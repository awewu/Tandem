@echo off
setlocal
cd /d "%~dp0.."
"runtime\node.exe" "scripts\health-check.js"
