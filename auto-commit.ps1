# SmartCRM Auto-Commit Watcher
# Watches for file changes and auto-commits + pushes to GitHub

$git = "C:\Users\DHANUSH S A\.qoder\bin\git\cmd\git.exe"
$repoPath = "D:\python\CRM"
$debounceSeconds = 10   # wait 10s after last change before committing

Write-Host "[AutoCommit] Watching $repoPath for changes..." -ForegroundColor Cyan
Write-Host "[AutoCommit] Will auto-commit + push every time files change (10s debounce)" -ForegroundColor Cyan

Set-Location $repoPath

$watcher = New-Object System.IO.FileSystemWatcher
$watcher.Path = $repoPath
$watcher.IncludeSubdirectories = $true
$watcher.EnableRaisingEvents = $true

# Ignore patterns
$ignorePatterns = @(
    "\.git\", "__pycache__\", "node_modules\", ".venv\",
    "dist\", "build\", "\.pytest_cache\", "\.hypothesis\",
    "instance\", "*.db", "*.sqlite", "*.pyc", "*.log"
)

$lastChange = [DateTime]::MinValue
$pendingCommit = $false

$action = {
    $path = $Event.SourceEventArgs.FullPath
    
    # Skip ignored paths
    foreach ($pattern in @(".git\", "__pycache__\", "node_modules\", ".venv\", "dist\", ".pytest_cache\", "instance\", ".hypothesis\")) {
        if ($path -like "*$pattern*") { return }
    }
    if ($path -match "\.(db|sqlite|pyc|log)$") { return }
    
    $script:lastChange = [DateTime]::UtcNow
    $script:pendingCommit = $true
    Write-Host "[AutoCommit] Change detected: $($path.Replace($repoPath, ''))" -ForegroundColor Yellow
}

Register-ObjectEvent $watcher "Changed" -Action $action | Out-Null
Register-ObjectEvent $watcher "Created" -Action $action | Out-Null
Register-ObjectEvent $watcher "Deleted" -Action $action | Out-Null
Register-ObjectEvent $watcher "Renamed" -Action $action | Out-Null

try {
    while ($true) {
        Start-Sleep -Seconds 2
        
        if ($pendingCommit) {
            $elapsed = ([DateTime]::UtcNow - $lastChange).TotalSeconds
            if ($elapsed -ge $debounceSeconds) {
                $pendingCommit = $false
                Set-Location $repoPath
                
                # Check if there are actual changes
                $status = & $git status --porcelain 2>&1
                if ($status) {
                    $timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
                    $changedFiles = ($status | Measure-Object -Line).Lines
                    
                    Write-Host "[AutoCommit] Committing $changedFiles changed file(s)..." -ForegroundColor Green
                    & $git add . 2>&1 | Out-Null
                    & $git commit -m "Auto-commit: $changedFiles file(s) changed [$timestamp]" 2>&1 | Out-Null
                    
                    Write-Host "[AutoCommit] Pushing to GitHub..." -ForegroundColor Green
                    $pushResult = & $git push origin main 2>&1
                    Write-Host "[AutoCommit] Pushed successfully at $timestamp" -ForegroundColor Green
                }
            }
        }
    }
}
finally {
    $watcher.Dispose()
    Write-Host "[AutoCommit] Watcher stopped." -ForegroundColor Red
}
