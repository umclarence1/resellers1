# Sets production env vars on the reseller frontend Vercel project.
$ErrorActionPreference = 'Continue'
Set-Location (Split-Path $PSScriptRoot -Parent)

function Set-FrontendVercelEnv($Name, $Value) {
  if ([string]::IsNullOrWhiteSpace($Value)) { return }
  Write-Host "Setting $Name..."
  Push-Location frontend
  vercel env add $Name production --value $Value --force --yes 2>&1 | Out-Null
  Pop-Location
}

Set-FrontendVercelEnv 'VITE_API_URL' '/api'
Set-FrontendVercelEnv 'VITE_APP_URL' 'https://www.topdealsgh.com'

Write-Host 'Done setting reseller frontend env vars.'
