from rest_framework import serializers

from clinic.utils import resolve_patient
from pharmacy.models import (
    ClinicSupplyRequest,
    DrugInventory,
    GoodsReceipt,
    GoodsReceiptLine,
    Invoice,
    InvoiceLine,
    MedicineProduct,
    PharmacyOrder,
    PharmacyOrderItem,
    PurchaseOrder,
    PurchaseOrderLine,
    Supplier,
    StockLot,
    StockMovement,
)


class SupplierSerializer(serializers.ModelSerializer):
    class Meta:
        model = Supplier
        fields = [
            'id',
            'code',
            'name',
            'contact_person',
            'phone',
            'email',
            'address',
            'is_active',
            'created_at',
            'updated_at',
        ]


class PurchaseOrderLineSerializer(serializers.ModelSerializer):
    id = serializers.IntegerField(required=False)
    product_sku = serializers.CharField(source='product.sku', read_only=True)
    product_name = serializers.CharField(source='product.name', read_only=True)

    class Meta:
        model = PurchaseOrderLine
        fields = [
            'id',
            'product',
            'product_sku',
            'product_name',
            'ordered_quantity',
            'received_quantity',
            'unit_cost',
            'notes',
        ]
        read_only_fields = ['received_quantity']


class PurchaseOrderSerializer(serializers.ModelSerializer):
    supplier_name = serializers.CharField(source='supplier.name', read_only=True)
    lines = PurchaseOrderLineSerializer(many=True)

    class Meta:
        model = PurchaseOrder
        fields = [
            'id',
            'supplier',
            'supplier_name',
            'reference',
            'status',
            'ordered_by',
            'expected_delivery_date',
            'notes',
            'lines',
            'created_at',
            'updated_at',
        ]

    def create(self, validated_data):
        lines_data = validated_data.pop('lines', [])
        order = PurchaseOrder.objects.create(**validated_data)
        PurchaseOrderLine.objects.bulk_create(
            [PurchaseOrderLine(purchase_order=order, **line_data) for line_data in lines_data]
        )
        order.refresh_receiving_status()
        return order

    def update(self, instance, validated_data):
        lines_data = validated_data.pop('lines', None)
        for field, value in validated_data.items():
            setattr(instance, field, value)
        instance.save()

        if lines_data is not None:
            existing_lines = {line.id: line for line in instance.lines.all()}
            seen_ids = set()
            for line_data in lines_data:
                line_id = line_data.get('id')
                if line_id and line_id in existing_lines:
                    line = existing_lines[line_id]
                    seen_ids.add(line_id)
                    for field, value in line_data.items():
                        if field != 'id':
                            setattr(line, field, value)
                    line.save()
                else:
                    PurchaseOrderLine.objects.create(purchase_order=instance, **line_data)
            for line_id, line in existing_lines.items():
                if line_id not in seen_ids:
                    line.delete()

        instance.refresh_receiving_status()
        return instance


class GoodsReceiptLineSerializer(serializers.ModelSerializer):
    id = serializers.IntegerField(required=False)
    product_sku = serializers.CharField(source='product.sku', read_only=True)
    product_name = serializers.CharField(source='product.name', read_only=True)

    class Meta:
        model = GoodsReceiptLine
        fields = [
            'id',
            'purchase_order_line',
            'product',
            'product_sku',
            'product_name',
            'quantity_received',
            'unit_cost',
            'lot_number',
            'expiry_date',
            'notes',
        ]


class GoodsReceiptSerializer(serializers.ModelSerializer):
    supplier_name = serializers.CharField(source='supplier.name', read_only=True)
    purchase_order_reference = serializers.CharField(source='purchase_order.reference', read_only=True)
    lines = GoodsReceiptLineSerializer(many=True)

    class Meta:
        model = GoodsReceipt
        fields = [
            'id',
            'purchase_order',
            'purchase_order_reference',
            'supplier',
            'supplier_name',
            'reference',
            'status',
            'received_by',
            'received_at',
            'posted_at',
            'notes',
            'lines',
            'created_at',
            'updated_at',
        ]

    def create(self, validated_data):
        lines_data = validated_data.pop('lines', [])
        receipt = GoodsReceipt.objects.create(**validated_data)
        GoodsReceiptLine.objects.bulk_create(
            [GoodsReceiptLine(receipt=receipt, **line_data) for line_data in lines_data]
        )
        return receipt

    def update(self, instance, validated_data):
        lines_data = validated_data.pop('lines', None)
        for field, value in validated_data.items():
            setattr(instance, field, value)
        instance.save()

        if lines_data is not None and instance.status != GoodsReceipt.STATUS_POSTED:
            existing_lines = {line.id: line for line in instance.lines.all()}
            seen_ids = set()
            for line_data in lines_data:
                line_id = line_data.get('id')
                if line_id and line_id in existing_lines:
                    line = existing_lines[line_id]
                    seen_ids.add(line_id)
                    for field, value in line_data.items():
                        if field != 'id':
                            setattr(line, field, value)
                    line.save()
                else:
                    GoodsReceiptLine.objects.create(receipt=instance, **line_data)
            for line_id, line in existing_lines.items():
                if line_id not in seen_ids:
                    line.delete()

        return instance


