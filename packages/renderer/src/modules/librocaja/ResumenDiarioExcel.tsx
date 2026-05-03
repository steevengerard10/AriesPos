import React, { useEffect, useMemo, useState } from 'react';
import { cajaAPI } from '../../lib/api';
import { formatCurrency } from '../../lib/utils';
import toast from 'react-hot-toast';

interface CajaMovimiento {
  id: number;
  tipo: 'ingreso' | 'egreso';
  monto: number;
  metodo_pago: string;
}

interface ResumenDiario {
  fecha: string;
  libro: number;
  caja: number;
  egresos: number;
  tarjeta: number;
  cambio: number;
  transferencias: number;
  gastos_tarjeta: number;
  total_caja: number;
  total_transferencia: number;
}

const fmt = (n: number) =>
  n.toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 2 });

interface EditableCellProps {
  value: number;
  onSave: (v: number) => void;
  readOnly?: boolean;
  highlight?: boolean;
}

const EditableCell: React.FC<EditableCellProps> = ({ value, onSave, readOnly = false, highlight = false }) => {
  const [editing, setEditing] = useState(false);
  const [inputVal, setInputVal] = useState('');
  const inputRef = React.useRef<HTMLInputElement>(null);

  const startEdit = () => {
    if (readOnly) return;
    setInputVal(String(value));
    setEditing(true);
    setTimeout(() => inputRef.current?.select(), 10);
  };

  const commit = () => {
    const n = parseFloat(inputVal.replace(',', '.'));
    if (!isNaN(n)) onSave(n);
    setEditing(false);
  };

  if (editing) {
    return (
      <input
        ref={inputRef}
        type="number"
        value={inputVal}
        onChange={(e) => setInputVal(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') commit();
          if (e.key === 'Escape') setEditing(false);
        }}
        style={{
          width: '100%',
          background: 'var(--bg)',
          border: '2px solid var(--accent)',
          borderRadius: 4,
          padding: '4px 8px',
          color: 'var(--text)',
          fontSize: 13,
          fontWeight: 800,
          fontFamily: "'Syne', sans-serif",
          outline: 'none',
          textAlign: 'right',
        }}
      />
    );
  }

  return (
    <div
      onDoubleClick={startEdit}
      onClick={!readOnly ? startEdit : undefined}
      title={readOnly ? '' : 'Doble-clic para editar'}
      style={{
        padding: '6px 8px',
        cursor: readOnly ? 'default' : 'text',
        background: highlight ? 'rgba(79,142,247,0.1)' : 'transparent',
        borderRadius: 4,
        fontSize: 13,
        fontWeight: 800,
        fontFamily: "'Syne', sans-serif",
        border: !readOnly ? '1px dashed rgba(79,142,247,0.3)' : '1px solid transparent',
        userSelect: 'none',
        transition: 'all 0.15s',
      }}
      onMouseEnter={(e) => {
        if (!readOnly) (e.currentTarget as HTMLDivElement).style.borderColor = 'var(--accent)';
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLDivElement).style.borderColor = 'rgba(79,142,247,0.3)';
      }}
    >
      $ {fmt(value)}
    </div>
  );
};

