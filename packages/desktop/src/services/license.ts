/**
 * ARIESPos — Sistema de Licencias Offline
 * Validación sin internet, sin servidor externo.
 */
import { createHmac, randomBytes } from 'crypto';
import * as path from 'path';
import * as fs from 'fs';
import { app } from 'electron';

// Secret interno — ofuscado para no aparecer como texto plano en el binario
const _S = Buffer.from('4152494553504f535f4c49435f323032345f503754394b', 'hex').toString();
// Decodifica como: "ARIESPOS_LIC_2024_P7T9K"

/**
 * Tu clave personal de propietario — nunca paga, siempre válida.
 * Usala en tu propio equipo o para demos.
 */
export const MASTER_KEY = 'ARIES-PROP-IETA-RIO0-0001';

function _sig(payload: string): string {
  return createHmac('sha256', _S)
    .update(payload)
    .digest('hex')
    .toUpperCase()
    .slice(0, 8);
}

/**
 * Genera una nueva clave de licencia para vender a un cliente.
 * Cada clave es única y aleatoria.
 * Formato: ARIES-XXXX-XXXX-XXXX-XXXX
 */
export function generateLicenseKey(): string {
  const rand = randomBytes(4).toString('hex').toUpperCase(); // 8 chars de payload
  const sig  = _sig(rand);                                   // 8 chars de firma
  const full = rand + sig;                                   // 16 chars totales
  return `ARIES-${full.slice(0, 4)}-${full.slice(4, 8)}-${full.slice(8, 12)}-${full.slice(12, 16)}`;
}

/**
 * Valida una clave de licencia sin necesidad de internet.
 * Retorna true si la clave es válida (comprada o master).
 */
export function validateLicenseKey(key: string): boolean {
  if (!key) return false;
  const k = key.trim().toUpperCase();

  // Clave maestra del propietario — siempre válida
  if (k === MASTER_KEY) return true;

  // Formato esperado: ARIES-XXXX-XXXX-XXXX-XXXX → sin guiones = 5+16 = 21 chars
  const stripped = k.replace(/-/g, '');
  if (!stripped.startsWith('ARIES') || stripped.length !== 21) return false;

  const payload = stripped.slice(5, 13); // 8 chars
  const sig     = stripped.slice(13);    // 8 chars

  return _sig(payload) === sig;
}

function licensePath(): string {
  return path.join(app.getPath('userData'), 'license.key');
}

/** Lee la clave guardada localmente (si existe). */
export function readSavedLicense(): string | null {
  try {
    const p = licensePath();
    if (!fs.existsSync(p)) return null;
    return fs.readFileSync(p, 'utf-8').trim();
  } catch {
    return null;
  }
}

/** Guarda una clave de licencia válida en disco. */
export function saveLicense(key: string): void {
  fs.writeFileSync(licensePath(), key.trim().toUpperCase(), 'utf-8');
}

/** Retorna true si el equipo tiene una clave de licencia válida. */
export function isLicensed(): boolean {
  const key = readSavedLicense();
  return key ? validateLicenseKey(key) : false;
}
