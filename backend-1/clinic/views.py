from rest_framework import viewsets, status
from rest_framework.decorators import action, api_view
from rest_framework.response import Response
from .models import *
from .serializers import *
from django.shortcuts import get_object_or_404
from django.contrib.auth.models import User
from django.db import models
from django.utils.decorators import method_decorator
from django.utils import timezone
from django.views.decorators.csrf import csrf_exempt
from django.conf import settings
import json
import requests
import uuid
from datetime import date


def _extract_ontology_acronym(ontology_link: str) -> str:
    if not ontology_link:
        return ""
    # BioPortal ontology link ends with /ontologies/{ACRONYM}
    parts = ontology_link.rstrip('/').split('/')
    return parts[-1] if parts else ""


def _patient_file_to_fhir_diagnostic_report(patient_file, patient):
    """
    Map local lab/document patient file to a lightweight FHIR DiagnosticReport shape.
    """
    file_name = patient_file.file_name or f"Lab Report {patient_file.file_id}"
    mime_type = "application/pdf" if file_name.lower().endswith(".pdf") else "image/*"
    status = "final"
    category = "LAB"
    code_text = patient_file.tag or "Lab Test/Scan"
    issued = patient_file.created_at.isoformat() if patient_file.created_at else None

    payload = patient_file.fhir_payload if isinstance(patient_file.fhir_payload, dict) else {}
    observations = payload.get("observations") if isinstance(payload.get("observations"), list) else []

    report = {
        "resourceType": "DiagnosticReport",
        "id": patient_file.external_report_id or str(patient_file.file_id),
        "status": status,
        "category": [{
            "coding": [{
                "system": "http://terminology.hl7.org/CodeSystem/v2-0074",
                "code": category,
                "display": "Laboratory"
            }]
        }],
        "code": {
            "text": code_text
        },
        "subject": {
            "reference": f"Patient/{patient.patient_id}",
            "display": patient.name
        },
        "effectiveDateTime": issued,
        "issued": issued,
        "presentedForm": [{
            "contentType": mime_type,
            "url": patient_file.file_url,
            "title": file_name
        }],
        "conclusion": patient_file.caption or ""
    }
    if observations:
        report["result"] = [{"reference": f"Observation/{obs.get('id')}"} for obs in observations if obs.get("id")]
    return report


def _extract_patient_from_fhir_subject(subject):
    """
    Resolve local patient from FHIR DiagnosticReport.subject.
    Supports:
    - reference: Patient/{id}
    - identifier.value: local patient_id
    """
    if not isinstance(subject, dict):
        return None

    reference = subject.get("reference", "") or ""
    if isinstance(reference, str) and reference.startswith("Patient/"):
        patient_id_str = reference.split("/", 1)[1].strip()
        if patient_id_str.isdigit():
            return Patient.objects.filter(patient_id=int(patient_id_str)).first()

    identifier = subject.get("identifier") or {}
    if isinstance(identifier, dict):
        value = str(identifier.get("value", "")).strip()
        if value.isdigit():
            return Patient.objects.filter(patient_id=int(value)).first()

    return None


def _ingest_diagnostic_report_resource(resource, observations_by_id=None):
    """
    Persist one FHIR DiagnosticReport as PatientFile (lab/document).
    """
    if not isinstance(resource, dict):
        return None, "Invalid resource payload", False
    if resource.get("resourceType") != "DiagnosticReport":
        return None, "Only DiagnosticReport resources are supported", False

    patient = _extract_patient_from_fhir_subject(resource.get("subject"))
    if not patient:
        return None, "Unable to resolve patient from DiagnosticReport.subject", False

    presented_forms = resource.get("presentedForm") or []
    form = presented_forms[0] if isinstance(presented_forms, list) and presented_forms else {}
    content_type = (form.get("contentType") or "").lower()
    file_url = form.get("url") or ""
    file_name = form.get("title") or f"DiagnosticReport-{resource.get('id', 'external')}"

    if not file_url:
        return None, "DiagnosticReport.presentedForm[0].url is required", False

    file_type = "document" if "pdf" in content_type else "lab"
    code_text = ((resource.get("code") or {}).get("text") or "Lab Result").strip()
    conclusion = resource.get("conclusion") or ""

    report_id = str(resource.get("id", "")).strip()
    if report_id:
        existing = PatientFile.objects.filter(
            patient=patient,
            external_report_id=report_id
        ).first()
        if existing:
            return existing, None, True

    observations_by_id = observations_by_id or {}
    linked_observations = []
    for result_ref in (resource.get("result") or []):
        ref = (result_ref or {}).get("reference", "")
        if isinstance(ref, str) and ref.startswith("Observation/"):
            obs_id = ref.split("/", 1)[1]
            if obs_id in observations_by_id:
                linked_observations.append(observations_by_id[obs_id])

    created_file = PatientFile.objects.create(
        patient=patient,
        file_type=file_type,
        file_url=file_url,
        file_name=file_name,
        tag=code_text[:100],
        caption=conclusion,
        source_system="fhir_lab_system",
        external_report_id=report_id,
        fhir_payload={
            "diagnosticReport": resource,
            "observations": linked_observations
        }
    )

    return created_file, None, False


def _build_fhir_medication_request_bundle(prescription):
    medical_record = prescription.medical_record
    patient = medical_record.patient if medical_record else None
    doctor = medical_record.doctor if medical_record else None
    authored_on = prescription.date.isoformat() if prescription.date else date.today().isoformat()

    med_links = PrescriptionMedication.objects.filter(prescription=prescription).select_related('medication')
    entries = []
    for link in med_links:
        med = link.medication
        med_request_id = f"mr-{prescription.prescription_id}-{med.med_id}"
        dosage_text = link.dosage or ""
        duration_text = f"{link.duration_days} days" if link.duration_days else ""
        if duration_text and dosage_text:
            dosage_text = f"{dosage_text} for {duration_text}"
        elif duration_text:
            dosage_text = duration_text

        entries.append({
            "resource": {
                "resourceType": "MedicationRequest",
                "id": med_request_id,
                "status": "active",
                "intent": "order",
                "subject": {
                    "reference": f"Patient/{patient.patient_id}" if patient else "",
                    "display": patient.name if patient else ""
                },
                "requester": {
                    "reference": f"Practitioner/{doctor.doctor_id}" if doctor else "",
                    "display": doctor.name if doctor else ""
                },
                "medicationCodeableConcept": {
                    "text": med.name
                },
                "authoredOn": authored_on,
                "dosageInstruction": [{
                    "text": dosage_text or "As directed by physician"
                }],
                "note": [{
                    "text": link.notes or ""
                }] if link.notes else []
            }
        })

    bundle = {
        "resourceType": "Bundle",
        "type": "collection",
        "identifier": {
            "system": "urn:clinic:prescription",
            "value": f"prescription-{prescription.prescription_id}"
        },
        "entry": entries
    }
    return bundle


def _dispatch_prescription_to_pharmacy(prescription, idempotency_key=None):
    idempotency_key = idempotency_key or f"rx-{prescription.prescription_id}"
    existing = PharmacyDispatch.objects.filter(idempotency_key=idempotency_key).first()
    if existing:
        # If there is a previous failed attempt under the same idempotency key,
        # retry it immediately so "Send to Pharmacy" remains reliable.
        if existing.status == 'failed':
            existing = _attempt_dispatch(existing)
        return existing, True

    payload = _build_fhir_medication_request_bundle(prescription)
    dispatch = PharmacyDispatch.objects.create(
        prescription=prescription,
        status='queued',
        idempotency_key=idempotency_key,
        fhir_payload=payload
    )

    dispatch = _attempt_dispatch(dispatch)
    return dispatch, False


def _attempt_dispatch(dispatch):
    endpoint = (getattr(settings, "PHARMACY_FHIR_ENDPOINT", "") or "").strip()
    token = (getattr(settings, "PHARMACY_FHIR_TOKEN", "") or "").strip()
    headers = {"Content-Type": "application/fhir+json"}
    if token:
        headers["Authorization"] = f"Bearer {token}"

    if not endpoint:
        dispatch.status = 'sent'
        dispatch.external_request_id = dispatch.external_request_id or str(uuid.uuid4())
        dispatch.response_payload = {"message": "Dispatched in local/mock mode (no PHARMACY_FHIR_ENDPOINT configured)."}
        dispatch.sent_at = timezone.now()
        dispatch.save(update_fields=['status', 'external_request_id', 'response_payload', 'sent_at', 'updated_at'])
        return dispatch

    try:
        response = requests.post(endpoint, json=dispatch.fhir_payload, headers=headers, timeout=20)
        response_payload = {}
        try:
            response_payload = response.json()
        except ValueError:
            response_payload = {"raw": response.text}

        if 200 <= response.status_code < 300:
            dispatch.status = 'sent'
            dispatch.external_request_id = response.headers.get("X-Request-ID", "") or dispatch.external_request_id or str(uuid.uuid4())
            dispatch.response_payload = response_payload
            dispatch.sent_at = timezone.now()
            dispatch.last_error = ""
            dispatch.save(update_fields=['status', 'external_request_id', 'response_payload', 'sent_at', 'last_error', 'updated_at'])
        else:
            dispatch.status = 'failed'
            dispatch.retry_count = (dispatch.retry_count or 0) + 1
            dispatch.last_error = f"HTTP {response.status_code}"
            dispatch.response_payload = response_payload
            dispatch.save(update_fields=['status', 'retry_count', 'last_error', 'response_payload', 'updated_at'])
    except requests.RequestException as exc:
        dispatch.status = 'failed'
        dispatch.retry_count = (dispatch.retry_count or 0) + 1
        dispatch.last_error = str(exc)
        dispatch.save(update_fields=['status', 'retry_count', 'last_error', 'updated_at'])

    return dispatch


def _calculate_patient_dob_from_age(age_value):
    try:
        age = int(age_value)
    except (TypeError, ValueError):
        return None
    if age < 0:
        return None
    today = date.today()
    return date(max(1900, today.year - age), 1, 1).isoformat()


def _build_lab_patient_sync_payload(patient):
    patient_allergies = PatientAllergy.objects.filter(patient=patient).select_related("allergy")
    allergies = [pa.allergy.name for pa in patient_allergies]
    medical_history = [h.strip() for h in (patient.medical_history or "").split(",") if h.strip()]
    surgeries = [s.strip() for s in (patient.surgeries or "").split(",") if s.strip()]
    return {
        "global_patient_id": str(patient.global_patient_id),
        "clinic_patient_id": str(patient.patient_id),
        "name": patient.name or "",
        "gender": (patient.gender or "").lower() or "other",
        "phone": patient.phone or "",
        "email": patient.email or "",
        "dob": _calculate_patient_dob_from_age(patient.age),
        "allergies": allergies,
        "medical_history": medical_history,
        "surgeries": surgeries,
        "notes": patient.notes or "",
        "has_insurance": bool(patient.has_insurance and patient.is_insurance_active(date.today())),
        "insurance_provider": patient.insurance_company.name if patient.insurance_company else "",
        "insurance_policy_number": "",
        "insurance_member_id": patient.insurance_member_id or "",
        "insurance_expiry": patient.insurance_valid_to.isoformat() if patient.insurance_valid_to else "",
    }


def _push_patient_profile_to_lab(patient):
    endpoint = (getattr(settings, "LAB_PATIENT_SYNC_ENDPOINT", "") or "").strip()
    if not endpoint:
        return
    token = (getattr(settings, "LAB_PATIENT_SYNC_TOKEN", "") or "").strip()
    headers = {"Content-Type": "application/json", "X-Source-System": "CLINIC_SYSTEM"}
    if token:
        headers["Authorization"] = f"Bearer {token}"
    payload = _build_lab_patient_sync_payload(patient)
    requests.post(endpoint, json=payload, headers=headers, timeout=20)


def _build_lab_insurance_sync_payload():
    providers = []
    for company in InsuranceCompany.objects.all().order_by("name"):
        providers.append({
            "name": company.name,
            "discount_percent": float(company.discount_percent),
            "is_active": True,
        })
    return {"providers": providers}


def _push_insurance_providers_to_lab():
    endpoint = (getattr(settings, "LAB_INSURANCE_SYNC_ENDPOINT", "") or "").strip()
    if not endpoint:
        return {"success": False, "error": "LAB_INSURANCE_SYNC_ENDPOINT is not configured"}
    token = (getattr(settings, "LAB_INSURANCE_SYNC_TOKEN", "") or "").strip()
    headers = {"Content-Type": "application/json", "X-Source-System": "CLINIC_SYSTEM"}
    if token:
        headers["Authorization"] = f"Bearer {token}"
    payload = _build_lab_insurance_sync_payload()
    response = requests.post(endpoint, json=payload, headers=headers, timeout=20)
    body = {}
    try:
        body = response.json()
    except Exception:
        body = {"raw": response.text}
    return {
        "success": 200 <= response.status_code < 300,
        "status_code": response.status_code,
        "payload": payload,
        "response": body,
    }


