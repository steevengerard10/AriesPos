import { ipcMain, dialog, BrowserWindow } from 'electron';
import { getDb } from '../database/db';
import { emitToWeb, getActivePort } from '../server/index';
import { manualBackup, restoreBackup, listBackups, autoBackup, getBackupsDir } from '../database/backup';
import { importFromNextar } from '../utils/nextar-importer';
import { importFromZip, findLatestZipInDir, importFromFolder } from '../utils/nx1-importer';
import { app } from 'electron';
import * as fs from 'fs';
import * as path from 'path';
import { VentaPayload } from '../types/index';
import { exportFiadosToExcel, getFiadosExcelPath } from '../services/fiados-excel-backup';
import * as os from 'os';

/** Devuelve todas las IPs IPv4 reales (saltea adaptadores virtuales y loopback) */
function getAllLocalIPs(): { name: string; address: string; preferred: boolean }[] {
  const VIRTUAL = /virtualbox|vmware|vethernet|hyper-v|tap|pseudo|bluetooth|loopback|teredo|isatap|6to4/i;
  const nets = os.networkInterfaces();
  const results: { name: string; address: string; preferred: boolean }[] = [];
  for (const [name, iface] of Object.entries(nets)) {
    if (VIRTUAL.test(name)) continue;
    for (const info of iface ?? []) {
      if (info.family === 'IPv4' && !info.internal) {
        const preferred = /^(192\.168\.|10\.|172\.(1[6-9]|2\d|3[01])\.)/.test(info.address);
        results.push({ name, address: info.address, preferred });
      }
    }
  }
  // Ordenar: primero las preferidas (LAN privadas), luego el resto
  results.sort((a, b) => (b.preferred ? 1 : 0) - (a.preferred ? 1 : 0));
  return results;
}

