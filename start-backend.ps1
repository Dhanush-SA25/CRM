# SmartCRM Backend Starter
$ErrorActionPreference = "Stop"

$root = $PSScriptRoot
$python = Join-Path $root "backend\.venv\Scripts\python.exe"
if (-not (Test-Path $python)) {
  Write-Host "Python virtual environment not found at backend\.venv" -ForegroundColor Red
  Write-Host "Create it with:  python -m venv backend\.venv && backend\.venv\Scripts\pip install -r backend\requirements.txt" -ForegroundColor Yellow
  exit 1
}

Write-Host "Starting SmartCRM Backend..." -ForegroundColor Cyan
Set-Location (Join-Path $root "backend")

# Ensure DB tables + seed data exist silently
& $python -c @"
import sys
sys.path.insert(0, r'$root\backend')
from dotenv import load_dotenv
load_dotenv(r'$root\backend\.env')
from app import create_app
app = create_app()
with app.app_context():
    from database.db import db
    db.create_all()
    from models.user import User
    if User.query.count() == 0:
        from database.seed import seed_database
        seed_database(app)
        print('Database seeded with demo data.')
    else:
        print(f'Database ready. Users: {User.query.count()}')
"@

Write-Host ""
Write-Host "Backend running at http://localhost:5000" -ForegroundColor Green
Write-Host "Health check: http://localhost:5000/api/health" -ForegroundColor Gray
Write-Host "Demo login: admin@smartcrm.com / admin123" -ForegroundColor Yellow
Write-Host "Press Ctrl+C to stop." -ForegroundColor Gray
Write-Host ""

& $python (Join-Path $root "backend\app.py")
