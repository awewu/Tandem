@echo off
setlocal
cd /d "%~dp0.."
if not exist "config\.env.production" (
  echo ERROR: config\.env.production not found.
  echo Copy config\.env.production.example and fill production secrets first.
  exit /b 1
)
set "DOTENV_CONFIG_PATH=%CD%\config\.env.production"
"%CD%\runtime\node.exe" "%CD%\scripts\backend-launcher.js"
