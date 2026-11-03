[CmdletBinding()]
param()
$ErrorActionPreference = 'Stop'
$taskRoot = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
$taskConfig = Join-Path $taskRoot 'tests\pos3\firebase.emulators.json'
$taskSmoke = Join-Path $PSScriptRoot 'emulator.cjs'
$taskFirebaseCommand = Get-Command firebase -ErrorAction Stop
$taskFirebaseRoot = Join-Path (Split-Path $taskFirebaseCommand.Source) 'node_modules\firebase-tools'
$taskFirebaseCli = Join-Path $taskFirebaseRoot 'lib\bin\firebase.js'
$taskEmulatorInfo = Get-Content -Raw (Join-Path $taskFirebaseRoot 'lib\emulator\downloadableEmulatorInfo.json') | ConvertFrom-Json
$taskJarName = $taskEmulatorInfo.firestore.downloadPathRelativeToCacheDir
$taskJar = Join-Path $env:USERPROFILE ('.cache\firebase\emulators\' + $taskJarName)
if (-not (Test-Path -LiteralPath $taskJar -PathType Leaf)) { throw 'Firestore emulator is not cached. No dependencies will be downloaded automatically.' }
if (-not (Test-Path -LiteralPath $taskFirebaseCli -PathType Leaf)) { throw 'Existing Firebase CLI entry point not found.' }
$taskSettings = Get-Content -Raw $taskConfig | ConvertFrom-Json
if ($taskSettings.emulators.firestore.host -ne '127.0.0.1' -or $taskSettings.emulators.firestore.port -ne 18180) { throw 'Unexpected emulator host or port.' }
if ($taskSettings.PSObject.Properties.Name -contains 'hosting' -or $taskSettings.PSObject.Properties.Name -contains 'functions') { throw 'This phase runs only Firestore; application code must not start.' }
& java -version
if ($LASTEXITCODE -ne 0) { throw 'Java must already be installed.' }
$taskRunDirectory = Join-Path $env:TEMP ('luro-pos3-emulator-' + [guid]::NewGuid().ToString('N'))
New-Item -ItemType Directory -Path $taskRunDirectory | Out-Null
$taskOldUpdateCheck = $env:FIREBASE_CLI_DISABLE_UPDATE_CHECK
try {
  $env:FIREBASE_CLI_DISABLE_UPDATE_CHECK = '1'
  Push-Location $taskRunDirectory
  try {
    & node $taskFirebaseCli emulators:exec --config $taskConfig --only firestore --project demo-luro-pos3 ('node "' + $taskSmoke + '"')
    $taskResult = $LASTEXITCODE
  } finally { Pop-Location }
} finally { $env:FIREBASE_CLI_DISABLE_UPDATE_CHECK = $taskOldUpdateCheck }
Write-Output ('Local emulator logs: ' + $taskRunDirectory)
exit $taskResult
