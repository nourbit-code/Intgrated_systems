from django.db import models
from django.contrib.auth.models import User
from datetime import time
from datetime import date as current_date
import uuid

# -------------------------
# Insurance Company
# -------------------------
class InsuranceCompany(models.Model):
    name = models.CharField(max_length=200, unique=True)
    discount_percent = models.DecimalField(max_digits=5, decimal_places=2, default=0.0)  # percentage

    def __str__(self):
        return f"{self.name} ({self.discount_percent}%)"


# -------------------------
# Patient
# -------------------------
class Patient(models.Model):
    GENDER_CHOICES = [
        ('male', 'Male'),
        ('female', 'Female'),
    ]
    
    patient_id = models.AutoField(primary_key=True)
    global_patient_id = models.UUIDField(default=uuid.uuid4, unique=True, editable=False, db_index=True)
    name = models.CharField(max_length=200)
    age = models.PositiveIntegerField(null=True, blank=True)
    gender = models.CharField(max_length=20, choices=GENDER_CHOICES, blank=True)
    phone = models.CharField(max_length=20, blank=True)
    email = models.EmailField(max_length=254, blank=True, null=True)
    notes = models.TextField(blank=True)
    medical_history = models.TextField(blank=True)  # Store as comma-separated or JSON
    surgeries = models.TextField(blank=True)  # Store as comma-separated or JSON
    has_insurance = models.BooleanField(default=False)
    insurance_company = models.ForeignKey(InsuranceCompany, on_delete=models.SET_NULL, null=True, blank=True, related_name='patients')
    insurance_member_id = models.CharField(max_length=100, blank=True)
    insurance_valid_from = models.DateField(null=True, blank=True)
    insurance_valid_to = models.DateField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.name} ({self.patient_id})"

    def is_insurance_active(self, on_date=None):
        if not self.has_insurance or not self.insurance_company:
            return False
        check_date = on_date or current_date.today()
        if self.insurance_valid_from and check_date < self.insurance_valid_from:
            return False
        if self.insurance_valid_to and check_date > self.insurance_valid_to:
            return False
        return True


# -------------------------
# Doctor
# -------------------------
class Doctor(models.Model):
    doctor_id = models.AutoField(primary_key=True)
    name = models.CharField(max_length=200)
    specialty = models.CharField(max_length=200, blank=True)
    email = models.EmailField(max_length=254, unique=True, null=True, blank=True)
    password = models.CharField(max_length=128, null=True, blank=True)

    def __str__(self):
        return f"Dr. {self.name} - {self.specialty}"


# -------------------------
# Clinic Schedule (Default or Per-Doctor)
# -------------------------
class ClinicSchedule(models.Model):
    doctor = models.ForeignKey(Doctor, on_delete=models.SET_NULL, null=True, blank=True, related_name='clinic_schedules')
    open_days = models.JSONField(default=list)  # list of weekday indexes (0=Sun .. 6=Sat)
    open_time = models.TimeField(default=time(9, 0))
    close_time = models.TimeField(default=time(17, 0))
    slot_interval = models.PositiveIntegerField(default=30)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "Clinic Schedule"
        verbose_name_plural = "Clinic Schedules"

    def __str__(self):
        label = f"Dr. {self.doctor.name}" if self.doctor else "All Doctors"
        return f"{label} schedule"


# -------------------------
# Receptionist (linked to Django User)
# -------------------------
class Receptionist(models.Model):
    receptionist_id = models.AutoField(primary_key=True)
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='receptionist_profile')
    name = models.CharField(max_length=200)
    email = models.EmailField(max_length=254, unique=True, null=True, blank=True)
    password = models.CharField(max_length=128, null=True, blank=True)
    is_admin = models.BooleanField(default=False)

    def __str__(self):
        return self.name


# -------------------------
# Service
# -------------------------
class Service(models.Model):
    CATEGORY_CHOICES = [
        ('laser', 'Laser'),
        ('diagnosis', 'Diagnosis'),
    ]
    
    service_id = models.AutoField(primary_key=True)
    service_name = models.CharField(max_length=200)
    category = models.CharField(max_length=100, choices=CATEGORY_CHOICES, blank=True)
    duration_minutes = models.PositiveIntegerField(default=30)
    price = models.DecimalField(max_digits=10, decimal_places=2, default=0.0)

    def __str__(self):
        return f"{self.service_name} ({self.category})"


