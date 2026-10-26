@echo off
rem Fallback launcher that keeps a console window open so startup problems are
rem visible. Normal use: double-click ProfileGPT.exe or Start ProfileGPT.vbs.
setlocal
cd /d "%~dp0"

if not exist "runtime\node.exe" (
  echo [ProfileGPT] runtime\node.exe is missing. Extract the whole ZIP, then retry.
  pause
  exit /b 1
)
if not exist "launcher.js" (
  echo [ProfileGPT] launcher.js is missing. Extract the whole ZIP, then retry.
  pause
  exit /b 1
)

"runtime\node.exe" launcher.js
if errorlevel 1 pause
