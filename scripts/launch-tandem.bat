@echo off
chcp 65001 >nul
title Tandem 启动器
cls
echo.
echo  ╔════════════════════════════════════════╗
echo  ║     Tandem 桌面端一键启动器            ║
echo  ╚════════════════════════════════════════╝
echo.

:: 先尝试用已经安装好的 PowerShell
where powershell >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo [错误] 找不到 PowerShell，请确保系统已安装 PowerShell。
    pause
    exit /b 1
)

:: 运行一键启动脚本（绕过执行策略限制）
powershell -ExecutionPolicy Bypass -File "%~dp0launch-tandem.ps1"

pause
