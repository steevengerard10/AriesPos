/**
 * index.ts — Orquestador de importación de backup Nextar
 *
 * IMPORTANTE: Los archivos .nx1 de Nextar son bases de datos NexusDB (header NX!2 / páginas NXHD),
 * NO Firebird. Se utiliza un lector binario NexusDB propio, no node-firebird.
 */

import * as path from 'path';
import * as fs from 'fs';
import { extractNextarBackup, findLatestZip } from './zip-extractor';
import {
  extractProductsFromBuffer,
  extractCategoriasFromBuffer,
  extractClientesFromBuffer,
  debugDumpStrings,
} from './nx1-reader';
import { mapProducto } from './mappers/produto.mapper';
import { mapCategoria } from './mappers/categoria.mapper';
import { mapCliente } from './mappers/cliente.mapper';
import { getDb } from '../../database/db';

// ── Tipos públicos ─────────────────────────────────────────────────────────────

export interface ImportProgress {
  step: string;
  current: number;   // 0-100
  total: number;
  status: 'running' | 'done' | 'error';
  message: string;
}

export interface ImportNixtarResult {
  success: boolean;
  productos: number;
  categorias: number;
  clientes: number;
  skipped: number;
  errores: string[];
  duracion: number;
}

export type ProgressCallback = (p: ImportProgress) => void;

const DEFAULT_ZIP_DIR = 'C:\\Nex\\backup';

// ── Función principal ─────────────────────────────────────────────────────────

