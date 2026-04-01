// packages/desktop/src/main/main.ts
import { app, BrowserWindow, ipcMain } from 'electron'
import path from 'path'
import { getConfig, saveConfig, resetConfig, isConfigured } from './config/mode.config'
import { startServer, setMainWindow } from './server/index'
import { autoUpdater } from 'electron-updater';
import { Menu } from 'electron';

let mainWindow: BrowserWindow | null = null
let networkWindow: BrowserWindow | null = null

async function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 1024,
    minHeight: 640,
    frame: false,
    titleBarStyle: 'hidden',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  })

  // Si no está configurado → mostrar pantalla de setup
  if (!isConfigured()) {
    mainWindow.loadURL(
      process.env.NODE_ENV === 'development'
        ? 'http://localhost:5173/#/setup'
        : `file://${path.join(__dirname, '../renderer/index.html')}#/setup`
    )
    return
  }

  const config = getConfig()!

  setMainWindow(mainWindow)

  if (config.mode === 'server') {
    // Modo servidor: iniciar Express + Socket.IO local
    await startServer({ port: config.serverPort, mode: 'server' })
  } else {
    // Modo cliente: conectar al servidor remoto
    await startServer({
      port: config.serverPort,
      mode: 'client',
      serverIP: config.serverIP!,
    })
  }

  // Cargar la app principal
  mainWindow.loadURL(
    process.env.NODE_ENV === 'development'
      ? 'http://localhost:5173'
      : `file://${path.join(__dirname, '../renderer/index.html')}`
  )

  // --- AUTO-ACTUALIZACIÓN ---
  autoUpdater.checkForUpdatesAndNotify();

  autoUpdater.on('update-available', () => {
    mainWindow?.webContents.send('update:available');
  });
  autoUpdater.on('update-downloaded', () => {
    mainWindow?.webContents.send('update:downloaded');
  });
  ipcMain.on('update:restart', () => {
    autoUpdater.quitAndInstall();
  });
}

// IPC: guardar configuración desde la pantalla de setup
ipcMain.handle('setup:save-config', async (_, config) => {
  saveConfig({ ...config, configuredAt: new Date().toISOString() })
  // Reiniciar la app para aplicar la configuración
  app.relaunch()
  app.exit(0)
})

// IPC: obtener IP local de esta PC
ipcMain.handle('setup:get-local-ip', async () => {
  const { networkInterfaces } = await import('os')
  const nets = networkInterfaces()
  for (const name of Object.keys(nets)) {
    for (const net of nets[name]!) {
      if (net.family === 'IPv4' && !net.internal) {
        return net.address
      }
    }
  }
  return '127.0.0.1'
})

// IPC: resetear configuración (para cambiar de modo)
ipcMain.handle('setup:reset-config', async () => {
  resetConfig()
  app.relaunch()
  app.exit(0)
})

// --- NUEVA VENTANA DE CONFIGURACIÓN DE RED ---

function createNetworkWindow() {
  if (networkWindow) {
    networkWindow.focus()
    return
  }
  networkWindow = new BrowserWindow({
    width: 480,
    height: 520,
    resizable: false,
    title: 'Configurar Red ARIESPos',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  })
  networkWindow.on('closed', () => { networkWindow = null })
  networkWindow.loadURL(
    process.env.NODE_ENV === 'development'
      ? 'http://localhost:5173/#/network-setup'
      : `file://${path.join(__dirname, '../renderer/index.html')}#/network-setup`
  )
}

// Atajo global para abrir la ventana de red (puedes cambiar el trigger)
app.whenReady().then(() => {
  // Por ejemplo, F9 abre la ventana de red
  const { globalShortcut } = require('electron')
  globalShortcut.register('F9', createNetworkWindow)
})

// IPC para guardar la configuración de red desde la ventana
ipcMain.handle('save-network-config', async (_event, config) => {
  await saveConfig(config)
  app.relaunch()
  app.exit()
})

// --- VENTANA DE RED ---
ipcMain.handle('window:open-network', async () => {
  if (networkWindow) {
    networkWindow.focus();
    return;
  }
  networkWindow = new BrowserWindow({
    width: 800,
    height: 600,
    title: 'Configuración de Red — ARIESPos',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  networkWindow.on('closed', () => { networkWindow = null; });
  networkWindow.loadURL(
    process.env.NODE_ENV === 'development'
      ? 'http://localhost:5173/#/network'
      : `file://${path.join(__dirname, '../renderer/index.html')}#/network`
  );
});

// --- MENÚ SUPERIOR PARA CONFIGURAR RED ---

import type { MenuItemConstructorOptions } from 'electron';

const template: MenuItemConstructorOptions[] = [
  {
    label: 'Archivo',
    submenu: [
      {
        label: 'Configurar Red',
        click: () => {
          createNetworkWindow();
        }
      },
      { role: 'quit' as const }
    ]
  }
];
const menu = Menu.buildFromTemplate(template);
Menu.setApplicationMenu(menu);

app.whenReady().then(createWindow)