# -------------------------
# Appointment
# -------------------------
class Appointment(models.Model):
    STATUS_CHOICES = [
        ('booked', 'Booked'),
        ('checked_in', 'Checked-in'),
        ('completed', 'Completed'),
        ('cancelled', 'Cancelled'),
    ]

    appointment_id = models.AutoField(primary_key=True)
    patient = models.ForeignKey(Patient, on_delete=models.CASCADE, related_name='appointments')
    doctor = models.ForeignKey(Doctor, on_delete=models.SET_NULL, null=True, blank=True, related_name='appointments')

    type = models.CharField(max_length=100, blank=True)  # free field: Laser/Beauty/Diagnosis
    date = models.DateField()
    time = models.TimeField()
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='booked')
    notes = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    services = models.ManyToManyField(Service, through='AppointmentService', related_name='appointments')

    def __str__(self):
        return f"App#{self.appointment_id} - {self.patient.name} on {self.date} {self.time}"


class AppointmentService(models.Model):
    """
    join table for appointment <-> service
    includes custom price for service in this appointment if needed
    """
    appointment = models.ForeignKey(Appointment, on_delete=models.CASCADE)
    service = models.ForeignKey(Service, on_delete=models.CASCADE)
    appo_cost = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)

    class Meta:
        unique_together = ('appointment', 'service')

    def __str__(self):
        return f"Appointment {self.appointment_id} - {self.service.service_name}"


# -------------------------
# Invoice / Payment
# -------------------------
class Invoice(models.Model):
    PAYMENT_METHODS = [
        ('cash', 'Cash'),
        ('visa', 'Visa'),
        ('instapay', 'InstaPay'),
        ('ewallet', 'E-Wallet'),
        ('card', 'Card'),
        ('transfer', 'Bank Transfer'),
        ('other', 'Other'),
    ]
    
    PAYMENT_STATUS = [
        ('not_paid', 'Not Paid'),
        ('paid', 'Paid'),
        ('canceled', 'Canceled'),
    ]

    invoice_id = models.AutoField(primary_key=True)
    patient = models.ForeignKey(Patient, on_delete=models.CASCADE, related_name='invoices', null=True, blank=True)
    appointment = models.OneToOneField(Appointment, on_delete=models.CASCADE, related_name='invoice', null=True, blank=True)
    invoice_date = models.DateField(auto_now_add=True)
    issued_by = models.ForeignKey(Receptionist, on_delete=models.SET_NULL, null=True, blank=True)
    subtotal = models.DecimalField(max_digits=12, decimal_places=2, default=0.0)
    discount_amount = models.DecimalField(max_digits=12, decimal_places=2, default=0.0)
    insurance_provider = models.CharField(max_length=100, blank=True)
    insurance_coverage = models.DecimalField(max_digits=5, decimal_places=2, default=0.0)  # percentage
    insurance_amount = models.DecimalField(max_digits=12, decimal_places=2, default=0.0)
    total_amount = models.DecimalField(max_digits=12, decimal_places=2, default=0.0)
    payment_method = models.CharField(max_length=30, choices=PAYMENT_METHODS, blank=True, default='cash')
    payment_status = models.CharField(max_length=20, choices=PAYMENT_STATUS, default='not_paid')
    is_paid = models.BooleanField(default=False)

    def __str__(self):
        return f"Invoice {self.invoice_id} - {self.total_amount}"


class InvoiceItem(models.Model):
    """Individual service/item in an invoice"""
    item_id = models.AutoField(primary_key=True)
    invoice = models.ForeignKey(Invoice, on_delete=models.CASCADE, related_name='items')
    description = models.CharField(max_length=200)
    quantity = models.PositiveIntegerField(default=1)
    unit_price = models.DecimalField(max_digits=10, decimal_places=2, default=0.0)
    
    @property
    def amount(self):
        return self.quantity * self.unit_price
    
    def __str__(self):
        return f"{self.description} x{self.quantity} - {self.amount}"


# -------------------------
# Medical Record / Diagnosis
# -------------------------
class MedicalRecord(models.Model):
    record_id = models.AutoField(primary_key=True)
    patient = models.ForeignKey(Patient, on_delete=models.CASCADE, related_name='medical_records')
    doctor = models.ForeignKey(Doctor, on_delete=models.SET_NULL, null=True, blank=True)
    appointment = models.ForeignKey(Appointment, on_delete=models.SET_NULL, null=True, blank=True)
    notes = models.TextField(blank=True)
    diagnosis = models.TextField(blank=True)
    primary_disease_id = models.CharField(max_length=255, blank=True)
    primary_disease_label = models.CharField(max_length=255, blank=True)
    primary_disease_ontology = models.CharField(max_length=50, blank=True)
    symptom_ids = models.TextField(blank=True)  # JSON list of concept ids
    symptom_labels = models.TextField(blank=True)  # JSON list of labels
    location_ids = models.TextField(blank=True)  # JSON list of concept ids
    location_labels = models.TextField(blank=True)  # JSON list of labels
    severity = models.CharField(max_length=20, blank=True)  # mild/moderate/severe
    date = models.DateField(auto_now_add=True)

    def __str__(self):
        return f"Record {self.record_id} - {self.patient.name}"


