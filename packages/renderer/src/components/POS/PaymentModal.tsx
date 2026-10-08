import React, { useState, useEffect, useRef, useMemo } from 'react';
import { formatCurrency } from '../../lib/utils';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';
import { useVentasStore, MetodoPago } from '../../store/useVentasStore';
import { useAppStore } from '../../store/useAppStore';
import { printerAPI } from '../../lib/api';
import { Banknote, CreditCard, Smartphone, Bitcoin, FileText, Wallet, X, CheckCircle, AlertTriangle, ChevronLeft, Plus, Trash2, QrCode, Printer, type LucideIcon } from 'lucide-react';

interface MetodoPagoConfig { id: string; nombre: string; activo: boolean; }

const METODOS_BASE: Record<string, { Icon: LucideIcon; color: string; colorBg: string; colorBorder: string }> = {
  efectivo:        { Icon: Banknote,   color: 'var(--accent3)', colorBg: 'rgba(16,185,129,0.12)',  colorBorder: 'rgba(16,185,129,0.35)'  },
  tarjeta:         { Icon: CreditCard, color: '#60a5fa',        colorBg: 'rgba(96,165,250,0.12)',  colorBorder: 'rgba(96,165,250,0.35)'  },
  tarjeta_credito: { Icon: CreditCard, color: '#60a5fa',        colorBg: 'rgba(96,165,250,0.12)',  colorBorder: 'rgba(96,165,250,0.35)'  },
  tarjeta_debito:  { Icon: CreditCard, color: '#34d399',        colorBg: 'rgba(52,211,153,0.12)',  colorBorder: 'rgba(52,211,153,0.35)'  },
  transferencia:   { Icon: Smartphone, color: '#a78bfa',        colorBg: 'rgba(167,139,250,0.12)', colorBorder: 'rgba(167,139,250,0.35)' },
  qr:              { Icon: QrCode,     color: '#f472b6',        colorBg: 'rgba(244,114,182,0.12)', colorBorder: 'rgba(244,114,182,0.35)' },
  cripto:          { Icon: Bitcoin,    color: '#fbbf24',        colorBg: 'rgba(251,191,36,0.12)',  colorBorder: 'rgba(251,191,36,0.35)'  },
  fiado:           { Icon: FileText,   color: 'var(--warn)',    colorBg: 'rgba(245,158,11,0.12)',  colorBorder: 'rgba(245,158,11,0.35)'  },
};
const DEFAULT_ESTILO = { Icon: Wallet, color: '#94a3b8', colorBg: 'rgba(148,163,184,0.12)', colorBorder: 'rgba(148,163,184,0.35)' };

const METODOS_DEFAULT: MetodoPagoConfig[] = [
  { id: 'efectivo',        nombre: 'Efectivo',         activo: true },
  { id: 'tarjeta_credito', nombre: 'Tarjeta Crédito',  activo: true },
  { id: 'tarjeta_debito',  nombre: 'Tarjeta Débito',   activo: true },
  { id: 'transferencia',   nombre: 'Transferencia',    activo: true },
  { id: 'qr',              nombre: 'QR / MercadoPago', activo: true },
  { id: 'cripto',          nombre: 'Cripto',           activo: true },
  { id: 'fiado',           nombre: 'Fiado',            activo: true },
];

interface PaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (cobrado: number) => void | false | Record<string, unknown> | Promise<void | false | Record<string, unknown> | null>;
  simbolo?: string;
}

