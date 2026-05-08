from datetime import datetime

from django.db import transaction
from django.utils import timezone

from clinic.models import Doctor, MedicalRecord, Patient, Prescription
from clinic.utils import resolve_doctor, resolve_patient
from pharmacy.models import PharmacyOrder


FHIR_IDENTIFIER_SYSTEM = 'https://derma-skincare-clinic.example/fhir/prescription'


def _as_list(value):
    if value is None:
        return []
    if isinstance(value, list):
        return value
    return [value]


def _text(value):
    return str(value or '').strip()


def _first_identifier(resource):
    for identifier in _as_list(resource.get('identifier')):
        value = _text(identifier.get('value'))
        if value:
            return _text(identifier.get('system')) or FHIR_IDENTIFIER_SYSTEM, value
    resource_id = _text(resource.get('id'))
    if resource_id:
        return FHIR_IDENTIFIER_SYSTEM, resource_id
    return None, None


def _resource_by_reference(resources_by_ref, reference):
    reference = _text(reference)
    if not reference:
        return None
    return resources_by_ref.get(reference) or resources_by_ref.get(reference.lstrip('#'))


def _human_name(resource):
    names = _as_list(resource.get('name'))
    if not names:
        return ''
    name = names[0]
    text = _text(name.get('text'))
    if text:
        return text
    pieces = []
    pieces.extend(_as_list(name.get('prefix')))
    pieces.extend(_as_list(name.get('given')))
    family = _text(name.get('family'))
    if family:
        pieces.append(family)
    return ' '.join(_text(piece) for piece in pieces if _text(piece))


def _phone(resource):
    for telecom in _as_list(resource.get('telecom')):
        if _text(telecom.get('system')).lower() == 'phone' and _text(telecom.get('value')):
            return _text(telecom.get('value'))
    return ''


def _date(value):
    text = _text(value)
    if not text:
        return None
    try:
        return datetime.fromisoformat(text[:10]).date()
    except ValueError:
        return None


def _patient_from_reference(subject, resources_by_ref):
    subject_resource = _resource_by_reference(resources_by_ref, subject.get('reference'))
    if subject_resource:
        name = _human_name(subject_resource) or _text(subject.get('display'))
        patient = resolve_patient(name)
        phone = _phone(subject_resource)
        birth_date = _date(subject_resource.get('birthDate'))
        changed = []
        if phone and patient.phone != phone:
            patient.phone = phone
            changed.append('phone')
        if birth_date and patient.date_of_birth != birth_date:
            patient.date_of_birth = birth_date
            changed.append('date_of_birth')
        if changed:
            patient.save(update_fields=changed)
        return patient

    reference = _text(subject.get('reference'))
    if reference.startswith('Patient/'):
        local_id = reference.split('/', 1)[1]
        if local_id.isdigit():
            patient = Patient.objects.filter(pk=int(local_id)).first()
            if patient:
                return patient
    return resolve_patient(_text(subject.get('display')) or 'FHIR Patient')


def _doctor_from_reference(requester, resources_by_ref):
    requester_resource = _resource_by_reference(resources_by_ref, requester.get('reference'))
    if requester_resource:
        name = _human_name(requester_resource) or _text(requester.get('display'))
        specialty = ''
        qualifications = _as_list(requester_resource.get('qualification'))
        if qualifications:
            specialty = _text(qualifications[0].get('code', {}).get('text'))
        doctor = resolve_doctor(name or 'Clinic Doctor')
        if specialty and doctor.specialty != specialty:
            doctor.specialty = specialty
            doctor.save(update_fields=['specialty'])
        return doctor
    return resolve_doctor(_text(requester.get('display')) or None)


def _codeable_text(codeable):
    text = _text(codeable.get('text'))
    if text:
        return text
    for coding in _as_list(codeable.get('coding')):
        display = _text(coding.get('display'))
        if display:
            return display
        code = _text(coding.get('code'))
        if code:
            return code
    return ''


