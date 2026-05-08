from django.core.exceptions import ValidationError
from django.db import models

from clinic.models import Patient, Prescription


class Supplier(models.Model):
    code = models.CharField(max_length=30, unique=True)
    name = models.CharField(max_length=120, unique=True)
    contact_person = models.CharField(max_length=120, blank=True)
    phone = models.CharField(max_length=40, blank=True)
    email = models.EmailField(blank=True)
    address = models.TextField(blank=True)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['name']

    def __str__(self):
        return f'{self.name} ({self.code})'


class MedicineProduct(models.Model):
    sku = models.CharField(max_length=40, unique=True)
    name = models.CharField(max_length=120)
    category = models.CharField(max_length=120, blank=True)
    barcode = models.CharField(max_length=80, blank=True)
    supplier = models.CharField(max_length=120, blank=True)
    low_stock_threshold = models.IntegerField(default=10)
    default_price = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    controlled = models.BooleanField(default=False)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f'{self.name} ({self.sku})'


class StockLot(models.Model):
    product = models.ForeignKey(MedicineProduct, on_delete=models.CASCADE, related_name='stock_lots')
    lot_number = models.CharField(max_length=60, blank=True)
    expiry_date = models.DateField(null=True, blank=True)
    supplier = models.CharField(max_length=120, blank=True)
    barcode = models.CharField(max_length=80, blank=True)
    quantity_received = models.IntegerField(default=0)
    quantity_on_hand = models.IntegerField(default=0)
    quantity_reserved = models.IntegerField(default=0)
    unit_cost = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    is_primary_snapshot = models.BooleanField(default=False)
    is_recalled = models.BooleanField(default=False)
    notes = models.TextField(blank=True)
    received_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['expiry_date', 'lot_number', 'id']

    def __str__(self):
        lot_label = self.lot_number or 'NO-LOT'
        return f'{self.product.name} [{lot_label}]'

    @property
    def quantity_available(self):
        return max(0, self.quantity_on_hand - self.quantity_reserved)

    def clean(self):
        if self.quantity_reserved > self.quantity_on_hand:
            raise ValidationError('Reserved stock cannot exceed on-hand stock.')

    def save(self, *args, **kwargs):
        self.full_clean()
        return super().save(*args, **kwargs)


class StockMovement(models.Model):
    RECEIPT = 'RECEIPT'
    RESERVE = 'RESERVE'
    RELEASE = 'RELEASE'
    DISPENSE = 'DISPENSE'
    RETURN = 'RETURN'
    ADJUSTMENT = 'ADJUSTMENT'
    RECALL = 'RECALL'
    FULFILLMENT = 'FULFILLMENT'
    MIGRATION = 'MIGRATION'
    MOVEMENT_TYPES = [
        (RECEIPT, 'Receipt'),
        (RESERVE, 'Reserve'),
        (RELEASE, 'Release'),
        (DISPENSE, 'Dispense'),
        (RETURN, 'Return'),
        (ADJUSTMENT, 'Adjustment'),
        (RECALL, 'Recall'),
        (FULFILLMENT, 'Fulfillment'),
        (MIGRATION, 'Migration'),
    ]

    product = models.ForeignKey(MedicineProduct, on_delete=models.CASCADE, related_name='stock_movements')
    lot = models.ForeignKey(
        StockLot,
        on_delete=models.SET_NULL,
        related_name='stock_movements',
        null=True,
        blank=True,
    )
    movement_type = models.CharField(max_length=20, choices=MOVEMENT_TYPES)
    quantity = models.IntegerField(default=0)
    balance_after = models.IntegerField(default=0)
    reference = models.CharField(max_length=120, blank=True)
    notes = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at', '-id']

    def __str__(self):
        return f'{self.movement_type} {self.quantity} for {self.product.sku}'


class PurchaseOrder(models.Model):
    STATUS_DRAFT = 'Draft'
    STATUS_ORDERED = 'Ordered'
    STATUS_PARTIAL = 'Partially Received'
    STATUS_RECEIVED = 'Received'
    STATUS_CANCELLED = 'Cancelled'
    STATUS_CHOICES = [
        (STATUS_DRAFT, 'Draft'),
        (STATUS_ORDERED, 'Ordered'),
        (STATUS_PARTIAL, 'Partially Received'),
        (STATUS_RECEIVED, 'Received'),
        (STATUS_CANCELLED, 'Cancelled'),
    ]

    supplier = models.ForeignKey(Supplier, on_delete=models.PROTECT, related_name='purchase_orders')
    reference = models.CharField(max_length=40, unique=True)
    status = models.CharField(max_length=30, choices=STATUS_CHOICES, default=STATUS_DRAFT)
    ordered_by = models.CharField(max_length=120, blank=True)
    expected_delivery_date = models.DateField(null=True, blank=True)
    notes = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at', '-id']

    def __str__(self):
        return self.reference

    def refresh_receiving_status(self):
        if self.status == self.STATUS_CANCELLED:
            return self.status
        lines = list(self.lines.all())
        if not lines:
            self.status = self.STATUS_DRAFT
        else:
            ordered_total = sum(max(0, line.ordered_quantity) for line in lines)
            received_total = sum(max(0, line.received_quantity) for line in lines)
            if received_total <= 0:
                self.status = self.STATUS_ORDERED if self.status != self.STATUS_DRAFT else self.STATUS_DRAFT
            elif received_total < ordered_total:
                self.status = self.STATUS_PARTIAL
            else:
                self.status = self.STATUS_RECEIVED
        self.save(update_fields=['status', 'updated_at'])
        return self.status


