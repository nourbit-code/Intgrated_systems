from django.contrib import admin

from .models import LabResult, LabTestOrder, LabTestType

admin.site.register(LabTestType)
admin.site.register(LabTestOrder)
admin.site.register(LabResult)
