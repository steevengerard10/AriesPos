import React, { useState, useRef, useEffect } from 'react';
import { X, Send, Sparkles, Bot } from 'lucide-react';
import { useAppStore } from '../../store/useAppStore';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  time: string;
}

const WELCOME: Message = {
  id: 'welcome',
  role: 'assistant',
  text: '¡Hola! Soy ARIES IA. Puedo ayudarte con consultas del negocio, reportes de ventas, alertas de stock y más. ¿En qué te puedo ayudar hoy?',
  time: '',
};

function now() {
  return new Date().toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });
}

export default function AriesIA() {
  const { setIaOpen } = useAppStore();
  const [messages, setMessages] = useState<Message[]>([WELCOME]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  async function sendMessage() {
    const text = input.trim();
    if (!text || loading) return;
    setInput('');
    const userMsg: Message = { id: Date.now().toString(), role: 'user', text, time: now() };
    setMessages((m) => [...m, userMsg]);
    setLoading(true);

    // Simulate AI response (replace with actual API call)
    await new Promise((r) => setTimeout(r, 800));
    const replies: Record<string, string> = {
      default: 'Esta función estará disponible próximamente. Por ahora puedo ayudarte con consultas básicas sobre el sistema.',
    };
    const lc = text.toLowerCase();
    let reply = replies.default;
    if (lc.includes('venta') || lc.includes('hoy')) {
      reply = 'Para ver las ventas de hoy, ve al módulo Dashboard o a Historial de Ventas.';
    } else if (lc.includes('stock') || lc.includes('inventario')) {
      reply = 'Para revisar el inventario y alertas de stock, accede al módulo Inventario.';
    } else if (lc.includes('cliente') || lc.includes('fiado')) {
      reply = 'Los fiados y clientes están disponibles en el módulo Clientes.';
    }

    setMessages((m) => [...m, { id: (Date.now() + 1).toString(), role: 'assistant', text: reply, time: now() }]);
    setLoading(false);
  }

  return (
    <div
      className="flex flex-col shrink-0 animate-slide-left"
      style={{
        width: 300,
        background: 'var(--bg2)',
        borderLeft: '1px solid var(--border)',
      }}
    >
      {/* Header */}
      <div
        className="flex items-center justify-between px-4 shrink-0"
        style={{ height: 52, borderBottom: '1px solid var(--border)' }}
      >
        <div className="flex items-center gap-2.5">
          <div
            className="flex items-center justify-center rounded-lg"
            style={{
              width: 28, height: 28,
              background: 'linear-gradient(135deg, rgba(79,142,247,0.25) 0%, rgba(124,58,237,0.25) 100%)',
              border: '1px solid rgba(79,142,247,0.3)',
            }}
          >
            <Bot size={14} style={{ color: 'var(--accent)' }} />
          </div>
          <div>
            <div className="font-bold text-sm" style={{ color: 'var(--text)', fontFamily: "'Syne', sans-serif" }}>
              ARIES <span style={{ color: 'var(--accent)' }}>IA</span>
            </div>
            <div className="flex items-center gap-1.5" style={{ fontSize: 10, color: 'var(--text3)' }}>
              <span className="animate-pulse-dot rounded-full inline-block" style={{ width: 5, height: 5, background: 'var(--accent3)' }} />
              En línea
            </div>
          </div>
        </div>
        <button
          onClick={() => setIaOpen(false)}
          className="btn btn-ghost btn-xs"
          style={{ padding: '4px 6px' }}
        >
          <X size={14} />
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-3" style={{ gap: 10, display: 'flex', flexDirection: 'column' }}>
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            {msg.role === 'assistant' && (
              <div
                className="flex items-center justify-center rounded-full shrink-0 mr-2"
                style={{ width: 22, height: 22, background: 'rgba(79,142,247,0.15)', marginTop: 2 }}
              >
                <Sparkles size={11} style={{ color: 'var(--accent)' }} />
              </div>
            )}
            <div style={{ maxWidth: '82%' }}>
              <div
                className="rounded-xl text-sm"
                style={{
                  padding: '8px 11px',
                  background: msg.role === 'user' ? 'var(--accent)' : 'var(--bg3)',
                  color: msg.role === 'user' ? '#fff' : 'var(--text)',
                  lineHeight: 1.55,
                  borderRadius: msg.role === 'user' ? '14px 14px 4px 14px' : '4px 14px 14px 14px',
                }}
              >
                {msg.text}
              </div>
              {msg.time && (
                <div style={{ fontSize: 9, color: 'var(--text3)', marginTop: 3, textAlign: msg.role === 'user' ? 'right' : 'left' }}>
                  {msg.time}
                </div>
              )}
            </div>
          </div>
        ))}

        {loading && (
          <div className="flex justify-start">
            <div
              className="flex items-center justify-center rounded-full shrink-0 mr-2"
              style={{ width: 22, height: 22, background: 'rgba(79,142,247,0.15)', marginTop: 2 }}
            >
              <Sparkles size={11} style={{ color: 'var(--accent)' }} />
            </div>
            <div
              className="rounded-xl text-sm flex items-center gap-1.5"
              style={{ padding: '10px 14px', background: 'var(--bg3)', borderRadius: '4px 14px 14px 14px' }}
            >
              {[0, 150, 300].map((d) => (
                <span
                  key={d}
                  style={{
                    width: 5, height: 5, borderRadius: '50%',
                    background: 'var(--text3)',
                    display: 'inline-block',
                    animation: `pulseDot 1.2s ${d}ms ease-in-out infinite`,
                  }}
                />
              ))}
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="p-3 shrink-0" style={{ borderTop: '1px solid var(--border)' }}>
        <div className="flex gap-2">
          <input
            className="input text-sm flex-1"
            style={{ fontSize: 13 }}
            placeholder="Pregunta algo..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && sendMessage()}
          />
          <button
            onClick={sendMessage}
            disabled={!input.trim() || loading}
            className="btn btn-primary"
            style={{ padding: '8px 12px' }}
          >
            <Send size={14} />
          </button>
        </div>
      </div>
    </div>
  );
}
