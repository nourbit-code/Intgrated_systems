# AlphaLab System - Full Product Description

AlphaLab is a complete lab operations platform that connects Reception, Lab Technician workflows, Radiology, Inventory, Billing, Patient records, and Reporting in one unified system.
It is designed to reduce manual errors, speed up turnaround time, and give management clear operational and financial visibility.

## Core Business Value

- End-to-end workflow from patient registration to final result/report.
- Role-based experience for Receptionist and Lab Technician.
- Built-in billing, insurance discounts, and payment tracking.
- Integrated inventory control with consumption tracking tied to tests/scans.
- Advanced radiology viewer capabilities, including DICOM handling.
- Real-time status progression for orders and appointments.
- Audit-ready backend with activity logging and filtered reporting APIs.

## Technical Architecture

- Frontend: React Native + Expo + Expo Router (web/mobile-ready UI).
- Backend: Django + Django REST Framework.
- Database: SQLite (current environment), easy migration path to production DBs.
- Authentication/Security: Session authentication + CSRF protection.
- API Style: RESTful `/api/v1/*` with model viewsets and report endpoints.
- Testing stack: Django tests, Jest unit tests, Playwright E2E, API smoke tests.
- Utilities: DICOM parser, barcode generation (`bwip-js`), print-ready document views.

## Security and Access Control

- Authenticated API by default.
- Role-based access (`LAB_TECH`, `RECEPTIONIST`) with scoped data filtering.
- Staff/superuser override for administrative access.
- Entity-level activity logs for create/update/delete traceability.
- Strong model constraints (unique codes, one-to-one result links, controlled statuses).

## Major Functional Modules

### 1) Patient Management

- Full patient profile (demographics, contact, insurance details).
- Patient directory with search and profile drill-down.
- Patient visit history, lab orders, scan history, and past reports.
- EMR-style page consolidating medical history and reports timeline.

### 2) Order and Workflow Management

- Create lab/scan orders from reception.
- Auto-link orders to appointments and invoices.
- Multi-status lifecycle: waiting, in progress, completed, cancelled.
- Role-driven status transitions with validation rules.

### 3) Lab Operations

- Sample collection workflow with specimen metadata.
- Barcode generation and print for sample labels.
- Analyzer/test-run workflow with QC checklist steps.
- Multi-parameter result entry with reference ranges and critical flags.
- Completed test queue and result dashboard views.

### 4) Radiology Operations

- Radiology order dashboard and upload history.
- Detailed radiology report entry per order.
- DICOM/image upload with viewer controls.
- Multi-frame/slice handling, windowing, zoom/pan, brightness/contrast.
- Side-by-side comparison mode and annotation pin mode.
- Structured reporting fields (modality, body part, laterality, severity, follow-up).
- Result persistence and synchronization to backend scan results.

### 5) Inventory and Procurement

- Inventory dashboard with quantities, min stock, expiry, supplier metadata.
- Low-stock and expiry alert pages.
- Stock movement transaction log (add/use/adjust/expired).
- Purchase request and receive-order flow.
- Supplier management and inventory settings.
- Consumption templates mapped to test/scan workflows.
- Auto-allocation and shortage detection before completing orders.

### 6) Billing and Insurance

- Invoice/payment management per patient/order.
- Payment status tracking (paid/partial/unpaid).
- Insurance provider management and discount percentages.
- Discount-aware order total calculations.
- Print-ready invoice output and barcode-linked order support.
- Date/method/insurance filters for financial control.

### 7) Reporting and Analytics

- Daily tests report.
- Weekly tests report.
- Revenue report (invoiced vs paid totals).
- Inventory low-stock report.
- Frontend report dashboards/cards for operational visibility.

## UI/UX Style and Attractive Product Elements

- Clean clinical theme with high readability and soft medical palette.
- Professional sidebar navigation with role-specific menus.
- Responsive card-based dashboards with actionable KPIs.
- Rich filter chips, date-range tools, quick search patterns.
- Visual status badges, priority chips, and table-driven operations.
- Print-friendly document layouts for invoices/reports.
- Smooth workflow from dashboard action buttons to detailed execution screens.

## Complete Page Map

### Global and Auth

- `/` landing redirect.
- `/login` role-aware sign-in.
- `/(auth)/index` auth entry route.
- `/modal` shared modal screen.
- `+not-found` fallback route.

