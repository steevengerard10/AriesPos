// Wrapper tipado para todas las llamadas IPC al proceso main de Electron
// Cuando se usa en el navegador (panel web), usa fetch a la API REST

const isElectron = (): boolean => {
  return typeof window !== 'undefined' && !!window.electron;
};

async function invoke<T>(channel: string, ...args: unknown[]): Promise<T> {
  if (!isElectron()) {
    throw new Error(`Canal IPC "${channel}" no disponible fuera de Electron`);
  }
  return window.electron!.invoke(channel, ...args) as Promise<T>;
}

export function onEvent(channel: string, callback: (...args: unknown[]) => void): () => void {
  if (!isElectron()) return () => {};
  return window.electron!.on(channel, callback);
}

export function sendEvent(channel: string, ...args: unknown[]): void {
  if (!isElectron()) return;
  window.electron!.send(channel, ...args);
}

// ── PRODUCTOS ──────────────────────────────────────────────────
export const productosAPI = {
  getAll: (filters?: {
    categoria?: number;
    activo?: boolean;
    search?: string;
    stockBajo?: boolean;
    limit?: number;
    offset?: number;
  }) => invoke<{ rows: unknown[]; total: number; limit: number; offset: number }>('productos:getAll', filters),

  getById: (id: number) => invoke('productos:getById', id),
  search: (query: string) => invoke('productos:search', query),
  getByBarcode: (barcode: string) => invoke('productos:getByBarcode', barcode),
  create: (data: Record<string, unknown>) => invoke<{ id: number }>('productos:create', data),
  update: (id: number, data: Record<string, unknown>) => invoke('productos:update', id, data),
  delete: (id: number) => invoke('productos:delete', id),
  deleteAll: () => invoke<{ success: boolean }>('productos:deleteAll'),
  deleteMany: (ids: number[]) => invoke<{ deleted: number }>('productos:deleteMany', ids),
  limpiarBasura: () => invoke<{ deleted: number; pt: number; en: number; basura: number }>('productos:limpiarBasura'),
  loadSeed: () => invoke<{ inserted: number }>('productos:loadSeed'),
  importCSV: (csvData: string) => invoke<{ imported: number; errors: number }>('productos:importCSV', csvData),
  saveImage: (productoId: number, imageData: string) => invoke('productos:saveImage', productoId, imageData),
  truncate: () => invoke('productos:truncate'),
  buscarInternet: (query: string, type: 'barcode' | 'nombre') =>
    invoke<{ found: boolean; results?: { barcode: string; nombre: string; marca: string; imagen_url: string | null; unidad_hint: string }[]; error?: string }>('productos:buscarInternet', query, type),
};

// ── CATEGORIAS ──────────────────────────────────────────────────
export const categoriasAPI = {
  getAll: () => invoke('categorias:getAll'),
  create: (data: { nombre: string; color: string }) => invoke<{ id: number }>('categorias:create', data),
  update: (id: number, data: { nombre: string; color: string }) => invoke('categorias:update', id, data),
  delete: (id: number) => invoke('categorias:delete', id),
};

// ── CLIENTES ──────────────────────────────────────────────────
export const clientesAPI = {
  getAll: (search?: string) => invoke('clientes:getAll', search),
  getById: (id: number) => invoke('clientes:getById', id),
  create: (data: Record<string, unknown>) => invoke<{ id: number }>('clientes:create', data),
  update: (id: number, data: Record<string, unknown>) => invoke('clientes:update', id, data),
  delete: (id: number) => invoke('clientes:delete', id),
  getVentas: (clienteId: number) => invoke('clientes:getVentas', clienteId),
  pagarFiado: (clienteId: number, monto: number, metodo?: string) =>
    invoke('clientes:pagarFiado', clienteId, monto, metodo || 'efectivo'),
  getSaldoActual: (clienteId: number) =>
    invoke<number>('clientes:getSaldoActual', clienteId),
  exportCSV: () => invoke<string>('clientes:exportCSV'),
};

