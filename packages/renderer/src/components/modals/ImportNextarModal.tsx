import React, { useState } from 'react';
import { Upload, CheckCircle, AlertCircle, X, FileText, ArrowRight, Archive, FolderOpen } from 'lucide-react';

interface ImportNextarModalProps {
  onClose: () => void;
  onSuccess: () => void;
}

type Status = 'idle' | 'loading' | 'success' | 'error';

interface ImportResult {
  imported: number;
  skipped: number;
  errors: string[];
}

export const ImportNextarModal: React.FC<ImportNextarModalProps> = ({ onClose, onSuccess }) => {
  const [status, setStatus] = useState<Status>('idle');
  const [result, setResult] = useState<ImportResult | null>(null);
  const [loadingMessage, setLoadingMessage] = useState('Procesando archivo...');

  const handleSelectFile = async () => {    try {
      const filePaths = await window.electron!.invoke('dialog:showOpenDialog', {
        title: 'Seleccionar archivo de Nextar',
        filters: [
          { name: 'Archivos de Nextar', extensions: ['csv', 'txt', 'tsv'] },
          { name: 'Todos los archivos', extensions: ['*'] },
        ],
        properties: ['openFile'],
      }) as string[];

      if (!filePaths || filePaths.length === 0) return;

      setStatus('loading');
      setResult(null);
      setLoadingMessage('Procesando archivo CSV...');

      const res = await window.electron!.invoke('productos:importFromNextar', filePaths[0]) as {
        success: boolean;
        imported: number;
        skipped: number;
        errors: string[];
      };

      if (res.success || res.imported > 0) {
        setStatus('success');
        setResult({ imported: res.imported, skipped: res.skipped, errors: res.errors });
        onSuccess();
      } else {
        setStatus('error');
        setResult({ imported: 0, skipped: res.skipped ?? 0, errors: res.errors });
      }
    } catch (err) {
      setStatus('error');
      setResult({ imported: 0, skipped: 0, errors: [String(err)] });
    }
  };

  const handleImportFromZip = async (customPath?: string) => {
    try {
      setStatus('loading');
      setResult(null);
      setLoadingMessage('Leyendo backup ZIP de Nextar...');

      const res = await window.electron!.invoke('productos:importFromZip', customPath) as {
        success: boolean;
        imported: number;
        skipped: number;
        errors: string[];
      };

      if (res.success || res.imported > 0) {
        setStatus('success');
        setResult({ imported: res.imported, skipped: res.skipped || 0, errors: res.errors || [] });
        onSuccess();
      } else {
        setStatus('error');
        setResult({ imported: 0, skipped: res.skipped ?? 0, errors: res.errors ?? ['No se importaron productos'] });
      }
    } catch (err) {
      setStatus('error');
      setResult({ imported: 0, skipped: 0, errors: [String(err)] });
    }
  };

  const handlePickZip = async () => {
    try {
      const filePaths = await window.electron!.invoke('dialog:showOpenDialog', {
        title: 'Seleccionar backup ZIP de Nextar',
        filters: [{ name: 'Backup Nextar', extensions: ['zip'] }],
        defaultPath: 'C:\\Nex\\backup',
        properties: ['openFile'],
      }) as string[];
      if (!filePaths || filePaths.length === 0) return;
      await handleImportFromZip(filePaths[0]);
    } catch (err) {
      setStatus('error');
      setResult({ imported: 0, skipped: 0, errors: [String(err)] });
    }
  };

  const handlePickFolder = async () => {
    try {
      const folderPaths = await window.electron!.invoke('dialog:showOpenDialog', {
        title: 'Seleccionar carpeta de backup de Nextar',
        properties: ['openDirectory'],
      }) as string[];
      if (!folderPaths || folderPaths.length === 0) return;

      setStatus('loading');
      setResult(null);
      setLoadingMessage('Leyendo archivos de la carpeta de backup...');

      const res = await window.electron!.invoke('productos:importFromFolder', folderPaths[0]) as {
        success: boolean;
        imported: number;
        skipped: number;
        errors: string[];
      };

      if (res.success || res.imported > 0) {
        setStatus('success');
        setResult({ imported: res.imported, skipped: res.skipped || 0, errors: res.errors || [] });
        onSuccess();
      } else {
        setStatus('error');
        setResult({ imported: 0, skipped: res.skipped ?? 0, errors: res.errors ?? ['No se importaron productos'] });
      }
    } catch (err) {
      setStatus('error');
      setResult({ imported: 0, skipped: 0, errors: [String(err)] });
    }
  };

  return (
    <div className="flex flex-col gap-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <FileText size={20} className="text-blue-400" />
          <h2 className="text-lg font-semibold text-white">Importar desde Nextar</h2>
        </div>
        <button
          onClick={onClose}
          className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-white hover:bg-slate-700 transition-colors"
        >
          <X size={16} />
        </button>
      </div>

      {/* Contenido */}
      {status === 'idle' && (
        <div className="flex flex-col gap-4">
          <p className="text-sm text-slate-400 leading-relaxed">
            Seleccioná el archivo CSV exportado desde Nextar. ARIESPos detecta la codificación
            automáticamente — no necesitás convertirlo ni modificarlo.
          </p>

          {/* Zona de upload */}
          <button
            onClick={handleSelectFile}
            className="flex flex-col items-center justify-center gap-3 border-2 border-dashed border-slate-600 hover:border-blue-500/60 rounded-xl p-8 transition-colors group"
          >
            <Upload size={32} className="text-slate-500 group-hover:text-blue-400 transition-colors" />
            <div className="text-center">
              <p className="font-medium text-white">Hacer clic para seleccionar el archivo</p>
              <p className="text-xs text-slate-500 mt-1">Compatible con Nextar 1.x, 2.x y 3.x — .csv, .txt, .tsv</p>
            </div>
          </button>

          {/* Tip */}
          <div className="flex gap-2 p-3 rounded-lg bg-amber-500/8 border border-amber-500/20">
            <ArrowRight size={14} className="text-amber-400 mt-0.5 shrink-0" />
            <p className="text-xs text-amber-200/80 leading-relaxed">
              <strong className="text-amber-300">En Nextar:</strong> ir a Productos → Exportar → CSV.
              Si los caracteres aparecen rotos (ñ, tildes, símbolos raros), importá igual — ARIESPos lo convierte solo.
            </p>
          </div>

          {/* Info columnas soportadas */}
          <div className="text-xs text-slate-500">
            <p className="mb-1 font-medium text-slate-400">Columnas reconocidas automáticamente:</p>
            <p>Código · Nombre · Precio de Venta · Precio de Costo · Stock · Unidad · Categoría · Código de Barras · Precio 2 · Precio 3</p>
          </div>

          {/* Separador */}
          <div className="border-t border-slate-700 pt-1">
            <p className="text-xs text-slate-500 mb-3">O importá directo del backup de Nextar (archivo .zip o carpeta)</p>
            <div className="flex gap-2 mb-2">
              <button
                onClick={() => handleImportFromZip(undefined)}
                className="flex items-center gap-2 flex-1 justify-center px-3 py-2.5 rounded-lg bg-slate-700 hover:bg-slate-600 text-white text-sm font-medium transition-colors"
                title="Importa del último .zip encontrado en C:\Nex\backup"
              >
                <Archive size={16} className="text-blue-400" />
                Importar desde C:\Nex\backup
              </button>
              <button
                onClick={handlePickZip}
                className="px-3 py-2.5 rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-300 text-xs transition-colors"
                title="Elegir otro archivo .zip manualmente"
              >
                Elegir otro ZIP...
              </button>
            </div>
            <button
              onClick={handlePickFolder}
              className="flex items-center gap-2 w-full justify-center px-3 py-2.5 rounded-lg bg-slate-700 hover:bg-slate-600 text-white text-sm font-medium transition-colors"
              title="Seleccionar una carpeta que contiene los archivos de backup de Nextar"
            >
              <FolderOpen size={16} className="text-amber-400" />
              Seleccionar carpeta de backup...
            </button>
          </div>
        </div>
      )}

      {status === 'loading' && (
        <div className="flex flex-col items-center justify-center py-10 gap-4">
          <div className="w-10 h-10 border-3 border-slate-600 border-t-blue-500 rounded-full animate-spin" />
          <p className="text-slate-400 text-sm">{loadingMessage}</p>
        </div>
      )}

      {status === 'success' && result && (
        <div className="flex flex-col gap-4">
          <div className="flex items-center gap-3 p-4 rounded-xl bg-green-500/10 border border-green-500/20">
            <CheckCircle size={24} className="text-green-400 shrink-0" />
            <div>
              <p className="font-semibold text-white">{result.imported} productos importados correctamente</p>
              {result.skipped > 0 && (
                <p className="text-xs text-slate-400 mt-0.5">{result.skipped} filas omitidas (sin nombre o inválidas)</p>
              )}
            </div>
          </div>

          {result.errors.length > 0 && (
            <div className="rounded-xl bg-amber-500/8 border border-amber-500/20 p-3">
              <p className="text-xs font-medium text-amber-300 mb-2">{result.errors.length} advertencias:</p>
              <div className="max-h-32 overflow-y-auto flex flex-col gap-1">
                {result.errors.map((e, i) => (
                  <p key={i} className="text-xs text-slate-400 font-mono">{e}</p>
                ))}
              </div>
            </div>
          )}

          <div className="flex gap-3">
            <button
              onClick={() => { setStatus('idle'); setResult(null); }}
              className="btn btn-secondary flex-1"
            >
              Importar otro archivo
            </button>
            <button onClick={onClose} className="btn btn-primary flex-1">
              Listo
            </button>
          </div>
        </div>
      )}

      {status === 'error' && result && (
        <div className="flex flex-col gap-4">
          <div className="flex items-start gap-3 p-4 rounded-xl bg-red-500/10 border border-red-500/20">
            <AlertCircle size={20} className="text-red-400 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-white">Error al importar</p>
              <div className="mt-2 flex flex-col gap-1">
                {result.errors.map((e, i) => (
                  <p key={i} className="text-xs text-red-300/80">{e}</p>
                ))}
              </div>
            </div>
          </div>

          <button
            onClick={() => { setStatus('idle'); setResult(null); }}
            className="btn btn-secondary w-full"
          >
            Intentar de nuevo
          </button>
        </div>
      )}
    </div>
  );
};
