@echo off
chcp 65001
cls
echo ===================================
echo  商用热水制冷设计平台 - 开发启动
echo ===================================
echo.

:: 检查Node.js
node --version >nul 2>&1
if errorlevel 1 (
    echo [错误] 未检测到Node.js，请先安装Node.js 18+
    pause
    exit /b 1
)

echo [1/4] 安装根目录依赖...
call npm install
if errorlevel 1 (
    echo [错误] 根目录依赖安装失败
    pause
    exit /b 1
)

echo [2/4] 安装API服务依赖...
cd apps/api
call npm install
if errorlevel 1 (
    echo [错误] API依赖安装失败
    pause
    exit /b 1
)
cd ..\..

echo [3/4] 安装前端依赖...
cd apps/web
call npm install
if errorlevel 1 (
    echo [错误] 前端依赖安装失败
    pause
    exit /b 1
)
cd ..\..

echo [4/4] 启动开发服务器...
echo.
echo API服务将运行在: http://localhost:3002
echo 前端界面将运行在: http://localhost:5173
echo.
echo 按任意键开始启动...
pause >nul

start "API Server" cmd /k "cd apps/api && npm run dev"
timeout /t 3 /nobreak >nul
start "Web Client" cmd /k "cd apps/web && npm run dev"

echo.
echo ===================================
echo  开发服务器已启动！
echo ===================================
echo.
echo 访问地址:
echo   - 前端界面: http://localhost:5173
echo   - API文档: http://localhost:3002/health
echo.
pause
