/**
 * Hora de referencia del servidor principal (PC administrador).
 * Al iniciar se sincroniza contra GET /api/servidor/hora; si falla, usa hora local.
 */

import { appAPI } from './api';

let offsetMs = 0;
let synced = false;

export function getServerNow(): Date {
  if (!synced) return new Date();
  return new Date(Date.now() + offsetMs);
}

export function isServerTimeSynced(): boolean {
  return synced;
}

export async function syncServerTime(): Promise<boolean> {
  const t0 = Date.now();
  try {
    const data = await appAPI.getServerHora();
    const serverMs = new Date(data.now).getTime();
    if (Number.isNaN(serverMs)) throw new Error('Hora del servidor inválida');
    const t1 = Date.now();
    offsetMs = serverMs - (t0 + t1) / 2;
    synced = true;
    return true;
  } catch {
    offsetMs = 0;
    synced = false;
    return false;
  }
}

export function startServerTimeSync(intervalMs = 5 * 60 * 1000): () => void {
  const id = setInterval(() => {
    void syncServerTime();
  }, intervalMs);
  return () => clearInterval(id);
}
