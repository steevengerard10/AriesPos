@echo off
chcp 65001 >nul
title Actualizador ARIESPos

echo.
echo  ============================================
echo   ARIESPos - Actualizando a la ultima version
echo  ============================================
echo.

echo  Buscando actualizaciones en GitHub...
powershell.exe -NoProfile -ExecutionPolicy Bypass -Command "$ErrorActionPreference = 'Stop'; function ConvertTo-AppVersion([string]$value) { $clean = $value -replace '^[vV]', '' -replace '[^0-9.].*$', ''; try { return [version]$clean } catch { return [version]'0.0.0' } }; try { $release = Invoke-RestMethod -Uri 'https://api.github.com/repos/steevengerard10/ariespos/releases/latest' -Headers @{ 'User-Agent' = 'ARIESPos-Updater' }; $latestVersion = ConvertTo-AppVersion $release.tag_name; $registryPaths = @('HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall\*', 'HKLM:\SOFTWARE\WOW6432Node\Microsoft\Windows\CurrentVersion\Uninstall\*', 'HKCU:\SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall\*'); $installedVersions = @(Get-ItemProperty -Path $registryPaths -ErrorAction SilentlyContinue | Where-Object { $_.DisplayName -like 'ARIESPos*' -and $_.DisplayVersion } | ForEach-Object { ConvertTo-AppVersion $_.DisplayVersion }); if ($installedVersions.Count -gt 0) { $installedVersion = $installedVersions | Sort-Object -Descending | Select-Object -First 1 } else { $programFilesX86 = [Environment]::GetFolderPath([Environment+SpecialFolder]::ProgramFilesX86); $exePaths = @((Join-Path $env:ProgramFiles 'ARIESPos\ARIESPos.exe'), (Join-Path $programFilesX86 'ARIESPos\ARIESPos.exe')); $exe = $exePaths | Where-Object { Test-Path $_ } | Select-Object -First 1; $installedVersion = if ($exe) { ConvertTo-AppVersion (Get-Item $exe).VersionInfo.ProductVersion } else { [version]'0.0.0' } }; Write-Host ('Version instalada: ' + $installedVersion); Write-Host ('Version disponible: ' + $latestVersion); if ($installedVersion -ge $latestVersion) { Write-Host 'ARIESPos ya esta actualizado.' -ForegroundColor Green; exit 0 }; $asset = $release.assets | Where-Object { $_.name -match '^ARIESPos\.Setup\.\d+\.\d+\.\d+\.exe$' } | Select-Object -First 1; if (-not $asset) { throw 'El release mas reciente no contiene el instalador Windows esperado.' }; $installer = Join-Path $env:TEMP ('ARIESPos.Setup.' + $latestVersion + '.exe'); Write-Host 'Descargando instalador...'; Invoke-WebRequest -Uri $asset.browser_download_url -OutFile $installer; Write-Host 'Iniciando instalacion. Windows puede solicitar autorizacion de administrador.'; Start-Process -FilePath $installer -Wait; if (Test-Path $installer) { Remove-Item -LiteralPath $installer -Force }; Write-Host 'Actualizacion finalizada.' -ForegroundColor Green } catch { Write-Host ('Error al actualizar: ' + $_.Exception.Message) -ForegroundColor Red; exit 1 }"
if errorlevel 1 (
    echo.
    echo  No se pudo completar la actualizacion.
    pause
    exit /b 1
)

echo.
echo  Proceso de actualizacion terminado.
pause
