from django.test import TestCase, override_settings
from rest_framework.test import APIClient

from apps.accounts.models import User
from apps.patients.models import Patient


@override_settings(ALLOWED_HOSTS=["testserver", "127.0.0.1", "localhost"])
class PatientApiTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.lab_tech_user = User.objects.create_user(
            username="lab_tech_patients",
            email="lab_tech_patients@example.com",
            password="LAB_TECHPass123!",
            role=User.Roles.LAB_TECH,
        )
        self.receptionist = User.objects.create_user(
            username="reception_patients",
            email="reception_patients@example.com",
            password="ReceptionPass123!",
            role=User.Roles.RECEPTIONIST,
        )

    def test_receptionist_can_create_patient_and_data_is_persisted(self):
        self.client.force_authenticate(user=self.receptionist)
        payload = {
            "full_name": "Test Patient A",
            "dob": "1998-05-03",
            "gender": "female",
            "phone": "01000000009",
            "email": "test.patient.a@example.com",
            "address": "Cairo",
            "primary_lab_tech": self.lab_tech_user.id,
            "external_id": "PAT-TEST-001",
            "consent_signed": True,
            "is_active": True,
        }

        response = self.client.post("/api/v1/patients/", payload, format="json")

        self.assertEqual(response.status_code, 201, response.content)
        created_id = response.json()["id"]
        patient = Patient.objects.get(id=created_id)
        self.assertEqual(patient.full_name, payload["full_name"])
        self.assertEqual(patient.external_id, payload["external_id"])
        self.assertEqual(patient.primary_lab_tech_id, self.lab_tech_user.id)

    def test_lab_tech_list_is_scoped_to_primary_lab_tech_patients(self):
        Patient.objects.create(
            full_name="Lab Tech Own Patient",
            dob="1990-01-01",
            gender="male",
            phone="01000000010",
            primary_lab_tech=self.lab_tech_user,
            external_id="PAT-TEST-OWN",
        )
        other_lab_tech = User.objects.create_user(
            username="lab_tech_other",
            email="lab_tech_other@example.com",
            password="LAB_TECHPass123!",
            role=User.Roles.LAB_TECH,
        )
        Patient.objects.create(
            full_name="Other Lab Tech Patient",
            dob="1991-01-01",
            gender="female",
            phone="01000000011",
            primary_lab_tech=other_lab_tech,
            external_id="PAT-TEST-OTHER",
        )

        self.client.force_authenticate(user=self.lab_tech_user)
        response = self.client.get("/api/v1/patients/")

        self.assertEqual(response.status_code, 200, response.content)
        names = {item["full_name"] for item in response.json()}
        self.assertIn("Lab Tech Own Patient", names)
        self.assertNotIn("Other Lab Tech Patient", names)



