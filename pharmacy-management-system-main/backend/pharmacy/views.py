from datetime import timedelta
from decimal import Decimal
import re

from django.db import transaction
from django.db.models import F, Q
from django.utils import timezone
import requests
from rest_framework import mixins, permissions, serializers, status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.views import APIView

from config.permissions import BillingAccessPermission, DispensingAccessPermission, InventoryAccessPermission
from pharmacy.models import (
    ClinicSupplyRequest,
    DrugInventory,
    GoodsReceipt,
    Invoice,
    InvoiceLine,
    MedicineProduct,
    PharmacyOrder,
    PurchaseOrder,
    StockLot,
    StockMovement,
    Supplier,
)
from pharmacy.serializers import (
    ClinicSupplyRequestSerializer,
    DirectInvoiceCreateSerializer,
    DrugInventorySerializer,
    GoodsReceiptSerializer,
    InvoiceSerializer,
    MedicineProductSerializer,
    PharmacyOrderSerializer,
    PurchaseOrderSerializer,
    SupplierSerializer,
    StockLotSerializer,
    StockMovementSerializer,
)


class MedicineProductViewSet(viewsets.ModelViewSet):
    queryset = MedicineProduct.objects.prefetch_related('stock_lots').order_by('name')
    serializer_class = MedicineProductSerializer
    permission_classes = [InventoryAccessPermission]
    lookup_field = 'sku'


class SupplierViewSet(viewsets.ModelViewSet):
    queryset = Supplier.objects.all().order_by('name')
    serializer_class = SupplierSerializer
    permission_classes = [InventoryAccessPermission]
    lookup_field = 'code'


class PurchaseOrderViewSet(viewsets.ModelViewSet):
    queryset = PurchaseOrder.objects.select_related('supplier').prefetch_related('lines__product').order_by('-created_at')
    serializer_class = PurchaseOrderSerializer
    permission_classes = [InventoryAccessPermission]
    lookup_field = 'reference'


class StockLotViewSet(viewsets.ModelViewSet):
    queryset = StockLot.objects.select_related('product').order_by('product__name', 'expiry_date', 'lot_number')
    serializer_class = StockLotSerializer
    permission_classes = [InventoryAccessPermission]


class StockMovementViewSet(mixins.ListModelMixin, mixins.RetrieveModelMixin, viewsets.GenericViewSet):
    queryset = StockMovement.objects.select_related('product', 'lot').order_by('-created_at')
    serializer_class = StockMovementSerializer
    permission_classes = [InventoryAccessPermission]
    http_method_names = ['get', 'head', 'options']


class GoodsReceiptViewSet(viewsets.ModelViewSet):
    queryset = GoodsReceipt.objects.select_related('supplier', 'purchase_order').prefetch_related(
        'lines__product',
        'lines__purchase_order_line',
    ).order_by('-created_at')
    serializer_class = GoodsReceiptSerializer
    permission_classes = [InventoryAccessPermission]
    lookup_field = 'reference'

    def perform_create(self, serializer):
        receipt = serializer.save()
        if receipt.status == GoodsReceipt.STATUS_POSTED:
            self._post_receipt(receipt)

    def perform_update(self, serializer):
        was_posted = serializer.instance.status == GoodsReceipt.STATUS_POSTED
        receipt = serializer.save()
        if not was_posted and receipt.status == GoodsReceipt.STATUS_POSTED:
            self._post_receipt(receipt)

    def _post_receipt(self, receipt):
        if receipt.posted_at is not None:
            return receipt

        with transaction.atomic():
            for line in receipt.lines.select_related('product', 'purchase_order_line'):
                quantity = int(line.quantity_received or 0)
                if quantity <= 0:
                    continue

                product = line.product
                inventory, _ = DrugInventory.objects.get_or_create(
                    sku=product.sku,
                    defaults={
                        'product': product,
                        'name': product.name,
                        'category': product.category,
                        'quantity': 0,
                        'expiry_date': line.expiry_date,
                        'low_stock_threshold': product.low_stock_threshold,
                        'batch_number': line.lot_number,
                        'barcode': product.barcode,
                        'supplier': receipt.supplier.name,
                        'price': line.unit_cost or product.default_price,
                        'controlled': product.controlled,
                    },
                )

                inventory.product = product
                inventory.name = product.name
                inventory.category = product.category
                inventory.low_stock_threshold = product.low_stock_threshold
                inventory.barcode = product.barcode
                inventory.supplier = receipt.supplier.name
                inventory.controlled = product.controlled
                inventory.price = line.unit_cost or product.default_price
                if line.expiry_date:
                    inventory.expiry_date = line.expiry_date
                if line.lot_number:
                    inventory.batch_number = line.lot_number
                inventory.quantity = max(0, inventory.quantity + quantity)
                inventory.save()
                inventory.record_stock_movement(
                    StockMovement.RECEIPT,
                    quantity,
                    reference=f'goods-receipt:{receipt.reference}',
                    notes=f'Received via goods receipt {receipt.reference}.',
                )

                po_line = line.purchase_order_line
                if po_line is not None:
                    po_line.received_quantity = max(0, po_line.received_quantity + quantity)
                    po_line.unit_cost = line.unit_cost or po_line.unit_cost
                    po_line.save(update_fields=['received_quantity', 'unit_cost'])

            posted_at = timezone.now()
            if receipt.received_at is None:
                receipt.received_at = posted_at
            receipt.posted_at = posted_at
            receipt.status = GoodsReceipt.STATUS_POSTED
            receipt.save(update_fields=['received_at', 'posted_at', 'status', 'updated_at'])

            if receipt.purchase_order_id:
                receipt.purchase_order.refresh_receiving_status()

        return receipt


