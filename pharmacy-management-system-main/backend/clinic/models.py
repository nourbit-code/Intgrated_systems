from django.db import models


class Patient(models.Model):
    full_name = models.CharField(max_length=120)
    phone = models.CharField(max_length=30, blank=True)
    date_of_birth = models.DateField(null=True, blank=True)
    age = models.PositiveIntegerField(null=True, blank=True)
    allergies = models.CharField(max_length=255, blank=True)
    chronic_conditions = models.CharField(max_length=255, blank=True)
    history_notes = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return self.full_name


class Doctor(models.Model):
    full_name = models.CharField(max_length=120)
    specialty = models.CharField(max_length=120, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return self.full_name


class Appointment(models.Model):
    patient = models.ForeignKey(Patient, on_delete=models.CASCADE, related_name='appointments')
    doctor = models.ForeignKey(Doctor, on_delete=models.SET_NULL, null=True, related_name='appointments')
    scheduled_at = models.DateTimeField()
    status = models.CharField(max_length=30, default='Scheduled')
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f'{self.patient} - {self.scheduled_at:%Y-%m-%d %H:%M}'


class MedicalRecord(models.Model):
    patient = models.ForeignKey(Patient, on_delete=models.CASCADE, related_name='medical_records')
    doctor = models.ForeignKey(Doctor, on_delete=models.SET_NULL, null=True, related_name='medical_records')
    diagnosis = models.TextField()
    notes = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f'{self.patient} - {self.created_at:%Y-%m-%d}'


class Prescription(models.Model):
    medical_record = models.ForeignKey(MedicalRecord, on_delete=models.CASCADE, related_name='prescriptions')
    patient = models.ForeignKey(Patient, on_delete=models.CASCADE, related_name='prescriptions')
    doctor = models.ForeignKey(Doctor, on_delete=models.SET_NULL, null=True, related_name='prescriptions')
    external_system = models.CharField(max_length=120, null=True, blank=True)
    external_id = models.CharField(max_length=120, null=True, blank=True)
    medication = models.CharField(max_length=120)
    dosage = models.CharField(max_length=120)
    instructions = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=['external_system', 'external_id'],
                name='unique_external_prescription',
                condition=models.Q(external_id__isnull=False),
            ),
        ]

    def __str__(self):
        return f'{self.medication} for {self.patient}'