class PurchaseOrderLine(models.Model):
    purchase_order = models.ForeignKey(PurchaseOrder, on_delete=models.CASCADE, related_name='lines')
    product = models.ForeignKey(MedicineProduct, on_delete=models.PROTECT, related_name='purchase_order_lines')
    ordered_quantity = models.PositiveIntegerField(default=1)
    received_quantity = models.PositiveIntegerField(default=0)
    unit_cost = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    notes = models.TextField(blank=True)

    class Meta:
        ordering = ['id']

    def __str__(self):
        return f'{self.purchase_order.reference} - {self.product.sku}'


class GoodsReceipt(models.Model):
    STATUS_DRAFT = 'Draft'
    STATUS_POSTED = 'Posted'
    STATUS_CHOICES = [
        (STATUS_DRAFT, 'Draft'),
        (STATUS_POSTED, 'Posted'),
    ]

    purchase_order = models.ForeignKey(
        PurchaseOrder,
        on_delete=models.SET_NULL,
        related_name='goods_receipts',
        null=True,
        blank=True,
    )
    supplier = models.ForeignKey(Supplier, on_delete=models.PROTECT, related_name='goods_receipts')
    reference = models.CharField(max_length=40, unique=True)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default=STATUS_DRAFT)
    received_by = models.CharField(max_length=120, blank=True)
    received_at = models.DateTimeField(null=True, blank=True)
    notes = models.TextField(blank=True)
    posted_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at', '-id']

    def __str__(self):
        return self.reference


class GoodsReceiptLine(models.Model):
    receipt = models.ForeignKey(GoodsReceipt, on_delete=models.CASCADE, related_name='lines')
    purchase_order_line = models.ForeignKey(
        PurchaseOrderLine,
        on_delete=models.SET_NULL,
        related_name='receipt_lines',
        null=True,
        blank=True,
    )
    product = models.ForeignKey(MedicineProduct, on_delete=models.PROTECT, related_name='goods_receipt_lines')
    quantity_received = models.PositiveIntegerField(default=1)
    unit_cost = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    lot_number = models.CharField(max_length=60, blank=True)
    expiry_date = models.DateField(null=True, blank=True)
    notes = models.TextField(blank=True)

    class Meta:
        ordering = ['id']

    def __str__(self):
        return f'{self.receipt.reference} - {self.product.sku}'


