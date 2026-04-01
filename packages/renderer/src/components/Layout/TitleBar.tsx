import React from 'react';

export default function TitleBar() {
  return (
    <div
      className="titlebar-drag flex items-center justify-between shrink-0 select-none"
      style={{
        height: 36,
        background: 'var(--bg2)',
        borderBottom: '1px solid var(--border)',
        paddingLeft: 16,
        paddingRight: 16,
      }}
    >
      {/* Logo + nombre */}
      <div className="titlebar-no-drag flex items-center gap-2.5 pointer-events-none">
        {/* Ícono ARIES */}
        <div
          className="flex items-center justify-center rounded-md text-white font-black text-xs"
          style={{
            width: 22,
            height: 22,
            background: 'linear-gradient(135deg, var(--accent) 0%, var(--accent2) 100%)',
            fontSize: 10,
            letterSpacing: 0,
          }}
        >
          A
        </div>
        <span
          style={{
            fontFamily: "'Syne', sans-serif",
            fontWeight: 700,
            fontSize: 12,
            color: 'var(--text)',
            letterSpacing: '0.02em',
          }}
        >
          ARIES<span style={{ color: 'var(--accent)' }}>Pos</span>
        </span>
      </div>

      {/* Versión */}
      <div
        className="titlebar-no-drag pointer-events-none"
        style={{ fontSize: 10, color: 'var(--text3)', fontFamily: "'DM Mono', monospace" }}
      >
        v1.0.0
      </div>
    </div>
  );
}
