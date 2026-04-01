import React, { useState, useRef } from 'react';

interface Props {
  onActivated: () => void;
}

export const LicenseScreen: React.FC<Props> = ({ onActivated }) => {
  const [key, setKey] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-formatear mientras escribe: ARIES-XXXX-XXXX-XXXX-XXXX
  const handleChange = (val: string) => {
    const clean = val.toUpperCase().replace(/[^A-Z0-9]/g, '');
    let formatted = '';
    if (clean.startsWith('ARIES')) {
      formatted = 'ARIES';
      const rest = clean.slice(5);
      for (let i = 0; i < rest.length && i < 16; i++) {
        if (i > 0 && i % 4 === 0) formatted += '-';
        formatted += rest[i];
      }
    } else {
      // Si pega la clave completa con guiones, usarla tal cual
      formatted = val.toUpperCase();
    }
    setKey(formatted);
    setError('');
  };

  const handleActivate = async () => {
    if (!key.trim()) {
      setError('Ingresá tu clave de licencia.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const electron = (window as any).electron;
      const result = await electron.licenseActivate(key.trim());
      if (result.success) {
        onActivated();
      } else {
        setError(result.error || 'Clave inválida. Verificá que la copiaste correctamente.');
      }
    } catch {
      setError('Error al validar la clave. Reiniciá la aplicación.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="flex items-center justify-center h-screen flex-col"
      style={{ background: '#0d1117', fontFamily: "'Syne', sans-serif" }}
    >
      {/* Logo */}
      <div className="flex items-center gap-3 mb-10">
        <div
          className="flex items-center justify-center rounded-2xl text-white font-black text-2xl"
          style={{
            width: 52,
            height: 52,
            background: 'linear-gradient(135deg, #4f8ef7 0%, #7c3aed 100%)',
            boxShadow: '0 4px 24px rgba(79,142,247,0.4)',
          }}
        >
          A
        </div>
        <div>
          <div className="text-2xl font-black" style={{ color: '#f1f5f9', letterSpacing: '-0.02em' }}>
            ARIES<span style={{ color: '#4f8ef7' }}>Pos</span>
          </div>
          <div style={{ fontSize: 11, color: '#64748b', letterSpacing: '0.12em', textTransform: 'uppercase' }}>
            Sistema de ventas
          </div>
        </div>
      </div>

      {/* Card */}
      <div
        style={{
          background: '#161b27',
          border: '1px solid #1e293b',
          borderRadius: 16,
          padding: '36px 40px',
          width: 440,
          boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
        }}
      >
        <h2 style={{ color: '#f1f5f9', fontSize: 20, fontWeight: 700, marginBottom: 4, marginTop: 0 }}>
          Activar licencia
        </h2>
        <p style={{ color: '#64748b', fontSize: 13, marginBottom: 28, marginTop: 0 }}>
          Ingresá la clave que recibiste al comprar ARIESPos.
        </p>

        <label style={{ display: 'block', color: '#94a3b8', fontSize: 12, fontWeight: 600, marginBottom: 8, letterSpacing: '0.05em', textTransform: 'uppercase' }}>
          Clave de licencia
        </label>
        <input
          ref={inputRef}
          value={key}
          onChange={(e) => handleChange(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleActivate()}
          placeholder="ARIES-XXXX-XXXX-XXXX-XXXX"
          spellCheck={false}
          style={{
            width: '100%',
            background: '#0d1117',
            border: error ? '1px solid #ef4444' : '1px solid #1e293b',
            borderRadius: 8,
            padding: '12px 14px',
            color: '#f1f5f9',
            fontSize: 15,
            fontFamily: 'monospace',
            letterSpacing: '0.08em',
            outline: 'none',
            boxSizing: 'border-box',
            transition: 'border-color 0.2s',
          }}
          onFocus={(e) => (e.target.style.borderColor = error ? '#ef4444' : '#4f8ef7')}
          onBlur={(e) => (e.target.style.borderColor = error ? '#ef4444' : '#1e293b')}
        />

        {error && (
          <p style={{ color: '#ef4444', fontSize: 12, marginTop: 8, marginBottom: 0 }}>
            {error}
          </p>
        )}

        <button
          onClick={handleActivate}
          disabled={loading}
          style={{
            width: '100%',
            marginTop: 20,
            padding: '13px 0',
            background: loading ? '#1e293b' : 'linear-gradient(135deg, #4f8ef7 0%, #7c3aed 100%)',
            color: loading ? '#64748b' : '#fff',
            border: 'none',
            borderRadius: 8,
            fontSize: 14,
            fontWeight: 700,
            cursor: loading ? 'not-allowed' : 'pointer',
            transition: 'opacity 0.2s',
            fontFamily: "'Syne', sans-serif",
            letterSpacing: '0.03em',
          }}
        >
          {loading ? 'Verificando...' : 'Activar ARIESPos'}
        </button>

        <div style={{ marginTop: 24, padding: '14px 16px', background: '#0d1117', borderRadius: 8, border: '1px solid #1e293b' }}>
          <p style={{ color: '#64748b', fontSize: 12, margin: 0, lineHeight: 1.6 }}>
            ¿No tenés clave?{' '}
            <strong style={{ color: '#94a3b8' }}>Contactate por WhatsApp</strong> para adquirir tu licencia.
            <br />
            Cada clave funciona en <strong style={{ color: '#94a3b8' }}>1 equipo</strong> de forma permanente.
          </p>
        </div>
      </div>

      <p style={{ color: '#334155', fontSize: 11, marginTop: 20 }}>
        ARIESPos v{(window as any).electron?.getAppVersion?.() ?? '—'} — Licencia requerida para uso comercial
      </p>
    </div>
  );
};
