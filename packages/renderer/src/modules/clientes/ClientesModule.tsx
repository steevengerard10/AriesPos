import React, { useState, useEffect, useMemo } from 'react';
import {
  Users, Plus, Search, Edit, Trash2, RefreshCw, DollarSign, FileText, Download,
  ChevronDown, ChevronRight, Package
} from 'lucide-react';
import toast from 'react-hot-toast';
import { clientesAPI, ventasAPI, appAPI, sendEvent, productosAPI, authAPI } from '../../lib/api';
import { Modal, ConfirmDialog } from '../../components/shared/Modal';
import { formatCurrency, formatDate, downloadCSV } from '../../lib/utils';
import { useTranslation } from 'react-i18next';
import { useAppStore } from '../../store/useAppStore';

interface Cliente {
  id: number;
  nombre: string;
  apellido: string;
  documento: string;
  telefono: string;
  email: string;
  direccion: string;
  saldo_pendiente: number;
  limite_credito: number;
  activo: boolean;
}

interface VentaItem {
  id: number;
  producto_id?: number;
  producto_nombre: string;
  cantidad: number;
  precio_unitario: number;
  precio_actual: number | null;  // precio actual del producto (puede diferir del precio en la venta)
  precio_cobrado?: number;        // precio escrito manualmente en el carrito
  precio_modificado?: number;     // precio que el usuario escribió manualmente en el carrito (si lo cambió)
  precio_sistema?: number;        // precio original del producto
  total: number;
  fraccionable?: boolean;
  unidad_medida?: string;
}

interface FiadoPendienteItem {
  key: string;
  ventaId: number;
  ventaNumero: string;
  itemId: number;
  producto_nombre: string;
  cantidad: number;
  precioOriginal: number;        // precio en la venta (precio_unitario)
  precioActual: number;          // precio a usar para el cálculo
  precioModificado?: number;     // precio que el usuario escribió manualmente (si existe)
  precioSistema?: number;        // precio original del producto
}

type PagoParcialModo = 'manual' | 'automatico';

interface Venta {
  id: number;
  numero: string;
  fecha: string;
  hora: string;
  total: number;
  metodo_pago: string;
  estado: string;
  observaciones?: string;
}

const defaultCliente: Omit<Cliente, 'id' | 'saldo_pendiente'> = {
  nombre: '',
  apellido: '',
  documento: '',
  telefono: '',
  email: '',
  direccion: '',
  limite_credito: 0,
  activo: true,
};