def _build_fhir_service_request_bundle(patient, doctor, orders):
    entries = []
    for idx, order in enumerate(orders):
        name = str(order.get("name") or "").strip()
        if not name:
            continue
        category = str(order.get("category") or "LAB_TEST").strip().upper()
        code = str(order.get("code") or name.upper().replace(" ", "_")).strip()
        note = str(order.get("notes") or "").strip()
        sr_id = f"sr-{patient.patient_id}-{idx+1}-{uuid.uuid4().hex[:8]}"
        entries.append({
            "resource": {
                "resourceType": "ServiceRequest",
                "id": sr_id,
                "status": "active",
                "intent": "order",
                "category": [{"text": category}],
                "code": {"text": name, "coding": [{"code": code, "display": name}]},
                "subject": {
                    "reference": f"Patient/{patient.patient_id}",
                    "display": patient.name,
                    "identifier": {"value": str(patient.patient_id)}
                },
                "requester": {
                    "reference": f"Practitioner/{doctor.doctor_id}" if doctor else "",
                    "display": doctor.name if doctor else ""
                },
                "authoredOn": date.today().isoformat(),
                "note": [{"text": note}] if note else []
            }
        })
    return {"resourceType": "Bundle", "type": "collection", "entry": entries}


def _dispatch_orders_to_lab(patient, doctor, orders):
    endpoint = (getattr(settings, "LAB_ORDER_INGEST_ENDPOINT", "") or "").strip()
    if not endpoint:
        return {"success": False, "error": "LAB_ORDER_INGEST_ENDPOINT not configured"}
    bundle = _build_fhir_service_request_bundle(patient, doctor, orders)
    if not bundle.get("entry"):
        return {"success": False, "error": "No valid orders to dispatch"}
    # DRF endpoint on lab side accepts JSON parser by default.
    headers = {"Content-Type": "application/json", "X-Source-System": "CLINIC_SYSTEM"}
    token = (getattr(settings, "LAB_ORDER_INGEST_TOKEN", "") or "").strip()
    if token:
        headers["Authorization"] = f"Bearer {token}"
    response = requests.post(endpoint, json=bundle, headers=headers, timeout=20)
    try:
        payload = response.json()
    except ValueError:
        payload = {"raw": response.text}
    if not (200 <= response.status_code < 300):
        return {"success": False, "error": f"Lab ingest failed ({response.status_code})", "payload": payload}
    return {"success": True, "payload": payload}


@api_view(['GET'])
def ontology_search(request):
    q = (request.query_params.get('q') or "").strip()
    concept_type = (request.query_params.get('type') or "disease").strip()
    ontologies_param = (request.query_params.get('ontologies') or "").strip()
    limit_param = request.query_params.get('limit') or "20"

    if not q:
        return Response([])

    try:
        limit = max(1, min(int(limit_param), 100))
    except ValueError:
        limit = 20

    if ontologies_param:
        ontologies = [o.strip() for o in ontologies_param.split(',') if o.strip()]
    else:
        ontologies = ["SNOMEDCT", "ICD10CM", "DOID"]

    local_qs = MedicalConcept.objects.filter(name__icontains=q)
    if concept_type:
        local_qs = local_qs.filter(concept_type=concept_type)
    if ontologies:
        local_qs = local_qs.filter(ontology__in=ontologies)

    local_results = list(local_qs.order_by('name')[:limit])

    # If local cache is sufficient, return immediately
    if len(local_results) >= limit:
        return Response([
            {
                "id": c.concept_id,
                "name": c.name,
                "type": c.concept_type,
                "ontology": c.ontology,
                "code": c.code,
            } for c in local_results
        ])

    # Otherwise, fetch from BioPortal and cache
    api_key = getattr(settings, "BIOPORTAL_API_KEY", "").strip()
    if not api_key:
        return Response([
            {
                "id": c.concept_id,
                "name": c.name,
                "type": c.concept_type,
                "ontology": c.ontology,
                "code": c.code,
            } for c in local_results
        ])

    try:
        resp = requests.get(
            "https://data.bioontology.org/search",
            params={
                "q": q,
                "ontologies": ",".join(ontologies),
                "pagesize": limit,
                "page": 1,
                "apikey": api_key,
            },
            timeout=10,
        )
        resp.raise_for_status()
        data = resp.json()
        collection = data.get("collection", []) if isinstance(data, dict) else []

        cached = []
        for item in collection:
            concept_id = item.get("@id") or item.get("id") or ""
            name = item.get("prefLabel") or item.get("label") or ""
            code = ""
            if isinstance(item.get("notation"), list) and item.get("notation"):
                code = str(item.get("notation")[0])
            elif item.get("notation"):
                code = str(item.get("notation"))

            ontology_link = ""
            links = item.get("links") or {}
            if isinstance(links, dict):
                ontology_link = links.get("ontology", "")
            ontology = _extract_ontology_acronym(ontology_link) or item.get("ontology", "")

            if not concept_id or not name or not ontology:
                continue

            concept, created = MedicalConcept.objects.get_or_create(
                concept_id=concept_id,
                defaults={
                    "name": name,
                    "concept_type": concept_type,
                    "ontology": ontology,
                    "code": code,
                }
            )
            if not created:
                # Keep cache fresh
                updated = False
                if concept.name != name:
                    concept.name = name
                    updated = True
                if concept.code != code:
                    concept.code = code
                    updated = True
                if concept.concept_type != concept_type:
                    concept.concept_type = concept_type
                    updated = True
                if concept.ontology != ontology:
                    concept.ontology = ontology
                    updated = True
                if updated:
                    concept.save()

            cached.append(concept)

        combined = local_results + [c for c in cached if c.concept_id not in {x.concept_id for x in local_results}]
        combined = combined[:limit]

        return Response([
            {
                "id": c.concept_id,
                "name": c.name,
                "type": c.concept_type,
                "ontology": c.ontology,
                "code": c.code,
            } for c in combined
        ])

    except requests.RequestException:
        return Response([
            {
                "id": c.concept_id,
                "name": c.name,
                "type": c.concept_type,
                "ontology": c.ontology,
                "code": c.code,
            } for c in local_results
        ])


@api_view(['POST'])
def login(request):
    """
    Login endpoint for doctors and receptionists
    Expects JSON: { "email": "...", "password": "..." }
    Returns: { "role": "doctor/receptionist", "user": {...} }
    """
    email = request.data.get('email')
    password = request.data.get('password')
    
    if not email or not password:
        return Response(
            {'error': 'Email and password are required'}, 
            status=status.HTTP_400_BAD_REQUEST
        )
    
    # Check if user is a doctor
    try:
        doctor = Doctor.objects.get(email=email)
        if doctor.password == password:
            return Response({
                'role': 'doctor',
                'user': {
                    'id': doctor.doctor_id,
                    'name': doctor.name,
                    'email': doctor.email,
                    'specialty': doctor.specialty
                }
            })
    except Doctor.DoesNotExist:
        pass
    
    # Check if user is a receptionist
    try:
        receptionist = Receptionist.objects.get(email=email)
        if receptionist.password == password:
            return Response({
                'role': 'receptionist',
                'user': {
                    'id': receptionist.receptionist_id,
                    'name': receptionist.name,
                    'email': receptionist.email,
                    'is_admin': receptionist.is_admin,
                }
            })
    except Receptionist.DoesNotExist:
        pass
    
    return Response(
        {'error': 'Invalid email or password'}, 
        status=status.HTTP_401_UNAUTHORIZED
    )


@api_view(['POST'])
@csrf_exempt
def ingest_fhir_lab_results(request):
    """
    Ingest endpoint for external lab system using FHIR payloads.
    Accepts:
    - DiagnosticReport resource
    - Bundle with entry[].resource DiagnosticReport
    """
    configured_token = (getattr(settings, "LAB_INGEST_TOKEN", "") or "").strip()
    if configured_token:
        auth_header = request.headers.get("Authorization", "")
        expected = f"Bearer {configured_token}"
        if auth_header != expected:
            return Response({"error": "Unauthorized"}, status=status.HTTP_401_UNAUTHORIZED)

    payload = request.data
    if not isinstance(payload, dict):
        return Response({"error": "Invalid JSON payload"}, status=status.HTTP_400_BAD_REQUEST)

    resources = []
    observations_by_id = {}
    resource_type = payload.get("resourceType")
    if resource_type == "DiagnosticReport":
        resources = [payload]
    elif resource_type == "Bundle":
        entries = payload.get("entry") or []
        for entry in entries:
            resource = (entry or {}).get("resource")
            if not isinstance(resource, dict):
                continue
            if resource.get("resourceType") == "DiagnosticReport":
                resources.append(resource)
            if resource.get("resourceType") == "Observation":
                obs_id = str(resource.get("id", "")).strip()
                if obs_id:
                    observations_by_id[obs_id] = resource
    else:
        return Response(
            {"error": "Unsupported FHIR resourceType. Use DiagnosticReport or Bundle."},
            status=status.HTTP_400_BAD_REQUEST
        )

    if not resources:
        return Response({"error": "No DiagnosticReport resources found"}, status=status.HTTP_400_BAD_REQUEST)

    created_ids = []
    duplicate_ids = []
    errors = []
    for idx, resource in enumerate(resources):
        created_file, err, is_duplicate = _ingest_diagnostic_report_resource(resource, observations_by_id=observations_by_id)
        if err:
            errors.append({"index": idx, "error": err, "id": resource.get("id")})
            continue
        if is_duplicate:
            duplicate_ids.append(created_file.file_id)
        else:
            created_ids.append(created_file.file_id)

    has_success = len(created_ids) > 0 or len(duplicate_ids) > 0
    status_code = status.HTTP_201_CREATED if len(created_ids) > 0 else (status.HTTP_200_OK if len(duplicate_ids) > 0 else status.HTTP_400_BAD_REQUEST)
    return Response({
        "success": has_success,
        "created_count": len(created_ids),
        "created_file_ids": created_ids,
        "duplicate_file_ids": duplicate_ids,
        "observations_received": len(observations_by_id),
        "errors": errors
    }, status=status_code)


@api_view(['PATCH'])
@csrf_exempt
def mark_lab_result_reviewed(request, file_id):
    patient_file = get_object_or_404(PatientFile, pk=file_id, file_type__in=['lab', 'document'])
    doctor_id = request.data.get('doctor_id')
    doctor = Doctor.objects.filter(pk=doctor_id).first() if doctor_id else None

    patient_file.reviewed = True
    patient_file.reviewed_by = doctor
    patient_file.reviewed_at = timezone.now()
    patient_file.save(update_fields=['reviewed', 'reviewed_by', 'reviewed_at'])

    return Response({
        "success": True,
        "file_id": patient_file.file_id,
        "reviewed": True,
        "reviewed_at": patient_file.reviewed_at.isoformat(),
        "reviewed_by": doctor.name if doctor else ""
    })


@api_view(['POST'])
@csrf_exempt
def dispatch_prescription_to_pharmacy(request):
    prescription_id = request.data.get("prescription_id")
    if not prescription_id:
        return Response({"error": "prescription_id is required"}, status=status.HTTP_400_BAD_REQUEST)

    prescription = get_object_or_404(Prescription, pk=prescription_id)
    idempotency_key = request.data.get("idempotency_key") or f"rx-{prescription.prescription_id}"
    dispatch, duplicate = _dispatch_prescription_to_pharmacy(prescription, idempotency_key=idempotency_key)

    return Response({
        "success": True,
        "duplicate": duplicate,
        "dispatch": PharmacyDispatchSerializer(dispatch).data
    }, status=status.HTTP_200_OK if duplicate else status.HTTP_201_CREATED)


@api_view(['POST'])
@csrf_exempt
def dispatch_lab_orders(request):
    patient_id = request.data.get("patient_id")
    doctor_id = request.data.get("doctor_id")
    orders = request.data.get("orders") or []
    if not patient_id:
        return Response({"error": "patient_id is required"}, status=status.HTTP_400_BAD_REQUEST)
    if not isinstance(orders, list) or not orders:
        return Response({"error": "orders list is required"}, status=status.HTTP_400_BAD_REQUEST)

    patient = get_object_or_404(Patient, pk=patient_id)
    doctor = Doctor.objects.filter(pk=doctor_id).first() if doctor_id else None

    result = _dispatch_orders_to_lab(patient, doctor, orders)
    if not result.get("success"):
        return Response(result, status=status.HTTP_502_BAD_GATEWAY)
    return Response({"success": True, "result": result.get("payload", {})}, status=status.HTTP_201_CREATED)


@api_view(['POST'])
@csrf_exempt
def dispatch_insurance_providers_to_lab(request):
    result = _push_insurance_providers_to_lab()
    if not result.get("success"):
        return Response(result, status=status.HTTP_502_BAD_GATEWAY)
    return Response(result, status=status.HTTP_200_OK)


@api_view(['GET'])
@csrf_exempt
def get_lab_catalog(request):
    endpoint = (getattr(settings, "LAB_CATALOG_ENDPOINT", "") or "").strip()
    if not endpoint:
        return Response({"success": False, "error": "LAB_CATALOG_ENDPOINT is not configured"}, status=status.HTTP_400_BAD_REQUEST)
    token = (getattr(settings, "LAB_CATALOG_TOKEN", "") or "").strip()
    headers = {"X-Source-System": "CLINIC_SYSTEM"}
    if token:
        headers["Authorization"] = f"Bearer {token}"
    try:
        response = requests.get(endpoint, headers=headers, timeout=20)
        data = response.json() if response.content else {}
        if response.status_code >= 400:
            return Response({"success": False, "error": data}, status=status.HTTP_502_BAD_GATEWAY)
        return Response(data, status=status.HTTP_200_OK)
    except requests.RequestException as exc:
        return Response({"success": False, "error": str(exc)}, status=status.HTTP_502_BAD_GATEWAY)

