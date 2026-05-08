from decimal import Decimal
import time

from django.db import OperationalError
from django.db import transaction
from django.utils import timezone
from rest_framework import mixins, permissions, status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from clinic.models import Appointment, MedicalRecord, Patient, Prescription
from clinic.serializers import (
    AppointmentSerializer,
    FrontendPrescriptionCreateSerializer,
    MedicalRecordSerializer,
    PatientSerializer,
    PrescriptionSerializer,
    PrescriptionUpdateSerializer,
)
from config.permissions import ClinicalAccessPermission, DoctorWorkflowPermission
from pharmacy.models import DrugInventory, Invoice, InvoiceLine, PharmacyOrder, PharmacyOrderItem, StockMovement
from pharmacy.serializers import PharmacyOrderItemSerializer, PharmacyOrderPreparationSerializer
from pharmacy.utils import build_prepared_line, parse_prescription_medications


MONEY_PLACES = Decimal('0.01')


def money(value):
    return Decimal(str(value or 0)).quantize(MONEY_PLACES)


class PatientViewSet(viewsets.ModelViewSet):
    queryset = Patient.objects.all().order_by('-created_at')
    serializer_class = PatientSerializer
    permission_classes = [ClinicalAccessPermission]


class AppointmentViewSet(viewsets.ModelViewSet):
    queryset = Appointment.objects.select_related('patient', 'doctor').order_by('-scheduled_at')
    serializer_class = AppointmentSerializer
    permission_classes = [ClinicalAccessPermission]


class MedicalRecordViewSet(viewsets.ModelViewSet):
    queryset = MedicalRecord.objects.select_related('patient', 'doctor').order_by('-created_at')
    serializer_class = MedicalRecordSerializer
    permission_classes = [DoctorWorkflowPermission]
    http_method_names = ['post', 'head', 'options']


