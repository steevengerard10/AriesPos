// packages/desktop/src/main/preload.ts
import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('electron', {
  // ── Configuración inicial ─────────────────────────────────────
  getAppMode:          () => ipcRenderer.invoke('app:get-mode'),
  saveSetupConfig:     (config: any) => ipcRenderer.invoke('setup:save-config', config),
  saveNetworkConfig:   (config: any) => ipcRenderer.invoke('save-network-config', config),
  getLocalIP:          () => ipcRenderer.invoke('setup:get-local-ip'),
  resetConfig:         () => ipcRenderer.invoke('setup:reset-config'),

  // ── Conexión ──────────────────────────────────────────────────
  onConnectionChange:  (cb: (status: string) => void) => {
    ipcRenderer.on('connection:status', (_, s) => cb(s))
    return () => ipcRenderer.removeAllListeners('connection:status')
  },
  onClientsUpdate:     (cb: (count: number) => void) => {
    ipcRenderer.on('clients:count', (_, n) => cb(n))
    return () => ipcRenderer.removeAllListeners('clients:count')
  },

  // ── Actualizaciones ───────────────────────────────────────────
  onUpdateAvailable:  (cb: () => void) => ipcRenderer.on('update:available', cb),
  onUpdateDownloaded: (cb: () => void) => ipcRenderer.on('update:downloaded', cb),
  restartToUpdate:    () => ipcRenderer.send('update:restart'),

  // ── Ventana de red ────────────────────────────────────────────
  openNetworkWindow:  () => ipcRenderer.invoke('window:open-network'),

  // ── Auth: usuarios y PINs ────────────────────────────────────
  authValidatePin:   (pin: string) => ipcRenderer.invoke('auth:validate-pin', pin),
  authValidateAdmin: (pin: string) => ipcRenderer.invoke('auth:validate-admin', pin),
  authGetUsers:      () => ipcRenderer.invoke('auth:get-users'),
  authCreateUser:    (data: { nombre: string; pin: string; rol: string }) =>
    ipcRenderer.invoke('auth:create-user', data),
  authUpdateUser:    (id: number, data: Record<string, unknown>) =>
    ipcRenderer.invoke('auth:update-user', id, data),
  authDeleteUser:    (id: number) => ipcRenderer.invoke('auth:delete-user', id),

  // ── Network: escaneo LAN ─────────────────────────────────────
  networkScan:      (port?: number) => ipcRenderer.invoke('network:scan', port),
  networkGetLocalIP: () => ipcRenderer.invoke('network:get-local-ip'),

  // ── Invocación genérica (para api.ts) ─────────────────────────
  invoke: (channel: string, ...args: any[]) => ipcRenderer.invoke(channel, ...args),
  on: (channel: string, cb: (...args: any[]) => void) => {
    const wrapped = (_: any, ...a: any[]) => cb(...a)
    ipcRenderer.on(channel, wrapped)
    return () => ipcRenderer.removeListener(channel, wrapped)
  },
  once: (channel: string, cb: (...args: any[]) => void) => {
    ipcRenderer.once(channel, (_, ...a) => cb(...a))
  },
  send: (channel: string, ...args: any[]) => ipcRenderer.send(channel, ...args),
  removeAllListeners: (channel: string) => ipcRenderer.removeAllListeners(channel),
})

