# AlphaLab Integration Specification

Version: 1.0  
System: AlphaLab (`lab_system`)  
Prepared for: Integrating AlphaLab with two external systems (`System A`, `System B`)  
Date: 2026-04-25

## 1) Purpose and Scope

This document defines the technical integration contract between AlphaLab and two external systems.

Goals:
- Exchange core clinical and operational data reliably.
- Prevent duplicates and data drift across systems.
- Keep auditability and role-based controls intact.
- Support phased rollout with minimal downtime.

In scope:
- Patients, appointments, lab/scan orders and results.
- Billing, payments, insurance, inventory consumption.
- Authentication model, API contract expectations, data mapping, sync strategy, testing.

Out of scope:
- UI-level integration.
- Non-API file sharing methods unless explicitly agreed.

## 2) Systems Overview

- AlphaLab: source system for lab workflow execution, radiology report workflow, and clinic front-desk operations.
- System A: external platform #1 (define role: e.g., HIS/EMR/LIS).
- System B: external platform #2 (define role: e.g., finance/ERP/insurance gateway).

## 3) Environment and Base URLs

Current AlphaLab local base URL:
- `http://127.0.0.1:8000`

Required environments:
- DEV
- STAGING
- PROD

For each environment, define:
- Base URL per system
- Auth endpoint
- Webhook endpoint(s)
- Network allowlist
- TLS certificates

## 4) Integration Architecture (Recommended)

Recommended pattern:
- Use API-based near-real-time sync plus nightly reconciliation.
- Add a lightweight integration service (or middleware) to manage:
- Retries
- Idempotency
- External ID mapping
- Transformation and validation
- Structured error logging

Transport:
- HTTPS REST JSON for transactional APIs.
- Optional webhook callbacks for event-driven updates.

## 5) Authentication and Security

### Current AlphaLab Auth (As-Is)
- Session authentication with CSRF (`/api/v1/auth/csrf`, `/api/v1/auth/login`, etc.).
- Best for browser clients.

### Required for System-to-System (To-Be)
- Introduce non-session machine auth for integrations:
- Preferred: OAuth2 client credentials or signed API keys.
- Fallback: long-lived service token rotated by policy.

Security requirements:
- TLS 1.2+ mandatory.
- Request signing or token-based auth mandatory.
- Principle of least privilege for integration accounts.
- Audit every create/update/delete action with source identifier.
- No PHI/PII logging in plaintext.

## 6) Source of Truth Model

Define ownership per domain (example default):
- Patients: System A master, AlphaLab local copy.
- Appointments/orders/results: AlphaLab master after order acceptance.
- Billing/payments: System B master or dual-write with reconciliation.
- Inventory: AlphaLab master.

Conflict resolution:
- Use `updated_at` + source priority.
- If conflict and same timestamp: keep master source and log exception.

## 7) Canonical Data Model and Keys

Primary key strategy:
- Keep AlphaLab internal IDs intact.
- Add external reference fields in integration mapping table:
- `alpha_entity`
- `alpha_id`
- `external_system` (`A` or `B`)
- `external_id`
- `last_sync_at`
- `sync_status`

Required business correlation fields:
- Patient: `external_id` (already present in AlphaLab patient model).
- Order: external order code (to be added if not available).
- Invoice: external invoice reference.

Idempotency:
- Every create/update call must include:
- `Idempotency-Key` header (UUID)
- `X-Source-System` header (`SYSTEM_A` / `SYSTEM_B`)

## 8) AlphaLab API Surfaces (Current)

Auth:
- `GET /api/v1/auth/csrf`
- `POST /api/v1/auth/login`
- `POST /api/v1/auth/logout`
- `GET /api/v1/auth/me`

Core resources:
- `/api/v1/users/`
- `/api/v1/patients/`
- `/api/v1/appointments/`
- `/api/v1/lab-test-types/`
- `/api/v1/lab-test-orders/`
- `/api/v1/lab-results/`
- `/api/v1/scan-types/`
- `/api/v1/scan-orders/`
- `/api/v1/scan-results/`
- `/api/v1/inventory-items/`
- `/api/v1/inventory-transactions/`
- `/api/v1/inventory-purchase-orders/`
- `/api/v1/invoices/`
- `/api/v1/payments/`
- `/api/v1/insurance-providers/`
- `/api/v1/activity-log/`

Reports:
- `GET /api/v1/reports/daily-tests`
- `GET /api/v1/reports/weekly-tests`
- `GET /api/v1/reports/revenue`
- `GET /api/v1/reports/inventory`

## 9) Data Mapping Matrix

## 9.1 Patients

AlphaLab fields:
- `full_name`, `dob`, `gender`, `phone`, `email`, `address`
- `insurance_provider`, `insurance_policy_number`, `insurance_member_id`, `insurance_expiry`
- `external_id`, `is_active`

Mapping rules:
- Gender enum mapping must be strict (`male|female|other`).
- If external patient has no DOB but has age, transform to policy-approved fallback date.
- `external_id` is required for deduplication.

## 9.2 Appointments and Orders

AlphaLab appointment:
- `patient`, `scheduled_at`, `status`, `type`, `notes`

AlphaLab lab order:
- `appointment`, `test_type`, `status`, `price`

AlphaLab scan order:
- `appointment`, `scan_type`, `status`, `price`

Rules:
- Do not mix imaging and lab tests in one AlphaLab order transaction.
- Cancellation rights may be role-limited in AlphaLab logic.

## 9.3 Results

Lab result:
- One-to-one with lab order.

Scan result:
- One-to-one with scan order.

Rules:
- Multiple results for same order should be rejected or versioned by external system before posting.
- Attach external reference in `external_ref` and `source_system`.

## 9.4 Billing and Payments