### Shared App Pages

- `/patients` patient directory.
- `/patients/[id]` patient visit history.
- `/patients/[id]/emr` EMR deep profile.
- `/appointments/book` booking wizard view.
- `/reports` report index.
- `/reports/daily-tests` daily analytics.
- `/reports/revenue` revenue analytics.
- `/results/upload` generic results upload.
- `/inventory` generic inventory screen.

### Receptionist Area

- `/receptionist` receptionist dashboard.
- `/receptionist/add-patient` new patient registration.
- `/receptionist/create-order` order creation + billing summary + barcodes.
- `/receptionist/orders` order board + filtering + status actions.
- `/receptionist/billing` payments and invoice management.
- `/receptionist/insurance-settings` providers and discount rates.
- `/receptionist/reports` receptionist reports dashboard.
- `/receptionist/user-management` staff accounts management.
- `/receptionist/user-management/profile/[userId]` edit staff profile.
- `/receptionist/profile` own profile page.

### Lab Technician Area

- `/lab-tech` lab tech dashboard.
- `/lab-tech/results-dashboard` test queue dashboard.
- `/lab-tech/results-entry` perform test/result entry.
- `/lab-tech/results-multi/[orderId]` advanced multi-test result entry.
- `/lab-tech/sample-collection` specimen collection workflow.
- `/lab-tech/lab-tests/[orderId]` guided test run execution.
- `/lab-tech/test-selection/[orderId]` test selection step.
- `/lab-tech/completed-tests` completed cases list.
- `/lab-tech/radiology` radiology upload history/dashboard.
- `/lab-tech/radiology/[orderId]` full radiology viewer and report page.
- `/lab-tech/reports` technician reports page.
- `/lab-tech/profile` own profile page.
- `/lab-tech/settings` settings hub.
- `/lab-tech/settings/general` general settings.
- `/lab-tech/settings/tests-scans` test/scan catalog settings.
- `/lab-tech/settings/results` results behavior settings.
- `/lab-tech/settings/reports` report settings.
- `/lab-tech/inventory` inventory dashboard.
- `/lab-tech/inventory/items` inventory items management.
- `/lab-tech/inventory/add` add inventory item.
- `/lab-tech/inventory/alerts` low stock alerts.
- `/lab-tech/inventory/expired-alerts` expiry alerts.
- `/lab-tech/inventory/transactions` stock transactions log.
- `/lab-tech/inventory/request-order` create purchase request.
- `/lab-tech/inventory/order-requests` purchase requests list.
- `/lab-tech/inventory/order-requests/[requestId]` receive purchase order.
- `/lab-tech/inventory/suppliers` suppliers management.
- `/lab-tech/inventory/reports` inventory reports.
- `/lab-tech/inventory/settings` inventory settings/configuration.

## Data and Compliance Strengths

- Unique identifiers and validation on core entities (users, test codes, scan codes, SKUs, insurance names, patient external IDs).
- One-result-per-order integrity for lab and scan results.
- Controlled enum statuses across orders, invoices, payments, and procurement.
- Audit trail for create/update/delete operations.

## Quality and Testing Readiness

- Backend integration tests for auth, profiles, permissions, reports, and audit behavior.
- Frontend unit tests for API/auth utility logic.
- Playwright E2E flow for receptionist-to-lab and profile persistence paths.
- API smoke script validating auth flow, endpoints, and negative validation scenarios.

## Special Selling Points

- Full operational coverage in one system (no tool switching).
- DICOM-capable radiology workflow inside the same platform.
- Barcode-based sample handling to reduce labeling errors.
- Inventory consumption linked to actual performed tests/scans.
- Insurance-aware billing and financial visibility.
- Role-based UX that keeps each team focused and secure.
- Print-ready outputs for practical day-to-day clinic operations.

## Optional Upsell Extensions

1. Multi-branch support with branch-wise analytics.
2. WhatsApp/SMS notifications for result readiness.
3. LIS/HIS integration adapters (HL7/FHIR/API connectors).
4. Cloud deployment with backups and disaster recovery.
5. Executive BI dashboard with trend forecasting.
6. Arabic/English full localization package.
7. Advanced audit/compliance reports for accreditation.
