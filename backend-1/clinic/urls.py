from rest_framework import routers
from django.urls import path, include
from . import views

router = routers.DefaultRouter()
router.register(r'patients', views.PatientViewSet)
router.register(r'doctors', views.DoctorViewSet)
router.register(r'receptionists', views.ReceptionistViewSet)
router.register(r'services', views.ServiceViewSet)
router.register(r'appointments', views.AppointmentViewSet)
router.register(r'invoices', views.InvoiceViewSet)
router.register(r'medical-records', views.MedicalRecordViewSet)
router.register(r'medications', views.MedicationViewSet)
router.register(r'prescriptions', views.PrescriptionViewSet)
router.register(r'treatment-plans', views.TreatmentPlanViewSet)
router.register(r'treatment-sessions', views.TreatmentSessionViewSet)
router.register(r'allergies', views.AllergyViewSet)
router.register(r'patient-allergies', views.PatientAllergyViewSet)
router.register(r'medical-conditions', views.MedicalConditionViewSet)
router.register(r'patient-medical-conditions', views.PatientMedicalConditionViewSet)
router.register(r'surgery-types', views.SurgeryTypeViewSet)
router.register(r'patient-surgeries', views.PatientSurgeryViewSet)
router.register(r'insurance-companies', views.InsuranceCompanyViewSet)
router.register(r'clinic-schedules', views.ClinicScheduleViewSet)
router.register(r'inventory', views.InventoryItemViewSet)
router.register(r'stock-transactions', views.StockTransactionViewSet)

urlpatterns = [
    path('login/', views.login, name='login'),
    path('integration/fhir/lab-results/ingest/', views.ingest_fhir_lab_results, name='ingest_fhir_lab_results'),
    path('integration/fhir/lab-orders/dispatch/', views.dispatch_lab_orders, name='dispatch_lab_orders'),
    path('integration/fhir/insurance-providers/dispatch/', views.dispatch_insurance_providers_to_lab, name='dispatch_insurance_providers_to_lab'),
    path('integration/fhir/lab-catalog/', views.get_lab_catalog, name='get_lab_catalog'),
    path('integration/fhir/pharmacy/dispatch/', views.dispatch_prescription_to_pharmacy, name='dispatch_prescription_to_pharmacy'),
    path('lab-results/<int:file_id>/review/', views.mark_lab_result_reviewed, name='mark_lab_result_reviewed'),
    path('ontology/search/', views.ontology_search, name='ontology_search'),
    path('reports/analytics/', views.report_analytics, name='report_analytics'),
    path('reports/appointments/', views.appointments_report, name='appointments_report'),
    path('reports/inventory/', views.inventory_report, name='inventory_report'),
    path('reports/patients/', views.patients_analytics, name='patients_analytics'),
    path('', include(router.urls)),
]
