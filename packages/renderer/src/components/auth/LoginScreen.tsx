import React, { useState, useEffect, useCallback } from 'react';
import toast from 'react-hot-toast';
import { useAppStore } from '../../store/useAppStore';
import { usuariosAPI, appAPI, networkAPI } from '../../lib/api';
import AriesLogo from '../../assets/icon_logo.png';

interface LoginResult {
  id: number;
  nombre: string;
  rol: string;
}

export const LoginScreen: React.FC = () => {
  const { login } = useAppStore();
  const [pin, setPin] = useState('');
  const [loading, setLoading] = useState(false);
  const [shake, setShake] = useState(false);
  const [appMode, setAppMode] = useState<'server' | 'server-only' | 'client' | null>(null);
  const [firewallStatus, setFirewallStatus] = useState<'idle' | 'working' | 'ok' | 'error'>('idle');
  // Diagnóstico del servidor local (solo modo servidor)
  const [serverCheck, setServerCheck] = useState<'idle' | 'checking' | 'ok' | 'wrong-port' | 'down'>('idle');
  const [serverActivePort, setServerActivePort] = useState(3001);
  const [networkProfile, setNetworkProfile] = useState<string>(''); // 'Private' | 'Public' | 'DomainAuthenticated' | 'Unknown'
  const [diagResult, setDiagResult] = useState<{ port3001Listening: boolean; localPingOk: boolean; firewallRule: boolean; hasPublicNetwork: boolean } | null>(null);

  const checkServerHealth = useCallback(() => {
    setServerCheck('checking');
    setDiagResult(null);
    networkAPI.serverInfo()
      .then(info => {
        setServerActivePort(info.port);
        const ctrl = new AbortController();
        const t = setTimeout(() => ctrl.abort(), 3000);
        fetch(`http://localhost:${info.port}/api/ping`, { signal: ctrl.signal })
          .then(r => {
            clearTimeout(t);
            if (r.ok) setServerCheck(info.port !== 3001 ? 'wrong-port' : 'ok');
            else { setServerCheck('down'); networkAPI.diagnose().then(d => setDiagResult(d)).catch(() => {}); }
          })
          .catch(() => { clearTimeout(t); setServerCheck('down'); networkAPI.diagnose().then(d => setDiagResult(d)).catch(() => {}); });
      })
      .catch(() => { setServerCheck('down'); networkAPI.diagnose().then(d => setDiagResult(d)).catch(() => {}); });
  }, []);

  useEffect(() => {
    appAPI.getAppConfig().then(cfg => {
      const mode = cfg?.mode ?? null;
      setAppMode(mode);
      if (mode === 'server' || mode === 'server-only') {
        // Pequeña espera para que el servidor tenga tiempo de arrancar
        setTimeout(checkServerHealth, 1200);
        // Verificar perfil de red Windows
        networkAPI.getNetworkProfile().then(r => setNetworkProfile(r?.profile ?? '')).catch(() => {});
      }
    }).catch(() => {});
  }, [checkServerHealth]);

  const handleFirewall = async () => {
    setFirewallStatus('working');
    toast('Aparecerá una ventana de Windows pidiendo permisos. Por favor aceptala.', { icon: 'ℹ️', duration: 8000 });
    try {
      const res = await networkAPI.openFirewall(3001);
      setFirewallStatus(res?.success ? 'ok' : 'error');
      if (res?.success) {
        toast.success('Puerto 3001 abierto — otras PCs ya pueden conectarse');
        // Refrescar diagnóstico y perfil de red después de abrir el firewall
        setTimeout(() => {
          checkServerHealth();
          networkAPI.getNetworkProfile().then(r => setNetworkProfile(r?.profile ?? '')).catch(() => {});
        }, 1000);
      } else {
        toast.error('No se pudo abrir el firewall. Ejecutá ARIESPos como administrador.');
      }
    } catch {
      setFirewallStatus('error');
      toast.error('Error al abrir el firewall');
    }
  };

  const handleLogin = async () => {
    if (pin.length < 4) return;
    setLoading(true);
    try {
      const user = await usuariosAPI.login(pin) as LoginResult | null;
      if (user) {
        login(user);
        toast.success(`Bienvenido, ${user.nombre}`);
      } else {
        setShake(true);
        setPin('');
        toast.error('PIN incorrecto');
        setTimeout(() => setShake(false), 500);
      }
    } catch (_e: unknown) {
      setShake(true);
      setPin('');
      toast.error('Error de conexión con el servidor');
      setTimeout(() => setShake(false), 500);
    } finally {
      setLoading(false);
    }
  };

  const switchToServer = async () => {
    try {
      await appAPI.becomeServer();
    } catch { /* ignorar */ }
  };

  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') handleLogin();
  };

  const pressDigit = (d: string) => {
    if (pin.length < 8) {
      const newPin = pin + d;
      setPin(newPin);
      if (newPin.length >= 4) {
        // Auto-login si el pin tiene 4+ dígitos y se presiona
      }
    }
  };

  return (
    <div className="flex h-screen items-center justify-center" style={{ background: '#0d0f14', backgroundImage: 'radial-gradient(ellipse at center, #1a1028 0%, #0d0f14 70%)' }}>
      <div className="w-80 space-y-8">
        {/* Logo */}
        <div className="text-center">
          <img
            src={AriesLogo}
            alt="ARIESPos"
            style={{
              width: 96, height: 96,
              objectFit: 'contain',
              margin: '0 auto 16px',
              display: 'block',
              filter: 'drop-shadow(0 4px 20px rgba(190,50,120,0.55))',
            }}
          />
          <h1 className="text-3xl font-black text-white mt-4 tracking-tight">
            ARIES<span style={{ color: '#be3278' }}>Pos</span>
          </h1>
          <p className="text-slate-400 text-sm mt-1 tracking-widest uppercase">Punto de Venta</p>
        </div>

        {/* PIN input */}
        <div className={`space-y-4 ${shake ? 'animate-[shake_0.4s_ease-in-out]' : ''}`}>
          <div className="relative">
            <input
              type="password"
              maxLength={8}
              inputMode="numeric"
              pattern="[0-9]*"
              placeholder="PIN de acceso"
              value={pin}
              onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 8))}
              onKeyDown={handleKeyPress}
              autoFocus
              className="w-full bg-slate-800 border border-slate-600 rounded-xl px-5 py-4 text-center text-2xl font-mono tracking-[0.5em] text-white focus:outline-none focus:border-[#be3278] transition-colors placeholder:text-slate-600 placeholder:tracking-normal placeholder:text-base"
            />
            {/* Indicadores de dígitos */}
            <div className="flex justify-center gap-2 mt-3">
              {Array.from({ length: Math.max(4, pin.length) }).map((_, i) => (
                <div
                  key={i}
                  className={`w-2.5 h-2.5 rounded-full transition-all ${i < pin.length ? 'scale-110' : 'bg-slate-600'}`}
                  style={i < pin.length ? { backgroundColor: '#be3278' } : {}}
                />
              ))}
            </div>
          </div>

          <button
            onClick={handleLogin}
            disabled={loading || pin.length < 4}
            className="w-full py-4 text-white rounded-xl font-bold text-lg transition-all active:scale-95 shadow-lg disabled:bg-slate-700 disabled:text-slate-500"
            style={loading || pin.length < 4 ? {} : { background: '#be3278', boxShadow: '0 4px 20px rgba(190,50,120,0.35)' }}
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Verificando...
              </span>
            ) : 'Ingresar'}
          </button>

          {/* Teclado numérico */}
          <div className="grid grid-cols-3 gap-2 mt-2">
            {[1, 2, 3, 4, 5, 6, 7, 8, 9, null, 0, 'del'].map((d, i) => (
              d === null ? (
                <div key={i} />
              ) : d === 'del' ? (
                <button
                  key={i}
                  onClick={() => setPin((p) => p.slice(0, -1))}
                  className="py-3 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded-xl font-bold text-lg transition-all active:scale-95"
                >
                  ⌫
                </button>
              ) : (
                <button
                  key={i}
                  onClick={() => pressDigit(String(d))}
                  className="py-3 bg-slate-800 hover:bg-slate-700 text-white rounded-xl font-bold text-xl transition-all active:scale-95 border border-slate-700"
                >
                  {d}
                </button>
              )
            ))}
          </div>

          <p className="text-center text-xs text-slate-600">
            PIN por defecto: <span className="font-mono text-slate-500">1234</span>
          </p>
        </div>

        {/* Acceso rápido a configuración de red */}
        <div style={{ textAlign: 'center', marginTop: 20, display: 'flex', flexDirection: 'column', gap: 6 }}>
          {/* Diagnóstico del servidor local — solo modo servidor */}
          {(appMode === 'server' || appMode === 'server-only') && (
            <div style={{
              background: '#0f172a', border: '1px solid #1e293b', borderRadius: 8,
              padding: '8px 12px', fontSize: 12, textAlign: 'left', marginBottom: 2,
            }}>
              {serverCheck === 'idle' && (
                <span style={{ color: '#475569' }}>Modo servidor</span>
              )}
              {serverCheck === 'checking' && (
                <span style={{ color: '#64748b' }}>🔍 Verificando servidor local...</span>
              )}
              {serverCheck === 'ok' && (
                <span style={{ color: '#10b981' }}>✅ Servidor activo en puerto 3001 — otras PCs pueden conectarse</span>
              )}
              {/* Aviso RED PÚBLICA — causa más frecuente de que nadie se pueda conectar */}
              {networkProfile && networkProfile !== 'Private' && networkProfile !== 'DomainAuthenticated' && (
                <div style={{ marginTop: 8, background: '#7c2d12', border: '1px solid #9a3412', borderRadius: 6, padding: '7px 10px' }}>
                  <div style={{ color: '#fed7aa', fontWeight: 700, fontSize: 12 }}>
                    ⚠️ Red Windows clasificada como <strong>{networkProfile}</strong>
                  </div>
                  <div style={{ color: '#fdba74', fontSize: 11, marginTop: 3 }}>
                    En redes Públicas Windows bloquea las conexiones entrantes. Hacé clic en <strong>"Abrir puerto"</strong> abajo para cambiarla a Privada automáticamente.
                  </div>
                </div>
              )}              {serverCheck === 'wrong-port' && (
                <div>
                  <div style={{ color: '#f59e0b', fontWeight: 700 }}>
                    ⚠️ Servidor activo en puerto <strong>{serverActivePort}</strong> (3001 estaba ocupado)
                  </div>
                  <div style={{ color: '#94a3b8', marginTop: 2 }}>
                    Abrí el firewall para el puerto {serverActivePort}, o reiniciá la PC para liberar el puerto 3001.
                  </div>
                  <button
                    onClick={async () => {
                      setFirewallStatus('working');
                      const res = await networkAPI.openFirewall(serverActivePort).catch(() => ({ success: false }));
                      setFirewallStatus(res?.success ? 'ok' : 'error');
                      if (res?.success) toast.success(`Puerto ${serverActivePort} abierto`);
                      else toast.error('Ejecutá ARIESPos como administrador');
                    }}
                    style={{
                      marginTop: 6, background: '#78350f', border: 'none', borderRadius: 6,
                      color: '#fcd34d', fontSize: 11, cursor: 'pointer', padding: '4px 10px', fontWeight: 700,
                    }}
                  >
                    🛡️ Abrir firewall para puerto {serverActivePort}
                  </button>
                </div>
              )}
              {serverCheck === 'down' && (
                <div>
                  <div style={{ color: '#ef4444', fontWeight: 700 }}>❌ El servidor local no responde</div>
                  {/* Diagnóstico detallado */}
                  {diagResult ? (
                    <div style={{ marginTop: 5, fontSize: 11 }}>
                      {!diagResult.port3001Listening && (
                        <div style={{ color: '#fca5a5', marginBottom: 3 }}>
                          ⚠️ Puerto 3001 no está activo — el servidor no arrancó. Reiniciá la app.
                        </div>
                      )}
                      {diagResult.port3001Listening && !diagResult.localPingOk && (
                        <div style={{ color: '#fca5a5', marginBottom: 3 }}>
                          ⚠️ Puerto escuchando pero no responde — posible error interno del servidor.
                        </div>
                      )}
                      {diagResult.hasPublicNetwork && (
                        <div style={{ color: '#fed7aa', marginBottom: 3 }}>
                          ⚠️ Tu red WiFi está en modo <strong>PÚBLICO</strong> — Windows bloquea conexiones entrantes.
                          Hacé clic en <strong>"🛡️ Abrir puerto"</strong> abajo para cambiarlo a Privado.
                        </div>
                      )}
                      {!diagResult.firewallRule && (
                        <div style={{ color: '#fed7aa', marginBottom: 3 }}>
                          ⚠️ Regla de firewall faltante — hacé clic en <strong>"🛡️ Abrir puerto"</strong> abajo.
                        </div>
                      )}
                    </div>
                  ) : (
                    <div style={{ color: '#64748b', marginTop: 2, fontSize: 11 }}>🔍 Diagnosticando...</div>
                  )}
                  <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
                    <button
                      onClick={checkServerHealth}
                      style={{ background: '#1e293b', border: 'none', borderRadius: 6, color: '#94a3b8', fontSize: 11, cursor: 'pointer', padding: '4px 10px' }}
                    >
                      🔄 Verificar de nuevo
                    </button>
                    <button
                      onClick={() => appAPI.becomeServer()}
                      style={{ background: '#7f1d1d', border: 'none', borderRadius: 6, color: '#fca5a5', fontSize: 11, cursor: 'pointer', padding: '4px 10px', fontWeight: 700 }}
                    >
                      🔁 Reiniciar como servidor
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Si es servidor: mostrar botón de firewall prominente */}
          {(appMode === 'server' || appMode === 'server-only') && (
            <button
              onClick={handleFirewall}
              disabled={firewallStatus === 'working'}
              style={{
                background: firewallStatus === 'ok' ? '#064e3b' : firewallStatus === 'error' ? '#7f1d1d' : '#0f766e',
                border: 'none', borderRadius: 8, color: '#fff', fontSize: 12,
                cursor: firewallStatus === 'working' ? 'not-allowed' : 'pointer',
                padding: '8px 16px', fontWeight: 700, opacity: firewallStatus === 'working' ? 0.6 : 1,
              }}
            >
              {firewallStatus === 'working' ? '⏳ Abriendo firewall...'
                : firewallStatus === 'ok' ? '✅ Firewall abierto — otras PCs pueden conectarse'
                : firewallStatus === 'error' ? '❌ Falló — ejecutar como administrador'
                : '🛡️ Abrir puerto para otras PCs (necesario)'}
            </button>
          )}
          <button
            onClick={() => (window as any).electron?.invoke('window:open-network')}
            style={{ background: 'none', border: '1px solid #1e293b', borderRadius: 8, color: '#475569', fontSize: 11, cursor: 'pointer', padding: '6px 16px' }}
          >
            ⚙️ Configuración de red
          </button>
          {appMode !== 'server' && (
            <button
              onClick={switchToServer}
              style={{ background: 'none', border: 'none', color: '#334155', fontSize: 11, cursor: 'pointer', textDecoration: 'underline' }}
            >
              🖥️ Usar esta PC como servidor independiente
            </button>
          )}
        </div>

        {/* Hint del atajo de teclado */}
        <p style={{ textAlign: 'center', fontSize: 10, color: '#1e293b', marginTop: 12 }}>
          Ctrl+Shift+R = restablecer configuración
        </p>
      </div>
    </div>
  );
};
