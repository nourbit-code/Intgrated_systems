from rest_framework import viewsets

from common.mixins import AuditLogMixin, FilteredQuerysetMixin
from common.permissions import RoleBasedPermission

from .models import Appointment
from .serializers import AppointmentSerializer

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


class AppointmentViewSet(AuditLogMixin, FilteredQuerysetMixin, viewsets.ModelViewSet):
    permission_classes = [RoleBasedPermission]
    queryset = Appointment.objects.all().order_by('id')
    serializer_class = AppointmentSerializer
    exact_filters = {
        "patient": "patient_id",
        "status": "status",
        "type": "type",
        "source_system": "source_system",
    }
    date_fields = ["scheduled_at", "created_at"]

    def get_queryset(self):
        qs = super().get_queryset()
        user = self.request.user
        if not getattr(user, "is_authenticated", False):
            return qs
        if getattr(user, "role", None) == "LAB_TECH":
            return qs.filter(patient__primary_lab_tech=user)
        return qs





