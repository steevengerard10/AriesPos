import React, { useState, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Warehouse, Search, Plus, RefreshCw, TrendingUp, TrendingDown,
  AlertCircle, ArrowUp, ArrowDown, X, Check
} from 'lucide-react';
import toast from 'react-hot-toast';
import { stockAPI, productosAPI } from '../../lib/api';
import { Modal } from '../../components/shared/Modal';
import { formatCurrency, formatDate } from '../../lib/utils';

interface Movimiento {
  id: number;
  producto_id: number;
  producto_nombre: string;
  tipo: 'entrada' | 'salida' | 'ajuste' | 'venta' | 'devolucion';
  cantidad: number;
  stock_previo: number;
  stock_nuevo: number;
  costo_unitario: number;
  motivo: string;
  usuario_nombre: string;
  fecha: string;
}

interface ProductoStock {
  id: number;
  nombre: string;
  codigo: string;
  stock_actual: number;
  stock_minimo: number;
  unidad_medida: string;
  precio_costo: number;
  categoria_nombre: string;
}

const TIPO_LABELS: Record<string, string> = {
  entrada: 'Entrada',
  salida: 'Salida',
  ajuste: 'Ajuste',
  venta: 'Venta',
  devolucion: 'Devolución',
};

const TIPO_COLORS: Record<string, string> = {
  entrada: 'text-green-400',
  salida: 'text-red-400',
  ajuste: 'text-yellow-400',
  venta: 'text-blue-400',
  devolucion: 'text-purple-400',
};

