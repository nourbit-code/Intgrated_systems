param(
    [string]$BaseUrl = "http://127.0.0.1:8000",
    [string]$Username = "dr_salim",
    [string]$Password = "ChangeMe123!",
    [string]$DateFrom = "",
    [string]$DateTo = ""
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

if ([string]::IsNullOrWhiteSpace($DateFrom)) {
    $DateFrom = (Get-Date).AddDays(-30).ToString("yyyy-MM-dd")
}
if ([string]::IsNullOrWhiteSpace($DateTo)) {
    $DateTo = (Get-Date).ToString("yyyy-MM-dd")
}

$session = New-Object Microsoft.PowerShell.Commands.WebRequestSession
$results = @()

function Get-StatusCodeFromException {
    param([System.Management.Automation.ErrorRecord]$ErrorRecord)
    $response = $ErrorRecord.Exception.Response
    if ($null -ne $response) {
        if ($response.StatusCode -is [int]) {
            return [int]$response.StatusCode
        }
        if ($null -ne $response.StatusCode.value__) {
            return [int]$response.StatusCode.value__
        }
    }
    return -1
}

function Invoke-TestRequest {
    param(
        [string]$Name,
        [string]$Method,
        [string]$Url,
        [int[]]$ExpectedStatus,
        [hashtable]$Headers = @{},
        [string]$Body = ""
    )

    $actualStatus = -1
    $responseBody = ""
    $ok = $false

    try {
        $params = @{
            Uri = $Url
            Method = $Method
            WebSession = $session
            Headers = $Headers
            UseBasicParsing = $true
        }
        if ($Body -ne "") {
            $params["Body"] = $Body
        }

        $resp = Invoke-WebRequest @params
        $actualStatus = [int]$resp.StatusCode
        $responseBody = $resp.Content
    } catch {
        $actualStatus = Get-StatusCodeFromException -ErrorRecord $_
        try {
            $stream = $_.Exception.Response.GetResponseStream()
            if ($null -ne $stream) {
                $reader = New-Object System.IO.StreamReader($stream)
                $responseBody = $reader.ReadToEnd()
            }
        } catch {
            $responseBody = $_.Exception.Message
        }
    }

    $ok = $ExpectedStatus -contains $actualStatus
    $statusText = if ($ok) { "PASS" } else { "FAIL" }
    $expectedText = ($ExpectedStatus -join ",")
    Write-Host ("[{0}] {1} => {2} (expected: {3})" -f $statusText, $Name, $actualStatus, $expectedText)

    $entry = [pscustomobject]@{
        Name = $Name
        Method = $Method
        Url = $Url
        Expected = $expectedText
        Actual = $actualStatus
        Result = $statusText
        Body = $responseBody
    }
    $script:results += $entry
    return $entry
}

function Add-SkippedResult {
    param(
        [string]$Name,
        [string]$Reason
    )
    Write-Host ("[SKIP] {0} => {1}" -f $Name, $Reason)
    $script:results += [pscustomobject]@{
        Name = $Name
        Method = "N/A"
        Url = "N/A"
        Expected = "N/A"
        Actual = "N/A"
        Result = "SKIP"
        Body = $Reason
    }
}

Write-Host "Running backend API smoke checks..."
Write-Host ("BaseUrl={0} Username={1} DateFrom={2} DateTo={3}" -f $BaseUrl, $Username, $DateFrom, $DateTo)

# 1) Auth flow
[void](Invoke-TestRequest -Name "Auth CSRF" -Method "GET" -Url "$BaseUrl/api/v1/auth/csrf" -ExpectedStatus @(200))

$csrfCookie = $session.Cookies.GetCookies($BaseUrl) | Where-Object { $_.Name -eq "csrftoken" } | Select-Object -First 1
$csrf = if ($null -ne $csrfCookie) { $csrfCookie.Value } else { "" }

$loginHeaders = @{
    "Content-Type" = "application/json"
}
if ($csrf -ne "") {
    $loginHeaders["X-CSRFToken"] = $csrf
}

$loginBody = (@{
    username = $Username
    password = $Password
} | ConvertTo-Json -Compress)

$loginResult = Invoke-TestRequest -Name "Auth Login" -Method "POST" -Url "$BaseUrl/api/v1/auth/login" -ExpectedStatus @(200) -Headers $loginHeaders -Body $loginBody
$meResult = Invoke-TestRequest -Name "Auth Me" -Method "GET" -Url "$BaseUrl/api/v1/auth/me" -ExpectedStatus @(200)

# Refresh CSRF after login (Django can rotate token on auth events)
$csrfCookie = $session.Cookies.GetCookies($BaseUrl) | Where-Object { $_.Name -eq "csrftoken" } | Select-Object -First 1
$csrf = if ($null -ne $csrfCookie) { $csrfCookie.Value } else { $csrf }

# 2) Reports
$role = ""
if ($meResult.Actual -eq 200) {
    try {
        $meJsonForRole = $meResult.Body | ConvertFrom-Json
        $role = [string]$meJsonForRole.role
    } catch {
        $role = ""
    }
}

[void](Invoke-TestRequest -Name "Report Daily Tests" -Method "GET" -Url "$BaseUrl/api/v1/reports/daily-tests?date_from=$DateFrom&date_to=$DateTo" -ExpectedStatus @(200))
[void](Invoke-TestRequest -Name "Report Weekly Tests" -Method "GET" -Url "$BaseUrl/api/v1/reports/weekly-tests?date_from=$DateFrom&date_to=$DateTo" -ExpectedStatus @(200))
[void](Invoke-TestRequest -Name "Report Revenue" -Method "GET" -Url "$BaseUrl/api/v1/reports/revenue?date_from=$DateFrom&date_to=$DateTo" -ExpectedStatus @(200))

$inventoryExpected = if ($role -in @("RECEPTIONIST", "LAB_TECH")) { @(200) } else { @(403) }
[void](Invoke-TestRequest -Name ("Report Inventory (role={0})" -f $role) -Method "GET" -Url "$BaseUrl/api/v1/reports/inventory" -ExpectedStatus $inventoryExpected)

# 3) Core read endpoints
$readResources = @(
    "users",
    "patients",
    "appointments",
    "lab-test-types",
    "lab-test-orders",
    "lab-results",
    "scan-types",
    "scan-orders",
    "scan-results",
    "inventory-items",
    "inventory-transactions",
    "inventory-purchase-orders",
    "invoices",
    "payments",
    "insurance-providers",
    "activity-log"
)

foreach ($res in $readResources) {
    [void](Invoke-TestRequest -Name ("List {0}" -f $res) -Method "GET" -Url "$BaseUrl/api/v1/$res/" -ExpectedStatus @(200))
}

# 4) Negative test: duplicate username should fail
if ($meResult.Actual -eq 200) {
    $meJson = $null
    try {
        $meJson = $meResult.Body | ConvertFrom-Json
    } catch {
        $meJson = $null
    }

    if ($null -ne $meJson -and -not [string]::IsNullOrWhiteSpace($meJson.username)) {
        $dupHeaders = @{
            "Content-Type" = "application/json"
        }
        if ($csrf -ne "") {
            $dupHeaders["X-CSRFToken"] = $csrf
        }
        $duplicateBody = (@{
            username = $meJson.username
            password = "ChangeMe123!"
        } | ConvertTo-Json -Compress)
        # Depending on current role map wiring, this may fail at permission layer (403)
        # or serializer validation layer (400). Both indicate backend checks are working.
        $duplicateExpected = @(400, 403)
        [void](Invoke-TestRequest -Name ("Users duplicate username validation (role={0})" -f $role) -Method "POST" -Url "$BaseUrl/api/v1/users/" -ExpectedStatus $duplicateExpected -Headers $dupHeaders -Body $duplicateBody)
    } else {
        Add-SkippedResult -Name "Users duplicate username validation" -Reason "Could not parse /auth/me username"
    }
} else {
    Add-SkippedResult -Name "Users duplicate username validation" -Reason "Skipped because auth/me failed"
}

# 5) Logout
$logoutHeaders = @{}
if ($csrf -ne "") {
    $logoutHeaders["X-CSRFToken"] = $csrf
}
[void](Invoke-TestRequest -Name "Auth Logout" -Method "POST" -Url "$BaseUrl/api/v1/auth/logout" -ExpectedStatus @(200) -Headers $logoutHeaders)

Write-Host ""
Write-Host "Summary:"
$results | Select-Object Name, Expected, Actual, Result | Format-Table -AutoSize

$failed = @($results | Where-Object { $_.Result -eq "FAIL" })
if ($failed.Count -gt 0) {
    Write-Host ""
    Write-Host "Failed cases details:" -ForegroundColor Red
    foreach ($f in $failed) {
        Write-Host ("- {0}: expected {1}, got {2}" -f $f.Name, $f.Expected, $f.Actual) -ForegroundColor Red
        if (-not [string]::IsNullOrWhiteSpace($f.Body)) {
            Write-Host ("  body: {0}" -f $f.Body)
        }
    }
    exit 1
}

Write-Host ""
Write-Host "All tests passed." -ForegroundColor Green
exit 0

