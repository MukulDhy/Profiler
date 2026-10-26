@echo off
rem Stops ProfileGPT and its background servers.
setlocal
cd /d "%~dp0"

if not exist "data\launcher.pid" (
  echo [ProfileGPT] Not running ^(no data\launcher.pid^).
  timeout /t 2 >nul
  exit /b 0
)

set "PID="
set /p PID=<"data\launcher.pid"
if defined PID (
  taskkill /PID %PID% /T /F >nul 2>&1
  echo [ProfileGPT] Stopped.
) else (
  echo [ProfileGPT] Empty PID file.
)

del /q "data\launcher.pid" >nul 2>&1
timeout /t 2 >nul
