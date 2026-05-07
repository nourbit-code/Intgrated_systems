param(
  [string]$DbPath = ".\db.sqlite3",
  [string]$BackupDir = ".\db_backups"
)

$ErrorActionPreference = "Stop"

if (-not (Test-Path -LiteralPath $DbPath)) {
  throw "Database file not found: $DbPath"
}

if (-not (Test-Path -LiteralPath $BackupDir)) {
  New-Item -ItemType Directory -Path $BackupDir | Out-Null
}

$timestamp = Get-Date -Format "yyyyMMdd_HHmmss"
$target = Join-Path $BackupDir ("db.sqlite3." + $timestamp + ".bak")
Copy-Item -LiteralPath $DbPath -Destination $target -Force

Write-Host "Backup created: $target"
