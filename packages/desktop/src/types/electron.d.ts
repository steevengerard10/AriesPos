export interface ARIESUser {
  id: number;
  nombre: string;
  pin: string;
  rol: 'admin' | 'vendedor' | 'readonly';
  activo: number;
}

export interface ScannedServer {
  ip: string;
  port: number;
  nombre: string;
}

export interface ElectronAPI {
  // Configuración
  getAppMode: () => Promise<string>;
  saveSetupConfig: (config: any) => Promise<void>;
  saveNetworkConfig: (config: any) => Promise<void>;
  getLocalIP: () => Promise<string>;
  resetConfig: () => Promise<void>;

  // Conexión
  onConnectionChange: (cb: (status: string) => void) => () => void;
  onClientsUpdate: (cb: (count: number) => void) => () => void;

  // Actualizaciones
  onUpdateAvailable: (cb: () => void) => void;
  onUpdateDownloaded: (cb: () => void) => void;
  restartToUpdate: () => void;

  // Ventana de red
  openNetworkWindow: () => void;

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

  // Genérico
  invoke: (channel: string, ...args: any[]) => Promise<any>;
  on: (channel: string, cb: (...args: any[]) => void) => () => void;
  once: (channel: string, cb: (...args: any[]) => void) => void;
  send: (channel: string, ...args: any[]) => void;
  removeAllListeners: (channel: string) => void;
}

declare interface Window {
  electron: ElectronAPI;
}
