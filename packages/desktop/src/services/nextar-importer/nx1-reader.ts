/**
 * nx1-reader.ts
 * 
 * Los archivos .nx1 de Nextar son bases de datos NexusDB (formato NX!2 / páginas NXHD),
 * NO Firebird. Este módulo implementa un lector binario del formato NexusDB para
 * extraer registros de las tablas más importantes del backup de Nextar.
 *
 * Formato NexusDB:
 *  - Tamaño de página: 4096 bytes
 *  - Páginas de datos: encabezado "NXHD" (4 bytes)
 *  - Strings: null-terminated UTF-16LE
 *  - Números: Int64 little-endian (precios × 10000), Int32 LE (IDs, stock)
 */

import * as fs from 'fs';
import * as iconv from 'iconv-lite';

const PAGE_SIZE = 4096;
const NXHD = Buffer.from('NXHD');

// ── Unidades de medida reconocidas por Nextar ─────────────────────────────────
const UNIT_STRINGS = new Set([
  'Pieza', 'pieza', 'Kg', 'kg', 'litro', 'Litro',
  'Lt', 'lt', 'Un', 'un', 'Unid', 'unid', 'Caja', 'caja',
  'Pack', 'pack', 'Fardo', 'fardo', 'Docena', 'docena',
  'Gramo', 'gramo', 'Gr', 'gr', 'Metro', 'metro', 'Mt', 'mt',
  'Mililitro', 'ml', 'ML', 'mL',
]);

/** U+0000..U+001F (evita no-control-regex en patrones literales) */
function hasAsciiControlChars(s: string): boolean {
  for (let i = 0; i < s.length; i++) {
    if (s.charCodeAt(i) <= 0x1f) return true;
  }
  return false;
}

// ── Primitivas de parseo ──────────────────────────────────────────────────────

/** Lee string null-terminated UTF-16LE. Devuelve [texto, nextOffset] */
function readUtf16le(buf: Buffer, offset: number): [string, number] {
  const chars: string[] = [];
  let i = offset;
  while (i + 1 < buf.length) {
    const lo = buf[i];
    const hi = buf[i + 1];
    if (lo === 0 && hi === 0) return [chars.join(''), i + 2];
    try { chars.push(buf.slice(i, i + 2).toString('utf16le')); }
    catch { break; }
    i += 2;
  }
  return [chars.join(''), i + 2];
}

/** Lee Int64 LE (precio × 10000 en Nextar) */
function readInt64LE(buf: Buffer, offset: number): number {
  const lo = buf.readUInt32LE(offset);
  const hi = buf.readInt32LE(offset + 4);
  return hi * 0x100000000 + lo;
}

/** Corrige encoding de strings que vienen en binary/latin-1 */
function fixEncoding(str: string): string {
  try {
    return iconv.decode(Buffer.from(str, 'binary'), 'win1252').trim();
  } catch {
    return str.trim();
  }
}

// ── Tipos de datos brutos ─────────────────────────────────────────────────────

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
// Estrategia: buscar strings de unidad como ancla, luego leer precio Int64 y
// buscar hacia atrás nombre, barcode, categoría.

export function extractProductsFromBuffer(data: Buffer): RawProduct[] {
  const products: RawProduct[] = [];
  const totalPages = Math.floor(data.length / PAGE_SIZE);

  for (let p = 0; p < totalPages; p++) {
    const page = data.slice(p * PAGE_SIZE, (p + 1) * PAGE_SIZE);
    if (!page.slice(0, 4).equals(NXHD)) continue;

    let i = 4;
    while (i < PAGE_SIZE - 20) {
      const lo = page[i];
      const hi = i + 1 < PAGE_SIZE ? page[i + 1] : 0;

      if (hi === 0 && lo >= 0x41 && lo <= 0x7a) {
        const [text, nextI] = readUtf16le(page, i);
        const textClean = text.trim();

        if (UNIT_STRINGS.has(textClean) && nextI + 8 <= PAGE_SIZE) {
          const raw = readInt64LE(page, nextI);
          const precio = raw / 10000.0;

          if (precio > 0.5 && precio < 1000000) {
            let nombre = '';
            let categoria = '';
            let codigoBarras = '';

            const searchStart = Math.max(4, i - 512);
            const stringsBefore: Array<[number, string]> = [];
            let j = searchStart;

            while (j < i) {
              const lob = page[j];
              const hib = j + 1 < page.length ? page[j + 1] : 0;
              if (hib === 0 && lob >= 0x20 && lob <= 0x7e) {
                const [s, nj] = readUtf16le(page, j);
                const sTrim = fixEncoding(s.trim());
                if (sTrim.length >= 2 && sTrim.length <= 80) {
                  stringsBefore.push([j, sTrim]);
                  j = nj;
                  continue;
                }
              }
              j++;
            }

            if (stringsBefore.length > 0) {
              const last5 = stringsBefore.slice(-5);
              const candidates = last5.map(([, s]) => s).filter((s) => s.length > 3 && !/^\d+$/.test(s));
              if (candidates.length > 0) nombre = candidates[candidates.length - 1];

              for (const [, s] of stringsBefore) {
                if (/^\d+$/.test(s) && s.length >= 7 && s.length <= 14) codigoBarras = s;
              }

              if (candidates.length >= 2) categoria = candidates[0];
            }

            if (nombre && nombre.length > 2) {
              const unidLower = textClean.toLowerCase();
              const fraccionable = ['kg', 'gramo', 'gr', 'litro', 'lt', 'ml', 'metro', 'mt'].includes(unidLower);
              products.push({
                codigo: codigoBarras || `SIN-COD-${products.length + 1}`,
                codigoBarras: codigoBarras || null,
                nombre,
                categoria,
                precioVenta: Math.round(precio * 100) / 100,
                precioCosto: 0,
                stockActual: 0,
                unidadMedida: textClean.toLowerCase(),
                fraccionable,
              });
            }
          }

          i = nextI;
          continue;
        }
      }
      i++;
    }
  }

  // Deduplicar por (nombre, precio)
  const seen = new Map<string, boolean>();
  return products.filter((p) => {
    const key = `${p.nombre.toLowerCase()}|${p.precioVenta}`;
    if (seen.has(key)) return false;
    seen.set(key, true);
    return true;
  });
}

