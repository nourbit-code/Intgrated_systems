# Testing Strategy (Backend + Frontend + API + DB)

This project should be tested in 4 layers:

1. API smoke tests (fast system health)
2. Backend integration tests (logic + DB persistence + permissions)
3. Frontend unit/component tests (UI logic and client state)
4. End-to-end user flows (real browser/app behavior)

## 1) API Smoke Tests

Use:

```powershell
powershell -ExecutionPolicy Bypass -File backend\test_api.ps1
```

What it validates:

1. Auth flow (csrf/login/me/logout)
2. Core list endpoints
3. Reports endpoints
4. Negative validation sample

Best for:

1. Quick confidence after pull/merge
2. Detecting broken routes/auth/session immediately

## 2) Backend Integration Tests (Django)

Run all backend tests:

```powershell
cd backend
python manage.py test -v 2
```

Run only a specific app:

```powershell
python manage.py test apps.accounts.tests -v 2
python manage.py test apps.patients.tests -v 2
python manage.py test apps.appointments.tests -v 2
python manage.py test apps.reports.tests -v 2
```

Current high-value tests include:

1. `apps/accounts/tests.py`
   - profile photo persistence through create -> login -> `/auth/me`
   - duplicate username validation
2. `apps/patients/tests.py`
   - patient creation persistence
   - doctor-scoped patient listing
3. `apps/appointments/tests.py`
   - appointment creation + audit log creation
4. `apps/reports/tests.py`
   - role-based permission on inventory report
   - revenue aggregation correctness

Best for:

1. Business logic correctness
2. DB save/read integrity
3. Permission rules

## 3) Frontend Tests (Expo/Jest)

Install frontend test dependencies once:

```powershell
cd frontend
npm install
```

Then run:

```powershell
npm test
```

You should cover:

1. Login form behavior and error handling
2. User profile editor behavior (including photo data URL handling)
3. Hooks and utilities (`useAuth`, `api.ts`) with mocked API responses

## 4) End-to-End Flows (Must-Have)

Critical flows you should automate next:

1. Receptionist login -> create patient -> create appointment -> invoice/payment
2. Doctor login -> can view only own patients and orders
3. Lab-tech login -> complete lab order -> result visible in patient history
4. Admin/receptionist edits user profile photo -> user logs in -> sees same photo
5. Forbidden access checks (role cannot access restricted modules)

Note for this project:

1. Doctor workflows are represented by `LAB_TECH` role in frontend login (`doctor == lab-tech`).

## What To Tell Me So I Can Build The Remaining Tests

Share these and I can generate a complete professional suite:

1. Exact "happy path" flows per role (Receptionist / Doctor / Lab-tech)
2. Fields that are mandatory in each form
3. Validation rules (min/max, formats, uniqueness)
4. Critical calculations (billing totals, discounts, report formulas)
5. Any integrations (external lab/scanner systems, upload constraints)
6. Production blocking risks you care about most

## Suggested CI Order

1. `python manage.py test -v 2`
2. `powershell -ExecutionPolicy Bypass -File backend\test_api.ps1`
3. `npm test` (frontend)

Fail build if any step fails.
