param(
    [string]$Text = "Urgent from client: please approve the revised budget and campaign invoice before 5 PM today!",
    [string]$GroupId = "demo-group-101@g.us",
    [string]$Sender = "919876543210"
)

$envFile = Join-Path $PSScriptRoot ".env"
$secret = "719b4449fd0dff158fa1c2217207a4cf"

if (Test-Path $envFile) {
    Get-Content $envFile | ForEach-Object {
        if ($_ -match "^\s*META_APP_SECRET\s*=\s*(.+)$") {
            $secret = $matches[1].Trim()
        }
    }
}

$msgId = "wamid.test." + [System.Guid]::NewGuid().ToString().Substring(0, 8)
$timestamp = [DateTimeOffset]::UtcNow.ToUnixTimeSeconds()

$body = "{`"object`":`"whatsapp_business_account`",`"entry`":[{`"id`":`"1249970158206146`",`"changes`":[{`"field`":`"messages`",`"value`":{`"metadata`":{`"phone_number_id`":`"1310637042128885`"},`"messages`":[{`"from`":`"$Sender`",`"id`":`"$msgId`",`"timestamp`":`"$timestamp`",`"type`":`"text`",`"group_id`":`"$GroupId`",`"text`":{`"body`":`"$Text`"}}]}}]}]}"

# Compute HMAC-SHA256 signature
$hmac = New-Object System.Security.Cryptography.HMACSHA256
$hmac.Key = [System.Text.Encoding]::UTF8.GetBytes($secret)
$hash = $hmac.ComputeHash([System.Text.Encoding]::UTF8.GetBytes($body))
$sig = "sha256=" + [System.BitConverter]::ToString($hash).Replace("-", "").ToLower()

Write-Host "==========================================" -ForegroundColor Cyan
Write-Host " SENDING SIMULATED WHATSAPP CLIENT MESSAGE" -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "Group ID:  $GroupId" -ForegroundColor Yellow
Write-Host "Sender:    +$Sender" -ForegroundColor Yellow
Write-Host "Message:   $Text" -ForegroundColor White
Write-Host "Target:    http://localhost:8081/webhook/whatsapp" -ForegroundColor Gray
Write-Host ""

try {
    $headers = @{ "X-Hub-Signature-256" = $sig }
    $res = Invoke-WebRequest -Uri "http://localhost:8081/webhook/whatsapp" -Method Post -Body $body -ContentType "application/json" -Headers $headers -UseBasicParsing
    Write-Host "[OK] Webhook delivered and accepted: HTTP $($res.StatusCode)" -ForegroundColor Green

    Start-Sleep -Milliseconds 600

    $health = Invoke-RestMethod -Uri "http://localhost:8081/api/health" -Method Get
    Write-Host "[OK] Ingested successfully into database." -ForegroundColor Green
    Write-Host "    Total Messages Stored: $($health.storedMessages)" -ForegroundColor Gray
    Write-Host "    Total Webhook Events:  $($health.storedWebhookEvents)" -ForegroundColor Gray
    Write-Host ""
    Write-Host "Open the dashboard to see your message in the Inbox:" -ForegroundColor Cyan
    Write-Host "  -> http://localhost:3000" -ForegroundColor Green
} catch {
    Write-Host "[ERROR] Failed: $($_.Exception.Message)" -ForegroundColor Red
}
