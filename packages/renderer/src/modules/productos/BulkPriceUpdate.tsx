import React, { useState, useCallback } from 'react';
import {
  Search, TrendingUp, TrendingDown, Check, X, AlertTriangle,
  ChevronLeft, Loader2, PercentSquare,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { productosAPI, BulkProductRow } from '../../lib/api';
import { formatCurrency } from '../../lib/utils';

// ── Tipos ──────────────────────────────────────────────────────────────────────

interface BulkPriceFilters {
  brand: string;
  category: string;
  name: string;
}

// ── Componente principal ───────────────────────────────────────────────────────

interface BulkPriceUpdateProps {
  onBack: () => void;
  onDone?: () => void;
}

export const BulkPriceUpdate: React.FC<BulkPriceUpdateProps> = ({ onBack, onDone }) => {
  const [filters, setFilters] = useState<BulkPriceFilters>({ brand: '', category: '', name: '' });
  const [percentage, setPercentage] = useState<string>('');
  const [rows, setRows] = useState<BulkProductRow[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [searching, setSearching] = useState(false);
  const [applying, setApplying] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);

  const pct = parseFloat(percentage);
  const validPct = !isNaN(pct) && pct !== 0;
  const hasFilters = filters.brand.trim() || filters.category.trim() || filters.name.trim();

  // ── Búsqueda ─────────────────────────────────────────────────────────────────

  const handleSearch = useCallback(async () => {
    if (!hasFilters) {
      toast.error('Ingresá al menos un filtro para buscar productos');
      return;
    }
    setSearching(true);
    setHasSearched(true);
    try {
      const result = await productosAPI.bulkGetByFilters({
        brand: filters.brand.trim() || undefined,
        category: filters.category.trim() || undefined,
        name: filters.name.trim() || undefined,
      });
      setRows(result);
      setSelectedIds(new Set(result.map((r) => r.id)));
    } catch {
      toast.error('Error al buscar productos');
    } finally {
      setSearching(false);
    }
  }, [filters, hasFilters]);

  // ── Selección ─────────────────────────────────────────────────────────────────

  const toggleAll = () => {
    if (selectedIds.size === rows.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(rows.map((r) => r.id)));
    }
  };

  const toggleOne = (id: number) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // ── Precio nuevo (preview) ───────────────────────────────────────────────────

  const newPrice = (current: number): number => {
    if (!validPct) return current;
    return Math.round(current * (1 + pct / 100) * 100) / 100;
  };

  // ── Aplicar cambio ────────────────────────────────────────────────────────────

  const handleApply = async () => {
    setShowConfirm(false);
    setApplying(true);
    try {
      const result = await productosAPI.bulkUpdatePrices({
        productIds: Array.from(selectedIds),
        percentage: pct,
      });
      toast.success(`${result.updated} producto${result.updated !== 1 ? 's' : ''} actualizado${result.updated !== 1 ? 's' : ''}`);
      setRows([]);
      setSelectedIds(new Set());
      setHasSearched(false);
      onDone?.();
    } catch {
      toast.error('Error al actualizar precios');
    } finally {
      setApplying(false);
    }
  };

  const canApply = selectedIds.size > 0 && validPct;

  // ── Render ────────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col h-full overflow-hidden">

      {/* Encabezado */}
      <div className="shrink-0 px-6 pt-6 pb-4 border-b border-slate-700/60">
        <div className="flex items-center gap-3 mb-1">
          <button
            onClick={onBack}
            className="btn btn-sm btn-secondary flex items-center gap-1"
          >
            <ChevronLeft size={15} /> Volver
          </button>
          <h1 className="module-title flex items-center gap-2 text-xl">
            <PercentSquare size={24} className="text-blue-400" />
            Actualización masiva de precios
          </h1>
        </div>
        <p className="text-sm text-slate-400 ml-[72px]">
          Filtrá productos, elegí el porcentaje y confirmá el cambio.
        </p>
      </div>

      {/* Cuerpo con scroll */}
      <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">

        {/* Panel de filtros */}
        <section className="card p-5 space-y-4">
          <h2 className="text-sm font-semibold text-slate-300 uppercase tracking-wide">
            1 · Filtrar productos
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <label className="flex flex-col gap-1">
              <span className="text-xs text-slate-400">Por marca</span>
              <input
                type="text"
                className="input input-sm"
                placeholder="Ej: Coca-Cola"
                value={filters.brand}
                onChange={(e) => setFilters((f) => ({ ...f, brand: e.target.value }))}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-xs text-slate-400">Por categoría</span>
              <input
                type="text"
                className="input input-sm"
                placeholder="Ej: Bebidas"
                value={filters.category}
                onChange={(e) => setFilters((f) => ({ ...f, category: e.target.value }))}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-xs text-slate-400">Por nombre</span>
              <input
                type="text"
                className="input input-sm"
                placeholder="Ej: Coca"
                value={filters.name}
                onChange={(e) => setFilters((f) => ({ ...f, name: e.target.value }))}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              />
            </label>
          </div>
          <div className="flex items-center gap-3">
            <button
              className="btn btn-primary flex items-center gap-2"
              onClick={handleSearch}
              disabled={searching || !hasFilters}
            >
              {searching ? <Loader2 size={16} className="animate-spin" /> : <Search size={16} />}
              Buscar productos
            </button>
            {!hasFilters && (
              <span className="text-xs text-slate-500 flex items-center gap-1">
                <AlertTriangle size={13} /> Completá al menos un filtro
              </span>
            )}
          </div>
        </section>

        {/* Panel de porcentaje */}
        <section className="card p-5 space-y-3">
          <h2 className="text-sm font-semibold text-slate-300 uppercase tracking-wide">
            2 · Porcentaje de cambio
          </h2>
          <div className="flex items-center gap-4">
            <div className="flex flex-col gap-1 w-48">
              <span className="text-xs text-slate-400">Porcentaje (%)</span>
              <input
                type="number"
                step="0.1"
                className="input"
                placeholder="Ej: 10  ó  -5"
                value={percentage}
                onChange={(e) => setPercentage(e.target.value)}
              />
            </div>
            {validPct && (
              <div className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-semibold border ${
                pct > 0
                  ? 'bg-emerald-900/40 text-emerald-300 border-emerald-700'
                  : 'bg-red-900/40 text-red-300 border-red-700'
              }`}>
                {pct > 0
                  ? <TrendingUp size={16} />
                  : <TrendingDown size={16} />
                }
                {pct > 0 ? `▲ +${pct}%` : `▼ ${pct}%`}
              </div>
            )}
          </div>
        </section>

        {/* Tabla de previsualización */}
        {hasSearched && (
          <section className="card overflow-hidden">
            <div className="flex items-center justify-between px-5 py-3 border-b border-slate-700/60">
              <h2 className="text-sm font-semibold text-slate-300 uppercase tracking-wide">
                3 · Previsualización
              </h2>
              <span className="text-sm text-slate-400">
                {selectedIds.size} de {rows.length} seleccionados
              </span>
            </div>

            {rows.length === 0 ? (
              <div className="px-5 py-10 text-center text-slate-500 text-sm">
                No se encontraron productos con esos filtros.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-700/60 bg-slate-800/40">
                      <th className="w-10 px-4 py-2 text-left">
                        <input
                          type="checkbox"
                          checked={selectedIds.size === rows.length && rows.length > 0}
                          onChange={toggleAll}
                          className="rounded border-slate-600 bg-slate-700 accent-blue-500"
                        />
                      </th>
                      <th className="px-4 py-2 text-left text-slate-400 font-medium">Nombre</th>
                      <th className="px-4 py-2 text-left text-slate-400 font-medium">Marca</th>
                      <th className="px-4 py-2 text-left text-slate-400 font-medium">Categoría</th>
                      <th className="px-4 py-2 text-right text-slate-400 font-medium">Precio actual</th>
                      <th className="px-4 py-2 text-right text-slate-400 font-medium">Precio nuevo</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-700/40">
                    {rows.map((row) => {
                      const selected = selectedIds.has(row.id);
                      const np = newPrice(row.precio_venta);
                      const changed = validPct && np !== row.precio_venta;
                      return (
                        <tr
                          key={row.id}
                          className={`transition-colors ${selected ? 'hover:bg-slate-700/30' : 'opacity-40'}`}
                          onClick={() => toggleOne(row.id)}
                          style={{ cursor: 'pointer' }}
                        >
                          <td className="px-4 py-2" onClick={(e) => e.stopPropagation()}>
                            <input
                              type="checkbox"
                              checked={selected}
                              onChange={() => toggleOne(row.id)}
                              className="rounded border-slate-600 bg-slate-700 accent-blue-500"
                            />
                          </td>
                          <td className="px-4 py-2 text-slate-200 font-medium">{row.nombre}</td>
                          <td className="px-4 py-2 text-slate-400">{row.marca || '—'}</td>
                          <td className="px-4 py-2 text-slate-400">{row.categoria_nombre || '—'}</td>
                          <td className="px-4 py-2 text-right text-slate-300 tabular-nums">
                            {formatCurrency(row.precio_venta)}
                          </td>
                          <td className={`px-4 py-2 text-right font-semibold tabular-nums ${
                            !validPct || !selected
                              ? 'text-slate-500'
                              : changed
                                ? pct > 0 ? 'text-emerald-400' : 'text-red-400'
                                : 'text-slate-300'
                          }`}>
                            {selected && validPct ? formatCurrency(np) : '—'}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {/* Pie de tabla */}
            {rows.length > 0 && (
              <div className="flex items-center justify-between px-5 py-3 border-t border-slate-700/60 bg-slate-800/30">
                <span className="text-xs text-slate-400">
                  {selectedIds.size} producto{selectedIds.size !== 1 ? 's' : ''} seleccionado{selectedIds.size !== 1 ? 's' : ''}
                  {validPct && ` · ${pct > 0 ? '+' : ''}${pct}%`}
                </span>
                <button
                  className="btn btn-primary flex items-center gap-2"
                  disabled={!canApply || applying}
                  onClick={() => setShowConfirm(true)}
                >
                  {applying
                    ? <Loader2 size={16} className="animate-spin" />
                    : <Check size={16} />
                  }
                  Aplicar cambio
                </button>
              </div>
            )}
          </section>
        )}
      </div>

      {/* Modal de confirmación */}
      {showConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="card w-full max-w-sm p-6 space-y-4 shadow-2xl">
            <div className="flex items-start gap-3">
              <AlertTriangle size={22} className="text-amber-400 shrink-0 mt-0.5" />
              <div>
                <h3 className="font-semibold text-slate-100 text-lg">¿Confirmar cambio?</h3>
                <p className="text-sm text-slate-400 mt-1">
                  Vas a modificar el precio de{' '}
                  <span className="text-slate-200 font-semibold">{selectedIds.size} producto{selectedIds.size !== 1 ? 's' : ''}</span>{' '}
                  en{' '}
                  <span className={`font-semibold ${pct > 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                    {pct > 0 ? '+' : ''}{pct}%
                  </span>.
                  <br />Esta acción no se puede deshacer.
                </p>
              </div>
            </div>
            <div className="flex gap-3 justify-end pt-2">
              <button
                className="btn btn-sm btn-secondary flex items-center gap-1"
                onClick={() => setShowConfirm(false)}
              >
                <X size={14} /> Cancelar
              </button>
              <button
                className="btn btn-sm btn-primary flex items-center gap-1"
                onClick={handleApply}
              >
                <Check size={14} /> Confirmar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
