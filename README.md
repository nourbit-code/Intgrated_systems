# Integrated Healthcare Operations Platform

## A connected digital solution for clinic, laboratory, and pharmacy operations

This portfolio project demonstrates a modular healthcare platform designed to
connect the main operational areas of a modern medical organization:

- Patient and clinic administration
- Dermatology consultation and clinical documentation
- Laboratory testing and result management
- Radiology and medical-image review
- Pharmacy inventory and dispensing workflows
- Billing, payments, procurement, and reporting

The platform is presented as three focused products that can operate separately
or work together through REST APIs and shared business workflows.

> This public document contains no private credentials, secrets, database details,
> patient data, or deployment instructions.

---

## Product Vision

Healthcare teams often work across disconnected tools. This platform brings
clinical, laboratory, pharmacy, and administrative work into organized role-based
experiences.

The solution is designed to help an organization:

- Reduce paper-based and repetitive processes.
- Improve visibility from patient registration to completed care.
- Give every team member the right information for their role.
- Track orders, results, inventory, and payments in one workflow.
- Improve operational control through dashboards and reports.
- Create a foundation for future integrations and production deployment.

---

## Value for an Organization

### Better patient coordination

Patient profiles, appointments, clinical notes, laboratory orders, prescriptions,
and reports are organized around the patient journey.

### Faster daily operations

Search, filters, status tracking, barcode support, reusable forms, and dashboard
summaries reduce the time required for routine work.

### Stronger operational visibility

Managers can monitor appointments, test volumes, revenue, inventory levels,
low-stock alerts, suppliers, and payment status.

### Scalable architecture

The three products have clear responsibilities and API boundaries. This makes it
possible to improve or deploy each area independently while preserving integration
options.

---

## Technology Stack

### Frontend

- React Native for cross-platform application development.
- Expo for web, Android, and iOS development workflows.
- Expo Router for structured, role-based navigation.
- TypeScript and JavaScript for application logic.
- Responsive dashboard layouts and reusable interface components.
- React Native Web for browser-based access.

### Backend

- Python for backend services.
- Django for application structure, security, and administration.
- Django REST Framework for RESTful APIs.
- Role-based permissions and authenticated workflows.
- Session and CSRF protection for applicable web interactions.

### Data and integration

- SQLite for local demonstration environments.
- Relational domain models for patients, appointments, orders, inventory,
  prescriptions, results, suppliers, and invoices.
- JSON-based REST communication between frontends and backends.
- FHIR-style medication resources in the pharmacy integration layer.

### Healthcare and document capabilities

- DICOM parsing and radiology image viewing.
- Barcode generation for sample and order workflows.
- Print-ready reports, invoices, and clinical documents.
- Structured results with reference ranges and critical-value indicators.


---

## Platform Architecture

```text
Clinic and Dermatology
    ├── Patient records
    ├── Appointments
    ├── Diagnoses and prescriptions
    └── Clinic reports

AlphaLab Laboratory
    ├── Patients and appointments
    ├── Lab and radiology orders
    ├── Samples and results
    ├── Laboratory inventory
    └── Billing and reports

Pharmacy Management
    ├── Medicines and inventory
    ├── Suppliers and purchasing
    ├── Pharmacy orders
    ├── Stock alerts
    └── Invoices and billing
```

The systems are intentionally separated into clear product areas. This supports
independent ownership by clinic, laboratory, and pharmacy teams while allowing
future service-to-service communication.

---

# 1. Clinic and Dermatology Management

## Product description

The clinic system is a clinical and administrative workspace for dermatology and
general clinic operations. It helps doctors focus on patient care while giving
receptionists the tools needed to coordinate appointments, patient records,
payments, and daily activity.

## Business capabilities

- Central patient directory.
- Patient history and visit review.
- Appointment booking and scheduling.
- Doctor dashboard and daily patient list.
- Diagnosis and medical-note entry.
- Prescription and medication selection.
- Clinic inventory monitoring.
- Payment and insurance tracking.
- Doctor income, revenue, appointment, and inventory reporting.