def _medication_name(resource):
    return _codeable_text(resource.get('medicationCodeableConcept') or {}) or 'Medication'


def _dosage_text(resource):
    instructions = _as_list(resource.get('dosageInstruction'))
    if not instructions:
        return ''
    primary = instructions[0]
    dosage = _text(primary.get('text'))
    if dosage:
        return dosage
    timing = primary.get('timing', {}).get('code', {})
    dose = primary.get('doseAndRate', [{}])[0].get('doseQuantity', {})
    dose_text = ' '.join(part for part in [_text(dose.get('value')), _text(dose.get('unit'))] if part)
    return ' '.join(part for part in [dose_text, _codeable_text(timing)] if part)


def _notes(resource):
    notes = [_text(note.get('text')) for note in _as_list(resource.get('note')) if _text(note.get('text'))]
    return '\n'.join(notes)


def _diagnosis(resource):
    reasons = [_codeable_text(reason) for reason in _as_list(resource.get('reasonCode'))]
    reasons = [reason for reason in reasons if reason]
    return '; '.join(reasons) or 'FHIR MedicationRequest from clinic'


def _resources_from_bundle(bundle):
    resources = []
    for entry in _as_list(bundle.get('entry')):
        resource = entry.get('resource') or {}
        if resource:
            resources.append(resource)
    return resources


def _resource_index(resources):
    indexed = {}
    for resource in resources:
        resource_id = _text(resource.get('id'))
        resource_type = _text(resource.get('resourceType'))
        if resource_id:
            indexed[resource_id] = resource
            indexed[f'{resource_type}/{resource_id}'] = resource
    return indexed


def extract_medication_requests(payload):
    if _text(payload.get('resourceType')) == 'Bundle':
        resources = _resources_from_bundle(payload)
        requests = [resource for resource in resources if resource.get('resourceType') == 'MedicationRequest']
        return requests, _resource_index(resources)
    if _text(payload.get('resourceType')) == 'MedicationRequest':
        resources = [payload] + _as_list(payload.get('contained'))
        return [payload], _resource_index(resources)
    raise ValueError('Expected a FHIR R4 MedicationRequest or Bundle.')


@transaction.atomic
def import_medication_request(resource, resources_by_ref=None):
    resources_by_ref = resources_by_ref or {}
    external_system, external_id = _first_identifier(resource)
    prescription = None
    if external_id:
        prescription = Prescription.objects.filter(
            external_system=external_system,
            external_id=external_id,
        ).select_related('patient', 'doctor', 'medical_record').first()

    patient = _patient_from_reference(resource.get('subject') or {}, resources_by_ref)
    doctor = _doctor_from_reference(resource.get('requester') or {}, resources_by_ref)
    medication = _medication_name(resource)
    dosage = _dosage_text(resource)
    notes = _notes(resource) or dosage
    diagnosis = _diagnosis(resource)

    if prescription is None:
        record = MedicalRecord.objects.create(
            patient=patient,
            doctor=doctor,
            diagnosis=diagnosis,
            notes=notes,
        )
        prescription = Prescription.objects.create(
            medical_record=record,
            patient=patient,
            doctor=doctor,
            external_system=external_system,
            external_id=external_id,
            medication=medication,
            dosage=dosage,
            instructions=notes,
        )
        created = True
    else:
        prescription.patient = patient
        prescription.doctor = doctor
        prescription.medication = medication
        prescription.dosage = dosage
        prescription.instructions = notes
        prescription.save(update_fields=['patient', 'doctor', 'medication', 'dosage', 'instructions'])
        record = prescription.medical_record
        record.patient = patient
        record.doctor = doctor
        record.diagnosis = diagnosis
        record.notes = notes
        record.save(update_fields=['patient', 'doctor', 'diagnosis', 'notes'])
        created = False

    order, _ = PharmacyOrder.objects.get_or_create(
        prescription=prescription,
        defaults={'patient': prescription.patient, 'status': 'New'},
    )
    if order.patient_id != prescription.patient_id:
        order.patient = prescription.patient
        order.save(update_fields=['patient'])
    return prescription, order, created


