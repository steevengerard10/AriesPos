import React, { useState, useEffect } from 'react';
import { appAPI, networkAPI } from '../lib/api';

interface FoundServer { ip: string; port: number; nombre: string; }
interface LocalIP { name: string; address: string; preferred: boolean; }
type Step = 'menu' | 'scan' | 'manual' | 'server-confirm' | 'done';

const C = {
  bg: '#0f172a', bg2: '#1e293b', bg3: '#334155', border: '#334155',
  text: '#f1f5f9', text2: '#94a3b8', accent: '#4f8ef7',
  green: '#10b981', red: '#ef4444', yellow: '#f59e0b', teal: '#0f766e',
};

const card: React.CSSProperties = {
  background: C.bg2, border: `1px solid ${C.border}`, borderRadius: 12,
  padding: '18px 22px', marginBottom: 12,
};
const btn = (color = C.accent): React.CSSProperties => ({
  background: color, color: '#fff', border: 'none', borderRadius: 8,
  padding: '10px 20px', fontWeight: 700, fontSize: 14, cursor: 'pointer', width: '100%',
});
const ghostBtn: React.CSSProperties = {
  background: C.bg3, color: C.text2, border: 'none', borderRadius: 8,
  padding: '10px 20px', fontWeight: 600, fontSize: 13, cursor: 'pointer', width: '100%',
};
const smBtn = (color = C.bg3): React.CSSProperties => ({
  background: color, color: '#fff', border: 'none', borderRadius: 6,
  padding: '6px 14px', fontWeight: 700, fontSize: 12, cursor: 'pointer',
});
const inputStyle: React.CSSProperties = {
  background: C.bg3, border: `1px solid ${C.border}`, borderRadius: 8,
  color: C.text, padding: '9px 12px', fontSize: 14, width: '100%', boxSizing: 'border-box',
};

