import React, { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Plus, Search, Grid, List, Upload, Download, Edit, Trash2,
  Package, Tag, BarChart2, RefreshCw, Image, X, Check, AlertCircle, FileText, Globe, Loader2
} from 'lucide-react';
import toast from 'react-hot-toast';
import { productosAPI, categoriasAPI, appAPI } from '../../lib/api';
import { useProductosStore } from '../../store/useProductosStore';
import { Modal, ConfirmDialog } from '../../components/shared/Modal';
import { ImportNextarModal } from '../../components/modals/ImportNextarModal';
import { BusquedaWebModal } from '../../components/modals/BusquedaWebModal';
import { formatCurrency, downloadCSV } from '../../lib/utils';

interface Producto {
  id: number;
  nombre: string;
  codigo: string;
  codigo_barras: string;
  categoria_id: number | null;
  categoria_nombre?: string;
  precio_costo: number;
  precio_venta: number;
  precio2: number;
  precio3: number;
  stock_actual: number;
  stock_minimo: number;
  unidad_medida: string;
  fraccionable: boolean;
  en_catalogo: boolean;
  imagen_path: string | null;
  activo: boolean;
  marca: string;
  proveedor: string;
}

interface Categoria {
  id: number;
  nombre: string;
  color: string;
}

const defaultProducto: Omit<Producto, 'id'> = {
  nombre: '',
  codigo: '',
  codigo_barras: '',
  categoria_id: null,
  precio_costo: 0,
  precio_venta: 0,
  precio2: 0,
  precio3: 0,
  stock_actual: 0,
  stock_minimo: 0,
  unidad_medida: 'unidad',
  fraccionable: false,
  en_catalogo: false,
  imagen_path: null,
  activo: true,
  marca: '',
  proveedor: '',
};

