/**
 * nx1-importer.ts
 * Importa productos desde un archivo de backup de Nextar (.zip o carpeta con Produto.nx1)
 * Soporta formato NX!2 (NexusDB v2) y formato NX1 antiguo.
 */

import * as fs from 'fs';
import * as path from 'path';
const AdmZip = require('adm-zip');
import type { Database } from 'better-sqlite3';

// ── Constantes ────────────────────────────────────────────────────────────────
const PAGE_SIZE = 4096;

/** Unidades de medida conocidas de Nextar */
const UNIT_SET = new Set([
  'Pieza', 'pieza', 'Kg', 'kg', 'litro', 'Litro', 'Lt', 'lt',
  'Un', 'un', 'Unid', 'unid', 'Caja', 'caja', 'Pack', 'pack',
  'Fardo', 'fardo', 'Docena', 'docena', 'g', 'ml', 'Metro', 'metro',
  'Gramo', 'gramo', 'Mt', 'mt', 'Lata', 'lata',
]);

// ── Tipos ─────────────────────────────────────────────────────────────────────
interface ParsedProduct {
  codigo: string;
  codigo_barras: string | null;
  nombre: string;
  categoria: string;
  precio_venta: number;
  precio_costo: number;
  stock_actual: number;
}

export interface Nx1ImportResult {
  success: boolean;
  imported: number;
  skipped: number;
  errors: string[];
}

// ── Utilidades ────────────────────────────────────────────────────────────────

function readInt64LE(buf: Buffer, offset: number): number {
  const lo = buf.readUInt32LE(offset);
  const hi = buf.readInt32LE(offset + 4);
  return hi * 0x100000000 + lo;
}

function readCurrency(buf: Buffer, offset: number): number {
  if (offset + 8 > buf.length) return 0;
  const raw = readInt64LE(buf, offset);
  return Math.round((raw / 10000) * 100) / 100;
}

// ── Parser NX!2 (NexusDB v2 - formato moderno) ───────────────────────────────

/**
 * Extrae todos los strings UTF-16LE de las páginas NXHD.
 * En NX!2, los campos WideString se almacenan como strings null-terminated en UTF-16LE.
 */
function extractTokensNX2(data: Buffer): Array<{ val: string; end: number }> {
  const tokens: Array<{ val: string; end: number }> = [];
  const totalPages = Math.floor(data.length / PAGE_SIZE);

  for (let p = 0; p < totalPages; p++) {
    const off = p * PAGE_SIZE;
    if (data.slice(off, off + 4).toString('ascii') !== 'NXHD') continue;

    let i = off + 36; // saltar header de la página
    while (i < off + PAGE_SIZE - 2) {
      const lo = data[i];
      const hi = data[i + 1];
      // UTF-16LE: hi byte 0x00 o 0x01 (BMP incluyendo diacríticos hispanos)
      if ((hi === 0x00 || hi === 0x01) && lo >= 0x20 && lo <= 0x7e) {
        let s = '';
        let j = i;
        while (j < off + PAGE_SIZE - 1) {
          const l = data[j];
          const h = data[j + 1];
          if (l === 0 && h === 0) break;
          if (h > 2) break;
          s += String.fromCharCode((h << 8) | l);
          j += 2;
        }
        const trimmed = s.trim();
        if (trimmed.length >= 2) {
          tokens.push({ val: trimmed, end: j + 2 });
          i = j + 2;
          continue;
        }
      }
      i++;
    }
  }
  return tokens;
}

