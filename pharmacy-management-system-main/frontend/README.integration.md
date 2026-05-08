# Pharmacy Integration (Frontend)

This frontend is built for the pharmacy module and integrates with the clinic system
via the MVP endpoints in `pharmacy_integration_plan.pdf`.

## Configure API
Set these environment variables before running:

- `EXPO_PUBLIC_API_BASE_URL` (example: http://localhost:8000)
- `EXPO_PUBLIC_API_TOKEN` (optional fallback token)

Example (PowerShell):

```powershell
$env:EXPO_PUBLIC_API_BASE_URL = "http://localhost:8000"
$env:EXPO_PUBLIC_API_TOKEN = "YOUR_TOKEN"
npm run web
```

## Login Flow (Plan)
The login screen calls `POST /login/` and expects a token response.
Supported token keys: `token`, `key`, or `access`.

## Integration Endpoints (Plan)
- `/prescriptions/`
- `/pharmacy-orders/`
- `/inventory/`
- `/inventory/low-stock/`
- `/invoices/`

## Notes
If the API is unreachable, the UI will show sample data and a warning banner.