export const PaymentModal: React.FC<PaymentModalProps> = ({ isOpen, onClose, onConfirm, simbolo = '$' }) => {
  const { total, setMetodoPago, setMetodoPagoMixto, setEsFiado, clienteId, clienteNombre, descuentoGlobal, recargoGlobal } = useVentasStore();
  const { config } = useAppStore();
  const { t } = useTranslation();
  const [step, setStep] = useState<'metodo' | 'efectivo' | 'mixto' | 'tarjeta'>('metodo');
  const [received, setReceived] = useState('');
  const [cobrarMonto, setCobrarMonto] = useState('');
  const [selectedIdx, setSelectedIdx] = useState(0);
  // Líneas del pago mixto: { metodo, monto }
  const [mixtoLineas, setMixtoLineas] = useState<{ metodo: string; monto: string }[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [ticketAfterSale, setTicketAfterSale] = useState<Record<string, unknown> | null>(null);
  const [printingTicket, setPrintingTicket] = useState(false);
  const paymentInitializedRef = useRef(false);
  const [metodoSeleccionado, setMetodoSeleccionado] = useState<MetodoPago | null>(null);
  const [recargoTarjetaEnabled, setRecargoTarjetaEnabled] = useState(false);
  const [recargoTarjetaPorcentaje, setRecargoTarjetaPorcentaje] = useState('0');
  const inputRef = useRef<HTMLInputElement>(null);
  const recargoInputRef = useRef<HTMLInputElement>(null);
  const enterHandlerRef = useRef<(event: KeyboardEvent) => void>(() => {});

  const methods = useMemo<MetodoPagoConfig[]>(() => {
    try {
      const raw = config.metodos_pago;
      if (raw) return (JSON.parse(raw) as MetodoPagoConfig[]).filter((m) => m.activo);
    } catch { /* vacío */ }
    return METODOS_DEFAULT;
  }, [config.metodos_pago]);

  // Métodos disponibles para pago mixto (excluye fiado si no hay cliente)
  const methodsMixto = useMemo(() =>
    methods.filter((m) => m.id !== 'fiado' || !!clienteId),
    [methods, clienteId]
  );

  useEffect(() => {
    if (isOpen && !paymentInitializedRef.current) {
      paymentInitializedRef.current = true;
      setStep('metodo');
      setReceived(total.toFixed(2));
      setCobrarMonto(total.toFixed(2));
      setSelectedIdx(0);
      setMixtoLineas([]);
      setSubmitting(false);
      setTicketAfterSale(null);
      setMetodoSeleccionado(null);
      setRecargoTarjetaEnabled(false);
      setRecargoTarjetaPorcentaje('0');
    }
    if (!isOpen) paymentInitializedRef.current = false;
  }, [isOpen, total]);

  useEffect(() => {
    if (step === 'efectivo') setTimeout(() => { inputRef.current?.focus(); inputRef.current?.select(); }, 60);
    if (step === 'tarjeta') setTimeout(() => { recargoInputRef.current?.focus(); }, 60);
  }, [step]);

  useEffect(() => {
    if (!isOpen || step !== 'metodo') return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (submitting) return;
      if (e.key === 'ArrowDown') { e.preventDefault(); setSelectedIdx((i) => (i + 1) % (methods.length + 1)); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); setSelectedIdx((i) => (i - 1 + methods.length + 1) % (methods.length + 1)); }
      else if (e.key === 'Escape') { onClose(); }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, step, selectedIdx, methods, clienteId, submitting]);

  useEffect(() => {
    const handleEnter = (event: KeyboardEvent) => enterHandlerRef.current(event);
    window.addEventListener('keydown', handleEnter, true);
    return () => window.removeEventListener('keydown', handleEnter, true);
  }, []);

  if (!isOpen) return null;

  const cobradoNum = parseFloat(cobrarMonto) || total;
  const recargoTarjetaMonto = recargoTarjetaEnabled ? total * (parseFloat(recargoTarjetaPorcentaje) || 0) / 100 : 0;
  const totalConRecargoTarjeta = total + recargoTarjetaMonto;
  const esParcial = cobradoNum < total - 0.01;
  const change = Math.max(0, parseFloat(received || '0') - cobradoNum);
  const quickAmounts = [...new Set([
    Math.ceil(cobradoNum / 100) * 100,
    Math.ceil(cobradoNum / 500) * 500,
    Math.ceil(cobradoNum / 1000) * 1000,
  ])].filter((v) => v > cobradoNum).slice(0, 3);

  // ── Lógica mixto ──
  const mixtoUsados = new Set(mixtoLineas.map((l) => l.metodo));
  const mixtoSum = mixtoLineas.reduce((s, l) => s + (parseFloat(l.monto) || 0), 0);
  const mixtoResta = total - mixtoSum;
  const mixtoOk = Math.abs(mixtoResta) < 0.01 && mixtoLineas.length >= 2;

  const handleOpenMixto = () => {
    // Iniciar con línea vacía usando el primer método disponible
    const primero = methodsMixto[0];
    if (!primero) return;
    setMixtoLineas([{ metodo: primero.id, monto: total.toFixed(2) }]);
    setStep('mixto');
  };

  const handleAddLinea = (metodoId: string) => {
    const resta = total - mixtoLineas.reduce((s, l) => s + (parseFloat(l.monto) || 0), 0);
    setMixtoLineas((prev) => [...prev, { metodo: metodoId, monto: Math.max(0, resta).toFixed(2) }]);
  };

  const handleRemoveLinea = (idx: number) => {
    setMixtoLineas((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleUpdateMonto = (idx: number, val: string) => {
    setMixtoLineas((prev) => prev.map((l, i) => i === idx ? { ...l, monto: val } : l));
  };

  const handleAutoDistribuir = () => {
    if (mixtoLineas.length === 0) return;
    const porPartes = total / mixtoLineas.length;
    setMixtoLineas((prev) => prev.map((l) => ({ ...l, monto: porPartes.toFixed(2) })));
  };

  const confirmarVenta = async (cobrado: number) => {
    if (submitting) return;
    setSubmitting(true);
    try {
      const ticket = await onConfirm(cobrado);
      if (ticket === false) return;
      if (!ticket || !('items' in ticket)) {
        onClose();
        return;
      }
      const mode = config.ticket_modo_impresion || 'preguntar';
      if (mode === 'nunca') {
        onClose();
        return;
      }
      if (mode === 'siempre' && config.ticket_impresora) {
        const result = await printerAPI.printTicket(ticket, config);
        if (!result.success) toast.error(result.error || 'No se pudo imprimir el ticket');
        else toast.success('Ticket enviado a imprimir');
        onClose();
        return;
      }
      setTicketAfterSale(ticket);
    } finally {
      setSubmitting(false);
    }
  };

  const handlePrintTicket = async () => {
    if (!ticketAfterSale) return;
    setPrintingTicket(true);
    try {
      const result = await printerAPI.printTicket(ticketAfterSale, config);
      if (!result.success) throw new Error(result.error || 'No se pudo imprimir el ticket');
      toast.success('Ticket enviado a imprimir');
      setTicketAfterSale(null);
      onClose();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'No se pudo imprimir el ticket');
    } finally {
      setPrintingTicket(false);
    }
  };

  if (ticketAfterSale) {
    return (
      <div style={{ position: 'fixed', inset: 0, zIndex: 1100, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
        <div className="bg-slate-800 border border-slate-700 rounded-xl p-6 w-full max-w-sm space-y-4 text-center">
          <CheckCircle size={32} className="text-emerald-400 mx-auto" />
          <h2 className="text-lg font-bold text-white">Venta registrada</h2>
          <p className="text-sm text-slate-400">{config.ticket_impresora ? '¿Querés imprimir el ticket ahora?' : 'No hay una impresora configurada.'}</p>
          <div className="flex flex-col gap-2">
            {config.ticket_impresora && (
              <button type="button" className="btn-primary btn w-full" onClick={() => void handlePrintTicket()} disabled={printingTicket}>
                <Printer size={16} /> {printingTicket ? 'Imprimiendo…' : 'Imprimir ticket'}
              </button>
            )}
            <button type="button" className="btn-secondary btn w-full" onClick={() => { setTicketAfterSale(null); onClose(); }} disabled={printingTicket}>
              Continuar sin imprimir
            </button>
          </div>
        </div>
      </div>
    );
  }

  const handleConfirmMixto = () => {
    setMetodoPago('mixto' as MetodoPago);
    setMetodoPagoMixto(mixtoLineas.map((l) => ({ metodo: l.metodo, monto: parseFloat(l.monto) || 0 })));
    setEsFiado(false);
    void confirmarVenta(mixtoSum);
  };

  const handleSelectMetodo = (id: MetodoPago) => {
    setMetodoPago(id);
    setMetodoPagoMixto([]);
    if (id === 'efectivo') { setStep('efectivo'); return; }
    if (id === 'fiado') { if (!clienteId) return; setEsFiado(true); } else { setEsFiado(false); }
    // Mostrar step tarjeta para métodos tarjeta
    if (id === 'tarjeta' || id === 'tarjeta_credito' || id === 'tarjeta_debito') {
      setMetodoSeleccionado(id);
      setStep('tarjeta');
      setRecargoTarjetaEnabled(false);
      setRecargoTarjetaPorcentaje('0');
      return;
    }
    void confirmarVenta(cobradoNum);
  };

  const handleConfirmTarjeta = () => {
    if (!metodoSeleccionado) return;
    setMetodoPago(metodoSeleccionado);
    setMetodoPagoMixto([]);
    setEsFiado(false);
    
    // Calcular monto con recargo
    let montoFinal = cobradoNum;
    if (recargoTarjetaEnabled) {
      const porcentajeRecargo = parseFloat(recargoTarjetaPorcentaje) || 0;
      const montoRecargo = total * (porcentajeRecargo / 100);
      montoFinal = total + montoRecargo;
    }
    
    void confirmarVenta(montoFinal);
  };

  const handleConfirmEfectivo = () => { setEsFiado(false); void confirmarVenta(cobradoNum); };

  enterHandlerRef.current = (event) => {
    if (!isOpen || event.key !== 'Enter' || submitting || ticketAfterSale) return;
    event.preventDefault();
    event.stopImmediatePropagation();

    if (step === 'metodo') {
      if (selectedIdx === methods.length) {
        handleOpenMixto();
        return;
      }
      const selectedMethod = methods[selectedIdx];
      if (!selectedMethod || (selectedMethod.id === 'fiado' && !clienteId)) return;
      const methodId = selectedMethod.id as MetodoPago;
      setMetodoPago(methodId);
      setMetodoPagoMixto([]);
      setEsFiado(methodId === 'fiado');
      setMetodoSeleccionado(methodId);
      void confirmarVenta(cobradoNum);
      return;
    }
    if (step === 'efectivo') {
      handleConfirmEfectivo();
      return;
    }
    if (step === 'tarjeta') {
      handleConfirmTarjeta();
      return;
    }
    if (mixtoOk) {
      handleConfirmMixto();
    } else if (mixtoLineas.length === 1 && Math.abs(mixtoSum - total) < 0.01) {
      setMetodoPago(mixtoLineas[0].metodo as MetodoPago);
      setMetodoPagoMixto([]);
      setEsFiado(false);
      void confirmarVenta(mixtoSum);
    } else {
      toast.error('Revisá los importes del pago mixto antes de confirmar');
    }
  };

  const overlay: React.CSSProperties = {
    position: 'fixed', inset: 0, zIndex: 1000,
    background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(4px)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
  };
  const card: React.CSSProperties = {
    background: 'var(--bg2)', border: '1px solid var(--border)',
    borderRadius: 20, width: '100%', maxWidth: step === 'mixto' ? 480 : 420, overflow: 'hidden',
    boxShadow: '0 25px 60px rgba(0,0,0,0.55)',
  };

  return (
    <div style={overlay} onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div style={card}>

        {/* ── Header ── */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', padding: '20px 24px 16px', borderBottom: '1px solid var(--border)' }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 11, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 4 }}>{t('pos.pay.cartTotal')}</div>
            <div style={{ fontSize: 32, fontWeight: 900, color: 'var(--text2)', fontFamily: "'DM Mono', monospace", letterSpacing: '-0.03em', lineHeight: 1 }}>
              {formatCurrency(total, simbolo)}
            </div>
            {clienteNombre && (
              <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 8 }}>
                {t('pos.pay.clientLabel')}: <span style={{ color: 'var(--text2)', fontWeight: 600 }}>{clienteNombre}</span>
              </div>
            )}
            {(descuentoGlobal > 0 || recargoGlobal > 0 || recargoTarjetaMonto > 0) && (
              <div style={{ fontSize: 11, marginTop: 8, color: (recargoGlobal > 0 || recargoTarjetaMonto > 0) ? '#fbbf24' : 'var(--warn)' }}>
                {recargoGlobal > 0 ? `Recargo +${formatCurrency(recargoGlobal, simbolo)}` : recargoTarjetaMonto > 0 ? `Recargo tarjeta ${recargoTarjetaPorcentaje}% +${formatCurrency(recargoTarjetaMonto, simbolo)}` : `Descuento -${formatCurrency(descuentoGlobal, simbolo)}`}
              </div>
            )}
            {/* Monto a cobrar — solo en paso metodo */}
            {step === 'metodo' && (
              <div style={{ marginTop: 10 }}>
                <div style={{ fontSize: 10, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>{t('pos.pay.amountTo')}</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <input
                    type="number"
                    value={cobrarMonto}
                    onChange={(e) => setCobrarMonto(e.target.value)}
                    title="Monto a cobrar"
                    placeholder={total.toFixed(2)}
                    style={{
                      width: 140, background: esParcial ? 'rgba(245,158,11,0.1)' : 'var(--bg3)',
                      border: `2px solid ${esParcial ? 'rgba(245,158,11,0.6)' : 'var(--accent3)'}`,
                      borderRadius: 10, padding: '6px 10px',
                      fontSize: 22, fontWeight: 900, fontFamily: "'DM Mono', monospace",
                      color: esParcial ? 'var(--warn)' : 'var(--accent3)', textAlign: 'right', outline: 'none',
                    }}
                  />
                  {esParcial && <span style={{ fontSize: 11, color: 'var(--warn)', maxWidth: 100 }}>{t('pos.pay.partial')}</span>}
                  {cobradoNum !== total && (
                    <button onClick={() => setCobrarMonto(total.toFixed(2))} style={{ fontSize: 10, color: 'var(--text3)', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}>{t('pos.pay.total')}</button>
                  )}
                </div>
              </div>
            )}
          </div>
          <button onClick={onClose} title="Cerrar" style={{ background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 10, width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text3)', cursor: 'pointer', flexShrink: 0, marginLeft: 12 }}>
            <X size={16} />
          </button>
        </div>

        {/* ── Body ── */}
        <div style={{ padding: 24 }}>

          {/* Paso 1: Elegir método */}
          {step === 'metodo' && (
            <>
              <div style={{ fontSize: 11, color: 'var(--text3)', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 12 }}>
                {t('pos.pay.title')} <span style={{ fontWeight: 400, opacity: 0.6 }}>↑↓ Enter</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {methods.map(({ id, nombre }, i) => {
                  const { Icon, color, colorBg, colorBorder } = METODOS_BASE[id] ?? DEFAULT_ESTILO;
                  const isSelected = i === selectedIdx;
                  const disabled = id === 'fiado' && !clienteId;
                  return (
                    <button
                      key={id}
                      disabled={disabled || submitting}
                      onClick={() => !disabled && !submitting && handleSelectMetodo(id as MetodoPago)}
                      style={{
                        background: isSelected ? colorBg : 'var(--bg3)',
                        border: `2px solid ${isSelected ? colorBorder : 'var(--border)'}`,
                        borderRadius: 12, padding: '12px 18px',
                        display: 'flex', alignItems: 'center', gap: 14,
                        cursor: disabled ? 'not-allowed' : 'pointer',
                        opacity: disabled ? 0.4 : 1,
                        color: isSelected ? color : disabled ? 'var(--text3)' : 'var(--text2)',
                        fontFamily: "'Syne', sans-serif",
                        transition: 'all 0.1s', textAlign: 'left',
                      }}
                    >
                      <Icon size={20} />
                      <span style={{ fontSize: 14, fontWeight: 700, flex: 1 }}>{nombre}</span>
                      {isSelected && <span style={{ fontSize: 11, opacity: 0.6 }}>Enter ↵</span>}
                    </button>
                  );
                })}

                {/* Opción Pago Mixto */}
                {(() => {
                  const isMixtoSel = selectedIdx === methods.length;
                  return (
                    <button
                      onClick={handleOpenMixto}
                      disabled={submitting}
                      style={{
                        background: isMixtoSel ? 'rgba(124,58,237,0.12)' : 'var(--bg3)',
                        border: `2px solid ${isMixtoSel ? 'rgba(124,58,237,0.4)' : 'var(--border)'}`,
                        borderRadius: 12, padding: '12px 18px',
                        display: 'flex', alignItems: 'center', gap: 14,
                        cursor: 'pointer',
                        color: isMixtoSel ? '#a78bfa' : 'var(--text2)',
                        fontFamily: "'Syne', sans-serif",
                        transition: 'all 0.1s', textAlign: 'left',
                      }}
                    >
                      <Wallet size={20} />
                      <span style={{ fontSize: 14, fontWeight: 700, flex: 1 }}>Pago Mixto</span>
                      <span style={{ fontSize: 10, opacity: 0.55, background: 'rgba(124,58,237,0.15)', color: '#a78bfa', borderRadius: 6, padding: '2px 7px', fontWeight: 600 }}>Múltiples</span>
                    </button>
                  );
                })()}
              </div>
              {!clienteId && (
                <div style={{ marginTop: 14, padding: '10px 14px', borderRadius: 10, background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.2)', fontSize: 12, color: 'var(--warn)', display: 'flex', alignItems: 'center', gap: 8 }}>
                  <AlertTriangle size={13} />
                  {t('pos.pay.creditWarn')} <strong>{t('pos.credit')}</strong>, asigná primero un cliente con <kbd style={{ marginLeft: 4, background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 4, padding: '1px 6px' }}>F5</kbd>
                </div>
              )}
            </>
          )}

          {/* Paso 2: Efectivo */}
          {step === 'efectivo' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <button onClick={() => setStep('metodo')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text3)', fontSize: 12, display: 'flex', alignItems: 'center', gap: 6, alignSelf: 'flex-start' }}>
                <ChevronLeft size={14} /> {t('pos.pay.changeMethod')}
              </button>
              <div>
                <div style={{ fontSize: 11, color: 'var(--text3)', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 10 }}>{t('pos.pay.received')}</div>
                <input
                  ref={inputRef}
                  type="number"
                  value={received}
                  onChange={(e) => setReceived(e.target.value)}
                  title="Monto recibido"
                  placeholder={cobradoNum.toFixed(2)}
                  style={{ width: '100%', boxSizing: 'border-box', background: 'var(--bg3)', border: '2px solid var(--accent3)', borderRadius: 12, padding: '14px 16px', fontSize: 30, fontWeight: 900, fontFamily: "'DM Mono', monospace", color: 'var(--text)', textAlign: 'right', outline: 'none' }}
                />
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={() => setReceived(cobradoNum.toFixed(2))} style={{ flex: 1, background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 10, padding: '10px 6px', fontSize: 12, color: 'var(--text2)', cursor: 'pointer', fontFamily: "'DM Mono', monospace" }}>{t('pos.pay.exact')}</button>
                {quickAmounts.map((a) => (
                  <button key={a} onClick={() => setReceived(String(a))} style={{ flex: 1, background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 10, padding: '10px 6px', fontSize: 12, color: 'var(--text2)', cursor: 'pointer', fontFamily: "'DM Mono', monospace" }}>
                    {simbolo}{a.toLocaleString('es-AR')}
                  </button>
                ))}
              </div>
              {change > 0 && (
                <div style={{ background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.3)', borderRadius: 12, padding: '14px 18px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: 14, color: 'var(--text3)' }}>{t('pos.pay.change')}</span>
                  <span style={{ fontSize: 28, fontWeight: 900, color: 'var(--accent3)', fontFamily: "'DM Mono', monospace" }}>{formatCurrency(change, simbolo)}</span>
                </div>
              )}
              {esParcial && (
                <div style={{ background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.3)', borderRadius: 10, padding: '10px 14px', fontSize: 12, color: 'var(--warn)', display: 'flex', alignItems: 'center', gap: 8 }}>
                  ⚠ {t('pos.pay.partialWarning', { amount: formatCurrency(cobradoNum, simbolo) })}
                </div>
              )}
              <button
                onClick={handleConfirmEfectivo}
                disabled={submitting}
                style={{ background: 'var(--accent3)', color: '#fff', border: 'none', borderRadius: 14, padding: '16px', fontSize: 15, fontWeight: 800, cursor: submitting ? 'not-allowed' : 'pointer', opacity: submitting ? 0.6 : 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, fontFamily: "'Syne', sans-serif" }}
              >
                <CheckCircle size={20} />
                {t('pos.pay.confirm')} {esParcial ? `(${formatCurrency(cobradoNum, simbolo)})` : ''}
                <kbd style={{ background: 'rgba(255,255,255,0.2)', borderRadius: 6, padding: '2px 8px', fontSize: 12 }}>Enter</kbd>
              </button>
            </div>
          )}

          {/* Paso 3: Pago Mixto */}
          {step === 'mixto' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <button onClick={() => setStep('metodo')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text3)', fontSize: 12, display: 'flex', alignItems: 'center', gap: 6, alignSelf: 'flex-start' }}>
                <ChevronLeft size={14} /> Elegir otro método
              </button>

              {/* Líneas de pago */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {mixtoLineas.map((linea, idx) => {
                  const { Icon, color, colorBg, colorBorder } = METODOS_BASE[linea.metodo] ?? DEFAULT_ESTILO;
                  const met = methodsMixto.find((m) => m.id === linea.metodo);
                  return (
                    <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: 8, background: colorBg, border: `1px solid ${colorBorder}`, borderRadius: 12, padding: '10px 12px' }}>
                      <Icon size={18} style={{ color, flexShrink: 0 }} />
                      <span style={{ fontSize: 13, fontWeight: 700, color, width: 110, flexShrink: 0 }}>{met?.nombre ?? linea.metodo}</span>
                      <input
                        type="number"
                        value={linea.monto}
                        onChange={(e) => handleUpdateMonto(idx, e.target.value)}
                        title={`Monto ${met?.nombre}`}
                        placeholder="0.00"
                        style={{ flex: 1, background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 8, padding: '6px 10px', fontSize: 16, fontWeight: 700, fontFamily: "'DM Mono', monospace", color: 'var(--text)', textAlign: 'right', outline: 'none', minWidth: 0 }}
                      />
                      {mixtoLineas.length > 1 && (
                        <button onClick={() => handleRemoveLinea(idx)} title="Quitar" style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text3)', padding: 4 }}>
                          <Trash2 size={14} />
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Chips para agregar método */}
              <div>
                <div style={{ fontSize: 10, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6, fontWeight: 700 }}>Agregar método</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {methodsMixto
                    .filter((m) => !mixtoUsados.has(m.id))
                    .map((m) => {
                      const { Icon, color } = METODOS_BASE[m.id] ?? DEFAULT_ESTILO;
                      return (
                        <button
                          key={m.id}
                          onClick={() => handleAddLinea(m.id)}
                          style={{ background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 8, padding: '6px 12px', fontSize: 12, fontWeight: 600, color, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, transition: 'all 0.1s' }}
                        >
                          <Icon size={13} />
                          {m.nombre}
                          <Plus size={11} />
                        </button>
                      );
                    })
                  }
                  {methodsMixto.filter((m) => !mixtoUsados.has(m.id)).length === 0 && (
                    <span style={{ fontSize: 12, color: 'var(--text3)' }}>Todos los métodos agregados</span>
                  )}
                </div>
              </div>

              {/* Resumen */}
              <div style={{ background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 12, padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 6 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--text3)' }}>
                  <span>Total</span>
                  <span style={{ fontFamily: "'DM Mono', monospace", fontWeight: 700, color: 'var(--text)' }}>{formatCurrency(total, simbolo)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--text3)' }}>
                  <span>Asignado</span>
                  <span style={{ fontFamily: "'DM Mono', monospace", fontWeight: 700, color: mixtoOk ? 'var(--accent3)' : 'var(--text)' }}>{formatCurrency(mixtoSum, simbolo)}</span>
                </div>
                {Math.abs(mixtoResta) > 0.01 && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: mixtoResta > 0 ? 'var(--warn)' : 'var(--danger)' }}>
                    <span>{mixtoResta > 0 ? 'Falta asignar' : 'Excede por'}</span>
                    <span style={{ fontFamily: "'DM Mono', monospace", fontWeight: 900 }}>{formatCurrency(Math.abs(mixtoResta), simbolo)}</span>
                  </div>
                )}
              </div>

              {/* Botones de acción */}
              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  onClick={handleAutoDistribuir}
                  style={{ flex: 1, background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 10, padding: '10px', fontSize: 12, color: 'var(--text2)', cursor: 'pointer', fontWeight: 600 }}
                >
                  Distribuir en partes iguales
                </button>
                <button
                  onClick={handleConfirmMixto}
                  disabled={!mixtoOk || submitting}
                  style={{
                    flex: 2, background: mixtoOk && !submitting ? 'var(--accent3)' : 'var(--bg3)',
                    border: `1px solid ${mixtoOk && !submitting ? 'var(--accent3)' : 'var(--border)'}`,
                    color: mixtoOk && !submitting ? '#fff' : 'var(--text3)',
                    borderRadius: 10, padding: '10px 16px', fontSize: 14, fontWeight: 800,
                    cursor: mixtoOk && !submitting ? 'pointer' : 'not-allowed',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                    fontFamily: "'Syne', sans-serif",
                    transition: 'all 0.15s',
                  }}
                >
                  <CheckCircle size={16} />
                  Confirmar pago
                </button>
              </div>

              {mixtoLineas.length < 2 && (
                <p style={{ fontSize: 11, color: 'var(--text3)', textAlign: 'center', margin: 0 }}>
                  Agregá al menos 2 métodos para usar pago mixto
                </p>
              )}
            </div>
          )}

          {/* Paso 4: Configurar recargo de tarjeta */}
          {step === 'tarjeta' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <button onClick={() => setStep('metodo')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text3)', fontSize: 12, display: 'flex', alignItems: 'center', gap: 6, alignSelf: 'flex-start' }}>
                <ChevronLeft size={14} /> {t('pos.pay.changeMethod')}
              </button>
              
              <div style={{ background: 'rgba(59, 130, 246, 0.08)', border: '1px solid rgba(59, 130, 246, 0.3)', borderRadius: 12, padding: '14px 16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text2)', marginBottom: 4 }}>Aplicar recargo por tarjeta</div>
                    <div style={{ fontSize: 11, color: 'var(--text3)' }}>El cliente pagará el recargo además del total</div>
                  </div>
                  <label style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8 }}>
                    <input
                      type="checkbox"
                      checked={recargoTarjetaEnabled}
                      onChange={(e) => setRecargoTarjetaEnabled(e.target.checked)}
                      style={{ width: 20, height: 20, cursor: 'pointer' }}
                    />
                  </label>
                </div>
              </div>

              {recargoTarjetaEnabled && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <div>
                    <div style={{ fontSize: 11, color: 'var(--text3)', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 8 }}>Porcentaje de recargo (%)</div>
                    <input
                      ref={recargoInputRef}
                      type="number"
                      value={recargoTarjetaPorcentaje}
                      onChange={(e) => setRecargoTarjetaPorcentaje(e.target.value)}
                      title="Porcentaje de recargo"
                      placeholder="0"
                      min="0"
                      step="0.1"
                      style={{ width: '100%', boxSizing: 'border-box', background: 'var(--bg3)', border: '2px solid var(--accent3)', borderRadius: 12, padding: '12px 14px', fontSize: 24, fontWeight: 900, fontFamily: "'DM Mono', monospace", color: 'var(--accent3)', textAlign: 'right', outline: 'none' }}
                    />
                  </div>

                  <div style={{ background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 12, padding: '12px 14px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                      <span style={{ fontSize: 12, color: 'var(--text3)' }}>Total original</span>
                      <span style={{ fontSize: 14, fontWeight: 700, fontFamily: "'DM Mono', monospace", color: 'var(--text)' }}>{formatCurrency(total, simbolo)}</span>
                    </div>
                    {recargoTarjetaMonto > 0 && (
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6, color: '#fbbf24' }}>
                        <span style={{ fontSize: 12 }}>Recargo {recargoTarjetaPorcentaje}%</span>
                        <span style={{ fontSize: 14, fontWeight: 700, fontFamily: "'DM Mono', monospace" }}>+{formatCurrency(recargoTarjetaMonto, simbolo)}</span>
                      </div>
                    )}
                    <div style={{ borderTop: '1px solid var(--border)', paddingTop: 8, display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text2)' }}>Total a cobrar</span>
                      <span style={{ fontSize: 18, fontWeight: 900, fontFamily: "'DM Mono', monospace", color: '#fbbf24' }}>{formatCurrency(totalConRecargoTarjeta, simbolo)}</span>
                    </div>
                  </div>
                </div>
              )}

              <button
                onClick={handleConfirmTarjeta}
                disabled={submitting}
                style={{ background: 'var(--accent3)', color: '#fff', border: 'none', borderRadius: 14, padding: '16px', fontSize: 15, fontWeight: 800, cursor: submitting ? 'not-allowed' : 'pointer', opacity: submitting ? 0.6 : 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, fontFamily: "'Syne', sans-serif" }}
              >
                <CheckCircle size={20} />
                {t('pos.pay.confirm')}
                <kbd style={{ background: 'rgba(255,255,255,0.2)', borderRadius: 6, padding: '2px 8px', fontSize: 12 }}>Enter</kbd>
              </button>
            </div>
          )}

        </div>
      </div>
    </div>
  );
};
