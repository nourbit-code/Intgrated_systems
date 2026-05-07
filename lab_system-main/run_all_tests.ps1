Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

Write-Host "== Backend Django tests =="
Push-Location "backend"
python manage.py test -v 2
Pop-Location

Write-Host ""
Write-Host "== Backend API smoke tests =="
powershell -ExecutionPolicy Bypass -File "backend\test_api.ps1"

Write-Host ""
Write-Host "== Frontend tests =="
Write-Host "Run these manually after installing frontend dev dependencies:"
Write-Host "  cd frontend"
Write-Host "  npm install"
Write-Host "  npm test"
