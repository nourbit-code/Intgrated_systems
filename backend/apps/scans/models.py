from django.conf import settings
from django.db import models


class ScanType(models.Model):
    name = models.CharField(max_length=255)
    code = models.CharField(max_length=50, unique=True)
    modality = models.CharField(max_length=50, blank=True, null=True)
    description = models.TextField(blank=True, null=True)
    default_price = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    turnaround_hours = models.PositiveIntegerField(default=24)
    is_active = models.BooleanField(default=True)

    def __str__(self) -> str:
        return self.name


class ScanOrder(models.Model):
    class Status(models.TextChoices):
        IN_PROGRESS = "in_progress", "In Progress"
        COMPLETED = "completed", "Completed"
        CANCELLED = "cancelled", "Cancelled"

    appointment = models.ForeignKey("appointments.Appointment", on_delete=models.CASCADE, related_name="scan_orders")
    scan_type = models.ForeignKey(ScanType, on_delete=models.PROTECT, related_name="orders")
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.IN_PROGRESS)
    price = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    performed_at = models.DateTimeField(blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self) -> str:
        return f"{self.scan_type.name} - {self.appointment.patient.full_name}"


class ScanResult(models.Model):
    scan_order = models.OneToOneField(ScanOrder, on_delete=models.CASCADE, related_name="result")
    finding_text = models.TextField(blank=True, null=True)
    image_file = models.FileField(upload_to="scan_results/", blank=True, null=True)
    reported_at = models.DateTimeField(blank=True, null=True)
    reported_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="reported_scan_results",
    )
    source_system = models.CharField(max_length=50, blank=True, null=True)
    external_ref = models.CharField(max_length=100, blank=True, null=True)

    def __str__(self) -> str:
        return f"Result for {self.scan_order}" 
