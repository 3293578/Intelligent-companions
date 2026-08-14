param([switch]$PromptForKey)

$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$launcher = Join-Path $projectRoot 'scripts\start-wyth.ps1'

if ($PromptForKey) {
  Write-Warning 'Interactive model-key setup is retired. Wyth now uses its saved platform-managed configuration.'
}

& $launcher
exit $LASTEXITCODE