export async function importNixtarBackup(
  zipPath: string | null,
  onProgress: ProgressCallback = () => undefined,
): Promise<ImportNixtarResult> {
  const startTime = Date.now();
  const errores: string[] = [];
  let productosInserted = 0;
  let categoriasInserted = 0;
  let clientesInserted = 0;
  let skipped = 0;

  // Resolver ruta del ZIP
  const resolvedZip = zipPath || findLatestZip(DEFAULT_ZIP_DIR);
  if (!resolvedZip) {
    return {
      success: false, productos: 0, categorias: 0, clientes: 0, skipped: 0,
      errores: [`No se encontró ningún archivo .zip en ${DEFAULT_ZIP_DIR}`],
      duracion: 0,
    };
  }

  onProgress({ step: 'Abriendo backup ZIP…', current: 2, total: 100, status: 'running', message: path.basename(resolvedZip) });

  // Extraer archivos del ZIP a tmp
  let extracted;
  try {
    extracted = extractNextarBackup(resolvedZip);
  } catch (e) {
    return {
      success: false, productos: 0, categorias: 0, clientes: 0, skipped: 0,
      errores: [`Error al leer ZIP: ${String(e)}`],
      duracion: Date.now() - startTime,
    };
  }

  const { files, cleanup } = extracted;

  try {
    const db = getDb();

    // ── PASO 1: LEER DATOS DEL BINARIO NX1 ──────────────────────────────
    onProgress({ step: 'Leyendo productos…', current: 10, total: 100, status: 'running', message: 'Analizando Produto.nx1' });

    let rawProducts: ReturnType<typeof extractProductsFromBuffer> = [];
    let rawCategorias: ReturnType<typeof extractCategoriasFromBuffer> = [];
    let rawClientes: ReturnType<typeof extractClientesFromBuffer> = [];

    if (files['produto.nx1']) {
      try {
        const data = fs.readFileSync(files['produto.nx1']);
        rawProducts = extractProductsFromBuffer(data);
        // DEBUG: si no se encontraron productos, volcar strings de las primeras páginas
        if (rawProducts.length === 0) {
          const debugStrings = debugDumpStrings(data, 8);
          console.log('[nx1-debug] 0 productos encontrados. Strings en Produto.nx1:');
          debugStrings.forEach(s => console.log(' ', s));
        }
        onProgress({ step: 'Leyendo productos…', current: 20, total: 100, status: 'running', message: `${rawProducts.length} productos encontrados` });
      } catch (e) {
        errores.push(`Produto.nx1: ${String(e)}`);
      }
    } else {
      errores.push('Produto.nx1 no encontrado en el ZIP');
    }

    if (files['categoria.nx1']) {
      try {
        const data = fs.readFileSync(files['categoria.nx1']);
        rawCategorias = extractCategoriasFromBuffer(data);
        onProgress({ step: 'Leyendo categorías…', current: 30, total: 100, status: 'running', message: `${rawCategorias.length} categorías encontradas` });
      } catch (e) {
        errores.push(`Categoria.nx1: ${String(e)}`);
      }
    }

    if (files['cliente.nx1']) {
      try {
        const data = fs.readFileSync(files['cliente.nx1']);
        rawClientes = extractClientesFromBuffer(data);
        onProgress({ step: 'Leyendo clientes…', current: 40, total: 100, status: 'running', message: `${rawClientes.length} clientes encontrados` });
      } catch (e) {
        errores.push(`Cliente.nx1: ${String(e)}`);
      }
    }

    // ── PASO 2: CATEGORÍAS ───────────────────────────────────────────────
    onProgress({ step: 'Importando categorías…', current: 45, total: 100, status: 'running', message: '' });

    // Recopilar TODAS las categorías: de Categoria.nx1 + las que aparecen en productos
    const allCatNames = new Set<string>();
    for (const raw of rawCategorias) {
      if (raw.nombre) allCatNames.add(raw.nombre.trim());
    }
    for (const p of rawProducts) {
      if (p.categoria && p.categoria.trim()) allCatNames.add(p.categoria.trim());
    }

    const catIdMap = new Map<string, number>(); // nombre → id en SQLite

    db.transaction(() => {
      // Limpiar y reimportar categorías
      db.prepare('DELETE FROM categorias').run();
      try { db.prepare("DELETE FROM sqlite_sequence WHERE name='categorias'").run(); } catch { /* ok */ }

      let catIdx = 0;
      for (const catNombre of allCatNames) {
        if (!catNombre || catNombre.length > 100) continue;
        const mapped = mapCategoria({ nombre: catNombre }, catIdx++);
        const result = db.prepare(`INSERT OR IGNORE INTO categorias (nombre, color) VALUES (?, ?)`).run(mapped.nombre, mapped.color);
        if (result.lastInsertRowid) {
          catIdMap.set(catNombre.toLowerCase(), result.lastInsertRowid as number);
          categoriasInserted++;
        }
      }
      // Recuperar IDs para categorías ya existentes (INSERT OR IGNORE no da lastInsertRowid si era duplicado)
      const allCats = db.prepare('SELECT id, nombre FROM categorias').all() as { id: number; nombre: string }[];
      for (const cat of allCats) {
        catIdMap.set(cat.nombre.toLowerCase(), cat.id);
      }
    })();

    // ── PASO 3: PRODUCTOS ────────────────────────────────────────────────
    onProgress({ step: 'Importando productos…', current: 55, total: 100, status: 'running', message: `Procesando ${rawProducts.length} productos…` });

    const codigosUsados = new Set<string>();

    db.transaction(() => {
      db.prepare('DELETE FROM venta_items').run();
      db.prepare('DELETE FROM productos').run();
      try { db.prepare("DELETE FROM sqlite_sequence WHERE name='productos'").run(); } catch { /* ok */ }

      const insertProd = db.prepare(`
        INSERT INTO productos
          (codigo, codigo_barras, nombre, precio_venta, precio_costo,
           stock_actual, unidad_medida, fraccionable, activo, categoria_id)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, ?)
      `);

      for (let i = 0; i < rawProducts.length; i++) {
        const raw = rawProducts[i];
        if (!raw.nombre || raw.precioVenta <= 0) { skipped++; continue; }

        const mapped = mapProducto(raw, i);
        // Código único
        let codigo = mapped.codigo;
        const orig = codigo;
        let suffix = 0;
        while (codigosUsados.has(codigo)) {
          suffix++;
          codigo = `${orig}-${suffix}`;
        }
        codigosUsados.add(codigo);

        const catId = mapped.categoriaNombre
          ? catIdMap.get(mapped.categoriaNombre.toLowerCase()) ?? null
          : null;

        try {
          insertProd.run(
            codigo, mapped.codigoBarras, mapped.nombre,
            mapped.precioVenta, mapped.precioCosto, mapped.stockActual,
            mapped.unidadMedida, mapped.fraccionable, catId,
          );
          productosInserted++;
        } catch (e) {
          skipped++;
          if (errores.length < 20) errores.push(`Producto "${mapped.nombre}": ${String(e)}`);
        }
      }
    })();

    onProgress({ step: 'Importando productos…', current: 75, total: 100, status: 'running', message: `${productosInserted} productos importados` });

    // ── PASO 4: CLIENTES ─────────────────────────────────────────────────
    if (rawClientes.length > 0) {
      onProgress({ step: 'Importando clientes…', current: 85, total: 100, status: 'running', message: `${rawClientes.length} clientes…` });

      db.transaction(() => {
        const insertCli = db.prepare(`
          INSERT OR IGNORE INTO clientes (nombre, apellido, telefono, email, direccion)
          VALUES (?, ?, ?, ?, ?)
        `);
        for (const raw of rawClientes) {
          const m = mapCliente(raw);
          if (!m.nombre || m.nombre.length < 2) continue;
          try {
            insertCli.run(m.nombre, m.apellido, m.telefono, m.email, m.direccion);
            clientesInserted++;
          } catch { /* duplicado - ignorar */ }
        }
      })();
    }

    onProgress({
      step: 'Importación completa',
      current: 100, total: 100,
      status: 'done',
      message: `${productosInserted} productos · ${categoriasInserted} categorías · ${clientesInserted} clientes`,
    });

    return {
      success: productosInserted > 0,
      productos: productosInserted,
      categorias: categoriasInserted,
      clientes: clientesInserted,
      skipped,
      errores,
      duracion: Date.now() - startTime,
    };

  } catch (e) {
    return {
      success: false, productos: productosInserted, categorias: categoriasInserted,
      clientes: clientesInserted, skipped,
      errores: [...errores, `Error general: ${String(e)}`],
      duracion: Date.now() - startTime,
    };
  } finally {
    cleanup();
  }
}

// ── Re-export helpers ─────────────────────────────────────────────────────────
export { findLatestZip } from './zip-extractor';
