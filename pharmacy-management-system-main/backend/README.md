# Backend (Django + SQLite)

This backend implements the pharmacy integration plan with these endpoints:
- `/login/`
- `/patients/`
- `/appointments/`
- `/medical-records/`
- `/prescriptions/`
- `/inventory/`
- `/inventory/low-stock/`
- `/pharmacy-orders/`
- `/invoices/`
- `/billing/` (alias of invoices for billing workspace clients)

## Setup
If Python is installed system-wide, you can use it directly. In this workspace, a
portable Python was installed at `tools\python312`.

```powershell
# Using the workspace Python
$py = "C:\Users\nadee\Desktop\pharmacy management system\tools\python312\python.exe"
& $py "C:\Users\nadee\Desktop\pharmacy management system\backend\manage.py" runserver
```

## Database & migrations
```powershell
$py = "C:\Users\nadee\Desktop\pharmacy management system\tools\python312\python.exe"
& $py "C:\Users\nadee\Desktop\pharmacy management system\backend\manage.py" makemigrations
& $py "C:\Users\nadee\Desktop\pharmacy management system\backend\manage.py" migrate
```

## Admin user
A superuser was created:
- `username`: admin
- `password`: Admin123!

Change this after first login.

## Demo data
You can re-run demo seeding anytime:

```powershell
$py = "C:\Users\nadee\Desktop\pharmacy management system\tools\python312\python.exe"
& $py "C:\Users\nadee\Desktop\pharmacy management system\backend\manage.py" seed_demo
```

## Notes
- Token login uses `POST /login/` (Django REST Framework token auth).
- Creating a `MedicalRecord` with `prescriptions` automatically creates `PharmacyOrder` entries.
- Low stock alerts are generated at `/inventory/low-stock/` using `quantity < low_stock_threshold`.
