@echo off
setlocal
cd /d "%~dp0.."
"runtime\node.exe" "scripts\service-manager.js" stop
