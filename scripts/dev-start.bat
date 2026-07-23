@echo off
chcp 65001 >nul

:: 瑞美6大系统一键计算平台 - 开发环境快速启动
:: 150人团队本地开发

echo 🚀 启动6大系统一键计算平台 (开发模式)
echo ======================================
echo.

cd /d "%~dp0.."

:: 检查依赖
echo [1/4] 检查依赖...
if not exist node_modules (
    echo     安装依赖...
    call npm install
)
echo     ✓ 依赖就绪

:: 检查环境变量
echo [2/4] 检查环境变量...
if not exist .env (
    echo     创建.env文件...
    copy .env.example .env
    echo     ⚠ 请编辑.env文件配置实际参数
)
echo     ✓ 环境变量就绪

:: 创建必要的目录
echo [3/4] 创建目录结构...
if not exist logs mkdir logs
if not exist uploads mkdir uploads
if not exist dist mkdir dist
echo     ✓ 目录就绪

:: 启动服务
echo [4/4] 启动服务...
echo     服务器: http://localhost:5000
echo     API文档: http://localhost:5000/api-docs
echo     一键计算: http://localhost:5000/oneclick-calc.html
echo.
echo 按Ctrl+C停止服务
echo.

:: 使用nodemon监视文件变化 (如果已安装)
npx nodemon --watch server --watch public server/index.js --port 5000

:: 如果nodemon不可用，使用普通node
if %errorlevel% neq 0 (
    node server/index.js
)
