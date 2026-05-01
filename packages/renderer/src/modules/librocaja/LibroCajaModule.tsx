import React, { useEffect, useState, useRef, useCallback } from 'react';
import {
  BookOpen, RefreshCw, Plus, Lock, Unlock,
  ChevronLeft, ChevronRight, Calendar, Banknote, Table2,
  Loader2, FileSpreadsheet, Archive, LockKeyhole, LockKeyholeOpen,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { useLibroCajaStore } from '../../store/useLibroCajaStore';
import { LibroCajaDia } from '../../lib/api';
import { appAPI, cajaAPI } from '../../lib/api';
import { useAppStore } from '../../store/useAppStore';

// ── Utilidades ──────────────────────────────────────────────────────────────
const fmt = (n: number) =>
  n.toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 2 });

const fmtFecha = (fecha: string) => {
  const [y, m, d] = fecha.split('-');
  return `${d}/${m}/${y}`;
};

function hoyISO() {
  return new Date().toISOString().split('T')[0];
}

// ── Libro de Caja (Día actual) — basado en caja_movimientos ──────────────────
type CajaMovimiento = {
  id: number;
  tipo: 'ingreso' | 'egreso';
  monto: number;
  descripcion: string;
  metodo_pago: string;
  venta_id?: number | null;
  venta_numero?: string | null;
  fecha: string;
};

