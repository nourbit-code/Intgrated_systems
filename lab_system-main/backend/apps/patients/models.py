from django.conf import settings
from django.db import models
import uuid


class Patient(models.Model):
    class Gender(models.TextChoices):
        MALE = "male", "Male"
        FEMALE = "female", "Female"
        OTHER = "other", "Other"

    full_name = models.CharField(max_length=255)
    dob = models.DateField()
    gender = models.CharField(max_length=20, choices=Gender.choices)
    phone = models.CharField(max_length=30)
    email = models.EmailField(blank=True, null=True)
    address = models.TextField(blank=True, null=True)
    insurance_provider = models.CharField(max_length=120, blank=True, null=True)
    insurance_policy_number = models.CharField(max_length=120, blank=True, null=True)
    insurance_member_id = models.CharField(max_length=120, blank=True, null=True)
    insurance_expiry = models.DateField(blank=True, null=True)
    primary_lab_tech = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="primary_patients",
    )
    global_patient_id = models.UUIDField(default=uuid.uuid4, unique=True, db_index=True)
    external_id = models.CharField(max_length=100, blank=True, null=True, unique=True)
    clinical_profile_snapshot = models.JSONField(default=dict, blank=True)
    consent_signed = models.BooleanField(default=False)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self) -> str:
        return self.full_name

    # Backward-compat alias while code and clients migrate from old naming.
    @property
    def primary_doctor(self):
        return self.primary_lab_tech

    @primary_doctor.setter
    def primary_doctor(self, value):
        self.primary_lab_tech = value
