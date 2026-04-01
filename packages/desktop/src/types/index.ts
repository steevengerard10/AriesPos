export interface Producto {
  id: number;
  codigo: string;
  codigo_barras: string;
  nombre: string;
  categoria_id: number | null;
  categoria_nombre?: string;
  precio_costo: number;
  precio_venta: number;
  precio2: number;
  precio3: number;
  stock_actual: number;
  stock_minimo: number;
  unidad_medida: string;
  fraccionable: boolean;
  en_catalogo: boolean;
  imagen_path: string | null;
  activo: boolean;
  created_at: string;
  updated_at: string;
}

export interface Categoria {
  id: number;
  nombre: string;
  color: string;
}

export interface Cliente {
  id: number;
  nombre: string;
  telefono: string;
  email: string;
  direccion: string;
  documento: string;
  limite_credito: number;
  saldo_deuda?: number;
  created_at: string;
}

export interface Venta {
  id: number;
  numero: string;
  tipo: 'venta' | 'pedido' | 'cotizacion' | 'devolucion';
  estado: string;
  fecha: string;
  hora: string;
  cliente_id: number | null;
  cliente_nombre?: string;
  vendedor_id: number | null;
  vendedor_nombre?: string;
  subtotal: number;
  descuento: number;
  total: number;
  metodo_pago: string;
  es_fiado: boolean;
  observaciones: string;
  created_at: string;
  items?: VentaItem[];
}

export interface VentaItem {
  id: number;
  venta_id: number;
  producto_id: number;
  producto_nombre?: string;
  cantidad: number;
  precio_unitario: number;
  descuento: number;
  total: number;
}

export interface CartItem {
  producto_id: number;
  nombre: string;
  cantidad: number;
  precio_unitario: number;
  descuento: number;
  total: number;
  fraccionable: boolean;
  unidad_medida: string;
}

export interface StockMovimiento {
  id: number;
  producto_id: number;
  producto_nombre?: string;
  tipo: 'entrada' | 'salida' | 'ajuste';
  cantidad: number;
  motivo: string;
  venta_id: number | null;
  fecha: string;
}

export interface CajaSesion {
  id: number;
  fecha_apertura: string;
  fecha_cierre: string | null;
  monto_inicial: number;
  monto_final: number | null;
  usuario_id: number | null;
  usuario_nombre?: string;
  total_ventas?: number;
  total_efectivo?: number;
  total_tarjeta?: number;
  total_transferencia?: number;
  total_fiado?: number;
}

export interface CajaMovimiento {
  id: number;
  sesion_id: number;
  tipo: 'ingreso' | 'egreso';
  monto: number;
  descripcion: string;
  metodo_pago: string;
  venta_id: number | null;
  fecha: string;
}

export interface CuentaPagar {
  id: number;
  descripcion: string;
  proveedor: string;
  monto_total: number;
  monto_pagado: number;
  vencimiento: string;
  estado: 'pendiente' | 'parcial' | 'pagado';
}

export interface Usuario {
  id: number;
  nombre: string;
  pin: string;
  rol: 'admin' | 'vendedor' | 'readonly';
  activo: boolean;
}

export interface Configuracion {
  clave: string;
  valor: string;
}

export interface DashboardStats {
  ventasHoy: number;
  ventasSemana: number;
  ventasMes: number;
  productoMasVendido: string;
  clienteMasCompras: string;
  stockBajo: number;
  fiadosPendientes: number;
  cajaActual: number;
}

export interface VentaPayload {
  tipo: 'venta' | 'pedido' | 'cotizacion';
  cliente_id: number | null;
  vendedor_id: number | null;
  items: CartItem[];
  descuento: number;
  metodo_pago: string;
  es_fiado: boolean;
  observaciones: string;
  metodos_pago_mixto?: { metodo: string; monto: number }[];
}

export interface BackupInfo {
  filename: string;
  path: string;
  size: number;
  created_at: string;
}
