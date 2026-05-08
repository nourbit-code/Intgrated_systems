from django.db import transaction
from rest_framework import serializers

from clinic.models import Appointment, Doctor, MedicalRecord, Patient, Prescription
from clinic.utils import resolve_doctor, resolve_patient
from pharmacy.models import Invoice


class PatientSerializer(serializers.ModelSerializer):
    name = serializers.CharField(source='full_name', required=False)
    chronic = serializers.CharField(source='chronic_conditions', required=False, allow_blank=True)
    history = serializers.CharField(source='history_notes', required=False, allow_blank=True)

    class Meta:
        model = Patient
        fields = [
            'id',
            'full_name',
            'name',
            'phone',
            'date_of_birth',
            'age',
            'allergies',
            'chronic_conditions',
            'chronic',
            'history_notes',
            'history',
            'created_at',
        ]

    def to_internal_value(self, data):
        mutable_data = data.copy() if hasattr(data, 'copy') else dict(data)
        if mutable_data.get('full_name') in [None, ''] and mutable_data.get('name') not in [None, '']:
            mutable_data['full_name'] = mutable_data.get('name')
        if mutable_data.get('chronic_conditions') in [None, ''] and mutable_data.get('chronic') not in [None, '']:
            mutable_data['chronic_conditions'] = mutable_data.get('chronic')
        if mutable_data.get('history_notes') in [None, ''] and mutable_data.get('history') not in [None, '']:
            mutable_data['history_notes'] = mutable_data.get('history')
        return super().to_internal_value(mutable_data)

    def validate(self, attrs):
        if 'full_name' not in attrs and 'name' not in self.initial_data:
            raise serializers.ValidationError({'name': 'Patient name is required.'})
        return super().validate(attrs)


class DoctorSerializer(serializers.ModelSerializer):
    class Meta:
        model = Doctor
        fields = ['id', 'full_name', 'specialty', 'created_at']


class AppointmentSerializer(serializers.ModelSerializer):
    class Meta:
        model = Appointment
        fields = ['id', 'patient', 'doctor', 'scheduled_at', 'status', 'created_at']


class PrescriptionSerializer(serializers.ModelSerializer):
    patient_name = serializers.CharField(source='patient.full_name', read_only=True)
    doctor_name = serializers.CharField(source='doctor.full_name', read_only=True)
    meds = serializers.SerializerMethodField()
    notes = serializers.CharField(source='instructions', read_only=True)
    status = serializers.SerializerMethodField()
    pharmacy_order_id = serializers.SerializerMethodField()
    invoice_id = serializers.SerializerMethodField()
    invoice_status = serializers.SerializerMethodField()
    controlled = serializers.SerializerMethodField()

    class Meta:
        model = Prescription
        fields = [
            'id',
            'medical_record',
            'patient',
            'patient_name',
            'doctor',
            'doctor_name',
            'medication',
            'meds',
            'dosage',
            'instructions',
            'notes',
            'status',
            'pharmacy_order_id',
            'invoice_id',
            'invoice_status',
            'controlled',
            'created_at',
        ]

    def get_status(self, obj):
        order = getattr(obj, 'pharmacy_order', None)
        if not order:
            return 'New'
        return 'New' if order.status == 'Pending' else order.status

    def get_pharmacy_order_id(self, obj):
        order = getattr(obj, 'pharmacy_order', None)
        return getattr(order, 'id', None)

    def get_invoice_id(self, obj):
        order = getattr(obj, 'pharmacy_order', None)
        if not order:
            return None
        try:
            invoice = order.invoice
        except Invoice.DoesNotExist:
            return None
        return getattr(invoice, 'id', None)

    def get_invoice_status(self, obj):
        order = getattr(obj, 'pharmacy_order', None)
        if not order:
            return None
        try:
            invoice = order.invoice
        except Invoice.DoesNotExist:
            return None
        return getattr(invoice, 'status', None)

    def get_controlled(self, obj):
        inventory_by_name = getattr(obj, '_inventory_by_name', None)
        if inventory_by_name is None:
            inventory_by_name = self.context.get('inventory_by_name', {})
        if inventory_by_name is None:
            return False
        return bool(inventory_by_name.get(obj.medication.casefold(), False))

    def get_meds(self, obj):
        order = getattr(obj, 'pharmacy_order', None)
        if order and hasattr(order, 'items'):
            prepared_names = []
            for item in order.items.all():
                name = str(item.medicine_name or item.source_name or '').strip()
                if name:
                    prepared_names.append(name)
            if prepared_names:
                # keep insertion order while removing duplicates
                unique_names = list(dict.fromkeys(prepared_names))
                return ', '.join(unique_names)
        return obj.medication


