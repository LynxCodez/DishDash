@echo off
title DishDash Demo Launcher
rem ============================================================
rem  DISHDASH DEFENSE-DEMO LAUNCHER
rem  Double-click this file. It:
rem    1. starts the site server on http://localhost:5173
rem    2. waits until the site responds
rem    3. opens Chrome  as the CUSTOMER (demo@dishdash.ng)
rem    4. opens Edge    as the ADMIN    (admin@dishdash.ng)
rem  Both browsers share ONE live Supabase dataset - orders placed
rem  in Chrome appear in Edge instantly (that is the whole demo).
rem ============================================================

cd /d "%~dp0"

echo.
echo   [1/3] Starting the DishDash server...
rem -- if a server is already running, keep it; otherwise start a new one
curl -s -o nul --max-time 2 http://localhost:5173/ 2>nul
if %errorlevel%==0 (
    echo         Server already running - reusing it.
) else (
    start "DishDash server (leave this window open)" /min cmd /c "node server.js > server.log 2>&1"
    timeout /t 2 /nobreak >nul
)

echo   [2/3] Waiting for the site to respond...
set /a tries=0
:waitloop
curl -s -o nul --max-time 2 http://localhost:5173/ 2>nul
if %errorlevel%==0 goto ready
set /a tries+=1
if %tries% geq 10 (
    echo.
    echo   Could not reach http://localhost:5173 after 20 seconds.
    echo   Check that Node.js is installed and that no firewall blocked it.
    echo   The server log is in: dishdash\server.log
    pause
    exit /b 1
)
timeout /t 2 /nobreak >nul
goto waitloop

:ready
echo         Site is live.

echo   [3/3] Opening the demo browsers...
rem -- customer window: Chrome
start "" chrome.exe --new-window "http://localhost:5173/login.html?next=menu.html" 2>nul
if %errorlevel% neq 0 start "" "http://localhost:5173/login.html?next=menu.html"

rem -- admin window: Edge
start "" msedge.exe --new-window "http://localhost:5173/login.html?next=admin/index.html" 2>nul
if %errorlevel% neq 0 start "" "http://localhost:5173/login.html?next=admin/index.html"

echo.
echo   Done! Two windows opened:
echo     - Chrome  = customer  (demo@dishdash.ng / demo1234)
echo     - Edge    = admin     (admin@dishdash.ng / admin123)
echo   Sign in on each side and place an order in Chrome - it will
echo   appear in Edge instantly.
echo.
echo   To stop the demo: close the minimized "DishDash server" window.
echo.
timeout /t 12
