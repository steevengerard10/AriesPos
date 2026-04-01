import { app } from 'electron';
import path from 'path';
import fs from 'fs';

export interface AppConfig {
  mode: 'server' | 'client' | 'server-only' | null;
  serverIP: string;
  serverPort: number;
  terminalName: string;
}

const DEFAULT: AppConfig = {
  mode: null,
  serverIP: '',
  serverPort: 3001,
  terminalName: 'Terminal',
};

function getConfigPath(): string {
  return path.join(app.getPath('userData'), 'app-config.json');
}

export function getAppConfig(): AppConfig {
  try {
    const p = getConfigPath();
    if (fs.existsSync(p)) {
      return { ...DEFAULT, ...JSON.parse(fs.readFileSync(p, 'utf-8')) };
    }
  } catch { /* ignore */ }
  return { ...DEFAULT };
}

export function saveAppConfig(config: Partial<AppConfig>): void {
  const current = getAppConfig();
  fs.writeFileSync(getConfigPath(), JSON.stringify({ ...current, ...config }, null, 2));
}

export function resetAppConfig(): void {
  try { fs.unlinkSync(getConfigPath()); } catch { /* ignore */ }
}
