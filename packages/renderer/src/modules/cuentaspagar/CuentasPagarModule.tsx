import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { FileText, Plus, Search, RefreshCw, Check, X, AlertCircle, Edit, Trash2, Zap, Shield } from 'lucide-react';
import toast from 'react-hot-toast';
import { Modal, ConfirmDialog } from '../../components/shared/Modal';
import { formatCurrency, formatDate } from '../../lib/utils';
import { useAppStore } from '../../store/useAppStore';
import { useLibroCajaStore } from '../../store/useLibroCajaStore';

interface CuentaPagar {
  id: number;
  proveedor: string;
  concepto: string;
  monto_total: number;
  monto_pagado: number;
  monto_pendiente: number;
  fecha_vencimiento: string | null;
  estado: 'pendiente' | 'parcial' | 'pagada';
  notas: string;
}

const defaultCuenta: Omit<CuentaPagar, 'id' | 'monto_pagado' | 'monto_pendiente' | 'estado'> = {
  proveedor: '',
  concepto: '',
  monto_total: 0,
  fecha_vencimiento: '',
  notas: '',
};

export const CuentasPagarModule: React.FC = () => {
  const { t } = useTranslation();
  const { currentUser } = useAppStore();
  const isAdmin = currentUser?.rol === 'admin';
  const { egresos, addEgreso, removeEgreso, cargarDia, fechaSeleccionada } = useLibroCajaStore();
  const egresosListRef = useRef<HTMLDivElement>(null);

  const [cuentas, setCuentas] = useState<CuentaPagar[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterEstado, setFilterEstado] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [formData, setFormData] = useState<typeof defaultCuenta>(defaultCuenta);
  const [confirmDelete, setConfirmDelete] = useState<number | null>(null);
  const [showPagar, setShowPagar] = useState<CuentaPagar | null>(null);
  const [montoAPagar, setMontoAPagar] = useState('');

  // Estado de egresos rápidos
  const [egresoProveedor, setEgresoProveedor] = useState('');
  const [egresoMonto, setEgresoMonto] = useState('');
  const [egresoMedioPago, setEgresoMedioPago] = useState<'efectivo' | 'transferencia'>('efectivo');
  const [addingEgreso, setAddingEgreso] = useState(false);

  const loadData = async () => {
    setLoading(true);
    try {
      const { invoke } = (window as unknown as { electron: { invoke: (c: string, ...a: unknown[]) => Promise<unknown> } }).electron;
      const list = await invoke('cuentaspagar:getAll') as CuentaPagar[];
      setCuentas(list);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    cargarDia(); // cargar egresos del día actual
  }, []);

  const handleAddEgreso = useCallback(async () => {
    const monto = parseFloat(egresoMonto.replace(',', '.'));
    if (!egresoProveedor.trim()) { toast.error('Ingresá el proveedor o concepto'); return; }
    if (!monto || monto <= 0) { toast.error('Ingresá un monto válido'); return; }
    setAddingEgreso(true);
    try {
      await addEgreso(egresoProveedor.trim(), monto, egresoMedioPago);
      setEgresoProveedor('');
      setEgresoMonto('');
      toast.success('Egreso registrado');
    } finally {
      setAddingEgreso(false);
    }
  }, [egresoProveedor, egresoMonto, egresoMedioPago, addEgreso]);

  const filtered = cuentas.filter((c) => {
    const matchSearch = !search.trim() ||
      c.proveedor.toLowerCase().includes(search.toLowerCase()) ||
      c.concepto.toLowerCase().includes(search.toLowerCase());
    const matchEstado = !filterEstado || c.estado === filterEstado;
    return matchSearch && matchEstado;
  });

  const totales = {
    pendiente: cuentas.filter((c) => c.estado !== 'pagada').reduce((s, c) => s + c.monto_pendiente, 0),
    pagado: cuentas.reduce((s, c) => s + c.monto_pagado, 0),
  };

  const invoke = (window as unknown as { electron: { invoke: (c: string, ...a: unknown[]) => Promise<unknown> } }).electron.invoke;

  const handleSave = async () => {
    if (!formData.proveedor.trim()) { toast.error(t('cp.supplierRequired')); return; }
    if (!formData.monto_total || formData.monto_total <= 0) { toast.error(t('cp.amountRequired')); return; }
    try {
      if (editingId) {
        await invoke('cuentaspagar:update', editingId, formData);
        toast.success(t('cp.updated'));
      } else {
        await invoke('cuentaspagar:create', formData);
        toast.success(t('cp.created'));
      }
      setShowForm(false);
      setEditingId(null);
      setFormData(defaultCuenta);
      loadData();
    } catch {
      toast.error(t('cp.saveError'));
    }
  };

  const handlePagar = async () => {
    if (!showPagar) return;
    const monto = parseFloat(montoAPagar);
    if (!monto || monto <= 0) { toast.error(t('cp.payAmountInvalid')); return; }
    if (monto > showPagar.monto_pendiente) { toast.error(t('cp.payExceeds')); return; }
    try {
      await invoke('cuentaspagar:pagar', showPagar.id, monto);
      toast.success(t('cp.payOk', { amount: formatCurrency(monto) }));
      setShowPagar(null);
      setMontoAPagar('');
      loadData();
    } catch {
      toast.error(t('cp.payError'));
    }
  };

  const handleDelete = async (id: number) => {
    await invoke('cuentaspagar:delete', id);
    toast.success(t('cp.deleted'));
    setConfirmDelete(null);
    loadData();
  };

  const ESTADO_COLORS: Record<string, string> = {
    pendiente: 'badge-red',
    parcial: 'badge-yellow',
    pagada: 'badge-green',
  };

  const isVencida = (fecha: string | null) => {
    if (!fecha) return false;
    return new Date(fecha) < new Date();
  };

  // Scroll automático al final si la lista es larga
  useEffect(() => {
    if (egresosListRef.current) {
      egresosListRef.current.scrollTop = egresosListRef.current.scrollHeight;
    }
  }, [egresos.length]);

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="shrink-0 module-header px-6 pt-6">
        <div>
          <h1 className="module-title flex items-center gap-3"><FileText size={28} className="text-blue-400" /> {t('cp.title')}</h1>
          <div className="flex gap-4 text-sm text-slate-400 mt-1">
            <span>{t('cp.pending')} <span className="text-red-400 font-semibold">{formatCurrency(totales.pendiente)}</span></span>
            <span>{t('cp.paid')} <span className="text-green-400 font-semibold">{formatCurrency(totales.pagado)}</span></span>
          </div>
        </div>
        <div className="flex gap-2">
          <button className="btn-ghost btn p-2" onClick={loadData}><RefreshCw size={16} /></button>
          <button className="btn-primary btn" onClick={() => { setFormData(defaultCuenta); setEditingId(null); setShowForm(true); }}>
            <Plus size={16} /> {t('cp.new')}
          </button>
        </div>
      </div>

      {/* Filtros */}
      <div className="shrink-0 px-6 pb-4 flex items-center gap-3">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input type="text" placeholder={t('cp.search')} value={search} onChange={(e) => setSearch(e.target.value)} className="input pl-9 text-sm" />
        </div>
        <select value={filterEstado} onChange={(e) => setFilterEstado(e.target.value)} className="input text-sm w-36">
          <option value="">{t('cp.all')}</option>
          <option value="pendiente">{t('cp.pendiente')}</option>
          <option value="parcial">{t('cp.parcial')}</option>
          <option value="pagada">{t('cp.pagada')}</option>
        </select>
      </div>

      {/* Tabla */}
      <div className="flex-1 overflow-auto px-6 pb-6">
        <div className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-700">
                <th className="table-header">{t('cp.col.supplier')}</th>
                <th className="table-header">{t('cp.col.concept')}</th>
                <th className="table-header text-center">{t('cp.col.due')}</th>
                <th className="table-header text-right">{t('cp.col.total')}</th>
                <th className="table-header text-right">{t('cp.col.paid')}</th>
                <th className="table-header text-right">{t('cp.col.remaining')}</th>
                <th className="table-header text-center">{t('cp.col.status')}</th>
                <th className="table-header"></th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={8} className="text-center py-8 text-slate-400">Cargando...</td></tr>
              ) : filtered.length === 0 ? (
                  <tr><td colSpan={8} className="text-center py-8 text-slate-500">{t('cp.empty')}</td></tr>
              ) : filtered.map((c) => (
                <tr key={c.id} className="table-row">
                  <td className="table-cell">
                    <div className="font-semibold text-white">{c.proveedor}</div>
                    {c.notas && <div className="text-xs text-slate-500 truncate max-w-[200px]">{c.notas}</div>}
                  </td>
                  <td className="table-cell text-sm text-slate-300">{c.concepto}</td>
                  <td className={`table-cell text-center text-xs ${c.fecha_vencimiento && isVencida(c.fecha_vencimiento) && c.estado !== 'pagada' ? 'text-red-400 font-bold' : 'text-slate-400'}`}>
                    {c.fecha_vencimiento ? (
                      <div className="flex items-center justify-center gap-1">
                        {isVencida(c.fecha_vencimiento) && c.estado !== 'pagada' && <AlertCircle size={12} />}
                        {new Date(c.fecha_vencimiento).toLocaleDateString('es-AR')}
                      </div>
                    ) : '—'}
                  </td>
                  <td className="table-cell text-right font-mono text-slate-300">{formatCurrency(c.monto_total)}</td>
                  <td className="table-cell text-right font-mono text-green-400">{formatCurrency(c.monto_pagado)}</td>
                  <td className={`table-cell text-right font-mono font-bold ${c.monto_pendiente > 0 ? 'text-red-400' : 'text-slate-500'}`}>
                    {formatCurrency(c.monto_pendiente)}
                  </td>
                  <td className="table-cell text-center">
                    <span className={`badge ${ESTADO_COLORS[c.estado]} text-[10px]`}>{c.estado}</span>
                  </td>
                  <td className="table-cell">
                    <div className="flex gap-1">
                      {c.estado !== 'pagada' && (
                        <button onClick={() => { setShowPagar(c); setMontoAPagar(c.monto_pendiente.toString()); }} className="btn-success btn p-1.5" title="Registrar pago">
                          <Check size={12} />
                        </button>
                      )}
                      <button onClick={() => { setFormData(c); setEditingId(c.id); setShowForm(true); }} className="btn-ghost btn p-1.5"><Edit size={12} /></button>
                      <button onClick={() => setConfirmDelete(c.id)} className="btn-ghost btn p-1.5 hover:text-red-400"><Trash2 size={12} /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Form modal */}
      <Modal isOpen={showForm} onClose={() => setShowForm(false)} title={editingId ? t('cp.editTitle') : t('cp.newTitle')} size="md"
        footer={<><button className="btn-secondary btn" onClick={() => setShowForm(false)}>{t('common.cancel')}</button><button className="btn-primary btn" onClick={handleSave}>{t('common.save').split(' ')[0]}</button></>}>
        <div className="space-y-4">
          <div>
            <label className="label">{t('cp.form.supplier')}</label>
            <input className="input" value={formData.proveedor} onChange={(e) => setFormData({ ...formData, proveedor: e.target.value })} placeholder={t('cp.form.supplierPh')} autoFocus />
          </div>
          <div>
            <label className="label">{t('cp.form.concept')}</label>
            <input className="input" value={formData.concepto} onChange={(e) => setFormData({ ...formData, concepto: e.target.value })} placeholder={t('cp.form.conceptPh')} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">{t('cp.form.total')}</label>
              <input className="input font-mono text-right" type="number" step="0.01" min="0" value={formData.monto_total} onChange={(e) => setFormData({ ...formData, monto_total: parseFloat(e.target.value) || 0 })} />
            </div>
            <div>
              <label className="label">{t('cp.form.dueDate')}</label>
              <input className="input" type="date" value={formData.fecha_vencimiento || ''} onChange={(e) => setFormData({ ...formData, fecha_vencimiento: e.target.value })} />
            </div>
          </div>
          <div>
            <label className="label">{t('cp.form.notes')}</label>
            <input className="input" value={formData.notas} onChange={(e) => setFormData({ ...formData, notas: e.target.value })} placeholder={t('cp.form.notesPh')} />
          </div>
        </div>
      </Modal>

      {/* Pagar modal */}
      <Modal isOpen={showPagar !== null} onClose={() => setShowPagar(null)} title={t('cp.payTitle')} size="sm"
        footer={<><button className="btn-secondary btn" onClick={() => setShowPagar(null)}>{t('common.cancel')}</button><button className="btn-success btn" onClick={handlePagar}><Check size={16} /> {t('cp.payBtn')}</button></>}>
        {showPagar && (
          <div className="space-y-4">
            <div className="bg-slate-700/50 rounded-lg p-3 text-sm">
              <div className="text-slate-400">{showPagar.proveedor}</div>
              <div className="flex justify-between mt-1">
                <span className="text-slate-400">{t('cp.col.remaining')}:</span>
                <span className="font-mono font-bold text-red-400">{formatCurrency(showPagar.monto_pendiente)}</span>
              </div>
            </div>
            <div>
              <label className="label">{t('cp.payAmount')}</label>
              <input className="input font-mono text-right text-xl" type="number" step="0.01" min="0.01" max={showPagar.monto_pendiente} value={montoAPagar} onChange={(e) => setMontoAPagar(e.target.value)} autoFocus />
            </div>
          </div>
        )}
      </Modal>

      <ConfirmDialog isOpen={confirmDelete !== null} title={t('cp.deleteTitle')} message={t('cp.deleteMsg')} onConfirm={() => confirmDelete && handleDelete(confirmDelete)} onCancel={() => setConfirmDelete(null)} />

      {/* ── Egresos rápidos del día ───────────────────────────────── */}
      <div className="shrink-0 px-6 pb-6">
        <div style={{ background: 'var(--bg2)', borderRadius: 12, border: '1px solid rgba(239,68,68,0.25)', padding: 16 }}>
          {/* Header */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
            <Zap size={15} style={{ color: '#ef4444' }} />
            <span style={{ fontSize: 13, fontWeight: 700, color: '#ef4444', textTransform: 'uppercase', letterSpacing: '0.07em' }}>
              Egresos Rápidos — Hoy ({fechaSeleccionada.split('-').reverse().slice(0,2).join('/')})
            </span>
            <span style={{ fontSize: 11, color: 'var(--text3)', marginLeft: 2 }}>
              se descuenta de {egresoMedioPago === 'transferencia' ? 'Gastos Tarjeta/Transfer.' : 'Total en Caja'} en el libro
            </span>
          </div>

          {/* Formulario (solo admins) */}
          {isAdmin ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 14 }}>
              <div style={{ display: 'flex', gap: 8 }}>
                <input
                  type="text"
                  placeholder="Proveedor / concepto"
                  value={egresoProveedor}
                  onChange={e => setEgresoProveedor(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') handleAddEgreso(); }}
                  className="input"
                  style={{ flex: 2 }}
                />
                <input
                  type="number"
                  placeholder="Monto"
                  value={egresoMonto}
                  onChange={e => setEgresoMonto(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') handleAddEgreso(); }}
                  className="input font-mono text-right"
                  style={{ flex: 1 }}
                />
                <button
                  onClick={handleAddEgreso}
                  disabled={addingEgreso}
                  className="btn-danger btn"
                >
                  <Plus size={14} /> Registrar
                </button>
              </div>
              {/* Toggle efectivo / transferencia */}
              <div style={{ display: 'flex', gap: 6 }}>
                <button
                  onClick={() => setEgresoMedioPago('efectivo')}
                  style={{
                    padding: '4px 14px', borderRadius: 20, fontSize: 12, fontWeight: 600, cursor: 'pointer',
                    border: egresoMedioPago === 'efectivo' ? 'none' : '1px solid var(--border)',
                    background: egresoMedioPago === 'efectivo' ? '#22c55e' : 'var(--bg3)',
                    color: egresoMedioPago === 'efectivo' ? 'white' : 'var(--text3)',
                  }}
                >
                  💵 Efectivo
                </button>
                <button
                  onClick={() => setEgresoMedioPago('transferencia')}
                  style={{
                    padding: '4px 14px', borderRadius: 20, fontSize: 12, fontWeight: 600, cursor: 'pointer',
                    border: egresoMedioPago === 'transferencia' ? 'none' : '1px solid var(--border)',
                    background: egresoMedioPago === 'transferencia' ? '#3b82f6' : 'var(--bg3)',
                    color: egresoMedioPago === 'transferencia' ? 'white' : 'var(--text3)',
                  }}
                >
                  🏦 Transferencia
                </button>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-2 text-sm text-slate-400 mb-4">
              <Shield size={13} /> Solo administradores pueden registrar egresos
            </div>
          )}

          {/* Lista de egresos del día */}
          {egresos.length === 0 ? (
            <div style={{ fontSize: 12, color: 'var(--text3)', textAlign: 'center', padding: '10px 0' }}>
              Sin egresos hoy
            </div>
          ) : (
            <div
              ref={egresosListRef}
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 5,
                maxHeight: egresos.length > 6 ? 260 : 'none',
                overflowY: egresos.length > 6 ? 'auto' : 'visible',
                marginBottom: 0
              }}
            >
              {egresos.map(eg => (
                <div key={eg.id} className="flex items-center gap-3" style={{
                  padding: '7px 10px', background: 'var(--bg)',
                  borderRadius: 8, border: '1px solid var(--border)',
                }}>
                  <span style={{ fontSize: 11, color: 'var(--text3)', minWidth: 35 }}>
                    {eg.fecha ? eg.fecha.slice(11, 16) : ''}
                  </span>
                  <span style={{
                    fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 12,
                    background: eg.medio_pago === 'transferencia' ? 'rgba(59,130,246,0.15)' : 'rgba(34,197,94,0.12)',
                    color: eg.medio_pago === 'transferencia' ? '#3b82f6' : '#22c55e',
                  }}>
                    {eg.medio_pago === 'transferencia' ? '🏦 Transfer.' : '💵 Efectivo'}
                  </span>
                  <span className="flex-1 text-sm" style={{ color: 'var(--text)' }}>{eg.proveedor}</span>
                  <span className="font-mono font-bold" style={{ color: '#ef4444' }}>
                    - {formatCurrency(eg.monto)}
                  </span>
                  {isAdmin && (
                    <button
                      onClick={() => removeEgreso(eg.id)}
                      className="btn-ghost btn p-1 hover:text-red-400"
                      title="Eliminar egreso"
                    >
                      <Trash2 size={13} />
                    </button>
                  )}
                </div>
              ))}
              <div className="flex justify-end pt-2" style={{ borderTop: '1px solid var(--border)', background: 'var(--bg2)' }}>
                <span className="font-mono font-bold text-sm" style={{ color: '#ef4444' }}>
                  Total: - {formatCurrency(egresos.reduce((a, e) => a + e.monto, 0))}
                </span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
