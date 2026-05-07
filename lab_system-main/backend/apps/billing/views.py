from decimal import Decimal

from django.conf import settings
from django.views.decorators.csrf import csrf_exempt
from rest_framework import status, viewsets
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response

from common.mixins import AuditLogMixin, FilteredQuerysetMixin
from common.permissions import RoleBasedPermission

from .models import InsuranceProvider, Invoice, Payment
from .serializers import InsuranceProviderSerializer, InvoiceSerializer, PaymentSerializer

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
    'insurance-providers': ['RECEPTIONIST'],
    'activity-log': ['LAB_TECH'],
}

RoleBasedPermission.role_map = ROLE_MAP


class InvoiceViewSet(AuditLogMixin, FilteredQuerysetMixin, viewsets.ModelViewSet):
    permission_classes = [RoleBasedPermission]
    queryset = Invoice.objects.all().order_by('id')
    serializer_class = InvoiceSerializer
    exact_filters = {
        "patient": "patient_id",
        "status": "status",
        "appointment": "appointment_id",
    }
    date_fields = ["created_at"]


class PaymentViewSet(AuditLogMixin, FilteredQuerysetMixin, viewsets.ModelViewSet):
    permission_classes = [RoleBasedPermission]
    queryset = Payment.objects.all().order_by('id')
    serializer_class = PaymentSerializer
    exact_filters = {
        "invoice": "invoice_id",
        "method": "method",
    }
    date_fields = ["paid_at"]


class InsuranceProviderViewSet(AuditLogMixin, FilteredQuerysetMixin, viewsets.ModelViewSet):
    permission_classes = [RoleBasedPermission]
    queryset = InsuranceProvider.objects.all().order_by('name')
    serializer_class = InsuranceProviderSerializer
    exact_filters = {
        "is_active": "is_active",
        "name": "name",
    }


@api_view(["POST"])
@csrf_exempt
@permission_classes([AllowAny])
def clinic_insurance_providers_upsert(request):
    """
    Upsert insurance providers from clinic into lab.
    Expected payload:
    {
      "providers": [
        {"name": "AXA", "discount_percent": 15.0, "is_active": true}
      ]
    }
    """
    configured_token = str(getattr(settings, "CLINIC_INSURANCE_SYNC_TOKEN", "") or "").strip()
    if configured_token:
        auth_header = request.headers.get("Authorization", "")
        expected = f"Bearer {configured_token}"
        if auth_header != expected:
            return Response({"error": "Unauthorized"}, status=status.HTTP_401_UNAUTHORIZED)

    payload = request.data if isinstance(request.data, dict) else {}
    raw_providers = payload.get("providers")
    if not isinstance(raw_providers, list) or not raw_providers:
        return Response({"error": "providers list is required"}, status=status.HTTP_400_BAD_REQUEST)

    created_count = 0
    updated_count = 0
    skipped = []

    for idx, raw in enumerate(raw_providers):
        if not isinstance(raw, dict):
            skipped.append({"index": idx, "reason": "Invalid object"})
            continue
        name = str(raw.get("name") or "").strip()
        if not name:
            skipped.append({"index": idx, "reason": "Missing name"})
            continue
        try:
            discount = Decimal(str(raw.get("discount_percent", 0)))
        except Exception:
            discount = Decimal("0")
        discount = max(Decimal("0"), min(Decimal("100"), discount))
        is_active = bool(raw.get("is_active", True))

        existing = InsuranceProvider.objects.filter(name__iexact=name).first()
        if existing:
            existing.name = name
            existing.discount_percent = discount
            existing.is_active = is_active
            existing.save(update_fields=["name", "discount_percent", "is_active"])
            updated_count += 1
        else:
            InsuranceProvider.objects.create(
                name=name,
                discount_percent=discount,
                is_active=is_active,
            )
            created_count += 1

    return Response(
        {
            "success": True,
            "received": len(raw_providers),
            "created": created_count,
            "updated": updated_count,
            "skipped": skipped,
        },
        status=status.HTTP_200_OK,
    )


