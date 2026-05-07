import logging
import uuid
import base64

import requests
from django.conf import settings
from django.contrib.auth import get_user_model
from django.utils import timezone
from django.views.decorators.csrf import csrf_exempt
from rest_framework import viewsets
from rest_framework.decorators import api_view
from rest_framework.decorators import permission_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework import status

from common.mixins import AuditLogMixin, FilteredQuerysetMixin
from common.permissions import RoleBasedPermission

from apps.appointments.models import Appointment
from apps.patients.models import Patient
from apps.scans.models import ScanOrder, ScanType
from .models import LabResult, LabTestOrder, LabTestType
from .serializers import LabResultSerializer, LabTestOrderSerializer, LabTestTypeSerializer

ROLE_MAP = {
    'users': ['LAB_TECH', 'RECEPTIONIST'],
    'patients': ['LAB_TECH', 'RECEPTIONIST'],
    'appointments': ['LAB_TECH', 'RECEPTIONIST'],
    'lab-test-types': ['LAB_TECH'],
    'lab-test-orders': ['LAB_TECH'],
    'lab-results': ['LAB_TECH'],
    'scan-types': ['LAB_TECH'],
    'scan-orders': ['LAB_TECH'],
    'scan-results': ['LAB_TECH', 'RECEPTIONIST'],
    'inventory-items': ['RECEPTIONIST', 'LAB_TECH'],
    'inventory-transactions': ['RECEPTIONIST', 'LAB_TECH'],
    'invoices': ['RECEPTIONIST'],
    'payments': ['RECEPTIONIST'],
    'activity-log': ['LAB_TECH'],
}

RoleBasedPermission.role_map = ROLE_MAP
logger = logging.getLogger(__name__)

