/// <reference types="vite/client" />

// Declaración global para evitar errores de window.electronAPI

interface ElectronAPI {
  getAppMode: () => Promise<{ mode: string; serverIP?: string }>
  saveSetupConfig: (config: any) => Promise<any>
  saveNetworkConfig: (config: any) => Promise<any>
  getLocalIP: () => Promise<string>
  resetConfig: () => void
  onConnectionChange: (cb: (status: string) => void) => void
  onClientsUpdate: (cb: (count: number) => void) => void
  onUpdateAvailable: (cb: () => void) => void
  onUpdateDownloaded: (cb: () => void) => void
  restartToUpdate: () => void
  openNetworkWindow: () => void
}

declare global {
  interface Window {
    electron: ElectronAPI
  }
}