function extractProductsNX2(data: Buffer): ParsedProduct[] {
  const tokens = extractTokensNX2(data);
  const products: ParsedProduct[] = [];

  const isBarcode = (v: string) => /^\d{7,14}$/.test(v);
  const isNumCode = (v: string) => /^\d{1,12}$/.test(v);
  const isCode    = (v: string) => /^\d{3,12}$/.test(v) || /^[A-Z][A-Z0-9-]{2,14}$/.test(v);
  const isBad     = (v: string) =>
    v.length < 4 ||
    v.startsWith('@') ||
    UNIT_SET.has(v) ||
    isBarcode(v) ||
    isNumCode(v) ||
    /^[#$%^&*!?]/.test(v);

  /**
   * Intenta leer el precio justo después del token `t`.
   * Primero mira si los bytes inmediatos son una unidad UTF-16LE conocida
   * (ej. "Pieza\0", "Kg\0") y salta esos bytes antes de leer el int64.
   * Si no hay unidad inline, lee el precio directamente en t.end.
   */
  function findPriceAfter(endPos: number): number {
    // Intentar leer un string UTF-16LE corto (máx 9 chars = 18 bytes)
    let j = endPos;
    let unitStr = '';
    while (j < endPos + 18 && j + 1 < data.length) {
      const lo = data[j];
      const hi = data[j + 1];
      if (lo === 0 && hi === 0) { j += 2; break; }   // null-terminator
      if (hi > 1 || (hi === 0 && lo < 0x20)) break;  // no es string válido
      unitStr += String.fromCharCode((hi << 8) | lo);
      j += 2;
    }
    if (UNIT_SET.has(unitStr.trim())) {
      const p = readCurrency(data, j);
      if (p > 0 && p < 500_000) return p;
    }
    // Sin unidad inline: precio directo
    return readCurrency(data, endPos);
  }

  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i];
    if (isBad(t.val)) continue;

    const preco = findPriceAfter(t.end);
    if (preco <= 0 || preco >= 500_000) continue;

    // ── Buscar hacia atrás: barcode, código, categoría ──
    let barcode = '';
    let codigo  = '';
    let cat     = '';
    let step    = i - 1;

    // Barcode
    while (step >= 0 && (tokens[step].val.length <= 2 ||
           UNIT_SET.has(tokens[step].val) ||
           tokens[step].val.startsWith('@'))) step--;
    if (step >= 0 && isBarcode(tokens[step].val)) { barcode = tokens[step].val; step--; }

    // Código interno
    while (step >= 0 && (tokens[step].val.length <= 2 ||
           UNIT_SET.has(tokens[step].val) ||
           tokens[step].val.startsWith('@'))) step--;
    if (step >= 0 && isCode(tokens[step].val)) { codigo = tokens[step].val; step--; }

    // Categoría
    while (step >= 0 && (tokens[step].val.length <= 2 ||
           UNIT_SET.has(tokens[step].val) ||
           isBarcode(tokens[step].val) ||
           isCode(tokens[step].val) ||
           tokens[step].val.startsWith('@'))) step--;
    if (step >= 0) {
      const v = tokens[step].val;
      if (v.length >= 3 && v.length < 60 && !v.startsWith('@')) cat = v;
    }

    products.push({
      codigo: codigo || t.val.substring(0, 12),
      codigo_barras: barcode || null,
      nombre: t.val,
      categoria: cat,
      precio_venta: preco,
      precio_costo: 0,
      stock_actual: 0,
    });
  }

  // Deduplicar: mismo nombre + mismo barcode = duplicado
  const seen = new Set<string>();
  return products.filter((p) => {
    const key = `${p.nombre.toLowerCase().trim()}|${p.codigo_barras ?? ''}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

// ── Parser NX1 antiguo (fallback) ────────────────────────────────────────────

function readUtf16leStr(buf: Buffer, offset: number): [string, number] {
  const chars: string[] = [];
  let i = offset;
  while (i + 1 < buf.length) {
    const lo = buf[i];
    const hi = buf[i + 1];
    if (lo === 0 && hi === 0) return [chars.join(''), i + 2];
    try { chars.push(buf.slice(i, i + 2).toString('utf16le')); } catch { break; }
    i += 2;
  }
  return [chars.join(''), i + 2];
}

function extractProductsLegacy(data: Buffer): ParsedProduct[] {
  const products: ParsedProduct[] = [];
  const totalPages = Math.floor(data.length / PAGE_SIZE);

  for (let pageIdx = 0; pageIdx < totalPages; pageIdx++) {
    const pageStart = pageIdx * PAGE_SIZE;
    const page = data.slice(pageStart, pageStart + PAGE_SIZE);
    if (page.slice(0, 4).toString('ascii') !== 'NXHD') continue;

    let i = 4;
    while (i < PAGE_SIZE - 20) {
      const lo = page[i];
      const hi = i + 1 < PAGE_SIZE ? page[i + 1] : 0;
      if (hi === 0 && lo >= 0x41 && lo <= 0x7a) {
        const [text, nextI] = readUtf16leStr(page, i);
        const textClean = text.trim();
        if (UNIT_SET.has(textClean) && nextI + 8 <= PAGE_SIZE) {
          const raw = readInt64LE(page, nextI);
          const precio = raw / 10000.0;
          if (precio > 0.5 && precio < 500000) {
            const searchStart = Math.max(4, i - 512);
            const stringsBefore: Array<[number, string]> = [];
            let j = searchStart;
            while (j < i) {
              const lob = page[j];
              const hib = j + 1 < page.length ? page[j + 1] : 0;
              if (hib === 0 && lob >= 0x20 && lob <= 0x7e) {
                const [s, nj] = readUtf16leStr(page, j);
                const sTrim = s.trim();
                if (sTrim.length >= 2 && sTrim.length <= 80) { stringsBefore.push([j, sTrim]); j = nj; continue; }
              }
              j++;
            }
            if (stringsBefore.length > 0) {
              const candidates = stringsBefore.slice(-5).map(([, s]) => s).filter(s => s.length > 3 && !/^\d+$/.test(s));
              const nombre = candidates[candidates.length - 1] || '';
              const codigoBarras = stringsBefore.map(([, s]) => s).find(s => /^\d+$/.test(s) && s.length >= 7 && s.length <= 14) || '';
              const categoria = candidates.length >= 2 ? candidates[0] : '';
              if (nombre && nombre.length > 2) {
                products.push({ codigo: codigoBarras || `SIN-COD-${products.length + 1}`, codigo_barras: codigoBarras || null, nombre, categoria, precio_venta: Math.round(precio * 100) / 100, precio_costo: 0, stock_actual: 0 });
              }
            }
          }
          i = nextI; continue;
        }
      }
      i++;
    }
  }
  const seen = new Map<string, boolean>();
  return products.filter(p => { const k = `${p.nombre.toLowerCase()}|${p.precio_venta}`; if (seen.has(k)) return false; seen.set(k, true); return true; });
}

// ── Detector de formato y entrada principal ───────────────────────────────────

function extractProductsFromBuffer(data: Buffer): ParsedProduct[] {
  // Detectar formato NX!2 por el header del archivo
  const isNX2 = data.slice(0, 4).toString('ascii') === 'NX!2';
  const raw = isNX2 ? extractProductsNX2(data) : extractProductsLegacy(data);

  // Si el parser primario no encontró nada, intentar el otro
  if (raw.length < 5 && isNX2) return extractProductsLegacy(data);
  if (raw.length < 5 && !isNX2) return extractProductsNX2(data);

  return raw;
}


// ── Buscar el ZIP más reciente en una carpeta ─────────────────────────────────

export function findLatestZipInDir(dirPath: string): string | null {
  if (!fs.existsSync(dirPath)) return null;
  const files = fs.readdirSync(dirPath)
    .filter((f) => f.toLowerCase().endsWith('.zip'))
    .map((f) => ({ name: f, mtime: fs.statSync(path.join(dirPath, f)).mtime.getTime() }))
    .sort((a, b) => b.mtime - a.mtime);
  return files.length > 0 ? path.join(dirPath, files[0].name) : null;
}

// ── Función principal de importación ─────────────────────────────────────────

export function importFromZip(zipPath: string, db: Database): Nx1ImportResult {
  const errors: string[] = [];

  // 1. Leer el ZIP
  if (!fs.existsSync(zipPath)) {
    return { success: false, imported: 0, skipped: 0, errors: [`Archivo no encontrado: ${zipPath}`] };
  }

  let nx1Data: Buffer;
  try {
    const zip = new AdmZip(zipPath);
    const entry = zip.getEntry('Produto.nx1');
    if (!entry) {
      return { success: false, imported: 0, skipped: 0, errors: ['No se encontró Produto.nx1 en el ZIP'] };
    }
    nx1Data = zip.readFile(entry) as Buffer;
  } catch (e) {
    return { success: false, imported: 0, skipped: 0, errors: [`Error al leer ZIP: ${String(e)}`] };
  }

  // 2. Parsear binario NX1
  const rawProducts = extractProductsFromBuffer(nx1Data);

  if (rawProducts.length < 5) {
    errors.push(`Solo se encontraron ${rawProducts.length} productos en el NX1. Puede indicar un formato diferente.`);
    if (rawProducts.length === 0) {
      return { success: false, imported: 0, skipped: 0, errors };
    }
  }

  // 3. Importar a la DB
  const catCache = new Map<string, number>();

  const insertCat = db.prepare(`INSERT OR IGNORE INTO categorias (nombre) VALUES (?)`);
  const getCatId = db.prepare(`SELECT id FROM categorias WHERE nombre = ?`);
  const deleteProd = db.prepare(`DELETE FROM productos`);
  const deleteCat = db.prepare(`DELETE FROM categorias`);
  const resetSeq = db.prepare(`DELETE FROM sqlite_sequence WHERE name IN ('productos','categorias')`);
  const insertProd = db.prepare(`
    INSERT INTO productos
      (codigo, codigo_barras, nombre, precio_venta, precio_costo, stock_actual, categoria_id, activo)
    VALUES (?, ?, ?, ?, ?, ?, ?, 1)
  `);

  function getOrCreateCat(nombre: string): number | null {
    const n = nombre.trim();
    if (!n) return null;
    const key = n.toLowerCase();
    if (catCache.has(key)) return catCache.get(key)!;
    insertCat.run(n);
    const row = getCatId.get(n) as { id: number };
    catCache.set(key, row.id);
    return row.id;
  }

  let inserted = 0;
  let skipped = 0;
  const codigosUsados = new Set<string>();

  db.transaction(() => {
    deleteProd.run();
    deleteCat.run();
    try { resetSeq.run(); } catch { /* sqlite_sequence puede no existir */ }

    for (const p of rawProducts) {
      const nombre = p.nombre.trim();
      if (!nombre || p.precio_venta <= 0) { skipped++; continue; }

      let codigo = p.codigo.trim();
      const original = codigo;
      let suffix = 0;
      while (codigosUsados.has(codigo)) {
        suffix++;
        codigo = `${original}-${suffix}`;
      }
      codigosUsados.add(codigo);

      try {
        const catId = getOrCreateCat(p.categoria);
        insertProd.run(
          codigo,
          p.codigo_barras,
          nombre,
          p.precio_venta,
          p.precio_costo,
          p.stock_actual,
          catId,
        );
        inserted++;
      } catch (e) {
        errors.push(`${nombre}: ${String(e)}`);
        skipped++;
      }
    }
  })();

  return {
    success: inserted > 0,
    imported: inserted,
    skipped,
    errors,
  };
}

// ── Importar desde una CARPETA que contiene Produto.nx1 ───────────────────────

export function importFromFolder(folderPath: string, db: Database): Nx1ImportResult {
  if (!fs.existsSync(folderPath)) {
    return { success: false, imported: 0, skipped: 0, errors: [`Carpeta no encontrada: ${folderPath}`] };
  }

  // Buscar Produto.nx1 (insensible a mayúsculas) en la carpeta y una subcarpeta de nivel
  const candidates = [
    path.join(folderPath, 'Produto.nx1'),
    path.join(folderPath, 'produto.nx1'),
    path.join(folderPath, 'PRODUTO.NX1'),
  ];

  // También buscar en subcarpetas (nivel 1)
  try {
    const entries = fs.readdirSync(folderPath, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isDirectory()) {
        candidates.push(path.join(folderPath, entry.name, 'Produto.nx1'));
        candidates.push(path.join(folderPath, entry.name, 'produto.nx1'));
      }
      // También aceptar cualquier archivo .nx1 directamente
      if (entry.isFile() && entry.name.toLowerCase().endsWith('.nx1')) {
        candidates.unshift(path.join(folderPath, entry.name));
      }
    }
  } catch { /* ignorar errores de lectura */ }

  const nx1Path = candidates.find(c => fs.existsSync(c));
  if (!nx1Path) {
    // Si no hay .nx1, buscar CSV en la carpeta y retornar descripción clara
    const csvFiles = fs.readdirSync(folderPath).filter(f =>
      /\.(csv|txt|tsv)$/i.test(f)
    );
    if (csvFiles.length > 0) {
      return {
        success: false, imported: 0, skipped: 0,
        errors: [
          `No se encontró Produto.nx1 en la carpeta. Se encontraron archivos CSV: ${csvFiles.join(', ')}. ` +
          `Usá la opción "Importar CSV" para cargarlos.`,
        ],
      };
    }
    return {
      success: false, imported: 0, skipped: 0,
      errors: [
        `No se encontró ningún archivo de backup de Nextar (.nx1) en: ${folderPath}`,
      ],
    };
  }

  let nx1Data: Buffer;
  try {
    nx1Data = fs.readFileSync(nx1Path);
  } catch (e) {
    return { success: false, imported: 0, skipped: 0, errors: [`Error al leer ${nx1Path}: ${String(e)}`] };
  }

  // Reutilizar el mismo lógico de parseo e inserción
  const errors: string[] = [];
  const rawProducts = extractProductsFromBuffer(nx1Data);

  if (rawProducts.length < 5) {
    errors.push(`Solo se encontraron ${rawProducts.length} productos en ${path.basename(nx1Path)}.`);
    if (rawProducts.length === 0) {
      return { success: false, imported: 0, skipped: 0, errors };
    }
  }

  const catCache = new Map<string, number>();
  const insertCat = db.prepare(`INSERT OR IGNORE INTO categorias (nombre) VALUES (?)`);
  const getCatId  = db.prepare(`SELECT id FROM categorias WHERE nombre = ?`);
  const deleteProd = db.prepare(`DELETE FROM productos`);
  const deleteCat  = db.prepare(`DELETE FROM categorias`);
  const resetSeq   = db.prepare(`DELETE FROM sqlite_sequence WHERE name IN ('productos','categorias')`);
  const insertProd = db.prepare(`
    INSERT INTO productos
      (codigo, codigo_barras, nombre, precio_venta, precio_costo, stock_actual, categoria_id, activo)
    VALUES (?, ?, ?, ?, ?, ?, ?, 1)
  `);

  function getOrCreateCat(nombre: string): number | null {
    const n = nombre.trim();
    if (!n) return null;
    const key = n.toLowerCase();
    if (catCache.has(key)) return catCache.get(key)!;
    insertCat.run(n);
    const row = getCatId.get(n) as { id: number };
    catCache.set(key, row.id);
    return row.id;
  }

  let inserted = 0;
  let skipped = 0;
  const codigosUsados = new Set<string>();

  db.transaction(() => {
    deleteProd.run();
    deleteCat.run();
    try { resetSeq.run(); } catch { /* sqlite_sequence puede no existir */ }

    for (const p of rawProducts) {
      const nombre = p.nombre.trim();
      if (!nombre || p.precio_venta <= 0) { skipped++; continue; }

      let codigo = p.codigo.trim();
      const original = codigo;
      let suffix = 0;
      while (codigosUsados.has(codigo)) {
        suffix++;
        codigo = `${original}-${suffix}`;
      }
      codigosUsados.add(codigo);

      try {
        const catId = getOrCreateCat(p.categoria);
        insertProd.run(codigo, p.codigo_barras, nombre, p.precio_venta, p.precio_costo, p.stock_actual, catId);
        inserted++;
      } catch (e) {
        errors.push(`${nombre}: ${String(e)}`);
        skipped++;
      }
    }
  })();

  return { success: inserted > 0, imported: inserted, skipped, errors };
}
