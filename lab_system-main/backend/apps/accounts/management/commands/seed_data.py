from decimal import Decimal

from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand
from django.utils import timezone

from apps.appointments.models import Appointment
from apps.audit.models import ActivityLog
from apps.billing.models import Invoice, Payment
from apps.inventory.models import InventoryItem, InventoryTransaction
from apps.lab.models import LabResult, LabTestOrder, LabTestType
from apps.patients.models import Patient
from apps.scans.models import ScanOrder, ScanResult, ScanType


class Command(BaseCommand):
    help = "Seed initial demo data for local development"

    def handle(self, *args, **options):
        User = get_user_model()
        now = timezone.now()

        admin, created = User.objects.get_or_create(
            username="admin",
            defaults={
                "email": "admin@example.com",
                "role": "LAB_TECH",
                "is_staff": True,
                "is_superuser": True,
            },
        )
        if created:
            admin.set_password("ChangeMe123!")
            admin.save()

        lab_tech_user, _ = User.objects.get_or_create(
            username="dr_salim",
            defaults={
                "email": "dr.salim@example.com",
                "role": "LAB_TECH",
            },
        )
        if not lab_tech_user.has_usable_password():
            lab_tech_user.set_password("ChangeMe123!")
            lab_tech_user.save()

        receptionist, _ = User.objects.get_or_create(
            username="reception_1",
            defaults={
                "email": "reception@example.com",
                "role": "RECEPTIONIST",
            },
        )
        if not receptionist.has_usable_password():
            receptionist.set_password("ChangeMe123!")
            receptionist.save()

        lab_tech, _ = User.objects.get_or_create(
            username="labtech_1",
            defaults={
                "email": "labtech@example.com",
                "role": "LAB_TECH",
            },
        )
        if not lab_tech.has_usable_password():
            lab_tech.set_password("ChangeMe123!")
            lab_tech.save()

        patient1, _ = Patient.objects.get_or_create(
            full_name="Sara Ali",
            defaults={
                "dob": "1992-05-12",
                "gender": "female",
                "phone": "01000000001",
                "primary_lab_tech": lab_tech_user,
                "consent_signed": True,
                "external_id": "PAT-0001",
            },
        )
        patient2, _ = Patient.objects.get_or_create(
            full_name="Omar Hassan",
            defaults={
                "dob": "1986-11-03",
                "gender": "male",
                "phone": "01000000002",
                "primary_lab_tech": lab_tech_user,
                "consent_signed": True,
                "external_id": "PAT-0002",
            },
        )
        patient3, _ = Patient.objects.get_or_create(
            full_name="Mona Samir",
            defaults={
                "dob": "1979-02-19",
                "gender": "female",
                "phone": "01000000003",
                "primary_lab_tech": lab_tech_user,
                "consent_signed": True,
                "external_id": "PAT-0003",
            },
        )

        cbc, _ = LabTestType.objects.get_or_create(
            code="CBC",
            defaults={
                "name": "Complete Blood Count",
                "category": "Hematology",
                "default_price": Decimal("150.00"),
                "turnaround_hours": 12,
            },
        )
        lipid, _ = LabTestType.objects.get_or_create(
            code="LIPID",
            defaults={
                "name": "Lipid Panel",
                "category": "Chemistry",
                "default_price": Decimal("200.00"),
                "turnaround_hours": 24,
            },
        )
        glucose, _ = LabTestType.objects.get_or_create(
            code="GLUCOSE",
            defaults={
                "name": "Blood Glucose",
                "category": "Chemistry",
                "default_price": Decimal("90.00"),
                "result_unit": "mg/dL",
                "reference_min": Decimal("70.00"),
                "reference_max": Decimal("140.00"),
                "turnaround_hours": 12,
            },
        )
        vitamin_d, _ = LabTestType.objects.get_or_create(
            code="VITAMIN-D",
            defaults={
                "name": "Vitamin D",
                "category": "Chemistry",
                "default_price": Decimal("200.00"),
                "result_unit": "ng/mL",
                "reference_min": Decimal("30.00"),
                "reference_max": Decimal("100.00"),
                "turnaround_hours": 24,
            },
        )

        xray, _ = ScanType.objects.get_or_create(
            code="XRAY",
            defaults={
                "name": "Chest X-Ray",
                "modality": "X-Ray",
                "default_price": Decimal("350.00"),
                "turnaround_hours": 24,
            },
        )
        mri, _ = ScanType.objects.get_or_create(
            code="MRI",
            defaults={
                "name": "Brain MRI",
                "modality": "MRI",
                "default_price": Decimal("1200.00"),
                "turnaround_hours": 48,
            },
        )

        appt1, _ = Appointment.objects.get_or_create(
            patient=patient1,
            scheduled_at=now,
            type="LAB_TEST",
            defaults={
                "created_by": receptionist,
                "status": "confirmed",
            },
        )
        appt2, _ = Appointment.objects.get_or_create(
            patient=patient2,
            scheduled_at=now,
            type="SCAN",
            defaults={
                "created_by": receptionist,
                "status": "confirmed",
            },
        )

        lab_order, _ = LabTestOrder.objects.get_or_create(
            appointment=appt1,
            test_type=cbc,
            defaults={
                "status": "completed",
                "price": Decimal("150.00"),
                "sample_collected_at": now,
            },
        )
        LabResult.objects.get_or_create(
            lab_test_order=lab_order,
            defaults={
                "result_text": "Hemoglobin and WBC within normal ranges.",
                "normal_range": "See reference",
                "reported_at": now,
                "reported_by": lab_tech,
            },
        )

        scan_order, _ = ScanOrder.objects.get_or_create(
            appointment=appt2,
            scan_type=xray,
            defaults={
                "status": "completed",
                "price": Decimal("350.00"),
                "performed_at": now,
            },
        )
        ScanResult.objects.get_or_create(
            scan_order=scan_order,
            defaults={
                "finding_text": "No acute cardiopulmonary findings.",
                "reported_at": now,
                "reported_by": lab_tech,
            },
        )

        item1, _ = InventoryItem.objects.get_or_create(
            sku="LAB-GLV",
            defaults={
                "name": "Latex Gloves",
                "unit": "box",
                "quantity": Decimal("24"),
                "reorder_level": Decimal("10"),
                "unit_cost": Decimal("55.00"),
            },
        )
        InventoryTransaction.objects.get_or_create(
            item=item1,
            delta=Decimal("-1"),
            defaults={
                "reason": "Used in lab tests",
                "created_by": lab_tech,
            },
        )

        invoice, _ = Invoice.objects.get_or_create(
            patient=patient1,
            appointment=appt1,
            defaults={
                "total": Decimal("150.00"),
                "paid": True,
                "status": "paid",
            },
        )
        Payment.objects.get_or_create(
            invoice=invoice,
            amount=Decimal("150.00"),
            method="cash",
            paid_at=now,
        )

        ActivityLog.objects.get_or_create(
            user=admin,
            action="seed",
            entity_type="System",
            entity_id="seed",
        )

        self.stdout.write(self.style.SUCCESS("Seed data created."))



