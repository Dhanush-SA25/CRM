# SmartCRM Frontend Starter
$ErrorActionPreference = "Stop"

$node = (Get-Command node -ErrorAction SilentlyContinue).Source
if (-not $node) {
  $fallback = "D:\python\node.exe"
  if (Test-Path $fallback) { $node = $fallback }
}
if (-not $node) {
  Write-Host "Node.js was not found on PATH and D:\python\node.exe does not exist." -ForegroundColor Red
  Write-Host "Install Node.js 18+ from https://nodejs.org and reopen this terminal." -ForegroundColor Yellow
  exit 1
}

$npm = (Get-Command npm -ErrorAction SilentlyContinue).Source
Write-Host "Node: $(& $node --version)" -ForegroundColor Gray
if ($npm) { Write-Host "npm:  $(& $npm --version)" -ForegroundColor Gray }

Set-Location "$PSScriptRoot\frontend"

if (-not (Test-Path "$PSScriptRoot\frontend\node_modules")) {
  Write-Host "Frontend dependencies are missing. Run: npm install" -ForegroundColor Yellow
  exit 1
}

Write-Host ""
Write-Host "Starting SmartCRM Frontend..." -ForegroundColor Cyan
Write-Host "Frontend running at http://localhost:5173" -ForegroundColor Green
Write-Host "Backend must be running at http://localhost:5000" -ForegroundColor Yellow
Write-Host "Press Ctrl+C to stop." -ForegroundColor Gray
Write-Host ""

& $node "$PSScriptRoot\frontend\node_modules\vite\bin\vite.js"
