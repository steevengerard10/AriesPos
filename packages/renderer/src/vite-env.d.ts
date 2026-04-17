/// <reference types="vite/client" />

interface ARIESUser {
  id: number;
  nombre: string;
  pin: string;
  rol: 'admin' | 'vendedor' | 'readonly';
  activo: number;
}

interface ScannedServer {
  ip: string;
  port: number;
  nombre: string;
}

interface ElectronAPI {
  // Genérico
  invoke: (channel: string, ...args: unknown[]) => Promise<unknown>;
  on: (channel: string, callback: (...args: unknown[]) => void) => () => void;
  once: (channel: string, callback: (...args: unknown[]) => void) => void;
  send: (channel: string, ...args: unknown[]) => void;
  removeAllListeners: (channel: string) => void;

  // Configuración y red
  openNetworkWindow: () => void;
  saveNetworkConfig: (config: any) => Promise<unknown>;
  getAppMode: () => Promise<string>;
  saveSetupConfig: (config: any) => Promise<void>;
  getLocalIP: () => Promise<string>;
  resetConfig: () => Promise<void>;

  // Auth
  authValidatePin: (pin: string) => Promise<{ ok: boolean; user?: ARIESUser; error?: string }>;
  authValidateAdmin: (pin: string) => Promise<{ ok: boolean; error?: string }>;
  authGetUsers: () => Promise<ARIESUser[]>;
  authCreateUser: (data: { nombre: string; pin: string; rol: string }) => Promise<{ ok: boolean; id?: number; error?: string }>;
  authUpdateUser: (id: number, data: Partial<ARIESUser>) => Promise<{ ok: boolean; error?: string }>;
  authDeleteUser: (id: number) => Promise<{ ok: boolean; error?: string }>;

  // Network scan
  networkScan: (port?: number) => Promise<ScannedServer[]>;
  networkGetLocalIP: () => Promise<string>;
  networkServerInfo: () => Promise<{ localIP: string; port: number }>;
  networkOpenFirewall: (port?: number) => Promise<void>;
  networkPingServer: (ip: string, port: number) => Promise<boolean>;
  networkGetProfile: () => Promise<unknown>;

  // Controles de ventana
  windowMinimize: () => void;
  windowMaximize: () => void;
  windowClose: () => void;
  windowIsMaximized: () => Promise<boolean>;
  onWindowMaximize: (cb: () => void) => () => void;

  // Conexión
  onConnectionChange: (cb: (status: string) => void) => () => void;
  onClientsUpdate: (cb: (count: number) => void) => () => void;
  becomeServer: () => Promise<void>;
  resetToSetup: () => Promise<void>;

  // Actualizaciones
  onUpdateAvailable: (cb: () => void) => void;
  onUpdateDownloaded: (cb: () => void) => void;
  restartToUpdate: () => void;
  updaterDownload: () => Promise<void>;
  updaterInstall: () => Promise<void>;
  updaterCheckManual: () => Promise<void>;
  getAppVersion: () => string;

  // Licencia
  licenseCheck: () => Promise<{ licensed: boolean }>;
  licenseActivate: (key: string) => Promise<{ ok: boolean; error?: string }>;
}

interface EnvAPI {
  platform: string;
  isElectron: boolean;
}

declare global {
  interface Window {
    electron: ElectronAPI;
    env?: EnvAPI;
  }
}

export {};
