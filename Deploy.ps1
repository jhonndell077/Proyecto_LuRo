[CmdletBinding()]
param(
  [ValidateSet('hosting','functions','all')]
  [string]$Target = 'hosting',
  [switch]$Analyze
)

$scriptPath = Join-Path $PSScriptRoot 'scripts\deploy-safe.ps1'
if (-not (Test-Path -LiteralPath $scriptPath)) {
  Write-Host "ERROR: No se encontro $scriptPath" -ForegroundColor Red
  exit 1
}

if ($Analyze) {
  & $scriptPath -Target $Target -AnalyzeOnly
} else {
  & $scriptPath -Target $Target
}
exit $LASTEXITCODE
