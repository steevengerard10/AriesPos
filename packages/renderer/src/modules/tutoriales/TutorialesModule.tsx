import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  Play, Pause, SkipForward, SkipBack,
  ChevronRight, BookOpen, ShoppingCart, Package, Users,
  Archive, Wallet, CreditCard, Layers, BarChart2, Settings,
  CheckCircle, Maximize2, Minimize2, Volume2, VolumeX, Subtitles,
  MessageSquare,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';

// ─── Tipos ────────────────────────────────────────────────────────────────────

interface CursorWaypoint {
  x: number;   // 0-100 porcentaje horizontal
  y: number;   // 0-100 porcentaje vertical
  t: number;   // segundos desde inicio del slide
  click?: boolean;
}

interface Slide {
  title: string;
  captionES: string;   // narración en español (TTS + subtítulo por defecto)
  captionEN: string;   // subtítulo en inglés
  visual: React.ReactNode;
  duration: number;
  waypoints: CursorWaypoint[];
}

interface Tutorial {
  id: string;
  title: string;
  description: string;
  icon: React.ReactNode;
  color: string;
  slides: Slide[];
}

// ─── Cursor animado ───────────────────────────────────────────────────────────

function lerp(a: number, b: number, t: number) { return a + (b - a) * t; }
function easeInOut(t: number) { return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2; }

function getCursorPos(waypoints: CursorWaypoint[], elapsed: number) {
  if (!waypoints.length) return { x: 50, y: 50, clicking: false };
  let prev = waypoints[0];
  let next = waypoints[waypoints.length - 1];
  for (let i = 0; i < waypoints.length - 1; i++) {
    if (waypoints[i].t <= elapsed && waypoints[i + 1].t >= elapsed) {
      prev = waypoints[i];
      next = waypoints[i + 1];
      break;
    }
    if (waypoints[i].t <= elapsed) prev = waypoints[i];
  }
  if (prev.t === next.t) return { x: prev.x, y: prev.y, clicking: prev.click ?? false };
  const raw = (elapsed - prev.t) / (next.t - prev.t);
  const t = Math.max(0, Math.min(1, raw));
  const e = easeInOut(t);
  return { x: lerp(prev.x, next.x, e), y: lerp(prev.y, next.y, e), clicking: elapsed - prev.t < 0.35 && (prev.click ?? false) };
}

const AnimatedCursorOverlay: React.FC<{ waypoints: CursorWaypoint[]; elapsed: number }> = ({ waypoints, elapsed }) => {
  const { x, y, clicking } = getCursorPos(waypoints, elapsed);
  return (
    <div className="absolute inset-0 pointer-events-none" style={{ zIndex: 25 }}>
      {/* Ripple de clic */}
      {clicking && (
        <div
          key={`${Math.round(elapsed * 10)}`}
          style={{
            position: 'absolute', left: `${x}%`, top: `${y}%`,
            transform: 'translate(-50%,-50%)',
            width: 32, height: 32, borderRadius: '50%',
            border: '2px solid rgba(255,255,255,0.6)',
            animation: 'cursorRipple 0.4s ease-out forwards',
          }}
        />
      )}
      {/* Cursor principal */}
      <div
        style={{
          position: 'absolute',
          left: `${x}%`, top: `${y}%`,
          width: 18, height: 18,
          borderRadius: '50%',
          background: clicking ? 'rgba(255,255,255,0.95)' : 'rgba(255,255,255,0.1)',
          border: '2px solid white',
          boxShadow: clicking ? '0 0 0 4px rgba(255,255,255,0.25)' : '0 0 8px rgba(0,0,0,0.5)',
          transition: 'background 0.1s, transform 0.1s, left 0.35s cubic-bezier(.4,0,.2,1), top 0.35s cubic-bezier(.4,0,.2,1)',
          transform: clicking ? 'translate(-50%,-50%) scale(0.7)' : 'translate(-50%,-50%) scale(1)',
        }}
      />
    </div>
  );
};

// ─── Web Speech API ───────────────────────────────────────────────────────────

