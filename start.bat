@echo off
chcp 65001 > nul
title Voxel Sandbox 2D [Port 8012]
echo ========================================================
echo   VOXEL SANDBOX 2D [PORT 8012]
echo ========================================================

if exist "C:\Python313\python.exe" (
    set "PY=C:\Python313\python.exe"
) else (
    set "PY=python"
)

echo [INFO] Проверка и освобождение порта 8012...
for /f "tokens=5" %%a in ('netstat -aon ^| findstr ":8012" ^| findstr "LISTENING"') do taskkill /f /pid %%a >nul 2>&1

echo [INFO] Запуск веб-сервера на http://localhost:8012 ...
start "" cmd /c "timeout /t 2 /nobreak >nul && start http://localhost:8012"

cd /d "%~dp0"
"%PY%" -m uvicorn main:app --host 127.0.0.1 --port 8012
pause
