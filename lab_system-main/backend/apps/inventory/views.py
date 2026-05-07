from rest_framework import viewsets

from common.mixins import AuditLogMixin, FilteredQuerysetMixin
from common.permissions import RoleBasedPermission

from .models import InventoryItem, InventoryPurchaseOrder, InventoryTransaction
from .serializers import InventoryItemSerializer, InventoryPurchaseOrderSerializer, InventoryTransactionSerializer

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
    'inventory-purchase-orders': ['RECEPTIONIST', 'LAB_TECH'],
    'invoices': ['RECEPTIONIST'],
    'payments': ['RECEPTIONIST'],
    'activity-log': ['LAB_TECH'],
}

RoleBasedPermission.role_map = ROLE_MAP


class InventoryItemViewSet(AuditLogMixin, FilteredQuerysetMixin, viewsets.ModelViewSet):
    permission_classes = [RoleBasedPermission]
    queryset = InventoryItem.objects.all().order_by('id')
    serializer_class = InventoryItemSerializer
    exact_filters = {
        "sku": "sku",
        "is_active": "is_active",
    }


class InventoryTransactionViewSet(AuditLogMixin, FilteredQuerysetMixin, viewsets.ModelViewSet):
    permission_classes = [RoleBasedPermission]
    queryset = InventoryTransaction.objects.all().order_by('id')
    serializer_class = InventoryTransactionSerializer
    exact_filters = {
        "item": "item_id",
    }
    date_fields = ["created_at"]


class InventoryPurchaseOrderViewSet(AuditLogMixin, FilteredQuerysetMixin, viewsets.ModelViewSet):
    permission_classes = [RoleBasedPermission]
    queryset = InventoryPurchaseOrder.objects.all().order_by('-id')
    serializer_class = InventoryPurchaseOrderSerializer
    exact_filters = {
        "status": "status",
        "payment_status": "payment_status",
        "item": "item_id",
    }
    date_fields = ["requested_at", "received_at", "created_at"]