class PatientViewSet(viewsets.ModelViewSet):
    queryset = Patient.objects.all().order_by('-created_at')
    serializer_class = PatientSerializer

    def _sync_patient_to_lab_safe(self, patient):
        try:
            _push_patient_profile_to_lab(patient)
        except Exception as exc:
            print(f"[PatientSync] patient_id={patient.patient_id} sync failed: {exc}")

    def create(self, request, *args, **kwargs):
        response = super().create(request, *args, **kwargs)
        patient_id = response.data.get("patient_id")
        if patient_id:
            patient = Patient.objects.filter(patient_id=patient_id).first()
            if patient:
                self._sync_patient_to_lab_safe(patient)
        return response

    def update(self, request, *args, **kwargs):
        response = super().update(request, *args, **kwargs)
        patient_id = kwargs.get("pk")
        if patient_id:
            patient = Patient.objects.filter(patient_id=patient_id).first()
            if patient:
                self._sync_patient_to_lab_safe(patient)
        return response

    @action(detail=False, methods=['post'])
    def sync_all_to_lab(self, request):
        """
        Bulk sync all clinic patients to lab system in one call.
        Optional JSON body:
        {
            "limit": 100,          # optional positive int
            "patient_ids": [1,2]   # optional list of clinic patient_id values
        }
        """
        endpoint = (getattr(settings, "LAB_PATIENT_SYNC_ENDPOINT", "") or "").strip()
        if not endpoint:
            return Response(
                {
                    "success": False,
                    "error": "LAB_PATIENT_SYNC_ENDPOINT is not configured"
                },
                status=status.HTTP_400_BAD_REQUEST
            )

        qs = Patient.objects.all().order_by("patient_id")

        requested_ids = request.data.get("patient_ids") if isinstance(request.data, dict) else None
        if isinstance(requested_ids, list) and requested_ids:
            normalized_ids = []
            for raw_id in requested_ids:
                try:
                    normalized_ids.append(int(raw_id))
                except (TypeError, ValueError):
                    continue
            if normalized_ids:
                qs = qs.filter(patient_id__in=normalized_ids)

        limit_raw = request.data.get("limit") if isinstance(request.data, dict) else None
        if limit_raw is not None:
            try:
                limit = int(limit_raw)
                if limit > 0:
                    qs = qs[:limit]
            except (TypeError, ValueError):
                pass

        total = qs.count() if hasattr(qs, "count") else len(qs)
        success_count = 0
        failed = []

        for patient in qs:
            try:
                _push_patient_profile_to_lab(patient)
                success_count += 1
            except Exception as exc:
                failed.append({
                    "patient_id": patient.patient_id,
                    "name": patient.name,
                    "error": str(exc),
                })

        return Response(
            {
                "success": len(failed) == 0,
                "endpoint": endpoint,
                "total": total,
                "synced": success_count,
                "failed_count": len(failed),
                "failed": failed[:50],
            },
            status=status.HTTP_200_OK
        )

    @action(detail=True, methods=['get'])
    def history(self, request, pk=None):
        patient = self.get_object()
        records = patient.medical_records.all()
        ser = MedicalRecordSerializer(records, many=True)
        return Response(ser.data)

    @action(detail=True, methods=['get'])
    def details(self, request, pk=None):
        """
        Get comprehensive patient details for diagnosis page
        Returns patient info, allergies, last visit, and any active appointments
        """
        patient = self.get_object()
        
        # Get patient allergies
        patient_allergies = PatientAllergy.objects.filter(patient=patient).select_related('allergy')
        allergies = [pa.allergy.name for pa in patient_allergies]
        
        # Get last visit (last completed appointment)
        last_appointment = Appointment.objects.filter(
            patient=patient,
            status='completed'
        ).order_by('-date', '-time').first()
        
        last_visit = None
        if last_appointment:
            last_visit = last_appointment.date.strftime('%Y-%m-%d')
        
        # Get last medical record
        last_record = MedicalRecord.objects.filter(patient=patient).order_by('-date').first()
        last_diagnosis = None
        if last_record:
            last_diagnosis = {
                'diagnosis': last_record.diagnosis,
                'notes': last_record.notes,
                'date': last_record.date.strftime('%Y-%m-%d')
            }
        
        # Parse medical history and surgeries from comma-separated strings
        medical_history = [h.strip() for h in patient.medical_history.split(',') if h.strip()] if patient.medical_history else []
        surgeries = [s.strip() for s in patient.surgeries.split(',') if s.strip()] if patient.surgeries else []
        
        insurance_company = patient.insurance_company
        insurance_is_active = patient.is_insurance_active(date.today())
        return Response({
            'id': patient.patient_id,
            'name': patient.name,
            'age': patient.age,
            'gender': patient.gender,
            'phone': patient.phone,
            'email': patient.email or '',
            'allergies': allergies,
            'notes': patient.notes or '',
            'medical_history': medical_history,
            'surgeries': surgeries,
            'last_visit': last_visit,
            'last_diagnosis': last_diagnosis,
            'has_insurance': patient.has_insurance,
            'insurance_company': insurance_company.id if insurance_company else None,
            'insurance_company_name': insurance_company.name if insurance_company else '',
            'insurance_discount_percent': float(insurance_company.discount_percent) if insurance_company else 0,
            'insurance_member_id': patient.insurance_member_id or '',
            'insurance_valid_from': patient.insurance_valid_from.isoformat() if patient.insurance_valid_from else None,
            'insurance_valid_to': patient.insurance_valid_to.isoformat() if patient.insurance_valid_to else None,
            'insurance_is_active': insurance_is_active,
            'created_at': patient.created_at.strftime('%Y-%m-%d')
        })

    @action(detail=True, methods=['get'])
    def lab_results(self, request, pk=None):
        """
        FHIR-oriented lab result feed for diagnosis page.
        Returns a FHIR Bundle (DiagnosticReport entries) plus a simplified UI list.
        By default this exposes only externally ingested lab reports (lab system feed)
        so the diagnosis page can reflect interoperability-ready results.
        Optional query params:
        - include_local=1 : include local/manual lab uploads
        - status=ready|reviewed|all : filter result lifecycle status (default: all)
        """
        patient = self.get_object()
        include_local = str(request.query_params.get("include_local", "")).lower() in {"1", "true", "yes"}
        status_filter = str(request.query_params.get("status", "all")).lower().strip()

        file_qs = PatientFile.objects.filter(patient=patient, file_type__in=['lab', 'document'])

        if not include_local:
            file_qs = file_qs.filter(source_system__in=['lab_system', 'fhir_lab_system'])

        if status_filter == "ready":
            file_qs = file_qs.filter(reviewed=False)
        elif status_filter == "reviewed":
            file_qs = file_qs.filter(reviewed=True)

        file_qs = file_qs.order_by('-created_at')

        entries = []
        ui_results = []
        for f in file_qs:
            diagnostic_report = _patient_file_to_fhir_diagnostic_report(f, patient)
            entries.append({
                "resource": diagnostic_report
            })
            ui_results.append({
                "id": f.file_id,
                "name": f.file_name or f"Lab Report {f.file_id}",
                "uri": f.file_url,
                "mimeType": diagnostic_report["presentedForm"][0]["contentType"],
                "timestamp": f.created_at.strftime('%Y-%m-%d %H:%M') if f.created_at else "",
                "status": "reviewed" if f.reviewed else "ready",
                "source": f.source_system or "lab_system",
                "fhir_resource_type": "DiagnosticReport",
                "fhir_id": f.external_report_id or str(f.file_id),
                "reviewed": f.reviewed,
                "reviewed_at": f.reviewed_at.isoformat() if f.reviewed_at else None,
                "observation_count": len((f.fhir_payload or {}).get("observations", [])) if isinstance(f.fhir_payload, dict) else 0,
            })

        return Response({
            "resourceType": "Bundle",
            "type": "searchset",
            "total": len(entries),
            "entry": entries,
            "results": ui_results,
            "feed": {
                "include_local": include_local,
                "status": status_filter if status_filter in {"ready", "reviewed", "all"} else "all",
                "ready_count": len([r for r in ui_results if r.get("status") == "ready"]),
                "reviewed_count": len([r for r in ui_results if r.get("status") == "reviewed"]),
            }
        })

    @method_decorator(csrf_exempt)
    @action(detail=True, methods=['post'])
    def save_diagnosis(self, request, pk=None):
        """
        Save a diagnosis/medical record for a patient
        Creates a MedicalRecord and associated Prescription with medications
        Also saves photos and lab files if provided
        
        Expected JSON:
        {
            "doctor_id": 1,
            "appointment_id": null (optional),
            "diagnosis": "Acne Vulgaris",
            "notes": "General treatment instructions",
            "medications": [
                {"name": "Panadol", "dose": "500mg", "duration": "5 days", "notes": "After meals"}
            ],
            "photos": [
                {"uri": "base64...", "tag": "Before", "caption": "Initial condition"}
            ],
            "labs": [
                {"uri": "base64...", "name": "blood_test.pdf", "mimeType": "application/pdf"}
            ]
        }
        """
        patient = self.get_object()
        
        doctor_id = request.data.get('doctor_id')
        appointment_id = request.data.get('appointment_id')
        diagnosis_text = request.data.get('diagnosis', '')
        notes = request.data.get('notes', '')
        primary_disease_id = request.data.get('primary_disease_id', '')
        primary_disease_label = request.data.get('primary_disease_label', '')
        primary_disease_ontology = request.data.get('primary_disease_ontology', '')
        symptom_ids = request.data.get('symptom_ids', [])
        symptom_labels = request.data.get('symptom_labels', [])
        location_ids = request.data.get('location_ids', [])
        location_labels = request.data.get('location_labels', [])
        severity = request.data.get('severity', '')
        medications_data = request.data.get('medications', [])
        ordered_tests_data = request.data.get('ordered_tests', [])
        photos_data = request.data.get('photos', [])
        labs_data = request.data.get('labs', [])
        
        doctor = None
        if doctor_id:
            doctor = get_object_or_404(Doctor, pk=doctor_id)
        
        appointment = None
        if appointment_id:
            appointment = get_object_or_404(Appointment, pk=appointment_id)
        
        # Create Medical Record
        medical_record = MedicalRecord.objects.create(
            patient=patient,
            doctor=doctor,
            appointment=appointment,
            diagnosis=diagnosis_text,
            notes=notes,
            primary_disease_id=primary_disease_id or '',
            primary_disease_label=primary_disease_label or '',
            primary_disease_ontology=primary_disease_ontology or '',
            symptom_ids=json.dumps(symptom_ids) if isinstance(symptom_ids, list) else str(symptom_ids or ''),
            symptom_labels=json.dumps(symptom_labels) if isinstance(symptom_labels, list) else str(symptom_labels or ''),
            location_ids=json.dumps(location_ids) if isinstance(location_ids, list) else str(location_ids or ''),
            location_labels=json.dumps(location_labels) if isinstance(location_labels, list) else str(location_labels or ''),
            severity=severity or ''
        )
        
        # Create Prescription if there are medications or ordered tests/scans
        prescription = None
        if medications_data or ordered_tests_data:
            prescription = Prescription.objects.create(
                medical_record=medical_record,
                notes=notes,
                ordered_tests_json=json.dumps(ordered_tests_data) if isinstance(ordered_tests_data, list) else '[]'
            )
            
            # Add medications
            for med_data in medications_data:
                # Check if medication exists, or create a simple one
                med_name = med_data.get('name', 'Unknown')
                medication = (
                    Medication.objects.filter(name__iexact=med_name)
                    .order_by('med_id')
                    .first()
                )
                if medication is None:
                    medication = Medication.objects.create(
                        name=med_name,
                        generic_name=med_name,
                        strength=med_data.get('dose', ''),
                        form='tablet',
                    )
                elif not medication.strength and med_data.get('dose'):
                    medication.strength = med_data.get('dose', '')
                    medication.save(update_fields=['strength'])
                
                # Create prescription medication link
                PrescriptionMedication.objects.create(
                    prescription=prescription,
                    medication=medication,
                    dosage=med_data.get('dose', ''),
                    duration_days=self._parse_duration(med_data.get('duration', '')),
                    notes=med_data.get('notes', '')
                )
        
        pharmacy_dispatch_data = None
        pharmacy_dispatch_error = ""
        dispatch_to_pharmacy = bool(request.data.get('dispatch_to_pharmacy', False))
        if dispatch_to_pharmacy and prescription and medications_data:
            # Dispatch only when explicitly requested by caller.
            try:
                dispatch, _ = _dispatch_prescription_to_pharmacy(
                    prescription,
                    idempotency_key=f"rx-{prescription.prescription_id}",
                )
                pharmacy_dispatch_data = PharmacyDispatchSerializer(dispatch).data
            except Exception as exc:
                pharmacy_dispatch_error = str(exc)

        # Save photos
        for photo in photos_data:
            PatientFile.objects.create(
                patient=patient,
                medical_record=medical_record,
                file_type='photo',
                file_url=photo.get('uri', ''),
                file_name=photo.get('name', ''),
                tag=photo.get('tag', ''),
                caption=photo.get('caption', ''),
                uploaded_by=doctor
            )
        
        # Save lab files
        for lab in labs_data:
            file_type = 'lab'
            mime_type = lab.get('mimeType', '')
            if 'pdf' in mime_type:
                file_type = 'document'
            
            PatientFile.objects.create(
                patient=patient,
                medical_record=medical_record,
                file_type=file_type,
                file_url=lab.get('uri', ''),
                file_name=lab.get('name', ''),
                tag='Lab Result',
                caption='',
                uploaded_by=doctor
            )
        
        # Handle Laser Session data if provided
        laser_session_data = request.data.get('laser_session')
        laser_session = None
        if laser_session_data:
            laser_session = LaserSession.objects.create(
                patient=patient,
                doctor=doctor,
                medical_record=medical_record,
                treatment_area=laser_session_data.get('treatment_area', ''),
                skin_type=laser_session_data.get('skin_type', 'III'),
                intensity=laser_session_data.get('intensity', 'Medium'),
                passes=laser_session_data.get('passes', 1),
                notes=laser_session_data.get('notes', ''),
                post_care_instructions=json.dumps(laser_session_data.get('post_care', [])),
                consumables_used=json.dumps(laser_session_data.get('consumables', []))
            )
        
        return Response({
            'success': True,
            'record_id': medical_record.record_id,
            'prescription_id': prescription.prescription_id if prescription else None,
            'pharmacy_dispatch': pharmacy_dispatch_data,
            'pharmacy_dispatch_error': pharmacy_dispatch_error,
            'laser_session_id': laser_session.session_id if laser_session else None,
            'files_saved': len(photos_data) + len(labs_data),
            'message': 'Diagnosis saved successfully'
        }, status=status.HTTP_201_CREATED)
    
    @action(detail=True, methods=['post', 'patch'])
    def update_info(self, request, pk=None):
        """
        Update patient additional info: email, notes, medical_history, surgeries, allergies
        
        Expected JSON:
        {
            "email": "patient@email.com",
            "notes": "Some notes about the patient",
            "medical_history": ["Diabetes", "Hypertension"],
            "surgeries": ["Appendectomy 2020"],
            "allergies": ["Penicillin", "Aspirin"]
        }
        """
        patient = self.get_object()
        
        # Update basic fields
        if 'email' in request.data:
            patient.email = request.data.get('email', '')
        
        if 'notes' in request.data:
            patient.notes = request.data.get('notes', '')
        
        if 'medical_history' in request.data:
            medical_history = request.data.get('medical_history', [])
            if isinstance(medical_history, list):
                patient.medical_history = ', '.join(medical_history)
            else:
                patient.medical_history = str(medical_history)
        
        if 'surgeries' in request.data:
            surgeries = request.data.get('surgeries', [])
            if isinstance(surgeries, list):
                patient.surgeries = ', '.join(surgeries)
            else:
                patient.surgeries = str(surgeries)
        
        patient.save()
        
        # Handle allergies separately (uses junction table)
        if 'allergies' in request.data:
            allergy_names = request.data.get('allergies', [])
            
            # Remove existing allergies
            PatientAllergy.objects.filter(patient=patient).delete()
            
            # Add new allergies
            for allergy_name in allergy_names:
                if allergy_name and allergy_name.strip():
                    allergy, _ = Allergy.objects.get_or_create(name=allergy_name.strip())
                    PatientAllergy.objects.get_or_create(patient=patient, allergy=allergy)
        
        # Return updated patient info
        patient_allergies = PatientAllergy.objects.filter(patient=patient).select_related('allergy')
        allergies = [pa.allergy.name for pa in patient_allergies]
        self._sync_patient_to_lab_safe(patient)
        
        return Response({
            'success': True,
            'message': 'Patient info updated successfully',
            'patient': {
                'id': patient.patient_id,
                'name': patient.name,
                'email': patient.email or '',
                'notes': patient.notes or '',
                'medical_history': [h.strip() for h in patient.medical_history.split(',') if h.strip()] if patient.medical_history else [],
                'surgeries': [s.strip() for s in patient.surgeries.split(',') if s.strip()] if patient.surgeries else [],
                'allergies': allergies
            }
        })

    def _parse_duration(self, duration_str):
        """Parse duration string to days (e.g., '7 days' -> 7)"""
        if not duration_str:
            return None
        import re
        match = re.search(r'(\d+)', str(duration_str))
        if match:
            return int(match.group(1))
        return None

    @action(detail=True, methods=['get'])
    def laser_sessions(self, request, pk=None):
        """
        Get all laser sessions for a patient
        Returns list of laser sessions with post-care instructions and consumables
        """
        patient = self.get_object()
        
        sessions = LaserSession.objects.filter(
            patient=patient
        ).select_related('doctor').order_by('-session_date')
        
        session_list = []
        for session in sessions:
            try:
                post_care = json.loads(session.post_care_instructions) if session.post_care_instructions else []
            except:
                post_care = []
            
            try:
                consumables = json.loads(session.consumables_used) if session.consumables_used else []
            except:
                consumables = []
            
            session_list.append({
                'session_id': session.session_id,
                'treatment_area': session.treatment_area,
                'skin_type': session.skin_type,
                'skin_type_display': session.get_skin_type_display(),
                'intensity': session.intensity,
                'passes': session.passes,
                'notes': session.notes,
                'post_care_instructions': post_care,
                'consumables_used': consumables,
                'doctor_name': session.doctor.name if session.doctor else 'Unknown',
                'session_date': session.session_date.strftime('%Y-%m-%d'),
                'created_at': session.created_at.strftime('%Y-%m-%d %H:%M')
            })
        
        return Response({
            'success': True,
            'sessions': session_list,
            'total': len(session_list)
        })

    @action(detail=True, methods=['get'])
    def profile(self, request, pk=None):
        """
        Get comprehensive patient profile for patient-page
        Returns patient info, allergies, medical history, all visits with prescriptions, and all files
        """
        patient = self.get_object()
        
        # Get patient allergies
        patient_allergies = PatientAllergy.objects.filter(patient=patient).select_related('allergy')
        allergies = [pa.allergy.name for pa in patient_allergies]
        
        # Get all medical records with prescriptions and files
        medical_records = MedicalRecord.objects.filter(
            patient=patient
        ).select_related('doctor', 'appointment').prefetch_related(
            'prescriptions__prescriptionmedication_set__medication',
            'files'
        ).order_by('-date')
        
        visits = []
        for record in medical_records:
            # Get prescriptions for this record
            prescriptions = []
            for prescription in record.prescriptions.all():
                for pm in prescription.prescriptionmedication_set.all():
                    prescriptions.append({
                        'medication': pm.medication.name,
                        'dose': pm.dosage or pm.medication.strength or '',
                        'frequency': '1×/day',  # Default
                        'duration': f"{pm.duration_days} days" if pm.duration_days else '',
                        'notes': pm.notes
                    })

                # Include ordered lab tests/scans as prescription-like rows for visit history + download
                ordered_tests = []
                try:
                    ordered_tests = json.loads(prescription.ordered_tests_json or '[]')
                except Exception:
                    ordered_tests = []

                for idx, item in enumerate(ordered_tests):
                    if not isinstance(item, dict):
                        continue
                    name = str(item.get('name') or '').strip()
                    if not name:
                        continue
                    category = str(item.get('category') or 'LAB_TEST').replace('_', ' ').title()
                    item_notes = str(item.get('notes') or '').strip()
                    prescriptions.append({
                        'medication': f"[{category}] {name}",
                        'dose': category,
                        'frequency': '',
                        'duration': '',
                        'notes': item_notes
                    })
            
            # Get files for this record
            record_files = []
            for f in record.files.all():
                record_files.append({
                    'id': f.file_id,
                    'type': f.file_type,
                    'url': f.file_url,
                    'name': f.file_name,
                    'tag': f.tag,
                    'caption': f.caption,
                    'date': f.created_at.strftime('%Y-%m-%d %H:%M')
                })
            
            # Get appointment info if available
            service_type = 'Diagnosis'
            if record.appointment:
                service_type = record.appointment.type or 'Diagnosis'
            
            doctor_name = f"Dr. {record.doctor.name}" if record.doctor else "Unknown Doctor"
            
            visits.append({
                'id': record.record_id,
                'title': f"Visit with {doctor_name}",
                'date': record.date.strftime('%B %d, %Y'),
                'service': service_type,
                'diagnosis': {
                    'complaint': '',  # Not stored separately in current model
                    'findings': '',   # Not stored separately in current model
                    'finalDiagnosis': record.diagnosis
                },
                'prescriptions': prescriptions,
                'treatment': record.notes,
                'files': record_files,
                'cost': 0,
                'paymentStatus': 'Paid'
            })
        
        # Get all appointments for additional visit info
        appointments = Appointment.objects.filter(
            patient=patient
        ).select_related('doctor').order_by('-date')
        
        # Add appointments that don't have medical records
        existing_appt_ids = [r.appointment_id for r in medical_records if r.appointment_id]
        for appt in appointments:
            if appt.appointment_id not in existing_appt_ids and appt.status == 'completed':
                doctor_name = f"Dr. {appt.doctor.name}" if appt.doctor else "Unknown Doctor"
                visits.append({
                    'id': f"appt_{appt.appointment_id}",
                    'title': f"Visit with {doctor_name}",
                    'date': appt.date.strftime('%B %d, %Y'),
                    'service': appt.type or 'General',
                    'diagnosis': {
                        'complaint': '',
                        'findings': '',
                        'finalDiagnosis': appt.notes or 'No diagnosis recorded'
                    },
                    'prescriptions': [],
                    'treatment': appt.notes or '',
                    'files': [],
                    'cost': 0,
                    'paymentStatus': 'Paid'
                })
        
        # Sort visits by date (newest first)
        visits.sort(key=lambda x: x['date'], reverse=True)
        
        # Get ALL patient files (for gallery view)
        all_files = PatientFile.objects.filter(patient=patient).order_by('-created_at')
        all_photos = []
        all_labs = []
        for f in all_files:
            file_data = {
                'id': f.file_id,
                'type': f.file_type,
                'url': f.file_url,
                'name': f.file_name,
                'tag': f.tag,
                'caption': f.caption,
                'date': f.created_at.strftime('%Y-%m-%d %H:%M'),
                'visit_id': f.medical_record_id
            }
            if f.file_type in ['photo', 'before_after']:
                all_photos.append(file_data)
            else:
                all_labs.append(file_data)
        
        insurance_company = patient.insurance_company
        insurance_is_active = patient.is_insurance_active(date.today())
        return Response({
            'id': patient.patient_id,
            'name': patient.name,
            'age': patient.age,
            'gender': patient.gender or 'Unknown',
            'phone': patient.phone or '',
            'email': patient.email or '',
            'allergies': allergies,
            'notes': patient.notes or '',
            'medicalHistory': [h.strip() for h in patient.medical_history.split(',') if h.strip()] if patient.medical_history else [],
            'surgeries': [s.strip() for s in patient.surgeries.split(',') if s.strip()] if patient.surgeries else [],
            'has_insurance': patient.has_insurance,
            'insurance_company': insurance_company.id if insurance_company else None,
            'insurance_company_name': insurance_company.name if insurance_company else '',
            'insurance_discount_percent': float(insurance_company.discount_percent) if insurance_company else 0,
            'insurance_member_id': patient.insurance_member_id or '',
            'insurance_valid_from': patient.insurance_valid_from.isoformat() if patient.insurance_valid_from else None,
            'insurance_valid_to': patient.insurance_valid_to.isoformat() if patient.insurance_valid_to else None,
            'insurance_is_active': insurance_is_active,
            'visits': visits,
            'photos': all_photos,
            'labs': all_labs,
            'created_at': patient.created_at.strftime('%Y-%m-%d')
        })


