from django.contrib.auth.models import AbstractUser
from django.db import models


class User(AbstractUser):
    class Roles(models.TextChoices):
        LAB_TECH = "LAB_TECH", "Lab Tech"
        RECEPTIONIST = "RECEPTIONIST", "Receptionist"

    role = models.CharField(max_length=20, choices=Roles.choices, default=Roles.RECEPTIONIST)
    phone = models.CharField(max_length=30, blank=True)
    job_title = models.CharField(max_length=120, blank=True)
    department = models.CharField(max_length=120, blank=True)
    shift = models.CharField(max_length=80, blank=True)
    working_days = models.CharField(max_length=120, blank=True)
    working_hours_start = models.CharField(max_length=10, blank=True)
    working_hours_end = models.CharField(max_length=10, blank=True)
    contact_phone = models.CharField(max_length=30, blank=True)
    contact_email = models.EmailField(blank=True, null=True)
    emergency_contact = models.CharField(max_length=255, blank=True)
    address = models.TextField(blank=True)
    photo_data_url = models.TextField(blank=True)
    notes = models.TextField(blank=True)

    def __str__(self) -> str:
        return f"{self.username} ({self.role})"

