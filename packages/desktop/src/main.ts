import { app, BrowserWindow, ipcMain, dialog, shell, nativeTheme } from 'electron';
import * as path from 'path';
import * as fs from 'fs';
import { initDatabase, getDb } from './database/db';
import { startServer } from './server/index';
import { registerIpcHandlers } from './ipc/handlers';
import { autoBackup, scheduleBackupCleanup } from './database/backup';
import { getAppConfig, saveAppConfig, resetAppConfig } from './config/appConfig';
import { initAutoUpdater } from './updater';
import { isLicensed, validateLicenseKey, saveLicense, readSavedLicense } from './services/license';

let mainWindow: BrowserWindow | null = null;
let posWindow: BrowserWindow | null = null;
let networkWindow: BrowserWindow | null = null;
let splashWindow: BrowserWindow | null = null;

const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;

function getAppIconPath(): string {
  if (process.platform === 'win32') {
    const icon = app.isPackaged
      ? path.join(process.resourcesPath, 'assets', 'icon.ico')
      : path.join(app.getAppPath(), 'packages/desktop/assets/icon.ico');
    // Asegurarse de que el archivo existe, si no, usar el PNG
    if (!fs.existsSync(icon) && !app.isPackaged) {
      return path.join(app.getAppPath(), 'packages/desktop/assets/icon.png');
    }
    return icon;
  }
  // linux/mac: usar png en runtime (el .icns lo maneja el bundle)
  return app.isPackaged
    ? path.join(process.resourcesPath, 'assets', 'icon.png')
    : path.join(app.getAppPath(), 'packages/desktop/assets/icon.png');
}

function getLogoPath(): string {
  return app.isPackaged
    ? path.join(process.resourcesPath, 'logo', 'icon_logo.png')
    : path.join(app.getAppPath(), 'packages/renderer/src/assets/icon_logo.png');
}

function createSplash(): void {
  const logoPath = getLogoPath();

  splashWindow = new BrowserWindow({
    width: 380,
    height: 440,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    center: true,
    resizable: false,
    skipTaskbar: true,
    icon: getAppIconPath(),
    webPreferences: { contextIsolation: true, nodeIntegration: false },
  });

  // Si el logo no existe, usar un fallback sin img tag
  const imgTag = fs.existsSync(logoPath)
    ? `<img src="file://${logoPath.replace(/\\/g, '/')}" style="width:150px;height:150px;object-fit:contain; filter:drop-shadow(0 0 24px rgba(190,50,120,0.7))" />`
    : `<div style="width:150px;height:150px;display:flex;align-items:center;justify-content:center;font-size:32px;font-weight:800;color:#be3278">AP</div>`;

  splashWindow.loadURL(`data:text/html;charset=utf-8,<!DOCTYPE html>
<html><body style="margin:0;background:transparent;display:flex;flex-direction:column;
  align-items:center;justify-content:center;height:100vh;
  font-family:'Segoe UI',sans-serif;-webkit-app-region:drag">
  ${imgTag}
  <p style="color:#e2e8f0;font-size:20px;font-weight:700;margin:18px 0 4px;
    letter-spacing:0.08em">ARIES<span style="color:#be3278">POS</span></p>
  <p style="color:#64748b;font-size:11px;margin:0">Iniciando sistema...</p>
  <div style="margin-top:22px;width:180px;height:3px;background:#1a1f2e;
    border-radius:2px;overflow:hidden">
    <div style="height:100%;background:linear-gradient(90deg,#8b2158,#be3278);
      border-radius:2px;animation:ld 2.2s ease-in-out forwards" id="b"></div>
  </div>
  <style>@keyframes ld{0%{width:0}60%{width:65%}100%{width:100%}}</style>
</body></html>`);

  splashWindow.on('closed', () => { splashWindow = null; });
}

function createMainWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1100,
    minHeight: 700,
    backgroundColor: '#0f172a',
    frame: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
    icon: getAppIconPath(),
    show: false,
  });

  function loadRenderer() {
    if (isDev) {
      mainWindow!.loadURL('http://localhost:9200');
      mainWindow!.webContents.openDevTools({ mode: 'detach' });
    } else {
      const rendererPath = path.join(process.resourcesPath, 'renderer', 'index.html');
      mainWindow!.loadFile(rendererPath);
    }
  }

  // Siempre carga el renderer de escritorio completo (no la webpos del servidor)
  loadRenderer();

  mainWindow.once('ready-to-show', () => {
    console.log('[Main] mainWindow ready-to-show');
    mainWindow?.maximize();
    mainWindow?.show();
  });

  // Ctrl+Shift+R — restablecer configuración (funciona en CUALQUIER pantalla)
  mainWindow.webContents.on('before-input-event', (_event, input) => {
    if (input.type === 'keyDown' && input.control && input.shift && input.key.toLowerCase() === 'r') {
      resetAppConfig();
      app.relaunch();
      app.exit(0);
    }
  });

  mainWindow.on('closed', () => {
    console.log('[Main] mainWindow closed');
    mainWindow = null;
  });

  // Si falla la carga (ej. dev server no está), reintentar el renderer local
  mainWindow.webContents.on('did-fail-load', (_e, code, desc, url) => {
    console.error(`[Main] mainWindow did-fail-load: ${code} ${desc} ${url}`);
    if (!isDev) {
      setTimeout(() => {
        const rendererPath = path.join(process.resourcesPath, 'renderer', 'index.html');
        mainWindow?.loadFile(rendererPath);
      }, 1500);
    }
  });
}

export function createPosWindow(): void {
  if (posWindow && !posWindow.isDestroyed()) {
    posWindow.focus();
    posWindow.webContents.send('pos:reset');
    return;
  }

  posWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 1000,
    minHeight: 650,
    backgroundColor: '#0f172a',
    frame: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
    icon: getAppIconPath(),
    show: false,
  });

  if (isDev) {
    posWindow.loadURL('http://localhost:9200/#/pos');
  } else {
    const rendererPath = path.join(process.resourcesPath, 'renderer', 'index.html');
    posWindow.loadFile(rendererPath, { hash: '/pos' });
  }

  posWindow.once('ready-to-show', () => {
    posWindow?.maximize();
    posWindow?.show();
    posWindow?.focus();
  });

  posWindow.on('closed', () => {
    posWindow = null;
  });
}

ipcMain.on('open-pos-window', () => {
  createPosWindow();
});

ipcMain.on('close-pos-window', () => {
  if (posWindow && !posWindow.isDestroyed()) {
    posWindow.close();
  }
});

// ── Window controls ────────────────────────────────────────────────────────
ipcMain.on('window:minimize', (event) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  win?.minimize();
});
ipcMain.on('window:maximize', (event) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  if (!win) return;
  if (win.isMaximized()) win.unmaximize(); else win.maximize();
});
ipcMain.on('window:close', (event) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  win?.close();
});
ipcMain.handle('window:is-maximized', (event) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  return win?.isMaximized() ?? false;
});

ipcMain.on('broadcast-event', (_event, eventName: string, data: unknown) => {
  // Broadcast to main window
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send(eventName, data);
  }
  // Broadcast to pos window
  if (posWindow && !posWindow.isDestroyed()) {
    posWindow.webContents.send(eventName, data);
  }
});

ipcMain.handle('app:get-version', () => app.getVersion());
// Versión síncrona para preload.getAppVersion()
ipcMain.on('app:get-version-sync', (event) => { event.returnValue = app.getVersion(); });
ipcMain.handle('app:get-path', (_event, name: string) => app.getPath(name as Parameters<typeof app.getPath>[0]));

ipcMain.handle('dialog:open-file', async (_event, options) => {
  const result = await dialog.showOpenDialog(mainWindow!, options);
  return result;
});

ipcMain.handle('dialog:save-file', async (_event, options) => {
  const result = await dialog.showSaveDialog(mainWindow!, options);
  return result;
});