class DoctorViewSet(viewsets.ModelViewSet):
    queryset = Doctor.objects.all()
    serializer_class = DoctorSerializer

    def get_queryset(self):
        return Doctor.objects.all().order_by('name')

    @action(detail=True, methods=['get'])
    def dashboard(self, request, pk=None):
        """
        Get dashboard data for a specific doctor
        Returns appointments for today, stats, and appointments grouped by date
        """
        from datetime import date, datetime
        from django.db.models import Count, Q
        from collections import defaultdict
        
        doctor = self.get_object()
        today = date.today()
        
        # Get today's appointments for this doctor
        todays_appointments = Appointment.objects.filter(
            doctor=doctor,
            date=today
        ).select_related('patient').order_by('time')
        
        # Get all appointments for calendar (next 60 days and past 30 days)
        from datetime import timedelta
        start_date = today - timedelta(days=30)
        end_date = today + timedelta(days=60)
        
        all_appointments = Appointment.objects.filter(
            doctor=doctor,
            date__gte=start_date,
            date__lte=end_date
        ).select_related('patient').order_by('date', 'time')
        
        # Group appointments by date for calendar
        appointments_by_date = defaultdict(list)
        for appt in all_appointments:
            date_str = appt.date.strftime('%Y-%m-%d')
            appointments_by_date[date_str].append({
                'id': appt.appointment_id,
                'patient_id': appt.patient.patient_id,
                'name': appt.patient.name,
                'service': appt.type or 'General',
                'time': appt.time.strftime('%I:%M %p'),
                'status': self._map_status(appt.status),
            })
        
        # Calculate stats
        total_today = todays_appointments.count()
        pending = todays_appointments.filter(status__in=['booked', 'checked_in']).count()
        confirmed = todays_appointments.filter(status='completed').count()
        
        # Get open medical records count
        open_records = MedicalRecord.objects.filter(doctor=doctor).count()
        
        # Format today's appointments
        today_list = []
        for appt in todays_appointments:
            today_list.append({
                'id': appt.appointment_id,
                'patient_id': appt.patient.patient_id,
                'name': appt.patient.name,
                'service': appt.type or 'General',
                'time': appt.time.strftime('%I:%M %p'),
                'status': self._map_status(appt.status),
            })
        
        return Response({
            'doctor': {
                'id': doctor.doctor_id,
                'name': doctor.name,
                'specialty': doctor.specialty,
            },
            'stats': {
                'total_sessions': total_today,
                'pending': pending,
                'confirmed': confirmed,
                'open_records': open_records,
            },
            'todays_appointments': today_list,
            'appointments_by_date': dict(appointments_by_date),
        })
    
    def _map_status(self, status):
        """Map backend status to frontend display status"""
        status_map = {
            'booked': 'Pending',
            'checked_in': 'Pending',
            'completed': 'Confirmed',
            'cancelled': 'Canceled',
        }
        return status_map.get(status, 'Pending')
    
    @action(detail=True, methods=['get'])
    def appointments_by_date(self, request, pk=None):
        """Get appointments for a specific date"""
        doctor = self.get_object()
        date_str = request.query_params.get('date')
        
        if not date_str:
            return Response({'error': 'date parameter required'}, status=status.HTTP_400_BAD_REQUEST)
        
        from datetime import datetime
        try:
            target_date = datetime.strptime(date_str, '%Y-%m-%d').date()
        except ValueError:
            return Response({'error': 'Invalid date format. Use YYYY-MM-DD'}, status=status.HTTP_400_BAD_REQUEST)
        
        appointments = Appointment.objects.filter(
            doctor=doctor,
            date=target_date
        ).select_related('patient').order_by('time')
        
        result = []
        for appt in appointments:
            result.append({
                'id': appt.appointment_id,
                'patient_id': appt.patient.patient_id,
                'name': appt.patient.name,
                'service': appt.type or 'General',
                'time': appt.time.strftime('%I:%M %p'),
                'status': self._map_status(appt.status),
            })
        
        return Response({'date': date_str, 'appointments': result})

    @action(detail=True, methods=['get'])
    def patients(self, request, pk=None):
        """
        Get all patients that this doctor has seen (through appointments)
        Returns patient info with their last service and last visit date
        """
        from django.db.models import Max
        
        doctor = self.get_object()
        
        # Get all unique patients who have appointments with this doctor
        patient_appointments = Appointment.objects.filter(
            doctor=doctor
        ).values('patient').annotate(
            last_visit=Max('date')
        ).order_by('-last_visit')
        
        result = []
        for pa in patient_appointments:
            patient = Patient.objects.get(patient_id=pa['patient'])
            
            # Get the last appointment for this patient with this doctor
            last_appt = Appointment.objects.filter(
                doctor=doctor,
                patient=patient
            ).order_by('-date', '-time').first()
            
            result.append({
                'patient_id': patient.patient_id,
                'name': patient.name,
                'age': patient.age,
                'gender': patient.gender,
                'phone': patient.phone,
                'last_service': last_appt.type if last_appt and last_appt.type else 'General',
                'last_visit': pa['last_visit'].strftime('%Y-%m-%d') if pa['last_visit'] else None,
            })
        
        return Response(result)


