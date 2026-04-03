import React from 'react';
import AriesLogo from '../../assets/aries_logo.svg';

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
      <div className="titlebar-no-drag flex items-center gap-2 pointer-events-none">
        <img
          src={AriesLogo}
          alt="ARIESPos"
          style={{ width: 20, height: 20, objectFit: 'contain', filter: 'drop-shadow(0 0 4px rgba(190,50,120,0.5))' }}
        />
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
