import React, { useState, useEffect } from 'react';
import {
  Vault, Play, StopCircle, Plus, Minus, RefreshCw, FileText, Check, DollarSign,
  TrendingUp, CreditCard, Smartphone, Bitcoin
} from 'lucide-react';
import toast from 'react-hot-toast';
import { cajaAPI } from '../../lib/api';
import { Modal } from '../../components/shared/Modal';
import { formatCurrency, formatDate } from '../../lib/utils';
import { useTranslation } from 'react-i18next';
import { useLibroCajaStore } from '../../store/useLibroCajaStore';

interface CajaSesion {
  id: number;
  fecha_apertura: string;
  fecha_cierre: string | null;
  saldo_inicial: number;
  saldo_final: number | null;
  total_ventas: number;
  total_ingresos: number;
  total_egresos: number;
  usuario_nombre: string;
  estado: 'abierta' | 'cerrada';
}

interface CajaMovimiento {
  id: number;
  tipo: 'ingreso' | 'egreso';
  descripcion: string;
  monto: number;
  metodo_pago: string;
  venta_numero: string | null;
  fecha: string;
}

const METODO_ICONS: Record<string, React.ReactNode> = {
  efectivo: <DollarSign size={14} />,
  tarjeta: <CreditCard size={14} />,
  transferencia: <Smartphone size={14} />,
  cripto: <Bitcoin size={14} />,
};

