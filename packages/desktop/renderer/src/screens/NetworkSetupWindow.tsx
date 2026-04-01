import React, { useState } from 'react';

const NetworkSetupWindow = () => {
  const [mode, setMode] = useState<'server' | 'client'>('client');
  const [serverIP, setServerIP] = useState('');
  const [port, setPort] = useState('3001');
  const [status, setStatus] = useState<'idle' | 'connecting' | 'connected' | 'error'>('idle');
  const [error, setError] = useState('');

  const handleConnect = () => {
    setStatus('connecting');
    setError('');
    window.electronAPI.saveNetworkConfig({ mode, serverIP, port })
      .then(() => {
        setStatus('connected');
      })
      .catch((err: any) => {
        setStatus('error');
        setError(err?.message || 'Error de conexión');
      });
  };

  return (
    <div style={{ padding: 32, maxWidth: 400, margin: '0 auto', fontFamily: 'sans-serif' }}>
      <h2>Conectar ARIESPos en Red</h2>
      <div style={{ marginBottom: 16 }}>
        <label>
          <input
            type="radio"
            checked={mode === 'server'}
            onChange={() => setMode('server')}
          /> Servidor (PC principal)
        </label>
        <label style={{ marginLeft: 16 }}>
          <input
            type="radio"
            checked={mode === 'client'}
            onChange={() => setMode('client')}
          /> Cliente (Otra PC)
        </label>
      </div>
      {mode === 'client' && (
        <div style={{ marginBottom: 12 }}>
          <input
            placeholder="IP del servidor principal"
            value={serverIP}
            onChange={e => setServerIP(e.target.value)}
            style={{ width: '100%', padding: 8, borderRadius: 4, border: '1px solid #ccc' }}
          />
        </div>
      )}
      <div style={{ marginBottom: 12 }}>
        <input
          placeholder="Puerto (por defecto 3001)"
          value={port}
          onChange={e => setPort(e.target.value)}
          style={{ width: '100%', padding: 8, borderRadius: 4, border: '1px solid #ccc' }}
        />
      </div>
      <button onClick={handleConnect} style={{ width: '100%', padding: 10, borderRadius: 6, background: '#4f8ef7', color: '#fff', fontWeight: 700, border: 'none' }}>
        {status === 'connecting' ? 'Conectando...' : 'Guardar y conectar'}
      </button>
      {status === 'connected' && <div style={{ color: 'green', marginTop: 12 }}>¡Conectado!</div>}
      {status === 'error' && <div style={{ color: 'red', marginTop: 12 }}>{error}</div>}
      <div style={{ marginTop: 24, fontSize: 13, color: '#64748b' }}>
        Si la PC principal falla, puedes abrir el servidor en cualquier otra PC de la red.<br />
        Solo selecciona "Servidor" y asegúrate de que las demás PCs apunten a la nueva IP.
      </div>
    </div>
  );
};

export default NetworkSetupWindow;