class ReceptionistViewSet(viewsets.ModelViewSet):
    queryset = Receptionist.objects.all()
    serializer_class = ReceptionistSerializer

    def get_queryset(self):
        return Receptionist.objects.all().order_by('name')

    def create(self, request, *args, **kwargs):
        name = (request.data.get('name') or '').strip()
        email = (request.data.get('email') or '').strip().lower()
        password = request.data.get('password') or ''
        is_admin = bool(request.data.get('is_admin', False))

        if not name or not email or not password:
            return Response({'error': 'Name, email, and password are required.'}, status=status.HTTP_400_BAD_REQUEST)

        if Receptionist.objects.filter(email=email).exists():
            return Response({'error': 'Receptionist with this email already exists.'}, status=status.HTTP_400_BAD_REQUEST)

        username_base = email.split('@')[0] or f"receptionist_{name.replace(' ', '_').lower()}"
        username = username_base
        suffix = 1
        while User.objects.filter(username=username).exists():
            suffix += 1
            username = f"{username_base}_{suffix}"

        user = User.objects.create_user(username=username, email=email, password=password)
        if not Receptionist.objects.filter(is_admin=True).exists():
            is_admin = True

        receptionist = Receptionist.objects.create(
            user=user,
            name=name,
            email=email,
            password=password,
            is_admin=is_admin
        )
        serializer = self.get_serializer(receptionist)
        return Response(serializer.data, status=status.HTTP_201_CREATED)

    def destroy(self, request, *args, **kwargs):
        receptionist = self.get_object()
        if receptionist.is_admin and Receptionist.objects.filter(is_admin=True).count() <= 1:
            return Response({'error': 'Cannot delete the only admin receptionist.'}, status=status.HTTP_400_BAD_REQUEST)
        linked_user = receptionist.user
        receptionist.delete()
        if linked_user:
            linked_user.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)

    @action(detail=False, methods=['post'])
    def ensure_admin(self, request):
        """
        If no admin receptionist exists yet, promote the provided receptionist id as admin.
        """
        receptionist_id = request.data.get('receptionist_id')
        if not receptionist_id:
            return Response({'error': 'receptionist_id is required.'}, status=status.HTTP_400_BAD_REQUEST)

        target = Receptionist.objects.filter(receptionist_id=receptionist_id).first()
        if not target:
            return Response({'error': 'Receptionist not found.'}, status=status.HTTP_404_NOT_FOUND)

        if not Receptionist.objects.filter(is_admin=True).exists():
            target.is_admin = True
            target.save(update_fields=['is_admin'])

        return Response({
            'receptionist_id': target.receptionist_id,
            'is_admin': target.is_admin,
        })

    @action(detail=True, methods=['get'])
    def dashboard(self, request, pk=None):
        """
        Get dashboard data for receptionist
        Returns today's appointments, stats, and appointments grouped by date
        """
        from datetime import date, timedelta
        from collections import defaultdict
        
        try:
            receptionist = self.get_object()
        except Exception:
            receptionist = None
        today = date.today()
        
        # Get today's appointments (all doctors)
        todays_appointments = Appointment.objects.filter(
            date=today
        ).select_related('patient', 'doctor').order_by('time')
        
        # Get appointments for calendar (next 60 days and past 30 days)
        start_date = today - timedelta(days=30)
        end_date = today + timedelta(days=60)
        
        all_appointments = Appointment.objects.filter(
            date__gte=start_date,
            date__lte=end_date
        ).select_related('patient', 'doctor').order_by('date', 'time')
        
        # Group appointments by date for calendar
        appointments_by_date = defaultdict(list)
        for appt in all_appointments:
            date_str = appt.date.strftime('%Y-%m-%d')
            appointments_by_date[date_str].append({
                'id': appt.appointment_id,
                'patient_id': appt.patient.patient_id,
                'patient': appt.patient.name,
                'doctor': appt.doctor.name if appt.doctor else 'Unassigned',
                'service': appt.type or 'General',
                'time': appt.time.strftime('%I:%M %p'),
                'status': self._map_status(appt.status),
            })
        
        # Calculate stats
        total_today = todays_appointments.count()
        pending = todays_appointments.filter(status__in=['booked', 'checked_in']).count()
        confirmed = todays_appointments.filter(status='completed').count()
        checked_in = todays_appointments.filter(status='checked_in').count()
        
        # Get total patients count
        total_patients = Patient.objects.count()
        
        # Format today's appointments
        today_list = []
        for appt in todays_appointments:
            today_list.append({
                'id': appt.appointment_id,
                'patient_id': appt.patient.patient_id,
                'patient': appt.patient.name,
                'doctor': appt.doctor.name if appt.doctor else 'Unassigned',
                'service': appt.type or 'General',
                'time': appt.time.strftime('%I:%M %p'),
                'status': self._map_status(appt.status),
            })
        
        return Response({
            'receptionist': {
                'id': receptionist.receptionist_id if receptionist else None,
                'name': receptionist.name if receptionist else 'Receptionist',
            },
            'stats': {
                'total_appointments': total_today,
                'pending': pending,
                'confirmed': confirmed,
                'checked_in': checked_in,
                'total_patients': total_patients,
            },
            'todays_appointments': today_list,
            'appointments_by_date': dict(appointments_by_date),
        })
    
    def _map_status(self, status):
        """Map backend status to frontend display status"""
        status_map = {
            'booked': 'Pending',
            'checked_in': 'Checked In',
            'completed': 'Confirmed',
            'cancelled': 'Canceled',
        }
        return status_map.get(status, 'Pending')


class ServiceViewSet(viewsets.ModelViewSet):
    queryset = Service.objects.all()
    serializer_class = ServiceSerializer


class AppointmentViewSet(viewsets.ModelViewSet):
    queryset = Appointment.objects.all().order_by('-date', '-time')
    serializer_class = AppointmentSerializer

    def get_queryset(self):
        """
        Optionally filter appointments by date and/or doctor
        """
        queryset = Appointment.objects.all().order_by('-date', '-time')
        
        # Filter by date if provided
        date = self.request.query_params.get('date', None)
        if date:
            queryset = queryset.filter(date=date)
        
        # Filter by doctor if provided
        doctor = self.request.query_params.get('doctor', None)
        if doctor:
            queryset = queryset.filter(doctor_id=doctor)
        
        # Filter by patient if provided
        patient = self.request.query_params.get('patient', None)
        if patient:
            queryset = queryset.filter(patient_id=patient)
        
        # Filter by status if provided
        status = self.request.query_params.get('status', None)
        if status:
            queryset = queryset.filter(status=status)
        
        return queryset

    @action(detail=True, methods=['post'])
    def add_service(self, request, pk=None):
        appointment = self.get_object()
        service_id = request.data.get('service_id')
        appo_cost = request.data.get('appo_cost', None)
        service = get_object_or_404(Service, pk=service_id)
        appt_service, created = AppointmentService.objects.get_or_create(appointment=appointment, service=service)
        if appo_cost is not None:
            appt_service.appo_cost = appo_cost
            appt_service.save()
        return Response({'status': 'service added'})


class InvoiceViewSet(viewsets.ModelViewSet):
    queryset = Invoice.objects.all().order_by('-invoice_date')
    serializer_class = InvoiceSerializer

    def create(self, request, *args, **kwargs):
        """Create a new invoice with items"""
        from .models import InvoiceItem
        
        # Extract items from request data
        items_data = request.data.pop('items', [])
        
        # Calculate totals
        subtotal = sum(item.get('quantity', 1) * float(item.get('unit_price', 0)) for item in items_data)
        discount_amount = float(request.data.get('discount_amount', 0))
        insurance_coverage = float(request.data.get('insurance_coverage', 0) or 0)
        insurance_provider = request.data.get('insurance_provider', '') or ''

        # Auto-apply insurance from patient account if not provided
        patient_id = request.data.get('patient')
        if patient_id:
            patient = Patient.objects.filter(patient_id=patient_id).select_related('insurance_company').first()
            if patient and patient.is_insurance_active(date.today()):
                if insurance_coverage <= 0:
                    insurance_coverage = float(patient.insurance_company.discount_percent)
                if not insurance_provider:
                    insurance_provider = patient.insurance_company.name
                request.data['insurance_provider'] = insurance_provider
                request.data['insurance_coverage'] = insurance_coverage
            else:
                request.data['insurance_provider'] = ''
                request.data['insurance_coverage'] = 0

        insurance_amount = max(0, (subtotal - discount_amount) * (insurance_coverage / 100))
        total_amount = max(0, subtotal - discount_amount - insurance_amount)
        
        # Update request data with calculated values
        request.data['subtotal'] = subtotal
        request.data['insurance_amount'] = insurance_amount
        request.data['total_amount'] = total_amount
        
        # Create invoice
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        invoice = serializer.save()
        
        # Create invoice items
        for item_data in items_data:
            InvoiceItem.objects.create(
                invoice=invoice,
                description=item_data.get('description', ''),
                quantity=item_data.get('quantity', 1),
                unit_price=item_data.get('unit_price', 0)
            )
        
        # Re-fetch invoice with items
        invoice.refresh_from_db()
        result_serializer = self.get_serializer(invoice)
        return Response(result_serializer.data, status=status.HTTP_201_CREATED)

    def update(self, request, *args, **kwargs):
        """Update invoice with items"""
        from .models import InvoiceItem
        
        partial = kwargs.pop('partial', False)
        instance = self.get_object()
        
        # Extract items from request data
        items_data = request.data.pop('items', None)
        
        if items_data is not None:
            # Calculate totals from new items
            subtotal = sum(item.get('quantity', 1) * float(item.get('unit_price', 0)) for item in items_data)
            discount_amount = float(request.data.get('discount_amount', instance.discount_amount))
            insurance_coverage = float(request.data.get('insurance_coverage', instance.insurance_coverage) or 0)
            insurance_provider = request.data.get('insurance_provider', instance.insurance_provider) or ''

            # Auto-apply insurance from patient account if not provided
            patient = instance.patient
            if patient and patient.is_insurance_active(date.today()):
                if insurance_coverage <= 0:
                    insurance_coverage = float(patient.insurance_company.discount_percent)
                if not insurance_provider:
                    insurance_provider = patient.insurance_company.name
                request.data['insurance_provider'] = insurance_provider
                request.data['insurance_coverage'] = insurance_coverage
            else:
                request.data['insurance_provider'] = ''
                request.data['insurance_coverage'] = 0

            insurance_amount = max(0, (subtotal - discount_amount) * (insurance_coverage / 100))
            total_amount = max(0, subtotal - discount_amount - insurance_amount)
            
            request.data['subtotal'] = subtotal
            request.data['insurance_amount'] = insurance_amount
            request.data['total_amount'] = total_amount
            
            # Delete old items and create new ones
            instance.items.all().delete()
            for item_data in items_data:
                InvoiceItem.objects.create(
                    invoice=instance,
                    description=item_data.get('description', ''),
                    quantity=item_data.get('quantity', 1),
                    unit_price=item_data.get('unit_price', 0)
                )
        
        serializer = self.get_serializer(instance, data=request.data, partial=partial)
        serializer.is_valid(raise_exception=True)
        self.perform_update(serializer)
        
        return Response(serializer.data)

    @action(detail=True, methods=['post'])
    def mark_paid(self, request, pk=None):
        inv = self.get_object()
        inv.is_paid = True
        inv.payment_status = 'paid'
        inv.payment_method = request.data.get('payment_method', inv.payment_method)
        inv.save()
        return Response({'status': 'invoice marked paid'})


