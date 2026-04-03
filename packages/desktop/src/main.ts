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

function createSplash(): void {
  const logoPath = app.isPackaged
    ? path.join(process.resourcesPath, 'logo', 'aries_logo.svg')
    : path.join(__dirname, '../../packages/renderer/src/assets/aries_logo.svg');

  splashWindow = new BrowserWindow({
    width: 380,
    height: 440,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    center: true,
    resizable: false,
    skipTaskbar: true,
    icon: path.join(__dirname, '../assets/icon.ico'),
    webPreferences: { contextIsolation: true, nodeIntegration: false },
  });

  const logoUrl = `file://${logoPath.replace(/\\/g, '/')}`;
  splashWindow.loadURL(`data:text/html;charset=utf-8,<!DOCTYPE html>
<html><body style="margin:0;background:transparent;display:flex;flex-direction:column;
  align-items:center;justify-content:center;height:100vh;
  font-family:'Segoe UI',sans-serif;-webkit-app-region:drag">
  <img src="${logoUrl}" style="width:120px;height:120px;object-fit:contain;
    filter:drop-shadow(0 0 24px rgba(190,50,120,0.7))" />
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
    titleBarStyle: 'hidden',
    titleBarOverlay: {
      color: '#1e293b',
      symbolColor: '#94a3b8',
      height: 36,
    },
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
    icon: path.join(__dirname, process.platform === 'win32' ? '../assets/icon.ico' : '../assets/icon.png'),
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
    mainWindow?.show();
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
    titleBarStyle: 'hidden',
    titleBarOverlay: {
      color: '#1e293b',
      symbolColor: '#94a3b8',
      height: 36,
    },
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
    icon: path.join(__dirname, process.platform === 'win32' ? '../assets/icon.ico' : '../assets/icon.png'),
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

// Llamado desde SetupScreen para activar modo cliente sin reiniciar
ipcMain.handle('app:switchToClientMode', (_e, { ip, port, terminalName }: { ip: string; port: number; terminalName: string }) => {
  saveAppConfig({ mode: 'client', serverIP: ip, serverPort: port, terminalName });
  // Reiniciar la app completa para que los proxy handlers se registren correctamente
  app.relaunch();
  app.exit(0);
  return { success: true };
});

// Test de conexión al servidor (usado en setup screen)
ipcMain.handle('app:testServerConnection', async (_e, { ip, port }: { ip: string; port: number }) => {
  const { default: http } = await import('http');
  return new Promise<{ ok: boolean; info?: Record<string, unknown>; error?: string }>((resolve) => {
    const req = http.get(`http://${ip}:${port}/api/servidor/info`, { timeout: 4000 }, (res) => {
      if (res.statusCode === 200 || res.statusCode === 401) {
        resolve({ ok: true });
      } else {
        resolve({ ok: false, error: `HTTP ${res.statusCode}` });
      }
      res.resume();
    });
    req.on('error', (e) => resolve({ ok: false, error: e.message }));
    req.on('timeout', () => { req.destroy(); resolve({ ok: false, error: 'Tiempo de espera agotado' }); });
  });
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
    // Abrir firewall — profile=any para cubrir redes Public, Private y Domain
    try {
      const { exec } = await import('child_process');
      const { promisify } = await import('util');
      const execAsync = promisify(exec);
      const port = 3001;
      const addRule = `netsh advfirewall firewall add rule name="ARIESPos-${port}" dir=in action=allow protocol=TCP localport=${port} profile=any`;
      let ruleExists = false;
      try {
        const { stdout } = await execAsync(`netsh advfirewall firewall show rule name="ARIESPos-${port}"`);
        // Verificar que la regla existente tenga profile=any (puede ser una regla vieja sin ese profile)
        ruleExists = stdout.includes('Profiles:') ? stdout.toLowerCase().includes('any') : true;
      } catch { /* regla no existe */ }

      if (!ruleExists) {
        // Intentar primero sin elevación (si ya hay admin)
        try {
          await execAsync(`netsh advfirewall firewall delete rule name="ARIESPos-${port}"`);
        } catch { /* ignorar */ }
        try {
          await execAsync(addRule);
          console.log(`[Firewall] Puerto ${port} abierto (profile=any)`);
        } catch {
          // Sin admin — usar PowerShell con Start-Process -Verb RunAs (UAC popup)
          console.log('[Firewall] Sin admin, intentando elevación via PowerShell...');
          try {
            const psCmd = `Start-Process -FilePath 'netsh' -ArgumentList 'advfirewall firewall add rule name=\"ARIESPos-${port}\" dir=in action=allow protocol=TCP localport=${port} profile=any' -Verb RunAs -Wait -WindowStyle Hidden`;
            await execAsync(`powershell -NoProfile -NonInteractive -Command "${psCmd}"`);
            console.log(`[Firewall] Puerto ${port} abierto via PowerShell elevado`);
          } catch (elevErr) {
            console.warn('[Firewall] No se pudo abrir el puerto. El usuario rechazó la elevación o no tiene permisos:', elevErr);
          }
        }
      } else {
        console.log(`[Firewall] Puerto ${port} ya tiene regla con profile=any`);
      }
    } catch (fwErr) {
      console.warn('[Firewall] Error general al configurar firewall:', fwErr);
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