export const ResumenDiarioExcel: React.FC = () => {
  const [sesionActiva, setSesionActiva] = useState<{ id: number } | null>(null);
  const [movimientos, setMovimientos] = useState<CajaMovimiento[]>([]);
  const [loading, setLoading] = useState(true);
  const [resumen, setResumen] = useState<ResumenDiario>({
    fecha: new Date().toISOString().split('T')[0],
    libro: 0,
    caja: 0,
    egresos: 0,
    tarjeta: 0,
    cambio: 1500,
    transferencias: 0,
    gastos_tarjeta: 0,
    total_caja: 0,
    total_transferencia: 0,
  });

  const loadData = async () => {
    setLoading(true);
    try {
      let sesion = await cajaAPI.getSesionActiva() as { id: number } | null;
      if (!sesion) {
        const hist = await cajaAPI.getHistorico() as Array<{ id: number; fecha_apertura?: string }>;
        const hoy = new Date().toISOString().split('T')[0];
        sesion = (hist || []).find((x) => String(x.fecha_apertura || '').slice(0, 10) === hoy) || null;
      }
      setSesionActiva(sesion);

      if (sesion?.id) {
        const movs = await cajaAPI.getMovimientos(sesion.id) as CajaMovimiento[];
        setMovimientos(Array.isArray(movs) ? movs : []);

        // Auto-completar resumen desde movimientos
        const ingresosTarjeta = movs
          .filter((m) => m.tipo === 'ingreso' && ['tarjeta_credito', 'tarjeta_debito', 'qr'].includes(m.metodo_pago))
          .reduce((s, m) => s + (m.monto || 0), 0);

        const ingresosTransf = movs
          .filter((m) => m.tipo === 'ingreso' && m.metodo_pago === 'transferencia')
          .reduce((s, m) => s + (m.monto || 0), 0);

        const egresosTotal = movs
          .filter((m) => m.tipo === 'egreso')
          .reduce((s, m) => s + (m.monto || 0), 0);

        const egresosTarjeta = movs
          .filter((m) => m.tipo === 'egreso' && ['tarjeta_credito', 'tarjeta_debito', 'transferencia'].includes(m.metodo_pago))
          .reduce((s, m) => s + (m.monto || 0), 0);

        setResumen((prev) => ({
          ...prev,
          tarjeta: ingresosTarjeta,
          transferencias: ingresosTransf,
          egresos: egresosTotal,
          gastos_tarjeta: egresosTarjeta,
        }));
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleSave = (field: keyof ResumenDiario, value: number) => {
    setResumen((prev) => ({
      ...prev,
      [field]: value,
    }));
    toast.success('Actualizado');
  };

  const totalCaja = resumen.caja - resumen.egresos;
  const totalTransf = resumen.tarjeta + resumen.transferencias - resumen.gastos_tarjeta;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div
        style={{
          padding: '14px 16px',
          background: 'var(--bg2)',
          border: '1px solid var(--border)',
          borderRadius: 10,
        }}
      >
        <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--text)', fontFamily: "'Syne', sans-serif" }}>
          Resumen Diario (Estilo Excel)
        </div>
        <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 4 }}>
          Sincronizado con Caja · Doble-clic para editar
        </div>
      </div>

      {loading ? (
        <div style={{ padding: 16, color: 'var(--text3)', textAlign: 'center' }}>Cargando datos de caja...</div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table
            style={{
              width: '100%',
              borderCollapse: 'collapse',
              background: 'var(--bg2)',
              border: '1px solid var(--border)',
              borderRadius: 8,
            }}
          >
            <thead>
              <tr style={{ background: 'var(--bg3)' }}>
                <th style={{ padding: '10px 12px', textAlign: 'left', fontSize: 11, fontWeight: 800, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                  Concepto
                </th>
                <th style={{ padding: '10px 12px', textAlign: 'right', fontSize: 11, fontWeight: 800, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                  Monto
                </th>
                <th style={{ padding: '10px 12px', textAlign: 'left', fontSize: 10, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                  Descripción
                </th>
              </tr>
            </thead>
            <tbody>
              {/* Libro */}
              <tr style={{ borderTop: '1px solid var(--border)' }}>
                <td style={{ padding: '12px', fontWeight: 700, color: '#8b5cf6' }}>Libro</td>
                <td style={{ padding: '12px', textAlign: 'right' }}>
                  <EditableCell value={resumen.libro} onSave={(v) => handleSave('libro', v)} />
                </td>
                <td style={{ padding: '12px', fontSize: 12, color: 'var(--text3)' }}>Saldo según libro contable</td>
              </tr>

              {/* Caja */}
              <tr style={{ borderTop: '1px solid var(--border)' }}>
                <td style={{ padding: '12px', fontWeight: 700, color: '#22c55e' }}>Caja</td>
                <td style={{ padding: '12px', textAlign: 'right' }}>
                  <EditableCell value={resumen.caja} onSave={(v) => handleSave('caja', v)} highlight />
                </td>
                <td style={{ padding: '12px', fontSize: 12, color: 'var(--text3)' }}>Efectivo real en caja (editable)</td>
              </tr>

              {/* Egresos */}
              <tr style={{ borderTop: '1px solid var(--border)' }}>
                <td style={{ padding: '12px', fontWeight: 700, color: '#ef4444' }}>Egresos</td>
                <td style={{ padding: '12px', textAlign: 'right' }}>
                  <EditableCell value={resumen.egresos} onSave={(v) => handleSave('egresos', v)} readOnly />
                </td>
                <td style={{ padding: '12px', fontSize: 12, color: 'var(--text3)' }}>Suma de egresos rápidos (auto)</td>
              </tr>

              {/* Tarjeta */}
              <tr style={{ borderTop: '1px solid var(--border)' }}>
                <td style={{ padding: '12px', fontWeight: 700, color: '#3b82f6' }}>Tarjeta</td>
                <td style={{ padding: '12px', textAlign: 'right' }}>
                  <EditableCell value={resumen.tarjeta} onSave={(v) => handleSave('tarjeta', v)} readOnly />
                </td>
                <td style={{ padding: '12px', fontSize: 12, color: 'var(--text3)' }}>Ingresos con tarjeta débito/crédito/QR (auto)</td>
              </tr>

              {/* Cambio */}
              <tr style={{ borderTop: '1px solid var(--border)' }}>
                <td style={{ padding: '12px', fontWeight: 700, color: '#f59e0b' }}>Cambio</td>
                <td style={{ padding: '12px', textAlign: 'right' }}>
                  <EditableCell value={resumen.cambio} onSave={(v) => handleSave('cambio', v)} />
                </td>
                <td style={{ padding: '12px', fontSize: 12, color: 'var(--text3)' }}>Fondo de cambio (default $1.500)</td>
              </tr>

              {/* Transferencias */}
              <tr style={{ borderTop: '1px solid var(--border)' }}>
                <td style={{ padding: '12px', fontWeight: 700, color: '#06b6d4' }}>Transferencias</td>
                <td style={{ padding: '12px', textAlign: 'right' }}>
                  <EditableCell value={resumen.transferencias} onSave={(v) => handleSave('transferencias', v)} readOnly />
                </td>
                <td style={{ padding: '12px', fontSize: 12, color: 'var(--text3)' }}>Ingresos por transferencia bancaria (auto)</td>
              </tr>

              {/* Gastos con Tarjeta */}
              <tr style={{ borderTop: '1px solid var(--border)' }}>
                <td style={{ padding: '12px', fontWeight: 700, color: '#f97316' }}>Gastos Tarjeta</td>
                <td style={{ padding: '12px', textAlign: 'right' }}>
                  <EditableCell value={resumen.gastos_tarjeta} onSave={(v) => handleSave('gastos_tarjeta', v)} readOnly />
                </td>
                <td style={{ padding: '12px', fontSize: 12, color: 'var(--text3)' }}>Egresos con tarjeta/transf (auto)</td>
              </tr>

              {/* Separador visual */}
              <tr style={{ borderTop: '2px solid var(--accent)' }}>
                <td colSpan={3} style={{ height: 2 }}></td>
              </tr>

              {/* Total en Caja */}
              <tr style={{ background: 'rgba(34,197,94,0.08)' }}>
                <td style={{ padding: '12px', fontWeight: 800, color: '#22c55e', fontSize: 14 }}>Total en Caja</td>
                <td style={{ padding: '12px', textAlign: 'right' }}>
                  <EditableCell value={totalCaja} onSave={(v) => handleSave('total_caja', v)} highlight />
                </td>
                <td style={{ padding: '12px', fontSize: 12, color: 'var(--text3)' }}>Caja − Egresos (resultado)</td>
              </tr>

              {/* Total en Transferencia */}
              <tr style={{ background: 'rgba(6,182,212,0.08)' }}>
                <td style={{ padding: '12px', fontWeight: 800, color: '#06b6d4', fontSize: 14 }}>Total Transferencia</td>
                <td style={{ padding: '12px', textAlign: 'right' }}>
                  <EditableCell value={totalTransf} onSave={(v) => handleSave('total_transferencia', v)} highlight />
                </td>
                <td style={{ padding: '12px', fontSize: 12, color: 'var(--text3)' }}>Tarjeta + Transf. − Gs. (resultado)</td>
              </tr>
            </tbody>
          </table>
        </div>
      )}

      {/* Botones de acción */}
      <div style={{ display: 'flex', gap: 10 }}>
        <button
          onClick={loadData}
          style={{
            padding: '8px 16px',
            background: 'var(--accent)',
            color: 'white',
            border: 'none',
            borderRadius: 6,
            fontSize: 13,
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          Sincronizar desde Caja
        </button>
      </div>
    </div>
  );
};