class DrugInventoryViewSet(viewsets.ModelViewSet):
    queryset = DrugInventory.objects.all().order_by('name')
    serializer_class = DrugInventorySerializer
    permission_classes = [InventoryAccessPermission]
    lookup_field = 'sku'

    def get_queryset(self):
        queryset = super().get_queryset()
        limit_param = self.request.query_params.get('limit')
        if limit_param:
            try:
                limit_val = max(1, min(int(limit_param), 2000))
                queryset = queryset[:limit_val]
            except ValueError:
                pass
        return queryset

    @action(detail=False, methods=['get'], url_path='low-stock')
    def low_stock(self, request):
        queryset = self.get_queryset().filter(
            quantity__lte=F('low_stock_threshold'),
            low_stock_threshold__gt=0,
        )
        serializer = self.get_serializer(queryset, many=True)
        return Response(serializer.data)


class PharmacyOrderViewSet(
    mixins.ListModelMixin,
    mixins.RetrieveModelMixin,
    mixins.UpdateModelMixin,
    viewsets.GenericViewSet,
):
    queryset = PharmacyOrder.objects.select_related('patient', 'prescription', 'invoice').prefetch_related(
        'items__inventory'
    ).order_by('-created_at')
    serializer_class = PharmacyOrderSerializer
    permission_classes = [DispensingAccessPermission]
    http_method_names = ['get', 'patch', 'head', 'options']

    def _release_reservations(self, order):
        if order.stock_reserved_at is None or order.stock_deducted_at is not None:
            return
        with transaction.atomic():
            for item in order.items.select_related('inventory'):
                inventory = item.inventory
                if inventory is None or not item.in_stock:
                    continue
                inventory.release_reserved_stock(
                    item.quantity,
                    reference=f'pharmacy-order:{order.pk}',
                    notes=f'Released reservation for order {order.pk}.',
                )
            order.stock_reserved_at = None
            order.save(update_fields=['stock_reserved_at'])

    def _dispense_order(self, order):
        if order.stock_deducted_at is not None:
            if order.status != 'Dispensed':
                order.status = 'Dispensed'
                order.save(update_fields=['status'])
            return order

        with transaction.atomic():
            for item in order.items.select_related('inventory'):
                inventory = item.inventory
                if inventory is None or not item.in_stock:
                    continue
                inventory.dispense_reserved_stock(
                    item.quantity,
                    reference=f'pharmacy-order:{order.pk}',
                    notes=f'Dispensed stock for order {order.pk}.',
                )
            now = timezone.now()
            order.status = 'Dispensed'
            order.stock_reserved_at = None
            order.stock_deducted_at = now
            order.dispensed_at = now
            order.save(update_fields=['status', 'stock_reserved_at', 'stock_deducted_at', 'dispensed_at'])
        return order

    def perform_update(self, serializer):
        previous_status = serializer.instance.status
        order = serializer.save()
        new_status = order.status

        if new_status == 'Dispensed':
            self._dispense_order(order)
            return

        if previous_status == 'Ready' and new_status in {'New', 'Preparing'}:
            self._release_reservations(order)

    @action(detail=True, methods=['post'], url_path='dispense')
    def dispense(self, request, pk=None):
        order = self.get_object()
        self._dispense_order(order)
        serializer = self.get_serializer(order)
        return Response(serializer.data, status=status.HTTP_200_OK)