ipcMain.handle('dialog:open-directory', async (_event, options) => {
  const result = await dialog.showOpenDialog(mainWindow!, { ...options, properties: ['openDirectory'] });
  return result;
});

ipcMain.handle('shell:open-path', (_event, filePath: string) => {
  return shell.openPath(filePath);
});

ipcMain.handle('app:restart', () => {
  app.relaunch();
  app.exit(0);
});

ipcMain.handle('theme:set', (_event, theme: 'dark' | 'light' | 'system') => {
  nativeTheme.themeSource = theme;
});

// ── Config de red (modo servidor / cliente) ────────────────────────────
ipcMain.handle('app:getAppConfig', () => getAppConfig());

ipcMain.handle('app:setAppConfig', (_e, config: Record<string, unknown>) => {
  saveAppConfig(config as Parameters<typeof saveAppConfig>[0]);
  return { success: true };
});

ipcMain.handle('app:resetAppConfig', () => {
  resetAppConfig();
  return { success: true };
});

// Handler atómico: convierte esta PC en servidor y reinicia (una sola llamada, sin race conditions)
ipcMain.handle('app:become-server', () => {
  // Resetear completamente y luego establecer modo servidor limpio
  resetAppConfig();
  saveAppConfig({ mode: 'server', terminalName: 'Servidor' });
  app.relaunch();
  app.exit(0);
});

// Handler atómico: vuelve al setup inicial borrando toda la configuración
ipcMain.handle('app:reset-to-setup', () => {
  resetAppConfig();
  app.relaunch();
  app.exit(0);
});

// Llamado desde SetupScreen para activar modo cliente sin reiniciar
ipcMain.handle('app:switchToClientMode', (_e, { ip, port, terminalName }: { ip: string; port: number; terminalName: string }) => {
  saveAppConfig({ mode: 'client', serverIP: ip, serverPort: port, terminalName });
  // Reiniciar la app completa para que los proxy handlers se registren correctamente
  app.relaunch();
  app.exit(0);
  return { success: true };
});

// Test de conexión al servidor (usado en setup screen y NetworkSetupWindow)
ipcMain.handle('app:testServerConnection', async (_e, { ip, port }: { ip: string; port: number }) => {
  // Usa /api/ping (mismo endpoint que el escaneo de red, siempre disponible en todas las versiones)
  const url = `http://${ip}:${port}/api/ping`;
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 5000);
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timer);
    if (res.ok) return { ok: true };
    return { ok: false, error: `El servidor respondió con código HTTP ${res.status}` };
  } catch (err: any) {
    const msg = err?.name === 'AbortError'
      ? 'Sin respuesta del servidor en 5 segundos (timeout)'
      : err?.message || 'Error de red desconocido';
    return { ok: false, error: msg };
  }
});

ipcMain.handle('app:validateAdminCode', async (_e, code: string) => {
  const cfg = getAppConfig();
  if (cfg.mode === 'client' && cfg.serverIP) {
    try {
      const auth = 'Basic ' + Buffer.from(`admin:159753`).toString('base64');
      const { default: http } = await import('http');
      const data = await new Promise<string>((resolve, reject) => {
        const body = JSON.stringify({ pin: code });
        const req = http.request(
          { hostname: cfg.serverIP, port: cfg.serverPort || 3001, path: '/api/sync/auth/validate-admin', method: 'POST',
            headers: { Authorization: auth, 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) } },
          (res) => { let d = ''; res.on('data', c => d += c); res.on('end', () => resolve(d)); }
        );
        req.on('error', reject);
        req.write(body);
        req.end();
      });
      return (JSON.parse(data) as { valid: boolean }).valid ?? false;
    } catch { return false; }
  }
  try {
    const db = getDb();
    const row = db.prepare(`SELECT id FROM usuarios WHERE pin = ? AND activo = 1 AND rol = 'admin'`).get(code);
    return Boolean(row);
  } catch {
    return false;
  }
});