export const CajaModule: React.FC = () => {
  const [sesionActiva, setSesionActiva] = useState<CajaSesion | null>(null);
  const [historico, setHistorico] = useState<CajaSesion[]>([]);
  const [movimientos, setMovimientos] = useState<CajaMovimiento[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'actual' | 'historico'>('actual');
  const { t } = useTranslation();
  const { cargarDia, cargarHistorico: cargarHistoricoLibro } = useLibroCajaStore();

  const [showAbrirModal, setShowAbrirModal] = useState(false);
  const [showCerrarModal, setShowCerrarModal] = useState(false);
  const [showMovimientoModal, setShowMovimientoModal] = useState(false);
  const [tipoMovimiento, setTipoMovimiento] = useState<'ingreso' | 'egreso'>('ingreso');

  const [saldoInicial, setSaldoInicial] = useState('');
  const [saldoFinal, setSaldoFinal] = useState('');
  const [movConcepto, setMovConcepto] = useState('');
  const [movMonto, setMovMonto] = useState('');
  const [movMetodo, setMovMetodo] = useState('efectivo');

  const loadData = async () => {
    setLoading(true);
    try {
      const [sesion, hist] = await Promise.all([
        cajaAPI.getSesionActiva() as Promise<CajaSesion | null>,
        cajaAPI.getHistorico() as Promise<CajaSesion[]>,
      ]);
      setSesionActiva(sesion);
      setHistorico(hist);

      if (sesion) {
        const movs = await cajaAPI.getMovimientos(sesion.id) as CajaMovimiento[];
        setMovimientos(movs);
      } else {
        setMovimientos([]);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); }, []);

  const handleAbrir = async () => {
    const saldo = parseFloat(saldoInicial) || 0;
    await cajaAPI.abrir({ saldo_inicial: saldo });
    toast.success(t('caja.openedSuccess'));
    setShowAbrirModal(false);
    setSaldoInicial('');
    loadData();
  };

  const handleCerrar = async () => {
    if (!sesionActiva) return;
    const saldo = parseFloat(saldoFinal) || 0;
    await cajaAPI.cerrar(sesionActiva.id, { saldo_final: saldo });
    toast.success(t('caja.closedSuccess'));
    setShowCerrarModal(false);
    setSaldoFinal('');
    loadData();
    // Actualizar libro de caja del día
    const hoy = new Date().toISOString().split('T')[0];
    cargarDia(hoy);
    cargarHistoricoLibro();
  };

  const handleMovimiento = async () => {
    if (!sesionActiva) return;
    if (!movConcepto.trim()) { toast.error(t('caja.conceptRequired')); return; }
    const monto = parseFloat(movMonto);
    if (!monto || monto <= 0) { toast.error(t('caja.invalidAmount')); return; }
    await cajaAPI.agregarMovimiento(sesionActiva.id, {
      tipo: tipoMovimiento,
      concepto: movConcepto,
      monto,
      metodo_pago: movMetodo,
    });
      toast.success(`${tipoMovimiento === 'ingreso' ? t('caja.income') : t('caja.expense')} registrado`);
    setShowMovimientoModal(false);
    setMovConcepto('');
    setMovMonto('');
    loadData();
  };

  // Calcula totales por método de pago (solo movimientos de ventas)
  const totalesPorMetodo = movimientos.reduce<Record<string, number>>((acc, m) => {
    if (m.tipo === 'ingreso' && m.venta_numero) {
      acc[m.metodo_pago] = (acc[m.metodo_pago] || 0) + m.monto;
    }
    return acc;
  }, {});

  const saldoEfectivoEstimado = (sesionActiva?.saldo_inicial || 0) +
    movimientos.filter((m) => m.metodo_pago === 'efectivo' && m.tipo === 'ingreso').reduce((s, m) => s + m.monto, 0) -
    movimientos.filter((m) => m.tipo === 'egreso').reduce((s, m) => s + m.monto, 0);

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="shrink-0 module-header px-6 pt-6">
        <div>
          <h1 className="module-title flex items-center gap-3"><Vault size={28} className="text-blue-400" /> {t('caja.title')}</h1>
          {sesionActiva ? (
            <div className="flex items-center gap-2 mt-1">
              <span className="badge badge-green text-xs">{t('caja.openBadge')}</span>
              <span className="text-sm text-slate-400">desde {formatDate(sesionActiva.fecha_apertura)} · {sesionActiva.usuario_nombre}</span>
            </div>
          ) : (
            <span className="badge badge-gray text-xs mt-1">{t('caja.closedBadge')}</span>
          )}
        </div>
        <div className="flex gap-2">
          {!sesionActiva ? (
            <button className="btn-success btn" onClick={() => setShowAbrirModal(true)}>
              <Play size={16} /> {t('caja.openAction')}
            </button>
          ) : (
            <>
              <button className="btn-secondary btn" onClick={() => { setTipoMovimiento('ingreso'); setShowMovimientoModal(true); }}>
                <Plus size={16} /> {t('caja.income')}
              </button>
              <button className="btn-secondary btn" onClick={() => { setTipoMovimiento('egreso'); setShowMovimientoModal(true); }}>
                <Minus size={16} /> {t('caja.expense')}
              </button>
              <button className="btn-danger btn" onClick={() => setShowCerrarModal(true)}>
                <StopCircle size={16} /> {t('caja.closeAction')}
              </button>
            </>
          )}
          <button className="btn-ghost btn p-2" onClick={loadData}><RefreshCw size={16} /></button>
        </div>
      </div>

      {/* Tabs */}
      <div className="shrink-0 px-6 flex gap-1 border-b border-slate-700">
        <button onClick={() => setTab('actual')} className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${tab === 'actual' ? 'border-blue-500 text-white' : 'border-transparent text-slate-400 hover:text-white'}`}>
          {t('caja.session')}
        </button>
        <button onClick={() => setTab('historico')} className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${tab === 'historico' ? 'border-blue-500 text-white' : 'border-transparent text-slate-400 hover:text-white'}`}>
          {t('caja.history')}
        </button>
      </div>

      {tab === 'actual' && (
        <div className="flex-1 overflow-auto px-6 py-4 pb-6">
          {!sesionActiva ? (
            <div className="flex flex-col items-center justify-center h-48 text-slate-500 gap-3">
              <Vault size={48} />
              <p>{t('caja.closedMsg')}</p>
              <button className="btn-success btn" onClick={() => setShowAbrirModal(true)}>
                <Play size={16} /> {t('caja.openAction')}
              </button>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Resumen */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="stat-card">
                  <div className="stat-label">{t('caja.initialBalance')}</div>
                  <div className="stat-value text-slate-300">{formatCurrency(sesionActiva.saldo_inicial)}</div>
                </div>
                <div className="stat-card">
                  <div className="stat-label">{t('caja.totalSales')}</div>
                  <div className="stat-value text-green-400">{formatCurrency(sesionActiva.total_ventas)}</div>
                </div>
                <div className="stat-card">
                  <div className="stat-label">{t('caja.extraIncome')}</div>
                  <div className="stat-value text-blue-400">{formatCurrency(sesionActiva.total_ingresos)}</div>
                </div>
                <div className="stat-card">
                  <div className="stat-label">{t('caja.expenses')}</div>
                  <div className="stat-value text-red-400">{formatCurrency(sesionActiva.total_egresos)}</div>
                </div>
              </div>

              {/* Saldo estimado efectivo */}
              <div className="bg-gradient-to-r from-green-900/40 to-green-800/20 border border-green-700/50 rounded-xl p-5 flex items-center justify-between">
                <div>
                  <div className="text-sm text-green-400 uppercase tracking-wider font-semibold">{t('caja.cashEstimate')}</div>
                  <div className="text-3xl font-mono font-bold text-white mt-1">{formatCurrency(saldoEfectivoEstimado)}</div>
                </div>
                <DollarSign size={48} className="text-green-700" />
              </div>

              {/* Ventas por método */}
              {Object.keys(totalesPorMetodo).length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-3">{t('caja.byMethod')}</h3>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    {Object.entries(totalesPorMetodo).map(([metodo, total]) => (
                      <div key={metodo} className="bg-slate-800 border border-slate-700 rounded-lg p-3 flex items-center gap-3">
                        <div className="text-slate-400">{METODO_ICONS[metodo] || <DollarSign size={14} />}</div>
                        <div>
                          <div className="text-xs text-slate-500 capitalize">{metodo}</div>
                          <div className="font-mono font-bold text-white">{formatCurrency(total)}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Tabla de movimientos */}
              <div>
                <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                  <FileText size={14} /> {t('caja.movements')}
                </h3>
                <div className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-slate-700">
                        <th className="table-header">{t('caja.col.time')}</th>
                        <th className="table-header">{t('caja.col.type')}</th>
                          <th className="table-header">{t('caja.col.desc')}</th>
                          <th className="table-header">{t('caja.col.method')}</th>
                          <th className="table-header text-right">{t('caja.col.amount')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {movimientos.length === 0 ? (
                        <tr><td colSpan={6} className="text-center py-6 text-slate-500">{t('caja.noMovements')}</td></tr>
                      ) : movimientos.map((m) => (
                        <tr key={m.id} className="table-row">
                          <td className="table-cell text-xs text-slate-400">{new Date(m.fecha).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}</td>
                          <td className="table-cell">
                            <span className={`text-xs font-semibold capitalize ${m.tipo === 'ingreso' ? 'text-green-400' : 'text-red-400'}`}>
                              {m.venta_numero ? `Venta #${m.venta_numero}` : m.tipo}
                            </span>
                          </td>
                          <td className="table-cell text-sm text-slate-300">{m.descripcion}</td>
                          <td className="table-cell text-sm text-slate-400 capitalize">{m.metodo_pago}</td>
                          <td className={`table-cell text-right font-mono font-bold ${m.tipo === 'egreso' ? 'text-red-400' : 'text-green-400'}`}>
                            {m.tipo === 'egreso' ? '-' : '+'}{formatCurrency(m.monto)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {tab === 'historico' && (
        <div className="flex-1 overflow-auto px-6 py-4 pb-6">
          <div className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-700">
                  <th className="table-header">{t('caja.col.opening')}</th>
                  <th className="table-header">{t('caja.col.closing')}</th>
                  <th className="table-header">{t('caja.col.cashier')}</th>
                  <th className="table-header text-right">{t('caja.initialBalance')}</th>
                  <th className="table-header text-right">{t('caja.totalSales')}</th>
                  <th className="table-header text-right">{t('caja.expenses')}</th>
                  <th className="table-header text-right">{t('caja.col.finalBalance')}</th>
                </tr>
              </thead>
              <tbody>
                {historico.map((s) => (
                  <tr key={s.id} className="table-row">
                    <td className="table-cell text-xs text-slate-400">{formatDate(s.fecha_apertura)}</td>
                    <td className="table-cell text-xs text-slate-400">{s.fecha_cierre ? formatDate(s.fecha_cierre) : <span className="badge badge-green text-[10px]">Abierta</span>}</td>
                    <td className="table-cell text-sm text-slate-300">{s.usuario_nombre}</td>
                    <td className="table-cell text-right font-mono text-slate-400">{formatCurrency(s.saldo_inicial)}</td>
                    <td className="table-cell text-right font-mono text-green-400">{formatCurrency(s.total_ventas)}</td>
                    <td className="table-cell text-right font-mono text-red-400">{formatCurrency(s.total_egresos)}</td>
                    <td className="table-cell text-right font-mono font-bold text-white">{s.saldo_final !== null ? formatCurrency(s.saldo_final) : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modal abrir caja */}
      <Modal isOpen={showAbrirModal} onClose={() => setShowAbrirModal(false)} title={t('caja.openAction')} size="sm"
        footer={<><button className="btn-secondary btn" onClick={() => setShowAbrirModal(false)}>{t('common.cancel')}</button><button className="btn-success btn" onClick={handleAbrir}><Play size={16} /> {t('caja.openAction')}</button></>}
      >
        <div className="space-y-4">
          <div>
            <label className="label">{t('caja.initialCash')}</label>
            <input className="input font-mono text-right text-xl" type="number" step="0.01" min="0" value={saldoInicial} onChange={(e) => setSaldoInicial(e.target.value)} placeholder="0.00" autoFocus />
          </div>
          <p className="text-xs text-slate-500">{t('caja.countCash')}</p>
        </div>
      </Modal>

      {/* Modal cerrar caja */}
      <Modal isOpen={showCerrarModal} onClose={() => setShowCerrarModal(false)} title={t('caja.closeAction')} size="sm"
        footer={<><button className="btn-secondary btn" onClick={() => setShowCerrarModal(false)}>{t('common.cancel')}</button><button className="btn-danger btn" onClick={handleCerrar}><StopCircle size={16} /> {t('caja.closeAction')}</button></>}
      >
        <div className="space-y-4">
          {sesionActiva && (
            <div className="bg-slate-700/50 rounded-lg p-4 text-sm space-y-2">
              <div className="flex justify-between">
                <span className="text-slate-400">{t('caja.totalSalesLabel')}</span>
                <span className="font-mono text-green-400 font-bold">{formatCurrency(sesionActiva.total_ventas)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">{t('caja.cashEstimateLabel')}</span>
                <span className="font-mono text-white font-bold">{formatCurrency(saldoEfectivoEstimado)}</span>
              </div>
            </div>
          )}
          <div>
            <label className="label">{t('caja.physicalBalance')}</label>
            <input className="input font-mono text-right text-xl" type="number" step="0.01" min="0" value={saldoFinal} onChange={(e) => setSaldoFinal(e.target.value)} placeholder="0.00" autoFocus />
          </div>
          {saldoFinal && (
            <div className={`text-sm ${Math.abs(parseFloat(saldoFinal) - saldoEfectivoEstimado) > 1 ? 'text-yellow-400' : 'text-green-400'}`}>
              {t('caja.difference')} {formatCurrency(parseFloat(saldoFinal) - saldoEfectivoEstimado)}
            </div>
          )}
        </div>
      </Modal>

      {/* Modal movimiento */}
      <Modal isOpen={showMovimientoModal} onClose={() => setShowMovimientoModal(false)}
        title={tipoMovimiento === 'ingreso' ? t('caja.incomeTitle') : t('caja.expenseTitle')} size="sm"
        footer={<><button className="btn-secondary btn" onClick={() => setShowMovimientoModal(false)}>{t('common.cancel')}</button><button className="btn-primary btn" onClick={handleMovimiento}><Check size={16} /> {t('common.save').split(' ')[0]}</button></>}
      >
        <div className="space-y-4">
          <div>
            <label className="label">{t('caja.concept')}</label>
            <input className="input" value={movConcepto} onChange={(e) => setMovConcepto(e.target.value)} placeholder={tipoMovimiento === 'ingreso' ? 'Ej: Préstamo, cobro extra...' : 'Ej: Pago proveedor, gastos...'} autoFocus />
          </div>
          <div>
            <label className="label">Monto *</label>
            <input className="input font-mono text-right text-xl" type="number" step="0.01" min="0.01" value={movMonto} onChange={(e) => setMovMonto(e.target.value)} placeholder="0.00" />
          </div>
          <div>
            <label className="label">{t('caja.payMethod')}</label>
            <select className="input" value={movMetodo} onChange={(e) => setMovMetodo(e.target.value)}>
              <option value="efectivo">{t('hist.method.cash')}</option>
              <option value="tarjeta">{t('hist.method.card')}</option>
              <option value="transferencia">{t('hist.method.transfer')}</option>
            </select>
          </div>
        </div>
      </Modal>
    </div>
  );
};
