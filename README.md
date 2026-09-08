# Integrated Healthcare Systems

An integrated healthcare software portfolio project made of three connected systems:

1. **Clinic and Dermatology Management**
2. **AlphaLab Laboratory Management**
3. **Pharmacy Management**

Together, the systems support the complete patient journey: registration, appointment
booking, clinical consultation, laboratory testing, prescriptions, inventory, billing,
and reporting.

> **Portfolio note:** This repository contains local demo credentials for development.
> Replace them and remove them from public documentation before deploying or publishing
> the project.

---

## Project Overview

The project is designed as a modular healthcare platform. Each system has its own
frontend and Django backend, database, and role-based workflows. The systems can run
independently, while the clinic, laboratory, and pharmacy APIs provide integration
points for sharing patient, order, prescription, inventory, and billing information.

### Main goals

- Reduce manual work in healthcare administration.
- Keep patient and operational data organized.
- Give each staff role a focused workspace.
- Track orders and status changes from creation to completion.
- Provide clear inventory, billing, and performance reports.
- Support future integration with production databases and external services.

---

## Technology Stack

| Area | Technologies |
| --- | --- |
| Mobile and web UI | React Native, Expo, Expo Router |
| Frontend language | TypeScript and JavaScript |
| Backend | Python, Django, Django REST Framework |
| Database | SQLite for local development |
| API style | REST APIs with JSON responses |
| Authentication | Django authentication, session/CSRF protection, and role-based access |
| Laboratory imaging | DICOM parsing and radiology viewer tools |
| Documents | PDF, print, invoice, and report generation |
| Testing | Django tests, Jest, and Playwright |

---

## Repository Structure

```text
.
├── backend-1/                         # Clinic Django backend
├── DermaSkincareApp/                 # Clinic and dermatology Expo frontend
├── lab_system-main/
│   ├── backend/                       # Laboratory Django backend
│   └── frontend/                      # Laboratory Expo frontend
├── pharmacy-management-system-main/
│   ├── backend/                       # Pharmacy Django backend
│   └── frontend/                      # Pharmacy Expo frontend
├── AUTHENTICATION_SETUP.md            # Clinic authentication notes
└── README.md
```

---

# System 1: Clinic and Dermatology Management

The clinic system helps doctors and receptionists manage patient care and daily
clinic operations. It includes role-based dashboards, patient records, appointments,
diagnosis, prescriptions, payments, inventory, and management reports.

## Clinic roles

### Doctor

- View the doctor dashboard and today's patients.
- Open a patient's history and previous visits.
- Record diagnoses and medical notes.
- Create prescriptions and select medications.
- Review appointments, income, and inventory reports.
- Scan prescription information when needed.

### Receptionist

- Register and edit patient profiles.
- Search the patient directory.
- Book and manage appointments.
- Track payments and insurance information.
- Review appointment and inventory reports.
- Manage receptionist settings.

## Clinic pages and screenshot placeholders

Add screenshots to a portfolio `docs/screenshots/clinic/` folder and replace the
placeholders below with image links.

| Page | Description | Screenshot |
| --- | --- | --- |
| Login | Secure entry point for doctors and receptionists. | `<!-- Screenshot: clinic-login.png -->` |
| Doctor dashboard | Shows daily activity, appointments, and key statistics. | `<!-- Screenshot: doctor-dashboard.png -->` |
| Today's patients | Lists patients scheduled for the current day. | `<!-- Screenshot: todays-patients.png -->` |
| Patient history | Searches and reviews previous patient visits. | `<!-- Screenshot: patient-history.png -->` |
| Patient profile | Displays the patient's demographic and clinical information. | `<!-- Screenshot: patient-profile.png -->` |
| Diagnosis | Records diagnosis, notes, medications, and prescriptions. | `<!-- Screenshot: diagnosis.png -->` |
| Prescription scanner | Supports prescription scanning and review. | `<!-- Screenshot: prescription-scanner.png -->` |
| Reception dashboard | Gives reception staff an overview of clinic activity. | `<!-- Screenshot: reception-dashboard.png -->` |
| Patient directory | Provides searchable patient records. | `<!-- Screenshot: patient-directory.png -->` |
| Add patient | Creates a new patient record. | `<!-- Screenshot: add-patient.png -->` |
| Book appointment | Books an appointment with a doctor. | `<!-- Screenshot: book-appointment.png -->` |
| Payments | Tracks patient payment status and transactions. | `<!-- Screenshot: clinic-payments.png -->` |
| Insurance | Stores insurance information used in billing workflows. | `<!-- Screenshot: clinic-insurance.png -->` |
| Clinic inventory | Displays medicines and stock levels. | `<!-- Screenshot: clinic-inventory.png -->` |
| Reports | Displays appointment, revenue, doctor income, and inventory reports. | `<!-- Screenshot: clinic-reports.png -->` |

