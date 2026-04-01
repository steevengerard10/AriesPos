#!/usr/bin/env tsx
/**
 * ARIESPos — Generador de Claves de Licencia
 * 
 * Uso:
 *   pnpm keygen           → genera 1 clave nueva
 *   pnpm keygen 5         → genera 5 claves nuevas
 *   pnpm keygen validate ARIES-XXXX-XXXX-XXXX-XXXX  → valida una clave
 */

import { createHmac, randomBytes } from 'crypto';

// ⚠️ DEBE COINCIDIR CON packages/desktop/src/services/license.ts
const _S = Buffer.from('4152494553504f535f4c49435f323032345f503754394b', 'hex').toString();
const MASTER_KEY = 'ARIES-PROP-IETA-RIO0-0001';

function _sig(payload: string): string {
  return createHmac('sha256', _S).update(payload).digest('hex').toUpperCase().slice(0, 8);
}

function generateKey(): string {
  const rand = randomBytes(4).toString('hex').toUpperCase();
  const sig  = _sig(rand);
  const full = rand + sig;
  return `ARIES-${full.slice(0, 4)}-${full.slice(4, 8)}-${full.slice(8, 12)}-${full.slice(12, 16)}`;
}

function validateKey(key: string): boolean {
  if (!key) return false;
  const k = key.trim().toUpperCase();
  if (k === MASTER_KEY) return true;
  const stripped = k.replace(/-/g, '');
  if (!stripped.startsWith('ARIES') || stripped.length !== 21) return false;
  const payload = stripped.slice(5, 13);
  const sig     = stripped.slice(13);
  return _sig(payload) === sig;
}

// ── CLI ─────────────────────────────────────────────────────────────────────

const args = process.argv.slice(2);

console.log('\n🔑  ARIESPos — Generador de Licencias');
console.log('━'.repeat(52));

if (args[0] === 'validate') {
  const k = args[1];
  if (!k) {
    console.log('❌  Falta la clave. Ejemplo: pnpm keygen validate ARIES-XXXX-...');
  } else {
    const ok = validateKey(k);
    console.log(ok ? `✅  VÁLIDA  →  ${k}` : `❌  INVÁLIDA →  ${k}`);
  }
} else {
  const count = parseInt(args[0] ?? '1', 10) || 1;

  console.log(`\n🔐  Tu clave MAESTRA (uso personal — nunca vencida):`);
  console.log(`    ${MASTER_KEY}`);
  console.log('\n━'.repeat(52));
  console.log(`\n📦  ${count} clave${count > 1 ? 's' : ''} nueva${count > 1 ? 's' : ''} para vender:\n`);

  for (let i = 0; i < count; i++) {
    const k = generateKey();
    console.log(`    ${k}`);
  }

  console.log('\n━'.repeat(52));
  console.log('\n💡  Enviá cada clave por WhatsApp al cliente después de recibir el pago.');
  console.log('    Cada clave activa 1 equipo de forma permanente.\n');
}
