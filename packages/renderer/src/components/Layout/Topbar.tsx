import React, { useState, useEffect } from 'react';
import { Sparkles, Minus, Square, Maximize2, X } from 'lucide-react';
import { useAppStore } from '../../store/useAppStore';
import { useTranslation } from 'react-i18next';

export default function Topbar() {
  const { currentModule, toggleIa, iaOpen } = useAppStore();
  const { t } = useTranslation();
  const [isMaximized, setIsMaximized] = useState(false);

  const MODULE_TITLES: Record<string, { title: string; sub?: string }> = {
    dashboard:     { title: t('page.dashboard.title'),     sub: t('page.dashboard.sub') },
    pos:           { title: t('page.pos.title'),           sub: t('page.pos.sub') },
    productos:     { title: t('page.productos.title'),     sub: t('page.productos.sub') },
    clientes:      { title: t('page.clientes.title'),      sub: t('page.clientes.sub') },
    stock:         { title: t('page.stock.title'),         sub: t('page.stock.sub') },
    caja:          { title: t('page.caja.title'),          sub: t('page.caja.sub') },
    estadisticas:  { title: t('page.estadisticas.title'),  sub: t('page.estadisticas.sub') },
    configuracion: { title: t('page.configuracion.title'), sub: t('page.configuracion.sub') },
    ayuda:         { title: t('page.ayuda.title'),         sub: t('page.ayuda.sub') },
    ventas:        { title: t('page.ventas.title'),        sub: t('page.ventas.sub') },
    cuentaspagar:  { title: t('page.cuentaspagar.title'),  sub: t('page.cuentaspagar.sub') },
    combos:        { title: t('page.combos.title'),        sub: t('page.combos.sub') },
  };

  const info = MODULE_TITLES[currentModule] ?? { title: currentModule };

  useEffect(() => {
    window.electron.windowIsMaximized().then((v: boolean) => setIsMaximized(v));
    const unsub = window.electron.onWindowMaximize?.(() => {
      window.electron.windowIsMaximized().then((v: boolean) => setIsMaximized(v));
    });
    return () => { unsub?.(); };
  }, []);

  return (
    <div
      className="titlebar-drag shrink-0 flex items-center select-none"
      style={{ height: 46, background: 'var(--bg2)', borderBottom: '1px solid var(--border)', paddingLeft: 14, paddingRight: 0 }}
    >
      {/* Título del módulo */}
      <div className="titlebar-no-drag flex-1 pointer-events-none">
        <span className="font-semibold" style={{ fontFamily: "'Syne', sans-serif", fontSize: 14, color: 'var(--text)' }}>
          {info.title}
        </span>
        {info.sub && <span style={{ fontSize: 10, color: 'var(--text3)', marginLeft: 8 }}>{info.sub}</span>}
      </div>

      {/* Acciones + controles */}
      <div className="titlebar-no-drag flex items-center" style={{ gap: 4, paddingRight: 4 }}>
        {/* ARIES IA */}
        <button
          onClick={toggleIa}
          className="btn btn-ghost btn-sm"
          style={{ gap: 5, height: 30, color: iaOpen ? 'var(--accent)' : 'var(--text2)', background: iaOpen ? 'rgba(79,142,247,0.1)' : undefined, border: iaOpen ? '1px solid rgba(79,142,247,0.25)' : '1px solid transparent' }}
        >
          <Sparkles size={13} />
          <span style={{ fontSize: 12 }}>ARIES IA</span>
          {iaOpen && <span className="animate-pulse-dot rounded-full" style={{ width: 5, height: 5, background: 'var(--accent3)', display: 'inline-block' }} />}
        </button>

        {/* Red */}
        <button
          onClick={() => window.electron.openNetworkWindow()}
          className="btn btn-ghost btn-sm"
          style={{ height: 30, color: 'var(--accent2)', fontSize: 12, fontWeight: 700 }}
        >
          Red
        </button>

        {/* Controles de ventana */}
        <div style={{ display: 'flex', marginLeft: 6 }}>
          <WinBtn onClick={() => window.electron.windowMinimize()} title="Minimizar" hoverBg="var(--bg3)">
            <Minus size={14} />
          </WinBtn>
          <WinBtn onClick={() => window.electron.windowMaximize()} title={isMaximized ? 'Restaurar' : 'Maximizar'} hoverBg="var(--bg3)">
            {isMaximized ? <Square size={12} /> : <Maximize2 size={13} />}
          </WinBtn>
          <WinBtn onClick={() => window.electron.windowClose()} title="Cerrar" hoverBg="#c42b1c" hoverColor="#fff">
            <X size={14} />
          </WinBtn>
        </div>
      </div>
    </div>
  );
}

function WinBtn({ children, onClick, title, hoverBg, hoverColor }: {
  children: React.ReactNode;
  onClick: () => void;
  title: string;
  hoverBg: string;
  hoverColor?: string;
}) {
  const [hovered, setHovered] = useState(false);
  return (
    <button
      onClick={onClick}
      title={title}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{ width: 46, height: 46, border: 'none', background: hovered ? hoverBg : 'transparent', color: hovered && hoverColor ? hoverColor : 'var(--text3)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'background 0.12s, color 0.12s' }}
    >
      {children}
    </button>
  );
}
