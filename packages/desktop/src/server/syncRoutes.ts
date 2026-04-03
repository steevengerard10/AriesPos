/**
 * syncRoutes.ts
 *
 * Router Express con todos los endpoints /api/sync/* que el modo CLIENTE
 * necesita para operar contra la base de datos del servidor.
 *
 * Montado en server/index.ts como:
 *   expressApp.use('/api/sync', basicAuth, syncRouter(io, exportFiadosToExcel))
 */

import { Router, Request, Response } from 'express';
import { Server as SocketIOServer } from 'socket.io';
import { getDb } from '../database/db';
import { seedProductos } from '../services/seed-productos';

type EmitFn = (event: string, data: unknown) => void;
type ExportFiadosFn = (db: ReturnType<typeof getDb>) => string;

function boolToInt(v: unknown): number | unknown {
  return typeof v === 'boolean' ? (v ? 1 : 0) : v;
}

export function createSyncRouter(io: SocketIOServer, exportFiadosToExcel: ExportFiadosFn): Router {
  const router = Router();

  function emit(event: string, data: unknown): void {
    io.emit(event, data);
    // Notificar también al renderer local
    try {
      const { BrowserWindow } = require('electron');
      for (const win of (BrowserWindow.getAllWindows() as import('electron').BrowserWindow[])) {
        if (!win.isDestroyed()) win.webContents.send(event, data);
      }
    } catch { /* ignorar */ }
  }

  // ── ENDPOINT DE DETECCIÓN DE CAMBIOS (para polling de clientes) ────────────
  router.get('/last-changed', (_req, res) => {
    const db = getDb();
    const row = db.prepare(`
      SELECT MAX(updated_at) as ts
      FROM (
        SELECT MAX(updated_at) as updated_at FROM productos
        UNION ALL
        SELECT MAX(created_at) as updated_at FROM ventas
        UNION ALL
        SELECT MAX(updated_at) as updated_at FROM clientes
      )
    `).get() as { ts: string | null };
    res.json({ ts: row?.ts || new Date().toISOString() });
  });

  // ── PRODUCTOS ──────────────────────────────────────────────────────────────

  router.get('/productos', (req, res) => {
    const db = getDb();
    const { categoria, activo, search, stockBajo, limit = '200', offset = '0' } = req.query as Record<string, string>;

    let query = `
      SELECT p.*, c.nombre as categoria_nombre
      FROM productos p LEFT JOIN categorias c ON p.categoria_id = c.id
      WHERE 1=1
    `;
    const params: unknown[] = [];

    if (categoria) { query += ` AND p.categoria_id = ?`; params.push(parseInt(categoria)); }
    if (activo !== undefined) { query += ` AND p.activo = ?`; params.push(activo === 'true' ? 1 : 0); }
    else { query += ` AND p.activo = 1`; }
    if (search) {
      query += ` AND (p.nombre LIKE ? OR p.codigo LIKE ? OR p.codigo_barras LIKE ?)`;
      const s = `%${search}%`;
      params.push(s, s, s);
    }
    if (stockBajo === 'true') { query += ` AND p.stock_actual <= p.stock_minimo`; }

    const total = (db.prepare(`SELECT COUNT(*) as c FROM (${query})`).get(...params) as { c: number }).c;

    query += ` ORDER BY p.nombre LIMIT ? OFFSET ?`;
    params.push(parseInt(limit), parseInt(offset));
    const rows = db.prepare(query).all(...params);

    res.json({ rows, total, limit: parseInt(limit), offset: parseInt(offset) });
  });

  router.get('/productos/search', (req, res) => {
    const db = getDb();
    const q = String(req.query.q || '');
    if (!q) { res.json([]); return; }
    const s = `%${q}%`;
    const rows = db.prepare(`
      SELECT p.*, c.nombre as categoria_nombre
      FROM productos p LEFT JOIN categorias c ON p.categoria_id = c.id
      WHERE p.activo = 1 AND (p.nombre LIKE ? OR p.codigo LIKE ? OR p.codigo_barras LIKE ?)
      ORDER BY
        CASE WHEN p.codigo_barras = ? THEN 0
             WHEN LOWER(p.codigo) = LOWER(?) THEN 1
             WHEN LOWER(p.nombre) LIKE ? THEN 2
             ELSE 3 END, p.nombre ASC
      LIMIT 20
    `).all(s, s, s, q, q, q + '%');
    res.json(rows);
  });

  router.get('/productos/barcode/:code', (req, res) => {
    const db = getDb();
    const code = req.params.code;
    const p = db.prepare(`SELECT p.*, c.nombre as categoria_nombre FROM productos p LEFT JOIN categorias c ON p.categoria_id = c.id WHERE p.codigo_barras = ? AND p.activo = 1`).get(code)
      || db.prepare(`SELECT p.*, c.nombre as categoria_nombre FROM productos p LEFT JOIN categorias c ON p.categoria_id = c.id WHERE p.codigo = ? AND p.activo = 1`).get(code);
    res.json(p || null);
  });
  // Endpoint para polling de sincronización: devuelve el updated_at más reciente de productos
  router.get('/productos/last-update', (_req, res) => {
    const db = getDb();
    const row = db.prepare(`SELECT MAX(updated_at) as ts FROM productos`).get() as { ts: string | null };
    res.json({ ts: row.ts || new Date(0).toISOString() });
  });
  router.get('/productos/:id', (req, res) => {
    const db = getDb();
    const p = db.prepare(`SELECT p.*, c.nombre as categoria_nombre FROM productos p LEFT JOIN categorias c ON p.categoria_id = c.id WHERE p.id = ?`).get(parseInt(req.params.id));
    if (!p) { res.status(404).json({ error: 'Producto no encontrado' }); return; }
    res.json(p);
  });

  router.post('/productos', (req: Request, res: Response) => {
    const db = getDb();
    const data = req.body as Record<string, unknown>;
    const clean = {
      marca: '', proveedor: '', codigo: '', codigo_barras: '', nombre: '', categoria_id: null,
      precio_costo: 0, precio_venta: 0, precio2: 0, precio3: 0,
      stock_actual: 0, stock_minimo: 0, unidad_medida: 'unidad', imagen_path: null,
      ...data,
      fraccionable: boolToInt(data.fraccionable ?? false),
      en_catalogo: boolToInt(data.en_catalogo ?? false),
      activo: boolToInt(data.activo ?? true),
    };
    const result = db.prepare(`
      INSERT INTO productos (codigo, codigo_barras, nombre, categoria_id, precio_costo, precio_venta, precio2, precio3,
        stock_actual, stock_minimo, unidad_medida, fraccionable, en_catalogo, imagen_path, activo, marca, proveedor)
      VALUES (@codigo, @codigo_barras, @nombre, @categoria_id, @precio_costo, @precio_venta, @precio2, @precio3,
        @stock_actual, @stock_minimo, @unidad_medida, @fraccionable, @en_catalogo, @imagen_path, @activo, @marca, @proveedor)
    `).run(clean);
    emit('producto:actualizado', { id: result.lastInsertRowid });
    res.json({ id: result.lastInsertRowid });
  });

  router.put('/productos/:id', (req: Request, res: Response) => {
    const db = getDb();
    const id = parseInt(req.params.id);
    const data = req.body as Record<string, unknown>;
    const allowed = ['nombre','codigo','codigo_barras','categoria_id','precio_costo','precio_venta',
      'precio2','precio3','stock_actual','stock_minimo','unidad_medida','fraccionable',
      'en_catalogo','imagen_path','activo','marca','proveedor'];
    const filtered = Object.fromEntries(
      Object.entries(data)
        .filter(([k]) => allowed.includes(k))
        .map(([k, v]) => [k, ['fraccionable','en_catalogo','activo'].includes(k) ? boolToInt(v) : v])
    );
    if (Object.keys(filtered).length === 0) { res.json({ success: true }); return; }
    const fields = Object.keys(filtered).map(k => `${k} = @${k}`).join(', ');
    db.prepare(`UPDATE productos SET ${fields}, updated_at = datetime('now') WHERE id = @id`).run({ ...filtered, id });
    emit('producto:actualizado', { id });
    res.json({ success: true });
  });

  router.delete('/productos/all', (_req, res) => {
    const db = getDb();
    db.transaction(() => {
      db.prepare(`DELETE FROM stock_movimientos`).run();
      db.prepare(`DELETE FROM venta_items`).run();
      db.prepare(`DELETE FROM productos`).run();
      db.prepare(`DELETE FROM categorias`).run();
      db.prepare(`DELETE FROM sqlite_sequence WHERE name IN ('productos','categorias','stock_movimientos','venta_items')`).run();
    })();
    emit('producto:actualizado', { reload: true });
    res.json({ success: true });
  });

  router.post('/productos/delete-many', (req, res) => {
    const { ids } = req.body as { ids: number[] };
    if (!ids || ids.length === 0) { res.json({ deleted: 0 }); return; }
    const db = getDb();
    const placeholders = ids.map(() => '?').join(',');
    const result = db.prepare(`DELETE FROM productos WHERE id IN (${placeholders})`).run(...ids);
    emit('producto:actualizado', { reload: true });
    res.json({ deleted: result.changes });
  });

  router.post('/productos/limpiar-basura', (_req, res) => {
    const db = getDb();
    const { validateProductName } = require('../services/nextar-importer/language-detector');
    type ValidationResult = { isValid: boolean; language: string; reason?: string };

    const PLACEHOLDERS = new Set([
      'sin nombre', 'sin descripcion', 'sin desc', 'producto',
      'undefined', 'null', 'n/a', 'na',
    ]);

    const todos = db.prepare(`SELECT id, nombre FROM productos`).all() as { id: number; nombre: string }[];
    const basura: number[] = [];
    let eliminadosPt = 0, eliminadosEn = 0, eliminadosBasura = 0;

    for (const p of todos) {
      const n = (p.nombre || '').trim();
      if (PLACEHOLDERS.has(n.toLowerCase())) { basura.push(p.id); eliminadosBasura++; continue; }
      const result: ValidationResult = validateProductName(n);
      if (!result.isValid) {
        basura.push(p.id);
        if (result.language === 'pt') eliminadosPt++;
        else if (result.language === 'en') eliminadosEn++;
        else eliminadosBasura++;
      }
    }

    if (basura.length > 0) {
      const CHUNK = 500;
      db.transaction(() => {
        for (let i = 0; i < basura.length; i += CHUNK) {
          const chunk = basura.slice(i, i + CHUNK);
          const placeholders = chunk.map(() => '?').join(',');
          db.prepare(`DELETE FROM productos WHERE id IN (${placeholders})`).run(...chunk);
        }
      })();
      emit('producto:actualizado', { reload: true });
    }
    res.json({ deleted: basura.length, pt: eliminadosPt, en: eliminadosEn, basura: eliminadosBasura });
  });

  router.post('/productos/seed', (_req, res) => {
    const db = getDb();
    let inserted = 0;
    db.transaction(() => {
      for (const item of seedProductos) {
        let catId: number | null = null;
        const cat = db.prepare(`SELECT id FROM categorias WHERE lower(nombre)=lower(?)`).get(item.categoria) as { id: number } | undefined;
        if (cat) {
          catId = cat.id;
        } else {
          const r = db.prepare(`INSERT OR IGNORE INTO categorias (nombre, color) VALUES (?,?)`).run(item.categoria, '#6366f1');
          catId = r.lastInsertRowid as number || null;
        }
        const exists = db.prepare(`SELECT id FROM productos WHERE lower(nombre)=lower(?)`).get(item.nombre);
        if (!exists) {
          db.prepare(`INSERT INTO productos (nombre, codigo, codigo_barras, categoria_id, precio_venta, precio_costo, precio2, precio3, stock_actual, stock_minimo, unidad_medida, fraccionable, en_catalogo, activo, marca, proveedor) VALUES (?,?,?,?,?,0,0,0,0,0,?,0,1,1,?,'')`).run(
            item.nombre, item.codigo_barras || '', item.codigo_barras || '',
            catId, item.precio_venta, item.unidad_medida || 'unidad', item.marca || '',
          );
          inserted++;
        }
      }
    })();
    emit('producto:actualizado', { reload: true });
    res.json({ inserted });
  });

  router.delete('/productos/:id', (req, res) => {
    const db = getDb();
    db.prepare(`UPDATE productos SET activo = 0 WHERE id = ?`).run(parseInt(req.params.id));
    res.json({ success: true });
  });

  router.post('/productos/import-csv', (req: Request, res: Response) => {
    // CSV import — solo disponible en servidor
    res.status(400).json({ error: 'Import CSV debe realizarse desde el servidor' });
  });

  router.post('/productos/:id/imagen', (req: Request, res: Response) => {
    // Image save — solo disponible en servidor (necesita filesystem local)
    res.status(400).json({ error: 'Subir imagen solo disponible en servidor' });
  });

  // ── CATEGORIAS ──────────────────────────────────────────────────────────────

  router.get('/categorias', (_req, res) => {
    res.json(getDb().prepare(`SELECT * FROM categorias ORDER BY nombre`).all());
  });

  router.post('/categorias', (req: Request, res: Response) => {
    const db = getDb();
    const { nombre, color = '#64748b' } = req.body as { nombre: string; color?: string };
    if (!nombre) { res.status(400).json({ error: 'nombre requerido' }); return; }
    const result = db.prepare(`INSERT INTO categorias (nombre, color) VALUES (?, ?)`).run(nombre, color);
    res.json({ id: result.lastInsertRowid });
  });

  router.put('/categorias/:id', (req: Request, res: Response) => {
    const db = getDb();
    const { nombre, color } = req.body as { nombre: string; color: string };
    db.prepare(`UPDATE categorias SET nombre = ?, color = ? WHERE id = ?`).run(nombre, color, parseInt(req.params.id));
    res.json({ success: true });
  });

  router.delete('/categorias/:id', (req, res) => {
    const db = getDb();
    const id = parseInt(req.params.id);
    db.prepare(`UPDATE productos SET categoria_id = NULL WHERE categoria_id = ?`).run(id);
    db.prepare(`DELETE FROM categorias WHERE id = ?`).run(id);
    res.json({ success: true });
  });

  // ── CLIENTES ──────────────────────────────────────────────────────────────

  router.get('/clientes', (req, res) => {
    const db = getDb();
    const { search } = req.query as { search?: string };
    let query = `
      SELECT c.*,
        COALESCE((
          SELECT SUM(MAX(0,
            COALESCE((
              SELECT SUM(CASE WHEN p.precio_venta > 0 THEN p.precio_venta ELSE vi.precio_unitario END * vi.cantidad)
                - COALESCE(vf.descuento, 0)
              FROM venta_items vi LEFT JOIN productos p ON p.id = vi.producto_id
              WHERE vi.venta_id = vf.id
            ), vf.total) - COALESCE(vf.monto_pagado, 0)
          ))
          FROM ventas vf
          WHERE vf.cliente_id = c.id AND vf.es_fiado = 1 AND vf.estado NOT IN ('pagado')
        ), 0) as saldo_pendiente
      FROM clientes c WHERE 1=1
    `;
    const params: unknown[] = [];
    if (search) {
      query += ` AND (c.nombre LIKE ? OR c.telefono LIKE ? OR c.documento LIKE ?)`;
      const s = `%${search}%`;
      params.push(s, s, s);
    }
    query += ` ORDER BY c.nombre`;
    res.json(db.prepare(query).all(...params));
  });

  router.get('/clientes/export-csv', (_req, res) => {
    const db = getDb();
    const clientes = db.prepare(`SELECT * FROM clientes ORDER BY nombre`).all() as Record<string, unknown>[];
    const headers = ['id','nombre','apellido','telefono','email','direccion','documento','limite_credito','created_at'];
    const csv = [headers.join(','),
      ...clientes.map(c => headers.map(h => `"${String(c[h] ?? '').replace(/"/g, '""')}"`).join(','))
    ].join('\n');
    res.setHeader('Content-Type', 'text/csv');
    res.send(csv);
  });

  router.get('/clientes/:id/saldo', (req, res) => {
    const db = getDb();
    const clienteId = parseInt(req.params.id);
    const ventas = db.prepare(`
      SELECT v.id, COALESCE(v.descuento,0) as descuento, COALESCE(v.monto_pagado,0) as monto_pagado, v.total as total_historico
      FROM ventas v
      WHERE v.cliente_id = ? AND v.es_fiado = 1 AND v.estado NOT IN ('pagado')
    `).all(clienteId) as { id: number; descuento: number; monto_pagado: number; total_historico: number }[];

    let saldo = 0;
    for (const v of ventas) {
      const items = db.prepare(`
        SELECT vi.cantidad, CASE WHEN p.precio_venta > 0 THEN p.precio_venta ELSE vi.precio_unitario END as precio_actual
        FROM venta_items vi LEFT JOIN productos p ON p.id = vi.producto_id WHERE vi.venta_id = ?
      `).all(v.id) as { cantidad: number; precio_actual: number }[];
      if (!items.length) { saldo += Math.max(0, v.total_historico - v.monto_pagado); continue; }
      const subtotal = items.reduce((s, i) => s + i.precio_actual * i.cantidad, 0);
      saldo += Math.max(0, subtotal - v.descuento - v.monto_pagado);
    }
    res.json(saldo);
  });

  router.get('/clientes/:id/ventas', (req, res) => {
    const db = getDb();
    res.json(db.prepare(`
      SELECT v.*, GROUP_CONCAT(p.nombre, ', ') as productos_nombres
      FROM ventas v
      LEFT JOIN venta_items vi ON vi.venta_id = v.id
      LEFT JOIN productos p ON p.id = vi.producto_id
      WHERE v.cliente_id = ?
      GROUP BY v.id ORDER BY v.created_at DESC
    `).all(parseInt(req.params.id)));
  });

  router.get('/clientes/:id', (req, res) => {
    const db = getDb();
    const c = db.prepare(`SELECT * FROM clientes WHERE id = ?`).get(parseInt(req.params.id));
    if (!c) { res.status(404).json({ error: 'Cliente no encontrado' }); return; }
    res.json(c);
  });

  router.post('/clientes', (req: Request, res: Response) => {
    const db = getDb();
    const data = { nombre: '', apellido: '', telefono: '', email: '', direccion: '', documento: '', limite_credito: 0, ...req.body as Record<string, unknown> };
    const result = db.prepare(`
      INSERT INTO clientes (nombre, apellido, telefono, email, direccion, documento, limite_credito)
      VALUES (@nombre, @apellido, @telefono, @email, @direccion, @documento, @limite_credito)
    `).run(data);
    res.json({ id: result.lastInsertRowid });
  });

  router.put('/clientes/:id', (req: Request, res: Response) => {
    const db = getDb();
    const id = parseInt(req.params.id);
    const allowed = ['nombre','apellido','telefono','email','direccion','documento','limite_credito','activo'];
    const filtered = Object.fromEntries(Object.entries(req.body as Record<string, unknown>).filter(([k]) => allowed.includes(k)));
    if (!Object.keys(filtered).length) { res.json({ success: true }); return; }
    const fields = Object.keys(filtered).map(k => `${k} = @${k}`).join(', ');
    db.prepare(`UPDATE clientes SET ${fields} WHERE id = @id`).run({ ...filtered, id });
    res.json({ success: true });
  });

  router.delete('/clientes/:id', (req, res) => {
    getDb().prepare(`DELETE FROM clientes WHERE id = ?`).run(parseInt(req.params.id));
    res.json({ success: true });
  });

  router.post('/clientes/:id/pagar-fiado', (req: Request, res: Response) => {
    const db = getDb();
    const clienteId = parseInt(req.params.id);
    const { monto, metodo = 'efectivo' } = req.body as { monto: number; metodo?: string };

    const ventas = db.prepare(`
      SELECT id, total, COALESCE(descuento,0) as descuento, COALESCE(monto_pagado,0) as monto_pagado
      FROM ventas WHERE cliente_id = ? AND es_fiado = 1 AND estado NOT IN ('pagado') ORDER BY id ASC
    `).all(clienteId) as { id: number; total: number; descuento: number; monto_pagado: number }[];

    if (!ventas.length) { res.status(400).json({ success: false, error: 'Sin fiados pendientes' }); return; }

    const sesion = db.prepare(`SELECT id FROM caja_sesiones WHERE fecha_cierre IS NULL ORDER BY id DESC LIMIT 1`).get() as { id: number } | undefined;

    db.transaction(() => {
      let restante = monto;
      for (const v of ventas) {
        if (restante <= 0) break;
        const items = db.prepare(`
          SELECT vi.cantidad, CASE WHEN p.precio_venta > 0 THEN p.precio_venta ELSE vi.precio_unitario END as precio_actual
          FROM venta_items vi LEFT JOIN productos p ON p.id = vi.producto_id WHERE vi.venta_id = ?
        `).all(v.id) as { cantidad: number; precio_actual: number }[];
        const subtotal = items.length
          ? items.reduce((s, i) => s + i.precio_actual * i.cantidad, 0)
          : v.total;
        const saldo = Math.max(0, subtotal - v.descuento - v.monto_pagado);
        if (saldo <= 0) continue;
        if (restante >= saldo) {
          db.prepare(`UPDATE ventas SET estado = 'pagado', monto_pagado = ? WHERE id = ?`).run(v.monto_pagado + saldo, v.id);
          restante -= saldo;
        } else {
          db.prepare(`UPDATE ventas SET estado = 'parcial', monto_pagado = ? WHERE id = ?`).run(v.monto_pagado + restante, v.id);
          restante = 0;
        }
      }
      if (sesion) {
        db.prepare(`INSERT INTO caja_movimientos (sesion_id, tipo, monto, descripcion, metodo_pago) VALUES (?, 'ingreso', ?, ?, ?)`).run(sesion.id, monto, `Pago fiado - Cliente #${clienteId}`, metodo);
      }
    })();

    try { exportFiadosToExcel(db); } catch { /* silencioso */ }
    emit('fiados:list-changed', { clienteId });
    res.json({ success: true });
  });

  // ── VENTAS ──────────────────────────────────────────────────────────────

  router.get('/ventas/historico', (req, res) => {
    const db = getDb();
    const { desde, hasta, tipo, cliente_id, vendedor_id } = req.query as Record<string, string>;
    let query = `
      SELECT v.*, c.nombre as cliente_nombre, u.nombre as vendedor_nombre,
        (SELECT COUNT(*) FROM venta_items vi WHERE vi.venta_id = v.id) as total_items
      FROM ventas v
      LEFT JOIN clientes c ON v.cliente_id = c.id
      LEFT JOIN usuarios u ON v.vendedor_id = u.id
      WHERE 1=1
    `;
    const params: unknown[] = [];
    if (desde) { query += ` AND v.fecha >= ?`; params.push(desde); }
    if (hasta) { query += ` AND v.fecha <= ?`; params.push(hasta); }
    if (tipo) { query += ` AND v.tipo = ?`; params.push(tipo); }
    if (cliente_id) { query += ` AND v.cliente_id = ?`; params.push(parseInt(cliente_id)); }
    if (vendedor_id) { query += ` AND v.vendedor_id = ?`; params.push(parseInt(vendedor_id)); }
    query += ` ORDER BY v.created_at DESC LIMIT 500`;
    res.json(db.prepare(query).all(...params));
  });

  router.get('/ventas/:id', (req, res) => {
    const db = getDb();
    const id = parseInt(req.params.id);
    const venta = db.prepare(`
      SELECT v.*, c.nombre as cliente_nombre, u.nombre as vendedor_nombre
      FROM ventas v LEFT JOIN clientes c ON v.cliente_id = c.id
      LEFT JOIN usuarios u ON v.vendedor_id = u.id WHERE v.id = ?
    `).get(id) as Record<string, unknown>;
    if (!venta) { res.status(404).json({ error: 'Venta no encontrada' }); return; }
    const items = db.prepare(`
      SELECT vi.*, p.nombre as producto_nombre, p.codigo as producto_codigo,
        p.precio_venta as precio_actual
      FROM venta_items vi
      LEFT JOIN productos p ON p.id = vi.producto_id
      WHERE vi.venta_id = ?
    `).all(id);
    res.json({ ...venta, items });
  });

  router.put('/ventas/:id', (req: Request, res: Response) => {
    const db = getDb();
    const id = parseInt(req.params.id);
    const changes = req.body as { observaciones?: string; metodo_pago?: string; cliente_id?: number | null };
    const sets: string[] = [];
    const params: unknown[] = [];
    if (changes.observaciones !== undefined) { sets.push('observaciones = ?'); params.push(changes.observaciones); }
    if (changes.metodo_pago !== undefined) { sets.push('metodo_pago = ?'); params.push(changes.metodo_pago); }
    if ('cliente_id' in changes) { sets.push('cliente_id = ?'); params.push(changes.cliente_id ?? null); }
    if (sets.length) {
      params.push(id);
      db.prepare(`UPDATE ventas SET ${sets.join(', ')} WHERE id = ?`).run(...params);
    }
    res.json({ success: true });
  });

  router.post('/ventas/:id/devolucion', (req: Request, res: Response) => {
    const db = getDb();
    const ventaId = parseInt(req.params.id);
    const { items } = req.body as { items: { producto_id: number; cantidad: number }[] };
    const venta = db.prepare(`SELECT * FROM ventas WHERE id = ?`).get(ventaId) as { numero: string; total: number; cliente_id: number | null } | undefined;
    if (!venta) { res.status(404).json({ error: 'Venta no encontrada' }); return; }

    const sesion = db.prepare(`SELECT id FROM caja_sesiones WHERE fecha_cierre IS NULL ORDER BY id DESC LIMIT 1`).get() as { id: number } | undefined;
    const numero = `DEV${Date.now()}`;
    const ahora = new Date();

    db.transaction(() => {
      const total = (items || []).reduce((s, i) => {
        const item = db.prepare(`SELECT precio_unitario FROM venta_items WHERE venta_id = ? AND producto_id = ?`).get(ventaId, i.producto_id) as { precio_unitario: number } | undefined;
        return s + (item?.precio_unitario || 0) * i.cantidad;
      }, 0);

      const devId = (db.prepare(`
        INSERT INTO ventas (numero, tipo, estado, fecha, hora, cliente_id, subtotal, total, metodo_pago, observaciones)
        VALUES (?, 'devolucion', 'completada', ?, ?, ?, ?, ?, 'efectivo', ?)
      `).run(numero, ahora.toISOString().split('T')[0], ahora.toTimeString().split(' ')[0], venta.cliente_id, total, total, `Devolución de Venta #${venta.numero}`) as { lastInsertRowid: number }).lastInsertRowid;

      for (const i of (items || [])) {
        const item = db.prepare(`SELECT * FROM venta_items WHERE venta_id = ? AND producto_id = ?`).get(ventaId, i.producto_id) as { precio_unitario: number } | undefined;
        db.prepare(`INSERT INTO venta_items (venta_id, producto_id, cantidad, precio_unitario, descuento, total) VALUES (?, ?, ?, ?, 0, ?)`).run(devId, i.producto_id, i.cantidad, item?.precio_unitario || 0, (item?.precio_unitario || 0) * i.cantidad);
        db.prepare(`UPDATE productos SET stock_actual = stock_actual + ?, updated_at = datetime('now') WHERE id = ?`).run(i.cantidad, i.producto_id);
        const prod = db.prepare(`SELECT stock_actual FROM productos WHERE id = ?`).get(i.producto_id) as { stock_actual: number } | undefined;
        const nuevo = prod?.stock_actual ?? 0;
        db.prepare(`INSERT INTO stock_movimientos (producto_id, tipo, cantidad, motivo, venta_id, stock_previo, stock_nuevo) VALUES (?, 'entrada', ?, ?, ?, ?, ?)`).run(i.producto_id, i.cantidad, `Devolución #${numero}`, devId, nuevo - i.cantidad, nuevo);
      }
      if (sesion) {
        db.prepare(`INSERT INTO caja_movimientos (sesion_id, tipo, monto, descripcion, metodo_pago, venta_id) VALUES (?, 'egreso', ?, ?, 'efectivo', ?)`).run(sesion.id, total, `Devolución Venta #${venta.numero}`, devId);
      }
    })();

    emit('stock:actualizado', {});
    res.json({ success: true, numero });
  });

  router.post('/ventas/:id/convertir-pedido', (req, res) => {
    const db = getDb();
    const pedidoId = parseInt(req.params.id);
    const pedido = db.prepare(`SELECT * FROM ventas WHERE id = ? AND tipo = 'pedido'`).get(pedidoId) as Record<string, unknown> | undefined;
    if (!pedido) { res.status(404).json({ success: false, error: 'Pedido no encontrado' }); return; }

    const items = db.prepare(`SELECT * FROM venta_items WHERE venta_id = ?`).all(pedidoId) as { producto_id: number; cantidad: number; precio_unitario: number }[];
    const sesion = db.prepare(`SELECT id FROM caja_sesiones WHERE fecha_cierre IS NULL ORDER BY id DESC LIMIT 1`).get() as { id: number } | undefined;

    db.transaction(() => {
      db.prepare(`UPDATE ventas SET tipo = 'venta', estado = 'completada', fecha = date('now'), hora = time('now') WHERE id = ?`).run(pedidoId);
      for (const item of items) {
        const p = db.prepare(`SELECT stock_actual FROM productos WHERE id = ?`).get(item.producto_id) as { stock_actual: number } | undefined;
        const previo = p?.stock_actual ?? 0;
        const nuevo = previo - item.cantidad;
        db.prepare(`UPDATE productos SET stock_actual = stock_actual - ?, updated_at = datetime('now') WHERE id = ?`).run(item.cantidad, item.producto_id);
        db.prepare(`INSERT INTO stock_movimientos (producto_id, tipo, cantidad, motivo, venta_id, stock_previo, stock_nuevo) VALUES (?, 'salida', ?, ?, ?, ?, ?)`).run(item.producto_id, item.cantidad, `Venta (desde pedido) #${pedido.numero}`, pedidoId, previo, nuevo);
      }
      if (sesion) {
        db.prepare(`INSERT INTO caja_movimientos (sesion_id, tipo, monto, descripcion, metodo_pago, venta_id) VALUES (?, 'ingreso', ?, ?, ?, ?)`).run(sesion.id, pedido.total, `Venta (pedido) #${pedido.numero}`, pedido.metodo_pago, pedidoId);
      }
    })();

    emit('venta:nueva', { id: pedidoId });
    res.json({ success: true });
  });

  // Nota: POST /ventas ya existe en index.ts como /api/ventas — los clientes proxy usan ese endpoint directamente.

  // ── STOCK ──────────────────────────────────────────────────────────────

  router.get('/stock/movimientos', (req, res) => {
    const db = getDb();
    const { productoId } = req.query as { productoId?: string };
    let query = `
      SELECT sm.*, p.nombre as producto_nombre, p.codigo as producto_codigo
      FROM stock_movimientos sm LEFT JOIN productos p ON p.id = sm.producto_id WHERE 1=1
    `;
    const params: unknown[] = [];
    if (productoId) { query += ` AND sm.producto_id = ?`; params.push(parseInt(productoId)); }
    query += ` ORDER BY sm.fecha DESC LIMIT 200`;
    res.json(db.prepare(query).all(...params));
  });

  router.post('/stock/ajuste', (req: Request, res: Response) => {
    const db = getDb();
    const { productoId, tipo, cantidad, motivo = '' } = req.body as { productoId: number; tipo: string; cantidad: number; motivo?: string };
    db.transaction(() => {
      const prod = db.prepare(`SELECT stock_actual FROM productos WHERE id = ?`).get(productoId) as { stock_actual: number } | undefined;
      const previo = prod?.stock_actual ?? 0;
      let nuevo: number;
      if (tipo === 'ajuste') {
        nuevo = cantidad;
        db.prepare(`UPDATE productos SET stock_actual = ?, updated_at = datetime('now') WHERE id = ?`).run(cantidad, productoId);
      } else if (tipo === 'entrada') {
        nuevo = previo + cantidad;
        db.prepare(`UPDATE productos SET stock_actual = stock_actual + ?, updated_at = datetime('now') WHERE id = ?`).run(cantidad, productoId);
      } else {
        nuevo = previo - cantidad;
        db.prepare(`UPDATE productos SET stock_actual = stock_actual - ?, updated_at = datetime('now') WHERE id = ?`).run(cantidad, productoId);
      }
      db.prepare(`INSERT INTO stock_movimientos (producto_id, tipo, cantidad, motivo, stock_previo, stock_nuevo) VALUES (?, ?, ?, ?, ?, ?)`).run(productoId, tipo, cantidad, motivo, previo, nuevo);
    })();
    emit('stock:actualizado', { productoId });
    res.json({ success: true });
  });

  // ── CAJA ──────────────────────────────────────────────────────────────

  router.get('/caja/sesion-activa', (_req, res) => {
    const db = getDb();
    const sesion = db.prepare(`
      SELECT cs.*, u.nombre as usuario_nombre
      FROM caja_sesiones cs LEFT JOIN usuarios u ON cs.usuario_id = u.id
      WHERE cs.fecha_cierre IS NULL ORDER BY cs.id DESC LIMIT 1
    `).get() as Record<string, unknown> | undefined;
    if (!sesion) { res.json(null); return; }
    const totales = db.prepare(`
      SELECT
        COALESCE(SUM(CASE WHEN tipo='ingreso' AND venta_id IS NOT NULL THEN monto ELSE 0 END),0) as total_ventas,
        COALESCE(SUM(CASE WHEN tipo='ingreso' AND venta_id IS NULL THEN monto ELSE 0 END),0) as total_ingresos,
        COALESCE(SUM(CASE WHEN tipo='egreso' THEN monto ELSE 0 END),0) as total_egresos,
        COALESCE(SUM(CASE WHEN tipo='ingreso' AND metodo_pago='efectivo' THEN monto ELSE 0 END),0) as efectivo,
        COALESCE(SUM(CASE WHEN tipo='ingreso' AND metodo_pago='tarjeta' THEN monto ELSE 0 END),0) as tarjeta,
        COALESCE(SUM(CASE WHEN tipo='ingreso' AND metodo_pago='transferencia' THEN monto ELSE 0 END),0) as transferencia
      FROM caja_movimientos WHERE sesion_id = ?
    `).get(sesion.id as number) as Record<string, unknown>;
    res.json({ ...sesion, ...totales, saldo_inicial: sesion.monto_inicial, saldo_final: sesion.monto_final });
  });

  router.post('/caja/abrir', (req: Request, res: Response) => {
    const db = getDb();
    const existente = db.prepare(`SELECT id FROM caja_sesiones WHERE fecha_cierre IS NULL`).get();
    if (existente) { res.status(400).json({ success: false, error: 'Ya hay una sesión abierta' }); return; }
    const { monto_inicial = 0, usuario_id = null } = req.body as { monto_inicial?: number; usuario_id?: number };
    const result = db.prepare(`INSERT INTO caja_sesiones (monto_inicial, usuario_id) VALUES (?, ?)`).run(monto_inicial, usuario_id);
    emit('caja:movimiento', { tipo: 'apertura', monto: monto_inicial });
    res.json({ id: result.lastInsertRowid, success: true });
  });

  router.post('/caja/cerrar', (req: Request, res: Response) => {
    const db = getDb();
    const { sesion_id, monto_final = 0 } = req.body as { sesion_id: number; monto_final?: number };
    db.prepare(`UPDATE caja_sesiones SET fecha_cierre = datetime('now'), monto_final = ? WHERE id = ?`).run(monto_final, sesion_id);
    emit('caja:movimiento', { tipo: 'cierre', monto: monto_final });
    res.json({ success: true });
  });

  router.post('/caja/movimiento', (req: Request, res: Response) => {
    const db = getDb();
    const { sesion_id, tipo, monto, descripcion = '', metodo_pago = 'efectivo' } = req.body as { sesion_id: number; tipo: string; monto: number; descripcion?: string; metodo_pago?: string };
    const result = db.prepare(`INSERT INTO caja_movimientos (sesion_id, tipo, monto, descripcion, metodo_pago) VALUES (?, ?, ?, ?, ?)`).run(sesion_id, tipo, monto, descripcion, metodo_pago);
    emit('caja:movimiento', { tipo, monto, descripcion });
    res.json({ id: result.lastInsertRowid });
  });

  router.get('/caja/movimientos', (req, res) => {
    const db = getDb();
    const { sesionId } = req.query as { sesionId?: string };
    if (!sesionId) { res.status(400).json({ error: 'sesionId requerido' }); return; }
    res.json(db.prepare(`
      SELECT cm.*, v.numero as venta_numero
      FROM caja_movimientos cm LEFT JOIN ventas v ON v.id = cm.venta_id
      WHERE cm.sesion_id = ? ORDER BY cm.fecha DESC
    `).all(parseInt(sesionId)));
  });

  router.get('/caja/historico', (_req, res) => {
    const db = getDb();
    res.json(db.prepare(`
      SELECT cs.*, cs.monto_inicial as saldo_inicial, cs.monto_final as saldo_final,
        u.nombre as usuario_nombre,
        (SELECT COALESCE(SUM(monto),0) FROM caja_movimientos WHERE sesion_id = cs.id AND tipo = 'ingreso' AND venta_id IS NOT NULL) as total_ventas,
        (SELECT COALESCE(SUM(monto),0) FROM caja_movimientos WHERE sesion_id = cs.id AND tipo = 'ingreso' AND venta_id IS NULL) as total_ingresos,
        (SELECT COALESCE(SUM(monto),0) FROM caja_movimientos WHERE sesion_id = cs.id AND tipo = 'egreso') as total_egresos
      FROM caja_sesiones cs LEFT JOIN usuarios u ON cs.usuario_id = u.id
      ORDER BY cs.id DESC LIMIT 50
    `).all());
  });

  // ── ESTADÍSTICAS ──────────────────────────────────────────────────────────────

  router.get('/stats/dashboard', (_req, res) => {
    const db = getDb();
    const today = new Date().toISOString().split('T')[0];
    const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString().split('T')[0];
    const monthStart = new Date(); monthStart.setDate(1);
    const ms = monthStart.toISOString().split('T')[0];
    const prevWeekStart = new Date(Date.now() - 14 * 86400000).toISOString().split('T')[0];

    const rowHoy = db.prepare(`SELECT COUNT(*) as count, COALESCE(SUM(total),0) as total FROM ventas WHERE fecha = ? AND tipo='venta'`).get(today) as { count: number; total: number };
    const rowSemana = db.prepare(`SELECT COUNT(*) as count, COALESCE(SUM(total),0) as total FROM ventas WHERE fecha >= ? AND tipo='venta'`).get(weekAgo) as { count: number; total: number };
    const rowSemAnt = db.prepare(`SELECT COALESCE(SUM(total),0) as total FROM ventas WHERE fecha >= ? AND fecha < ? AND tipo='venta'`).get(prevWeekStart, weekAgo) as { total: number };
    const rowMes = db.prepare(`SELECT COUNT(*) as count, COALESCE(SUM(total),0) as total FROM ventas WHERE fecha >= ? AND tipo='venta'`).get(ms) as { count: number; total: number };
    const clientesNuevosMes = (db.prepare(`SELECT COUNT(*) as c FROM clientes WHERE date(created_at) >= ?`).get(ms) as { c: number }).c;
    const productosStockBajo = (db.prepare(`SELECT COUNT(*) as c FROM productos WHERE stock_actual <= stock_minimo AND activo=1`).get() as { c: number }).c;
    const fiadoTotal = (db.prepare(`SELECT COALESCE(SUM(total-COALESCE(monto_pagado,0)),0) as t FROM ventas WHERE es_fiado=1 AND estado!='pagado' AND tipo='venta'`).get() as { t: number }).t;
    const ventasPorDia = db.prepare(`SELECT fecha, COALESCE(SUM(total),0) as total, COUNT(*) as cantidad FROM ventas WHERE tipo='venta' AND fecha >= date('now','-30 days') GROUP BY fecha ORDER BY fecha`).all();
    const ventasPorHora = db.prepare(`SELECT substr(hora,1,2) as hora, COUNT(*) as cantidad, COALESCE(SUM(total),0) as total FROM ventas WHERE tipo='venta' AND fecha=? GROUP BY substr(hora,1,2) ORDER BY hora`).all(today);
    const topProductos = db.prepare(`SELECT p.nombre, SUM(vi.cantidad) as cantidad, SUM(vi.total) as total FROM venta_items vi JOIN productos p ON p.id=vi.producto_id JOIN ventas v ON v.id=vi.venta_id WHERE v.tipo='venta' AND v.fecha >= ? GROUP BY vi.producto_id ORDER BY total DESC LIMIT 8`).all(ms);
    const ventasPorMetodo = db.prepare(`SELECT COALESCE(metodo_pago,'efectivo') as metodo, COALESCE(SUM(total),0) as total, COUNT(*) as cantidad FROM ventas WHERE tipo='venta' AND fecha=? AND es_fiado=0 GROUP BY metodo_pago`).all(today);
    const alertasStock = db.prepare(`SELECT nombre, stock_actual, stock_minimo FROM productos WHERE stock_actual <= stock_minimo AND activo=1 ORDER BY stock_actual ASC LIMIT 5`).all();

    res.json({
      ventas_hoy: rowHoy.count, total_hoy: rowHoy.total,
      ventas_semana: rowSemana.count, total_semana: rowSemana.total,
      total_semana_anterior: rowSemAnt.total,
      ventas_mes: rowMes.count, total_mes: rowMes.total,
      ticket_promedio_hoy: rowHoy.count > 0 ? rowHoy.total / rowHoy.count : 0,
      clientes_nuevos_mes: clientesNuevosMes, productos_bajo_stock: productosStockBajo,
      fiado_total: fiadoTotal, ventas_por_dia: ventasPorDia, ventas_por_hora: ventasPorHora,
      top_productos: topProductos, ventas_por_metodo: ventasPorMetodo, alertas_stock: alertasStock,
    });
  });

  router.get('/stats/periodo', (req, res) => {
    const db = getDb();
    const { desde, hasta } = req.query as { desde: string; hasta: string };
    res.json(db.prepare(`
      SELECT fecha, COALESCE(SUM(total),0) as total, COUNT(*) as cantidad,
        COALESCE(SUM(CASE WHEN metodo_pago='efectivo' THEN total ELSE 0 END),0) as efectivo,
        COALESCE(SUM(CASE WHEN metodo_pago='tarjeta' THEN total ELSE 0 END),0) as tarjeta
      FROM ventas WHERE tipo='venta' AND fecha BETWEEN ? AND ?
      GROUP BY fecha ORDER BY fecha
    `).all(desde, hasta));
  });

  // ── CUENTAS A PAGAR ──────────────────────────────────────────────────────────────

  router.get('/cuentaspagar', (_req, res) => {
    res.json(getDb().prepare(`SELECT * FROM cuentas_pagar ORDER BY vencimiento ASC`).all());
  });

  router.post('/cuentaspagar', (req: Request, res: Response) => {
    const db = getDb();
    const data = { descripcion: '', proveedor: '', monto_total: 0, monto_pagado: 0, vencimiento: null, estado: 'pendiente', ...req.body as Record<string, unknown> };
    const result = db.prepare(`INSERT INTO cuentas_pagar (descripcion, proveedor, monto_total, monto_pagado, vencimiento, estado) VALUES (@descripcion, @proveedor, @monto_total, @monto_pagado, @vencimiento, @estado)`).run(data);
    res.json({ id: result.lastInsertRowid });
  });

  router.put('/cuentaspagar/:id', (req: Request, res: Response) => {
    const db = getDb();
    const id = parseInt(req.params.id);
    const data = req.body as Record<string, unknown>;
    const fields = Object.keys(data).map(k => `${k} = @${k}`).join(', ');
    if (fields) db.prepare(`UPDATE cuentas_pagar SET ${fields} WHERE id = @id`).run({ ...data, id });
    res.json({ success: true });
  });

  router.delete('/cuentaspagar/:id', (req, res) => {
    getDb().prepare(`DELETE FROM cuentas_pagar WHERE id = ?`).run(parseInt(req.params.id));
    res.json({ success: true });
  });

  router.post('/cuentaspagar/:id/pagar', (req: Request, res: Response) => {
    const db = getDb();
    const id = parseInt(req.params.id);
    const { monto } = req.body as { monto: number };
    const cuenta = db.prepare(`SELECT * FROM cuentas_pagar WHERE id = ?`).get(id) as { monto_total: number; monto_pagado: number } | undefined;
    if (!cuenta) { res.status(404).json({ success: false }); return; }
    const nuevoPagado = cuenta.monto_pagado + monto;
    const estado = nuevoPagado >= cuenta.monto_total ? 'pagado' : 'parcial';
    db.prepare(`UPDATE cuentas_pagar SET monto_pagado = ?, estado = ? WHERE id = ?`).run(nuevoPagado, estado, id);
    res.json({ success: true });
  });

  // ── USUARIOS / AUTH ──────────────────────────────────────────────────────────────

  router.get('/usuarios', (_req, res) => {
    res.json(getDb().prepare(`SELECT id, nombre, rol, activo FROM usuarios ORDER BY nombre`).all());
  });

  router.post('/usuarios/login', (req: Request, res: Response) => {
    const { pin } = req.body as { pin: string };
    const user = getDb().prepare(`SELECT id, nombre, rol, activo FROM usuarios WHERE pin = ? AND activo = 1`).get(pin);
    res.json(user || null);
  });

  router.post('/usuarios', (req: Request, res: Response) => {
    const db = getDb();
    const { nombre, pin, rol = 'cajero' } = req.body as { nombre: string; pin: string; rol?: string };
    const result = db.prepare(`INSERT INTO usuarios (nombre, pin, rol) VALUES (?, ?, ?)`).run(nombre, pin, rol);
    res.json({ id: result.lastInsertRowid });
  });

  router.put('/usuarios/:id', (req: Request, res: Response) => {
    const db = getDb();
    const id = parseInt(req.params.id);
    const data = req.body as Record<string, unknown>;
    const fields = Object.keys(data).map(k => `${k} = @${k}`).join(', ');
    if (fields) db.prepare(`UPDATE usuarios SET ${fields} WHERE id = @id`).run({ ...data, id });
    res.json({ success: true });
  });

  router.post('/usuarios/:id/desactivar', (req, res) => {
    getDb().prepare(`UPDATE usuarios SET activo = 0 WHERE id = ?`).run(parseInt(req.params.id));
    res.json({ success: true });
  });

  router.post('/auth/validate-pin', (req: Request, res: Response) => {
    const { pin } = req.body as { pin: string };
    const user = getDb().prepare(`SELECT id, nombre, rol FROM usuarios WHERE pin = ? AND activo = 1`).get(pin);
    res.json(user ? { valid: true, user } : { valid: false });
  });

  router.post('/auth/validate-admin', (req: Request, res: Response) => {
    const { pin } = req.body as { pin: string };
    // Valida contra usuarios con rol admin en DB
    const adminUser = getDb().prepare(`SELECT id FROM usuarios WHERE pin = ? AND activo = 1 AND rol = 'admin'`).get(pin);
    // También valida contra el PIN de admin de la web (configuracion tabla)
    const adminWebPin = (getDb().prepare(`SELECT valor FROM configuracion WHERE clave = 'admin_web_password'`).get() as { valor: string } | undefined)?.valor || '159753';
    res.json({ valid: Boolean(adminUser) || pin === adminWebPin });
  });

  // ── CONFIGURACIÓN ──────────────────────────────────────────────────────────────

  router.get('/config', (_req, res) => {
    const db = getDb();
    const rows = db.prepare(`SELECT clave, valor FROM configuracion`).all() as { clave: string; valor: string }[];
    const config: Record<string, string> = {};
    for (const row of rows) config[row.clave] = row.valor;
    res.json(config);
  });

  router.post('/config', (req: Request, res: Response) => {
    const db = getDb();
    const { clave, valor } = req.body as { clave: string; valor: string };
    if (!clave) { res.status(400).json({ error: 'clave requerida' }); return; }
    db.prepare(`INSERT OR REPLACE INTO configuracion (clave, valor) VALUES (?, ?)`).run(clave, valor);
    res.json({ success: true });
  });

  router.post('/config/multiple', (req: Request, res: Response) => {
    const db = getDb();
    const data = req.body as Record<string, string>;
    const stmt = db.prepare(`INSERT OR REPLACE INTO configuracion (clave, valor) VALUES (?, ?)`);
    const txn = db.transaction(() => {
      for (const [k, v] of Object.entries(data)) stmt.run(k, v);
    });
    txn();
    emit('config:actualizado', {});
    res.json({ success: true });
  });

  // ── COMBOS ──────────────────────────────────────────────────────────────

  router.get('/combos', (_req, res) => {
    const db = getDb();
    const combos = db.prepare(`SELECT * FROM combos ORDER BY nombre`).all() as Record<string, unknown>[];
    for (const c of combos) {
      (c as Record<string, unknown>).items = db.prepare(`SELECT ci.*, p.nombre as producto_nombre FROM combo_items ci LEFT JOIN productos p ON p.id = ci.producto_id WHERE ci.combo_id = ?`).all(c.id as number);
    }
    res.json(combos);
  });

  router.get('/combos/:id', (req, res) => {
    const db = getDb();
    const combo = db.prepare(`SELECT * FROM combos WHERE id = ?`).get(parseInt(req.params.id)) as Record<string, unknown> | undefined;
    if (!combo) { res.status(404).json({ error: 'Combo no encontrado' }); return; }
    (combo as Record<string, unknown>).items = db.prepare(`SELECT ci.*, p.nombre as producto_nombre FROM combo_items ci LEFT JOIN productos p ON p.id = ci.producto_id WHERE ci.combo_id = ?`).all(combo.id as number);
    res.json(combo);
  });

  router.post('/combos', (req: Request, res: Response) => {
    const db = getDb();
    const { nombre, descripcion = '', precio, activo = true, items = [] } = req.body as { nombre: string; descripcion?: string; precio: number; activo?: boolean; items?: { producto_id: number; cantidad: number; precio_unitario: number }[] };
    db.transaction(() => {
      const result = db.prepare(`INSERT INTO combos (nombre, descripcion, precio, activo) VALUES (?, ?, ?, ?)`).run(nombre, descripcion, precio, activo ? 1 : 0);
      const comboId = result.lastInsertRowid;
      for (const item of items) {
        db.prepare(`INSERT INTO combo_items (combo_id, producto_id, cantidad, precio_unitario) VALUES (?, ?, ?, ?)`).run(comboId, item.producto_id, item.cantidad, item.precio_unitario);
      }
      res.json({ id: comboId });
    })();
  });

  router.put('/combos/:id', (req: Request, res: Response) => {
    const db = getDb();
    const id = parseInt(req.params.id);
    const { nombre, descripcion, precio, activo, items = [] } = req.body as { nombre: string; descripcion?: string; precio: number; activo?: boolean; items?: { producto_id: number; cantidad: number; precio_unitario: number }[] };
    db.transaction(() => {
      db.prepare(`UPDATE combos SET nombre = ?, descripcion = ?, precio = ?, activo = ? WHERE id = ?`).run(nombre, descripcion ?? '', precio, activo ? 1 : 0, id);
      db.prepare(`DELETE FROM combo_items WHERE combo_id = ?`).run(id);
      for (const item of items) {
        db.prepare(`INSERT INTO combo_items (combo_id, producto_id, cantidad, precio_unitario) VALUES (?, ?, ?, ?)`).run(id, item.producto_id, item.cantidad, item.precio_unitario);
      }
    })();
    res.json({ success: true });
  });

  router.delete('/combos/:id', (req, res) => {
    const db = getDb();
    db.prepare(`DELETE FROM combo_items WHERE combo_id = ?`).run(parseInt(req.params.id));
    db.prepare(`DELETE FROM combos WHERE id = ?`).run(parseInt(req.params.id));
    res.json({ success: true });
  });

  // ── LIBRO DE CAJA ──────────────────────────────────────────────────────────────

  router.get('/librocaja', (req, res) => {
    const db = getDb();
    const { fecha } = req.query as { fecha?: string };
    if (!fecha) { res.status(400).json({ error: 'fecha requerida' }); return; }
    let dia = db.prepare(`SELECT * FROM libro_caja_dias WHERE fecha = ?`).get(fecha) as Record<string, unknown> | undefined;
    if (!dia) {
      db.prepare(`INSERT OR IGNORE INTO libro_caja_dias (fecha) VALUES (?)`).run(fecha);
      dia = db.prepare(`SELECT * FROM libro_caja_dias WHERE fecha = ?`).get(fecha) as Record<string, unknown>;
    }
    if (dia) {
      (dia as Record<string, unknown>).egresos_detalle = db.prepare(`SELECT * FROM libro_caja_egresos WHERE dia_id = ? ORDER BY created_at ASC`).all(dia.id as number);
    }
    res.json(dia || null);
  });

  router.get('/librocaja/historico', (req, res) => {
    const db = getDb();
    const limit = parseInt(String(req.query.limit || '60'));
    res.json(db.prepare(`SELECT * FROM libro_caja_dias ORDER BY fecha DESC LIMIT ?`).all(limit));
  });

  router.get('/librocaja/turno/activo', (req, res) => {
    const db = getDb();
    const { fecha } = req.query as { fecha?: string };
    if (!fecha) { res.json(null); return; }
    const dia = db.prepare(`SELECT id FROM libro_caja_dias WHERE fecha = ?`).get(fecha) as { id: number } | undefined;
    if (!dia) { res.json(null); return; }
    res.json(db.prepare(`SELECT * FROM libro_caja_turnos WHERE dia_id = ? AND fecha_cierre IS NULL ORDER BY numero DESC LIMIT 1`).get(dia.id) || null);
  });

  router.put('/librocaja/:fecha', (req: Request, res: Response) => {
    const db = getDb();
    const { fecha } = req.params;
    const data = req.body as Record<string, unknown>;
    db.prepare(`INSERT OR IGNORE INTO libro_caja_dias (fecha) VALUES (?)`).run(fecha);
    const dia = db.prepare(`SELECT id FROM libro_caja_dias WHERE fecha = ?`).get(fecha) as { id: number };
    const allowed = ['caja','tarjetas','transferencias','egresos','cambio','notas'];
    const filtered = Object.fromEntries(Object.entries(data).filter(([k]) => allowed.includes(k)));
    if (Object.keys(filtered).length) {
      const fields = Object.keys(filtered).map(k => `${k} = @${k}`).join(', ');
      db.prepare(`UPDATE libro_caja_dias SET ${fields}, updated_at = datetime('now') WHERE id = @id`).run({ ...filtered, id: dia.id });
    }
    res.json({ success: true });
  });

  router.post('/librocaja/:fecha/sync', (req, res) => {
    const db = getDb();
    const { fecha } = req.params;
    const tots = db.prepare(`
      SELECT
        COALESCE(SUM(CASE WHEN v.metodo_pago='efectivo' AND v.tipo='venta' AND v.es_fiado=0 THEN v.total ELSE 0 END),0) as efectivo,
        COALESCE(SUM(CASE WHEN v.metodo_pago IN ('tarjeta','debito','credito') AND v.tipo='venta' THEN v.total ELSE 0 END),0) as tarjetas,
        COALESCE(SUM(CASE WHEN v.metodo_pago IN ('transferencia','qr','mercadopago') AND v.tipo='venta' THEN v.total ELSE 0 END),0) as transferencias
      FROM ventas v WHERE v.fecha = ?
    `).get(fecha) as { efectivo: number; tarjetas: number; transferencias: number };
    db.prepare(`INSERT OR IGNORE INTO libro_caja_dias (fecha) VALUES (?)`).run(fecha);
    db.prepare(`UPDATE libro_caja_dias SET caja = ?, tarjetas = ?, transferencias = ?, updated_at = datetime('now') WHERE fecha = ?`).run(tots.efectivo, tots.tarjetas, tots.transferencias, fecha);
    res.json({ success: true });
  });

  router.post('/librocaja/:fecha/turno/abrir', (req: Request, res: Response) => {
    const db = getDb();
    const { fecha } = req.params;
    const { monto_apertura = 0, usuario_id = null, notas = '' } = req.body as { monto_apertura?: number; usuario_id?: number; notas?: string };
    db.prepare(`INSERT OR IGNORE INTO libro_caja_dias (fecha) VALUES (?)`).run(fecha);
    const dia = db.prepare(`SELECT id FROM libro_caja_dias WHERE fecha = ?`).get(fecha) as { id: number };
    const maxNumero = (db.prepare(`SELECT COALESCE(MAX(numero),0) as m FROM libro_caja_turnos WHERE dia_id = ?`).get(dia.id) as { m: number }).m;
    const result = db.prepare(`INSERT INTO libro_caja_turnos (dia_id, numero, fecha_apertura, monto_apertura, usuario_id, notas) VALUES (?, ?, datetime('now'), ?, ?, ?)`).run(dia.id, maxNumero + 1, monto_apertura, usuario_id, notas);
    res.json({ id: result.lastInsertRowid, success: true });
  });

  router.put('/librocaja/turno/:id/cerrar', (req: Request, res: Response) => {
    const db = getDb();
    const { monto_cierre = 0, notas = '' } = req.body as { monto_cierre?: number; notas?: string };
    db.prepare(`UPDATE libro_caja_turnos SET fecha_cierre = datetime('now'), monto_cierre = ?, notas_cierre = ? WHERE id = ?`).run(monto_cierre, notas, parseInt(req.params.id));
    res.json({ success: true });
  });

  router.put('/librocaja/:fecha/billetes', (req: Request, res: Response) => {
    const db = getDb();
    const { fecha } = req.params;
    const { billetes = [] } = req.body as { billetes?: { denominacion: number; cantidad: number }[] };
    db.prepare(`INSERT OR IGNORE INTO libro_caja_dias (fecha) VALUES (?)`).run(fecha);
    const dia = db.prepare(`SELECT id FROM libro_caja_dias WHERE fecha = ?`).get(fecha) as { id: number };
    db.prepare(`DELETE FROM libro_caja_billetes WHERE dia_id = ?`).run(dia.id);
    for (const b of billetes) {
      db.prepare(`INSERT INTO libro_caja_billetes (dia_id, denominacion, cantidad) VALUES (?, ?, ?)`).run(dia.id, b.denominacion, b.cantidad);
    }
    res.json({ success: true });
  });

  router.post('/librocaja/:fecha/egreso', (req: Request, res: Response) => {
    const db = getDb();
    const { fecha } = req.params;
    const { proveedor, monto, medio_pago = 'efectivo' } = req.body as { proveedor: string; monto: number; medio_pago?: string };
    db.prepare(`INSERT OR IGNORE INTO libro_caja_dias (fecha) VALUES (?)`).run(fecha);
    const dia = db.prepare(`SELECT id FROM libro_caja_dias WHERE fecha = ?`).get(fecha) as { id: number };
    const result = db.prepare(`INSERT INTO libro_caja_egresos (dia_id, proveedor, monto, medio_pago) VALUES (?, ?, ?, ?)`).run(dia.id, proveedor, monto, medio_pago);
    const total = (db.prepare(`SELECT COALESCE(SUM(monto),0) as t FROM libro_caja_egresos WHERE dia_id = ?`).get(dia.id) as { t: number }).t;
    db.prepare(`UPDATE libro_caja_dias SET egresos = ?, updated_at = datetime('now') WHERE id = ?`).run(total, dia.id);
    res.json({ id: result.lastInsertRowid });
  });

  router.delete('/librocaja/egreso/:id', (req, res) => {
    const db = getDb();
    const id = parseInt(req.params.id);
    const egreso = db.prepare(`SELECT dia_id, monto FROM libro_caja_egresos WHERE id = ?`).get(id) as { dia_id: number; monto: number } | undefined;
    if (!egreso) { res.status(404).json({ error: 'Egreso no encontrado' }); return; }
    db.prepare(`DELETE FROM libro_caja_egresos WHERE id = ?`).run(id);
    const total = (db.prepare(`SELECT COALESCE(SUM(monto),0) as t FROM libro_caja_egresos WHERE dia_id = ?`).get(egreso.dia_id) as { t: number }).t;
    db.prepare(`UPDATE libro_caja_dias SET egresos = ?, updated_at = datetime('now') WHERE id = ?`).run(total, egreso.dia_id);
    res.json({ success: true });
  });

  return router;
}
