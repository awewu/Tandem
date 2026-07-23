@echo off
REM Terminal-Script: 启动服务器

echo [Terminal] 检查环境...
npm install

echo [Terminal] 查找可用端口...
set PORT=5000
:checkPort
netstat -ano | findstr :%PORT% >nul 2>&1
if %errorlevel% == 0 (
  set /a PORT=%PORT%+1
  goto checkPort
)
echo [Terminal] 使用端口: %PORT%

echo [Terminal] 启动服务器...
set PORT=%PORT%
node server-production.js