class InvoiceViewSet(viewsets.ModelViewSet):
    queryset = Invoice.objects.select_related('patient', 'order').prefetch_related('lines__inventory').order_by('-created_at')
    serializer_class = InvoiceSerializer
    permission_classes = [BillingAccessPermission]
    http_method_names = ['get', 'post', 'patch', 'head', 'options']

    def get_queryset(self):
        queryset = super().get_queryset()
        invoice_type = self.request.query_params.get('invoice_type')
        if invoice_type:
            queryset = queryset.filter(invoice_type=invoice_type)
        return queryset

    def get_serializer_class(self):
        if self.action == 'create':
            return DirectInvoiceCreateSerializer
        return InvoiceSerializer

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        invoice = self._create_direct_invoice(serializer.validated_data)
        output = InvoiceSerializer(invoice)
        return Response(output.data, status=status.HTTP_201_CREATED)

    def perform_update(self, serializer):
        previous_status = serializer.instance.status
        invoice = serializer.save()
        if previous_status != 'Refunded' and invoice.status == 'Refunded':
            self._apply_refund(invoice)

    def _create_direct_invoice(self, validated_data):
        from clinic.utils import resolve_patient

        lines_data = validated_data.get('lines', [])
        patient_value = str(validated_data.get('patient', '')).strip()
        patient = resolve_patient(patient_value or 'Walk-in Customer')
        payment_method = str(validated_data.get('payment_method', '')).strip()
        source_reference = str(validated_data.get('source_reference', '')).strip()
        notes = str(validated_data.get('notes', '')).strip()
        requested_status = str(validated_data.get('status', '')).strip().title() or 'Pending'
        tax_amount = Decimal(str(validated_data.get('tax_amount', 0) or 0))
        discount_amount = Decimal(str(validated_data.get('discount_amount', 0) or 0))

        invoice_lines = []
        subtotal = Decimal('0.00')
        stock_updates = []
        for line_data in lines_data:
            sku = str(line_data['sku']).strip()
            inventory = DrugInventory.objects.filter(sku__iexact=sku).first()
            if inventory is None:
                raise serializers.ValidationError({'lines': [f'Inventory item {sku} was not found.']})

            quantity = int(line_data['quantity'])
            if quantity > inventory.quantity_available():
                raise serializers.ValidationError(
                    {'lines': [f'Only {inventory.quantity_available()} unit(s) of {inventory.name} are available.']}
                )

            unit_price = Decimal(str(line_data.get('unit_price') or inventory.price or 0))
            line_total = (unit_price * quantity).quantize(Decimal('0.01'))
            subtotal += line_total
            invoice_lines.append(
                {
                    'inventory': inventory,
                    'sku': inventory.sku,
                    'description': str(line_data.get('description') or inventory.name),
                    'quantity': quantity,
                    'unit_price': unit_price,
                    'line_total': line_total,
                    'source_type': 'Direct Sale',
                    'source_reference': source_reference,
                }
            )
            stock_updates.append((inventory, quantity))

        amount = max(Decimal('0.00'), subtotal + tax_amount - discount_amount).quantize(Decimal('0.01'))

        with transaction.atomic():
            invoice = Invoice.objects.create(
                patient=patient,
                invoice_type=Invoice.TYPE_DIRECT,
                source_reference=source_reference,
                subtotal=subtotal,
                tax_amount=tax_amount,
                discount_amount=discount_amount,
                amount=amount,
                status=requested_status,
                payment_method=payment_method,
                notes=notes,
            )

            InvoiceLine.objects.bulk_create(
                [InvoiceLine(invoice=invoice, **line) for line in invoice_lines]
            )

            for inventory, quantity in stock_updates:
                inventory.dispense_stock(
                    quantity,
                    reference=f'invoice:{invoice.reference or invoice.pk}',
                    notes=f'Direct sale invoice {invoice.reference or invoice.pk}.',
                )

        invoice.refresh_from_db()
        return invoice

    def _apply_refund(self, invoice):
        if invoice.invoice_type != Invoice.TYPE_DIRECT:
            return
        with transaction.atomic():
            for line in invoice.lines.select_related('inventory'):
                inventory = line.inventory
                if inventory is None:
                    continue
                inventory.return_stock(
                    int(line.quantity),
                    reference=f'invoice-refund:{invoice.reference or invoice.pk}',
                    notes=f'Refunded direct sale invoice {invoice.reference or invoice.pk}.',
                )