// ── Abrir puerto en el firewall de Windows (con elevación UAC visible) ───
ipcMain.handle('network:open-firewall', async (_e, port = 3001) => {
  if (process.platform !== 'win32') return { success: true };
  const { exec } = await import('child_process');
  const { promisify } = await import('util');
  const { writeFileSync } = await import('fs');
  const { tmpdir } = await import('os');
  const { join } = await import('path');
  const execAsync = promisify(exec);

  // Ruta al ejecutable de la app (para agregar regla por programa, más confiable que por puerto)
  const execPath = app.getPath('exe').replace(/\\/g, '\\\\');

  const scriptPath = join(tmpdir(), 'ariespos-net-setup.ps1');
  const script = [
    `$ErrorActionPreference = 'SilentlyContinue'`,
    `Write-Host "=== ARIESPos: Configurando red ===" -ForegroundColor Cyan`,
    `Write-Host ""`,
    ``,
    `# 1. Abrir puerto ${port} (profile=any cubre Publico + Privado + Dominio)`,
    `Write-Host "[1/3] Configurando regla de firewall para puerto ${port}..." -ForegroundColor Yellow`,
    `netsh advfirewall firewall delete rule name="ARIESPos-${port}" | Out-Null`,
    `netsh advfirewall firewall add rule name="ARIESPos-${port}" dir=in action=allow protocol=TCP localport=${port} profile=any`,
    `if ($LASTEXITCODE -eq 0) {`,
    `  Write-Host "     OK - Puerto ${port} habilitado (todos los perfiles)" -ForegroundColor Green`,
    `} else {`,
    `  Write-Host "     ERROR al crear regla de puerto" -ForegroundColor Red`,
    `}`,
    ``,
    `# 2. Agregar ARIESPos como aplicacion confiable por ejecutable`,
    `Write-Host "[2/3] Registrando ARIESPos como app confiable..." -ForegroundColor Yellow`,
    `netsh advfirewall firewall delete rule name="ARIESPos-app" | Out-Null`,
    `netsh advfirewall firewall add rule name="ARIESPos-app" dir=in action=allow program="${execPath}" profile=any`,
    `if ($LASTEXITCODE -eq 0) {`,
    `  Write-Host "     OK - ARIESPos autorizado como aplicacion confiable" -ForegroundColor Green`,
    `} else {`,
    `  Write-Host "     Nota: No se pudo agregar por ejecutable (continando con regla de puerto)" -ForegroundColor Yellow`,
    `}`,
    ``,
    `# 3. Cambiar redes Publicas a Privadas (Windows bloquea entrantes en red Publica)`,
    `Write-Host "[3/3] Verificando perfil de red..." -ForegroundColor Yellow`,
    `$perfiles = Get-NetConnectionProfile`,
    `foreach ($p in $perfiles) {`,
    `  if ($p.NetworkCategory -eq 0) {`,
    `    Set-NetConnectionProfile -InterfaceIndex $p.InterfaceIndex -NetworkCategory Private`,
    `    Write-Host "     OK - Red '$($p.Name)' cambiada de PUBLICA a Privada" -ForegroundColor Green`,
    `  } else {`,
    `    Write-Host "     OK - Red '$($p.Name)' ya esta configurada correctamente" -ForegroundColor Green`,
    `  }`,
    `}`,
    ``,
    `Write-Host ""`,
    `Write-Host "Configuracion completada. Esta ventana se cierra sola." -ForegroundColor Green`,
    `Start-Sleep -Seconds 4`,
    `Write-Host "DONE"`,
  ].join('\r\n');

  try { writeFileSync(scriptPath, script, 'utf8'); } catch (e) {
    return { success: false, error: `No se pudo crear script temporal: ${(e as Error).message}` };
  }

  // Intentar sin elevación primero (si ya es admin o la regla no requiere admin en este sistema)
  try {
    const { stdout } = await execAsync(
      `powershell -NoLogo -NonInteractive -ExecutionPolicy Bypass -File "${scriptPath}"`,
      { timeout: 12000 }
    );
    if (stdout.includes('DONE')) return { success: true };
  } catch { /* no es admin, continuar con UAC */ }

  // Elevar con UAC — minimizar ventana principal para que el prompt sea visible
  mainWindow?.minimize();
  try {
    // Sin -NonInteractive en el proceso hijo para que la ventana PS sea visible al usuario
    await execAsync(
      `powershell -NoLogo -NonInteractive -Command "Start-Process powershell.exe -ArgumentList '-NoLogo -ExecutionPolicy Bypass -File \\"${scriptPath}\\"' -Verb RunAs -Wait"`,
      { timeout: 90000 }
    );
    mainWindow?.restore();
    return { success: true };
  } catch (err) {
    mainWindow?.restore();
    return { success: false, error: (err as Error).message };
  }
});