const NetworkSetupWindow: React.FC = () => {
  const [step, setStep] = useState<Step>('menu');
  const [scanning, setScanning] = useState(false);
  const [servers, setServers] = useState<FoundServer[]>([]);
  const [manualIP, setManualIP] = useState('');
  const [manualPort, setManualPort] = useState('3001');
  const [testing, setTesting] = useState(false);
  const [testErr, setTestErr] = useState('');
  const [currentMode, setCurrentMode] = useState<string | null>(null);
  const [allIPs, setAllIPs] = useState<LocalIP[]>([]);
  const [serverPort, setServerPort] = useState<number>(3001);
  const [fwStatus, setFwStatus] = useState<'idle' | 'working' | 'ok' | 'error'>('idle');
  const [fwError, setFwError] = useState('');
  const [pingStatus, setPingStatus] = useState<'idle' | 'testing' | 'ok' | 'error'>('idle');
  const [pingMs, setPingMs] = useState<number | null>(null);
  const [copiedIP, setCopiedIP] = useState('');

  useEffect(() => {
    appAPI.getAppConfig().then(cfg => setCurrentMode(cfg?.mode ?? null)).catch(() => {});
    networkAPI.serverInfo().then(info => {
      setAllIPs(info.ips);
      setServerPort(info.port);
    }).catch(() => {
      networkAPI.getLocalIP().then(ip => setAllIPs([{ name: '', address: ip, preferred: true }])).catch(() => {});
    });
  }, []);

  const primaryIP = allIPs.find(i => i.preferred)?.address || allIPs[0]?.address || '...';

  const copyIP = (ip: string) => {
    navigator.clipboard.writeText(ip).then(() => {
      setCopiedIP(ip);
      setTimeout(() => setCopiedIP(''), 2000);
    }).catch(() => {});
  };

  const handleScan = async () => {
    setScanning(true); setServers([]); setTestErr('');
    try { const found = await networkAPI.scan(3001); setServers(found); }
    catch { setTestErr('Error al escanear la red'); }
    finally { setScanning(false); }
  };

  const handleConnectTo = async (ip: string, port: number) => {
    setTesting(true); setTestErr('');
    try {
      const res = await appAPI.testServerConnection({ ip, port });
      if (!res?.ok) {
        setTestErr(`Error al conectar con ${ip}:${port} — ${res?.error || 'sin respuesta'}. Verificá que el servidor tenga ARIESPos abierto y el firewall reparado.`);
        setTesting(false);
        return;
      }
      await appAPI.switchToClientMode({ ip, port, terminalName: `Terminal (${primaryIP})` });
      setStep('done');
    } catch (e: any) { setTestErr(e?.message || 'Error de conexión'); }
    finally { setTesting(false); }
  };

  const handleSetServer = async () => {
    try {
      await appAPI.becomeServer(); // atómico: guarda config + reinicia en una sola operación
    } catch (e: any) { setTestErr(e?.message || 'Error'); }
  };

  const handleOpenFirewall = async () => {
    setFwStatus('working'); setFwError('');
    try {
      const res = await networkAPI.openFirewall(serverPort);
      setFwStatus(res?.success ? 'ok' : 'error');
      if (!res?.success) setFwError(res?.error || 'No se pudo abrir el puerto');
    } catch (e: any) { setFwStatus('error'); setFwError(e?.message || 'Error'); }
  };

  const handlePing = async () => {
    if (!manualIP.trim()) return;
    setPingStatus('testing'); setPingMs(null);
    try {
      const res = await networkAPI.pingServer(manualIP.trim(), Number(manualPort) || 3001);
      setPingStatus(res?.ok ? 'ok' : 'error');
      if (res?.ok) setPingMs(res.ms ?? null);
      else if (res?.error) setTestErr(res.error);
    } catch (e: any) { setPingStatus('error'); setTestErr(e?.message || 'Error'); }
  };

  if (step === 'done') return (
    <div style={{ background: C.bg, minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 32 }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>✅</div>
        <h2 style={{ color: C.text, margin: '0 0 8px' }}>¡Configuración guardada!</h2>
        <p style={{ color: C.text2, marginBottom: 24 }}>La aplicación se reiniciará para aplicar los cambios.</p>
        <button style={btn(C.green)} onClick={() => window.close()}>Cerrar ventana</button>
      </div>
    </div>
  );

  const wrap: React.CSSProperties = { background: C.bg, minHeight: '100vh', padding: 28, color: C.text, fontFamily: "'Segoe UI', sans-serif", overflowY: 'auto' };

  if (step === 'menu') return (
    <div style={wrap}>
      <h2 style={{ margin: '0 0 16px', fontSize: 20 }}>⚙️ Configuración de Red</h2>

      {/* Panel de IPs */}
      <div style={{ ...card, marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8, flexWrap: 'wrap' }}>
          <span style={{ color: C.text2, fontSize: 13, fontWeight: 600 }}>Esta PC:</span>
          {currentMode && (
            <span style={{ background: currentMode === 'server' ? '#064e3b' : currentMode === 'client' ? '#1e3a5f' : C.bg3, color: currentMode === 'server' ? C.green : currentMode === 'client' ? C.accent : C.text2, borderRadius: 6, padding: '3px 10px', fontSize: 12, fontWeight: 700 }}>
              {currentMode === 'server' ? '🖥️ SERVIDOR' : currentMode === 'client' ? '💻 CLIENTE' : currentMode}
            </span>
          )}
          {currentMode === 'server' && serverPort !== 3001 && (
            <span style={{ background: '#7c2d12', color: '#fdba74', borderRadius: 6, padding: '3px 10px', fontSize: 12, fontWeight: 700 }}>
              ⚠️ Puerto activo: {serverPort} (¡no 3001!)
            </span>
          )}
        </div>

        {allIPs.length === 0 && <div style={{ color: C.text2, fontSize: 13 }}>Detectando IPs...</div>}
        {allIPs.map(ip => (
          <div key={ip.address} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 5, flexWrap: 'wrap' }}>
            <span style={{ fontFamily: 'monospace', fontSize: 16, color: ip.preferred ? C.accent : C.text2, fontWeight: ip.preferred ? 700 : 400 }}>
              {ip.address}
              {currentMode === 'server' && <span style={{ color: C.text2, fontWeight: 400, fontSize: 13 }}>:{serverPort}</span>}
            </span>
            <span style={{ color: C.text2, fontSize: 11 }}>({ip.name || 'adaptador'})</span>
            {ip.preferred && <span style={{ background: '#064e3b', color: C.green, fontSize: 11, borderRadius: 4, padding: '1px 6px' }}>recomendada</span>}
            <button onClick={() => copyIP(ip.address)} style={{ ...smBtn(), padding: '3px 8px', fontSize: 11 }}>
              {copiedIP === ip.address ? '✅' : '📋 Copiar'}
            </button>
          </div>
        ))}
        {allIPs.length > 1 && (
          <div style={{ color: C.yellow, fontSize: 11, marginTop: 4 }}>
            ⚠️ Múltiples adaptadores detectados. Usá la IP <strong>recomendada</strong> (la de tu red WiFi o cable compartida con las otras PCs).
          </div>
        )}
      </div>

      <div style={card}>
        <div style={{ fontWeight: 700, marginBottom: 6 }}>🔍 Buscar servidor automáticamente</div>
        <div style={{ color: C.text2, fontSize: 13, marginBottom: 12 }}>Escanea la red local. Todas las PCs deben estar en la <strong>misma red WiFi o cable</strong>.</div>
        <button style={btn()} onClick={() => { setStep('scan'); handleScan(); }}>Buscar servidores</button>
      </div>

      <div style={card}>
        <div style={{ fontWeight: 700, marginBottom: 6 }}>✏️ Ingresar IP manualmente</div>
        <div style={{ color: C.text2, fontSize: 13, marginBottom: 12 }}>Si ya sabés la IP del servidor, conectate directo. Usá el número que ves arriba en la PC servidor.</div>
        <button style={ghostBtn} onClick={() => setStep('manual')}>Conectar por IP manual</button>
      </div>

      <div style={card}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 6, marginBottom: 6 }}>
          <div style={{ fontWeight: 700 }}>🖥️ Esta PC es el servidor</div>
          <span style={{ background: '#1e3a5f', color: '#93c5fd', borderRadius: 6, padding: '2px 10px', fontSize: 11, fontWeight: 600 }}>Sin límite de clientes</span>
        </div>
        <div style={{ color: C.text2, fontSize: 13, marginBottom: 12 }}>
          Todas las PCs clientes se conectarán a <strong style={{ color: C.accent, fontFamily: 'monospace' }}>{primaryIP}:{serverPort}</strong>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button style={{ ...btn(C.teal), width: 'auto', flex: 1 }} onClick={() => setStep('server-confirm')}>
            Configurar como servidor
          </button>
          <button onClick={handleOpenFirewall} disabled={fwStatus === 'working'}
            style={{ ...smBtn(fwStatus === 'ok' ? '#064e3b' : fwStatus === 'error' ? '#7f1d1d' : '#374151'), opacity: fwStatus === 'working' ? 0.6 : 1, padding: '8px 14px' }}>
            {fwStatus === 'working' ? '⏳ Abriendo...' : fwStatus === 'ok' ? '✅ Puerto abierto' : fwStatus === 'error' ? '❌ Falló' : '🛡️ Reparar firewall'}
          </button>
        </div>
        {fwStatus === 'ok' && <div style={{ color: C.green, fontSize: 12, marginTop: 8 }}>✅ Puerto {serverPort} abierto en el firewall (todas las redes).</div>}
        {fwStatus === 'error' && <div style={{ color: C.red, fontSize: 12, marginTop: 8 }}>❌ {fwError || 'Ejecutá ARIESPos como administrador e intentá de nuevo.'}</div>}
      </div>

      <div style={{ background: '#1a2744', border: `1px solid #2d4a7a`, borderRadius: 10, padding: '12px 16px', fontSize: 12, color: '#93c5fd', lineHeight: 1.8 }}>
        <strong>💡 Cómo conectar varias PCs (3 o más):</strong><br/>
        1. Una sola PC actúa como <strong>servidor</strong> → presioná <strong>"Reparar firewall"</strong> → aceptar popup<br/>
        2. Anotá la IP del servidor (la que aparece arriba en esa PC)<br/>
        3. En <strong>cada PC cliente</strong>: abrí esta ventana → "IP manual" → ingresá la misma IP → Conectar<br/>
        4. Todas las PCs deben estar en el <strong>mismo router/WiFi/cable</strong><br/>
        <span style={{ color: '#6ee7b7', fontWeight: 600 }}>✔ No hay límite de PCs clientes que pueden conectarse al servidor</span>
      </div>
    </div>
  );

  if (step === 'scan') return (
    <div style={wrap}>
      <button onClick={() => setStep('menu')} style={{ background: 'none', border: 'none', color: C.text2, cursor: 'pointer', marginBottom: 20, fontSize: 13 }}>← Volver</button>
      <h2 style={{ margin: '0 0 4px', fontSize: 20 }}>🔍 Buscar servidores</h2>
      <p style={{ color: C.text2, fontSize: 13, margin: '0 0 20px' }}>Escaneando {primaryIP.replace(/\.\d+$/, '.0')}/24...</p>

      {scanning && (
        <div style={{ ...card, textAlign: 'center', color: C.text2 }}>
          <div style={{ fontSize: 32, marginBottom: 8 }}>⏳</div>
          <div>Escaneando ~254 IPs en la red... puede tardar 30 segundos</div>
        </div>
      )}

      {!scanning && servers.length === 0 && (
        <div style={{ ...card, textAlign: 'center' }}>
          <div style={{ fontSize: 32, marginBottom: 8 }}>🔎</div>
          <div style={{ color: C.text2, marginBottom: 12 }}>No se encontraron servidores ARIESPos.</div>
          <div style={{ color: C.yellow, fontSize: 12, marginBottom: 16 }}>
            Verificá: 1) ARIESPos abierto en el servidor 2) Firewall reparado en el servidor 3) Misma red WiFi/cable
          </div>
          <button style={btn()} onClick={handleScan}>Volver a escanear</button>
          <button style={{ ...ghostBtn, marginTop: 8 }} onClick={() => setStep('manual')}>Ingresar IP manualmente</button>
        </div>
      )}

      {!scanning && servers.length > 0 && (
        <>
          <div style={{ color: C.green, fontWeight: 700, marginBottom: 12 }}>
            ✅ {servers.length} servidor{servers.length !== 1 ? 'es' : ''} encontrado{servers.length !== 1 ? 's' : ''}
          </div>
          {servers.map(s => (
            <div key={`${s.ip}:${s.port}`} style={{ ...card, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <div style={{ fontWeight: 700 }}>{s.nombre}</div>
                <div style={{ color: C.text2, fontSize: 13 }}>{s.ip}:{s.port}</div>
              </div>
              <button style={{ ...btn(), width: 'auto', padding: '8px 18px', opacity: testing ? 0.6 : 1 }} disabled={testing} onClick={() => handleConnectTo(s.ip, s.port)}>
                {testing ? 'Conectando...' : 'Conectar'}
              </button>
            </div>
          ))}
          <button style={{ ...ghostBtn, marginTop: 4 }} onClick={handleScan}>Volver a escanear</button>
        </>
      )}

      {testErr && <div style={{ color: C.red, marginTop: 12, fontSize: 13, background: '#1c0a0a', padding: '8px 12px', borderRadius: 6 }}>⚠️ {testErr}</div>}
    </div>
  );

  if (step === 'manual') return (
    <div style={wrap}>
      <button onClick={() => setStep('menu')} style={{ background: 'none', border: 'none', color: C.text2, cursor: 'pointer', marginBottom: 20, fontSize: 13 }}>← Volver</button>
      <h2 style={{ margin: '0 0 20px', fontSize: 20 }}>✏️ Conectar por IP</h2>
      <div style={card}>
        <label style={{ display: 'block', color: C.text2, fontSize: 13, marginBottom: 6 }}>IP del servidor</label>
        <input style={inputStyle} placeholder="Ej: 192.168.1.10" value={manualIP}
          onChange={e => { setManualIP(e.target.value); setTestErr(''); setPingStatus('idle'); }} />
        <label style={{ display: 'block', color: C.text2, fontSize: 13, margin: '14px 0 6px' }}>Puerto</label>
        <input style={{ ...inputStyle, width: 100 }} placeholder="3001" value={manualPort}
          onChange={e => setManualPort(e.target.value)} />

        <div style={{ display: 'flex', gap: 8, marginTop: 12, alignItems: 'center', flexWrap: 'wrap' }}>
          <button style={{ ...smBtn('#374151'), opacity: !manualIP ? 0.5 : 1, padding: '8px 16px' }}
            disabled={!manualIP || pingStatus === 'testing'} onClick={handlePing}>
            {pingStatus === 'testing' ? '⏳ Probando...' : '📡 Probar conexión'}
          </button>
          {pingStatus === 'ok' && <span style={{ color: C.green, fontSize: 13 }}>✅ Alcanzable {pingMs != null ? `(${pingMs}ms)` : ''}</span>}
          {pingStatus === 'error' && <span style={{ color: C.red, fontSize: 13 }}>❌ No responde</span>}
        </div>

        {testErr && <div style={{ color: C.red, fontSize: 13, marginTop: 10, background: '#1c0a0a', padding: '8px 12px', borderRadius: 6 }}>⚠️ {testErr}</div>}
        <button style={{ ...btn(), marginTop: 16, opacity: testing ? 0.6 : 1 }} disabled={testing}
          onClick={() => handleConnectTo(manualIP.trim(), Number(manualPort) || 3001)}>
          {testing ? 'Verificando...' : 'Conectar y guardar'}
        </button>
      </div>
      <div style={{ color: C.text2, fontSize: 12, marginTop: 12, lineHeight: 1.7 }}>
        💡 La IP la ves abriendo esta ventana (F9) en la <strong>PC servidor</strong>. Cada PC cliente debe conectarse a esa misma IP.<br/>
        Si "Probar conexión" falla → abrí esta ventana en el servidor → presioná <strong>"Reparar firewall"</strong>.
      </div>
    </div>
  );

  if (step === 'server-confirm') return (
    <div style={wrap}>
      <button onClick={() => setStep('menu')} style={{ background: 'none', border: 'none', color: C.text2, cursor: 'pointer', marginBottom: 20, fontSize: 13 }}>← Volver</button>
      <h2 style={{ margin: '0 0 20px', fontSize: 20 }}>🖥️ Configurar como servidor</h2>
      <div style={card}>
        <p style={{ color: C.text2, marginBottom: 16 }}>Esta PC quedará como <strong style={{ color: C.text }}>servidor principal</strong>. Las otras PCs se conectarán a:</p>
        <div style={{ background: C.bg3, borderRadius: 8, padding: '12px 16px', fontFamily: 'monospace', fontSize: 15, color: C.accent, marginBottom: 16 }}>
          {primaryIP}:{serverPort}
        </div>
        {allIPs.length > 1 && (
          <div style={{ color: C.yellow, fontSize: 12, marginBottom: 14 }}>
            ⚠️ Múltiples IPs detectadas. Todas las PCs clientes deben usar la IP de la red que comparten con este servidor.
          </div>
        )}
        <button style={btn(C.teal)} onClick={handleSetServer}>Confirmar — Usar esta PC como servidor</button>
        {testErr && <div style={{ color: C.red, fontSize: 13, marginTop: 10 }}>{testErr}</div>}
      </div>
    </div>
  );

  return null;
};

export default NetworkSetupWindow;

