@echo off
chcp 65001 >nul
title Actualizador ARIESPos

echo.
echo  ============================================
echo   ARIESPos - Actualizando a la ultima version
echo  ============================================
echo.

echo  Descargando ultima version...
powershell -Command "& {
    $url = 'https://github.com/steevengerard10/AriesPos/releases/latest/download/ARIESPos.Setup.4.0.0.exe'
    $out = 'C:\Users\KIOSCO~1\AppData\Local\Temp\ARIESPos_Setup.exe'
    Invoke-WebRequest -Uri $url -OutFile $out
    Start-Process $out
}"

echo  Instalacion iniciada. Siga las instrucciones en pantalla.
pause
