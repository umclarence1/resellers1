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

Set-FrontendVercelEnv 'VITE_API_URL' 'https://resellers1-api.vercel.app/api'
Set-FrontendVercelEnv 'VITE_APP_URL' 'https://resellers1.vercel.app'

Write-Host 'Done setting reseller frontend env vars.'
