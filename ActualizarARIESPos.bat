@echo off
chcp 65001 >nul
title Actualizador ARIESPos

echo.
echo  ============================================
echo   ARIESPos - Actualizador de versión
echo  ============================================
echo.

:: Verificar que pnpm esté disponible
where pnpm >nul 2>&1
if %errorlevel% neq 0 (
    echo  [ERROR] pnpm no encontrado. Instala Node.js y pnpm primero.
    pause
    exit /b 1
)

:: Directorio del proyecto
set "PROYECTO=C:\Users\Kiosco Aries\Desktop\Pos Claude 2"
cd /d "%PROYECTO%"

echo  [1/5] Deteniendo procesos anteriores...
powershell -Command "Get-Process -Name electron,node -EA SilentlyContinue | Stop-Process -Force"
timeout /t 2 /nobreak >nul

echo  [2/5] Compilando renderer (React + Vite)...
call pnpm --filter renderer build
if %errorlevel% neq 0 (
    echo  [ERROR] Fallo al compilar el renderer.
    pause
    exit /b 1
)

echo  [3/5] Compilando main process (TypeScript)...
cd /d "%PROYECTO%\packages\desktop"
call npx tsc -p tsconfig.json
if %errorlevel% neq 0 (
    echo  [ERROR] Fallo al compilar el main process.
    pause
    exit /b 1
)
cd /d "%PROYECTO%"

echo  [4/5] Generando instalador y publicando en GitHub...
echo.
echo  Ingresa el token de GitHub (GH_TOKEN):
set /p GH_TOKEN="  Token: "

set "GH_TOKEN=%GH_TOKEN%"
call pnpm --filter desktop exec electron-builder --win --publish always
if %errorlevel% neq 0 (
    echo.
    echo  [ERROR] Fallo al publicar. Verifica el token de GitHub.
    pause
    exit /b 1
)

echo.
echo  [5/5] Listo!
echo  ============================================
echo   Nueva version publicada en GitHub Releases
echo  ============================================
echo.
pause
