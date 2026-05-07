from django.conf import settings
from django.conf.urls.static import static
from django.contrib import admin
from django.http import JsonResponse
from django.urls import include, path
from rest_framework.routers import DefaultRouter

from apps.accounts.views import CsrfView, LoginView, LogoutView, MeView, UserViewSet
from apps.appointments.views import AppointmentViewSet
from apps.audit.views import ActivityLogViewSet
from apps.billing.views import InsuranceProviderViewSet, InvoiceViewSet, PaymentViewSet, clinic_insurance_providers_upsert
from apps.inventory.views import InventoryItemViewSet, InventoryPurchaseOrderViewSet, InventoryTransactionViewSet
from apps.lab.views import (
    LabResultViewSet,
    LabTestOrderViewSet,
    LabTestTypeViewSet,
    ingest_clinic_orders,
    public_lab_catalog,
    seed_default_lab_catalog,
)
from apps.patients.views import PatientViewSet, clinic_patient_upsert
from apps.scans.views import ScanOrderViewSet, ScanResultViewSet, ScanTypeViewSet
from apps.reports.views import DailyTestsReportView, WeeklyTestsReportView, RevenueReportView, InventoryReportView

# Force admin modules to register models
from apps.audit import admin as audit_admin  # noqa: F401
from apps.accounts import admin as accounts_admin  # noqa: F401
from apps.appointments import admin as appointments_admin  # noqa: F401
from apps.billing import admin as billing_admin  # noqa: F401
from apps.inventory import admin as inventory_admin  # noqa: F401
from apps.lab import admin as lab_admin  # noqa: F401
from apps.patients import admin as patients_admin  # noqa: F401
from apps.scans import admin as scans_admin  # noqa: F401

router = DefaultRouter()
router.register(r"users", UserViewSet)
router.register(r"patients", PatientViewSet)
router.register(r"appointments", AppointmentViewSet)
router.register(r"lab-test-types", LabTestTypeViewSet)
router.register(r"lab-test-orders", LabTestOrderViewSet)
router.register(r"lab-results", LabResultViewSet)
router.register(r"scan-types", ScanTypeViewSet)
router.register(r"scan-orders", ScanOrderViewSet)
router.register(r"scan-results", ScanResultViewSet)
router.register(r"inventory-items", InventoryItemViewSet)
router.register(r"inventory-transactions", InventoryTransactionViewSet)
router.register(r"inventory-purchase-orders", InventoryPurchaseOrderViewSet)
router.register(r"invoices", InvoiceViewSet)
router.register(r"payments", PaymentViewSet)
router.register(r"insurance-providers", InsuranceProviderViewSet)
router.register(r"activity-log", ActivityLogViewSet)

urlpatterns = [
    path("admin/", admin.site.urls),
    path("admin-debug/", lambda request: JsonResponse({"apps": [a["app_label"] for a in admin.site.get_app_list(request)]})),
    path("api/v1/reports/daily-tests", DailyTestsReportView.as_view()),
    path("api/v1/reports/weekly-tests", WeeklyTestsReportView.as_view()),
    path("api/v1/reports/revenue", RevenueReportView.as_view()),
    path("api/v1/reports/inventory", InventoryReportView.as_view()),
    path("api/v1/auth/csrf", CsrfView.as_view()),
    path("api/v1/auth/login", LoginView.as_view()),
    path("api/v1/auth/logout", LogoutView.as_view()),
    path("api/v1/auth/me", MeView.as_view()),
    path("api/v1/integration/clinic/lab-orders/ingest", ingest_clinic_orders),
    path("api/v1/integration/clinic/patients/upsert", clinic_patient_upsert),
    path("api/v1/integration/clinic/insurance-providers/upsert", clinic_insurance_providers_upsert),
    path("api/v1/integration/catalog", public_lab_catalog),
    path("api/v1/integration/catalog/seed-defaults", seed_default_lab_catalog),
    path("api/v1/", include(router.urls)),
]

if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