# -------------------------
# Ontology Concepts (Cached)
# -------------------------
class MedicalConcept(models.Model):
    concept_id = models.CharField(max_length=255, unique=True)
    name = models.CharField(max_length=255)
    concept_type = models.CharField(max_length=50, db_index=True)  # disease/symptom/body_part
    ontology = models.CharField(max_length=50, db_index=True)
    code = models.CharField(max_length=100, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"{self.name} ({self.ontology})"


# -------------------------
# Medication / Prescription
# -------------------------
class Medication(models.Model):
    med_id = models.AutoField(primary_key=True)
    name = models.CharField(max_length=200)
    generic_name = models.CharField(max_length=200, blank=True)
    form = models.CharField(max_length=100, blank=True)  # e.g., tablet, cream
    strength = models.CharField(max_length=100, blank=True)
    manufacturer = models.CharField(max_length=200, blank=True)
    category = models.CharField(max_length=200, blank=True)
    region = models.CharField(max_length=100, blank=True)
    price = models.DecimalField(max_digits=10, decimal_places=2, default=0.0)

    def __str__(self):
        return f"{self.name} ({self.form} {self.strength})"


class Prescription(models.Model):
    prescription_id = models.AutoField(primary_key=True)
    medical_record = models.ForeignKey(MedicalRecord, on_delete=models.CASCADE, related_name='prescriptions')
    notes = models.TextField(blank=True)
    ordered_tests_json = models.TextField(blank=True, default='[]')
    date = models.DateField(auto_now_add=True)

    medications = models.ManyToManyField(Medication, through='PrescriptionMedication', related_name='prescriptions')

    def __str__(self):
        return f"Presc {self.prescription_id} for Record {self.medical_record.record_id}"


class PrescriptionMedication(models.Model):
    prescription = models.ForeignKey(Prescription, on_delete=models.CASCADE)
    medication = models.ForeignKey(Medication, on_delete=models.CASCADE)
    dosage = models.CharField(max_length=200, blank=True)  # e.g., "1 tablet twice daily"
    duration_days = models.PositiveIntegerField(null=True, blank=True)
    notes = models.TextField(blank=True)

    class Meta:
        unique_together = ('prescription', 'medication')

    def __str__(self):
        return f"{self.medication.name} in Presc {self.prescription_id}"


class PharmacyDispatch(models.Model):
    STATUS_CHOICES = [
        ('queued', 'Queued'),
        ('sent', 'Sent'),
        ('acknowledged', 'Acknowledged'),
        ('failed', 'Failed'),
    ]

    dispatch_id = models.AutoField(primary_key=True)
    prescription = models.ForeignKey(Prescription, on_delete=models.CASCADE, related_name='pharmacy_dispatches')
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='queued')
    idempotency_key = models.CharField(max_length=255, unique=True)
    external_request_id = models.CharField(max_length=255, blank=True)
    fhir_payload = models.JSONField(default=dict, blank=True)
    response_payload = models.JSONField(default=dict, blank=True)
    retry_count = models.PositiveIntegerField(default=0)
    last_error = models.TextField(blank=True)
    sent_at = models.DateTimeField(null=True, blank=True)
    acknowledged_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"Dispatch {self.dispatch_id} - Prescription {self.prescription_id} ({self.status})"


# -------------------------
# Treatment sessions & plans
# -------------------------
class TreatmentPlan(models.Model):
    plan_id = models.AutoField(primary_key=True)
    patient = models.ForeignKey(Patient, on_delete=models.CASCADE, related_name='treatment_plans')
    created_by = models.ForeignKey(Doctor, on_delete=models.SET_NULL, null=True, blank=True)
    notes = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"Plan {self.plan_id} - {self.patient.name}"