// ── Diagnóstico completo del servidor local ───────────────────────────────
ipcMain.handle('network:diagnose', async () => {
  if (process.platform !== 'win32') {
    return { port3001Listening: true, localPingOk: true, firewallRule: true, hasPublicNetwork: false };
  }
  const { exec } = await import('child_process');
  const { promisify } = await import('util');
  const execAsync = promisify(exec);
  const result = {
    port3001Listening: false,
    localPingOk: false,
    firewallRule: false,
    hasPublicNetwork: false,
  };

  // ¿Está el puerto 3001 escuchando?
  try {
    const { stdout } = await execAsync(
      `powershell -NoProfile -NonInteractive -Command "Get-NetTCPConnection -LocalPort 3001 -State Listen -ErrorAction SilentlyContinue | Measure-Object | Select-Object -ExpandProperty Count"`,
      { timeout: 5000 }
    );
    result.port3001Listening = parseInt(stdout.trim()) > 0;
  } catch { result.port3001Listening = false; }

  // Ping local
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 2000);
    const r = await fetch('http://localhost:3001/api/ping', { signal: ctrl.signal });
    clearTimeout(t);
    result.localPingOk = r.ok;
  } catch { result.localPingOk = false; }

  // Regla de firewall
  try {
    const { stdout } = await execAsync(`netsh advfirewall firewall show rule name="ARIESPos-3001"`, { timeout: 5000 });
    result.firewallRule = stdout.includes('Rule Name:');
  } catch { result.firewallRule = false; }

  // ¿Hay alguna red clasificada como Pública? (NetworkCategory=0)
  try {
    const { stdout } = await execAsync(
      `powershell -NoProfile -NonInteractive -Command "(Get-NetConnectionProfile | Where-Object {$_.NetworkCategory -eq 0} | Measure-Object).Count"`,
      { timeout: 5000 }
    );
    result.hasPublicNetwork = parseInt(stdout.trim()) > 0;
  } catch { result.hasPublicNetwork = false; }

  return result;
});

// ── Consultar perfil de red Windows (Private/Public/Unknown) ─────────────
ipcMain.handle('network:get-profile', async () => {
  if (process.platform !== 'win32') return { profile: 'Private' };
  const { exec } = await import('child_process');
  const { promisify } = await import('util');
  const execAsync = promisify(exec);
  try {
    const { stdout } = await execAsync(
      `powershell -NoProfile -NonInteractive -Command "(Get-NetConnectionProfile | Select-Object -First 1).NetworkCategory"`,
      { timeout: 5000 }
    );
    const val = stdout.trim();
    return { profile: val || 'Unknown' };
  } catch {
    return { profile: 'Unknown' };
  }
});

