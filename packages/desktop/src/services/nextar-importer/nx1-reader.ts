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

// Unidades de medida reconocidas por Nextar (campo fk_descr_unidade / Unid)
// IMPORTANTE: Nextar es software brasileño → usa "Unidade", "Cx", "Pç", etc.
const UNIT_SET = new Set([
  // ── Portugués (Nextar nativo) ───────────────────────────────────────────
  'Unidade', 'unidade', 'Un', 'un',
  'Cx', 'cx', 'Caixa', 'caixa',
  'Pç', 'pç', 'Peça', 'peça',
  'Frasco', 'frasco', 'Frascos', 'frascos',
  'Pct', 'pct', 'Pacote', 'pacote',
  'Kg', 'kg', 'Lts', 'lts', 'Lt', 'lt', 'Ml', 'ml',
  'Gr', 'gr',
  // ── Español ────────────────────────────────────────────────────────────
  'Pieza', 'pieza', 'Pza', 'pza', 'Piezas', 'piezas',
  'Kilo', 'kilo', 'Kilogramo', 'kilogramo', 'Kilogramos', 'kilogramos',
  'Litro', 'litro', 'Litros', 'litros',
  'Unid', 'unid', 'Unidad', 'unidad', 'Unidades', 'unidades', 'Und', 'und',
  'Caja', 'caja', 'Cajas', 'cajas',
  'Pack', 'pack', 'Packs', 'packs',
  'Fardo', 'fardo', 'Fardos', 'fardos',
  'Docena', 'docena', 'Docenas', 'docenas',
  'Gramo', 'gramo', 'Gramos', 'gramos', 'Grs', 'grs',
  'Metro', 'metro', 'Metros', 'metros', 'Mt', 'mt', 'Mts', 'mts',
  'Mililitro', 'mililitro', 'Mililitros', 'mililitros', 'ML', 'mL',
  'Lata', 'lata', 'Latas', 'latas',
  'Botella', 'botella', 'Botellas', 'botellas',
  'Bolsa', 'bolsa', 'Bolsas', 'bolsas',
  'Sobre', 'sobre', 'Sobres', 'sobres',
  'Tarro', 'tarro', 'Tarros', 'tarros',
  'Rollo', 'rollo', 'Rollos', 'rollos',
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
 * Solo permite caracteres típicos de nombres de productos; rechaza símbolos binarios.
 */
function isValidProductName(s: string): boolean {
  // Longitud: entre 2 y 120 chars
  if (s.length < 2 || s.length > 120) return false;
  // El primer carácter debe ser letra o dígito
  if (!/^[a-zA-ZáéíóúñüäöïçàèÁÉÍÓÚÑÜÄÖÏÇÀÈ0-9]/.test(s)) return false;
  // Solo caracteres típicos de nombres de productos
  const valid = /^[a-zA-ZáéíóúñüäöïçàèÁÉÍÓÚÑÜÄÖÏÇÀÈìùÌÙ0-9\s\-.,()\/\'&+°%ºª¡¿!#@]+$/.test(s);
  if (!valid) return false;
  // Al menos 2 letras
  const letters = s.split('').filter(c => /[a-zA-ZáéíóúñüäöïçàèÁÉÍÓÚÑÜÄÖÏÇÀÈ]/i.test(c)).length;
  if (letters < 2) return false;
  // Al menos 25% letras (permite "7UP", "9 de Julio", "2L Coca", etc.)
  return (letters / s.length) >= 0.25;
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
 * Estrategia EAN (ancla por código de barras):
 *
 * Análisis del backup real reveló que el formato tiene DOS variantes de registro:
 *
 * Variante A (con código interno y unidad):
 *   [categoria][proveedor][Unidad1][cod_interno][EAN][Nombre][Unidad2][Int64LE precio×10000]
 *
 * Variante B (sin código interno, EAN duplicado):
 *   [categoria][proveedor][EAN][EAN][Nombre][...]
 *
 * La estrategia U1/U2 sólo encontraba la Variante A (~459 productos).
 * La estrategia EAN encuentra ambas variantes (~2091 productos).
 *
 * Ancla: string de 7-14 dígitos (EAN/barcode).
 *   - Si el siguiente string es el mismo EAN (duplicado), el nombre está 2 posiciones después.
 *   - Si no hay duplicado, el nombre está 1 posición después.
 *   - Precio: Int64LE tras Unidad2 (si existe), dividido por 10000.
 */
export function extractProductsFromBuffer(data: Buffer): RawProduct[] {
  const products: RawProduct[] = [];
  const totalPages = Math.floor(data.length / PAGE_SIZE);

  type StrEntry = { start: number; end: number; text: string };

  const EAN_RE = /^\d{7,14}$/;
  const HAS_LETTER = /[a-zA-Z]/;

  for (let p = 0; p < totalPages; p++) {
    const page = data.slice(p * PAGE_SIZE, (p + 1) * PAGE_SIZE);
    if (!page.slice(0, 4).equals(NXHD)) continue;

    // Recopilar todos los strings UTF-16LE de la página
    const strs: StrEntry[] = [];
    let i = 4;
    while (i < PAGE_SIZE - 4) {
      const lo = page[i];
      const hi = (i + 1 < PAGE_SIZE) ? page[i + 1] : 0;
      const isAsciiPrintable = lo >= 0x20 && lo <= 0x7E;
      const isLatin1Accented = lo >= 0xC0 && lo <= 0xFF;
      if (hi !== 0 || (!isAsciiPrintable && !isLatin1Accented)) { i++; continue; }
      const [text, nextI] = readUtf16le(page, i);
      const t = text.trim();
      if (t.length >= 2) strs.push({ start: i, end: nextI, text: t });
      i = nextI;
    }

    if (strs.length === 0) continue;

    // Ancla EAN: buscar código de barras (7-14 dígitos) y extraer nombre siguiente
    let k = 0;
    while (k < strs.length) {
      const eanEntry = strs[k];

      if (!EAN_RE.test(eanEntry.text)) { k++; continue; }

      // Detectar EAN duplicado (Variante B): el nombre está 2 posiciones después
      const isDup = k + 1 < strs.length && strs[k + 1].text === eanEntry.text;
      const nameIdx = isDup ? k + 2 : k + 1;

      if (nameIdx >= strs.length) { k += (isDup ? 3 : 2); continue; }

      const nameEntry = strs[nameIdx];
      const rawName = nameEntry.text;

      if (!HAS_LETTER.test(rawName) || rawName.length < 3) { k++; continue; }

      const nombre = fixEncoding(rawName);
      if (!isValidProductName(nombre)) { k++; continue; }

      // Buscar unidad hacia atrás (hasta 8 posiciones) y categoría
      let unitStr = '';
      let categoria = '';
      for (let back = 1; back <= 8 && k - back >= 0; back++) {
        const prev = strs[k - back].text;
        if (UNIT_SET.has(prev)) {
          if (!unitStr) unitStr = prev;
        } else if (!/^\d/.test(prev) && prev.length >= 3 && !categoria) {
          const c = fixEncoding(prev);
          if (isValidProductName(c)) categoria = c;
        }
      }

      // Buscar unidad hacia adelante (hasta 3 posiciones tras el nombre)
      let unit2Str = '';
      let u2End = -1;
      for (let fwd = 1; fwd <= 3; fwd++) {
        if (nameIdx + fwd < strs.length) {
          const nxt = strs[nameIdx + fwd].text;
          if (UNIT_SET.has(nxt)) {
            unit2Str = nxt;
            u2End = strs[nameIdx + fwd].end;
            break;
          }
        }
      }

      const finalUnit = unitStr || unit2Str;

      // Precio: Int64LE × 10000 inmediatamente después de Unidad2
      let precio = 0;
      if (u2End >= 0 && u2End + 8 <= PAGE_SIZE) {
        const raw64 = readInt64LE(page, u2End);
        const pv = raw64 / 10000.0;
        if (pv >= 1 && pv <= 500_000) {
          precio = Math.round(pv * 100) / 100;
        }
      }

      const unitLower = finalUnit ? finalUnit.toLowerCase() : 'unidad';

      // Codigo interno: en Variante A está 1 posición antes del EAN (string de hasta 8 dígitos, no EAN)
      let codigoInterno = '';
      if (!isDup && k - 1 >= 0) {
        const prevText = strs[k - 1].text;
        if (/^\d{1,8}$/.test(prevText) && !EAN_RE.test(prevText)) {
          codigoInterno = prevText;
        }
      }

      products.push({
        codigo: codigoInterno,
        codigoBarras: eanEntry.text,
        nombre,
        categoria,
        precioVenta: precio,
        precioCosto: 0,
        stockActual: 0,
        unidadMedida: unitLower,
        fraccionable: FRACCIONABLE_UNITS.has(unitLower),
      });

      k += (isDup ? 3 : 2);
    }
  }

  // Dedup: primero por EAN, luego por nombre
  const eanSeen = new Set<string>();
  const nameSeen = new Set<string>();
  return products.filter(p => {
    const ean = p.codigoBarras || '';
    const nameKey = p.nombre.toLowerCase().trim();
    if (ean && eanSeen.has(ean)) return false;
    if (nameSeen.has(nameKey)) return false;
    if (ean) eanSeen.add(ean);
    nameSeen.add(nameKey);
    return true;
  });
}

// ── DIAGNÓSTICO ───────────────────────────────────────────────────────────────

/**
 * Lee los primeros `maxPages` NXHD pages y devuelve todos los strings
 * UTF-16LE encontrados (>= 3 chars). Útil para depurar qué hay en el archivo.
 */
export function debugDumpStrings(data: Buffer, maxPages = 5): string[] {
  const result: string[] = [];
  const totalPages = Math.floor(data.length / PAGE_SIZE);
  let pagesScanned = 0;

  for (let p = 0; p < totalPages && pagesScanned < maxPages; p++) {
    const page = data.slice(p * PAGE_SIZE, (p + 1) * PAGE_SIZE);
    if (!page.slice(0, 4).equals(NXHD)) continue;
    pagesScanned++;

    let i = 4;
    while (i < PAGE_SIZE - 4) {
      const lo = page[i];
      const hi = (i + 1 < PAGE_SIZE) ? page[i + 1] : 0;
      if (hi !== 0 || lo < 0x20 || lo > 0x7e) { i++; continue; }
      const [text, nextI] = readUtf16le(page, i);
      const t = text.trim();
      if (t.length >= 3) result.push(`[p${p} @${i}] "${t}"`);
      i = nextI;
    }
  }
  return result;
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
