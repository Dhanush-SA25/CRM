# ============================================================================
# SmartCRM Admin Bootstrap Script
# ============================================================================
# 
# This script securely creates the first admin user on a remote Render 
# instance by calling the /api/setup/initial-admin endpoint.
#
# SECURITY:
# - Reads ADMIN_SETUP_TOKEN from environment variable only (not from input)
# - Does NOT echo the token to console or logs
# - Passes token in X-Setup-Token header (not in URL or body)
# - Only works if no admin exists; fails safely after first use
# - Validates email and password before sending to server
#
# USAGE:
#   1. Set environment variable:  $env:ADMIN_SETUP_TOKEN = "your-token-here"
#   2. Run this script:             .\call_setup_endpoint.ps1
#   3. Or with inline token:        $env:ADMIN_SETUP_TOKEN = "token"; .\call_setup_endpoint.ps1
#
# ============================================================================

# Configuration
$API_ENDPOINT = "https://smartcrm-api-3vfb.onrender.com/api/setup/initial-admin"
$ADMIN_EMAIL = "admin@example.com"          # Change this to desired admin email
$ADMIN_PASSWORD = "YourSecurePassword123!"  # Change this to desired admin password

# ============================================================================
# INPUT VALIDATION
# ============================================================================

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "SmartCRM Admin Bootstrap" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Get token from environment (NEVER from user input for security)
$TOKEN = $env:ADMIN_SETUP_TOKEN

if (-not $TOKEN) {
    Write-Host "ERROR: ADMIN_SETUP_TOKEN environment variable not set" -ForegroundColor Red
    Write-Host ""
    Write-Host "To set the token, run:" -ForegroundColor Yellow
    Write-Host '  $env:ADMIN_SETUP_TOKEN = "your-token-from-render"' -ForegroundColor Gray
    Write-Host ""
    Write-Host "Then run this script again:" -ForegroundColor Yellow
    Write-Host "  .\call_setup_endpoint.ps1" -ForegroundColor Gray
    exit 1
}

Write-Host "✓ Token loaded from environment variable" -ForegroundColor Green
Write-Host ""

# Validate email
if (-not $ADMIN_EMAIL -or $ADMIN_EMAIL -notmatch "^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$") {
    Write-Host "ERROR: Invalid email format: $ADMIN_EMAIL" -ForegroundColor Red
    exit 1
}
Write-Host "Email: $ADMIN_EMAIL" -ForegroundColor Gray

# Validate password
if ($ADMIN_PASSWORD.Length -lt 8) {
    Write-Host "ERROR: Password must be at least 8 characters" -ForegroundColor Red
    exit 1
}
Write-Host "Password: [hidden - $(($ADMIN_PASSWORD.Length)) characters]" -ForegroundColor Gray
Write-Host ""

# ============================================================================
# MAKE REQUEST
# ============================================================================

Write-Host "Calling endpoint: $API_ENDPOINT" -ForegroundColor Cyan
Write-Host ""

$headers = @{
    "Content-Type"  = "application/json"
    "X-Setup-Token" = $TOKEN  # Token in header, NOT in URL or body
}

$body = @{
    email    = $ADMIN_EMAIL
    password = $ADMIN_PASSWORD
} | ConvertTo-Json

try {
    $response = Invoke-WebRequest `
        -Uri $API_ENDPOINT `
        -Method POST `
        -Headers $headers `
        -Body $body `
        -ErrorAction Stop

    Write-Host "✓ SUCCESS: Admin user created" -ForegroundColor Green
    Write-Host ""
    Write-Host "Response:" -ForegroundColor Cyan
    $responseData = $response.Content | ConvertFrom-Json
    Write-Host ($responseData | ConvertTo-Json -Indent 2)
    Write-Host ""
    Write-Host "Next steps:" -ForegroundColor Yellow
    Write-Host "  1. Go to https://smartcrm-connect.netlify.app/login" -ForegroundColor Gray
    Write-Host "  2. Login with email: $ADMIN_EMAIL" -ForegroundColor Gray
    Write-Host "  3. (Optional) Delete ADMIN_SETUP_TOKEN from Render after verification" -ForegroundColor Gray
    Write-Host ""

} catch {
    $statusCode = $_.Exception.Response.StatusCode.Value__
    $errorBody = $_.Exception.Response.Content | ConvertFrom-Json -ErrorAction SilentlyContinue

    Write-Host "✗ ERROR: Request failed" -ForegroundColor Red
    Write-Host ""
    Write-Host "HTTP Status: $statusCode" -ForegroundColor Yellow
    
    switch ($statusCode) {
        400 {
            Write-Host "Details: Bad request (invalid email or password)" -ForegroundColor Yellow
        }
        401 {
            Write-Host "Details: Unauthorized (wrong token)" -ForegroundColor Yellow
            Write-Host "  Verify ADMIN_SETUP_TOKEN matches Render environment variable" -ForegroundColor Gray
        }
        403 {
            Write-Host "Details: Forbidden (admin already exists or token not configured)" -ForegroundColor Yellow
            Write-Host "  If admin already exists, you can now login at:" -ForegroundColor Gray
            Write-Host "  https://smartcrm-connect.netlify.app/login" -ForegroundColor Gray
        }
        500 {
            Write-Host "Details: Server error (database or backend issue)" -ForegroundColor Yellow
        }
        default {
            Write-Host "Details: $($errorBody.error)" -ForegroundColor Yellow
        }
    }

    if ($errorBody) {
        Write-Host ""
        Write-Host "Server response:" -ForegroundColor Cyan
        Write-Host ($errorBody | ConvertTo-Json -Indent 2)
    }

    exit 1
}
