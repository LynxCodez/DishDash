@echo off
rem Refreshes the offline DishDash copy (same as running: node make-offline.js)
cd /d "%~dp0"
node make-offline.js
echo.
pause