export const ProductosModule: React.FC = () => {
  const { t } = useTranslation();
  const { viewMode, setViewMode, searchQuery, setSearchQuery, selectedCategoria, setSelectedCategoria } = useProductosStore();

  const [productos, setProductos] = useState<Producto[]>([]);
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [totalProductos, setTotalProductos] = useState(0);
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [formData, setFormData] = useState<Omit<Producto, 'id'>>(defaultProducto);
  const [confirmDelete, setConfirmDelete] = useState<number | null>(null);
  const [stockBajoOnly, setStockBajoOnly] = useState(false);
  const [savingImage, setSavingImage] = useState(false);
  const [showImportNextar, setShowImportNextar] = useState(false);
  const [showNuevaCat, setShowNuevaCat] = useState(false);
  const [nuevaCatNombre, setNuevaCatNombre] = useState('');
  const [nuevaCatColor, setNuevaCatColor] = useState('#6366f1');
  const [pendingImage, setPendingImage] = useState<string | null>(null);
  const [margenPct, setMargenPct] = useState('');
  const [buscandoWeb, setBuscandoWeb] = useState(false);
  const [showBusquedaWeb, setShowBusquedaWeb] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const csvRef = useRef<HTMLInputElement>(null);

  // Shortcut Insert o F2 para abrir formulario nuevo producto
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if ((e.key === 'Insert' || e.key === 'F2') && !showForm) {
        e.preventDefault();
        setFormData(defaultProducto);
        setEditingId(null);
        setShowForm(true);
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [showForm]);

  const PAGE_SIZE = 300;

  const loadData = async (pg = page) => {
    setPage(pg);
    setLoading(true);
    try {
      const [result, cats] = await Promise.all([
        productosAPI.getAll({
          search: searchQuery || undefined,
          categoria: selectedCategoria || undefined,
          stockBajo: stockBajoOnly || undefined,
          activo: true,
          limit: PAGE_SIZE,
          offset: pg * PAGE_SIZE,
        }) as Promise<{ rows: Producto[]; total: number }>,
        categoriasAPI.getAll() as Promise<Categoria[]>,
      ]);
      setProductos(result.rows);
      setTotalProductos(result.total);
      setCategorias(cats);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadData(0); }, [searchQuery, selectedCategoria, stockBajoOnly]);

  const handleSave = async () => {
    try {
      if (editingId) {
        await productosAPI.update(editingId, formData as unknown as Record<string, unknown>);
        if (pendingImage) {
          await productosAPI.saveImage(editingId, pendingImage);
        }
        toast.success(t('prod.updated'));
      } else {
        const result = await productosAPI.create(formData as unknown as Record<string, unknown>);
        const newId = (result as { id: number }).id;
        if (pendingImage) {
          await productosAPI.saveImage(newId, pendingImage);
        }
        toast.success(t('prod.created'));
      }
      setShowForm(false);
      setEditingId(null);
      setFormData(defaultProducto);
      setPendingImage(null);
      setMargenPct('');
      loadData();
    } catch (err) {
      toast.error(t('prod.saveError'));
    }
  };

  const handleEdit = (p: Producto) => {
    // Solo tomamos los campos editables (excluye categoria_nombre, created_at, updated_at, etc.)
    setFormData({
      nombre: p.nombre,
      codigo: p.codigo,
      codigo_barras: p.codigo_barras,
      categoria_id: p.categoria_id,
      precio_costo: p.precio_costo,
      precio_venta: p.precio_venta,
      precio2: p.precio2,
      precio3: p.precio3,
      stock_actual: p.stock_actual,
      stock_minimo: p.stock_minimo,
      unidad_medida: p.unidad_medida,
      fraccionable: p.fraccionable,
      en_catalogo: p.en_catalogo,
      imagen_path: p.imagen_path,
      activo: p.activo,
      marca: p.marca || '',
      proveedor: p.proveedor || ''
    });
    setMargenPct(margen(p.precio_costo, p.precio_venta).toFixed(1));
    setEditingId(p.id);
    setShowForm(true);
  };

  const handleDelete = async (id: number) => {
    await productosAPI.delete(id);
toast.success(t('prod.deactivated'));
    setConfirmDelete(null);
    loadData();
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setSavingImage(true);
    const reader = new FileReader();
    reader.onload = async (ev) => {
      const base64 = ev.target?.result as string;
      if (editingId) {
        try {
          await productosAPI.saveImage(editingId, base64);
          setFormData((prev) => ({ ...prev, imagen_path: base64 }));
          toast.success(t('prod.img.saved'));
          loadData();
        } catch {
          toast.error(t('prod.img.error'));
        }
      } else {
        setPendingImage(base64);
      }
      setSavingImage(false);
    };
    reader.readAsDataURL(file);
    if (fileRef.current) fileRef.current.value = '';
  };

  const handleCSVImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    const result = await productosAPI.importCSV(text) as { imported: number; errors: number };
    toast.success(t('prod.csv.imported', { n: result.imported, e: result.errors }));
    loadData();
    if (csvRef.current) csvRef.current.value = '';
  };

  const handleExportCSV = async () => {
    const headers = 'id,codigo,codigo_barras,nombre,categoria,precio_costo,precio_venta,stock_actual,stock_minimo,unidad_medida,fraccionable,activo';
    const rows = productos.map((p) =>
      [p.id, p.codigo, p.codigo_barras, `"${p.nombre}"`, `"${p.categoria_nombre || ''}"`,
       p.precio_costo, p.precio_venta, p.stock_actual, p.stock_minimo, p.unidad_medida, p.fraccionable ? 1 : 0, p.activo ? 1 : 0].join(',')
    );
    downloadCSV([headers, ...rows].join('\n'), 'productos_ariespos.csv');
    toast.success(t('prod.csv.exported'));
  };

  const margen = (costo: number, venta: number): number => {
    if (costo <= 0) return 0;
    return ((venta - costo) / costo) * 100;
  };

  const cancelForm = () => {
    setShowForm(false);
    setEditingId(null);
    setPendingImage(null);
    setMargenPct('');
  };

  const buscarEnInternet = async () => {
    const query = formData.codigo_barras?.trim() || formData.nombre.trim();
    if (!query) { toast.error('Ingresá un código de barras o nombre primero'); return; }
    const type = formData.codigo_barras?.trim() ? 'barcode' : 'nombre';
    setBuscandoWeb(true);
    try {
      const res = await productosAPI.buscarInternet(query, type);
      if (!res.found || !res.results?.length) {
        toast.error('No se encontró información en internet'); return;
      }
      const r = res.results[0];
      setFormData((p) => ({
        ...p,
        nombre: p.nombre || r.nombre,
        marca: p.marca || r.marca,
        codigo_barras: p.codigo_barras || r.barcode,
        unidad_medida: r.unidad_hint || p.unidad_medida,
      }));
      if (r.imagen_url && !pendingImage && !formData.imagen_path) {
        setPendingImage(r.imagen_url);
      }
      toast.success(`Encontrado: ${r.nombre || r.marca}`);
    } catch { toast.error('Error al buscar en internet'); }
    finally { setBuscandoWeb(false); }
  };

  const filtered = productos;

  // ── Formulario de alta/edición ────────────────────────────────────
  if (showForm) {
    return (
      <div className="flex flex-col h-full" style={{ background: 'var(--bg)' }}>
        {/* Inputs ocultos */}
        <input ref={csvRef} type="file" accept=".csv" className="hidden" onChange={handleCSVImport} />
        <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />

        {/* Header del formulario */}
        <div style={{ borderBottom: '1px solid var(--border)', background: 'var(--bg2)' }}
          className="shrink-0 flex items-center justify-between px-8 py-4">
          <h2 className="text-lg font-bold flex items-center gap-2" style={{ color: 'var(--text)' }}>
            <Package size={20} className="text-blue-400" />
            {editingId ? t('prod.editTitle') : t('prod.newTitle')}
          </h2>
          <div className="flex items-center gap-3">
            <button className="btn-secondary btn" onClick={cancelForm}>{t('common.cancel')}</button>
            <button className="btn-primary btn" onClick={handleSave}><Check size={16} /> {t('common.save')}</button>
          </div>
        </div>

        {/* Cuerpo del formulario */}
        <div className="flex-1 overflow-y-auto p-8">
          <div className="max-w-4xl mx-auto grid grid-cols-4 gap-x-5 gap-y-5">

            {/* Nombre */}
            <div className="col-span-2">
              <label className="label">{t('prod.form.name')}</label>
              <input autoFocus className="input" value={formData.nombre}
                onChange={(e) => setFormData((p) => ({ ...p, nombre: e.target.value }))}
                placeholder={t('prod.form.namePh')} />
            </div>

            {/* Código */}
            <div>
              <label className="label">{t('prod.form.code')}</label>
              <input className="input font-mono" value={formData.codigo}
                onChange={(e) => setFormData((p) => ({ ...p, codigo: e.target.value }))}
                placeholder="COD001" />
            </div>

            {/* Código de barras */}
            <div>
              <label className="label">{t('prod.form.barcode')}</label>
              <div className="flex gap-2">
                <input className="input font-mono flex-1" value={formData.codigo_barras || ''}
                  onChange={(e) => setFormData((p) => ({ ...p, codigo_barras: e.target.value }))}
                  placeholder="7790001234567" />
                <button type="button"
                  onClick={buscarEnInternet}
                  disabled={buscandoWeb}
                  title="Buscar información del producto en internet"
                  className="btn btn-secondary px-3 shrink-0 flex items-center gap-1 text-xs">
                  {buscandoWeb
                    ? <Loader2 size={14} className="animate-spin" />
                    : <Globe size={14} />}
                  {buscandoWeb ? '' : 'Web'}
                </button>
              </div>
            </div>

            {/* Categoría */}
            <div className="col-span-2">
              <label className="label">{t('prod.form.category')}</label>
              <div className="flex gap-2">
                <select className="input flex-1" value={formData.categoria_id || ''}
                  onChange={(e) => setFormData((p) => ({ ...p, categoria_id: e.target.value ? parseInt(e.target.value) : null }))}>
                  <option value="">{t('prod.form.noCategory')}</option>
                  {categorias.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
                </select>
                <button type="button" className="btn-secondary btn px-3" onClick={() => setShowNuevaCat((v) => !v)}>
                  <Plus size={14} />
                </button>
              </div>
              {showNuevaCat && (
                <div className="mt-2 flex gap-2 items-center">
                  <input className="input flex-1 text-sm" placeholder={t('prod.form.newCat')}
                    value={nuevaCatNombre} onChange={(e) => setNuevaCatNombre(e.target.value)} autoFocus />
                  <input type="color" value={nuevaCatColor} onChange={(e) => setNuevaCatColor(e.target.value)}
                    className="w-9 h-9 rounded border border-slate-600 cursor-pointer bg-transparent" />
                  <button type="button" className="btn-primary btn btn-sm" onClick={async () => {
                    if (!nuevaCatNombre.trim()) return;
                    const r = await categoriasAPI.create({ nombre: nuevaCatNombre.trim(), color: nuevaCatColor }) as { id: number };
                    const cats = await categoriasAPI.getAll() as Categoria[];
                    setCategorias(cats);
                    setFormData((p) => ({ ...p, categoria_id: r.id }));
                    setNuevaCatNombre(''); setShowNuevaCat(false);
                    toast.success(t('prod.form.catCreated'));
                  }}><Check size={13} /></button>
                  <button type="button" className="btn-ghost btn btn-sm" onClick={() => setShowNuevaCat(false)}><X size={13} /></button>
                </div>
              )}
            </div>

            {/* Unidad */}
            <div>
              <label className="label">{t('prod.form.unit')}</label>
              <select className="input" value={formData.unidad_medida}
                onChange={(e) => setFormData((p) => ({ ...p, unidad_medida: e.target.value }))}>
                <option value="unidad">Unidad</option>
                <option value="kg">Kilogramo (kg)</option>
                <option value="g">Gramo (g)</option>
                <option value="litro">Litro</option>
                <option value="ml">Mililitro (ml)</option>
                <option value="m">Metro</option>
                <option value="cm">Centímetro</option>
                <option value="par">Par</option>
                <option value="docena">Docena</option>
              </select>
            </div>

            {/* Placeholder para alinear */}
            <div />

            {/* Costo */}
            <div>
              <label className="label">{t('prod.form.cost')}</label>
              <input type="number" className="input font-mono text-right" step="0.01" min="0"
                value={formData.precio_costo}
                onChange={(e) => {
                  const costo = parseFloat(e.target.value) || 0;
                  const pct = parseFloat(margenPct);
                  setFormData((p) => ({
                    ...p,
                    precio_costo: costo,
                    precio_venta: (!isNaN(pct) && pct > 0 && costo > 0)
                      ? parseFloat((costo * (1 + pct / 100)).toFixed(2))
                      : p.precio_venta,
                  }));
                }} />
            </div>

            {/* Precio venta */}
            <div>
              <label className="label">{t('prod.form.price1')}</label>
              <input type="number" className="input font-mono text-right" step="0.01" min="0"
                value={formData.precio_venta}
                onChange={(e) => {
                  const venta = parseFloat(e.target.value) || 0;
                  setFormData((p) => ({ ...p, precio_venta: venta }));
                  if (formData.precio_costo > 0) {
                    setMargenPct(margen(formData.precio_costo, venta).toFixed(1));
                  }
                }} />
            </div>

            {/* Margen % — EDITABLE */}
            <div>
              <label className="label">{t('prod.form.margin')} (ganancia %)</label>
              <div className="relative">
                <input type="number" className="input font-mono text-right pr-7" step="0.1" min="0"
                  placeholder="0.0"
                  value={margenPct}
                  onChange={(e) => {
                    const pct = e.target.value;
                    setMargenPct(pct);
                    const pctNum = parseFloat(pct);
                    if (!isNaN(pctNum) && formData.precio_costo > 0) {
                      setFormData((p) => ({
                        ...p,
                        precio_venta: parseFloat((p.precio_costo * (1 + pctNum / 100)).toFixed(2)),
                      }));
                    }
                  }} />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">%</span>
              </div>
            </div>

            {/* Precio 2 */}
            <div>
              <label className="label">{t('prod.form.price2')}</label>
              <input type="number" className="input font-mono text-right" step="0.01" min="0"
                value={formData.precio2 || 0}
                onChange={(e) => setFormData((p) => ({ ...p, precio2: parseFloat(e.target.value) || 0 }))} />
            </div>

            {/* Precio 3 */}
            <div>
              <label className="label">{t('prod.form.price3')}</label>
              <input type="number" className="input font-mono text-right" step="0.01" min="0"
                value={formData.precio3 || 0}
                onChange={(e) => setFormData((p) => ({ ...p, precio3: parseFloat(e.target.value) || 0 }))} />
            </div>

            {/* Stock actual */}
            <div>
              <label className="label">{t('prod.form.stock')}</label>
              <input type="number" className="input font-mono" step={formData.fraccionable ? '0.01' : '1'}
                value={formData.stock_actual}
                onChange={(e) => setFormData((p) => ({ ...p, stock_actual: parseFloat(e.target.value) || 0 }))} />
            </div>

            {/* Stock mínimo */}
            <div>
              <label className="label">{t('prod.form.minStock')}</label>
              <input type="number" className="input font-mono" step={formData.fraccionable ? '0.01' : '1'}
                value={formData.stock_minimo} min="0"
                onChange={(e) => setFormData((p) => ({ ...p, stock_minimo: parseFloat(e.target.value) || 0 }))} />
            </div>

            {/* Marca */}
            <div>
              <label className="label">{t('prod.form.brand')}</label>
              <input className="input" value={formData.marca || ''}
                onChange={(e) => setFormData((p) => ({ ...p, marca: e.target.value }))}
                placeholder="Ej: Samsung, Nike..." />
            </div>

            {/* Proveedor */}
            <div>
              <label className="label">{t('prod.form.supplier')}</label>
              <input className="input" value={formData.proveedor || ''}
                onChange={(e) => setFormData((p) => ({ ...p, proveedor: e.target.value }))}
                placeholder="Ej: Distribuidora X" />
            </div>

            {/* Checkboxes */}
            <div className="col-span-4 flex items-center gap-8 pt-2">
              <label className="flex items-center gap-2 cursor-pointer text-sm" style={{ color: 'var(--text2)' }}>
                <input type="checkbox" className="w-4 h-4 rounded" checked={formData.fraccionable}
                  onChange={(e) => setFormData((p) => ({ ...p, fraccionable: e.target.checked }))} />
                {t('prod.form.fractional')}
              </label>
              <label className="flex items-center gap-2 cursor-pointer text-sm" style={{ color: 'var(--text2)' }}>
                <input type="checkbox" className="w-4 h-4 rounded" checked={formData.en_catalogo}
                  onChange={(e) => setFormData((p) => ({ ...p, en_catalogo: e.target.checked }))} />
                {t('prod.form.catalog')}
              </label>
              <label className="flex items-center gap-2 cursor-pointer text-sm" style={{ color: 'var(--text2)' }}>
                <input type="checkbox" className="w-4 h-4 rounded" checked={formData.activo}
                  onChange={(e) => setFormData((p) => ({ ...p, activo: e.target.checked }))} />
                {t('prod.form.active')}
              </label>
            </div>

            {/* Imagen */}
            <div className="col-span-2 pt-2">
              <label className="label">{t('prod.form.image')}</label>
              <div className="flex items-start gap-4">
                {(pendingImage || formData.imagen_path) ? (
                  <div className="relative shrink-0">
                    <img src={pendingImage || formData.imagen_path || ''} alt="preview"
                      className="w-20 h-20 rounded-lg object-cover border border-slate-600" />
                    <button type="button"
                      className="absolute -top-1.5 -right-1.5 bg-slate-700 rounded-full p-0.5 hover:bg-red-600 transition-colors"
                      onClick={() => { setPendingImage(null); setFormData((p) => ({ ...p, imagen_path: null })); }}>
                      <X size={12} />
                    </button>
                  </div>
                ) : null}
                <div className="flex flex-col gap-1.5">
                  <button type="button" className="btn-secondary btn btn-sm"
                    onClick={() => fileRef.current?.click()} disabled={savingImage}>
                    <Image size={14} />
                    {savingImage ? t('prod.form.saving') : (pendingImage || formData.imagen_path ? t('prod.form.changeImage') : t('prod.form.loadImage'))}
                  </button>
                  {!editingId && pendingImage && <p className="text-xs text-slate-400">{t('prod.pending')}</p>}
                </div>
              </div>
            </div>

          </div>
        </div>
      </div>
    );
  }

  // ── Vista lista/grid ──────────────────────────────────────────────
  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="shrink-0 module-header px-6 pt-6">
        <div>
          <h1 className="module-title flex items-center gap-3"><Package size={28} className="text-blue-400" /> {t('prod.title')}</h1>
          <p className="text-sm text-slate-400 mt-1">{t('prod.count', { n: totalProductos })}</p>
        </div>
        <div className="flex items-center gap-2">
          <button className="btn-secondary btn btn-sm" onClick={() => setShowBusquedaWeb(true)} title="Carga masiva de productos buscando en internet">
            <Globe size={14} /> Buscar en Web
          </button>
          <button className="btn-secondary btn btn-sm" onClick={() => setShowImportNextar(true)} title="Importar productos desde archivo CSV de Nextar">
            <FileText size={14} /> {t('prod.nextar')}
          </button>
          <button className="btn-secondary btn btn-sm" onClick={() => csvRef.current?.click()}>
            <Upload size={14} /> {t('prod.import')}
          </button>
          <button className="btn-secondary btn btn-sm" onClick={handleExportCSV}>
            <Download size={14} /> {t('prod.export')}
          </button>
          <button className="btn-primary btn" onClick={() => { setFormData(defaultProducto); setEditingId(null); setShowForm(true); }}>
            <Plus size={16} /> {t('prod.new')} <kbd>Ins</kbd>
          </button>
        </div>
      </div>

      {/* Filtros */}
      <div className="shrink-0 px-6 pb-4 flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder={t('prod.search')}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="input pl-9 text-sm"
          />
        </div>

        <select
          value={selectedCategoria || ''}
          onChange={(e) => setSelectedCategoria(e.target.value ? parseInt(e.target.value) : null)}
          className="input text-sm w-40"
        >
          <option value="">{t('prod.allCats')}</option>
          {categorias.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
        </select>

        <label className="flex items-center gap-2 text-sm text-slate-400 cursor-pointer">
          <input type="checkbox" checked={stockBajoOnly} onChange={(e) => setStockBajoOnly(e.target.checked)} className="rounded" />
          <AlertCircle size={14} className="text-red-400" /> Stock bajo
        </label>

        <div className="flex items-center gap-1 bg-slate-800 rounded-lg p-1">
          <button
            onClick={() => setViewMode('grid')}
            className={`p-1.5 rounded ${viewMode === 'grid' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'}`}
          >
            <Grid size={16} />
          </button>
          <button
            onClick={() => setViewMode('list')}
            className={`p-1.5 rounded ${viewMode === 'list' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'}`}
          >
            <List size={16} />
          </button>
        </div>

        <button className="btn-ghost btn p-2" onClick={() => loadData(0)}><RefreshCw size={16} /></button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto px-6 pb-6">
        {loading ? (
          <div className="flex items-center justify-center h-32 text-slate-400">{t('prod.loading')}</div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-32 text-slate-500 gap-2">
            <Package size={40} />
            <p>{t('prod.empty')}</p>
          </div>
        ) : viewMode === 'grid' ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
            {filtered.map((p) => (
              <div key={p.id} className={`card group relative overflow-hidden hover:border-blue-600/50 transition-all ${!p.activo ? 'opacity-50' : ''}`}>
                {/* Imagen */}
                <div className="h-32 bg-slate-700 rounded-lg mb-3 flex items-center justify-center overflow-hidden">
                  {p.imagen_path ? (
                    <img
                      src={`http://localhost:3001/images/${p.imagen_path}`}
                      alt={p.nombre}
                      className="w-full h-full object-cover"
                      onError={(e) => { e.currentTarget.style.display = 'none'; }}
                    />
                  ) : (
                    <Package size={32} className="text-slate-500" />
                  )}
                </div>

                {/* Info */}
                <div className="space-y-1">
                  <div className="font-semibold text-white text-sm leading-tight truncate" title={p.nombre}>{p.nombre}</div>
                  <div className="font-mono text-xs text-slate-400">{p.codigo}</div>
                  {p.categoria_nombre && (
                    <span className="badge badge-blue text-[10px]">{p.categoria_nombre}</span>
                  )}
                  <div className="font-mono font-bold text-green-400 text-lg">{formatCurrency(p.precio_venta)}</div>
                  <div className="flex items-center justify-between text-xs">
                    <span className={`${p.stock_actual <= p.stock_minimo ? 'text-red-400' : 'text-slate-400'}`}>
                      Stock: {p.stock_actual} {p.unidad_medida}
                    </span>
                    <span className="text-slate-500">{margen(p.precio_costo, p.precio_venta).toFixed(0)}%</span>
                  </div>
                </div>

                {/* Acciones */}
                <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button onClick={() => handleEdit(p)} className="btn-secondary btn p-1.5 text-xs"><Edit size={12} /></button>
                  <button onClick={() => setConfirmDelete(p.id)} className="btn-danger btn p-1.5 text-xs"><Trash2 size={12} /></button>
                </div>

                {p.stock_actual <= p.stock_minimo && (
                  <div className="absolute top-2 left-2">
                    <span className="badge badge-red text-[10px]">{t('prod.lowStock')}</span>
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : (
          /* Vista lista */
          <div className="bg-slate-800 rounded-xl overflow-hidden border border-slate-700">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-700">
                  <th className="table-header">{t('prod.col.product')}</th>
                  <th className="table-header">{t('prod.col.code')}</th>
                  <th className="table-header">{t('prod.col.category')}</th>
                  <th className="table-header text-right">{t('prod.col.cost')}</th>
                  <th className="table-header text-right">{t('prod.col.price')}</th>
                  <th className="table-header text-right">{t('prod.col.margin')}</th>
                  <th className="table-header text-right">{t('prod.col.stock')}</th>
                  <th className="table-header text-center">{t('prod.col.catalog')}</th>
                  <th className="table-header"></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((p) => (
                  <tr key={p.id} className={`table-row ${!p.activo ? 'opacity-50' : ''}`}>
                    <td className="table-cell">
                      <div className="font-medium text-white">{p.nombre}</div>
                      {p.fraccionable && <span className="badge badge-blue text-[10px]">Fraccionable</span>}
                    </td>
                    <td className="table-cell font-mono text-slate-400 text-xs">{p.codigo}</td>
                    <td className="table-cell">
                      {p.categoria_nombre && <span className="badge badge-gray">{p.categoria_nombre}</span>}
                    </td>
                    <td className="table-cell text-right font-mono text-slate-400">{formatCurrency(p.precio_costo)}</td>
                    <td className="table-cell text-right font-mono font-bold text-green-400">{formatCurrency(p.precio_venta)}</td>
                    <td className="table-cell text-right text-slate-400">{margen(p.precio_costo, p.precio_venta).toFixed(1)}%</td>
                    <td className={`table-cell text-right font-mono ${p.stock_actual <= p.stock_minimo ? 'text-red-400' : 'text-slate-300'}`}>
                      {p.stock_actual} {p.unidad_medida}
                    </td>
                    <td className="table-cell text-center">
                      {p.en_catalogo ? <Check size={14} className="text-green-400 mx-auto" /> : <X size={14} className="text-slate-600 mx-auto" />}
                    </td>
                    <td className="table-cell">
                      <div className="flex gap-1">
                        <button onClick={() => handleEdit(p)} className="btn-ghost btn p-1.5"><Edit size={13} /></button>
                        <button onClick={() => setConfirmDelete(p.id)} className="btn-ghost btn p-1.5 hover:text-red-400"><Trash2 size={13} /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Paginación */}
      {totalProductos > PAGE_SIZE && (
        <div className="shrink-0 px-6 py-3 flex items-center justify-between border-t border-slate-700 bg-slate-900">
          <span className="text-sm text-slate-400">
            {t('prod.pag.showing', { from: page * PAGE_SIZE + 1, to: Math.min((page + 1) * PAGE_SIZE, totalProductos), total: totalProductos })}
          </span>
          <div className="flex gap-2">
            <button
              onClick={() => loadData(page - 1)}
              disabled={page === 0}
              className="btn-secondary btn btn-sm disabled:opacity-40"
            >
              {t('prod.pag.prev')}
            </button>
            <button
              onClick={() => loadData(page + 1)}
              disabled={(page + 1) * PAGE_SIZE >= totalProductos}
              className="btn-secondary btn btn-sm disabled:opacity-40"
            >
              {t('prod.pag.next')}
            </button>
          </div>
        </div>
      )}

      {/* Inputs ocultos */}
      <input ref={csvRef} type="file" accept=".csv" className="hidden" onChange={handleCSVImport} />
      <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />

      {/* Confirm delete */}
      <ConfirmDialog
        isOpen={confirmDelete !== null}
        title={t('prod.deactivate')}
        message={t('prod.deactivateMsg')}
        onConfirm={() => confirmDelete && handleDelete(confirmDelete)}
        onCancel={() => setConfirmDelete(null)}
      />

      {/* Modal importar desde Nextar */}
      <Modal isOpen={showImportNextar} onClose={() => setShowImportNextar(false)} title="" size="md">
        <ImportNextarModal
          onClose={() => setShowImportNextar(false)}
          onSuccess={() => { loadData(); setShowImportNextar(false); }}
        />
      </Modal>

      {/* Modal búsqueda web masiva */}
      <Modal isOpen={showBusquedaWeb} onClose={() => setShowBusquedaWeb(false)} title="🌐 Carga masiva con búsqueda en internet" size="lg">
        <BusquedaWebModal
          onClose={() => setShowBusquedaWeb(false)}
          onSuccess={() => { loadData(); setShowBusquedaWeb(false); }}
        />
      </Modal>
    </div>
  );
};
