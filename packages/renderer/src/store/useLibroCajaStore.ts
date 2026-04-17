import { create } from 'zustand';
import { libroCajaAPI, LibroCajaDia, LibroCajaTurno, LibroCajaBillete, LibroCajaEgreso } from '../lib/api';

export interface LibroCajaPeriodo {
  periodo: string;
  estado: 'abierto' | 'cerrado';
  fecha_cierre: string | null;
}

interface LibroCajaState {
  // Datos del día actual
  diaActual: LibroCajaDia | null;
  turnos: LibroCajaTurno[];
  turnoActivo: LibroCajaTurno | null;
  billetes: LibroCajaBillete[];
  egresos: LibroCajaEgreso[];

  // Histórico
  historico: LibroCajaDia[];

  // Periodos mensuales
  periodos: LibroCajaPeriodo[];
  periodoActual: string; // YYYY-MM

  // UI
  fechaSeleccionada: string;
  loading: boolean;
  loadingSync: boolean;

  // Acciones
  setFecha: (fecha: string) => void;
  setPeriodo: (periodo: string) => void;
  cargarDia: (fecha?: string) => Promise<void>;
  cargarHistorico: () => Promise<void>;
  cargarPeriodos: () => Promise<void>;
  cerrarMes: (periodo: string) => Promise<void>;
  reabrirMes: (periodo: string) => Promise<void>;
  actualizarCampo: (campo: keyof LibroCajaDia, valor: number | string) => Promise<void>;
  actualizarCampoPorFecha: (fecha: string, campo: keyof LibroCajaDia, valor: number | string) => Promise<void>;
  syncDesdeVentas: () => Promise<void>;
  abrirTurno: (montoApertura?: number) => Promise<void>;
  cerrarTurno: (montoCierre?: number) => Promise<void>;
  actualizarBilletes: (billetes: { denominacion: number; cantidad: number }[]) => Promise<void>;
  addEgreso: (proveedor: string, monto: number, medio_pago: 'efectivo' | 'transferencia') => Promise<void>;
  removeEgreso: (egresoId: number) => Promise<void>;
  exportarExcel: (desde: string, hasta: string) => Promise<{ success: boolean; path?: string; error?: string }>;
}

function hoyISO(): string {
  return new Date().toISOString().split('T')[0];
}

