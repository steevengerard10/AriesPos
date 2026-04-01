/**
 * clientProxyHandlers.ts
 *
 * Modo CLIENTE: registra handlers IPC que proxifican todas las operaciones de datos
 * al servidor principal via HTTP. El renderer no cambia nada — sigue usando IPC
 * igual que siempre; este módulo redirige las llamadas al servidor.
 */

import { ipcMain, dialog, BrowserWindow } from 'electron';
import * as os from 'os';

let _base = '';
let _auth = '';

function init(serverIP: string, port: number, password = '159753'): void {
  _base = `http://${serverIP}:${port}`;
  _auth = 'Basic ' + Buffer.from(`admin:${password}`).toString('base64');
}

async function get(path: string): Promise<unknown> {
  const res = await fetch(`${_base}${path}`, {
    headers: { Authorization: _auth, 'Content-Type': 'application/json' },
  });
  if (!res.ok) {
    const err = await res.text().catch(() => res.statusText);
    throw new Error(`GET ${path} → ${res.status}: ${err}`);
  }
  return res.json();
}

async function post(path: string, body: unknown = {}): Promise<unknown> {
  const res = await fetch(`${_base}${path}`, {
    method: 'POST',
    headers: { Authorization: _auth, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.text().catch(() => res.statusText);
    throw new Error(`POST ${path} → ${res.status}: ${err}`);
  }
  return res.json();
}

async function put(path: string, body: unknown = {}): Promise<unknown> {
  const res = await fetch(`${_base}${path}`, {
    method: 'PUT',
    headers: { Authorization: _auth, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.text().catch(() => res.statusText);
    throw new Error(`PUT ${path} → ${res.status}: ${err}`);
  }
  return res.json();
}

async function del(path: string): Promise<unknown> {
  const res = await fetch(`${_base}${path}`, {
    method: 'DELETE',
    headers: { Authorization: _auth, 'Content-Type': 'application/json' },
  });
  if (!res.ok) {
    const err = await res.text().catch(() => res.statusText);
    throw new Error(`DELETE ${path} → ${res.status}: ${err}`);
  }
  return res.json();
}

function buildQuery(params: Record<string, unknown> | undefined): string {
  if (!params) return '';
  const qs = Object.entries(params)
    .filter(([, v]) => v !== undefined && v !== null)
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`)
    .join('&');
  return qs ? `?${qs}` : '';
}

function getLocalIP(): string {
  const ifaces = os.networkInterfaces();
  for (const iface of Object.values(ifaces)) {
    for (const info of iface ?? []) {
      if (info.family === 'IPv4' && !info.internal) return info.address;
    }
  }
  return 'localhost';
}

export function registerClientProxyHandlers(serverIP: string, port: number, serverPassword?: string): void {
  init(serverIP, port, serverPassword);

  // ── PRODUCTOS ──────────────────────────────────────────────────
  ipcMain.handle('productos:getAll', (_e, filters?: Record<string, unknown>) =>
    get(`/api/sync/productos${buildQuery(filters)}`));

  ipcMain.handle('productos:getById', (_e, id: number) =>
    get(`/api/sync/productos/${id}`));

  ipcMain.handle('productos:search', (_e, query: string) =>
    get(`/api/sync/productos/search?q=${encodeURIComponent(query)}`));

  ipcMain.handle('productos:getByBarcode', (_e, barcode: string) =>
    get(`/api/sync/productos/barcode/${encodeURIComponent(barcode)}`));

  ipcMain.handle('productos:create', (_e, data: Record<string, unknown>) =>
    post('/api/sync/productos', data));

  ipcMain.handle('productos:update', (_e, id: number, data: Record<string, unknown>) =>
    put(`/api/sync/productos/${id}`, data));

  ipcMain.handle('productos:delete', (_e, id: number) =>
    del(`/api/sync/productos/${id}`));

  ipcMain.handle('productos:truncate', () =>
    del('/api/sync/productos/all'));

  ipcMain.handle('productos:importCSV', (_e, csvData: string) =>
    post('/api/sync/productos/import-csv', { csvData }));

  ipcMain.handle('productos:importFromNextar', (_e, filePath: string) =>
    ({ success: false, imported: 0, skipped: 0, errors: ['Import Nextar solo disponible en servidor'] }));

  ipcMain.handle('productos:importFromZip', () =>
    ({ success: false, imported: 0, skipped: 0, errors: ['Import ZIP solo disponible en servidor'] }));

  ipcMain.handle('productos:importFromFolder', () =>
    ({ success: false, imported: 0, skipped: 0, errors: ['Import carpeta solo disponible en servidor'] }));

  ipcMain.handle('productos:saveImage', (_e, productoId: number, imageData: string) =>
    post(`/api/sync/productos/${productoId}/imagen`, { imageData }));

  // buscarInternet hace fetch externo directo (no necesita servidor)
  ipcMain.handle('productos:buscarInternet', async (_e, query: string, type: 'barcode' | 'nombre') => {
    const headers = { 'User-Agent': 'AriesPos/1.0' };
    try {
      if (type === 'barcode') {
        const url = `https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(query)}.json?fields=code,product_name,product_name_es,product_name_fr,brands,image_front_url,image_url,quantity`;
        const res = await fetch(url, { headers });
        const data = await res.json() as { status: number; product?: Record<string, unknown> };
        if (data.status !== 1 || !data.product) return { found: false };
        const p = { ...data.product, code: query };
        return { found: true, results: [mapProduct(p)] };
      } else {
        const url = `https://world.openfoodfacts.org/cgi/search.pl?search_terms=${encodeURIComponent(query)}&json=1&page_size=6&fields=code,product_name,product_name_es,product_name_fr,brands,image_front_url,image_url,quantity`;
        const res = await fetch(url, { headers });
        const data = await res.json() as { products?: Record<string, unknown>[] };
        if (!data.products?.length) return { found: false };
        return { found: true, results: data.products.map(mapProduct).filter((r: { nombre: string; marca: string }) => r.nombre || r.marca) };
      }
    } catch (err) {
      return { found: false, error: String(err) };
    }
  });

  // ── CATEGORIAS ──────────────────────────────────────────────────
  ipcMain.handle('categorias:getAll', () =>
    get('/api/sync/categorias'));

  ipcMain.handle('categorias:create', (_e, data: { nombre: string; color: string }) =>
    post('/api/sync/categorias', data));

  ipcMain.handle('categorias:update', (_e, id: number, data: { nombre: string; color: string }) =>
    put(`/api/sync/categorias/${id}`, data));

  ipcMain.handle('categorias:delete', (_e, id: number) =>
    del(`/api/sync/categorias/${id}`));

  // ── CLIENTES ──────────────────────────────────────────────────
  ipcMain.handle('clientes:getAll', (_e, search?: string) =>
    get(`/api/sync/clientes${search ? `?search=${encodeURIComponent(search)}` : ''}`));

  ipcMain.handle('clientes:getById', (_e, id: number) =>
    get(`/api/sync/clientes/${id}`));

  ipcMain.handle('clientes:create', (_e, data: Record<string, unknown>) =>
    post('/api/sync/clientes', data));

  ipcMain.handle('clientes:update', (_e, id: number, data: Record<string, unknown>) =>
    put(`/api/sync/clientes/${id}`, data));

  ipcMain.handle('clientes:delete', (_e, id: number) =>
    del(`/api/sync/clientes/${id}`));

  ipcMain.handle('clientes:getVentas', (_e, clienteId: number) =>
    get(`/api/sync/clientes/${clienteId}/ventas`));

  ipcMain.handle('clientes:getSaldoActual', (_e, clienteId: number) =>
    get(`/api/sync/clientes/${clienteId}/saldo`));

  ipcMain.handle('clientes:pagarFiado', (_e, clienteId: number, monto: number, metodo: string) =>
    post(`/api/sync/clientes/${clienteId}/pagar-fiado`, { monto, metodo: metodo || 'efectivo' }));

  ipcMain.handle('clientes:exportCSV', () =>
    get('/api/sync/clientes/export-csv'));

  // ── FIADOS ──────────────────────────────────────────────────
  ipcMain.handle('fiados:exportExcel', () =>
    ({ success: false, filePath: null, error: 'Solo disponible en servidor' }));

  ipcMain.handle('fiados:getExcelPath', () => null);

  // ── VENTAS ──────────────────────────────────────────────────
  ipcMain.handle('ventas:crear', (_e, payload: unknown) =>
    post('/api/sync/ventas', payload));

  ipcMain.handle('ventas:getHistorico', (_e, filters?: Record<string, unknown>) =>
    get(`/api/sync/ventas/historico${buildQuery(filters)}`));

  ipcMain.handle('ventas:getById', (_e, id: number) =>
    get(`/api/sync/ventas/${id}`));

  ipcMain.handle('ventas:editar', (_e, id: number, changes: Record<string, unknown>) =>
    put(`/api/sync/ventas/${id}`, changes));

  ipcMain.handle('ventas:devolución', (_e, ventaId: number, items: unknown[]) =>
    post(`/api/sync/ventas/${ventaId}/devolucion`, { items }));

  ipcMain.handle('ventas:convertirPedido', (_e, pedidoId: number) =>
    post(`/api/sync/ventas/${pedidoId}/convertir-pedido`, {}));

  // ── STOCK ──────────────────────────────────────────────────
  ipcMain.handle('stock:getMovimientos', (_e, productoId?: number) =>
    get(`/api/sync/stock/movimientos${productoId ? `?productoId=${productoId}` : ''}`));

  ipcMain.handle('stock:ajuste', (_e, productoId: number, tipo: string, cantidad: number, motivo: string) =>
    post('/api/sync/stock/ajuste', { productoId, tipo, cantidad, motivo }));

  // ── CAJA ──────────────────────────────────────────────────
  ipcMain.handle('caja:getSesionActiva', () =>
    get('/api/sync/caja/sesion-activa'));

  ipcMain.handle('caja:abrir', (_e, montoInicial: number, usuarioId?: number) =>
    post('/api/sync/caja/abrir', { monto_inicial: montoInicial, usuario_id: usuarioId ?? null }));

  ipcMain.handle('caja:cerrar', (_e, sessionId: number, montoFinal: number) =>
    post('/api/sync/caja/cerrar', { sesion_id: sessionId, monto_final: montoFinal }));

  ipcMain.handle('caja:agregarMovimiento', (_e, data: Record<string, unknown>) =>
    post('/api/sync/caja/movimiento', data));

  ipcMain.handle('caja:getMovimientos', (_e, sesionId: number) =>
    get(`/api/sync/caja/movimientos?sesionId=${sesionId}`));

  ipcMain.handle('caja:getHistorico', () =>
    get('/api/sync/caja/historico'));

  // ── ESTADÍSTICAS ──────────────────────────────────────────────────
  ipcMain.handle('stats:dashboard', () =>
    get('/api/sync/stats/dashboard'));

  ipcMain.handle('stats:ventasPorPeriodo', (_e, desde: string, hasta: string) =>
    get(`/api/sync/stats/periodo?desde=${desde}&hasta=${hasta}`));

  // ── CUENTAS A PAGAR ──────────────────────────────────────────────────
  ipcMain.handle('cuentaspagar:getAll', () =>
    get('/api/sync/cuentaspagar'));

  ipcMain.handle('cuentaspagar:create', (_e, data: Record<string, unknown>) =>
    post('/api/sync/cuentaspagar', data));

  ipcMain.handle('cuentaspagar:update', (_e, id: number, data: Record<string, unknown>) =>
    put(`/api/sync/cuentaspagar/${id}`, data));

  ipcMain.handle('cuentaspagar:delete', (_e, id: number) =>
    del(`/api/sync/cuentaspagar/${id}`));

  ipcMain.handle('cuentaspagar:pagar', (_e, id: number, monto: number) =>
    post(`/api/sync/cuentaspagar/${id}/pagar`, { monto }));

  // ── USUARIOS / AUTH ──────────────────────────────────────────────────
  ipcMain.handle('usuarios:getAll', () =>
    get('/api/sync/usuarios'));

  ipcMain.handle('usuarios:login', (_e, pin: string) =>
    post('/api/sync/usuarios/login', { pin }));

  ipcMain.handle('usuarios:create', (_e, data: { nombre: string; pin: string; rol: string }) =>
    post('/api/sync/usuarios', data));

  ipcMain.handle('usuarios:update', (_e, id: number, data: Record<string, unknown>) =>
    put(`/api/sync/usuarios/${id}`, data));

  ipcMain.handle('usuarios:delete', (_e, id: number) =>
    post(`/api/sync/usuarios/${id}/desactivar`, {}));

  ipcMain.handle('auth:validate-pin', (_e, pin: string) =>
    post('/api/sync/auth/validate-pin', { pin }));

  ipcMain.handle('auth:validate-admin', (_e, pin: string) =>
    post('/api/sync/auth/validate-admin', { pin }));

  ipcMain.handle('auth:get-users', () =>
    get('/api/sync/usuarios'));

  ipcMain.handle('auth:create-user', (_e, data: { nombre: string; pin: string; rol: string }) =>
    post('/api/sync/usuarios', data));

  ipcMain.handle('auth:update-user', (_e, id: number, data: Record<string, unknown>) =>
    put(`/api/sync/usuarios/${id}`, data));

  ipcMain.handle('auth:delete-user', (_e, id: number) =>
    post(`/api/sync/usuarios/${id}/desactivar`, {}));

  // ── CONFIGURACIÓN ──────────────────────────────────────────────────
  ipcMain.handle('config:getAll', () =>
    get('/api/sync/config'));

  ipcMain.handle('config:set', (_e, clave: string, valor: string) =>
    post('/api/sync/config', { clave, valor }));

  ipcMain.handle('config:setMultiple', (_e, data: Record<string, string>) =>
    post('/api/sync/config/multiple', data));

  // ── COMBOS ──────────────────────────────────────────────────
  ipcMain.handle('combos:getAll', () =>
    get('/api/sync/combos'));

  ipcMain.handle('combos:getById', (_e, id: number) =>
    get(`/api/sync/combos/${id}`));

  ipcMain.handle('combos:create', (_e, data: unknown) =>
    post('/api/sync/combos', data));

  ipcMain.handle('combos:update', (_e, id: number, data: unknown) =>
    put(`/api/sync/combos/${id}`, data));

  ipcMain.handle('combos:delete', (_e, id: number) =>
    del(`/api/sync/combos/${id}`));

  // ── LIBRO DE CAJA ──────────────────────────────────────────────────
  ipcMain.handle('librocaja:getDia', (_e, fecha: string) =>
    get(`/api/sync/librocaja?fecha=${fecha}`));

  ipcMain.handle('librocaja:getHistorico', (_e, limit = 60) =>
    get(`/api/sync/librocaja/historico?limit=${limit}`));

  ipcMain.handle('librocaja:updateDia', (_e, fecha: string, data: Record<string, unknown>) =>
    put(`/api/sync/librocaja/${fecha}`, data));

  ipcMain.handle('librocaja:syncFromVentas', (_e, fecha: string) =>
    post(`/api/sync/librocaja/${fecha}/sync`, {}));

  ipcMain.handle('librocaja:abrirTurno', (_e, fecha: string, data: Record<string, unknown>) =>
    post(`/api/sync/librocaja/${fecha}/turno/abrir`, data));

  ipcMain.handle('librocaja:cerrarTurno', (_e, turnoId: number, data: Record<string, unknown>) =>
    put(`/api/sync/librocaja/turno/${turnoId}/cerrar`, data));

  ipcMain.handle('librocaja:getTurnoActivo', (_e, fecha: string) =>
    get(`/api/sync/librocaja/turno/activo?fecha=${fecha}`));

  ipcMain.handle('librocaja:updateBilletes', (_e, fecha: string, billetes: unknown[]) =>
    put(`/api/sync/librocaja/${fecha}/billetes`, { billetes }));

  ipcMain.handle('librocaja:addEgreso', (_e, fecha: string, data: Record<string, unknown>) =>
    post(`/api/sync/librocaja/${fecha}/egreso`, data));

  ipcMain.handle('librocaja:removeEgreso', (_e, egresoId: number) =>
    del(`/api/sync/librocaja/egreso/${egresoId}`));

  ipcMain.handle('librocaja:exportExcel', () =>
    ({ success: false, error: 'Export Excel solo disponible en servidor' }));

  // ── FIRMA DIGITAL (valida pines contra servidor) ──────────────────────────
  ipcMain.handle('firma:estado', async () => {
    // En cliente indicamos que está configurado (el servidor tiene la firma)
    return { configurado: true, nombre: 'Servidor' };
  });

  ipcMain.handle('firma:verificar', (_e, clave: string) =>
    post('/api/sync/auth/validate-admin', { pin: clave }));

  ipcMain.handle('firma:registrar', () =>
    ({ success: false, error: 'Configuración de firma solo disponible en servidor' }));

  ipcMain.handle('firma:cambiar', () =>
    ({ success: false, error: 'Cambio de firma solo disponible en servidor' }));

  // ── BACKUP (no disponible en cliente) ──────────────────────────
  ipcMain.handle('backup:list', () => []);
  ipcMain.handle('backup:create', () => ({ success: false, error: 'Backup solo disponible en servidor' }));
  ipcMain.handle('backup:restore', () => ({ success: false, error: 'Restore solo disponible en servidor' }));
  ipcMain.handle('backup:autoBackup', () => ({ success: false }));

  // ── EXPORT/IMPORT (no disponible en cliente) ──────────────────────────
  ipcMain.handle('export:allJSON', () => ({ success: false, error: 'Export solo disponible en servidor' }));
  ipcMain.handle('import:fromJSON', () => ({ success: false, error: 'Import solo disponible en servidor' }));

  // ── NEXTAR (no disponible en cliente) ──────────────────────────
  ipcMain.handle('nextar:selectBackup', async (event) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    const { canceled, filePaths } = await dialog.showOpenDialog(win!, {
      title: 'Seleccionar backup de Nextar',
      filters: [{ name: 'Backup Nextar', extensions: ['zip'] }],
      properties: ['openFile'],
    });
    return canceled ? null : filePaths[0];
  });
  ipcMain.handle('nextar:importBackup', () =>
    ({ success: false, error: 'Import Nextar solo disponible en servidor' }));

  // ── DIALOG (sistema local — no necesita servidor) ──────────────────────────
  ipcMain.handle('dialog:showOpenDialog', async (_e, options: Electron.OpenDialogOptions) => {
    const { canceled, filePaths } = await dialog.showOpenDialog(options);
    return canceled ? [] : filePaths;
  });

  // ── SERVER INFO (devuelve info del servidor remoto) ──────────────────────────
  ipcMain.handle('server:getLocalIP', () => serverIP);
  ipcMain.handle('server:getPort', () => port);

  // ── NETWORK (escaneo local) ──────────────────────────────────────
  ipcMain.handle('network:scan', async (_e, scanPort?: number) => {
    const targetPort = scanPort ?? 3001;
    const localIP = getLocalIP();
    const subnet = localIP.split('.').slice(0, 3).join('.');
    const results: { ip: string; port: number; info: Record<string, unknown> }[] = [];

    const checkHost = async (host: string) => {
      try {
        const ctrl = new AbortController();
        const tid = setTimeout(() => ctrl.abort(), 800);
        const res = await fetch(`http://${host}:${targetPort}/api/servidor/info`, { signal: ctrl.signal });
        clearTimeout(tid);
        if (res.ok) {
          const info = await res.json() as Record<string, unknown>;
          results.push({ ip: host, port: targetPort, info });
        }
      } catch { /* ignorar */ }
    };

    const promises: Promise<void>[] = [];
    for (let i = 1; i <= 254; i++) {
      promises.push(checkHost(`${subnet}.${i}`));
    }
    await Promise.allSettled(promises);
    return results;
  });

  ipcMain.handle('network:get-local-ip', () => getLocalIP());

  // ── LICENSE (local a cada PC) ──────────────────────────────────────────
  // Los handlers de licencia quedan en main.ts (son locales por PC)
  // No registrar aquí para evitar duplicado — main.ts los registra antes.
}

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