## User roles

### Doctor

The doctor can review the daily schedule, open patient history, document
diagnoses, create prescriptions, and review clinical and financial reports.

### Receptionist

The receptionist can register patients, update patient details, book appointments,
manage payments, review insurance information, and monitor clinic activity.

## Clinic page catalogue

### Login

Provides a clear entry point for authorized clinic staff and directs users to the
appropriate doctor or receptionist workspace.

<img width="1801" height="895" alt="image" src="https://github.com/user-attachments/assets/df8d1576-a578-43bd-b2dc-da855b8f000c" />




### Doctor dashboard

Presents the doctor's daily workload, key statistics, appointment activity, and
quick access to patient-care actions.

<img width="1801" height="892" alt="image" src="https://github.com/user-attachments/assets/0cf9dff7-e4b7-4b78-a465-29c62af86380" />


### Today's patients

Shows the patients scheduled for the current day and supports a quick transition
from the appointment list to the patient's clinical record.

<img width="1787" height="892" alt="image" src="https://github.com/user-attachments/assets/efc6b811-1feb-4b33-a8e4-e130c9e42585" />

### Patient history

Provides a searchable view of previous patients and visits, helping the doctor
understand the patient's care history before a consultation.

<img width="1802" height="900" alt="image" src="https://github.com/user-attachments/assets/40d86111-ecb9-4e00-b8ed-6e45767d3835" />

### Patient profile

Combines patient demographics, contact information, clinical background, and
visit-related information in one accessible profile.

<img width="1803" height="901" alt="image" src="https://github.com/user-attachments/assets/fb973233-069a-4d5e-902d-0adb2d92f4d0" />

### Diagnosis and prescription

Gives the doctor a structured workspace for recording diagnosis details, notes,
medications, dosage instructions, and prescription information.

<img width="1788" height="900" alt="image" src="https://github.com/user-attachments/assets/0ea58d52-e36f-4114-a8aa-2766288113bb" />

### Prescription QR 

Supports prescription scanning and review as part of a more efficient medication
workflow.

<img width="1787" height="902" alt="image" src="https://github.com/user-attachments/assets/46fa5ac3-f9f3-4cc2-a6bf-db78e98c0fd2" />

### Reception dashboard

Gives the reception team an operational overview of appointments, patients,
payments, and the day's priorities.

<img width="1787" height="905" alt="image" src="https://github.com/user-attachments/assets/13b6be69-b5c4-4ac1-b1d2-7bd992853710" />

### Patient directory and registration

Supports patient search, profile creation, and controlled updates to patient
information.

<img width="1802" height="895" alt="image" src="https://github.com/user-attachments/assets/01958cb7-b170-441b-8c00-d0ca5f883962" />

### Appointment booking

Allows reception staff to select a patient, doctor, date, and appointment details
while keeping scheduling information organized.

<img width="1797" height="892" alt="image" src="https://github.com/user-attachments/assets/d19bc190-7e70-49d9-a40f-ef60129b4365" />


### Payments and insurance

Centralizes payment tracking and insurance details so reception staff can follow
financial status alongside clinical appointments.

<img width="1748" height="892" alt="image" src="https://github.com/user-attachments/assets/841c99c7-5785-432a-a5f8-8858bb8f14a7" />


### Clinic inventory

Displays medicine stock information and supports better awareness of available
clinical supplies.
<img width="1740" height="892" alt="image" src="https://github.com/user-attachments/assets/8e15ba62-34e3-4051-b06a-093da9ff4807" />

<img width="1782" height="893" alt="image" src="https://github.com/user-attachments/assets/8404da85-ba29-4963-ad48-b09a9755c7ea" />

### Clinic reports

Provides management views for appointments, revenue, doctor income, and inventory
activity.