## Clinic API

The clinic backend exposes endpoints for authentication and core clinical data,
including:

- `/api/login/`
- `/api/doctors/`
- `/api/receptionists/`
- `/api/patients/`
- `/api/appointments/`
- `/api/medical-records/`
- `/api/prescriptions/`
- `/api/inventory/`
- `/api/payments/`

## Clinic local admin access

```text
URL:      http://127.0.0.1:8000/admin/
Username: clinicadmin
Password: ChangeMe123!
```

---

# System 2: AlphaLab Laboratory Management

AlphaLab manages the complete laboratory workflow from patient registration and
test ordering to sample collection, analysis, result approval, radiology reporting,
billing, inventory, and analytics.

## Laboratory roles

### Receptionist

- Register patients and manage appointments.
- Create lab and scan orders.
- Manage billing, insurance, and payments.
- View patients, orders, and operational reports.

### Lab technician

- Review the work queue and test orders.
- Collect samples and print barcode labels.
- Enter single and multi-parameter results.
- Run quality-control steps.
- Upload and report radiology studies.
- Manage laboratory inventory and suppliers.

## Laboratory workflow

```text
Patient registration
        ↓
Appointment and order creation
        ↓
Sample collection and barcode labeling
        ↓
Laboratory test or radiology workflow
        ↓
Result entry and quality checks
        ↓
Result approval and patient report
        ↓
Billing, payment, and reporting
```

## Laboratory pages and screenshot placeholders

| Page | Description | Screenshot |
| --- | --- | --- |
| Login | Authenticates laboratory staff and selects the correct role workspace. | `<!-- Screenshot: lab-login.png -->` |
| Reception dashboard | Shows appointments, orders, payments, and daily activity. | `<!-- Screenshot: lab-reception-dashboard.png -->` |
| Add patient | Creates a patient record with contact and insurance details. | `<!-- Screenshot: lab-add-patient.png -->` |
| Patient directory | Searches patients and opens their records. | `<!-- Screenshot: lab-patient-directory.png -->` |
| Patient EMR | Combines patient history, orders, results, and reports in one view. | `<!-- Screenshot: lab-patient-emr.png -->` |
| Create order | Creates laboratory or radiology orders for a patient. | `<!-- Screenshot: lab-create-order.png -->` |
| Orders | Tracks order status from waiting to completed or cancelled. | `<!-- Screenshot: lab-orders.png -->` |
| Sample collection | Records specimens and supports barcode label printing. | `<!-- Screenshot: sample-collection.png -->` |
| Lab technician dashboard | Shows the technician queue and active work. | `<!-- Screenshot: lab-tech-dashboard.png -->` |
| Test selection | Selects tests and prepares them for processing. | `<!-- Screenshot: test-selection.png -->` |
| Lab test page | Records test execution details and status. | `<!-- Screenshot: lab-test.png -->` |
| Results dashboard | Lists pending, active, and completed results. | `<!-- Screenshot: results-dashboard.png -->` |
| Results entry | Enters and validates laboratory measurements. | `<!-- Screenshot: results-entry.png -->` |
| Multi-result entry | Enters multiple analytes and reference ranges together. | `<!-- Screenshot: results-multi.png -->` |
| Completed tests | Reviews completed tests and final results. | `<!-- Screenshot: completed-tests.png -->` |
| Radiology orders | Lists radiology studies waiting for processing. | `<!-- Screenshot: radiology-orders.png -->` |
| Radiology viewer | Views DICOM studies with zoom, pan, windowing, and slice controls. | `<!-- Screenshot: radiology-viewer.png -->` |
| Radiology report | Enters structured findings and follow-up recommendations. | `<!-- Screenshot: radiology-report.png -->` |
| Inventory dashboard | Shows stock quantities, expiry, and low-stock information. | `<!-- Screenshot: lab-inventory-dashboard.png -->` |
| Inventory items | Manages laboratory materials and supplies. | `<!-- Screenshot: inventory-items.png -->` |
| Inventory alerts | Lists low-stock and expired items. | `<!-- Screenshot: inventory-alerts.png -->` |
| Suppliers | Stores supplier records and purchasing information. | `<!-- Screenshot: suppliers.png -->` |
| Stock transactions | Audits stock additions, usage, adjustments, and expiry. | `<!-- Screenshot: stock-transactions.png -->` |
| Billing | Creates invoices and tracks payments. | `<!-- Screenshot: lab-billing.png -->` |
| Reports | Shows tests, revenue, inventory, and operational reports. | `<!-- Screenshot: lab-reports.png -->` |

