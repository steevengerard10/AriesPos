import React, { useState, useEffect } from 'react';
import { appAPI, networkAPI } from '../lib/api';

interface FoundServer {
  ip: string;
  port: number;
  nombre: string;
}

type Step = 'menu' | 'scan' | 'manual' | 'server-confirm' | 'done';

const C = {
  bg:      '#0f172a',
  bg2:     '#1e293b',
  bg3:     '#334155',
  border:  '#334155',
  text:    '#f1f5f9',
  text2:   '#94a3b8',
  accent:  '#4f8ef7',
  green:   '#10b981',
  red:     '#ef4444',
  yellow:  '#f59e0b',
};

const NetworkSetupWindow = () => {
  const [step, setStep] = useState<Step>('menu');
  const [scanning, setScanning] = useState(false);
  const [servers, setServers] = useState<FoundServer[]>([]);
  const [manualIP, setManualIP] = useState('');
  const [manualPort, setManualPort] = useState('3001');
  const [testing, setTesting] = useState(false);
  const [testErr, setTestErr] = useState('');
  const [localIP, setLocalIP] = useState('');
  const [currentMode, setCurrentMode] = useState<string | null>(null);

  useEffect(() => {
    // Cargar IP local y modo actual al abrir
    appAPI.getAppConfig().then(cfg => {
      setCurrentMode(cfg?.mode ?? null);
    }).catch(() => {});
    networkAPI.getLocalIP().then(ip => setLocalIP(ip)).catch(() => {});
  }, []);

  // ── Escanear red ──────────────────────────────────────────────
  const handleScan = async () => {
    setScanning(true);
    setServers([]);
    setTestErr('');
    try {
      const found = await networkAPI.scan(3001);
      setServers(found);
    } catch {
      setTestErr('Error al escanear la red');
    } finally {
      setScanning(false);
    }
  };

  // ── Conectar a un servidor encontrado ─────────────────────────
  const handleConnectTo = async (ip: string, port: number) => {
    setTesting(true);
    setTestErr('');
    try {
      const res = await appAPI.testServerConnection({ ip, port });
      if (!res?.ok) { setTestErr('No se pudo conectar a ese servidor'); setTesting(false); return; }
      await appAPI.switchToClientMode({ ip, port, terminalName: `Terminal (${localIP})` });
      setStep('done');
    } catch (e: any) {
      setTestErr(e?.message || 'Error de conexión');
    } finally {
      setTesting(false);
    }
  };

  // ── Conectar manual ──────────────────────────────────────────
  const handleManualConnect = async () => {
    if (!manualIP.trim()) { setTestErr('Ingresa la IP del servidor'); return; }
    await handleConnectTo(manualIP.trim(), Number(manualPort) || 3001);
  };

  // ── Convertir esta PC en servidor ────────────────────────────
  const handleSetServer = async () => {
    try {
      await appAPI.setAppConfig({ mode: 'server', terminalName: 'Servidor principal' });
      setStep('done');
    } catch (e: any) {
      setTestErr(e?.message || 'Error al configurar como servidor');
    }
  };

  // ─────────────────────────────────────────────────────────────
  const card: React.CSSProperties = {
    background: C.bg2, border: `1px solid ${C.border}`, borderRadius: 12,
    padding: '20px 24px', marginBottom: 12,
  };
  const btn = (color = C.accent): React.CSSProperties => ({
    background: color, color: '#fff', border: 'none', borderRadius: 8,
    padding: '10px 20px', fontWeight: 700, fontSize: 14, cursor: 'pointer', width: '100%',
  });
  const ghostBtn: React.CSSProperties = {
    background: C.bg3, color: C.text2, border: 'none', borderRadius: 8,
    padding: '10px 20px', fontWeight: 600, fontSize: 13, cursor: 'pointer', width: '100%',
  };
  const input: React.CSSProperties = {
    background: C.bg3, border: `1px solid ${C.border}`, borderRadius: 8,
    color: C.text, padding: '9px 12px', fontSize: 14, width: '100%', boxSizing: 'border-box',
  };

  // ── Pantalla de finalización ─────────────────────────────────
  if (step === 'done') {
    return (
      <div style={{ background: C.bg, minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 32 }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>✅</div>
          <h2 style={{ color: C.text, margin: '0 0 8px' }}>¡Configuración guardada!</h2>
          <p style={{ color: C.text2, marginBottom: 24 }}>La aplicación se reiniciará para aplicar los cambios.</p>
          <button style={btn(C.green)} onClick={() => window.close()}>Cerrar ventana</button>
        </div>
      </div>
    );
  }

  // ── Menú principal ───────────────────────────────────────────
  if (step === 'menu') {
    return (
      <div style={{ background: C.bg, minHeight: '100vh', padding: 32, color: C.text, fontFamily: "'Syne', sans-serif" }}>
        <h2 style={{ margin: '0 0 4px', fontSize: 20 }}>⚙️ Configuración de Red</h2>
        <p style={{ color: C.text2, fontSize: 13, margin: '0 0 24px' }}>
          Esta PC: <strong style={{ color: C.accent }}>{localIP || '...'}</strong>
          {currentMode && <> · Modo actual: <strong style={{ color: C.yellow }}>{currentMode}</strong></>}
        </p>

        <div style={card}>
          <div style={{ fontWeight: 700, marginBottom: 6 }}>🔍 Buscar servidor en la red</div>
          <div style={{ color: C.text2, fontSize: 13, marginBottom: 14 }}>
            Escanea automáticamente todas las PCs de tu red local para encontrar un servidor ARIESPos.
          </div>
          <button style={btn()} onClick={() => { setStep('scan'); handleScan(); }}>
            Buscar servidores automáticamente
          </button>
        </div>

        <div style={card}>
          <div style={{ fontWeight: 700, marginBottom: 6 }}>✏️ Ingresar IP manualmente</div>
          <div style={{ color: C.text2, fontSize: 13, marginBottom: 14 }}>
            Si ya sabés la IP del servidor, podés conectarte directamente.
          </div>
          <button style={ghostBtn} onClick={() => setStep('manual')}>
            Conectar por IP manual
          </button>
        </div>

        <div style={card}>
          <div style={{ fontWeight: 700, marginBottom: 6 }}>🖥️ Esta PC es el servidor</div>
          <div style={{ color: C.text2, fontSize: 13, marginBottom: 14 }}>
            Convertir esta PC en servidor. Las otras PCs se conectarán a <strong style={{ color: C.accent }}>{localIP || 'esta IP'}</strong>.
          </div>
          <button style={btn('#0f766e')} onClick={() => setStep('server-confirm')}>
            Configurar como servidor
          </button>
        </div>
      </div>
    );
  }

  // ── Escaneo automático ───────────────────────────────────────
  if (step === 'scan') {
    return (
      <div style={{ background: C.bg, minHeight: '100vh', padding: 32, color: C.text, fontFamily: "'Syne', sans-serif" }}>
        <button onClick={() => setStep('menu')} style={{ background: 'none', border: 'none', color: C.text2, cursor: 'pointer', marginBottom: 20, fontSize: 13 }}>
          ← Volver
        </button>
        <h2 style={{ margin: '0 0 4px', fontSize: 20 }}>🔍 Buscar servidores</h2>
        <p style={{ color: C.text2, fontSize: 13, margin: '0 0 20px' }}>Escaneando la red local en busca de servidores ARIESPos...</p>

        {scanning && (
          <div style={{ ...card, textAlign: 'center', color: C.text2 }}>
            <div style={{ fontSize: 32, marginBottom: 8 }}>⏳</div>
            <div>Escaneando {localIP ? localIP.replace(/\.\d+$/, '.0') : 'la red'}/24...</div>
            <div style={{ fontSize: 12, marginTop: 6 }}>Esto puede tardar hasta 30 segundos</div>
          </div>
        )}

        {!scanning && servers.length === 0 && (
          <div style={{ ...card, textAlign: 'center' }}>
            <div style={{ fontSize: 32, marginBottom: 8 }}>🔎</div>
            <div style={{ color: C.text2, marginBottom: 16 }}>No se encontraron servidores ARIESPos en la red.</div>
            <button style={btn()} onClick={handleScan}>Volver a escanear</button>
            <button style={{ ...ghostBtn, marginTop: 8 }} onClick={() => setStep('manual')}>Ingresar IP manualmente</button>
          </div>
        )}

        {!scanning && servers.length > 0 && (
          <>
            <div style={{ color: C.green, fontWeight: 700, marginBottom: 12 }}>
              ✅ {servers.length} servidor{servers.length > 1 ? 'es' : ''} encontrado{servers.length > 1 ? 's' : ''}
            </div>
            {servers.map(s => (
              <div key={`${s.ip}:${s.port}`} style={{ ...card, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div>
                  <div style={{ fontWeight: 700 }}>{s.nombre}</div>
                  <div style={{ color: C.text2, fontSize: 13 }}>{s.ip}:{s.port}</div>
                </div>
                <button
                  style={{ ...btn(), width: 'auto', padding: '8px 18px', opacity: testing ? 0.6 : 1 }}
                  disabled={testing}
                  onClick={() => handleConnectTo(s.ip, s.port)}
                >
                  {testing ? 'Conectando...' : 'Conectar'}
                </button>
              </div>
            ))}
            <button style={{ ...ghostBtn, marginTop: 4 }} onClick={handleScan}>Volver a escanear</button>
          </>
        )}

        {testErr && <div style={{ color: C.red, marginTop: 12, fontSize: 13 }}>{testErr}</div>}
      </div>
    );
  }

  // ── Manual ───────────────────────────────────────────────────
  if (step === 'manual') {
    return (
      <div style={{ background: C.bg, minHeight: '100vh', padding: 32, color: C.text, fontFamily: "'Syne', sans-serif" }}>
        <button onClick={() => setStep('menu')} style={{ background: 'none', border: 'none', color: C.text2, cursor: 'pointer', marginBottom: 20, fontSize: 13 }}>
          ← Volver
        </button>
        <h2 style={{ margin: '0 0 20px', fontSize: 20 }}>✏️ Conectar por IP</h2>

        <div style={card}>
          <label style={{ display: 'block', color: C.text2, fontSize: 13, marginBottom: 6 }}>IP del servidor</label>
          <input
            style={input}
            placeholder="Ej: 192.168.1.10"
            value={manualIP}
            onChange={e => { setManualIP(e.target.value); setTestErr(''); }}
          />
          <label style={{ display: 'block', color: C.text2, fontSize: 13, margin: '14px 0 6px' }}>Puerto</label>
          <input
            style={{ ...input, width: 120 }}
            placeholder="3001"
            value={manualPort}
            onChange={e => setManualPort(e.target.value)}
          />
          {testErr && <div style={{ color: C.red, fontSize: 13, marginTop: 10 }}>{testErr}</div>}
          <button
            style={{ ...btn(), marginTop: 18, opacity: testing ? 0.6 : 1 }}
            disabled={testing}
            onClick={handleManualConnect}
          >
            {testing ? 'Verificando conexión...' : 'Conectar'}
          </button>
        </div>

        <div style={{ color: C.text2, fontSize: 12, marginTop: 12 }}>
          💡 Para saber la IP del servidor, abrí esta ventana en la PC servidor y verás la IP en la parte superior.
        </div>
      </div>
    );
  }

  // ── Confirmar modo servidor ───────────────────────────────────
  if (step === 'server-confirm') {
    return (
      <div style={{ background: C.bg, minHeight: '100vh', padding: 32, color: C.text, fontFamily: "'Syne', sans-serif" }}>
        <button onClick={() => setStep('menu')} style={{ background: 'none', border: 'none', color: C.text2, cursor: 'pointer', marginBottom: 20, fontSize: 13 }}>
          ← Volver
        </button>
        <h2 style={{ margin: '0 0 20px', fontSize: 20 }}>🖥️ Configurar como servidor</h2>
        <div style={card}>
          <p style={{ color: C.text2, marginBottom: 16 }}>
            Esta PC quedará como <strong style={{ color: C.text }}>servidor principal</strong>. Las otras PCs podrán conectarse a:
          </p>
          <div style={{ background: C.bg3, borderRadius: 8, padding: '12px 16px', fontFamily: 'monospace', fontSize: 15, color: C.accent, marginBottom: 20 }}>
            {localIP || '...'} : 3001
          </div>
          <p style={{ color: C.text2, fontSize: 13, marginBottom: 20 }}>
            ⚠️ Si esta PC ya estaba en modo cliente, dejará de conectarse al servidor anterior.
          </p>
          <button style={btn('#0f766e')} onClick={handleSetServer}>
            Confirmar — Usar esta PC como servidor
          </button>
          {testErr && <div style={{ color: C.red, fontSize: 13, marginTop: 10 }}>{testErr}</div>}
        </div>
      </div>
    );
  }

  return null;
};

export default NetworkSetupWindow;