<img width="1807" height="911" alt="image" src="https://github.com/user-attachments/assets/9cc483f4-0b57-4dcf-ae3e-cc3cd27fea65" />


# 2. AlphaLab Laboratory Management

## Product description

AlphaLab is an end-to-end laboratory operations platform. It connects reception,
laboratory technicians, radiology, inventory, billing, patient records, and
reporting in one workflow.

## Business capabilities

- Patient and appointment management.
- Laboratory and radiology order creation.
- Sample collection and barcode labels.
- Test selection and processing queues.
- Single and multi-parameter result entry.
- Critical-result and reference-range support.
- DICOM image viewing and radiology reporting.
- Inventory, suppliers, purchasing, and stock transactions.
- Billing, insurance discounts, and payment tracking.
- Daily, weekly, revenue, and inventory reports.
- Activity logs and traceable operational actions.

## User roles

### Receptionist

Manages patients, appointments, orders, billing, insurance, and front-desk
operations.

### Laboratory technician

Manages samples, tests, results, radiology studies, inventory, and technician
work queues.

## Laboratory page catalogue

### Login

Provides controlled access to the laboratory workspaces and routes each staff
member to the correct role-based experience.

<img width="1787" height="882" alt="image" src="https://github.com/user-attachments/assets/0464347d-3655-43c6-9ed2-3272ff60c18b" />


### Reception dashboard

Summarizes appointments, active orders, payments, and front-desk actions for the
day.

<img width="1785" height="897" alt="image" src="https://github.com/user-attachments/assets/7d5b1cc9-1d0c-4f53-a949-5a8db1ff1e84" />


### Patient directory and EMR

Lets staff search for a patient and open a consolidated record containing history,
appointments, orders, results, and reports.

<img width="1761" height="887" alt="image" src="https://github.com/user-attachments/assets/c7b569dc-6a2d-4660-b977-8dad9e29542a" />
<img width="1756" height="891" alt="image" src="https://github.com/user-attachments/assets/50f963c8-d4ef-4489-866f-bb8b75f57540" />



### Order creation

Creates laboratory or radiology orders and connects them to the patient and
appointment workflow.

<img width="1798" height="882" alt="image" src="https://github.com/user-attachments/assets/7349a430-0114-43dd-baa7-491b2e115a16" />
<img width="1750" height="900" alt="image" src="https://github.com/user-attachments/assets/8cacc13f-4fec-4234-a7c0-18b10740d925" />



### Orders workspace

Tracks the order lifecycle from waiting and in progress to completed or cancelled.

<img width="1750" height="887" alt="image" src="https://github.com/user-attachments/assets/057e0ac4-870b-4a34-aea4-8297c491912c" />

### Sample collection

Records specimen details and supports barcode-based identification for safer,
more traceable processing.

<img width="1752" height="901" alt="image" src="https://github.com/user-attachments/assets/d990c17c-4730-425d-906a-ef221df9a50b" />


### Laboratory technician dashboard

Shows the technician's active queue, pending actions, and high-priority work.

<img width="1767" height="898" alt="image" src="https://github.com/user-attachments/assets/6ce117a1-858f-4742-9c5f-4b25d7917078" />


### Test selection and lab test processing

Helps technicians select the required tests, review order details, and progress
each test through the laboratory workflow.

<img width="1787" height="887" alt="image" src="https://github.com/user-attachments/assets/e7705f76-c2be-419d-ba04-69aa5c66b8cf" />



### Results entry

Supports structured entry of measurements, reference ranges, units, comments,
and critical-value indicators.

<img width="1781" height="896" alt="image" src="https://github.com/user-attachments/assets/4d1d92c3-a392-476d-a624-3900578d2a7a" />

### Radiology order and DICOM viewer

Provides a radiology workspace for reviewing imaging studies with controls such
as zoom, pan, windowing, brightness, contrast, slice navigation, comparison, and
annotations.