DEFAULT_LAB_TEST_TYPES = [
    {"name": "Complete Blood Count", "code": "CBC", "category": "Hematology", "unit": "", "min": None, "max": None, "ref": "See report"},
    {"name": "C-Reactive Protein", "code": "CRP", "category": "Inflammation", "unit": "mg/L", "min": 0, "max": 5, "ref": "0-5"},
    {"name": "Erythrocyte Sedimentation Rate", "code": "ESR", "category": "Hematology", "unit": "mm/hr", "min": 0, "max": 20, "ref": "0-20"},
    {"name": "Fasting Blood Glucose", "code": "FBG", "category": "Chemistry", "unit": "mg/dL", "min": 70, "max": 99, "ref": "70-99"},
    {"name": "HbA1c", "code": "HBA1C", "category": "Diabetes", "unit": "%", "min": 4, "max": 5.6, "ref": "4.0-5.6"},
    {"name": "Lipid Profile", "code": "LIPID", "category": "Chemistry", "unit": "", "min": None, "max": None, "ref": "Panel"},
    {"name": "Liver Function Test", "code": "LFT", "category": "Chemistry", "unit": "", "min": None, "max": None, "ref": "Panel"},
    {"name": "Kidney Function Test", "code": "KFT", "category": "Chemistry", "unit": "", "min": None, "max": None, "ref": "Panel"},
    {"name": "Thyroid Stimulating Hormone", "code": "TSH", "category": "Hormones", "unit": "uIU/mL", "min": 0.4, "max": 4.0, "ref": "0.4-4.0"},
    {"name": "Free T4", "code": "FT4", "category": "Hormones", "unit": "ng/dL", "min": 0.8, "max": 1.8, "ref": "0.8-1.8"},
    {"name": "Free T3", "code": "FT3", "category": "Hormones", "unit": "pg/mL", "min": 2.3, "max": 4.2, "ref": "2.3-4.2"},
    {"name": "Vitamin D", "code": "VITD", "category": "Vitamins", "unit": "ng/mL", "min": 30, "max": 100, "ref": "30-100"},
    {"name": "Vitamin B12", "code": "VITB12", "category": "Vitamins", "unit": "pg/mL", "min": 200, "max": 900, "ref": "200-900"},
    {"name": "Ferritin", "code": "FERR", "category": "Iron", "unit": "ng/mL", "min": 20, "max": 300, "ref": "20-300"},
    {"name": "Serum Iron", "code": "IRON", "category": "Iron", "unit": "ug/dL", "min": 60, "max": 170, "ref": "60-170"},
    {"name": "Total Iron Binding Capacity", "code": "TIBC", "category": "Iron", "unit": "ug/dL", "min": 240, "max": 450, "ref": "240-450"},
    {"name": "Uric Acid", "code": "URIC", "category": "Chemistry", "unit": "mg/dL", "min": 3.5, "max": 7.2, "ref": "3.5-7.2"},
    {"name": "Calcium", "code": "CAL", "category": "Chemistry", "unit": "mg/dL", "min": 8.5, "max": 10.5, "ref": "8.5-10.5"},
    {"name": "Magnesium", "code": "MG", "category": "Chemistry", "unit": "mg/dL", "min": 1.7, "max": 2.2, "ref": "1.7-2.2"},
    {"name": "Phosphorus", "code": "PHOS", "category": "Chemistry", "unit": "mg/dL", "min": 2.5, "max": 4.5, "ref": "2.5-4.5"},
    {"name": "Sodium", "code": "NA", "category": "Electrolytes", "unit": "mmol/L", "min": 135, "max": 145, "ref": "135-145"},
    {"name": "Potassium", "code": "K", "category": "Electrolytes", "unit": "mmol/L", "min": 3.5, "max": 5.1, "ref": "3.5-5.1"},
    {"name": "Chloride", "code": "CL", "category": "Electrolytes", "unit": "mmol/L", "min": 98, "max": 107, "ref": "98-107"},
    {"name": "Urinalysis", "code": "UA", "category": "Urine", "unit": "", "min": None, "max": None, "ref": "Routine"},
    {"name": "Urine Culture", "code": "UCULT", "category": "Microbiology", "unit": "", "min": None, "max": None, "ref": "Culture"},
    {"name": "Stool Analysis", "code": "STOOL", "category": "Microbiology", "unit": "", "min": None, "max": None, "ref": "Routine"},
    {"name": "D-Dimer", "code": "DDIMER", "category": "Coagulation", "unit": "ug/mL", "min": 0, "max": 0.5, "ref": "<0.5"},
    {"name": "Prothrombin Time", "code": "PT", "category": "Coagulation", "unit": "sec", "min": 11, "max": 14, "ref": "11-14"},
    {"name": "INR", "code": "INR", "category": "Coagulation", "unit": "", "min": 0.8, "max": 1.2, "ref": "0.8-1.2"},
    {"name": "Activated Partial Thromboplastin Time", "code": "APTT", "category": "Coagulation", "unit": "sec", "min": 25, "max": 35, "ref": "25-35"},
]


def _resolve_patient_reference_id(patient) -> str:
    """
    Prefer mapped external patient id (clinic-side id) when numeric.
    Fall back to local patient id for development setups where ids are mirrored.
    """
    external = str(patient.external_id or "").strip()
    if external.isdigit():
        return external
    return str(patient.id)


def _build_result_file_url(request, result: LabResult) -> str:
    if not result.result_file:
        text = (result.result_text or "").strip()
        if text:
            encoded = base64.b64encode(text.encode("utf-8")).decode("ascii")
            return f"data:text/plain;base64,{encoded}"
        return ""
    try:
        return request.build_absolute_uri(result.result_file.url)
    except Exception:
        base = str(getattr(settings, "LAB_RESULT_PUBLIC_BASE_URL", "") or "").rstrip("/")
        if base:
            return f"{base}/{str(result.result_file.name).lstrip('/')}"
        return result.result_file.url


