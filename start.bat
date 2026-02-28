@echo off
echo Starting LearnOS...
echo.

start "LearnOS Backend" cmd /k "cd /d %~dp0backend && python main.py"
timeout /t 2 /nobreak >nul
start "LearnOS Frontend" cmd /k "cd /d %~dp0frontend && npm run dev"

echo.
echo Backend: http://localhost:8000
echo Frontend: http://localhost:3000
echo.
echo Both running in separate windows. Close those windows to stop.
pause