// ── VENTAS ──────────────────────────────────────────────────
export const ventasAPI = {
  crear: (payload: unknown) => invoke<{ id: number; numero: string; venta: unknown }>('ventas:crear', payload),
  getHistorico: (filters?: {
    desde?: string;
    hasta?: string;
    tipo?: string;
    cliente_id?: number;
    vendedor_id?: number;
  }) => invoke('ventas:getHistorico', filters),
  getById: (id: number) => invoke('ventas:getById', id),
  devolucion: (ventaId: number, itemsOrMeta: { producto_id: number; cantidad: number }[] | { motivo?: string }) =>
    invoke('ventas:devolución', ventaId, Array.isArray(itemsOrMeta) ? itemsOrMeta : []),
  convertirPedido: (pedidoId: number) => invoke('ventas:convertirPedido', pedidoId),
  editar: (ventaId: number, changes: { observaciones?: string; metodo_pago?: string; cliente_id?: number | null }) =>
    invoke('ventas:editar', ventaId, changes),
};

// ── STOCK ──────────────────────────────────────────────────
export const stockAPI = {
  getMovimientos: (productoId?: number) => invoke('stock:getMovimientos', productoId),
  ajuste: (dataOrId: number | { producto_id: number; tipo: 'entrada' | 'salida' | 'ajuste'; cantidad: number; costo_unitario?: number; motivo?: string }, tipo?: 'entrada' | 'salida' | 'ajuste', cantidad?: number, motivo?: string) => {
    if (typeof dataOrId === 'object') {
      return invoke('stock:ajuste', dataOrId.producto_id, dataOrId.tipo, dataOrId.cantidad, dataOrId.motivo || '');
    }
    return invoke('stock:ajuste', dataOrId, tipo, cantidad, motivo || '');
  },
};

// ── CAJA ──────────────────────────────────────────────────
export const cajaAPI = {
  getSesionActiva: () => invoke('caja:getSesionActiva'),
  abrir: (montoInicialOrData: number | { saldo_inicial: number }, usuarioId?: number) => {
    const monto = typeof montoInicialOrData === 'object' ? montoInicialOrData.saldo_inicial : montoInicialOrData;
    return invoke('caja:abrir', monto, usuarioId);
  },
  cerrar: (sessionId: number, montoFinalOrData: number | { saldo_final: number }) => {
    const monto = typeof montoFinalOrData === 'object' ? montoFinalOrData.saldo_final : montoFinalOrData;
    return invoke('caja:cerrar', sessionId, monto);
  },
  agregarMovimiento: (sesionIdOrData: number | { sesion_id: number; tipo: 'ingreso' | 'egreso'; monto: number; descripcion: string; metodo_pago: string }, movData?: { tipo: 'ingreso' | 'egreso'; monto: number; concepto?: string; descripcion?: string; metodo_pago: string }) => {
    if (typeof sesionIdOrData === 'number' && movData) {
      return invoke('caja:agregarMovimiento', {
        sesion_id: sesionIdOrData,
        tipo: movData.tipo,
        monto: movData.monto,
        descripcion: movData.concepto || movData.descripcion || '',
        metodo_pago: movData.metodo_pago,
      });
    }
    return invoke('caja:agregarMovimiento', sesionIdOrData);
  },
  getMovimientos: (sesionId: number) => invoke('caja:getMovimientos', sesionId),
  getHistorico: () => invoke('caja:getHistorico'),
};

// ── ESTADÍSTICAS ──────────────────────────────────────────────────
export const statsAPI = {
  dashboard: () => invoke('stats:dashboard'),
  ventasPorPeriodo: (desde: string, hasta: string) => invoke('stats:ventasPorPeriodo', desde, hasta),
};

// ── COMBOS ──────────────────────────────────────────────────
export const combosAPI = {
  getAll: () => invoke('combos:getAll'),
  getById: (id: number) => invoke('combos:getById', id),
  create: (data: Record<string, unknown>) => invoke<{ id: number }>('combos:create', data),
  update: (id: number, data: Record<string, unknown>) => invoke('combos:update', id, data),
  delete: (id: number) => invoke('combos:delete', id),
};

// ── CUENTAS A PAGAR ──────────────────────────────────────────────────
export const cuentasAPI = {
  getAll: () => invoke('cuentaspagar:getAll'),
  create: (data: Record<string, unknown>) => invoke<{ id: number }>('cuentaspagar:create', data),
  update: (id: number, data: Record<string, unknown>) => invoke('cuentaspagar:update', id, data),
  delete: (id: number) => invoke('cuentaspagar:delete', id),
  pagar: (id: number, monto: number) => invoke('cuentaspagar:pagar', id, monto),
};

