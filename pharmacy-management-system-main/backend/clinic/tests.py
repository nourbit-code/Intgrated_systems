from django.contrib.auth.models import User
from rest_framework.authtoken.models import Token
from rest_framework.test import APIClient, APITestCase

from clinic.models import Patient, Prescription
from pharmacy.models import PharmacyOrder


class FhirPrescriptionIntegrationTests(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user(username='integration', password='test-pass')
        self.token = Token.objects.create(user=self.user)
        self.client = APIClient()
        self.client.credentials(HTTP_AUTHORIZATION=f'Token {self.token.key}')

    def medication_request_payload(self):
        return {
            'resourceType': 'MedicationRequest',
            'id': 'DERMA-RX-1001',
            'contained': [
                {
                    'resourceType': 'Patient',
                    'id': 'patient-1',
                    'name': [{'text': 'Mariam Hassan'}],
                    'telecom': [{'system': 'phone', 'value': '+201000000000'}],
                    'birthDate': '1997-05-20',
                },
                {
                    'resourceType': 'Practitioner',
                    'id': 'doctor-1',
                    'name': [{'text': 'Dr. Salma Adel'}],
                    'qualification': [{'code': {'text': 'Dermatology'}}],
                },
            ],
            'identifier': [{'system': 'https://clinic.example/rx', 'value': 'RX-1001'}],
            'status': 'active',
            'intent': 'order',
            'medicationCodeableConcept': {'text': 'Isotretinoin 20mg'},
            'subject': {'reference': 'Patient/patient-1', 'display': 'Mariam Hassan'},
            'requester': {'reference': 'Practitioner/doctor-1', 'display': 'Dr. Salma Adel'},
            'reasonCode': [{'text': 'Acne treatment plan'}],
            'dosageInstruction': [{'text': 'One capsule daily after food'}],
            'note': [{'text': 'Check pregnancy test before dispensing.'}],
        }

    def test_import_medication_request_creates_prescription_and_pharmacy_order(self):
        response = self.client.post(
            '/fhir/MedicationRequest/$import/',
            self.medication_request_payload(),
            format='json',
        )

        self.assertEqual(response.status_code, 201)
        self.assertEqual(Prescription.objects.count(), 1)
        self.assertEqual(PharmacyOrder.objects.count(), 1)

        prescription = Prescription.objects.select_related('patient', 'doctor').get()
        self.assertEqual(prescription.external_system, 'https://clinic.example/rx')
        self.assertEqual(prescription.external_id, 'RX-1001')
        self.assertEqual(prescription.patient.full_name, 'Mariam Hassan')
        self.assertEqual(prescription.patient.phone, '+201000000000')
        self.assertEqual(prescription.doctor.full_name, 'Dr. Salma Adel')
        self.assertEqual(prescription.medication, 'Isotretinoin 20mg')

        resources = [entry['resource']['resourceType'] for entry in response.data['entry']]
        self.assertIn('MedicationRequest', resources)
        self.assertIn('MedicationDispense', resources)

    def test_import_medication_request_is_idempotent_by_identifier(self):
        payload = self.medication_request_payload()
        first = self.client.post('/fhir/MedicationRequest/$import/', payload, format='json')
        payload['medicationCodeableConcept']['text'] = 'Isotretinoin 10mg'
        second = self.client.post('/fhir/MedicationRequest/$import/', payload, format='json')

        self.assertEqual(first.status_code, 201)
        self.assertEqual(second.status_code, 200)
        self.assertEqual(Prescription.objects.count(), 1)
        self.assertEqual(PharmacyOrder.objects.count(), 1)
        self.assertEqual(Prescription.objects.get().medication, 'Isotretinoin 10mg')

    def test_medication_dispense_endpoint_reports_pharmacy_order_status(self):
        self.client.post('/fhir/MedicationRequest/$import/', self.medication_request_payload(), format='json')
        order = PharmacyOrder.objects.get()
        order.status = 'Dispensed'
        order.save(update_fields=['status'])

        response = self.client.get(f'/fhir/MedicationDispense/{order.pk}/')

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['resourceType'], 'MedicationDispense')
        self.assertEqual(response.data['status'], 'completed')
        self.assertEqual(response.data['authorizingPrescription'][0]['reference'], 'MedicationRequest/1')
