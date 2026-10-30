# Launch the WhatsApp Web Bridge
$bridgeDir = Join-Path $PSScriptRoot "whatsapp-bridge"
Set-Location $bridgeDir
Write-Host "Starting WhatsApp Web Bridge..." -ForegroundColor Cyan
node bridge.js
