@echo off
setlocal
cd /d "%~dp0"
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\setup-wyth-cloud.ps1"
if errorlevel 1 (
  echo.
  echo Setup was not completed. No existing configuration was replaced.
  pause
  exit /b 1
)
pause
