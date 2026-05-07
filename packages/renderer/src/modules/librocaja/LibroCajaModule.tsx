import React, { useEffect, useMemo, useRef, useState } from 'react';
import { BookOpen, ChevronLeft, ChevronRight } from 'lucide-react';
import toast from 'react-hot-toast';
import { libroCajaAPI, LibroCajaDiarioRow } from '../../lib/api';
import { useAppStore } from '../../store/useAppStore';

const fmt = (n: number) => n.toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 2 });

const meses = ['ENERO','FEBRERO','MARZO','ABRIL','MAYO','JUNIO','JULIO','AGOSTO','SEPTIEMBRE','OCTUBRE','NOVIEMBRE','DICIEMBRE'];

function mesActualISO(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

type EditableField = 'target' | 'cambio' | 'total_caja';

const EditableCell: React.FC<{
  value: number;
  onSave: (v: number) => Promise<void> | void;
  isAdmin: boolean;
}> = ({ value, onSave, isAdmin }) => {
  const [editing, setEditing] = useState(false);
  const [val, setVal] = useState('');
  const ref = useRef<HTMLInputElement>(null);

  const start = () => {
    if (!isAdmin) { toast.error('Solo administradores pueden editar'); return; }
    setVal(String(value ?? 0));
    setEditing(true);
    setTimeout(() => ref.current?.select(), 10);
  };

  const commit = async () => {
    const n = parseFloat(val.replace(',', '.'));
    setEditing(false);
    if (isNaN(n)) return;
    await onSave(n);
  };

  if (editing) {
    return (
      <input
        ref={ref}
        type="number"
        value={val}
        onChange={(e) => setVal(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => { if (e.key === 'Enter') void commit(); if (e.key === 'Escape') setEditing(false); }}
        className="input font-mono text-right"
        style={{ padding: '4px 8px', minWidth: 90 }}
      />
    );
  }

  return (
    <button
      onClick={start}
      className="font-mono text-right w-full"
      style={{
        background: 'transparent',
        border: '1px dashed transparent',
        padding: '4px 8px',
        cursor: isAdmin ? 'text' : 'default',
        color: 'var(--text)',
        borderRadius: 6,
      }}
      title={isAdmin ? 'Clic para editar' : ''}
      onMouseEnter={(e) => { if (isAdmin) (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--border)'; }}
      onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.borderColor = 'transparent'; }}
    >
      $ {fmt(value || 0)}
    </button>
  );
};

export const LibroCajaModule: React.FC = () => {
  const { currentUser } = useAppStore();
  const isAdmin = currentUser?.rol === 'admin';

  const [periodo, setPeriodo] = useState<string>(mesActualISO());
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<LibroCajaDiarioRow[]>([]);

  const labelMes = useMemo(() => {
    const [y, m] = periodo.split('-');
    return `${meses[parseInt(m, 10) - 1]} ${y}`;
  }, [periodo]);

  const load = async () => {
    setLoading(true);
    try {
      const r = await libroCajaAPI.getDiarioMes(periodo);
      setRows(Array.isArray(r) ? r : []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, [periodo]);

  const tot = useMemo(() => rows.reduce((a, r) => ({
    libro: a.libro + (r.libro || 0),
    caja: a.caja + (r.caja || 0),
    egreso: a.egreso + (r.egreso || 0),
    target: a.target + (r.target || 0),
    cambio: a.cambio + (r.cambio || 0),
    transferencias: a.transferencias + (r.transferencias || 0),
    gastos_tarjeta: a.gastos_tarjeta + (r.gastos_tarjeta || 0),
    total_caja: a.total_caja + (r.total_caja || 0),
  }), { libro: 0, caja: 0, egreso: 0, target: 0, cambio: 0, transferencias: 0, gastos_tarjeta: 0, total_caja: 0 }), [rows]);

  const go = (delta: number) => {
    const d = new Date(`${periodo}-01T12:00:00`);
    d.setMonth(d.getMonth() + delta);
    const p = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    setPeriodo(p);
  };

  const saveManual = async (fecha: string, field: EditableField, value: number) => {
    await libroCajaAPI.setManual(fecha, { [field]: value } as any);
    setRows((prev) => prev.map((r) => (r.fecha === fecha ? { ...r, [field]: value } as any : r)));
    toast.success('Guardado', { duration: 700 });
  };

  return (
    <div className="flex flex-col h-full" style={{ background: 'var(--bg)' }}>
      <div className="shrink-0 px-6 pt-6 pb-4 flex items-center gap-3">
        <div style={{
          width: 34, height: 34, borderRadius: 9, display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: 'linear-gradient(135deg, #22c55e 0%, #16a34a 100%)',
        }}>
          <BookOpen size={17} style={{ color: 'white' }} />
        </div>
        <div>
          <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--text)', fontFamily: "'Syne', sans-serif" }}>
            Libro de Caja — {labelMes}
          </div>
          <div style={{ fontSize: 11, color: 'var(--text3)' }}>
            Una fila por día · Totales al final
          </div>
        </div>
        <div style={{ flex: 1 }} />
        <div className="flex items-center gap-2">
          <button className="btn btn-secondary btn-sm" onClick={() => go(-1)} title="Mes anterior">
            <ChevronLeft size={14} />
          </button>
          <button className="btn btn-secondary btn-sm" onClick={() => go(1)} title="Mes siguiente">
            <ChevronRight size={14} />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-auto px-6 pb-6">
        <div className="rounded-xl overflow-hidden" style={{ background: 'var(--bg2)', border: '1px solid var(--border)' }}>
          <table className="w-full text-sm" style={{ borderCollapse: 'collapse', minWidth: 1040 }}>
            <thead>
              <tr style={{ background: 'var(--bg3)', borderBottom: '1px solid var(--border)' }}>
                {['Día','Libro','Caja','Egreso','Target','Cambio','Transferencias','Gastos tarjeta','Total en caja'].map((h) => (
                  <th key={h} className="table-header" style={{ textAlign: h === 'Día' ? 'left' : 'right' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={9} className="text-center py-10" style={{ color: 'var(--text3)' }}>Cargando…</td></tr>
              ) : rows.map((r) => {
                const day = parseInt(r.fecha.slice(8, 10), 10);
                return (
                  <tr key={r.fecha} className="table-row" style={{ borderBottom: '1px solid var(--border)' }}>
                    <td className="table-cell" style={{ fontWeight: 700, color: 'var(--text)' }}>{day}</td>
                    <td className="table-cell text-right font-mono" style={{ color: 'var(--text)' }}>$ {fmt(r.libro || 0)}</td>
                    <td className="table-cell text-right font-mono" style={{ color: 'var(--text)' }}>$ {fmt(r.caja || 0)}</td>
                    <td className="table-cell text-right font-mono" style={{ color: '#ef4444' }}>$ {fmt(r.egreso || 0)}</td>
                    <td className="table-cell text-right">
                      <EditableCell value={r.target || 0} isAdmin={isAdmin} onSave={(v) => saveManual(r.fecha, 'target', v)} />
                    </td>
                    <td className="table-cell text-right">
                      <EditableCell value={r.cambio ?? 1500} isAdmin={isAdmin} onSave={(v) => saveManual(r.fecha, 'cambio', v)} />
                    </td>
                    <td className="table-cell text-right font-mono" style={{ color: 'var(--text)' }}>$ {fmt(r.transferencias || 0)}</td>
                    <td className="table-cell text-right font-mono" style={{ color: 'var(--text)' }}>$ {fmt(r.gastos_tarjeta || 0)}</td>
                    <td className="table-cell text-right">
                      <EditableCell value={r.total_caja || 0} isAdmin={isAdmin} onSave={(v) => saveManual(r.fecha, 'total_caja', v)} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
            {!loading && rows.length > 0 && (
              <tfoot>
                <tr style={{ background: 'var(--bg3)', borderTop: '2px solid var(--border)' }}>
                  <td className="table-cell" style={{ fontWeight: 800, color: 'var(--text)' }}>TOTALES</td>
                  <td className="table-cell text-right font-mono font-bold">$ {fmt(tot.libro)}</td>
                  <td className="table-cell text-right font-mono font-bold">$ {fmt(tot.caja)}</td>
                  <td className="table-cell text-right font-mono font-bold" style={{ color: '#ef4444' }}>$ {fmt(tot.egreso)}</td>
                  <td className="table-cell text-right font-mono font-bold">$ {fmt(tot.target)}</td>
                  <td className="table-cell text-right font-mono font-bold">$ {fmt(tot.cambio)}</td>
                  <td className="table-cell text-right font-mono font-bold">$ {fmt(tot.transferencias)}</td>
                  <td className="table-cell text-right font-mono font-bold">$ {fmt(tot.gastos_tarjeta)}</td>
                  <td className="table-cell text-right font-mono font-bold">$ {fmt(tot.total_caja)}</td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>
    </div>
  );
};
