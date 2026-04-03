/**
 * nx1-reader.ts
 *
 * Lector binario del formato NexusDB (NX!2) para backups de Nextar.
 *
 * Estructura real del archivo Produto.nx1 (verificado con backup real):
 *  - Páginas de 4096 bytes, encabezado NXHD en páginas de datos
 *  - Strings: null-terminated UTF-16LE (nxtWideString)
 *  - Precios: Int64 LE × 10000 (nxtCurrency)
 *
 * Patrón de registro de producto (en orden dentro de la página NXHD):
 *   [fk_descr_categoria]  ← categoría (string)
 *   [binario: GUIDs subcategoría, marca, uid_unidade]
 *   [fk_descr_unidade]    ← "Pieza" / "Kg" / etc.   ← ANCLA U1
 *   [GUID Marca: 16 bytes]
 *   [Codigo]              ← código interno (string)
 *   [CodigoNum: 4 bytes UInt32]
 *   [Codigo2]             ← código secundario (string, generalmente vacío)
 *   [EanGtin]             ← código de barras (string numérico)
 *   [Codigo2Num: 4 bytes UInt32]
 *   [Descricao]           ← nombre del producto  ← BUSCAMOS ESTO
 *   [Unid]                ← "Pieza" / "Kg" / etc.   ← ANCLA U2 (duplicado)
 *   [Preco: Int64LE]      ← precio × 10000          ← PRECIO REAL
 *   [... más campos: costo, stock, etc. ...]
 */

import * as iconv from 'iconv-lite';

const PAGE_SIZE = 4096;
const NXHD = Buffer.from('NXHD');

// Unidades de medida reconocidas por Nextar
const UNIT_SET = new Set([
  'Pieza', 'pieza', 'Kg', 'kg', 'Litro', 'litro',
  'Lt', 'lt', 'Un', 'un', 'Unid', 'unid', 'Caja', 'caja',
  'Pack', 'pack', 'Fardo', 'fardo', 'Docena', 'docena',
  'Gramo', 'gramo', 'Gr', 'gr', 'Metro', 'metro', 'Mt', 'mt',
  'Mililitro', 'ml', 'ML', 'mL', 'Lata', 'lata', 'Botella', 'botella',
]);

const FRACCIONABLE_UNITS = new Set(['kg', 'gramo', 'gr', 'litro', 'lt', 'ml', 'metro', 'mt']);

function hasAsciiControlChars(s: string): boolean {
  for (let i = 0; i < s.length; i++) {
    if (s.charCodeAt(i) <= 0x1f) return true;
  }
  return false;
}

/**
 * Verifica que el string sea un nombre de producto válido (español).
 * Rechaza nombres con símbolos raros provenientes de datos binarios/imagen.
 */
function isValidProductName(s: string): boolean {
  if (s.length < 3) return false;
  // El primer carácter debe ser letra o dígito (no '@', '*', etc.)
  if (!/^[a-zA-ZáéíóúñüäöïçàèÁÉÍÓÚÑÜÄÖÏÇÀÈ0-9]/.test(s)) return false;
  // Solo caracteres válidos en nombres de productos (español)
  const valid = /^[\x20-\x7EáéíóúñüäöïçàèÁÉÍÓÚÑÜÄÖÏÇÀÈìùÌÙ°ºª¡¿]+$/.test(s);
  if (!valid) return false;
  // Al menos 2 letras
  const letters = s.split('').filter(c => /[a-záéíóúñüäöïçàèÁÉÍÓÚÑÜÄÖÏÇÀÈ]/i.test(c)).length;
  return letters >= 2;
}

/** Lee string null-terminated UTF-16LE a partir de `offset`. Devuelve [texto, próximo_offset] */
function readUtf16le(buf: Buffer, offset: number, maxLen = 200): [string, number] {
  const chars: string[] = [];
  let i = offset;
  while (i + 1 < buf.length && chars.length < maxLen) {
    const lo = buf[i];
    const hi = buf[i + 1];
    if (lo === 0 && hi === 0) return [chars.join(''), i + 2];
    chars.push(Buffer.from([lo, hi]).toString('utf16le'));
    i += 2;
  }
  return [chars.join(''), i + 2];
}

/** Lee Int64 LE (precio × 10000 en Nextar) */
function readInt64LE(buf: Buffer, offset: number): number {
  if (offset + 8 > buf.length) return 0;
  const lo = buf.readUInt32LE(offset);
  const hi = buf.readInt32LE(offset + 4);
  return hi * 0x100000000 + lo;
}

/** Corrige encoding de strings (fallback para nombres con tildes en CP1252) */
function fixEncoding(str: string): string {
  try {
    return iconv.decode(Buffer.from(str, 'binary'), 'win1252').trim();
  } catch {
    return str.trim();
  }
}

// ── Tipos públicos ────────────────────────────────────────────────────────────

export interface RawProduct {
  codigo: string;
  codigoBarras: string | null;
  nombre: string;
  categoria: string;
  precioVenta: number;
  precioCosto: number;
  stockActual: number;
  unidadMedida: string;
  fraccionable: boolean;
}

