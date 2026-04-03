import React, { useState } from 'react';
import { appAPI, networkAPI } from '../lib/api';
import AriesLogo from '../assets/aries_logo.svg';

interface SetupScreenProps {
  onComplete: () => void;
}

type Step = 'choose' | 'client-form' | 'server-login' | 'testing' | 'done';

interface ScannedServer { ip: string; port: number; nombre: string; version?: string; }

export function SetupScreen({ onComplete }: SetupScreenProps) {
  const [step, setStep] = useState<Step>('choose');
  const [ip, setIp] = useState('');
  const [port, setPort] = useState('3001');
  const [termName, setTermName] = useState('Terminal 2');
  const [error, setError] = useState('');
  const [testing, setTesting] = useState(false);
  const [adminCode, setAdminCode] = useState('');
  const [serverLoginError, setServerLoginError] = useState('');
  const [scanning, setScanning] = useState(false);
  const [foundServers, setFoundServers] = useState<ScannedServer[]>([]);


  const setServer = async () => {
    await appAPI.setAppConfig({ mode: 'server', terminalName: 'Servidor principal' });
    onComplete();
  };

  // Nuevo: iniciar solo como servidor (modo cajero, sin admin local)
  const handleServerLogin = async () => {
    setServerLoginError('');
    if (!adminCode.trim()) {
      setServerLoginError('Ingresá el código de admin');
      return;
    }
    // Validar el código de admin contra el backend (puedes ajustar esto según tu API)
    try {
      const ok = await appAPI.validateAdminCode(adminCode.trim());
      if (ok) {
        await appAPI.setAppConfig({ mode: 'server-only', terminalName: 'Servidor solo-cajero' });
        onComplete();
      } else {
        setServerLoginError('Código incorrecto');
      }
    } catch (e) {
      setServerLoginError('Error de conexión');
    }
  };

  const testAndConnect = async () => {
    if (!ip.trim()) { setError('Ingresá la IP del servidor'); return; }
    setError('');
    setTesting(true);
    const result = await appAPI.testServerConnection({
      ip: ip.trim(),
      port: parseInt(port, 10) || 3001,
    });
    setTesting(false);
    if (result.ok) {
      // Activar modo cliente y cargar la URL del servidor directamente
      await appAPI.switchToClientMode({
        ip: ip.trim(),
        port: parseInt(port, 10) || 3001,
        terminalName: termName || 'Terminal',
      });
      // La ventana carga la web del servidor — no necesitamos hacer nada más aquí
    } else {
      setError(result.error || 'No se pudo conectar al servidor');
    }
  };

  const handleScan = async () => {
    setScanning(true);
    setFoundServers([]);
    setError('');
    try {
      const found = await networkAPI.scan(3001);
      setFoundServers(found);
      if (found.length === 0) setError('No se encontraron servidores ARIESPos en la red. Verificá que esté encendido y en la misma red.');
    } catch {
      setError('Error al escanear la red');
    } finally {
      setScanning(false);
    }
  };

  return (
    <div style={{
      position: 'fixed', inset: 0,
      background: '#0f172a',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
      color: '#e2e8f0',
      WebkitAppRegion: 'no-drag',
    } as React.CSSProperties}
      onClick={e => {
        const t = e.target as HTMLElement;
        if (t.tagName === 'INPUT') t.focus();
      }}
    >
      <div style={{
        background: '#1e293b',
        border: '1px solid #334155',
        borderRadius: 20,
        padding: '40px 36px',
        width: 420,
        maxWidth: '90vw',
        WebkitAppRegion: 'no-drag',
      } as React.CSSProperties}>
        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <img
            src={AriesLogo}
            alt="ARIESPos"
            style={{
              width: 72, height: 72,
              objectFit: 'contain',
              margin: '0 auto 12px',
              display: 'block',
              filter: 'drop-shadow(0 4px 20px rgba(190,50,120,0.5))',
            }}
          />
          <div style={{ fontSize: 20, fontWeight: 800, letterSpacing: '-0.02em' }}>
            ARIES<span style={{ color: '#be3278' }}>Pos</span>
          </div>
          <div style={{ fontSize: 12, color: '#64748b', marginTop: 4 }}>Configuración inicial</div>
        </div>

        {step === 'choose' && (
          <>
            <p style={{ fontSize: 13, color: '#94a3b8', textAlign: 'center', marginBottom: 24, lineHeight: 1.6 }}>
              ¿Esta PC va a ser el <strong style={{ color: '#e2e8f0' }}>servidor principal</strong> con la base de datos,<br />
              o una <strong style={{ color: '#e2e8f0' }}>terminal cliente</strong> que se conecta a otro servidor?
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>

              <button
                onClick={setServer}
                style={{
                  padding: '14px 20px', borderRadius: 12,
                  background: '#be3278', color: 'white',
                  border: 'none', cursor: 'pointer',
                  fontWeight: 700, fontSize: 14, textAlign: 'left',
                }}
              >
                <div>🖥️ Esta PC es el SERVIDOR (con admin)</div>
                <div style={{ fontSize: 11, fontWeight: 400, marginTop: 3, opacity: 0.85 }}>
                  Base de datos local · Caja principal · Host de la red
                </div>
              </button>

              <button
                onClick={() => setStep('server-login')}
                style={{
                  padding: '14px 20px', borderRadius: 12,
                  background: '#0e223a', color: '#e2e8f0',
                  border: '1px solid #334155', cursor: 'pointer',
                  fontWeight: 700, fontSize: 14, textAlign: 'left',
                }}
              >
                <div>🔒 Solo SERVIDOR (modo cajero)</div>
                <div style={{ fontSize: 11, fontWeight: 400, marginTop: 3, color: '#94a3b8' }}>
                  Solo datos · Sin ventas ni configuración local · Requiere código admin
                </div>
              </button>

              <button
                onClick={() => setStep('client-form')}
                style={{
                  padding: '14px 20px', borderRadius: 12,
                  background: '#1a2744', color: '#e2e8f0',
                  border: '1px solid #334155', cursor: 'pointer',
                  fontWeight: 700, fontSize: 14, textAlign: 'left',
                }}
              >
                <div>💻 Esta PC es un CLIENTE</div>
                <div style={{ fontSize: 11, fontWeight: 400, marginTop: 3, color: '#94a3b8' }}>
                  Se conecta a la PC servidor de la red · Solo necesita WiFi/LAN
                </div>
              </button>
            </div>
          </>
        )}

        {step === 'server-login' && (
          <>
            <p style={{ fontSize: 13, color: '#94a3b8', marginBottom: 20, lineHeight: 1.6 }}>
              Ingresá el <b>código de admin</b> para iniciar el servidor en modo solo-cajero.<br />
              Nadie podrá modificar la configuración ni acceder a funciones críticas sin este código.
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <input
                type="password"
                value={adminCode}
                onChange={e => { setAdminCode(e.target.value); setServerLoginError(''); }}
                placeholder="Código de admin"
                style={{
                  width: '100%', padding: '12px 14px',
                  background: '#0f172a', border: '1px solid #334155',
                  borderRadius: 9, color: '#e2e8f0', fontSize: 16,
                  outline: 'none', fontVariantNumeric: 'tabular-nums',
                  letterSpacing: '0.2em',
                }}
                onKeyDown={e => e.key === 'Enter' && handleServerLogin()}
              />
              {serverLoginError && (
                <div style={{ color: '#ef4444', fontSize: 13, padding: '8px 12px', background: 'rgba(239,68,68,.1)', borderRadius: 7 }}>
                  ⚠️ {serverLoginError}
                </div>
              )}
              <button
                onClick={handleServerLogin}
                style={{
                  padding: '12px', borderRadius: 9,
                  background: '#3b82f6', color: 'white',
                  border: 'none', cursor: 'pointer', fontSize: 15, fontWeight: 700,
                }}
              >
                Iniciar servidor
              </button>
              <button
                onClick={() => setStep('choose')}
                style={{
                  padding: '10px', borderRadius: 9,
                  background: 'transparent', color: '#94a3b8',
                  border: '1px solid #334155', cursor: 'pointer', fontSize: 13, fontWeight: 600,
                }}
              >
                Volver
              </button>
            </div>
          </>
        )}

        {step === 'client-form' && (
          <>
            <p style={{ fontSize: 13, color: '#94a3b8', marginBottom: 16, lineHeight: 1.6 }}>
              Buscá el servidor automáticamente o ingresá su IP.
            </p>

            {/* Botón de escaneo automático */}
            <button
              onClick={handleScan}
              disabled={scanning}
              style={{
                width: '100%', padding: '11px', borderRadius: 9, marginBottom: 12,
                background: scanning ? '#1a2744' : '#0f766e',
                color: scanning ? '#94a3b8' : 'white',
                border: 'none', cursor: scanning ? 'not-allowed' : 'pointer',
                fontSize: 13, fontWeight: 700,
              }}
            >
              {scanning ? '🔍 Buscando en la red...' : '🔍 Buscar servidor automáticamente'}
            </button>

            {/* Servidores encontrados */}
            {foundServers.length > 0 && (
              <div style={{ marginBottom: 12 }}>
                <div style={{ fontSize: 11, color: '#10b981', fontWeight: 700, marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Servidores encontrados
                </div>
                {foundServers.map(s => (
                  <button
                    key={`${s.ip}:${s.port}`}
                    onClick={() => { setIp(s.ip); setPort(String(s.port)); setFoundServers([]); }}
                    style={{
                      width: '100%', textAlign: 'left', padding: '10px 14px', borderRadius: 8,
                      background: '#0d2137', border: '1px solid #10b981',
                      color: '#e2e8f0', cursor: 'pointer', marginBottom: 6, fontSize: 13,
                    }}
                  >
                    <strong style={{ color: '#10b981' }}>{s.nombre}</strong>
                    <span style={{ color: '#64748b', marginLeft: 8 }}>{s.ip}:{s.port}</span>
                  </button>
                ))}
              </div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div>
                <div style={{ fontSize: 11, color: '#64748b', fontWeight: 700, marginBottom: 5, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  IP del servidor
                </div>
                <div style={{ fontSize: 11, color: '#475569', marginBottom: 6 }}>
                  La IP aparece en la pantalla del servidor en Configuración → Servidor web
                </div>
                <input
                  type="text"
                  value={ip}
                  onChange={e => { setIp(e.target.value); setError(''); }}
                  placeholder="ej: 192.168.1.10"
                  autoFocus
                  style={{
                    width: '100%', padding: '10px 12px',
                    background: '#0f172a', border: '1px solid #334155',
                    borderRadius: 9, color: '#e2e8f0', fontSize: 14,
                    outline: 'none', fontVariantNumeric: 'tabular-nums',
                    boxSizing: 'border-box',
                    WebkitUserSelect: 'text',
                    userSelect: 'text',
                  } as React.CSSProperties}
                  onKeyDown={e => e.key === 'Enter' && testAndConnect()}
                  onClick={e => (e.target as HTMLInputElement).focus()}
                />
              </div>

              <div style={{ display: 'flex', gap: 10 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 11, color: '#64748b', fontWeight: 700, marginBottom: 5, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    Puerto
                  </div>
                  <input
                    type="number"
                    value={port}
                    onChange={e => setPort(e.target.value)}
                    placeholder="3001"
                    style={{
                      width: '100%', padding: '10px 12px',
                      background: '#0f172a', border: '1px solid #334155',
                      borderRadius: 9, color: '#e2e8f0', fontSize: 14, outline: 'none',
                    }}
                  />
                </div>
                <div style={{ flex: 2 }}>
                  <div style={{ fontSize: 11, color: '#64748b', fontWeight: 700, marginBottom: 5, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    Nombre de esta terminal
                  </div>
                  <input
                    type="text"
                    value={termName}
                    onChange={e => setTermName(e.target.value)}
                    placeholder="Terminal 2"
                    style={{
                      width: '100%', padding: '10px 12px',
                      background: '#0f172a', border: '1px solid #334155',
                      borderRadius: 9, color: '#e2e8f0', fontSize: 14, outline: 'none',
                    }}
                  />
                </div>
              </div>

              {error && (
                <div style={{ color: '#ef4444', fontSize: 12, padding: '8px 12px', background: 'rgba(239,68,68,.1)', borderRadius: 7 }}>
                  ⚠️ {error}
                </div>
              )}

              <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
                <button
                  onClick={() => setStep('choose')}
                  style={{
                    flex: 1, padding: '10px', borderRadius: 9,
                    background: 'transparent', color: '#94a3b8',
                    border: '1px solid #334155', cursor: 'pointer', fontSize: 13, fontWeight: 600,
                  }}
                >
                  Atrás
                </button>
                <button
                  onClick={testAndConnect}
                  disabled={testing || !ip.trim()}
                  style={{
                    flex: 2, padding: '10px', borderRadius: 9,
                    background: testing ? '#1a2744' : '#3b82f6', color: testing ? '#94a3b8' : 'white',
                    border: 'none', cursor: testing || !ip.trim() ? 'not-allowed' : 'pointer',
                    fontSize: 13, fontWeight: 700,
                  }}
                >
                  {testing ? '⏳ Probando conexión...' : '✓ Conectar al servidor'}
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