class ClinicSupplyRequestViewSet(viewsets.ModelViewSet):
    queryset = ClinicSupplyRequest.objects.select_related('inventory').order_by('-created_at')
    serializer_class = ClinicSupplyRequestSerializer
    permission_classes = [InventoryAccessPermission]

    def _apply_fulfillment(self, request_obj):
        if request_obj.quantity <= 0:
            return

        inventory = request_obj.inventory
        if inventory is None and request_obj.sku:
            inventory = DrugInventory.objects.filter(sku__iexact=request_obj.sku).first()
        if inventory is None and request_obj.item_name:
            inventory = DrugInventory.objects.filter(name__iexact=request_obj.item_name).first()
        if inventory is None:
            return

        if request_obj.inventory_id != inventory.pk:
            request_obj.inventory = inventory
            request_obj.save(update_fields=['inventory'])

        inventory.quantity = max(0, inventory.quantity - request_obj.quantity)
        inventory.save(update_fields=['quantity'])
        inventory.record_stock_movement(
            StockMovement.FULFILLMENT,
            -request_obj.quantity,
            reference=f'clinic-request:{request_obj.pk}',
            notes=f'Fulfilled clinic request for {request_obj.item_name}.',
        )

    def perform_create(self, serializer):
        request_obj = serializer.save()
        if request_obj.status == 'Fulfilled':
            self._apply_fulfillment(request_obj)

    def perform_update(self, serializer):
        previous = self.get_object()
        request_obj = serializer.save()
        if previous.status != 'Fulfilled' and request_obj.status == 'Fulfilled':
            self._apply_fulfillment(request_obj)


class AlertListView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        today = timezone.localdate()
        now = timezone.localtime()
        expiring_cutoff = today + timedelta(days=30)
        alerts = []

        low_stock_items = DrugInventory.objects.filter(
            quantity__lte=F('low_stock_threshold'),
            low_stock_threshold__gt=0,
        ).order_by('quantity', 'name')[:20]
        for item in low_stock_items:
            alerts.append(
                {
                    'id': f'low-stock-{item.pk}',
                    'time': now.strftime('%H:%M'),
                    'message': f'{item.name} is below its stock threshold.',
                    'status': 'Alert',
                    'type': 'Alert',
                    'related': item.sku,
                    'page': 'Inventory',
                }
            )

        expiring_items = DrugInventory.objects.filter(
            expiry_date__isnull=False,
            expiry_date__lte=expiring_cutoff,
        ).order_by('expiry_date', 'name')[:20]
        for item in expiring_items:
            expiry_label = 'expired' if item.expiry_date < today else f'expires on {item.expiry_date.isoformat()}'
            alerts.append(
                {
                    'id': f'expiry-{item.pk}',
                    'time': now.strftime('%H:%M'),
                    'message': f'{item.name} {expiry_label}.',
                    'status': 'Alert',
                    'type': 'Alert',
                    'related': item.sku,
                    'page': 'Inventory',
                }
            )

        active_orders = PharmacyOrder.objects.select_related('patient', 'prescription').exclude(
            status='Dispensed'
        ).order_by('-created_at')[:20]
        for order in active_orders:
            alerts.append(
                {
                    'id': f'order-{order.pk}',
                    'time': timezone.localtime(order.created_at).strftime('%H:%M'),
                    'message': f'Prescription for {order.patient.full_name} is {order.status}.',
                    'status': 'Unread',
                    'type': 'Unread',
                    'related': str(order.pk),
                    'page': 'Pharmacy Orders',
                }
            )

        open_requests = ClinicSupplyRequest.objects.exclude(status='Fulfilled').order_by('-created_at')[:20]
        for request_obj in open_requests:
            alerts.append(
                {
                    'id': f'clinic-request-{request_obj.pk}',
                    'time': timezone.localtime(request_obj.created_at).strftime('%H:%M'),
                    'message': f'Clinic request for {request_obj.item_name} is {request_obj.status}.',
                    'status': 'Unread',
                    'type': 'Unread',
                    'related': str(request_obj.pk),
                    'page': 'Inventory',
                }
            )

        return Response(alerts[:30])