export interface RawCategoria {
  nombre: string;
}

export interface RawCliente {
  nombre: string;
  telefono: string;
  email: string;
  direccion: string;
}

// ── Extractor de PRODUCTOS ────────────────────────────────────────────────────
/**
 * Estrategia corregida (verificada con backup real):
 * 1. Buscar string U1 = unidad de medida (fk_descr_unidade)
 * 2. Desde U1_end, buscar forward el string U2 = misma unidad (campo Unid, duplicado)
 *    dentro de un rango de 500 bytes
 * 3. El precio Int64LE está en U2_end (inmediatamente después)
 * 4. El nombre del producto (Descricao) es el último string entre U1_end y U2_start
 * 5. El EAN/código es el string numérico de 7-14 dígitos que precede al nombre
 * 6. La categoría está en los strings ANTES del EAN en la página
 */
export function extractProductsFromBuffer(data: Buffer): RawProduct[] {
  const products: RawProduct[] = [];
  const totalPages = Math.floor(data.length / PAGE_SIZE);

  type StrEntry = { start: number; end: number; text: string };

  for (let p = 0; p < totalPages; p++) {
    const page = data.slice(p * PAGE_SIZE, (p + 1) * PAGE_SIZE);
    if (!page.slice(0, 4).equals(NXHD)) continue;

    // ── PASO 1: Recopilar todos los strings UTF-16LE de la página ────────
    // Avanzamos PAST cada string completo para evitar substrings duplicados.
    const strs: StrEntry[] = [];
    let i = 4;
    while (i < PAGE_SIZE - 4) {
      const lo = page[i];
      const hi = (i + 1 < PAGE_SIZE) ? page[i + 1] : 0;
      if (hi !== 0 || lo < 0x20 || lo > 0x7e) { i++; continue; }
      const [text, nextI] = readUtf16le(page, i);
      const t = text.trim();
      if (t.length >= 1) strs.push({ start: i, end: nextI, text: t });
      i = nextI;
    }

    // ── PASO 2: Estructura verificada: [EAN][nombre][unidad o 4B binario][precio] ──
    // Usamos EAN como ancla principal — el nombre siempre viene justo después.
    const tryAddProduct = (
      eanText: string | null,
      nombreRaw: string,
      nameEnd: number,
      nextStrAfterName: StrEntry | undefined,
      catCandidateEnd: number,
    ) => {
      const nombre = fixEncoding(nombreRaw);
      if (!nombre || nombre.length < 3 || !isValidProductName(nombre)) return false;

      let precio = 0;
      let unitStr = 'unidad';

      // Caso A: el string después del nombre es una unidad de medida
      if (nextStrAfterName && UNIT_SET.has(nextStrAfterName.text) &&
        nextStrAfterName.start >= nameEnd && nextStrAfterName.start <= nameEnd + 6) {
        unitStr = nextStrAfterName.text.toLowerCase();
        const raw = readInt64LE(page, nextStrAfterName.end);
        const pv = raw / 10000.0;
        if (pv >= 1 && pv <= 100_000) precio = Math.round(pv * 100) / 100;
      }

      // Caso B: 4 bytes binarios después del nombre → precio inmediatamente
      if (precio === 0) {
        const raw = readInt64LE(page, nameEnd + 4);
        const pv = raw / 10000.0;
        if (pv >= 1 && pv <= 100_000) precio = Math.round(pv * 100) / 100;
      }

      // Caso C: precio directo sin campo intermedio
      if (precio === 0) {
        const raw = readInt64LE(page, nameEnd);
        const pv = raw / 10000.0;
        if (pv >= 1 && pv <= 100_000) precio = Math.round(pv * 100) / 100;
      }

      if (precio === 0) return false;

      // Categoría: primer string legible antes del ancla (EAN o código)
      let categoria = '';
      for (const s of strs) {
        if (s.end < catCandidateEnd - 30 && s.end >= catCandidateEnd - 600 &&
          !UNIT_SET.has(s.text) && !/^\d/.test(s.text) &&
          s.text.length >= 3 && s.text.length <= 60 && isValidProductName(fixEncoding(s.text))) {
          categoria = fixEncoding(s.text);
          break;
        }
      }

      products.push({
        codigo: eanText || `NXT-${products.length + 1}`,
        codigoBarras: eanText,
        nombre,
        categoria,
        precioVenta: precio,
        precioCosto: 0,
        stockActual: 0,
        unidadMedida: unitStr,
        fraccionable: FRACCIONABLE_UNITS.has(unitStr),
      });
      return true;
    };

    for (let k = 0; k < strs.length; k++) {
      const anchor = strs[k].text;

      // Ancla 1: EAN (7-14 dígitos)
      if (/^\d{7,14}$/.test(anchor)) {
        // El nombre es el próximo string legible válido (máx. 3 strings hacia adelante)
        for (let m = k + 1; m < Math.min(k + 4, strs.length); m++) {
          const t = strs[m].text;
          if (isValidProductName(fixEncoding(t)) && !UNIT_SET.has(t)) {
            tryAddProduct(anchor, t, strs[m].end, strs[m + 1], strs[k].start);
            break;
          }
        }
        continue;
      }

      // Ancla 2: código interno corto (3-6 dígitos) — para productos sin EAN
      if (/^\d{3,6}$/.test(anchor)) {
        // Verificar que el siguiente string NO sea un EAN (eso indicaría que
        // este código es el Codigo interno de un producto que SÍ tiene EAN, ya capturado)
        const nextAnchor = strs[k + 1];
        if (nextAnchor && /^\d{7,14}$/.test(nextAnchor.text)) continue;

        for (let m = k + 1; m < Math.min(k + 5, strs.length); m++) {
          const t = strs[m].text;
          if (isValidProductName(fixEncoding(t)) && !UNIT_SET.has(t)) {
            tryAddProduct(null, t, strs[m].end, strs[m + 1], strs[k].start);
            break;
          }
        }
      }
    }
  }

  // Dedup por nombre (primera ocurrencia = precio de venta)
  const byNombre = new Map<string, RawProduct>();
  for (const p of products) {
    const k = p.nombre.toLowerCase().trim();
    if (!byNombre.has(k)) byNombre.set(k, p);
  }
  const unique = [...byNombre.values()];

  // Dedup adicional por EAN: si dos productos tienen el mismo EAN, dejar solo el primero
  const eanSeen = new Set<string>();
  return unique.filter(p => {
    if (!p.codigoBarras) return true;
    if (eanSeen.has(p.codigoBarras)) return false;
    eanSeen.add(p.codigoBarras);
    return true;
  });
}

