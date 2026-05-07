# Playwright E2E

These tests validate real flows in browser against your running backend.

Important project rule:

1. In this system, `LAB_TECH` is treated as `lab-tech` user role in frontend login.

## Prerequisites

1. Backend running on `http://127.0.0.1:8000`
2. Frontend dependencies installed
3. Playwright browsers installed

## Install

```powershell
cd frontend
npm install
npx playwright install
```

## Run

```powershell
npm run e2e
```

## Optional environment variables

1. `E2E_API_BASE_URL` (default: `http://127.0.0.1:8000`)
2. `E2E_WEB_PORT` (default: `19006`)
3. `E2E_RECEPTIONIST_EMAIL` (default: `reception@example.com`)
4. `E2E_RECEPTIONIST_PASSWORD` (default: `ChangeMe123!`)

