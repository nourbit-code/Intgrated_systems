from rest_framework import serializers

from .models import InventoryItem, InventoryPurchaseOrder, InventoryTransaction


class InventoryItemSerializer(serializers.ModelSerializer):
    class Meta:
        model = InventoryItem
        fields = '__all__'


class InventoryTransactionSerializer(serializers.ModelSerializer):
    class Meta:
        model = InventoryTransaction
        fields = '__all__'


class InventoryPurchaseOrderSerializer(serializers.ModelSerializer):
    class Meta:
        model = InventoryPurchaseOrder
        fields = '__all__'
