#!/usr/bin/env pwsh

# Kill any node processes
Get-Process | Where-Object { $_.ProcessName -eq "node" -or $_.ProcessName -eq "npm" } | Stop-Process -Force -ErrorAction SilentlyContinue

# Wait a bit
Start-Sleep -Seconds 2

# Remove .next directory
$nextDir = ".\.next"
if (Test-Path $nextDir) {
    Remove-Item -Recurse -Force $nextDir
    Write-Host ".next directory removed"
}

# Run build
Write-Host "Starting build..."
npm run build

Write-Host "Build complete!"