class MedicalRecordViewSet(viewsets.ModelViewSet):
    queryset = MedicalRecord.objects.all().order_by('-date')
    serializer_class = MedicalRecordSerializer


class MedicationViewSet(viewsets.ModelViewSet):
    queryset = Medication.objects.all()
    serializer_class = MedicationSerializer

    def _fallback_price_for_name(self, name, med_id=""):
        seed = f"{name}|{med_id}"
        total = sum(ord(ch) for ch in seed)
        # Deterministic testing price band in EGP: 18.00 -> 147.50
        return round(18.0 + ((total % 104) * 1.25), 2)

    def _fetch_pharmacy_medications(self, q="", limit=30):
        endpoint = (getattr(settings, "PHARMACY_CATALOG_ENDPOINT", "") or "").strip()
        if not endpoint:
            return None
        try:
            response = requests.get(
                endpoint,
                params={
                    "q": q or "",
                    "limit": limit,
                    "in_stock_only": 0,
                },
                timeout=12,
            )
            response.raise_for_status()
            payload = response.json()
            items = payload if isinstance(payload, list) else payload.get("results", [])
            if not isinstance(items, list):
                return []
            return items
        except Exception:
            return None

    def _map_pharmacy_item_to_medication(self, item):
        name = str(item.get("name") or "").strip()
        if not name:
            return None
        med_id = str(item.get("sku") or item.get("id") or name)
        quantity = item.get("quantity")
        price_raw = item.get("price")
        try:
            price = float(price_raw) if price_raw is not None else 0.0
        except (TypeError, ValueError):
            price = 0.0
        if price <= 0:
            price = self._fallback_price_for_name(name, med_id)
        notes = f"Pharmacy stock: {quantity}" if quantity is not None else "Pharmacy stock: N/A"
        return {
            "med_id": med_id,
            "name": name,
            "category": str(item.get("category") or ""),
            "manufacturer": str(item.get("supplier") or ""),
            "form": str(item.get("form") or ""),
            "strength": str(item.get("strength") or item.get("dose") or ""),
            "price": price,
            "stock": int(quantity or 0),
            "notes": notes,
            "pharmacy_sku": str(item.get("sku") or ""),
            "pharmacy_quantity": int(quantity or 0),
            "source": "pharmacy_inventory",
        }
    
    def get_queryset(self):
        queryset = super().get_queryset()
        q = (self.request.query_params.get('q') or "").strip()
        if q:
            queryset = queryset.filter(
                models.Q(name__icontains=q) |
                models.Q(form__icontains=q) |
                models.Q(manufacturer__icontains=q) |
                models.Q(category__icontains=q)
            )
        queryset = queryset.order_by('name')
        limit = self.request.query_params.get('limit')
        if limit:
            try:
                limit_val = max(1, min(int(limit), 100))
                queryset = queryset[:limit_val]
            except ValueError:
                pass
        return queryset

    def list(self, request, *args, **kwargs):
        q = (request.query_params.get('q') or "").strip()
        limit = request.query_params.get('limit')
        try:
            limit_val = max(1, min(int(limit or 30), 100))
        except ValueError:
            limit_val = 30

        pharmacy_items = self._fetch_pharmacy_medications(q=q, limit=limit_val)
        if pharmacy_items is not None:
            mapped = [self._map_pharmacy_item_to_medication(item) for item in pharmacy_items]
            mapped = [m for m in mapped if m]
            return Response(mapped)

        queryset = self.filter_queryset(self.get_queryset())
        serializer = self.get_serializer(queryset, many=True)
        enriched = []
        for item in serializer.data:
            row = dict(item)
            row["stock"] = int(row.get("pharmacy_quantity", 0) or 0)
            try:
                row["price"] = float(row.get("price", 0) or 0)
            except (TypeError, ValueError):
                row["price"] = 0.0
            enriched.append(row)
        return Response(enriched)

    @action(detail=False, methods=['get'])
    def suggest(self, request):
        q = (request.query_params.get('q') or "").strip()
        limit = request.query_params.get('limit')
        if not q:
            return Response([])
        try:
            limit_val = max(1, min(int(limit or 10), 50))
        except ValueError:
            limit_val = 10

        pharmacy_items = self._fetch_pharmacy_medications(q=q, limit=limit_val)
        if pharmacy_items is not None:
            mapped = [self._map_pharmacy_item_to_medication(item) for item in pharmacy_items]
            mapped = [m for m in mapped if m]
            return Response(mapped)

        base_qs = Medication.objects.filter(
            models.Q(name__icontains=q) |
            models.Q(category__icontains=q) |
            models.Q(manufacturer__icontains=q)
        )

        qs = base_qs.order_by('name')[:limit_val]
        if qs:
            serializer = self.get_serializer(qs, many=True)
            return Response(serializer.data)

        # Fallback: map common diseases to broad categories
        q_lower = q.lower()
        category_map = {
            "acne": ["Antibiotic", "Antifungal", "Vitamin"],
            "rosacea": ["Antibiotic", "Vitamin"],
            "eczema": ["Antifungal", "Vitamin"],
            "dermatitis": ["Antifungal", "Vitamin"],
            "psoriasis": ["Vitamin", "Antifungal"],
            "fungal": ["Antifungal"],
            "tinea": ["Antifungal"],
            "infection": ["Antibiotic"],
            "bacterial": ["Antibiotic"],
            "viral": ["Antiviral"],
            "herpes": ["Antiviral"],
            "allergy": ["Vitamin"],
            "urticaria": ["Vitamin"],
            "pruritus": ["Vitamin"],
            "melasma": ["Vitamin"],
        }
        matched_categories = []
        for key, cats in category_map.items():
            if key in q_lower:
                matched_categories.extend(cats)

        if matched_categories:
            cat_qs = Medication.objects.filter(category__in=matched_categories).order_by('name')[:limit_val]
            serializer = self.get_serializer(cat_qs, many=True)
            return Response(serializer.data)

        # Final fallback: return first N medications
        fallback_qs = Medication.objects.all().order_by('name')[:limit_val]
        serializer = self.get_serializer(fallback_qs, many=True)
        return Response(serializer.data)


class PrescriptionViewSet(viewsets.ModelViewSet):
    queryset = Prescription.objects.all()
    serializer_class = PrescriptionSerializer

    @action(detail=True, methods=['post'])
    def add_medication(self, request, pk=None):
        presc = self.get_object()
        med_id = request.data.get('medication_id')
        dosage = request.data.get('dosage', '')
        duration_days = request.data.get('duration_days', None)
        med = get_object_or_404(Medication, pk=med_id)
        pm, created = PrescriptionMedication.objects.get_or_create(prescription=presc, medication=med)
        pm.dosage = dosage
        pm.duration_days = duration_days
        pm.save()
        return Response({'status': 'medication added'})

    @action(detail=True, methods=['post'])
    def dispatch_to_pharmacy(self, request, pk=None):
        prescription = self.get_object()
        idempotency_key = request.data.get("idempotency_key") or f"rx-{prescription.prescription_id}"
        dispatch, duplicate = _dispatch_prescription_to_pharmacy(prescription, idempotency_key=idempotency_key)
        return Response({
            "success": True,
            "duplicate": duplicate,
            "dispatch": PharmacyDispatchSerializer(dispatch).data
        }, status=status.HTTP_200_OK if duplicate else status.HTTP_201_CREATED)

    @action(detail=True, methods=['get'])
    def pharmacy_dispatch_status(self, request, pk=None):
        prescription = self.get_object()
        dispatches = PharmacyDispatch.objects.filter(prescription=prescription).order_by('-created_at')
        latest = dispatches.first()
        return Response({
            "prescription_id": prescription.prescription_id,
            "latest": PharmacyDispatchSerializer(latest).data if latest else None,
            "history": PharmacyDispatchSerializer(dispatches, many=True).data
        })

    @action(detail=True, methods=['post'])
    def retry_pharmacy_dispatch(self, request, pk=None):
        prescription = self.get_object()
        dispatch = PharmacyDispatch.objects.filter(prescription=prescription).order_by('-created_at').first()
        if not dispatch:
            return Response({"error": "No dispatch found for this prescription"}, status=status.HTTP_404_NOT_FOUND)

        dispatch = _attempt_dispatch(dispatch)
        return Response({
            "success": True,
            "dispatch": PharmacyDispatchSerializer(dispatch).data
        })

    @action(detail=True, methods=['post'])
    def acknowledge_pharmacy_dispatch(self, request, pk=None):
        prescription = self.get_object()
        dispatch = PharmacyDispatch.objects.filter(prescription=prescription).order_by('-created_at').first()
        if not dispatch:
            return Response({"error": "No dispatch found for this prescription"}, status=status.HTTP_404_NOT_FOUND)

        external_request_id = request.data.get("external_request_id")
        if external_request_id:
            dispatch.external_request_id = external_request_id
        dispatch.status = 'acknowledged'
        dispatch.acknowledged_at = timezone.now()
        dispatch.last_error = ""
        dispatch.save(update_fields=['status', 'acknowledged_at', 'external_request_id', 'last_error', 'updated_at'])
        return Response({
            "success": True,
            "dispatch": PharmacyDispatchSerializer(dispatch).data
        })


class TreatmentPlanViewSet(viewsets.ModelViewSet):
    queryset = TreatmentPlan.objects.all()
    serializer_class = TreatmentPlanSerializer


class TreatmentSessionViewSet(viewsets.ModelViewSet):
    queryset = TreatmentSession.objects.all()
    serializer_class = TreatmentSessionSerializer


class AllergyViewSet(viewsets.ModelViewSet):
    queryset = Allergy.objects.all().order_by('name')
    serializer_class = AllergySerializer
    
    def create(self, request, *args, **kwargs):
        """Create a new allergy, or return existing one if name matches"""
        name = request.data.get('name', '').strip()
        if name:
            existing = Allergy.objects.filter(name__iexact=name).first()
            if existing:
                serializer = self.get_serializer(existing)
                return Response(serializer.data, status=status.HTTP_200_OK)
        return super().create(request, *args, **kwargs)


class PatientAllergyViewSet(viewsets.ModelViewSet):
    queryset = PatientAllergy.objects.all()
    serializer_class = PatientAllergySerializer


class MedicalConditionViewSet(viewsets.ModelViewSet):
    queryset = MedicalCondition.objects.all().order_by('name')
    serializer_class = MedicalConditionSerializer
    
    def create(self, request, *args, **kwargs):
        """Create a new condition, or return existing one if name matches"""
        name = request.data.get('name', '').strip()
        if name:
            existing = MedicalCondition.objects.filter(name__iexact=name).first()
            if existing:
                serializer = self.get_serializer(existing)
                return Response(serializer.data, status=status.HTTP_200_OK)
        return super().create(request, *args, **kwargs)


class PatientMedicalConditionViewSet(viewsets.ModelViewSet):
    queryset = PatientMedicalCondition.objects.all()
    serializer_class = PatientMedicalConditionSerializer


class SurgeryTypeViewSet(viewsets.ModelViewSet):
    queryset = SurgeryType.objects.all().order_by('name')
    serializer_class = SurgeryTypeSerializer
    
    def create(self, request, *args, **kwargs):
        """Create a new surgery type, or return existing one if name matches"""
        name = request.data.get('name', '').strip()
        if name:
            existing = SurgeryType.objects.filter(name__iexact=name).first()
            if existing:
                serializer = self.get_serializer(existing)
                return Response(serializer.data, status=status.HTTP_200_OK)
        return super().create(request, *args, **kwargs)


