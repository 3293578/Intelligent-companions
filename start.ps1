$ErrorActionPreference = "Stop"

$projectRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $projectRoot

$envFile = Join-Path $projectRoot ".env.local"

if (Test-Path $envFile) {
  Get-Content $envFile | ForEach-Object {
    $line = $_.Trim()
    if (!$line -or $line.StartsWith("#")) {
      return
    }

    $parts = $line.Split("=", 2)
    if ($parts.Count -ne 2) {
      return
    }

    $name = $parts[0].Trim()
    $value = $parts[1].Trim().Trim('"').Trim("'")
    if ($name) {
      Set-Item -Path "Env:$name" -Value $value
    }
  }
}

if (!$env:DEEPSEEK_API_KEY -and !$env:OPENAI_API_KEY -and !$env:LLM_API_KEY) {
  $secureKey = Read-Host "Enter DeepSeek API key for this PowerShell session" -AsSecureString
  $plainKey = [Runtime.InteropServices.Marshal]::PtrToStringAuto(
    [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secureKey)
  )
  $env:DEEPSEEK_API_KEY = $plainKey
}

if (!$env:DEEPSEEK_MODEL) {
  $env:DEEPSEEK_MODEL = "deepseek-v4-flash"
}

Write-Host "Starting English Companions at http://127.0.0.1:5173"
npm run dev
