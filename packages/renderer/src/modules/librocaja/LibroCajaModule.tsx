import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { BookOpen, ChevronLeft, ChevronRight, Lock } from 'lucide-react';
import toast from 'react-hot-toast';
import { authAPI, libroCajaAPI, LibroCajaDiarioRow } from '../../lib/api';
import { Modal } from '../../components/shared/Modal';

const fmt = (n: number) => n.toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 2 });

const meses = ['ENERO','FEBRERO','MARZO','ABRIL','MAYO','JUNIO','JULIO','AGOSTO','SEPTIEMBRE','OCTUBRE','NOVIEMBRE','DICIEMBRE'];
const COL_COUNT = 9;
const EDIT_SESSION_MS = 5 * 60 * 1000;

function mesActualISO(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

type ManualField = 'target' | 'cambio' | 'total_caja';

function assertLibroSave(res: { success: boolean; error?: string }, fallback: string) {
  if (!res?.success) throw new Error(res?.error || fallback);
}

const EditableCell: React.FC<{
  value: number;
  onSave: (v: number) => Promise<void> | void;
  onRequestEdit: (startEdit: () => void) => void;
}> = ({ value, onSave, onRequestEdit }) => {
  const [editing, setEditing] = useState(false);
  const [val, setVal] = useState('');
  const ref = useRef<HTMLInputElement>(null);
  const committingRef = useRef(false);

  const beginEdit = useCallback(() => {
    setVal(String(value ?? 0));
    setEditing(true);
    requestAnimationFrame(() => {
      ref.current?.focus();
      ref.current?.select();
    });
  }, [value]);

  const commit = useCallback(async () => {
    if (committingRef.current) return;
    committingRef.current = true;
    try {
      const n = parseFloat(String(val).replace(',', '.'));
      setEditing(false);
      if (!isNaN(n) && Math.abs(n - (value ?? 0)) > 0.0001) {
        await onSave(n);
      }
    } catch (err) {
      setEditing(false);
      const msg = err instanceof Error ? err.message : 'No se pudo guardar';
      toast.error(msg);
    } finally {
      committingRef.current = false;
    }
  }, [onSave, val, value]);

  const start = () => {
    onRequestEdit(beginEdit);
  };

  if (editing) {
    return (
      <input
        ref={ref}
        type="number"
        step="0.01"
        value={val}
        onChange={(e) => setVal(e.target.value)}
        onBlur={() => { void commit(); }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            void commit();
          }
          if (e.key === 'Escape') {
            e.preventDefault();
            committingRef.current = false;
            setEditing(false);
          }
        }}
        className="input font-mono text-right w-full"
        style={{ padding: '4px 8px', minWidth: 90 }}
      />
    );
  }

  return (
    <button
      type="button"
      onClick={start}
      className="font-mono text-right w-full"
      style={{
        background: 'transparent',
        border: '1px dashed transparent',
        padding: '4px 8px',
        cursor: 'text',
        color: 'var(--text)',
        borderRadius: 6,
      }}
      title="Clic para editar"
      onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--border)'; }}
      onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.borderColor = 'transparent'; }}
    >
      $ {fmt(value || 0)}
    </button>
  );
};

