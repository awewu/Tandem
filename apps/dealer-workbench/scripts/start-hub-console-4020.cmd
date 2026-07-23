@echo off
setlocal
set PORT=4020
cd /d "%~dp0..\.next\standalone\apps\dealer-workbench"
"D:\Soft\nodejs20\node.exe" server.js
