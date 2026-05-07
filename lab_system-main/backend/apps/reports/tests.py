from decimal import Decimal

from django.test import TestCase, override_settings
from django.utils import timezone
from rest_framework.test import APIClient

from apps.accounts.models import User
from apps.billing.models import Invoice, Payment
from apps.inventory.models import InventoryItem
from apps.patients.models import Patient


@override_settings(ALLOWED_HOSTS=["testserver", "127.0.0.1", "localhost"])
class ReportsApiTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.lab_tech_user = User.objects.create_user(
            username="lab_tech_reports",
            email="lab_tech_reports@example.com",
            password="LAB_TECHPass123!",
            role=User.Roles.LAB_TECH,
        )
        self.receptionist = User.objects.create_user(
            username="reception_reports",
            email="reception_reports@example.com",
            password="ReceptionPass123!",
            role=User.Roles.RECEPTIONIST,
        )
        self.lab_tech = User.objects.create_user(
            username="labtech_reports",
            email="labtech_reports@example.com",
            password="LabTechPass123!",
            role=User.Roles.LAB_TECH,
        )

    def test_inventory_report_permissions(self):
        InventoryItem.objects.create(
            name="Low Item",
            sku="INV-LOW-1",
            unit="box",
            quantity=Decimal("5"),
            reorder_level=Decimal("10"),
        )

        self.client.force_authenticate(user=self.lab_tech_user)
        lab_tech_response = self.client.get("/api/v1/reports/inventory")
        self.assertEqual(lab_tech_response.status_code, 200, lab_tech_response.content)
        self.assertEqual(lab_tech_response.json()["low_stock"], 1)

        self.client.force_authenticate(user=self.receptionist)
        recep_response = self.client.get("/api/v1/reports/inventory")
        self.assertEqual(recep_response.status_code, 200, recep_response.content)
        self.assertEqual(recep_response.json()["low_stock"], 1)

        self.client.force_authenticate(user=self.lab_tech)
        labtech_response = self.client.get("/api/v1/reports/inventory")
        self.assertEqual(labtech_response.status_code, 200, labtech_response.content)

    def test_revenue_report_aggregates_invoice_and_payment_totals(self):
        patient = Patient.objects.create(
            full_name="Report Patient",
            dob="1994-08-21",
            gender="female",
            phone="01000000020",
            primary_lab_tech=self.lab_tech_user,
            external_id="PAT-REPORT-01",
        )
        invoice = Invoice.objects.create(
            patient=patient,
            total=Decimal("300.00"),
            paid=True,
            status="paid",
        )
        Payment.objects.create(
            invoice=invoice,
            amount=Decimal("250.00"),
            method="cash",
            paid_at=timezone.now(),
        )

        self.client.force_authenticate(user=self.receptionist)
        response = self.client.get("/api/v1/reports/revenue")

        self.assertEqual(response.status_code, 200, response.content)
        body = response.json()
        self.assertEqual(Decimal(str(body["invoiced_total"])), Decimal("300.00"))
        self.assertEqual(Decimal(str(body["paid_total"])), Decimal("250.00"))



