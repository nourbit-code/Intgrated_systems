from django.utils import timezone
from rest_framework import viewsets

from common.mixins import AuditLogMixin, FilteredQuerysetMixin
from common.permissions import RoleBasedPermission

from .models import ScanOrder, ScanResult, ScanType
from .serializers import ScanOrderSerializer, ScanResultSerializer, ScanTypeSerializer

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


class ScanTypeViewSet(AuditLogMixin, FilteredQuerysetMixin, viewsets.ModelViewSet):
    permission_classes = [RoleBasedPermission]
    queryset = ScanType.objects.all().order_by('id')
    serializer_class = ScanTypeSerializer
    exact_filters = {
        "code": "code",
        "is_active": "is_active",
        "modality": "modality",
    }


class ScanOrderViewSet(AuditLogMixin, FilteredQuerysetMixin, viewsets.ModelViewSet):
    permission_classes = [RoleBasedPermission]
    queryset = ScanOrder.objects.all().order_by('id')
    serializer_class = ScanOrderSerializer
    exact_filters = {
        "appointment": "appointment_id",
        "scan_type": "scan_type_id",
        "status": "status",
    }
    date_fields = ["performed_at", "created_at"]

    def get_queryset(self):
        qs = super().get_queryset()
        user = self.request.user
        if not getattr(user, "is_authenticated", False):
            return qs
        if getattr(user, "role", None) == "LAB_TECH":
            return qs.filter(appointment__patient__primary_lab_tech=user)
        return qs


class ScanResultViewSet(AuditLogMixin, FilteredQuerysetMixin, viewsets.ModelViewSet):
    permission_classes = [RoleBasedPermission]
    queryset = ScanResult.objects.all().order_by('id')
    serializer_class = ScanResultSerializer
    exact_filters = {
        "scan_order": "scan_order_id",
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
            return qs.filter(scan_order__appointment__patient__primary_lab_tech=user)
        return qs

    def _sync_order_completion(self, result: ScanResult):
        scan_order = result.scan_order
        update_fields = []
        if scan_order.status != ScanOrder.Status.COMPLETED:
            scan_order.status = ScanOrder.Status.COMPLETED
            update_fields.append("status")
        if scan_order.performed_at is None:
            scan_order.performed_at = result.reported_at or timezone.now()
            update_fields.append("performed_at")
        if update_fields:
            scan_order.save(update_fields=update_fields + ["updated_at"])

    def perform_create(self, serializer):
        user = self.request.user
        reported_by = serializer.validated_data.get("reported_by")
        if reported_by is None and getattr(user, "is_authenticated", False):
            reported_by = user
        result = serializer.save(reported_by=reported_by)
        self._sync_order_completion(result)

    def perform_update(self, serializer):
        user = self.request.user
        reported_by = serializer.validated_data.get("reported_by")
        if reported_by is None and serializer.instance.reported_by_id is None and getattr(user, "is_authenticated", False):
            reported_by = user
        result = serializer.save(reported_by=reported_by) if reported_by is not None else serializer.save()
        self._sync_order_completion(result)