class DrugInventory(models.Model):
    product = models.OneToOneField(
        MedicineProduct,
        on_delete=models.SET_NULL,
        related_name='inventory_snapshot',
        null=True,
        blank=True,
    )
    sku = models.CharField(max_length=40, unique=True)
    name = models.CharField(max_length=120)
    category = models.CharField(max_length=120, blank=True)
    quantity = models.IntegerField(default=0)
    expiry_date = models.DateField(null=True, blank=True)
    low_stock_threshold = models.IntegerField(default=10)
    batch_number = models.CharField(max_length=60, blank=True)
    barcode = models.CharField(max_length=80, blank=True)
    supplier = models.CharField(max_length=120, blank=True)
    price = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    controlled = models.BooleanField(default=False)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f'{self.name} ({self.sku})'

    def save(self, *args, **kwargs):
        super().save(*args, **kwargs)
        self.sync_stock_snapshot()

    def ensure_product(self):
        defaults = {
            'name': self.name,
            'category': self.category,
            'barcode': self.barcode,
            'supplier': self.supplier,
            'low_stock_threshold': self.low_stock_threshold,
            'default_price': self.price,
            'controlled': self.controlled,
        }
        product = self.product
        if product is None:
            product, _ = MedicineProduct.objects.get_or_create(sku=self.sku, defaults=defaults)
            if self.product_id != product.pk:
                DrugInventory.objects.filter(pk=self.pk).update(product=product)
                self.product = product
        changed = []
        for field, value in defaults.items():
            if getattr(product, field) != value:
                setattr(product, field, value)
                changed.append(field)
        if changed:
            product.save(update_fields=changed + ['updated_at'])
        return product

    def sync_stock_snapshot(self):
        product = self.ensure_product()
        lot, created = StockLot.objects.get_or_create(
            product=product,
            is_primary_snapshot=True,
            defaults={
                'lot_number': self.batch_number,
                'expiry_date': self.expiry_date,
                'supplier': self.supplier,
                'barcode': self.barcode,
                'quantity_received': self.quantity,
                'quantity_on_hand': self.quantity,
                'unit_cost': self.price,
            },
        )
        changed = []
        lot_defaults = {
            'lot_number': self.batch_number,
            'expiry_date': self.expiry_date,
            'supplier': self.supplier,
            'barcode': self.barcode,
            'quantity_on_hand': self.quantity,
            'unit_cost': self.price,
        }
        for field, value in lot_defaults.items():
            if getattr(lot, field) != value:
                setattr(lot, field, value)
                changed.append(field)
        baseline_received = max(lot.quantity_received, self.quantity)
        if lot.quantity_received != baseline_received:
            lot.quantity_received = baseline_received
            changed.append('quantity_received')
        if lot.quantity_reserved > lot.quantity_on_hand:
            lot.quantity_reserved = max(0, lot.quantity_on_hand)
            changed.append('quantity_reserved')
        if changed:
            lot.save(update_fields=changed + ['updated_at'])
        elif created:
            lot.save()
        return lot

    def record_stock_movement(self, movement_type, quantity, reference='', notes=''):
        product = self.ensure_product()
        lot = self.sync_stock_snapshot()
        return StockMovement.objects.create(
            product=product,
            lot=lot,
            movement_type=movement_type,
            quantity=quantity,
            balance_after=self.quantity,
            reference=reference,
            notes=notes,
        )

    def quantity_available(self):
        lot = self.sync_stock_snapshot()
        return lot.quantity_available

    def reserve_stock(self, quantity, reference='', notes=''):
        if quantity <= 0:
            return self.sync_stock_snapshot()
        lot = self.sync_stock_snapshot()
        lot.quantity_reserved = min(lot.quantity_on_hand, lot.quantity_reserved + quantity)
        lot.save(update_fields=['quantity_reserved', 'updated_at'])
        self.record_stock_movement(
            StockMovement.RESERVE,
            quantity,
            reference=reference,
            notes=notes,
        )
        return lot

    def release_reserved_stock(self, quantity, reference='', notes=''):
        if quantity <= 0:
            return self.sync_stock_snapshot()
        lot = self.sync_stock_snapshot()
        released = min(lot.quantity_reserved, quantity)
        lot.quantity_reserved = max(0, lot.quantity_reserved - released)
        lot.save(update_fields=['quantity_reserved', 'updated_at'])
        self.record_stock_movement(
            StockMovement.RELEASE,
            -released,
            reference=reference,
            notes=notes,
        )
        return lot

    def dispense_reserved_stock(self, quantity, reference='', notes=''):
        if quantity <= 0:
            return self.sync_stock_snapshot()
        lot = self.sync_stock_snapshot()
        dispensed = min(quantity, lot.quantity_on_hand)
        reserved_to_clear = min(lot.quantity_reserved, dispensed)
        lot.quantity_reserved = max(0, lot.quantity_reserved - reserved_to_clear)
        lot.quantity_on_hand = max(0, lot.quantity_on_hand - dispensed)
        lot.save(update_fields=['quantity_reserved', 'quantity_on_hand', 'updated_at'])
        self.quantity = max(0, self.quantity - dispensed)
        super().save(update_fields=['quantity', 'updated_at'])
        self.record_stock_movement(
            StockMovement.DISPENSE,
            -dispensed,
            reference=reference,
            notes=notes,
        )
        return lot

    def dispense_stock(self, quantity, reference='', notes=''):
        if quantity <= 0:
            return self.sync_stock_snapshot()
        lot = self.sync_stock_snapshot()
        if quantity > lot.quantity_available:
            raise ValidationError(f'Only {lot.quantity_available} unit(s) of {self.name} are available.')
        lot.quantity_on_hand = max(0, lot.quantity_on_hand - quantity)
        lot.save(update_fields=['quantity_on_hand', 'updated_at'])
        self.quantity = max(0, self.quantity - quantity)
        super().save(update_fields=['quantity', 'updated_at'])
        self.record_stock_movement(
            StockMovement.DISPENSE,
            -quantity,
            reference=reference,
            notes=notes,
        )
        return lot

    def return_stock(self, quantity, reference='', notes=''):
        if quantity <= 0:
            return self.sync_stock_snapshot()
        lot = self.sync_stock_snapshot()
        lot.quantity_on_hand = max(0, lot.quantity_on_hand + quantity)
        lot.quantity_received = max(lot.quantity_received, lot.quantity_on_hand)
        lot.save(update_fields=['quantity_on_hand', 'quantity_received', 'updated_at'])
        self.quantity = max(0, self.quantity + quantity)
        super().save(update_fields=['quantity', 'updated_at'])
        self.record_stock_movement(
            StockMovement.RETURN,
            quantity,
            reference=reference,
            notes=notes,
        )
        return lot


