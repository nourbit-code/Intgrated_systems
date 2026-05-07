# Role Access Matrix (Backend + Frontend)

This matrix is aligned to your system roles:
1. `LAB_TECH`
2. `RECEPTIONIST`

Technical alias:
- Backend code still uses `DOCTOR` in many permission rules.
- In your product language, treat backend `DOCTOR` as `LAB_TECH`.

## Source Of Truth Files

- `backend/core/urls.py`
- `backend/common/permissions.py`
- `backend/apps/*/views.py`
- `backend/apps/*/serializers.py`
- `frontend/hooks/useAuth.ts`
- `frontend/app/(app)/_layout.tsx`

## Global Rules

1. API requires authentication except csrf/login.
2. `is_staff` or `is_superuser` bypasses role checks.
3. For viewsets, role permission applies to CRUD unless queryset/serializer adds extra limits.

## Endpoint Matrix (Backend)

Legend:
- `Y` allowed
- `N` forbidden
- `S` allowed but scoped

| Resource | LAB_TECH (backend `DOCTOR`) | RECEPTIONIST | Notes |
|---|---:|---:|---|
| `/api/v1/users/` | S | N | Non-staff lab tech can only see/edit self |
| `/api/v1/patients/` | S | Y | Lab tech scoped to own assigned patients in backend filter |
| `/api/v1/appointments/` | S | Y | Lab tech scoped to own-patient appointments |
| `/api/v1/lab-test-types/` | Y | N | |
| `/api/v1/lab-test-orders/` | S | N | Lab tech scoped |
| `/api/v1/lab-results/` | S | N | Lab tech scoped |
| `/api/v1/scan-types/` | Y | N | |
| `/api/v1/scan-orders/` | S | N | Lab tech scoped |
| `/api/v1/scan-results/` | S | N | Lab tech scoped |
| `/api/v1/inventory-items/` | N | Y | Backend `LAB_TECH` constant can access; backend `DOCTOR` alias cannot |
| `/api/v1/inventory-transactions/` | N | Y | Same note as above |
| `/api/v1/inventory-purchase-orders/` | N | Y | Same note as above |
| `/api/v1/invoices/` | N | Y | |
| `/api/v1/payments/` | N | Y | |
| `/api/v1/insurance-providers/` | N | Y | |
| `/api/v1/activity-log/` | S | N | Non-staff sees own logs only |

## Reports Matrix

| Report Endpoint | LAB_TECH (backend `DOCTOR`) | RECEPTIONIST | Notes |
|---|---:|---:|---|
| `/api/v1/reports/daily-tests` | Y | Y | |
| `/api/v1/reports/weekly-tests` | Y | Y | |
| `/api/v1/reports/revenue` | Y | Y | Backend `LAB_TECH` constant is forbidden |
| `/api/v1/reports/inventory` | N | Y | Backend `LAB_TECH` constant is allowed |

## Frontend Role Model

1. Frontend only has `lab-tech` and `receptionist`.
2. Frontend route guard blocks cross-area navigation (`/lab-tech/*` vs `/receptionist/*`).
3. Current frontend mapping in code maps backend `DOCTOR` to receptionist, which conflicts with your desired naming.

## Frontend Route Matrix

| Route Prefix | LAB_TECH UI | RECEPTIONIST UI | Notes |
|---|---:|---:|---|
| `/lab-tech/*` | Y | N | |
| `/receptionist/*` | N | Y | |
| `/patients/*` | Y | Y | Shared |
| `/appointments/*` | N | Y | |

## Business Validation Constraints

1. Lab order status allowed: `waiting_for_sample`, `in_progress`, `completed`, `cancelled`.
2. Scan order status allowed: `in_progress`, `completed`, `cancelled`.
3. Only receptionist can set order status to `cancelled` (lab + scan serializer rules).
4. One lab result per lab order.
5. One scan result per scan order.
6. Unique constraints: username, patient external_id, lab code, scan code, inventory sku, insurance provider name.
7. Choice constraints apply to gender, appointment status/type, invoice status, payment method, inventory PO statuses.
8. Patient ownership field is now `primary_lab_tech` (with backward-compatible input/filter alias `primary_doctor`).

## Impossible Options (Current Logic)

### Role / naming / navigation

1. Dedicated frontend login as a separate `DOCTOR` role.
2. Creating a user labeled `DOCTOR` from frontend user-management form.
3. Lab-tech browsing receptionist-only route space.
4. Receptionist browsing lab-tech-only route space.

### Permission-level impossible options

1. Receptionist using lab/scan type/order/result endpoints.
2. Receptionist or lab-tech using `/users/` endpoint under normal role checks.
3. Lab-tech using invoices/payments/insurance-providers endpoints.
4. Receptionist using `/activity-log/`.
5. Lab-tech (backend `DOCTOR`) using inventory report endpoint.

### Scoped-data impossible options

1. Lab-tech (backend `DOCTOR`) reading other lab-tech-owned patients.
2. Lab-tech (backend `DOCTOR`) reading other lab-tech-owned appointments.
3. Lab-tech (backend `DOCTOR`) reading other lab-tech-owned lab orders/results.
4. Lab-tech (backend `DOCTOR`) reading other lab-tech-owned scan orders/results.
5. Non-staff lab-tech managing other users.

### Status / model impossible options

1. Invalid status values outside enum choices.
2. Non-receptionist canceling lab or scan orders.
3. Multiple lab results for one lab order.
4. Multiple scan results for one scan order.
5. Duplicate values on unique fields.

### Persistence-gap impossible options

1. Guaranteed backend persistence for result rows entered in current result-entry UI (currently localStorage-driven on that screen).
2. Guaranteed receptionist creation of backend lab/scan sub-orders in all cases (permission mismatch exists in backend role map).
