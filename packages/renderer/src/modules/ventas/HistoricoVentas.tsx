import React, { useState, useEffect, useMemo } from 'react';
import {
  ShoppingBag, Search, RefreshCw, RotateCcw, Eye, Edit2, Check, ShoppingCart
} from 'lucide-react';
import toast from 'react-hot-toast';
import { ventasAPI, onEvent, appAPI, sendEvent, productosAPI } from '../../lib/api';
import { Modal } from '../../components/shared/Modal';
import { formatCurrency, formatDate, toLocalDateISO } from '../../lib/utils';
import { useTranslation } from 'react-i18next';
import { useAppStore } from '../../store/useAppStore';
import { AlertMonitorButton } from '../../components/POS/AlertMonitorPanel';

interface VentaItem {
  id: number;
  producto_id?: number;
  producto_nombre: string;
  cantidad: number;
  precio_unitario: number;
  descuento: number;
  /** Subtotal línea si el backend lo mapea; si no, `total` de SQLite. */
  subtotal?: number;
  total?: number;
  fraccionable?: boolean;
  unidad_medida?: string;
}

interface Venta {
  id: number;
  numero: string;
  fecha: string;
  hora: string;
  cliente_id?: number | null;
  cliente_nombre: string | null;
  vendedor_nombre: string;
  subtotal: number;
  descuento_global: number;
  total: number;
  metodo_pago: string;
  estado: 'completada' | 'anulada' | 'fiado' | 'pedido';
  observaciones: string;
  productos?: string | null;
  items?: VentaItem[];
}

interface VentaCancelada extends Omit<Venta, 'id' | 'estado'> {
  id: number;
  venta_id_original: number;
  motivo: string;
  cancelada_at: string;
  estado?: string;
}

const ESTADO_COLORS: Record<string, string> = {
  completada: 'badge-green',
  anulada: 'badge-red',
  fiado: 'badge-yellow',
  pedido: 'badge-blue',
};

