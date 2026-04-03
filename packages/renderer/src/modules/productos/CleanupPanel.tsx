import React, { useState } from 'react';
import { Trash2, RefreshCw, ChevronDown, ChevronUp } from 'lucide-react';
import toast from 'react-hot-toast';
import { productosAPI } from '../../lib/api';

interface CleanupResult {
  deleted: number;
  pt: number;
  en: number;
  basura: number;
}

export const CleanupPanel: React.FC<{ onDone: () => void }> = ({ onDone }) => {
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<CleanupResult | null>(null);
  const [showDetail, setShowDetail] = useState(false);

  const run = async () => {
    setRunning(true);
    setResult(null);
    try {
      const r = await productosAPI.limpiarBasura() as CleanupResult;
      setResult(r);
      if (r.deleted > 0) {
        toast.success(`${r.deleted} productos basura eliminados`);
        onDone();
      } else {
        toast.success('No se encontraron productos basura');
      }
    } catch {
      toast.error('Error al limpiar productos');
    } finally {
      setRunning(false);
    }
  };

  return (
    <div className="rounded-lg border border-slate-700 bg-slate-900 p-4 mb-4">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-slate-200 mb-1">Limpiar productos basura</p>
          <p className="text-xs text-slate-500 leading-relaxed">
            Elimina entradas inválidas importadas de Nextar:
            <span className="text-red-400"> términos técnicos en inglés</span> (NexusDB),
            <span className="text-amber-400"> campos de sistema en portugués</span> (Nextar Brasil),
            y&nbsp;<span className="text-slate-400"> fragmentos binarios</span> sin sentido.
          </p>

          {/* Desglose de tipos */}
          <div className="mt-2 flex flex-wrap gap-2">
            {[
              { color: 'bg-red-900 border-red-700 text-red-300', label: 'Inglés (NexusDB)', example: 'StreamDescriptor, BlobHeap…' },
              { color: 'bg-amber-900 border-amber-700 text-amber-300', label: 'Portugués (Nextar)', example: 'Produto, Estoque, Fornecedor…' },
              { color: 'bg-slate-800 border-slate-600 text-slate-400', label: 'Basura binaria', example: 'j7, LY, *$, fragmentos…' },
            ].map(item => (
              <div key={item.label} className={`text-xs px-2 py-1 rounded border ${item.color}`}>
                <span className="font-semibold">{item.label}</span>
                <span className="ml-1 opacity-70">{item.example}</span>
              </div>
            ))}
          </div>
        </div>

        <button
          onClick={run}
          disabled={running}
          className="shrink-0 btn btn-sm bg-orange-900 hover:bg-orange-800 text-orange-200 border border-orange-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {running
            ? <><RefreshCw size={13} className="animate-spin" /> Limpiando…</>
            : <><Trash2 size={13} /> Limpiar ahora</>
          }
        </button>
      </div>

      {/* Resultado */}
      {result && result.deleted > 0 && (
        <div className="mt-3 pt-3 border-t border-slate-700">
          <div className="grid grid-cols-3 gap-2 mb-2">
            {[
              { value: result.en,     label: 'Inglés (NexusDB)',   cls: 'text-red-400' },
              { value: result.pt,     label: 'Portugués (Nextar)', cls: 'text-amber-400' },
              { value: result.basura, label: 'Binario/basura',     cls: 'text-slate-400' },
            ].map(item => (
              <div key={item.label} className="bg-slate-800 rounded p-2 text-center">
                <p className={`text-lg font-bold font-mono ${item.cls}`}>{item.value}</p>
                <p className="text-xs text-slate-500">{item.label}</p>
              </div>
            ))}
          </div>
          <button
            onClick={() => setShowDetail(v => !v)}
            className="flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300"
          >
            {showDetail ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
            Total eliminados: <strong className="font-mono">{result.deleted}</strong>
          </button>
        </div>
      )}

      {result && result.deleted === 0 && (
        <p className="mt-2 text-xs text-emerald-400">✓ No se encontraron productos basura</p>
      )}
    </div>
  );
};
