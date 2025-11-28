@echo off
chcp 65001 >nul
echo ========================================
echo   滑雪大冒险 - 自动打包脚本
echo ========================================
echo.

echo [1/3] 检查Node.js环境...
node --version >nul 2>&1
if errorlevel 1 (
    echo ❌ 错误：未检测到Node.js
    echo 请先安装Node.js: https://nodejs.org/
    pause
    exit /b 1
)
echo ✅ Node.js环境正常
echo.

echo [2/3] 安装依赖包...
echo 这可能需要几分钟，请耐心等待...
call npm install
if errorlevel 1 (
    echo ❌ 依赖安装失败
    pause
    exit /b 1
)
echo ✅ 依赖安装完成
echo.

echo [3/3] 开始打包...
echo 打包过程需要5-10分钟，请耐心等待...
call npm run build:win
if errorlevel 1 (
    echo ❌ 打包失败
    pause
    exit /b 1
)
echo.
echo ========================================
echo   ✅ 打包完成！
echo ========================================
echo.
echo 打包文件位置：
echo   安装程序：dist\滑雪大冒险 Setup 1.0.0.exe
echo   免安装版：dist\win-unpacked\滑雪大冒险.exe
echo.
echo 按任意键打开dist文件夹...
pause >nul
explorer dist
