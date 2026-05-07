from django.contrib import admin

from .models import InventoryItem, InventoryPurchaseOrder, InventoryTransaction

admin.site.register(InventoryItem)
admin.site.register(InventoryTransaction)
admin.site.register(InventoryPurchaseOrder)