def _build_fhir_diagnostic_report(result: LabResult, report_id: str, file_url: str) -> dict:
    order = result.lab_test_order
    patient = order.appointment.patient
    test_type = order.test_type
    reported_at = result.reported_at or timezone.now()
    patient_ref = _resolve_patient_reference_id(patient)

    observations = []
    if result.result_text:
        observations.append(
            {
                "resourceType": "Observation",
                "id": f"obs-{report_id}",
                "status": "final",
                "code": {"text": test_type.name},
                "subject": {"reference": f"Patient/{patient_ref}"},
                "effectiveDateTime": reported_at.isoformat(),
                "valueString": result.result_text,
            }
        )

    content_type = "application/pdf"
    if file_url.startswith("data:text/plain"):
        content_type = "text/plain"

    resource = {
        "resourceType": "DiagnosticReport",
        "id": report_id,
        "status": "final",
        "code": {"text": test_type.name},
        "subject": {
            "reference": f"Patient/{patient_ref}",
            "display": patient.full_name,
        },
        "effectiveDateTime": reported_at.isoformat(),
        "issued": reported_at.isoformat(),
        "presentedForm": [
            {
                "contentType": content_type,
                "url": file_url,
                "title": f"{test_type.name} Result",
            }
        ],
        "conclusion": result.result_text or "",
        "result": [{"reference": f"Observation/{obs['id']}"} for obs in observations],
    }

    return {
        "resourceType": "Bundle",
        "type": "collection",
        "entry": [{"resource": resource}] + [{"resource": obs} for obs in observations],
    }


def _push_result_to_clinic(request, result: LabResult):
    endpoint = str(getattr(settings, "CLINIC_FHIR_INGEST_ENDPOINT", "") or "").strip()
    token = str(getattr(settings, "CLINIC_FHIR_INGEST_TOKEN", "") or "").strip()
    if not endpoint:
        return

    file_url = _build_result_file_url(request, result)
    if not file_url:
        logger.warning("Skipping clinic sync for LabResult %s: no result_file URL available.", result.id)
        return

    report_id = result.external_ref or f"labres-{result.id}"
    payload = _build_fhir_diagnostic_report(result, report_id=report_id, file_url=file_url)

    headers = {
        # Clinic ingest endpoint uses DRF JSON parser, so send application/json.
        "Content-Type": "application/json",
        "X-Source-System": "LAB_SYSTEM",
        "Idempotency-Key": str(uuid.uuid4()),
    }
    if token:
        headers["Authorization"] = f"Bearer {token}"

    response = requests.post(endpoint, json=payload, headers=headers, timeout=20)
    response.raise_for_status()


def _resolve_patient_from_service_request(resource):
    subject = resource.get("subject") or {}
    clinic_id = ""
    ref = str(subject.get("reference") or "")
    if ref.startswith("Patient/"):
        clinic_id = ref.split("/", 1)[1].strip()
    identifier = subject.get("identifier") or {}
    if not clinic_id and isinstance(identifier, dict):
        clinic_id = str(identifier.get("value") or "").strip()
    if not clinic_id:
        return None
    patient = Patient.objects.filter(external_id=clinic_id).first()
    if patient:
        return patient
    display = str(subject.get("display") or "Unknown Patient").strip() or "Unknown Patient"
    user_model = get_user_model()
    default_lab_tech = user_model.objects.filter(role="LAB_TECH", is_active=True).order_by("id").first()
    return Patient.objects.create(
        full_name=display,
        dob=timezone.now().date(),
        gender="other",
        phone="",
        external_id=clinic_id,
        primary_lab_tech=default_lab_tech,
        consent_signed=False,
    )


def _create_order_from_service_request(resource):
    patient = _resolve_patient_from_service_request(resource)
    if not patient:
        return None, "Unable to resolve patient"
    category = ((resource.get("category") or [{}])[0] or {}).get("text", "LAB_TEST")
    category = str(category or "LAB_TEST").upper()
    code_block = resource.get("code") or {}
    code_text = str(code_block.get("text") or "Requested Test").strip()
    coding = (code_block.get("coding") or [])
    code_value = str((coding[0] or {}).get("code") or code_text.upper().replace(" ", "_")).strip()
    note = ""
    notes = resource.get("note") or []
    if notes and isinstance(notes, list):
        note = str((notes[0] or {}).get("text") or "").strip()

    appointment = Appointment.objects.create(
        patient=patient,
        scheduled_at=timezone.now(),
        status=Appointment.Status.CONFIRMED,
        type=Appointment.Types.SCAN if "SCAN" in category else Appointment.Types.LAB_TEST,
        notes=note,
        source_system="clinic_system",
    )

    if "SCAN" in category:
        scan_type, _ = ScanType.objects.get_or_create(
            code=code_value,
            defaults={"name": code_text, "modality": "XRAY", "default_price": 0, "is_active": True},
        )
        order = ScanOrder.objects.create(
            appointment=appointment,
            scan_type=scan_type,
            status=ScanOrder.Status.IN_PROGRESS,
            price=scan_type.default_price or 0,
        )
        return {"kind": "scan", "order_id": order.id, "code": code_value, "name": code_text}, None

    test_type, _ = LabTestType.objects.get_or_create(
        code=code_value,
        defaults={"name": code_text, "category": "Imported", "default_price": 0, "turnaround_hours": 24, "is_active": True},
    )
    order = LabTestOrder.objects.create(
        appointment=appointment,
        test_type=test_type,
        status=LabTestOrder.Status.WAITING_FOR_SAMPLE,
        price=test_type.default_price or 0,
    )
    return {"kind": "lab", "order_id": order.id, "code": code_value, "name": code_text}, None


