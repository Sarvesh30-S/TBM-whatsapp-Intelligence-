# Manual helper for the Meta WhatsApp Groups API (uses credentials from .env).
# Usage:
#   .\meta-groups.ps1 list
#   .\meta-groups.ps1 create -Subject "TBM Test Pod 1"
#   .\meta-groups.ps1 invite -GroupId "<group id>"
param(
    [Parameter(Position = 0)][ValidateSet("list", "create", "invite")][string]$Action = "list",
    [string]$Subject = "TBM Test Pod 1",
    [string]$GroupId
)

$envFile = Join-Path $PSScriptRoot ".env"
$cfg = @{}
Get-Content $envFile | ForEach-Object {
    if ($_ -match "^\s*([A-Z_]+)\s*=\s*(.*)$") { $cfg[$matches[1]] = $matches[2].Trim() }
}
$token = $cfg["META_ACCESS_TOKEN"]
$phoneId = $cfg["META_PHONE_NUMBER_ID"]
$version = if ($cfg["META_GRAPH_API_VERSION"]) { $cfg["META_GRAPH_API_VERSION"] } else { "v23.0" }
if (-not $token -or -not $phoneId) { Write-Host "[ERROR] META_ACCESS_TOKEN / META_PHONE_NUMBER_ID missing in .env" -ForegroundColor Red; exit 1 }

$base = "https://graph.facebook.com/$version"
$headers = @{ Authorization = "Bearer $token" }

function Show($label, $scriptBlock) {
    try {
        $result = & $scriptBlock
        Write-Host "[OK] $label" -ForegroundColor Green
        $result | ConvertTo-Json -Depth 10
    } catch {
        Write-Host "[FAILED] $label" -ForegroundColor Red
        $detail = ""
        if ($_.ErrorDetails -and $_.ErrorDetails.Message) {
            $detail = $_.ErrorDetails.Message
        } elseif ($_.Exception.Response) {
            try {
                $stream = $_.Exception.Response.GetResponseStream()
                if ($stream) {
                    $reader = New-Object System.IO.StreamReader($stream)
                    $detail = $reader.ReadToEnd()
                }
            } catch {}
        }
        if (-not $detail) { $detail = $_.Exception.Message }
        Write-Host $detail -ForegroundColor Yellow
    }
}

switch ($Action) {
    "list" {
        Show "Groups owned by phone number $phoneId" {
            Invoke-RestMethod -Uri "$base/$phoneId/groups" -Headers $headers -Method Get
        }
    }
    "create" {
        $body = @{ messaging_product = "whatsapp"; subject = $Subject } | ConvertTo-Json
        Show "Create group '$Subject'" {
            Invoke-RestMethod -Uri "$base/$phoneId/groups" -Headers $headers -Method Post -Body $body -ContentType "application/json"
        }
        Write-Host "`nNext: run '.\meta-groups.ps1 list' to get the Group ID, then '.\meta-groups.ps1 invite -GroupId <id>'." -ForegroundColor Cyan
    }
    "invite" {
        if (-not $GroupId) { Write-Host "[ERROR] -GroupId is required" -ForegroundColor Red; exit 1 }
        Show "Invite link for group $GroupId" {
            Invoke-RestMethod -Uri "$base/$GroupId/invite_link" -Headers $headers -Method Get
        }
    }
}
