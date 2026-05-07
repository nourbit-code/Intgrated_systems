param(
  [Parameter(Mandatory = $true)]
  [string]$BackupFile,
  [string]$DbPath = ".\db.sqlite3"
)

$ErrorActionPreference = "Stop"

if (-not (Test-Path -LiteralPath $BackupFile)) {
  throw "Backup file not found: $BackupFile"
}

if (Test-Path -LiteralPath $DbPath) {
  $timestamp = Get-Date -Format "yyyyMMdd_HHmmss"
  Copy-Item -LiteralPath $DbPath -Destination ($DbPath + ".pre_restore." + $timestamp + ".bak") -Force
}

Copy-Item -LiteralPath $BackupFile -Destination $DbPath -Force
Write-Host "Database restored from: $BackupFile"