@api_view(["POST"])
@csrf_exempt
@permission_classes([AllowAny])
def ingest_clinic_orders(request):
    configured_token = str(getattr(settings, "LAB_ORDER_INGEST_TOKEN", "") or "").strip()
    if configured_token:
        auth_header = request.headers.get("Authorization", "")
        if auth_header != f"Bearer {configured_token}":
            return Response({"error": "Unauthorized"}, status=status.HTTP_401_UNAUTHORIZED)

    payload = request.data if isinstance(request.data, dict) else {}
    if payload.get("resourceType") != "Bundle":
        return Response({"error": "FHIR Bundle expected"}, status=status.HTTP_400_BAD_REQUEST)
    entries = payload.get("entry") or []
    created = []
    errors = []
    for entry in entries:
        resource = (entry or {}).get("resource") or {}
        if resource.get("resourceType") != "ServiceRequest":
            continue
        item, err = _create_order_from_service_request(resource)
        if err:
            errors.append(err)
        elif item:
            created.append(item)

    return Response(
        {"success": True, "created_count": len(created), "created": created, "errors": errors},
        status=status.HTTP_201_CREATED if created else status.HTTP_200_OK,
    )


@api_view(["GET"])
@csrf_exempt
@permission_classes([AllowAny])
def public_lab_catalog(request):
    lab_tests = LabTestType.objects.filter(is_active=True).order_by("name").values("name", "code", "category")
    scan_types = ScanType.objects.filter(is_active=True).order_by("name").values("name", "code", "modality")
    return Response(
        {
            "success": True,
            "lab_tests": list(lab_tests),
            "scan_types": list(scan_types),
        },
        status=status.HTTP_200_OK,
    )


@api_view(["POST"])
@csrf_exempt
@permission_classes([AllowAny])
def seed_default_lab_catalog(request):
    created = 0
    updated = 0
    for item in DEFAULT_LAB_TEST_TYPES:
        obj, was_created = LabTestType.objects.update_or_create(
            code=item["code"],
            defaults={
                "name": item["name"],
                "category": item["category"],
                "description": "Seeded default lab catalog item",
                "default_price": 120,
                "result_unit": item["unit"] or None,
                "reference_min": item["min"],
                "reference_max": item["max"],
                "reference_text": item["ref"] or None,
                "turnaround_hours": 24,
                "is_active": True,
            },
        )
        if was_created:
            created += 1
        else:
            updated += 1

    default_scans = [
        {"name": "Chest X-Ray", "code": "XR_CHEST", "modality": "XRAY"},
        {"name": "Abdominal Ultrasound", "code": "US_ABD", "modality": "US"},
        {"name": "Pelvic Ultrasound", "code": "US_PELV", "modality": "US"},
        {"name": "Thyroid Ultrasound", "code": "US_THYR", "modality": "US"},
        {"name": "CT Chest", "code": "CT_CHEST", "modality": "CT"},
        {"name": "CT Abdomen", "code": "CT_ABD", "modality": "CT"},
        {"name": "MRI Brain", "code": "MRI_BRAIN", "modality": "MRI"},
        {"name": "MRI Spine", "code": "MRI_SPINE", "modality": "MRI"},
        {"name": "Doppler Ultrasound", "code": "US_DOP", "modality": "US"},
    ]
    scan_created = 0
    scan_updated = 0
    for item in default_scans:
        _, was_created = ScanType.objects.update_or_create(
            code=item["code"],
            defaults={
                "name": item["name"],
                "modality": item["modality"],
                "description": "Seeded default scan catalog item",
                "default_price": 250,
                "turnaround_hours": 24,
                "is_active": True,
            },
        )
        if was_created:
            scan_created += 1
        else:
            scan_updated += 1

    return Response(
        {
            "success": True,
            "lab_tests_created": created,
            "lab_tests_updated": updated,
            "scan_types_created": scan_created,
            "scan_types_updated": scan_updated,
        },
        status=status.HTTP_200_OK,
    )


