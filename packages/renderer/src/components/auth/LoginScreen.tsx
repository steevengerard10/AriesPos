import React, { useState } from 'react';
import toast from 'react-hot-toast';
import { useAppStore } from '../../store/useAppStore';
import { usuariosAPI } from '../../lib/api';

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
    <div className="flex h-screen items-center justify-center bg-slate-900 bg-[radial-gradient(ellipse_at_center,_#1e3a5f_0%,_#0f172a_70%)]">
      <div className="w-80 space-y-8">
        {/* Logo */}
        <div className="text-center">
          <div className="w-20 h-20 bg-blue-600 rounded-3xl flex items-center justify-center text-white font-black text-4xl mx-auto shadow-2xl shadow-blue-600/40">
            A
          </div>
          <h1 className="text-3xl font-black text-white mt-4 tracking-tight">ARIESPos</h1>
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
              className="w-full bg-slate-800 border border-slate-600 rounded-xl px-5 py-4 text-center text-2xl font-mono tracking-[0.5em] text-white focus:outline-none focus:border-blue-500 transition-colors placeholder:text-slate-600 placeholder:tracking-normal placeholder:text-base"
            />
            {/* Indicadores de dígitos */}
            <div className="flex justify-center gap-2 mt-3">
              {Array.from({ length: Math.max(4, pin.length) }).map((_, i) => (
                <div
                  key={i}
                  className={`w-2.5 h-2.5 rounded-full transition-all ${i < pin.length ? 'bg-blue-500 scale-110' : 'bg-slate-600'}`}
                />
              ))}
            </div>
          </div>

          <button
            onClick={handleLogin}
            disabled={loading || pin.length < 4}
            className="w-full py-4 bg-blue-600 hover:bg-blue-500 disabled:bg-slate-700 disabled:text-slate-500 text-white rounded-xl font-bold text-lg transition-all active:scale-95 shadow-lg shadow-blue-600/30"
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