class PatientSurgeryViewSet(viewsets.ModelViewSet):
    queryset = PatientSurgery.objects.all()
    serializer_class = PatientSurgerySerializer


# -------------------------
# Insurance Companies
# -------------------------
class InsuranceCompanyViewSet(viewsets.ModelViewSet):
    queryset = InsuranceCompany.objects.all().order_by('name')
    serializer_class = InsuranceCompanySerializer


# -------------------------
# Clinic Schedules
# -------------------------
class ClinicScheduleViewSet(viewsets.ModelViewSet):
    queryset = ClinicSchedule.objects.select_related('doctor').all().order_by('doctor__name', '-updated_at')
    serializer_class = ClinicScheduleSerializer

    def get_queryset(self):
        queryset = ClinicSchedule.objects.select_related('doctor').all()
        doctor_id = self.request.query_params.get('doctor')
        if doctor_id is not None:
            if doctor_id in ('', 'default', 'null'):
                queryset = queryset.filter(doctor__isnull=True)
            else:
                queryset = queryset.filter(doctor_id=doctor_id)
        return queryset.order_by('doctor__name', '-updated_at')

    @action(detail=False, methods=['post'])
    def upsert(self, request):
        doctor_id = request.data.get('doctor')
        open_days = request.data.get('open_days', [1, 2, 3, 4, 5, 6])
        open_time = request.data.get('open_time', '09:00')
        close_time = request.data.get('close_time', '17:00')
        slot_interval = int(request.data.get('slot_interval', 30) or 30)
        slot_interval = max(5, slot_interval)

        if doctor_id in (None, '', 'default', 'null'):
            schedule, _ = ClinicSchedule.objects.get_or_create(doctor=None)
        else:
            doctor = Doctor.objects.filter(doctor_id=doctor_id).first()
            if not doctor:
                return Response({'error': 'Doctor not found.'}, status=status.HTTP_404_NOT_FOUND)
            schedule, _ = ClinicSchedule.objects.get_or_create(doctor=doctor)

        schedule.open_days = open_days
        schedule.open_time = open_time
        schedule.close_time = close_time
        schedule.slot_interval = slot_interval
        schedule.save()

        serializer = self.get_serializer(schedule)
        return Response(serializer.data, status=status.HTTP_200_OK)

    @action(detail=False, methods=['get'])
    def resolved(self, request):
        doctor_id = request.query_params.get('doctor')
        target = None
        if doctor_id and doctor_id not in ('default', 'null'):
            target = ClinicSchedule.objects.select_related('doctor').filter(doctor_id=doctor_id).first()

        if not target:
            target = ClinicSchedule.objects.select_related('doctor').filter(doctor__isnull=True).first()

        if not target:
            target = ClinicSchedule.objects.create(
                doctor=None,
                open_days=[1, 2, 3, 4, 5, 6],
                open_time='09:00',
                close_time='17:00',
                slot_interval=30,
            )

        serializer = self.get_serializer(target)
        return Response(serializer.data)


# -------------------------
# Inventory ViewSets
# -------------------------
class InventoryItemViewSet(viewsets.ModelViewSet):
    queryset = InventoryItem.objects.all().order_by('name')
    serializer_class = InventoryItemSerializer
    
    @action(detail=False, methods=['get'])
    def low_stock(self, request):
        """Get items that are running low on stock"""
        low_stock_items = [item for item in self.queryset if item.is_low_stock]
        serializer = self.get_serializer(low_stock_items, many=True)
        return Response(serializer.data)
    
    @action(detail=False, methods=['get'])
    def expiring_soon(self, request):
        """Get items that are expiring within 90 days"""
        expiring_items = [item for item in self.queryset if item.is_expiring_soon]
        serializer = self.get_serializer(expiring_items, many=True)
        return Response(serializer.data)
    
    @action(detail=False, methods=['get'])
    def summary(self, request):
        """Get inventory summary statistics"""
        from django.db.models import Sum, Count
        from datetime import date, timedelta
        
        total_items = self.queryset.count()
        total_quantity = self.queryset.aggregate(total=Sum('quantity'))['total'] or 0
        low_stock_count = len([item for item in self.queryset if item.is_low_stock])
        expiring_soon_count = len([item for item in self.queryset if item.is_expiring_soon])
        
        # Category breakdown
        category_breakdown = {}
        for item in self.queryset:
            cat = item.get_category_display()
            if cat not in category_breakdown:
                category_breakdown[cat] = {'count': 0, 'total_quantity': 0}
            category_breakdown[cat]['count'] += 1
            category_breakdown[cat]['total_quantity'] += item.quantity
        
        return Response({
            'total_items': total_items,
            'total_quantity': total_quantity,
            'low_stock_count': low_stock_count,
            'expiring_soon_count': expiring_soon_count,
            'category_breakdown': category_breakdown,
        })
    
    @action(detail=True, methods=['post'])
    def add_stock(self, request, pk=None):
        """Add stock to an item and create a transaction"""
        item = self.get_object()
        quantity = int(request.data.get('quantity', 0))
        notes = request.data.get('notes', '')
        performed_by = request.data.get('performed_by', '')
        
        if quantity <= 0:
            return Response({'error': 'Quantity must be positive'}, status=status.HTTP_400_BAD_REQUEST)
        
        # Update item quantity
        item.quantity += quantity
        
        # Update supplier and expiry if provided
        if request.data.get('supplier'):
            item.supplier = request.data.get('supplier')
        if request.data.get('expiry_date'):
            item.expiry_date = request.data.get('expiry_date')
        
        item.save()
        
        # Create transaction record
        StockTransaction.objects.create(
            item=item,
            transaction_type='add',
            quantity=quantity,
            notes=notes,
            performed_by=performed_by
        )
        
        serializer = self.get_serializer(item)
        return Response(serializer.data)
    
    @action(detail=True, methods=['post'])
    def use_stock(self, request, pk=None):
        """Use/deduct stock from an item and create a transaction"""
        item = self.get_object()
        quantity = int(request.data.get('quantity', 0))
        notes = request.data.get('notes', '')
        performed_by = request.data.get('performed_by', '')
        
        if quantity <= 0:
            return Response({'error': 'Quantity must be positive'}, status=status.HTTP_400_BAD_REQUEST)
        
        if quantity > item.quantity:
            return Response({'error': 'Insufficient stock'}, status=status.HTTP_400_BAD_REQUEST)
        
        # Update item quantity
        item.quantity -= quantity
        item.save()
        
        # Create transaction record
        StockTransaction.objects.create(
            item=item,
            transaction_type='use',
            quantity=-quantity,
            notes=notes,
            performed_by=performed_by
        )
        
        serializer = self.get_serializer(item)
        return Response(serializer.data)


class StockTransactionViewSet(viewsets.ModelViewSet):
    queryset = StockTransaction.objects.all().order_by('-created_at')
    serializer_class = StockTransactionSerializer
    
    def get_queryset(self):
        queryset = super().get_queryset()
        item_id = self.request.query_params.get('item', None)
        if item_id:
            queryset = queryset.filter(item_id=item_id)
        return queryset


# -------------------------
# Report Analytics ViewSets
# -------------------------
@api_view(['GET'])
def report_analytics(request):
    """
    Get comprehensive analytics for reports
    Query params:
    - period: week, month, year (default: week)
    - start_date: YYYY-MM-DD (optional, for custom range)
    - end_date: YYYY-MM-DD (optional, for custom range)
    """
    from datetime import date, timedelta
    from django.db.models import Count, Sum
    from django.db.models.functions import TruncDate, TruncMonth, TruncWeek
    from collections import defaultdict
    
    period = request.query_params.get('period', 'week')
    today = date.today()
    
    # Calculate date range based on period
    if period == 'week':
        start_date = today - timedelta(days=6)  # Last 7 days
        date_range = [(start_date + timedelta(days=i)) for i in range(7)]
    elif period == 'month':
        start_date = today - timedelta(days=29)  # Last 30 days
        date_range = [(start_date + timedelta(days=i)) for i in range(30)]
    else:  # year
        start_date = today - timedelta(days=364)  # Last 12 months
        date_range = None  # Will group by month
    
    # Custom date range if provided
    if request.query_params.get('start_date'):
        from datetime import datetime
        start_date = datetime.strptime(request.query_params.get('start_date'), '%Y-%m-%d').date()
    if request.query_params.get('end_date'):
        from datetime import datetime
        end_date = datetime.strptime(request.query_params.get('end_date'), '%Y-%m-%d').date()
    else:
        end_date = today
    
    # --- Appointments Analytics ---
    appointments = Appointment.objects.filter(date__gte=start_date, date__lte=end_date)
    
    if period == 'year':
        # Group by month
        appt_by_date = appointments.annotate(
            period=TruncMonth('date')
        ).values('period').annotate(count=Count('appointment_id')).order_by('period')
        
        monthly_data = {item['period'].strftime('%Y-%m'): item['count'] for item in appt_by_date}
        labels = []
        appointment_counts = []
        current = start_date.replace(day=1)
        while current <= end_date:
            labels.append(current.strftime('%b'))
            key = current.strftime('%Y-%m')
            appointment_counts.append(monthly_data.get(key, 0))
            # Move to next month
            if current.month == 12:
                current = current.replace(year=current.year + 1, month=1)
            else:
                current = current.replace(month=current.month + 1)
    else:
        # Group by day
        appt_by_date = appointments.values('date').annotate(count=Count('appointment_id')).order_by('date')
        daily_data = {item['date']: item['count'] for item in appt_by_date}
        
        labels = []
        appointment_counts = []
        for d in date_range:
            if period == 'week':
                labels.append(d.strftime('%a'))  # Mon, Tue, etc.
            else:
                labels.append(str(d.day))  # 1, 2, 3, etc.
            appointment_counts.append(daily_data.get(d, 0))
    
    # Appointment status breakdown
    status_counts = appointments.values('status').annotate(count=Count('appointment_id'))
    completed = sum(s['count'] for s in status_counts if s['status'] == 'completed')
    cancelled = sum(s['count'] for s in status_counts if s['status'] == 'cancelled')
    no_shows = sum(s['count'] for s in status_counts if s['status'] == 'no_show')
    total_appts = appointments.count()
    
    # --- Patients Analytics ---
    patients = Patient.objects.filter(created_at__date__gte=start_date, created_at__date__lte=end_date)
    
    if period == 'year':
        patient_by_date = patients.annotate(
            period=TruncMonth('created_at')
        ).values('period').annotate(count=Count('patient_id')).order_by('period')
        
        monthly_patient_data = {item['period'].strftime('%Y-%m'): item['count'] for item in patient_by_date}
        new_patients = []
        current = start_date.replace(day=1)
        while current <= end_date:
            key = current.strftime('%Y-%m')
            new_patients.append(monthly_patient_data.get(key, 0))
            if current.month == 12:
                current = current.replace(year=current.year + 1, month=1)
            else:
                current = current.replace(month=current.month + 1)
    else:
        patient_by_date = patients.values('created_at__date').annotate(count=Count('patient_id')).order_by('created_at__date')
        daily_patient_data = {item['created_at__date']: item['count'] for item in patient_by_date}
        
        new_patients = []
        for d in date_range:
            new_patients.append(daily_patient_data.get(d, 0))
    
    # --- Payments Analytics ---
    invoices = Invoice.objects.filter(invoice_date__gte=start_date, invoice_date__lte=end_date)
    
    if period == 'year':
        invoice_by_date = invoices.annotate(
            period=TruncMonth('invoice_date')
        ).values('period').annotate(total=Sum('total_amount')).order_by('period')
        
        monthly_invoice_data = {item['period'].strftime('%Y-%m'): float(item['total'] or 0) for item in invoice_by_date}
        payments = []
        current = start_date.replace(day=1)
        while current <= end_date:
            key = current.strftime('%Y-%m')
            payments.append(monthly_invoice_data.get(key, 0))
            if current.month == 12:
                current = current.replace(year=current.year + 1, month=1)
            else:
                current = current.replace(month=current.month + 1)
    else:
        invoice_by_date = invoices.values('invoice_date').annotate(total=Sum('total_amount')).order_by('invoice_date')
        daily_invoice_data = {item['invoice_date']: float(item['total'] or 0) for item in invoice_by_date}
        
        payments = []
        for d in date_range:
            payments.append(daily_invoice_data.get(d, 0))
    
    # Payment method breakdown
    payment_methods = invoices.values('payment_method').annotate(
        total=Sum('total_amount'),
        count=Count('invoice_id')
    )
    
    # --- Check-ins (appointments that were checked in) ---
    checked_in = appointments.filter(status__in=['checked_in', 'completed'])
    
    if period == 'year':
        checkin_by_date = checked_in.annotate(
            period=TruncMonth('date')
        ).values('period').annotate(count=Count('appointment_id')).order_by('period')
        
        monthly_checkin_data = {item['period'].strftime('%Y-%m'): item['count'] for item in checkin_by_date}
        check_ins = []
        current = start_date.replace(day=1)
        while current <= end_date:
            key = current.strftime('%Y-%m')
            check_ins.append(monthly_checkin_data.get(key, 0))
            if current.month == 12:
                current = current.replace(year=current.year + 1, month=1)
            else:
                current = current.replace(month=current.month + 1)
    else:
        checkin_by_date = checked_in.values('date').annotate(count=Count('appointment_id')).order_by('date')
        daily_checkin_data = {item['date']: item['count'] for item in checkin_by_date}
        
        check_ins = []
        for d in date_range:
            check_ins.append(daily_checkin_data.get(d, 0))
    
    return Response({
        'period': period,
        'date_range': {
            'start': start_date.isoformat(),
            'end': end_date.isoformat(),
        },
        'labels': labels,
        'appointments': {
            'data': appointment_counts,
            'total': total_appts,
            'completed': completed,
            'cancelled': cancelled,
            'no_shows': no_shows,
            'completion_rate': round((completed / total_appts * 100) if total_appts > 0 else 0, 1),
        },
        'new_patients': {
            'data': new_patients,
            'total': patients.count(),
        },
        'payments': {
            'data': payments,
            'total': sum(payments),
            'by_method': list(payment_methods),
        },
        'check_ins': {
            'data': check_ins,
            'total': sum(check_ins),
        },
    })