class TreatmentSession(models.Model):
    session_id = models.AutoField(primary_key=True)
    treatment_plan = models.ForeignKey(TreatmentPlan, on_delete=models.CASCADE, related_name='sessions', null=True, blank=True)
    patient = models.ForeignKey(Patient, on_delete=models.CASCADE, related_name='treatment_sessions')
    doctor = models.ForeignKey(Doctor, on_delete=models.SET_NULL, null=True, blank=True)
    service = models.ForeignKey(Service, on_delete=models.SET_NULL, null=True, blank=True)
    session_date = models.DateField()
    duration_minutes = models.PositiveIntegerField(default=30)
    notes = models.TextField(blank=True)
    price = models.DecimalField(max_digits=10, decimal_places=2, default=0.0)

    def __str__(self):
        return f"Session {self.session_id} for {self.patient.name} on {self.session_date}"


# -------------------------
# Allergies
# -------------------------
class Allergy(models.Model):
    allergy_id = models.AutoField(primary_key=True)
    name = models.CharField(max_length=200, unique=True)

    def __str__(self):
        return self.name


class PatientAllergy(models.Model):
    patient = models.ForeignKey(Patient, on_delete=models.CASCADE, related_name='allergies')
    allergy = models.ForeignKey(Allergy, on_delete=models.CASCADE)
    notes = models.TextField(blank=True)

    class Meta:
        unique_together = ('patient', 'allergy')

    def __str__(self):
        return f"{self.patient.name} - {self.allergy.name}"


# -------------------------
# Medical Conditions (for dropdown)
# -------------------------
class MedicalCondition(models.Model):
    condition_id = models.AutoField(primary_key=True)
    name = models.CharField(max_length=200, unique=True)
    
    def __str__(self):
        return self.name


class PatientMedicalCondition(models.Model):
    patient = models.ForeignKey(Patient, on_delete=models.CASCADE, related_name='medical_conditions')
    condition = models.ForeignKey(MedicalCondition, on_delete=models.CASCADE)
    notes = models.TextField(blank=True)
    
    class Meta:
        unique_together = ('patient', 'condition')
    
    def __str__(self):
        return f"{self.patient.name} - {self.condition.name}"


# -------------------------
# Surgeries (for dropdown)
# -------------------------
class SurgeryType(models.Model):
    surgery_id = models.AutoField(primary_key=True)
    name = models.CharField(max_length=200, unique=True)
    
    def __str__(self):
        return self.name


class PatientSurgery(models.Model):
    patient = models.ForeignKey(Patient, on_delete=models.CASCADE, related_name='patient_surgeries')
    surgery = models.ForeignKey(SurgeryType, on_delete=models.CASCADE)
    notes = models.TextField(blank=True)
    
    class Meta:
        unique_together = ('patient', 'surgery')
    
    def __str__(self):
        return f"{self.patient.name} - {self.surgery.name}"


# -------------------------
# Inventory Management
# -------------------------
class InventoryItem(models.Model):
    CATEGORY_CHOICES = [
        ('neurotoxin', 'Botulinum Toxin (Neurotoxin)'),
        ('ha_filler', 'Hyaluronic Acid Filler'),
        ('bio_filler', 'Biostimulatory Filler'),
        ('suture', 'Suture/Thread'),
        ('consumable', 'Consumable (Syringe/Needle)'),
        ('prescription', 'Topical/Rx (Prescription)'),
        ('equipment', 'Equipment/Tool'),
        ('cleaning', 'Cleaning/Sterilization'),
        ('other', 'Other'),
    ]
    
    UNIT_CHOICES = [
        ('vial', 'Vial'),
        ('unit', 'Unit'),
        ('syringe', 'Syringe'),
        ('ml', 'ml'),
        ('box', 'Box'),
        ('kit', 'Kit'),
        ('packet', 'Packet'),
        ('set', 'Set'),
        ('pack', 'Pack'),
        ('tube', 'Tube'),
        ('bottle', 'Bottle'),
        ('jar', 'Jar'),
        ('mg', 'mg'),
        ('item', 'Item'),
        ('wipe', 'Wipe'),
        ('gallon', 'Gallon'),
    ]

    item_id = models.AutoField(primary_key=True)
    name = models.CharField(max_length=200)
    category = models.CharField(max_length=50, choices=CATEGORY_CHOICES, default='other')
    quantity = models.PositiveIntegerField(default=0)
    unit = models.CharField(max_length=20, choices=UNIT_CHOICES, default='unit')
    supplier = models.CharField(max_length=200, blank=True)
    expiry_date = models.DateField(null=True, blank=True)
    linked_service = models.CharField(max_length=200, blank=True)
    min_stock_level = models.PositiveIntegerField(default=5)  # For low stock alerts
    cost_per_unit = models.DecimalField(max_digits=10, decimal_places=2, default=0.0)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"{self.name} ({self.quantity} {self.unit})"
    
    @property
    def is_low_stock(self):
        return self.quantity <= self.min_stock_level
    
    @property
    def is_expiring_soon(self):
        if not self.expiry_date:
            return False
        from datetime import date, timedelta
        return self.expiry_date <= date.today() + timedelta(days=90)