// ── Test rápido ping al servidor (sin usar http para no bloquear) ──────────
ipcMain.handle('network:ping-server', async (_e, { ip, port }: { ip: string; port: number }) => {
  const { default: http } = await import('http');
  return new Promise<{ ok: boolean; ms?: number; error?: string }>((resolve) => {
    const t0 = Date.now();
    const req = http.get(`http://${ip}:${port}/api/ping`, { timeout: 3000 }, (res) => {
      res.resume();
      resolve({ ok: res.statusCode === 200, ms: Date.now() - t0 });
    });
    req.on('error', (e) => resolve({ ok: false, error: e.message }));
    req.on('timeout', () => { req.destroy(); resolve({ ok: false, error: 'timeout' }); });
  });
});

// ── Ventana de red ─────────────────────────────────────────────
ipcMain.handle('window:open-network', () => {
  if (networkWindow && !networkWindow.isDestroyed()) {
    networkWindow.focus();
    return;
  }
  networkWindow = new BrowserWindow({
    width: 800,
    height: 620,
    title: 'Configuración de Red — ARIESPos',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });
  networkWindow.on('closed', () => { networkWindow = null; });
  const netUrl = isDev
    ? 'http://localhost:9200/#/network-setup'
    : `file://${path.join(process.resourcesPath, 'renderer', 'index.html')}#/network-setup`;
  networkWindow.loadURL(netUrl);
});

// ── LICENCIA (global: funciona en ambos modos, servidor y cliente) ────────
ipcMain.handle('license:check', () => {
  const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;
  return { isDev, licensed: isDev || isLicensed(), key: readSavedLicense() };
});

ipcMain.handle('license:activate', (_e, key: string) => {
  if (!validateLicenseKey(key)) return { success: false, error: 'Clave inv\u00e1lida. Verific\u00e1 que la copiaste correctamente.' };
  saveLicense(key);
  return { success: true };
});

process.on('uncaughtException', (err) => {
  console.error('[FATAL] uncaughtException:', err);
});
process.on('unhandledRejection', (reason) => {
  console.error('[FATAL] unhandledRejection:', reason);
});

