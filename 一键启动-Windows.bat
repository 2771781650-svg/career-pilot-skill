@echo off
chcp 65001 >nul
cd /d "%~dp0"
title 职途 CareerPilot 一键启动
echo ================================================
echo   职途 CareerPilot · 本地服务 + 公网 https 链接
echo ================================================
set PY=python
where python >nul 2>nul || set PY=py

if not exist cloudflared.exe (
  echo [1/3] 首次运行，下载 cloudflared ^(约 40MB^)...
  curl -L -o cloudflared.exe https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-windows-amd64.exe
)

echo [2/3] 启动本地服务 127.0.0.1:8000 ...
start "CareerPilot-服务" /min %PY% server.py
timeout /t 3 >nul

echo [3/3] 启动公网隧道 ...
start "CareerPilot-隧道" /min cmd /c "cloudflared.exe tunnel --url http://127.0.0.1:8000 --no-autoupdate > tunnel.log 2>&1"
timeout /t 10 >nul

echo.
echo 下面这条 https 链接就是公网地址（微信 / QQ / 手机都能打开）：
findstr /C:"trycloudflare.com" tunnel.log
echo.
echo 提示：这条链接每次启动都会变，关掉窗口就失效；答辩时保持这两个窗口别关。
echo 本机测试：http://127.0.0.1:8000
start "" http://127.0.0.1:8000
pause
