@echo off
title ProRider GYM
cd /d "%~dp0"

rem O perfil do navegador guarda a autorizacao do pendrive (IndexedDB) e a do
rem dongle BLED112. Ficava em %TEMP%, que o Windows limpa -> toda vez que era
rem limpo, o ProRider voltava a pedir para escolher a pasta e a porta serial.
rem Agora fica ao lado do PRORIDER.bat e persiste.

node --version >nul 2>&1
if errorlevel 1 (
  echo  ERRO: Node.js nao encontrado. Instala em: https://nodejs.org
  pause & exit /b 1
)

taskkill /F /FI "WINDOWTITLE eq ProRider-Server" >nul 2>&1
start "ProRider-Server" /B node servidor-local.js
timeout /t 2 /nobreak >nul

set CHROME=
if exist "%ProgramFiles%\Google\Chrome\Application\chrome.exe"       set CHROME="%ProgramFiles%\Google\Chrome\Application\chrome.exe"
if exist "%ProgramFiles(x86)%\Google\Chrome\Application\chrome.exe"  set CHROME="%ProgramFiles(x86)%\Google\Chrome\Application\chrome.exe"
if exist "%LocalAppData%\Google\Chrome\Application\chrome.exe"        set CHROME="%LocalAppData%\Google\Chrome\Application\chrome.exe"

if defined CHROME (
  start "" %CHROME% --start-fullscreen --user-data-dir="%~dp0.perfil-chrome" --disable-infobars --noerrdialogs --no-first-run --disable-session-crashed-bubble --disable-features=TranslateUI http://localhost:3000/ginasio
  exit
)

set EDGE=
if exist "%ProgramFiles(x86)%\Microsoft\Edge\Application\msedge.exe"  set EDGE="%ProgramFiles(x86)%\Microsoft\Edge\Application\msedge.exe"
if exist "%ProgramFiles%\Microsoft\Edge\Application\msedge.exe"        set EDGE="%ProgramFiles%\Microsoft\Edge\Application\msedge.exe"

if defined EDGE (
  start "" %EDGE% --start-fullscreen --user-data-dir="%~dp0.perfil-edge" --no-first-run --disable-infobars --disable-features=TranslateUI http://localhost:3000/ginasio
  exit
)

start http://localhost:3000/ginasio
