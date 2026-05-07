from datetime import date
import uuid

from django.conf import settings
from django.views.decorators.csrf import csrf_exempt
from rest_framework import status, viewsets
from rest_framework.decorators import api_view
from rest_framework.permissions import AllowAny
from rest_framework.decorators import permission_classes
from rest_framework.response import Response

from common.mixins import AuditLogMixin, FilteredQuerysetMixin
from common.permissions import RoleBasedPermission

from .models import Patient
from .serializers import PatientSerializer

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


class PatientViewSet(AuditLogMixin, FilteredQuerysetMixin, viewsets.ModelViewSet):
    permission_classes = [RoleBasedPermission]
    queryset = Patient.objects.all().order_by('id')
    serializer_class = PatientSerializer
    exact_filters = {
        "external_id": "external_id",
        "is_active": "is_active",
        "primary_doctor": "primary_lab_tech_id",
        "primary_lab_tech": "primary_lab_tech_id",
    }
    date_fields = ["created_at"]

    def get_queryset(self):
        qs = super().get_queryset()
        user = self.request.user
        if not getattr(user, "is_authenticated", False):
            return qs
        if getattr(user, "role", None) == "LAB_TECH":
            return qs.filter(primary_lab_tech=user)
        return qs


@api_view(["POST"])
@csrf_exempt
@permission_classes([AllowAny])
def clinic_patient_upsert(request):
    """
    Upsert patient profile from clinic system into lab system.
    Expected payload:
    {
      "global_patient_id": "uuid",
      "clinic_patient_id": "123",
      "name": "Ali",
      "gender": "male|female|other",
      "phone": "01...",
      "email": "...",
      "dob": "YYYY-MM-DD" (optional),
      "allergies": [...],
      "medical_history": [...],
      "surgeries": [...],
      "notes": "...",
      "has_insurance": true,
      "insurance_provider": "...",
      "insurance_policy_number": "...",
      "insurance_member_id": "...",
      "insurance_expiry": "YYYY-MM-DD"
    }
    """
    payload = request.data if isinstance(request.data, dict) else {}
    configured_token = str(getattr(settings, "CLINIC_PATIENT_SYNC_TOKEN", "") or "").strip()
    if configured_token:
        auth_header = request.headers.get("Authorization", "")
        expected = f"Bearer {configured_token}"
        if auth_header != expected:
            return Response({"error": "Unauthorized"}, status=status.HTTP_401_UNAUTHORIZED)
    clinic_patient_id = str(payload.get("clinic_patient_id") or "").strip()
    global_patient_id_raw = str(payload.get("global_patient_id") or "").strip()
    parsed_global_patient_id = None
    if global_patient_id_raw:
        try:
            parsed_global_patient_id = uuid.UUID(global_patient_id_raw)
        except ValueError:
            return Response({"error": "global_patient_id must be a valid UUID"}, status=status.HTTP_400_BAD_REQUEST)
    if not clinic_patient_id and not parsed_global_patient_id:
        return Response(
            {"error": "Either clinic_patient_id or global_patient_id is required"},
            status=status.HTTP_400_BAD_REQUEST
        )

    name = str(payload.get("name") or "Unknown Patient").strip() or "Unknown Patient"
    gender_raw = str(payload.get("gender") or "").strip().lower()
    gender = gender_raw if gender_raw in {"male", "female", "other"} else "other"
    phone = str(payload.get("phone") or "").strip()
    email = str(payload.get("email") or "").strip() or None
    insurance_provider = str(payload.get("insurance_provider") or "").strip() or None
    insurance_policy_number = str(payload.get("insurance_policy_number") or "").strip() or None
    insurance_member_id = str(payload.get("insurance_member_id") or "").strip() or None
    insurance_expiry_raw = str(payload.get("insurance_expiry") or "").strip()
    dob_raw = str(payload.get("dob") or "").strip()
    try:
        dob_value = date.fromisoformat(dob_raw) if dob_raw else date(1990, 1, 1)
    except ValueError:
        dob_value = date(1990, 1, 1)
    try:
        insurance_expiry_value = date.fromisoformat(insurance_expiry_raw) if insurance_expiry_raw else None
    except ValueError:
        insurance_expiry_value = None

    clinical_snapshot = {
        "global_patient_id": str(parsed_global_patient_id) if parsed_global_patient_id else "",
        "clinic_patient_id": clinic_patient_id,
        "allergies": payload.get("allergies") or [],
        "medical_history": payload.get("medical_history") or [],
        "surgeries": payload.get("surgeries") or [],
        "notes": payload.get("notes") or "",
        "has_insurance": bool(payload.get("has_insurance", False)),
        "insurance_provider": insurance_provider or "",
        "insurance_policy_number": insurance_policy_number or "",
        "insurance_member_id": insurance_member_id or "",
        "insurance_expiry": insurance_expiry_raw or "",
        "synced_at": date.today().isoformat(),
    }

    defaults = {
        "full_name": name,
        "dob": dob_value,
        "gender": gender,
        "phone": phone,
        "email": email,
        "insurance_provider": insurance_provider,
        "insurance_policy_number": insurance_policy_number,
        "insurance_member_id": insurance_member_id,
        "insurance_expiry": insurance_expiry_value,
        "clinical_profile_snapshot": clinical_snapshot,
        "is_active": True,
    }
    if clinic_patient_id:
        defaults["external_id"] = clinic_patient_id
    if parsed_global_patient_id:
        defaults["global_patient_id"] = parsed_global_patient_id

    patient = None
    created = False
    if parsed_global_patient_id:
        patient = Patient.objects.filter(global_patient_id=parsed_global_patient_id).first()
    if not patient and clinic_patient_id:
        patient = Patient.objects.filter(external_id=clinic_patient_id).first()

    if patient:
        for field, value in defaults.items():
            setattr(patient, field, value)
        patient.save()
    else:
        patient = Patient.objects.create(**defaults)
        created = True

    return Response(
        {
            "success": True,
            "created": created,
            "patient_id": patient.id,
            "global_patient_id": str(patient.global_patient_id),
            "external_id": patient.external_id,
        },
        status=status.HTTP_201_CREATED if created else status.HTTP_200_OK,
    )
