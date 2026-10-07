@echo off
setlocal
title ProRider - gerar o programa da TV
rem ============================================================
rem  ProRider - GERAR O PROGRAMA DA TV (03/10v)
rem  Confere se os arquivos certos estao no lugar certo e so
rem  entao roda o "npm run dist". Evita instalar versao velha.
rem ============================================================
set VERSAO=03/10v
set APP=%~dp0
for %%I in ("%APP%.") do set PASTA=%%~nxI

echo.
echo  ProRider - gerar o programa da TV - versao esperada: BUILD %VERSAO%
echo  Pasta destes arquivos: %APP%
echo.

if /I not "%PASTA%"=="app" goto ERRO_PASTA
if not exist "%APP%..\package.json" goto ERRO_PASTA
dir /b /ad "%APP%ProRider_1_GINASIO_*" >nul 2>&1 && goto ERRO_SUB
findstr /C:"var PR_BUILD='BUILD %VERSAO%';" "%APP%script.js" >nul || goto ERRO_VER
for %%F in (ginasio.html script.js telas-pv.js style.css bled112.js brasoes.js logo-prorider.png) do if not exist "%APP%%%F" (set FALTA=%%F& goto ERRO_FALTA)

echo  [OK] arquivos da versao %VERSAO% direto na pasta app
echo.
cd /d "%APP%.."
if exist "dist\*.exe" (
  if not exist "dist\antigos" mkdir "dist\antigos"
  move /y "dist\*.exe" "dist\antigos\" >nul
  echo  [OK] programas antigos movidos para dist\antigos
)
echo  Gerando o programa (npm run dist)... pode levar alguns minutos.
echo.
call npm run dist
if errorlevel 1 goto ERRO_DIST
echo.
echo  ============================================================
echo   PRONTO. Use SOMENTE este programa (acabou de ser gerado):
for /f "delims=" %%E in ('dir /b /o-d "dist\*.exe" 2^>nul') do (echo     dist\%%E & goto MOSTROU)
:MOSTROU
echo   Depois de instalar, a TV tem que mostrar BUILD %VERSAO%
echo   na tela inicial e na Saude do sistema.
echo  ============================================================
start "" explorer "dist"
pause
exit /b 0

:ERRO_PASTA
echo  [ERRO] Estes arquivos nao estao em ...\Executavel\app\
echo         Estao em: %APP%
echo         Provavelmente o Windows criou uma subpasta ao extrair o zip.
echo         Mova TODO o conteudo desta pasta para C:\ProRider\Executavel\app\
echo         (substituindo os arquivos), apague a subpasta e rode de novo
echo         o GERAR_PROGRAMA_DA_TV.bat que esta dentro de app\.
goto FIM
:ERRO_SUB
echo  [ERRO] Existe uma subpasta ProRider_1_GINASIO_... dentro de app\
echo         (sobra de uma extracao errada). Apague essa subpasta, extraia
echo         o zip novo DIRETO em app\ (substituindo) e rode de novo.
goto FIM
:ERRO_VER
echo  [ERRO] O script.js de app\ NAO e da versao %VERSAO%.
for /f "tokens=*" %%L in ('findstr /C:"var PR_BUILD=" "%APP%script.js"') do echo         Encontrado: %%L
echo         Extraia o zip ProRider_1_GINASIO_03-10v.zip DIRETO em app\
echo         (substituindo os arquivos) e rode de novo.
goto FIM
:ERRO_FALTA
echo  [ERRO] Falta o arquivo %FALTA% em app\. Extraia o zip completo de novo.
goto FIM
:ERRO_DIST
echo  [ERRO] O "npm run dist" falhou. Veja a mensagem acima.
goto FIM
:FIM
echo.
echo  Nada foi gerado. Corrija e rode de novo.
pause
exit /b 1