class MedicineProductSerializer(serializers.ModelSerializer):
    total_on_hand = serializers.SerializerMethodField()
    total_reserved = serializers.SerializerMethodField()
    total_available = serializers.SerializerMethodField()

    class Meta:
        model = MedicineProduct
        fields = [
            'id',
            'sku',
            'name',
            'category',
            'barcode',
            'supplier',
            'low_stock_threshold',
            'default_price',
            'controlled',
            'is_active',
            'total_on_hand',
            'total_reserved',
            'total_available',
            'created_at',
            'updated_at',
        ]

    def get_total_on_hand(self, instance):
        return sum(max(0, lot.quantity_on_hand) for lot in instance.stock_lots.all())

    def get_total_reserved(self, instance):
        return sum(max(0, lot.quantity_reserved) for lot in instance.stock_lots.all())

    def get_total_available(self, instance):
        return sum(lot.quantity_available for lot in instance.stock_lots.all())


class StockLotSerializer(serializers.ModelSerializer):
    product_sku = serializers.CharField(source='product.sku', read_only=True)
    product_name = serializers.CharField(source='product.name', read_only=True)
    quantity_available = serializers.IntegerField(read_only=True)

    class Meta:
        model = StockLot
        fields = [
            'id',
            'product',
            'product_sku',
            'product_name',
            'lot_number',
            'expiry_date',
            'supplier',
            'barcode',
            'quantity_received',
            'quantity_on_hand',
            'quantity_reserved',
            'quantity_available',
            'unit_cost',
            'is_primary_snapshot',
            'is_recalled',
            'notes',
            'received_at',
            'created_at',
            'updated_at',
        ]


class StockMovementSerializer(serializers.ModelSerializer):
    product_sku = serializers.CharField(source='product.sku', read_only=True)
    product_name = serializers.CharField(source='product.name', read_only=True)
    lot_number = serializers.CharField(source='lot.lot_number', read_only=True)

    class Meta:
        model = StockMovement
        fields = [
            'id',
            'product',
            'product_sku',
            'product_name',
            'lot',
            'lot_number',
            'movement_type',
            'quantity',
            'balance_after',
            'reference',
            'notes',
            'created_at',
        ]


class DrugInventorySerializer(serializers.ModelSerializer):
    PLACEHOLDER_VALUES = {'n/a', 'na', 'none', 'null', '-'}
    product_id = serializers.IntegerField(source='product.id', read_only=True)

    @staticmethod
    def _fallback_price_for_item(name, sku):
        seed = f'{name}|{sku}'
        total = sum(ord(ch) for ch in seed)
        # Deterministic testing range in EGP.
        return round(18.0 + ((total % 104) * 1.25), 2)

    class Meta:
        model = DrugInventory
        fields = [
            'id',
            'product_id',
            'sku',
            'name',
            'category',
            'quantity',
            'expiry_date',
            'low_stock_threshold',
            'batch_number',
            'barcode',
            'supplier',
            'price',
            'controlled',
            'updated_at',
        ]
        extra_kwargs = {
            'sku': {'validators': []},
        }

    def to_internal_value(self, data):
        mutable_data = data.copy() if hasattr(data, 'copy') else dict(data)
        if mutable_data.get('sku') in [None, ''] and mutable_data.get('id') not in [None, '']:
            mutable_data['sku'] = mutable_data.get('id')
        if mutable_data.get('quantity') in [None, ''] and mutable_data.get('stock') not in [None, '']:
            mutable_data['quantity'] = mutable_data.get('stock')
        if mutable_data.get('expiry_date') in [None, ''] and mutable_data.get('expiry') not in [None, '']:
            mutable_data['expiry_date'] = mutable_data.get('expiry')
        if mutable_data.get('low_stock_threshold') in [None, ''] and mutable_data.get('threshold') not in [None, '']:
            mutable_data['low_stock_threshold'] = mutable_data.get('threshold')
        if mutable_data.get('batch_number') in [None, ''] and mutable_data.get('batch') not in [None, '']:
            mutable_data['batch_number'] = mutable_data.get('batch')

        for field in ['expiry_date', 'batch_number', 'supplier', 'barcode', 'category']:
            value = mutable_data.get(field)
            if isinstance(value, str) and value.strip().lower() in self.PLACEHOLDER_VALUES:
                mutable_data[field] = None if field == 'expiry_date' else ''

        return super().to_internal_value(mutable_data)

    def create(self, validated_data):
        sku = validated_data.get('sku')
        if sku:
            instance = DrugInventory.objects.filter(sku=sku).first()
            if instance:
                return self.update(instance, validated_data)
        return super().create(validated_data)

    def update(self, instance, validated_data):
        for field, value in validated_data.items():
            setattr(instance, field, value)
        instance.save()
        return instance

    def to_representation(self, instance):
        data = super().to_representation(instance)
        try:
            price_val = float(data.get('price') or 0)
        except (TypeError, ValueError):
            price_val = 0.0
        if price_val <= 0:
            data['price'] = f"{self._fallback_price_for_item(data.get('name', ''), data.get('sku', '')):.2f}"
        return data


