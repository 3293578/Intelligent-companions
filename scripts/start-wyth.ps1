param(
  [int]$Port = 53128,
  [switch]$NoBrowser
)

$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$dataDirectory = Join-Path $projectRoot '.local-data'
$stderrLog = Join-Path $dataDirectory 'wyth-launcher.err.log'
$stdoutLog = Join-Path $dataDirectory 'wyth-launcher.out.log'
$stderrPreviousLog = Join-Path $dataDirectory 'wyth-launcher.err.previous.log'
$stdoutPreviousLog = Join-Path $dataDirectory 'wyth-launcher.out.previous.log'
$serverPath = Join-Path $projectRoot 'server.mjs'
$quotedServerPath = '"' + $serverPath + '"'
$siteUrl = "http://127.0.0.1:$Port/"
$healthUrl = "${siteUrl}api/health"

function Get-WythHealth {
  try {
    $health = Invoke-RestMethod -Uri $healthUrl -TimeoutSec 2
    if ($health.ok -eq $true -and [int]$health.port -eq $Port) { return $health }
    return $null
  } catch {
    return $null
  }
}

function Test-WythHealth { return $null -ne (Get-WythHealth) }

function Open-WythSite {
  if (-not $NoBrowser) {
    Start-Process -FilePath $siteUrl
  }
}

function Get-WythSourceLastWrite {
  $runtimeFiles = @(
    (Join-Path $projectRoot 'server.mjs'),
    (Join-Path $projectRoot 'package.json')
  )
  $runtimeFiles += Get-ChildItem -LiteralPath (Join-Path $projectRoot 'src') -File -Recurse -ErrorAction SilentlyContinue | Select-Object -ExpandProperty FullName
  return ($runtimeFiles | Get-Item -ErrorAction SilentlyContinue | Sort-Object LastWriteTime -Descending | Select-Object -First 1).LastWriteTime
}

function Get-WythPortOwner {
  $pattern = ":$Port\s+.*LISTENING\s+(\d+)\s*$"
  foreach ($line in (& netstat.exe -ano -p tcp)) {
    if ($line -match $pattern) {
      return Get-CimInstance Win32_Process -Filter "ProcessId = $([int]$Matches[1])" -ErrorAction SilentlyContinue
    }
  }
  return $null
}

function Stop-WythProcess([int]$ProcessId) {
  Stop-Process -Id $ProcessId -Force -ErrorAction Stop
  Wait-Process -Id $ProcessId -Timeout 5 -ErrorAction SilentlyContinue
}

if (Test-WythHealth) {
  $health = Get-WythHealth
  $listenerProcess = if ($health.processId) {
    Get-Process -Id ([int]$health.processId) -ErrorAction SilentlyContinue
  } else {
    $owner = Get-WythPortOwner
    if ($owner) { Get-Process -Id ([int]$owner.ProcessId) -ErrorAction SilentlyContinue }
  }
  $sourceLastWrite = Get-WythSourceLastWrite
  if ($listenerProcess -and $sourceLastWrite -and $listenerProcess.StartTime -lt $sourceLastWrite) {
    Stop-WythProcess -ProcessId $listenerProcess.Id
    for ($attempt = 0; $attempt -lt 20 -and (Test-WythHealth); $attempt += 1) {
      Start-Sleep -Milliseconds 100
    }
  } else {
    Open-WythSite
    exit 0
  }
}

New-Item -ItemType Directory -Path $dataDirectory -Force | Out-Null
$portOwner = Get-WythPortOwner
if ($portOwner) {
  $isOwnedWyth = $portOwner.Name -match '^node(?:\.exe)?$' -and $portOwner.CommandLine -like "*$serverPath*"
  if ($isOwnedWyth) {
    Stop-WythProcess -ProcessId ([int]$portOwner.ProcessId)
  } else {
    Write-Error "Wyth port is occupied by another process (PID $($portOwner.ProcessId), $($portOwner.Name)). Close it or choose another port."
  }
}

if (Test-Path -LiteralPath $stderrLog) { Move-Item -LiteralPath $stderrLog -Destination $stderrPreviousLog -Force }
if (Test-Path -LiteralPath $stdoutLog) { Move-Item -LiteralPath $stdoutLog -Destination $stdoutPreviousLog -Force }
$nodeCommand = Get-Command node.exe -ErrorAction Stop
try {
  Start-Process `
    -FilePath $nodeCommand.Source `
    -ArgumentList @($quotedServerPath, '--port', $Port) `
    -WorkingDirectory $projectRoot `
    -RedirectStandardOutput $stdoutLog `
    -RedirectStandardError $stderrLog `
    -WindowStyle Hidden | Out-Null
} catch {
  Write-Error "Wyth process could not be launched. Check $stderrLog."
}

for ($attempt = 0; $attempt -lt 40; $attempt += 1) {
  if (Test-WythHealth) {
    Open-WythSite
    exit 0
  }
  Start-Sleep -Milliseconds 250
}

Write-Error "Wyth failed to start at $siteUrl. Check $stderrLog."
