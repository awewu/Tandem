@echo off
setlocal
cd /d "%~dp0..\frontend\apps\dealer-workbench"
set "NODE_ENV=production"
set "HOSTNAME=127.0.0.1"
set "PORT=5000"
set "API_URL=https://nexus.rhautt.com"
set "NEXUS_API_URL=https://nexus.rhautt.com"
set "NEXUS_API_PREFIX=/api/v2"
"%~dp0..\runtime\node.exe" server.js
