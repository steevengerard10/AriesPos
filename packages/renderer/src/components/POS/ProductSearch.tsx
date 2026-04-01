import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Search, X, Loader2, CornerDownLeft } from 'lucide-react';
import { productosAPI } from '../../lib/api';
import { useVentasStore } from '../../store/useVentasStore';
import { formatCurrency } from '../../lib/utils';
import toast from 'react-hot-toast';

interface Producto {
  id: number;
  nombre: string;
  codigo: string;
  codigo_barras: string;
  precio_venta: number;
  precio2: number;
  precio3: number;
  stock_actual: number;
  unidad_medida: string;
  fraccionable: boolean;
  categoria_nombre?: string;
}

interface ProductSearchProps {
  onSelect?: (producto: Producto) => void;
  autoFocus?: boolean;
  selectedPrecio?: 1 | 2 | 3;
}

// Pasos del flujo tipo Nextar: buscar → cantidad → precio → cargar
type FlowStep = 'search' | 'qty' | 'price';

export const ProductSearch: React.FC<ProductSearchProps> = ({
  onSelect,
  autoFocus = true,
  selectedPrecio = 1,
}) => {
  const { t } = useTranslation();
  const [query, setQuery] = useState('');
  const [qty, setQty] = useState('1');
  const [precio, setPrecio] = useState('');
  const [results, setResults] = useState<Producto[]>([]);
  const [loading, setLoading] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [selectedProduct, setSelectedProduct] = useState<Producto | null>(null);
  const [step, setStep] = useState<FlowStep>('search');

  const inputRef = useRef<HTMLInputElement>(null);
  const qtyRef = useRef<HTMLInputElement>(null);
  const precioRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const searchTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  const { addItem } = useVentasStore();

  useEffect(() => {
    if (autoFocus) inputRef.current?.focus();
  }, [autoFocus]);

  // Búsqueda con debounce — solo mientras no hay producto seleccionado
  useEffect(() => {
    if (selectedProduct) return;
    if (!query.trim()) {
      setResults([]);
      setShowDropdown(false);
      return;
    }
    if (searchTimeout.current) clearTimeout(searchTimeout.current);
    searchTimeout.current = setTimeout(async () => {
      setLoading(true);
      try {
        const data = await productosAPI.search(query) as Producto[];
        setResults(data);
        setShowDropdown(data.length > 0);
        setSelectedIndex(0);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }, 200);
    return () => { if (searchTimeout.current) clearTimeout(searchTimeout.current); };
  }, [query, selectedProduct]);

  const getPrice = useCallback((p: Producto): number => {
    if (selectedPrecio === 2 && p.precio2 > 0) return p.precio2;
    if (selectedPrecio === 3 && p.precio3 > 0) return p.precio3;
    return p.precio_venta;
  }, [selectedPrecio]);

  // Reset completo al estado inicial
  const resetForm = useCallback(() => {
    setQuery('');
    setQty('1');
    setPrecio('');
    setSelectedProduct(null);
    setShowDropdown(false);
    setStep('search');
    setTimeout(() => inputRef.current?.focus(), 10);
  }, []);

  // Selecciona un producto y avanza al paso de cantidad
  const selectProduct = useCallback((producto: Producto) => {
    setSelectedProduct(producto);
    setQuery(producto.nombre);
    setPrecio(String(getPrice(producto)));
    setShowDropdown(false);
    setStep('qty');
    setTimeout(() => { qtyRef.current?.focus(); qtyRef.current?.select(); }, 10);
  }, [getPrice]);

  // Agrega el producto al carrito con la cantidad y precio actuales
  const commitAdd = useCallback(() => {
    if (!selectedProduct) return;
    const parsedQty = parseFloat(qty.replace(',', '.'));
    const cantidad = (!isNaN(parsedQty) && parsedQty > 0) ? parsedQty : 1;
    const parsedPrecio = parseFloat(precio.replace(',', '.'));
    const precioFinal = (!isNaN(parsedPrecio) && parsedPrecio >= 0) ? parsedPrecio : getPrice(selectedProduct);

    if (selectedProduct.stock_actual <= 0 && !selectedProduct.fraccionable) {
      toast(`⚠ Sin stock: ${selectedProduct.nombre}`, { duration: 2000 });
    }
    addItem({
      producto_id: selectedProduct.id,
      nombre: selectedProduct.nombre,
      cantidad,
      precio_unitario: precioFinal,
      precio_original: getPrice(selectedProduct),
      descuento: 0,
      fraccionable: selectedProduct.fraccionable,
      unidad_medida: selectedProduct.unidad_medida,
    });
    toast.success(`${selectedProduct.nombre} agregado`, { duration: 1000 });
    if (onSelect) onSelect(selectedProduct);
    resetForm();
  }, [selectedProduct, qty, precio, addItem, onSelect, getPrice, resetForm]);

  // ── Handlers de teclado ─────────────────────────────────────────
  const handleSearchKeyDown = useCallback(async (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      // Dropdown abierto → seleccionar ítem resaltado
      if (showDropdown && results.length > 0) {
        selectProduct(results[selectedIndex]);
        return;
      }
      // Sin dropdown → intentar por código de barras / búsqueda exacta
      if (query.trim()) {
        setLoading(true);
        try {
          const porBarras = await productosAPI.getByBarcode(query.trim()) as Producto | null;
          if (porBarras) {
            selectProduct(porBarras);
          } else {
            const buscados = await productosAPI.search(query.trim()) as Producto[];
            if (buscados.length === 1) {
              selectProduct(buscados[0]);
            } else if (buscados.length > 1) {
              setResults(buscados);
              setShowDropdown(true);
              setSelectedIndex(0);
            } else {
              toast.error(`No encontrado: ${query}`);
              setQuery('');
            }
          }
        } finally {
          setLoading(false);
        }
      }
      return;
    }
    if (e.key === 'ArrowDown') { e.preventDefault(); setSelectedIndex((i) => Math.min(i + 1, results.length - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setSelectedIndex((i) => Math.max(i - 1, 0)); }
    else if (e.key === 'Escape') { setShowDropdown(false); setQuery(''); }
  }, [showDropdown, results, selectedIndex, query, selectProduct]);

  const handleQtyKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === 'Tab') {
      e.preventDefault();
      setStep('price');
      setTimeout(() => { precioRef.current?.focus(); precioRef.current?.select(); }, 10);
    } else if (e.key === 'Escape') {
      resetForm();
    }
  }, [resetForm]);

  const handlePrecioKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === 'Tab') {
      e.preventDefault();
      commitAdd();
    } else if (e.key === 'Escape') {
      resetForm();
    }
  }, [commitAdd, resetForm]);

  const currentTotal = selectedProduct
    ? (parseFloat(qty.replace(',', '.')) || 1) * (parseFloat(String(precio).replace(',', '.')) || getPrice(selectedProduct))
    : 0;

  const fieldCls = (active: boolean) =>
    `flex items-center gap-1.5 rounded border px-2.5 py-2 transition-all duration-150 shrink-0 ${
      active
        ? 'border-blue-400 bg-slate-600/80 shadow-[0_0_0_2px_rgba(96,165,250,0.2)]'
        : 'border-slate-600/80 bg-slate-700/40'
    }`;

  return (
    <div className="relative flex items-center gap-2">
      {/* ── Campo de búsqueda ─────────────────────────────────────── */}
      <div className={`relative flex-1 flex items-center gap-2 rounded border px-2.5 py-2 transition-all duration-150 min-w-0 ${
        step === 'search'
          ? 'border-blue-400 bg-slate-600/80 shadow-[0_0_0_2px_rgba(96,165,250,0.2)]'
          : 'border-slate-600/80 bg-slate-700/40'
      }`}>
        <Search size={14} className="text-slate-400 shrink-0 pointer-events-none" />
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => {
            // Si hay producto seleccionado y el usuario empieza a tipear → cancelar selección
            if (selectedProduct) {
              setSelectedProduct(null);
              setStep('search');
              setPrecio('');
              setShowDropdown(false);
            }
            setQuery(e.target.value);
          }}
          onKeyDown={handleSearchKeyDown}
          onBlur={() => setTimeout(() => setShowDropdown(false), 150)}
          onFocus={() => { if (query && results.length > 0 && !selectedProduct) setShowDropdown(true); }}
          onClick={() => { if (selectedProduct) resetForm(); }}
          placeholder={t('search.placeholder')}
          className="flex-1 bg-transparent text-sm text-white placeholder:text-slate-500 outline-none min-w-0"
          autoComplete="off"
        />
        {loading && <Loader2 size={12} className="text-slate-400 animate-spin shrink-0" />}
        {selectedProduct && !loading && (
          <button
            className="text-slate-400 hover:text-red-400 shrink-0 transition-colors"
            onMouseDown={(e) => { e.preventDefault(); resetForm(); }}
            title="Cancelar (Esc)"
          >
            <X size={13} />
          </button>
        )}
      </div>

      {/* ── Cant ─────────────────────────────────────────────────── */}
      <div className={fieldCls(step === 'qty')}>
        <span className={`text-xs font-semibold whitespace-nowrap ${step === 'qty' ? 'text-blue-300' : 'text-slate-400'}`}>Cant:</span>
        <input
          ref={qtyRef}
          type="number"
          value={qty}
          onChange={(e) => setQty(e.target.value)}
          onKeyDown={handleQtyKeyDown}
          onFocus={(e) => { setStep('qty'); e.target.select(); }}
          step="0.001"
          min="0.001"
          title="Cantidad"
          placeholder="1"
          className="text-right text-sm font-mono outline-none w-14 bg-transparent text-white placeholder:text-slate-600"
        />
      </div>

      {/* ── Precio ───────────────────────────────────────────────── */}
      <div className={fieldCls(step === 'price')}>
        <span className={`text-xs font-semibold whitespace-nowrap ${step === 'price' ? 'text-blue-300' : 'text-slate-400'}`}>Precio:</span>
        <input
          ref={precioRef}
          type="number"
          value={precio}
          onChange={(e) => setPrecio(e.target.value)}
          onKeyDown={handlePrecioKeyDown}
          onFocus={(e) => { setStep('price'); e.target.select(); }}
          step="0.01"
          min="0"
          placeholder="0"
          className="text-right text-sm font-mono outline-none w-20 bg-transparent text-white placeholder:text-slate-600"
        />
      </div>

      {/* ── Total ────────────────────────────────────────────────── */}
      <div className="flex items-center gap-1.5 border border-slate-600/80 bg-slate-800/60 rounded px-2.5 py-2 shrink-0">
        <span className="text-xs font-semibold text-slate-400 whitespace-nowrap">Total:</span>
        <span className={`text-sm font-mono font-bold w-24 text-right ${currentTotal > 0 ? 'text-green-400' : 'text-slate-600'}`}>
          {currentTotal > 0 ? formatCurrency(currentTotal) : '—'}
        </span>
      </div>

      {/* ── Botón Emitir / Agregar ────────────────────────────────── */}
      <button
        onClick={commitAdd}
        disabled={!selectedProduct}
        className={`flex items-center justify-center gap-1 px-3 py-2 rounded border text-sm font-semibold transition-all shrink-0 ${
          selectedProduct
            ? 'bg-blue-600 border-blue-500 text-white hover:bg-blue-500 shadow-md'
            : 'bg-slate-700/50 border-slate-600/80 text-slate-500 cursor-not-allowed'
        }`}
        title="Agregar al carrito (Enter)"
      >
        <CornerDownLeft size={15} />
      </button>

      {/* ── Dropdown resultados ───────────────────────────────────── */}
      {showDropdown && results.length > 0 && (
        <div
          ref={dropdownRef}
          className="absolute top-full left-0 mt-1 bg-slate-800 border border-slate-600 rounded-xl shadow-2xl z-50 overflow-hidden w-[min(600px,70%)]"
        >
          {results.slice(0, 9).map((p, i) => (
            <button
              key={p.id}
              className={`w-full flex items-center gap-3 px-4 py-2.5 text-left hover:bg-slate-700 transition-colors ${i === selectedIndex ? 'bg-slate-700' : ''}`}
              onMouseDown={(e) => { e.preventDefault(); selectProduct(p); }}
              onMouseEnter={() => setSelectedIndex(i)}
            >
              <div className="flex-1 min-w-0">
                <div className="font-medium text-white text-sm truncate">{p.nombre}</div>
                <div className="text-xs text-slate-400 flex items-center gap-2">
                  <span className="font-mono">{p.codigo}</span>
                  {p.categoria_nombre && <span>• {p.categoria_nombre}</span>}
                  <span>• Stock: {p.fraccionable ? p.stock_actual.toFixed(3) : p.stock_actual} {p.unidad_medida}</span>
                  {p.fraccionable && <span className="text-amber-400/80">• fraccionable</span>}
                </div>
              </div>
              <div className="text-right shrink-0">
                <div className="font-mono font-bold text-green-400 text-sm">
                  {formatCurrency(getPrice(p))}
                </div>
                {p.stock_actual <= 0 && (
                  <div className="text-xs text-red-400">sin stock</div>
                )}
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};