function mesActualISO(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

export const useLibroCajaStore = create<LibroCajaState>((set, get) => ({
  diaActual: null,
  turnos: [],
  turnoActivo: null,
  billetes: [],
  egresos: [],
  historico: [],
  periodos: [],
  periodoActual: mesActualISO(),
  fechaSeleccionada: hoyISO(),
  loading: false,
  loadingSync: false,

  setFecha: (fecha) => {
    set({ fechaSeleccionada: fecha });
    get().cargarDia(fecha);
  },

  setPeriodo: (periodo) => {
    set({ periodoActual: periodo });
    get().cargarHistorico();
  },

  cargarDia: async (fecha) => {
    const f = fecha || get().fechaSeleccionada;
    set({ loading: true });
    try {
      const { dia, turnos, billetes, egresos } = await libroCajaAPI.getDia(f);
      const turnoActivo = await libroCajaAPI.getTurnoActivo(f);
      set({ diaActual: dia, turnos, billetes, egresos, turnoActivo });
    } finally {
      set({ loading: false });
    }
  },

  cargarHistorico: async () => {
    const { periodoActual } = get();
    const historico = await libroCajaAPI.getHistorico(periodoActual);
    set({ historico });
  },

  cargarPeriodos: async () => {
    const periodos = await libroCajaAPI.getPeriodos();
    set({ periodos });
    // Si el mes actual no aparece en la lista, agregarlo como 'abierto'
    const mesActual = get().periodoActual;
    if (!periodos.some(p => p.periodo === mesActual)) {
      set(s => ({ periodos: [{ periodo: mesActual, estado: 'abierto', fecha_cierre: null }, ...s.periodos] }));
    }
  },

  cerrarMes: async (periodo) => {
    await libroCajaAPI.cerrarMes(periodo);
    await get().cargarPeriodos();
  },

  reabrirMes: async (periodo) => {
    await libroCajaAPI.reabrirMes(periodo);
    await get().cargarPeriodos();
  },

  actualizarCampo: async (campo, valor) => {
    const fecha = get().fechaSeleccionada;
    await libroCajaAPI.updateDia(fecha, { [campo]: valor } as Partial<LibroCajaDia>);
    // Actualizar estado local optimísticamente
    set(s => ({
      diaActual: s.diaActual ? { ...s.diaActual, [campo]: valor } : s.diaActual,
    }));
    // Refrescar histórico
    get().cargarHistorico();
  },

  actualizarCampoPorFecha: async (fecha, campo, valor) => {
    await libroCajaAPI.updateDia(fecha, { [campo]: valor } as Partial<LibroCajaDia>);
    // Si es el día actualmente cargado, actualizar también diaActual
    set(s => ({
      diaActual: s.diaActual?.fecha === fecha
        ? { ...s.diaActual, [campo]: valor }
        : s.diaActual,
      historico: s.historico.map(d =>
        d.fecha === fecha ? { ...d, [campo]: valor } : d
      ),
    }));
    get().cargarHistorico();
  },

  syncDesdeVentas: async () => {
    const fecha = get().fechaSeleccionada;
    set({ loadingSync: true });
    try {
      const { tarjetas, transferencias } = await libroCajaAPI.syncFromVentas(fecha);
      set(s => ({
        diaActual: s.diaActual
          ? { ...s.diaActual, tarjetas, transferencias }
          : s.diaActual,
      }));
      get().cargarHistorico();
    } finally {
      set({ loadingSync: false });
    }
  },

  abrirTurno: async (montoApertura = 0) => {
    const fecha = get().fechaSeleccionada;
    await libroCajaAPI.abrirTurno(fecha, { monto_apertura: montoApertura });
    await get().cargarDia(fecha);
  },

  cerrarTurno: async (montoCierre = 0) => {
    const { turnoActivo } = get();
    if (!turnoActivo) return;
    await libroCajaAPI.cerrarTurno(turnoActivo.id, { monto_cierre: montoCierre });
    await get().cargarDia(get().fechaSeleccionada);
  },

  actualizarBilletes: async (billetes) => {
    const fecha = get().fechaSeleccionada;
    await libroCajaAPI.updateBilletes(fecha, billetes);
    set(s => ({
      billetes: billetes.map(b => ({
        id: s.billetes.find(x => x.denominacion === b.denominacion)?.id ?? 0,
        dia_id: s.diaActual?.id ?? 0,
        denominacion: b.denominacion,
        cantidad: b.cantidad,
      })),
    }));
  },

  addEgreso: async (proveedor, monto, medio_pago) => {
    const fecha = get().fechaSeleccionada;
    const { id, extra_caja, egresos, transferencias, gastos_tarjeta } = await libroCajaAPI.addEgreso(fecha, { proveedor, monto, medio_pago });
    const nuevoEgreso: LibroCajaEgreso = {
      id: id as number,
      dia_id: get().diaActual?.id ?? 0,
      proveedor,
      monto,
      medio_pago,
      fecha: new Date().toISOString(),
    };
    set(s => ({
      egresos: [nuevoEgreso, ...s.egresos],
      diaActual: s.diaActual ? {
        ...s.diaActual,
        extra_caja,
        egresos,
        transferencias,
        gastos_tarjeta,
      } : s.diaActual,
    }));
    get().cargarHistorico();
  },

  removeEgreso: async (egresoId) => {
    const fecha = get().fechaSeleccionada;
    await libroCajaAPI.removeEgreso(egresoId, fecha);
    set(s => ({ egresos: s.egresos.filter(e => e.id !== egresoId) }));
    // Recargar día completo para reflejar cambios en extra_caja, transferencias, gastos_tarjeta
    const { dia } = await libroCajaAPI.getDia(fecha);
    set(s => ({ diaActual: s.diaActual ? { ...s.diaActual, ...dia } : s.diaActual }));
    get().cargarHistorico();
  },

  exportarExcel: async (desde, hasta) => {
    return await libroCajaAPI.exportExcel(desde, hasta);
  },
}));