const LibroCajaHoy: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [sesion, setSesion] = useState<{ id: number } | null>(null);
  const [movs, setMovs] = useState<CajaMovimiento[]>([]);

  const load = async () => {
    setLoading(true);
    try {
      // 1) Preferir sesión activa
      let s = await cajaAPI.getSesionActiva() as { id: number } | null;
      // 2) Si no hay sesión activa, tomar la última sesión del día (si existe)
      if (!s) {
        const hist = await cajaAPI.getHistorico() as Array<{ id: number; fecha_apertura?: string }>;
        const hoy = hoyISO();
        s = (hist || []).find((x) => String(x.fecha_apertura || '').slice(0, 10) === hoy) || null;
      }
      setSesion(s);
      if (!s?.id) { setMovs([]); return; }
      const rows = await cajaAPI.getMovimientos(s.id) as CajaMovimiento[];
      setMovs(Array.isArray(rows) ? rows : []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, []);

  const ingresos = movs.filter(m => m.tipo === 'ingreso').reduce((s, m) => s + (m.monto || 0), 0);
  const egresos  = movs.filter(m => m.tipo === 'egreso').reduce((s, m) => s + (m.monto || 0), 0);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 10 }}>
        <div style={{ fontWeight: 800, color: 'var(--text)', fontFamily: "'Syne', sans-serif" }}>
          Libro del día (apertura → cierre)
        </div>
        <div style={{ flex: 1 }} />
        <button
          onClick={load}
          className="btn btn-secondary btn-sm"
        >
          Actualizar
        </button>
      </div>

      {!sesion?.id && !loading && (
        <div style={{ padding: 18, color: 'var(--text3)', background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 10 }}>
          No hay caja abierta ni sesiones registradas para hoy.
        </div>
      )}

      {loading ? (
        <div style={{ padding: 18, color: 'var(--text3)' }}>Cargando…</div>
      ) : (
        <>
          {sesion?.id && (
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              <div style={{ padding: '10px 14px', background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 10 }}>
                <div style={{ fontSize: 11, color: 'var(--text3)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Ingresos</div>
                <div style={{ fontSize: 18, fontWeight: 800, color: '#22c55e', fontFamily: "'Syne', sans-serif" }}>$ {fmt(ingresos)}</div>
              </div>
              <div style={{ padding: '10px 14px', background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 10 }}>
                <div style={{ fontSize: 11, color: 'var(--text3)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Egresos</div>
                <div style={{ fontSize: 18, fontWeight: 800, color: '#ef4444', fontFamily: "'Syne', sans-serif" }}>$ {fmt(egresos)}</div>
              </div>
              <div style={{ padding: '10px 14px', background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 10 }}>
                <div style={{ fontSize: 11, color: 'var(--text3)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Neto</div>
                <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--text)', fontFamily: "'Syne', sans-serif" }}>$ {fmt(ingresos - egresos)}</div>
              </div>
            </div>
          )}

          <div style={{ border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden', background: 'var(--bg2)' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: 'var(--bg3)' }}>
                  <th style={{ padding: '10px 12px', textAlign: 'left', fontSize: 11, fontWeight: 800, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Concepto</th>
                  <th style={{ padding: '10px 12px', textAlign: 'right', fontSize: 11, fontWeight: 800, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Monto</th>
                  <th style={{ padding: '10px 12px', textAlign: 'center', fontSize: 11, fontWeight: 800, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Tipo</th>
                </tr>
              </thead>
              <tbody>
                {movs.length === 0 ? (
                  <tr>
                    <td colSpan={3} style={{ padding: 16, textAlign: 'center', color: 'var(--text3)' }}>Sin movimientos</td>
                  </tr>
                ) : (
                  movs.map((m) => (
                    <tr key={m.id} style={{ borderTop: '1px solid var(--border)' }}>
                      <td style={{ padding: '10px 12px', color: 'var(--text2)' }}>
                        {m.descripcion || (m.venta_numero ? `Venta #${m.venta_numero}` : '—')}
                      </td>
                      <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 800, color: m.tipo === 'ingreso' ? '#22c55e' : '#ef4444', fontFamily: "'Syne', sans-serif" }}>
                        $ {fmt(m.monto || 0)}
                      </td>
                      <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                        <span style={{
                          fontSize: 11, fontWeight: 800, padding: '2px 10px', borderRadius: 999,
                          background: m.tipo === 'ingreso' ? 'rgba(34,197,94,0.12)' : 'rgba(239,68,68,0.12)',
                          color: m.tipo === 'ingreso' ? '#22c55e' : '#ef4444',
                          textTransform: 'uppercase',
                        }}>
                          {m.tipo}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
};

/** Efectivo: caja cobrada menos egresos en efectivo */
function calcTotalCaja(d: LibroCajaDia | null) {
  if (!d) return 0;
  return (d.caja || 0) - (d.egresos || 0);
}

/** Digital: tarjetas + transferencias − gastos pagados con tarjeta/transf */
function calcTotalTransf(d: LibroCajaDia | null) {
  if (!d) return 0;
  return (d.tarjetas || 0) + (d.transferencias || 0) - (d.gastos_tarjeta || 0);
}

// Denominaciones de billetes ARG
const DENOMINACIONES = [20000, 10000, 5000, 2000, 1000, 500, 200, 100, 50, 20, 10];

// ── Celda editable ──────────────────────────────────────────────────────────
interface EditableCellProps {
  value: number;
  onSave: (v: number) => void;
  highlight?: boolean;
  readOnly?: boolean;
  isAdmin?: boolean;
  prefix?: string;
  colorVal?: string;
}

const EditableCell: React.FC<EditableCellProps> = ({ value, onSave, highlight, readOnly, isAdmin = true, prefix = '$', colorVal }) => {
  const [editing, setEditing] = useState(false);
  const [inputVal, setInputVal] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const startEdit = () => {
    if (readOnly) return;
    if (!isAdmin) { toast.error('Solo administradores pueden editar'); return; }
    setInputVal(String(value));
    setEditing(true);
    setTimeout(() => { inputRef.current?.select(); }, 10);
  };

  const commit = () => {
    const n = parseFloat(inputVal.replace(',', '.'));
    if (!isNaN(n)) onSave(n);
    setEditing(false);
  };

  const cancel = () => setEditing(false);

  if (editing) {
    return (
      <input
        ref={inputRef}
        type="number"
        value={inputVal}
        onChange={e => setInputVal(e.target.value)}
        onBlur={commit}
        onKeyDown={e => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') cancel(); }}
        style={{
          width: '100%', background: 'var(--bg)', border: '1px solid var(--accent)',
          borderRadius: 4, padding: '2px 6px', color: 'var(--text)', fontSize: 13,
          fontFamily: "'Syne', sans-serif", outline: 'none',
        }}
        className="tabular-nums"
      />
    );
  }

  return (
    <div
      onDoubleClick={startEdit}
      onClick={!readOnly && isAdmin ? startEdit : undefined}
      title={readOnly ? '' : isAdmin ? 'Clic para editar' : 'Solo admins pueden editar'}
      style={{
        padding: '4px 6px', borderRadius: 4,
        cursor: readOnly ? 'default' : isAdmin ? 'text' : 'not-allowed',
        background: highlight ? 'rgba(79,142,247,0.08)' : 'transparent',
        color: value > 0 ? (colorVal || 'var(--text)') : 'var(--text3)',
        fontSize: 13, fontFamily: "'Syne', sans-serif", userSelect: 'none',
        transition: 'background 0.15s', outline: 'none',
        border: !readOnly && isAdmin ? '1px dashed transparent' : '1px solid transparent',
      }}
      onMouseEnter={e => { if (!readOnly && isAdmin) (e.currentTarget as HTMLDivElement).style.borderColor = 'var(--border)'; }}
      onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.borderColor = 'transparent'; }}
    >
      {prefix} {fmt(value)}
    </div>
  );
};

// Colores por columna para estilo Excel
const COL_COLORS: Record<string, string> = {
  libro:          '#8b5cf6',
  caja:           '#22c55e',
  egresos:        '#ef4444',
  tarjetas:       '#3b82f6',
  cambio:         '#f59e0b',
  transferencias: '#06b6d4',
  gastos_tarjeta: '#f97316',
};

// ── Tabla histórico ─────────────────────────────────────────────────────────
const COLS = [
  { key: 'fecha',          label: 'Fecha',            editable: false },
  { key: 'libro',          label: 'Libro',             editable: true  },
  { key: 'caja',           label: 'Caja',              editable: true  },
  { key: 'egresos',        label: 'Egresos',           editable: true  },
  { key: 'tarjetas',       label: 'Tarjetas',          editable: true  },
  { key: 'cambio',         label: 'Cambio',            editable: true  },
  { key: 'transferencias', label: 'Transferencias',    editable: true  },
  { key: 'gastos_tarjeta', label: 'Gs. Tarjeta',       editable: true  },
  { key: '_total_caja',    label: 'Total en Caja',     editable: false },
  { key: '_total_transf',  label: 'Total Transf.',     editable: false },
];

const TablaHistorico: React.FC = () => {
  const {
    historico, cargarHistorico, cargarPeriodos, actualizarCampoPorFecha,
    fechaSeleccionada, setFecha, syncDesdeVentas, loadingSync,
    exportarExcel, periodos, periodoActual, setPeriodo, cerrarMes, reabrirMes,
  } = useLibroCajaStore();
  const { currentUser } = useAppStore();
  const isAdmin = currentUser?.rol === 'admin';
  const [exporting, setExporting] = useState(false);
  const [exportDesde, setExportDesde] = useState('');
  const [exportHasta, setExportHasta] = useState('');
  const [showExport, setShowExport] = useState(false);
  const [confirmCerrar, setConfirmCerrar] = useState(false);

  useEffect(() => {
    cargarPeriodos();
    cargarHistorico();
  }, []);

  // Nombre legible del periodo
  const periodoLabel = (p: string) => {
    const [y, m] = p.split('-');
    const meses = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
    return `${meses[parseInt(m, 10) - 1]} ${y}`;
  };

  const periodoInfo = periodos.find(p => p.periodo === periodoActual);
  const mesActualStr = (() => { const n = new Date(); return `${n.getFullYear()}-${String(n.getMonth()+1).padStart(2,'0')}`; })();
  const esMesCerrado = periodoInfo?.estado === 'cerrado';

  // Navegar entre periodos disponibles
  const periodosOrdenados = [...periodos].sort((a, b) => b.periodo.localeCompare(a.periodo));
  const idx = periodosOrdenados.findIndex(p => p.periodo === periodoActual);
  const puedePrevio = idx < periodosOrdenados.length - 1;
  const puedeNext = idx > 0;

  const irAPeriodo = (p: string) => {
    setPeriodo(p);
  };

  const handleCerrarMes = async () => {
    await cerrarMes(periodoActual);
    setConfirmCerrar(false);
    toast.success(`Mes ${periodoLabel(periodoActual)} cerrado`);
  };

  const handleReoabrirMes = async () => {
    await reabrirMes(periodoActual);
    toast.success(`Mes ${periodoLabel(periodoActual)} reabierto`);
  };

  // Edición inline directa por fecha — sin race condition
  const handleEdit = async (fecha: string, campo: keyof LibroCajaDia, valor: number) => {
    await actualizarCampoPorFecha(fecha, campo, valor);
    toast.success('Guardado', { duration: 800 });
  };

  const handleExport = async () => {
    if (!exportDesde || !exportHasta) { toast.error('Seleccioná rango de fechas'); return; }
    setExporting(true);
    try {
      const r = await exportarExcel(exportDesde, exportHasta);
      if (r.success && r.path) {
        toast.success(`Excel guardado: ${r.path.split('\\').pop()}`);
        // Abrir carpeta
        await appAPI.openDirectory?.();
      } else {
        toast.error(r.error || 'Error al exportar');
      }
    } finally {
      setExporting(false);
      setShowExport(false);
    }
  };

  // Calcular totales de columna
  const totales = historico.reduce((acc, d) => ({
    libro:          acc.libro          + (d.libro          || 0),
    caja:           acc.caja           + (d.caja           || 0),
    egresos:        acc.egresos        + (d.egresos        || 0),
    tarjetas:       acc.tarjetas       + (d.tarjetas       || 0),
    cambio:         acc.cambio         + (d.cambio         || 0),
    transferencias: acc.transferencias + (d.transferencias || 0),
    gastos_tarjeta: acc.gastos_tarjeta + (d.gastos_tarjeta || 0),
  }), { libro: 0, caja: 0, egresos: 0, tarjetas: 0, cambio: 0, transferencias: 0, gastos_tarjeta: 0 });

  const [nuevaFecha, setNuevaFecha] = useState('');
  const [showNueva, setShowNueva] = useState(false);

  const crearEntrada = async () => {
    if (!nuevaFecha) { toast.error('Seleccioná una fecha'); return; }
    await actualizarCampoPorFecha(nuevaFecha, 'cambio', 1500);
    await cargarHistorico();
    setFecha(nuevaFecha);
    setNuevaFecha('');
    setShowNueva(false);
    toast.success('Entrada creada — hacé clic en las celdas para editar');
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, height: '100%' }}>
      {/* Navegador mensual */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', background: 'var(--bg2)', borderRadius: 10, border: '1px solid var(--border)' }}>
        <button
          onClick={() => puedePrevio && irAPeriodo(periodosOrdenados[idx + 1].periodo)}
          disabled={!puedePrevio}
          style={{ background: 'none', border: '1px solid var(--border)', borderRadius: 6, padding: '4px 8px', color: puedePrevio ? 'var(--text2)' : 'var(--text3)', cursor: puedePrevio ? 'pointer' : 'default' }}
        >
          <ChevronLeft size={16} />
        </button>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1, justifyContent: 'center' }}>
          <Archive size={16} style={{ color: esMesCerrado ? '#ef4444' : '#22c55e' }} />
          <span style={{ fontWeight: 700, fontSize: 15, color: 'var(--text)' }}>
            {periodoLabel(periodoActual)}
          </span>
          <span style={{
            fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 20,
            background: esMesCerrado ? 'rgba(239,68,68,0.15)' : 'rgba(34,197,94,0.15)',
            color: esMesCerrado ? '#ef4444' : '#22c55e',
          }}>
            {esMesCerrado ? 'CERRADO' : 'ABIERTO'}
          </span>
          {periodoActual === mesActualStr && (
            <span style={{ fontSize: 10, padding: '1px 6px', borderRadius: 10, background: 'rgba(79,142,247,0.15)', color: 'var(--accent)' }}>
              Mes actual
            </span>
          )}
        </div>

        <button
          onClick={() => puedeNext && irAPeriodo(periodosOrdenados[idx - 1].periodo)}
          disabled={!puedeNext}
          style={{ background: 'none', border: '1px solid var(--border)', borderRadius: 6, padding: '4px 8px', color: puedeNext ? 'var(--text2)' : 'var(--text3)', cursor: puedeNext ? 'pointer' : 'default' }}
        >
          <ChevronRight size={16} />
        </button>

        {/* Selector rápido de mes */}
        <select
          value={periodoActual}
          onChange={e => irAPeriodo(e.target.value)}
          style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 6, padding: '4px 8px', color: 'var(--text)', fontSize: 12 }}
        >
          {periodosOrdenados.map(p => (
            <option key={p.periodo} value={p.periodo}>
              {periodoLabel(p.periodo)} {p.estado === 'cerrado' ? '🔒' : ''}
            </option>
          ))}
        </select>

        {/* Botones cerrar/reabrir mes */}
        {isAdmin && !esMesCerrado && (
          confirmCerrar ? (
            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              <span style={{ fontSize: 12, color: '#f59e0b' }}>¿Confirmar cierre?</span>
              <button onClick={handleCerrarMes} style={{ padding: '4px 10px', background: '#ef4444', border: 'none', borderRadius: 6, color: 'white', fontSize: 12, cursor: 'pointer' }}>
                Sí, cerrar
              </button>
              <button onClick={() => setConfirmCerrar(false)} style={{ padding: '4px 10px', background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 6, color: 'var(--text2)', fontSize: 12, cursor: 'pointer' }}>
                Cancelar
              </button>
            </div>
          ) : (
            <button
              onClick={() => setConfirmCerrar(true)}
              style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '5px 12px', background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.35)', borderRadius: 8, color: '#ef4444', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}
            >
              <LockKeyhole size={13} /> Cerrar mes
            </button>
          )
        )}
        {isAdmin && esMesCerrado && (
          <button
            onClick={handleReoabrirMes}
            style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '5px 12px', background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.3)', borderRadius: 8, color: '#22c55e', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}
          >
            <LockKeyholeOpen size={13} /> Reabrir mes
          </button>
        )}
      </div>

      {/* Toolbar */}
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
        <button
          onClick={() => { setFecha(hoyISO()); cargarHistorico(); }}
          style={{
            display: 'flex', alignItems: 'center', gap: 6, padding: '6px 14px',
            background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 8,
            color: 'var(--text2)', fontSize: 13, cursor: 'pointer',
          }}
        >
          <RefreshCw size={14} /> Actualizar
        </button>

        {isAdmin && (
          <button
            onClick={() => setShowNueva(!showNueva)}
            style={{
              display: 'flex', alignItems: 'center', gap: 6, padding: '6px 14px',
              background: 'rgba(139,92,246,0.12)', border: '1px solid rgba(139,92,246,0.3)',
              borderRadius: 8, color: '#8b5cf6', fontSize: 13, cursor: 'pointer',
            }}
          >
            <Plus size={14} /> Nueva entrada
          </button>
        )}

        {showNueva && isAdmin && (
          <div style={{ display: 'flex', gap: 6, alignItems: 'center', padding: '5px 10px', background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 8 }}>
            <input
              type="date"
              value={nuevaFecha}
              onChange={e => setNuevaFecha(e.target.value)}
              style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 4, padding: '3px 6px', color: 'var(--text)', fontSize: 12 }}
            />
            <button
              onClick={crearEntrada}
              style={{ padding: '4px 12px', background: '#8b5cf6', border: 'none', borderRadius: 4, color: 'white', fontSize: 12, cursor: 'pointer' }}
            >
              Crear
            </button>
          </div>
        )}

        <button
          onClick={() => syncDesdeVentas()}
          disabled={loadingSync}
          style={{
            display: 'flex', alignItems: 'center', gap: 6, padding: '6px 14px',
            background: 'rgba(79,142,247,0.12)', border: '1px solid rgba(79,142,247,0.3)',
            borderRadius: 8, color: 'var(--accent)', fontSize: 13, cursor: 'pointer',
          }}
        >
          {loadingSync ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
          Sync Ventas ({fechaSeleccionada.split('-').reverse().slice(0, 2).join('/')})
        </button>

        <button
          onClick={() => setShowExport(!showExport)}
          style={{
            display: 'flex', alignItems: 'center', gap: 6, padding: '6px 14px',
            background: 'rgba(34,197,94,0.12)', border: '1px solid rgba(34,197,94,0.3)',
            borderRadius: 8, color: '#22c55e', fontSize: 13, cursor: 'pointer',
          }}
        >
          <FileSpreadsheet size={14} /> Exportar Excel
        </button>

        {showExport && (
          <div style={{
            display: 'flex', gap: 8, alignItems: 'center', padding: '6px 12px',
            background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 8,
          }}>
            <input type="date" value={exportDesde} onChange={e => setExportDesde(e.target.value)}
              style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 4, padding: '3px 6px', color: 'var(--text)', fontSize: 12 }} />
            <span style={{ color: 'var(--text3)' }}>→</span>
            <input type="date" value={exportHasta} onChange={e => setExportHasta(e.target.value)}
              style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 4, padding: '3px 6px', color: 'var(--text)', fontSize: 12 }} />
            <button
              onClick={handleExport}
              disabled={exporting}
              style={{
                padding: '4px 12px', background: '#22c55e', border: 'none',
                borderRadius: 4, color: 'white', fontSize: 12, cursor: 'pointer',
              }}
            >
              {exporting ? <Loader2 size={12} className="animate-spin" /> : 'Descargar'}
            </button>
          </div>
        )}
      </div>

      {/* Tabla */}
      <div style={{ flex: 1, overflow: 'auto', borderRadius: 10, border: '1px solid var(--border)' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 980 }}>
          <thead>
            <tr style={{ background: 'var(--bg2)', position: 'sticky', top: 0, zIndex: 1 }}>
              {COLS.map(col => {
                const color = COL_COLORS[col.key];
                const isTotal = col.key === '_total_caja' || col.key === '_total_transf';
                const totalColor = col.key === '_total_caja' ? '#22c55e' : '#06b6d4';
                return (
                  <th key={col.key} style={{
                    padding: '10px 8px',
                    textAlign: col.key === 'fecha' ? 'left' : 'right',
                    fontSize: 11, fontWeight: 700,
                    color: isTotal ? totalColor : color ? color : 'var(--text3)',
                    textTransform: 'uppercase', letterSpacing: '0.06em',
                    borderBottom: `2px solid ${isTotal ? totalColor : color ? `${color}55` : 'var(--border)'}`,
                    whiteSpace: 'nowrap',
                    background: isTotal
                      ? col.key === '_total_caja' ? 'rgba(34,197,94,0.06)' : 'rgba(6,182,212,0.06)'
                      : color ? `${color}10` : 'var(--bg2)',
                  }}>
                    {col.label}{col.editable && isAdmin && !esMesCerrado ? ' ✎' : ''}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {historico.length === 0 && (
              <tr>
                <td colSpan={COLS.length} style={{ textAlign: 'center', padding: 40, color: 'var(--text3)', fontSize: 13 }}>
                  No hay registros. Usá "Nueva entrada" para comenzar.
                </td>
              </tr>
            )}
            {historico.map((d, i) => {
              const isSelected = d.fecha === fechaSeleccionada;
              const totalCaja  = calcTotalCaja(d);
              const totalTransf = calcTotalTransf(d);
              const tieneAbierto = (d.turnos_abiertos || 0) > 0;
              return (
                <tr
                  key={d.id}
                  onClick={() => setFecha(d.fecha)}
                  style={{
                    background: isSelected ? 'rgba(79,142,247,0.07)' : i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.015)',
                    cursor: 'pointer',
                    borderBottom: '1px solid var(--border)',
                    outline: isSelected ? '1px solid rgba(79,142,247,0.3)' : 'none',
                  }}
                >
                  {/* Fecha */}
                  <td style={{ padding: '4px 8px', whiteSpace: 'nowrap' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      {tieneAbierto
                        ? <Unlock size={12} style={{ color: '#f59e0b' }} />
                        : <Lock size={12} style={{ color: 'var(--text3)' }} />
                      }
                      <span style={{ fontWeight: isSelected ? 700 : 400, color: isSelected ? 'var(--accent)' : 'var(--text)', fontSize: 13 }}>
                        {fmtFecha(d.fecha)}
                      </span>
                    </div>
                  </td>

                  {/* Columnas editables con color por columna */}
                  {(['libro','caja','egresos','tarjetas','cambio','transferencias','gastos_tarjeta'] as (keyof LibroCajaDia)[]).map(campo => (
                    <td key={campo} style={{ padding: '2px 4px', textAlign: 'right', background: `${COL_COLORS[campo]}05` }}>
                      <EditableCell
                        value={(d[campo] as number) || 0}
                        onSave={v => handleEdit(d.fecha, campo, v)}
                        isAdmin={isAdmin}
                        readOnly={esMesCerrado}
                        colorVal={COL_COLORS[campo]}
                      />
                    </td>
                  ))}

                  {/* Total en Caja (calculado) */}
                  <td style={{ padding: '4px 8px', textAlign: 'right', background: 'rgba(34,197,94,0.04)' }}>
                    <span style={{
                      fontWeight: 700, fontSize: 13,
                      color: totalCaja >= 0 ? '#22c55e' : '#ef4444',
                      fontFamily: "'Syne', sans-serif",
                    }}>
                      $ {fmt(totalCaja)}
                    </span>
                  </td>

                  {/* Total Transferencias (calculado) */}
                  <td style={{ padding: '4px 8px', textAlign: 'right', background: 'rgba(6,182,212,0.04)' }}>
                    <span style={{
                      fontWeight: 700, fontSize: 13,
                      color: totalTransf >= 0 ? '#06b6d4' : '#ef4444',
                      fontFamily: "'Syne', sans-serif",
                    }}>
                      $ {fmt(totalTransf)}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
          {historico.length > 0 && (
            <tfoot>
              <tr style={{ background: 'var(--bg2)', borderTop: '2px solid var(--border)' }}>
                <td style={{ padding: '10px 8px', fontWeight: 700, color: 'var(--text2)', fontSize: 12, whiteSpace: 'nowrap' }}>
                  TOTALES ({historico.length} días)
                </td>
                {(['libro','caja','egresos','tarjetas','cambio','transferencias','gastos_tarjeta'] as (keyof typeof totales)[]).map(k => (
                  <td key={k} style={{ padding: '10px 8px', textAlign: 'right', fontWeight: 700, color: COL_COLORS[k] || 'var(--text)', fontSize: 13 }}>
                    $ {fmt(totales[k])}
                  </td>
                ))}
                {/* Total Caja acumulado */}
                <td style={{ padding: '10px 8px', textAlign: 'right', fontWeight: 800, color: '#22c55e', fontSize: 14, background: 'rgba(34,197,94,0.06)' }}>
                  $ {fmt(totales.caja - totales.egresos)}
                </td>
                {/* Total Transf acumulado */}
                <td style={{ padding: '10px 8px', textAlign: 'right', fontWeight: 800, color: '#06b6d4', fontSize: 14, background: 'rgba(6,182,212,0.06)' }}>
                  $ {fmt(totales.tarjetas + totales.transferencias - totales.gastos_tarjeta)}
                </td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </div>
  );
};

// ── Panel del día seleccionado ───────────────────────────────────────────────
const PanelDia: React.FC = () => {
  const {
    diaActual, turnos, turnoActivo, loading,
    fechaSeleccionada, setFecha,
    actualizarCampo, syncDesdeVentas, loadingSync,
    abrirTurno, cerrarTurno,
  } = useLibroCajaStore();
  const { currentUser } = useAppStore();
  const isAdmin = currentUser?.rol === 'admin';

  const [montoApertura, setMontoApertura] = useState('0');
  const [montoCierre, setMontoCierre] = useState('0');
  const [notas, setNotas] = useState('');
  const [showTurnoModal, setShowTurnoModal] = useState<'abrir' | 'cerrar' | null>(null);

  useEffect(() => {
    if (diaActual) setNotas(diaActual.notas || '');
  }, [diaActual?.id]);

  const cambiarDia = (offset: number) => {
    const d = new Date(fechaSeleccionada + 'T12:00:00');
    d.setDate(d.getDate() + offset);
    setFecha(d.toISOString().split('T')[0]);
  };

  const guardarNotas = useCallback(async () => {
    await actualizarCampo('notas', notas);
    toast.success('Notas guardadas');
  }, [notas, actualizarCampo]);

  const handleAbrirTurno = async () => {
    const monto = parseFloat(montoApertura) || 0;
    await abrirTurno(monto);
    setShowTurnoModal(null);
    toast.success('Turno abierto');
  };

  const handleCerrarTurno = async () => {
    const monto = parseFloat(montoCierre) || 0;
    await cerrarTurno(monto);
    setShowTurnoModal(null);
    toast.success('Turno cerrado');
  };

  const totalEnCaja  = calcTotalCaja(diaActual);
  const totalEnTransf = calcTotalTransf(diaActual);

  const CAMPOS_EDITABLE = [
    { key: 'libro'          as const, label: 'Libro',          color: '#8b5cf6', desc: 'Saldo según libro contable' },
    { key: 'caja'           as const, label: 'Caja',           color: '#22c55e', desc: 'Efectivo cobrado en el día' },
    { key: 'egresos'        as const, label: 'Egresos',        color: '#ef4444', desc: 'Pagos en efectivo realizados' },
    { key: 'tarjetas'       as const, label: 'Tarjetas',       color: '#3b82f6', desc: 'Cobrado con tarjeta de débito/crédito' },
    { key: 'cambio'         as const, label: 'Cambio',         color: '#f59e0b', desc: 'Fondo de cambio diario (por defecto $1.500)' },
    { key: 'transferencias' as const, label: 'Transferencias', color: '#06b6d4', desc: 'Cobrado por transferencia bancaria' },
    { key: 'gastos_tarjeta' as const, label: 'Gastos Tarjeta', color: '#f97316', desc: 'Pagos realizados con tarjeta o transferencia' },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Header del día */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 10,
        padding: '12px 16px', background: 'var(--bg2)',
        borderRadius: 10, border: '1px solid var(--border)',
      }}>
        <button onClick={() => cambiarDia(-1)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text3)', padding: 4, borderRadius: 6 }}>
          <ChevronLeft size={18} />
        </button>
        <Calendar size={16} style={{ color: 'var(--accent)' }} />
        <span style={{ fontWeight: 700, fontSize: 15, color: 'var(--text)', fontFamily: "'Syne', sans-serif" }}>
          {fmtFecha(fechaSeleccionada)}
          {fechaSeleccionada === hoyISO() && (
            <span style={{ marginLeft: 8, fontSize: 11, color: '#22c55e', background: 'rgba(34,197,94,0.12)', padding: '2px 8px', borderRadius: 12 }}>
              HOY
            </span>
          )}
        </span>
        <button onClick={() => cambiarDia(1)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text3)', padding: 4, borderRadius: 6 }}>
          <ChevronRight size={18} />
        </button>

        <div style={{ flex: 1 }} />

        {/* Turno */}
        {turnoActivo ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, color: '#22c55e', background: 'rgba(34,197,94,0.1)', padding: '4px 10px', borderRadius: 20 }}>
              <Unlock size={12} /> Turno {turnoActivo.numero} abierto
            </span>
            <button
              onClick={() => setShowTurnoModal('cerrar')}
              style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '6px 12px', background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 8, color: '#ef4444', fontSize: 12, cursor: 'pointer' }}
            >
              <Lock size={12} /> Cerrar turno
            </button>
          </div>
        ) : (
          <button
            onClick={() => setShowTurnoModal('abrir')}
            style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '6px 14px', background: 'rgba(79,142,247,0.12)', border: '1px solid rgba(79,142,247,0.3)', borderRadius: 8, color: 'var(--accent)', fontSize: 12, cursor: 'pointer' }}
          >
            <Unlock size={12} /> Abrir turno
          </button>
        )}

        <button
          onClick={() => syncDesdeVentas()}
          disabled={loadingSync}
          style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '6px 12px', background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text2)', fontSize: 12, cursor: 'pointer' }}
        >
          {loadingSync ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />}
          Sync
        </button>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: 40, color: 'var(--text3)' }}>
          <Loader2 size={24} className="animate-spin" style={{ margin: '0 auto' }} />
        </div>
      ) : (
        <>
          {/* Cards de campos */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 10 }}>
            {CAMPOS_EDITABLE.map(({ key, label, color, desc }) => (
              <CampoCard
                key={key}
                label={label}
                color={color}
                desc={desc}
                value={(diaActual?.[key] as number) || 0}
                onSave={v => actualizarCampo(key, v)}
                isAdmin={isAdmin}
              />
            ))}

            {/* Total en Caja (readonly) */}
            <div style={{
              padding: '14px 16px', background: 'rgba(34,197,94,0.06)',
              border: '1px solid rgba(34,197,94,0.25)', borderRadius: 10,
            }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#22c55e', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>
                Total en Caja
              </div>
              <div style={{ fontSize: 22, fontWeight: 800, color: totalEnCaja >= 0 ? '#22c55e' : '#ef4444', fontFamily: "'Syne', sans-serif" }}>
                $ {fmt(totalEnCaja)}
              </div>
              <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 2 }}>Caja − Egresos (efectivo neto)</div>
            </div>

            {/* Total en Transferencia (readonly) */}
            <div style={{
              padding: '14px 16px', background: 'rgba(6,182,212,0.06)',
              border: '1px solid rgba(6,182,212,0.25)', borderRadius: 10,
            }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#06b6d4', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>
                Total en Transferencia
              </div>
              <div style={{ fontSize: 22, fontWeight: 800, color: totalEnTransf >= 0 ? '#06b6d4' : '#ef4444', fontFamily: "'Syne', sans-serif" }}>
                $ {fmt(totalEnTransf)}
              </div>
              <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 2 }}>Tarjetas + Transf. − Gs. Tarjeta</div>
            </div>
          </div>

          {/* Notas */}
          <div style={{ background: 'var(--bg2)', borderRadius: 10, border: '1px solid var(--border)', padding: 14 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text3)', marginBottom: 8 }}>NOTAS DEL DÍA</div>
            <textarea
              value={notas}
              onChange={e => setNotas(e.target.value)}
              placeholder="Notas del día..."
              rows={3}
              style={{
                width: '100%', background: 'var(--bg)', border: '1px solid var(--border)',
                borderRadius: 6, padding: '8px 10px', color: 'var(--text)', fontSize: 13,
                resize: 'vertical', outline: 'none', boxSizing: 'border-box',
              }}
            />
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 6 }}>
              <button
                onClick={guardarNotas}
                style={{ padding: '5px 14px', background: 'var(--accent)', border: 'none', borderRadius: 6, color: 'white', fontSize: 12, cursor: 'pointer' }}
              >
                Guardar notas
              </button>
            </div>
          </div>

          {/* Historial de turnos del día */}
          {turnos.length > 0 && (
            <div style={{ background: 'var(--bg2)', borderRadius: 10, border: '1px solid var(--border)', padding: 14 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text3)', marginBottom: 10 }}>TURNOS DEL DÍA</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {turnos.map(t => (
                  <div key={t.id} style={{
                    display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px',
                    background: 'var(--bg)', borderRadius: 8, border: '1px solid var(--border)',
                  }}>
                    {t.fecha_cierre
                      ? <Lock size={13} style={{ color: 'var(--text3)' }} />
                      : <Unlock size={13} style={{ color: '#22c55e' }} />
                    }
                    <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>Turno {t.numero}</span>
                    <span style={{ fontSize: 12, color: 'var(--text3)' }}>
                      {t.fecha_apertura.split('T')[1]?.slice(0, 5) || t.fecha_apertura.slice(11, 16)}
                    </span>
                    {t.fecha_cierre && (
                      <>
                        <span style={{ color: 'var(--text3)' }}>→</span>
                        <span style={{ fontSize: 12, color: 'var(--text3)' }}>
                          {t.fecha_cierre.split('T')[1]?.slice(0, 5) || t.fecha_cierre.slice(11, 16)}
                        </span>
                      </>
                    )}
                    <div style={{ flex: 1 }} />
                    {t.monto_apertura > 0 && (
                      <span style={{ fontSize: 12, color: 'var(--text2)' }}>Ap: $ {fmt(t.monto_apertura)}</span>
                    )}
                    {t.monto_cierre != null && (
                      <span style={{ fontSize: 12, color: 'var(--text2)' }}>Cie: $ {fmt(t.monto_cierre)}</span>
                    )}
                    {!t.fecha_cierre && (
                      <span style={{ fontSize: 11, color: '#22c55e', background: 'rgba(34,197,94,0.1)', padding: '2px 8px', borderRadius: 12 }}>Abierto</span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {/* Modal abrir/cerrar turno */}
      {showTurnoModal && (
        <div
          style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
          }}
          onClick={() => setShowTurnoModal(null)}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 14,
              padding: 28, width: 340, maxWidth: '90vw',
            }}
          >
            <h3 style={{ margin: '0 0 16px', fontWeight: 800, fontSize: 17, color: 'var(--text)', fontFamily: "'Syne', sans-serif" }}>
              {showTurnoModal === 'abrir' ? '🟢 Abrir turno' : '🔴 Cerrar turno'}
            </h3>
            <div style={{ marginBottom: 16 }}>
              <label style={{ fontSize: 12, color: 'var(--text3)', fontWeight: 600 }}>
                {showTurnoModal === 'abrir' ? 'Monto de apertura' : 'Monto al cierre'}
              </label>
              <input
                type="number"
                value={showTurnoModal === 'abrir' ? montoApertura : montoCierre}
                onChange={e => showTurnoModal === 'abrir' ? setMontoApertura(e.target.value) : setMontoCierre(e.target.value)}
                style={{
                  width: '100%', marginTop: 6, padding: '8px 12px',
                  background: 'var(--bg)', border: '1px solid var(--border)',
                  borderRadius: 8, color: 'var(--text)', fontSize: 15,
                  boxSizing: 'border-box',
                }}
                autoFocus
              />
            </div>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button onClick={() => setShowTurnoModal(null)} style={{ padding: '8px 16px', background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text2)', cursor: 'pointer', fontSize: 13 }}>
                Cancelar
              </button>
              <button
                onClick={showTurnoModal === 'abrir' ? handleAbrirTurno : handleCerrarTurno}
                style={{
                  padding: '8px 20px', border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 13, fontWeight: 700, color: 'white',
                  background: showTurnoModal === 'abrir' ? '#22c55e' : '#ef4444',
                }}
              >
                {showTurnoModal === 'abrir' ? 'Abrir' : 'Cerrar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// ── Campo card editable ──────────────────────────────────────────────────────
interface CampoCardProps {
  label: string;
  color: string;
  desc: string;
  value: number;
  onSave: (v: number) => void;
  isAdmin?: boolean;
}

const CampoCard: React.FC<CampoCardProps> = ({ label, color, desc, value, onSave, isAdmin = true }) => {
  const [editing, setEditing] = useState(false);
  const [inputVal, setInputVal] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const startEdit = () => {
    if (!isAdmin) { toast.error('Solo administradores pueden editar'); return; }
    setInputVal(String(value));
    setEditing(true);
    setTimeout(() => inputRef.current?.select(), 10);
  };

  const commit = () => {
    const n = parseFloat(inputVal.replace(',', '.'));
    if (!isNaN(n)) onSave(n);
    setEditing(false);
  };

  return (
    <div
      title={isAdmin ? 'Clic para editar' : 'Solo admins pueden editar'}
      style={{
        padding: '14px 16px', background: 'var(--bg2)',
        border: `1px solid ${color}30`, borderRadius: 10,
        cursor: isAdmin ? 'pointer' : 'not-allowed',
      }}
      onClick={!editing ? startEdit : undefined}
    >
      <div style={{ fontSize: 11, fontWeight: 700, color, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>
        {label}
      </div>
      {editing ? (
        <input
          ref={inputRef}
          type="number"
          value={inputVal}
          onChange={e => setInputVal(e.target.value)}
          onBlur={commit}
          onKeyDown={e => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') setEditing(false); }}
          style={{
            width: '100%', background: 'var(--bg)', border: `1px solid ${color}`, borderRadius: 6,
            padding: '4px 8px', color: 'var(--text)', fontSize: 18, fontWeight: 700,
            fontFamily: "'Syne', sans-serif", outline: 'none', boxSizing: 'border-box',
          }}
        />
      ) : (
        <div style={{ fontSize: 20, fontWeight: 800, color: value > 0 ? color : 'var(--text3)', fontFamily: "'Syne', sans-serif" }}>
          $ {fmt(value)}
        </div>
      )}
      <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 3 }}>{desc}</div>
    </div>
  );
};

// ── Contador de billetes ─────────────────────────────────────────────────────
const ContadorBilletes: React.FC = () => {
  const { billetes, actualizarBilletes, fechaSeleccionada, diaActual } = useLibroCajaStore();

  // Estado local de cantidades
  const [cantidades, setCantidades] = useState<Record<number, number>>({});

  useEffect(() => {
    const initial: Record<number, number> = {};
    DENOMINACIONES.forEach(d => { initial[d] = 0; });
    billetes.forEach(b => { initial[b.denominacion] = b.cantidad; });
    setCantidades(initial);
  }, [billetes, fechaSeleccionada]);

  const handleChange = (den: number, val: string) => {
    const n = Math.max(0, parseInt(val) || 0);
    setCantidades(prev => ({ ...prev, [den]: n }));
  };

  const handleSave = async () => {
    const list = DENOMINACIONES.map(d => ({ denominacion: d, cantidad: cantidades[d] || 0 }));
    await actualizarBilletes(list);
    toast.success('Contador guardado');
  };

  const handleReset = () => {
    const reset: Record<number, number> = {};
    DENOMINACIONES.forEach(d => { reset[d] = 0; });
    setCantidades(reset);
  };

  const total = DENOMINACIONES.reduce((acc, d) => acc + d * (cantidades[d] || 0), 0);
  const totalBilletesGrandes = [20000, 10000, 5000, 2000, 1000].reduce((acc, d) => acc + d * (cantidades[d] || 0), 0);
  const totalChicos = [500, 200, 100, 50, 20, 10].reduce((acc, d) => acc + d * (cantidades[d] || 0), 0);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 10,
        padding: '12px 16px', background: 'var(--bg2)',
        borderRadius: 10, border: '1px solid var(--border)',
      }}>
        <Banknote size={18} style={{ color: '#22c55e' }} />
        <span style={{ fontWeight: 700, fontSize: 15, color: 'var(--text)', fontFamily: "'Syne', sans-serif" }}>
          Contador de Billetes — {fmtFecha(fechaSeleccionada)}
        </span>
        <div style={{ flex: 1 }} />
        <button
          onClick={handleReset}
          style={{ padding: '5px 12px', background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text3)', fontSize: 12, cursor: 'pointer' }}
        >
          Limpiar
        </button>
        <button
          onClick={handleSave}
          style={{ padding: '5px 14px', background: '#22c55e', border: 'none', borderRadius: 8, color: 'white', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}
        >
          Guardar
        </button>
      </div>

      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
        {/* Tabla billetes */}
        <div style={{ flex: '0 0 auto', minWidth: 340, background: 'var(--bg2)', borderRadius: 12, border: '1px solid var(--border)', overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: 'var(--bg3)' }}>
                <th style={{ padding: '10px 16px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase' }}>Denominación</th>
                <th style={{ padding: '10px 16px', textAlign: 'center', fontSize: 11, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase' }}>Cantidad</th>
                <th style={{ padding: '10px 16px', textAlign: 'right', fontSize: 11, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase' }}>Subtotal</th>
              </tr>
            </thead>
            <tbody>
              {DENOMINACIONES.map((den, i) => {
                const cant = cantidades[den] || 0;
                const sub = den * cant;
                const isBig = den >= 1000;
                return (
                  <tr key={den} style={{ borderTop: '1px solid var(--border)', background: i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.01)' }}>
                    <td style={{ padding: '8px 16px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div style={{
                          width: 48, height: 24, borderRadius: 4, display: 'flex', alignItems: 'center', justifyContent: 'center',
                          background: isBig ? 'rgba(34,197,94,0.15)' : 'rgba(79,142,247,0.12)',
                          border: `1px solid ${isBig ? 'rgba(34,197,94,0.3)' : 'rgba(79,142,247,0.3)'}`,
                          fontSize: 11, fontWeight: 800, color: isBig ? '#22c55e' : 'var(--accent)',
                        }}>
                          ${den >= 1000 ? `${den / 1000}K` : den}
                        </div>
                        <span style={{ fontSize: 13, color: 'var(--text2)' }}>${fmt(den)}</span>
                      </div>
                    </td>
                    <td style={{ padding: '6px 16px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, justifyContent: 'center' }}>
                        <button
                          onClick={() => handleChange(den, String(Math.max(0, cant - 1)))}
                          style={{ width: 26, height: 26, borderRadius: 6, border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text)', cursor: 'pointer', fontSize: 16, lineHeight: '1' }}
                        >−</button>
                        <input
                          type="number"
                          min="0"
                          value={cant}
                          onChange={e => handleChange(den, e.target.value)}
                          style={{
                            width: 60, textAlign: 'center', padding: '4px 6px',
                            background: 'var(--bg)', border: '1px solid var(--border)',
                            borderRadius: 6, color: 'var(--text)', fontSize: 14,
                            fontWeight: 700, fontFamily: "'Syne', sans-serif",
                          }}
                        />
                        <button
                          onClick={() => handleChange(den, String(cant + 1))}
                          style={{ width: 26, height: 26, borderRadius: 6, border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text)', cursor: 'pointer', fontSize: 16, lineHeight: '1' }}
                        >+</button>
                      </div>
                    </td>
                    <td style={{ padding: '8px 16px', textAlign: 'right', fontWeight: cant > 0 ? 700 : 400, color: cant > 0 ? 'var(--text)' : 'var(--text3)', fontSize: 13 }}>
                      {cant > 0 ? `$ ${fmt(sub)}` : '—'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Panel resumen */}
        <div style={{ flex: 1, minWidth: 220, display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ background: 'var(--bg2)', borderRadius: 12, border: '1px solid var(--border)', padding: 20 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 12 }}>Resumen</div>
            <ResumenItem label="Billetes grandes (≥$1000)" value={totalBilletesGrandes} color="#22c55e" />
            <ResumenItem label="Billetes chicos (<$1000)" value={totalChicos} color="var(--accent)" />
            <div style={{ borderTop: '1px solid var(--border)', marginTop: 12, paddingTop: 12 }}>
              <ResumenItem label="TOTAL CONTADO" value={total} color="#f59e0b" large />
            </div>
          </div>

          {/* Comparar con caja */}
          {diaActual && diaActual.caja > 0 && (
            <div style={{ background: 'var(--bg2)', borderRadius: 12, border: '1px solid var(--border)', padding: 20 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 12 }}>Comparar con Caja</div>
              <ResumenItem label="Caja registrada" value={diaActual.caja} color="var(--text2)" />
              <ResumenItem label="Contado en billetes" value={total} color="var(--text2)" />
              <div style={{ borderTop: '1px solid var(--border)', marginTop: 10, paddingTop: 10 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: 13, color: 'var(--text3)' }}>Diferencia</span>
                  <span style={{
                    fontSize: 15, fontWeight: 800,
                    color: Math.abs(total - diaActual.caja) < 1 ? '#22c55e' : total > diaActual.caja ? '#22c55e' : '#ef4444',
                  }}>
                    {total - diaActual.caja >= 0 ? '+' : ''}$ {fmt(total - diaActual.caja)}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Botón actualizar caja con total */}
          <button
            onClick={async () => {
              await actualizarBilletes(DENOMINACIONES.map(d => ({ denominacion: d, cantidad: cantidades[d] || 0 })));
              toast.success('Contador guardado');
            }}
            style={{
              padding: '12px 0', background: '#22c55e', border: 'none',
              borderRadius: 10, color: 'white', fontSize: 14, fontWeight: 700,
              cursor: 'pointer', fontFamily: "'Syne', sans-serif",
            }}
          >
            💾 Guardar contador
          </button>
        </div>
      </div>
    </div>
  );
};

const ResumenItem: React.FC<{ label: string; value: number; color: string; large?: boolean }> = ({ label, value, color, large }) => (
  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
    <span style={{ fontSize: large ? 13 : 12, color: 'var(--text3)', fontWeight: large ? 700 : 400 }}>{label}</span>
    <span style={{ fontSize: large ? 18 : 13, fontWeight: 700, color, fontFamily: "'Syne', sans-serif" }}>
      $ {fmt(value)}
    </span>
  </div>
);

// ── Módulo principal ─────────────────────────────────────────────────────────
type TabType = 'hoy' | 'tabla' | 'dia' | 'billetes';

export const LibroCajaModule: React.FC = () => {
  const [tab, setTab] = useState<TabType>('hoy');  // Ahora 'hoy' es la pestaña por defecto
  const { cargarDia, cargarHistorico, fechaSeleccionada } = useLibroCajaStore();

  useEffect(() => {
    cargarDia();
    cargarHistorico();
  }, []);

  // Solo mostrar la pestaña "hoy" por defecto. Las otras son para usuarios avanzados.
  const TABS: { id: TabType; label: string; icon: React.ElementType }[] = [
    { id: 'hoy',     label: 'Movimientos del día',   icon: Table2 },
    // Opcional: agregar otras pestañas si el usuario quiere
    // { id: 'tabla',   label: 'Libro de Caja',    icon: Table2 },
    // { id: 'dia',     label: 'Día / Turnos',     icon: Calendar },
    // { id: 'billetes',label: 'Contador Billetes', icon: Banknote },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: 'var(--bg)' }}>
      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 12,
        padding: '14px 20px', borderBottom: '1px solid var(--border)',
        background: 'var(--bg2)', flexShrink: 0,
      }}>
        <div style={{
          width: 34, height: 34, borderRadius: 9, display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: 'linear-gradient(135deg, #22c55e 0%, #16a34a 100%)',
        }}>
          <BookOpen size={17} style={{ color: 'white' }} />
        </div>
        <div>
          <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--text)', fontFamily: "'Syne', sans-serif" }}>
            Libro de Caja
          </div>
          <div style={{ fontSize: 11, color: 'var(--text3)' }}>Control diario de caja · Turnos · Billetes</div>
        </div>

        <div style={{ flex: 1 }} />

        {/* Tabs */}
        <div style={{ display: 'flex', gap: 4, background: 'var(--bg)', borderRadius: 10, padding: 3, border: '1px solid var(--border)' }}>
          {TABS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              style={{
                display: 'flex', alignItems: 'center', gap: 6, padding: '6px 14px',
                borderRadius: 8, border: 'none', cursor: 'pointer', fontSize: 12,
                fontWeight: tab === id ? 700 : 400,
                background: tab === id ? 'var(--accent)' : 'transparent',
                color: tab === id ? 'white' : 'var(--text3)',
                transition: 'all 0.15s',
              }}
            >
              <Icon size={13} /> {label}
            </button>
          ))}
        </div>
      </div>

      {/* Contenido */}
      <div style={{ flex: 1, overflow: 'auto', padding: 20 }}>
        {tab === 'hoy'      && <LibroCajaHoy />}
        {tab === 'tabla'    && <TablaHistorico />}
        {tab === 'dia'      && <PanelDia />}
        {tab === 'billetes' && <ContadorBilletes />}
      </div>
    </div>
  );
};
