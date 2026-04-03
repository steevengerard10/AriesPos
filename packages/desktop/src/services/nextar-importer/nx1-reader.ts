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
const UNIT_SET = new Set([
  'Pieza', 'pieza', 'Pza', 'pza', 'Piezas', 'piezas',
  'Kg', 'kg', 'Kilo', 'kilo', 'Kilogramo', 'kilogramo', 'Kilogramos', 'kilogramos',
  'Litro', 'litro', 'Litros', 'litros', 'Lt', 'lt', 'Lts', 'lts',
  'Unid', 'unid', 'Unidad', 'unidad', 'Unidades', 'unidades', 'Und', 'und',
  'Caja', 'caja', 'Cajas', 'cajas',
  'Pack', 'pack', 'Packs', 'packs',
  'Fardo', 'fardo', 'Fardos', 'fardos',
  'Docena', 'docena', 'Docenas', 'docenas',
  'Gramo', 'gramo', 'Gramos', 'gramos', 'Gr', 'gr', 'Grs', 'grs',
  'Metro', 'metro', 'Metros', 'metros', 'Mt', 'mt', 'Mts', 'mts',
  'Mililitro', 'mililitro', 'Mililitros', 'mililitros', 'Ml', 'ml', 'ML', 'mL',
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
  if (s.length < 4 || s.length > 80) return false;
  // El primer carácter debe ser letra o dígito
  if (!/^[a-zA-ZáéíóúñüäöïçàèÁÉÍÓÚÑÜÄÖÏÇÀÈ0-9]/.test(s)) return false;
  // Solo caracteres típicos de nombres de productos
  const valid = /^[a-zA-ZáéíóúñüäöïçàèÁÉÍÓÚÑÜÄÖÏÇÀÈìùÌÙ0-9\s\-.,()\/'&+°%ºª¡¿]+$/.test(s);
  if (!valid) return false;
  // Al menos 3 letras
  const letters = s.split('').filter(c => /[a-zA-ZáéíóúñüäöïçàèÁÉÍÓÚÑÜÄÖÏÇÀÈ]/i.test(c)).length;
  if (letters < 3) return false;
  // Al menos 40% del string deben ser letras (filtra strings tipo "1234 AB" con pocos chars)
  return (letters / s.length) >= 0.40;
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
 * Estrategia U1/U2 (ancla doble por unidad de medida):
 *
 * En el formato NX1, cada registro de producto contiene la unidad TWO VECES:
 *   [fk_descr_unidade] = U1 ("Pieza", "Kg", etc.)
 *   ...varios campos binarios y strings...
 *   [Descricao] = nombre del producto
 *   [Unid]      = U2 (misma/similar unidad)
 *   [Preco]     = Int64LE precio × 10000
 *
 * Buscar dos strings de UNIT_SET dentro de 600 bytes es muy confiable:
 * prácticamente imposible por coincidencia en datos binarios.
 *
 * El nombre del producto es el ÚLTIMO string válido entre U1 y U2.
 * El EAN es cualquier string de 7-14 dígitos entre U1 y U2.
 * La categoría es el string legible que precede a U1.
 */
export function extractProductsFromBuffer(data: Buffer): RawProduct[] {
  const products: RawProduct[] = [];
  const totalPages = Math.floor(data.length / PAGE_SIZE);

  type StrEntry = { start: number; end: number; text: string };

  for (let p = 0; p < totalPages; p++) {
    const page = data.slice(p * PAGE_SIZE, (p + 1) * PAGE_SIZE);
    if (!page.slice(0, 4).equals(NXHD)) continue;

    // Recopilar todos los strings UTF-16LE de la página
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

    if (strs.length === 0) continue;

    // Buscar pares U1/U2: dos strings de UNIT_SET dentro de 600 bytes
    // REQUISITOS para evitar falsos positivos:
    //   1. U1 y U2 deben ser el MISMO string (Nextar siempre repite la unidad)
    //   2. La unidad debe tener >= 3 chars (excluye "Un", "gr", "ml", "kg", etc.)
    let k = 0;
    while (k < strs.length) {
      const u1 = strs[k];
      if (!UNIT_SET.has(u1.text) || u1.text.length < 3) { k++; continue; }

      // Buscar U2 dentro de 600 bytes desde U1_end
      let consumed = false;
      for (let m = k + 1; m < strs.length; m++) {
        const u2 = strs[m];
        if (u2.start > u1.end + 600) break;
        // U2 debe ser la misma unidad que U1 (case-insensitive)
        if (u2.text.toLowerCase() !== u1.text.toLowerCase()) continue;

        // Par U1(k) / U2(m) encontrado.
        // Extraer nombre, EAN y categoría entre ellos.
        let nombre = '';
        let eanText: string | null = null;

        for (let n = k + 1; n < m; n++) {
          const raw = strs[n].text;
          if (/^\d{7,14}$/.test(raw)) {
            eanText = raw;
          } else if (!UNIT_SET.has(raw)) {
            const t = fixEncoding(raw);
            if (isValidProductName(t)) {
              nombre = t; // último string válido antes de U2 = Descricao
            }
          }
        }

        if (nombre) {
          // Precio = Int64LE inmediatamente después de U2
          const raw64 = readInt64LE(page, u2.end);
          const pv = raw64 / 10000.0;
          if (pv >= 1 && pv <= 500_000) {
            const precio = Math.round(pv * 100) / 100;
            const unitStr = u1.text.toLowerCase();

            // Categoría: string legible anterior a U1 (hasta 6 posiciones atrás)
            let categoria = '';
            for (let n = k - 1; n >= 0 && n >= k - 6; n--) {
              const t = fixEncoding(strs[n].text);
              if (!UNIT_SET.has(strs[n].text) && !/^\d/.test(strs[n].text) &&
                  t.length >= 3 && t.length <= 60 && isValidProductName(t)) {
                categoria = t;
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
          }
        }

        // Avanzar el cursor externo al índice de U2 (la siguiente iteración lo salta)
        k = m;
        consumed = true;
        break;
      }

      if (!consumed) k++;
    }
  }

  // Dedup por nombre (primera ocurrencia = precio de venta)
  const byNombre = new Map<string, RawProduct>();
  for (const p of products) {
    const key = p.nombre.toLowerCase().trim();
    if (!byNombre.has(key)) byNombre.set(key, p);
  }
  const unique = [...byNombre.values()];

  // Dedup adicional por EAN
  const eanSeen = new Set<string>();
  return unique.filter(p => {
    if (!p.codigoBarras) return true;
    if (eanSeen.has(p.codigoBarras)) return false;
    eanSeen.add(p.codigoBarras);
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
