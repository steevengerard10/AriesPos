import React from 'react';
import { WifiOff, RefreshCw, Settings } from 'lucide-react';
import { appAPI } from '../lib/api';

interface ConnectionLostScreenProps {
  serverIP: string;
}

export const ConnectionLostScreen: React.FC<ConnectionLostScreenProps> = ({ serverIP }) => {
  const handleReset = async () => {
    await appAPI.resetAppConfig();
    await appAPI.restart();
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'var(--bg, #0f172a)',
        color: 'var(--text, #e2e8f0)',
        fontFamily: "'Syne', sans-serif",
        gap: 16,
        padding: 32,
        WebkitAppRegion: 'drag',
      } as React.CSSProperties}
    >
      <WifiOff size={56} color="#ef4444" strokeWidth={1.5} />
      <h2 style={{ fontSize: 22, fontWeight: 700, margin: 0, textAlign: 'center' }}>
        Conexión perdida con el servidor
      </h2>
      <p style={{ fontSize: 14, color: 'var(--text2, #94a3b8)', textAlign: 'center', maxWidth: 360, lineHeight: 1.6, margin: 0 }}>
        No se puede conectar a{' '}
        <span style={{ color: '#4f8ef7', fontFamily: 'monospace', fontWeight: 600 }}>
          {serverIP}:3001
        </span>
        <br />
        Verificá que la PC servidor esté encendida y con ARIESPos abierto.
      </p>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          fontSize: 13,
          color: 'var(--text3, #64748b)',
          background: 'var(--bg2, #1e293b)',
          padding: '8px 16px',
          borderRadius: 8,
        }}
      >
        <RefreshCw size={14} style={{ animation: 'spin 1.5s linear infinite' }} />
        Reintentando conexión automáticamente...
      </div>
      <button
        onClick={handleReset}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          marginTop: 8,
          padding: '10px 20px',
          borderRadius: 8,
          border: '1px solid var(--border, #334155)',
          background: 'var(--bg2, #1e293b)',
          color: 'var(--text2, #94a3b8)',
          cursor: 'pointer',
          fontSize: 13,
          fontFamily: 'inherit',
          WebkitAppRegion: 'no-drag',
        } as React.CSSProperties}
      >
        <Settings size={14} />
        Cambiar configuración de servidor
      </button>
      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
};
