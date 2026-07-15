@echo off
setlocal
cd /d "%~dp0"
title KRISHOE Web App

echo.
echo ==================================================
echo    KRISHOE Web App
echo ==================================================
echo.

where npm >nul 2>nul
if errorlevel 1 (
  echo [X] Node.js bhetiyena.
  echo     Pahila Node.js install garnuhos: https://nodejs.org
  echo.
  pause
  exit /b 1
)

if not exist "node_modules" (
  echo [1/2] Pahilo patak - packages install hudai chha...
  echo       Kripaya parkhinuhos, ek-do minute lagna sakchha.
  echo.
  call npm install
  echo.
)

echo [2/2] App suru hudai chha...
echo.
echo    Browser aafai khulnechha:  http://localhost:3000
echo    Admin panel:               http://localhost:3000/admin
echo.
echo    App BANDA garna: yo window ma Ctrl+C thichnuhos
echo    athawa window nai banda garnuhos.
echo.

start "" /min cmd /c "timeout /t 6 >nul & start http://localhost:3000"

call npm run dev

echo.
echo App banda bhayo. Yo window banda garna kunai key thichnuhos.
pause >nul
