import React, { useState } from 'react';
import toast from 'react-hot-toast';
import { useAppStore } from '../../store/useAppStore';
import { usuariosAPI } from '../../lib/api';
import AriesLogo from '../../assets/aries_logo.svg';

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
    } finally {
      setLoading(false);
    }
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
              width: 80, height: 80,
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
      </div>
    </div>
  );
};
