from django.contrib import admin

from .models import InsuranceProvider, Invoice, Payment

admin.site.register(Invoice)
admin.site.register(Payment)
admin.site.register(InsuranceProvider)