def fhir_reference(resource_type, pk):
    return f'{resource_type}/{pk}'


def patient_to_fhir(patient):
    resource = {
        'resourceType': 'Patient',
        'id': str(patient.pk),
        'name': [{'text': patient.full_name}],
    }
    if patient.phone:
        resource['telecom'] = [{'system': 'phone', 'value': patient.phone}]
    if patient.date_of_birth:
        resource['birthDate'] = patient.date_of_birth.isoformat()
    return resource


def practitioner_to_fhir(doctor):
    if doctor is None:
        return {'resourceType': 'Practitioner', 'id': 'clinic-doctor', 'name': [{'text': 'Clinic Doctor'}]}
    resource = {
        'resourceType': 'Practitioner',
        'id': str(doctor.pk),
        'name': [{'text': doctor.full_name}],
    }
    if doctor.specialty:
        resource['qualification'] = [{'code': {'text': doctor.specialty}}]
    return resource


def prescription_to_medication_request(prescription):
    identifier = {
        'system': prescription.external_system or FHIR_IDENTIFIER_SYSTEM,
        'value': prescription.external_id or f'prescription-{prescription.pk}',
    }
    return {
        'resourceType': 'MedicationRequest',
        'id': str(prescription.pk),
        'identifier': [identifier],
        'status': 'active',
        'intent': 'order',
        'medicationCodeableConcept': {'text': prescription.medication},
        'subject': {
            'reference': fhir_reference('Patient', prescription.patient_id),
            'display': prescription.patient.full_name,
        },
        'requester': {
            'reference': fhir_reference('Practitioner', prescription.doctor_id or 'clinic-doctor'),
            'display': getattr(prescription.doctor, 'full_name', 'Clinic Doctor'),
        },
        'authoredOn': timezone.localtime(prescription.created_at).isoformat(),
        'dosageInstruction': [{'text': prescription.dosage or prescription.instructions}],
        'note': [{'text': prescription.instructions}] if prescription.instructions else [],
    }


def _dispense_status(order):
    status_map = {
        'New': 'preparation',
        'Preparing': 'preparation',
        'Ready': 'in-progress',
        'Dispensed': 'completed',
        'Cancelled': 'cancelled',
    }
    return status_map.get(order.status, 'unknown')


def order_to_medication_dispense(order):
    prescription = order.prescription
    dispense = {
        'resourceType': 'MedicationDispense',
        'id': str(order.pk),
        'identifier': [
            {
                'system': 'https://pharmacy.example/fhir/dispense',
                'value': f'pharmacy-order-{order.pk}',
            }
        ],
        'status': _dispense_status(order),
        'medicationCodeableConcept': {'text': prescription.medication},
        'subject': {
            'reference': fhir_reference('Patient', order.patient_id),
            'display': order.patient.full_name,
        },
        'authorizingPrescription': [{'reference': fhir_reference('MedicationRequest', prescription.pk)}],
        'whenPrepared': timezone.localtime(order.prepared_at).isoformat() if order.prepared_at else None,
        'whenHandedOver': timezone.localtime(order.dispensed_at).isoformat() if order.dispensed_at else None,
        'quantity': {'value': sum(item.quantity for item in order.items.all()), 'unit': 'unit'},
        'dosageInstruction': [{'text': prescription.dosage or prescription.instructions}],
        'note': [{'text': order.prepared_notes}] if order.prepared_notes else [],
    }
    return {key: value for key, value in dispense.items() if value not in [None, [], {}]}


def resources_to_bundle(resources, bundle_type='collection'):
    now = timezone.now().isoformat()
    return {
        'resourceType': 'Bundle',
        'type': bundle_type,
        'timestamp': now,
        'total': len(resources),
        'entry': [{'resource': resource} for resource in resources],
    }