// ── USUARIOS ──────────────────────────────────────────────────
export const usuariosAPI = {
  getAll: () => invoke('usuarios:getAll'),
  login: (pin: string) => invoke('usuarios:login', pin),
  create: (data: { nombre: string; pin: string; rol: string }) => invoke<{ id: number }>('usuarios:create', data),
  update: (id: number, data: Record<string, unknown>) => invoke('usuarios:update', id, data),
  delete: (id: number) => invoke('usuarios:delete', id),
};

// ── CONFIGURACIÓN ──────────────────────────────────────────────────
export const configAPI = {
  getAll: () => invoke<Record<string, string>>('config:getAll'),
  set: (clave: string, valor: string) => invoke('config:set', clave, valor),
  setMultiple: (data: Record<string, string>) => invoke('config:setMultiple', data),
};

// ── FIRMA DEL PROPIETARIO ──────────────────────────────────────
export const firmaAPI = {
  estado: () => invoke<{ registrada: boolean; nombre: string; fecha: string }>('firma:estado'),
  registrar: (nombre: string, clave: string) => invoke<{ success: boolean; error?: string }>('firma:registrar', nombre, clave),
  verificar: (clave: string) => invoke<{ valida: boolean }>('firma:verificar', clave),
  cambiar: (claveActual: string, nuevaClave: string, nuevoNombre: string) => invoke<{ success: boolean; error?: string }>('firma:cambiar', claveActual, nuevaClave, nuevoNombre),
};

// ── BACKUP ──────────────────────────────────────────────────
export const backupAPI = {
  list: () => invoke('backup:list'),
  create: (targetDir?: string) => invoke<{ path: string; success: boolean }>('backup:create', targetDir),
  restore: (backupPath: string) => invoke('backup:restore', backupPath),
  autoBackup: () => invoke('backup:autoBackup'),
};

// ── EXPORT / IMPORT ──────────────────────────────────────────────────
export const exportAPI = {
  allJSON: () => invoke('export:allJSON'),
  fromJSON: (data: Record<string, unknown[]>) => invoke('import:fromJSON', data),
};

// ── APP ──────────────────────────────────────────────────
export const appAPI = {
  openPosWindow: () => sendEvent('open-pos-window'),
  closePosWindow: () => sendEvent('close-pos-window'),
  restart: () => invoke('app:restart'),
  getVersion: () => invoke<string>('app:get-version'),
  openDirectory: () =>
    invoke<{ canceled: boolean; filePaths: string[] }>('dialog:open-directory', {}),
  saveFile: (options: unknown) =>
    invoke<{ canceled: boolean; filePath: string }>('dialog:save-file', options),
  openFile: (options: unknown) =>
    invoke<{ canceled: boolean; filePaths: string[] }>('dialog:open-file', options),
  getLocalIP: () => invoke<string>('server:getLocalIP'),
  getServerPort: () => invoke<number>('server:getPort'),
  getServerInfo: async (): Promise<{ ip: string; port: number }> => {
    const [ip, port] = await Promise.all([invoke<string>('server:getLocalIP'), invoke<number>('server:getPort')]);
    return { ip, port };
  },
  getAppConfig: () =>
    invoke<{ mode: 'server' | 'client' | 'server-only' | null; serverIP: string; serverPort: number; terminalName: string }>(
      'app:getAppConfig',
    ),
  setAppConfig: (data: Record<string, unknown>) => invoke('app:setAppConfig', data),
  switchToClientMode: (data: { ip: string; port: number; terminalName: string }) => invoke('app:switchToClientMode', data),
  testServerConnection: (data: { ip: string; port: number }) => invoke<{ ok: boolean; error?: string }>('app:testServerConnection', data),
  validateAdminCode: (code: string) => invoke<boolean>('app:validateAdminCode', code),
  resetAppConfig: () => invoke('app:resetAppConfig'),
  restartApp: () => invoke('app:restart'),
};

// ── LIBRO DE CAJA ──────────────────────────────────────────────────
export interface LibroCajaDia {
  id: number;
  fecha: string;
  libro: number;
  caja: number;
  egresos: number;
  tarjetas: number;
  cambio: number;
  transferencias: number;
  gastos_tarjeta: number;
  extra_caja: number;
  notas: string;
  total_turnos?: number;
  turnos_abiertos?: number;
  updated_at?: string;
}

