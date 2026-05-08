from django.contrib import admin

from clinic.models import Appointment, Doctor, MedicalRecord, Patient, Prescription

admin.site.register(Patient)
admin.site.register(Doctor)
admin.site.register(Appointment)
admin.site.register(MedicalRecord)
admin.site.register(Prescription)