class FrontendPrescriptionCreateSerializer(serializers.Serializer):
    patient = serializers.CharField(max_length=120)
    diagnosis = serializers.CharField()
    medication = serializers.CharField(max_length=120)
    dosage = serializers.CharField(max_length=120, required=False, allow_blank=True)
    notes = serializers.CharField(required=False, allow_blank=True)
    doctor = serializers.CharField(max_length=120, required=False, allow_blank=True)

    default_error_messages = {
        'patient_required': 'A patient name or patient ID is required.',
    }

    def validate_patient(self, value):
        if not str(value).strip():
            self.fail('patient_required')
        return value

    @transaction.atomic
    def create(self, validated_data):
        request = self.context.get('request')
        user = getattr(request, 'user', None)
        doctor_name = validated_data.get('doctor')
        fallback_doctor = getattr(user, 'get_full_name', lambda: '')() or getattr(user, 'username', '') or 'Clinic Doctor'

        patient = resolve_patient(validated_data['patient'])
        doctor = resolve_doctor(doctor_name, fallback_name=fallback_doctor)
        notes = validated_data.get('notes', '')

        medical_record = MedicalRecord.objects.create(
            patient=patient,
            doctor=doctor,
            diagnosis=validated_data['diagnosis'],
            notes=notes,
        )

        return Prescription.objects.create(
            medical_record=medical_record,
            patient=patient,
            doctor=doctor,
            medication=validated_data['medication'],
            dosage=validated_data.get('dosage', ''),
            instructions=notes,
        )


class PrescriptionUpdateSerializer(serializers.Serializer):
    status = serializers.CharField(max_length=30, required=False, allow_blank=True)
    notes = serializers.CharField(required=False, allow_blank=True)

    def update(self, instance, validated_data):
        notes = validated_data.get('notes')
        if notes is not None:
            instance.instructions = notes
            instance.save(update_fields=['instructions'])

        status = validated_data.get('status')
        if status:
            order = getattr(instance, 'pharmacy_order', None)
            if order:
                order.status = status
                order.save(update_fields=['status'])

        return instance


class PrescriptionCreateSerializer(serializers.Serializer):
    medication = serializers.CharField(max_length=120)
    dosage = serializers.CharField(max_length=120)
    instructions = serializers.CharField(allow_blank=True, required=False)


class MedicalRecordSerializer(serializers.ModelSerializer):
    prescriptions = PrescriptionCreateSerializer(many=True, write_only=True, required=False)

    class Meta:
        model = MedicalRecord
        fields = ['id', 'patient', 'doctor', 'diagnosis', 'notes', 'created_at', 'prescriptions']

    def create(self, validated_data):
        prescriptions_data = validated_data.pop('prescriptions', [])
        record = MedicalRecord.objects.create(**validated_data)
        for item in prescriptions_data:
            Prescription.objects.create(
                medical_record=record,
                patient=record.patient,
                doctor=record.doctor,
                medication=item.get('medication'),
                dosage=item.get('dosage'),
                instructions=item.get('instructions', ''),
            )
        return record

