# FHIR clinic-to-pharmacy prescription flow

This backend already had a clinic-to-pharmacy prescription workflow:

1. The clinic creates a local `Prescription`.
2. `clinic.signals.create_pharmacy_order` automatically creates a linked `PharmacyOrder`.
3. The pharmacy prepares the order, reserves stock, creates the invoice, and marks it dispensed.

The FHIR layer added here wraps that existing workflow with FHIR R4 resources instead of replacing it.

## Inbound from the dermatology clinic

`POST /fhir/MedicationRequest/$import/`

Accepts either a FHIR R4 `MedicationRequest` or a `Bundle` containing one or more `MedicationRequest` resources. A request can include contained `Patient` and `Practitioner` resources, or can use `subject.display` and `requester.display`.

Each imported `MedicationRequest` creates or updates:

- `Patient`
- `Doctor`
- `MedicalRecord`
- `Prescription`
- linked `PharmacyOrder`

`MedicationRequest.identifier.system` and `MedicationRequest.identifier.value` are stored on the local prescription as the external identity, so repeated clinic submissions update the same prescription instead of creating duplicates.

## Outbound back to the clinic

`GET /fhir/MedicationRequest/`

Returns local prescriptions as FHIR R4 `MedicationRequest` resources.

`GET /fhir/MedicationRequest/{prescription_id}/`

Returns one prescription as a FHIR R4 `MedicationRequest`.

`GET /fhir/MedicationDispense/`

Returns pharmacy orders as FHIR R4 `MedicationDispense` resources. Use `?prescription={prescription_id}` to filter by the local prescription.

`GET /fhir/MedicationDispense/{order_id}/`

Returns one pharmacy order status as a FHIR R4 `MedicationDispense`.

Status mapping:

- `New` and `Preparing` -> `preparation`
- `Ready` -> `in-progress`
- `Dispensed` -> `completed`
- `Cancelled` -> `cancelled`

All FHIR endpoints use the same token authentication as the rest of the API.
