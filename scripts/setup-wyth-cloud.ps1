param([int]$Port = 53128)

$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$envPath = Join-Path $projectRoot '.env.local'
$launcher = Join-Path $projectRoot 'scripts\start-wyth.ps1'

Write-Host ''
Write-Host 'Wyth account connection' -ForegroundColor Cyan
Write-Host 'Values entered here stay on this computer and are not sent to Codex or Git.'
Write-Host ''

$supabaseUrl = (Read-Host 'Paste Supabase Project URL').Trim().TrimEnd('/')
if ($supabaseUrl -notmatch '^https://[a-z0-9-]+\.supabase\.co$') {
  throw 'Project URL must look like https://your-project-ref.supabase.co'
}

$publishableKey = (Read-Host 'Paste Supabase publishable key (sb_publishable_...)').Trim()
if ($publishableKey -notmatch '^sb_publishable_[A-Za-z0-9_-]{16,}$') {
  throw 'Use the publishable key, not the secret key. It should start with sb_publishable_.'
}

$random = New-Object byte[] 48
$randomGenerator = [Security.Cryptography.RandomNumberGenerator]::Create()
try {
  $randomGenerator.GetBytes($random)
} finally {
  $randomGenerator.Dispose()
}
$recoverySecret = [Convert]::ToBase64String($random)
$appOrigin = "http://127.0.0.1:$Port"
$managedKeys = @('SUPABASE_URL', 'SUPABASE_PUBLISHABLE_KEY', 'APP_ORIGIN', 'AUTH_RECOVERY_SECRET')
$preservedLines = @()
if (Test-Path -LiteralPath $envPath) {
  foreach ($existingLine in (Get-Content -LiteralPath $envPath)) {
    $trimmed = $existingLine.Trim()
    if (-not $trimmed -or $trimmed.StartsWith('#')) {
      $preservedLines += $existingLine
      continue
    }
    $separator = $existingLine.IndexOf('=')
    $existingKey = if ($separator -gt 0) { $existingLine.Substring(0, $separator).Trim() } else { '' }
    if ($managedKeys -notcontains $existingKey) { $preservedLines += $existingLine }
  }
}
$content = @($preservedLines) + @(
  "SUPABASE_URL=$supabaseUrl",
  "SUPABASE_PUBLISHABLE_KEY=$publishableKey",
  "APP_ORIGIN=$appOrigin",
  "AUTH_RECOVERY_SECRET=$recoverySecret"
)
$content = $content -join [Environment]::NewLine

$temporaryPath = "$envPath.tmp"
[IO.File]::WriteAllText($temporaryPath, "$content$([Environment]::NewLine)", [Text.UTF8Encoding]::new($false))
Move-Item -LiteralPath $temporaryPath -Destination $envPath -Force

Write-Host ''
Write-Host 'Saved private local configuration.' -ForegroundColor Green
Write-Host 'Restarting Wyth...'
& $launcher -Port $Port -NoBrowser
Write-Host ''
Write-Host "Ready: $appOrigin" -ForegroundColor Green
Write-Host 'Next: configure the two Supabase email templates using docs\wyth\supabase-auth-email-templates.md'
