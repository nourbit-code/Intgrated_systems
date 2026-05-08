from datetime import timedelta

from django.contrib.auth.models import Group, User
from django.core.management.base import BaseCommand
from django.db import transaction
from django.utils import timezone

from clinic.models import Appointment, Doctor, MedicalRecord, Patient, Prescription
from pharmacy.models import DrugInventory, GoodsReceipt, GoodsReceiptLine, Invoice, PurchaseOrder, PurchaseOrderLine, Supplier


class Command(BaseCommand):
    help = 'Seed demo data for the pharmacy integration.'

    @transaction.atomic
    def handle(self, *args, **options):
        self._seed_roles_and_users()

        doctors = [
            {'full_name': 'Dr. Salma Hassan', 'specialty': 'Family Medicine'},
            {'full_name': 'Dr. Nader Ali', 'specialty': 'Internal Medicine'},
        ]

        patients = [
            {'full_name': 'Mona Hassan', 'phone': '0100000001'},
            {'full_name': 'Youssef Ali', 'phone': '0100000002'},
            {'full_name': 'Hala Ibrahim', 'phone': '0100000003'},
            {'full_name': 'Karim Saad', 'phone': '0100000004'},
        ]

        doctor_objs = []
        for doctor in doctors:
            obj, _ = Doctor.objects.get_or_create(**doctor)
            doctor_objs.append(obj)

        patient_objs = []
        for patient in patients:
            obj, _ = Patient.objects.get_or_create(**patient)
            patient_objs.append(obj)

        now = timezone.now()
        for i, patient in enumerate(patient_objs):
            Appointment.objects.get_or_create(
                patient=patient,
                doctor=doctor_objs[i % len(doctor_objs)],
                scheduled_at=now + timedelta(hours=i + 1),
                defaults={'status': 'Scheduled'},
            )

        record, _ = MedicalRecord.objects.get_or_create(
            patient=patient_objs[0],
            doctor=doctor_objs[0],
            diagnosis='Upper respiratory infection',
            defaults={'notes': 'Encourage hydration and rest.'},
        )

        Prescription.objects.get_or_create(
            medical_record=record,
            patient=record.patient,
            doctor=record.doctor,
            medication='Amoxicillin 250mg',
            dosage='1 capsule twice daily',
            defaults={'instructions': 'Take after meals.'},
        )
        Prescription.objects.get_or_create(
            medical_record=record,
            patient=record.patient,
            doctor=record.doctor,
            medication='Paracetamol 500mg',
            dosage='1 tablet every 8 hours',
            defaults={'instructions': 'Max 3 tablets per day.'},
        )

        inventory_items = [
            {'sku': 'RX-1021', 'name': 'Paracetamol 500mg', 'quantity': 164, 'low_stock_threshold': 40},
            {'sku': 'RX-2034', 'name': 'Amoxicillin 250mg', 'quantity': 38, 'low_stock_threshold': 50},
            {'sku': 'RX-1180', 'name': 'Ibuprofen 400mg', 'quantity': 92, 'low_stock_threshold': 30},
            {'sku': 'RX-4402', 'name': 'Vitamin D3 1000IU', 'quantity': 21, 'low_stock_threshold': 25},
        ]
        for item in inventory_items:
            DrugInventory.objects.update_or_create(
                sku=item['sku'],
                defaults=item,
            )

        supplier, _ = Supplier.objects.get_or_create(
            code='SUP-001',
            defaults={
                'name': 'Cairo Medical Supply',
                'contact_person': 'Laila Omar',
                'phone': '0122000000',
                'email': 'orders@cairomed.example',
            },
        )

        product_map = {item.product.sku: item.product for item in DrugInventory.objects.select_related('product')}
        purchase_order, _ = PurchaseOrder.objects.get_or_create(
            reference='PO-1001',
            defaults={
                'supplier': supplier,
                'status': PurchaseOrder.STATUS_ORDERED,
                'ordered_by': 'inventory',
                'notes': 'Weekly replenishment for fast-moving medicines.',
            },
        )
        if purchase_order.lines.count() == 0:
            PurchaseOrderLine.objects.create(
                purchase_order=purchase_order,
                product=product_map['RX-2034'],
                ordered_quantity=80,
                unit_cost='14.50',
            )
            PurchaseOrderLine.objects.create(
                purchase_order=purchase_order,
                product=product_map['RX-4402'],
                ordered_quantity=60,
                unit_cost='11.20',
            )
            purchase_order.refresh_receiving_status()

        receipt, _ = GoodsReceipt.objects.get_or_create(
            reference='GRN-1001',
            defaults={
                'purchase_order': purchase_order,
                'supplier': supplier,
                'status': GoodsReceipt.STATUS_DRAFT,
                'received_by': 'inventory',
                'notes': 'First partial delivery.',
            },
        )
        if receipt.lines.count() == 0:
            po_lines = list(purchase_order.lines.select_related('product'))
            for line in po_lines:
                GoodsReceiptLine.objects.create(
                    receipt=receipt,
                    purchase_order_line=line,
                    product=line.product,
                    quantity_received=20 if line.product.sku == 'RX-2034' else 15,
                    unit_cost=line.unit_cost,
                    lot_number=f'LOT-{line.product.sku[-3:]}-A',
                )

        Invoice.objects.get_or_create(
            patient=patient_objs[1],
            amount='72.50',
            defaults={'status': 'Pending'},
        )

        self.stdout.write(self.style.SUCCESS('Seeded demo data.'))

    def _seed_roles_and_users(self):
        role_users = {
            'admin': {'username': 'admin', 'password': 'Admin123!', 'is_staff': True, 'is_superuser': True},
            'pharmacist': {'username': 'pharmacist', 'password': 'Admin123!'},
            'cashier': {'username': 'cashier', 'password': 'Admin123!'},
            'inventory_clerk': {'username': 'inventory', 'password': 'Admin123!'},
            'doctor': {'username': 'doctor', 'password': 'Admin123!'},
            'receptionist': {'username': 'reception', 'password': 'Admin123!'},
        }

        for role_name, config in role_users.items():
            group, _ = Group.objects.get_or_create(name=role_name)
            user, created = User.objects.get_or_create(
                username=config['username'],
                defaults={
                    'is_staff': config.get('is_staff', False),
                    'is_superuser': config.get('is_superuser', False),
                },
            )

            password = config['password']
            if created or not user.check_password(password):
                user.set_password(password)

            user.is_staff = config.get('is_staff', user.is_staff)
            user.is_superuser = config.get('is_superuser', user.is_superuser)
            user.save()

            if role_name != 'admin':
                user.groups.add(group)
