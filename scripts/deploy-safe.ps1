[CmdletBinding()]
param(
  [ValidateSet('hosting','functions','all')]
  [string]$Target = 'hosting',
  [string]$Remote = 'origin',
  [switch]$AnalyzeOnly
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

$report = [ordered]@{
  Mode = if ($AnalyzeOnly) { 'analisis' } else { 'ejecucion' }
  Branch = 'N/A'
  LocalState = 'sin revisar'
  GitHubState = 'sin revisar'
  GitAdd = 'no ejecutado'
  GitCommit = 'no ejecutado'
  GitPush = 'no ejecutado'
  CommitMessage = 'sin commit'
  CommitDateTime = 'N/A'
  GitHubLastUpdate = 'N/A'
  FirebaseState = 'sin revisar'
  FirebaseService = if ($Target -eq 'hosting') { 'hosting' } elseif ($Target -eq 'functions') { 'functions' } else { 'functions + hosting' }
  FirebaseDeployTime = 'N/A'
  FirebaseLastDeploy = 'N/A'
  GitHubBehindFirebase = 'no determinado'
  Problem = 'sin problemas detectados'
  Recommendation = 'continuar con el flujo seguro de respaldo en GitHub antes de Firebase'
  Result = 'en proceso'
  ErrorStep = ''
  ErrorDetail = ''
}

function Format-DateDisplay {
  param([string]$IsoDate)
  if ([string]::IsNullOrWhiteSpace($IsoDate)) { return 'N/A' }
  try {
    $dto = [DateTimeOffset]::Parse($IsoDate)
    return $dto.ToLocalTime().ToString('yyyy-MM-dd HH:mm:ss zzz')
  } catch {
    return $IsoDate
  }
}

function Print-AnalysisReport {
  Write-Host "Estado actual GitHub: $($report.GitHubState)"
  Write-Host "Estado actual Firebase: $($report.FirebaseState)"
  Write-Host "GitHub atrasado respecto al deploy: $($report.GitHubBehindFirebase)"
  Write-Host "Fecha y hora de la ultima actualizacion detectada en GitHub: $($report.GitHubLastUpdate)"
  Write-Host "Fecha y hora del ultimo deploy detectado en Firebase: $($report.FirebaseLastDeploy)"
  Write-Host "Problema encontrado: $($report.Problem)"
  Write-Host "Recomendacion concreta: $($report.Recommendation)"
}

function Print-ExecutionReport {
  Write-Host "Estado local: $($report.LocalState)"
  Write-Host "GitHub: $($report.GitHubState)"
  Write-Host "Git add: $($report.GitAdd)"
  Write-Host "Git commit: $($report.GitCommit)"
  Write-Host "Git push: $($report.GitPush)"
  Write-Host "Rama utilizada: $($report.Branch)"
  Write-Host "Mensaje de commit: $($report.CommitMessage)"
  Write-Host "Fecha y hora commit: $($report.CommitDateTime)"
  Write-Host "Commit: $($report.CommitMessage) - $($report.CommitDateTime)"
  Write-Host "Firebase: $($report.FirebaseState)"
  Write-Host "Servicio actualizado: $($report.FirebaseService)"
  Write-Host "Fecha y hora deploy: $($report.FirebaseDeployTime)"
  if (-not [string]::IsNullOrWhiteSpace($report.ErrorStep)) {
    Write-Host "Error detectado en paso: $($report.ErrorStep)"
    Write-Host "Explicacion: $($report.ErrorDetail)"
  }
  Write-Host "Resultado: $($report.Result)"
}

function Stop-WithError {
  param(
    [string]$Step,
    [string]$SimpleMessage,
    [string]$TechnicalMessage = ''
  )

  $report.ErrorStep = $Step
  $report.ErrorDetail = $SimpleMessage
  $report.Result = 'error detectado'
  $report.Problem = $SimpleMessage

  if ([string]::IsNullOrWhiteSpace($TechnicalMessage)) {
    $report.Recommendation = 'Revise este paso y vuelva a ejecutar Deploy.'
  } else {
    $report.Recommendation = "Revise este paso y vuelva a ejecutar Deploy. Detalle tecnico: $TechnicalMessage"
  }

  if ($AnalyzeOnly) {
    Print-AnalysisReport
  } else {
    Print-ExecutionReport
  }

  exit 1
}

function Run-GitChecked {
  param(
    [Parameter(Mandatory = $true)]
    [string[]]$Args,
    [Parameter(Mandatory = $true)]
    [string]$Step,
    [Parameter(Mandatory = $true)]
    [string]$SimpleError
  )

  & git @Args
  if ($LASTEXITCODE -ne 0) {
    Stop-WithError -Step $Step -SimpleMessage $SimpleError
  }
}

function Get-RepoRoot {
  $root = (& git rev-parse --show-toplevel 2>$null)
  if ($LASTEXITCODE -ne 0 -or [string]::IsNullOrWhiteSpace($root)) {
    Stop-WithError -Step 'validacion previa' -SimpleMessage 'No se detecto un repositorio Git en esta ruta.'
  }
  return [string]$root
}

function Get-CurrentBranch {
  $branch = (& git rev-parse --abbrev-ref HEAD 2>$null)
  if ($LASTEXITCODE -ne 0) {
    Stop-WithError -Step 'validacion previa' -SimpleMessage 'No se pudo detectar la rama actual.'
  }
  return [string]$branch
}

function Get-DefaultBranch {
  param([string]$RemoteName)
  $remoteHead = (& git symbolic-ref --quiet --short "refs/remotes/$RemoteName/HEAD" 2>$null)
  if ($LASTEXITCODE -eq 0 -and -not [string]::IsNullOrWhiteSpace($remoteHead)) {
    return [string]($remoteHead -replace "^$RemoteName/", '')
  }
  return Get-CurrentBranch
}

function Get-Divergence {
  param(
    [string]$RemoteName,
    [string]$Branch
  )

  $raw = (& git rev-list --left-right --count "$RemoteName/$Branch...HEAD" 2>$null)
  if ($LASTEXITCODE -ne 0 -or [string]::IsNullOrWhiteSpace($raw)) {
    Stop-WithError -Step 'git push' -SimpleMessage "No se pudo comparar la rama local con $RemoteName/$Branch."
  }

  $parts = $raw.Trim() -split '\s+'
  if ($parts.Count -lt 2) {
    Stop-WithError -Step 'git push' -SimpleMessage 'No se pudo interpretar la diferencia entre GitHub y tu rama local.'
  }

  return [PSCustomObject]@{
    Behind = [int]$parts[0]
    Ahead = [int]$parts[1]
  }
}

function Get-FirebaseSite {
  $defaultSite = 'luro-control'
  if (-not (Test-Path -LiteralPath 'firebase.json')) { return $defaultSite }
  try {
    $jsonRaw = Get-Content -LiteralPath 'firebase.json' -Raw
    $jsonObj = $jsonRaw | ConvertFrom-Json
    if ($null -ne $jsonObj.hosting) {
      if ($jsonObj.hosting -is [System.Array]) {
        $first = $jsonObj.hosting | Select-Object -First 1
        if ($first -and -not [string]::IsNullOrWhiteSpace([string]$first.site)) {
          return [string]$first.site
        }
      } elseif (-not [string]::IsNullOrWhiteSpace([string]$jsonObj.hosting.site)) {
        return [string]$jsonObj.hosting.site
      }
    }
  } catch {
    return $defaultSite
  }
  return $defaultSite
}

function Get-FirebaseLiveRelease {
  param([string]$Site)

  $jsonText = (& firebase hosting:channel:list --site $Site --json 2>$null)
  if ($LASTEXITCODE -ne 0 -or $null -eq $jsonText) {
    return $null
  }

  try {
    $parsed = ($jsonText -join "`n") | ConvertFrom-Json
  } catch {
    return $null
  }

  $channels = $parsed.result.channels
  if ($null -eq $channels) { return $null }

  $live = $channels | Where-Object { [string]$_.name -like '*/channels/live' } | Select-Object -First 1
  if ($null -eq $live) {
    $live = $channels | Select-Object -First 1
  }

  if ($null -eq $live) { return $null }

  $releaseTime = [string]$live.release.releaseTime
  if ([string]::IsNullOrWhiteSpace($releaseTime)) {
    $releaseTime = [string]$live.updateTime
  }

  return [PSCustomObject]@{
    Site = $Site
    Url = [string]$live.url
    ReleaseTimeIso = $releaseTime
    ReleaseTimeDisplay = Format-DateDisplay $releaseTime
  }
}

function Compare-GitHubVsFirebaseTime {
  param(
    [string]$GitHubIso,
    [string]$FirebaseIso
  )

  if ([string]::IsNullOrWhiteSpace($GitHubIso) -or [string]::IsNullOrWhiteSpace($FirebaseIso)) {
    return 'no se pudo determinar'
  }

  try {
    $gh = [DateTimeOffset]::Parse($GitHubIso)
    $fb = [DateTimeOffset]::Parse($FirebaseIso)
    if ($gh -lt $fb) { return 'si' }
    return 'no'
  } catch {
    return 'no se pudo determinar'
  }
}

if (-not (Get-Command git -ErrorAction SilentlyContinue)) {
  Stop-WithError -Step 'validacion previa' -SimpleMessage 'Git no esta instalado o no esta disponible en PATH.'
}

if (-not (Get-Command firebase -ErrorAction SilentlyContinue)) {
  Stop-WithError -Step 'validacion previa' -SimpleMessage 'Firebase CLI no esta instalado o no esta disponible en PATH.'
}

$repoRoot = Get-RepoRoot
Set-Location $repoRoot

$defaultBranch = Get-DefaultBranch -RemoteName $Remote
$currentBranch = Get-CurrentBranch
$report.Branch = $defaultBranch

if ($currentBranch -ne $defaultBranch) {
  Stop-WithError -Step 'validacion previa' -SimpleMessage "Estas en la rama '$currentBranch'. Debes usar '$defaultBranch' para un Deploy seguro."
}

Run-GitChecked -Args @('fetch', $Remote, $defaultBranch, '--quiet') -Step 'git push' -SimpleError "No se pudo actualizar la referencia remota $Remote/$defaultBranch."

$githubLastUpdateIso = (& git log -1 --date=iso-strict --format=%cd "$Remote/$defaultBranch" 2>$null)
if ($LASTEXITCODE -eq 0 -and -not [string]::IsNullOrWhiteSpace($githubLastUpdateIso)) {
  $report.GitHubLastUpdate = Format-DateDisplay ([string]$githubLastUpdateIso)
  $report.GitHubState = "conectado y actualizado en rama $defaultBranch"
} else {
  $report.GitHubState = "conectado, pero no se pudo leer la ultima fecha de $Remote/$defaultBranch"
}

$site = Get-FirebaseSite
$releaseBefore = Get-FirebaseLiveRelease -Site $site
if ($null -ne $releaseBefore) {
  $report.FirebaseLastDeploy = $releaseBefore.ReleaseTimeDisplay
  $report.FirebaseState = "servicio $site disponible"
} else {
  $report.FirebaseState = "no se pudo consultar estado de hosting en Firebase"
}

$statusLines = @(& git status --porcelain=v1)
$hasWorkingChanges = $statusLines.Count -gt 0
$report.LocalState = if ($hasWorkingChanges) { 'cambios detectados' } else { 'sin cambios' }
$report.GitHubBehindFirebase = Compare-GitHubVsFirebaseTime -GitHubIso ([string]$githubLastUpdateIso) -FirebaseIso ([string]($releaseBefore.ReleaseTimeIso))

if ($AnalyzeOnly) {
  if ($report.GitHubBehindFirebase -eq 'si') {
    $report.Problem = 'GitHub esta atrasado respecto al ultimo deploy de Firebase.'
    $report.Recommendation = 'Ejecuta Deploy para respaldar primero en GitHub y luego publicar en Firebase.'
  } elseif ($report.LocalState -eq 'cambios detectados') {
    $report.Problem = 'Hay cambios locales sin respaldo en GitHub.'
    $report.Recommendation = 'Ejecuta Deploy para crear commit, push y luego deploy seguro.'
  } else {
    $report.Problem = 'No se detectaron inconsistencias criticas en este analisis.'
    $report.Recommendation = 'Puedes ejecutar Deploy cuando tengas cambios para publicar.'
  }

  $report.Result = 'analisis completado'
  Print-AnalysisReport
  exit 0
}

if ($hasWorkingChanges) {
  Run-GitChecked -Args @('add', '.') -Step 'git add' -SimpleError 'No se pudieron agregar los cambios con git add .'
  $report.GitAdd = 'correcto'

  $timestamp = Get-Date -Format 'yyyy-MM-dd HH:mm:ss zzz'
  $commitMessage = "respaldo antes de deploy - $timestamp"

  & git commit -m $commitMessage
  if ($LASTEXITCODE -ne 0) {
    & git diff --cached --quiet
    if ($LASTEXITCODE -eq 0) {
      $report.GitCommit = 'sin cambios para commit'
      $report.CommitMessage = 'sin commit (no requerido)'
      $report.CommitDateTime = 'N/A'
    } else {
      Stop-WithError -Step 'git commit' -SimpleMessage 'No se pudo crear el commit de respaldo en GitHub.'
    }
  } else {
    $report.GitCommit = 'correcto'
    $report.CommitMessage = $commitMessage
    $report.CommitDateTime = Format-DateDisplay ((Get-Date).ToString('o'))
  }
} else {
  $report.GitAdd = 'no requerido (sin cambios)'
  $report.GitCommit = 'no requerido (sin cambios)'
  $report.CommitMessage = 'sin commit (no requerido)'
  $report.CommitDateTime = 'N/A'
}

$divergence = Get-Divergence -RemoteName $Remote -Branch $defaultBranch
if ($divergence.Behind -gt 0 -and $divergence.Ahead -eq 0) {
  Stop-WithError -Step 'git push' -SimpleMessage "Tu rama local esta atrasada ($($divergence.Behind) commit(s)). Actualiza antes de desplegar."
}

if ($divergence.Behind -gt 0 -and $divergence.Ahead -gt 0) {
  Stop-WithError -Step 'git push' -SimpleMessage "Tu rama esta en conflicto con GitHub (behind=$($divergence.Behind), ahead=$($divergence.Ahead)). Resuelve antes de desplegar."
}

if ($divergence.Ahead -gt 0) {
  & git push $Remote $defaultBranch
  if ($LASTEXITCODE -ne 0) {
    Stop-WithError -Step 'git push' -SimpleMessage 'No se pudo subir el respaldo a GitHub. Firebase no sera desplegado.'
  }
  $report.GitPush = 'correcto'
  $report.GitHubState = "respaldo realizado correctamente en rama $defaultBranch"
} else {
  $report.GitPush = 'no requerido (sin commits nuevos)'
  if ($report.GitHubState -notlike 'respaldo realizado*') {
    $report.GitHubState = "sin cambios pendientes; rama $defaultBranch ya estaba sincronizada"
  }
}

switch ($Target) {
  'functions' {
    & firebase deploy --only functions
  }
  'all' {
    & firebase deploy --only functions,hosting
  }
  default {
    & firebase deploy --only hosting
  }
}

if ($LASTEXITCODE -ne 0) {
  Stop-WithError -Step 'firebase deploy' -SimpleMessage 'Firebase no pudo completar el deploy del servicio solicitado.'
}

$report.FirebaseState = 'deploy realizado correctamente'
$report.FirebaseDeployTime = Format-DateDisplay ((Get-Date).ToString('o'))

Run-GitChecked -Args @('fetch', $Remote, $defaultBranch, '--quiet') -Step 'git push' -SimpleError "No se pudo validar sincronizacion final con $Remote/$defaultBranch."
$localHead = (& git rev-parse HEAD 2>$null)
$remoteHead = (& git rev-parse "$Remote/$defaultBranch" 2>$null)

$releaseAfter = Get-FirebaseLiveRelease -Site $site
if ($null -ne $releaseAfter) {
  $report.FirebaseLastDeploy = $releaseAfter.ReleaseTimeDisplay
}

if (-not [string]::IsNullOrWhiteSpace([string]$githubLastUpdateIso)) {
  $githubLastUpdateIso = (& git log -1 --date=iso-strict --format=%cd "$Remote/$defaultBranch" 2>$null)
  if ($LASTEXITCODE -eq 0 -and -not [string]::IsNullOrWhiteSpace($githubLastUpdateIso)) {
    $report.GitHubLastUpdate = Format-DateDisplay ([string]$githubLastUpdateIso)
  }
}

if ($LASTEXITCODE -eq 0 -and [string]$localHead -eq [string]$remoteHead) {
  $report.Result = 'GitHub y Firebase quedaron sincronizados'
  $report.Problem = 'ninguno'
  $report.Recommendation = 'Flujo completado correctamente.'
} else {
  $report.Result = 'proceso incompleto'
  $report.Problem = 'No se pudo confirmar la sincronizacion final entre local y GitHub.'
  $report.Recommendation = 'Verifica la conexion de red y ejecuta Deploy nuevamente.'
}

Print-ExecutionReport