## Laboratory API

The laboratory API is organized under `/api/v1/` and includes endpoints for:

- Authentication and current-user information.
- Patients, appointments, and patient EMR data.
- Laboratory and radiology orders.
- Samples, tests, results, and reports.
- Inventory, suppliers, purchase requests, and transactions.
- Billing, payments, and insurance discounts.
- Daily tests, revenue, and inventory reports.

## Laboratory local admin access

Seed the demo users first:

```powershell
cd lab_system-main\backend
py -3.14 manage.py migrate
py -3.14 manage.py seed_data
```

Then use:

```text
URL:      http://127.0.0.1:8001/admin/
Username: admin
Password: ChangeMe123!
```

---

# System 3: Pharmacy Management

The pharmacy system manages medicine products, inventory, suppliers, purchase
orders, goods receipts, pharmacy orders, low-stock alerts, invoices, and clinic
integration.

## Pharmacy roles

- **Administrator:** Full access to the pharmacy backend and admin console.
- **Pharmacist:** Reviews prescriptions and pharmacy orders.
- **Cashier:** Handles billing and invoice workflows.
- **Inventory clerk:** Manages products, stock, suppliers, and receiving.
- **Doctor:** Creates or reviews medication-related requests.
- **Receptionist:** Works with clinic and patient-facing requests.

## Pharmacy pages and screenshot placeholders

| Page | Description | Screenshot |
| --- | --- | --- |
| Login | Authenticates pharmacy staff and loads their role-based workspace. | `<!-- Screenshot: pharmacy-login.png -->` |
| Pharmacy dashboard | Summarizes orders, inventory, alerts, and invoices. | `<!-- Screenshot: pharmacy-dashboard.png -->` |
| Pharmacy workspace | Provides navigation between pharmacy operations. | `<!-- Screenshot: pharmacy-workspace.png -->` |
| Inventory workspace | Searches medicines and manages current stock. | `<!-- Screenshot: pharmacy-inventory.png -->` |
| Product list | Shows medicine names, SKUs, quantities, and stock thresholds. | `<!-- Screenshot: pharmacy-products.png -->` |
| Low-stock alerts | Highlights medicines that need replenishment. | `<!-- Screenshot: pharmacy-alerts.png -->` |
| Suppliers | Manages supplier contacts and procurement information. | `<!-- Screenshot: pharmacy-suppliers.png -->` |
| Purchase orders | Creates and tracks medicine purchase orders. | `<!-- Screenshot: pharmacy-purchase-orders.png -->` |
| Goods receipts | Records delivered quantities and lot information. | `<!-- Screenshot: pharmacy-goods-receipts.png -->` |
| Pharmacy orders | Tracks prescriptions and clinic medication requests. | `<!-- Screenshot: pharmacy-orders.png -->` |
| Billing workspace | Creates and manages patient invoices. | `<!-- Screenshot: pharmacy-billing.png -->` |
| Doctor dashboard | Shows prescription and clinic-related pharmacy activity. | `<!-- Screenshot: pharmacy-doctor-dashboard.png -->` |
| Reception dashboard | Shows reception-facing pharmacy and patient activity. | `<!-- Screenshot: pharmacy-reception-dashboard.png -->` |

## Pharmacy API

The pharmacy backend provides REST endpoints for:

- `/login/`
- `/patients/`
- `/appointments/`
- `/medical-records/`
- `/prescriptions/`
- `/inventory/`
- `/inventory/low-stock/`
- `/pharmacy-orders/`
- `/invoices/`
- `/billing/`
- `/suppliers/`
- `/products/`
- `/purchase-orders/`
- `/goods-receipts/`

It also includes FHIR-style medication request and medication dispense endpoints
for future interoperability.

## Pharmacy local admin access

