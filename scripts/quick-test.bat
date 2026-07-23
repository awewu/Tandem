@echo off
chcp 65001 >nul

:: 瑞美6大系统一键计算平台 - 快速测试脚本
:: 150人团队极速验证

echo 🚀 瑞美6大系统一键计算平台 - 快速测试
echo ======================================
echo.

:: 检查Node.js
echo [检查] Node.js环境...
node --version >nul 2>&1
if %errorlevel% neq 0 (
    echo [错误] 未安装Node.js
    exit /b 1
)
echo [通过] Node.js已安装

:: 检查MongoDB
echo [检查] MongoDB...
netstat -ano | findstr :27017 >nul
if %errorlevel% neq 0 (
    echo [警告] MongoDB未运行，尝试本地计算模式
    set MONGO_AVAILABLE=false
) else (
    echo [通过] MongoDB运行中
    set MONGO_AVAILABLE=true
)

echo.
echo ======================================
echo 🧪 运行6大系统计算测试
echo ======================================
echo.

:: 运行一键计算引擎测试
cd /d "%~dp0.."
node test\oneclick-engine.test.js

if %errorlevel% neq 0 (
    echo.
    echo [错误] 测试失败
    exit /b 1
)

echo.
echo ======================================
echo ✅ 快速测试完成
echo ======================================
echo.
echo 访问测试页面: http://localhost:5000/oneclick-calc.html
echo.

pause
