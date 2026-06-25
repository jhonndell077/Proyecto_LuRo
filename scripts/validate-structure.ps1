$ErrorActionPreference = "Stop"

function Test-RequiredPath {
    param(
        [string]$Path,
        [string]$Label
    )

    $exists = Test-Path -LiteralPath $Path
    [pscustomobject]@{
        Area   = "Path"
        Item   = $Label
        Target = $Path
        Status = if ($exists) { "OK" } else { "MISSING" }
    }
}

function Test-FileContains {
    param(
        [string]$Path,
        [string]$Pattern,
        [string]$Label
    )

    $content = if (Test-Path -LiteralPath $Path) { Get-Content -LiteralPath $Path -Raw } else { "" }
    $match = $content -match $Pattern
    [pscustomobject]@{
        Area   = "Pattern"
        Item   = $Label
        Target = $Path
        Status = if ($match) { "OK" } else { "MISSING" }
    }
}

$root = Split-Path -Parent $MyInvocation.MyCommand.Path | Split-Path -Parent
Set-Location $root

$checks = @()

$checks += Test-RequiredPath "public/index.html" "Landing LuRo"
$checks += Test-RequiredPath "public/acceder.html" "Pantalla de acceso"
$checks += Test-RequiredPath "public/app.html" "Panel principal"
$checks += Test-RequiredPath "public/assets/js/app.js" "Motor principal frontend"
$checks += Test-RequiredPath "public/assets/js/cloud-bridge.js" "Puente cloud"
$checks += Test-RequiredPath "functions/index.js" "Backend Firebase Functions"
$checks += Test-RequiredPath "public/velvet-site/index.html" "Sitio La Foca Cheria"
$checks += Test-RequiredPath "public/velvet-admin/admin.html" "Admin La Foca Cheria"

$checks += Test-FileContains "public/app.html" 'id="luro-assistant-panel"' "Panel visual del Asistente LuRo"
$checks += Test-FileContains "public/app.html" 'onclick="toggleLuroAssistant\(' "Botones que abren el asistente"
$checks += Test-FileContains "public/assets/js/app.js" 'function assistantRefs\(' "Referencias del asistente"
$checks += Test-FileContains "public/assets/js/app.js" 'function abrirPanelAsistente\(' "Apertura del panel"
$checks += Test-FileContains "public/assets/js/app.js" 'window\.toggleLuroAssistant' "API global de apertura y cierre"
$checks += Test-FileContains "public/assets/js/app.js" 'window\.enviarMensajeAsistente\s*=\s*async function' "Envio de mensajes"
$checks += Test-FileContains "public/assets/js/app.js" 'ASSISTANT_ACTIONS' "Acciones del asistente"
$checks += Test-FileContains "public/assets/js/app.js" 'ASSISTANT_PAGES' "Modulos navegables del asistente"
$checks += Test-FileContains "public/assets/js/cloud-bridge.js" 'upsertOwnerData|getOwnerData' "Sincronizacion cloud de LuRo"
$checks += Test-FileContains "public/velvet-site/app.js" 'lafo_requests|registrarSolicitudLafo' "Memoria basica de Lafo"

$failed = $checks | Where-Object { $_.Status -ne "OK" }

Write-Host ""
Write-Host "Validacion de estructura de LuRo Control" -ForegroundColor Cyan
Write-Host "Raiz: $root" -ForegroundColor DarkGray
Write-Host ""

$checks | Format-Table -AutoSize

Write-Host ""
if ($failed.Count -gt 0) {
    Write-Host "Resultado: FALLO la validacion de estructura." -ForegroundColor Red
    exit 1
}

Write-Host "Resultado: estructura y puntos clave validados correctamente." -ForegroundColor Green
exit 0
