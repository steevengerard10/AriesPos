import React, { useState, useRef } from 'react';
import { Trash2, ChevronUp, ChevronDown, AlertTriangle } from 'lucide-react';
import { useVentasStore, CartItem } from '../../store/useVentasStore';
import { formatCurrency } from '../../lib/utils';
import { sendEvent } from '../../lib/api';
import { useTranslation } from 'react-i18next';

// Fracciones rápidas por unidad (igual que Nextar)
const FRACTION_SHORTCUTS: Record<string, { qty: number; label: string }[]> = {
  kg:      [{ qty: 0.25, label: '250g' }, { qty: 0.5, label: '½kg' }, { qty: 0.75, label: '750g' }, { qty: 1, label: '1kg' }],
  kilo:    [{ qty: 0.25, label: '250g' }, { qty: 0.5, label: '½kg' }, { qty: 0.75, label: '750g' }, { qty: 1, label: '1kg' }],
  litro:   [{ qty: 0.25, label: '¼L' },  { qty: 0.5, label: '½L' },  { qty: 0.75, label: '¾L' },  { qty: 1, label: '1L' }],
  metro:   [{ qty: 0.25, label: '25cm' }, { qty: 0.5, label: '50cm' }, { qty: 1, label: '1m' }, { qty: 1.5, label: '1.5m' }],
};

function getFractionShortcuts(unit: string): { qty: number; label: string }[] | null {
  const u = unit.toLowerCase().trim();
  return FRACTION_SHORTCUTS[u] ?? null;
}

interface CartTableProps {
  simbolo?: string;
}

