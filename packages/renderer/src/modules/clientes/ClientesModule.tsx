import React, { useState, useEffect, useMemo } from 'react';
import {
  Users, Plus, Search, Edit, Trash2, RefreshCw, DollarSign, FileText, Download,
  ChevronDown, ChevronRight, Package
} from 'lucide-react';
import toast from 'react-hot-toast';
import { clientesAPI, ventasAPI } from '../../lib/api';
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
  producto_nombre: string;
  cantidad: number;
  precio_unitario: number;
  total: number;
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
  const [selectedCliente, setSelectedCliente] = useState<Cliente | null>(null);
  const [clienteVentas, setClienteVentas] = useState<Venta[]>([]);
  const [pagoAmount, setPagoAmount] = useState('');
  const [pagoMetodo, setPagoMetodo] = useState('efectivo');
  const [showPagarModal, setShowPagarModal] = useState(false);
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
    await clientesAPI.delete(id);
    toast.success(t('clie.deleted'));
    setConfirmDelete(null);
    loadData();
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

  const handlePagar = async () => {
    if (!selectedCliente) return;
    const monto = parseFloat(pagoAmount);
    if (!monto || monto <= 0) { toast.error('Monto inválido'); return; }
    await clientesAPI.pagarFiado(selectedCliente.id, monto, pagoMetodo);
    toast.success(`Pago registrado: ${formatCurrency(monto)}`);
    setShowPagarModal(false);
    setPagoAmount('');
    setPagoMetodo('efectivo');
    setSaldoActual(null);
    const freshList = await loadData();
    const updated = freshList?.find((c) => c.id === selectedCliente.id);
    if (updated) {
      setSelectedCliente(updated);
      await handleVerCuenta(updated);
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
    <div className="flex h-full gap-4">
      {/* Lista de clientes */}
      <div className={`flex flex-col ${selectedCliente ? 'w-1/2' : 'w-full'} transition-all`}>
        {/* Header */}
        <div className="shrink-0 module-header px-6 pt-6">
          <div>
            <h1 className="module-title flex items-center gap-3"><Users size={28} className="text-blue-400" /> {t('clie.title')}</h1>
            <p className="text-sm text-slate-400 mt-1">{clientes.length} clientes · Fiado total: <span className="text-red-400 font-semibold">{formatCurrency(totalFiado)}</span></p>
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

        {/* Tabla */}
        <div className="flex-1 overflow-auto px-6 pb-6">
          <div className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-700">
                  <th className="table-header">{t('clie.col.name')}</th>
                  <th className="table-header">{t('clie.col.contact')}</th>
                  <th className="table-header text-right">{t('clie.col.balance')}</th>
                  <th className="table-header"></th>
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
                    <td className="table-cell">
                      <div className="font-semibold text-white">{c.nombre} {c.apellido}</div>
                      {c.documento && <div className="text-xs text-slate-500">Doc: {c.documento}</div>}
                    </td>
                    <td className="table-cell text-sm text-slate-400">
                      {c.telefono && <div>{c.telefono}</div>}
                      {c.email && <div className="text-xs">{c.email}</div>}
                    </td>
                    <td className="table-cell text-right">
                      {c.saldo_pendiente > 0 ? (
                        <span className="font-mono font-bold text-red-400">{formatCurrency(c.saldo_pendiente)}</span>
                      ) : (
                        <span className="text-slate-500 text-sm">{t('clie.noDebt')}</span>
                      )}
                    </td>
                    <td className="table-cell" onClick={(e) => e.stopPropagation()}>
                      <div className="flex gap-1">
                        <button onClick={() => handleEdit(c)} className="btn-ghost btn p-1.5"><Edit size={13} /></button>
                        <button onClick={() => setConfirmDelete(c.id)} className="btn-ghost btn p-1.5 hover:text-red-400"><Trash2 size={13} /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Panel de cuenta corriente */}
      {selectedCliente && (
        <div className="w-1/2 flex flex-col bg-slate-800/50 rounded-2xl border border-slate-700 m-4 mr-6 overflow-hidden">
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
              <button className="btn-success btn" onClick={() => {
                setPagoAmount((saldoActual ?? selectedCliente.saldo_pendiente).toFixed(2));
                setShowPagarModal(true);
              }}>
                <DollarSign size={16} /> {t('clie.registerPayment')}
              </button>
            )}
          </div>

          {/* Historial */}
          <div className="flex-1 overflow-auto p-4">
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
                  return (
                    <div key={v.id} className="bg-slate-700/50 rounded-lg overflow-hidden">
                      {/* Cabecera de la venta — click para expandir */}
                      <button
                        className="w-full flex items-center justify-between p-3 hover:bg-slate-600/40 transition-colors text-left"
                        onClick={() => handleToggleVenta(v.id)}
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
                          <div className="font-mono font-bold text-white">{formatCurrency(v.total)}</div>
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
                              {items.map((item, idx) => (
                                <div key={idx} className="flex items-center justify-between text-xs">
                                  <div className="flex items-center gap-1.5 text-slate-300 flex-1 min-w-0">
                                    <Package size={11} className="text-slate-500 shrink-0" />
                                    <span className="truncate">{item.producto_nombre || 'Producto eliminado'}</span>
                                  </div>
                                  <div className="flex items-center gap-3 shrink-0 ml-2">
                                    <span className="text-slate-400">x{item.cantidad % 1 === 0 ? item.cantidad : item.cantidad.toFixed(2)}</span>
                                    <span className="font-mono text-slate-300 w-20 text-right">{formatCurrency(item.total)}</span>
                                  </div>
                                </div>
                              ))}
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

      {/* Modal pago */}
      <Modal isOpen={showPagarModal} onClose={() => { setShowPagarModal(false); setSaldoActual(null); setPagoMetodo('efectivo'); }} title="Registrar Pago de Fiado" size="sm"
        footer={
          <>
            <button className="btn-secondary btn" onClick={() => { setShowPagarModal(false); setSaldoActual(null); setPagoMetodo('efectivo'); }}>Cancelar</button>
            <button className="btn-success btn" onClick={handlePagar}><DollarSign size={16} /> Confirmar Pago</button>
          </>
        }
      >
        <div className="space-y-4">
          <div>
            <div className="text-sm text-slate-400">Saldo a cobrar (precio actual)</div>
            <div className={`text-2xl font-mono font-bold mt-1 ${(saldoActual ?? 0) > 0 ? 'text-red-400' : 'text-green-400'}`}>
              {formatCurrency(saldoActual ?? 0)}
            </div>
          </div>
          <div>
            <label className="label">Método de pago</label>
            <div className="flex flex-wrap gap-2">
              {metodosPagoFiado.map((m) => (
                <button
                  key={m.id}
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
            <label className="label">{t('clie.payAmount')}</label>
            <input
              className="input text-right font-mono text-xl"
              type="number" step="0.01" min="0"
              value={pagoAmount}
              onChange={(e) => setPagoAmount(e.target.value)}
              autoFocus
            />
          </div>
          {parseFloat(pagoAmount) > 0 && selectedCliente && (
            <div className="bg-slate-700/50 rounded-lg p-3 text-sm">
              <div className="flex justify-between">
                <span className="text-slate-400">{t('clie.remaining')}:</span>
                <span className={`font-mono font-bold ${(saldoActual ?? selectedCliente.saldo_pendiente) - parseFloat(pagoAmount) > 0 ? 'text-red-400' : 'text-green-400'}`}>
                  {formatCurrency(Math.max(0, (saldoActual ?? selectedCliente.saldo_pendiente) - parseFloat(pagoAmount)))}
                </span>
              </div>
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
    </div>
  );
};
