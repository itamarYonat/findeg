@echo off
cd /d "%~dp0"
echo Starting FinDeg local server...
start "FinDeg server - close this window to stop" cmd /k python -m http.server 8358 --bind 127.0.0.1
timeout /t 1 /nobreak >nul
start "" http://127.0.0.1:8358/