class PharmacyOrderSerializer(serializers.ModelSerializer):
    patient_name = serializers.CharField(source='patient.full_name', read_only=True)
    medication = serializers.CharField(source='prescription.medication', read_only=True)
    items = serializers.SerializerMethodField()
    invoice_id = serializers.SerializerMethodField()
    invoice_status = serializers.SerializerMethodField()

    class Meta:
        model = PharmacyOrder
        fields = [
            'id',
            'prescription',
            'patient',
            'patient_name',
            'medication',
            'status',
            'prepared_notes',
            'subtotal',
            'tax_rate',
            'tax_amount',
            'total_amount',
            'missing_items_count',
            'prepared_at',
            'stock_reserved_at',
            'stock_deducted_at',
            'dispensed_at',
            'invoice_id',
            'invoice_status',
            'items',
            'created_at',
        ]

    def to_representation(self, instance):
        data = super().to_representation(instance)
        if data.get('status') == 'Pending':
            data['status'] = 'New'
        return data

    def get_items(self, instance):
        items = getattr(instance, 'items', None)
        if items is None:
            items = instance.items.all()
        return PharmacyOrderItemSerializer(items, many=True).data

    def get_invoice_id(self, instance):
        try:
            invoice = instance.invoice
        except Invoice.DoesNotExist:
            invoice = None
        return getattr(invoice, 'id', None)

    def get_invoice_status(self, instance):
        try:
            invoice = instance.invoice
        except Invoice.DoesNotExist:
            invoice = None
        return getattr(invoice, 'status', None)


class PharmacyOrderItemSerializer(serializers.ModelSerializer):
    inventory_sku = serializers.CharField(source='inventory.sku', read_only=True)
    inventory_name = serializers.CharField(source='inventory.name', read_only=True)

    class Meta:
        model = PharmacyOrderItem
        fields = [
            'id',
            'source_name',
            'medicine_name',
            'dosage',
            'quantity',
            'available_quantity',
            'unit_price',
            'line_total',
            'in_stock',
            'notes',
            'sort_order',
            'inventory_sku',
            'inventory_name',
        ]


class PharmacyOrderPreparationItemSerializer(serializers.Serializer):
    source_name = serializers.CharField(max_length=120, required=False, allow_blank=True)
    medicine_name = serializers.CharField(max_length=120)
    dosage = serializers.CharField(max_length=120, required=False, allow_blank=True)
    quantity = serializers.IntegerField(min_value=1, required=False, default=1)
    inventory_sku = serializers.CharField(max_length=40, required=False, allow_blank=True)
    unit_price = serializers.DecimalField(max_digits=10, decimal_places=2, required=False)
    notes = serializers.CharField(required=False, allow_blank=True)
    sort_order = serializers.IntegerField(min_value=0, required=False, default=0)


class PharmacyOrderPreparationSerializer(serializers.Serializer):
    notes = serializers.CharField(required=False, allow_blank=True)
    items = PharmacyOrderPreparationItemSerializer(many=True)


