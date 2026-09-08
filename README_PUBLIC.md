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

### Quality and maintainability

- Django backend tests.
- Jest frontend tests.
- Playwright end-to-end testing.
- API smoke testing.
- Modular folder structure with reusable screens, components, and services.

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

**Screenshot placeholder**

```text
docs/screenshots/clinic/01-login.png
```

![Clinic login](docs/screenshots/clinic/01-login.png)

### Doctor dashboard

Presents the doctor's daily workload, key statistics, appointment activity, and
quick access to patient-care actions.

**Screenshot placeholder**

```text
docs/screenshots/clinic/02-doctor-dashboard.png
```

![Doctor dashboard](docs/screenshots/clinic/02-doctor-dashboard.png)

### Today's patients

Shows the patients scheduled for the current day and supports a quick transition
from the appointment list to the patient's clinical record.

**Screenshot placeholder**

```text
docs/screenshots/clinic/03-todays-patients.png
```

![Today's patients](docs/screenshots/clinic/03-todays-patients.png)

### Patient history

Provides a searchable view of previous patients and visits, helping the doctor
understand the patient's care history before a consultation.

**Screenshot placeholder**

```text
docs/screenshots/clinic/04-patient-history.png
```

![Patient history](docs/screenshots/clinic/04-patient-history.png)

### Patient profile

Combines patient demographics, contact information, clinical background, and
visit-related information in one accessible profile.

**Screenshot placeholder**

```text
docs/screenshots/clinic/05-patient-profile.png
```

![Patient profile](docs/screenshots/clinic/05-patient-profile.png)

### Diagnosis and prescription

Gives the doctor a structured workspace for recording diagnosis details, notes,
medications, dosage instructions, and prescription information.

**Screenshot placeholder**

```text
docs/screenshots/clinic/06-diagnosis.png
```

![Diagnosis and prescription](docs/screenshots/clinic/06-diagnosis.png)

### Prescription scanning

Supports prescription scanning and review as part of a more efficient medication
workflow.

**Screenshot placeholder**

```text
docs/screenshots/clinic/07-prescription-scanner.png
```

![Prescription scanner](docs/screenshots/clinic/07-prescription-scanner.png)

### Reception dashboard

Gives the reception team an operational overview of appointments, patients,
payments, and the day's priorities.

**Screenshot placeholder**

```text
docs/screenshots/clinic/08-reception-dashboard.png
```

![Reception dashboard](docs/screenshots/clinic/08-reception-dashboard.png)

### Patient directory and registration

Supports patient search, profile creation, and controlled updates to patient
information.

**Screenshot placeholder**

```text
docs/screenshots/clinic/09-patient-directory.png
```

![Patient directory](docs/screenshots/clinic/09-patient-directory.png)

### Appointment booking

Allows reception staff to select a patient, doctor, date, and appointment details
while keeping scheduling information organized.

**Screenshot placeholder**

```text
docs/screenshots/clinic/10-book-appointment.png
```

![Appointment booking](docs/screenshots/clinic/10-book-appointment.png)

### Payments and insurance

Centralizes payment tracking and insurance details so reception staff can follow
financial status alongside clinical appointments.

**Screenshot placeholder**

```text
docs/screenshots/clinic/11-payments-insurance.png
```

![Payments and insurance](docs/screenshots/clinic/11-payments-insurance.png)

### Clinic inventory

Displays medicine stock information and supports better awareness of available
clinical supplies.

**Screenshot placeholder**

```text
docs/screenshots/clinic/12-inventory.png
```

![Clinic inventory](docs/screenshots/clinic/12-inventory.png)

### Clinic reports

Provides management views for appointments, revenue, doctor income, and inventory
activity.

**Screenshot placeholder**

```text
docs/screenshots/clinic/13-reports.png
```

![Clinic reports](docs/screenshots/clinic/13-reports.png)

---

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

**Screenshot placeholder**

```text
docs/screenshots/laboratory/01-login.png
```

![Laboratory login](docs/screenshots/laboratory/01-login.png)

### Reception dashboard

Summarizes appointments, active orders, payments, and front-desk actions for the
day.

**Screenshot placeholder**

```text
docs/screenshots/laboratory/02-reception-dashboard.png
```

![Laboratory reception dashboard](docs/screenshots/laboratory/02-reception-dashboard.png)

### Patient directory and EMR

Lets staff search for a patient and open a consolidated record containing history,
appointments, orders, results, and reports.

**Screenshot placeholder**

```text
docs/screenshots/laboratory/03-patient-emr.png
```

![Patient EMR](docs/screenshots/laboratory/03-patient-emr.png)

### Order creation

Creates laboratory or radiology orders and connects them to the patient and
appointment workflow.

**Screenshot placeholder**

```text
docs/screenshots/laboratory/04-create-order.png
```

![Order creation](docs/screenshots/laboratory/04-create-order.png)

### Orders workspace

Tracks the order lifecycle from waiting and in progress to completed or cancelled.

**Screenshot placeholder**

```text
docs/screenshots/laboratory/05-orders.png
```

![Laboratory orders](docs/screenshots/laboratory/05-orders.png)

### Sample collection

Records specimen details and supports barcode-based identification for safer,
more traceable processing.

**Screenshot placeholder**

```text
docs/screenshots/laboratory/06-sample-collection.png
```

![Sample collection](docs/screenshots/laboratory/06-sample-collection.png)

### Laboratory technician dashboard

Shows the technician's active queue, pending actions, and high-priority work.

**Screenshot placeholder**

```text
docs/screenshots/laboratory/07-technician-dashboard.png
```

![Technician dashboard](docs/screenshots/laboratory/07-technician-dashboard.png)

### Test selection and lab test processing

Helps technicians select the required tests, review order details, and progress
each test through the laboratory workflow.

**Screenshot placeholder**

```text
docs/screenshots/laboratory/08-test-processing.png
```

![Test processing](docs/screenshots/laboratory/08-test-processing.png)

### Results dashboard

Provides a clear queue of pending, active, and completed laboratory results.

**Screenshot placeholder**

```text
docs/screenshots/laboratory/09-results-dashboard.png
```

![Results dashboard](docs/screenshots/laboratory/09-results-dashboard.png)

### Results entry

Supports structured entry of measurements, reference ranges, units, comments,
and critical-value indicators.

**Screenshot placeholder**

```text
docs/screenshots/laboratory/10-results-entry.png
```

![Results entry](docs/screenshots/laboratory/10-results-entry.png)

### Radiology order and DICOM viewer

Provides a radiology workspace for reviewing imaging studies with controls such
as zoom, pan, windowing, brightness, contrast, slice navigation, comparison, and
annotations.

**Screenshot placeholder**

```text
docs/screenshots/laboratory/11-radiology-viewer.png
```

![Radiology viewer](docs/screenshots/laboratory/11-radiology-viewer.png)

### Radiology report

Captures structured findings, modality details, body part, laterality, severity,
and follow-up recommendations.

**Screenshot placeholder**

```text
docs/screenshots/laboratory/12-radiology-report.png
```

![Radiology report](docs/screenshots/laboratory/12-radiology-report.png)

### Laboratory inventory

Displays stock levels, expiry information, minimum quantities, suppliers, and
inventory activity.

**Screenshot placeholder**

```text
docs/screenshots/laboratory/13-inventory.png
```

![Laboratory inventory](docs/screenshots/laboratory/13-inventory.png)

### Inventory alerts and procurement

Highlights low-stock and expired items and supports supplier, order-request,
purchase, and receiving workflows.

**Screenshot placeholder**

```text
docs/screenshots/laboratory/14-inventory-alerts.png
```

![Inventory alerts](docs/screenshots/laboratory/14-inventory-alerts.png)

### Billing and payments

Connects patient orders to invoices, payment status, insurance providers, and
discount calculations.

**Screenshot placeholder**

```text
docs/screenshots/laboratory/15-billing.png
```

![Laboratory billing](docs/screenshots/laboratory/15-billing.png)

### Laboratory reports

Provides operational and financial visibility through test-volume, revenue, and
inventory reporting.

**Screenshot placeholder**

```text
docs/screenshots/laboratory/16-reports.png
```

![Laboratory reports](docs/screenshots/laboratory/16-reports.png)

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

### Inventory clerk

Manages products, quantities, suppliers, purchasing, receipts, and stock movement.

### Cashier

Manages invoices, payment status, and billing operations.

### Doctor and receptionist

Support clinic-facing prescription, patient, and medication workflows.

### Administrator

Maintains the pharmacy system and its operational configuration.

## Pharmacy page catalogue

### Login

Provides a role-aware entry point for pharmacy staff.

**Screenshot placeholder**

```text
docs/screenshots/pharmacy/01-login.png
```

![Pharmacy login](docs/screenshots/pharmacy/01-login.png)

### Pharmacy dashboard

Summarizes orders, inventory, low-stock alerts, invoices, and key operational
indicators.

**Screenshot placeholder**

```text
docs/screenshots/pharmacy/02-dashboard.png
```

![Pharmacy dashboard](docs/screenshots/pharmacy/02-dashboard.png)

### Inventory workspace

Provides a focused view for searching medicines, reviewing quantities, and
managing stock information.

**Screenshot placeholder**

```text
docs/screenshots/pharmacy/03-inventory.png
```

![Pharmacy inventory](docs/screenshots/pharmacy/03-inventory.png)

### Products and medicine catalogue

Organizes medicine names, SKUs, quantities, stock thresholds, and product details
for daily pharmacy operations.

**Screenshot placeholder**

```text
docs/screenshots/pharmacy/04-products.png
```

![Medicine products](docs/screenshots/pharmacy/04-products.png)

### Low-stock alerts

Highlights products that require replenishment before they affect service
availability.

**Screenshot placeholder**

```text
docs/screenshots/pharmacy/05-low-stock-alerts.png
```

![Low-stock alerts](docs/screenshots/pharmacy/05-low-stock-alerts.png)

### Suppliers and procurement

Manages supplier contacts and supports purchase order workflows for reliable
medicine replenishment.

**Screenshot placeholder**

```text
docs/screenshots/pharmacy/06-suppliers-procurement.png
```

![Suppliers and procurement](docs/screenshots/pharmacy/06-suppliers-procurement.png)

### Goods receipts

Records delivered medicines, received quantities, lot information, and receiving
status.

**Screenshot placeholder**

```text
docs/screenshots/pharmacy/07-goods-receipts.png
```

![Goods receipts](docs/screenshots/pharmacy/07-goods-receipts.png)

### Pharmacy orders

Tracks prescription and clinic medication requests from creation through pharmacy
processing.

**Screenshot placeholder**

```text
docs/screenshots/pharmacy/08-pharmacy-orders.png
```

![Pharmacy orders](docs/screenshots/pharmacy/08-pharmacy-orders.png)

### Billing workspace

Provides invoice visibility and supports patient-facing pharmacy payment
operations.

**Screenshot placeholder**

```text
docs/screenshots/pharmacy/09-billing.png
```

![Pharmacy billing](docs/screenshots/pharmacy/09-billing.png)

### Doctor dashboard

Shows doctor-related prescription and medication activity connected to the
pharmacy workflow.

**Screenshot placeholder**

```text
docs/screenshots/pharmacy/10-doctor-dashboard.png
```

![Pharmacy doctor dashboard](docs/screenshots/pharmacy/10-doctor-dashboard.png)

### Reception dashboard

Supports reception-facing patient and medication coordination.

**Screenshot placeholder**

```text
docs/screenshots/pharmacy/11-reception-dashboard.png
```

![Pharmacy reception dashboard](docs/screenshots/pharmacy/11-reception-dashboard.png)

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

## Data Protection and Public Release

This public presentation is intended for portfolio review. Any released demo
data should be fictional or fully anonymized.

Before publishing screenshots or source code, confirm that:

- No private credential, secret, API key, or environment value is visible.
- No real patient name, phone number, email, address, or medical record is shown.
- No private DICOM study or identifiable medical image is included.
- No local database containing user or patient records is published.
- Development secrets are stored outside the repository.
- Public screenshots use realistic but fictional demonstration content.

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

## Portfolio Note

This project demonstrates product thinking as well as software implementation:
clear user roles, practical workflows, healthcare-specific data structures,
integration boundaries, and interfaces designed around real operational needs.

Add a project license before public publication.
