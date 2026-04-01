// packages/desktop/src/updater.ts
import { autoUpdater } from 'electron-updater';
import { BrowserWindow, ipcMain } from 'electron';
import * as path from 'path';
import * as fs from 'fs';

// Configurar log de actualizaciones en archivo (no en consola, no molesta al usuario)
const logPath = path.join(
  process.env.APPDATA || process.env.HOME || '',
  'ARIESPos',
  'update.log'
);
try {
  const logDir = path.dirname(logPath);
  if (!fs.existsSync(logDir)) fs.mkdirSync(logDir, { recursive: true });
} catch { /* silencioso */ }

autoUpdater.logger = {
  info:  (msg: unknown) => fs.appendFileSync(logPath, `[INFO]  ${new Date().toISOString()} ${msg}\n`),
  warn:  (msg: unknown) => fs.appendFileSync(logPath, `[WARN]  ${new Date().toISOString()} ${msg}\n`),
  error: (msg: unknown) => fs.appendFileSync(logPath, `[ERROR] ${new Date().toISOString()} ${msg}\n`),
  debug: (_msg: unknown) => { /* silencioso */ },
} as unknown as typeof autoUpdater.logger;

// No descargar automáticamente — el usuario decide
autoUpdater.autoDownload = false;
// Instalar al cerrar la app (no forzar reinicio)
autoUpdater.autoInstallOnAppQuit = true;

export function initAutoUpdater(mainWindow: BrowserWindow): void {
  // Verificar actualizaciones al iniciar (silencioso si no hay nada)
  setTimeout(() => {
    autoUpdater.checkForUpdates().catch(() => { /* sin internet, ok */ });
  }, 8000); // esperar 8s para que la app cargue primero

  // ── EVENTOS ──────────────────────────────────────────────────────────────

  autoUpdater.on('checking-for-update', () => {
    sendSafe(mainWindow, 'updater:checking');
  });

  autoUpdater.on('update-available', (info) => {
    sendSafe(mainWindow, 'updater:available', {
      version: info.version,
      releaseDate: info.releaseDate,
      releaseNotes: info.releaseNotes,
    });
  });

  autoUpdater.on('update-not-available', () => {
    sendSafe(mainWindow, 'updater:not-available');
  });

  autoUpdater.on('download-progress', (progress) => {
    sendSafe(mainWindow, 'updater:progress', {
      percent:        Math.round(progress.percent),
      transferred:    progress.transferred,
      total:          progress.total,
      bytesPerSecond: progress.bytesPerSecond,
    });
  });

  autoUpdater.on('update-downloaded', (info) => {
    sendSafe(mainWindow, 'updater:downloaded', {
      version: info.version,
    });
  });

  autoUpdater.on('error', (err) => {
    sendSafe(mainWindow, 'updater:error', err.message);
  });

  // ── IPC HANDLERS ─────────────────────────────────────────────────────────

  // El usuario acepta descargar
  ipcMain.removeHandler('updater:download');
  ipcMain.handle('updater:download', () => {
    autoUpdater.downloadUpdate().catch(console.error);
  });

  // El usuario quiere instalar ahora
  ipcMain.removeHandler('updater:install');
  ipcMain.handle('updater:install', () => {
    autoUpdater.quitAndInstall(false, true);
  });

  // Verificar manualmente desde Configuración
  ipcMain.removeHandler('updater:check-manual');
  ipcMain.handle('updater:check-manual', async () => {
    try {
      const result = await autoUpdater.checkForUpdates();
      return { hasUpdate: !!result?.updateInfo?.version };
    } catch {
      return { hasUpdate: false, error: 'Sin conexión a internet' };
    }
  });
}

function sendSafe(win: BrowserWindow, channel: string, data?: unknown): void {
  if (win && !win.isDestroyed()) {
    win.webContents.send(channel, data);
  }
}
