@echo off
REM ===== GP Profile Crawler - Frontend launcher (Windows) =====
cd /d "%~dp0frontend"

REM .env na ho to localhost backend ke saath bana do
if not exist ".env" (
    echo [setup] frontend\.env bana rahe hain...
    echo REACT_APP_BACKEND_URL=http://localhost:8001> .env
)

if not exist "node_modules" (
    echo [setup] Installing frontend dependencies (yarn)...
    call yarn install
)

echo.
echo =================================================
echo   Dashboard: http://localhost:3000
echo   Backend se jud raha hai: http://localhost:8001
echo =================================================
echo.
call yarn start
pause
