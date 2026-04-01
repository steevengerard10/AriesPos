import { contextBridge, ipcRenderer } from 'electron';

// Expone API segura al renderer
const api = {
  // ── Genérico ──────────────────────────────────────────────────
  invoke: (channel: string, ...args: unknown[]) => ipcRenderer.invoke(channel, ...args),
  on: (channel: string, callback: (...args: unknown[]) => void) => {
    const subscription = (_event: Electron.IpcRendererEvent, ...args: unknown[]) => callback(...args);
    ipcRenderer.on(channel, subscription);
    return () => ipcRenderer.removeListener(channel, subscription);
  },
  once: (channel: string, callback: (...args: unknown[]) => void) => {
    ipcRenderer.once(channel, (_event, ...args) => callback(...args));
  },
  send: (channel: string, ...args: unknown[]) => ipcRenderer.send(channel, ...args),
  removeAllListeners: (channel: string) => ipcRenderer.removeAllListeners(channel),

  // ── Configuración ─────────────────────────────────────────────
  getAppMode:        () => ipcRenderer.invoke('app:get-mode'),
  saveSetupConfig:   (config: unknown) => ipcRenderer.invoke('setup:save-config', config),
  saveNetworkConfig: (config: unknown) => ipcRenderer.invoke('save-network-config', config),
  getLocalIP:        () => ipcRenderer.invoke('setup:get-local-ip'),
  resetConfig:       () => ipcRenderer.invoke('setup:reset-config'),

  // ── Conexión ──────────────────────────────────────────────────
  onConnectionChange: (cb: (status: string) => void) => {
    const fn = (_: Electron.IpcRendererEvent, s: string) => cb(s);
    ipcRenderer.on('connection:status', fn);
    return () => ipcRenderer.removeListener('connection:status', fn);
  },
  onClientsUpdate: (cb: (count: number) => void) => {
    const fn = (_: Electron.IpcRendererEvent, n: number) => cb(n);
    ipcRenderer.on('clients:count', fn);
    return () => ipcRenderer.removeListener('clients:count', fn);
  },

  // ── Actualizaciones ───────────────────────────────────────────
  onUpdateAvailable:  (cb: () => void) => ipcRenderer.on('update:available', cb as any),
  onUpdateDownloaded: (cb: () => void) => ipcRenderer.on('update:downloaded', cb as any),
  restartToUpdate:    () => ipcRenderer.send('update:restart'),

  // ── Ventana de red ────────────────────────────────────────────
  openNetworkWindow: () => ipcRenderer.invoke('window:open-network'),

  // ── Auth ─────────────────────────────────────────────────────
  authValidatePin:   (pin: string) => ipcRenderer.invoke('auth:validate-pin', pin),
  authValidateAdmin: (pin: string) => ipcRenderer.invoke('auth:validate-admin', pin),
  authGetUsers:      () => ipcRenderer.invoke('auth:get-users'),
  authCreateUser:    (data: unknown) => ipcRenderer.invoke('auth:create-user', data),
  authUpdateUser:    (id: number, data: unknown) => ipcRenderer.invoke('auth:update-user', id, data),
  authDeleteUser:    (id: number) => ipcRenderer.invoke('auth:delete-user', id),

  // ── Network scan ─────────────────────────────────────────────
  networkScan:       (port?: number) => ipcRenderer.invoke('network:scan', port),
  networkGetLocalIP: () => ipcRenderer.invoke('network:get-local-ip'),

  // ── Actualizador ─────────────────────────────────────────────
  updaterDownload:    () => ipcRenderer.invoke('updater:download'),
  updaterInstall:     () => ipcRenderer.invoke('updater:install'),
  updaterCheckManual: () => ipcRenderer.invoke('updater:check-manual'),
  getAppVersion:      () => ipcRenderer.sendSync('app:get-version-sync'),
};

contextBridge.exposeInMainWorld('electron', api);

// También exponer información de entorno
contextBridge.exposeInMainWorld('env', {
  platform: process.platform,
  isElectron: true,
});
