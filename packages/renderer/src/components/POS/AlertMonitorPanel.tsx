import React, { useRef, useEffect } from 'react';
import { Bell, Trash2, X, ShoppingCart, AlertTriangle, XCircle } from 'lucide-react';
import { useAlertMonitorStore, AlertEvent, AlertEventType } from '../../store/useAlertMonitorStore';

const EVENT_ICONS: Record<AlertEventType, React.ReactNode> = {
  item_removed:    <Trash2 size={13} />,
  cart_cleared:    <ShoppingCart size={13} />,
  sale_failed:     <XCircle size={13} />,
  sale_cancelled:  <AlertTriangle size={13} />,
};

const EVENT_COLORS: Record<AlertEventType, string> = {
  item_removed:   'var(--warn)',
  cart_cleared:   'var(--accent2)',
  sale_failed:    'var(--danger)',
  sale_cancelled: 'var(--text3)',
};

const EVENT_LABELS: Record<AlertEventType, string> = {
  item_removed:   'Producto eliminado',
  cart_cleared:   'Carrito vaciado',
  sale_failed:    'Venta fallida',
  sale_cancelled: 'Venta cancelada',
};

function formatTime(date: Date): string {
  return date.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

interface AlertMonitorPanelProps {
  open: boolean;
  onClose: () => void;
}


import { useAppStore } from '../../store/useAppStore';

export const AlertMonitorPanel: React.FC<AlertMonitorPanelProps> = ({ open, onClose }) => {
  const { events, unread, markAllRead, clearAll } = useAlertMonitorStore();
  const { currentUser } = useAppStore();
  const isAdmin = currentUser?.rol === 'admin';
  const panelRef = useRef<HTMLDivElement>(null);

  // Marcar como leídos al abrir
  useEffect(() => {
    if (open && unread > 0) markAllRead();
  }, [open, unread, markAllRead]);

  // Cerrar al hacer click fuera
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      ref={panelRef}
      style={{
        position: 'absolute',
        top: '100%',
        right: 0,
        marginTop: 6,
        width: 340,
        background: 'var(--bg2)',
        border: '1px solid var(--border)',
        borderRadius: 10,
        boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
        zIndex: 9999,
        overflow: 'hidden',
      }}
    >
      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '10px 14px', borderBottom: '1px solid var(--border)',
        background: 'var(--bg3)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <Bell size={13} style={{ color: 'var(--accent)' }} />
          <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text)', letterSpacing: '0.06em' }}>
            MONITOR DE ALERTAS
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          {events.length > 0 && isAdmin && (
            <button
              onClick={clearAll}
              style={{
                fontSize: 10, fontWeight: 600, color: 'var(--text3)',
                background: 'transparent', border: 'none', cursor: 'pointer',
                padding: '2px 6px', borderRadius: 4,
              }}
              onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--danger)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--text3)'; }}
            >
              Limpiar todo
            </button>
          )}
          {events.length > 0 && !isAdmin && (
            <span style={{ fontSize: 10, color: 'var(--text3)', opacity: 0.6, padding: '2px 6px', borderRadius: 4, cursor: 'not-allowed' }} title="Solo el admin puede borrar alertas">
              Limpiar todo
            </span>
          )}
          <button
            onClick={onClose}
            style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text3)', padding: 2 }}
          >
            <X size={13} />
          </button>
        </div>
      </div>

      {/* Lista de eventos */}
      <div style={{ maxHeight: 360, overflowY: 'auto' }}>
        {events.length === 0 ? (
          <div style={{ padding: '28px 0', textAlign: 'center' }}>
            <div style={{ fontSize: 28, marginBottom: 6 }}>✅</div>
            <p style={{ fontSize: 12, color: 'var(--text3)' }}>Sin alertas recientes</p>
          </div>
        ) : (
          events.map((ev: AlertEvent) => (
            <div
              key={ev.id}
              style={{
                display: 'flex', alignItems: 'flex-start', gap: 10,
                padding: '9px 14px',
                borderBottom: '1px solid var(--border)',
                background: ev.read ? 'transparent' : 'rgba(255,255,255,0.02)',
                transition: 'background 0.15s',
              }}
            >
              {/* Ícono tipo */}
              <div style={{
                marginTop: 1, flexShrink: 0,
                color: EVENT_COLORS[ev.type],
              }}>
                {EVENT_ICONS[ev.type]}
              </div>
              {/* Contenido */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 4 }}>
                  <span style={{ fontSize: 11, fontWeight: 700, color: EVENT_COLORS[ev.type] }}>
                    {EVENT_LABELS[ev.type]}
                  </span>
                  <span style={{ fontSize: 10, color: 'var(--text3)', flexShrink: 0 }}>
                    {formatTime(ev.timestamp)}
                  </span>
                </div>
                <div style={{ fontSize: 12, color: 'var(--text)', marginTop: 1, wordBreak: 'break-word' }}>
                  {ev.message}
                </div>
                {ev.detail && (
                  <div style={{ fontSize: 10, color: 'var(--text3)', marginTop: 2 }}>
                    {ev.detail}
                  </div>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Footer con leyenda */}
      {events.length > 0 && (
        <div style={{
          padding: '6px 14px', fontSize: 10, color: 'var(--text3)',
          borderTop: '1px solid var(--border)', background: 'var(--bg3)',
          display: 'flex', gap: 12,
        }}>
          {(['item_removed', 'cart_cleared', 'sale_failed', 'sale_cancelled'] as AlertEventType[]).map((type) => {
            const count = events.filter((e) => e.type === type).length;
            if (count === 0) return null;
            return (
              <span key={type} style={{ color: EVENT_COLORS[type] }}>
                {count}× {EVENT_LABELS[type].toLowerCase()}
              </span>
            );
          })}
        </div>
      )}
    </div>
  );
};

interface AlertMonitorButtonProps {
  className?: string;
}

export const AlertMonitorButton: React.FC<AlertMonitorButtonProps> = ({ className }) => {
  const { unread } = useAlertMonitorStore();
  const [open, setOpen] = React.useState(false);

  return (
    <div style={{ position: 'relative' }} className={className}>
      <button
        className="btn btn-ghost btn-sm flex items-center gap-1.5"
        style={{ fontSize: 11, position: 'relative' }}
        onClick={() => setOpen((v) => !v)}
        title="Monitor de alertas"
      >
        <Bell size={11} style={{ color: unread > 0 ? 'var(--warn)' : 'var(--text3)' }} />
        <span style={{ color: unread > 0 ? 'var(--warn)' : 'var(--text3)' }}>Alertas</span>
        {unread > 0 && (
          <span style={{
            position: 'absolute', top: 1, right: 1,
            background: 'var(--danger)', color: '#fff',
            borderRadius: 99, fontSize: 9, fontWeight: 700,
            minWidth: 14, height: 14, padding: '0 3px',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            lineHeight: 1,
          }}>
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>
      <AlertMonitorPanel open={open} onClose={() => setOpen(false)} />
    </div>
  );
};
