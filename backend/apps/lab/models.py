from django.conf import settings
from django.db import models


class LabTestType(models.Model):
    name = models.CharField(max_length=255)
    code = models.CharField(max_length=50, unique=True)
    category = models.CharField(max_length=100, blank=True, null=True)
    description = models.TextField(blank=True, null=True)
    default_price = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    result_unit = models.CharField(max_length=40, blank=True, null=True)
    reference_min = models.DecimalField(max_digits=10, decimal_places=2, blank=True, null=True)
    reference_max = models.DecimalField(max_digits=10, decimal_places=2, blank=True, null=True)
    reference_text = models.CharField(max_length=120, blank=True, null=True)
    turnaround_hours = models.PositiveIntegerField(default=24)
    is_active = models.BooleanField(default=True)

    def __str__(self) -> str:
        return self.name


class LabTestOrder(models.Model):
    class Status(models.TextChoices):
        WAITING_FOR_SAMPLE = "waiting_for_sample", "Waiting for Sample"
        IN_PROGRESS = "in_progress", "In Progress"
        COMPLETED = "completed", "Completed"
        CANCELLED = "cancelled", "Cancelled"

    appointment = models.ForeignKey("appointments.Appointment", on_delete=models.CASCADE, related_name="lab_orders")
    test_type = models.ForeignKey(LabTestType, on_delete=models.PROTECT, related_name="orders")
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.WAITING_FOR_SAMPLE)
    price = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    sample_collected_at = models.DateTimeField(blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self) -> str:
        return f"{self.test_type.name} - {self.appointment.patient.full_name}"


class LabResult(models.Model):
    lab_test_order = models.OneToOneField(LabTestOrder, on_delete=models.CASCADE, related_name="result")
    result_text = models.TextField(blank=True, null=True)
    normal_range = models.CharField(max_length=100, blank=True, null=True)
    result_file = models.FileField(upload_to="lab_results/", blank=True, null=True)
    reported_at = models.DateTimeField(blank=True, null=True)
    reported_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="reported_lab_results",
    )
    source_system = models.CharField(max_length=50, blank=True, null=True)
    external_ref = models.CharField(max_length=100, blank=True, null=True)

    def __str__(self) -> str:
        return f"Result for {self.lab_test_order}" 