function useSpeechNarration(text: string, playing: boolean, enabled: boolean, speechLang: 'en' | 'es') {
  const voicesRef = useRef<SpeechSynthesisVoice[]>([]);

  useEffect(() => {
    const load = () => { voicesRef.current = window.speechSynthesis?.getVoices() ?? []; };
    load();
    window.speechSynthesis?.addEventListener('voiceschanged', load);
    return () => window.speechSynthesis?.removeEventListener('voiceschanged', load);
  }, []);

  useEffect(() => {
    if (!window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    if (!enabled || !playing || !text) return;
    const u = new SpeechSynthesisUtterance(text);
    const voices = voicesRef.current;
    if (speechLang === 'en') {
      u.lang = 'en-US';
      u.rate = 0.92;
      u.pitch = 1;
      u.volume = 0.95;
      const voice = voices.find(v => v.lang === 'en-US')
        || voices.find(v => v.lang.startsWith('en'));
      if (voice) u.voice = voice;
    } else {
      u.lang = 'es-AR';
      u.rate = 0.88;
      u.pitch = 1.08;
      u.volume = 0.95;
      const voice = voices.find(v => v.lang === 'es-AR')
        || voices.find(v => v.lang === 'es-ES')
        || voices.find(v => v.lang.startsWith('es'));
      if (voice) u.voice = voice;
    }
    const t = setTimeout(() => window.speechSynthesis.speak(u), 80);
    return () => { clearTimeout(t); window.speechSynthesis.cancel(); };
  }, [text, playing, enabled, speechLang]);
}

// ─── Componentes de visuales ──────────────────────────────────────────────────

const Callout: React.FC<{ text: string; x: number; y: number; color?: string }> = ({ text, x, y, color = 'var(--accent)' }) => (
  <div className="absolute pointer-events-none" style={{ left: `${x}%`, top: `${y}%`, transform: 'translate(-50%,-50%)', zIndex: 15 }}>
    <div className="px-3 py-1.5 rounded-lg text-xs font-semibold text-white whitespace-nowrap shadow-xl" style={{ background: color, boxShadow: `0 0 20px ${color}55` }}>
      {text}
    </div>
  </div>
);

const HighlightBox: React.FC<{ x: number; y: number; w: number; h: number; color?: string }> = ({ x, y, w, h, color = 'var(--accent)' }) => (
  <div className="absolute pointer-events-none rounded-lg" style={{ left: `${x}%`, top: `${y}%`, width: `${w}%`, height: `${h}%`, transform: 'translate(-50%,-50%)', border: `2px solid ${color}`, background: `${color}20`, boxShadow: `0 0 15px ${color}40`, animation: 'pulse 2s infinite', zIndex: 10 }} />
);

const MockTopbar: React.FC<{ title: string; subtitle?: string }> = ({ title, subtitle }) => (
  <div className="flex items-center justify-between px-4 py-2 border-b" style={{ borderColor: 'rgba(255,255,255,0.1)', background: 'rgba(0,0,0,0.3)' }}>
    <div>
      <div className="font-bold text-white text-sm">{title}</div>
      {subtitle && <div className="text-xs" style={{ color: 'var(--text3)' }}>{subtitle}</div>}
    </div>
    <div className="flex gap-2">
      <div className="rounded px-2 py-0.5 text-xs font-medium" style={{ background: 'var(--accent)', color: '#fff' }}>+ Nuevo</div>
      <div className="rounded px-2 py-0.5 text-xs font-medium" style={{ background: 'rgba(255,255,255,0.08)', color: 'var(--text2)' }}>Importar</div>
    </div>
  </div>
);

const PosBg: React.FC = () => (
  <div className="flex h-full">
    <div className="flex flex-col w-56 border-r" style={{ borderColor: 'rgba(255,255,255,0.08)', background: '#111120' }}>
      <div className="p-3 border-b" style={{ borderColor: 'rgba(255,255,255,0.08)' }}>
        <div className="rounded-md px-3 py-1.5 text-xs" style={{ background: 'rgba(255,255,255,0.06)', color: 'var(--text3)' }}>🔍 Buscar producto...</div>
      </div>
      <div className="flex-1 p-2 space-y-1">
        {['Coca Cola 2L','Pan lactal','Leche x 1L','Yerba mate 500g'].map((item, i) => (
          <div key={i} className="flex items-center justify-between px-2 py-1.5 rounded-md text-xs" style={{ background: 'rgba(255,255,255,0.04)', color: 'var(--text2)' }}>
            <span>{item}</span><span style={{ color: 'var(--accent)' }}>${[850,2100,1400,3200][i]}</span>
          </div>
        ))}
      </div>
    </div>
    <div className="flex-1 flex flex-col">
      <div className="p-2 border-b flex items-center justify-between" style={{ borderColor: 'rgba(255,255,255,0.08)' }}>
        <span className="text-xs font-medium" style={{ color: 'var(--text2)' }}>🛒 Carrito (3 ítems)</span>
        <span className="text-xs" style={{ color: 'var(--text3)' }}>Cliente: sin asignar</span>
      </div>
      <div className="flex-1 p-2 space-y-1.5">
        {[{n:'Coca Cola 2L',c:2,p:850},{n:'Pan lactal',c:1,p:2100},{n:'Leche x 1L',c:3,p:1400}].map((item,i) => (
          <div key={i} className="flex items-center gap-2 px-2 py-1.5 rounded-md text-xs" style={{ background: 'rgba(255,255,255,0.05)' }}>
            <span className="flex-1 text-white">{item.n}</span>
            <span className="w-8 text-center rounded px-1" style={{ background: 'rgba(79,142,247,0.2)', color: 'var(--accent)' }}>{item.c}</span>
            <span style={{ color: 'var(--text2)', minWidth: 50 }}>${(item.c*item.p).toLocaleString()}</span>
          </div>
        ))}
      </div>
      <div className="p-3 border-t" style={{ borderColor: 'rgba(255,255,255,0.08)', background: 'rgba(0,0,0,0.3)' }}>
        <div className="flex justify-between mb-2 text-sm font-bold">
          <span style={{ color: 'var(--text2)' }}>TOTAL</span><span className="text-white">$9,200</span>
        </div>
        <div className="rounded-lg py-1.5 text-center text-sm font-bold text-white" style={{ background: 'var(--accent)' }}>Confirmar venta ↵</div>
      </div>
    </div>
  </div>
);

const PosVisual: React.FC<{ highlight?: 'search'|'qty'|'confirm' }> = ({ highlight }) => (
  <div className="relative w-full h-full rounded-lg overflow-hidden" style={{ background: '#0d0d1a' }}>
    <PosBg />
    {highlight === 'search' && <HighlightBox x={29} y={12} w={42} h={10} />}
    {highlight === 'qty' && <HighlightBox x={73} y={55} w={12} h={8} color="#22c55e" />}
    {highlight === 'confirm' && <HighlightBox x={73} y={90} w={48} h={10} />}
  </div>
);

const ProductosVisual: React.FC<{ highlight?: 'search'|'form'|'import' }> = ({ highlight }) => (
  <div className="relative w-full h-full rounded-lg overflow-hidden" style={{ background: '#0d0d1a' }}>
    <MockTopbar title="Productos" subtitle="Catálogo de productos" />
    <div className="p-3">
      <div className="flex gap-2 mb-3">
        <div className="flex-1 rounded px-2 py-1 text-xs" style={{ background: 'rgba(255,255,255,0.06)', color: 'var(--text3)', border: highlight === 'search' ? '1px solid var(--accent)' : '1px solid transparent' }}>🔍 Buscar por nombre o código...</div>
        <div className="rounded px-2 py-1 text-xs" style={{ background: 'rgba(255,255,255,0.06)', color: 'var(--text2)', border: highlight === 'import' ? '1px solid #22c55e' : '1px solid transparent' }}>📥 Importar</div>
        <div className="rounded px-2 py-1 text-xs" style={{ background: 'rgba(255,255,255,0.06)', color: 'var(--text2)' }}>⊞</div>
      </div>
      <div className="grid grid-cols-3 gap-2">
        {['Coca Cola 2L','Yerba Mate 500g','Pan Lactal','Leche 1L','Azúcar 1kg','Fideos 500g'].map((p,i) => (
          <div key={i} className="rounded-lg p-2 text-xs" style={{ background: 'rgba(255,255,255,0.05)', border: highlight === 'form' && i === 0 ? '1px solid var(--accent)' : '1px solid rgba(255,255,255,0.06)' }}>
            <div className="rounded mb-1.5 flex items-center justify-center text-xl" style={{ background: 'rgba(255,255,255,0.04)', height: 32 }}>🛒</div>
            <div className="font-medium text-white truncate">{p}</div>
            <div style={{ color: 'var(--accent)' }}>${[850,3200,2100,1400,1100,950][i]}</div>
          </div>
        ))}
      </div>
    </div>
    {highlight === 'import' && <Callout text="Importá desde Nextar u otros sistemas" x={72} y={22} color="#22c55e" />}
    {highlight === 'form' && <Callout text="Doble clic para editar" x={22} y={75} />}
  </div>
);

const ClientesVisual: React.FC<{ step?: number }> = ({ step = 0 }) => (
  <div className="relative w-full h-full rounded-lg overflow-hidden" style={{ background: '#0d0d1a' }}>
    <MockTopbar title="Clientes" subtitle="Gestión de clientes y cuenta corriente" />
    <div className="flex h-[calc(100%-44px)]">
      <div className="w-52 border-r p-2 space-y-1.5" style={{ borderColor: 'rgba(255,255,255,0.08)' }}>
        {['Juan Pérez','María García','Carlos López','Ana Martínez'].map((c,i) => (
          <div key={i} className={`px-2 py-1.5 rounded-md text-xs flex justify-between items-center ${i===1&&step>=1?'ring-1 ring-accent':''}`} style={{ background: i===1?'rgba(79,142,247,0.1)':'rgba(255,255,255,0.04)', color: 'var(--text2)' }}>
            <span className="text-white">{c}</span>
            {i===1 && <span className="text-xs rounded px-1" style={{ background: 'rgba(239,68,68,0.2)', color: '#f87171' }}>Fiado</span>}
          </div>
        ))}
      </div>
      <div className="flex-1 p-3">
        {step >= 1 && (
          <div className="space-y-2">
            <div className="text-sm font-bold text-white">María García</div>
            <div className="grid grid-cols-2 gap-2">
              <div className="rounded-lg p-2 text-xs" style={{ background: 'rgba(255,255,255,0.04)' }}>
                <div style={{ color: 'var(--text3)' }}>Saldo fiado</div>
                <div className="font-bold text-lg" style={{ color: '#f87171' }}>-$15,200</div>
              </div>
              <div className="rounded-lg p-2 text-xs" style={{ background: 'rgba(255,255,255,0.04)' }}>
                <div style={{ color: 'var(--text3)' }}>Compras totales</div>
                <div className="font-bold text-lg text-white">$87,400</div>
              </div>
            </div>
            {step >= 2 && <div className="rounded py-1.5 text-center text-xs font-bold" style={{ background: '#22c55e22', color: '#22c55e', border: '1px solid #22c55e55' }}>💰 Registrar pago</div>}
          </div>
        )}
      </div>
    </div>
  </div>
);

const StockVisual: React.FC<{ highlight?: string }> = ({ highlight }) => (
  <div className="relative w-full h-full rounded-lg overflow-hidden" style={{ background: '#0d0d1a' }}>
    <MockTopbar title="Stock" subtitle="Control de inventario" />
    <div className="p-3">
      <div className="overflow-hidden rounded-lg border" style={{ borderColor: 'rgba(255,255,255,0.08)' }}>
        <div className="grid grid-cols-4 px-3 py-1.5 text-xs font-medium" style={{ background: 'rgba(255,255,255,0.04)', color: 'var(--text3)' }}>
          <span>Producto</span><span>Stock</span><span>Mínimo</span><span>Estado</span>
        </div>
        {[{n:'Coca Cola 2L',s:24,m:10,ok:true},{n:'Yerba Mate',s:3,m:10,ok:false},{n:'Pan Lactal',s:0,m:5,ok:false},{n:'Leche 1L',s:18,m:12,ok:true},{n:'Azúcar 1kg',s:7,m:8,ok:false}].map((p,i) => (
          <div key={i} className={`grid grid-cols-4 px-3 py-1.5 text-xs border-t ${!p.ok&&highlight==='low'?'bg-red-500/5':''}`} style={{ borderColor: 'rgba(255,255,255,0.05)', color: 'var(--text2)' }}>
            <span className={!p.ok?'text-red-400 font-medium':'text-white'}>{p.n}</span>
            <span className={p.s===0?'text-red-400 font-bold':p.s<p.m?'text-yellow-400':'text-white'}>{p.s}</span>
            <span>{p.m}</span>
            <span>{p.ok?<span style={{color:'#22c55e'}}>✓ OK</span>:p.s===0?<span className="text-red-400">⚠ Sin stock</span>:<span className="text-yellow-400">⚠ Bajo</span>}</span>
          </div>
        ))}
      </div>
    </div>
    {highlight === 'btn' && <HighlightBox x={80} y={10} w={18} h={9} color="#f59e0b" />}
  </div>
);

const CajaVisual: React.FC<{ step?: number }> = ({ step = 0 }) => (
  <div className="relative w-full h-full rounded-lg overflow-hidden" style={{ background: '#0d0d1a' }}>
    <MockTopbar title="Caja" subtitle="Cierre y apertura de caja" />
    <div className="p-4 space-y-3">
      <div className="grid grid-cols-3 gap-3">
        {[{label:'Efectivo',icon:'💵',value:'$84,200',color:'#22c55e'},{label:'Tarjeta',icon:'💳',value:'$31,450',color:'var(--accent)'},{label:'Fiado',icon:'📋',value:'$12,750',color:'#f59e0b'}].map((c,i) => (
          <div key={i} className="rounded-lg p-3 text-center" style={{ background: 'rgba(255,255,255,0.05)' }}>
            <div className="text-2xl mb-1">{c.icon}</div>
            <div className="text-xs mb-0.5" style={{ color: 'var(--text3)' }}>{c.label}</div>
            <div className="font-bold text-sm" style={{ color: c.color }}>{c.value}</div>
          </div>
        ))}
      </div>
      <div className="rounded-lg p-3" style={{ background: 'rgba(255,255,255,0.04)' }}>
        <div className="flex justify-between text-sm mb-1"><span style={{ color: 'var(--text3)' }}>Total del día</span><span className="font-bold text-white">$128,400</span></div>
        <div className="flex justify-between text-sm"><span style={{ color: 'var(--text3)' }}>Ventas registradas</span><span style={{ color: 'var(--accent)' }}>47</span></div>
      </div>
      {step >= 1 && <div className="rounded-lg py-2 text-center text-sm font-bold" style={{ background: 'rgba(239,68,68,0.15)', color: '#f87171', border: '1px solid rgba(239,68,68,0.3)' }}>🔒 Cerrar caja del día</div>}
    </div>
  </div>
);

const CombosVisual: React.FC<{ step?: number }> = ({ step = 0 }) => (
  <div className="relative w-full h-full rounded-lg overflow-hidden" style={{ background: '#0d0d1a' }}>
    <MockTopbar title="Combos" subtitle="Paquetes y ofertas especiales" />
    <div className="p-3 grid grid-cols-2 gap-3">
      {[{name:'Combo Desayuno',items:['Leche 1L','Medialunas x6','Café 250g'],price:4500,original:5200},{name:'Combo Asado',items:['Carne 2kg','Carbón','Sal gruesa','Bebida 2L'],price:18000,original:21000}].map((combo,i) => (
        <div key={i} className={`rounded-lg p-3 ${step>=1&&i===0?'ring-1 ring-accent':''}`} style={{ background: 'rgba(255,255,255,0.05)' }}>
          <div className="font-bold text-sm text-white mb-2">{combo.name}</div>
          <div className="space-y-0.5 mb-2">
            {combo.items.map((item,j) => (
              <div key={j} className="text-xs flex items-center gap-1" style={{ color: 'var(--text3)' }}><span style={{ color: 'var(--accent)' }}>•</span> {item}</div>
            ))}
          </div>
          <div className="flex justify-between items-center">
            <div><span className="font-bold" style={{ color: 'var(--accent)' }}>${combo.price.toLocaleString()}</span><span className="text-xs ml-1 line-through" style={{ color: 'var(--text3)' }}>${combo.original.toLocaleString()}</span></div>
            <span className="text-xs rounded px-1.5 py-0.5" style={{ background: 'rgba(34,197,94,0.15)', color: '#22c55e' }}>-{Math.round((1-combo.price/combo.original)*100)}%</span>
          </div>
        </div>
      ))}
    </div>
  </div>
);

// ─── Datos de tutoriales con waypoints ───────────────────────────────────────

const TUTORIALES: Tutorial[] = [
  {
    id: 'pos', title: 'Punto de Venta (POS)', description: 'Cómo registrar ventas, agregar productos y cobrar',
    icon: <ShoppingCart size={20} />, color: '#4f8ef7',
    slides: [
      {
        title: 'Abrir el POS',
        captionES: 'Presioná F2 o hacé clic en Nueva Venta en la barra lateral para abrir el punto de venta. La ventana del POS se abre lista para recibir productos.',
        captionEN: 'Press F2 or click New Sale in the sidebar to open the point of sale. The POS window opens ready to receive products.',
        visual: <PosVisual />,
        duration: 7,
        waypoints: [{x:10,y:25,t:0},{x:10,y:25,t:1,click:true},{x:45,y:50,t:2.5},{x:20,y:12,t:4},{x:20,y:12,t:6}],
      },
      {
        title: 'Buscar y agregar productos',
        captionES: 'Escribí el nombre del producto en el buscador o escaneá el código de barras. Los resultados aparecen en tiempo real. Hacé clic para agregar al carrito.',
        captionEN: 'Type the product name or scan a barcode. Results appear in real time. Click to add it to the cart.',
        visual: <PosVisual highlight="search" />,
        duration: 8,
        waypoints: [{x:20,y:12,t:0,click:true},{x:20,y:12,t:1.5},{x:20,y:35,t:3,click:true},{x:65,y:50,t:5},{x:65,y:50,t:7}],
      },
      {
        title: 'Modificar cantidad y precio',
        captionES: 'Hacé clic sobre la cantidad en el carrito para editarla directamente. Para aplicar un descuento al ítem, usá el ícono de porcentaje que aparece en cada producto.',
        captionEN: 'Click the quantity in the cart to edit it directly. To apply a discount, use the percentage icon that appears on each product.',
        visual: <PosVisual highlight="qty" />,
        duration: 7,
        waypoints: [{x:65,y:48,t:0},{x:73,y:55,t:1.5,click:true},{x:73,y:55,t:3},{x:73,y:62,t:4.5,click:true},{x:73,y:55,t:6}],
      },
      {
        title: 'Cobrar y cerrar la venta',
        captionES: 'Revisá el total en la parte inferior. Elegí el método de pago y presioná Confirmar venta o la tecla Enter para registrar la operación.',
        captionEN: 'Check the total at the bottom. Choose the payment method and press Confirm sale or Enter to complete the transaction.',
        visual: <PosVisual highlight="confirm" />,
        duration: 8,
        waypoints: [{x:65,y:70,t:0},{x:73,y:85,t:2},{x:73,y:90,t:3.5,click:true},{x:73,y:90,t:7}],
      },
    ],
  },
  {
    id: 'productos', title: 'Gestión de Productos', description: 'Agregar, editar e importar el catálogo de productos',
    icon: <Package size={20} />, color: '#a855f7',
    slides: [
      {
        title: 'Vista del catálogo',
        captionES: 'En el módulo Productos encontrás todo tu catálogo. Podés alternar entre vista grilla y lista. Los productos con stock bajo aparecen resaltados.',
        captionEN: 'In the Products module you will find your full catalog. Toggle between grid and list view. Products with low stock are highlighted.',
        visual: <ProductosVisual />,
        duration: 7,
        waypoints: [{x:50,y:50,t:0},{x:22,y:55,t:2},{x:50,y:55,t:4},{x:78,y:55,t:6}],
      },
      {
        title: 'Buscar productos',
        captionES: 'Usá el buscador para encontrar productos por nombre, código de barras o código interno. La búsqueda es instantánea mientras escribís.',
        captionEN: 'Use the search bar to find products by name, barcode, or internal code. The search is instant as you type.',
        visual: <ProductosVisual highlight="search" />,
        duration: 6,
        waypoints: [{x:40,y:20,t:0,click:true},{x:40,y:20,t:2},{x:40,y:20,t:4},{x:50,y:55,t:5.5}],
      },
      {
        title: 'Editar un producto',
        captionES: 'Hacé doble clic en cualquier producto para abrir el formulario de edición. Podés cambiar nombre, precios, stock mínimo, categoría e imagen.',
        captionEN: 'Double-click any product to open the edit form. You can change the name, prices, minimum stock, category, and image.',
        visual: <ProductosVisual highlight="form" />,
        duration: 8,
        waypoints: [{x:22,y:55,t:0},{x:22,y:55,t:1,click:true},{x:22,y:55,t:1.3,click:true},{x:50,y:55,t:4},{x:50,y:55,t:7}],
      },
      {
        title: 'Importar desde Nextar',
        captionES: 'Usá el botón Importar para cargar productos desde un backup de Nextar o desde una carpeta. El sistema detecta automáticamente el formato y evita duplicados.',
        captionEN: 'Use the Import button to load products from a Nextar backup or a folder. The system automatically detects the format and avoids duplicates.',
        visual: <ProductosVisual highlight="import" />,
        duration: 8,
        waypoints: [{x:50,y:55,t:0},{x:72,y:20,t:2,click:true},{x:72,y:20,t:4},{x:50,y:55,t:7}],
      },
    ],
  },
  {
    id: 'clientes', title: 'Clientes y Cuenta Corriente', description: 'Administrar clientes, fiados y pagos',
    icon: <Users size={20} />, color: '#22c55e',
    slides: [
      {
        title: 'Lista de clientes',
        captionES: 'En el módulo Clientes encontrás todos los clientes registrados. Los que tienen saldo pendiente de fiado aparecen con una etiqueta roja.',
        captionEN: 'In the Clients module you will find all registered clients. Those with pending credit appear with a red label.',
        visual: <ClientesVisual step={0} />,
        duration: 6,
        waypoints: [{x:22,y:35,t:0},{x:22,y:45,t:1.5},{x:22,y:55,t:3},{x:22,y:65,t:4.5}],
      },
      {
        title: 'Ver cuenta corriente',
        captionES: 'Hacé clic en un cliente para ver su ficha completa con el saldo de fiado, historial de compras y límite de crédito.',
        captionEN: 'Click a client to see their full profile with credit balance, purchase history, and credit limit.',
        visual: <ClientesVisual step={1} />,
        duration: 7,
        waypoints: [{x:22,y:45,t:0,click:true},{x:65,y:55,t:2},{x:65,y:65,t:4},{x:65,y:55,t:6}],
      },
      {
        title: 'Registrar un pago',
        captionES: 'Cuando un cliente abona su deuda, usá el botón verde Registrar pago para descontarle el monto del saldo. Podés ingresar el monto parcial o total.',
        captionEN: 'When a client pays their debt, use the green Register payment button to deduct the amount. You can enter a partial or full payment.',
        visual: <ClientesVisual step={2} />,
        duration: 8,
        waypoints: [{x:65,y:55,t:0},{x:65,y:75,t:2,click:true},{x:65,y:75,t:5},{x:65,y:55,t:7}],
      },
    ],
  },
  {
    id: 'stock', title: 'Control de Stock', description: 'Inventario, alertas de stock bajo y ajustes',
    icon: <Archive size={20} />, color: '#f59e0b',
    slides: [
      {
        title: 'Tabla de inventario',
        captionES: 'El módulo Stock muestra todos tus productos con su cantidad actual. Podés ordenar por nombre, stock, categoría y filtrar por estado.',
        captionEN: 'The Stock module shows all your products with their current quantity. You can sort by name, stock, category, and filter by status.',
        visual: <StockVisual />,
        duration: 6,
        waypoints: [{x:50,y:30,t:0},{x:50,y:45,t:1.5},{x:50,y:58,t:3},{x:50,y:70,t:4.5}],
      },
      {
        title: 'Alertas de stock bajo',
        captionES: 'Los productos por debajo del stock mínimo configurado aparecen en amarillo. Los que están sin stock, en rojo. El mínimo se define en la ficha de cada producto.',
        captionEN: 'Products below the configured minimum stock appear in yellow. Those with no stock appear in red. The minimum is defined in each product form.',
        visual: <StockVisual highlight="low" />,
        duration: 7,
        waypoints: [{x:20,y:45,t:0},{x:20,y:58,t:1.5},{x:50,y:58,t:3},{x:80,y:58,t:4.5},{x:20,y:70,t:6}],
      },
      {
        title: 'Ajustes de inventario',
        captionES: 'Usá el botón Ajustar stock para ingresar mercadería recibida o corregir diferencias. Cada movimiento queda registrado en el historial.',
        captionEN: 'Use the Adjust stock button to enter received goods or correct differences. Every movement is recorded in the history.',
        visual: <StockVisual highlight="btn" />,
        duration: 7,
        waypoints: [{x:50,y:50,t:0},{x:80,y:10,t:2,click:true},{x:80,y:10,t:4},{x:50,y:50,t:6}],
      },
    ],
  },
  {
    id: 'caja', title: 'Caja del Día', description: 'Apertura, cierre y resumen del dinero diario',
    icon: <Wallet size={20} />, color: '#ef4444',
    slides: [
      {
        title: 'Resumen de la caja',
        captionES: 'El módulo Caja muestra el resumen diario de ventas agrupado por método de pago: efectivo, tarjeta y fiado. Se actualiza en tiempo real con cada venta.',
        captionEN: 'The Cash module shows the daily sales summary grouped by payment method: cash, card, and credit. It updates in real time with each sale.',
        visual: <CajaVisual step={0} />,
        duration: 7,
        waypoints: [{x:20,y:40,t:0},{x:50,y:40,t:1.5},{x:80,y:40,t:3},{x:50,y:65,t:5},{x:50,y:75,t:6}],
      },
      {
        title: 'Cerrar la caja',
        captionES: 'Al finalizar el día, cerrá la caja para guardar el resumen definitivo. El cierre genera un informe con el total, la cantidad de ventas y el desglose por método de pago.',
        captionEN: 'At the end of the day, close the cash register to save the final report. The close generates a summary with totals and breakdown by payment method.',
        visual: <CajaVisual step={1} />,
        duration: 8,
        waypoints: [{x:50,y:50,t:0},{x:50,y:75,t:2},{x:50,y:80,t:3.5,click:true},{x:50,y:80,t:7}],
      },
    ],
  },
  {
    id: 'combos', title: 'Combos y Ofertas', description: 'Crear paquetes de productos con descuento',
    icon: <Layers size={20} />, color: '#06b6d4',
    slides: [
      {
        title: '¿Qué son los combos?',
        captionES: 'Los combos permiten agrupar varios productos y venderlos juntos a un precio especial. Son perfectos para ofertas, canastas o packs de temporada.',
        captionEN: 'Combos let you group products and sell them together at a special price. Perfect for promotions, baskets, or seasonal packs.',
        visual: <CombosVisual step={0} />,
        duration: 6,
        waypoints: [{x:25,y:45,t:0},{x:75,y:45,t:2},{x:25,y:70,t:4},{x:75,y:70,t:5.5}],
      },
      {
        title: 'Crear un combo',
        captionES: 'Hacé clic en el botón Nuevo, asignale un nombre, añadí los productos que lo componen y definí el precio total. El sistema calcula el descuento automáticamente.',
        captionEN: 'Click the New button, assign a name, add its products, and set the total price. The system automatically calculates the discount percentage.',
        visual: <CombosVisual step={1} />,
        duration: 8,
        waypoints: [{x:80,y:10,t:0,click:true},{x:50,y:40,t:2},{x:25,y:50,t:4},{x:25,y:65,t:6,click:true}],
      },
      {
        title: 'Vender un combo desde el POS',
        captionES: 'Los combos aparecen en el buscador del POS igual que los productos individuales. Al vender un combo, el stock de cada producto incluido se descuenta automáticamente.',
        captionEN: 'Combos appear in the POS search just like individual products. When you sell a combo, the stock of each included product is automatically deducted.',
        visual: <PosVisual highlight="search" />,
        duration: 7,
        waypoints: [{x:20,y:12,t:0,click:true},{x:20,y:12,t:1.5},{x:20,y:30,t:3,click:true},{x:65,y:50,t:5},{x:65,y:50,t:6.5}],
      },
    ],
  },
];

// ─── Estilos de animación ─────────────────────────────────────────────────────

const KEYFRAMES = `
@keyframes cursorRipple {
  0%   { transform: translate(-50%,-50%) scale(0.5); opacity: 0.8; }
  100% { transform: translate(-50%,-50%) scale(2.5); opacity: 0; }
}
`;

// ─── Componente principal ─────────────────────────────────────────────────────

export const TutorialesModule: React.FC = () => {
  const { i18n } = useTranslation();
  const uiLangRaw = i18n.language?.split('-')[0]?.toLowerCase() ?? 'es';
  const lang: 'en' | 'es' | 'pt' = uiLangRaw === 'en' ? 'en' : uiLangRaw === 'pt' ? 'pt' : 'es';

  const [selectedTutorial, setSelectedTutorial] = useState<Tutorial | null>(null);
  const [currentSlide, setCurrentSlide]         = useState(0);
  const [playing, setPlaying]                   = useState(false);
  const [progress, setProgress]                 = useState(0);
  const [completed, setCompleted]               = useState<Set<string>>(new Set());
  const [fullscreen, setFullscreen]             = useState(false);
  const [narrationOn, setNarrationOn]           = useState(true);
  const [subtitlesOn, setSubtitlesOn]           = useState(true);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const FPS = 30;

  const currentSlideDuration = selectedTutorial?.slides[currentSlide]?.duration ?? 7;
  const elapsedInSlide       = progress * currentSlideDuration;

  // Avance automático
  useEffect(() => {
    if (!playing || !selectedTutorial) return;
    const step = 1 / (currentSlideDuration * FPS);
    intervalRef.current = setInterval(() => {
      setProgress(prev => {
        if (prev + step >= 1) {
          const next = currentSlide + 1;
          if (next < selectedTutorial.slides.length) { setCurrentSlide(next); return 0; }
          setPlaying(false);
          setCompleted(c => new Set([...c, selectedTutorial.id]));
          return 1;
        }
        return prev + step;
      });
    }, 1000 / FPS);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [playing, currentSlide, currentSlideDuration, selectedTutorial]);

  // Narración (mismo idioma que el subtítulo; PT usa texto ES + voz ES)
  const slideForSpeech = selectedTutorial?.slides[currentSlide];
  const narrationText = slideForSpeech
    ? (lang === 'en' ? slideForSpeech.captionEN : slideForSpeech.captionES)
    : '';
  useSpeechNarration(narrationText, playing, narrationOn, lang === 'en' ? 'en' : 'es');

  const handlePlayPause  = useCallback(() => setPlaying(p => !p), []);
  const handlePrevSlide  = useCallback(() => { setProgress(0); setCurrentSlide(s => Math.max(0, s - 1)); }, []);
  const handleNextSlide  = useCallback(() => {
    if (!selectedTutorial) return;
    setProgress(0);
    const next = currentSlide + 1;
    if (next < selectedTutorial.slides.length) { setCurrentSlide(next); }
    else { setPlaying(false); setCompleted(c => new Set([...c, selectedTutorial.id])); }
  }, [currentSlide, selectedTutorial]);

  const handleSelectTutorial = (t: Tutorial) => {
    setSelectedTutorial(t); setCurrentSlide(0); setProgress(0); setPlaying(false);
  };

  const handleClose = () => {
    window.speechSynthesis?.cancel();
    setSelectedTutorial(null); setPlaying(false); setProgress(0); setCurrentSlide(0); setFullscreen(false);
    if (intervalRef.current) clearInterval(intervalRef.current);
  };

  const totalDuration  = selectedTutorial ? selectedTutorial.slides.reduce((a, s) => a + s.duration, 0) : 0;
  const elapsedTotal   = selectedTutorial ? selectedTutorial.slides.slice(0, currentSlide).reduce((a, s) => a + s.duration, 0) + elapsedInSlide : 0;
  const fmt = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

  const currentCaption = selectedTutorial?.slides[currentSlide]
    ? (lang === 'en' ? selectedTutorial.slides[currentSlide].captionEN : selectedTutorial.slides[currentSlide].captionES)
    : '';

  return (
    <div className="flex flex-col h-full overflow-hidden" style={{ background: 'var(--bg)' }}>
      <style>{KEYFRAMES}</style>

      {/* Header */}
      <div className="flex items-center justify-between shrink-0 px-6 py-4 border-b" style={{ borderColor: 'var(--border)' }}>
        <div className="flex items-center gap-3">
          {selectedTutorial && (
            <button onClick={handleClose} className="mr-1 p-1.5 rounded-lg transition-colors hover:bg-white/5" title="Volver">
              <ChevronRight size={16} style={{ color: 'var(--text3)', transform: 'rotate(180deg)' }} />
            </button>
          )}
          <BookOpen size={20} style={{ color: 'var(--accent)' }} />
          <div>
            <h1 className="text-base font-bold" style={{ color: 'var(--text)' }}>
              {selectedTutorial ? selectedTutorial.title : 'Tutoriales'}
            </h1>
            <p className="text-xs" style={{ color: 'var(--text3)' }}>
              {selectedTutorial ? selectedTutorial.description : `${TUTORIALES.length} tutoriales disponibles`}
            </p>
          </div>
        </div>
        <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: 'var(--bg3)', color: 'var(--text3)' }}>
          {completed.size}/{TUTORIALES.length} completados
        </span>
      </div>

      {!selectedTutorial ? (
        <div className="flex-1 overflow-y-auto p-6">
          <div className="grid grid-cols-2 gap-4 max-w-3xl mx-auto">
            {TUTORIALES.map(t => (
              <button key={t.id} onClick={() => handleSelectTutorial(t)}
                className="relative flex items-start gap-4 p-4 rounded-xl text-left transition-all duration-150"
                style={{ background: 'var(--bg2)', border: '1px solid var(--border)' }}
                onMouseEnter={e => (e.currentTarget.style.borderColor = t.color + '66')}
                onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--border)')}>
                <div className="shrink-0 w-10 h-10 rounded-lg flex items-center justify-center" style={{ background: t.color + '22', color: t.color }}>{t.icon}</div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="font-semibold text-sm" style={{ color: 'var(--text)' }}>{t.title}</span>
                    {completed.has(t.id) && <CheckCircle size={13} style={{ color: '#22c55e' }} />}
                  </div>
                  <p className="text-xs" style={{ color: 'var(--text3)' }}>{t.description}</p>
                  <div className="flex items-center gap-2 mt-2">
                    <span className="text-xs" style={{ color: 'var(--text3)' }}>
                      {t.slides.length} capítulos · ~{Math.ceil(t.slides.reduce((a, s) => a + s.duration, 0) / 60)} min
                    </span>
                  </div>
                  {completed.has(t.id) && <div className="mt-2 rounded-full h-1 overflow-hidden" style={{ background: 'var(--border)' }}><div className="h-full rounded-full" style={{ width: '100%', background: '#22c55e' }} /></div>}
                </div>
                <ChevronRight size={14} style={{ color: 'var(--text3)', marginTop: 2 }} />
              </button>
            ))}
          </div>
        </div>
      ) : (
        <div className={`flex flex-1 overflow-hidden ${fullscreen ? 'flex-col' : ''}`}>

          {/* Capítulos */}
          {!fullscreen && (
            <div className="w-56 shrink-0 border-r overflow-y-auto" style={{ borderColor: 'var(--border)', background: 'var(--bg2)' }}>
              <div className="p-2">
                {selectedTutorial.slides.map((slide, idx) => (
                  <button key={idx} onClick={() => { setCurrentSlide(idx); setProgress(0); }}
                    className="w-full flex items-center gap-2 px-2 py-2 rounded-lg text-left mb-1 transition-colors"
                    style={{ background: idx===currentSlide ? selectedTutorial.color+'20' : 'transparent', border: idx===currentSlide ? `1px solid ${selectedTutorial.color}44` : '1px solid transparent' }}>
                    <div className="shrink-0 w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold"
                      style={{ background: idx<currentSlide?'#22c55e':idx===currentSlide?selectedTutorial.color:'var(--bg3)', color: idx<=currentSlide?'#fff':'var(--text3)' }}>
                      {idx < currentSlide ? '✓' : idx + 1}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-medium truncate" style={{ color: idx===currentSlide?'var(--text)':'var(--text3)' }}>{slide.title}</div>
                      <div className="text-xs" style={{ color: 'var(--text3)' }}>{slide.duration}s</div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Player */}
          <div className="flex-1 flex flex-col overflow-hidden">

            {/* Visual */}
            <div className="flex-1 flex items-center justify-center p-4 overflow-hidden" style={{ background: 'var(--bg)' }}>
              <div className="relative w-full max-w-2xl" style={{ aspectRatio: '16/9', maxHeight: '100%' }}>
                {selectedTutorial.slides[currentSlide]?.visual}

                {/* Cursor animado overlay */}
                <AnimatedCursorOverlay
                  waypoints={selectedTutorial.slides[currentSlide]?.waypoints ?? []}
                  elapsed={elapsedInSlide}
                />

                {/* Subtítulos */}
                {subtitlesOn && currentCaption && (
                  <div className="absolute bottom-0 left-0 right-0 px-4 py-2 text-center" style={{ background: 'linear-gradient(transparent, rgba(0,0,0,0.8))' }}>
                    <p className="text-xs leading-snug font-medium" style={{ color: '#fff', textShadow: '0 1px 3px rgba(0,0,0,0.9)', maxWidth: '85%', margin: '0 auto' }}>
                      {currentCaption}
                    </p>
                  </div>
                )}

                {/* Overlay al pausar */}
                {!playing && (
                  <button onClick={handlePlayPause}
                    className="absolute inset-0 flex items-center justify-center rounded-lg"
                    style={{ background: 'rgba(0,0,0,0.35)', backdropFilter: 'blur(1px)' }}>
                    <div className="w-16 h-16 rounded-full flex items-center justify-center"
                      style={{ background: 'rgba(255,255,255,0.12)', backdropFilter: 'blur(4px)' }}>
                      <Play size={28} style={{ color: '#fff', marginLeft: 4 }} />
                    </div>
                  </button>
                )}

                <button onClick={() => setFullscreen(f => !f)} className="absolute top-2 right-2 p-1.5 rounded-md" style={{ background: 'rgba(0,0,0,0.4)', color: '#fff' }}>
                  {fullscreen ? <Minimize2 size={13} /> : <Maximize2 size={13} />}
                </button>
              </div>
            </div>

            {/* Controles */}
            <div className="shrink-0 px-4 pb-3 pt-2" style={{ borderTop: '1px solid var(--border)', background: 'var(--bg2)' }}>

              {/* Barra de progreso */}
              <div className="mb-2 flex items-center gap-2">
                <span className="text-xs tabular-nums" style={{ color: 'var(--text3)', minWidth: 36 }}>{fmt(elapsedTotal)}</span>
                <div className="flex-1 h-1.5 rounded-full overflow-hidden cursor-pointer" style={{ background: 'var(--border)' }}
                  onClick={e => {
                    const rect = e.currentTarget.getBoundingClientRect();
                    const cp = (e.clientX - rect.left) / rect.width;
                    let cum = 0;
                    for (let i = 0; i < selectedTutorial.slides.length; i++) {
                      const frac = selectedTutorial.slides[i].duration / totalDuration;
                      if (cp <= cum + frac) { setCurrentSlide(i); setProgress((cp - cum) / frac); break; }
                      cum += frac;
                    }
                  }}>
                  <div className="flex h-full gap-px">
                    {selectedTutorial.slides.map((s, idx) => {
                      const frac = s.duration / totalDuration;
                      const fill = idx < currentSlide ? 1 : idx === currentSlide ? progress : 0;
                      return (
                        <div key={idx} className="h-full rounded-sm relative overflow-hidden" style={{ flex: frac, background: 'var(--bg3)' }}>
                          <div className="h-full absolute inset-y-0 left-0 transition-all duration-75" style={{ width: `${fill * 100}%`, background: selectedTutorial.color }} />
                        </div>
                      );
                    })}
                  </div>
                </div>
                <span className="text-xs tabular-nums" style={{ color: 'var(--text3)', minWidth: 36 }}>{fmt(totalDuration)}</span>
              </div>

              <div className="flex items-center gap-3">
                {/* Transporte */}
                <div className="flex items-center gap-1">
                  <button onClick={handlePrevSlide} disabled={currentSlide===0} className="p-1.5 rounded-md hover:bg-white/5 disabled:opacity-30">
                    <SkipBack size={16} style={{ color: 'var(--text2)' }} />
                  </button>
                  <button onClick={handlePlayPause} className="p-2 rounded-lg" style={{ background: selectedTutorial.color, color: '#fff' }}>
                    {playing ? <Pause size={16} /> : <Play size={16} />}
                  </button>
                  <button onClick={handleNextSlide} disabled={currentSlide===selectedTutorial.slides.length-1} className="p-1.5 rounded-md hover:bg-white/5 disabled:opacity-30">
                    <SkipForward size={16} style={{ color: 'var(--text2)' }} />
                  </button>
                </div>

                {/* Info del slide */}
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold truncate" style={{ color: 'var(--text)' }}>
                    {currentSlide + 1}. {selectedTutorial.slides[currentSlide]?.title}
                  </div>
                </div>

                {/* Controles de voz y subtítulos */}
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setNarrationOn(n => !n)}
                    className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs transition-colors"
                    style={{ background: narrationOn ? selectedTutorial.color + '22' : 'var(--bg3)', color: narrationOn ? selectedTutorial.color : 'var(--text3)', border: `1px solid ${narrationOn ? selectedTutorial.color + '44' : 'var(--border)'}` }}
                    title={narrationOn ? 'Silenciar narración' : 'Activar narración'}>
                    {narrationOn ? <Volume2 size={12} /> : <VolumeX size={12} />}
                    <span className="hidden sm:inline">{narrationOn ? 'Voz' : 'Mudo'}</span>
                  </button>
                  <button
                    onClick={() => setSubtitlesOn(s => !s)}
                    className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs transition-colors"
                    style={{ background: subtitlesOn ? selectedTutorial.color + '22' : 'var(--bg3)', color: subtitlesOn ? selectedTutorial.color : 'var(--text3)', border: `1px solid ${subtitlesOn ? selectedTutorial.color + '44' : 'var(--border)'}` }}
                    title={subtitlesOn ? 'Ocultar subtítulos' : 'Mostrar subtítulos'}>
                    <MessageSquare size={12} />
                    <span className="hidden sm:inline">CC</span>
                  </button>
                  <span className="text-xs px-1.5 py-1 rounded" style={{ background: 'var(--bg3)', color: 'var(--text3)' }}>
                    {lang === 'en' ? '🇺🇸 EN' : lang === 'pt' ? '🇧🇷 PT' : '🇦🇷 ES'}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};