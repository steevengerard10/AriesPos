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
  precioOriginal: number;
  precioActual: number;
}

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
  const [saldoActual, setSaldoActual] = useState<number | null>(null);
  const [expandedVentaId, setExpandedVentaId] = useState<number | null>(null);
  const [ventaItemsCache, setVentaItemsCache] = useState<Record<number, VentaItem[]>>({});
  const [loadingItems, setLoadingItems] = useState<number | null>(null);
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

  const loadFiadoPendientes = async (clienteId: number): Promise<FiadoPendienteItem[]> => {
    const ventas = await clientesAPI.getVentas(clienteId) as Venta[];
    const pendientes = ventas.filter((v) => v.estado === 'fiado' || v.estado === 'parcial');
    const items: FiadoPendienteItem[] = [];
    await Promise.all(
      pendientes.map(async (v) => {
        const detail = await ventasAPI.getById(v.id) as { items: VentaItem[] };
        for (const item of detail.items || []) {
          items.push({
            key: `${v.id}-${item.id}`,
            ventaId: v.id,
            ventaNumero: v.numero,
            itemId: item.id,
            producto_nombre: item.producto_nombre,
            cantidad: item.cantidad,
            precioOriginal: item.precio_unitario,
            precioActual: item.precio_actual ?? item.precio_unitario,
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

  const handleOpenPagarModal = async () => {
    if (!selectedCliente) return;
    setShowPagarModal(true);
    setPagoMetodo('efectivo');
    setLoadingPagoItems(true);
    try {
      const items = await loadFiadoPendientes(selectedCliente.id);
      setFiadoPendientes(items);
      setPagoSeleccion(initPagoSeleccion(items));
    } finally {
      setLoadingPagoItems(false);
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
          const precioActual = Number(prod?.precio_venta ?? item.precio_actual ?? item.precio_unitario ?? 0);
          const precioOriginal = Number(item.precio_unitario ?? precioActual ?? 0);
          const key = item.producto_id ? `pid:${item.producto_id}` : `name:${nombre.toLowerCase()}`;
          const existing = grouped.get(key);

          if (existing) {
            existing.cantidad += qty;
            existing.precio_unitario = precioActual || existing.precio_unitario || precioOriginal;
            existing.precio_original = precioOriginal || existing.precio_original || precioActual || 0;
            existing.nombre = nombre;
          } else {
            grouped.set(key, {
              producto_id: item.producto_id ?? 0,
              nombre,
              cantidad: qty,
              precio_unitario: precioActual || precioOriginal || 0,
              precio_original: precioOriginal || precioActual || 0,
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
    const monto = totalSeleccionado;
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
                <button className="btn-secondary btn" onClick={() => void cargarFiadoEnPos()}>
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
                    ? items.reduce((s, it) => s + it.cantidad * (it.precio_actual ?? it.precio_unitario), 0)
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
                                const precioOriginal = item.precio_unitario;
                                const precioActual = item.precio_actual ?? item.precio_unitario;
                                const precioDistinto = Math.abs(precioActual - precioOriginal) >= 0.01;
                                const lineTotalActual = item.cantidad * precioActual;
                                return (
                                  <div key={idx} className="flex items-center justify-between text-xs">
                                    <div className="flex items-center gap-1.5 text-slate-300 flex-1 min-w-0">
                                      <Package size={11} className="text-slate-500 shrink-0" />
                                      <span className="truncate">{item.producto_nombre || 'Producto eliminado'}</span>
                                    </div>
                                    <div className="flex items-center gap-3 shrink-0 ml-2">
                                      <span className="text-slate-400">x{item.cantidad % 1 === 0 ? item.cantidad : item.cantidad.toFixed(2)}</span>
                                      <span className="font-mono w-24 text-right">
                                        {precioDistinto ? (
                                          <span className="flex flex-col items-end gap-0.5">
                                            <span className="line-through text-slate-500 text-[10px]">{formatCurrency(precioOriginal)}</span>
                                            <span className="text-white font-semibold">{formatCurrency(precioActual)}</span>
                                          </span>
                                        ) : (
                                          <span className="text-white">{formatCurrency(precioActual)}</span>
                                        )}
                                      </span>
                                      <span className="font-mono text-white w-20 text-right">{formatCurrency(lineTotalActual)}</span>
                                    </div>
                                  </div>
                                );
                              })}
                              {(() => {
                                const subtotalActual = items.reduce((s, it) => s + it.cantidad * (it.precio_actual ?? it.precio_unitario), 0);
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
            <button className="btn-success btn" disabled={pagoSubmitting || totalSeleccionado <= 0} onClick={handlePagar}>
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

          {totalSeleccionado > 0 && saldoActual !== null && (
            <div className="bg-slate-700/50 rounded-lg p-3 text-sm flex justify-between">
              <span className="text-slate-400">{t('clie.remaining')}:</span>
              <span className={`font-mono font-bold ${saldoActual - totalSeleccionado > 0.01 ? 'text-red-400' : 'text-green-400'}`}>
                {formatCurrency(Math.max(0, saldoActual - totalSeleccionado))}
              </span>
            </div>
          )}
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
    </div>
  );
};
