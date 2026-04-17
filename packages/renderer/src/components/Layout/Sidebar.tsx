import React from 'react';
import {
  ShoppingCart, Users, Package, Archive, Wallet,
  BarChart2, CreditCard, HelpCircle, Settings,
  ChevronRight, ChevronLeft, LayoutDashboard, Layers, PlayCircle, BookOpen, Lock,
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { useAppStore } from '../../store/useAppStore';
import { useTranslation } from 'react-i18next';
import AriesLogo from '../../assets/icon_logo.png';

interface NavItem {
  id: string;
  label: string;
  icon: React.ElementType;
  badge?: string;
  badgeColor?: 'red' | 'yellow' | 'blue';
}

const BADGE_COLORS: Record<string, string> = {
  red:    'badge-red',
  yellow: 'badge-yellow',
  blue:   'badge-blue',
};

export default function Sidebar() {
  const { currentModule, setCurrentModule, sidebarCollapsed, toggleSidebar, config, currentUser } = useAppStore();
  const { t } = useTranslation();
  const W = sidebarCollapsed ? 64 : 220;

  // Lista de módulos que pueden ser restringidos
  const MODULOS_RESTRINGIBLES = ['ventas','clientes','stock','estadisticas','caja','librocaja','productos','configuracion'];

  // Si el usuario es admin, no restringir nada
  const isAdmin = currentUser?.rol === 'admin';

  // Helper para saber si un módulo está habilitado
  const moduloHabilitado = (id: string) => {
    if (isAdmin) return true;
    if (!MODULOS_RESTRINGIBLES.includes(id)) return true;
    // Si no está seteado, por defecto está habilitado
    return config[`modulo_${id}`] !== 'false';
  };

  const GROUPS: { label: string; items: NavItem[] }[] = [
    {
      label: t('nav.group.principal'),
      items: [
        { id: 'dashboard',     label: t('nav.dashboard'),     icon: LayoutDashboard },
        { id: 'pos',           label: t('nav.pos'),           icon: ShoppingCart },
        { id: 'clientes',      label: t('nav.clientes'),      icon: Users },
      ],
    },
    {
      label: t('nav.group.negocio'),
      items: [
        { id: 'productos',     label: t('nav.productos'),     icon: Package },
        { id: 'combos',        label: t('nav.combos'),        icon: Layers },
        { id: 'stock',         label: t('nav.stock'),         icon: Archive },
        { id: 'caja',          label: t('nav.caja'),          icon: Wallet },
        { id: 'ventas',        label: t('nav.ventas'),        icon: CreditCard },
        { id: 'cuentaspagar',  label: t('nav.cuentaspagar'),  icon: CreditCard },
        { id: 'librocaja',     label: 'Libro de Caja',        icon: BookOpen },
      ],
    },
    {
      label: t('nav.group.sistema'),
      items: [
        { id: 'estadisticas',  label: t('nav.estadisticas'),  icon: BarChart2 },
        { id: 'configuracion', label: t('nav.configuracion'), icon: Settings },
        { id: 'tutoriales',    label: t('nav.tutoriales'),    icon: PlayCircle },
        { id: 'ayuda',         label: t('nav.ayuda'),         icon: HelpCircle },
      ],
    },
  ];

  return (
    <aside
      className="flex flex-col shrink-0 overflow-hidden transition-all duration-200"
      style={{ width: W, minWidth: W, background: 'var(--bg2)', borderRight: '1px solid var(--border)' }}
    >
      {/* Toggle header */}
      <button
        onClick={toggleSidebar}
        className="flex items-center shrink-0 transition-all duration-150 hover:brightness-110 focus:outline-none"
        style={{
          height: 52,
          padding: sidebarCollapsed ? '0' : '0 12px 0 16px',
          gap: 10,
          justifyContent: sidebarCollapsed ? 'center' : 'space-between',
          borderBottom: '1px solid var(--border)',
        }}
        title={sidebarCollapsed ? t('sidebar.expand') : t('sidebar.collapse')}
      >
        <div className="flex items-center gap-2.5 overflow-hidden">
          <img
            src={AriesLogo}
            alt="ARIESPos"
            style={{
              width: 38, height: 38,
              objectFit: 'contain',
              flexShrink: 0,
              filter: 'drop-shadow(0 0 5px rgba(190,50,120,0.5))',
            }}
          />
          {!sidebarCollapsed && (
            <span className="font-bold whitespace-nowrap" style={{ fontFamily: "'Syne', sans-serif", fontSize: 14, color: 'var(--text)' }}>
              ARIES<span style={{ color: 'var(--accent)' }}>Pos</span>
            </span>
          )}
        </div>
        {!sidebarCollapsed && <ChevronLeft size={14} style={{ color: 'var(--text3)', flexShrink: 0 }} />}
      </button>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto overflow-x-hidden" style={{ padding: '8px' }}>
        {GROUPS.map((group) => (
          <div key={group.label} className="mb-1">
            {!sidebarCollapsed && <div className="section-label">{group.label}</div>}
            {sidebarCollapsed && <div style={{ height: 10 }} />}
            {group.items.map((item) => {
              const Icon = item.icon;
              const isActive = currentModule === item.id;
              const enabled = moduloHabilitado(item.id);
              return (
                <button
                  key={item.id}
                  onClick={() => enabled && setCurrentModule(item.id)}
                  className={cn('sidebar-item', isActive && 'active', !enabled && 'opacity-50 cursor-not-allowed')}
                  style={{ justifyContent: sidebarCollapsed ? 'center' : 'flex-start', padding: sidebarCollapsed ? '10px 0' : undefined }}
                  title={sidebarCollapsed ? item.label : undefined}
                  disabled={!enabled}
                >
                  <Icon size={16} className="shrink-0" />
                  {!sidebarCollapsed && (
                    <>
                      <span className="flex-1 truncate">{item.label}</span>
                      {!enabled && !isAdmin && <Lock size={11} className="shrink-0 text-slate-500" />}
                      {item.badge && (
                        <span className={cn('badge text-xs', BADGE_COLORS[item.badgeColor ?? 'blue'])}>{item.badge}</span>
                      )}
                    </>
                  )}
                </button>
              );
            })}
          </div>
        ))}
      </nav>

      {/* Footer */}
      {!sidebarCollapsed && (
        <div style={{ padding: '10px 12px', borderTop: '1px solid var(--border)', fontSize: 11, color: 'var(--text3)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <div style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--accent3)' }} className="animate-pulse-dot" />
            Sistema operativo
          </div>
        </div>
      )}
    </aside>
  );
}