class StockTransaction(models.Model):
    """Track stock additions and usage"""
    TRANSACTION_TYPES = [
        ('add', 'Stock Added'),
        ('use', 'Stock Used'),
        ('adjust', 'Manual Adjustment'),
        ('expired', 'Expired/Disposed'),
    ]
    
    transaction_id = models.AutoField(primary_key=True)
    item = models.ForeignKey(InventoryItem, on_delete=models.CASCADE, related_name='transactions')
    transaction_type = models.CharField(max_length=20, choices=TRANSACTION_TYPES)
    quantity = models.IntegerField()  # Positive for add, negative for use
    notes = models.TextField(blank=True)
    performed_by = models.CharField(max_length=200, blank=True)  # Could be doctor or receptionist
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.transaction_type}: {self.quantity} {self.item.name}"


# -------------------------
# Patient Files (Photos and Documents)
# -------------------------
class PatientFile(models.Model):
    FILE_TYPE_CHOICES = [
        ('photo', 'Photo'),
        ('lab', 'Lab Test/Scan'),
        ('document', 'Document'),
        ('before_after', 'Before & After'),
    ]
    
    file_id = models.AutoField(primary_key=True)
    patient = models.ForeignKey(Patient, on_delete=models.CASCADE, related_name='files')
    medical_record = models.ForeignKey(MedicalRecord, on_delete=models.SET_NULL, null=True, blank=True, related_name='files')
    file_type = models.CharField(max_length=20, choices=FILE_TYPE_CHOICES, default='photo')
    file_url = models.TextField()  # Store base64 or file path
    file_name = models.CharField(max_length=255, blank=True)
    tag = models.CharField(max_length=100, blank=True)  # e.g., 'Before', 'After', 'Lab Result'
    caption = models.TextField(blank=True)
    uploaded_by = models.ForeignKey(Doctor, on_delete=models.SET_NULL, null=True, blank=True)
    source_system = models.CharField(max_length=100, blank=True)
    external_report_id = models.CharField(max_length=255, blank=True, db_index=True)
    fhir_payload = models.JSONField(default=dict, blank=True)
    reviewed = models.BooleanField(default=False)
    reviewed_by = models.ForeignKey(Doctor, on_delete=models.SET_NULL, null=True, blank=True, related_name='reviewed_files')
    reviewed_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.file_type} - {self.patient.name} ({self.created_at.strftime('%Y-%m-%d')})"


# -------------------------
# Laser Session
# -------------------------
class LaserSession(models.Model):
    SKIN_TYPE_CHOICES = [
        ('I', 'Type I - Very Fair'),
        ('II', 'Type II - Fair'),
        ('III', 'Type III - Medium'),
        ('IV', 'Type IV - Olive'),
        ('V', 'Type V - Brown'),
        ('VI', 'Type VI - Dark Brown/Black'),
    ]
    
    INTENSITY_CHOICES = [
        ('Low', 'Low'),
        ('Medium', 'Medium'),
        ('High', 'High'),
        ('Very High', 'Very High'),
    ]
    
    session_id = models.AutoField(primary_key=True)
    patient = models.ForeignKey(Patient, on_delete=models.CASCADE, related_name='laser_sessions')
    doctor = models.ForeignKey(Doctor, on_delete=models.SET_NULL, null=True, blank=True)
    medical_record = models.ForeignKey(MedicalRecord, on_delete=models.SET_NULL, null=True, blank=True, related_name='laser_session')
    
    # Treatment details
    treatment_area = models.CharField(max_length=200)
    skin_type = models.CharField(max_length=5, choices=SKIN_TYPE_CHOICES)
    intensity = models.CharField(max_length=20, choices=INTENSITY_CHOICES, default='Medium')
    passes = models.PositiveIntegerField(default=1)
    notes = models.TextField(blank=True)
    
    # Post-care instructions (stored as JSON)
    post_care_instructions = models.TextField(blank=True)  # JSON array of selected instructions
    
    # Consumables used (stored as JSON)
    consumables_used = models.TextField(blank=True)  # JSON array of {itemId, name, quantity}
    
    session_date = models.DateField(auto_now_add=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"Laser Session {self.session_id} - {self.patient.name} ({self.treatment_area})"


# -------------------------
# Audit: previous visits flag (simple boolean/derived)
# -------------------------
# You can compute previous visits by checking patient.appointments.filter(date__lt=today).exists()