export const StockModule: React.FC = () => {
  const { t } = useTranslation();
  const [tab, setTab] = useState<'inventario' | 'movimientos'>('inventario');
  const [productos, setProductos] = useState<ProductoStock[]>([]);
  const [movimientos, setMovimientos] = useState<Movimiento[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [stockBajoOnly, setStockBajoOnly] = useState(false);
  const [showAjuste, setShowAjuste] = useState(false);
  const [ajusteData, setAjusteData] = useState({
    producto_id: '',
    tipo: 'entrada' as 'entrada' | 'salida' | 'ajuste',
    cantidad: '',
    costo_unitario: '',
    motivo: '',
  });
  const [prodSearch, setProdSearch] = useState('');
  const [prodSearchResults, setProdSearchResults] = useState<ProductoStock[]>([]);
  const [selectedProd, setSelectedProd] = useState<ProductoStock | null>(null);

  const loadData = async () => {
    setLoading(true);
    try {
      const [movs] = await Promise.all([
        stockAPI.getMovimientos() as Promise<Movimiento[]>,
      ]);
      setMovimientos(movs);
      // Cargar productos actualizados
      const prodsResult = await productosAPI.getAll({ activo: true, limit: 5000 }) as { rows: ProductoStock[]; total: number };
      setProductos(prodsResult.rows);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); }, []);

  const filteredProductos = useMemo(() => {
    let list = productos;
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter((p) => p.nombre.toLowerCase().includes(q) || p.codigo.toLowerCase().includes(q));
    }
    if (stockBajoOnly) {
      list = list.filter((p) => p.stock_actual <= p.stock_minimo);
    }
    return list;
  }, [productos, search, stockBajoOnly]);

  const stockBajoCount = useMemo(() => productos.filter((p) => p.stock_actual <= p.stock_minimo).length, [productos]);
  const valorTotal = useMemo(() => productos.reduce((s, p) => s + p.stock_actual * p.precio_costo, 0), [productos]);

  const handleProdSearch = (q: string) => {
    setProdSearch(q);
    if (q.length >= 2) {
      const res = productos.filter((p) => p.nombre.toLowerCase().includes(q.toLowerCase()) || p.codigo.toLowerCase().includes(q.toLowerCase())).slice(0, 8);
      setProdSearchResults(res);
    } else {
      setProdSearchResults([]);
    }
  };

  const selectProd = (p: ProductoStock) => {
    setSelectedProd(p);
    setProdSearch(p.nombre);
    setProdSearchResults([]);
    setAjusteData((prev) => ({ ...prev, producto_id: String(p.id), costo_unitario: String(p.precio_costo) }));
  };

  const handleAjuste = async () => {
    if (!ajusteData.producto_id) { toast.error(t('stock.selectProduct')); return; }
    const cantidad = parseFloat(ajusteData.cantidad);
    if (!cantidad || cantidad <= 0) { toast.error(t('stock.invalidQty')); return; }

    try {
      await stockAPI.ajuste({
        producto_id: parseInt(ajusteData.producto_id),
        tipo: ajusteData.tipo,
        cantidad,
        costo_unitario: parseFloat(ajusteData.costo_unitario) || 0,
        motivo: ajusteData.motivo || `Ajuste manual ${ajusteData.tipo}`,
      });
      toast.success(t('stock.moveOk'));
      setShowAjuste(false);
      setAjusteData({ producto_id: '', tipo: 'entrada', cantidad: '', costo_unitario: '', motivo: '' });
      setSelectedProd(null);
      setProdSearch('');
      loadData();
    } catch {
      toast.error(t('stock.moveError'));
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="shrink-0 module-header px-6 pt-6">
        <div>
          <h1 className="module-title flex items-center gap-3"><Warehouse size={28} className="text-blue-400" /> {t('stock.title')}</h1>
          <div className="flex gap-4 text-sm text-slate-400 mt-1">
            <span>{t('stock.totalValue')} <span className="text-white font-semibold">{formatCurrency(valorTotal)}</span></span>
            {stockBajoCount > 0 && (
              <span className="text-red-400 flex items-center gap-1"><AlertCircle size={14} /> {stockBajoCount} {t('stock.lowAlert')}</span>
            )}
          </div>
        </div>
        <button className="btn-primary btn" onClick={() => setShowAjuste(true)}>
          <Plus size={16} /> {t('stock.adjust')}
        </button>
      </div>

      {/* Tabs */}
      <div className="shrink-0 px-6 pb-0 flex gap-1 border-b border-slate-700">
        <button
          onClick={() => setTab('inventario')}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${tab === 'inventario' ? 'border-blue-500 text-white' : 'border-transparent text-slate-400 hover:text-white'}`}
        >
          {t('stock.tabInventory')}
        </button>
        <button
          onClick={() => setTab('movimientos')}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${tab === 'movimientos' ? 'border-blue-500 text-white' : 'border-transparent text-slate-400 hover:text-white'}`}
        >
          {t('stock.tabMoves')}
        </button>
      </div>

      {tab === 'inventario' && (
        <>
          {/* Filtros inventario */}
          <div className="shrink-0 px-6 py-4 flex items-center gap-3">
            <div className="relative flex-1">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input type="text" placeholder={t('stock.search')} value={search} onChange={(e) => setSearch(e.target.value)} className="input pl-9 text-sm" />
            </div>
            <label className="flex items-center gap-2 text-sm text-slate-400 cursor-pointer">
              <input type="checkbox" checked={stockBajoOnly} onChange={(e) => setStockBajoOnly(e.target.checked)} className="rounded" />
              <AlertCircle size={14} className="text-red-400" /> {t('stock.lowOnly')}
            </label>
            <button className="btn-ghost btn p-2" onClick={loadData}><RefreshCw size={16} /></button>
          </div>

          {/* Tabla inventario */}
          <div className="flex-1 overflow-auto px-6 pb-6">
            <div className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden" style={{ maxHeight: 'calc(100vh - 340px)', display: 'flex', flexDirection: 'column' }}>
              <table className="w-full">
                <thead style={{ position: 'sticky', top: 0, zIndex: 10, background: 'var(--bg2)' }}>
                  <tr className="border-b border-slate-700">
                    <th className="table-header">{t('stock.col.product')}</th>
                    <th className="table-header">{t('stock.col.category')}</th>
                    <th className="table-header text-right">{t('stock.col.current')}</th>
                    <th className="table-header text-right">{t('stock.col.min')}</th>
                    <th className="table-header text-right">{t('stock.col.cost')}</th>
                    <th className="table-header text-right">{t('stock.col.value')}</th>
                    <th className="table-header text-center">{t('stock.col.status')}</th>
                  </tr>
                </thead>
                <tbody style={{ overflowY: 'auto', display: 'block', maxHeight: 'calc(100vh - 400px)' }}>
                  {loading ? (
                    <tr><td colSpan={7} className="text-center py-8 text-slate-400">Cargando...</td></tr>
                  ) : filteredProductos.length === 0 ? (
                    <tr><td colSpan={7} className="text-center py-8 text-slate-500">{t('stock.noResults')}</td></tr>
                  ) : filteredProductos.map((p) => {
                    const bajStock = p.stock_actual <= p.stock_minimo;
                    return (
                      <tr key={p.id} className="table-row">
                        <td className="table-cell">
                          <div className="font-medium text-white">{p.nombre}</div>
                          <div className="text-xs font-mono text-slate-500">{p.codigo}</div>
                        </td>
                        <td className="table-cell text-sm text-slate-400">{p.categoria_nombre || '—'}</td>
                        <td className={`table-cell text-right font-mono font-bold ${bajStock ? 'text-red-400' : 'text-white'}`}>
                          {p.stock_actual} {p.unidad_medida}
                        </td>
                        <td className="table-cell text-right font-mono text-slate-400">{p.stock_minimo} {p.unidad_medida}</td>
                        <td className="table-cell text-right font-mono text-slate-400">{formatCurrency(p.precio_costo)}</td>
                        <td className="table-cell text-right font-mono text-white">{formatCurrency(p.stock_actual * p.precio_costo)}</td>
                        <td className="table-cell text-center">
                          {bajStock ? (
                            <span className="badge badge-red flex items-center gap-1 justify-center">
                              <AlertCircle size={11} /> {t('stock.statusLow')}
                            </span>
                          ) : (
                            <span className="badge badge-green flex items-center gap-1 justify-center">
                              <Check size={11} /> {t('stock.statusOk')}
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {tab === 'movimientos' && (
        <div className="flex-1 overflow-auto px-6 py-4 pb-6">
          <div className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden" style={{ maxHeight: 'calc(100vh - 280px)', display: 'flex', flexDirection: 'column' }}>
            <table className="w-full">
              <thead style={{ position: 'sticky', top: 0, zIndex: 10, background: 'var(--bg2)' }}>
                <tr className="border-b border-slate-700">
                  <th className="table-header">{t('stock.col.date')}</th>
                  <th className="table-header">{t('stock.col.product')}</th>
                  <th className="table-header text-center">{t('stock.col.type')}</th>
                  <th className="table-header text-right">{t('stock.col.qty')}</th>
                  <th className="table-header text-center">{t('stock.col.before')}</th>
                  <th className="table-header">{t('stock.col.reason')}</th>
                  <th className="table-header">{t('stock.col.user')}</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={7} className="text-center py-8 text-slate-400">Cargando...</td></tr>
                ) : movimientos.length === 0 ? (
                  <tr><td colSpan={7} className="text-center py-8 text-slate-500">{t('stock.noMoves')}</td></tr>
                ) : movimientos.map((m) => (
                  <tr key={m.id} className="table-row">
                    <td className="table-cell text-xs text-slate-400">{formatDate(m.fecha)}</td>
                    <td className="table-cell text-sm text-white">{m.producto_nombre}</td>
                    <td className="table-cell text-center">
                      <span className={`text-xs font-semibold flex items-center justify-center gap-1 ${TIPO_COLORS[m.tipo]}`}>
                        {m.tipo === 'entrada' || m.tipo === 'devolucion' ? <ArrowUp size={12} /> : <ArrowDown size={12} />}
                        {TIPO_LABELS[m.tipo]}
                      </span>
                    </td>
                    <td className={`table-cell text-right font-mono font-bold ${TIPO_COLORS[m.tipo]}`}>
                      {m.tipo === 'entrada' || m.tipo === 'devolucion' ? '+' : '-'}{m.cantidad}
                    </td>
                    <td className="table-cell text-center font-mono text-xs text-slate-400">
                      {m.stock_previo} → <span className="text-white">{m.stock_nuevo}</span>
                    </td>
                    <td className="table-cell text-sm text-slate-400 max-w-xs truncate">{m.motivo}</td>
                    <td className="table-cell text-xs text-slate-500">{m.usuario_nombre}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modal ajuste de stock */}
      <Modal isOpen={showAjuste} onClose={() => setShowAjuste(false)} title={t('stock.adjustTitle')} size="md"
        footer={
          <>
            <button className="btn-secondary btn" onClick={() => setShowAjuste(false)}>Cancelar</button>
            <button className="btn-primary btn" onClick={handleAjuste}><Check size={16} /> {t('common.add')}</button>
          </>
        }
      >
        <div className="space-y-4">
          <div className="relative">
            <label className="label">{t('stock.productLabel')}</label>
            <input
              className="input"
              value={prodSearch}
              onChange={(e) => handleProdSearch(e.target.value)}
              placeholder={t('stock.productSearch')}
              autoFocus
            />
            {prodSearchResults.length > 0 && (
              <div className="absolute z-10 w-full bg-slate-700 border border-slate-600 rounded-lg mt-1 shadow-xl max-h-48 overflow-auto">
                {prodSearchResults.map((p) => (
                  <button key={p.id} className="w-full text-left px-3 py-2 hover:bg-slate-600 text-sm" onClick={() => selectProd(p)}>
                    <span className="text-white">{p.nombre}</span>
                    <span className="text-slate-400 ml-2 text-xs">Stock: {p.stock_actual}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {selectedProd && (
            <div className="bg-slate-700/50 rounded-lg p-3 text-sm">
              <span className="text-slate-400">{t('stock.currentStock')} </span>
              <span className="font-mono font-bold text-white">{selectedProd.stock_actual} {selectedProd.unidad_medida}</span>
            </div>
          )}

          <div>
            <label className="label">{t('stock.moveType')}</label>
            <div className="grid grid-cols-3 gap-2">
              {(['entrada', 'salida', 'ajuste'] as const).map((tipo) => (
                <button
                  key={tipo}
                  onClick={() => setAjusteData((prev) => ({ ...prev, tipo }))}
                  className={`py-2 rounded-lg text-sm font-medium border transition-all ${
                    ajusteData.tipo === tipo
                      ? tipo === 'entrada' ? 'bg-green-600 border-green-500 text-white' : tipo === 'salida' ? 'bg-red-600 border-red-500 text-white' : 'bg-yellow-600 border-yellow-500 text-white'
                      : 'bg-slate-700 border-slate-600 text-slate-400 hover:border-slate-500'
                  }`}
                >
                  {tipo === 'entrada' ? <><TrendingUp className="inline mr-1 w-3 h-3" /> {t('stock.entrada')}</> : tipo === 'salida' ? <><TrendingDown className="inline mr-1 w-3 h-3" /> {t('stock.salida')}</> : t('stock.ajuste')}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">{t('stock.qtyLabel')}</label>
              <input className="input font-mono text-right" type="number" step="0.01" min="0.01" value={ajusteData.cantidad} onChange={(e) => setAjusteData({ ...ajusteData, cantidad: e.target.value })} />
            </div>
            <div>
              <label className="label">{t('stock.costLabel')}</label>
              <input className="input font-mono text-right" type="number" step="0.01" min="0" value={ajusteData.costo_unitario} onChange={(e) => setAjusteData({ ...ajusteData, costo_unitario: e.target.value })} />
            </div>
          </div>

          <div>
            <label className="label">{t('stock.reasonLabel')}</label>
            <input className="input" value={ajusteData.motivo} onChange={(e) => setAjusteData({ ...ajusteData, motivo: e.target.value })} placeholder={t('stock.reasonPlaceholder')} />
          </div>

          {selectedProd && ajusteData.cantidad && (
            <div className="bg-slate-700/50 rounded-lg p-3 text-sm">
              <span className="text-slate-400">{t('stock.resultStock')} </span>
              <span className="font-mono font-bold text-white">
                {ajusteData.tipo === 'entrada'
                  ? selectedProd.stock_actual + parseFloat(ajusteData.cantidad || '0')
                  : ajusteData.tipo === 'salida'
                  ? selectedProd.stock_actual - parseFloat(ajusteData.cantidad || '0')
                  : parseFloat(ajusteData.cantidad || '0')
                } {selectedProd.unidad_medida}
              </span>
            </div>
          )}
        </div>
      </Modal>
    </div>
  );
};