class PharmacyOrder(models.Model):
    prescription = models.OneToOneField(Prescription, on_delete=models.CASCADE, related_name='pharmacy_order')
    patient = models.ForeignKey(Patient, on_delete=models.CASCADE, related_name='pharmacy_orders')
    status = models.CharField(max_length=30, default='New')
    prepared_notes = models.TextField(blank=True)
    subtotal = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    tax_rate = models.DecimalField(max_digits=5, decimal_places=2, default=14)
    tax_amount = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    total_amount = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    missing_items_count = models.PositiveIntegerField(default=0)
    prepared_at = models.DateTimeField(null=True, blank=True)
    stock_reserved_at = models.DateTimeField(null=True, blank=True)
    stock_deducted_at = models.DateTimeField(null=True, blank=True)
    dispensed_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f'Order {self.id} - {self.patient}'


class PharmacyOrderItem(models.Model):
    order = models.ForeignKey(PharmacyOrder, on_delete=models.CASCADE, related_name='items')
    inventory = models.ForeignKey(
        DrugInventory,
        on_delete=models.SET_NULL,
        related_name='prepared_order_items',
        null=True,
        blank=True,
    )
    source_name = models.CharField(max_length=120, blank=True)
    medicine_name = models.CharField(max_length=120)
    dosage = models.CharField(max_length=120, blank=True)
    quantity = models.PositiveIntegerField(default=1)
    available_quantity = models.IntegerField(default=0)
    unit_price = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    line_total = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    in_stock = models.BooleanField(default=False)
    notes = models.TextField(blank=True)
    sort_order = models.PositiveIntegerField(default=0)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['sort_order', 'id']

    def __str__(self):
        return f'{self.medicine_name} x {self.quantity}'


class Invoice(models.Model):
    TYPE_DIRECT = 'Direct Sale'
    TYPE_PRESCRIPTION = 'Prescription'
    TYPE_CHOICES = [
        (TYPE_DIRECT, 'Direct Sale'),
        (TYPE_PRESCRIPTION, 'Prescription'),
    ]

    patient = models.ForeignKey(Patient, on_delete=models.CASCADE, related_name='invoices')
    order = models.OneToOneField(
        PharmacyOrder,
        on_delete=models.SET_NULL,
        related_name='invoice',
        null=True,
        blank=True,
    )
    invoice_type = models.CharField(max_length=30, choices=TYPE_CHOICES, default=TYPE_DIRECT)
    reference = models.CharField(max_length=40, unique=True, null=True, blank=True)
    source_reference = models.CharField(max_length=80, blank=True)
    subtotal = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    tax_amount = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    discount_amount = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    amount = models.DecimalField(max_digits=10, decimal_places=2)
    status = models.CharField(max_length=30, default='Pending')
    payment_method = models.CharField(max_length=30, blank=True)
    notes = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f'Invoice {self.reference or self.id} - {self.patient}'

    def save(self, *args, **kwargs):
        is_new = self.pk is None
        super().save(*args, **kwargs)
        if is_new and not self.reference:
            self.reference = f'INV-{self.pk:05d}'
            super().save(update_fields=['reference'])


class InvoiceLine(models.Model):
    invoice = models.ForeignKey(Invoice, on_delete=models.CASCADE, related_name='lines')
    inventory = models.ForeignKey(
        DrugInventory,
        on_delete=models.SET_NULL,
        related_name='invoice_lines',
        null=True,
        blank=True,
    )
    sku = models.CharField(max_length=40, blank=True)
    description = models.CharField(max_length=200)
    quantity = models.PositiveIntegerField(default=1)
    unit_price = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    line_total = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    source_type = models.CharField(max_length=30, blank=True)
    source_reference = models.CharField(max_length=80, blank=True)
    notes = models.TextField(blank=True)

    class Meta:
        ordering = ['id']

    def __str__(self):
        return f'{self.invoice.reference or self.invoice_id} - {self.description}'


class ClinicSupplyRequest(models.Model):
    inventory = models.ForeignKey(
        DrugInventory,
        on_delete=models.SET_NULL,
        related_name='clinic_requests',
        null=True,
        blank=True,
    )
    sku = models.CharField(max_length=40, blank=True)
    item_name = models.CharField(max_length=120)
    quantity = models.IntegerField(default=0)
    priority = models.CharField(max_length=20, default='Normal')
    status = models.CharField(max_length=20, default='Requested')
    notes = models.TextField(blank=True)
    requested_by = models.CharField(max_length=120, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f'Request {self.id} - {self.item_name}'
