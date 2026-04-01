import React, { useEffect, useState } from 'react';
import {
  TrendingUp, ShoppingCart, AlertTriangle, CreditCard,
  RefreshCw, BarChart2,
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from 'recharts';
import { statsAPI, ventasAPI } from '../../lib/api';
import { useAppStore } from '../../store/useAppStore';
import { useTranslation } from 'react-i18next';

interface DashStats {
  ventas_hoy: number;
  total_hoy: number;
  ventas_semana: number;
  total_semana: number;
  total_semana_anterior: number;
  ventas_mes: number;
  total_mes: number;
  ticket_promedio_hoy: number;
  clientes_nuevos_mes: number;
  productos_bajo_stock: number;
  fiado_total: number;
  ventas_por_dia: { fecha: string; total: number; cantidad: number }[];
  top_productos: { nombre: string; cantidad: number; total: number }[];
  ventas_por_metodo: { metodo: string; total: number; cantidad: number }[];
  alertas_stock: { nombre: string; stock_actual: number; stock_minimo: number }[];
}

interface Venta {
  id: number;
  numero: string;
  fecha: string;
  total: number;
  metodo_pago: string;
  cliente_nombre?: string;
}

function fmt(n: number) {
  return '$' + n.toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

function fmtDate(d: string) {
  return new Date(d + 'T12:00:00').toLocaleDateString('es-AR', { day: '2-digit', month: 'short' });
}

interface KPIProps {
  title: string;
  value: string;
  sub?: string;
  icon: React.ElementType;
  color: string;
  trend?: number;
}
function KPICard({ title, value, sub, icon: Icon, color, trend }: KPIProps) {
  return (
    <div className="metric-card">
      <div className="flex items-start justify-between mb-3">
        <div
          className="flex items-center justify-center rounded-lg"
          style={{ width: 36, height: 36, background: `${color}18`, border: `1px solid ${color}30` }}
        >
          <Icon size={16} style={{ color }} />
        </div>
        {trend !== undefined && (
          <span
            className="badge"
            style={{
              background: trend >= 0 ? 'rgba(16,185,129,.12)' : 'rgba(239,68,68,.12)',
              color: trend >= 0 ? 'var(--accent3)' : 'var(--danger)',
              border: `1px solid ${trend >= 0 ? 'rgba(16,185,129,.25)' : 'rgba(239,68,68,.25)'}`,
              fontSize: 10,
            }}
          >
            {trend >= 0 ? '+' : ''}{trend.toFixed(0)}%
          </span>
        )}
      </div>
      <div className="num font-bold" style={{ fontSize: 22, color: 'var(--text)', letterSpacing: '-0.02em' }}>
        {value}
      </div>
      <div className="font-semibold mt-0.5" style={{ fontSize: 12, color: 'var(--text2)' }}>{title}</div>
      {sub && <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 3 }}>{sub}</div>}
    </div>
  );
}

// Custom tooltip for chart
function ChartTooltip({ active, payload, label }: Record<string, unknown>) {
  if (!active || !payload || !(payload as { value: number }[]).length) return null;
  return (
    <div style={{ background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 8, padding: '8px 12px' }}>
      <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 4 }}>{label as string}</div>
      <div style={{ fontSize: 13, fontFamily: "'DM Mono', monospace", color: 'var(--accent)', fontWeight: 600 }}>
        {fmt((payload as { value: number }[])[0].value)}
      </div>
    </div>
  );
}

