@echo off
setlocal
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\start-wyth.ps1"
if errorlevel 1 (
  echo.
  echo Wyth could not start. The error details are shown above.
  pause
)
endlocal
