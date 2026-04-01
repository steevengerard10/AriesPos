import React, { useState, useEffect, useCallback, useRef } from 'react';
import { X, Archive, CheckCircle, AlertTriangle, Loader2, FolderOpen } from 'lucide-react';

interface ProgressEvent {
  step: string;
  percent: number;
  detail?: string;
}

interface ImportResult {
  success: boolean;
  productos: number;
  categorias: number;
  clientes: number;
  skipped: number;
  errores: string[];
  duracion: number;
}

interface Props {
  onClose: () => void;
}

type Stage = 'idle' | 'importing' | 'done' | 'error';

const electron = () =>
  (window as unknown as { electron: { invoke: (c: string, ...a: unknown[]) => Promise<unknown>; on: (c: string, cb: (...a: unknown[]) => void) => () => void } }).electron;

export const ImportNixtarModal: React.FC<Props> = ({ onClose }) => {
  const [stage, setStage] = useState<Stage>('idle');
  const [progress, setProgress] = useState<ProgressEvent>({ step: '', percent: 0 });
  const [result, setResult] = useState<ImportResult | null>(null);
  const [errorMsg, setErrorMsg] = useState('');
  const progressBarRef = useRef<HTMLDivElement>(null);

  // Update progress bar width imperatively to avoid inline style lint rule
  useEffect(() => {
    if (progressBarRef.current) {
      progressBarRef.current.style.width = `${progress.percent}%`;
    }
  }, [progress.percent]);

  useEffect(() => {
    const unsub = electron().on('nextar:progress', (p) => {
      setProgress(p as ProgressEvent);
    });
    return unsub;
  }, []);

  const runImport = useCallback(async (zipPath?: string) => {
    setStage('importing');
    setProgress({ step: 'Iniciando...', percent: 0 });
    try {
      const res = await electron().invoke('nextar:importBackup', zipPath) as ImportResult;
      if (res.success) {
        setResult(res);
        setStage('done');
      } else {
        setErrorMsg(res.errores?.[0] || 'Error desconocido');
        setResult(res);
        setStage('error');
      }
    } catch (err) {
      setErrorMsg(String(err));
      setStage('error');
    }
  }, []);

  const handleAutoImport = useCallback(() => {
    runImport(undefined);
  }, [runImport]);

  const handleSelectFile = useCallback(async () => {
    const zipPath = await electron().invoke('nextar:selectBackup') as string | null;
    if (!zipPath) return;
    runImport(zipPath);
  }, [runImport]);

  const handleClose = () => {
    if (stage === 'importing') return;
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4" onClick={(e) => { if (e.target === e.currentTarget) handleClose(); }}>
      <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-lg shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-700">
          <h2 className="text-lg font-semibold text-white flex items-center gap-2">
            <Archive size={20} className="text-blue-400" />
            Importar backup completo de Nextar
          </h2>
          {stage !== 'importing' && (
            <button onClick={handleClose} title="Cerrar" className="text-slate-400 hover:text-white transition-colors">
              <X size={20} />
            </button>
          )}
        </div>

        {/* Body */}
        <div className="px-6 py-5">
          {stage === 'idle' && (
            <div className="space-y-4">
              <p className="text-sm text-slate-300">
                Importa <strong className="text-white">productos, clientes y categorías</strong> desde el archivo de backup de Nextar (<code className="text-blue-300">.zip</code>).
              </p>
              <div className="bg-amber-900/30 border border-amber-700/50 rounded-lg px-4 py-3 text-xs text-amber-300">
                ⚠️ Los productos y categorías existentes serán <strong>reemplazados</strong>. Los clientes nuevos se agregan sin borrar los existentes.
              </div>
              <div className="space-y-2 pt-2">
                <button
                  className="btn btn-primary w-full flex items-center justify-center gap-2"
                  onClick={handleAutoImport}
                >
                  <Archive size={16} />
                  Importar desde C:\Nex\backup (automático)
                </button>
                <button
                  className="btn btn-secondary w-full flex items-center justify-center gap-2"
                  onClick={handleSelectFile}
                >
                  <FolderOpen size={16} />
                  Elegir archivo .zip...
                </button>
              </div>
            </div>
          )}

          {stage === 'importing' && (
            <div className="space-y-5">
              <div className="flex items-center gap-3">
                <Loader2 size={20} className="text-blue-400 animate-spin shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-white truncate">{progress.step}</p>
                  {progress.detail && <p className="text-xs text-slate-400 truncate mt-0.5">{progress.detail}</p>}
                </div>
                <span className="text-sm font-mono text-blue-400 shrink-0">{progress.percent}%</span>
              </div>
              {/* Progress bar */}
              <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
                <div
                  ref={progressBarRef}
                  className="h-full bg-blue-500 rounded-full transition-all duration-300"
                />
              </div>
              <p className="text-xs text-slate-500 text-center">No cierres la ventana mientras se importa...</p>
            </div>
          )}

          {stage === 'done' && result && (
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-green-400">
                <CheckCircle size={20} />
                <span className="font-semibold">Importación completada en {(result.duracion / 1000).toFixed(1)}s</span>
              </div>
              <div className="grid grid-cols-3 gap-3">
                {([
                  { label: 'Productos', value: result.productos, color: 'text-blue-400' },
                  { label: 'Categorías', value: result.categorias, color: 'text-purple-400' },
                  { label: 'Clientes', value: result.clientes, color: 'text-green-400' },
                ] as { label: string; value: number; color: string }[]).map((item) => (
                  <div key={item.label} className="bg-slate-800 border border-slate-700 rounded-xl p-3 text-center">
                    <div className={`text-2xl font-bold ${item.color}`}>{item.value}</div>
                    <div className="text-xs text-slate-400 mt-0.5">{item.label}</div>
                  </div>
                ))}
              </div>
              {result.skipped > 0 && (
                <p className="text-xs text-slate-400">Omitidos: {result.skipped} registros inválidos</p>
              )}
              {result.errores.length > 0 && (
                <details className="bg-slate-800 border border-slate-700 rounded-lg">
                  <summary className="px-3 py-2 text-xs text-amber-400 cursor-pointer">
                    {result.errores.length} advertencias (no críticas)
                  </summary>
                  <ul className="px-3 pb-2 space-y-0.5 max-h-32 overflow-auto">
                    {result.errores.slice(0, 20).map((e, i) => (
                      <li key={i} className="text-xs text-slate-400">{e}</li>
                    ))}
                  </ul>
                </details>
              )}
              <button className="btn btn-primary w-full" onClick={onClose}>Cerrar</button>
            </div>
          )}

          {stage === 'error' && (
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-red-400">
                <AlertTriangle size={20} />
                <span className="font-semibold">Error en la importación</span>
              </div>
              <p className="text-sm text-slate-300 bg-red-900/20 border border-red-800/50 rounded-lg px-3 py-2">
                {errorMsg}
              </p>
              {result?.errores && result.errores.length > 0 && (
                <ul className="space-y-1 max-h-32 overflow-auto">
                  {result.errores.slice(0, 10).map((e, i) => (
                    <li key={i} className="text-xs text-red-300">• {e}</li>
                  ))}
                </ul>
              )}
              <div className="flex gap-2">
                <button className="btn btn-secondary flex-1" onClick={() => { setStage('idle'); setErrorMsg(''); setResult(null); }}>
                  Reintentar
                </button>
                <button className="btn btn-ghost flex-1" onClick={onClose}>Cerrar</button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
