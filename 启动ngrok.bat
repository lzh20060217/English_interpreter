@echo off
chcp 65001 >nul
title AI 智能同传助手 - ngrok

echo ========================================
echo   AI 智能同传助手 - 启动服务
echo ========================================
echo.
echo 正在启动 ngrok 服务...
echo.

cd /d "%~dp0"

start "ngrok" "c:\Users\黎至恒\Desktop\English_interpreter\.tools\ngrok.exe" http 3000 --config="c:\Users\黎至恒\Desktop\English_interpreter\.tools\ngrok.yml"

echo.
echo 请查看弹出的 ngrok 窗口
echo 找到 "Forwarding" 行的 https 地址
echo.
echo 复制该地址即可在任意设备访问！
echo.
pause
