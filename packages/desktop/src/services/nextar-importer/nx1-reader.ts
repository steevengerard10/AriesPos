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
  'Mililitro', 'ml', 'ML', 'mL',
]);

const FRACCIONABLE_UNITS = new Set(['kg', 'gramo', 'gr', 'litro', 'lt', 'ml', 'metro', 'mt']);

function hasAsciiControlChars(s: string): boolean {
  for (let i = 0; i < s.length; i++) {
    if (s.charCodeAt(i) <= 0x1f) return true;
  }
  return false;
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
 * 5. El código de barras (EanGtin) es el string numérico de 7-14 dígitos en ese mismo rango
 * 6. La categoría está en los strings ANTES de U1 en la página
 */
export function extractProductsFromBuffer(data: Buffer): RawProduct[] {
  const products: RawProduct[] = [];
  const totalPages = Math.floor(data.length / PAGE_SIZE);

  for (let p = 0; p < totalPages; p++) {
    const page = data.slice(p * PAGE_SIZE, (p + 1) * PAGE_SIZE);
    if (!page.slice(0, 4).equals(NXHD)) continue;

    let i = 4;
    while (i < PAGE_SIZE - 30) {
      const lo = page[i];
      const hi = (i + 1 < PAGE_SIZE) ? page[i + 1] : 0;

      // Detectar inicio de WideString UTF-16LE: byte legible seguido de 0x00
      if (hi !== 0 || lo < 0x20 || lo > 0x7e) { i++; continue; }

      const [unitText, u1End] = readUtf16le(page, i);
      const unitClean = unitText.trim();

      if (!UNIT_SET.has(unitClean)) { i++; continue; }

      // Tenemos U1 (fk_descr_unidade). Ahora buscar U2 (Unid) hacia adelante.
      // U2 debe ser el mismo string de unidad dentro de 500 bytes.
      const searchEnd = Math.min(u1End + 500, PAGE_SIZE - 8);
      let u2Start = -1;
      let u2End = -1;

      let j = u1End;
      while (j < searchEnd - 2) {
        const lj = page[j];
        const hj = (j + 1 < PAGE_SIZE) ? page[j + 1] : 0;
        if (hj !== 0 || lj < 0x20 || lj > 0x7e) { j++; continue; }
        const [s2, s2End] = readUtf16le(page, j);
        if (s2.trim() === unitClean) {
          u2Start = j;
          u2End = s2End;
          break;
        }
        j++;
      }

      if (u2Start === -1) { i = u1End; continue; }

      // Leer precio después de U2
      if (u2End + 8 > PAGE_SIZE) { i = u2End; continue; }
      const rawPrice = readInt64LE(page, u2End);
      const precioVenta = rawPrice / 10000.0;

      if (precioVenta < 0.5 || precioVenta > 5_000_000) { i = u1End; continue; }

      // Escanear strings entre U1_end y U2_start para encontrar nombre y EAN
      let nombre = '';
      let codigoBarras = '';
      let codigoInterno = '';

      let k = u1End;
      while (k < u2Start - 2) {
        const lk = page[k];
        const hk = (k + 1 < PAGE_SIZE) ? page[k + 1] : 0;
        if (hk !== 0 || lk < 0x20 || lk > 0x7e) { k++; continue; }
        const [s, sEnd] = readUtf16le(page, k);
        const sTrim = s.trim();
        if (sTrim.length >= 2) {
          if (/^\d{7,14}$/.test(sTrim)) {
            // Código de barras  (EAN/GTIN)
            codigoBarras = sTrim;
          } else if (/^\d+$/.test(sTrim) && sTrim.length <= 6) {
            // Código interno numérico corto
            codigoInterno = sTrim;
          } else if (sTrim.length >= 3 && sTrim.length <= 120 && !hasAsciiControlChars(sTrim) && !UNIT_SET.has(sTrim)) {
            // Nombre (tomamos el ÚLTIMO string legible antes de U2)
            nombre = fixEncoding(sTrim);
          }
        }
        k = sEnd;
      }

      if (!nombre || nombre.length < 2) { i = u1End; continue; }

      // Buscar categoría en los strings ANTES de U1 en la página
      let categoria = '';
      const searchCatStart = Math.max(4, i - 600);
      let m = searchCatStart;
      const strsBefore: string[] = [];
      while (m < i) {
        const lm = page[m];
        const hm = (m + 1 < PAGE_SIZE) ? page[m + 1] : 0;
        if (hm !== 0 || lm < 0x20 || lm > 0x7e) { m++; continue; }
        const [sc, scEnd] = readUtf16le(page, m);
        const scTrim = fixEncoding(sc.trim());
        if (scTrim.length >= 2 && scTrim.length <= 50 && !hasAsciiControlChars(scTrim) && !UNIT_SET.has(scTrim) && !/^\d+$/.test(scTrim)) {
          strsBefore.push(scTrim);
        }
        m = scEnd;
      }
      if (strsBefore.length > 0) {
        // La categoría suele ser el primer string o uno de los primeros
        // Las marcas/proveedores son los últimos antes de U1
        categoria = strsBefore[0] || '';
      }

      const unidLower = unitClean.toLowerCase();
      const fraccionable = FRACCIONABLE_UNITS.has(unidLower);

      products.push({
        codigo: codigoBarras || codigoInterno || `NXT-${products.length + 1}`,
        codigoBarras: codigoBarras || null,
        nombre,
        categoria,
        precioVenta: Math.round(precioVenta * 100) / 100,
        precioCosto: 0,
        stockActual: 0,
        unidadMedida: unidLower,
        fraccionable,
      });

      i = u2End + 8; // Saltar más allá del precio para evitar re-analizar
    }
  }

  // Deduplicar por (nombre normalizado, precio)
  const seen = new Map<string, boolean>();
  return products.filter((p) => {
    const key = `${p.nombre.toLowerCase().trim()}|${p.precioVenta}`;
    if (seen.has(key)) return false;
    seen.set(key, true);
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
