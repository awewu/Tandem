@echo off
chcp 65001 >nul
echo ============================================================
echo 🏢 瑞美商用HVAC系统 - 独立入口
echo ============================================================
echo.

:: 检查Node.js
echo [1/3] 检查Node.js环境...
node -v >nul 2>&1
if errorlevel 1 (
    echo ❌ 未安装Node.js，请先安装Node.js 18+
    pause
    exit /b 1
)
echo ✅ Node.js已安装

:: 安装依赖
echo.
echo [2/3] 检查依赖...
if not exist "node_modules" (
    echo 📦 安装依赖...
    npm install
    if errorlevel 1 (
        echo ❌ 依赖安装失败
        pause
        exit /b 1
    )
) else (
    echo ✅ 依赖已安装
)

:: 启动商用服务器
echo.
echo [3/3] 启动商用HVAC系统...
echo.
echo ============================================================
echo 🚀 正在启动...
echo 📍 入口文件: server.js
echo 🌐 端口: 5050
echo 🔗 API地址: http://localhost:5050
echo 📖 健康检查: http://localhost:5050/api/commercial/health
echo ============================================================
echo.

node server.js

pause