export interface LibroCajaTurno {
  id: number;
  dia_id: number;
  numero: number;
  fecha_apertura: string;
  fecha_cierre: string | null;
  usuario_id: number | null;
  monto_apertura: number;
  monto_cierre: number | null;
  notas: string;
}

export interface LibroCajaBillete {
  id: number;
  dia_id: number;
  denominacion: number;
  cantidad: number;
}

export interface LibroCajaEgreso {
  id: number;
  dia_id: number;
  proveedor: string;
  monto: number;
  fecha: string;
  medio_pago: 'efectivo' | 'transferencia';
}

export const libroCajaAPI = {
  getDia: (fecha: string) =>
    invoke<{ dia: LibroCajaDia; turnos: LibroCajaTurno[]; billetes: LibroCajaBillete[]; egresos: LibroCajaEgreso[] }>('librocaja:getDia', fecha),
  getHistorico: (limit?: number) =>
    invoke<LibroCajaDia[]>('librocaja:getHistorico', limit),
  updateDia: (fecha: string, data: Partial<LibroCajaDia>) =>
    invoke<{ success: boolean }>('librocaja:updateDia', fecha, data),
  syncFromVentas: (fecha: string) =>
    invoke<{ tarjetas: number; transferencias: number }>('librocaja:syncFromVentas', fecha),
  abrirTurno: (fecha: string, data?: { monto_apertura?: number; usuario_id?: number; notas?: string }) =>
    invoke<{ id: number; numero: number }>('librocaja:abrirTurno', fecha, data || {}),
  cerrarTurno: (turnoId: number, data?: { monto_cierre?: number; notas?: string }) =>
    invoke<{ success: boolean }>('librocaja:cerrarTurno', turnoId, data || {}),
  getTurnoActivo: (fecha: string) =>
    invoke<LibroCajaTurno | null>('librocaja:getTurnoActivo', fecha),
  updateBilletes: (fecha: string, billetes: { denominacion: number; cantidad: number }[]) =>
    invoke<{ success: boolean }>('librocaja:updateBilletes', fecha, billetes),
  addEgreso: (fecha: string, data: { proveedor: string; monto: number; medio_pago: 'efectivo' | 'transferencia' }) =>
    invoke<{ id: number; totalEgresos: number; caja: number; transferencias: number }>('librocaja:addEgreso', fecha, data),
  removeEgreso: (egresoId: number, fecha: string) =>
    invoke<{ success: boolean }>('librocaja:removeEgreso', egresoId, fecha),
  exportExcel: (desde: string, hasta: string) =>
    invoke<{ success: boolean; path?: string; error?: string }>('librocaja:exportExcel', desde, hasta),
};

// ── AUTH ──────────────────────────────────────────────────
export const authAPI = {
  validatePin: (pin: string) =>
    invoke<{ ok: boolean; user?: ARIESUser; error?: string }>('auth:validate-pin', pin),
  validateAdmin: (pin: string) =>
    invoke<{ ok: boolean; error?: string }>('auth:validate-admin', pin),
  getUsers: () =>
    invoke<ARIESUser[]>('auth:get-users'),
  createUser: (data: { nombre: string; pin: string; rol: string }) =>
    invoke<{ ok: boolean; id?: number; error?: string }>('auth:create-user', data),
  updateUser: (id: number, data: Partial<ARIESUser>) =>
    invoke<{ ok: boolean; error?: string }>('auth:update-user', id, data),
  deleteUser: (id: number) =>
    invoke<{ ok: boolean; error?: string }>('auth:delete-user', id),
};

// ── NETWORK SCAN ─────────────────────────────────────────
export const networkAPI = {
  scan: (port?: number) =>
    invoke<ScannedServer[]>('network:scan', port),
  getLocalIP: () =>
    invoke<string>('network:get-local-ip'),
};

interface ARIESUser {
  id: number;
  nombre: string;
  pin: string;
  rol: 'admin' | 'vendedor' | 'readonly';
  activo: number;
}

interface ScannedServer {
  ip: string;
  port: number;
  nombre: string;
}