class LabTestTypeViewSet(AuditLogMixin, FilteredQuerysetMixin, viewsets.ModelViewSet):
    permission_classes = [RoleBasedPermission]
    queryset = LabTestType.objects.all().order_by('id')
    serializer_class = LabTestTypeSerializer
    exact_filters = {
        "code": "code",
        "is_active": "is_active",
        "category": "category",
    }


class LabTestOrderViewSet(AuditLogMixin, FilteredQuerysetMixin, viewsets.ModelViewSet):
    permission_classes = [RoleBasedPermission]
    queryset = LabTestOrder.objects.all().order_by('id')
    serializer_class = LabTestOrderSerializer
    exact_filters = {
        "appointment": "appointment_id",
        "test_type": "test_type_id",
        "status": "status",
    }
    date_fields = ["sample_collected_at", "created_at"]

    def get_queryset(self):
        qs = super().get_queryset()
        user = self.request.user
        if not getattr(user, "is_authenticated", False):
            return qs
        if getattr(user, "role", None) == "LAB_TECH":
            return qs.filter(appointment__patient__primary_lab_tech=user)
        return qs


class LabResultViewSet(AuditLogMixin, FilteredQuerysetMixin, viewsets.ModelViewSet):
    permission_classes = [RoleBasedPermission]
    queryset = LabResult.objects.all().order_by('id')
    serializer_class = LabResultSerializer
    exact_filters = {
        "lab_test_order": "lab_test_order_id",
        "source_system": "source_system",
        "external_ref": "external_ref",
    }
    date_fields = ["reported_at"]

    def get_queryset(self):
        qs = super().get_queryset()
        user = self.request.user
        if not getattr(user, "is_authenticated", False):
            return qs
        if getattr(user, "role", None) == "LAB_TECH":
            return qs.filter(lab_test_order__appointment__patient__primary_lab_tech=user)
        return qs

    def _sync_order_completion(self, result: LabResult):
        order = result.lab_test_order
        update_fields = []
        if order.status != LabTestOrder.Status.COMPLETED:
            order.status = LabTestOrder.Status.COMPLETED
            update_fields.append("status")
        if order.sample_collected_at is None:
            order.sample_collected_at = result.reported_at or timezone.now()
            update_fields.append("sample_collected_at")
        if update_fields:
            order.save(update_fields=update_fields + ["updated_at"])

    def _sync_to_clinic_safe(self, result: LabResult):
        try:
            _push_result_to_clinic(self.request, result)
        except Exception as exc:
            logger.exception("Clinic sync failed for LabResult %s: %s", result.id, exc)

    def perform_create(self, serializer):
        user = self.request.user
        reported_by = serializer.validated_data.get("reported_by")
        if reported_by is None and getattr(user, "is_authenticated", False):
            reported_by = user
        result = serializer.save(reported_by=reported_by, source_system="lab_system")
        self._sync_order_completion(result)
        self._sync_to_clinic_safe(result)

    def perform_update(self, serializer):
        user = self.request.user
        reported_by = serializer.validated_data.get("reported_by")
        if reported_by is None and serializer.instance.reported_by_id is None and getattr(user, "is_authenticated", False):
            reported_by = user
        if reported_by is not None:
            result = serializer.save(reported_by=reported_by)
        else:
            result = serializer.save()
        if not result.source_system:
            result.source_system = "lab_system"
            result.save(update_fields=["source_system"])
        self._sync_order_completion(result)
        self._sync_to_clinic_safe(result)
