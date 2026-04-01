import React, { useState, useEffect, useCallback } from 'react';
import {
  Save, RefreshCw, FileText, UserPlus, Percent, StickyNote, AlertTriangle,
  User, X
} from 'lucide-react';
import toast from 'react-hot-toast';
import { ProductSearch } from '../POS/ProductSearch';
import { CartTable } from '../POS/CartTable';
import { PaymentModal } from '../POS/PaymentModal';
import { Modal } from '../shared/Modal';

import { useVentasStore } from '../../store/useVentasStore';
import { useAppStore } from '../../store/useAppStore';
import { formatCurrency, generateTicketHTML } from '../../lib/utils';
import { ventasAPI, clientesAPI, usuariosAPI, configAPI, appAPI, sendEvent } from '../../lib/api';
import { useTranslation } from 'react-i18next';

interface Cliente {
  id: number;
  nombre: string;
  telefono: string;
  saldo_deuda: number;
}

interface Usuario {
  id: number;
  nombre: string;
  rol: string;
}

export const POSWindow: React.FC = () => {
  const {
    cart, subtotal, totalDescuento, total, descuentoGlobal,
    clienteId, clienteNombre, vendedorId, vendedorNombre,
    esFiado, observaciones, tipoOperacion,
    setDescuentoGlobal, setCliente, setVendedor,
    setEsFiado, setObservaciones, setTipoOperacion, resetSale,
    metodoPago, metodoPagoMixto,
  } = useVentasStore();

  const { config } = useAppStore();
  const [showPayment, setShowPayment] = useState(false);
  const [showClienteModal, setShowClienteModal] = useState(false);
  const [showVendedorModal, setShowVendedorModal] = useState(false);
  const [showDescuentoModal, setShowDescuentoModal] = useState(false);
  const [showObsModal, setShowObsModal] = useState(false);
  const [showEnvioModal, setShowEnvioModal] = useState(false);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [vendedores, setVendedores] = useState<Usuario[]>([]);
  const [descuentoInput, setDescuentoInput] = useState('0');
  const [clienteSearch, setClienteSearch] = useState('');
  const [procesando, setProcesando] = useState(false);
  const [selectedPrecio, setSelectedPrecio] = useState<1 | 2 | 3>(1);
  const { t } = useTranslation();

  const simbolo = config.simbolo_moneda || '$';

  useEffect(() => {
    configAPI.getAll().then((c) => useAppStore.getState().setConfig(c as Record<string, string>));
  }, []);

  // Seleccionar todo al hacer foco en inputs numéricos
  useEffect(() => {
    const handleFocus = (e: FocusEvent) => {
      const target = e.target as HTMLInputElement;
      if (target.tagName === 'INPUT' && target.type === 'number') target.select();
    };
    document.addEventListener('focusin', handleFocus);
    return () => document.removeEventListener('focusin', handleFocus);
  }, []);

  // Cargar clientes y vendedores
  useEffect(() => {
    clientesAPI.getAll().then((data) => setClientes(data as Cliente[]));
    usuariosAPI.getAll().then((data) => setVendedores((data as Usuario[]).filter((u) => u.rol !== 'readonly')));
  }, []);

  // Atajos de teclado
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    // Permitir atajos siempre, excepto si el foco está en un textarea (para no interrumpir escritura de notas largas)
    if (e.target instanceof HTMLTextAreaElement) return;

    switch (e.key) {
      case 'F2': e.preventDefault(); if (cart.length > 0) setShowPayment(true); break;
      case 'F3': e.preventDefault(); resetSale(); toast(t('pos.cleared'), { icon: '🗑️' }); sendEvent('broadcast-event', 'pos:alert', { type: 'cart_cleared', message: 'Carrito vaciado con F3', detail: `${cart.length} ítem${cart.length !== 1 ? 's' : ''} eliminados` }); break;
      case 'F4': e.preventDefault(); setTipoOperacion('pedido'); toast(t('pos.modeOrder'), { icon: '📋' }); break;
      case 'F5': e.preventDefault(); setShowClienteModal(true); break;
      case 'F6': e.preventDefault(); setShowDescuentoModal(true); break;
      case 'F7': e.preventDefault(); setShowObsModal(true); break;
      case 'F8': e.preventDefault(); {
        const next = !esFiado;
        setEsFiado(next);
        if (next) toast(t('pos.modeCreditOn'), { icon: '💳' });
        else toast(t('pos.modeCreditOff'));
        break;
      }
      case 'F9': e.preventDefault(); setShowEnvioModal(true); break;
      case 'F10': e.preventDefault(); setShowVendedorModal(true); break;
      case 'Escape': e.preventDefault();
        if (cart.length > 0) {
          sendEvent('broadcast-event', 'pos:cart-abandoned', { count: cart.length, items: cart.map((i) => i.nombre) });
        }
        appAPI.closePosWindow();
        break;
    }
  }, [cart, esFiado, resetSale, setTipoOperacion, setEsFiado]);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  // También escuchar evento de reset desde main
  useEffect(() => {
    if (window.electron) {
      const cleanup = window.electron.on('pos:reset', () => resetSale());
      return cleanup;
    }
  }, [resetSale]);

  // Alertar si se cierra la ventana con ítems en el carrito (botón X del OS)
  useEffect(() => {
    const handleBeforeUnload = () => {
      if (cart.length > 0) {
        sendEvent('broadcast-event', 'pos:cart-abandoned', { count: cart.length, items: cart.map((i) => i.nombre) });
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [cart]);

  const handleConfirmSale = async (cobrado: number) => {
    if (cart.length === 0) { toast.error(t('pos.emptyCart')); return; }
    if (esFiado && !clienteId) { toast.error(t('pos.creditNeedsClient')); setShowClienteModal(true); return; }

    setProcesando(true);
    try {
      // Si el cobro es parcial (solo aplica para ventas NO fiado), ajustar el total reduciendo el descuento global
      const rawSubtotal = cart.reduce((s, i) => s + i.precio_unitario * i.cantidad, 0);
      const esParcial = !esFiado && cobrado < total - 0.01;
      const descuentoFinal = esParcial ? rawSubtotal - cobrado : totalDescuento;

      const payload = {
        tipo: tipoOperacion,
        cliente_id: clienteId,
        vendedor_id: vendedorId,
        items: cart.map((i) => ({
          producto_id: i.producto_id,
          nombre: i.nombre,
          cantidad: i.cantidad,
          precio_unitario: i.precio_unitario,
          descuento: i.descuento,
          total: i.total,
          fraccionable: i.fraccionable,
          unidad_medida: i.unidad_medida,
        })),
        descuento: descuentoFinal,
        metodo_pago: metodoPago,
        es_fiado: esFiado,
        observaciones,
        metodos_pago_mixto: metodoPagoMixto,
      };

      const result = await ventasAPI.crear(payload) as { id: number; numero: string; venta: Record<string, unknown> };

      // Imprimir ticket
      const allConfig = await configAPI.getAll() as Record<string, string>;
      const ticketHTML = generateTicketHTML(result.venta as Record<string, unknown>, cart as unknown as Record<string, unknown>[], allConfig);
      const printWindow = window.open('', '_blank', 'width=400,height=600');
      if (printWindow) {
        printWindow.document.write(ticketHTML);
        printWindow.document.close();
        printWindow.print();
        printWindow.close();
      }

      toast.success(
        tipoOperacion === 'venta' ? `${t('pos.saleSaved')} #${result.numero}` :
        tipoOperacion === 'pedido' ? `${t('pos.orderSaved')} #${result.numero}` :
        `${t('pos.quoteSaved')} #${result.numero}`,
        { duration: 3000 }
      );

      setShowPayment(false);
      resetSale();
    } catch (err) {
      toast.error(t('pos.saleError'));
      console.error(err);
      sendEvent('broadcast-event', 'pos:alert', { type: 'sale_failed', message: 'Error al registrar la venta', detail: String(err) });
    } finally {
      setProcesando(false);
    }
  };

  const filteredClientes = clientes.filter(
    (c) => c.nombre.toLowerCase().includes(clienteSearch.toLowerCase())
  );

  const tipoLabel = tipoOperacion === 'venta' ? 'VENTA' : tipoOperacion === 'pedido' ? 'PEDIDO' : 'COTIZACIÓN';
  const tipoAccent =
    tipoOperacion === 'venta' ? 'var(--accent3)' :
    tipoOperacion === 'pedido' ? 'var(--accent)' :
    'var(--accent2)';

  return (
    <div className="flex flex-col h-screen" style={{ background: 'var(--bg)', color: 'var(--text)' }}>

      {/* ── Barra de meta-acciones (cliente, precio, tipo) ──────────────── */}
      <div
        className="titlebar-no-drag shrink-0 flex items-center gap-1 px-3 py-1.5"
        style={{ background: 'var(--bg2)', borderBottom: '1px solid var(--border)' }}
      >
        {/* Selector precio */}
        <div className="flex items-center gap-1 mr-2">
          <span style={{ fontSize: 10, color: 'var(--text3)', fontWeight: 600, letterSpacing: '0.08em' }}>PRECIO</span>
          {([1, 2, 3] as const).map((p) => (
            <button
              key={p}
              onClick={() => setSelectedPrecio(p)}
              className="btn btn-sm"
              style={{
                fontSize: 10, padding: '2px 7px',
                background: selectedPrecio === p ? 'var(--accent)' : 'var(--bg3)',
                color: selectedPrecio === p ? '#fff' : 'var(--text2)',
                border: `1px solid ${selectedPrecio === p ? 'transparent' : 'var(--border)'}`,
              }}
            >
              P{p}
            </button>
          ))}
        </div>

        <div style={{ width: 1, height: 16, background: 'var(--border)', flexShrink: 0, margin: '0 4px' }} />

        {/* Cliente */}
        <button
          className="btn btn-ghost btn-sm flex items-center gap-1.5"
          style={{ fontSize: 11, maxWidth: 160 }}
          onClick={() => setShowClienteModal(true)}
          title="Asignar cliente (F5)"
        >
          <UserPlus size={11} />
          <span className="truncate" style={{ color: clienteNombre ? 'var(--text)' : 'var(--text3)' }}>
            {clienteNombre || 'Sin cliente'}
          </span>
          {clienteNombre && (
            <X size={10} className="shrink-0 opacity-50 hover:opacity-100"
              onClick={(e) => { e.stopPropagation(); setCliente(null, ''); }} />
          )}
          <kbd style={{ marginLeft: 2 }}>F5</kbd>
        </button>

        {/* Vendedor */}
        <button
          className="btn btn-ghost btn-sm flex items-center gap-1.5"
          style={{ fontSize: 11, maxWidth: 140 }}
          onClick={() => setShowVendedorModal(true)}
          title="Vendedor (F10)"
        >
          <User size={11} />
          <span className="truncate" style={{ color: vendedorNombre ? 'var(--text)' : 'var(--text3)' }}>
            {vendedorNombre || t('pos.noSeller')}
          </span>
          <kbd style={{ marginLeft: 2 }}>F10</kbd>
        </button>

        {/* Descuento */}
        <button
          className="btn btn-ghost btn-sm flex items-center gap-1.5"
          style={{ fontSize: 11 }}
          onClick={() => { setDescuentoInput(String(descuentoGlobal)); setShowDescuentoModal(true); }}
          title="Descuento global (F6)"
        >
          <Percent size={11} />
          {descuentoGlobal > 0
            ? <span style={{ color: 'var(--warn)', fontWeight: 700 }}>-{simbolo}{descuentoGlobal}</span>
            : <span style={{ color: 'var(--text3)' }}>{t('pos.discount')}</span>
          }
          <kbd>F6</kbd>
        </button>

        {/* Tipo pedido */}
        <button
          className={`btn btn-sm flex items-center gap-1.5 ${tipoOperacion === 'pedido' ? 'btn-primary' : 'btn-ghost'}`}
          style={{ fontSize: 11 }}
          onClick={() => setTipoOperacion(tipoOperacion === 'pedido' ? 'venta' : 'pedido')}
          title="Pedido (F4)"
        >
          <FileText size={11} />
          <span>{t('pos.order')}</span>
          <kbd>F4</kbd>
        </button>

        {/* Fiado */}
        <button
          className={`btn btn-sm flex items-center gap-1.5 ${esFiado ? 'btn-warning' : 'btn-ghost'}`}
          style={{ fontSize: 11 }}
          onClick={() => setEsFiado(!esFiado)}
          title="Fiado (F8)"
        >
          <AlertTriangle size={11} />
          <span>{t('pos.credit')}</span>
          <kbd>F8</kbd>
        </button>

        {/* Observaciones */}
        <button
          className="btn btn-ghost btn-sm flex items-center gap-1.5"
          style={{ fontSize: 11 }}
          onClick={() => setShowObsModal(true)}
          title="Notas (F7)"
        >
          <StickyNote size={11} />
          <span style={{ color: observaciones ? 'var(--accent2)' : 'var(--text3)' }}>{t('pos.notes')}</span>
          <kbd>F7</kbd>
        </button>

        {/* Nueva venta */}
        <button
          className="btn btn-ghost btn-sm flex items-center gap-1.5 ml-auto"
          style={{ fontSize: 11, color: 'var(--text3)' }}
          onClick={() => { resetSale(); toast(t('pos.cleared'), { icon: '🗑️' }); sendEvent('broadcast-event', 'pos:alert', { type: 'cart_cleared', message: 'Carrito vaciado manualmente', detail: `${cart.length} ítem${cart.length !== 1 ? 's' : ''} eliminados` }); }}
          title="Nueva venta (F3)"
        >
          <RefreshCw size={11} /> {t('pos.clear')} <kbd>F3</kbd>
        </button>
      </div>

      {/* ── Búsqueda ────────────────────────────────────────────────────── */}
      <div
        className="shrink-0 px-3 py-2.5"
        style={{ background: 'var(--bg2)', borderBottom: '1px solid var(--border)' }}
      >
        <ProductSearch autoFocus selectedPrecio={selectedPrecio} />
      </div>

      {/* ── Carrito (ocupa todo el espacio disponible) ───────────────────── */}
      <div className="flex-1 overflow-hidden">
        <CartTable simbolo={simbolo} />
      </div>

      {/* ── Barra de total + cobrar ──────────────────────────────────────── */}
      <div
        className="shrink-0 flex items-center px-4 gap-4"
        style={{ height: 60, background: 'var(--bg2)', borderTop: '1px solid var(--border)' }}
      >
        {/* Resumen de descuento si existe */}
        {totalDescuento > 0 && (
          <div style={{ fontSize: 12, color: 'var(--text3)' }}>
            <span>Sub: </span>
            <span className="num" style={{ color: 'var(--text2)' }}>{formatCurrency(subtotal, simbolo)}</span>
            <span style={{ marginLeft: 8, color: 'var(--warn)' }}>−{formatCurrency(totalDescuento, simbolo)}</span>
          </div>
        )}

        {/* Artículos */}
        <div style={{ fontSize: 11, color: 'var(--text3)', whiteSpace: 'nowrap' }}>
          {cart.length} {cart.length !== 1 ? t('pos.items') : t('pos.item')}
        </div>

        {/* Total — protagonista */}
        <div className="flex items-baseline gap-1.5 ml-auto">
          <span style={{ fontSize: 12, color: 'var(--text3)', fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase' }}>{t('pos.total')}</span>
          <span
            className="num font-black"
            style={{ fontSize: 36, color: 'var(--accent3)', letterSpacing: '-0.03em', lineHeight: 1 }}
          >
            {formatCurrency(total, simbolo)}
          </span>
        </div>

        {/* Botón Cobrar */}
        <button
          className="btn btn-success btn-lg font-bold"
          style={{ fontSize: 15, height: 44, minWidth: 160, justifyContent: 'center' }}
          onClick={() => cart.length > 0 && setShowPayment(true)}
          disabled={cart.length === 0 || procesando}
        >
          <Save size={17} />
          {t('pos.charge')}
          <kbd style={{ marginLeft: 6, background: 'rgba(255,255,255,0.2)', borderColor: 'transparent' }}>F2</kbd>
        </button>

      </div>

      {/* ── Modales ─────────────────────────────────────────────────────── */}
      <PaymentModal
        isOpen={showPayment}
        onClose={() => setShowPayment(false)}
        onConfirm={handleConfirmSale}
        simbolo={simbolo}
      />

      <Modal isOpen={showClienteModal} onClose={() => setShowClienteModal(false)} title={t('pos.clientModal')} size="md">
        <div className="space-y-3">
          <input
            type="text"
            placeholder={t('pos.searchClient')}
            value={clienteSearch}
            onChange={(e) => setClienteSearch(e.target.value)}
            className="input"
            autoFocus
          />
          <button
            className="btn btn-secondary btn-sm w-full"
            onClick={() => { setCliente(null, ''); setShowClienteModal(false); }}
          >
            {t('pos.noClientOption')}
          </button>
          <div className="space-y-1 max-h-64 overflow-y-auto">
            {filteredClientes.map((c) => (
              <button
                key={c.id}
                className="w-full text-left px-3 py-2 rounded-lg transition-colors"
                style={{ background: 'transparent' }}
                onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--bg3)')}
                onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                onClick={() => { setCliente(c.id, c.nombre); setShowClienteModal(false); }}
              >
                <div className="font-medium" style={{ color: 'var(--text)' }}>{c.nombre}</div>
                <div className="text-xs flex gap-2" style={{ color: 'var(--text3)' }}>
                  <span>{c.telefono}</span>
                  {c.saldo_deuda > 0 && <span style={{ color: 'var(--warn)' }}>{t('pos.debt')} {formatCurrency(c.saldo_deuda, simbolo)}</span>}
                </div>
              </button>
            ))}
          </div>
        </div>
      </Modal>

      <Modal isOpen={showVendedorModal} onClose={() => setShowVendedorModal(false)} title={t('pos.sellerModal')} size="sm">
        <div className="space-y-1">
          <button
            className="w-full text-left px-3 py-2 rounded-lg"
            style={{ color: 'var(--text2)' }}
            onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--bg3)')}
            onMouseLeave={(e) => (e.currentTarget.style.background = '')}
            onClick={() => { setVendedor(null, ''); setShowVendedorModal(false); }}
          >
            {t('pos.noSellerOption')}
          </button>
          {vendedores.map((v) => (
            <button
              key={v.id}
              className="w-full text-left px-3 py-2 rounded-lg"
              onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--bg3)')}
              onMouseLeave={(e) => (e.currentTarget.style.background = '')}
              onClick={() => { setVendedor(v.id, v.nombre); setShowVendedorModal(false); }}
            >
              <div className="font-medium" style={{ color: 'var(--text)' }}>{v.nombre}</div>
              <div className="text-xs capitalize" style={{ color: 'var(--text3)' }}>{v.rol}</div>
            </button>
          ))}
        </div>
      </Modal>

      <Modal
        isOpen={showDescuentoModal}
        onClose={() => setShowDescuentoModal(false)}
        title={t('pos.discountModal')}
        size="sm"
        footer={
          <>
            <button className="btn btn-secondary" onClick={() => setShowDescuentoModal(false)}>{t('common.cancel')}</button>
            <button className="btn btn-primary" onClick={() => { setDescuentoGlobal(parseFloat(descuentoInput) || 0); setShowDescuentoModal(false); }}>{t('pos.apply')}</button>
          </>
        }
      >
        <div className="space-y-3">
          <label className="label">{t('pos.discountLabel')} ({simbolo})</label>
          <input
            type="number"
            value={descuentoInput}
            onChange={(e) => setDescuentoInput(e.target.value)}
            className="input num text-right text-xl"
            min="0"
            step="0.01"
            autoFocus
          />
          <p style={{ fontSize: 11, color: 'var(--text3)' }}>Ingresa el monto en {simbolo} a descontar del total.</p>
        </div>
      </Modal>

      <Modal
        isOpen={showObsModal}
        onClose={() => setShowObsModal(false)}
        title={t('pos.obsModal')}
        size="sm"
        footer={<button className="btn btn-primary" onClick={() => setShowObsModal(false)}>{t('common.save')}</button>}
      >
        <textarea
          value={observaciones}
          onChange={(e) => setObservaciones(e.target.value)}
          className="input h-32 resize-none"
          placeholder={t('pos.obsPlaceholder')}
          autoFocus
        />
      </Modal>

      <Modal
        isOpen={showEnvioModal}
        onClose={() => setShowEnvioModal(false)}
        title={t('pos.envioModal')}
        size="sm"
        footer={
          <>
            <button className="btn btn-secondary" onClick={() => setShowEnvioModal(false)}>{t('common.cancel')}</button>
            <button className="btn btn-primary" onClick={() => { toast(t('pos.envioSaved')); setShowEnvioModal(false); }}>{t('common.save')}</button>
          </>
        }
      >
        <div className="space-y-3">
          <div>
            <label className="label">{t('pos.deliveryAddress')}</label>
            <input type="text" className="input" placeholder="Calle 123, Piso 2..." />
          </div>
          <div>
            <label className="label">{t('pos.deliveryPhone')}</label>
            <input type="text" className="input" placeholder="+54 11..." />
          </div>
          <div>
            <label className="label">{t('pos.deliveryNotes')}</label>
            <textarea className="input h-16 resize-none" placeholder={t('pos.deliveryNotesPlaceholder')} />
          </div>
        </div>
      </Modal>
    </div>
  );
};
