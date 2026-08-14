param([int]$Port = 53128)

$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
Set-Location $projectRoot
Write-Host "Wyth preview: http://127.0.0.1:$Port/"
Write-Host "Health: http://127.0.0.1:$Port/api/health"
node server.mjs --port $Port