export const CartTable: React.FC<CartTableProps> = ({ simbolo = '$' }) => {
  const { cart, updateItem, removeItem } = useVentasStore();
  const [editingCell, setEditingCell] = useState<{
    itemId: string;
    field: 'cantidad' | 'precio_unitario' | 'descuento';
  } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const { t } = useTranslation();

  if (cart.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center text-slate-500">
        <div className="text-center">
          <div className="text-4xl mb-3">🛒</div>
          <p className="text-sm">{t('cart.empty')}</p>
          <p className="text-xs mt-1 text-slate-600">{t('cart.emptyBarcode')}</p>
        </div>
      </div>
    );
  }

  const startEdit = (itemId: string, field: 'cantidad' | 'precio_unitario' | 'descuento') => {
    setEditingCell({ itemId, field });
    setTimeout(() => inputRef.current?.select(), 10);
  };

  const commitEdit = (item: CartItem, field: string, value: string) => {
    const num = parseFloat(value);
    if (isNaN(num) || num < 0) {
      setEditingCell(null);
      return;
    }
    if (field === 'cantidad' && !item.fraccionable && !Number.isInteger(num)) {
      setEditingCell(null);
      return;
    }
    updateItem(item.itemId, { [field]: num });
    setEditingCell(null);
  };

  return (
    <div className="flex-1 overflow-auto">
      <table className="w-full text-sm">
        <thead className="hidden">
          <tr>
            <th></th><th></th><th></th><th></th><th></th><th></th>
          </tr>
        </thead>
        <tbody>
          {cart.map((item) => (
            <tr key={item.itemId} className="table-row group">
              <td className="table-cell">
                <div className="font-medium text-white">{item.nombre}</div>
                <div className="text-xs text-slate-500">
                  {item.unidad_medida}
                  {item.fraccionable && <span className="ml-1.5 text-amber-500/80">· fraccionable</span>}
                </div>
              </td>

              {/* Cantidad */}
              <td className="table-cell text-center">
                {editingCell?.itemId === item.itemId && editingCell.field === 'cantidad' ? (
                  <input
                    ref={inputRef}
                    type="number"
                    defaultValue={item.cantidad}
                    step={item.fraccionable ? '0.001' : '1'}
                    min={item.fraccionable ? '0.001' : '1'}
                    className="input text-center w-full py-1 px-2 text-sm font-mono"
                    onBlur={(e) => commitEdit(item, 'cantidad', e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') commitEdit(item, 'cantidad', e.currentTarget.value);
                      if (e.key === 'Escape') setEditingCell(null);
                    }}
                    autoFocus
                  />
                ) : (
                  <div>
                    <div className="flex items-center justify-center gap-1">
                      <button
                        className="w-6 h-6 rounded hover:bg-slate-600 flex items-center justify-center text-slate-400 hover:text-white"
                        onClick={() => {
                          const step = item.fraccionable ? 0.1 : 1;
                          const newQty = Math.max(step, parseFloat((item.cantidad - step).toFixed(3)));
                          updateItem(item.itemId, { cantidad: newQty });
                        }}
                      >
                        <ChevronDown size={12} />
                      </button>
                      <button
                        className="font-mono font-semibold min-w-[2.5rem] hover:text-blue-400 transition-colors"
                        onClick={() => startEdit(item.itemId, 'cantidad')}
                        title="Click para editar cantidad"
                      >
                        {item.fraccionable
                          ? `${item.cantidad.toFixed(3)} ${item.unidad_medida}`
                          : item.cantidad}
                      </button>
                      <button
                        className="w-6 h-6 rounded hover:bg-slate-600 flex items-center justify-center text-slate-400 hover:text-white"
                        onClick={() => {
                          const step = item.fraccionable ? 0.1 : 1;
                          const newQty = parseFloat((item.cantidad + step).toFixed(3));
                          updateItem(item.itemId, { cantidad: newQty });
                        }}
                      >
                        <ChevronUp size={12} />
                      </button>
                    </div>
                    {/* Botones de fracción rápida (solo para fraccionables) */}
                    {item.fraccionable && (() => {
                      const shortcuts = getFractionShortcuts(item.unidad_medida);
                      if (!shortcuts) return null;
                      return (
                        <div className="flex gap-0.5 mt-1">
                          {shortcuts.map(s => (
                            <button
                              key={s.qty}
                              onClick={() => updateItem(item.itemId, { cantidad: s.qty })}
                              className="flex-1 text-[9px] font-mono py-0.5 px-0 rounded bg-slate-700/60 hover:bg-slate-600 text-slate-400 hover:text-amber-400 border border-transparent hover:border-amber-400/30 transition-all"
                            >
                              {s.label}
                            </button>
                          ))}
                        </div>
                      );
                    })()}
                  </div>
                )}
              </td>

              {/* Precio unitario — editable, con indicador si fue modificado */}
              <td className="table-cell text-right">
                {editingCell?.itemId === item.itemId && editingCell.field === 'precio_unitario' ? (
                  <input
                    ref={inputRef}
                    type="number"
                    defaultValue={item.precio_unitario}
                    step="0.01"
                    min="0"
                    className="input text-right w-full py-1 px-2 text-sm font-mono"
                    onBlur={(e) => commitEdit(item, 'precio_unitario', e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') commitEdit(item, 'precio_unitario', e.currentTarget.value);
                      if (e.key === 'Escape') setEditingCell(null);
                    }}
                    autoFocus
                  />
                ) : (() => {
                  const modified = item.precio_unitario !== item.precio_original;
                  return (
                    <div className="flex flex-col items-end gap-0.5">
                      <button
                        onClick={() => startEdit(item.itemId, 'precio_unitario')}
                        title="Click para editar precio en esta venta"
                        className={`font-mono text-sm flex items-center gap-1 px-1.5 py-0.5 rounded transition-colors ${
                          modified
                            ? 'text-amber-400 bg-amber-400/10 border border-amber-400/30 hover:bg-amber-400/20'
                            : 'text-slate-200 hover:text-blue-400'
                        }`}
                      >
                        {modified && <AlertTriangle size={10} />}
                        {formatCurrency(item.precio_unitario, simbolo)}
                      </button>
                      {modified && (
                        <span className="font-mono text-xs text-slate-600 line-through">
                          {formatCurrency(item.precio_original, simbolo)}
                        </span>
                      )}
                    </div>
                  );
                })()}
              </td>

              {/* Descuento */}
              <td className="table-cell text-right">
                {editingCell?.itemId === item.itemId && editingCell.field === 'descuento' ? (
                  <input
                    ref={inputRef}
                    type="number"
                    defaultValue={item.descuento}
                    step="0.01"
                    min="0"
                    className="input text-right w-full py-1 px-2 text-sm font-mono"
                    onBlur={(e) => commitEdit(item, 'descuento', e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') commitEdit(item, 'descuento', e.currentTarget.value);
                      if (e.key === 'Escape') setEditingCell(null);
                    }}
                    autoFocus
                  />
                ) : (
                  <button
                    className={`font-mono hover:text-amber-400 transition-colors ${item.descuento > 0 ? 'text-amber-400' : 'text-slate-500'}`}
                    onClick={() => startEdit(item.itemId, 'descuento')}
                    title="Click para editar descuento"
                  >
                    {item.descuento > 0 ? `-${formatCurrency(item.descuento, simbolo)}` : '—'}
                  </button>
                )}
              </td>

              {/* Total */}
              <td className="table-cell text-right font-mono font-bold text-white">
                {formatCurrency(item.total, simbolo)}
              </td>

              {/* Eliminar */}
              <td className="table-cell">
                <button
                  className="btn-ghost btn p-1.5 opacity-0 group-hover:opacity-100 hover:text-red-400 transition-all"
                  onClick={() => {
                    sendEvent('broadcast-event', 'pos:alert', { type: 'item_removed', message: item.nombre, detail: `${item.cantidad} × ${formatCurrency(item.precio_unitario, simbolo)} = ${formatCurrency(item.total, simbolo)}` });
                    removeItem(item.itemId);
                  }}
                >
                  <Trash2 size={14} />
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};
