from django.contrib import admin
from django.urls import include, path
from rest_framework.routers import DefaultRouter

from clinic import views as clinic_views
from clinic import fhir_views
from config.api_views import LoginView
from pharmacy import views as pharmacy_views

router = DefaultRouter()
router.register('patients', clinic_views.PatientViewSet, basename='patients')
router.register('appointments', clinic_views.AppointmentViewSet, basename='appointments')
router.register('medical-records', clinic_views.MedicalRecordViewSet, basename='medical-records')
router.register('prescriptions', clinic_views.PrescriptionViewSet, basename='prescriptions')
router.register('suppliers', pharmacy_views.SupplierViewSet, basename='suppliers')
router.register('products', pharmacy_views.MedicineProductViewSet, basename='products')
router.register('purchase-orders', pharmacy_views.PurchaseOrderViewSet, basename='purchase-orders')
router.register('inventory', pharmacy_views.DrugInventoryViewSet, basename='inventory')
router.register('stock-lots', pharmacy_views.StockLotViewSet, basename='stock-lots')
router.register('stock-movements', pharmacy_views.StockMovementViewSet, basename='stock-movements')
router.register('goods-receipts', pharmacy_views.GoodsReceiptViewSet, basename='goods-receipts')
router.register('pharmacy-orders', pharmacy_views.PharmacyOrderViewSet, basename='pharmacy-orders')
router.register('invoices', pharmacy_views.InvoiceViewSet, basename='invoices')
router.register('billing', pharmacy_views.InvoiceViewSet, basename='billing')
router.register('clinic-requests', pharmacy_views.ClinicSupplyRequestViewSet, basename='clinic-requests')

urlpatterns = [
    path('admin/', admin.site.urls),
    path('login/', LoginView.as_view()),
    path('alerts/', pharmacy_views.AlertListView.as_view()),
    path('api/v1/integration/pharmacy-medications', pharmacy_views.IntegrationMedicationCatalogView.as_view()),
    path('api/v1/integration/catalog', pharmacy_views.IntegrationMedicationCatalogView.as_view()),
    path('api/v1/integration/pharmacy-medications/sync-from-clinic', pharmacy_views.IntegrationPharmacyMedicationSyncView.as_view()),
    path('fhir/MedicationRequest/', fhir_views.FhirMedicationRequestListView.as_view()),
    path('fhir/MedicationRequest/<int:pk>/', fhir_views.FhirMedicationRequestDetailView.as_view()),
    path('fhir/MedicationRequest/$import/', fhir_views.FhirMedicationRequestImportView.as_view()),
    path('fhir/MedicationDispense/', fhir_views.FhirMedicationDispenseListView.as_view()),
    path('fhir/MedicationDispense/<int:pk>/', fhir_views.FhirMedicationDispenseDetailView.as_view()),
    path('', include(router.urls)),
]
