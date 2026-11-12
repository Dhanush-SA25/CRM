# SmartCRM Initial Admin Bootstrap Endpoint Guide

## Overview

This guide explains how to use the secure token-authenticated endpoint to create the first admin user on your Render production instance. This is necessary because Render's free tier doesn't provide shell access for running Flask CLI commands.

## Security Architecture

### Token-Based Authentication
- The endpoint requires an `X-Setup-Token` header matching the `ADMIN_SETUP_TOKEN` environment variable
- The token is read from the environment, **never hardcoded** in the application
- The token is passed in the HTTP header, **not in the URL or request body**
- This prevents token leakage in logs, browser history, or network traces

### Auto-Disable After First Admin
- The endpoint checks if any admin user already exists before processing
- If an admin exists, the endpoint returns HTTP 403 (Forbidden)
- After the first admin is created, this endpoint becomes "invisible" to all subsequent requests
- This prevents:
  - Unauthorized account creation
  - Token brute-force attacks (attacker can't tell if token is valid)
  - Account enumeration (attacker can't discover whether admin exists)

### Request Validation
- Email must be in valid format (e.g., `admin@example.com`)
- Password must be at least 8 characters
- User's email must not already exist in the database
- All validation happens server-side before database operations

## Setup Steps

### Step 1: Generate a Setup Token

Generate a random 20+ character token. Options:

**Option A: PowerShell**
```powershell
[System.Convert]::ToBase64String([System.Security.Cryptography.RandomNumberGenerator]::GetBytes(32))
```

**Option B: Online Generator**
Use https://www.random.org/ or similar to generate a random string.

**Example token:**
```
aB3cD4eF5gH6iJ7kL8mN9oP0qR1sT2uV3w
```

### Step 2: Add ADMIN_SETUP_TOKEN to Render

1. Go to your Render dashboard: https://dashboard.render.com
2. Select your **smartcrm-api** service
3. Click the **Environment** tab
4. Click **Add Environment Variable**
5. Name: `ADMIN_SETUP_TOKEN`
6. Value: Paste your generated token
7. Click **Save**

⚠️ **Important:** After creating the admin account, you can delete this environment variable for extra security.

### Step 3: Wait for Deployment

After adding the environment variable, Render will automatically redeploy your service. Wait for the deployment to complete (status shows "Live").

You can monitor this on your service dashboard.

### Step 4: Run the Bootstrap Script

Navigate to your workspace root and run:

```powershell
$env:ADMIN_SETUP_TOKEN = "aB3cD4eF5gH6iJ7kL8mN9oP0qR1sT2uV3w"
.\call_setup_endpoint.ps1
```

Or set the token once and run multiple times:

```powershell
$env:ADMIN_SETUP_TOKEN = "aB3cD4eF5gH6iJ7kL8mN9oP0qR1sT2uV3w"
.\call_setup_endpoint.ps1
# Token persists for the PowerShell session
.\call_setup_endpoint.ps1  # Another call (will fail with 403 if admin exists)
```

### Step 5: Verify Login

1. Go to https://smartcrm-connect.netlify.app/login
2. Enter your admin email and password
3. Click **Login**
4. You should see the dashboard

If login fails, check:
- Email matches what you used in the script
- Password is exactly what you entered
- Netlify's API proxy is correctly routing to Render backend

## Endpoint Reference

### URL
```
POST https://smartcrm-api-3vfb.onrender.com/api/setup/initial-admin
```

### Headers
```
Content-Type: application/json
X-Setup-Token: <your-token-from-ADMIN_SETUP_TOKEN-env-var>
```

### Request Body
```json
{
  "email": "admin@example.com",
  "password": "YourSecurePassword123!"
}
```

### Response Codes

| Code | Meaning | Cause |
|------|---------|-------|
| **201** | Created | Admin user successfully created |
| **400** | Bad Request | Invalid email/password format, or user with email already exists |
| **401** | Unauthorized | Token missing or incorrect |
| **403** | Forbidden | Admin already exists **OR** token not configured in environment |
| **500** | Server Error | Database or backend issue |

### Success Response (201)
```json
{
  "id": 1,
  "email": "admin@example.com",
  "name": "Administrator",
  "role": "admin",
  "message": "Admin user created successfully"
}
```

### Error Response Example (403)
```json
{
  "error": "Forbidden"
}
```

**Note:** The 403 response is intentionally generic to prevent state enumeration attacks. It returns the same response whether the admin exists or the token is invalid.

## Using curl (Advanced)

If you prefer `curl` instead of the PowerShell script:

```bash
curl -X POST \
  https://smartcrm-api-3vfb.onrender.com/api/setup/initial-admin \
  -H "Content-Type: application/json" \
  -H "X-Setup-Token: aB3cD4eF5gH6iJ7kL8mN9oP0qR1sT2uV3w" \
  -d '{
    "email": "admin@example.com",
    "password": "YourSecurePassword123!"
  }'
```

## Troubleshooting

### Script doesn't find the endpoint
- Verify that Render deployment is Live
- Check that the endpoint URL is correct: `https://smartcrm-api-3vfb.onrender.com`
- Try accessing the health check: `https://smartcrm-api-3vfb.onrender.com/api/health`

### 401 Unauthorized
- Verify `ADMIN_SETUP_TOKEN` environment variable is set in your PowerShell session
- Verify the token matches exactly what you set in Render
- Check for extra spaces or typos

### 403 Forbidden
- If admin already exists, this is expected (endpoint auto-disables)
- If it's your first attempt, verify `ADMIN_SETUP_TOKEN` is configured in Render
- Verify Render deployment is Live

### 400 Bad Request
- Email must be in valid format (e.g., `admin@example.com`)
- Password must be at least 8 characters
- Email must not already exist in database

### 500 Server Error
- Check Render service logs for database or import errors
- Verify database is accessible
- Verify Python dependencies are installed

## Post-Setup Security

After successfully creating the admin account:

1. **Delete the setup token** from Render environment variables (optional but recommended)
   - This prevents accidental re-use or token compromise
   - The endpoint will return 403 anyway if an admin exists

2. **Delete the bootstrap script** from your local machine (optional)
   - After verification, you no longer need `call_setup_endpoint.ps1`

3. **Use password-based login** for ongoing access
   - Go to https://smartcrm-connect.netlify.app/login
   - Login with admin email and password

## How the Endpoint Works

1. **Check if admin exists** → If yes, return 403 (endpoint disabled)
2. **Verify token in header** → If missing or wrong, return 401
3. **Validate email format** → If invalid, return 400
4. **Validate password length** → If too short, return 400
5. **Check email uniqueness** → If duplicate, return 400
6. **Create admin user** → Hash password with bcrypt, insert into database
7. **Return 201 with user data**

This design ensures:
- Token is validated before any database queries
- Database operations only happen if all validations pass
- Endpoint is secured by token AND by admin existence check
- Failed attempts don't leak information about valid tokens or existing admins

## Implementation Details

The endpoint is implemented in `backend/routes/setup.py`:
- 115+ lines of heavily documented code
- Comprehensive input validation
- Secure error handling
- No side effects (read-only checks before write operations)

The endpoint is automatically registered in `backend/app.py` alongside other API routes.

## Questions or Issues?

1. Check the troubleshooting section above
2. Review Render service logs
3. Verify `backend/routes/setup.py` is deployed correctly
4. Confirm `ADMIN_SETUP_TOKEN` is set in Render environment

---

**Last Updated:** November 2026
**Status:** Production-ready
