import express, { Request, Response, NextFunction } from 'express';
import { createServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import cors from 'cors';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { app as electronApp } from 'electron';
import { getDb } from '../database/db';
import { generatePosHTML } from './webpos';
import { exportFiadosToExcel } from '../services/fiados-excel-backup';
import { createSyncRouter } from './syncRoutes';
const localtunnel = require('localtunnel') as (opts: { port: number; subdomain?: string }) => Promise<{ url: string; close(): void; on(ev: string, cb: (...a: unknown[]) => void): void }>;
const cloudflared = require('cloudflared') as {
  bin: string;
  install(to: string, version?: string): Promise<string>;
  Tunnel: {
    quick(url?: string, options?: Record<string, string | number | boolean>): {
      once(ev: string, cb: (...args: unknown[]) => void): void;
      on(ev: string, cb: (...args: unknown[]) => void): void;
      stop(): boolean;
    };
  };
};

export let io: SocketIOServer;

let tunnelUrl: string | null = null;
let activePort = 3001;
let activeTunnelStop: (() => void) | null = null;

export function getActivePort(): number { return activePort; }

function getLocalIP(): string {
  const ifaces = os.networkInterfaces();
  for (const iface of Object.values(ifaces)) {
    for (const info of iface ?? []) {
      if (info.family === 'IPv4' && !info.internal) return info.address;
    }
  }
  return 'localhost';
}

async function startLocalTunnel(port: number): Promise<void> {
  try {
    const tunnel = await localtunnel({ port });
    activeTunnelStop = () => tunnel.close();
    tunnelUrl = tunnel.url;
    console.log(`[Tunnel] URL publica (localtunnel): ${tunnelUrl}/pos`);
    tunnel.on('close', () => {
      activeTunnelStop = null;
      tunnelUrl = null;
      console.log('[Tunnel] Reconectando en 10s...');
      setTimeout(() => startTunnel(port), 10000);
    });
    tunnel.on('error', (err: unknown) => {
      console.error('[Tunnel] Error:', (err as Error).message);
    });
  } catch (err) {
    console.error('[Tunnel] No se pudo iniciar:', (err as Error).message);
    setTimeout(() => startTunnel(port), 15000);
  }
}

async function startCloudflareTunnel(port: number): Promise<boolean> {
  try {
    if (!fs.existsSync(cloudflared.bin)) {
      console.log('[Tunnel] Instalando cloudflared...');
      await cloudflared.install(cloudflared.bin);
    }

    const tunnel = cloudflared.Tunnel.quick(`http://127.0.0.1:${port}`, { 'no-autoupdate': true });
    activeTunnelStop = () => {
      tunnel.stop();
    };

    return await new Promise<boolean>((resolve) => {
      let settled = false;
      const finish = (ok: boolean) => {
        if (settled) return;
        settled = true;
        resolve(ok);
      };

      const timeoutId = setTimeout(() => {
        console.error('[Tunnel] Cloudflare no respondio a tiempo.');
        activeTunnelStop = null;
        try {
          tunnel.stop();
        } catch {
          // ignore stop failures
        }
        finish(false);
      }, 30000);

      tunnel.once('url', (url: unknown) => {
        clearTimeout(timeoutId);
        tunnelUrl = String(url);
        console.log(`[Tunnel] URL publica (Cloudflare): ${tunnelUrl}/pos`);
        finish(true);
      });

      tunnel.once('error', (err: unknown) => {
        clearTimeout(timeoutId);
        console.error('[Tunnel] Cloudflare error:', (err as Error).message);
        activeTunnelStop = null;
        finish(false);
      });

      tunnel.on('exit', () => {
        clearTimeout(timeoutId);
        const shouldReconnect = !!tunnelUrl;
        activeTunnelStop = null;
        tunnelUrl = null;
        if (!settled) finish(false);
        if (shouldReconnect) {
          console.log('[Tunnel] Cloudflare cerrado. Reconectando en 10s...');
          setTimeout(() => startTunnel(port), 10000);
        }
      });
    });
  } catch (err) {
    console.error('[Tunnel] No se pudo iniciar Cloudflare:', (err as Error).message);
    activeTunnelStop = null;
    return false;
  }
}

async function startTunnel(port: number): Promise<void> {
  if (activeTunnelStop) {
    try {
      activeTunnelStop();
    } catch {
      // ignore tunnel cleanup failures
    }
    activeTunnelStop = null;
  }

  tunnelUrl = null;

  const cloudflareReady = await startCloudflareTunnel(port);
  if (cloudflareReady) return;

  console.log('[Tunnel] Fallback a localtunnel...');
  await startLocalTunnel(port);
}

const ADMIN_USER = 'admin';
const ADMIN_PASS_KEY = 'admin_web_password';
const DEFAULT_ADMIN_PASS = '159753';

const CAJERO_USER = 'cajero';
const CAJERO_PASS_KEY = 'pin_cajero';
const DEFAULT_CAJERO_PASS = '1234';

function getAdminPassword(): string {
  try {
    const db = getDb();
    const row = db.prepare('SELECT valor FROM configuracion WHERE clave = ?').get(ADMIN_PASS_KEY) as
      | { valor: string }
      | undefined;
    return row?.valor || DEFAULT_ADMIN_PASS;
  } catch {
    return DEFAULT_ADMIN_PASS;
  }
}

function getCajeroPin(): string {
  try {
    const db = getDb();
    const row = db.prepare('SELECT valor FROM configuracion WHERE clave = ?').get(CAJERO_PASS_KEY) as
      | { valor: string }
      | undefined;
    return row?.valor || DEFAULT_CAJERO_PASS;
  } catch {
    return DEFAULT_CAJERO_PASS;
  }
}

function decodeBasicAuth(req: Request): { user: string; pass: string } | null {
  const authHeader = req.headers['authorization'];
  if (!authHeader?.startsWith('Basic ')) return null;
  const str = Buffer.from(authHeader.split(' ')[1], 'base64').toString();
  const idx = str.indexOf(':');
  if (idx < 0) return null;
  return { user: str.substring(0, idx), pass: str.substring(idx + 1) };
}

function basicAuth(req: Request, res: Response, next: NextFunction): void {
  const creds = decodeBasicAuth(req);
  if (!creds) {
    res.status(401).json({ error: 'Autenticación requerida' });
    return;
  }
  const { user, pass } = creds;
  if (
    (user === ADMIN_USER && pass === getAdminPassword()) ||
    (user === CAJERO_USER && pass === getCajeroPin())
  ) {
    next();
  } else {
    res.status(401).json({ error: 'Credenciales incorrectas' });
  }
}

function adminOnly(req: Request, res: Response, next: NextFunction): void {
  const creds = decodeBasicAuth(req);
  if (creds && creds.user === ADMIN_USER && creds.pass === getAdminPassword()) {
    next();
  } else {
    res.status(403).json({ error: 'Acceso restringido a administradores' });
  }
}

export function startServer(): void {
  const db = getDb();

  // Migración: si la contraseña admin sigue siendo la antigua alfanumérica, cambiarla a numérica
  const existingPass = db.prepare('SELECT valor FROM configuracion WHERE clave = ?').get(ADMIN_PASS_KEY) as { valor: string } | undefined;
  if (!existingPass || existingPass.valor === 'ariespos2024') {
    db.prepare('INSERT OR REPLACE INTO configuracion (clave, valor) VALUES (?, ?)').run(ADMIN_PASS_KEY, DEFAULT_ADMIN_PASS);
    console.log('[Servidor] PIN admin actualizado a numérico.');
  }

  const portRow = db.prepare('SELECT valor FROM configuracion WHERE clave = ?').get('puerto_servidor') as
    | { valor: string }
    | undefined;
  const PORT = parseInt(portRow?.valor || '3001', 10);

  const expressApp = express();
  const httpServer = createServer(expressApp);

  io = new SocketIOServer(httpServer, {
    cors: {
      origin: '*',
      methods: ['GET', 'POST'],
      credentials: false,
    },
    transports: ['websocket', 'polling'],
  });

  expressApp.use(cors({
    origin: (_origin, callback) => callback(null, true), // acepta cualquier origen (red local)
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  }));
  expressApp.use(express.json({ limit: '10mb' }));
  expressApp.use(express.urlencoded({ extended: true }));

  // Servir imágenes de productos
  const imagesDir = path.join(electronApp.getPath('userData'), 'images');
  expressApp.use('/images', express.static(imagesDir));

  // ── API REST ──────────────────────────────────────────────────────────────

  // Rol del usuario autenticado
  expressApp.get('/api/auth/role', basicAuth, (req, res) => {
    const creds = decodeBasicAuth(req)!;
    res.json({ role: creds.user === CAJERO_USER ? 'cajero' : 'admin' });
  });

  // Dashboard (solo admin)
  expressApp.get('/api/stats', adminOnly, (_req, res) => {
    const stats = getDashboardStats();
    res.json(stats);
  });

  // Productos
  expressApp.get('/api/productos', basicAuth, (_req, res) => {
    const rows = db
      .prepare(
        `SELECT p.*, c.nombre as categoria_nombre
         FROM productos p
         LEFT JOIN categorias c ON p.categoria_id = c.id
         WHERE p.activo = 1
         ORDER BY p.nombre`
      )
      .all();
    res.json(rows);
  });

  // Ventas del día (solo admin)
  expressApp.get('/api/ventas/hoy', adminOnly, (_req, res) => {
    const today = new Date().toISOString().split('T')[0];
    const rows = db
      .prepare(
        `SELECT v.*, c.nombre as cliente_nombre, u.nombre as vendedor_nombre
         FROM ventas v
         LEFT JOIN clientes c ON v.cliente_id = c.id
         LEFT JOIN usuarios u ON v.vendedor_id = u.id
         WHERE v.fecha = ? AND v.tipo = 'venta'
         ORDER BY v.created_at DESC`
      )
      .all(today);
    res.json(rows);
  });

  // Clientes
  expressApp.get('/api/clientes', basicAuth, (_req, res) => {
    const rows = db
      .prepare(
        `SELECT c.*,
          COALESCE((SELECT SUM(v.total) FROM ventas v WHERE v.cliente_id = c.id AND v.es_fiado = 1 AND v.estado != 'pagado'), 0) as saldo_deuda
         FROM clientes c ORDER BY c.nombre`
      )
      .all();
    res.json(rows);
  });

  // Stock crítico
  expressApp.get('/api/stock/alertas', basicAuth, (_req, res) => {
    const rows = db
      .prepare(
        `SELECT p.id, p.nombre, p.codigo, p.stock_actual, p.stock_minimo
         FROM productos p
         WHERE p.stock_actual <= p.stock_minimo AND p.activo = 1
         ORDER BY p.stock_actual ASC`
      )
      .all();
    res.json(rows);
  });

  // Fiados pendientes
  expressApp.get('/api/fiados', basicAuth, (_req, res) => {
    const rows = db
      .prepare(
        `SELECT v.*, c.nombre as cliente_nombre, c.telefono as cliente_telefono
         FROM ventas v
         LEFT JOIN clientes c ON v.cliente_id = c.id
         WHERE v.es_fiado = 1 AND v.estado != 'pagado' AND v.tipo = 'venta'
         ORDER BY v.created_at DESC`
      )
      .all();
    res.json(rows);
  });

  // Categorías
  expressApp.get('/api/categorias', basicAuth, (_req, res) => {
    res.json(db.prepare(`SELECT * FROM categorias ORDER BY nombre`).all());
  });

  // Configuración del negocio (nombre, moneda, etc.)
  expressApp.get('/api/config', basicAuth, (_req, res) => {
    const claves = ['nombre_negocio', 'simbolo_moneda', 'nombre_terminal'];
    const result: Record<string, string> = {};
    for (const c of claves) {
      const row = db.prepare('SELECT valor FROM configuracion WHERE clave = ?').get(c) as { valor: string } | undefined;
      result[c] = row?.valor || '';
    }
    res.json(result);
  });

  // Endpoint de info para test de conexión (público)
  expressApp.get('/api/servidor/info', (_req, res) => {
    res.json({ ok: true, version: '1.0', nombre: 'ARIESPos' });
  });

  // ── CREAR VENTA (POST) ───────────────────────────────────────────────────
  expressApp.post('/api/ventas', basicAuth, (req, res) => {
    const payload = req.body as {
      items: { producto_id: number; cantidad: number; precio_unitario: number; descuento: number }[];
      metodo_pago: string;
      cliente_id: number | null;
      es_fiado: boolean;
      descuento: number;
      tipo: string;
      observaciones: string;
    };

    if (!payload?.items?.length) {
      res.status(400).json({ error: 'items requeridos' });
      return;
    }

    try {
      const numero = `V${Date.now()}`;
      const ahora = new Date();
      const fecha = ahora.toISOString().split('T')[0];
      const hora = ahora.toTimeString().split(' ')[0];
      const tipo = payload.tipo || 'venta';
      const descuento = payload.descuento || 0;
      const subtotal = payload.items.reduce((s, i) => s + i.precio_unitario * i.cantidad, 0);
      const total = Math.max(0, subtotal - descuento);

      const sesionActiva = db.prepare(
        `SELECT id FROM caja_sesiones WHERE fecha_cierre IS NULL ORDER BY id DESC LIMIT 1`
      ).get() as { id: number } | undefined;

      let ventaId = 0;

      db.transaction(() => {
        const result = db.prepare(`
          INSERT INTO ventas (numero, tipo, estado, fecha, hora, cliente_id, vendedor_id,
            subtotal, descuento, total, metodo_pago, es_fiado, observaciones)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
          numero, tipo,
          tipo === 'venta' ? (payload.es_fiado ? 'fiado' : 'completada') : 'abierto',
          fecha, hora,
          payload.cliente_id || null, null,
          subtotal, descuento, total,
          payload.metodo_pago, payload.es_fiado ? 1 : 0,
          payload.observaciones || ''
        );
        ventaId = result.lastInsertRowid as number;

        for (const item of payload.items) {
          const itemTotal = item.precio_unitario * item.cantidad - (item.descuento || 0);
          db.prepare(`
            INSERT INTO venta_items (venta_id, producto_id, cantidad, precio_unitario, descuento, total)
            VALUES (?, ?, ?, ?, ?, ?)
          `).run(ventaId, item.producto_id, item.cantidad, item.precio_unitario, item.descuento || 0, itemTotal);

          if (tipo === 'venta') {
            const prod = db.prepare(`SELECT stock_actual FROM productos WHERE id = ?`).get(item.producto_id) as { stock_actual: number } | undefined;
            const previo = prod?.stock_actual ?? 0;
            const nuevo = previo - item.cantidad;
            db.prepare(`UPDATE productos SET stock_actual = stock_actual - ?, updated_at = datetime('now') WHERE id = ?`).run(item.cantidad, item.producto_id);
            db.prepare(`
              INSERT INTO stock_movimientos (producto_id, tipo, cantidad, motivo, venta_id, stock_previo, stock_nuevo)
              VALUES (?, 'salida', ?, ?, ?, ?, ?)
            `).run(item.producto_id, item.cantidad, payload.es_fiado ? `Fiado #${numero}` : `Venta #${numero}`, ventaId, previo, nuevo);
          }
        }

        if (tipo === 'venta' && !payload.es_fiado && sesionActiva) {
          db.prepare(`
            INSERT INTO caja_movimientos (sesion_id, tipo, monto, descripcion, metodo_pago, venta_id)
            VALUES (?, 'ingreso', ?, ?, ?, ?)
          `).run(sesionActiva.id, total, `Venta #${numero}`, payload.metodo_pago, ventaId);
        }
      })();

      const ventaCompleta = db.prepare(
        `SELECT v.*, c.nombre as cliente_nombre FROM ventas v LEFT JOIN clientes c ON v.cliente_id = c.id WHERE v.id = ?`
      ).get(ventaId);

      emitToWeb('venta:nueva', { venta: ventaCompleta, total });
      emitToWeb('producto:actualizado', { reload: true });

      if (payload.es_fiado && payload.cliente_id) {
        emitToWeb('fiados:list-changed', { clienteId: payload.cliente_id });
        try { exportFiadosToExcel(db); } catch { /* silencioso */ }
      }

      res.json({ success: true, venta_id: ventaId, numero, total });
    } catch (err) {
      console.error('[POST /api/ventas]', err);
      res.status(500).json({ error: 'Error interno al crear la venta' });
    }
  });

  // ── WEB POS (para PCs clientes en la LAN) ────────────────────────────────
  expressApp.get('/pos', (_req, res) => {
    const configRow = db.prepare('SELECT valor FROM configuracion WHERE clave = ?').get('nombre_negocio') as { valor: string } | undefined;
    const businessName = configRow?.valor || 'ARIESPos';
    const simRow = db.prepare('SELECT valor FROM configuracion WHERE clave = ?').get('simbolo_moneda') as { valor: string } | undefined;
    const simbolo = simRow?.valor || '$';
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    res.setHeader('Surrogate-Control', 'no-store');
    res.send(generatePosHTML(businessName, simbolo));
  });

  // ── CATÁLOGO ONLINE ────────────────────────────────────────────────────────
  expressApp.get('/catalogo', (_req, res) => {
    const rows = db
      .prepare(
        `SELECT p.nombre, p.precio_venta, p.imagen_path, c.nombre as categoria
         FROM productos p
         LEFT JOIN categorias c ON p.categoria_id = c.id
         WHERE p.en_catalogo = 1 AND p.activo = 1
         ORDER BY p.nombre`
      )
      .all() as { nombre: string; precio_venta: number; imagen_path: string | null; categoria: string }[];

    const configRow = db.prepare('SELECT valor FROM configuracion WHERE clave = ?').get('nombre_negocio') as
      | { valor: string }
      | undefined;
    const businessName = configRow?.valor || 'Mi Negocio';
    const monedaRow = db.prepare('SELECT valor FROM configuracion WHERE clave = ?').get('simbolo_moneda') as
      | { valor: string }
      | undefined;
    const simbolo = monedaRow?.valor || '$';

    const html = generateCatalogoHTML(businessName, simbolo, rows);
    res.send(html);
  });

  // ── PANEL ADMIN ────────────────────────────────────────────────────────────
  expressApp.get('/admin', basicAuth, (_req, res) => {
    const stats = getDashboardStats();
    const html = generateAdminHTML(stats);
    res.send(html);
  });

  // ── Endpoint ping para la app móvil (sin auth) ───────────────────────────
  expressApp.get('/api/ping', (_req, res) => {
    const configRow = db.prepare('SELECT valor FROM configuracion WHERE clave = ?').get('nombre_negocio') as { valor: string } | undefined;
    res.json({ status: 'ok', version: '1.0.0', negocio: configRow?.valor || 'ARIESPos' });
  });

  // ── Cambiar PINs (solo admin) ─────────────────────────────────────────────
  expressApp.put('/api/settings/pins', adminOnly, (req, res) => {
    const { tipo, pin_actual, nuevo_pin } = req.body as { tipo: string; pin_actual?: string; nuevo_pin: string };
    if (!nuevo_pin || !/^\d{4,20}$/.test(nuevo_pin)) {
      res.status(400).json({ error: 'El PIN debe tener entre 4 y 20 dígitos numéricos' });
      return;
    }
    if (tipo === 'admin') {
      if (!pin_actual || pin_actual !== getAdminPassword()) {
        res.status(401).json({ error: 'PIN actual incorrecto' });
        return;
      }
      db.prepare('INSERT OR REPLACE INTO configuracion (clave, valor) VALUES (?, ?)').run(ADMIN_PASS_KEY, nuevo_pin);
      res.json({ success: true });
    } else if (tipo === 'cajero') {
      db.prepare('INSERT OR REPLACE INTO configuracion (clave, valor) VALUES (?, ?)').run(CAJERO_PASS_KEY, nuevo_pin);
      res.json({ success: true });
    } else {
      res.status(400).json({ error: 'tipo debe ser admin o cajero' });
    }
  });

  // ── URL de acceso remoto (solo admin) ────────────────────────────────────
  expressApp.get('/api/settings/remote-url', adminOnly, (_req, res) => {
    const localIP = getLocalIP();
    res.json({
      local: `http://${localIP}:${activePort}/pos`,
      tunnel: tunnelUrl ? `${tunnelUrl}/pos` : null,
    });
  });

  // ── Web App Manifest (PWA) ────────────────────────────────────────────────
  expressApp.get('/manifest.json', (_req, res) => {
    const configRow = db.prepare('SELECT valor FROM configuracion WHERE clave = ?').get('nombre_negocio') as { valor: string } | undefined;
    const name = configRow?.valor || 'ARIESPos';
    res.setHeader('Content-Type', 'application/manifest+json');
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    res.json({
      name,
      short_name: 'ARIESPos',
      start_url: '/pos',
      display: 'standalone',
      background_color: '#0f1117',
      theme_color: '#6c63ff',
      orientation: 'portrait',
      icons: [
        { src: '/api/icon', sizes: '192x192', type: 'image/svg+xml' },
        { src: '/api/icon', sizes: '512x512', type: 'image/svg+xml' },
      ],
    });
  });

  // ── Ícono SVG para PWA ────────────────────────────────────────────────────
  expressApp.get('/api/icon', (_req, res) => {
    res.setHeader('Content-Type', 'image/svg+xml');
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    res.send(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 192 192"><rect width="192" height="192" rx="40" fill="#6c63ff"/><text x="50%" y="56%" dominant-baseline="middle" text-anchor="middle" font-family="system-ui,sans-serif" font-size="80" font-weight="900" fill="white">A</text></svg>`);
  });

  // ── CAJA ──────────────────────────────────────────────────────────────────
  expressApp.get('/api/caja/estado', adminOnly, (_req, res) => {
    const sesion = db.prepare(`
      SELECT cs.*, u.nombre as usuario_nombre
      FROM caja_sesiones cs
      LEFT JOIN usuarios u ON cs.usuario_id = u.id
      WHERE cs.fecha_cierre IS NULL ORDER BY cs.id DESC LIMIT 1
    `).get() as Record<string, unknown> | undefined;
    if (!sesion) { res.json({ abierta: false }); return; }
    const totales = db.prepare(`
      SELECT
        COALESCE(SUM(CASE WHEN tipo='ingreso' AND venta_id IS NOT NULL THEN monto ELSE 0 END),0) as total_ventas,
        COALESCE(SUM(CASE WHEN tipo='ingreso' AND venta_id IS NULL THEN monto ELSE 0 END),0) as total_ingresos_extra,
        COALESCE(SUM(CASE WHEN tipo='egreso' THEN monto ELSE 0 END),0) as total_egresos,
        COALESCE(SUM(CASE WHEN tipo='ingreso' AND metodo_pago='efectivo' THEN monto ELSE 0 END),0) as efectivo,
        COALESCE(SUM(CASE WHEN tipo='ingreso' AND metodo_pago='tarjeta' THEN monto ELSE 0 END),0) as tarjeta,
        COALESCE(SUM(CASE WHEN tipo='ingreso' AND metodo_pago='transferencia' THEN monto ELSE 0 END),0) as transferencia,
        COALESCE(SUM(CASE WHEN tipo='ingreso' AND metodo_pago='mercadopago' THEN monto ELSE 0 END),0) as mercadopago
      FROM caja_movimientos WHERE sesion_id = ?
    `).get(sesion.id as number) as Record<string, unknown>;
    res.json({ abierta: true, sesion: { ...sesion, ...totales } });
  });

  expressApp.post('/api/caja/abrir', adminOnly, (req, res) => {
    const existente = db.prepare(`SELECT id FROM caja_sesiones WHERE fecha_cierre IS NULL`).get();
    if (existente) { res.status(400).json({ error: 'Ya hay una caja abierta' }); return; }
    const { monto_inicial = 0 } = req.body as { monto_inicial?: number };
    const result = db.prepare(`INSERT INTO caja_sesiones (monto_inicial) VALUES (?)`).run(monto_inicial);
    emitToWeb('caja:movimiento', { tipo: 'apertura', monto: monto_inicial });
    res.json({ success: true, id: result.lastInsertRowid });
  });

  expressApp.post('/api/caja/cerrar', adminOnly, (req, res) => {
    const sesion = db.prepare(`SELECT id FROM caja_sesiones WHERE fecha_cierre IS NULL ORDER BY id DESC LIMIT 1`).get() as { id: number } | undefined;
    if (!sesion) { res.status(400).json({ error: 'No hay caja abierta' }); return; }
    const { monto_final = 0 } = req.body as { monto_final?: number };
    db.prepare(`UPDATE caja_sesiones SET fecha_cierre = datetime('now'), monto_final = ? WHERE id = ?`).run(monto_final, sesion.id);
    emitToWeb('caja:movimiento', { tipo: 'cierre', monto: monto_final });
    res.json({ success: true });
  });

  expressApp.get('/api/caja/movimientos', adminOnly, (_req, res) => {
    const sesion = db.prepare(`SELECT id FROM caja_sesiones WHERE fecha_cierre IS NULL ORDER BY id DESC LIMIT 1`).get() as { id: number } | undefined;
    if (!sesion) { res.json([]); return; }
    const rows = db.prepare(`
      SELECT cm.*, v.numero as venta_numero
      FROM caja_movimientos cm
      LEFT JOIN ventas v ON cm.venta_id = v.id
      WHERE cm.sesion_id = ?
      ORDER BY cm.id DESC LIMIT 60
    `).all(sesion.id);
    res.json(rows);
  });

  expressApp.post('/api/caja/movimiento', adminOnly, (req, res) => {
    const sesion = db.prepare(`SELECT id FROM caja_sesiones WHERE fecha_cierre IS NULL ORDER BY id DESC LIMIT 1`).get() as { id: number } | undefined;
    if (!sesion) { res.status(400).json({ error: 'No hay caja abierta' }); return; }
    const { tipo, monto, descripcion = '', metodo_pago = 'efectivo' } = req.body as { tipo: string; monto: number; descripcion?: string; metodo_pago?: string };
    if (!['ingreso','egreso'].includes(tipo) || !monto || monto <= 0) {
      res.status(400).json({ error: 'Datos inválidos' }); return;
    }
    db.prepare(`INSERT INTO caja_movimientos (sesion_id, tipo, monto, descripcion, metodo_pago) VALUES (?, ?, ?, ?, ?)`).run(sesion.id, tipo, monto, descripcion, metodo_pago);
    emitToWeb('caja:movimiento', { tipo, monto, descripcion });
    res.json({ success: true });
  });

  // ── PRODUCTOS CRUD ────────────────────────────────────────────────────────
  expressApp.get('/api/productos/:id', basicAuth, (req, res) => {
    const p = db.prepare(`
      SELECT p.*, c.nombre as categoria_nombre
      FROM productos p LEFT JOIN categorias c ON p.categoria_id = c.id
      WHERE p.id = ?
    `).get(parseInt(req.params.id)) as Record<string, unknown> | undefined;
    if (!p) { res.status(404).json({ error: 'Producto no encontrado' }); return; }
    res.json(p);
  });

  expressApp.put('/api/productos/:id', adminOnly, (req, res) => {
    const id = parseInt(req.params.id);
    const { nombre, precio_venta, precio_costo, stock_actual, stock_minimo, activo, en_catalogo } = req.body as {
      nombre?: string; precio_venta?: number; precio_costo?: number;
      stock_actual?: number; stock_minimo?: number; activo?: number; en_catalogo?: number;
    };
    const existe = db.prepare(`SELECT id FROM productos WHERE id = ?`).get(id);
    if (!existe) { res.status(404).json({ error: 'Producto no encontrado' }); return; }
    db.prepare(`
      UPDATE productos SET
        nombre = COALESCE(?, nombre),
        precio_venta = COALESCE(?, precio_venta),
        precio_costo = COALESCE(?, precio_costo),
        stock_actual = COALESCE(?, stock_actual),
        stock_minimo = COALESCE(?, stock_minimo),
        activo = COALESCE(?, activo),
        en_catalogo = COALESCE(?, en_catalogo),
        updated_at = datetime('now')
      WHERE id = ?
    `).run(
      nombre ?? null, precio_venta ?? null, precio_costo ?? null,
      stock_actual ?? null, stock_minimo ?? null, activo ?? null, en_catalogo ?? null, id
    );
    emitToWeb('producto:actualizado', { reload: true });
    res.json({ success: true });
  });

  // ── COBRAR FIADO ──────────────────────────────────────────────────────────
  expressApp.put('/api/fiados/:id/cobrar', basicAuth, (req, res) => {
    const id = parseInt(req.params.id);
    const fiado = db.prepare(`SELECT * FROM ventas WHERE id = ? AND es_fiado = 1`).get(id) as Record<string, unknown> | undefined;
    if (!fiado) { res.status(404).json({ error: 'Fiado no encontrado' }); return; }
    if (fiado.estado === 'pagado') { res.status(400).json({ error: 'Ya está pagado' }); return; }

    const { monto, metodo_pago = 'efectivo' } = req.body as { monto?: number; metodo_pago?: string };
    const total = Number(fiado.total) || 0;
    const yaPagado = Number(fiado.monto_pagado) || 0;
    const pendiente = total - yaPagado;

    if (!monto || monto <= 0) { res.status(400).json({ error: 'Monto inválido' }); return; }
    if (monto > pendiente + 0.001) { res.status(400).json({ error: `El monto excede lo pendiente (${pendiente.toFixed(2)})` }); return; }

    const nuevoPagado = yaPagado + monto;
    const pagadoTotal = nuevoPagado >= total - 0.001;
    const nuevoEstado = pagadoTotal ? 'pagado' : 'fiado';

    db.prepare(`UPDATE ventas SET monto_pagado = ?, estado = ? WHERE id = ?`).run(
      Math.min(nuevoPagado, total), nuevoEstado, id
    );

    const sesion = db.prepare(`SELECT id FROM caja_sesiones WHERE fecha_cierre IS NULL ORDER BY id DESC LIMIT 1`).get() as { id: number } | undefined;
    if (sesion) {
      const desc = pagadoTotal
        ? `Cobro fiado #${fiado.numero}`
        : `Pago parcial fiado #${fiado.numero}`;
      db.prepare(`INSERT INTO caja_movimientos (sesion_id, tipo, monto, descripcion, metodo_pago, venta_id) VALUES (?, 'ingreso', ?, ?, ?, ?)`).run(sesion.id, monto, desc, metodo_pago, id);
    }

    emitToWeb('fiado:cobrado', { id, monto, total, nuevoPagado, pagadoTotal });
    emitToWeb('fiados:list-changed', { id });
    res.json({ success: true, pagado_total: pagadoTotal, nuevo_pagado: nuevoPagado, pendiente: total - nuevoPagado });
  });

  // ── /api/sync/* — Sincronización multi-PC ─────────────────────────────────
  expressApp.use('/api/sync', basicAuth, createSyncRouter(io, exportFiadosToExcel));

  // ── Socket.IO ─────────────────────────────────────────────────────────────
  io.on('connection', (socket) => {
    console.log(`[Socket.IO] Cliente conectado: ${socket.id}`);

    // Enviar estado inicial
    const stats = getDashboardStats();
    socket.emit('stats:update', stats);

    // ── HANDLERS MOBILE ─────────────────────────────────────────────────────

    // Identificación del cliente móvil
    socket.on('mobile:identify', (info: { type: string; platform: string }) => {
      console.log(`[Mobile] Cliente identificado: ${info.platform} (${socket.id})`);
      const configRow = db.prepare('SELECT valor FROM configuracion WHERE clave = ?').get('nombre_negocio') as { valor: string } | undefined;
      socket.emit('server:info', {
        version: '1.0.0',
        negocio: configRow?.valor || 'ARIESPos',
      });
    });

    // Escáner: buscar producto por código de barras y agregar al carrito del POS
    socket.on('scanner:barcode', ({ barcode, cantidad }: { barcode: string; cantidad: number }) => {
      const product = db.prepare(
        `SELECT id, codigo, codigo_barras, nombre, precio_venta, precio_costo,
                stock_actual, stock_minimo, unidad_medida, fraccionable, imagen_path
         FROM productos WHERE (codigo_barras = ? OR codigo = ?) AND activo = 1 LIMIT 1`
      ).get(barcode, barcode) as Record<string, unknown> | undefined;

      if (product) {
        // Notificar a la ventana Electron (POS de la PC) vía IPC
        try {
          const { mainWindow } = require('../main');
          mainWindow?.webContents.send('scanner:add-to-cart', { product, cantidad: cantidad || 1 });
        } catch { /* mainWindow puede no estar disponible */ }
        socket.emit('scanner:product-found', product);
      } else {
        socket.emit('scanner:product-not-found', { barcode });
      }
    });

    // Escáner: consultar stock sin agregar al carrito
    socket.on('scanner:check-stock', ({ barcode }: { barcode: string }) => {
      const product = db.prepare(
        `SELECT id, nombre, stock_actual, stock_minimo, unidad_medida, precio_venta
         FROM productos WHERE (codigo_barras = ? OR codigo = ?) AND activo = 1 LIMIT 1`
      ).get(barcode, barcode) as Record<string, unknown> | undefined;
      socket.emit('scanner:stock-info', product || null);
    });

    // Escáner: consultar precio
    socket.on('scanner:check-price', ({ barcode }: { barcode: string }) => {
      const product = db.prepare(
        `SELECT id, nombre, precio_venta, precio_costo, stock_actual, unidad_medida
         FROM productos WHERE (codigo_barras = ? OR codigo = ?) AND activo = 1 LIMIT 1`
      ).get(barcode, barcode) as Record<string, unknown> | undefined;
      socket.emit('scanner:price-info', product || null);
    });

    // Escáner: modo inventario (ajustar stock)
    socket.on('scanner:inventory-count', ({ barcode, cantidad }: { barcode: string; cantidad: number }) => {
      const product = db.prepare(
        `SELECT id, nombre, stock_actual, unidad_medida FROM productos
         WHERE (codigo_barras = ? OR codigo = ?) AND activo = 1 LIMIT 1`
      ).get(barcode, barcode) as { id: number; nombre: string; stock_actual: number; unidad_medida: string } | undefined;

      if (!product) { socket.emit('scanner:inventory-updated', null); return; }

      const previo = product.stock_actual;
      const nuevo = previo + cantidad;
      db.prepare(`UPDATE productos SET stock_actual = ?, updated_at = datetime('now') WHERE id = ?`).run(nuevo, product.id);
      db.prepare(`
        INSERT INTO stock_movimientos (producto_id, tipo, cantidad, motivo, stock_previo, stock_nuevo)
        VALUES (?, 'entrada', ?, 'Conteo inventario móvil', ?, ?)
      `).run(product.id, cantidad, previo, nuevo);

      emitToWeb('stock:actualizado', { producto_id: product.id });
      socket.emit('scanner:inventory-updated', { ...product, stock_actual: nuevo });
    });

    // POS móvil: búsqueda de productos
    socket.on('products:search', ({ query }: { query: string }) => {
      const results = db.prepare(`
        SELECT id, codigo, codigo_barras, nombre, precio_venta, precio_costo,
               stock_actual, stock_minimo, unidad_medida, fraccionable, imagen_path
        FROM productos
        WHERE activo = 1 AND (
          nombre LIKE '%' || ? || '%'
          OR codigo LIKE '%' || ? || '%'
          OR codigo_barras = ?
        )
        ORDER BY
          CASE WHEN LOWER(nombre) LIKE LOWER(?) || '%' THEN 0 ELSE 1 END,
          nombre
        LIMIT 15
      `).all(query, query, query, query);
      socket.emit('products:search-results', results);
    });

    // POS móvil: crear venta
    socket.on('pos:create-sale', (saleData: {
      items: Array<{ id: number; nombre: string; cantidad: number; precioVenta: number; total: number }>;
      metodoPago: string;
      esFiado: boolean;
      clienteId?: number;
      source: string;
    }) => {
      try {
        if (!saleData?.items?.length) throw new Error('items requeridos');

        const numero = `VM${Date.now()}`;
        const ahora = new Date();
        const fecha = ahora.toISOString().split('T')[0];
        const hora = ahora.toTimeString().split(' ')[0];
        const subtotal = saleData.items.reduce((s, i) => s + i.total, 0);
        const total = subtotal;
        const metodo = saleData.esFiado ? 'fiado' : saleData.metodoPago;

        const sesionActiva = db.prepare(
          `SELECT id FROM caja_sesiones WHERE fecha_cierre IS NULL ORDER BY id DESC LIMIT 1`
        ).get() as { id: number } | undefined;

        let ventaId = 0;

        db.transaction(() => {
          const result = db.prepare(`
            INSERT INTO ventas (numero, tipo, estado, fecha, hora, cliente_id, vendedor_id,
              subtotal, descuento, total, metodo_pago, es_fiado, observaciones)
            VALUES (?, 'venta', ?, ?, ?, ?, NULL, ?, 0, ?, ?, ?, ?)
          `).run(
            numero,
            saleData.esFiado ? 'fiado' : 'completada',
            fecha, hora,
            saleData.clienteId || null,
            subtotal, total, metodo,
            saleData.esFiado ? 1 : 0,
            `Venta desde app móvil (${saleData.source})`
          );
          ventaId = result.lastInsertRowid as number;

          for (const item of saleData.items) {
            db.prepare(`
              INSERT INTO venta_items (venta_id, producto_id, cantidad, precio_unitario, descuento, total)
              VALUES (?, ?, ?, ?, 0, ?)
            `).run(ventaId, item.id, item.cantidad, item.precioVenta, item.total);

            const prod = db.prepare(`SELECT stock_actual FROM productos WHERE id = ?`).get(item.id) as { stock_actual: number } | undefined;
            const previo = prod?.stock_actual ?? 0;
            const nuevo = previo - item.cantidad;
            db.prepare(`UPDATE productos SET stock_actual = stock_actual - ?, updated_at = datetime('now') WHERE id = ?`).run(item.cantidad, item.id);
            db.prepare(`
              INSERT INTO stock_movimientos (producto_id, tipo, cantidad, motivo, venta_id, stock_previo, stock_nuevo)
              VALUES (?, 'salida', ?, ?, ?, ?, ?)
            `).run(item.id, item.cantidad, `Venta móvil #${numero}`, ventaId, previo, nuevo);
          }

          if (!saleData.esFiado && sesionActiva) {
            db.prepare(`
              INSERT INTO caja_movimientos (sesion_id, tipo, monto, descripcion, metodo_pago, venta_id)
              VALUES (?, 'ingreso', ?, ?, ?, ?)
            `).run(sesionActiva.id, total, `Venta móvil #${numero}`, metodo, ventaId);
          }
        })();

        emitToWeb('venta:nueva', { numero, total });
        emitToWeb('producto:actualizado', { reload: true });
        io.emit('sale:created', { id: ventaId, numero, total, fecha, hora });

        socket.emit('pos:sale-created', { id: ventaId, numero, total });
      } catch (err) {
        socket.emit('pos:sale-error', { message: String(err) });
      }
    });

    // Panel admin móvil: estadísticas
    socket.on('admin:get-stats', () => {
      const today = new Date().toISOString().split('T')[0];

      const ventasHoy = (db.prepare(
        `SELECT COALESCE(SUM(total),0) as v FROM ventas WHERE fecha = ? AND tipo = 'venta'`
      ).get(today) as { v: number }).v;

      const transacciones = (db.prepare(
        `SELECT COUNT(*) as c FROM ventas WHERE fecha = ? AND tipo = 'venta'`
      ).get(today) as { c: number }).c;

      const fiadosPendientes = (db.prepare(
        `SELECT COALESCE(SUM(total),0) as v FROM ventas WHERE es_fiado = 1 AND estado != 'pagado' AND tipo = 'venta'`
      ).get() as { v: number }).v;

      const stockCritico = (db.prepare(
        `SELECT COUNT(*) as c FROM productos WHERE stock_actual <= stock_minimo AND activo = 1`
      ).get() as { c: number }).c;

      const ultimasVentas = db.prepare(`
        SELECT v.id, v.numero, v.total, v.hora, v.metodo_pago, c.nombre as cliente_nombre
        FROM ventas v LEFT JOIN clientes c ON v.cliente_id = c.id
        WHERE v.fecha = ? AND v.tipo = 'venta'
        ORDER BY v.created_at DESC LIMIT 10
      `).all(today);

      const productosStockBajo = db.prepare(`
        SELECT id, nombre, stock_actual, stock_minimo, unidad_medida
        FROM productos WHERE stock_actual <= stock_minimo AND activo = 1
        ORDER BY stock_actual ASC LIMIT 20
      `).all();

      socket.emit('admin:stats', {
        ventasHoy,
        transacciones,
        fiadosPendientes,
        stockCritico,
        ultimasVentas,
        productosStockBajo,
      });
    });

    // ── FIN HANDLERS MOBILE ──────────────────────────────────────────────────

    socket.on('disconnect', () => {
      console.log(`[Socket.IO] Cliente desconectado: ${socket.id}`);
    });
  });

  function tryListen(port: number) {
    httpServer.listen(port, '0.0.0.0', () => {
      activePort = port;
      const localIP = getLocalIP();
      console.log(`[Servidor] Express + Socket.IO corriendo en puerto ${port}`);
      console.log(`[Servidor] POS Local: http://${localIP}:${port}/pos`);
      console.log(`[Servidor] Catálogo: http://localhost:${port}/catalogo`);
      console.log(`[Servidor] Admin: http://localhost:${port}/admin`);
      startTunnel(port);
    });
  }

  httpServer.on('error', (err: NodeJS.ErrnoException) => {
    if (err.code === 'EADDRINUSE') {
      console.log(`[Servidor] Puerto ${PORT} ocupado, intentando ${PORT + 1}...`);
      httpServer.close();
      tryListen(PORT + 1);
    } else {
      console.error('[Servidor] Error al iniciar:', err);
    }
  });

  tryListen(PORT);
}

export function emitToWeb(event: string, data: unknown): void {
  // Emitir a clientes web/móvil vía Socket.IO
  if (io) {
    io.emit(event, data);
  }
  // Notificar también al renderer Electron local (modo servidor)
  try {
    const { BrowserWindow } = require('electron');
    for (const win of (BrowserWindow.getAllWindows() as Electron.BrowserWindow[])) {
      if (!win.isDestroyed()) {
        win.webContents.send(event, data);
      }
    }
  } catch { /* ignorar si electron no está disponible */ }
  // Marcar cambio en configuracion para que el polling de clientes lo detecte
  try {
    const db = getDb();
    db.prepare(`INSERT OR REPLACE INTO configuracion (clave, valor) VALUES ('last_data_change', ?)`).run(new Date().toISOString());
  } catch { /* ignorar */ }
}

function getDashboardStats() {
  const db = getDb();
  const today = new Date().toISOString().split('T')[0];
  const weekStart = new Date();
  weekStart.setDate(weekStart.getDate() - 7);
  const monthStart = new Date();
  monthStart.setDate(1);

  const ventasHoy =
    (
      db
        .prepare(`SELECT COALESCE(SUM(total),0) as total FROM ventas WHERE fecha = ? AND tipo = 'venta'`)
        .get(today) as { total: number }
    ).total || 0;

  const ventasSemana =
    (
      db
        .prepare(
          `SELECT COALESCE(SUM(total),0) as total FROM ventas WHERE fecha >= ? AND tipo = 'venta'`
        )
        .get(weekStart.toISOString().split('T')[0]) as { total: number }
    ).total || 0;

  const ventasMes =
    (
      db
        .prepare(
          `SELECT COALESCE(SUM(total),0) as total FROM ventas WHERE fecha >= ? AND tipo = 'venta'`
        )
        .get(monthStart.toISOString().split('T')[0]) as { total: number }
    ).total || 0;

  const stockBajo =
    (
      db
        .prepare(`SELECT COUNT(*) as c FROM productos WHERE stock_actual <= stock_minimo AND activo = 1`)
        .get() as { c: number }
    ).c || 0;

  const fiadosPendientes =
    (
      db
        .prepare(
          `SELECT COALESCE(SUM(total),0) as total FROM ventas WHERE es_fiado = 1 AND estado != 'pagado' AND tipo = 'venta'`
        )
        .get() as { total: number }
    ).total || 0;

  return {
    ventasHoy,
    ventasSemana,
    ventasMes,
    stockBajo,
    fiadosPendientes,
    timestamp: new Date().toISOString(),
  };
}

function generateCatalogoHTML(
  businessName: string,
  simbolo: string,
  products: { nombre: string; precio_venta: number; imagen_path: string | null; categoria: string }[]
): string {
  const cards = products
    .map(
      (p) => `
    <div class="card">
      ${p.imagen_path ? `<img src="/images/${p.imagen_path}" alt="${p.nombre}" onerror="this.src='data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI4MCIgaGVpZ2h0PSI4MCIgdmlld0JveD0iMCAwIDI0IDI0IiBmaWxsPSJub25lIiBzdHJva2U9IiM2MzY2ZjEiIHN0cm9rZS13aWR0aD0iMiI+PHJlY3QgeD0iMyIgeT0iMyIgd2lkdGg9IjE4IiBoZWlnaHQ9IjE4IiByeD0iMiIvPjxjaXJjbGUgY3g9IjguNSIgY3k9IjguNSIgcj0iMS41Ii8+PHBvbHlsaW5lIHBvaW50cz0iMjEgMTUgMTYgMTAgNSAyMSIvPjwvc3ZnPg=='">` : `<div class="no-img">📦</div>`}
      <div class="info">
        <div class="cat">${p.categoria || 'General'}</div>
        <div class="name">${p.nombre}</div>
        <div class="price">${simbolo} ${p.precio_venta.toFixed(2)}</div>
      </div>
    </div>`
    )
    .join('');

  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${businessName} - Catálogo</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: 'Segoe UI', sans-serif; background: #0f172a; color: #e2e8f0; }
    header { background: #1e293b; padding: 1.5rem 2rem; border-bottom: 1px solid #334155; }
    header h1 { color: #2563eb; font-size: 1.8rem; }
    header p { color: #94a3b8; margin-top: 0.25rem; }
    .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 1.5rem; padding: 2rem; }
    .card { background: #1e293b; border: 1px solid #334155; border-radius: 12px; overflow: hidden; transition: transform 0.2s; }
    .card:hover { transform: translateY(-4px); }
    .card img, .card .no-img { width: 100%; height: 180px; object-fit: cover; display: flex; align-items: center; justify-content: center; font-size: 3rem; background: #334155; }
    .info { padding: 1rem; }
    .cat { font-size: 0.75rem; color: #6366f1; text-transform: uppercase; font-weight: 600; margin-bottom: 0.25rem; }
    .name { font-size: 1rem; font-weight: 600; margin-bottom: 0.5rem; }
    .price { font-size: 1.5rem; font-weight: 700; color: #22c55e; }
    .empty { text-align: center; padding: 4rem; color: #94a3b8; }
    footer { text-align: center; padding: 2rem; color: #475569; font-size: 0.875rem; border-top: 1px solid #1e293b; }
  </style>
</head>
<body>
  <header>
    <h1>${businessName}</h1>
    <p>Catálogo de productos • ${new Date().toLocaleDateString('es-AR')}</p>
  </header>
  ${products.length ? `<div class="grid">${cards}</div>` : '<div class="empty"><p>No hay productos disponibles en el catálogo.</p></div>'}
  <footer>Powered by ARIESPos</footer>
</body>
</html>`;
}

function generateAdminHTML(stats: ReturnType<typeof getDashboardStats>): string {
  const now = new Date().toLocaleString('es-AR');
  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0">
  <meta name="mobile-web-app-capable" content="yes">
  <meta name="apple-mobile-web-app-capable" content="yes">
  <meta name="apple-mobile-web-app-status-bar-style" content="black">
  <title>ARIESPos Admin</title>
  <script src="/socket.io/socket.io.js"></script>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    :root {
      --bg: #0f172a; --bg2: #1e293b; --bg3: #1a2744;
      --border: #334155; --text: #e2e8f0; --text2: #94a3b8; --text3: #64748b;
      --accent: #3b82f6; --green: #22c55e; --red: #ef4444; --yellow: #f59e0b;
    }
    html, body { height: 100%; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: var(--bg); color: var(--text); display: flex; flex-direction: column; }
    header { background: var(--bg2); border-bottom: 1px solid var(--border); padding: 12px 16px; display: flex; align-items: center; justify-content: space-between; flex-shrink: 0; }
    .logo { width: 34px; height: 34px; background: var(--accent); border-radius: 8px; display: flex; align-items: center; justify-content: center; font-weight: 800; font-size: 17px; color: white; margin-right: 10px; }
    .header-title { font-weight: 700; font-size: 15px; line-height: 1.2; }
    .header-sub { font-size: 11px; color: var(--text2); }
    .badge { display: inline-flex; align-items: center; gap: 5px; padding: 4px 10px; border-radius: 20px; font-size: 11px; font-weight: 600; background: var(--green); color: white; }
    .badge.offline { background: var(--red); }
    .badge::before { content: ''; width: 6px; height: 6px; border-radius: 50%; background: rgba(255,255,255,.8); display: inline-block; }
    .content { flex: 1; overflow-y: auto; padding: 14px 14px 80px; }
    .tab-pane { display: none; }
    .tab-pane.active { display: block; }
    .kpi-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 14px; }
    .kpi-card { background: var(--bg2); border: 1px solid var(--border); border-radius: 12px; padding: 14px 12px; }
    .kpi-label { font-size: 10px; color: var(--text2); font-weight: 600; text-transform: uppercase; letter-spacing: .05em; margin-bottom: 5px; }
    .kpi-value { font-size: 20px; font-weight: 700; font-variant-numeric: tabular-nums; line-height: 1; }
    .c-green { color: var(--green); } .c-blue { color: var(--accent); } .c-yellow { color: var(--yellow); } .c-red { color: var(--red); }
    .kpi-card.wide { grid-column: span 2; }
    .last-updated { font-size: 11px; color: var(--text3); text-align: center; margin-top: 4px; margin-bottom: 4px; }
    .section-title { font-size: 10px; color: var(--text3); text-transform: uppercase; letter-spacing: .06em; font-weight: 700; margin: 14px 0 8px; }
    .list-card { background: var(--bg2); border: 1px solid var(--border); border-radius: 12px; overflow: hidden; }
    .list-item { padding: 11px 14px; border-bottom: 1px solid var(--border); display: flex; align-items: center; justify-content: space-between; gap: 8px; }
    .list-item:last-child { border-bottom: none; }
    .li-main { flex: 1; min-width: 0; }
    .li-title { font-size: 13px; font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .li-sub { font-size: 11px; color: var(--text2); margin-top: 2px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .li-amount { font-size: 14px; font-weight: 700; font-variant-numeric: tabular-nums; white-space: nowrap; }
    .chip { display: inline-block; padding: 2px 7px; border-radius: 20px; font-size: 10px; font-weight: 700; margin-left: 3px; }
    .ch-g { background:rgba(34,197,94,.15); color:var(--green); } .ch-y { background:rgba(245,158,11,.15); color:var(--yellow); } .ch-r { background:rgba(239,68,68,.15); color:var(--red); } .ch-b { background:rgba(59,130,246,.15); color:var(--accent); }
    .empty { text-align: center; padding: 28px 16px; color: var(--text3); font-size: 13px; }
    .empty-icon { font-size: 30px; margin-bottom: 6px; }
    .loading { text-align: center; padding: 22px; color: var(--text3); font-size: 13px; }
    .btn-refresh { background: var(--bg2); border: 1px solid var(--border); color: var(--text2); padding: 7px 12px; border-radius: 8px; font-size: 12px; cursor: pointer; display: flex; align-items: center; gap: 5px; margin: 0 0 10px auto; }
    .btn-refresh:active { opacity: .6; }
    .total-row { background: var(--bg3) !important; }
    .stock-bar { height: 5px; background: var(--bg3); border-radius: 3px; margin-top: 5px; overflow: hidden; }
    .stock-bar-fill { height: 100%; border-radius: 3px; }
    nav { position: fixed; bottom: 0; left: 0; right: 0; background: var(--bg2); border-top: 1px solid var(--border); display: flex; z-index: 100; }
    .nav-btn { flex: 1; padding: 9px 4px 11px; border: none; background: transparent; color: var(--text3); cursor: pointer; display: flex; flex-direction: column; align-items: center; gap: 3px; font-size: 9px; font-weight: 700; text-transform: uppercase; letter-spacing: .05em; transition: color .15s; -webkit-tap-highlight-color: transparent; }
    .nav-btn.active { color: var(--accent); }
    .nav-btn svg { width: 20px; height: 20px; stroke: currentColor; fill: none; stroke-width: 1.75; stroke-linecap: round; stroke-linejoin: round; }
    @media (min-width: 600px) {
      .kpi-grid { grid-template-columns: repeat(3, 1fr); }
      .kpi-card.wide { grid-column: span 1; }
      .content { padding: 18px 22px 80px; max-width: 820px; margin: 0 auto; }
    }
  </style>
</head>
<body>
<header>
  <div style="display:flex;align-items:center">
    <div class="logo">A</div>
    <div><div class="header-title">ARIESPos</div><div class="header-sub">Panel de Administración</div></div>
  </div>
  <span id="conn-badge" class="badge offline">Conectando</span>
</header>

<div class="content">

  <!-- RESUMEN -->
  <div id="tab-resumen" class="tab-pane active">
    <div class="kpi-grid">
      <div class="kpi-card"><div class="kpi-label">Ventas hoy</div><div class="kpi-value c-green" id="k-hoy">$${stats.ventasHoy.toFixed(2)}</div></div>
      <div class="kpi-card"><div class="kpi-label">Esta semana</div><div class="kpi-value c-blue" id="k-semana">$${stats.ventasSemana.toFixed(2)}</div></div>
      <div class="kpi-card"><div class="kpi-label">Este mes</div><div class="kpi-value c-blue" id="k-mes">$${stats.ventasMes.toFixed(2)}</div></div>
      <div class="kpi-card"><div class="kpi-label">Fiados pendientes</div><div class="kpi-value c-yellow" id="k-fiados">$${stats.fiadosPendientes.toFixed(2)}</div></div>
      <div class="kpi-card wide"><div class="kpi-label">Stock bajo mínimo</div><div class="kpi-value ${stats.stockBajo > 0 ? 'c-red' : 'c-green'}" id="k-stock">${stats.stockBajo} productos</div></div>
    </div>
    <div class="last-updated" id="last-updated">Actualizado: ${now}</div>
    <div class="section-title">Accesos directos</div>
    <div class="list-card">
      <div class="list-item"><div class="li-main"><div class="li-title">Catálogo online</div><div class="li-sub">Visible para clientes sin contraseña</div></div><a href="/catalogo" style="color:var(--accent);font-size:12px;font-weight:600;white-space:nowrap">Abrir →</a></div>
      <div class="list-item"><div class="li-main"><div class="li-title">API Ventas hoy</div><div class="li-sub">/api/ventas/hoy · JSON</div></div><a href="/api/ventas/hoy" style="color:var(--accent);font-size:12px;font-weight:600;white-space:nowrap">Ver →</a></div>
      <div class="list-item"><div class="li-main"><div class="li-title">API Productos</div><div class="li-sub">/api/productos · JSON</div></div><a href="/api/productos" style="color:var(--accent);font-size:12px;font-weight:600;white-space:nowrap">Ver →</a></div>
    </div>
  </div>

  <!-- VENTAS HOY -->
  <div id="tab-ventas" class="tab-pane">
    <button class="btn-refresh" onclick="loadVentas()">↻ Actualizar</button>
    <div id="ventas-list" class="list-card"><div class="loading">Cargando...</div></div>
  </div>

  <!-- FIADOS -->
  <div id="tab-fiados" class="tab-pane">
    <button class="btn-refresh" onclick="loadFiados()">↻ Actualizar</button>
    <div id="fiados-list" class="list-card"><div class="loading">Cargando...</div></div>
  </div>

  <!-- STOCK -->
  <div id="tab-stock" class="tab-pane">
    <button class="btn-refresh" onclick="loadStock()">↻ Actualizar</button>
    <div id="stock-list" class="list-card"><div class="loading">Cargando...</div></div>
  </div>

</div>

<nav>
  <button class="nav-btn active" id="nav-resumen" onclick="switchTab('resumen')">
    <svg viewBox="0 0 24 24"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>Resumen
  </button>
  <button class="nav-btn" id="nav-ventas" onclick="switchTab('ventas')">
    <svg viewBox="0 0 24 24"><path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 01-8 0"/></svg>Ventas
  </button>
  <button class="nav-btn" id="nav-fiados" onclick="switchTab('fiados')">
    <svg viewBox="0 0 24 24"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6"/></svg>Fiados
  </button>
  <button class="nav-btn" id="nav-stock" onclick="switchTab('stock')">
    <svg viewBox="0 0 24 24"><path d="M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg>Stock
  </button>
</nav>

<script>
  const fmt = n => '$' + Number(n).toLocaleString('es-AR', {minimumFractionDigits:2, maximumFractionDigits:2});
  const fmtDate = s => s ? s.split('T')[0].split('-').reverse().join('/') : '';
  const fmtTime = s => s ? String(s).slice(0,5) : '';

  let currentTab = 'resumen';
  const loaded = { ventas: false, fiados: false, stock: false };

  function switchTab(tab) {
    document.getElementById('tab-' + currentTab).classList.remove('active');
    document.getElementById('nav-' + currentTab).classList.remove('active');
    currentTab = tab;
    document.getElementById('tab-' + tab).classList.add('active');
    document.getElementById('nav-' + tab).classList.add('active');
    if (!loaded[tab]) {
      if (tab === 'ventas') loadVentas();
      if (tab === 'fiados') loadFiados();
      if (tab === 'stock') loadStock();
    }
  }

  async function apiFetch(url) {
    const r = await fetch(url, { credentials: 'include' });
    if (!r.ok) throw new Error(r.status);
    return r.json();
  }

  async function loadVentas() {
    const el = document.getElementById('ventas-list');
    el.innerHTML = '<div class="loading">Cargando ventas de hoy...</div>';
    try {
      const data = await apiFetch('/api/ventas/hoy');
      loaded.ventas = true;
      if (!data.length) { el.innerHTML = '<div class="empty"><div class="empty-icon">🛒</div>Sin ventas registradas hoy</div>'; return; }
      const total = data.reduce((s, v) => s + Number(v.total || 0), 0);
      el.innerHTML = data.map(v => {
        const chip = v.es_fiado ? '<span class="chip ch-y">Fiado</span>' : '<span class="chip ch-g">Pagado</span>';
        return \`<div class="list-item">
          <div class="li-main">
            <div class="li-title">\${v.cliente_nombre || 'Consumidor final'}</div>
            <div class="li-sub">\${fmtTime(v.hora)} · #\${v.numero} · \${v.metodo_pago || ''}\${chip}</div>
          </div>
          <div class="li-amount c-green">\${fmt(v.total)}</div>
        </div>\`;
      }).join('') + \`<div class="list-item total-row">
        <div class="li-main"><div class="li-title" style="color:var(--text2)">\${data.length} ventas hoy</div></div>
        <div class="li-amount c-blue" style="font-size:16px">\${fmt(total)}</div>
      </div>\`;
    } catch(e) { el.innerHTML = '<div class="empty"><div class="empty-icon">⚠️</div>Error al cargar</div>'; }
  }

  async function loadFiados() {
    const el = document.getElementById('fiados-list');
    el.innerHTML = '<div class="loading">Cargando fiados...</div>';
    try {
      const data = await apiFetch('/api/fiados');
      loaded.fiados = true;
      if (!data.length) { el.innerHTML = '<div class="empty"><div class="empty-icon">✅</div>No hay fiados pendientes</div>'; return; }
      const total = data.reduce((s, v) => s + Math.max(0, Number(v.total||0) - Number(v.monto_pagado||0)), 0);
      el.innerHTML = data.map(v => {
        const deuda = Math.max(0, Number(v.total||0) - Number(v.monto_pagado||0));
        const chip = v.estado === 'parcial' ? '<span class="chip ch-y">Parcial</span>' : '<span class="chip ch-r">Pendiente</span>';
        const tel = v.cliente_telefono ? \` · \${v.cliente_telefono}\` : '';
        return \`<div class="list-item">
          <div class="li-main">
            <div class="li-title">\${v.cliente_nombre || 'Sin cliente'}</div>
            <div class="li-sub">\${fmtDate(v.fecha)}\${tel}\${chip}</div>
          </div>
          <div class="li-amount c-yellow">\${fmt(deuda)}</div>
        </div>\`;
      }).join('') + \`<div class="list-item total-row">
        <div class="li-main"><div class="li-title" style="color:var(--text2)">\${data.length} fiados</div></div>
        <div class="li-amount c-yellow" style="font-size:16px">\${fmt(total)}</div>
      </div>\`;
    } catch(e) { el.innerHTML = '<div class="empty"><div class="empty-icon">⚠️</div>Error al cargar</div>'; }
  }

  async function loadStock() {
    const el = document.getElementById('stock-list');
    el.innerHTML = '<div class="loading">Cargando stock...</div>';
    try {
      const data = await apiFetch('/api/stock/alertas');
      loaded.stock = true;
      if (!data.length) { el.innerHTML = '<div class="empty"><div class="empty-icon">📦</div>Todo el stock está bien</div>'; return; }
      el.innerHTML = data.map(p => {
        const pct = p.stock_minimo > 0 ? Math.min(100, Math.round(p.stock_actual / p.stock_minimo * 100)) : 0;
        const col = p.stock_actual <= 0 ? 'var(--red)' : 'var(--yellow)';
        const chip = p.stock_actual <= 0 ? '<span class="chip ch-r">Sin stock</span>' : '<span class="chip ch-y">Bajo</span>';
        return \`<div class="list-item">
          <div class="li-main" style="width:100%">
            <div style="display:flex;justify-content:space-between;align-items:center">
              <div class="li-title" style="font-size:12px">\${p.nombre}</div>
              <div style="font-size:12px;font-weight:700;color:\${col}">\${p.stock_actual} / \${p.stock_minimo}\${chip}</div>
            </div>
            <div class="stock-bar"><div class="stock-bar-fill" style="width:\${pct}%;background:\${col}"></div></div>
          </div>
        </div>\`;
      }).join('');
    } catch(e) { el.innerHTML = '<div class="empty"><div class="empty-icon">⚠️</div>Error al cargar</div>'; }
  }

  // Socket.IO
  const socket = io();
  const badge = document.getElementById('conn-badge');
  socket.on('connect', () => { badge.textContent = 'En línea'; badge.className = 'badge'; });
  socket.on('disconnect', () => { badge.textContent = 'Offline'; badge.className = 'badge offline'; });
  socket.on('stats:update', d => {
    document.getElementById('k-hoy').textContent = fmt(d.ventasHoy);
    document.getElementById('k-semana').textContent = fmt(d.ventasSemana);
    document.getElementById('k-mes').textContent = fmt(d.ventasMes);
    document.getElementById('k-fiados').textContent = fmt(d.fiadosPendientes);
    const ks = document.getElementById('k-stock');
    ks.textContent = d.stockBajo + ' productos';
    ks.className = 'kpi-value ' + (d.stockBajo > 0 ? 'c-red' : 'c-green');
    document.getElementById('last-updated').textContent = 'Actualizado: ' + new Date().toLocaleTimeString('es-AR');
  });
  socket.on('venta:nueva', () => {
    if (currentTab === 'ventas') { loaded.ventas = false; loadVentas(); }
  });
  // Auto-refresh cada 5 min
  setInterval(() => {
    if (currentTab === 'ventas') { loaded.ventas = false; loadVentas(); }
    else if (currentTab === 'fiados') { loaded.fiados = false; loadFiados(); }
    else if (currentTab === 'stock') { loaded.stock = false; loadStock(); }
  }, 300000);
</script>
</body>
</html>`;
}
