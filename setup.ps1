<#
.SYNOPSIS
    PhishGuard - one-time setup: PM2 + Cloudflare Tunnel
    Just run: .\setup.ps1
    It will self-elevate to Administrator automatically.
#>

# Self-elevate if not already running as Administrator
$isAdmin = ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
if (-not $isAdmin) {
    Write-Host "Not running as Administrator - relaunching elevated..." -ForegroundColor Yellow
    Start-Process powershell.exe -Verb RunAs -ArgumentList "-NoExit -ExecutionPolicy Bypass -File `"$PSCommandPath`""
    exit
}

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$ROOT     = $PSScriptRoot
$FRONTEND = Join-Path $ROOT 'frontend'
$CF_DIR   = Join-Path $ROOT 'cloudflared'
$CF_CFG   = Join-Path $CF_DIR 'config.yml'
$NPM      = 'C:\Program Files\nodejs\npm.cmd'
$NODE     = 'C:\Program Files\nodejs\node.exe'

function Write-Step { param($n, $msg) Write-Host "" ; Write-Host "[$n] $msg" -ForegroundColor Cyan }
function Write-Ok   { param($msg) Write-Host "    OK: $msg" -ForegroundColor Green }
function Write-Warn { param($msg) Write-Host "    !! $msg" -ForegroundColor Yellow }
function Write-Fail { param($msg) Write-Host "    FAILED: $msg" -ForegroundColor Red ; exit 1 }

function Wait-ForUser {
    param($msg)
    Write-Host ""
    Write-Host $msg -ForegroundColor Yellow
    Read-Host "Press Enter to continue"
}

# -------------------------------------------------------
Write-Host ""
Write-Host "========================================" -ForegroundColor Magenta
Write-Host "  PhishGuard - One-Time Setup Script   " -ForegroundColor Magenta
Write-Host "  PM2 + Cloudflare Tunnel (Option A)   " -ForegroundColor Magenta
Write-Host "========================================" -ForegroundColor Magenta
Write-Host ""

# -------------------------------------------------------
Write-Step 1 "Checking prerequisites"

if (-not (Test-Path $NODE)) { Write-Fail "Node.js not found at $NODE. Install from https://nodejs.org" }
Write-Ok "Node.js found"

$nodeVer = & $NODE --version 2>&1
Write-Ok "Node.js version: $nodeVer"

# -------------------------------------------------------
Write-Step 2 "Building React frontend"

Push-Location $FRONTEND
try {
    & $NPM run build 2>&1 | ForEach-Object { Write-Host "    $_" }
    if ($LASTEXITCODE -ne 0) { Write-Fail "Frontend build failed" }
    Write-Ok "Frontend built successfully -> frontend/dist/"
} finally {
    Pop-Location
}

# -------------------------------------------------------
Write-Step 3 "Installing PM2 globally"

$pm2Check = & $NPM list -g pm2 --depth=0 2>&1
if ($pm2Check -notmatch 'pm2@') {
    Write-Host "    Installing PM2..." -ForegroundColor DarkGray
    & $NPM install -g pm2 2>&1 | Out-Null
    Write-Ok "PM2 installed"
} else {
    Write-Ok "PM2 already installed"
}

$startupCheck = & $NPM list -g pm2-windows-startup --depth=0 2>&1
if ($startupCheck -notmatch 'pm2-windows-startup@') {
    Write-Host "    Installing pm2-windows-startup..." -ForegroundColor DarkGray
    & $NPM install -g pm2-windows-startup 2>&1 | Out-Null
    Write-Ok "pm2-windows-startup installed"
} else {
    Write-Ok "pm2-windows-startup already installed"
}

# -------------------------------------------------------
Write-Step 4 "Installing cloudflared"

$cfCmd = Get-Command cloudflared -ErrorAction SilentlyContinue
$cfExe = if ($cfCmd) { $cfCmd.Source } else { $null }

if (-not $cfExe) {
    Write-Warn "cloudflared not found - installing via winget..."
    winget install --id Cloudflare.cloudflared --silent --accept-source-agreements --accept-package-agreements
    # Refresh PATH for current session
    $env:Path = [System.Environment]::GetEnvironmentVariable('Path', 'Machine') + ';' +
                [System.Environment]::GetEnvironmentVariable('Path', 'User')
    $cfCmd = Get-Command cloudflared -ErrorAction SilentlyContinue
    $cfExe = if ($cfCmd) { $cfCmd.Source } else { $null }
    if (-not $cfExe) {
        Write-Fail "cloudflared install failed. Download manually from https://github.com/cloudflare/cloudflared/releases"
    }
    Write-Ok "cloudflared installed"
} else {
    Write-Ok "cloudflared found: $cfExe"
}

# -------------------------------------------------------
Write-Step 5 "Logging into Cloudflare"

$certPath = Join-Path $env:USERPROFILE '.cloudflared\cert.pem'
if (Test-Path $certPath) {
    Write-Ok "Already authenticated with Cloudflare"
} else {
    Wait-ForUser "A browser will open - log in with your FREE Cloudflare account (https://cloudflare.com). Press Enter to open it."
    cloudflared tunnel login
    if (-not (Test-Path $certPath)) {
        Write-Fail "Cloudflare login did not complete. Re-run the script and try again."
    }
    Write-Ok "Authenticated with Cloudflare"
}

# -------------------------------------------------------
Write-Step 6 "Creating Cloudflare Tunnel named 'phishguard'"

$TUNNEL_ID = $null

# Check if tunnel already exists
try {
    $listJson = cloudflared tunnel list --output json 2>$null
    $existingTunnels = $listJson | ConvertFrom-Json
    $existing = $existingTunnels | Where-Object { $_.name -eq 'phishguard' }
    if ($existing) {
        $TUNNEL_ID = $existing.id
        Write-Ok "Tunnel 'phishguard' already exists (ID: $TUNNEL_ID)"
    }
} catch {
    # No tunnels yet or parse error - will create below
}

if (-not $TUNNEL_ID) {
    $createOutput = cloudflared tunnel create phishguard 2>&1
    Write-Host ($createOutput | Out-String)
    # Extract UUID from output
    $uuidMatch = ($createOutput | Out-String) | Select-String -Pattern '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}'
    if ($uuidMatch) {
        $TUNNEL_ID = $uuidMatch.Matches[0].Value
    }
    if (-not $TUNNEL_ID) {
        Write-Fail "Could not extract tunnel ID. Check output above."
    }
    Write-Ok "Tunnel created (ID: $TUNNEL_ID)"
}

$CRED_FILE = Join-Path $env:USERPROFILE ".cloudflared\$TUNNEL_ID.json"
if (-not (Test-Path $CRED_FILE)) {
    Write-Fail "Credentials file not found at: $CRED_FILE"
}

# -------------------------------------------------------
Write-Step 7 "Writing cloudflared/config.yml"

$cfgContent = "# Cloudflare Tunnel config - auto-generated by setup.ps1`n"
$cfgContent += "tunnel: $TUNNEL_ID`n"
$cfgContent += "credentials-file: $CRED_FILE`n"
$cfgContent += "`ningress:`n"
$cfgContent += "  - service: http://localhost:4000`n"

[System.IO.File]::WriteAllText($CF_CFG, $cfgContent, [System.Text.Encoding]::ASCII)
Write-Ok "Config written -> cloudflared/config.yml"

# -------------------------------------------------------
Write-Step 8 "Your permanent public URL"

$PUBLIC_URL = "https://$TUNNEL_ID.cfargotunnel.com"
Write-Ok "Permanent URL: $PUBLIC_URL"
Write-Warn "Optional - if you own a domain on Cloudflare, run this to get a clean URL:"
Write-Host "     cloudflared tunnel route dns phishguard phishguard.yourdomain.com" -ForegroundColor DarkGray

# -------------------------------------------------------
Write-Step 9 "Installing cloudflared as Windows Service"

$svc = Get-Service -Name 'Cloudflared' -ErrorAction SilentlyContinue
if ($svc) {
    Write-Warn "Existing Cloudflared service found - reinstalling..."
    cloudflared service uninstall 2>&1 | Out-Null
}

cloudflared service install --config $CF_CFG 2>&1
Start-Service -Name 'Cloudflared'

$svc = Get-Service -Name 'Cloudflared' -ErrorAction SilentlyContinue
if ($svc -and $svc.Status -eq 'Running') {
    Write-Ok "Cloudflare Tunnel Windows Service installed and running"
} else {
    Write-Warn "Service may not have started yet. Check: Get-Service Cloudflared"
}

# -------------------------------------------------------
Write-Step 10 "Starting PhishGuard with PM2"

Push-Location $ROOT
try {
    pm2 delete phishguard 2>&1 | Out-Null
    pm2 start ecosystem.config.cjs --env production
    if ($LASTEXITCODE -ne 0) { Write-Fail "PM2 failed to start the app" }
    pm2 save 2>&1 | Out-Null
    Write-Ok "PhishGuard started via PM2"
} finally {
    Pop-Location
}

# -------------------------------------------------------
Write-Step 11 "Configuring PM2 to auto-start with Windows"

pm2-windows-startup install 2>&1 | Out-Null
Write-Ok "PM2 registered with Windows startup"

# -------------------------------------------------------
Write-Step 12 "Verifying"

Start-Sleep -Seconds 4

try {
    $health = Invoke-RestMethod -Uri 'http://localhost:4000/health' -TimeoutSec 5
    if ($health.status -eq 'ok') {
        Write-Ok "Node.js server is healthy on localhost:4000"
    }
} catch {
    Write-Warn "Server not yet responding - check: pm2 logs phishguard"
}

$tunnelSvc = Get-Service -Name 'Cloudflared' -ErrorAction SilentlyContinue
if ($tunnelSvc -and $tunnelSvc.Status -eq 'Running') {
    Write-Ok "Cloudflare Tunnel service is running"
} else {
    Write-Warn "Tunnel service not running - check: Get-Service Cloudflared"
}

# -------------------------------------------------------
Write-Host ""
Write-Host "========================================" -ForegroundColor Green
Write-Host "  Setup Complete!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host ""
Write-Host "  Public URL: $PUBLIC_URL" -ForegroundColor Green
Write-Host ""
Write-Host "  Both services auto-start on Windows boot." -ForegroundColor White
Write-Host "  No terminal needs to stay open." -ForegroundColor White
Write-Host ""
Write-Host "  Useful commands:" -ForegroundColor Yellow
Write-Host "    pm2 status              - check if app is running" -ForegroundColor DarkGray
Write-Host "    pm2 logs phishguard     - live app logs" -ForegroundColor DarkGray
Write-Host "    pm2 restart phishguard  - restart after code changes" -ForegroundColor DarkGray
Write-Host "    Get-Service Cloudflared - check tunnel service" -ForegroundColor DarkGray
Write-Host ""
Write-Host "  After making code changes:" -ForegroundColor Yellow
Write-Host "    1. cd frontend; npm run build" -ForegroundColor DarkGray
Write-Host "    2. pm2 restart phishguard" -ForegroundColor DarkGray
Write-Host "    3. Visit $PUBLIC_URL - live immediately" -ForegroundColor DarkGray
Write-Host ""