// ── Extractor de CATEGORÍAS ───────────────────────────────────────────────────
// Estrategia: extraer todos los strings cortos de NXHD pages. En la tabla
// Categoria de Nextar, prácticamente todos los strings son nombres de categorías.

export function extractCategoriasFromBuffer(data: Buffer): RawCategoria[] {
  const found = new Set<string>();
  const totalPages = Math.floor(data.length / PAGE_SIZE);

  for (let p = 0; p < totalPages; p++) {
    const page = data.slice(p * PAGE_SIZE, (p + 1) * PAGE_SIZE);
    if (!page.slice(0, 4).equals(NXHD)) continue;

    let i = 4;
    while (i < PAGE_SIZE - 4) {
      const lo = page[i];
      const hi = i + 1 < PAGE_SIZE ? page[i + 1] : 0;

      if (hi === 0 && lo >= 0x41 && lo <= 0x7e) {
        const [s, ni] = readUtf16le(page, i);
        const clean = fixEncoding(s.trim());
        // Nombres de categoría: 2-50 chars, no solo dígitos, no contiene control chars
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
// Estrategia: agrupar strings que aparecen próximos entre sí en la misma página.
// Cada "cluster" de strings es potencialmente un registro de cliente.

export function extractClientesFromBuffer(data: Buffer): RawCliente[] {
  const clients: RawCliente[] = [];
  const totalPages = Math.floor(data.length / PAGE_SIZE);

  for (let p = 0; p < totalPages; p++) {
    const page = data.slice(p * PAGE_SIZE, (p + 1) * PAGE_SIZE);
    if (!page.slice(0, 4).equals(NXHD)) continue;

    // Recolectar todos los strings de la página con sus offsets
    const pageStrings: Array<[number, string]> = [];
    let i = 4;

    while (i < PAGE_SIZE - 4) {
      const lo = page[i];
      const hi = i + 1 < PAGE_SIZE ? page[i + 1] : 0;

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

    // Agrupar strings próximos (dentro de 400 bytes) como candidatos a registro
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
      // EMAIL: contiene '@'
      const email = cluster.find((s) => s.includes('@') && s.includes('.')) || '';
      // TELÉFONO: 6-15 dígitos o con formatos típicos +54, 011, etc.
      const telefono = cluster.find((s) => /^[-\d\s()+]{6,20}$/.test(s) && s.replace(/\D/g, '').length >= 6) || '';
      // NOMBRE: string no-dígito más largo, descartando email y teléfono
      const candidates = cluster.filter((s) => s !== email && s !== telefono && !/^\d+$/.test(s) && s.length >= 3);
      const nombre = candidates.reduce((a, b) => (b.length > a.length ? b : a), '');
      // DIRECCIÓN: segundo string más largo que no sea nombre/email/teléfono
      const direccion = candidates.filter((s) => s !== nombre).reduce((a, b) => (b.length > a.length ? b : a), '');

      if (nombre && nombre.length >= 3 && nombre.length <= 100) {
        clients.push({ nombre, telefono, email, direccion });
      }
    }
  }

  // Deduplicar por nombre
  const seen = new Set<string>();
  return clients.filter((c) => {
    const key = c.nombre.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

// ── Funciones de conveniencia (desde archivo) ─────────────────────────────────

export function extractProductsFromFile(filePath: string): RawProduct[] {
  return extractProductsFromBuffer(fs.readFileSync(filePath));
}

export function extractCategoriasFromFile(filePath: string): RawCategoria[] {
  return extractCategoriasFromBuffer(fs.readFileSync(filePath));
}

export function extractClientesFromFile(filePath: string): RawCliente[] {
  return extractClientesFromBuffer(fs.readFileSync(filePath));
}
