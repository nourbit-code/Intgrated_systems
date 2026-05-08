from clinic.models import Doctor, Patient


def _clean_text(value):
    if value is None:
        return ''
    return str(value).strip()


def resolve_patient(value, *, create_if_missing=True):
    text = _clean_text(value)
    if not text:
        return None

    if text.isdigit():
        patient = Patient.objects.filter(pk=int(text)).first()
        if patient:
            return patient

    patient = Patient.objects.filter(full_name__iexact=text).first()
    if patient:
        return patient

    if not create_if_missing:
        return None

    return Patient.objects.create(full_name=text)


def resolve_doctor(value=None, *, fallback_name='Clinic Doctor'):
    text = _clean_text(value)

    if text:
        if text.isdigit():
            doctor = Doctor.objects.filter(pk=int(text)).first()
            if doctor:
                return doctor

        normalized = text.replace('Dr. ', '').replace('Dr ', '').strip()
        doctor = (
            Doctor.objects.filter(full_name__iexact=text).first()
            or Doctor.objects.filter(full_name__istartswith=text).first()
            or Doctor.objects.filter(full_name__icontains=normalized).first()
        )
        if doctor:
            return doctor

        display_name = text if text.lower().startswith('dr') else f'Dr. {text}'
        return Doctor.objects.create(full_name=display_name)

    doctor = Doctor.objects.order_by('id').first()
    if doctor:
        return doctor

    return Doctor.objects.create(full_name=fallback_name)
