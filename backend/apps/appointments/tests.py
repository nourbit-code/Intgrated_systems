from django.test import TestCase, override_settings
from django.utils import timezone
from rest_framework.test import APIClient

from apps.accounts.models import User
from apps.audit.models import ActivityLog
from apps.patients.models import Patient


@override_settings(ALLOWED_HOSTS=["testserver", "127.0.0.1", "localhost"])
class AppointmentApiTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.receptionist = User.objects.create_user(
            username="reception_appointments",
            email="reception_appointments@example.com",
            password="ReceptionPass123!",
            role=User.Roles.RECEPTIONIST,
        )
        self.lab_tech_user = User.objects.create_user(
            username="lab_tech_appointments",
            email="lab_tech_appointments@example.com",
            password="LAB_TECHPass123!",
            role=User.Roles.LAB_TECH,
        )
        self.patient = Patient.objects.create(
            full_name="Appointment Patient",
            dob="1992-01-02",
            gender="female",
            phone="01000000030",
            primary_lab_tech=self.lab_tech_user,
            external_id="PAT-APPT-001",
        )

    def test_create_appointment_persists_and_writes_audit_log(self):
        self.client.force_authenticate(user=self.receptionist)
        payload = {
            "patient": self.patient.id,
            "scheduled_at": timezone.now().isoformat(),
            "status": "confirmed",
            "type": "LAB_TEST",
            "created_by": self.receptionist.id,
            "notes": "Automated test appointment",
        }

        response = self.client.post("/api/v1/appointments/", payload, format="json")

        self.assertEqual(response.status_code, 201, response.content)
        appt_id = response.json()["id"]
        self.assertTrue(ActivityLog.objects.filter(entity_type="Appointment", entity_id=str(appt_id), action="create").exists())