class InvoiceSerializer(serializers.ModelSerializer):
    VALID_STATUSES = {'Pending', 'Paid', 'Overdue', 'Refunded'}
    VALID_TYPES = {Invoice.TYPE_DIRECT, Invoice.TYPE_PRESCRIPTION}
    patient_name = serializers.CharField(source='patient.full_name', read_only=True)
    order_id = serializers.IntegerField(source='order.id', read_only=True)
    lines = serializers.SerializerMethodField()

    class Meta:
        model = Invoice
        fields = [
            'id',
            'reference',
            'invoice_type',
            'source_reference',
            'patient',
            'patient_name',
            'order',
            'order_id',
            'subtotal',
            'tax_amount',
            'discount_amount',
            'amount',
            'status',
            'payment_method',
            'notes',
            'lines',
            'created_at',
            'updated_at',
        ]

    def to_internal_value(self, data):
        mutable_data = data.copy() if hasattr(data, 'copy') else dict(data)
        patient_value = mutable_data.get('patient')
        if isinstance(patient_value, str) and patient_value.strip() and not patient_value.strip().isdigit():
            patient = resolve_patient(patient_value)
            mutable_data['patient'] = patient.pk
        status_value = mutable_data.get('status')
        if isinstance(status_value, str):
            mutable_data['status'] = status_value.strip().title()
        return super().to_internal_value(mutable_data)

    def validate_status(self, value):
        normalized = str(value).strip().title()
        if normalized not in self.VALID_STATUSES:
            allowed = ', '.join(sorted(self.VALID_STATUSES))
            raise serializers.ValidationError(f'Invalid invoice status "{value}". Allowed values: {allowed}.')
        return normalized

    def validate_invoice_type(self, value):
        if value not in self.VALID_TYPES:
            allowed = ', '.join(sorted(self.VALID_TYPES))
            raise serializers.ValidationError(f'Invalid invoice type "{value}". Allowed values: {allowed}.')
        return value

    def get_lines(self, instance):
        return InvoiceLineSerializer(instance.lines.all(), many=True).data


class InvoiceLineSerializer(serializers.ModelSerializer):
    inventory_name = serializers.CharField(source='inventory.name', read_only=True)

    class Meta:
        model = InvoiceLine
        fields = [
            'id',
            'inventory',
            'inventory_name',
            'sku',
            'description',
            'quantity',
            'unit_price',
            'line_total',
            'source_type',
            'source_reference',
            'notes',
        ]


class DirectInvoiceLineInputSerializer(serializers.Serializer):
    sku = serializers.CharField(max_length=40)
    description = serializers.CharField(max_length=200, required=False, allow_blank=True)
    quantity = serializers.IntegerField(min_value=1)
    unit_price = serializers.DecimalField(max_digits=10, decimal_places=2, required=False)


class DirectInvoiceCreateSerializer(serializers.Serializer):
    patient = serializers.CharField(required=False, allow_blank=True)
    status = serializers.CharField(required=False, allow_blank=True)
    payment_method = serializers.CharField(required=False, allow_blank=True)
    source_reference = serializers.CharField(required=False, allow_blank=True)
    notes = serializers.CharField(required=False, allow_blank=True)
    tax_amount = serializers.DecimalField(max_digits=10, decimal_places=2, required=False, default='0.00')
    discount_amount = serializers.DecimalField(max_digits=10, decimal_places=2, required=False, default='0.00')
    lines = DirectInvoiceLineInputSerializer(many=True)


class ClinicSupplyRequestSerializer(serializers.ModelSerializer):
    inventory_name = serializers.CharField(source='inventory.name', read_only=True)

    class Meta:
        model = ClinicSupplyRequest
        fields = [
            'id',
            'inventory',
            'inventory_name',
            'sku',
            'item_name',
            'quantity',
            'priority',
            'status',
            'notes',
            'requested_by',
            'created_at',
            'updated_at',
        ]

    def to_internal_value(self, data):
        mutable_data = data.copy() if hasattr(data, 'copy') else dict(data)

        if mutable_data.get('inventory') in [None, '']:
            sku = str(mutable_data.get('sku', '')).strip()
            item_name = str(mutable_data.get('item_name', '')).strip()
            inventory = None
            if sku:
                inventory = DrugInventory.objects.filter(sku__iexact=sku).first()
            if not inventory and item_name:
                inventory = DrugInventory.objects.filter(name__iexact=item_name).first()
            if inventory:
                mutable_data['inventory'] = inventory.pk
                if not sku:
                    mutable_data['sku'] = inventory.sku
                if not item_name:
                    mutable_data['item_name'] = inventory.name

        return super().to_internal_value(mutable_data)
