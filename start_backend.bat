@echo off
REM ===== GP Profile Crawler - Backend launcher (Windows, venv-free, Python 3.12) =====
cd /d "%~dp0backend"

REM .env optional; na ho to default bana do
if not exist ".env" echo CORS_ORIGINS="*"> .env

REM Python 3.12 dhoondo
set PY=py -3.12
%PY% --version >nul 2>&1
if errorlevel 1 (
    echo.
    echo [ERROR] Python 3.12 nahi mila.
    echo Install karein: https://www.python.org/downloads/release/python-3129/
    echo Install karte waqt "Add python.exe to PATH" ZAROOR tick karein.
    echo Phir is file ko dobara chalayein.
    echo.
    pause
    exit /b 1
)

echo [setup] pip upgrade...
%PY% -m pip install --upgrade pip
echo [setup] Installing dependencies (pehli baar 2-3 min lag sakte hain)...
%PY% -m pip install fastapi "uvicorn[standard]" python-dotenv playwright openpyxl
echo [setup] Installing Playwright Chromium browser...
%PY% -m playwright install chromium

echo.
echo ============================================
echo   Backend running at http://localhost:8001
echo   (band karne ke liye is window me Ctrl+C)
echo ============================================
echo.
%PY% -m uvicorn server:app --host 0.0.0.0 --port 8001
pause