class PrescriptionViewSet(
    mixins.ListModelMixin,
    mixins.RetrieveModelMixin,
    mixins.CreateModelMixin,
    mixins.UpdateModelMixin,
    viewsets.GenericViewSet,
):
    queryset = Prescription.objects.select_related(
        'patient',
        'doctor',
        'medical_record',
        'pharmacy_order',
        'pharmacy_order__invoice',
    ).prefetch_related(
        'pharmacy_order__items__inventory',
    ).order_by('-created_at')
    permission_classes = [DoctorWorkflowPermission]
    LOCK_RETRY_ATTEMPTS = 4
    LOCK_RETRY_DELAY_SECONDS = 0.35

    def _controlled_map_for_medications(self, medication_names):
        names = [str(name or '').strip() for name in medication_names if str(name or '').strip()]
        if not names:
            return {}
        normalized = {name.casefold(): False for name in names}
        for item in DrugInventory.objects.filter(name__in=list(set(names))).values('name', 'controlled'):
            normalized[str(item['name']).casefold()] = bool(item['controlled'])
        return normalized

    def _ensure_order(self, prescription):
        order, _ = PharmacyOrder.objects.get_or_create(
            prescription=prescription,
            defaults={
                'patient': prescription.patient,
                'status': 'New',
            },
        )
        if order.patient_id != prescription.patient_id:
            order.patient = prescription.patient
            order.save(update_fields=['patient'])
        return order

    def _serialize_prepared_preview(self, prepared_line):
        inventory = prepared_line.get('inventory')
        return {
            'source_name': prepared_line['source_name'],
            'medicine_name': prepared_line['medicine_name'],
            'dosage': prepared_line['dosage'],
            'quantity': prepared_line['quantity'],
            'available_quantity': prepared_line['available_quantity'],
            'unit_price': str(money(prepared_line['unit_price'])),
            'line_total': str(money(prepared_line['line_total'])),
            'in_stock': prepared_line['in_stock'],
            'notes': prepared_line['notes'],
            'sort_order': prepared_line['sort_order'],
            'inventory_sku': prepared_line['inventory_sku'],
            'inventory_name': getattr(inventory, 'name', ''),
        }

    def _build_suggested_items(self, prescription):
        suggested_items = []
        for index, item in enumerate(parse_prescription_medications(prescription)):
            prepared_line = build_prepared_line({**item, 'sort_order': index})
            inventory = prepared_line.get('inventory')
            if inventory is not None:
                available_quantity = inventory.quantity_available()
                prepared_line['available_quantity'] = available_quantity
                prepared_line['in_stock'] = available_quantity >= prepared_line['quantity']
            suggested_items.append(self._serialize_prepared_preview(prepared_line))
        return suggested_items

    def _get_order_invoice(self, order):
        try:
            return order.invoice
        except Invoice.DoesNotExist:
            return None

    def _sync_invoice_lines(self, invoice, prepared_items, order):
        invoice.lines.all().delete()
        billable_items = [item for item in prepared_items if item['in_stock']]
        InvoiceLine.objects.bulk_create(
            [
                InvoiceLine(
                    invoice=invoice,
                    inventory=item['inventory'],
                    sku=getattr(item['inventory'], 'sku', ''),
                    description=item['medicine_name'],
                    quantity=item['quantity'],
                    unit_price=item['unit_price'],
                    line_total=item['line_total'],
                    source_type='Prescription',
                    source_reference=f'order:{order.pk}',
                    notes=item['notes'],
                )
                for item in billable_items
            ]
        )

    def _release_reserved_items(self, order):
        if order.stock_reserved_at is None or order.stock_deducted_at is not None:
            return
        for item in order.items.select_related('inventory'):
            inventory = item.inventory
            if inventory is None or not item.in_stock:
                continue
            inventory.release_reserved_stock(
                item.quantity,
                reference=f'pharmacy-order:{order.pk}',
                notes=f'Released reservation for order {order.pk}.',
            )

    def _reserve_prepared_items(self, order, prepared_items):
        reserved_any = False
        for item in prepared_items:
            inventory = item['inventory']
            if inventory is None or not item['in_stock']:
                continue
            inventory.reserve_stock(
                item['quantity'],
                reference=f'pharmacy-order:{order.pk}',
                notes=f'Reserved stock for order {order.pk}.',
            )
            reserved_any = True
        return reserved_any

    def _build_summary(self, items, tax_rate):
        subtotal = money(sum(money(item.get('line_total', 0)) for item in items if item.get('in_stock')))
        tax_amount = money(subtotal * Decimal(str(tax_rate or 0)) / Decimal('100'))
        total_amount = money(subtotal + tax_amount)
        missing_items = [item for item in items if not item.get('in_stock')]
        return {
            'subtotal': str(subtotal),
            'tax_rate': str(money(tax_rate)),
            'tax_amount': str(tax_amount),
            'total_amount': str(total_amount),
            'missing_items_count': len(missing_items),
            'prepared_items_count': len(items) - len(missing_items),
        }

    def _build_preparation_response(self, prescription, order):
        if order.pk and order.items.exists():
            items = PharmacyOrderItemSerializer(order.items.all(), many=True).data
        else:
            items = self._build_suggested_items(prescription)

        summary = self._build_summary(items, order.tax_rate or Decimal('14'))
        invoice = self._get_order_invoice(order)
        return {
            'prescription_id': prescription.pk,
            'patient_id': prescription.patient_id,
            'patient_name': prescription.patient.full_name,
            'doctor_name': getattr(prescription.doctor, 'full_name', 'Clinic Doctor'),
            'prescription_status': 'New' if order.status == 'Pending' else order.status,
            'prescription_notes': prescription.instructions,
            'order_id': order.pk,
            'order_status': 'New' if order.status == 'Pending' else order.status,
            'prepared_notes': order.prepared_notes,
            'prepared_at': order.prepared_at,
            'items': items,
            'summary': summary,
            'invoice': {
                'id': getattr(invoice, 'id', None),
                'status': getattr(invoice, 'status', None),
                'amount': str(getattr(invoice, 'amount', summary['total_amount'])) if invoice else summary['total_amount'],
            },
        }

    def _save_prepared_order(self, prescription, order, validated_data):
        items_data = validated_data.get('items', [])
        prepared_items = []
        for index, item in enumerate(items_data):
            prepared_line = build_prepared_line({**item, 'sort_order': item.get('sort_order', index)})
            if not prepared_line['medicine_name']:
                continue
            inventory = prepared_line.get('inventory')
            if inventory is not None:
                available_quantity = inventory.quantity_available()
                if order.stock_reserved_at is not None and order.stock_deducted_at is None:
                    existing_reserved = order.items.filter(
                        inventory=inventory,
                        in_stock=True,
                    ).exclude(pk=getattr(item, 'pk', None))
                    available_quantity += sum(existing_reserved.values_list('quantity', flat=True))
                prepared_line['available_quantity'] = available_quantity
                prepared_line['in_stock'] = available_quantity >= prepared_line['quantity']
            prepared_items.append(prepared_line)

        if not prepared_items:
            raise ValueError('Add at least one medicine before marking the prescription ready.')

        tax_rate = money(order.tax_rate or Decimal('14'))
        subtotal = money(sum(item['line_total'] for item in prepared_items if item['in_stock']))
        tax_amount = money(subtotal * tax_rate / Decimal('100'))
        total_amount = money(subtotal + tax_amount)
        missing_items_count = sum(1 for item in prepared_items if not item['in_stock'])

        with transaction.atomic():
            self._release_reserved_items(order)
            order.items.all().delete()
            PharmacyOrderItem.objects.bulk_create(
                [
                    PharmacyOrderItem(
                        order=order,
                        inventory=item['inventory'],
                        source_name=item['source_name'],
                        medicine_name=item['medicine_name'],
                        dosage=item['dosage'],
                        quantity=item['quantity'],
                        available_quantity=item['available_quantity'],
                        unit_price=item['unit_price'],
                        line_total=item['line_total'],
                        in_stock=item['in_stock'],
                        notes=item['notes'],
                        sort_order=item['sort_order'],
                    )
                    for item in prepared_items
                ]
            )

            order.prepared_notes = validated_data.get('notes', '')
            order.subtotal = subtotal
            order.tax_rate = tax_rate
            order.tax_amount = tax_amount
            order.total_amount = total_amount
            order.missing_items_count = missing_items_count
            order.prepared_at = timezone.now()
            order.status = 'Ready' if any(item['in_stock'] for item in prepared_items) else 'Preparing'
            order.stock_reserved_at = None
            order.save(
                update_fields=[
                    'prepared_notes',
                    'subtotal',
                    'tax_rate',
                    'tax_amount',
                    'total_amount',
                    'missing_items_count',
                    'prepared_at',
                    'status',
                    'stock_reserved_at',
                ]
            )

            invoice = self._get_order_invoice(order)
            if invoice is None:
                invoice = Invoice.objects.create(
                    patient=prescription.patient,
                    order=order,
                    invoice_type=Invoice.TYPE_PRESCRIPTION,
                    source_reference=f'prescription:{prescription.pk}',
                    subtotal=subtotal,
                    tax_amount=tax_amount,
                    discount_amount=Decimal('0.00'),
                    amount=total_amount,
                    status='Pending',
                )
            else:
                update_fields = []
                if invoice.patient_id != prescription.patient_id:
                    invoice.patient = prescription.patient
                    update_fields.append('patient')
                invoice.amount = total_amount
                update_fields.append('amount')
                invoice.invoice_type = Invoice.TYPE_PRESCRIPTION
                update_fields.append('invoice_type')
                invoice.source_reference = f'prescription:{prescription.pk}'
                update_fields.append('source_reference')
                invoice.subtotal = subtotal
                update_fields.append('subtotal')
                invoice.tax_amount = tax_amount
                update_fields.append('tax_amount')
                invoice.discount_amount = Decimal('0.00')
                update_fields.append('discount_amount')
                if not invoice.order_id:
                    invoice.order = order
                    update_fields.append('order')
                invoice.save(update_fields=update_fields)

            self._sync_invoice_lines(invoice, prepared_items, order)

            if self._reserve_prepared_items(order, prepared_items):
                order.stock_reserved_at = timezone.now()
                order.save(update_fields=['stock_reserved_at'])
            else:
                order.stock_reserved_at = None
                order.save(update_fields=['stock_reserved_at'])

        order.refresh_from_db()
        return self._build_preparation_response(prescription, order)

    def get_serializer_class(self):
        if self.action == 'create':
            return FrontendPrescriptionCreateSerializer
        if self.action in {'update', 'partial_update'}:
            return PrescriptionUpdateSerializer
        return PrescriptionSerializer

    def list(self, request, *args, **kwargs):
        queryset = self.filter_queryset(self.get_queryset())
        controlled_map = self._controlled_map_for_medications(
            [getattr(prescription, 'medication', '') for prescription in queryset]
        )
        for prescription in queryset:
            prescription._inventory_by_name = controlled_map
        serializer = self.get_serializer(queryset, many=True, context=super().get_serializer_context())
        return Response(serializer.data)

    def create(self, request, *args, **kwargs):
        prescription = None
        last_error = None
        for attempt in range(1, self.LOCK_RETRY_ATTEMPTS + 1):
            serializer = self.get_serializer(data=request.data)
            serializer.is_valid(raise_exception=True)
            try:
                prescription = serializer.save()
                last_error = None
                break
            except OperationalError as exc:
                if 'database is locked' not in str(exc).lower() or attempt == self.LOCK_RETRY_ATTEMPTS:
                    last_error = exc
                    break
                time.sleep(self.LOCK_RETRY_DELAY_SECONDS * attempt)
                last_error = exc

        if last_error is not None:
            return Response(
                {'detail': 'Database is busy. Please retry in a moment.'},
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )

        prescription._inventory_by_name = self._controlled_map_for_medications([prescription.medication])
        output = PrescriptionSerializer(prescription, context=super().get_serializer_context())
        headers = self.get_success_headers(output.data)
        return Response(output.data, status=status.HTTP_201_CREATED, headers=headers)

    def partial_update(self, request, *args, **kwargs):
        instance = self.get_object()
        serializer = self.get_serializer(instance, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        prescription = serializer.save()
        prescription._inventory_by_name = self._controlled_map_for_medications([prescription.medication])
        output = PrescriptionSerializer(prescription, context=super().get_serializer_context())
        return Response(output.data)

    @action(detail=True, methods=['get'], url_path='preparation')
    def preparation(self, request, pk=None):
        prescription = self.get_object()
        order = self._ensure_order(prescription)
        return Response(self._build_preparation_response(prescription, order))

    @action(detail=True, methods=['post'], url_path='prepare-order')
    def prepare_order(self, request, pk=None):
        prescription = self.get_object()
        order = self._ensure_order(prescription)
        serializer = PharmacyOrderPreparationSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        try:
            payload = self._save_prepared_order(prescription, order, serializer.validated_data)
        except ValueError as exc:
            return Response({'detail': str(exc)}, status=status.HTTP_400_BAD_REQUEST)
        return Response(payload, status=status.HTTP_200_OK)

    @action(detail=True, methods=['post'], url_path='prepare-invoice')
    def prepare_invoice(self, request, pk=None):
        prescription = self.get_object()
        order = self._ensure_order(prescription)
        default_items = self._build_suggested_items(prescription)
        if not default_items:
            return Response(
                {'detail': 'No medicines were found on this prescription.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        try:
            payload = self._save_prepared_order(
                prescription,
                order,
                {
                    'notes': order.prepared_notes or prescription.instructions,
                    'items': default_items,
                },
            )
        except ValueError as exc:
            return Response({'detail': str(exc)}, status=status.HTTP_400_BAD_REQUEST)

        return Response(
            {
                'prescription_id': prescription.pk,
                'order_id': payload['order_id'],
                'order_status': payload['order_status'],
                'invoice_id': payload['invoice']['id'],
                'invoice_status': payload['invoice']['status'],
                'invoice_amount': payload['invoice']['amount'],
                'summary': payload['summary'],
                'items': payload['items'],
            },
            status=status.HTTP_201_CREATED,
        )