export const ClientesModule: React.FC = () => {
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterFiados, setFilterFiados] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [formData, setFormData] = useState<Omit<Cliente, 'id' | 'saldo_pendiente'>>(defaultCliente);
  const [confirmDelete, setConfirmDelete] = useState<number | null>(null);
  const [showDeleteAdminModal, setShowDeleteAdminModal] = useState(false);
  const [deleteAdminPin, setDeleteAdminPin] = useState('');
  const [deleteAdminChecking, setDeleteAdminChecking] = useState(false);
  const [selectedCliente, setSelectedCliente] = useState<Cliente | null>(null);
  const [clienteVentas, setClienteVentas] = useState<Venta[]>([]);
  const [pagoMetodo, setPagoMetodo] = useState('efectivo');
  const [showPagarModal, setShowPagarModal] = useState(false);
  const [fiadoPendientes, setFiadoPendientes] = useState<FiadoPendienteItem[]>([]);
  const [pagoSeleccion, setPagoSeleccion] = useState<Record<string, { checked: boolean; cantidad: number }>>({});
  const [loadingPagoItems, setLoadingPagoItems] = useState(false);
  const [pagoSubmitting, setPagoSubmitting] = useState(false);
  const [showPagoParcialModal, setShowPagoParcialModal] = useState(false);
  const [pagoParcialModo, setPagoParcialModo] = useState<PagoParcialModo>('manual');
  const [pagoParcialVentaId, setPagoParcialVentaId] = useState<number | null>(null);
  const [pagoParcialItems, setPagoParcialItems] = useState<FiadoPendienteItem[]>([]);
  const [pagoParcialSeleccion, setPagoParcialSeleccion] = useState<Record<string, number>>({});
  const [pagoParcialMonto, setPagoParcialMonto] = useState('');
  const [pagoParcialMetodo, setPagoParcialMetodo] = useState('efectivo');
  const [pagoParcialLoading, setPagoParcialLoading] = useState(false);
  const [descuentoCobroActivo, setDescuentoCobroActivo] = useState(false);
  const [descuentoCobroUnidad, setDescuentoCobroUnidad] = useState<'%' | '$'>('%');
  const [descuentoCobroValor, setDescuentoCobroValor] = useState('0');
  const [recargoCobroActivo, setRecargoCobroActivo] = useState(false);
  const [recargoCobroUnidad, setRecargoCobroUnidad] = useState<'%' | '$'>('%');
  const [recargoCobroValor, setRecargoCobroValor] = useState('0');
  const [saldoActual, setSaldoActual] = useState<number | null>(null);
  const [expandedVentaId, setExpandedVentaId] = useState<number | null>(null);
  const [ventaItemsCache, setVentaItemsCache] = useState<Record<number, VentaItem[]>>({});
  const [loadingItems, setLoadingItems] = useState<number | null>(null);
  const [showDeleteFiadosByDayModal, setShowDeleteFiadosByDayModal] = useState(false);
  const [deleteByDayPin, setDeleteByDayPin] = useState('');
  const [deleteByDayChecking, setDeleteByDayChecking] = useState(false);
  const [deleteFiadosByDayDate, setDeleteFiadosByDayDate] = useState<string | null>(null);
  const { t } = useTranslation();
  const { config } = useAppStore();

  // Métodos de pago activos (sin 'fiado') para cobrar deudas
  const metodosPagoFiado = useMemo<{ id: string; nombre: string }[]>(() => {
    try {
      const raw = config.metodos_pago;
      if (raw) return (JSON.parse(raw) as { id: string; nombre: string; activo: boolean }[]).filter((m) => m.activo && m.id !== 'fiado');
    } catch { /* silencioso */ }
    return [
      { id: 'efectivo', nombre: 'Efectivo' },
      { id: 'tarjeta', nombre: 'Tarjeta' },
      { id: 'transferencia', nombre: 'Transferencia' },
    ];
  }, [config.metodos_pago]);

  const loadData = async () => {
    setLoading(true);
    try {
      const list = await clientesAPI.getAll() as Cliente[];
      setClientes(list);
      return list;
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); }, []);

  // Sincronización en tiempo real: recargar cuando llega un evento de cliente actualizado (ej: venta fiado)
  useEffect(() => {
    const w = window as unknown as { electron?: { on: (ch: string, cb: () => void) => (() => void) } };
    if (!w.electron) return;
    const cleanup = w.electron.on('cliente:actualizado', () => loadData());
    return cleanup;
  }, []);

  // Sincronización en tiempo real: recargar cuando cambia la lista de fiados (cobro vía IPC o REST)
  useEffect(() => {
    const w = window as unknown as { electron?: { on: (ch: string, cb: () => void) => (() => void) } };
    if (!w.electron) return;
    const cleanup = w.electron.on('fiados:list-changed', () => loadData());
    return cleanup;
  }, []);

  const filtered = useMemo(() => {
    let list = clientes;
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter((c) => c.nombre.toLowerCase().includes(q) || c.apellido.toLowerCase().includes(q) || c.documento.includes(q) || c.telefono.includes(q));
    }
    if (filterFiados) {
      list = list.filter((c) => c.saldo_pendiente > 0);
    }
    return list;
  }, [clientes, search, filterFiados]);

  const handleSave = async () => {
    if (!formData.nombre.trim()) { toast.error('El nombre es obligatorio'); return; }
    // Solo enviamos campos que existen en la tabla
    const apiData: Record<string, unknown> = {
      nombre: formData.nombre,
      apellido: formData.apellido,
      documento: formData.documento,
      telefono: formData.telefono,
      email: formData.email,
      direccion: formData.direccion,
      limite_credito: formData.limite_credito,
    };
    try {
      if (editingId) {
        await clientesAPI.update(editingId, apiData);
        toast.success(t('clie.updated'));
      } else {
        await clientesAPI.create(apiData);
        toast.success(t('clie.created'));
      }
      setShowForm(false);
      setEditingId(null);
      setFormData(defaultCliente);
      loadData();
    } catch {
      toast.error('Error al guardar el cliente');
    }
  };

  const handleEdit = (c: Cliente) => {
    setFormData({
      nombre: c.nombre,
      apellido: c.apellido || '',
      documento: c.documento || '',
      telefono: c.telefono || '',
      email: c.email || '',
      direccion: c.direccion || '',
      limite_credito: c.limite_credito || 0,
      activo: c.activo,
    });
    setEditingId(c.id);
    setShowForm(true);
  };

  const handleDelete = async (id: number) => {
    setConfirmDelete(null);
    setDeleteAdminPin('');
    setShowDeleteAdminModal(true);
    setPendingDeleteId(id);
  };

  const [pendingDeleteId, setPendingDeleteId] = useState<number | null>(null);

  const confirmDeleteWithPin = async () => {
    if (pendingDeleteId == null) return;
    if (!deleteAdminPin.trim()) {
      toast.error('Ingresá el PIN de administrador');
      return;
    }
    setDeleteAdminChecking(true);
    try {
      const res = await authAPI.validateAdmin(deleteAdminPin.trim());
      if (!res.ok) {
        toast.error(res.error || 'PIN de administrador incorrecto');
        return;
      }
      await clientesAPI.delete(pendingDeleteId);
      toast.success(t('clie.deleted'));
      setShowDeleteAdminModal(false);
      setDeleteAdminPin('');
      setPendingDeleteId(null);
      loadData();
    } finally {
      setDeleteAdminChecking(false);
    }
  };

  const handleVerCuenta = async (c: Cliente) => {
    setSelectedCliente(c);
    setExpandedVentaId(null);
    setVentaItemsCache({});
    setSaldoActual(null);
    const [ventas, saldo] = await Promise.all([
      clientesAPI.getVentas(c.id) as Promise<Venta[]>,
      clientesAPI.getSaldoActual(c.id) as Promise<number>,
    ]);
    setClienteVentas(ventas);
    setSaldoActual(saldo);
    const pendientes = ventas.filter((v) => v.estado === 'fiado' || v.estado === 'parcial');
    if (pendientes.length > 0) {
      const cacheUpdates: Record<number, VentaItem[]> = {};
      await Promise.all(
        pendientes.map(async (v) => {
          const detail = await ventasAPI.getById(v.id) as { items: VentaItem[] };
          cacheUpdates[v.id] = detail.items || [];
        })
      );
      setVentaItemsCache((prev) => ({ ...prev, ...cacheUpdates }));
    }
  };

  const loadFiadoPendientes = async (clienteId: number, ventaId?: number): Promise<FiadoPendienteItem[]> => {
    const ventas = ventaId == null
      ? await clientesAPI.getVentas(clienteId) as Venta[]
      : [await ventasAPI.getById(ventaId) as Venta];
    const pendientes = ventas.filter((v) => v.estado === 'fiado' || v.estado === 'parcial');
    const items: FiadoPendienteItem[] = [];
    await Promise.all(
      pendientes.map(async (v) => {
        const detail = await ventasAPI.getById(v.id) as { items: VentaItem[] };
        for (const item of detail.items || []) {
          // Aplicar la lógica de precios:
          // Si existe precio_modificado: usar ese precio
          // Si no: usar precio_actual (precio vigente)
          // Si no existe precio_actual: usar precio_unitario (precio en la venta)
          const precioParaUsar = ventaId != null
            ? (item.precio_actual != null && item.precio_actual > 0 ? item.precio_actual : item.precio_unitario)
            : item.precio_cobrado ?? item.precio_modificado ?? (item.precio_actual ?? item.precio_unitario);
          
          items.push({
            key: `${v.id}-${item.id}`,
            ventaId: v.id,
            ventaNumero: v.numero,
            itemId: item.id,
            producto_nombre: item.producto_nombre,
            cantidad: item.cantidad,
            precioOriginal: item.precio_unitario,
            precioActual: precioParaUsar,
            precioModificado: item.precio_cobrado ?? item.precio_modificado,
            precioSistema: item.precio_sistema,
          });
        }
      })
    );
    return items;
  };

  const initPagoSeleccion = (items: FiadoPendienteItem[]) => {
    const sel: Record<string, { checked: boolean; cantidad: number }> = {};
    items.forEach((item) => {
      sel[item.key] = { checked: true, cantidad: item.cantidad };
    });
    return sel;
  };

  // Agrupar fiados por día
  const fiadosPorDia = useMemo(() => {
    const grouped = new Map<string, { ventas: Venta[]; total: number }>();
    clienteVentas
      .filter((v) => v.estado === 'fiado' || v.estado === 'parcial')
      .forEach((v) => {
        const key = v.fecha;
        if (!grouped.has(key)) grouped.set(key, { ventas: [], total: 0 });
        const item = grouped.get(key)!;
        item.ventas.push(v);
        item.total += v.total;
      });
    return Array.from(grouped.entries())
      .sort((a, b) => b[0].localeCompare(a[0])) // Orden descendente (más recientes primero)
      .map(([fecha, data]) => ({ fecha, ...data }));
  }, [clienteVentas]);

  const handleDeleteFiadosByDay = async () => {
    if (!selectedCliente || !deleteFiadosByDayDate) return;
    if (!deleteByDayPin.trim()) {
      toast.error('Ingresá el PIN de administrador');
      return;
    }
    setDeleteByDayChecking(true);
    try {
      const res = await authAPI.validateAdmin(deleteByDayPin.trim());
      if (!res.ok) {
        toast.error(res.error || 'PIN de administrador incorrecto');
        return;
      }
      const result = await clientesAPI.deleteFiadosByDay(selectedCliente.id, deleteFiadosByDayDate);
      if (!result.success) {
        toast.error(result.error || 'No se pudieron eliminar los fiados');
        return;
      }
      toast.success(`Eliminados ${result.deleted ?? 0} fiados del día ${deleteFiadosByDayDate}`);
      setShowDeleteFiadosByDayModal(false);
      setDeleteByDayPin('');
      setDeleteFiadosByDayDate(null);
      loadData();
      if (selectedCliente) {
        const ventas = await clientesAPI.getVentas(selectedCliente.id) as Venta[];
        setClienteVentas(ventas);
      }
    } finally {
      setDeleteByDayChecking(false);
    }
  };

  const handleOpenDeleteFiadosByDayModal = (fecha: string) => {
    setDeleteFiadosByDayDate(fecha);
    setDeleteByDayPin('');
    setShowDeleteFiadosByDayModal(true);
  };

  const handleOpenPagarModal = async () => {
    if (!selectedCliente) return;
    setShowPagarModal(true);
    setPagoMetodo('efectivo');
    setDescuentoCobroActivo(false);
    setDescuentoCobroUnidad('%');
    setDescuentoCobroValor('0');
    setRecargoCobroActivo(false);
    setRecargoCobroUnidad('%');
    setRecargoCobroValor('0');
    setLoadingPagoItems(true);
    try {
      const items = await loadFiadoPendientes(selectedCliente.id);
      setFiadoPendientes(items);
      setPagoSeleccion(initPagoSeleccion(items));
    } finally {
      setLoadingPagoItems(false);
    }
  };

  const handleOpenPagoParcial = async (ventaId: number) => {
    if (!selectedCliente) return;
    setPagoParcialVentaId(ventaId);
    setPagoParcialModo('manual');
    setPagoParcialSeleccion({});
    setPagoParcialMonto('');
    setPagoParcialMetodo('efectivo');
    setShowPagoParcialModal(true);
    setPagoParcialLoading(true);
    try {
      const items = await loadFiadoPendientes(selectedCliente.id, ventaId);
      setPagoParcialItems(items);
      setPagoParcialSeleccion(Object.fromEntries(items.map((item) => [item.key, 0])));
    } catch {
      toast.error('No se pudieron cargar los productos pendientes');
      setShowPagoParcialModal(false);
    } finally {
      setPagoParcialLoading(false);
    }
  };

  const handleToggleVenta = async (ventaId: number) => {
    if (expandedVentaId === ventaId) {
      setExpandedVentaId(null);
      return;
    }
    setExpandedVentaId(ventaId);
    if (ventaItemsCache[ventaId]) return;
    setLoadingItems(ventaId);
    try {
      const detail = await ventasAPI.getById(ventaId) as { items: VentaItem[] };
      setVentaItemsCache((prev) => ({ ...prev, [ventaId]: detail.items || [] }));
    } finally {
      setLoadingItems(null);
    }
  };

  const totalSeleccionado = useMemo(() => {
    return fiadoPendientes.reduce((sum, item) => {
      const sel = pagoSeleccion[item.key];
      if (!sel?.checked) return sum;
      const qty = Math.min(Math.max(0, sel.cantidad), item.cantidad);
      return sum + qty * item.precioActual;
    }, 0);
  }, [fiadoPendientes, pagoSeleccion]);

  const descuentoCobro = descuentoCobroActivo
    ? (descuentoCobroUnidad === '%' ? totalSeleccionado * ((parseFloat(descuentoCobroValor) || 0) / 100) : Math.max(0, parseFloat(descuentoCobroValor) || 0))
    : 0;
  const recargoCobro = recargoCobroActivo
    ? (recargoCobroUnidad === '%' ? totalSeleccionado * ((parseFloat(recargoCobroValor) || 0) / 100) : Math.max(0, parseFloat(recargoCobroValor) || 0))
    : 0;
  const totalCobro = Math.max(0, totalSeleccionado - descuentoCobro + recargoCobro);

  const pagoParcialSeleccionados = useMemo(() => {
    if (pagoParcialModo === 'manual') {
      return pagoParcialItems.flatMap((item) => {
        const cantidad = Math.min(Math.max(0, Number(pagoParcialSeleccion[item.key]) || 0), item.cantidad);
        return cantidad > 0 ? [{ item, cantidad }] : [];
      });
    }
    const monto = Math.max(0, Number(pagoParcialMonto) || 0);
    const totalPendiente = pagoParcialItems.reduce((total, item) => total + item.cantidad * item.precioActual, 0);
    if (monto <= 0 || totalPendiente <= 0) return [];
    return pagoParcialItems.flatMap((item) => {
      if (item.precioActual <= 0) return [];
      const montoProporcional = monto * (item.cantidad * item.precioActual) / totalPendiente;
      const cantidad = Math.min(item.cantidad, Math.floor((montoProporcional + 0.000001) / item.precioActual));
      return cantidad > 0 ? [{ item, cantidad }] : [];
    });
  }, [pagoParcialModo, pagoParcialItems, pagoParcialSeleccion, pagoParcialMonto]);
  const pagoParcialTotalProductos = pagoParcialSeleccionados.reduce(
    (total, seleccion) => total + Math.round(seleccion.item.precioActual * seleccion.cantidad * 100) / 100,
    0,
  );
  const pagoParcialMontoRecibido = Math.max(0, Math.round((Number(pagoParcialMonto) || 0) * 100) / 100);
  const pagoParcialVarios = Math.max(0, Math.round((pagoParcialMontoRecibido - pagoParcialTotalProductos) * 100) / 100);
  const pagoParcialMontoInsuficiente = pagoParcialModo === 'manual' && pagoParcialTotalProductos > pagoParcialMontoRecibido + 0.009;

  const handleConfirmarPagoParcial = async () => {
    if (!selectedCliente || pagoParcialVentaId == null || pagoSubmitting || pagoParcialMontoRecibido <= 0 || pagoParcialMontoInsuficiente) return;
    setPagoSubmitting(true);
    try {
      const result = await clientesAPI.pagarFiadoProductos(
        selectedCliente.id,
        pagoParcialVentaId,
        pagoParcialSeleccionados.map(({ item, cantidad }) => ({ venta_id: item.ventaId, item_id: item.itemId, cantidad })),
        pagoParcialMontoRecibido,
        pagoParcialMetodo,
      );
      toast.success(`Pago parcial registrado: ${formatCurrency(result.monto)}`);
      setShowPagoParcialModal(false);
      setPagoParcialItems([]);
      setPagoParcialSeleccion({});
      const freshList = await loadData();
      const updated = freshList?.find((cliente) => cliente.id === selectedCliente.id) || selectedCliente;
      await handleVerCuenta(updated);
      setExpandedVentaId(pagoParcialVentaId);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'No se pudo registrar el pago parcial');
      if (selectedCliente) {
        const items = await loadFiadoPendientes(selectedCliente.id, pagoParcialVentaId).catch(() => []);
        setPagoParcialItems(items);
      }
    } finally {
      setPagoSubmitting(false);
    }
  };

  const cargarFiadoEnPos = async (ventaId?: number) => {
    if (!selectedCliente) return;

    try {
      const ventasPendientes = ventaId != null
        ? [await ventasAPI.getById(ventaId) as Venta & { items?: VentaItem[] }]
        : (await clientesAPI.getVentas(selectedCliente.id) as Venta[]).filter((v) => v.estado === 'fiado' || v.estado === 'parcial');

      const grouped = new Map<string, {
        producto_id: number;
        nombre: string;
        cantidad: number;
        precio_unitario: number;
        precio_original: number;
        precio_modificado?: number;
        precio_sistema?: number;
        fraccionable: boolean;
        unidad_medida: string;
      }>();

      for (const venta of ventasPendientes) {
        const detalle = await ventasAPI.getById(venta.id) as { items?: VentaItem[] };
        const items = detalle.items ?? [];

        for (const item of items) {
          const qty = Number(item.cantidad) || 0;
          if (!qty) continue;

          const prod = item.producto_id != null ? await productosAPI.getById(item.producto_id) as { nombre?: string; precio_venta?: number } | null : null;
          const nombre = (prod?.nombre || item.producto_nombre || 'Producto').trim() || 'Producto';
          
          // Aplicar la lógica de precios:
          // Si existe precio_modificado: usar ese precio
          // Si no: usar precio_actual (precio vigente del producto)
          // Si no existe precio_actual: usar precio_unitario (precio en la venta)
          const precioParaUsar = item.precio_cobrado ?? item.precio_modificado ?? (Number(prod?.precio_venta ?? item.precio_actual ?? item.precio_unitario ?? 0));
          const precioOriginal = Number(item.precio_unitario ?? precioParaUsar ?? 0);
          
          const key = item.producto_id ? `pid:${item.producto_id}` : `name:${nombre.toLowerCase()}`;
          const existing = grouped.get(key);

          if (existing) {
            existing.cantidad += qty;
            existing.precio_unitario = precioParaUsar || existing.precio_unitario || precioOriginal;
            existing.precio_original = precioOriginal || existing.precio_original || precioParaUsar || 0;
            existing.nombre = nombre;
          } else {
            grouped.set(key, {
              producto_id: item.producto_id ?? 0,
              nombre,
              cantidad: qty,
              precio_unitario: precioParaUsar || precioOriginal || 0,
              precio_original: precioOriginal || precioParaUsar || 0,
              precio_modificado: item.precio_cobrado ?? item.precio_modificado,
              precio_sistema: item.precio_sistema,
              fraccionable: Boolean(item.fraccionable),
              unidad_medida: item.unidad_medida || 'unidad',
            });
          }
        }
      }

      const cartItems = Array.from(grouped.values()).map((item) => ({
        itemId: typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `fiado_${Date.now()}_${Math.random().toString(16).slice(2)}`,
        producto_id: item.producto_id,
        nombre: item.nombre,
        cantidad: item.cantidad,
        precio_unitario: item.precio_unitario,
        precio_original: item.precio_original,
          precio_modificado: item.precio_modificado,
        precio_sistema: item.precio_sistema,
        descuento: 0,
        total: item.precio_unitario * item.cantidad,
        fraccionable: item.fraccionable,
        unidad_medida: item.unidad_medida,
      }));

      if (!cartItems.length) {
        toast.error('No hay productos pendientes para cargar en caja');
        return;
      }

      const payload = {
        items: cartItems,
        descuentoGlobal: 0,
        clienteId: selectedCliente.id,
        clienteNombre: `${selectedCliente.nombre} ${selectedCliente.apellido}`.trim(),
        observaciones: ventaId != null ? 'Fiado cargado desde cuenta corriente' : 'Cargar fiado total del cliente',
        metodoPago: 'fiado',
        esFiado: true,
        tipoOperacion: 'venta' as const,
      };

      try {
        sessionStorage.setItem('pos:reabrir-venta', JSON.stringify(payload));
      } catch { /* silencioso */ }

      appAPI.openPosWindow();
      const emitReabrir = () => sendEvent('broadcast-event', 'pos:reabrir-venta', payload);
      setTimeout(emitReabrir, 400);
      setTimeout(emitReabrir, 1200);
      toast.success(ventaId != null ? 'Fiado cargado en caja' : 'Fiado total cargado en caja');
    } catch {
      toast.error('No se pudo cargar el fiado en el POS');
    }
  };

  const handlePagar = async () => {
    if (!selectedCliente || pagoSubmitting) return;
    const monto = totalCobro;
    if (!monto || monto <= 0) { toast.error('Seleccioná al menos un producto'); return; }
    setPagoSubmitting(true);
    try {
      await clientesAPI.pagarFiado(selectedCliente.id, monto, pagoMetodo);
      toast.success(`Pago registrado: ${formatCurrency(monto)}`);
      setShowPagarModal(false);
      setPagoMetodo('efectivo');
      setFiadoPendientes([]);
      setPagoSeleccion({});
      setSaldoActual(null);
      const freshList = await loadData();
      const updated = freshList?.find((c) => c.id === selectedCliente.id);
      if (updated) {
        setSelectedCliente(updated);
        await handleVerCuenta(updated);
      }
    } catch {
      toast.error('Error al registrar el pago');
    } finally {
      setPagoSubmitting(false);
    }
  };

  const handleExportCSV = () => {
    const headers = 'id,nombre,apellido,dni,telefono,email,direccion,saldo_pendiente,limite_credito';
    const rows = clientes.map((c) =>
      [c.id, `"${c.nombre}"`, `"${c.apellido}"`, c.documento, c.telefono, c.email, `"${c.direccion}"`, c.saldo_pendiente, c.limite_credito].join(',')    
    );
    downloadCSV([headers, ...rows].join('\n'), 'clientes_ariespos.csv');
    toast.success('Exportado correctamente');
  };

  const handleExportFiadosExcel = async () => {
    try {
      const res = await window.electron!.invoke('fiados:exportExcel') as { success: boolean; filePath: string };
      if (res.success) toast.success(`Excel guardado en Documentos/ARIESPos/`);
    } catch {
      toast.error('No se pudo generar el Excel');
    }
  };

  const totalFiado = useMemo(() => clientes.reduce((s, c) => s + c.saldo_pendiente, 0), [clientes]);

  return (
    <div className="flex flex-col lg:flex-row h-full min-h-0 flex-1 w-full overflow-y-auto lg:overflow-hidden gap-4">
      {/* Lista de clientes */}
      <div className={`flex flex-col min-h-0 flex-1 w-full lg:min-w-0 overflow-hidden ${selectedCliente ? 'lg:max-w-[50%]' : ''}`}>
        {/* Header */}
        <div className="shrink-0 module-header px-6 pt-6">
          <div>
            <h1 className="module-title flex items-center gap-3"><Users size={28} className="text-blue-400" /> {t('clie.title')}</h1>
          </div>
          <div className="flex gap-2">
            <button className="btn-secondary btn btn-sm" onClick={handleExportFiadosExcel}><Download size={14} /> {t('clie.fiadosExcel')}</button>
            <button className="btn-secondary btn btn-sm" onClick={handleExportCSV}><Download size={14} /> CSV</button>
            <button className="btn-primary btn" onClick={() => { setFormData(defaultCliente); setEditingId(null); setShowForm(true); }}>
              <Plus size={16} /> {t('clie.new')}
            </button>
          </div>
        </div>

        {/* Filtros */}
        <div className="shrink-0 px-6 pb-4 flex items-center gap-3">
          <div className="relative flex-1">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input type="text" placeholder={t('clie.search')} value={search} onChange={(e) => setSearch(e.target.value)} className="input pl-9 text-sm" />
          </div>
          <label className="flex items-center gap-2 text-sm text-slate-400 cursor-pointer whitespace-nowrap">
            <input type="checkbox" checked={filterFiados} onChange={(e) => setFilterFiados(e.target.checked)} className="rounded" />
            {t('clie.withDebt')}
          </label>
          <button className="btn-ghost btn p-2" onClick={loadData}><RefreshCw size={16} /></button>
        </div>

        {/* Tabla + barra de totales */}
        <div className="flex-1 flex flex-col min-h-0 px-6 pb-6">
          <div className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden flex flex-col flex-1 min-h-0">
            <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden">
              <table className="w-full border-collapse table-fixed">
                <colgroup>
                  <col />
                  <col style={{ width: '26%' }} />
                  <col style={{ width: '18%' }} />
                  <col style={{ width: '14%' }} />
                </colgroup>
                <thead className="sticky top-0 z-10 bg-[var(--bg2)] shadow-[0_1px_0_var(--border)]">
                  <tr className="border-b border-slate-700">
                    <th className="table-header text-left">{t('clie.col.name')}</th>
                    <th className="table-header text-left">{t('clie.col.contact')}</th>
                    <th className="table-header text-right">{t('clie.col.balance')}</th>
                    <th className="table-header text-center w-24"></th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr><td colSpan={4} className="text-center py-8 text-slate-400">{t('common.loading')}</td></tr>
                  ) : filtered.length === 0 ? (
                    <tr><td colSpan={4} className="text-center py-8 text-slate-500">{t('clie.empty')}</td></tr>
                  ) : filtered.map((c) => (
                    <tr
                      key={c.id}
                      className={`table-row cursor-pointer ${selectedCliente?.id === c.id ? 'bg-blue-900/20' : ''}`}
                      onClick={() => handleVerCuenta(c)}
                    >
                      <td className="table-cell align-middle text-left">
                        <div className="font-semibold text-white truncate" title={`${c.nombre} ${c.apellido}`.trim()}>{c.nombre} {c.apellido}</div>
                        {c.documento && <div className="text-xs text-slate-500 truncate">Doc: {c.documento}</div>}
                      </td>
                      <td className="table-cell align-middle text-left text-sm text-slate-400">
                        {c.telefono && <div className="truncate">{c.telefono}</div>}
                        {c.email && <div className="text-xs truncate">{c.email}</div>}
                      </td>
                      <td className="table-cell align-middle text-right whitespace-nowrap">
                        {c.saldo_pendiente > 0 ? (
                          <span className="font-mono font-bold text-red-400">{formatCurrency(c.saldo_pendiente)}</span>
                        ) : (
                          <span className="text-slate-500 text-sm">{t('clie.noDebt')}</span>
                        )}
                      </td>
                      <td className="table-cell align-middle text-center whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                        <div className="flex gap-1 justify-center">
                          <button onClick={() => handleEdit(c)} className="btn-ghost btn p-1.5"><Edit size={13} /></button>
                          <button onClick={() => setConfirmDelete(c.id)} className="btn-ghost btn p-1.5 hover:text-red-400"><Trash2 size={13} /></button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {/* Barra de totales fija */}
            <div className="shrink-0 bg-slate-900/80 border-t border-slate-700 px-4 py-2 flex items-center justify-between">
              <span className="text-sm text-slate-400">{clientes.length} clientes</span>
              <span className="font-mono font-bold text-lg text-red-400">{formatCurrency(totalFiado)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Panel de cuenta corriente */}
      {selectedCliente && (
        <div className="flex flex-col flex-1 min-h-0 min-w-0 w-full lg:w-1/2 lg:max-w-[50%] bg-slate-800/50 rounded-2xl border border-slate-700 my-4 mr-6 overflow-hidden">
          {/* Header cuenta */}
          <div className="p-5 border-b border-slate-700 flex items-start justify-between">
            <div>
              <h2 className="text-lg font-bold text-white">{selectedCliente.nombre} {selectedCliente.apellido}</h2>
              <div className="text-sm text-slate-400 mt-0.5 space-x-3">
                {selectedCliente.telefono && <span>{selectedCliente.telefono}</span>}
                {selectedCliente.documento && <span>Doc: {selectedCliente.documento}</span>}
              </div>
            </div>
            <button onClick={() => setSelectedCliente(null)} className="btn-ghost btn p-2 text-slate-400">✕</button>
          </div>

          {/* Saldo */}
          <div className="p-5 border-b border-slate-700 flex items-center justify-between">
            <div>
              <div className="text-xs text-slate-400 uppercase tracking-wider">{t('clie.pendingBalance')}</div>
              {saldoActual === null ? (
                <div className="text-2xl font-mono font-bold mt-1 text-slate-500">...</div>
              ) : (
                <div className={`text-2xl font-mono font-bold mt-1 ${saldoActual > 0 ? 'text-red-400' : 'text-green-400'}`}>
                  {formatCurrency(saldoActual)}
                </div>
              )}
              {selectedCliente.limite_credito > 0 && (
                <div className="text-xs text-slate-500 mt-1">Límite: {formatCurrency(selectedCliente.limite_credito)}</div>
              )}
            </div>
            {(saldoActual ?? selectedCliente.saldo_pendiente) > 0 && (
              <div className="flex gap-2">
                <button className="btn-secondary btn" onClick={() => void handleOpenPagarModal()}>
                  <FileText size={16} /> Registrar pago total
                </button>
                <button className="btn-success btn" onClick={() => void handleOpenPagarModal()}>
                  <DollarSign size={16} /> {t('clie.registerPayment')}
                </button>
              </div>
            )}
          </div>

          {/* Historial */}
          <div className="flex-1 min-h-0 overflow-y-auto p-4">
            <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-3 flex items-center gap-2">
              <FileText size={14} /> {t('clie.salesHistory')}
            </h3>
            {clienteVentas.length === 0 ? (
              <p className="text-slate-500 text-sm text-center py-8">{t('clie.noSales')}</p>
            ) : (
              <div className="space-y-1.5">
                {clienteVentas.map((v) => {
                  const isExpanded = expandedVentaId === v.id;
                  const items = ventaItemsCache[v.id];
                  const totalActual = items?.length
                    ? items.reduce((s, it) => {
                        // Aplicar lógica de precios: si existe precio_modificado usarlo, si no usar precio_actual
                        const precioModificado = it.precio_cobrado ?? it.precio_modificado;
                        const precioActual = it.precio_actual ?? it.precio_unitario;
                        const precioParaUsar = precioModificado != null ? precioModificado : precioActual;
                        return s + it.cantidad * precioParaUsar;
                      }, 0)
                    : v.total;
                  return (
                    <div key={v.id} className="bg-slate-700/50 rounded-lg overflow-hidden">
                      {/* Cabecera de la venta — click para expandir */}
                      <button
                        className="w-full flex items-center justify-between p-3 hover:bg-slate-600/40 transition-colors text-left"
                        onClick={() => handleToggleVenta(v.id)}
                        onDoubleClick={() => void cargarFiadoEnPos(v.id)}
                        title="Doble click para cargar esta venta en el POS"
                      >
                        <div className="flex items-center gap-2">
                          {isExpanded
                            ? <ChevronDown size={14} className="text-blue-400 shrink-0" />
                            : <ChevronRight size={14} className="text-slate-500 shrink-0" />}
                          <div>
                            <div className="text-sm font-semibold text-white">#{v.numero}</div>
                            <div className="text-xs text-slate-400">
                              {formatDate(v.fecha)}{v.hora ? ` · ${v.hora.slice(0, 5)}` : ''}
                            </div>
                          </div>
                        </div>
                        <div className="text-right shrink-0">
                          <div className="font-mono font-bold text-white">{formatCurrency(totalActual)}</div>
                          <div className={`text-xs capitalize ${v.estado === 'fiado' || v.estado === 'parcial' ? 'text-red-400' : 'text-green-400'}`}>
                            {v.estado === 'fiado' ? 'pendiente' : v.estado === 'parcial' ? 'parcial' : v.metodo_pago}
                          </div>
                        </div>
                      </button>

                      {/* Detalle expandible */}
                      {isExpanded && (
                        <div className="border-t border-slate-600/50 px-3 pb-3 pt-2">
                          {loadingItems === v.id ? (
                            <p className="text-xs text-slate-400 text-center py-2">Cargando...</p>
                          ) : !items || items.length === 0 ? (
                            <p className="text-xs text-slate-500 text-center py-2">Sin detalle de productos</p>
                          ) : (
                            <div className="space-y-1">
                              {items.map((item, idx) => {
                                // Lógica de precios según lo especificado:
                                // Si existe precio_modificado: usar ese precio siempre
                                // Si no existe precio_modificado: usar precio_actual (precio vigente)
                                // Si precio vigente difiere del precio_sistema original: mostrar precio_sistema tachado + precio vigente
                                
                                const precioModificado = item.precio_cobrado ?? item.precio_modificado;
                                const precioSistema = item.precio_sistema;
                                const precioActual = item.precio_actual ?? item.precio_unitario;
                                const precioUnitario = item.precio_unitario;
                                
                                // Determinar qué precio usar
                                let precioParaMostrar: number;
                                let precioTachado: number | null = null;
                                
                                if (precioModificado != null) {
                                  // Existe precio_modificado: usar ese siempre
                                  precioParaMostrar = precioModificado;
                                  // No mostrar tachado si está modificado
                                } else {
                                  // No existe precio_modificado
                                  precioParaMostrar = precioActual;
                                  // Si precio_sistema existe y difiere del precio_actual: mostrar precio_sistema tachado
                                  if (precioSistema != null && Math.abs(precioActual - precioSistema) >= 0.01) {
                                    precioTachado = precioSistema;
                                  }
                                }
                                
                                const lineTotalActual = item.cantidad * precioParaMostrar;
                                return (
                                  <div key={idx} className="flex items-center justify-between text-xs">
                                    <div className="flex items-center gap-1.5 text-slate-300 flex-1 min-w-0">
                                      <Package size={11} className="text-slate-500 shrink-0" />
                                      <span className="truncate">{item.producto_nombre || 'Producto eliminado'}</span>
                                    </div>
                                    <div className="flex items-center gap-3 shrink-0 ml-2">
                                      <span className="text-slate-400">x{item.cantidad % 1 === 0 ? item.cantidad : item.cantidad.toFixed(2)}</span>
                                      <span className="font-mono w-24 text-right">
                                        {precioTachado != null ? (
                                          <span className="flex flex-col items-end gap-0.5">
                                            <span className="line-through text-slate-500 text-[10px]">{formatCurrency(precioTachado)}</span>
                                            <span className="text-white font-semibold">{formatCurrency(precioParaMostrar)}</span>
                                          </span>
                                        ) : (
                                          <span className="text-white">{formatCurrency(precioParaMostrar)}</span>
                                        )}
                                      </span>
                                      <span className="font-mono text-white w-20 text-right">{formatCurrency(lineTotalActual)}</span>
                                    </div>
                                  </div>
                                );
                              })}
                              {(() => {
                                // Calcular subtotal con la lógica correcta de precios
                                const subtotalActual = items.reduce((s, item) => {
                                  // Aplicar la lógica de precios a cada item
                                  const precioModificado = item.precio_cobrado ?? item.precio_modificado;
                                  const precioSistema = item.precio_sistema;
                                  const precioActual = item.precio_actual ?? item.precio_unitario;
                                  
                                  const precioParaUsar = precioModificado != null ? precioModificado : precioActual;
                                  return s + item.cantidad * precioParaUsar;
                                }, 0);
                                return (
                                  <div className="flex items-center justify-between text-xs pt-2 mt-1 border-t border-slate-600/40">
                                    <span className="text-slate-400 font-semibold">Subtotal (precio actual)</span>
                                    <span className="font-mono font-bold text-white">{formatCurrency(subtotalActual)}</span>
                                  </div>
                                );
                              })()}
                              {v.observaciones && (
                                <div className="text-xs text-slate-500 italic pt-1 border-t border-slate-600/40 mt-1">
                                  {v.observaciones}
                                </div>
                              )}
                              {(v.estado === 'fiado' || v.estado === 'parcial') && (
                                <div className="flex justify-end pt-2 border-t border-slate-600/40 mt-1">
                                  <button
                                    type="button"
                                    className="btn-success btn btn-sm"
                                    onClick={() => void handleOpenPagoParcial(v.id)}
                                  >
                                    <DollarSign size={14} /> Pago parcial
                                  </button>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Fiados pendientes por día */}
          {fiadosPorDia.length > 0 && (
            <div className="flex-1 min-h-0 overflow-y-auto p-4 border-t border-slate-700">
              <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                <FileText size={14} /> Fiados pendientes por día
              </h3>
              <div className="space-y-2">
                {fiadosPorDia.map(({ fecha, ventas, total }) => (
                  <div key={fecha} className="bg-slate-700/50 rounded-lg p-3 flex items-center justify-between hover:bg-slate-700/70 transition-colors">
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-semibold text-white">{formatDate(fecha)}</div>
                      <div className="text-xs text-slate-400">
                        {ventas.length} venta{ventas.length !== 1 ? 's' : ''}
                      </div>
                    </div>
                    <div className="text-right shrink-0 mr-3">
                      <div className="font-mono font-bold text-red-400">{formatCurrency(total)}</div>
                    </div>
                    <button
                      onClick={() => handleOpenDeleteFiadosByDayModal(fecha)}
                      className="btn-ghost btn btn-sm p-1.5 hover:text-red-400 shrink-0"
                      title="Eliminar fiados de este día"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Modal form */}
      <Modal
        isOpen={showForm}
        onClose={() => setShowForm(false)}
        title={editingId ? 'Editar Cliente' : 'Nuevo Cliente'}
        size="lg"
        footer={
          <>
            <button className="btn-secondary btn" onClick={() => setShowForm(false)}>Cancelar</button>
            <button className="btn-primary btn" onClick={handleSave}>Guardar</button>
          </>
        }
      >
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="label">Nombre *</label>
            <input className="input" value={formData.nombre} onChange={(e) => setFormData({ ...formData, nombre: e.target.value })} placeholder="Nombre" autoFocus />
          </div>
          <div>
            <label className="label">Apellido</label>
            <input className="input" value={formData.apellido} onChange={(e) => setFormData({ ...formData, apellido: e.target.value })} placeholder="Apellido" />
          </div>
          <div>
            <label className="label">DNI / CUIT</label>
            <input className="input" value={formData.documento} onChange={(e) => setFormData({ ...formData, documento: e.target.value })} placeholder="20123456789" />
          </div>
          <div>
            <label className="label">Teléfono</label>
            <input className="input" value={formData.telefono} onChange={(e) => setFormData({ ...formData, telefono: e.target.value })} placeholder="+54 9 11 1234-5678" />
          </div>
          <div>
            <label className="label">Email</label>
            <input className="input" type="email" value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })} placeholder="correo@ejemplo.com" />
          </div>
          <div>
            <label className="label">Límite de crédito</label>
            <input className="input font-mono text-right" type="number" step="0.01" min="0" value={formData.limite_credito} onChange={(e) => setFormData({ ...formData, limite_credito: parseFloat(e.target.value) || 0 })} />
          </div>
          <div className="col-span-2">
            <label className="label">Dirección</label>
            <input className="input" value={formData.direccion} onChange={(e) => setFormData({ ...formData, direccion: e.target.value })} placeholder="Calle 123, Ciudad" />
          </div>
        </div>
      </Modal>

      {/* Modal pago por productos */}
      <Modal
        isOpen={showPagarModal}
        onClose={() => { setShowPagarModal(false); setPagoMetodo('efectivo'); setFiadoPendientes([]); setPagoSeleccion({}); }}
        title="Cobrar Fiado — Seleccionar productos"
        size="lg"
        footer={
          <>
            <button className="btn-secondary btn" onClick={() => { setShowPagarModal(false); setPagoMetodo('efectivo'); setFiadoPendientes([]); setPagoSeleccion({}); }}>Cancelar</button>
            <button className="btn-success btn" disabled={pagoSubmitting || totalCobro <= 0} onClick={handlePagar}>
              <DollarSign size={16} /> {pagoSubmitting ? 'Procesando…' : 'Confirmar cobro'}
            </button>
          </>
        }
      >
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm text-slate-400">Saldo pendiente (precio actual)</div>
              <div className={`text-xl font-mono font-bold mt-0.5 ${(saldoActual ?? 0) > 0 ? 'text-red-400' : 'text-green-400'}`}>
                {formatCurrency(saldoActual ?? 0)}
              </div>
            </div>
            <div className="text-right">
              <div className="text-sm text-slate-400">Total seleccionado</div>
              <div className="text-2xl font-mono font-bold text-white">{formatCurrency(totalSeleccionado)}</div>
            </div>
          </div>

          <div>
            <label className="label">Método de pago</label>
            <div className="flex flex-wrap gap-2">
              {metodosPagoFiado.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => setPagoMetodo(m.id)}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-all ${
                    pagoMetodo === m.id
                      ? 'border-blue-500 bg-blue-500/15 text-blue-300'
                      : 'border-slate-600 bg-slate-700/50 text-slate-400 hover:border-slate-500'
                  }`}
                >
                  {m.nombre}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="rounded-lg border border-slate-700 bg-slate-700/30 p-3">
              <label className="flex items-center gap-2 text-sm text-slate-300">
                <input type="checkbox" checked={descuentoCobroActivo} onChange={(e) => setDescuentoCobroActivo(e.target.checked)} className="rounded" />
                Aplicar descuento
              </label>
              {descuentoCobroActivo && (
                <div className="flex gap-2 mt-2">
                  <input type="number" min="0" step="0.01" value={descuentoCobroValor} onChange={(e) => setDescuentoCobroValor(e.target.value)} className="input font-mono text-right py-1" />
                  <div className="flex rounded-lg border border-slate-600 overflow-hidden shrink-0">
                    <button type="button" onClick={() => setDescuentoCobroUnidad('%')} className={`px-2 text-xs ${descuentoCobroUnidad === '%' ? 'bg-blue-500/20 text-blue-300' : 'text-slate-400'}`}>%</button>
                    <button type="button" onClick={() => setDescuentoCobroUnidad('$')} className={`px-2 text-xs ${descuentoCobroUnidad === '$' ? 'bg-blue-500/20 text-blue-300' : 'text-slate-400'}`}>$</button>
                  </div>
                </div>
              )}
            </div>
            <div className="rounded-lg border border-slate-700 bg-slate-700/30 p-3">
              <label className="flex items-center gap-2 text-sm text-slate-300">
                <input type="checkbox" checked={recargoCobroActivo} onChange={(e) => setRecargoCobroActivo(e.target.checked)} className="rounded" />
                Aplicar recargo
              </label>
              {recargoCobroActivo && (
                <div className="flex gap-2 mt-2">
                  <input type="number" min="0" step="0.01" value={recargoCobroValor} onChange={(e) => setRecargoCobroValor(e.target.value)} className="input font-mono text-right py-1" />
                  <div className="flex rounded-lg border border-slate-600 overflow-hidden shrink-0">
                    <button type="button" onClick={() => setRecargoCobroUnidad('%')} className={`px-2 text-xs ${recargoCobroUnidad === '%' ? 'bg-blue-500/20 text-blue-300' : 'text-slate-400'}`}>%</button>
                    <button type="button" onClick={() => setRecargoCobroUnidad('$')} className={`px-2 text-xs ${recargoCobroUnidad === '$' ? 'bg-blue-500/20 text-blue-300' : 'text-slate-400'}`}>$</button>
                  </div>
                </div>
              )}
            </div>
          </div>

          <div>
            <label className="label">Productos pendientes</label>
            {loadingPagoItems ? (
              <p className="text-sm text-slate-400 text-center py-6">Cargando productos…</p>
            ) : fiadoPendientes.length === 0 ? (
              <p className="text-sm text-slate-500 text-center py-6">No hay productos pendientes</p>
            ) : (
              <div className="rounded-lg border border-slate-700 overflow-hidden max-h-72 overflow-y-auto">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-slate-800 z-10">
                    <tr className="border-b border-slate-700 text-xs text-slate-400">
                      <th className="text-left px-3 py-2 w-8"></th>
                      <th className="text-left px-3 py-2">Producto</th>
                      <th className="text-right px-3 py-2">Cant.</th>
                      <th className="text-right px-3 py-2">P. actual</th>
                      <th className="text-right px-3 py-2">Subtotal</th>
                    </tr>
                  </thead>
                  <tbody>
                    {fiadoPendientes.map((item) => {
                      const sel = pagoSeleccion[item.key] || { checked: false, cantidad: item.cantidad };
                      const qty = Math.min(Math.max(0, sel.cantidad), item.cantidad);
                      const precioDistinto = Math.abs(item.precioActual - item.precioOriginal) >= 0.01;
                      const subtotalLinea = qty * item.precioActual;
                      return (
                        <tr key={item.key} className="border-b border-slate-700/50">
                          <td className="px-3 py-2 align-middle">
                            <input
                              type="checkbox"
                              checked={sel.checked}
                              onChange={(e) => setPagoSeleccion((prev) => ({
                                ...prev,
                                [item.key]: { ...sel, checked: e.target.checked },
                              }))}
                              className="rounded"
                            />
                          </td>
                          <td className="px-3 py-2 align-middle">
                            <div className="font-medium text-white truncate max-w-[180px]" title={item.producto_nombre}>
                              {item.producto_nombre || 'Producto eliminado'}
                            </div>
                            <div className="text-[10px] text-slate-500">Venta #{item.ventaNumero}</div>
                          </td>
                          <td className="px-3 py-2 align-middle text-right">
                            <input
                              type="number"
                              min={0}
                              max={item.cantidad}
                              step={item.cantidad % 1 === 0 ? 1 : 0.01}
                              value={qty}
                              disabled={!sel.checked}
                              onChange={(e) => {
                                const val = parseFloat(e.target.value) || 0;
                                setPagoSeleccion((prev) => ({
                                  ...prev,
                                  [item.key]: {
                                    ...sel,
                                    cantidad: Math.min(Math.max(0, val), item.cantidad),
                                    checked: val > 0 ? true : sel.checked,
                                  },
                                }));
                              }}
                              className="input text-right font-mono w-16 py-1 text-xs"
                            />
                          </td>
                          <td className="px-3 py-2 align-middle text-right font-mono text-xs">
                            {precioDistinto ? (
                              <span className="flex flex-col items-end gap-0.5">
                                <span className="line-through text-slate-500">{formatCurrency(item.precioOriginal)}</span>
                                <span className="text-white font-semibold">{formatCurrency(item.precioActual)}</span>
                              </span>
                            ) : (
                              <span className="text-white">{formatCurrency(item.precioActual)}</span>
                            )}
                          </td>
                          <td className="px-3 py-2 align-middle text-right font-mono font-bold text-white">
                            {formatCurrency(subtotalLinea)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {totalSeleccionado > 0 && (
            <div className="bg-slate-700/50 rounded-lg p-3 text-sm space-y-1">
              <div className="flex justify-between"><span className="text-slate-400">Subtotal:</span><span className="font-mono text-white">{formatCurrency(totalSeleccionado)}</span></div>
              {descuentoCobro > 0 && <div className="flex justify-between text-amber-300"><span>Descuento:</span><span className="font-mono">-{formatCurrency(descuentoCobro)}</span></div>}
              {recargoCobro > 0 && <div className="flex justify-between text-blue-300"><span>Recargo:</span><span className="font-mono">+{formatCurrency(recargoCobro)}</span></div>}
              <div className="flex justify-between border-t border-slate-600 pt-1 font-semibold"><span className="text-slate-300">Total a cobrar:</span><span className="font-mono text-white">{formatCurrency(totalCobro)}</span></div>
            </div>
          )}
          {totalSeleccionado > 0 && saldoActual !== null && (
            <div className="bg-slate-700/50 rounded-lg p-3 text-sm flex justify-between">
              <span className="text-slate-400">{t('clie.remaining')}:</span>
              <span className={`font-mono font-bold ${saldoActual - totalCobro > 0.01 ? 'text-red-400' : 'text-green-400'}`}>
                {formatCurrency(Math.max(0, saldoActual - totalCobro))}
              </span>
            </div>
          )}
        </div>
      </Modal>

      <Modal
        isOpen={showPagoParcialModal}
        onClose={() => { setShowPagoParcialModal(false); setPagoParcialItems([]); setPagoParcialSeleccion({}); }}
        title="Pago parcial"
        size="lg"
        footer={(
          <>
            <button
              type="button"
              className="btn-secondary btn"
              onClick={() => { setShowPagoParcialModal(false); setPagoParcialItems([]); setPagoParcialSeleccion({}); }}
              disabled={pagoSubmitting}
            >
              Cancelar
            </button>
            <button
              type="button"
              className="btn-success btn"
              onClick={() => void handleConfirmarPagoParcial()}
              disabled={pagoSubmitting || pagoParcialLoading || pagoParcialMontoRecibido <= 0 || pagoParcialMontoInsuficiente}
            >
              <DollarSign size={15} /> {pagoSubmitting ? 'Procesando…' : `Confirmar ${formatCurrency(pagoParcialMontoRecibido)}`}
            </button>
          </>
        )}
      >
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="inline-flex rounded-lg border border-slate-600 p-1 bg-slate-900/50" role="group" aria-label="Modo de pago parcial">
              <button
                type="button"
                aria-pressed={pagoParcialModo === 'manual'}
                onClick={() => setPagoParcialModo('manual')}
                className={`btn btn-sm ${pagoParcialModo === 'manual' ? 'btn-primary' : 'btn-ghost'}`}
              >
                Manual
              </button>
              <button
                type="button"
                aria-pressed={pagoParcialModo === 'automatico'}
                onClick={() => setPagoParcialModo('automatico')}
                className={`btn btn-sm ${pagoParcialModo === 'automatico' ? 'btn-primary' : 'btn-ghost'}`}
              >
                Automático
              </button>
            </div>
            <label className="flex items-center gap-3 text-sm text-slate-300">
              Monto recibido
              <input
                type="number"
                min="0"
                step="0.01"
                value={pagoParcialMonto}
                onChange={(e) => setPagoParcialMonto(e.target.value)}
                className="input w-40 text-right font-mono"
                autoFocus
              />
            </label>
          </div>

          {pagoParcialLoading ? (
            <p className="text-sm text-slate-400 text-center py-8">Cargando productos pendientes…</p>
          ) : pagoParcialItems.length === 0 ? (
            <p className="text-sm text-slate-500 text-center py-8">No hay productos pendientes en este fiado.</p>
          ) : (
            <div className="rounded-lg border border-slate-700 overflow-hidden max-h-72 overflow-y-auto">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-slate-800 z-10">
                  <tr className="border-b border-slate-700 text-xs text-slate-400">
                    <th className="text-left px-3 py-2">Producto</th>
                    <th className="text-right px-3 py-2">Pendiente</th>
                    <th className="text-right px-3 py-2">Precio vigente</th>
                    <th className="text-right px-3 py-2">Unidades a pagar</th>
                    <th className="text-right px-3 py-2">Total</th>
                    {pagoParcialModo === 'automatico' && <th className="text-right px-3 py-2">Estado</th>}
                  </tr>
                </thead>
                <tbody>
                  {pagoParcialItems.map((item) => {
                    const seleccion = pagoParcialSeleccionados.find((selected) => selected.item.key === item.key);
                    const cantidadSeleccionada = seleccion?.cantidad ?? 0;
                    return (
                      <tr key={item.key} className="border-b border-slate-700/50">
                        <td className="px-3 py-2 text-slate-200">{item.producto_nombre || 'Producto eliminado'}</td>
                        <td className="px-3 py-2 text-right font-mono text-slate-300">{item.cantidad}</td>
                        <td className="px-3 py-2 text-right font-mono text-slate-300">{formatCurrency(item.precioActual)}</td>
                        <td className="px-3 py-2 text-right">
                          {pagoParcialModo === 'manual' ? (
                            <input
                              type="number"
                              min="0"
                              max={item.cantidad}
                              step={item.cantidad % 1 === 0 ? 1 : 0.01}
                              value={pagoParcialSeleccion[item.key] ?? 0}
                              onChange={(e) => {
                                const cantidad = Math.min(Math.max(0, Number(e.target.value) || 0), item.cantidad);
                                setPagoParcialSeleccion((prev) => ({ ...prev, [item.key]: cantidad }));
                              }}
                              className="input w-24 py-1 text-right font-mono text-xs"
                              aria-label={`Unidades de ${item.producto_nombre} a pagar`}
                            />
                          ) : (
                            <span className="font-mono text-white">{cantidadSeleccionada}</span>
                          )}
                        </td>
                        <td className="px-3 py-2 text-right font-mono text-white">{formatCurrency(item.precioActual * cantidadSeleccionada)}</td>
                        {pagoParcialModo === 'automatico' && (
                          <td className={`px-3 py-2 text-right text-xs ${cantidadSeleccionada > 0 ? 'text-emerald-400' : 'text-slate-500'}`}>
                            {cantidadSeleccionada > 0 ? 'Se pagará' : 'Pendiente'}
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          <div>
            <label className="label">Método de pago</label>
            <select className="input" value={pagoParcialMetodo} onChange={(e) => setPagoParcialMetodo(e.target.value)}>
              {metodosPagoFiado.map((metodo) => <option key={metodo.id} value={metodo.id}>{metodo.nombre}</option>)}
            </select>
          </div>

          <div className="rounded-lg border border-slate-700 bg-slate-900/50 p-3 space-y-2 text-sm">
            <div className="text-xs font-semibold uppercase tracking-wider text-slate-400">Resumen del cobro</div>
            <div className="space-y-1">
              {pagoParcialSeleccionados.map(({ item, cantidad }) => (
                <div key={item.key} className="flex justify-between gap-3 text-slate-300">
                  <span>{item.producto_nombre} x{cantidad}</span>
                  <span className="font-mono">{formatCurrency(item.precioActual * cantidad)}</span>
                </div>
              ))}
              {pagoParcialVarios > 0 && (
                <div className="flex justify-between gap-3 text-amber-300">
                  <span>Varios</span>
                  <span className="font-mono">{formatCurrency(pagoParcialVarios)}</span>
                </div>
              )}
              {pagoParcialMontoInsuficiente && (
                <p className="text-xs text-red-400">El monto recibido no alcanza para las unidades seleccionadas.</p>
              )}
              <div className="flex justify-between border-t border-slate-700 pt-2 font-semibold text-white">
                <span>Total recibido · {metodosPagoFiado.find((metodo) => metodo.id === pagoParcialMetodo)?.nombre || pagoParcialMetodo}</span>
                <span className="font-mono">{formatCurrency(pagoParcialMontoRecibido)}</span>
              </div>
            </div>
          </div>
        </div>
      </Modal>

      <ConfirmDialog
        isOpen={confirmDelete !== null}
        title={t('clie.deleteTitle')}
        message={t('clie.deleteMsg')}
        onConfirm={() => confirmDelete && handleDelete(confirmDelete)}
        onCancel={() => setConfirmDelete(null)}
      />

      <Modal
        isOpen={showDeleteAdminModal}
        onClose={() => { setShowDeleteAdminModal(false); setDeleteAdminPin(''); setPendingDeleteId(null); }}
        title="Confirmación de administrador"
        size="sm"
        footer={(
          <>
            <button type="button" className="btn-secondary btn" onClick={() => { setShowDeleteAdminModal(false); setDeleteAdminPin(''); setPendingDeleteId(null); }} disabled={deleteAdminChecking}>Cancelar</button>
            <button type="button" className="btn-danger btn" onClick={() => void confirmDeleteWithPin()} disabled={deleteAdminChecking}> {deleteAdminChecking ? 'Verificando…' : 'Eliminar'} </button>
          </>
        )}
      >
        <p className="text-sm mb-4 text-slate-300">Ingresá el PIN del administrador para confirmar la eliminación del cliente y su deuda asociada.</p>
        <label className="label">PIN de administrador</label>
        <input
          type="password"
          className="input font-mono"
          value={deleteAdminPin}
          onChange={(e) => setDeleteAdminPin(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') void confirmDeleteWithPin(); }}
          placeholder="••••"
          autoFocus
          disabled={deleteAdminChecking}
        />
      </Modal>

      <Modal
        isOpen={showDeleteFiadosByDayModal}
        onClose={() => { setShowDeleteFiadosByDayModal(false); setDeleteByDayPin(''); setDeleteFiadosByDayDate(null); }}
        title="Eliminar fiados por día"
        size="sm"
        footer={(
          <>
            <button type="button" className="btn-secondary btn" onClick={() => { setShowDeleteFiadosByDayModal(false); setDeleteByDayPin(''); setDeleteFiadosByDayDate(null); }} disabled={deleteByDayChecking}>Cancelar</button>
            <button type="button" className="btn-danger btn" onClick={() => void handleDeleteFiadosByDay()} disabled={deleteByDayChecking}> {deleteByDayChecking ? 'Verificando…' : 'Eliminar'} </button>
          </>
        )}
      >
        <p className="text-sm mb-4 text-slate-300">Ingresá el PIN del administrador para confirmar la eliminación de todos los fiados del día <strong>{deleteFiadosByDayDate}</strong>.</p>
        <label className="label">PIN de administrador</label>
        <input
          type="password"
          className="input font-mono"
          value={deleteByDayPin}
          onChange={(e) => setDeleteByDayPin(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') void handleDeleteFiadosByDay(); }}
          placeholder="••••"
          autoFocus
          disabled={deleteByDayChecking}
        />
      </Modal>
    </div>
  );
};