If the account does not exist in a fresh database, run:

```powershell
cd pharmacy-management-system-main\backend
py -3.14 manage.py migrate
py -3.14 manage.py seed_demo
```

Then use:

```text
URL:      http://127.0.0.1:8002/admin/
Username: admin
Password: Admin123!
```

Demo role accounts use the same password:

```text
pharmacist
cashier
inventory
doctor
reception

Password: Admin123!
```

---

# Running All Three Systems

The systems use separate backend ports so they can run at the same time.

| System | Backend | Frontend |
| --- | --- | --- |
| Clinic | `http://127.0.0.1:8000` | Expo web URL shown by `npm run web` |
| Laboratory | `http://127.0.0.1:8001` | `http://localhost:8082` |
| Pharmacy | `http://127.0.0.1:8002` | `http://localhost:8083` |

## Clinic

Backend:

```powershell
cd backend-1
py -3.14 -m pip install -r requirements.txt
py -3.14 manage.py migrate
py -3.14 manage.py runserver 8000
```

Frontend, in a second terminal:

```powershell
cd DermaSkincareApp
npm install
npm run web
```

## Laboratory

Backend:

```powershell
cd lab_system-main\backend
py -3.14 -m pip install -r requirements.txt
py -3.14 manage.py migrate
py -3.14 manage.py seed_data
py -3.14 manage.py runserver 8001
```

Frontend, in a second terminal:

```powershell
cd lab_system-main\frontend
npm install
$env:EXPO_PUBLIC_API_BASE_URL = "http://127.0.0.1:8001"
npm run web -- --port 8082
```

## Pharmacy

Backend:

```powershell
cd pharmacy-management-system-main\backend
py -3.14 -m pip install -r requirements.txt
py -3.14 manage.py migrate
py -3.14 manage.py seed_demo
py -3.14 manage.py runserver 8002
```

Frontend, in a second terminal:

```powershell
cd pharmacy-management-system-main\frontend
npm install
$env:EXPO_PUBLIC_API_BASE_URL = "http://localhost:8002"
npm run web -- --port 8083
```

> On Android or iOS devices, replace `localhost` with the computer's local network
> IP address. The device and computer must be connected to the same network.

---

# Integration Design

The three systems are separated by responsibility but designed to work together.

```text
Clinic
  ├── Patient and appointment data
  ├── Diagnoses and prescriptions
  └── Pharmacy and laboratory requests

Laboratory
  ├── Patient and appointment references
  ├── Lab and radiology orders
  ├── Results and reports
  └── Billing and inventory consumption

Pharmacy
  ├── Prescription and medication requests
  ├── Medicine inventory and suppliers
  ├── Dispensing and pharmacy orders
  └── Invoices and stock alerts
```

Important integration concepts include:

- Shared patient and order references.
- Prescription-to-pharmacy-order workflows.
- Inventory updates after medicine or test consumption.
- Billing records connected to clinical services.
- REST APIs for future service-to-service communication.
- FHIR-style medication resources for interoperability.

---

# Security and Data Notes

This repository is configured for local development and portfolio demonstration.
Before production use:

- Change all demo passwords.
- Remove credentials from documentation and source control.
- Use environment variables for secrets and API keys.
- Use PostgreSQL or another production database.
- Enable HTTPS and secure cookie settings.
- Review CORS and allowed-host configuration.
- Use hashed passwords and a production authentication strategy.
- Configure backups, audit retention, and access monitoring.
- Never commit patient-identifying data or private medical images.

The included SQLite databases and sample records are demonstration data only.

---

# Screenshot Guide

For a polished portfolio presentation, capture each page at the same browser size
and use consistent naming:

```text
docs/
└── screenshots/
    ├── clinic/
    ├── laboratory/
    └── pharmacy/
```

Recommended screenshot format:

- Use PNG or WebP.
- Capture the full page or the main content area.
- Hide personal data and development-only credentials.
- Add one short caption explaining the user value of the page.
- Replace a placeholder such as:

```md
<!-- Screenshot: doctor-dashboard.png -->
```

with:

```md
![Doctor dashboard](docs/screenshots/clinic/doctor-dashboard.png)
```

---

# Project Status

The project is suitable for local demonstration and portfolio review. The three
frontends and Django APIs are available as separate applications, with seeded demo
data for the main workflows. The architecture leaves room for cloud deployment,
stronger production security, external laboratory integrations, and a shared
production database.