export default function Dashboard() {
  const [stats, setStats] = useState<DashStats | null>(null);
  const [ventas, setVentas] = useState<Venta[]>([]);
  const [loading, setLoading] = useState(true);
  const { setCurrentModule } = useAppStore();
  const { t } = useTranslation();

  async function load() {
    setLoading(true);
    try {
      const [s, v] = await Promise.all([
        statsAPI.dashboard() as Promise<DashStats>,
        ventasAPI.getHistorico({} as Record<string, unknown>) as Promise<Venta[]>,
      ]);
      setStats(s);
      setVentas(Array.isArray(v) ? v : []);
    } catch (e) {
      console.error('[Dashboard] Error cargando datos:', e);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  const trend =
    stats && stats.total_semana_anterior > 0
      ? ((stats.total_semana - stats.total_semana_anterior) / stats.total_semana_anterior) * 100
      : undefined;

  // Format chart data — last 14 days
  const chartData =
    (stats?.ventas_por_dia ?? [])
      .slice(-14)
      .map((d) => ({ name: fmtDate(d.fecha), total: d.total }));

  return (
    <div className="flex-1 overflow-y-auto animate-fade-up" style={{ padding: '20px 24px', background: 'var(--bg)' }}>
      {/* Header */}
      <div className="module-header">
        <div>
          <h2 className="module-title">{t('dash.summary')}</h2>
          <p style={{ fontSize: 12, color: 'var(--text3)', marginTop: 2 }}>
            {new Date().toLocaleDateString('es-AR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
          </p>
        </div>
        <button onClick={load} className="btn btn-ghost btn-sm" disabled={loading}>
          <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
          {t('dash.refresh')}
        </button>
      </div>

      {/* KPI Grid */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <KPICard
          title={t('dash.kpi.ventasHoy')}
          value={loading ? '—' : fmt(stats?.total_hoy ?? 0)}
          sub={t('dash.kpi.ventasHoySub')}
          icon={TrendingUp}
          color="var(--accent)"
        />
        <KPICard
          title={t('dash.kpi.semana')}
          value={loading ? '—' : fmt(stats?.total_semana ?? 0)}
          sub={t('dash.kpi.semanaSub')}
          icon={ShoppingCart}
          color="var(--accent3)"
          trend={trend}
        />
        <KPICard
          title={t('dash.kpi.fiados')}
          value={loading ? '—' : fmt(stats?.fiado_total ?? 0)}
          sub={t('dash.kpi.fiadosSub')}
          icon={CreditCard}
          color="var(--warn)"
        />
        <KPICard
          title={t('dash.kpi.stock')}
          value={loading ? '—' : String(stats?.productos_bajo_stock ?? 0)}
          sub={t('dash.kpi.stockSub')}
          icon={AlertTriangle}
          color="var(--danger)"
        />
      </div>

      {/* Chart + Recent Sales */}
      <div className="grid gap-4" style={{ gridTemplateColumns: '1fr 340px' }}>
        {/* Bar Chart */}
        <div className="card" style={{ padding: '20px' }}>
          <div className="flex items-center gap-2 mb-4">
            <BarChart2 size={14} style={{ color: 'var(--accent)' }} />
            <span className="font-semibold text-sm" style={{ color: 'var(--text)' }}>{t('dash.chart')}</span>
          </div>
          {chartData.length === 0 ? (
            <div className="flex items-center justify-center" style={{ height: 160, color: 'var(--text3)', fontSize: 13 }}>
              {t('dash.noData')}
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={chartData} barSize={14} margin={{ top: 4, right: 4, left: -10, bottom: 0 }}>
                <CartesianGrid vertical={false} stroke="var(--border)" strokeDasharray="3 3" />
                <XAxis
                  dataKey="name"
                  tick={{ fontSize: 10, fill: 'var(--text3)', fontFamily: "'DM Mono', monospace" }}
                  axisLine={false} tickLine={false}
                />
                <YAxis
                  tick={{ fontSize: 10, fill: 'var(--text3)', fontFamily: "'DM Mono', monospace" }}
                  axisLine={false} tickLine={false}
                  tickFormatter={(v) => '$' + (v >= 1000 ? (v / 1000).toFixed(0) + 'k' : v)}
                />
                <Tooltip content={<ChartTooltip />} cursor={{ fill: 'rgba(79,142,247,0.06)' }} />
                <Bar dataKey="total" fill="var(--accent)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Recent Sales */}
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <div className="flex items-center justify-between px-4 py-3" style={{ borderBottom: '1px solid var(--border)' }}>
            <span className="font-semibold text-sm" style={{ color: 'var(--text)' }}>{t('dash.recentSales')}</span>
            <button onClick={() => setCurrentModule('ventas')} className="btn btn-ghost btn-xs" style={{ fontSize: 11 }}>
              {t('dash.viewAll')}
            </button>
          </div>
          <div className="overflow-y-auto" style={{ maxHeight: 230 }}>
            {loading ? (
              <div className="flex items-center justify-center py-8" style={{ color: 'var(--text3)', fontSize: 13 }}>{t('common.loading')}</div>
            ) : ventas.length === 0 ? (
              <div className="flex items-center justify-center py-8" style={{ color: 'var(--text3)', fontSize: 13 }}>{t('dash.noSales')}</div>
            ) : (
              <table className="w-full">
                <tbody>
                  {ventas.map((v) => (
                    <tr key={v.id} className="table-row">
                      <td className="table-cell pl-4" style={{ width: 70 }}>
                        <span className="num" style={{ fontSize: 11, color: 'var(--text3)' }}>#{v.numero}</span>
                      </td>
                      <td className="table-cell">
                        <div style={{ fontSize: 12, color: 'var(--text)' }}>{v.cliente_nombre ?? t('dash.consumer')}</div>
                        <div style={{ fontSize: 10, color: 'var(--text3)' }}>{v.metodo_pago}</div>
                      </td>
                      <td className="table-cell pr-4 text-right">
                        <span className="num font-semibold" style={{ fontSize: 13, color: 'var(--accent3)' }}>
                          {fmt(v.total)}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>

      {/* Top Products */}
      {stats?.top_productos && stats.top_productos.length > 0 && (
        <div className="card mt-4" style={{ padding: 0, overflow: 'hidden' }}>
          <div className="px-4 py-3" style={{ borderBottom: '1px solid var(--border)' }}>
            <span className="font-semibold text-sm" style={{ color: 'var(--text)' }}>{t('dash.topProducts')}</span>
          </div>
          <div className="grid grid-cols-5 divide-x" style={{ borderColor: 'var(--border)' }}>
            {stats.top_productos.map((p: any, i: number) => (
              <div key={i} className="p-4" style={{ borderRight: '1px solid var(--border)' }}>
                <div
                  className="num font-black mb-1"
                  style={{ fontSize: 20, color: i === 0 ? 'var(--accent)' : 'var(--text)' }}
                >
                  #{i + 1}
                </div>
                <div style={{ fontSize: 12, color: 'var(--text)', fontWeight: 600, marginBottom: 2 }} className="truncate">
                  {p.nombre}
                </div>
                <div style={{ fontSize: 11, color: 'var(--text3)' }}>{p.cantidad} uds · {fmt(p.total)}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
