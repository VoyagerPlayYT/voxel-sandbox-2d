@echo off
chcp 65001 > nul
title Voxel Sandbox 2D [Port 8012]
echo ========================================================
echo   VOXEL SANDBOX 2D // PROCEDURAL SIMULATION & FLUIDS
echo ========================================================
echo [INFO] Проверка и установка зависимостей...
python -m pip install -r requirements.txt --quiet
echo [INFO] Запуск FastAPI веб-сервера на http://localhost:8012 ...
start http://localhost:8012
python -m uvicorn main:app --host 0.0.0.0 --port 8012
pause