// ── Extractor de CATEGORÍAS ───────────────────────────────────────────────────

export function extractCategoriasFromBuffer(data: Buffer): RawCategoria[] {
  const found = new Set<string>();
  const totalPages = Math.floor(data.length / PAGE_SIZE);

  for (let p = 0; p < totalPages; p++) {
    const page = data.slice(p * PAGE_SIZE, (p + 1) * PAGE_SIZE);
    if (!page.slice(0, 4).equals(NXHD)) continue;

    let i = 4;
    while (i < PAGE_SIZE - 4) {
      const lo = page[i];
      const hi = (i + 1 < PAGE_SIZE) ? page[i + 1] : 0;
      if (hi === 0 && lo >= 0x41 && lo <= 0x7e) {
        const [s, ni] = readUtf16le(page, i);
        const clean = fixEncoding(s.trim());
        if (clean.length >= 2 && clean.length <= 50 && !/^\d+$/.test(clean) && !hasAsciiControlChars(clean)) {
          found.add(clean);
        }
        i = ni;
        continue;
      }
      i++;
    }
  }

  return Array.from(found).map((nombre) => ({ nombre }));
}

// ── Extractor de CLIENTES ─────────────────────────────────────────────────────

export function extractClientesFromBuffer(data: Buffer): RawCliente[] {
  const clients: RawCliente[] = [];
  const totalPages = Math.floor(data.length / PAGE_SIZE);

  for (let p = 0; p < totalPages; p++) {
    const page = data.slice(p * PAGE_SIZE, (p + 1) * PAGE_SIZE);
    if (!page.slice(0, 4).equals(NXHD)) continue;

    const pageStrings: Array<[number, string]> = [];
    let i = 4;
    while (i < PAGE_SIZE - 4) {
      const lo = page[i];
      const hi = (i + 1 < PAGE_SIZE) ? page[i + 1] : 0;
      if (hi === 0 && lo >= 0x20 && lo <= 0x7e) {
        const [s, ni] = readUtf16le(page, i);
        const clean = fixEncoding(s.trim());
        if (clean.length >= 3 && clean.length <= 100) {
          pageStrings.push([i, clean]);
          i = ni;
          continue;
        }
      }
      i++;
    }

    const clusters: string[][] = [];
    let current: string[] = [];
    let lastOffset = -1;
    for (const [offset, str] of pageStrings) {
      if (lastOffset === -1 || offset - lastOffset < 400) {
        current.push(str);
      } else {
        if (current.length >= 2) clusters.push(current);
        current = [str];
      }
      lastOffset = offset;
    }
    if (current.length >= 2) clusters.push(current);

    for (const cluster of clusters) {
      const email = cluster.find((s) => s.includes('@') && s.includes('.')) || '';
      const telefono = cluster.find((s) => /^[-\d\s()+]{6,20}$/.test(s) && s.replace(/\D/g, '').length >= 6) || '';
      const candidates = cluster.filter((s) => s !== email && s !== telefono && !/^\d+$/.test(s) && s.length >= 3);
      const nombre = candidates.reduce((a, b) => (b.length > a.length ? b : a), '');
      const direccion = candidates.filter((s) => s !== nombre).reduce((a, b) => (b.length > a.length ? b : a), '');
      if (nombre && nombre.length >= 3 && nombre.length <= 100) {
        clients.push({ nombre, telefono, email, direccion });
      }
    }
  }

  const seen = new Set<string>();
  return clients.filter((c) => {
    const key = c.nombre.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
