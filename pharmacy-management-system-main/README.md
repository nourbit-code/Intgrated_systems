# Pharmacy Management System (Clinic Integration)

This project provides a pharmacy management system that integrates with an existing clinic system.
It follows the integration plan in `pharmacy_integration_plan.pdf` and includes:

- Pharmacy dashboard with orders, inventory, low-stock alerts, and invoices
- Clinic integration via REST endpoints
- Token-based authentication

## Project Structure
- `frontend/` React Native + Expo web UI
- `backend/` Django + DRF API (SQLite)

## Quick Start (Backend)
Use the workspace Python:

```powershell
$py = "C:\Users\nadee\Desktop\pharmacy management system\tools\python312\python.exe"
& $py "C:\Users\nadee\Desktop\pharmacy management system\backend\manage.py" runserver
```

Admin user:
- username: `admin`
- password: `Admin123!`

## Quick Start (Frontend)
```powershell
cd "C:\Users\nadee\Desktop\pharmacy management system\frontend"
$env:EXPO_PUBLIC_API_BASE_URL = "http://localhost:8000"
$env:EXPO_PUBLIC_API_TOKEN = "55f831bf57aae3bd0f0e91b08e8b8662f619c6e9"
npm run web
```

Demo login:
- email: `doctor@example.com`
- password: `1234`

## Integration Endpoints (Plan)
- `/login/`
- `/patients/`
- `/appointments/`
- `/medical-records/`
- `/prescriptions/`
- `/inventory/`
- `/inventory/low-stock/`
- `/pharmacy-orders/`
- `/invoices/`

## Demo Data
You can re-seed demo data at any time:

```powershell
$py = "C:\Users\nadee\Desktop\pharmacy management system\tools\python312\python.exe"
& $py "C:\Users\nadee\Desktop\pharmacy management system\backend\manage.py" seed_demo
```

## CI
GitHub Actions runs:
- `python manage.py check`
- `npm ci` in `frontend/`