export function registerIpcHandlers(): void {
  // ── PRODUCTOS ────────────────────────────────────────────────
  ipcMain.handle('productos:getAll', (_e, filters?: { categoria?: number; activo?: boolean; search?: string; stockBajo?: boolean; limit?: number; offset?: number }) => {
    const db = getDb();
    const limit = filters?.limit ?? 300;
    const offset = filters?.offset ?? 0;
    let whereClause = `WHERE 1=1`;
    const params: unknown[] = [];

    if (filters?.activo !== undefined) {
      whereClause += ` AND p.activo = ?`;
      params.push(filters.activo ? 1 : 0);
    }
    if (filters?.categoria) {
      whereClause += ` AND p.categoria_id = ?`;
      params.push(filters.categoria);
    }
    if (filters?.search) {
      whereClause += ` AND (p.nombre LIKE ? OR p.codigo LIKE ? OR p.codigo_barras LIKE ?)`;
      const s = `%${filters.search}%`;
      params.push(s, s, s);
    }
    if (filters?.stockBajo) {
      whereClause += ` AND p.stock_actual <= p.stock_minimo`;
    }
    const total = (db.prepare(`SELECT COUNT(*) as c FROM productos p ${whereClause}`).get(...params) as { c: number }).c;
    const rows = db.prepare(`
      SELECT p.*, c.nombre as categoria_nombre
      FROM productos p
      LEFT JOIN categorias c ON p.categoria_id = c.id
      ${whereClause}
      ORDER BY p.nombre
      LIMIT ? OFFSET ?
    `).all(...params, limit, offset);
    return { rows, total, limit, offset };
  });

  ipcMain.handle('productos:getById', (_e, id: number) => {
    const db = getDb();
    return db.prepare(`SELECT p.*, c.nombre as categoria_nombre FROM productos p LEFT JOIN categorias c ON p.categoria_id = c.id WHERE p.id = ?`).get(id);
  });

  ipcMain.handle('productos:search', (_e, query: string) => {
    const db = getDb();
    const s = `%${query}%`;
    const exact = query.trim();
    return db.prepare(`
      SELECT p.*, c.nombre as categoria_nombre
      FROM productos p LEFT JOIN categorias c ON p.categoria_id = c.id
      WHERE p.activo = 1 AND (p.nombre LIKE ? OR p.codigo LIKE ? OR p.codigo_barras LIKE ?)
      ORDER BY
        CASE
          WHEN p.codigo_barras = ?       THEN 0
          WHEN LOWER(p.codigo) = LOWER(?) THEN 1
          WHEN LOWER(p.nombre) LIKE ?     THEN 2
          ELSE 3
        END,
        p.nombre ASC
      LIMIT 20
    `).all(s, s, s, exact, exact, exact + '%');
  });

  // ── IMPORTACIÓN NEXTAR ────────────────────────────────────────
  ipcMain.handle('dialog:showOpenDialog', async (_e, options: Electron.OpenDialogOptions) => {
    const { canceled, filePaths } = await dialog.showOpenDialog(options);
    return canceled ? [] : filePaths;
  });

  ipcMain.handle('productos:importFromNextar', (_e, filePath: string) => {
    try {
      const importResult = importFromNextar(filePath);
      if (importResult.products.length === 0) {
        return { success: false, imported: 0, skipped: importResult.skipped, errors: importResult.errors };
      }

      const db = getDb();

      // Asegurar que existe la categoría 'General' y las categorías demo
      const insertCat = db.prepare(`INSERT OR IGNORE INTO categorias (nombre, color) VALUES (?, '#64748b')`);
      const getCatId = db.prepare(`SELECT id FROM categorias WHERE nombre = ? LIMIT 1`);

      const insertProduct = db.prepare(`
        INSERT OR REPLACE INTO productos
          (codigo, codigo_barras, nombre, categoria_id, precio_costo, precio_venta, precio2, precio3,
           stock_actual, stock_minimo, unidad_medida, fraccionable, activo)
        VALUES
          (@codigo, @codigo_barras, @nombre, @categoria_id, @precio_costo, @precio_venta,
           @precio2, @precio3, @stock_actual, @stock_minimo, @unidad_medida, @fraccionable, @activo)
      `);

      const importMany = db.transaction(() => {
        let count = 0;
        for (const p of importResult.products) {
          // Crear la categoría si no existe
          insertCat.run(p.categoria);
          const catRow = getCatId.get(p.categoria) as { id: number } | undefined;

          insertProduct.run({
            codigo:        p.codigo,
            codigo_barras: p.codigo_barras || '',
            nombre:        p.nombre,
            categoria_id:  catRow?.id ?? null,
            precio_costo:  p.precio_costo,
            precio_venta:  p.precio_venta,
            precio2:       p.precio2 ?? 0,
            precio3:       p.precio3 ?? 0,
            stock_actual:  p.stock_actual,
            stock_minimo:  p.stock_minimo,
            unidad_medida: p.unidad_medida,
            fraccionable:  p.fraccionable ? 1 : 0,
            activo:        p.activo ? 1 : 0,
          });
          count++;
        }
        return count;
      });

      const count = importMany();
      emitToWeb('producto:actualizado', { reload: true });
      return { success: true, imported: count, skipped: importResult.skipped, errors: importResult.errors };
    } catch (error) {
      console.error('[importFromNextar]', error);
      return { success: false, imported: 0, skipped: 0, errors: [String(error)] };
    }
  });

  ipcMain.handle('productos:getByBarcode', (_e, barcode: string) => {
    const db = getDb();
    return db.prepare(`SELECT p.*, c.nombre as categoria_nombre FROM productos p LEFT JOIN categorias c ON p.categoria_id = c.id WHERE p.codigo_barras = ? AND p.activo = 1`).get(barcode)
      || db.prepare(`SELECT p.*, c.nombre as categoria_nombre FROM productos p LEFT JOIN categorias c ON p.categoria_id = c.id WHERE p.codigo = ? AND p.activo = 1`).get(barcode);
  });

  ipcMain.handle('productos:create', (_e, data: Record<string, unknown>) => {
    const db = getDb();
    const boolToInt = (v: unknown) => (typeof v === 'boolean' ? (v ? 1 : 0) : v);
    const clean = { marca: '', proveedor: '', ...data,
      fraccionable: boolToInt(data.fraccionable ?? false),
      en_catalogo:  boolToInt(data.en_catalogo  ?? false),
      activo:       boolToInt(data.activo        ?? true),
    };
    const stmt = db.prepare(`
      INSERT INTO productos (codigo, codigo_barras, nombre, categoria_id, precio_costo, precio_venta, precio2, precio3,
        stock_actual, stock_minimo, unidad_medida, fraccionable, en_catalogo, imagen_path, activo, marca, proveedor)
      VALUES (@codigo, @codigo_barras, @nombre, @categoria_id, @precio_costo, @precio_venta, @precio2, @precio3,
        @stock_actual, @stock_minimo, @unidad_medida, @fraccionable, @en_catalogo, @imagen_path, @activo,
        @marca, @proveedor)
    `);
    const result = stmt.run(clean);
    emitToWeb('producto:actualizado', { id: result.lastInsertRowid });
    return { id: result.lastInsertRowid };
  });

  ipcMain.handle('productos:update', (_e, id: number, data: Record<string, unknown>) => {
    const db = getDb();
    const boolToInt = (v: unknown) => (typeof v === 'boolean' ? (v ? 1 : 0) : v);
    const allowed = ['nombre','codigo','codigo_barras','categoria_id','precio_costo','precio_venta',
      'precio2','precio3','stock_actual','stock_minimo','unidad_medida','fraccionable',
      'en_catalogo','imagen_path','activo','marca','proveedor'];
    const filtered = Object.fromEntries(
      Object.entries(data)
        .filter(([k]) => allowed.includes(k))
        .map(([k, v]) => [k, ['fraccionable','en_catalogo','activo'].includes(k) ? boolToInt(v) : v])
    );
    if (Object.keys(filtered).length === 0) return { success: true };
    const fields = Object.keys(filtered).map(k => `${k} = @${k}`).join(', ');
    db.prepare(`UPDATE productos SET ${fields}, updated_at = datetime('now') WHERE id = @id`).run({ ...filtered, id });
    emitToWeb('producto:actualizado', { id });
    return { success: true };
  });

  ipcMain.handle('productos:delete', (_e, id: number) => {
    const db = getDb();
    db.prepare(`UPDATE productos SET activo = 0 WHERE id = ?`).run(id);
    return { success: true };
  });

  ipcMain.handle('productos:deleteAll', () => {
    const db = getDb();
    db.prepare(`DELETE FROM productos`).run();
    try { db.prepare(`DELETE FROM sqlite_sequence WHERE name='productos'`).run(); } catch { /* ok */ }
    return { success: true };
  });

  ipcMain.handle('productos:limpiarBasura', () => {
    const db = getDb();

    // Regla simple y directa:
    // Un nombre de producto válido para Argentina solo usa chars del rango
    // Latin Basic + Latin-1 + Latin Extended-A/B (codepoints 0–591 = U+024F).
    // Cualquier char fuera de ese rango (ej: ‰ U+2030, … U+2026, œ U+0153, etc.)
    // proviene de datos binarios del backup Nextar y debe eliminarse.
    function esBasura(nombre: string): boolean {
      if (!nombre || nombre.trim().length === 0) return true;
      for (const c of nombre) {
        const cp = c.codePointAt(0)!;
        // Control chars (< 32) o high-latin binario (> 591)
        if (cp < 32 || cp > 591) return true;
      }
      return false;
    }

    const todos = db.prepare(`SELECT id, nombre FROM productos`).all() as { id: number; nombre: string }[];
    const basura: number[] = [];

    for (const p of todos) {
      if (esBasura(p.nombre || '')) {
        basura.push(p.id);
      }
    }

    if (basura.length === 0) return { deleted: 0, pt: 0, en: 0, basura: 0 };

    // Borrar en lotes de 500 (límite SQLite = 999 variables)
    const CHUNK = 500;
    db.transaction(() => {
      for (let i = 0; i < basura.length; i += CHUNK) {
        const chunk = basura.slice(i, i + CHUNK);
        const phs = chunk.map(() => '?').join(',');
        db.prepare(`DELETE FROM productos WHERE id IN (${phs})`).run(...chunk);
      }
    })();

    return { deleted: basura.length, pt: 0, en: 0, basura: basura.length };
  });

  ipcMain.handle('productos:deleteMany', (_e, ids: number[]) => {
    if (!ids || ids.length === 0) return { deleted: 0 };
    const db = getDb();
    const placeholders = ids.map(() => '?').join(',');
    const result = db.prepare(`DELETE FROM productos WHERE id IN (${placeholders})`).run(...ids);
    return { deleted: result.changes };
  });

  // ── ACTUALIZACIÓN MASIVA DE PRECIOS ──────────────────────────
  ipcMain.handle('productos:bulkGetByFilters', (_e, filters: { brand?: string; category?: string; name?: string }) => {
    // Si no hay ningún filtro, devolver vacío para evitar traer toda la tabla sin querer
    if (!filters?.brand && !filters?.category && !filters?.name) return [];
    const db = getDb();
    let where = `WHERE p.activo = 1 AND p.precio_venta IS NOT NULL`;
    const params: unknown[] = [];
    if (filters.brand) {
      where += ` AND p.marca LIKE ?`;
      params.push(`%${filters.brand}%`);
    }
    if (filters.category) {
      where += ` AND c.nombre LIKE ?`;
      params.push(`%${filters.category}%`);
    }
    if (filters.name) {
      where += ` AND p.nombre LIKE ?`;
      params.push(`%${filters.name}%`);
    }
    return db.prepare(`
      SELECT p.id, p.nombre, p.marca, p.codigo, c.nombre AS categoria_nombre, p.precio_venta
      FROM productos p
      LEFT JOIN categorias c ON p.categoria_id = c.id
      ${where}
      ORDER BY p.nombre
      LIMIT 2000
    `).all(...params);
  });

  ipcMain.handle('productos:bulkUpdatePrices', (_e, payload: { productIds: number[]; percentage: number }) => {
    const { productIds, percentage } = payload;
    if (!productIds?.length || percentage === 0) return { updated: 0 };
    const db = getDb();
    const CHUNK = 500;
    let updated = 0;
    db.transaction(() => {
      for (let i = 0; i < productIds.length; i += CHUNK) {
        const chunk = productIds.slice(i, i + CHUNK);
        const phs = chunk.map(() => '?').join(',');
        const multiplier = 1 + percentage / 100;
        const result = db.prepare(`
          UPDATE productos
          SET precio_venta = ROUND(precio_venta * ?, 2),
              updated_at = datetime('now')
          WHERE id IN (${phs})
            AND precio_venta IS NOT NULL
        `).run(multiplier, ...chunk);
        updated += result.changes;
      }
    })();
    return { updated };
  });

  ipcMain.handle('productos:loadSeed', () => {
    const db = getDb();
    const { seedProductos } = require('../services/seed-productos');
    const items: Array<{ nombre: string; categoria: string; precio_venta: number; codigo_barras?: string; unidad_medida?: string; marca?: string }> = seedProductos;
    let inserted = 0;
    db.transaction(() => {
      for (const item of items) {
        // Buscar o crear categoría
        let catId: number | null = null;
        const cat = db.prepare(`SELECT id FROM categorias WHERE lower(nombre)=lower(?)`).get(item.categoria) as { id: number } | undefined;
        if (cat) {
          catId = cat.id;
        } else {
          const r = db.prepare(`INSERT OR IGNORE INTO categorias (nombre, color) VALUES (?,?)`).run(item.categoria, '#6366f1');
          catId = r.lastInsertRowid as number || null;
        }
        // Insertar producto (ignorar si ya existe por nombre)
        const exists = db.prepare(`SELECT id FROM productos WHERE lower(nombre)=lower(?)`).get(item.nombre);
        if (!exists) {
          const codigo = item.codigo_barras || `SEED-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
          db.prepare(`INSERT INTO productos (nombre, codigo, codigo_barras, categoria_id, precio_venta, precio_costo, precio2, precio3, stock_actual, stock_minimo, unidad_medida, fraccionable, en_catalogo, activo, marca, proveedor)
            VALUES (?,?,?,?,?,0,0,0,0,0,?,0,1,1,?,'')`).run(
            item.nombre,
            codigo,
            item.codigo_barras || '',
            catId,
            item.precio_venta,
            item.unidad_medida || 'unidad',
            item.marca || '',
          );
          inserted++;
        }
      }
    })();
    return { inserted };
  });

  ipcMain.handle('productos:importCSV', (_e, csvData: string) => {
    const db = getDb();
    const lines = csvData.split('\n').filter(l => l.trim());
    let imported = 0, errors = 0;

    if (lines.length < 2) return { imported: 0, errors: 0 };

    // Detectar separador
    const sep = lines[0].includes(';') ? ';' : ',';
    const headers = lines[0].split(sep).map(h => h.trim().toLowerCase()
      .replace(/"/g, '')
      // normalizar acentos para comparar sin tildes
      .normalize('NFD').replace(/[\u0300-\u036f]/g, ''));

    const colMap: Record<string, number> = {};
    const headerAliases: Record<string, string[]> = {
      codigo:        ['codigo', 'code', 'cod', 'id', 'ref', 'referencia'],
      nombre:        ['nombre', 'name', 'descripcion', 'producto', 'articulo', 'detalle', 'description'],
      precio_venta:  ['precio', 'precio_venta', 'price', 'pventa', 'precio venta', 'p.venta', 'venta', 'p. venta', 'precioventa'],
      precio_costo:  ['costo', 'precio_costo', 'cost', 'pcosto', 'precio costo', 'p.costo', 'p. costo', 'preciocosto', 'precio de costo'],
      stock_actual:  ['stock', 'stock_actual', 'cantidad', 'existencia', 'existencias', 'saldo', 'inventario'],
      codigo_barras: ['barcode', 'codigo_barras', 'ean', 'codbar', 'codigo de barras', 'codigobarras', 'barra', 'barras'],
      categoria_id:  ['categoria', 'category', 'rubro', 'familia'],
    };

    for (const [field, aliases] of Object.entries(headerAliases)) {
      for (let i = 0; i < headers.length; i++) {
        if (aliases.includes(headers[i])) {
          colMap[field] = i;
          break;
        }
      }
    }

    // Parser de números: soporta formato argentino (1.234,56) y estándar (1234.56)
    const parseNum = (val: string): number => {
      if (!val || val.trim() === '' || val.trim() === '-') return 0;
      const clean = val.trim().replace(/"/g, '');
      // Si tiene coma y punto: determinar cuál es decimal por posición
      if (clean.includes(',') && clean.includes('.')) {
        const lastComma = clean.lastIndexOf(',');
        const lastDot = clean.lastIndexOf('.');
        if (lastComma > lastDot) {
          // formato argentino: 1.234,56 -> 1234.56
          return parseFloat(clean.replace(/\./g, '').replace(',', '.')) || 0;
        } else {
          // formato 1,234.56
          return parseFloat(clean.replace(/,/g, '')) || 0;
        }
      }
      // Solo coma: podria ser decimal o miles
      if (clean.includes(',') && !clean.includes('.')) {
        // si la parte después de la coma tiene <= 2 dígitos, es decimal
        const parts = clean.split(',');
        if (parts[parts.length - 1].length <= 2) {
          return parseFloat(clean.replace(',', '.')) || 0;
        }
        return parseFloat(clean.replace(/,/g, '')) || 0;
      }
      return parseFloat(clean.replace(/,/g, '')) || 0;
    };

    const insertStmt = db.prepare(`
      INSERT OR REPLACE INTO productos (codigo, nombre, precio_venta, precio_costo, stock_actual, codigo_barras, categoria_id, activo)
      VALUES (?, ?, ?, ?, ?, ?, ?, 1)
    `);

    // Obtener o crear categoría por nombre
    const getCatStmt  = db.prepare(`SELECT id FROM categorias WHERE LOWER(nombre) = LOWER(?) LIMIT 1`);
    const insCatStmt  = db.prepare(`INSERT INTO categorias (nombre) VALUES (?)`);
    const catCache: Record<string, number> = {};
    const getOrCreateCat = (nombre: string): number | null => {
      if (!nombre) return null;
      const key = nombre.toLowerCase().trim();
      if (catCache[key] !== undefined) return catCache[key];
      const row = getCatStmt.get(key) as { id: number } | undefined;
      if (row) { catCache[key] = row.id; return row.id; }
      const res = insCatStmt.run(nombre.trim());
      const id = res.lastInsertRowid as number;
      catCache[key] = id;
      return id;
    };

    const importMany = db.transaction((rows: string[]) => {
      for (const line of rows) {
        try {
          // Parsear CSV respetando campos entre comillas que pueden tener el separador adentro
          const cols: string[] = [];
          let cur = '', inQuote = false;
          for (let i = 0; i < line.length; i++) {
            const ch = line[i];
            if (ch === '"') { inQuote = !inQuote; }
            else if (ch === sep && !inQuote) { cols.push(cur.trim()); cur = ''; }
            else { cur += ch; }
          }
          cols.push(cur.trim());

          const codigo = cols[colMap.codigo ?? 0]?.replace(/"/g, '') || `PROD-${Date.now()}-${Math.random()}`;
          const nombre = cols[colMap.nombre ?? 1]?.replace(/"/g, '') || 'Sin nombre';
          const precio_venta = parseNum(cols[colMap.precio_venta ?? 2] || '0');
          const precio_costo = parseNum(cols[colMap.precio_costo ?? -1] || '0');
          const stock_actual = parseNum(cols[colMap.stock_actual ?? -1] || '0');
          const codigo_barras = cols[colMap.codigo_barras ?? -1]?.replace(/"/g, '') || '';
          const cat_nombre   = cols[colMap.categoria_id ?? -1]?.replace(/"/g, '') || '';
          const categoria_id = cat_nombre ? getOrCreateCat(cat_nombre) : null;

          if (!nombre || nombre === 'Sin nombre' && !codigo) { errors++; continue; }

          insertStmt.run(codigo, nombre, precio_venta, precio_costo, stock_actual, codigo_barras, categoria_id);
          imported++;
        } catch {
          errors++;
        }
      }
    });

    importMany(lines.slice(1));
    return { imported, errors };
  });

  // ── BORRAR TODOS LOS PRODUCTOS ────────────────────────────────
  ipcMain.handle('productos:truncate', () => {
    const db = getDb();
    db.transaction(() => {
      db.prepare(`DELETE FROM stock_movimientos`).run();
      db.prepare(`DELETE FROM venta_items`).run();
      db.prepare(`DELETE FROM productos`).run();
      db.prepare(`DELETE FROM categorias`).run();
      db.prepare(`DELETE FROM sqlite_sequence WHERE name IN ('productos','categorias','stock_movimientos','venta_items')`).run();
    })();
    return { success: true };
  });

  // ── BUSCAR PRODUCTO EN INTERNET (Open Food Facts) ─────────────
  ipcMain.handle('productos:buscarInternet', async (_e, query: string, type: 'barcode' | 'nombre') => {
    const headers = { 'User-Agent': 'AriesPos/1.0 (sistema-pos-contacto@ariespos.ar)' };

    function mapProduct(p: Record<string, unknown>) {
      const barcode = (p.code || p._id || '') as string;
      const nombre = ((p.product_name_es || p.product_name_fr || p.product_name || '') as string).trim();
      const marca = ((p.brands || '') as string).replace(/,.*/, '').trim();
      const imagen_url = (p.image_front_url || p.image_url || null) as string | null;
      const qty = (p.quantity || '') as string;
      const unidad_hint = qty.toLowerCase().includes('kg') ? 'kg'
        : qty.toLowerCase().includes('g') ? 'g'
        : qty.toLowerCase().includes('l') || qty.toLowerCase().includes('litro') ? 'litro'
        : qty.toLowerCase().includes('ml') ? 'ml' : '';
      return { barcode, nombre, marca, imagen_url, unidad_hint };
    }

    try {
      if (type === 'barcode') {
        const url = `https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(query)}.json?fields=code,product_name,product_name_es,product_name_fr,brands,image_front_url,image_url,quantity`;
        const res = await fetch(url, { headers });
        const data = await res.json() as { status: number; product?: Record<string, unknown> };
        if (data.status !== 1 || !data.product) return { found: false };
        return { found: true, results: [mapProduct({ ...data.product, code: query })] };
      } else {
        const url = `https://world.openfoodfacts.org/cgi/search.pl?search_terms=${encodeURIComponent(query)}&json=1&page_size=6&fields=code,product_name,product_name_es,product_name_fr,brands,image_front_url,image_url,quantity`;
        const res = await fetch(url, { headers });
        const data = await res.json() as { products?: Record<string, unknown>[] };
        if (!data.products?.length) return { found: false };
        const results = data.products.map(mapProduct).filter(r => r.nombre || r.marca);
        return { found: results.length > 0, results };
      }
    } catch (err) {
      return { found: false, error: String(err) };
    }
  });

  // ── IMPORTAR DESDE NEXTAR ZIP (NX1 binario) ──────────────────
  ipcMain.handle('productos:importFromZip', async (event, zipPath?: string) => {
    const { importNixtarBackup, findLatestZip } = require('../services/nextar-importer');
    const sendProgress = (p: unknown) => {
      if (!event.sender.isDestroyed()) event.sender.send('nextar:progress', p);
    };
    let targetPath: string | null = zipPath || null;
    if (!targetPath) {
      const searchDirs = [
        'C:\\Nex\\backup',
        path.join(app.getPath('desktop'), 'Backup nextar'),
        app.getPath('desktop'),
      ];
      for (const dir of searchDirs) {
        const found: string | null = findLatestZip(dir);
        if (found) { targetPath = found; break; }
      }
    }
    if (!targetPath) {
      return { success: false, imported: 0, skipped: 0, errors: ['No se encontró ningún archivo .zip de backup'] };
    }
    const res = await importNixtarBackup(targetPath, sendProgress);
    // Normalizar el resultado al formato que espera el modal (imported = productos)
    return {
      success: res.success,
      imported: (res as { productos?: number }).productos ?? 0,
      skipped: res.skipped ?? 0,
      errors: (res as { errores?: string[]; errors?: string[] }).errores ?? (res as { errors?: string[] }).errors ?? [],
    };
  });

  ipcMain.handle('productos:importFromFolder', async (_e, folderPath: string) => {
    return importFromFolder(folderPath, getDb());
  });

  // ── IMPORTAR BACKUP COMPLETO NEXTAR ──────────────────────────
  ipcMain.handle('nextar:selectBackup', async (event) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    const { canceled, filePaths } = await dialog.showOpenDialog(win!, {
      title: 'Seleccionar backup de Nextar',
      filters: [{ name: 'Backup Nextar', extensions: ['zip'] }],
      defaultPath: 'C:\\Nex\\backup',
      properties: ['openFile'],
    });
    return canceled ? null : filePaths[0];
  });

  ipcMain.handle('nextar:importBackup', async (event, zipPath?: string) => {
    const { importNixtarBackup, findLatestZip } = require('../services/nextar-importer');
    const sendProgress = (p: unknown) => {
      if (!event.sender.isDestroyed()) {
        event.sender.send('nextar:progress', p);
      }
    };
    // Si no se pasó ruta, buscar en ubicaciones habituales del backup de Nextar
    let resolvedPath: string | null = zipPath || null;
    if (!resolvedPath) {
      const searchDirs: string[] = [
        'C:\\Nex\\backup',
        path.join(app.getPath('desktop'), 'Backup nextar'),
        app.getPath('desktop'),
        path.join(app.getPath('home'), 'Backup nextar'),
        app.getPath('documents'),
        path.join(app.getPath('userData'), 'backups'),
      ];
      for (const dir of searchDirs) {
        const found: string | null = findLatestZip(dir);
        if (found) { resolvedPath = found; break; }
      }
    }
    return importNixtarBackup(resolvedPath, sendProgress);
  });

  // ── CATEGORIAS ────────────────────────────────────────────────
  ipcMain.handle('categorias:getAll', () => {
    const db = getDb();
    return db.prepare(`SELECT * FROM categorias ORDER BY nombre`).all();
  });

  ipcMain.handle('categorias:create', (_e, data: { nombre: string; color: string }) => {
    const db = getDb();
    const result = db.prepare(`INSERT INTO categorias (nombre, color) VALUES (?, ?)`).run(data.nombre, data.color);
    return { id: result.lastInsertRowid };
  });

  ipcMain.handle('categorias:update', (_e, id: number, data: { nombre: string; color: string }) => {
    const db = getDb();
    db.prepare(`UPDATE categorias SET nombre = ?, color = ? WHERE id = ?`).run(data.nombre, data.color, id);
    return { success: true };
  });

  ipcMain.handle('categorias:delete', (_e, id: number) => {
    const db = getDb();
    db.prepare(`UPDATE productos SET categoria_id = NULL WHERE categoria_id = ?`).run(id);
    db.prepare(`DELETE FROM categorias WHERE id = ?`).run(id);
    return { success: true };
  });

  // ── CLIENTES ────────────────────────────────────────────────
  ipcMain.handle('clientes:getAll', (_e, search?: string) => {
    const db = getDb();
    // saldo_pendiente revalorizado: usa precio_venta actual del producto si es > 0,
    // sino el precio histórico. COALESCE: si no hay ítems, usa total almacenado.
    let query = `
      SELECT c.*,
        COALESCE((
          SELECT SUM(
            MAX(0,
              COALESCE(
                (SELECT SUM(CASE WHEN p.precio_venta > 0 THEN p.precio_venta ELSE vi.precio_unitario END * vi.cantidad)
                   - COALESCE(vf.descuento, 0)
                 FROM venta_items vi
                 LEFT JOIN productos p ON p.id = vi.producto_id
                 WHERE vi.venta_id = vf.id),
                vf.total
              ) - COALESCE(vf.monto_pagado, 0)
            )
          )
          FROM ventas vf
          WHERE vf.cliente_id = c.id AND vf.es_fiado = 1 AND vf.estado NOT IN ('pagado')
        ), 0) as saldo_pendiente
      FROM clientes c
      WHERE 1=1
    `;
    const params: unknown[] = [];
    if (search) {
      query += ` AND (c.nombre LIKE ? OR c.telefono LIKE ? OR c.documento LIKE ?)`;
      const s = `%${search}%`;
      params.push(s, s, s);
    }
    query += ` ORDER BY c.nombre`;
    return db.prepare(query).all(...params);
  });

  ipcMain.handle('clientes:getById', (_e, id: number) => {
    const db = getDb();
    return db.prepare(`SELECT * FROM clientes WHERE id = ?`).get(id);
  });

  ipcMain.handle('clientes:create', (_e, data: Record<string, unknown>) => {
    const db = getDb();
    const result = db.prepare(`
      INSERT INTO clientes (nombre, apellido, telefono, email, direccion, documento, limite_credito)
      VALUES (@nombre, @apellido, @telefono, @email, @direccion, @documento, @limite_credito)
    `).run(data);
    return { id: result.lastInsertRowid };
  });

  ipcMain.handle('clientes:update', (_e, id: number, data: Record<string, unknown>) => {
    const db = getDb();
    const allowed = ['nombre', 'apellido', 'telefono', 'email', 'direccion', 'documento', 'limite_credito', 'activo'];
    const filtered = Object.fromEntries(Object.entries(data).filter(([k]) => allowed.includes(k)));
    if (Object.keys(filtered).length === 0) return { success: true };
    const fields = Object.keys(filtered).map(k => `${k} = @${k}`).join(', ');
    db.prepare(`UPDATE clientes SET ${fields} WHERE id = @id`).run({ ...filtered, id });
    return { success: true };
  });

  ipcMain.handle('clientes:delete', (_e, id: number) => {
    const db = getDb();
    db.prepare(`DELETE FROM clientes WHERE id = ?`).run(id);
    return { success: true };
  });

  ipcMain.handle('clientes:getVentas', (_e, clienteId: number) => {
    const db = getDb();
    return db.prepare(`
      SELECT v.*, GROUP_CONCAT(p.nombre, ', ') as productos_nombres
      FROM ventas v
      LEFT JOIN venta_items vi ON vi.venta_id = v.id
      LEFT JOIN productos p ON p.id = vi.producto_id
      WHERE v.cliente_id = ?
      GROUP BY v.id
      ORDER BY v.created_at DESC
    `).all(clienteId);
  });

  ipcMain.handle('clientes:getSaldoActual', (_e, clienteId: number) => {
    const db = getDb();
    // Devuelve el saldo recalculado con precios actuales de productos
    // Usa precio_venta del producto solo si es mayor a 0; si no, usa el precio histórico de la venta
    const ventas = db.prepare(`
      SELECT v.id, COALESCE(v.descuento, 0) as descuento, COALESCE(v.monto_pagado, 0) as monto_pagado, v.total as total_historico
      FROM ventas v
      WHERE v.cliente_id = ? AND v.es_fiado = 1 AND v.estado NOT IN ('pagado')
      ORDER BY v.id ASC
    `).all(clienteId) as { id: number; descuento: number; monto_pagado: number; total_historico: number }[];

    let saldoActual = 0;
    for (const venta of ventas) {
      const items = db.prepare(`
        SELECT vi.cantidad, vi.precio_unitario,
               CASE WHEN p.precio_venta > 0 THEN p.precio_venta ELSE vi.precio_unitario END as precio_actual
        FROM venta_items vi
        LEFT JOIN productos p ON p.id = vi.producto_id
        WHERE vi.venta_id = ?
      `).all(venta.id) as { cantidad: number; precio_unitario: number; precio_actual: number }[];
      if (items.length === 0) {
        // Sin items: usar total histórico
        saldoActual += Math.max(0, venta.total_historico - venta.monto_pagado);
        continue;
      }
      const subtotalActual = items.reduce((s, i) => s + i.precio_actual * i.cantidad, 0);
      const totalActual = Math.max(0, subtotalActual - venta.descuento);
      saldoActual += Math.max(0, totalActual - venta.monto_pagado);
    }
    return saldoActual;
  });

  ipcMain.handle('clientes:pagarFiado', (_e, clienteId: number, monto: number, metodo: string) => {
    const db = getDb();
    const ventas = db.prepare(`
      SELECT id, total, COALESCE(descuento, 0) as descuento, COALESCE(monto_pagado, 0) as monto_pagado
      FROM ventas
      WHERE cliente_id = ? AND es_fiado = 1 AND estado NOT IN ('pagado')
      ORDER BY id ASC
    `).all(clienteId) as { id: number; total: number; descuento: number; monto_pagado: number }[];

    if (ventas.length === 0) return { success: false, error: 'Sin fiados pendientes para este cliente' };

    const sesionActiva = db.prepare(`SELECT id FROM caja_sesiones WHERE fecha_cierre IS NULL ORDER BY id DESC LIMIT 1`).get() as { id: number } | undefined;

    // Calcula el saldo revalorizado de una venta (precio actual del producto, no histórico)
    const getVentaSaldo = (ventaId: number, montoYaPagado: number, descuento: number, totalHistorico: number): number => {
      const items = db.prepare(`
        SELECT vi.cantidad,
               CASE WHEN p.precio_venta > 0 THEN p.precio_venta ELSE vi.precio_unitario END as precio_actual
        FROM venta_items vi
        LEFT JOIN productos p ON p.id = vi.producto_id
        WHERE vi.venta_id = ?
      `).all(ventaId) as { cantidad: number; precio_actual: number }[];
      if (items.length === 0) return Math.max(0, totalHistorico - montoYaPagado);
      const subtotal = items.reduce((s, i) => s + i.precio_actual * i.cantidad, 0);
      return Math.max(0, subtotal - descuento - montoYaPagado);
    };

    db.transaction(() => {
      let restante = monto;
      for (const venta of ventas) {
        if (restante <= 0) break;
        // Usar saldo revalorizado para decidir pago total/parcial
        const saldo = getVentaSaldo(venta.id, venta.monto_pagado, venta.descuento, venta.total);
        if (saldo <= 0) continue;

        if (restante >= saldo) {
          // Pago total de esta venta (basado en precio actual)
          const nuevoPagado = venta.monto_pagado + saldo;
          db.prepare(`UPDATE ventas SET estado = 'pagado', monto_pagado = ? WHERE id = ?`).run(nuevoPagado, venta.id);
          restante -= saldo;
        } else {
          // Pago parcial
          const nuevoPagado = venta.monto_pagado + restante;
          db.prepare(`UPDATE ventas SET estado = 'parcial', monto_pagado = ? WHERE id = ?`).run(nuevoPagado, venta.id);
          restante = 0;
        }
      }
      if (sesionActiva) {
        db.prepare(`
          INSERT INTO caja_movimientos (sesion_id, tipo, monto, descripcion, metodo_pago)
          VALUES (?, 'ingreso', ?, ?, ?)
        `).run(sesionActiva.id, monto, `Pago fiado - Cliente #${clienteId}`, metodo || 'efectivo');
      }
    })();

    emitToWeb('venta:actualizada', { clienteId });
    emitToWeb('fiados:list-changed', { clienteId });

    // Notificar al renderer Electron sobre cambio en fiados
    BrowserWindow.getAllWindows().forEach((w) => {
      if (!w.isDestroyed()) w.webContents.send('fiados:list-changed', { clienteId });
    });

    // Actualizar Excel de fiados automáticamente
    try { exportFiadosToExcel(db); } catch { /* silencioso */ }

    return { success: true };
  });

  ipcMain.handle('clientes:exportCSV', () => {
    const db = getDb();
    const clientes = db.prepare(`SELECT * FROM clientes ORDER BY nombre`).all() as Record<string, unknown>[];
    const headers = ['id','nombre','telefono','email','direccion','documento','limite_credito','created_at'];
    const csv = [headers.join(','), ...clientes.map(c => headers.map(h => `"${String(c[h] ?? '').replace(/"/g, '""')}"`).join(','))].join('\n');
    return csv;
  });

  ipcMain.handle('fiados:exportExcel', async () => {
    const db = getDb();
    const filePath = exportFiadosToExcel(db);
    return { success: true, filePath };
  });

  ipcMain.handle('fiados:getExcelPath', () => {
    return getFiadosExcelPath();
  });

  // ── VENTAS ────────────────────────────────────────────────
  ipcMain.handle('ventas:crear', (_e, payload: VentaPayload) => {
    const db = getDb();

    const numero = `V${Date.now()}`;
    const ahora = new Date();
    const fecha = ahora.toISOString().split('T')[0];
    const hora = ahora.toTimeString().split(' ')[0];

    const subtotal = payload.items.reduce((s, i) => s + i.precio_unitario * i.cantidad, 0);
    const total = subtotal - payload.descuento;

    let ventaId: number;

    const sesionActiva = db.prepare(`SELECT id FROM caja_sesiones WHERE fecha_cierre IS NULL ORDER BY id DESC LIMIT 1`).get() as { id: number } | undefined;

    db.transaction(() => {
      const result = db.prepare(`
        INSERT INTO ventas (numero, tipo, estado, fecha, hora, cliente_id, vendedor_id,
          subtotal, descuento, total, metodo_pago, es_fiado, observaciones)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        numero,
        payload.tipo,
        payload.tipo === 'venta' ? (payload.es_fiado ? 'fiado' : 'completada') : 'abierto',
        fecha, hora,
        payload.cliente_id, payload.vendedor_id,
        subtotal, payload.descuento, total,
        payload.metodo_pago,
        payload.es_fiado ? 1 : 0,
        payload.observaciones
      );

      ventaId = result.lastInsertRowid as number;

      // Insertar ítems y descontar stock (solo si es venta real)
      for (const item of payload.items) {
        const itemTotal = item.precio_unitario * item.cantidad - item.descuento;
        db.prepare(`
          INSERT INTO venta_items (venta_id, producto_id, cantidad, precio_unitario, descuento, total)
          VALUES (?, ?, ?, ?, ?, ?)
        `).run(ventaId, item.producto_id, item.cantidad, item.precio_unitario, item.descuento, itemTotal);

        if (payload.tipo === 'venta') {
          const prodStock = db.prepare(`SELECT stock_actual FROM productos WHERE id = ?`).get(item.producto_id) as { stock_actual: number } | undefined;
          const stockPrevio = prodStock?.stock_actual ?? 0;
          const stockNuevo = stockPrevio - item.cantidad;
          db.prepare(`UPDATE productos SET stock_actual = stock_actual - ?, updated_at = datetime('now') WHERE id = ?`).run(item.cantidad, item.producto_id);
          db.prepare(`
            INSERT INTO stock_movimientos (producto_id, tipo, cantidad, motivo, venta_id, stock_previo, stock_nuevo)
            VALUES (?, 'salida', ?, ?, ?, ?, ?)
          `).run(item.producto_id, item.cantidad, payload.es_fiado ? `Fiado #${numero}` : `Venta #${numero}`, ventaId, stockPrevio, stockNuevo);
        }
      }

      // Registrar en caja
      if (payload.tipo === 'venta' && !payload.es_fiado && sesionActiva) {
        if (payload.metodos_pago_mixto && payload.metodos_pago_mixto.length > 0) {
          for (const mp of payload.metodos_pago_mixto) {
            db.prepare(`
              INSERT INTO caja_movimientos (sesion_id, tipo, monto, descripcion, metodo_pago, venta_id)
              VALUES (?, 'ingreso', ?, ?, ?, ?)
            `).run(sesionActiva.id, mp.monto, `Venta #${numero}`, mp.metodo, ventaId);
          }
        } else {
          db.prepare(`
            INSERT INTO caja_movimientos (sesion_id, tipo, monto, descripcion, metodo_pago, venta_id)
            VALUES (?, 'ingreso', ?, ?, ?, ?)
          `).run(sesionActiva.id, total, `Venta #${numero}`, payload.metodo_pago, ventaId);
        }
      }
    })();

    // Obtener venta completa para retornarla
    const ventaCompleta = db.prepare(`
      SELECT v.*, c.nombre as cliente_nombre
      FROM ventas v LEFT JOIN clientes c ON v.cliente_id = c.id
      WHERE v.id = ?
    `).get(ventaId!);

    // Emitir evento tiempo real
    emitToWeb('venta:nueva', { venta: ventaCompleta, total });

    // Notificar al renderer principal si es venta fiado (actualiza saldo en Clientes)
    if (payload.es_fiado && payload.cliente_id) {
      emitToWeb('fiados:list-changed', { clienteId: payload.cliente_id });
      BrowserWindow.getAllWindows().forEach((w) => {
        if (!w.isDestroyed()) {
          w.webContents.send('cliente:actualizado', { clienteId: payload.cliente_id });
          w.webContents.send('fiados:list-changed', { clienteId: payload.cliente_id });
        }
      });
      // Actualizar Excel de fiados automáticamente
      try { exportFiadosToExcel(db); } catch { /* silencioso */ }
    }

    return { id: ventaId!, numero, venta: ventaCompleta };
  });

  ipcMain.handle('ventas:getHistorico', (_e, filters?: { desde?: string; hasta?: string; tipo?: string; cliente_id?: number; vendedor_id?: number }) => {
    const db = getDb();
    let query = `
      SELECT v.*, c.nombre as cliente_nombre, u.nombre as vendedor_nombre,
        (SELECT COUNT(*) FROM venta_items vi WHERE vi.venta_id = v.id) as total_items
      FROM ventas v
      LEFT JOIN clientes c ON v.cliente_id = c.id
      LEFT JOIN usuarios u ON v.vendedor_id = u.id
      WHERE 1=1
    `;
    const params: unknown[] = [];

    if (filters?.desde) { query += ` AND v.fecha >= ?`; params.push(filters.desde); }
    if (filters?.hasta) { query += ` AND v.fecha <= ?`; params.push(filters.hasta); }
    if (filters?.tipo) { query += ` AND v.tipo = ?`; params.push(filters.tipo); }
    if (filters?.cliente_id) { query += ` AND v.cliente_id = ?`; params.push(filters.cliente_id); }
    if (filters?.vendedor_id) { query += ` AND v.vendedor_id = ?`; params.push(filters.vendedor_id); }

    query += ` ORDER BY v.created_at DESC LIMIT 500`;
    return db.prepare(query).all(...params);
  });

  ipcMain.handle('ventas:editar', (_e, ventaId: number, changes: {
    observaciones?: string;
    metodo_pago?: string;
    cliente_id?: number | null;
  }) => {
    const db = getDb();
    const venta = db.prepare('SELECT * FROM ventas WHERE id = ?').get(ventaId) as Record<string, unknown> | undefined;
    if (!venta) return { success: false, error: 'Venta no encontrada' };
    if (venta.estado === 'anulada') return { success: false, error: 'No se puede editar una venta anulada' };

    db.transaction(() => {
      const sets: string[] = [];
      const params: unknown[] = [];
      if (changes.observaciones !== undefined) { sets.push('observaciones = ?'); params.push(changes.observaciones); }
      if (changes.metodo_pago !== undefined) { sets.push('metodo_pago = ?'); params.push(changes.metodo_pago); }
      if ('cliente_id' in changes) { sets.push('cliente_id = ?'); params.push(changes.cliente_id ?? null); }
      if (sets.length > 0) {
        params.push(ventaId);
        db.prepare(`UPDATE ventas SET ${sets.join(', ')} WHERE id = ?`).run(...params);
      }
    })();

    return { success: true };
  });

  ipcMain.handle('ventas:getById', (_e, id: number) => {
    const db = getDb();
    const venta = db.prepare(`
      SELECT v.*, c.nombre as cliente_nombre, u.nombre as vendedor_nombre
      FROM ventas v
      LEFT JOIN clientes c ON v.cliente_id = c.id
      LEFT JOIN usuarios u ON v.vendedor_id = u.id
      WHERE v.id = ?
    `).get(id) as Record<string, unknown>;

    const items = db.prepare(`
      SELECT vi.*,
        p.nombre as producto_nombre,
        p.codigo as producto_codigo,
        p.precio_venta as precio_actual
      FROM venta_items vi
      LEFT JOIN productos p ON p.id = vi.producto_id
      WHERE vi.venta_id = ?
    `).all(id);

    return { ...venta, items };
  });

  ipcMain.handle('ventas:devolución', (_e, ventaId: number, items: { producto_id: number; cantidad: number }[]) => {
    const db = getDb();
    const ventaOriginal = db.prepare(`SELECT * FROM ventas WHERE id = ?`).get(ventaId) as { numero: string; total: number; cliente_id: number | null } | undefined;
    if (!ventaOriginal) return { success: false, error: 'Venta no encontrada' };

    const sesionActiva = db.prepare(`SELECT id FROM caja_sesiones WHERE fecha_cierre IS NULL ORDER BY id DESC LIMIT 1`).get() as { id: number } | undefined;

    const numero = `DEV${Date.now()}`;
    const ahora = new Date();

    db.transaction(() => {
      const total = items.reduce((s, i) => {
        const item = db.prepare(`SELECT precio_unitario FROM venta_items WHERE venta_id = ? AND producto_id = ?`).get(ventaId, i.producto_id) as { precio_unitario: number } | undefined;
        return s + (item?.precio_unitario || 0) * i.cantidad;
      }, 0);

      const devId = (db.prepare(`
        INSERT INTO ventas (numero, tipo, estado, fecha, hora, cliente_id, subtotal, total, metodo_pago, observaciones)
        VALUES (?, 'devolucion', 'completada', ?, ?, ?, ?, ?, 'efectivo', ?)
      `).run(numero, ahora.toISOString().split('T')[0], ahora.toTimeString().split(' ')[0], ventaOriginal.cliente_id, total, total, `Devolución de Venta #${ventaOriginal.numero}`) as { lastInsertRowid: number }).lastInsertRowid;

      for (const i of items) {
        const item = db.prepare(`SELECT * FROM venta_items WHERE venta_id = ? AND producto_id = ?`).get(ventaId, i.producto_id) as { precio_unitario: number } | undefined;
        db.prepare(`INSERT INTO venta_items (venta_id, producto_id, cantidad, precio_unitario, descuento, total) VALUES (?, ?, ?, ?, 0, ?)`).run(devId, i.producto_id, i.cantidad, item?.precio_unitario || 0, (item?.precio_unitario || 0) * i.cantidad);

        // Restaurar stock
        db.prepare(`UPDATE productos SET stock_actual = stock_actual + ?, updated_at = datetime('now') WHERE id = ?`).run(i.cantidad, i.producto_id);
        const prodStockDev = db.prepare(`SELECT stock_actual FROM productos WHERE id = ?`).get(i.producto_id) as { stock_actual: number } | undefined;
        const stockNuevoDev = prodStockDev?.stock_actual ?? 0;
        const stockPrevioDev = stockNuevoDev - i.cantidad;
        db.prepare(`INSERT INTO stock_movimientos (producto_id, tipo, cantidad, motivo, venta_id, stock_previo, stock_nuevo) VALUES (?, 'entrada', ?, ?, ?, ?, ?)`).run(i.producto_id, i.cantidad, `Devolución #${numero}`, devId, stockPrevioDev, stockNuevoDev);
      }

      // Egreso en caja
      if (sesionActiva) {
        db.prepare(`INSERT INTO caja_movimientos (sesion_id, tipo, monto, descripcion, metodo_pago, venta_id) VALUES (?, 'egreso', ?, ?, 'efectivo', ?)`).run(sesionActiva.id, total, `Devolución Venta #${ventaOriginal.numero}`, devId);
      }
    })();

    emitToWeb('stock:actualizado', {});
    return { success: true, numero };
  });

  ipcMain.handle('ventas:convertirPedido', (_e, pedidoId: number) => {
    const db = getDb();
    const pedido = db.prepare(`SELECT * FROM ventas WHERE id = ? AND tipo = 'pedido'`).get(pedidoId) as { id: number; numero: string; cliente_id: number | null; vendedor_id: number | null; subtotal: number; descuento: number; total: number; metodo_pago: string; observaciones: string } | undefined;
    if (!pedido) return { success: false };

    const items = db.prepare(`SELECT * FROM venta_items WHERE venta_id = ?`).all(pedidoId) as { producto_id: number; cantidad: number; precio_unitario: number; descuento: number }[];
    const sesionActiva = db.prepare(`SELECT id FROM caja_sesiones WHERE fecha_cierre IS NULL ORDER BY id DESC LIMIT 1`).get() as { id: number } | undefined;

    db.transaction(() => {
      db.prepare(`UPDATE ventas SET tipo = 'venta', estado = 'completada', fecha = date('now'), hora = time('now') WHERE id = ?`).run(pedidoId);
      for (const item of items) {
        const prodStockPedido = db.prepare(`SELECT stock_actual FROM productos WHERE id = ?`).get(item.producto_id) as { stock_actual: number } | undefined;
        const stockPrevioPedido = prodStockPedido?.stock_actual ?? 0;
        const stockNuevoPedido = stockPrevioPedido - item.cantidad;
        db.prepare(`UPDATE productos SET stock_actual = stock_actual - ?, updated_at = datetime('now') WHERE id = ?`).run(item.cantidad, item.producto_id);
        db.prepare(`INSERT INTO stock_movimientos (producto_id, tipo, cantidad, motivo, venta_id, stock_previo, stock_nuevo) VALUES (?, 'salida', ?, ?, ?, ?, ?)`).run(item.producto_id, item.cantidad, `Venta (desde pedido) #${pedido.numero}`, pedidoId, stockPrevioPedido, stockNuevoPedido);
      }
      if (sesionActiva) {
        db.prepare(`INSERT INTO caja_movimientos (sesion_id, tipo, monto, descripcion, metodo_pago, venta_id) VALUES (?, 'ingreso', ?, ?, ?, ?)`).run(sesionActiva.id, pedido.total, `Venta (desde pedido) #${pedido.numero}`, pedido.metodo_pago, pedidoId);
      }
    })();

    emitToWeb('venta:nueva', { id: pedidoId });
    return { success: true };
  });

  // ── STOCK ────────────────────────────────────────────────
  ipcMain.handle('stock:getMovimientos', (_e, productoId?: number) => {
    const db = getDb();
    let query = `
      SELECT sm.*, p.nombre as producto_nombre, p.codigo as producto_codigo
      FROM stock_movimientos sm
      LEFT JOIN productos p ON p.id = sm.producto_id
      WHERE 1=1
    `;
    const params: unknown[] = [];
    if (productoId) { query += ` AND sm.producto_id = ?`; params.push(productoId); }
    query += ` ORDER BY sm.fecha DESC LIMIT 200`;
    return db.prepare(query).all(...params);
  });

  ipcMain.handle('stock:ajuste', (_e, productoId: number, tipo: 'entrada' | 'salida' | 'ajuste', cantidad: number, motivo: string) => {
    const db = getDb();
    db.transaction(() => {
      const prod = db.prepare(`SELECT stock_actual FROM productos WHERE id = ?`).get(productoId) as { stock_actual: number } | undefined;
      const stockPrevio = prod?.stock_actual ?? 0;
      let stockNuevo: number;
      if (tipo === 'ajuste') {
        stockNuevo = cantidad;
        db.prepare(`UPDATE productos SET stock_actual = ?, updated_at = datetime('now') WHERE id = ?`).run(cantidad, productoId);
      } else if (tipo === 'entrada') {
        stockNuevo = stockPrevio + cantidad;
        db.prepare(`UPDATE productos SET stock_actual = stock_actual + ?, updated_at = datetime('now') WHERE id = ?`).run(cantidad, productoId);
      } else {
        stockNuevo = stockPrevio - cantidad;
        db.prepare(`UPDATE productos SET stock_actual = stock_actual - ?, updated_at = datetime('now') WHERE id = ?`).run(cantidad, productoId);
      }
      db.prepare(`INSERT INTO stock_movimientos (producto_id, tipo, cantidad, motivo, stock_previo, stock_nuevo) VALUES (?, ?, ?, ?, ?, ?)`).run(productoId, tipo, cantidad, motivo, stockPrevio, stockNuevo);
    })();

    emitToWeb('stock:actualizado', { productoId });
    return { success: true };
  });

  // ── CAJA ────────────────────────────────────────────────
  ipcMain.handle('caja:getSesionActiva', () => {
    const db = getDb();
    const sesion = db.prepare(`
      SELECT cs.*, u.nombre as usuario_nombre
      FROM caja_sesiones cs
      LEFT JOIN usuarios u ON cs.usuario_id = u.id
      WHERE cs.fecha_cierre IS NULL
      ORDER BY cs.id DESC LIMIT 1
    `).get() as { id: number; usuario_nombre?: string } | undefined;

    if (!sesion) return null;

    const totales = db.prepare(`
      SELECT
        COALESCE(SUM(CASE WHEN tipo = 'ingreso' AND venta_id IS NOT NULL THEN monto ELSE 0 END), 0) as total_ventas,
        COALESCE(SUM(CASE WHEN tipo = 'ingreso' AND venta_id IS NULL THEN monto ELSE 0 END), 0) as total_ingresos,
        COALESCE(SUM(CASE WHEN tipo = 'egreso' THEN monto ELSE 0 END), 0) as total_egresos,
        COALESCE(SUM(CASE WHEN tipo = 'ingreso' AND metodo_pago = 'efectivo' THEN monto ELSE 0 END), 0) as efectivo,
        COALESCE(SUM(CASE WHEN tipo = 'ingreso' AND metodo_pago = 'tarjeta' THEN monto ELSE 0 END), 0) as tarjeta,
        COALESCE(SUM(CASE WHEN tipo = 'ingreso' AND metodo_pago = 'transferencia' THEN monto ELSE 0 END), 0) as transferencia
      FROM caja_movimientos WHERE sesion_id = ?
    `).get((sesion as { id: number }).id);

    const sesionObj = sesion as Record<string, unknown>;
    return {
      ...sesionObj,
      ...(totales as Record<string, unknown>),
      saldo_inicial: sesionObj.monto_inicial,
      saldo_final: sesionObj.monto_final,
    };
  });

  ipcMain.handle('caja:abrir', (_e, montoInicial: number, usuarioId?: number) => {
    const db = getDb();
    const existente = db.prepare(`SELECT id FROM caja_sesiones WHERE fecha_cierre IS NULL`).get();
    if (existente) return { success: false, error: 'Ya hay una sesión de caja abierta' };

    const result = db.prepare(`INSERT INTO caja_sesiones (monto_inicial, usuario_id) VALUES (?, ?)`).run(montoInicial, usuarioId || null);
    emitToWeb('caja:movimiento', { tipo: 'apertura', monto: montoInicial });
    return { id: result.lastInsertRowid, success: true };
  });

  ipcMain.handle('caja:cerrar', (_e, sessionId: number, montoFinal: number, efectivoManual: number, tarjetasManual: number, transferenciasManual: number) => {
    const db = getDb();
    db.prepare(`UPDATE caja_sesiones SET fecha_cierre = datetime('now'), monto_final = ? WHERE id = ?`).run(montoFinal, sessionId);
    emitToWeb('caja:movimiento', { tipo: 'cierre', monto: montoFinal });

    // Sincronizar libro de caja del día con los montos ingresados manualmente
    try {
      const today = new Date().toISOString().split('T')[0];

      // Egresos desde movimientos de caja de la sesión
      const tots = db.prepare(`
        SELECT
          COALESCE(SUM(CASE WHEN tipo='egreso' THEN monto ELSE 0 END),0) as egresos
        FROM caja_movimientos WHERE sesion_id = ?
      `).get(sessionId) as { egresos: number };

      let dia = db.prepare(`SELECT id FROM libro_caja_dias WHERE fecha = ?`).get(today) as { id: number } | undefined;
      if (!dia) {
        const r = db.prepare(`INSERT INTO libro_caja_dias (fecha, cambio) VALUES (?, 1500)`).run(today);
        dia = { id: r.lastInsertRowid as number };
      }

      db.prepare(`
        UPDATE libro_caja_dias
        SET caja = ?, tarjetas = ?, transferencias = ?, egresos = ?, updated_at = datetime('now')
        WHERE id = ?
      `).run(efectivoManual, tarjetasManual, transferenciasManual, tots.egresos, dia.id);

      // Cerrar turno activo del libro si existe
      const turnoActivo = db.prepare(`
        SELECT id FROM libro_caja_turnos
        WHERE dia_id = ? AND fecha_cierre IS NULL
        ORDER BY numero DESC LIMIT 1
      `).get(dia.id) as { id: number } | undefined;
      if (turnoActivo) {
        db.prepare(`
          UPDATE libro_caja_turnos SET fecha_cierre = datetime('now'), monto_cierre = ? WHERE id = ?
        `).run(montoFinal, turnoActivo.id);
      }
    } catch (e) {
      console.error('[caja:cerrar] Error sincronizando libro de caja:', e);
    }

    return { success: true };
  });

  ipcMain.handle('caja:agregarMovimiento', (_e, data: { sesion_id: number; tipo: 'ingreso' | 'egreso'; monto: number; descripcion: string; metodo_pago: string }) => {
    const db = getDb();
    const result = db.prepare(`
      INSERT INTO caja_movimientos (sesion_id, tipo, monto, descripcion, metodo_pago)
      VALUES (?, ?, ?, ?, ?)
    `).run(data.sesion_id, data.tipo, data.monto, data.descripcion, data.metodo_pago);
    emitToWeb('caja:movimiento', data);
    return { id: result.lastInsertRowid };
  });

  ipcMain.handle('caja:getMovimientos', (_e, sesionId: number) => {
    const db = getDb();
    return db.prepare(`
      SELECT cm.*, v.numero as venta_numero
      FROM caja_movimientos cm
      LEFT JOIN ventas v ON v.id = cm.venta_id
      WHERE cm.sesion_id = ?
      ORDER BY cm.fecha DESC
    `).all(sesionId);
  });

  ipcMain.handle('caja:getHistorico', () => {
    const db = getDb();
    return db.prepare(`
      SELECT cs.*,
        cs.monto_inicial as saldo_inicial,
        cs.monto_final as saldo_final,
        u.nombre as usuario_nombre,
        (SELECT COALESCE(SUM(monto),0) FROM caja_movimientos WHERE sesion_id = cs.id AND tipo = 'ingreso' AND venta_id IS NOT NULL) as total_ventas,
        (SELECT COALESCE(SUM(monto),0) FROM caja_movimientos WHERE sesion_id = cs.id AND tipo = 'ingreso' AND venta_id IS NULL) as total_ingresos,
        (SELECT COALESCE(SUM(monto),0) FROM caja_movimientos WHERE sesion_id = cs.id AND tipo = 'egreso') as total_egresos
      FROM caja_sesiones cs
      LEFT JOIN usuarios u ON cs.usuario_id = u.id
      ORDER BY cs.id DESC LIMIT 50
    `).all();
  });

  // ── ESTADÍSTICAS ────────────────────────────────────────────────
  ipcMain.handle('stats:dashboard', () => {
    const db = getDb();
    const today = new Date().toISOString().split('T')[0];
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    const monthStart = new Date();
    monthStart.setDate(1);
    const monthStartStr = monthStart.toISOString().split('T')[0];
    const prevWeekStart = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    // Hoy — count y total
    const rowHoy = db.prepare(`
      SELECT COUNT(*) as count, COALESCE(SUM(total),0) as total
      FROM ventas WHERE fecha = ? AND tipo = 'venta'
    `).get(today) as { count: number; total: number };

    // Semana
    const rowSemana = db.prepare(`
      SELECT COUNT(*) as count, COALESCE(SUM(total),0) as total
      FROM ventas WHERE fecha >= ? AND tipo = 'venta'
    `).get(weekAgo) as { count: number; total: number };

    // Semana anterior (para comparación)
    const rowSemanaAnterior = db.prepare(`
      SELECT COALESCE(SUM(total),0) as total
      FROM ventas WHERE fecha >= ? AND fecha < ? AND tipo = 'venta'
    `).get(prevWeekStart, weekAgo) as { total: number };

    // Mes
    const rowMes = db.prepare(`
      SELECT COUNT(*) as count, COALESCE(SUM(total),0) as total
      FROM ventas WHERE fecha >= ? AND tipo = 'venta'
    `).get(monthStartStr) as { count: number; total: number };

    // Ticket promedio hoy
    const ticket_promedio_hoy = rowHoy.count > 0 ? rowHoy.total / rowHoy.count : 0;

    // Clientes nuevos este mes
    const clientes_nuevos_mes = (db.prepare(`
      SELECT COUNT(*) as c FROM clientes WHERE date(created_at) >= ?
    `).get(monthStartStr) as { c: number }).c;

    // Stock bajo mínimo
    const productos_bajo_stock = (db.prepare(`
      SELECT COUNT(*) as c FROM productos WHERE stock_actual <= stock_minimo AND activo = 1
    `).get() as { c: number }).c;

    // Fiado pendiente
    const fiado_total = (db.prepare(`
      SELECT COALESCE(SUM(total - COALESCE(monto_pagado,0)),0) as t
      FROM ventas WHERE es_fiado = 1 AND estado != 'pagado' AND tipo = 'venta'
    `).get() as { t: number }).t;

    // Ventas por día (últimos 30 días)
    const ventas_por_dia = db.prepare(`
      SELECT fecha, COALESCE(SUM(total),0) as total, COUNT(*) as cantidad
      FROM ventas
      WHERE tipo = 'venta' AND fecha >= date('now', '-30 days')
      GROUP BY fecha ORDER BY fecha
    `).all() as { fecha: string; total: number; cantidad: number }[];

    // Ventas por hora hoy
    const ventas_por_hora = db.prepare(`
      SELECT substr(hora,1,2) as hora, COUNT(*) as cantidad, COALESCE(SUM(total),0) as total
      FROM ventas
      WHERE tipo = 'venta' AND fecha = ?
      GROUP BY substr(hora,1,2) ORDER BY hora
    `).all(today) as { hora: string; cantidad: number; total: number }[];

    // Top 8 productos del mes
    const top_productos = db.prepare(`
      SELECT p.nombre, SUM(vi.cantidad) as cantidad, SUM(vi.total) as total
      FROM venta_items vi
      JOIN productos p ON p.id = vi.producto_id
      JOIN ventas v ON v.id = vi.venta_id
      WHERE v.tipo = 'venta' AND v.fecha >= ?
      GROUP BY vi.producto_id
      ORDER BY total DESC LIMIT 8
    `).all(monthStartStr) as { nombre: string; cantidad: number; total: number }[];

    // Ventas por método de pago (hoy)
    const ventas_por_metodo = db.prepare(`
      SELECT COALESCE(metodo_pago, 'efectivo') as metodo, COALESCE(SUM(total),0) as total, COUNT(*) as cantidad
      FROM ventas
      WHERE tipo = 'venta' AND fecha = ? AND es_fiado = 0
      GROUP BY metodo_pago
    `).all(today) as { metodo: string; total: number; cantidad: number }[];

    // Productos con stock bajo para alertas
    const alertas_stock = db.prepare(`
      SELECT nombre, stock_actual, stock_minimo
      FROM productos WHERE stock_actual <= stock_minimo AND activo = 1
      ORDER BY stock_actual ASC LIMIT 5
    `).all() as { nombre: string; stock_actual: number; stock_minimo: number }[];

    return {
      ventas_hoy: rowHoy.count,
      total_hoy: rowHoy.total,
      ventas_semana: rowSemana.count,
      total_semana: rowSemana.total,
      total_semana_anterior: rowSemanaAnterior.total,
      ventas_mes: rowMes.count,
      total_mes: rowMes.total,
      ticket_promedio_hoy,
      clientes_nuevos_mes,
      productos_bajo_stock,
      fiado_total,
      ventas_por_dia,
      ventas_por_hora,
      top_productos,
      ventas_por_metodo,
      alertas_stock,
    };
  });

  ipcMain.handle('stats:ventasPorPeriodo', (_e, desde: string, hasta: string) => {
    const db = getDb();
    return db.prepare(`
      SELECT fecha, COALESCE(SUM(total),0) as total, COUNT(*) as cantidad,
        COALESCE(SUM(CASE WHEN metodo_pago = 'efectivo' THEN total ELSE 0 END), 0) as efectivo,
        COALESCE(SUM(CASE WHEN metodo_pago = 'tarjeta' THEN total ELSE 0 END), 0) as tarjeta
      FROM ventas
      WHERE tipo = 'venta' AND fecha BETWEEN ? AND ?
      GROUP BY fecha ORDER BY fecha
    `).all(desde, hasta);
  });

  // ── CUENTAS A PAGAR ────────────────────────────────────────────────
  ipcMain.handle('cuentaspagar:getAll', () => {
    const db = getDb();
    return db.prepare(`SELECT * FROM cuentas_pagar ORDER BY vencimiento ASC`).all();
  });

  ipcMain.handle('cuentaspagar:create', (_e, data: Record<string, unknown>) => {
    const db = getDb();
    const result = db.prepare(`
      INSERT INTO cuentas_pagar (descripcion, proveedor, monto_total, monto_pagado, vencimiento, estado)
      VALUES (@descripcion, @proveedor, @monto_total, @monto_pagado, @vencimiento, @estado)
    `).run(data);
    return { id: result.lastInsertRowid };
  });

  ipcMain.handle('cuentaspagar:update', (_e, id: number, data: Record<string, unknown>) => {
    const db = getDb();
    const fields = Object.keys(data).map(k => `${k} = @${k}`).join(', ');
    db.prepare(`UPDATE cuentas_pagar SET ${fields} WHERE id = @id`).run({ ...data, id });
    return { success: true };
  });

  ipcMain.handle('cuentaspagar:delete', (_e, id: number) => {
    const db = getDb();
    db.prepare(`DELETE FROM cuentas_pagar WHERE id = ?`).run(id);
    return { success: true };
  });

  ipcMain.handle('cuentaspagar:pagar', (_e, id: number, monto: number) => {
    const db = getDb();
    const cuenta = db.prepare(`SELECT * FROM cuentas_pagar WHERE id = ?`).get(id) as { monto_total: number; monto_pagado: number } | undefined;
    if (!cuenta) return { success: false };

    const nuevoPagado = cuenta.monto_pagado + monto;
    const estado = nuevoPagado >= cuenta.monto_total ? 'pagado' : 'parcial';
    db.prepare(`UPDATE cuentas_pagar SET monto_pagado = ?, estado = ? WHERE id = ?`).run(nuevoPagado, estado, id);
    return { success: true };
  });

  // ── USUARIOS ────────────────────────────────────────────────
  ipcMain.handle('usuarios:getAll', () => {
    const db = getDb();
    return db.prepare(`SELECT id, nombre, rol, activo FROM usuarios ORDER BY nombre`).all();
  });

  ipcMain.handle('usuarios:login', (_e, pin: string) => {
    const db = getDb();
    const user = db.prepare(`SELECT id, nombre, rol, activo FROM usuarios WHERE pin = ? AND activo = 1`).get(pin);
    return user || null;
  });

  ipcMain.handle('usuarios:create', (_e, data: { nombre: string; pin: string; rol: string }) => {
    const db = getDb();
    const result = db.prepare(`INSERT INTO usuarios (nombre, pin, rol) VALUES (?, ?, ?)`).run(data.nombre, data.pin, data.rol);
    return { id: result.lastInsertRowid };
  });

  ipcMain.handle('usuarios:update', (_e, id: number, data: Record<string, unknown>) => {
    const db = getDb();
    const fields = Object.keys(data).map(k => `${k} = @${k}`).join(', ');
    db.prepare(`UPDATE usuarios SET ${fields} WHERE id = @id`).run({ ...data, id });
    return { success: true };
  });

  ipcMain.handle('usuarios:delete', (_e, id: number) => {
    const db = getDb();
    db.prepare(`UPDATE usuarios SET activo = 0 WHERE id = ?`).run(id);
    return { success: true };
  });

  // ── CONFIGURACIÓN ────────────────────────────────────────────────
  ipcMain.handle('config:getAll', () => {
    const db = getDb();
    const rows = db.prepare(`SELECT clave, valor FROM configuracion`).all() as { clave: string; valor: string }[];
    return Object.fromEntries(rows.map(r => [r.clave, r.valor]));
  });

  ipcMain.handle('config:set', (_e, clave: string, valor: string) => {
    const db = getDb();
    db.prepare(`INSERT OR REPLACE INTO configuracion (clave, valor) VALUES (?, ?)`).run(clave, valor);
    return { success: true };
  });

  ipcMain.handle('config:setMultiple', (_e, data: Record<string, string>) => {
    const db = getDb();
    const stmt = db.prepare(`INSERT OR REPLACE INTO configuracion (clave, valor) VALUES (?, ?)`);
    const setAll = db.transaction(() => {
      for (const [clave, valor] of Object.entries(data)) {
        stmt.run(clave, valor);
      }
    });
    setAll();
    return { success: true };
  });

  // ── FIRMA DEL PROPIETARIO ─────────────────────────────────────
  // Usa SHA-256 nativo de Node — la firma nunca se guarda en texto plano.
  ipcMain.handle('firma:estado', () => {
    const db = getDb();
    const row = db.prepare(`SELECT valor FROM configuracion WHERE clave = 'firma_hash'`).get() as { valor: string } | undefined;
    const nombre = (db.prepare(`SELECT valor FROM configuracion WHERE clave = 'firma_nombre'`).get() as { valor: string } | undefined)?.valor || '';
    const fecha = (db.prepare(`SELECT valor FROM configuracion WHERE clave = 'firma_fecha'`).get() as { valor: string } | undefined)?.valor || '';
    return { registrada: !!row, nombre, fecha };
  });

  ipcMain.handle('firma:registrar', (_e, nombre: string, clave: string) => {
    if (!nombre?.trim() || !clave?.trim()) return { success: false, error: 'Nombre y clave son obligatorios' };
    const db = getDb();
    const yaExiste = db.prepare(`SELECT valor FROM configuracion WHERE clave = 'firma_hash'`).get();
    if (yaExiste) return { success: false, error: 'Ya existe una firma registrada. Verificá la clave actual para cambiarla.' };
    const crypto = require('crypto') as typeof import('crypto');
    const hash = crypto.createHash('sha256').update(clave.trim()).digest('hex');
    const fecha = new Date().toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' });
    db.prepare(`INSERT OR REPLACE INTO configuracion (clave, valor) VALUES ('firma_hash', ?)`).run(hash);
    db.prepare(`INSERT OR REPLACE INTO configuracion (clave, valor) VALUES ('firma_nombre', ?)`).run(nombre.trim());
    db.prepare(`INSERT OR REPLACE INTO configuracion (clave, valor) VALUES ('firma_fecha', ?)`).run(fecha);
    return { success: true };
  });

  ipcMain.handle('firma:verificar', (_e, clave: string) => {
    const db = getDb();
    const row = db.prepare(`SELECT valor FROM configuracion WHERE clave = 'firma_hash'`).get() as { valor: string } | undefined;
    if (!row) return { valida: false };
    const crypto = require('crypto') as typeof import('crypto');
    const hash = crypto.createHash('sha256').update(clave.trim()).digest('hex');
    return { valida: hash === row.valor };
  });

  ipcMain.handle('firma:cambiar', (_e, claveActual: string, nuevaClave: string, nuevoNombre: string) => {
    const db = getDb();
    const row = db.prepare(`SELECT valor FROM configuracion WHERE clave = 'firma_hash'`).get() as { valor: string } | undefined;
    if (!row) return { success: false, error: 'No hay firma registrada' };
    const crypto = require('crypto') as typeof import('crypto');
    const hashActual = crypto.createHash('sha256').update(claveActual.trim()).digest('hex');
    if (hashActual !== row.valor) return { success: false, error: 'Clave actual incorrecta' };
    const nuevoHash = crypto.createHash('sha256').update(nuevaClave.trim()).digest('hex');
    const fecha = new Date().toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' });
    db.prepare(`INSERT OR REPLACE INTO configuracion (clave, valor) VALUES ('firma_hash', ?)`).run(nuevoHash);
    db.prepare(`INSERT OR REPLACE INTO configuracion (clave, valor) VALUES ('firma_nombre', ?)`).run((nuevoNombre || nuevoNombre).trim());
    db.prepare(`INSERT OR REPLACE INTO configuracion (clave, valor) VALUES ('firma_fecha', ?)`).run(fecha);
    return { success: true };
  });

  // ── BACKUP ────────────────────────────────────────────────
  ipcMain.handle('backup:list', () => listBackups());
  ipcMain.handle('backup:get-dir', () => getBackupsDir());
  ipcMain.handle('backup:create', async (_e, targetDir?: string) => {
    try {
      const backupPath = await manualBackup(targetDir);
      return { path: backupPath, success: true };
    } catch (err) {
      console.error('[Backup] Error al crear backup:', err);
      return { success: false, error: (err as Error).message };
    }
  });
  ipcMain.handle('backup:restore', async (_e, backupPath: string) => {
    await restoreBackup(backupPath);
    return { success: true };
  });
  ipcMain.handle('backup:autoBackup', async () => {
    const path = await autoBackup();
    return { path, success: true };
  });

  ipcMain.handle('db:repair', async () => {
    const db = getDb();
    // 1. Crear backup preventivo antes de cualquier operación
    let backupPath: string | null = null;
    try { backupPath = await autoBackup(); } catch { /* continuar aunque falle el backup */ }

    // 2. Verificar integridad
    const integrityRows = db.prepare('PRAGMA integrity_check').all() as { integrity_check: string }[];
    const isOk = integrityRows.length === 1 && integrityRows[0].integrity_check === 'ok';
    const integrityResult = integrityRows.map(r => r.integrity_check).join(', ');

    // 3. Reconstruir índices
    try { db.exec('REINDEX'); } catch (e) { /* continuar */ }

    // 4. Compactar base de datos
    try { db.exec('VACUUM'); } catch (e) { /* continuar */ }

    // 5. Reparar secuencias corruptas (sqlite_sequence)
    try {
      const tables = db.prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name != 'sqlite_sequence'`).all() as { name: string }[];
      for (const { name } of tables) {
        try {
          const row = db.prepare(`SELECT MAX(id) as mx FROM "${name}"`).get() as { mx: number | null } | undefined;
          if (row?.mx != null) {
            db.prepare(`INSERT OR REPLACE INTO sqlite_sequence (name, seq) VALUES (?, ?)`).run(name, row.mx);
          }
        } catch { /* tabla sin columna id, ignorar */ }
      }
    } catch { /* ignorar */ }

    return {
      success: true,
      integrityOk: isOk,
      integrityResult,
      backupPath,
      message: isOk
        ? 'Reparación completada. La base de datos está en buen estado.'
        : `Se detectaron problemas (${integrityResult}). Se aplicaron reparaciones. Si los problemas persisten, restaurá el último backup.`,
    };
  });

  ipcMain.handle('db:resetOperacional', async () => {
    const db = getDb();
    // Primero hacer backup de seguridad
    try { await autoBackup(); } catch { /* ignorar si falla backup */ }
    // Borrar todos los datos operacionales en orden (respetando FK)
    db.transaction(() => {
      db.prepare('DELETE FROM libro_caja_egresos').run();
      db.prepare('DELETE FROM libro_caja_billetes').run();
      db.prepare('DELETE FROM libro_caja_turnos').run();
      db.prepare('DELETE FROM libro_caja_dias').run();
      db.prepare('DELETE FROM caja_movimientos').run();
      db.prepare('DELETE FROM caja_sesiones').run();
      db.prepare('DELETE FROM venta_items').run();
      db.prepare('DELETE FROM stock_movimientos').run();
      db.prepare('DELETE FROM ventas').run();
      db.prepare('DELETE FROM cuentas_pagar').run();
      // Reiniciar contadores de auto-increment
      const tablasReset = [
        'ventas', 'venta_items', 'stock_movimientos',
        'caja_sesiones', 'caja_movimientos', 'cuentas_pagar',
        'libro_caja_dias', 'libro_caja_turnos', 'libro_caja_billetes', 'libro_caja_egresos',
      ];
      for (const tabla of tablasReset) {
        db.prepare('DELETE FROM sqlite_sequence WHERE name = ?').run(tabla);
      }
    })();
    return { success: true };
  });

  // ── EXPORT / IMPORT JSON ────────────────────────────────────────────────
  ipcMain.handle('export:allJSON', () => {
    const db = getDb();
    return {
      productos: db.prepare(`SELECT * FROM productos`).all(),
      categorias: db.prepare(`SELECT * FROM categorias`).all(),
      clientes: db.prepare(`SELECT * FROM clientes`).all(),
      ventas: db.prepare(`SELECT * FROM ventas`).all(),
      venta_items: db.prepare(`SELECT * FROM venta_items`).all(),
      stock_movimientos: db.prepare(`SELECT * FROM stock_movimientos`).all(),
      configuracion: db.prepare(`SELECT * FROM configuracion`).all(),
      exported_at: new Date().toISOString(),
    };
  });

  ipcMain.handle('import:fromJSON', (_e, jsonData: Record<string, unknown[]>) => {
    const db = getDb();
    let imported = 0;
    db.transaction(() => {
      if (Array.isArray(jsonData.categorias)) {
        for (const cat of jsonData.categorias as { nombre: string; color: string }[]) {
          db.prepare(`INSERT OR IGNORE INTO categorias (nombre, color) VALUES (?, ?)`).run(cat.nombre, cat.color);
          imported++;
        }
      }
      if (Array.isArray(jsonData.productos)) {
        for (const p of jsonData.productos as Record<string, unknown>[]) {
          db.prepare(`INSERT OR REPLACE INTO productos (codigo, nombre, precio_venta, precio_costo, stock_actual, unidad_medida, fraccionable, activo)
            VALUES (?, ?, ?, ?, ?, ?, ?, 1)`)
            .run(p.codigo, p.nombre, p.precio_venta, p.precio_costo, p.stock_actual, p.unidad_medida || 'unidad', p.fraccionable || 0);
          imported++;
        }
      }
      if (Array.isArray(jsonData.clientes)) {
        for (const c of jsonData.clientes as Record<string, unknown>[]) {
          db.prepare(`INSERT OR IGNORE INTO clientes (nombre, telefono, email, direccion, documento) VALUES (?, ?, ?, ?, ?)`)
            .run(c.nombre, c.telefono || '', c.email || '', c.direccion || '', c.documento || '');
          imported++;
        }
      }
    })();
    return { imported };
  });

  // ── IMAGEN PRODUCTO ────────────────────────────────────────────────
  ipcMain.handle('productos:saveImage', (_e, productoId: number, imageData: string) => {
    const imagesDir = path.join(app.getPath('userData'), 'images');
    if (!fs.existsSync(imagesDir)) fs.mkdirSync(imagesDir, { recursive: true });

    const filename = `producto_${productoId}_${Date.now()}.jpg`;
    const filepath = path.join(imagesDir, filename);

    const base64Data = imageData.replace(/^data:image\/\w+;base64,/, '');
    fs.writeFileSync(filepath, Buffer.from(base64Data, 'base64'));

    const db = getDb();
    db.prepare(`UPDATE productos SET imagen_path = ? WHERE id = ?`).run(filename, productoId);

    return { filename, success: true };
  });

  // ── RED LOCAL ────────────────────────────────────────────────
  ipcMain.handle('server:getLocalIP', () => {
    const { networkInterfaces } = require('os');
    const nets = networkInterfaces();
    for (const name of Object.keys(nets)) {
      for (const net of nets[name]) {
        if (net.family === 'IPv4' && !net.internal) {
          return net.address;
        }
      }
    }
    return 'localhost';
  });

  ipcMain.handle('server:getPort', () => {
    const db = getDb();
    const row = db.prepare(`SELECT valor FROM configuracion WHERE clave = 'puerto_servidor'`).get() as { valor: string } | undefined;
    return parseInt(row?.valor || '3001', 10);
  });

  // ── COMBOS ────────────────────────────────────────────────────────────────
  ipcMain.handle('combos:getAll', () => {
    const db = getDb();
    return db.prepare(`
      SELECT c.*,
        (SELECT COUNT(*) FROM combo_items ci WHERE ci.combo_id = c.id) as items_count
      FROM combos c
      ORDER BY c.nombre
    `).all();
  });

  ipcMain.handle('combos:getById', (_e, id: number) => {
    const db = getDb();
    const combo = db.prepare(`SELECT * FROM combos WHERE id = ?`).get(id);
    const items = db.prepare(`
      SELECT ci.*, p.nombre as producto_nombre, p.codigo as producto_codigo, p.precio_venta as precio_lista
      FROM combo_items ci
      JOIN productos p ON ci.producto_id = p.id
      WHERE ci.combo_id = ?
    `).all(id);
    return { ...combo as object, items };
  });

  ipcMain.handle('combos:create', (_e, data: { nombre: string; descripcion: string; precio: number; activo: boolean; items: { producto_id: number; cantidad: number; precio_unitario: number }[] }) => {
    const db = getDb();
    let newId = 0;
    db.transaction(() => {
      const result = db.prepare(`
        INSERT INTO combos (nombre, descripcion, precio, activo) VALUES (?, ?, ?, ?)
      `).run(data.nombre, data.descripcion || '', data.precio || 0, data.activo !== false ? 1 : 0);
      newId = result.lastInsertRowid as number;
      for (const item of data.items || []) {
        db.prepare(`INSERT INTO combo_items (combo_id, producto_id, cantidad, precio_unitario) VALUES (?, ?, ?, ?)`)
          .run(newId, item.producto_id, item.cantidad, item.precio_unitario);
      }
    })();
    return { id: newId };
  });

  ipcMain.handle('combos:update', (_e, id: number, data: { nombre: string; descripcion: string; precio: number; activo: boolean; items: { producto_id: number; cantidad: number; precio_unitario: number }[] }) => {
    const db = getDb();
    db.transaction(() => {
      db.prepare(`UPDATE combos SET nombre = ?, descripcion = ?, precio = ?, activo = ? WHERE id = ?`)
        .run(data.nombre, data.descripcion || '', data.precio || 0, data.activo !== false ? 1 : 0, id);
      db.prepare(`DELETE FROM combo_items WHERE combo_id = ?`).run(id);
      for (const item of data.items || []) {
        db.prepare(`INSERT INTO combo_items (combo_id, producto_id, cantidad, precio_unitario) VALUES (?, ?, ?, ?)`)
          .run(id, item.producto_id, item.cantidad, item.precio_unitario);
      }
    })();
    return { success: true };
  });

  ipcMain.handle('combos:delete', (_e, id: number) => {
    const db = getDb();
    db.prepare(`DELETE FROM combos WHERE id = ?`).run(id);
    return { success: true };
  });

  // ── LIBRO DE CAJA ────────────────────────────────────────────────

  ipcMain.handle('librocaja:getDia', (_e, fecha: string) => {
    const db = getDb();
    let dia = db.prepare(`SELECT * FROM libro_caja_dias WHERE fecha = ?`).get(fecha) as Record<string, unknown> | undefined;
    if (!dia) {
      const result = db.prepare(`
        INSERT INTO libro_caja_dias (fecha, cambio) VALUES (?, 1500)
      `).run(fecha);
      dia = db.prepare(`SELECT * FROM libro_caja_dias WHERE id = ?`).get(result.lastInsertRowid) as Record<string, unknown>;
    }
    const turnos = db.prepare(`SELECT * FROM libro_caja_turnos WHERE dia_id = ? ORDER BY numero`).all((dia as { id: number }).id);
    const billetes = db.prepare(`SELECT * FROM libro_caja_billetes WHERE dia_id = ? ORDER BY denominacion DESC`).all((dia as { id: number }).id);
    const egresos = db.prepare(`SELECT * FROM libro_caja_egresos WHERE dia_id = ? ORDER BY fecha DESC`).all((dia as { id: number }).id);
    return { dia, turnos, billetes, egresos };
  });

  ipcMain.handle('librocaja:getHistorico', (_e, periodo?: string) => {
    const db = getDb();
    if (periodo) {
      // Filtrar por mes (YYYY-MM)
      const desde = `${periodo}-01`;
      const hasta = `${periodo}-31`;
      const dias = db.prepare(`
        SELECT d.*,
          (SELECT COUNT(*) FROM libro_caja_turnos WHERE dia_id = d.id) as total_turnos,
          (SELECT COUNT(*) FROM libro_caja_turnos WHERE dia_id = d.id AND fecha_cierre IS NULL) as turnos_abiertos
        FROM libro_caja_dias d
        WHERE d.fecha BETWEEN ? AND ?
        ORDER BY d.fecha DESC
      `).all(desde, hasta);
      return dias;
    }
    // Sin periodo: devuelve el mes actual
    const now = new Date();
    const mesActual = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const desde = `${mesActual}-01`;
    const hasta = `${mesActual}-31`;
    const dias = db.prepare(`
      SELECT d.*,
        (SELECT COUNT(*) FROM libro_caja_turnos WHERE dia_id = d.id) as total_turnos,
        (SELECT COUNT(*) FROM libro_caja_turnos WHERE dia_id = d.id AND fecha_cierre IS NULL) as turnos_abiertos
      FROM libro_caja_dias d
      WHERE d.fecha BETWEEN ? AND ?
      ORDER BY d.fecha DESC
    `).all(desde, hasta);
    return dias;
  });

  ipcMain.handle('librocaja:getPeriodos', () => {
    const db = getDb();
    // Obtener periodos distintos de todos los días registrados
    const rows = db.prepare(`
      SELECT DISTINCT substr(fecha, 1, 7) as periodo
      FROM libro_caja_dias
      ORDER BY periodo DESC
    `).all() as { periodo: string }[];
    const periodos = rows.map(r => r.periodo);

    // Enriquecer con estado de libro_caja_periodos
    const estados = db.prepare(`SELECT periodo, estado, fecha_cierre FROM libro_caja_periodos`).all() as { periodo: string; estado: string; fecha_cierre: string | null }[];
    const estadoMap = new Map(estados.map(e => [e.periodo, e]));

    return periodos.map(p => ({
      periodo: p,
      estado: estadoMap.get(p)?.estado ?? 'abierto',
      fecha_cierre: estadoMap.get(p)?.fecha_cierre ?? null,
    }));
  });

  ipcMain.handle('librocaja:cerrarMes', (_e, periodo: string) => {
    const db = getDb();
    db.prepare(`
      INSERT INTO libro_caja_periodos (periodo, estado, fecha_cierre)
      VALUES (?, 'cerrado', datetime('now'))
      ON CONFLICT(periodo) DO UPDATE SET estado='cerrado', fecha_cierre=datetime('now')
    `).run(periodo);
    return { success: true };
  });

  ipcMain.handle('librocaja:reabrirMes', (_e, periodo: string) => {
    const db = getDb();
    db.prepare(`
      INSERT INTO libro_caja_periodos (periodo, estado)
      VALUES (?, 'abierto')
      ON CONFLICT(periodo) DO UPDATE SET estado='abierto', fecha_cierre=NULL
    `).run(periodo);
    return { success: true };
  });

  ipcMain.handle('librocaja:updateDia', (_e, fecha: string, data: Record<string, unknown>) => {
    const db = getDb();
    let dia = db.prepare(`SELECT * FROM libro_caja_dias WHERE fecha = ?`).get(fecha) as { id: number } | undefined;
    if (!dia) {
      const result = db.prepare(`INSERT INTO libro_caja_dias (fecha, cambio) VALUES (?, 1500)`).run(fecha);
      dia = { id: result.lastInsertRowid as number };
    }
    const allowed = ['libro', 'caja', 'egresos', 'tarjetas', 'cambio', 'transferencias', 'gastos_tarjeta', 'extra_caja', 'notas'];
    const filtered = Object.fromEntries(Object.entries(data).filter(([k]) => allowed.includes(k)));
    if (Object.keys(filtered).length === 0) return { success: true };
    const fields = Object.keys(filtered).map(k => `${k} = @${k}`).join(', ');
    db.prepare(`UPDATE libro_caja_dias SET ${fields}, updated_at = datetime('now') WHERE id = @id`).run({ ...filtered, id: dia.id });
    return { success: true };
  });

  ipcMain.handle('librocaja:syncFromVentas', (_e, fecha: string) => {
    const db = getDb();
    const tarjetas = (db.prepare(`
      SELECT COALESCE(SUM(total), 0) as total
      FROM ventas
      WHERE fecha = ? AND metodo_pago IN ('tarjeta','debito','credito') AND estado NOT IN ('cancelada','devolucion')
    `).get(fecha) as { total: number }).total;

    const transferencias = (db.prepare(`
      SELECT COALESCE(SUM(total), 0) as total
      FROM ventas
      WHERE fecha = ? AND metodo_pago IN ('transferencia','qr','mercadopago') AND estado NOT IN ('cancelada','devolucion')
    `).get(fecha) as { total: number }).total;

    let dia = db.prepare(`SELECT * FROM libro_caja_dias WHERE fecha = ?`).get(fecha) as { id: number } | undefined;
    if (!dia) {
      const result = db.prepare(`INSERT INTO libro_caja_dias (fecha, cambio) VALUES (?, 1500)`).run(fecha);
      dia = { id: result.lastInsertRowid as number };
    }
    db.prepare(`UPDATE libro_caja_dias SET tarjetas = ?, transferencias = ?, updated_at = datetime('now') WHERE id = ?`)
      .run(tarjetas, transferencias, dia.id);
    return { tarjetas, transferencias };
  });

  ipcMain.handle('librocaja:abrirTurno', (_e, fecha: string, data: { monto_apertura?: number; usuario_id?: number; notas?: string }) => {
    const db = getDb();
    let dia = db.prepare(`SELECT * FROM libro_caja_dias WHERE fecha = ?`).get(fecha) as { id: number } | undefined;
    if (!dia) {
      const result = db.prepare(`INSERT INTO libro_caja_dias (fecha, cambio) VALUES (?, 1500)`).run(fecha);
      dia = { id: result.lastInsertRowid as number };
    }
    const ultimo = db.prepare(`SELECT MAX(numero) as max_num FROM libro_caja_turnos WHERE dia_id = ?`).get(dia.id) as { max_num: number | null };
    const numero = (ultimo.max_num || 0) + 1;
    const result = db.prepare(`
      INSERT INTO libro_caja_turnos (dia_id, numero, monto_apertura, usuario_id, notas)
      VALUES (?, ?, ?, ?, ?)
    `).run(dia.id, numero, data.monto_apertura || 0, data.usuario_id || null, data.notas || '');
    return { id: result.lastInsertRowid, numero };
  });

  ipcMain.handle('librocaja:cerrarTurno', (_e, turnoId: number, data: { monto_cierre?: number; notas?: string }) => {
    const db = getDb();
    db.prepare(`
      UPDATE libro_caja_turnos
      SET fecha_cierre = datetime('now'), monto_cierre = ?, notas = ?
      WHERE id = ? AND fecha_cierre IS NULL
    `).run(data.monto_cierre || 0, data.notas || '', turnoId);
    return { success: true };
  });

  ipcMain.handle('librocaja:getTurnoActivo', (_e, fecha: string) => {
    const db = getDb();
    const dia = db.prepare(`SELECT id FROM libro_caja_dias WHERE fecha = ?`).get(fecha) as { id: number } | undefined;
    if (!dia) return null;
    return db.prepare(`SELECT * FROM libro_caja_turnos WHERE dia_id = ? AND fecha_cierre IS NULL ORDER BY numero DESC LIMIT 1`).get(dia.id) || null;
  });

  ipcMain.handle('librocaja:updateBilletes', (_e, fecha: string, billetes: { denominacion: number; cantidad: number }[]) => {
    const db = getDb();
    let dia = db.prepare(`SELECT id FROM libro_caja_dias WHERE fecha = ?`).get(fecha) as { id: number } | undefined;
    if (!dia) {
      const result = db.prepare(`INSERT INTO libro_caja_dias (fecha, cambio) VALUES (?, 1500)`).run(fecha);
      dia = { id: result.lastInsertRowid as number };
    }
    const upsert = db.prepare(`
      INSERT INTO libro_caja_billetes (dia_id, denominacion, cantidad)
      VALUES (?, ?, ?)
      ON CONFLICT(dia_id, denominacion) DO UPDATE SET cantidad = excluded.cantidad
    `);
    const upsertAll = db.transaction(() => {
      for (const b of billetes) {
        upsert.run(dia!.id, b.denominacion, b.cantidad);
      }
    });
    upsertAll();
    return { success: true };
  });

  ipcMain.handle('librocaja:addEgreso', (_e, fecha: string, data: { proveedor: string; monto: number; medio_pago?: string }) => {
    const db = getDb();
    let dia = db.prepare(`SELECT id FROM libro_caja_dias WHERE fecha = ?`).get(fecha) as { id: number } | undefined;
    if (!dia) {
      const result = db.prepare(`INSERT INTO libro_caja_dias (fecha, cambio) VALUES (?, 1500)`).run(fecha);
      dia = { id: result.lastInsertRowid as number };
    }
    const medioPago = data.medio_pago === 'transferencia' ? 'transferencia' : 'efectivo';
    const result = db.prepare(`
      INSERT INTO libro_caja_egresos (dia_id, proveedor, monto, medio_pago) VALUES (?, ?, ?, ?)
    `).run(dia.id, data.proveedor.trim(), data.monto, medioPago);

    // egresos solo acumula egresos en efectivo; transferencia afecta sus propios campos
    const totalEgresosEfectivo = (db.prepare(`
      SELECT COALESCE(SUM(monto), 0) as total FROM libro_caja_egresos WHERE dia_id = ? AND medio_pago = 'efectivo'
    `).get(dia.id) as { total: number }).total;

    if (medioPago === 'efectivo') {
      // Sumar en egresos y restar de extra_caja (Caja Grande)
      db.prepare(`UPDATE libro_caja_dias SET egresos = ?, extra_caja = MAX(0, COALESCE(extra_caja, 0) - ?), updated_at = datetime('now') WHERE id = ?`)
        .run(totalEgresosEfectivo, data.monto, dia.id);
    } else {
      // Restar de transferencias, sumar en gastos_tarjeta
      db.prepare(`UPDATE libro_caja_dias SET transferencias = MAX(0, COALESCE(transferencias, 0) - ?), gastos_tarjeta = COALESCE(gastos_tarjeta, 0) + ?, updated_at = datetime('now') WHERE id = ?`)
        .run(data.monto, data.monto, dia.id);
    }

    const updatedDia = db.prepare(`SELECT extra_caja, egresos, transferencias, gastos_tarjeta FROM libro_caja_dias WHERE id = ?`).get(dia.id) as { extra_caja: number; egresos: number; transferencias: number; gastos_tarjeta: number };
    return { id: result.lastInsertRowid, extra_caja: updatedDia.extra_caja, egresos: updatedDia.egresos, transferencias: updatedDia.transferencias, gastos_tarjeta: updatedDia.gastos_tarjeta };
  });

  ipcMain.handle('librocaja:removeEgreso', (_e, egresoId: number, fecha: string) => {
    const db = getDb();
    const dia = db.prepare(`SELECT id FROM libro_caja_dias WHERE fecha = ?`).get(fecha) as { id: number } | undefined;
    const egreso = db.prepare(`SELECT monto, medio_pago FROM libro_caja_egresos WHERE id = ?`).get(egresoId) as { monto: number; medio_pago: string } | undefined;
    db.prepare(`DELETE FROM libro_caja_egresos WHERE id = ?`).run(egresoId);
    if (dia && egreso) {
      if (egreso.medio_pago === 'efectivo') {
        // Restar de egresos y restaurar extra_caja (Caja Grande)
        const totalEfectivo = (db.prepare(`SELECT COALESCE(SUM(monto), 0) as total FROM libro_caja_egresos WHERE dia_id = ? AND medio_pago = 'efectivo'`).get(dia.id) as { total: number }).total;
        db.prepare(`UPDATE libro_caja_dias SET egresos = ?, extra_caja = COALESCE(extra_caja, 0) + ?, updated_at = datetime('now') WHERE id = ?`)
          .run(totalEfectivo, egreso.monto, dia.id);
      } else {
        // Devolver a transferencias, restar de gastos_tarjeta
        db.prepare(`UPDATE libro_caja_dias SET transferencias = COALESCE(transferencias, 0) + ?, gastos_tarjeta = MAX(0, COALESCE(gastos_tarjeta, 0) - ?), updated_at = datetime('now') WHERE id = ?`)
          .run(egreso.monto, egreso.monto, dia.id);
      }
    }
    return { success: true };
  });

  ipcMain.handle('librocaja:exportExcel', async (_e, desde: string, hasta: string) => {
    const db = getDb();
    let XLSX: typeof import('xlsx');
    try { XLSX = require('xlsx'); } catch { return { success: false, error: 'xlsx no disponible' }; }

    const dias = db.prepare(`
      SELECT * FROM libro_caja_dias WHERE fecha BETWEEN ? AND ? ORDER BY fecha
    `).all(desde, hasta) as Record<string, unknown>[];

    const rows = dias.map(d => {
      const totalEnCaja = (d.caja as number) + (d.cambio as number);
      return {
        'Fecha':           d.fecha,
        'Libro ($)':       d.libro,
        'Caja ($)':        d.caja,
        'Egresos ($)':     d.egresos,
        'Tarjetas ($)':    d.tarjetas,
        'Cambio ($)':      d.cambio,
        'Transferencias ($)': d.transferencias,
        'Gastos Tarjeta ($)': d.gastos_tarjeta,
        'Total en Caja ($)':  totalEnCaja,
        'Notas':           d.notas,
      };
    });

    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Libro de Caja');

    // Auto-size columns
    const colWidths = Object.keys(rows[0] || {}).map(key => ({ wch: Math.max(key.length, 12) }));
    ws['!cols'] = colWidths;

    const userDataPath = require('electron').app.getPath('userData');
    const exportDir = path.join(userDataPath, 'exports');
    if (!fs.existsSync(exportDir)) fs.mkdirSync(exportDir, { recursive: true });
    const fileName = `libro_caja_${desde}_${hasta}.xlsx`;
    const filePath = path.join(exportDir, fileName);
    XLSX.writeFile(wb, filePath);
    return { success: true, path: filePath };
  });

  // ── AUTH: validar PIN y permisos ────────────────────────────────────────
  ipcMain.handle('auth:validate-pin', (_e, pin: string) => {
    if (!pin?.trim()) return { ok: false, error: 'PIN vacío' };
    const db = getDb();
    const user = db.prepare(
      `SELECT id, nombre, rol, activo FROM usuarios WHERE pin = ? AND activo = 1`
    ).get(pin.trim()) as { id: number; nombre: string; rol: string; activo: number } | undefined;
    if (!user) return { ok: false, error: 'PIN incorrecto' };
    return { ok: true, user };
  });

  ipcMain.handle('auth:validate-admin', (_e, pin: string) => {
    if (!pin?.trim()) return { ok: false, error: 'PIN vacío' };
    const db = getDb();
    const user = db.prepare(
      `SELECT id, nombre, rol FROM usuarios WHERE pin = ? AND rol = 'admin' AND activo = 1`
    ).get(pin.trim()) as { id: number; nombre: string; rol: string } | undefined;
    if (!user) return { ok: false, error: 'PIN de administrador incorrecto' };
    return { ok: true, user };
  });

  ipcMain.handle('auth:get-users', () => {
    const db = getDb();
    return db.prepare(`SELECT id, nombre, rol, activo FROM usuarios ORDER BY rol DESC, nombre`).all();
  });

  ipcMain.handle('auth:create-user', (_e, data: { nombre: string; pin: string; rol: string }) => {
    if (!data.nombre?.trim() || !data.pin?.trim()) return { ok: false, error: 'Nombre y PIN son obligatorios' };
    const db = getDb();
    const exists = db.prepare(`SELECT id FROM usuarios WHERE pin = ? AND activo = 1`).get(data.pin.trim());
    if (exists) return { ok: false, error: 'Ya existe un usuario con ese PIN' };
    const result = db.prepare(
      `INSERT INTO usuarios (nombre, pin, rol, activo) VALUES (?, ?, ?, 1)`
    ).run(data.nombre.trim(), data.pin.trim(), data.rol || 'vendedor');
    return { ok: true, id: result.lastInsertRowid };
  });

  ipcMain.handle('auth:update-user', (_e, id: number, data: { nombre?: string; pin?: string; rol?: string; activo?: number }) => {
    const db = getDb();
    if (data.pin?.trim()) {
      const dup = db.prepare(`SELECT id FROM usuarios WHERE pin = ? AND id != ? AND activo = 1`).get(data.pin.trim(), id);
      if (dup) return { ok: false, error: 'Ya existe otro usuario con ese PIN' };
    }
    const allowed: Record<string, unknown> = {};
    if (data.nombre !== undefined) allowed.nombre = data.nombre.trim();
    if (data.pin !== undefined) allowed.pin = data.pin.trim();
    if (data.rol !== undefined) allowed.rol = data.rol;
    if (data.activo !== undefined) allowed.activo = data.activo;
    if (Object.keys(allowed).length === 0) return { ok: true };
    const fields = Object.keys(allowed).map(k => `${k} = @${k}`).join(', ');
    db.prepare(`UPDATE usuarios SET ${fields} WHERE id = @id`).run({ ...allowed, id });
    return { ok: true };
  });

  ipcMain.handle('auth:delete-user', (_e, id: number) => {
    const db = getDb();
    db.prepare(`UPDATE usuarios SET activo = 0 WHERE id = ?`).run(id);
    return { ok: true };
  });

  // ── NETWORK: escaneo LAN en busca de servidores ARIESPos ───────────────
  ipcMain.handle('network:scan', async (_e, port?: number) => {
    // Usar getAllLocalIPs() para obtener la subred real (filtra adaptadores virtuales)
    const realIPs = getAllLocalIPs();
    const baseIP = realIPs.length > 0
      ? realIPs[0].address.split('.').slice(0, 3).join('.')
      : null;

    if (!baseIP) return [];

    const targetPort = port ?? 3001;
    const timeout = 800;
    const concurrency = 30;
    const servers: { ip: string; port: number; nombre: string; version: string }[] = [];

    const checkIP = (ip: string): Promise<void> =>
      new Promise((resolve) => {
        const controller = new AbortController();
        const timer = setTimeout(() => { controller.abort(); resolve(); }, timeout);
        fetch(`http://${ip}:${targetPort}/api/ping`, { signal: controller.signal })
          .then(r => r.json())
          .then((data: unknown) => {
            clearTimeout(timer);
            const d = data as { status?: string; negocio?: string; nombre?: string; version?: string };
            if (d?.status === 'ok') {
              servers.push({ ip, port: targetPort, nombre: d.negocio || d.nombre || 'ARIESPos', version: d.version || '?' });
            }
            resolve();
          })
          .catch(() => { clearTimeout(timer); resolve(); });
      });

    const ips = Array.from({ length: 254 }, (_, i) => `${baseIP}.${i + 1}`);
    for (let i = 0; i < ips.length; i += concurrency) {
      await Promise.all(ips.slice(i, i + concurrency).map(checkIP));
    }

    return servers;
  });

  // ── NETWORK: obtener IP local ─────────────────────────────────────────
  ipcMain.handle('network:get-local-ip', () => {
    const ips = getAllLocalIPs();
    return ips.length > 0 ? ips[0].address : '127.0.0.1';
  });

  // ── NETWORK: obtener todas las IPs + puerto activo del servidor ──────────
  ipcMain.handle('network:server-info', () => {
    const ips = getAllLocalIPs();
    const port = getActivePort();
    return { ips, port };
  });

  // Nota: license:check y license:activate se registran en main.ts (nivel global)
  // para que funcionen tanto en modo servidor como en modo cliente.

  console.log('[IPC] Todos los handlers registrados.');
}
