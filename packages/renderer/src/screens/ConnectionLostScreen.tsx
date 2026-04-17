import React, { useState, useEffect, useCallback, useRef } from 'react';
import { appAPI } from '../lib/api';

interface ConnectionLostScreenProps {
  serverIP: string;
  serverPort?: number;
}

export const ConnectionLostScreen: React.FC<ConnectionLostScreenProps> = ({ serverIP, serverPort = 3001 }) => {
  const [attempts, setAttempts] = useState(0);
  const [pingStatus, setPingStatus] = useState<'idle' | 'trying' | 'ok' | 'fail'>('idle');
  const [lastError, setLastError] = useState('');
  // Cuántas veces el ping fue OK pero aún no reconectamos (indica problema de auth/firewall del LADO DEL SERVIDOR)
  const [pingOkButStuck, setPingOkButStuck] = useState(0);

  // Ref para evitar re-crear el intervalo en cada render
  const attemptsRef = useRef(0);
  const pingOkCountRef = useRef(0);

  const tryPing = useCallback(async () => {
    if (!serverIP) return;
    setPingStatus('trying');
    try {
      const res = await (window as any).electron?.invoke('network:ping-server', { ip: serverIP, port: serverPort });
      if (res?.ok) {
        setPingStatus('ok');
        setLastError('');
        // Si el servidor está activo pero seguimos aquí, probablemente hay problema en el SERVIDOR (firewall/auth)
        pingOkCountRef.current += 1;
        setPingOkButStuck(pingOkCountRef.current);
        // NO reiniciamos la app automáticamente (causaba loop infinito ya que /api/ping no usa auth)
      } else {
        setPingStatus('fail');
        setLastError(res?.error || 'Sin respuesta');
        pingOkCountRef.current = 0;
        setPingOkButStuck(0);
        attemptsRef.current += 1;
        setAttempts(attemptsRef.current);
      }
    } catch (e: any) {
      setPingStatus('fail');
      setLastError(e?.message || 'Error al probar conexión');
      pingOkCountRef.current = 0;
      setPingOkButStuck(0);
      attemptsRef.current += 1;
      setAttempts(attemptsRef.current);
    }
  }, [serverIP, serverPort]);

  useEffect(() => {
    tryPing();
    const interval = setInterval(tryPing, 8000);
    return () => clearInterval(interval);
  }, [tryPing]);

  // pingOkButStuck >= 2 significa que el server responde pero no reconecta (auth o firewall del servidor)
  const serverFindsButCantAuth = pingOkButStuck >= 2;

  const statusColor = pingStatus === 'ok' ? '#10b981' : pingStatus === 'fail' ? '#ef4444' : '#f59e0b';
  const statusText = pingStatus === 'trying' ? 'Probando conexión...'
    : pingStatus === 'ok' && serverFindsButCantAuth
      ? `Servidor activo pero sin acceso (firewall o contraseña incorrecta)`
    : pingStatus === 'ok' ? 'Servidor encontrado — esperando reconexión del sistema...'
    : pingStatus === 'fail' ? `Sin respuesta (intento ${attempts})`
    : 'Iniciando...';

  return (
    <div style={{
      position: 'fixed', inset: 0, display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      background: '#0f172a', color: '#e2e8f0',
      fontFamily: "'Segoe UI', sans-serif", padding: 32,
      WebkitAppRegion: 'drag',
    } as React.CSSProperties}>

      <div style={{ fontSize: 52, marginBottom: 16 }}>
        {pingStatus === 'trying' ? '🔄' : pingStatus === 'ok' ? '✅' : '🔌'}
      </div>

      <h2 style={{ fontSize: 20, fontWeight: 700, margin: '0 0 8px', textAlign: 'center' }}>
        Conexión perdida con el servidor
      </h2>
      <p style={{ fontSize: 13, color: '#94a3b8', textAlign: 'center', maxWidth: 380, lineHeight: 1.6, margin: '0 0 20px' }}>
        Intentando conectar a{' '}
        <span style={{ color: '#4f8ef7', fontFamily: 'monospace', fontWeight: 600 }}>
          {serverIP}:{serverPort}
        </span>
        <br />
        Verificá que la PC servidor esté encendida y con ARIESPos abierto.
      </p>

      {/* Estado */}
      <div style={{
        background: '#1e293b', border: `1px solid ${statusColor}40`,
        borderRadius: 10, padding: '12px 20px', marginBottom: 20,
        textAlign: 'center', minWidth: 300,
      }}>
        <div style={{ color: statusColor, fontWeight: 700, fontSize: 14 }}>
          {statusText}
        </div>
        {lastError && pingStatus === 'fail' && (() => {
          const isTimeout = lastError === 'timeout' || lastError.includes('ETIMEDOUT');
          const isRefused = lastError.includes('ECONNREFUSED');
          const hint = isRefused
            ? '→ El puerto está cerrado. ARIESPos no está escuchando en ese puerto.'
            : isTimeout
            ? '→ El firewall está bloqueando la conexión. Abrí el puerto 3001 en la PC servidor.'
            : null;
          return (
            <>
              <div style={{ color: '#64748b', fontSize: 11, marginTop: 4, fontFamily: 'monospace', wordBreak: 'break-all' }}>
                {lastError}
              </div>
              {hint && (
                <div style={{ color: isRefused ? '#fbbf24' : '#f87171', fontSize: 11, marginTop: 6, fontStyle: 'italic' }}>
                  {hint}
                </div>
              )}
            </>
          );
        })()}
      </div>

      {/* Aviso especial: servidor responde pero no reconecta (firewall/auth en el servidor) */}
      {serverFindsButCantAuth && (
        <div style={{
          background: '#7c2d12', border: '1px solid #9a3412', borderRadius: 10,
          padding: '12px 20px', marginBottom: 16, maxWidth: 340, textAlign: 'center',
        }}>
          <div style={{ color: '#fed7aa', fontWeight: 700, fontSize: 13, marginBottom: 6 }}>
            ⚠️ El servidor responde pero rechaza la conexión
          </div>
          <div style={{ color: '#fdba74', fontSize: 11, lineHeight: 1.7 }}>
            Probable causa: <strong>firewall del servidor bloqueando el puerto 3001</strong>.<br />
            En la PC servidor: abrí ARIESPos como <strong>Administrador</strong> y en la<br />
            pantalla de Login hacé clic en <strong>"🛡️ Abrir puerto para otras PCs"</strong>
          </div>
        </div>
      )}

      {/* === BOTÓN PRINCIPAL: DESCONECTARSE Y SER SERVIDOR === */}
      <button
        onClick={() => appAPI.becomeServer()}
        style={{
          WebkitAppRegion: 'no-drag',
          background: '#0f766e', color: '#fff', border: 'none',
          borderRadius: 10, padding: '15px 28px', fontWeight: 800,
          fontSize: 15, cursor: 'pointer', marginBottom: 10,
          fontFamily: 'inherit', width: 340,
          boxShadow: '0 0 24px rgba(15,118,110,0.5)',
        } as React.CSSProperties}
      >
        🖥️ Usar esta PC como servidor independiente
      </button>
      <p style={{ fontSize: 11, color: '#475569', marginBottom: 16, textAlign: 'center' }}>
        ↑ Esta PC se reinicia como servidor con la base de datos local.<br />PIN de acceso: <strong style={{ color: '#64748b' }}>1234</strong>
      </p>

      {/* Botón reintentar */}
      <button
        onClick={tryPing}
        disabled={pingStatus === 'trying'}
        style={{
          WebkitAppRegion: 'no-drag',
          background: '#1e293b', color: '#94a3b8', border: '1px solid #334155',
          borderRadius: 8, padding: '10px 24px', fontWeight: 600,
          fontSize: 13, cursor: pingStatus === 'trying' ? 'not-allowed' : 'pointer',
          opacity: pingStatus === 'trying' ? 0.6 : 1, marginBottom: 8,
          fontFamily: 'inherit',
        } as React.CSSProperties}
      >
        {pingStatus === 'trying' ? '⏳ Probando...' : '↺ Reintentar conexión ahora'}
      </button>

      {/* Opciones secundarias */}
      <div style={{ display: 'flex', gap: 8, marginTop: 4, flexWrap: 'wrap', justifyContent: 'center' }}>
        <button
          onClick={() => (window as any).electron?.invoke('window:open-network')}
          style={{
            WebkitAppRegion: 'no-drag',
            background: 'none', color: '#475569', border: '1px solid #1e293b',
            borderRadius: 7, padding: '7px 14px', fontSize: 11,
            cursor: 'pointer', fontFamily: 'inherit',
          } as React.CSSProperties}
        >
          ⚙️ Cambiar servidor
        </button>
        <button
          onClick={() => appAPI.resetToSetup()}
          style={{
            WebkitAppRegion: 'no-drag',
            background: 'none', color: '#475569', border: '1px solid #1e293b',
            borderRadius: 7, padding: '7px 14px', fontSize: 11,
            cursor: 'pointer', fontFamily: 'inherit',
          } as React.CSSProperties}
        >
          🔄 Setup inicial
        </button>
      </div>

      <p style={{ fontSize: 10, color: '#1e293b', marginTop: 20 }}>
        Ctrl+Shift+R = volver al setup inicial
      </p>

      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
};
