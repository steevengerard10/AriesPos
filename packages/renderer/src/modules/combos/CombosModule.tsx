import React, { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Plus, Edit, Trash2, Layers, Search, X, Check, Package, RefreshCw } from 'lucide-react';
import toast from 'react-hot-toast';
import { combosAPI, productosAPI } from '../../lib/api';
import { formatCurrency } from '../../lib/utils';
import { ConfirmDialog } from '../../components/shared/Modal';

interface ComboItem {
  producto_id: number;
  producto_nombre: string;
  producto_codigo: string;
  precio_lista: number;
  cantidad: number;
  precio_unitario: number;
}

interface Combo {
  id: number;
  nombre: string;
  descripcion: string;
  precio: number;
  activo: boolean;
  items_count: number;
}

interface ComboFull extends Combo {
  items: ComboItem[];
}

interface Producto {
  id: number;
  nombre: string;
  codigo: string;
  precio_venta: number;
}

const defaultForm = { nombre: '', descripcion: '', precio: 0, activo: true };

export const CombosModule: React.FC = () => {
  const { t } = useTranslation();
  const [combos, setCombos] = useState<Combo[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [formData, setFormData] = useState(defaultForm);
  const [formItems, setFormItems] = useState<ComboItem[]>([]);
  const [confirmDelete, setConfirmDelete] = useState<number | null>(null);

  const [prodSearch, setProdSearch] = useState('');
  const [prodResults, setProdResults] = useState<Producto[]>([]);
  const [showDrop, setShowDrop] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);
  const dropRef = useRef<HTMLDivElement>(null);

  const loadCombos = async () => {
    setLoading(true);
    try {
      setCombos(await combosAPI.getAll() as Combo[]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadCombos(); }, []);

  useEffect(() => {
    if (!prodSearch.trim()) { setProdResults([]); setShowDrop(false); return; }
    const timer = setTimeout(async () => {
      const data = await productosAPI.search(prodSearch) as Producto[];
      setProdResults(data.slice(0, 12));
      setShowDrop(data.length > 0);
    }, 200);
    return () => clearTimeout(timer);
  }, [prodSearch]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropRef.current && !dropRef.current.contains(e.target as Node) &&
          searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setShowDrop(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const openNew = () => {
    setFormData(defaultForm);
    setFormItems([]);
    setEditingId(null);
    setProdSearch('');
    setShowForm(true);
  };

  const openEdit = async (combo: Combo) => {
    try {
      const full = await combosAPI.getById(combo.id) as ComboFull;
      setFormData({ nombre: full.nombre, descripcion: full.descripcion, precio: full.precio, activo: full.activo });
      setFormItems(full.items || []);
      setEditingId(combo.id);
      setProdSearch('');
      setShowForm(true);
    } catch {
      toast.error(t('combo.saveError'));
    }
  };

  const addProduct = (p: Producto) => {
    const existing = formItems.find(i => i.producto_id === p.id);
    if (existing) {
      setFormItems(prev => prev.map(i => i.producto_id === p.id ? { ...i, cantidad: i.cantidad + 1 } : i));
    } else {
      setFormItems(prev => [...prev, {
        producto_id: p.id,
        producto_nombre: p.nombre,
        producto_codigo: p.codigo,
        precio_lista: p.precio_venta,
        cantidad: 1,
        precio_unitario: p.precio_venta,
      }]);
    }
    setProdSearch('');
    setShowDrop(false);
    searchRef.current?.focus();
  };

  const removeItem = (idx: number) => setFormItems(prev => prev.filter((_, i) => i !== idx));

  const updateItem = (idx: number, field: 'cantidad' | 'precio_unitario', value: number) =>
    setFormItems(prev => prev.map((item, i) => i === idx ? { ...item, [field]: value } : item));

  const calcTotal = () => formItems.reduce((sum, i) => sum + i.cantidad * i.precio_unitario, 0);

  const handleSave = async () => {
    if (!formData.nombre.trim()) { toast.error(t('combo.nameRequired')); return; }
    try {
      const payload = {
        ...formData,
        precio: formData.precio > 0 ? formData.precio : calcTotal(),
        items: formItems.map(i => ({ producto_id: i.producto_id, cantidad: i.cantidad, precio_unitario: i.precio_unitario })),
      };
      if (editingId) {
        await combosAPI.update(editingId, payload as unknown as Record<string, unknown>);
        toast.success(t('combo.updated'));
      } else {
        await combosAPI.create(payload as unknown as Record<string, unknown>);
        toast.success(t('combo.created'));
      }
      setShowForm(false);
      loadCombos();
    } catch {
      toast.error(t('combo.saveError'));
    }
  };

  const handleDelete = async (id: number) => {
    await combosAPI.delete(id);
    toast.success(t('combo.deleted'));
    setConfirmDelete(null);
    loadCombos();
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="shrink-0 module-header px-6 pt-6">
        <div>
          <h1 className="module-title flex items-center gap-3">
            <Layers size={28} className="text-purple-400" /> {t('combo.title')}
          </h1>
          <p className="text-sm text-slate-400 mt-1">{t('combo.count', { n: combos.length })}</p>
        </div>
        <div className="flex items-center gap-2">
          <button className="btn-ghost btn p-2" onClick={loadCombos}><RefreshCw size={16} /></button>
          <button className="btn-primary btn" onClick={openNew}><Plus size={16} /> {t('combo.new')}</button>
        </div>
      </div>

      {/* List */}
      <div className="flex-1 overflow-auto px-6 pb-6">
        {loading ? (
          <div className="flex items-center justify-center h-32 text-slate-400">{t('common.loading')}</div>
        ) : combos.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-40 text-slate-500 gap-2">
            <Layers size={44} className="opacity-30" />
            <p>{t('combo.empty')}</p>
            <button className="btn-primary btn btn-sm mt-2" onClick={openNew}><Plus size={14} /> {t('combo.new')}</button>
          </div>
        ) : (
          <div className="bg-slate-800 rounded-xl overflow-hidden border border-slate-700">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-700">
                  <th className="table-header">{t('combo.col.name')}</th>
                  <th className="table-header">{t('combo.col.desc')}</th>
                  <th className="table-header text-center">{t('combo.col.items')}</th>
                  <th className="table-header text-right">{t('combo.col.price')}</th>
                  <th className="table-header text-center">Estado</th>
                  <th className="table-header w-20"></th>
                </tr>
              </thead>
              <tbody>
                {combos.map((c) => (
                  <tr key={c.id} className={`table-row ${!c.activo ? 'opacity-50' : ''}`}>
                    <td className="table-cell font-medium text-white">{c.nombre}</td>
                    <td className="table-cell text-slate-400 text-xs">{c.descripcion}</td>
                    <td className="table-cell text-center">
                      <span className="badge badge-blue">{c.items_count} {t('combo.items')}</span>
                    </td>
                    <td className="table-cell text-right font-mono font-bold text-green-400">
                      {formatCurrency(c.precio)}
                    </td>
                    <td className="table-cell text-center">
                      {c.activo
                        ? <span className="badge badge-green">Activo</span>
                        : <span className="badge badge-gray">Inactivo</span>}
                    </td>
                    <td className="table-cell">
                      <div className="flex gap-1">
                        <button onClick={() => openEdit(c)} className="btn-ghost btn p-1.5"><Edit size={13} /></button>
                        <button onClick={() => setConfirmDelete(c.id)} className="btn-ghost btn p-1.5 hover:text-red-400"><Trash2 size={13} /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Fullscreen form */}
      {showForm && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 9999, background: 'var(--bg)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          {/* Form header */}
          <div style={{ borderBottom: '1px solid var(--border)', background: 'var(--bg2)' }} className="flex items-center justify-between px-8 py-4 shrink-0">
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <Layers size={20} className="text-purple-400" />
              {editingId ? t('combo.editTitle') : t('combo.newTitle')}
            </h2>
            <div className="flex items-center gap-3">
              <button className="btn-secondary btn" onClick={() => { setShowForm(false); setProdSearch(''); }}>{t('common.cancel')}</button>
              <button className="btn-primary btn" onClick={handleSave}><Check size={16} /> {t('common.save')}</button>
            </div>
          </div>

          {/* Form content */}
          <div className="flex-1 overflow-y-auto p-8">
            <div className="max-w-5xl mx-auto flex flex-col gap-6">

              {/* Info general */}
              <div className="card">
                <h3 className="font-semibold text-white mb-4 text-sm uppercase tracking-wider" style={{ color: 'var(--text2)' }}>Información general</h3>
                <div className="grid grid-cols-3 gap-4">
                  <div className="col-span-2">
                    <label className="label">{t('combo.form.name')}</label>
                    <input
                      className="input"
                      value={formData.nombre}
                      onChange={(e) => setFormData({ ...formData, nombre: e.target.value })}
                      placeholder={t('combo.form.namePh')}
                      autoFocus
                    />
                  </div>
                  <div>
                    <label className="label">{t('combo.form.price')}</label>
                    <input
                      className="input font-mono text-right"
                      type="number" step="0.01" min="0"
                      value={formData.precio || ''}
                      onChange={(e) => setFormData({ ...formData, precio: parseFloat(e.target.value) || 0 })}
                      placeholder="0.00"
                    />
                    <p className="text-xs text-slate-500 mt-1">
                      {t('combo.form.itemsTotal')}: <span className="text-green-400 font-mono">{formatCurrency(calcTotal())}</span>
                      {formData.precio === 0 && formItems.length > 0 && <span className="text-slate-500"> (se usa este)</span>}
                    </p>
                  </div>
                  <div className="col-span-2">
                    <label className="label">{t('combo.form.desc')}</label>
                    <input
                      className="input"
                      value={formData.descripcion}
                      onChange={(e) => setFormData({ ...formData, descripcion: e.target.value })}
                      placeholder={t('combo.form.descPh')}
                    />
                  </div>
                  <div className="flex items-end pb-1">
                    <label className="flex items-center gap-2 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={formData.activo}
                        onChange={(e) => setFormData({ ...formData, activo: e.target.checked })}
                        className="w-4 h-4 rounded"
                      />
                      <span className="text-sm text-slate-300">{t('combo.form.active')}</span>
                    </label>
                  </div>
                </div>
              </div>

              {/* Productos del combo */}
              <div className="card">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-semibold text-white">{t('combo.form.items')}</h3>
                  {formItems.length > 0 && (
                    <span className="text-sm text-slate-400">
                      Total ítems: <span className="text-green-400 font-mono font-bold">{formatCurrency(calcTotal())}</span>
                    </span>
                  )}
                </div>

                {/* Buscador de productos */}
                <div className="relative mb-4">
                  <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    ref={searchRef}
                    type="text"
                    className="input pl-9 text-sm"
                    placeholder={t('combo.form.searchPh')}
                    value={prodSearch}
                    onChange={(e) => setProdSearch(e.target.value)}
                    onFocus={() => prodSearch.trim() && prodResults.length > 0 && setShowDrop(true)}
                  />
                  {showDrop && (
                    <div
                      ref={dropRef}
                      className="absolute left-0 right-0 top-full mt-1 rounded-lg border border-slate-700 shadow-xl overflow-hidden"
                      style={{ background: 'var(--bg2)', zIndex: 100, maxHeight: 240, overflowY: 'auto' }}
                    >
                      {prodResults.map((p) => (
                        <button
                          key={p.id}
                          type="button"
                          className="w-full text-left px-4 py-2.5 hover:bg-slate-700 transition-colors border-b border-slate-700/50 last:border-0"
                          onClick={() => addProduct(p)}
                        >
                          <div className="flex items-center justify-between">
                            <div>
                              <span className="text-sm font-medium text-white">{p.nombre}</span>
                              <span className="text-xs text-slate-400 ml-2 font-mono">{p.codigo}</span>
                            </div>
                            <span className="font-mono text-green-400 text-sm font-bold">{formatCurrency(p.precio_venta)}</span>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Tabla de ítems */}
                {formItems.length === 0 ? (
                  <div className="text-center py-10 text-slate-500">
                    <Package size={40} className="mx-auto mb-2 opacity-30" />
                    <p className="text-sm">{t('combo.form.emptyItems')}</p>
                  </div>
                ) : (
                  <div className="overflow-hidden rounded-lg border border-slate-700" style={{ maxHeight: 'calc(100vh - 420px)', display: 'flex', flexDirection: 'column' }}>
                    <table className="w-full">
                      <thead style={{ position: 'sticky', top: 0, zIndex: 10 }}>
                        <tr className="border-b border-slate-700" style={{ background: 'var(--bg2)' }}>
                          <th className="table-header">Producto</th>
                          <th className="table-header w-28 text-right">{t('combo.form.qty')}</th>
                          <th className="table-header w-36 text-right">{t('combo.form.unitPrice')}</th>
                          <th className="table-header w-32 text-right">{t('combo.form.subtotal')}</th>
                          <th className="table-header w-12"></th>
                        </tr>
                      </thead>
                      <tbody style={{ overflowY: 'auto', display: 'block', maxHeight: 'calc(100vh - 520px)' }}>
                        {formItems.map((item, idx) => (
                          <tr key={idx} className="table-row">
                            <td className="table-cell">
                              <div className="font-medium text-white text-sm">{item.producto_nombre}</div>
                              <div className="text-xs font-mono text-slate-400">{item.producto_codigo}</div>
                              {item.precio_unitario !== item.precio_lista && item.precio_lista > 0 && (
                                <div className="text-xs text-indigo-400 mt-0.5">
                                  Precio lista: {formatCurrency(item.precio_lista)}
                                </div>
                              )}
                            </td>
                            <td className="table-cell text-right">
                              <input
                                type="number" step="0.01" min="0.01"
                                value={item.cantidad}
                                onChange={(e) => updateItem(idx, 'cantidad', parseFloat(e.target.value) || 1)}
                                className="input text-right font-mono text-sm w-20 ml-auto"
                              />
                            </td>
                            <td className="table-cell text-right">
                              <input
                                type="number" step="0.01" min="0"
                                value={item.precio_unitario}
                                onChange={(e) => updateItem(idx, 'precio_unitario', parseFloat(e.target.value) || 0)}
                                className="input text-right font-mono text-sm w-28 ml-auto"
                              />
                            </td>
                            <td className="table-cell text-right font-mono font-bold text-green-400">
                              {formatCurrency(item.cantidad * item.precio_unitario)}
                            </td>
                            <td className="table-cell text-center">
                              <button
                                type="button"
                                onClick={() => removeItem(idx)}
                                className="btn-ghost btn p-1.5 hover:text-red-400"
                                title="Quitar del combo"
                              >
                                <X size={14} />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot>
                        <tr style={{ background: 'var(--bg3)', borderTop: '2px solid var(--border)' }}>
                          <td colSpan={3} className="px-3 py-3 text-right text-sm font-semibold" style={{ color: 'var(--text2)' }}>
                            Total del combo:
                          </td>
                          <td className="px-3 py-3 text-right font-mono font-bold text-green-400 text-base">
                            {formatCurrency(calcTotal())}
                          </td>
                          <td />
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      <ConfirmDialog
        isOpen={confirmDelete !== null}
        title={t('combo.deleteTitle')}
        message={t('combo.deleteMsg')}
        onConfirm={() => confirmDelete !== null && handleDelete(confirmDelete)}
        onCancel={() => setConfirmDelete(null)}
      />
    </div>
  );
};
