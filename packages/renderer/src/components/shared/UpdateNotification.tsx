import React, { useState, useEffect } from 'react';
import { Download, RefreshCw, X, CheckCircle } from 'lucide-react';

interface UpdateInfo {
  version: string;
  releaseDate?: string;
  releaseNotes?: string | { notes: string }[];
}

type UpdateState = 'idle' | 'available' | 'downloading' | 'ready' | 'error';

export const UpdateNotification: React.FC = () => {
  const [state, setState] = useState<UpdateState>('idle');
  const [info, setInfo] = useState<UpdateInfo | null>(null);
  const [progress, setProgress] = useState(0);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    const w = window as unknown as {
      electron?: {
        on: (ch: string, cb: (...args: unknown[]) => void) => (() => void);
      };
    };
    if (!w.electron) return;

    const cleanups = [
      w.electron.on('updater:not-available', () => setState('idle')),
      w.electron.on('updater:available', (...args) => {
        const i = args[0] as UpdateInfo;
        setInfo(i);
        setState('available');
        setDismissed(false);
      }),
      w.electron.on('updater:progress', (...args) => {
        const p = args[0] as { percent: number };
        setState('downloading');
        setProgress(p.percent ?? 0);
      }),
      w.electron.on('updater:downloaded', (...args) => {
        const i = args[0] as UpdateInfo;
        setInfo(i);
        setState('ready');
        setDismissed(false);
      }),
      w.electron.on('updater:error', () => setState('error')),
    ];

    return () => cleanups.forEach((fn) => fn());
  }, []);

  const handleDownload = () => {
    (window as unknown as { electron: { invoke: (ch: string) => void } }).electron.invoke('updater:download');
  };

  const handleInstall = () => {
    (window as unknown as { electron: { invoke: (ch: string) => void } }).electron.invoke('updater:install');
  };

  if (state === 'idle' || dismissed) return null;

  const notes = info?.releaseNotes
    ? typeof info.releaseNotes === 'string'
      ? info.releaseNotes
      : (info.releaseNotes as { notes: string }[]).map((n) => n.notes).join(' ')
    : null;

  return (
    <div
      style={{
        position: 'fixed',
        bottom: 24,
        right: 24,
        zIndex: 9999,
        background: '#131720',
        border: '1px solid #2a3148',
        borderRadius: 14,
        padding: '16px 18px',
        width: 320,
        boxShadow: '0 8px 40px rgba(0,0,0,0.55)',
        fontFamily: "'Syne', sans-serif",
      }}
    >
      {/* Descargando */}
      {state === 'downloading' && (
        <div>
          <p style={{ fontSize: 13, fontWeight: 600, color: '#e2e8f0', marginBottom: 12 }}>
            ⬇️ Descargando actualización...
          </p>
          <div style={{ background: '#0d0f14', borderRadius: 20, height: 6, overflow: 'hidden', marginBottom: 6 }}>
            <div
              style={{
                background: '#4f8ef7',
                height: '100%',
                width: `${progress}%`,
                borderRadius: 20,
                transition: 'width 0.3s ease',
              }}
            />
          </div>
          <p style={{ fontSize: 11, color: '#64748b', textAlign: 'right' }}>{progress}%</p>
        </div>
      )}

      {/* Disponible */}
      {state === 'available' && info && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
            <div>
              <p style={{ fontSize: 13, fontWeight: 700, color: '#e2e8f0', margin: 0 }}>
                🆕 Nueva versión disponible
              </p>
              <p style={{ fontSize: 11, color: '#64748b', margin: '3px 0 0' }}>
                ARIESPos v{info.version}
              </p>
            </div>
            <button
              onClick={() => setDismissed(true)}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b', padding: 4, lineHeight: 1 }}
            >
              <X size={13} />
            </button>
          </div>
          {notes && (
            <p style={{ fontSize: 11, color: '#94a3b8', marginBottom: 12, lineHeight: 1.6 }}>
              {notes.slice(0, 140)}{notes.length > 140 ? '...' : ''}
            </p>
          )}
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              onClick={handleDownload}
              style={{
                flex: 1,
                padding: '8px 12px',
                background: '#4f8ef7',
                color: '#fff',
                border: 'none',
                borderRadius: 7,
                fontSize: 12,
                fontWeight: 600,
                cursor: 'pointer',
                fontFamily: "'Syne', sans-serif",
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 6,
              }}
            >
              <Download size={12} /> Descargar
            </button>
            <button
              onClick={() => setDismissed(true)}
              style={{
                padding: '8px 12px',
                background: 'transparent',
                color: '#64748b',
                border: '1px solid #2a3148',
                borderRadius: 7,
                fontSize: 12,
                cursor: 'pointer',
                fontFamily: "'Syne', sans-serif",
              }}
            >
              Después
            </button>
          </div>
        </div>
      )}

      {/* Lista para instalar */}
      {state === 'ready' && info && (
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
            <CheckCircle size={15} color="#10b981" />
            <p style={{ fontSize: 13, fontWeight: 700, color: '#e2e8f0', margin: 0 }}>
              v{info.version} lista para instalar
            </p>
          </div>
          <p style={{ fontSize: 11, color: '#64748b', marginBottom: 14, lineHeight: 1.6 }}>
            El programa se va a reiniciar para aplicar la actualización.
          </p>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              onClick={handleInstall}
              style={{
                flex: 1,
                padding: '8px 12px',
                background: '#10b981',
                color: '#fff',
                border: 'none',
                borderRadius: 7,
                fontSize: 12,
                fontWeight: 600,
                cursor: 'pointer',
                fontFamily: "'Syne', sans-serif",
              }}
            >
              Reiniciar e instalar
            </button>
            <button
              onClick={() => setDismissed(true)}
              style={{
                padding: '8px 12px',
                background: 'transparent',
                color: '#64748b',
                border: '1px solid #2a3148',
                borderRadius: 7,
                fontSize: 12,
                cursor: 'pointer',
                fontFamily: "'Syne', sans-serif",
              }}
            >
              Al cerrar
            </button>
          </div>
        </div>
      )}

      {/* Error (silencioso, solo si alguien espera una respuesta) */}
      {state === 'error' && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <RefreshCw size={13} color="#64748b" />
          <span style={{ fontSize: 12, color: '#64748b' }}>
            No se pudo verificar actualizaciones
          </span>
          <button
            onClick={() => setDismissed(true)}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b', padding: 0, marginLeft: 'auto' }}
          >
            <X size={13} />
          </button>
        </div>
      )}
    </div>
  );
};
