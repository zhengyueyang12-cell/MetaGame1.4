@echo off
chcp 65001 >nul
title Twilight Threshold (MetaGame 1.4) 快速预览
cd /d "%~dp0"

echo ======================================================================
echo       Twilight Threshold (MetaGame 1.4) - 快速预览模式 (已预构建)
echo ======================================================================
echo.

where node >nul 2>&1
if %errorlevel% neq 0 (
    echo [错误] 系统未检测到 Node.js！
    pause
    exit /b 1
)

if not exist "dist\index.html" (
    echo [提示] 尚未检测到预构建文件，正在执行构建...
    node node_modules\vite\bin\vite.js build
)

echo [启动] 正在以快速预览模式启动服务...
echo [提示] 游戏将在默认浏览器中自动打开: http://localhost:3000
echo ======================================================================
echo.

node node_modules\vite\bin\vite.js preview --port 3000 --open --host 0.0.0.0
pause
