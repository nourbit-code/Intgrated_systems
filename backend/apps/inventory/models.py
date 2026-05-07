from django.conf import settings
from django.db import models


class InventoryItem(models.Model):
    name = models.CharField(max_length=255)
    description = models.TextField(blank=True, null=True)
    category = models.CharField(max_length=100, blank=True, null=True)
    sku = models.CharField(max_length=100, unique=True)
    unit = models.CharField(max_length=50)
    quantity = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    reorder_level = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    unit_cost = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    expiry_date = models.DateField(blank=True, null=True)
    supplier = models.CharField(max_length=255, blank=True, null=True)
    is_blocked = models.BooleanField(default=False)
    block_reason = models.CharField(max_length=100, blank=True, null=True)
    is_active = models.BooleanField(default=True)

    def __str__(self) -> str:
        return self.name


class InventoryTransaction(models.Model):
    item = models.ForeignKey(InventoryItem, on_delete=models.PROTECT, related_name="transactions")
    delta = models.DecimalField(max_digits=12, decimal_places=2)
    reason = models.CharField(max_length=255)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="inventory_transactions",
    )
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self) -> str:
        return f"{self.item.name}: {self.delta}"


class InventoryPurchaseOrder(models.Model):
    class Status(models.TextChoices):
        REQUESTED = "requested", "Requested"
        RECEIVED = "received", "Received"

    class PaymentStatus(models.TextChoices):
        PENDING = "pending", "Pending"
        PAID = "paid", "Paid"

    request_ref = models.CharField(max_length=100)
    requested_at = models.DateTimeField()
    item = models.ForeignKey(
        InventoryItem,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="purchase_orders",
    )
    item_name = models.CharField(max_length=255)
    category = models.CharField(max_length=100, blank=True, null=True)
    supplier = models.CharField(max_length=255)
    supplier_email = models.EmailField(blank=True, null=True)
    qty_to_order = models.DecimalField(max_digits=12, decimal_places=2)
    qty_type = models.CharField(max_length=50)
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.REQUESTED)
    received_at = models.DateTimeField(blank=True, null=True)
    received_qty = models.DecimalField(max_digits=12, decimal_places=2, blank=True, null=True)
    unit_cost = models.DecimalField(max_digits=12, decimal_places=2, blank=True, null=True)
    total_cost = models.DecimalField(max_digits=12, decimal_places=2, blank=True, null=True)
    payment_method = models.CharField(max_length=50, blank=True, null=True)
    payment_status = models.CharField(max_length=20, choices=PaymentStatus.choices, default=PaymentStatus.PENDING)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self) -> str:
        return f"PO {self.id} - {self.item_name}"