export const LibroCajaModule: React.FC = () => {
  const [periodo, setPeriodo] = useState<string>(mesActualISO());
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<LibroCajaDiarioRow[]>([]);
  const [editUnlockedUntil, setEditUnlockedUntil] = useState(0);
  const [showAdminModal, setShowAdminModal] = useState(false);
  const [adminPin, setAdminPin] = useState('');
  const [adminChecking, setAdminChecking] = useState(false);
  const pendingEditRef = useRef<(() => void) | null>(null);

  const labelMes = useMemo(() => {
    const [y, m] = periodo.split('-');
    return `${meses[parseInt(m, 10) - 1]} ${y}`;
  }, [periodo]);

  const isEditUnlocked = useCallback(() => Date.now() < editUnlockedUntil, [editUnlockedUntil]);

  const requestEditAccess = useCallback((startEdit: () => void) => {
    if (isEditUnlocked()) {
      startEdit();
      return;
    }
    pendingEditRef.current = startEdit;
    setShowAdminModal(true);
  }, [isEditUnlocked]);

  const closeAdminModal = () => {
    setShowAdminModal(false);
    setAdminPin('');
    pendingEditRef.current = null;
  };

  const handleAdminSubmit = async () => {
    if (!adminPin.trim()) {
      toast.error('Ingresá el PIN de administrador');
      return;
    }
    setAdminChecking(true);
    try {
      const res = await authAPI.validateAdmin(adminPin.trim());
      if (!res.ok) {
        toast.error(res.error || 'PIN de administrador incorrecto');
        return;
      }
      setEditUnlockedUntil(Date.now() + EDIT_SESSION_MS);
      setShowAdminModal(false);
      setAdminPin('');
      const pending = pendingEditRef.current;
      pendingEditRef.current = null;
      pending?.();
      toast.success('Edición habilitada por 5 minutos', { duration: 2000 });
    } finally {
      setAdminChecking(false);
    }
  };

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

  const saveManual = async (fecha: string, field: ManualField, value: number) => {
    const res = await libroCajaAPI.setManual(fecha, { [field]: value });
    assertLibroSave(res, 'Error al guardar valor manual');
    setRows((prev) => prev.map((r) => (r.fecha === fecha ? { ...r, [field]: value } as LibroCajaDiarioRow : r)));
    toast.success('Guardado', { duration: 700 });
  };

  const saveDia = async (
    fecha: string,
    field: 'caja' | 'egresos' | 'gastos_tarjeta',
    value: number,
    rowKey: keyof Pick<LibroCajaDiarioRow, 'caja' | 'egreso' | 'gastos_tarjeta'>,
  ) => {
    const res = await libroCajaAPI.updateDia(fecha, { [field]: value });
    assertLibroSave(res, 'Error al guardar en libro de caja');
    setRows((prev) => prev.map((r) => (r.fecha === fecha ? { ...r, [rowKey]: value } : r)));
    toast.success('Guardado', { duration: 700 });
  };

  const headers = ['Día','Libro','Caja','Egresos','Target','Cambio','Transferencia','Gastos tarjeta','Total en caja'];

  const editUnlockedLabel = isEditUnlocked()
    ? `Edición activa (${Math.max(1, Math.ceil((editUnlockedUntil - Date.now()) / 60000))} min)`
    : null;

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
            Libro = efectivo · Target = débito/crédito/QR (incl. pagos mixtos) · Transferencias = transferencia
          </div>
        </div>
        <div style={{ flex: 1 }} />
        {editUnlockedLabel && (
          <span className="text-xs px-2 py-1 rounded-md" style={{ background: 'rgba(34,197,94,0.15)', color: '#4ade80' }}>
            {editUnlockedLabel}
          </span>
        )}
        <div className="flex items-center gap-2">
          <button className="btn btn-secondary btn-sm" onClick={() => go(-1)} title="Mes anterior">
            <ChevronLeft size={14} />
          </button>
          <button className="btn btn-secondary btn-sm" onClick={() => go(1)} title="Mes siguiente">
            <ChevronRight size={14} />
          </button>
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto px-6 pb-6">
        <div className="rounded-xl overflow-hidden" style={{ background: 'var(--bg2)', border: '1px solid var(--border)' }}>
          <table className="w-full text-sm" style={{ borderCollapse: 'collapse', minWidth: 1080 }}>
            <thead>
              <tr style={{ background: 'var(--bg3)', borderBottom: '1px solid var(--border)' }}>
                {headers.map((h) => (
                  <th key={h} className="table-header" style={{ textAlign: h === 'Día' ? 'left' : 'right' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={COL_COUNT} className="text-center py-10" style={{ color: 'var(--text3)' }}>Cargando…</td></tr>
              ) : rows.map((r) => {
                const day = parseInt(r.fecha.slice(8, 10), 10);
                return (
                  <tr key={r.fecha} className="table-row" style={{ borderBottom: '1px solid var(--border)' }}>
                    <td className="table-cell" style={{ fontWeight: 700, color: 'var(--text)' }}>{day}</td>
                    <td className="table-cell text-right font-mono" style={{ color: 'var(--text)' }} title="Ventas en efectivo (auto)">$ {fmt(r.libro || 0)}</td>
                    <td className="table-cell text-right">
                      <EditableCell value={r.caja || 0} onRequestEdit={requestEditAccess} onSave={(v) => saveDia(r.fecha, 'caja', v, 'caja')} />
                    </td>
                    <td className="table-cell text-right">
                      <EditableCell value={r.egreso || 0} onRequestEdit={requestEditAccess} onSave={(v) => saveDia(r.fecha, 'egresos', v, 'egreso')} />
                    </td>
                    <td className="table-cell text-right" title="Ventas tarjeta/QR (auto; editable manual)">
                      <EditableCell value={r.target || 0} onRequestEdit={requestEditAccess} onSave={(v) => saveManual(r.fecha, 'target', v)} />
                    </td>
                    <td className="table-cell text-right">
                      <EditableCell value={r.cambio ?? 1500} onRequestEdit={requestEditAccess} onSave={(v) => saveManual(r.fecha, 'cambio', v)} />
                    </td>
                    <td className="table-cell text-right font-mono" style={{ color: 'var(--text)' }} title="Ventas por transferencia (auto)">$ {fmt(r.transferencias || 0)}</td>
                    <td className="table-cell text-right">
                      <EditableCell value={r.gastos_tarjeta || 0} onRequestEdit={requestEditAccess} onSave={(v) => saveDia(r.fecha, 'gastos_tarjeta', v, 'gastos_tarjeta')} />
                    </td>
                    <td className="table-cell text-right">
                      <EditableCell value={r.total_caja || 0} onRequestEdit={requestEditAccess} onSave={(v) => saveManual(r.fecha, 'total_caja', v)} />
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

      <Modal
        isOpen={showAdminModal}
        onClose={closeAdminModal}
        title="Autorización de administrador"
        size="sm"
        footer={(
          <>
            <button type="button" className="btn-secondary btn" onClick={closeAdminModal} disabled={adminChecking}>
              Cancelar
            </button>
            <button type="button" className="btn-primary btn" onClick={() => void handleAdminSubmit()} disabled={adminChecking}>
              <Lock size={14} /> {adminChecking ? 'Verificando…' : 'Confirmar'}
            </button>
          </>
        )}
      >
        <p className="text-sm mb-4" style={{ color: 'var(--text2)' }}>
          Ingresá el PIN de un usuario con rol administrador para editar celdas del libro de caja. La edición queda habilitada por 5 minutos.
        </p>
        <label className="label">PIN de administrador</label>
        <input
          type="password"
          className="input font-mono"
          value={adminPin}
          onChange={(e) => setAdminPin(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') void handleAdminSubmit(); }}
          placeholder="••••"
          autoFocus
          disabled={adminChecking}
        />
      </Modal>
    </div>
  );
};
