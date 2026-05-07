from django.contrib import admin

from .models import ScanOrder, ScanResult, ScanType

admin.site.register(ScanType)
admin.site.register(ScanOrder)
admin.site.register(ScanResult)
