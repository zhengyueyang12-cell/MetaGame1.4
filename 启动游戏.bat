@echo off
chcp 65001 >nul
title Twilight Threshold (MetaGame 1.4) 游戏启动器
cd /d "%~dp0"

echo ======================================================================
echo           Twilight Threshold (MetaGame 1.4) - 游戏启动器
echo ======================================================================
echo.

:: 1. 检查 Node.js 环境
where node >nul 2>&1
if %errorlevel% neq 0 (
    echo [错误] 系统未检测到 Node.js！
    echo 请先前往官网下载并安装 Node.js: https://nodejs.org/
    echo 安装完成后重新双击本脚本即可。
    echo.
    pause
    exit /b 1
)

:: 2. 检查依赖包
if not exist "node_modules" (
    echo [提示] 首次启动，正在为您安装游戏依赖，请稍候...
    call pnpm.cmd install || call npm.cmd install
    if %errorlevel% neq 0 (
        echo [错误] 依赖安装遇到问题，请检查网络或代理设置。
        pause
        exit /b 1
    )
    echo [成功] 依赖安装完成！
    echo.
)

:: 3. 启动 Vite 开发服务并自动在浏览器中打开游戏页面
echo [启动] 正在启动游戏本地服务器 (端口: 3000)...
echo [提示] 游戏页面将在默认浏览器中自动打开。
echo [提示] 保持本窗口开启以维持游戏运行；如需退出游戏，直接关闭本窗口或按 Ctrl+C。
echo.
echo 游戏访问地址: http://localhost:3000
echo ======================================================================
echo.

node node_modules\vite\bin\vite.js --port 3000 --open --host 0.0.0.0
pause
