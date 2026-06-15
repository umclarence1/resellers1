# Sets production env vars on the dedicated reseller `backend` Vercel project.
$ErrorActionPreference = 'Continue'
Set-Location (Split-Path $PSScriptRoot -Parent)

function New-RandomHex([int]$Bytes = 48) {
  node -e "console.log(require('crypto').randomBytes($Bytes).toString('hex'))"
}

function Set-VercelEnv($Name, $Value) {
  if ([string]::IsNullOrWhiteSpace($Value)) { return }
  Write-Host "Setting $Name..."
  Push-Location backend
  vercel env add $Name production --value $Value --force --yes 2>&1 | Out-Null
  Pop-Location
}

$resellerEnv = @{}
Get-Content "backend\.env" | ForEach-Object {
  if ($_ -match '^\s*([^#=]+)=(.*)$') {
    $resellerEnv[$matches[1].Trim()] = $matches[2].Trim()
  }
}

$waecEnv = @{}
$waecPath = "..\waeccheckers\backend\.env"
if (Test-Path $waecPath) {
  Get-Content $waecPath | ForEach-Object {
    if ($_ -match '^\s*([^#=]+)=(.*)$') {
      $waecEnv[$matches[1].Trim()] = $matches[2].Trim()
    }
  }
}

$jwt = $resellerEnv['JWT_SECRET']
if ([string]::IsNullOrWhiteSpace($jwt) -or $jwt -match 'change-in-production|dev-secret|changeme|your-super-secret') {
  $jwt = New-RandomHex 48
  Write-Host "Generated strong JWT_SECRET for production"
}

$refresh = $resellerEnv['REFRESH_TOKEN_SECRET']
if ([string]::IsNullOrWhiteSpace($refresh) -or $refresh -eq $jwt) {
  $refresh = New-RandomHex 48
  Write-Host "Generated REFRESH_TOKEN_SECRET for production"
}

$encryption = $resellerEnv['ENCRYPTION_KEY']
if ([string]::IsNullOrWhiteSpace($encryption) -or $encryption.Length -lt 32) {
  $encryption = New-RandomHex 32
  Write-Host "Generated ENCRYPTION_KEY for production"
}

$agentEmail = $resellerEnv['DEMO_AGENT_EMAIL']
if ([string]::IsNullOrWhiteSpace($agentEmail)) { $agentEmail = $resellerEnv['DEMO_DEALER_EMAIL'] }
if ([string]::IsNullOrWhiteSpace($agentEmail)) { $agentEmail = 'agent@databundle.test' }

$agentPassword = $resellerEnv['DEMO_AGENT_PASSWORD']
if ([string]::IsNullOrWhiteSpace($agentPassword)) { $agentPassword = $resellerEnv['DEMO_DEALER_PASSWORD'] }
if ([string]::IsNullOrWhiteSpace($agentPassword)) { $agentPassword = 'Agent@12345' }

Set-VercelEnv 'NODE_ENV' 'production'
Set-VercelEnv 'DEV_SKIP_OTP' 'false'
Set-VercelEnv 'FRONTEND_URL' 'https://frontend-teal-nu-674288cs0m.vercel.app'
Set-VercelEnv 'API_URL' 'https://backend-snowy-eight-68.vercel.app'
Set-VercelEnv 'MONGODB_URI' $resellerEnv['MONGODB_URI']
Set-VercelEnv 'JWT_SECRET' $jwt
Set-VercelEnv 'REFRESH_TOKEN_SECRET' $refresh
Set-VercelEnv 'ENCRYPTION_KEY' $encryption
Set-VercelEnv 'JWT_EXPIRES_IN' '15m'
Set-VercelEnv 'ADMIN_EMAIL' $resellerEnv['ADMIN_EMAIL']
Set-VercelEnv 'ADMIN_PASSWORD' $resellerEnv['ADMIN_PASSWORD']
Set-VercelEnv 'ADMIN_NAME' $resellerEnv['ADMIN_NAME']
Set-VercelEnv 'SMTP_HOST' $resellerEnv['SMTP_HOST']
Set-VercelEnv 'SMTP_PORT' '465'
Set-VercelEnv 'RESEND_API_KEY' $resellerEnv['RESEND_API_KEY']
Set-VercelEnv 'RESEND_FROM' $resellerEnv['RESEND_FROM']
Set-VercelEnv 'SMTP_USER' $resellerEnv['SMTP_USER']
Set-VercelEnv 'SMTP_PASS' $resellerEnv['SMTP_PASS']
Set-VercelEnv 'EMAIL_FROM' $resellerEnv['EMAIL_FROM']
Set-VercelEnv 'PAYSTACK_SECRET_KEY' $(if ($waecEnv['PAYSTACK_SECRET_KEY']) { $waecEnv['PAYSTACK_SECRET_KEY'] } else { $resellerEnv['PAYSTACK_SECRET_KEY'] })
Set-VercelEnv 'PAYSTACK_PUBLIC_KEY' $(if ($waecEnv['PAYSTACK_PUBLIC_KEY']) { $waecEnv['PAYSTACK_PUBLIC_KEY'] } else { $resellerEnv['PAYSTACK_PUBLIC_KEY'] })
Set-VercelEnv 'DEMO_AGENT_EMAIL' $agentEmail
Set-VercelEnv 'DEMO_AGENT_PASSWORD' $agentPassword
Set-VercelEnv 'DEMO_RESELLER_EMAIL' $resellerEnv['DEMO_RESELLER_EMAIL']
Set-VercelEnv 'DEMO_RESELLER_PASSWORD' $resellerEnv['DEMO_RESELLER_PASSWORD']

Write-Host 'Done setting reseller backend env vars.'