export const HistoricoVentas: React.FC = () => {
  const [ventas, setVentas] = useState<Venta[]>([]);
  const [ventasCanceladas, setVentasCanceladas] = useState<VentaCancelada[]>([]);
  const [listTab, setListTab] = useState<'activas' | 'canceladas'>('activas');
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [filterEstado, setFilterEstado] = useState('');
  const [filterMetodo, setFilterMetodo] = useState('');
  const { t } = useTranslation();
  const { config } = useAppStore();

  // Métodos de pago activos desde la configuración
  const metodosPago = useMemo<{ id: string; nombre: string }[]>(() => {
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
  const hoyISO = () => toLocalDateISO(new Date());
  const [desde, setDesde] = useState(() => hoyISO());
  const [hasta, setHasta] = useState(() => hoyISO());
  const [selectedVenta, setSelectedVenta] = useState<Venta | null>(null);
  const [selectedCancelada, setSelectedCancelada] = useState<VentaCancelada | null>(null);
  const [detailEditMode, setDetailEditMode] = useState(false);
  const [detailEditMetodo, setDetailEditMetodo] = useState('');
  const [detailEditObs, setDetailEditObs] = useState('');
  const [detailSaving, setDetailSaving] = useState(false);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [itemsPage, setItemsPage] = useState(1);

  const loadData = async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const [list, canceladas] = await Promise.all([
        ventasAPI.getHistorico({ desde, hasta }) as Promise<Venta[]>,
        ventasAPI.getCanceladas({ desde, hasta }) as Promise<VentaCancelada[]>,
      ]);
      setVentas(list);
      setVentasCanceladas(canceladas);
    } catch (err) {
      setLoadError('No se pudo cargar el historial. Intenta de nuevo.');
      console.error('Error al cargar historial:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); }, [desde, hasta]);

  // Recargar cuando el servidor notifica nueva venta (usado en modo cliente/red)
  useEffect(() => {
    const cleanup = onEvent('venta:nueva', () => loadData());
    return cleanup;
  }, [desde, hasta]);

  const handleVerDetalle = async (v: Venta | VentaCancelada, opts?: { openEdit?: boolean }) => {
    if ('venta_id_original' in v) {
      setSelectedCancelada(v);
      setSelectedVenta(null);
      setDetailEditMode(false);
      return;
    }
    const detalle = await ventasAPI.getById(v.id) as Venta;
    setSelectedCancelada(null);
    setSelectedVenta(detalle);
    setDetailEditMetodo(detalle.metodo_pago || 'efectivo');
    setDetailEditObs(detalle.observaciones || '');
    setDetailEditMode(Boolean(opts?.openEdit) && detalle.estado !== 'anulada');
    setItemsPage(1);
  };

  const handleCancelarVenta = async () => {
    if (!selectedVenta) return;
    if (!confirm(`¿Cancelar venta #${selectedVenta.numero}? Se archivará en canceladas y se revertirán stock y caja.`)) return;
    try {
      const res = await ventasAPI.cancelar(selectedVenta.id, { motivo: 'Cancelación desde histórico' });
      if (!res?.success) throw new Error(res?.error || 'Error al cancelar');
      toast.success('Venta cancelada y archivada');
      setSelectedVenta(null);
      setDetailEditMode(false);
      setListTab('canceladas');
      loadData();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error al cancelar la venta');
    }
  };

  const handleOpenEdit = (v: Venta, e: React.MouseEvent) => {
    e.stopPropagation();
    void handleVerDetalle(v, { openEdit: true });
  };

  const handleSaveDetail = async () => {
    if (!selectedVenta || selectedVenta.estado === 'anulada') return;
    setDetailSaving(true);
    try {
      const res = await ventasAPI.update(selectedVenta.id, {
        observaciones: detailEditObs,
        metodo_pago: detailEditMetodo,
      });
      if (!res?.success) throw new Error(res?.error || 'No se pudo guardar');
      toast.success('Venta actualizada');
      const refresh = await ventasAPI.getById(selectedVenta.id) as Venta;
      setSelectedVenta(refresh);
      setDetailEditMode(false);
      loadData();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error al guardar cambios');
    } finally {
      setDetailSaving(false);
    }
  };

  const lineTotal = (item: VentaItem) => Number(item.subtotal ?? item.total ?? 0);

  const handleReabrirEnCaja = async () => {
    if (!selectedVenta?.items?.length) {
      toast.error('La venta no tiene ítems para reabrir');
      return;
    }

    const cartItems = await Promise.all(selectedVenta.items.map(async (item) => {
      const descuento = Number(item.descuento) || 0;
      let precioUnitario = Number(item.precio_unitario) || 0;

      if (item.producto_id) {
        const producto = await productosAPI.getById(item.producto_id) as { precio_venta?: number; nombre?: string } | null;
        if (producto && typeof producto.precio_venta === 'number' && producto.precio_venta > 0) {
          precioUnitario = producto.precio_venta;
        }
      }

      return {
        itemId: crypto.randomUUID(),
        producto_id: item.producto_id ?? 0,
        nombre: item.producto_nombre || 'Producto',
        cantidad: Number(item.cantidad) || 0,
        precio_unitario: precioUnitario,
        precio_original: precioUnitario,
        descuento,
        total: precioUnitario * (Number(item.cantidad) || 0) - descuento,
        fraccionable: Boolean(item.fraccionable),
        unidad_medida: item.unidad_medida || 'unidad',
      };
    }));

    const payload = {
      items: cartItems,
      descuentoGlobal: selectedVenta.descuento_global || 0,
      recargoGlobal: 0,
      clienteId: selectedVenta.cliente_id ?? null,
      clienteNombre: selectedVenta.cliente_nombre || '',
      observaciones: selectedVenta.observaciones || '',
      metodoPago: selectedVenta.metodo_pago || 'efectivo',
      esFiado: selectedVenta.estado === 'fiado',
      tipoOperacion: 'venta' as const,
    };
    try {
      sessionStorage.setItem('pos:reabrir-venta', JSON.stringify(payload));
    } catch { /* silencioso */ }
    appAPI.openPosWindow();
    const emitReabrir = () => sendEvent('broadcast-event', 'pos:reabrir-venta', payload);
    setTimeout(emitReabrir, 400);
    setTimeout(emitReabrir, 1200);
    setSelectedVenta(null);
    setDetailEditMode(false);
    toast.success('Venta cargada en caja');
  };

  const filtered = useMemo(() => {
    const source = listTab === 'canceladas' ? ventasCanceladas : ventas;
    let list = source as (Venta | VentaCancelada)[];
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter((v) => v.numero.includes(q) || (v.cliente_nombre || '').toLowerCase().includes(q));
    }
    if (listTab === 'activas') {
      if (filterEstado) list = (list as Venta[]).filter((v) => v.estado === filterEstado);
      if (filterMetodo) list = (list as Venta[]).filter((v) => v.metodo_pago === filterMetodo);
    }
    return list;
  }, [ventas, ventasCanceladas, listTab, search, filterEstado, filterMetodo]);

  const totalFiltrado = useMemo(() => {
    if (listTab === 'canceladas') return filtered.reduce((s, v) => s + v.total, 0);
    return (filtered as Venta[]).reduce((s, v) => s + (v.estado !== 'anulada' ? v.total : 0), 0);
  }, [filtered, listTab]);

  return (
    <div className="flex flex-col h-full min-h-0 flex-1 w-full" style={{ background: 'var(--bg)' }}>
      {/* Header */}
      <div className="shrink-0 module-header px-6 pt-6">
        <div>
          <h1 className="module-title flex items-center gap-3"><ShoppingBag size={28} className="text-blue-400" /> Historial de Ventas</h1>
          <p className="text-sm text-slate-400 mt-1">
            {filtered.length} {listTab === 'canceladas' ? 'canceladas' : 'ventas'} · {formatCurrency(totalFiltrado)}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <AlertMonitorButton />
          <button className="btn-ghost btn p-2" title="Recargar" onClick={loadData}><RefreshCw size={16} /></button>
        </div>
      </div>

      {/* Filtros */}
      <div className="shrink-0 px-6 pb-4 flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-1 p-0.5 rounded-lg" style={{ background: 'var(--bg3)', border: '1px solid var(--border)' }}>
          <button
            type="button"
            className={`btn btn-sm ${listTab === 'activas' ? 'btn-primary' : 'btn-ghost'}`}
            onClick={() => setListTab('activas')}
          >
            Ventas
          </button>
          <button
            type="button"
            className={`btn btn-sm ${listTab === 'canceladas' ? 'btn-primary' : 'btn-ghost'}`}
            onClick={() => setListTab('canceladas')}
          >
            Canceladas
          </button>
        </div>
        <div className="flex items-center gap-2">
          <button
            className="btn btn-secondary btn-sm"
            onClick={() => { const h = hoyISO(); setDesde(h); setHasta(h); }}
            title="Mostrar ventas del día"
          >
            Día
          </button>
          <button
            className="btn btn-secondary btn-sm"
            onClick={() => {
              const d = new Date();
              const hastaISO = toLocalDateISO(d);
              d.setDate(d.getDate() - 6);
              const desdeISO = toLocalDateISO(d);
              setDesde(desdeISO); setHasta(hastaISO);
            }}
            title="Últimos 7 días"
          >
            Semana
          </button>
          <button
            className="btn btn-secondary btn-sm"
            onClick={() => {
              const now = new Date();
              const hastaISO = toLocalDateISO(now);
              const start = new Date(now.getFullYear(), now.getMonth(), 1);
              const desdeISO = toLocalDateISO(start);
              setDesde(desdeISO); setHasta(hastaISO);
            }}
            title="Mes actual"
          >
            Mes
          </button>
          <button
            className="btn btn-secondary btn-sm"
            onClick={() => { setDesde('2000-01-01'); setHasta(hoyISO()); }}
            title="Historial completo"
          >
            Completo
          </button>
        </div>
        <div className="relative flex-1 min-w-[180px]">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input type="text" placeholder={t('hist.search')} value={search} onChange={(e) => setSearch(e.target.value)} className="input pl-9 text-sm" />
        </div>
        <div className="flex items-center gap-2 text-sm text-slate-400">
          <span>{t('hist.from')}</span>
          <input type="date" value={desde} onChange={(e) => setDesde(e.target.value)} className="input text-sm py-1.5" />
          <span>{t('hist.to')}</span>
          <input type="date" value={hasta} onChange={(e) => setHasta(e.target.value)} className="input text-sm py-1.5" />
        </div>
        {listTab === 'activas' && (
          <select value={filterEstado} onChange={(e) => setFilterEstado(e.target.value)} className="input text-sm w-36">
            <option value="">{t('hist.allStates')}</option>
            <option value="completada">{t('hist.status.done')}</option>
            <option value="fiado">{t('hist.status.credit')}</option>
            <option value="anulada">{t('hist.status.void')}</option>
            <option value="pedido">{t('hist.status.order')}</option>
          </select>
        )}
        {listTab === 'activas' && (
        <select value={filterMetodo} onChange={(e) => setFilterMetodo(e.target.value)} className="input text-sm w-36">
          <option value="">{t('hist.allMethods')}</option>
          <option value="efectivo">{t('hist.method.cash')}</option>
          <option value="tarjeta">{t('hist.method.card')}</option>
          <option value="transferencia">{t('hist.method.transfer')}</option>
          <option value="fiado">{t('hist.method.credit')}</option>
          <option value="mixto">{t('hist.method.mixed')}</option>
        </select>
        )}
      </div>

      {/* Tabla con barra de totales fija y scroll en el área de filas */}
      <div className="flex-1 flex flex-col min-h-0 px-6 pb-6">
        {loadError ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3">
            <p className="text-red-400 text-sm">{loadError}</p>
            <button className="btn-secondary btn btn-sm" onClick={loadData}><RefreshCw size={13} /> Reintentar</button>
          </div>
        ) : (
          <div
            className="rounded-xl overflow-hidden flex flex-col flex-1 min-h-0"
            style={{ background: 'var(--bg2)', border: '1px solid var(--border)' }}
          >
            <div className="flex-1 overflow-y-auto min-h-0">
              <table className="w-full" style={{ tableLayout: 'fixed' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border)' }}>
                    <th className="table-header">{t('hist.col.num')}</th>
                    <th className="table-header">{t('hist.col.date')}</th>
                    <th className="table-header">{t('hist.col.client')}</th>
                    <th className="table-header">{t('hist.col.seller')}</th>
                    <th className="table-header text-center">{t('hist.col.method')}</th>
                    <th className="table-header text-right">{t('hist.col.total')}</th>
                    <th className="table-header text-center">{t('hist.col.status')}</th>
                    <th className="table-header"></th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr><td colSpan={8} className="text-center py-12">
                      <div className="flex flex-col items-center gap-3">
                        <RefreshCw size={20} className="text-slate-500 animate-spin" />
                        <span className="text-sm text-slate-500">{t('common.loading')}</span>
                      </div>
                    </td></tr>
                  ) : filtered.length === 0 ? (
                    <tr><td colSpan={8} className="text-center py-8 text-slate-500">{t('hist.empty')}</td></tr>
                  ) : filtered.map((v) => (
                    <tr key={v.id} className="table-row cursor-pointer" onClick={() => void handleVerDetalle(v)}>
                      <td className="table-cell font-mono text-blue-400 text-sm">#{v.numero}</td>
                      <td className="table-cell text-xs" style={{ color: 'var(--text3)' }}>
                        {formatDate(v.fecha)}{v.hora ? ` ${String(v.hora).slice(0, 5)}` : ''}
                      </td>
                      <td className="table-cell text-sm" style={{ color: 'var(--text2)' }}>
                        <div className="flex flex-col">
                          <span>{v.cliente_nombre || <span style={{ color: 'var(--text3)' }} className="italic">{t('hist.consumer')}</span>}</span>
                          {v.productos && (
                            <span className="text-[11px] truncate" style={{ color: 'var(--text3)' }} title={v.productos}>
                              {v.productos}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="table-cell text-xs text-slate-400">{v.vendedor_nombre}</td>
                      <td className="table-cell text-center text-xs text-slate-400 capitalize">{v.metodo_pago}</td>
                      <td
                        className={`table-cell text-right font-mono font-bold ${listTab === 'canceladas' || (v as Venta).estado === 'anulada' ? 'line-through' : ''}`}
                        style={{ color: listTab === 'canceladas' || (v as Venta).estado === 'anulada' ? 'var(--text3)' : 'var(--text)' }}
                      >
                        {formatCurrency(v.total)}
                      </td>
                      <td className="table-cell text-center">
                        {listTab === 'canceladas' ? (
                          <span className="badge badge-red text-[10px]">cancelada</span>
                        ) : (
                          <span className={`badge ${ESTADO_COLORS[(v as Venta).estado] || 'badge-gray'} text-[10px]`}>{(v as Venta).estado}</span>
                        )}
                      </td>
                      <td className="table-cell" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center gap-1">
                          <button title="Ver detalle" onClick={() => void handleVerDetalle(v)} className="btn-ghost btn p-1.5"><Eye size={13} /></button>
                          {listTab === 'activas' && (v as Venta).estado !== 'anulada' && (
                            <button title="Editar venta" onClick={(e) => handleOpenEdit(v as Venta, e)} className="btn-ghost btn p-1.5"><Edit2 size={13} /></button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {/* Barra de totales fija */}
            <div
              className="shrink-0 px-4 py-2 flex items-center justify-between"
              style={{ background: 'var(--bg3)', borderTop: '1px solid var(--border)' }}
            >
              <span className="text-sm" style={{ color: 'var(--text3)' }}>
                {filtered.length} {listTab === 'canceladas' ? 'canceladas' : 'ventas'}
              </span>
              <span className="font-mono font-bold text-lg" style={{ color: 'var(--text)' }}>{formatCurrency(totalFiltrado)}</span>
            </div>
          </div>
        )}
      </div>

      {/* Modal detalle */}
      <Modal
        isOpen={selectedVenta !== null || selectedCancelada !== null}
        onClose={() => { setSelectedVenta(null); setSelectedCancelada(null); setDetailEditMode(false); }}
        title={selectedCancelada ? `Venta cancelada #${selectedCancelada.numero}` : `Venta #${selectedVenta?.numero}`}
        size="lg"
        footer={
          <div className="flex items-center justify-between w-full gap-2 flex-wrap">
            <div className="flex items-center gap-2">
              {!selectedCancelada && !detailEditMode && selectedVenta?.estado !== 'anulada' && (
                <>
                  <button className="btn-danger btn btn-sm" onClick={handleCancelarVenta}>
                    <RotateCcw size={14} /> {t('hist.cancel')}
                  </button>
                  <button
                    type="button"
                    className="btn-secondary btn btn-sm"
                    onClick={() => setDetailEditMode(true)}
                  >
                    <Edit2 size={13} /> Editar
                  </button>
                  {selectedVenta?.items && selectedVenta.items.length > 0 && (
                    <button
                      type="button"
                      className="btn-success btn btn-sm"
                      onClick={handleReabrirEnCaja}
                    >
                      <ShoppingCart size={14} /> Reabrir en caja
                    </button>
                  )}
                </>
              )}
            </div>
            <div className="flex items-center gap-2 ml-auto">
              {detailEditMode && selectedVenta?.estado !== 'anulada' ? (
                <>
                  <button
                    type="button"
                    className="btn-secondary btn btn-sm"
                    disabled={detailSaving}
                    onClick={() => {
                      setDetailEditMode(false);
                      if (selectedVenta) {
                        setDetailEditMetodo(selectedVenta.metodo_pago || 'efectivo');
                        setDetailEditObs(selectedVenta.observaciones || '');
                      }
                    }}
                  >
                    Cancelar
                  </button>
                  <button type="button" className="btn-primary btn btn-sm" disabled={detailSaving} onClick={handleSaveDetail}>
                    <Check size={14} /> {detailSaving ? 'Guardando…' : 'Guardar'}
                  </button>
                </>
              ) : (
                <button type="button" className="btn-secondary btn" onClick={() => { setSelectedVenta(null); setSelectedCancelada(null); setDetailEditMode(false); }}>
                  {t('hist.close')}
                </button>
              )}
            </div>
          </div>
        }
      >
        {selectedVenta && (
          <div className="space-y-4">
            {detailEditMode && selectedVenta.estado !== 'anulada' && (
              <div className="rounded-lg p-4 border space-y-3" style={{ background: 'var(--bg3)', borderColor: 'var(--border)' }}>
                <div>
                  <label className="label">Método de pago</label>
                  <select
                    className="input"
                    value={detailEditMetodo}
                    onChange={(e) => setDetailEditMetodo(e.target.value)}
                  >
                    {metodosPago.map((m) => (
                      <option key={m.id} value={m.id}>{m.nombre}</option>
                    ))}
                    <option value="fiado">Fiado</option>
                    <option value="mixto">Mixto</option>
                  </select>
                </div>
                <div>
                  <label className="label">Observaciones</label>
                  <textarea
                    className="input resize-none"
                    rows={2}
                    value={detailEditObs}
                    onChange={(e) => setDetailEditObs(e.target.value)}
                    placeholder="Notas adicionales..."
                  />
                </div>
                <p className="text-xs" style={{ color: 'var(--text3)' }}>Los cambios se guardan en la base local (SQLite) vía servidor / IPC.</p>
                <div className="flex justify-end gap-2 pt-1">
                  <button
                    type="button"
                    className="btn-secondary btn btn-sm"
                    disabled={detailSaving}
                    onClick={() => {
                      setDetailEditMode(false);
                      setDetailEditMetodo(selectedVenta.metodo_pago || 'efectivo');
                      setDetailEditObs(selectedVenta.observaciones || '');
                    }}
                  >
                    Cancelar
                  </button>
                  <button type="button" className="btn-primary btn btn-sm" disabled={detailSaving} onClick={handleSaveDetail}>
                    <Check size={14} /> {detailSaving ? 'Guardando…' : 'Guardar cambios'}
                  </button>
                </div>
              </div>
            )}
            <div className="grid grid-cols-3 gap-4 text-sm">
              <div>
                <div style={{ color: 'var(--text3)' }}>Venta</div>
                <div style={{ color: 'var(--text)', fontVariantNumeric: 'tabular-nums' }} className="font-mono">#{selectedVenta.numero}</div>
              </div>
              <div>
                <div style={{ color: 'var(--text3)' }}>Fecha</div>
                <div style={{ color: 'var(--text)' }}>
                  {formatDate(selectedVenta.fecha)}{selectedVenta.hora ? ` ${String(selectedVenta.hora).slice(0, 5)}` : ''}
                </div>
              </div>
              <div>
                <div style={{ color: 'var(--text3)' }}>Cliente</div>
                <div style={{ color: 'var(--text)' }}>{selectedVenta.cliente_nombre || 'Consumidor final'}</div>
              </div>
              <div>
                <div style={{ color: 'var(--text3)' }}>Vendedor</div>
                <div style={{ color: 'var(--text)' }}>{selectedVenta.vendedor_nombre}</div>
              </div>
              {!detailEditMode && (
                <div>
                  <div style={{ color: 'var(--text3)' }}>Método de pago</div>
                  <div style={{ color: 'var(--text)' }} className="capitalize">{selectedVenta.metodo_pago}</div>
                </div>
              )}
              <div>
                <div style={{ color: 'var(--text3)' }}>Estado</div>
                <span className={`badge ${ESTADO_COLORS[selectedVenta.estado]}`}>{selectedVenta.estado}</span>
              </div>
              {!detailEditMode && selectedVenta.observaciones ? (
                <div className="col-span-3">
                  <div style={{ color: 'var(--text3)' }}>Observaciones</div>
                  <div style={{ color: 'var(--text)' }}>{selectedVenta.observaciones}</div>
                </div>
              ) : null}
            </div>

            {selectedVenta.items && (
              <div>
                <div className="flex items-center justify-between mb-2">
                  <div className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--text3)' }}>Items</div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs" style={{ color: 'var(--text3)' }}>Items/página</span>
                    <select
                      className="input text-xs py-1 px-2 w-20"
                      value={itemsPerPage}
                      onChange={(e) => { setItemsPerPage(Math.min(10, Math.max(1, parseInt(e.target.value, 10) || 10))); setItemsPage(1); }}
                    >
                      {Array.from({ length: 10 }, (_, i) => i + 1).map(n => (
                        <option key={n} value={n}>{n}</option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className="rounded-lg overflow-hidden max-h-48 overflow-y-auto" style={{ background: 'var(--bg3)', border: '1px solid var(--border)' }}>
                  <table className="w-full text-sm">
                    <thead>
                      <tr style={{ borderBottom: '1px solid var(--border)' }}>
                        <th className="text-left px-3 py-2 font-medium" style={{ color: 'var(--text3)' }}>{t('hist.detail.product')}</th>
                        <th className="text-right px-3 py-2 font-medium" style={{ color: 'var(--text3)' }}>{t('hist.detail.qty')}</th>
                        <th className="text-right px-3 py-2 font-medium" style={{ color: 'var(--text3)' }}>{t('hist.detail.unitPrice')}</th>
                        <th className="text-right px-3 py-2 font-medium" style={{ color: 'var(--text3)' }}>{t('hist.detail.discount')}</th>
                        <th className="text-right px-3 py-2 font-medium" style={{ color: 'var(--text3)' }}>{t('hist.detail.subtotal')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(() => {
                        const items = selectedVenta.items || [];
                        const totalPages = Math.max(1, Math.ceil(items.length / itemsPerPage));
                        const page = Math.min(totalPages, Math.max(1, itemsPage));
                        const slice = items.slice((page - 1) * itemsPerPage, (page - 1) * itemsPerPage + itemsPerPage);
                        return (
                          <>
                            {slice.map((item) => (
                              <tr key={item.id} style={{ borderBottom: '1px solid rgba(0,0,0,0.0)' }}>
                                <td className="px-3 py-2" style={{ color: 'var(--text)' }}>{item.producto_nombre}</td>
                                <td className="px-3 py-2 text-right font-mono" style={{ color: 'var(--text2)' }}>{item.cantidad}</td>
                                <td className="px-3 py-2 text-right font-mono" style={{ color: 'var(--text2)' }}>{formatCurrency(item.precio_unitario)}</td>
                                <td className="px-3 py-2 text-right font-mono" style={{ color: 'var(--text3)' }}>{item.descuento > 0 ? `${item.descuento}%` : '—'}</td>
                                <td className="px-3 py-2 text-right font-mono font-bold" style={{ color: 'var(--text)' }}>{formatCurrency(lineTotal(item))}</td>
                              </tr>
                            ))}
                            {items.length > itemsPerPage && (
                              <tr>
                                <td colSpan={5} className="px-3 py-2">
                                  <div className="flex items-center justify-between">
                                    <span className="text-xs" style={{ color: 'var(--text3)' }}>
                                      Página {page} de {totalPages} · {items.length} ítems
                                    </span>
                                    <div className="flex items-center gap-2">
                                      <button className="btn btn-secondary btn-xs" disabled={page <= 1} onClick={() => setItemsPage(p => Math.max(1, p - 1))}>Anterior</button>
                                      <button className="btn btn-secondary btn-xs" disabled={page >= totalPages} onClick={() => setItemsPage(p => Math.min(totalPages, p + 1))}>Siguiente</button>
                                    </div>
                                  </div>
                                </td>
                              </tr>
                            )}
                          </>
                        );
                      })()}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            <div className="flex flex-col items-end gap-1 text-sm">
              {selectedVenta.descuento_global > 0 && (
                <div className="flex gap-4">
                  <span className="text-slate-400">{t('hist.detail.subtotal')}:</span>
                  <span className="font-mono">{formatCurrency(selectedVenta.subtotal)}</span>
                </div>
              )}
              {selectedVenta.descuento_global > 0 && (
                <div className="flex gap-4 text-red-400">
                  <span>{t('hist.detail.globalDisc')}:</span>
                  <span className="font-mono">-{selectedVenta.descuento_global}%</span>
                </div>
              )}
              <div className="flex gap-4 text-lg">
                <span className="text-slate-400">{t('hist.detail.total')}:</span>
                <span className="font-mono font-bold" style={{ color: 'var(--text)' }}>{formatCurrency(selectedVenta.total)}</span>
              </div>
            </div>
          </div>
        )}
        {selectedCancelada && (
          <div className="space-y-4 text-sm">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <div style={{ color: 'var(--text3)' }}>Cancelada el</div>
                <div style={{ color: 'var(--text)' }}>{formatDate(selectedCancelada.cancelada_at?.slice(0, 10) || selectedCancelada.fecha)}</div>
              </div>
              <div>
                <div style={{ color: 'var(--text3)' }}>Motivo</div>
                <div style={{ color: 'var(--text)' }}>{selectedCancelada.motivo || '—'}</div>
              </div>
              <div>
                <div style={{ color: 'var(--text3)' }}>Cliente</div>
                <div style={{ color: 'var(--text)' }}>{selectedCancelada.cliente_nombre || 'Consumidor final'}</div>
              </div>
              <div>
                <div style={{ color: 'var(--text3)' }}>Método de pago</div>
                <div style={{ color: 'var(--text)' }} className="capitalize">{selectedCancelada.metodo_pago}</div>
              </div>
            </div>
            {selectedCancelada.productos && (
              <div>
                <div className="text-xs font-semibold uppercase tracking-wider mb-1" style={{ color: 'var(--text3)' }}>Productos</div>
                <div className="rounded-lg p-3 text-sm" style={{ background: 'var(--bg3)', border: '1px solid var(--border)', color: 'var(--text2)' }}>
                  {selectedCancelada.productos}
                </div>
              </div>
            )}
            <div className="flex justify-end text-lg">
              <span className="text-slate-400 mr-4">{t('hist.detail.total')}:</span>
              <span className="font-mono font-bold line-through" style={{ color: 'var(--text3)' }}>{formatCurrency(selectedCancelada.total)}</span>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};