@api_view(['GET'])
def appointments_report(request):
    """
    Detailed appointments report
    Query params:
    - period: week, month, year
    - doctor_id: filter by doctor (optional)
    """
    from datetime import date, timedelta
    from django.db.models import Count, Avg
    from collections import defaultdict
    
    period = request.query_params.get('period', 'week')
    doctor_id = request.query_params.get('doctor_id')
    today = date.today()
    
    # Calculate date range
    if period == 'week':
        start_date = today - timedelta(days=6)
        date_range = [(start_date + timedelta(days=i)) for i in range(7)]
    elif period == 'month':
        start_date = today - timedelta(days=29)
        date_range = [(start_date + timedelta(days=i)) for i in range(30)]
    else:
        start_date = today - timedelta(days=364)
        date_range = None
    
    # Base query
    appointments = Appointment.objects.filter(date__gte=start_date, date__lte=today)
    if doctor_id:
        appointments = appointments.filter(doctor_id=doctor_id)
    
    # Daily/Monthly breakdown
    if period == 'year':
        from django.db.models.functions import TruncMonth
        appt_by_period = appointments.annotate(
            period=TruncMonth('date')
        ).values('period').annotate(count=Count('appointment_id')).order_by('period')
        
        labels = []
        counts = []
        current = start_date.replace(day=1)
        monthly_data = {item['period'].strftime('%Y-%m'): item['count'] for item in appt_by_period}
        while current <= today:
            labels.append(current.strftime('%b'))
            counts.append(monthly_data.get(current.strftime('%Y-%m'), 0))
            if current.month == 12:
                current = current.replace(year=current.year + 1, month=1)
            else:
                current = current.replace(month=current.month + 1)
    else:
        appt_by_date = appointments.values('date').annotate(count=Count('appointment_id')).order_by('date')
        daily_data = {item['date']: item['count'] for item in appt_by_date}
        
        labels = []
        counts = []
        for d in date_range:
            labels.append(d.strftime('%a') if period == 'week' else str(d.day))
            counts.append(daily_data.get(d, 0))
    
    # Status breakdown
    status_breakdown = appointments.values('status').annotate(count=Count('appointment_id'))
    
    # Service type breakdown
    service_breakdown = appointments.values('type').annotate(count=Count('appointment_id')).order_by('-count')[:10]
    
    # Busiest hours
    from django.db.models.functions import ExtractHour
    hourly = appointments.annotate(hour=ExtractHour('time')).values('hour').annotate(count=Count('appointment_id')).order_by('hour')
    
    # Average appointments per day
    total_days = (today - start_date).days + 1
    avg_per_day = round(appointments.count() / total_days, 1) if total_days > 0 else 0
    
    return Response({
        'period': period,
        'labels': labels,
        'data': counts,
        'total': appointments.count(),
        'average_per_day': avg_per_day,
        'status_breakdown': list(status_breakdown),
        'service_breakdown': list(service_breakdown),
        'hourly_distribution': list(hourly),
        'completed': appointments.filter(status='completed').count(),
        'no_shows': appointments.filter(status='cancelled').count(),
    })


@api_view(['GET'])
def inventory_report(request):
    """
    Detailed inventory report
    """
    from django.db.models import Sum
    
    items = InventoryItem.objects.all()
    
    # Basic stats
    total_items = items.count()
    total_quantity = items.aggregate(total=Sum('quantity'))['total'] or 0
    
    # Category breakdown
    category_data = {}
    for item in items:
        cat = item.category or 'Other'
        if cat not in category_data:
            category_data[cat] = {'count': 0, 'quantity': 0, 'items': []}
        category_data[cat]['count'] += 1
        category_data[cat]['quantity'] += item.quantity
        category_data[cat]['items'].append({
            'id': item.item_id,
            'name': item.name,
            'quantity': item.quantity,
            'unit': item.unit,
            'reorder_level': item.min_stock_level,
            'supplier': item.supplier,
            'expiry_date': item.expiry_date.isoformat() if item.expiry_date else None,
            'is_low_stock': item.is_low_stock,
            'is_expiring_soon': item.is_expiring_soon,
        })
    
    # Low stock items
    low_stock = [
        {
            'id': item.item_id,
            'name': item.name,
            'quantity': item.quantity,
            'unit': item.unit,
            'reorder_level': item.min_stock_level,
            'supplier': item.supplier,
        }
        for item in items if item.is_low_stock
    ]
    
    # Expiring soon
    expiring_soon = [
        {
            'id': item.item_id,
            'name': item.name,
            'quantity': item.quantity,
            'unit': item.unit,
            'expiry_date': item.expiry_date.isoformat() if item.expiry_date else None,
        }
        for item in items if item.is_expiring_soon
    ]
    
    # Top stocked items
    top_stocked = items.order_by('-quantity')[:10]
    top_stocked_data = [
        {
            'id': item.item_id,
            'name': item.name,
            'quantity': item.quantity,
            'unit': item.unit,
        }
        for item in top_stocked
    ]
    
    # Recent transactions
    recent_transactions = StockTransaction.objects.all().order_by('-created_at')[:20]
    transactions_data = [
        {
            'id': t.transaction_id,
            'item_name': t.item.name,
            'type': t.transaction_type,
            'quantity': t.quantity,
            'date': t.created_at.isoformat(),
            'performed_by': t.performed_by,
        }
        for t in recent_transactions
    ]
    
    return Response({
        'summary': {
            'total_items': total_items,
            'total_quantity': total_quantity,
            'low_stock_count': len(low_stock),
            'expiring_soon_count': len(expiring_soon),
        },
        'category_breakdown': category_data,
        'low_stock_items': low_stock,
        'expiring_soon_items': expiring_soon,
        'top_stocked_items': top_stocked_data,
        'recent_transactions': transactions_data,
    })


@api_view(['GET'])
def patients_analytics(request):
    """
    Comprehensive patients analytics report
    Query params:
    - period: week, month, year
    Returns:
    - New patients trend
    - Age distribution
    - Gender breakdown
    - Top diagnoses (diseases)
    - Most prescribed medications
    """
    from datetime import date, timedelta
    from django.db.models import Count, Avg
    from django.db.models.functions import TruncMonth
    
    period = request.query_params.get('period', 'week')
    today = date.today()
    
    # Calculate date range
    if period == 'week':
        start_date = today - timedelta(days=6)
        date_range = [(start_date + timedelta(days=i)) for i in range(7)]
    elif period == 'month':
        start_date = today - timedelta(days=29)
        date_range = [(start_date + timedelta(days=i)) for i in range(30)]
    else:  # year
        start_date = today - timedelta(days=364)
        date_range = None
    
    # --- New Patients Trend ---
    patients = Patient.objects.filter(created_at__date__gte=start_date, created_at__date__lte=today)
    
    if period == 'year':
        patient_by_date = patients.annotate(
            period=TruncMonth('created_at')
        ).values('period').annotate(count=Count('patient_id')).order_by('period')
        
        monthly_data = {item['period'].strftime('%Y-%m'): item['count'] for item in patient_by_date}
        labels = []
        new_patients = []
        current = start_date.replace(day=1)
        while current <= today:
            labels.append(current.strftime('%b'))
            key = current.strftime('%Y-%m')
            new_patients.append(monthly_data.get(key, 0))
            if current.month == 12:
                current = current.replace(year=current.year + 1, month=1)
            else:
                current = current.replace(month=current.month + 1)
    else:
        patient_by_date = patients.values('created_at__date').annotate(count=Count('patient_id')).order_by('created_at__date')
        daily_data = {item['created_at__date']: item['count'] for item in patient_by_date}
        
        labels = []
        new_patients = []
        for d in date_range:
            if period == 'week':
                labels.append(d.strftime('%a'))
            else:
                labels.append(str(d.day))
            new_patients.append(daily_data.get(d, 0))
    
    # --- Gender Breakdown ---
    gender_counts = patients.values('gender').annotate(count=Count('patient_id'))
    gender_data = [
        {'gender': g['gender'] or 'Unknown', 'count': g['count']}
        for g in gender_counts
    ]
    
    # --- Age Distribution ---
    # Get all patients with age (not just new ones for broader insight)
    all_patients = Patient.objects.filter(age__isnull=False)
    age_groups = {
        '0-18': 0,
        '19-30': 0,
        '31-45': 0,
        '46-60': 0,
        '60+': 0,
    }
    for p in all_patients:
        if p.age <= 18:
            age_groups['0-18'] += 1
        elif p.age <= 30:
            age_groups['19-30'] += 1
        elif p.age <= 45:
            age_groups['31-45'] += 1
        elif p.age <= 60:
            age_groups['46-60'] += 1
        else:
            age_groups['60+'] += 1
    
    age_data = [{'age_group': k, 'count': v} for k, v in age_groups.items()]
    avg_age = all_patients.aggregate(avg=Avg('age'))['avg'] or 0
    
    # --- Top Diagnoses ---
    # Get diagnoses from medical records in the period
    records = MedicalRecord.objects.filter(date__gte=start_date, date__lte=today).exclude(diagnosis='').exclude(diagnosis__isnull=True)
    
    # Count diagnoses (split by common delimiters and normalize)
    diagnosis_counts = {}
    for record in records:
        # Split diagnosis by common delimiters
        diagnoses = [d.strip() for d in record.diagnosis.replace('\n', ',').replace(';', ',').split(',') if d.strip()]
        for diag in diagnoses:
            # Normalize to lowercase for counting
            key = diag.lower().strip()
            if key:
                diagnosis_counts[key] = diagnosis_counts.get(key, 0) + 1
    
    # Sort and get top 10
    sorted_diagnoses = sorted(diagnosis_counts.items(), key=lambda x: x[1], reverse=True)[:10]
    top_diagnoses = [{'diagnosis': d[0].title(), 'count': d[1]} for d in sorted_diagnoses]
    
    # --- Most Prescribed Medications ---
    prescriptions = Prescription.objects.filter(date__gte=start_date, date__lte=today)
    med_counts = PrescriptionMedication.objects.filter(
        prescription__in=prescriptions
    ).values('medication__name').annotate(count=Count('id')).order_by('-count')[:10]
    
    top_medications = [
        {'medication': m['medication__name'], 'count': m['count']}
        for m in med_counts
    ]
    
    # Also get all-time medication stats for broader insight
    all_time_med_counts = PrescriptionMedication.objects.values(
        'medication__name'
    ).annotate(count=Count('id')).order_by('-count')[:10]
    
    all_time_medications = [
        {'medication': m['medication__name'], 'count': m['count']}
        for m in all_time_med_counts
    ]
    
    # --- Medical History Stats ---
    # Count common conditions from medical_history field
    condition_counts = {}
    for p in Patient.objects.exclude(medical_history='').exclude(medical_history__isnull=True):
        conditions = [c.strip() for c in p.medical_history.replace('\n', ',').replace(';', ',').split(',') if c.strip()]
        for cond in conditions:
            key = cond.lower().strip()
            if key:
                condition_counts[key] = condition_counts.get(key, 0) + 1
    
    sorted_conditions = sorted(condition_counts.items(), key=lambda x: x[1], reverse=True)[:10]
    chronic_conditions = [{'condition': c[0].title(), 'count': c[1]} for c in sorted_conditions]
    
    # --- Allergy Analytics ---
    allergy_counts = PatientAllergy.objects.values(
        'allergy__name'
    ).annotate(count=Count('id')).order_by('-count')[:10]
    
    top_allergies = [
        {'allergy': a['allergy__name'], 'count': a['count']}
        for a in allergy_counts
    ]
    
    # Total patients with allergies
    patients_with_allergies = PatientAllergy.objects.values('patient').distinct().count()
    total_patients = Patient.objects.count()
    allergy_percentage = round((patients_with_allergies / total_patients * 100) if total_patients > 0 else 0, 1)
    
    return Response({
        'period': period,
        'date_range': {
            'start': start_date.isoformat(),
            'end': today.isoformat(),
        },
        'labels': labels,
        'data': new_patients,
        'total': patients.count(),
        'by_gender': gender_data,
        'by_age': age_data,
        'average_age': round(avg_age, 1),
        'top_diagnoses': top_diagnoses,
        'top_medications': top_medications,
        'all_time_medications': all_time_medications,
        'chronic_conditions': chronic_conditions,
        'top_allergies': top_allergies,
        'allergy_stats': {
            'patients_with_allergies': patients_with_allergies,
            'total_patients': total_patients,
            'percentage': allergy_percentage,
        },
    })