<img width="1761" height="898" alt="image" src="https://github.com/user-attachments/assets/323b5aef-475c-49b2-9ad0-cfdf8e78dd86" />

### Laboratory inventory

Displays stock levels, expiry information, minimum quantities, suppliers, and
inventory activity.
<img width="1765" height="901" alt="image" src="https://github.com/user-attachments/assets/bc0f1e3d-20fe-41a4-9fae-718bccef402e" />

### Billing and payments

Connects patient orders to invoices, payment status, insurance providers, and
discount calculations.
<img width="1781" height="891" alt="image" src="https://github.com/user-attachments/assets/73904a8c-7a80-4520-ab9b-e1e19db73457" />


---

# 3. Pharmacy Management

## Product description

The pharmacy system manages the medicine supply chain from product setup and
procurement to inventory control, prescription fulfillment, clinic requests, and
patient billing.

## Business capabilities

- Medicine product catalogue and SKU management.
- Current stock and stock-threshold monitoring.
- Low-stock alerts.
- Supplier management.
- Purchase order creation and tracking.
- Goods receiving and lot information.
- Pharmacy and clinic medication orders.
- Prescription-linked workflows.
- Invoices and billing.
- Role-based pharmacy dashboards.
- REST and FHIR-style integration endpoints.

## User roles

### Pharmacist

Reviews medication requests, prescriptions, pharmacy orders, and dispensing
activity.


## Pharmacy page catalogue

### Login

Provides a role-aware entry point for pharmacy staff.

<img width="1797" height="876" alt="image" src="https://github.com/user-attachments/assets/ae085ce0-9ab4-4b97-a577-f20e6ffe1f6f" />

### Pharmacy dashboard

Summarizes orders, inventory, low-stock alerts, invoices, and key operational
indicators.

<img width="1758" height="892" alt="image" src="https://github.com/user-attachments/assets/8fc04c1d-d123-4633-903a-28fd4c90a7dc" />


### Inventory workspace

Provides a focused view for searching medicines, reviewing quantities, and
managing stock information.

<img width="1800" height="895" alt="image" src="https://github.com/user-attachments/assets/f7613209-fad6-4bc0-8578-dc83fe25ecbb" />

### Low-stock alerts

Highlights products that require replenishment before they affect service
availability.

<img width="1067" height="782" alt="image" src="https://github.com/user-attachments/assets/57ad7d68-8cac-4b9f-a57f-116a7f661d6a" />


### Pharmacy orders

Tracks prescription and clinic medication requests from creation through pharmacy
processing.

<img width="1767" height="898" alt="image" src="https://github.com/user-attachments/assets/f417b316-2058-45a8-ad6f-ae4d64ddb738" />

### Billing workspace

Provides invoice visibility and supports patient-facing pharmacy payment
operations.

<img width="1791" height="881" alt="image" src="https://github.com/user-attachments/assets/8d88a9bf-994c-41f0-b2f9-5eadce05679f" />



---

## Integration Story

The products are designed to support a complete operational flow:

```text
Clinic consultation
        ↓
Diagnosis and prescription
        ↓
Laboratory order and/or pharmacy order
        ↓
Sample processing or medication fulfillment
        ↓
Results, dispensing, billing, and reporting
```

Integration points include:

- Patient and appointment references.
- Prescription-to-pharmacy-order workflows.
- Laboratory order and result references.
- Inventory consumption and replenishment.
- Billing records connected to services and orders.
- REST APIs for controlled future integrations.
- FHIR-style medication request and dispense resources.

---



---

## Future Product Direction

Potential production improvements include:

- Cloud deployment with staging and production environments.
- PostgreSQL or another production database.
- Central identity management and single sign-on.
- Expanded audit trails and monitoring.
- Automated backups and disaster recovery.
- Secure external laboratory and pharmacy integrations.
- Advanced analytics and management dashboards.
- Accessibility improvements and multilingual support.

---

Add a project license before public publication.
