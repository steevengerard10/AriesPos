import React from 'react';
import { Sparkles, Plus } from 'lucide-react';
import { useAppStore } from '../../store/useAppStore';
import { useTranslation } from 'react-i18next';

export default function Topbar() {
  const { currentModule, setCurrentModule, toggleIa, iaOpen } = useAppStore();
  const { t } = useTranslation();

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

  return (
    <div
      className="flex items-center justify-between shrink-0 px-5"
      style={{
        height: 52,
        background: 'var(--bg2)',
        borderBottom: '1px solid var(--border)',
      }}
    >
      {/* Page title */}
      <div>
        <h1
          className="font-bold leading-none"
          style={{ fontFamily: "'Syne', sans-serif", fontSize: 15, color: 'var(--text)' }}
        >
          {info.title}
        </h1>
        {info.sub && (
          <p style={{ fontSize: 11, color: 'var(--text3)', marginTop: 2 }}>{info.sub}</p>
        )}
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2">
        {/* ARIES IA toggle */}
        <button
          onClick={toggleIa}
          className="btn btn-ghost btn-sm"
          style={{
            gap: 6,
            color: iaOpen ? 'var(--accent)' : 'var(--text2)',
            background: iaOpen ? 'rgba(79,142,247,0.1)' : undefined,
            border: iaOpen ? '1px solid rgba(79,142,247,0.25)' : '1px solid transparent',
          }}
        >
          <Sparkles size={14} />
          <span>ARIES IA</span>
          {iaOpen && (
            <span
              className="animate-pulse-dot rounded-full"
              style={{ width: 5, height: 5, background: 'var(--accent3)', display: 'inline-block' }}
            />
          )}
        </button>

        {/* Nueva Venta */}
        <button
          onClick={() => setCurrentModule('pos')}
          className="btn btn-primary btn-sm"
        >
          <Plus size={14} />
          {t('action.newSale')}
          <kbd style={{ marginLeft: 2 }}>F3</kbd>
        </button>

        {/* Configuración de Red */}
        <button
          onClick={() => window.electron.openNetworkWindow()}
          className="btn btn-ghost btn-sm"
          style={{ color: 'var(--accent2)' }}
        >
          <span style={{ fontWeight: 700 }}>Red</span>
        </button>
      </div>
    </div>
  );
}
