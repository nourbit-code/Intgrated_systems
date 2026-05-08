import time

from django.db import OperationalError
from rest_framework import permissions, status
from rest_framework.parsers import JSONParser
from rest_framework.response import Response
from rest_framework.views import APIView

from clinic.fhir import (
    extract_medication_requests,
    import_medication_request,
    order_to_medication_dispense,
    patient_to_fhir,
    practitioner_to_fhir,
    prescription_to_medication_request,
    resources_to_bundle,
)
from clinic.models import Prescription
from pharmacy.models import PharmacyOrder


class FhirJsonParser(JSONParser):
    media_type = "application/fhir+json"


class FhirMedicationRequestImportView(APIView):
    # Allow clinic backend to push MedicationRequest bundles without requiring
    # a user token during local integration.
    permission_classes = [permissions.AllowAny]
    parser_classes = [FhirJsonParser, JSONParser]
    LOCK_RETRY_ATTEMPTS = 3
    LOCK_RETRY_DELAY_SECONDS = 0.35

    def post(self, request):
        try:
            medication_requests, resources_by_ref = extract_medication_requests(request.data)
        except ValueError as exc:
            return Response(
                {
                    'resourceType': 'OperationOutcome',
                    'issue': [{'severity': 'error', 'code': 'invalid', 'diagnostics': str(exc)}],
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        imported = []
        created_any = False
        for medication_request in medication_requests:
            prescription = None
            order = None
            created = False
            last_error = None
            for attempt in range(1, self.LOCK_RETRY_ATTEMPTS + 1):
                try:
                    prescription, order, created = import_medication_request(medication_request, resources_by_ref)
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
                    {
                        'resourceType': 'OperationOutcome',
                        'issue': [
                            {
                                'severity': 'error',
                                'code': 'exception',
                                'diagnostics': f'Failed to persist prescription: {last_error}',
                            }
                        ],
                    },
                    status=status.HTTP_503_SERVICE_UNAVAILABLE,
                )

            created_any = created_any or created
            imported.append(
                {
                    'resourceType': 'Bundle',
                    'type': 'collection',
                    'entry': [
                        {'resource': prescription_to_medication_request(prescription)},
                        {'resource': patient_to_fhir(prescription.patient)},
                        {'resource': practitioner_to_fhir(prescription.doctor)},
                        {'resource': order_to_medication_dispense(order)},
                    ],
                }
            )

        response_status = status.HTTP_201_CREATED if created_any else status.HTTP_200_OK
        if len(imported) == 1:
            return Response(imported[0], status=response_status)
        return Response(resources_to_bundle(imported), status=response_status)


class FhirMedicationRequestListView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        prescriptions = Prescription.objects.select_related('patient', 'doctor').order_by('-created_at')
        resources = [prescription_to_medication_request(prescription) for prescription in prescriptions]
        return Response(resources_to_bundle(resources))


class FhirMedicationRequestDetailView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, pk):
        prescription = Prescription.objects.select_related('patient', 'doctor').filter(pk=pk).first()
        if prescription is None:
            return Response(
                {
                    'resourceType': 'OperationOutcome',
                    'issue': [{'severity': 'error', 'code': 'not-found', 'diagnostics': 'MedicationRequest not found.'}],
                },
                status=status.HTTP_404_NOT_FOUND,
            )
        return Response(prescription_to_medication_request(prescription))


class FhirMedicationDispenseListView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        orders = PharmacyOrder.objects.select_related('patient', 'prescription').prefetch_related('items').order_by(
            '-created_at'
        )
        prescription_id = request.query_params.get('prescription')
        if prescription_id:
            orders = orders.filter(prescription_id=prescription_id)
        resources = [order_to_medication_dispense(order) for order in orders]
        return Response(resources_to_bundle(resources))


class FhirMedicationDispenseDetailView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, pk):
        order = (
            PharmacyOrder.objects.select_related('patient', 'prescription')
            .prefetch_related('items')
            .filter(pk=pk)
            .first()
        )
        if order is None:
            return Response(
                {
                    'resourceType': 'OperationOutcome',
                    'issue': [{'severity': 'error', 'code': 'not-found', 'diagnostics': 'MedicationDispense not found.'}],
                },
                status=status.HTTP_404_NOT_FOUND,
            )
        return Response(order_to_medication_dispense(order))