app.whenReady().then(async () => {
  console.log('[Main] app.whenReady fired');
  const appCfg = getAppConfig();
  const isClientMode = appCfg.mode === 'client' && Boolean(appCfg.serverIP);

  // Asegurar carpeta de datos
  const userDataPath = app.getPath('userData');
  const backupsPath = path.join(userDataPath, 'backups');
  if (!fs.existsSync(backupsPath)) {
    fs.mkdirSync(backupsPath, { recursive: true });
  }

  if (!isClientMode) {
    // SERVIDOR: inicializar DB local, abrir firewall, arrancar Express, registrar handlers locales
    try {
      await initDatabase();
      console.log('[Main] initDatabase OK');
    } catch (err) {
      console.error('[Main] initDatabase FAILED:', err);
      app.quit();
      return;
    }
    // Abrir firewall — siempre recrear la regla (delete + add) para garantizar profile=any
    // También cambiar perfil de red a Privado (red Pública puede bloquear todas las entrantes)
    try {
      const { exec } = await import('child_process');
      const { promisify } = await import('util');
      const { writeFileSync } = await import('fs');
      const { tmpdir } = await import('os');
      const { join } = await import('path');
      const execAsync = promisify(exec);
      const port = 3001;

      const scriptPath = join(tmpdir(), 'ariespos-fw-startup.ps1');
      const script = [
        // Cambiar red a Privada (evita bloqueo total en perfil Público)
        `try { Get-NetConnectionProfile | ForEach-Object { Set-NetConnectionProfile -InterfaceIndex $_.InterfaceIndex -NetworkCategory Private -ErrorAction SilentlyContinue } } catch {}`,
        // Asegurar que ni público ni privado tengan "bloquear TODO entrante"
        `netsh advfirewall set publicprofile firewallpolicy blockinbound,allowoutbound 2>$null`,
        `netsh advfirewall set privateprofile firewallpolicy blockinbound,allowoutbound 2>$null`,
        // Recrear regla
        `netsh advfirewall firewall delete rule name="ARIESPos-${port}" 2>$null`,
        `netsh advfirewall firewall add rule name="ARIESPos-${port}" dir=in action=allow protocol=TCP localport=${port} profile=any`,
        `Write-Host "DONE"`,
      ].join('\r\n');

      try { writeFileSync(scriptPath, script, 'utf8'); } catch { /* ignorar */ }

      const runArgs = `-NoLogo -NonInteractive -ExecutionPolicy Bypass -File "${scriptPath}"`;
      try {
        const { stdout } = await execAsync(`powershell ${runArgs}`, { timeout: 10000 });
        if (stdout.includes('DONE')) {
          console.log(`[Firewall] Regla recreada y perfil de red configurado — puerto ${port} abierto`);
        } else {
          throw new Error('sin DONE en stdout');
        }
      } catch {
        // Sin admin — intentar con elevación UAC
        console.log('[Firewall] Sin permisos admin, intentando elevación...');
        try {
          await execAsync(
            `powershell -NoLogo -NonInteractive -Command "Start-Process powershell -ArgumentList '${runArgs}' -Verb RunAs -Wait"`,
            { timeout: 35000 }
          );
          console.log(`[Firewall] Puerto ${port} configurado via elevación`);
        } catch (elevErr) {
          console.warn('[Firewall] Elevación fallida. El usuario puede usar el botón en la pantalla de Login:', elevErr);
        }
      }
    } catch (fwErr) {
      console.warn('[Firewall] Error general:', fwErr);
    }
    startServer();
    registerIpcHandlers();
  } else {
    // CLIENTE: sin DB local — todos los datos van al servidor a través de HTTP
    console.log(`[Main] Modo CLIENTE → ${appCfg.serverIP}:${appCfg.serverPort}`);
    try {
      const { registerClientProxyHandlers } = await import('./ipc/clientProxyHandlers');
      registerClientProxyHandlers(
        appCfg.serverIP,
        appCfg.serverPort || 3001,
      );
    } catch (proxyErr) {
      console.error('[Main] Error al registrar proxy handlers (modo cliente):', proxyErr);
      // Continuar igual — createMainWindow() siempre debe ejecutarse
    }
  }

  // Crear ventana principal (siempre carga el renderer de escritorio)
  // En producción mostramos el splash mientras carga
  if (app.isPackaged) {
    createSplash();
    createMainWindow();
    mainWindow?.once('ready-to-show', () => {
      setTimeout(() => {
        splashWindow?.close();
        mainWindow?.show();
      }, 1200);
    });
  } else {
    createMainWindow();
  }

  // Actualizaciones automáticas (solo en producción)
  if (app.isPackaged && mainWindow) {
    initAutoUpdater(mainWindow);
  }

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createMainWindow();
    }
  });
});

app.on('window-all-closed', async () => {
  // Backup automático al cerrar
  try {
    await autoBackup();
    await scheduleBackupCleanup();
  } catch (err) {
    console.error('Error en backup automático:', err);
  }

  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('before-quit', async () => {
  try {
    await autoBackup();
  } catch (err) {
    console.error('Error en backup antes de salir:', err);
  }
});

// Seguridad: deshabilitar navegación a URLs externas
app.on('web-contents-created', (_event, contents) => {
  contents.on('will-navigate', (event, url) => {
    const cfg = getAppConfig();
    const allowedOrigins = ['http://localhost:9200', 'file://'];
    // Permitir la URL del servidor en modo cliente
    if (cfg.mode === 'client' && cfg.serverIP) {
      allowedOrigins.push(`http://${cfg.serverIP}:${cfg.serverPort}`);
    }
    // Permitir IPs de red local (LAN) para el panel admin web
    const isLAN = /^http:\/\/(192\.168\.|10\.|172\.(1[6-9]|2[0-9]|3[01])\.)/.test(url);
    const isAllowed = isLAN || allowedOrigins.some(origin => url.startsWith(origin));
    if (!isAllowed) {
      event.preventDefault();
    }
  });

  contents.setWindowOpenHandler(() => {
    return { action: 'deny' };
  });
});
