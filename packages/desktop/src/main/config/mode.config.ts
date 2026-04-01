// packages/desktop/src/main/config/mode.config.ts
import { app } from 'electron'
import path from 'path'
import fs from 'fs'

export interface ARIESPosConfig {
  mode: 'server' | 'client'
  serverIP?: string
  serverPort: number
  negocioNombre: string
  configuredAt: string
}

const CONFIG_PATH = path.join(app.getPath('userData'), 'ariespos-config.json')

export function getConfig(): ARIESPosConfig | null {
  try {
    if (!fs.existsSync(CONFIG_PATH)) return null
    return JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf-8'))
  } catch {
    return null
  }
}

export function saveConfig(config: ARIESPosConfig): void {
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2), 'utf-8')
}

export function resetConfig(): void {
  if (fs.existsSync(CONFIG_PATH)) fs.unlinkSync(CONFIG_PATH)
}

export function isConfigured(): boolean {
  return getConfig() !== null
}
