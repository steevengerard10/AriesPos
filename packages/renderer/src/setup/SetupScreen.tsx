import React, { useState } from 'react';
import { appAPI } from '../lib/api';

interface SetupScreenProps {
  onComplete: () => void;
}

type Step = 'choose' | 'client-form' | 'server-login' | 'testing' | 'done';

export function SetupScreen({ onComplete }: SetupScreenProps) {
  const [step, setStep] = useState<Step>('choose');
  const [ip, setIp] = useState('');
  const [port, setPort] = useState('3001');
  const [termName, setTermName] = useState('Terminal 2');
  const [error, setError] = useState('');
  const [testing, setTesting] = useState(false);
  const [adminCode, setAdminCode] = useState('');
  const [serverLoginError, setServerLoginError] = useState('');


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

  return (
    <div style={{
      position: 'fixed', inset: 0,
      background: '#0f172a',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
      color: '#e2e8f0',
    }}>
      <div style={{
        background: '#1e293b',
        border: '1px solid #334155',
        borderRadius: 20,
        padding: '40px 36px',
        width: 420,
        maxWidth: '90vw',
      }}>
        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <div style={{
            width: 56, height: 56,
            background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)',
            borderRadius: 16, display: 'inline-flex',
            alignItems: 'center', justifyContent: 'center',
            fontWeight: 900, fontSize: 24, color: 'white', marginBottom: 12,
          }}>A</div>
          <div style={{ fontSize: 20, fontWeight: 800, letterSpacing: '-0.02em' }}>
            ARIES<span style={{ color: '#3b82f6' }}>Pos</span>
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
                  background: '#3b82f6', color: 'white',
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
            <p style={{ fontSize: 13, color: '#94a3b8', marginBottom: 20, lineHeight: 1.6 }}>
              Ingresá la IP de la PC servidor. Podés verla en ARIESPos → Configuración → Red.
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div>
                <div style={{ fontSize: 11, color: '#64748b', fontWeight: 700, marginBottom: 5, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  IP del servidor
                </div>
                <input
                  type="text"
                  value={ip}
                  onChange={e => { setIp(e.target.value); setError(''); }}
                  placeholder="ej: 192.168.1.10"
                  style={{
                    width: '100%', padding: '10px 12px',
                    background: '#0f172a', border: '1px solid #334155',
                    borderRadius: 9, color: '#e2e8f0', fontSize: 14,
                    outline: 'none', fontVariantNumeric: 'tabular-nums',
                  }}
                  onKeyDown={e => e.key === 'Enter' && testAndConnect()}
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