Invoice:
- `patient`, `appointment`, `total`, `status`

Payment:
- `invoice`, `amount`, `method`, `paid_at`

Rules:
- `status` must map to `unpaid|partial|paid|void`.
- Reconcile partial payments with cumulative paid amount.

## 9.5 Inventory

Inventory item:
- `sku`, `name`, `quantity`, `reorder_level`, `expiry_date`, `supplier`

Transactions:
- `delta`, `reason`, `created_at`

Rules:
- `sku` is unique and should be stable across systems.
- Negative delta means consumption/outflow.

## 10) Sync Patterns

### Real-time (Preferred)
- Inbound create/update from System A/B to AlphaLab for selected entities.
- Outbound event notification from AlphaLab on status/result/payment updates.

### Scheduled Reconciliation
- Nightly job compares:
- Patients by `external_id`
- Orders by external order reference
- Invoices by external invoice reference
- Inventory by `sku`

Reconciliation outputs:
- matched
- missing-in-alpha
- missing-in-external
- value-mismatch
- conflict

## 11) Error Handling and Retry Policy

HTTP behavior:
- `2xx`: success
- `4xx`: business/validation error, do not blind retry
- `5xx`: retry with exponential backoff

Retry policy:
- 3 immediate retries (2s, 5s, 15s)
- then dead-letter queue/manual review

Required error payload format:
```json
{
  "code": "VALIDATION_ERROR",
  "message": "Human readable message",
  "details": {
    "field": "status",
    "reason": "invalid enum value"
  },
  "trace_id": "uuid"
}
```

## 12) Idempotency and Duplicate Prevention

Create operations must be idempotent by:
- `Idempotency-Key`
- plus natural key (`external_id`, `external_order_id`, `external_invoice_id`)

Update operations:
- Require `If-Unmodified-Since` or `version` semantics where possible.

## 13) Observability and Audit

Minimum logging fields:
- timestamp
- source system
- entity type/id
- operation
- status (success/fail)
- latency
- trace ID

AlphaLab audit:
- Existing activity logs should be preserved and enriched with source metadata.

## 14) Performance and SLO Targets

Suggested targets:
- P95 API latency < 500 ms for reads, < 1000 ms for writes.
- Event delivery success >= 99.5%.
- Reconciliation mismatch rate < 0.5%.

## 15) Non-Functional Constraints

- Timezone normalization: store UTC internally.
- Date format: ISO 8601.
- Decimal precision: preserve billing and inventory quantities as strings in payloads when needed.
- Maximum payload size: define per endpoint.

## 16) Integration Test Plan

### Contract Tests
- Validate schema and enums per endpoint.
- Validate required/optional fields.

### Workflow Tests
- Patient create/update from external to AlphaLab.
- Order create in external -> appears in AlphaLab queue.
- Result complete in AlphaLab -> external receives final result state.
- Invoice/payment updates are consistent across both sides.

### Negative Tests
- Invalid enum values.
- Duplicate creates with same idempotency key.
- Out-of-order updates.
- Network timeout and retry outcomes.

### Reconciliation Tests
- Detect and classify mismatches.
- Confirm correction pipeline.

## 17) Deployment and Cutover Strategy

Recommended phases:
1. Read-only integration dry run in DEV.
2. Bi-directional sync in STAGING with masked data.
3. Pilot rollout (subset of clinics/departments).
4. Full PROD rollout with monitoring and rollback plan.

Rollback requirements:
- Feature flags per integration channel.
- Queue pausing.
- Replay support from dead-letter queue.

## 18) Open Items (To Finalize Before Go-Live)

1. Confirm source-of-truth ownership per entity with partners.
2. Confirm final auth mechanism for server-to-server traffic.
3. Define external IDs for orders and invoices if missing.
4. Approve full field-level mapping sheet with System A and B.
5. Approve retry windows and SLA responsibilities.
6. Approve PHI/PII data handling and compliance policy.

## 19) Suggested Immediate Enhancements in AlphaLab (Integration Readiness)

1. Add machine-to-machine auth endpoint/token model.
2. Add explicit integration mapping table for external IDs.
3. Add outbound webhook/event publisher for key state changes.
4. Add idempotency middleware for POST endpoints.
5. Add standardized API error response envelope.
6. Add versioning or optimistic locking fields for conflict-safe updates.

## 20) Example Payloads

### Example: Create Patient
```json
{
  "external_id": "PAT-EXT-10045",
  "full_name": "Sara Ali",
  "dob": "1992-05-12",
  "gender": "female",
  "phone": "01000000001",
  "email": "sara@example.com",
  "address": "Cairo",
  "insurance_provider": "AXA",
  "insurance_policy_number": "PL-2026-9921",
  "insurance_member_id": "MBR-7788",
  "insurance_expiry": "2027-05-11",
  "is_active": true
}
```

### Example: Create Lab Order
```json
{
  "appointment": 1201,
  "test_type": 5,
  "status": "waiting_for_sample",
  "price": "150.00"
}
```

### Example: Submit Lab Result
```json
{
  "lab_test_order": 3301,
  "result_text": "Within normal limits",
  "normal_range": "See reference",
  "reported_at": "2026-04-25T15:20:00Z",
  "source_system": "SYSTEM_A",
  "external_ref": "RES-A-33210"
}
```

### Example: Create Payment
```json
{
  "invoice": 901,
  "amount": "100.00",
  "method": "cash",
  "paid_at": "2026-04-25T16:00:00Z"
}
```

## 21) Sign-Off

Approval checklist:
- Product owner approval
- AlphaLab engineering approval
- System A engineering approval
- System B engineering approval
- Security/compliance approval

Once signed, this specification becomes the baseline for implementation and UAT.