class IntegrationMedicationCatalogView(APIView):
    permission_classes = [permissions.AllowAny]

    @staticmethod
    def _fallback_price_for_item(name, sku):
        seed = f'{name}|{sku}'
        total = sum(ord(ch) for ch in seed)
        return round(18.0 + ((total % 104) * 1.25), 2)

    def get(self, request):
        q = (request.query_params.get('q') or '').strip()
        limit_param = request.query_params.get('limit')
        # For clinic integration we prefer safe dispensing suggestions:
        # return only items that are actually in stock unless explicitly overridden.
        in_stock_only_param = str(request.query_params.get('in_stock_only', '')).strip().lower()
        allow_out_of_stock_param = str(request.query_params.get('allow_out_of_stock', '0')).strip().lower()
        allow_out_of_stock = allow_out_of_stock_param in {'1', 'true', 'yes'}
        if allow_out_of_stock:
            in_stock_only = in_stock_only_param not in {'', '0', 'false', 'no'}
        else:
            in_stock_only = True

        try:
            limit_val = max(1, min(int(limit_param or 30), 100))
        except ValueError:
            limit_val = 30

        base_queryset = DrugInventory.objects.all().order_by('name')
        queryset = base_queryset
        if in_stock_only:
            queryset = queryset.filter(quantity__gt=0)
        if q:
            queryset = queryset.filter(
                Q(name__icontains=q) |
                Q(category__icontains=q) |
                Q(sku__icontains=q) |
                Q(supplier__icontains=q)
            )

        # If strict stock filter returns nothing, gracefully fall back so clinic
        # can still display Egyptian medication names that exist in pharmacy.
        if in_stock_only and not queryset.exists():
            queryset = base_queryset
            if q:
                queryset = queryset.filter(
                    Q(name__icontains=q) |
                    Q(category__icontains=q) |
                    Q(sku__icontains=q) |
                    Q(supplier__icontains=q)
                )

        results = [
            {
                'id': item.sku,
                'sku': item.sku,
                'name': item.name,
                'category': item.category,
                'supplier': item.supplier,
                'quantity': item.quantity,
                'price': str(
                    item.price
                    if (item.price or Decimal('0')) > Decimal('0')
                    else self._fallback_price_for_item(item.name, item.sku)
                ),
                'in_stock': item.quantity > 0,
            }
            for item in queryset[:limit_val]
        ]
        return Response({'count': len(results), 'results': results})


class IntegrationPharmacyMedicationSyncView(APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        clinic_base = str(request.data.get('clinic_base_url') or 'http://127.0.0.1:8000/api').strip().rstrip('/')
        clinic_medications_url = f'{clinic_base}/medications/'
        initial_quantity = int(request.data.get('initial_quantity', 0) or 0)
        if initial_quantity < 0:
            initial_quantity = 0

        try:
            response = requests.get(
                clinic_medications_url,
                params={'limit': 5000},
                timeout=30,
            )
            response.raise_for_status()
            payload = response.json()
        except Exception as exc:
            return Response(
                {'success': False, 'error': f'Failed to fetch clinic medications: {exc}'},
                status=status.HTTP_502_BAD_GATEWAY,
            )

        medications = payload if isinstance(payload, list) else payload.get('results', [])
        if not isinstance(medications, list):
            medications = []

        created = 0
        updated = 0
        skipped = 0

        def build_sku(name, index):
            normalized = re.sub(r'[^A-Za-z0-9]+', '-', str(name or '').upper()).strip('-')
            head = normalized[:24] if normalized else f'MED-{index}'
            return f'EGY-{head}'

        with transaction.atomic():
            for index, med in enumerate(medications, start=1):
                name = str(med.get('name') or '').strip()
                if not name:
                    skipped += 1
                    continue
                category = str(med.get('category') or '').strip()
                supplier = str(med.get('manufacturer') or '').strip()
                price_raw = med.get('price') or 0
                try:
                    price = Decimal(str(price_raw))
                except Exception:
                    price = Decimal('0')

                sku = str(med.get('med_id') or '').strip() or build_sku(name, index)
                inventory = DrugInventory.objects.filter(Q(sku__iexact=sku) | Q(name__iexact=name)).first()
                if inventory is None:
                    DrugInventory.objects.create(
                        sku=sku[:40],
                        name=name[:120],
                        category=category[:120],
                        supplier=supplier[:120],
                        quantity=initial_quantity,
                        low_stock_threshold=10,
                        price=price,
                    )
                    created += 1
                else:
                    changed_fields = []
                    if not inventory.category and category:
                        inventory.category = category[:120]
                        changed_fields.append('category')
                    if not inventory.supplier and supplier:
                        inventory.supplier = supplier[:120]
                        changed_fields.append('supplier')
                    if (inventory.price or Decimal('0')) == Decimal('0') and price > 0:
                        inventory.price = price
                        changed_fields.append('price')
                    if changed_fields:
                        inventory.save(update_fields=changed_fields + ['updated_at'])
                        updated += 1
                    else:
                        skipped += 1

        return Response(
            {
                'success': True,
                'clinic_source': clinic_medications_url,
                'total_received': len(medications),
                'created': created,
                'updated': updated,
                'skipped': skipped,
                'initial_quantity_applied_to_new_items': initial_quantity,
            },
            status=status.HTTP_200_OK,
        )
