from django.contrib import admin

from pharmacy.models import (
    ClinicSupplyRequest,
    DrugInventory,
    Invoice,
    MedicineProduct,
    PharmacyOrder,
    StockLot,
    StockMovement,
)

admin.site.register(DrugInventory)
admin.site.register(MedicineProduct)
admin.site.register(StockLot)
admin.site.register(StockMovement)
admin.site.register(PharmacyOrder)
admin.site.register(Invoice)
admin.site.register(ClinicSupplyRequest)
