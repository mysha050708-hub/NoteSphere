@echo off
title NoteSphere Server
echo ========================================================
echo               Starting NoteSphere Server
echo ========================================================
echo.

:: Ensure Node is available in current PATH
where node >nul 2>nul
if %errorlevel% neq 0 (
  set "PATH=%LOCALAPPDATA%\Microsoft\WinGet\Packages\OpenJS.NodeJS.LTS_Microsoft.Winget.Source_8wekyb3d8bbwe\node-v24.19.0-win-x64;%PATH%"
)

:: Launch browser in background after 1.5 seconds
start "" cmd /c "timeout /t 2 /nobreak >nul && start http://localhost:3000"

:: Start the Express server
node server.js
pause
