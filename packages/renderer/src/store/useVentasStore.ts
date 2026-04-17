import { create } from 'zustand';

// Generador de ID único por ítem del carrito
const genItemId = () =>
  `item_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

export interface CartItem {
  itemId:         string;   // ID único del ítem (permite duplicados del mismo producto)
  producto_id:    number;
  nombre:         string;
  cantidad:       number;
  precio_unitario: number;
  precio_original: number;
  descuento:      number;
  total:          number;
  fraccionable:   boolean;
  unidad_medida:  string;
}

// MetodoPago acepta los built-ins y cualquier método personalizado configurado
export type MetodoPago = 'efectivo' | 'tarjeta' | 'transferencia' | 'cripto' | 'fiado' | (string & {});

export interface MetodoPagoMixto {
  metodo: MetodoPago;
  monto: number;
}

interface VentasState {
  cart: CartItem[];
  descuentoGlobal: number;
  clienteId: number | null;
  clienteNombre: string;
  vendedorId: number | null;
  vendedorNombre: string;
  metodoPago: MetodoPago;
  metodoPagoMixto: MetodoPagoMixto[];
  esFiado: boolean;
  observaciones: string;
  tipoOperacion: 'venta' | 'pedido' | 'cotizacion';

  // Computed
  subtotal: number;
  totalDescuento: number;
  total: number;

  // Actions
  addItem: (item: Omit<CartItem, 'total' | 'itemId'>, modo?: 'sumar' | 'nuevo') => void;
  updateItem: (itemId: string, updates: Partial<CartItem>) => void;
  removeItem: (itemId: string) => void;
  getItemsDelProducto: (productoId: number) => CartItem[];
  clearCart: () => void;
  setDescuentoGlobal: (descuento: number) => void;
  setCliente: (id: number | null, nombre: string) => void;
  setVendedor: (id: number | null, nombre: string) => void;
  setMetodoPago: (metodo: MetodoPago) => void;
  setMetodoPagoMixto: (mixed: MetodoPagoMixto[]) => void;
  setEsFiado: (val: boolean) => void;
  setObservaciones: (obs: string) => void;
  setTipoOperacion: (tipo: 'venta' | 'pedido' | 'cotizacion') => void;
  resetSale: () => void;
}

const computeTotals = (cart: CartItem[], descuentoGlobal: number) => {
  const subtotal = cart.reduce((s, i) => s + i.precio_unitario * i.cantidad, 0);
  const itemsDiscount = cart.reduce((s, i) => s + i.descuento, 0);
  const totalDescuento = itemsDiscount + descuentoGlobal;
  const total = Math.max(0, subtotal - totalDescuento);
  return { subtotal, totalDescuento, total };
};

const defaultState = {
  cart: [] as CartItem[],
  descuentoGlobal: 0,
  clienteId: null as number | null,
  clienteNombre: '',
  vendedorId: null as number | null,
  vendedorNombre: '',
  metodoPago: 'efectivo' as MetodoPago,
  metodoPagoMixto: [] as MetodoPagoMixto[],
  esFiado: false,
  observaciones: '',
  tipoOperacion: 'venta' as 'venta' | 'pedido' | 'cotizacion',
  subtotal: 0,
  totalDescuento: 0,
  total: 0,
};

export const useVentasStore = create<VentasState>((set, get) => ({
  ...defaultState,

  addItem: (item, modo = 'sumar') => {
    const { cart, descuentoGlobal } = get();
    const existing = cart.find((c) => c.producto_id === item.producto_id);

    let newCart: CartItem[];
    if (modo === 'sumar' && existing) {
      // Sumar cantidad al ítem existente
      newCart = cart.map((c) =>
        c.itemId !== existing.itemId
          ? c
          : {
              ...c,
              cantidad: Math.round((c.cantidad + item.cantidad) * 1000) / 1000,
              total: c.precio_unitario * (c.cantidad + item.cantidad) - c.descuento,
            }
      );
    } else {
      // Siempre crear fila nueva (modo 'nuevo' o no existe)
      const total = item.precio_unitario * item.cantidad - item.descuento;
      newCart = [...cart, { ...item, itemId: genItemId(), total }];
    }

    set({ cart: newCart, ...computeTotals(newCart, descuentoGlobal) });
  },

  updateItem: (itemId, updates) => {
    const { cart, descuentoGlobal } = get();
    const newCart = cart.map((c) => {
      if (c.itemId !== itemId) return c;
      const updated = { ...c, ...updates };
      updated.total = updated.precio_unitario * updated.cantidad - updated.descuento;
      return updated;
    });
    set({ cart: newCart, ...computeTotals(newCart, descuentoGlobal) });
  },

  removeItem: (itemId) => {
    const { cart, descuentoGlobal } = get();
    const newCart = cart.filter((c) => c.itemId !== itemId);
    set({ cart: newCart, ...computeTotals(newCart, descuentoGlobal) });
  },

  getItemsDelProducto: (productoId) => {
    return get().cart.filter((c) => c.producto_id === productoId);
  },

  clearCart: () => {
    set({ cart: [], subtotal: 0, totalDescuento: 0, total: 0, descuentoGlobal: 0 });
  },

  setDescuentoGlobal: (descuento) => {
    const { cart } = get();
    set({ descuentoGlobal: descuento, ...computeTotals(cart, descuento) });
  },

  setCliente: (id, nombre) => set({ clienteId: id, clienteNombre: nombre }),
  setVendedor: (id, nombre) => set({ vendedorId: id, vendedorNombre: nombre }),
  setMetodoPago: (metodo) => set({ metodoPago: metodo }),
  setMetodoPagoMixto: (mixed) => set({ metodoPagoMixto: mixed }),
  setEsFiado: (val) => {
    set({ esFiado: val });
    if (val) set({ metodoPago: 'fiado' });
  },
  setObservaciones: (obs) => set({ observaciones: obs }),
  setTipoOperacion: (tipo) => set({ tipoOperacion: tipo }),

  resetSale: () => set({ ...defaultState }),
}));
