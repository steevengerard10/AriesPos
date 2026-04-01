import React, { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import {
  BarChart2, TrendingUp, TrendingDown, DollarSign, ShoppingCart,
  Users, Package, RefreshCw, AlertTriangle, Clock, Zap,
  ArrowUpRight, ArrowDownRight,
} from 'lucide-react';
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, PieChart, Pie, Cell,
} from 'recharts';
import { statsAPI } from '../../lib/api';
import { formatCurrency, weekAgo, today, monthStart } from '../../lib/utils';

interface DashboardStats {
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
  top_productos: { nombre: string; cantidad: number; total: number }[];
  ventas_por_dia: { fecha: string; total: number; cantidad: number }[];
  ventas_por_hora: { hora: string; cantidad: number; total: number }[];
  ventas_por_metodo: { metodo: string; total: number; cantidad: number }[];
  alertas_stock: { nombre: string; stock_actual: number; stock_minimo: number }[];
}

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4'];

const fmtShort = (v: number) =>
  v >= 1_000_000 ? `${(v / 1_000_000).toFixed(1)}M` :
  v >= 1_000 ? `${(v / 1_000).toFixed(0)}k` : String(Math.round(v));

const dayLabel = (fecha: string) => {
  const [, , d] = fecha.split('-');
  return d;
};

const CustomTooltipCurrency: React.FC<{ active?: boolean; payload?: { value: number; name: string; color: string }[]; label?: string }> = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-slate-900 border border-slate-700 rounded-lg p-3 text-xs shadow-2xl">
      <p className="text-slate-400 mb-2 font-medium">{label}</p>
      {payload.map((p, i) => (
        <p key={i} style={{ color: p.color }} className="font-mono">
          {p.name}: {p.name.toLowerCase().includes('cant') ? p.value : formatCurrency(p.value)}
        </p>
      ))}
    </div>
  );
};

// ── KPI Card ────────────────────────────────────────────────────────────────
interface KpiCardProps {
  label: string;
  value: string;
  sub?: string;
  icon: React.ReactNode;
  color: string;
  trend?: number; // porcentaje de cambio
  trendLabel?: string;
}
const KpiCard: React.FC<KpiCardProps> = ({ label, value, sub, icon, color, trend, trendLabel }) => (
  <div className="bg-slate-800 border border-slate-700 rounded-xl p-4 flex flex-col gap-2 hover:border-slate-600 transition-colors">
    <div className="flex items-center justify-between">
      <span className="text-xs text-slate-500 font-medium uppercase tracking-wider">{label}</span>
      <span className={`p-1.5 rounded-lg ${color}`}>{icon}</span>
    </div>
    <div className="text-2xl font-bold text-white font-mono">{value}</div>
    <div className="flex items-center justify-between">
      {sub && <span className="text-xs text-slate-500">{sub}</span>}
      {trend !== undefined && (
        <span className={`text-xs flex items-center gap-1 font-medium ${trend >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
          {trend >= 0 ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}
          {Math.abs(trend).toFixed(0)}% {trendLabel}
        </span>
      )}
    </div>
  </div>
);

export const EstadisticasModule: React.FC = () => {
  const { t } = useTranslation();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [periodo, setPeriodo] = useState<'semana' | 'mes' | 'personalizado'>('semana');
  const [desde, setDesde] = useState(weekAgo());
  const [hasta, setHasta] = useState(today());
  const [ventasPeriodo, setVentasPeriodo] = useState<{ fecha: string; total: number; cantidad: number; efectivo: number; tarjeta: number }[]>([]);
  const [reloj, setReloj] = useState(new Date());
  const [lastRefresh, setLastRefresh] = useState(new Date());

  // Reloj en tiempo real
  useEffect(() => {
    const t = setInterval(() => setReloj(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  const loadDashboard = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await statsAPI.dashboard() as DashboardStats;
      setStats(data);
      setLastRefresh(new Date());
    } catch (e) {
      setError('Error al cargar estadísticas');
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadVentasPeriodo = useCallback(async () => {
    const df = periodo === 'semana' ? weekAgo() : periodo === 'mes' ? monthStart() : desde;
    const dt = periodo === 'personalizado' ? hasta : today();
    try {
      const data = await statsAPI.ventasPorPeriodo(df, dt) as typeof ventasPeriodo;
      setVentasPeriodo(data ?? []);
    } catch { setVentasPeriodo([]); }
  }, [periodo, desde, hasta]);

  useEffect(() => { loadDashboard(); }, [loadDashboard]);
  useEffect(() => { loadVentasPeriodo(); }, [loadVentasPeriodo]);

  // Auto-refresh cada 90 segundos
  useEffect(() => {
    const t = setInterval(() => { loadDashboard(); loadVentasPeriodo(); }, 90_000);
    return () => clearInterval(t);
  }, [loadDashboard, loadVentasPeriodo]);

  if (loading && !stats) {
    return (
      <div className="flex items-center justify-center h-full text-slate-400">
        <div className="text-center space-y-3">
          <div className="w-10 h-10 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-sm">Cargando estadísticas...</p>
        </div>
      </div>
    );
  }

  if (error && !stats) {
    return (
      <div className="flex items-center justify-center h-full text-slate-400">
        <div className="text-center space-y-3">
          <AlertTriangle size={40} className="mx-auto text-red-400" />
          <p className="text-red-400">{error}</p>
          <button className="btn btn-primary btn-sm" onClick={loadDashboard}>{t('stats.retryBtn')}</button>
        </div>
      </div>
    );
  }

  if (!stats) return null;

  const trendSemana = stats.total_semana_anterior > 0
    ? ((stats.total_semana - stats.total_semana_anterior) / stats.total_semana_anterior) * 100
    : 0;

  const maxProductoTotal = Math.max(...(stats.top_productos?.map((p) => p.total) ?? [1]));

  const pieData = (stats.ventas_por_metodo ?? []).map((m, i) => ({
    name: m.metodo.charAt(0).toUpperCase() + m.metodo.slice(1),
    value: m.total,
    cantidad: m.cantidad,
    fill: COLORS[i % COLORS.length],
  }));

  return (
    <div className="flex flex-col h-full overflow-auto">
      {/* ── Header ───────────────────────────────────────────────── */}
      <div className="shrink-0 px-6 pt-5 pb-4 flex items-center justify-between border-b border-slate-800">
        <div>
          <h1 className="text-xl font-bold text-white flex items-center gap-2">
            <BarChart2 size={22} className="text-blue-400" /> {t('stats.title')}
          </h1>
          <p className="text-xs text-slate-500 mt-0.5 flex items-center gap-2">
            <Clock size={11} />
            {reloj.toLocaleTimeString('es-AR')} · Actualizado {lastRefresh.toLocaleTimeString('es-AR')}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {loading && <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />}
          <span className="flex items-center gap-1 text-xs text-emerald-400 bg-emerald-400/10 px-2 py-1 rounded-full">
            <Zap size={10} /> {t('stats.live')}
          </span>
          <button className="btn-ghost btn p-2" title="Actualizar" onClick={() => { loadDashboard(); loadVentasPeriodo(); }}>
            <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-auto px-6 py-5 space-y-5">

        {/* ── KPIs principales ─────────────────────────────────────── */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <KpiCard
            label={t('stats.kpi.today')}
            value={formatCurrency(stats.total_hoy)}
            sub={`${stats.ventas_hoy} ${t('stats.kpi.todaySub')}`}
            icon={<DollarSign size={16} />}
            color="bg-blue-500/20 text-blue-400"
          />
          <KpiCard
            label={t('stats.kpi.ticket')}
            value={formatCurrency(stats.ticket_promedio_hoy)}
            sub={t('stats.kpi.ticketSub')}
            icon={<ShoppingCart size={16} />}
            color="bg-emerald-500/20 text-emerald-400"
          />
          <KpiCard
            label={t('stats.kpi.week')}
            value={formatCurrency(stats.total_semana)}
            sub={`${stats.ventas_semana} ${t('stats.kpi.weekSub')}`}
            icon={<TrendingUp size={16} />}
            color="bg-violet-500/20 text-violet-400"
            trend={trendSemana}
            trendLabel={t('stats.vsWeek')}
          />
          <KpiCard
            label={t('stats.kpi.month')}
            value={formatCurrency(stats.total_mes)}
            sub={`${stats.ventas_mes} ${t('stats.kpi.monthSub')}`}
            icon={<BarChart2 size={16} />}
            color="bg-amber-500/20 text-amber-400"
          />
        </div>

        {/* ── KPIs secundarios ─────────────────────────────────────── */}
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-slate-800 border border-slate-700 rounded-xl p-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-red-500/20"><TrendingDown size={18} className="text-red-400" /></div>
            <div>
              <div className="text-xs text-slate-500 uppercase tracking-wider">{t('stats.kpi.credit')}</div>
              <div className="text-lg font-bold text-red-400 font-mono">{formatCurrency(stats.fiado_total)}</div>
            </div>
          </div>
          <div className="bg-slate-800 border border-slate-700 rounded-xl p-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-cyan-500/20"><Users size={18} className="text-cyan-400" /></div>
            <div>
              <div className="text-xs text-slate-500 uppercase tracking-wider">{t('stats.kpi.newClients')}</div>
              <div className="text-lg font-bold text-cyan-400 font-mono">{stats.clientes_nuevos_mes}</div>
            </div>
          </div>
          <div className={`border rounded-xl p-4 flex items-center gap-3 ${stats.productos_bajo_stock > 0 ? 'bg-yellow-500/10 border-yellow-500/30' : 'bg-slate-800 border-slate-700'}`}>
            <div className={`p-2 rounded-lg ${stats.productos_bajo_stock > 0 ? 'bg-yellow-500/20' : 'bg-slate-700'}`}>
              <Package size={18} className={stats.productos_bajo_stock > 0 ? 'text-yellow-400' : 'text-slate-400'} />
            </div>
            <div>
              <div className="text-xs text-slate-500 uppercase tracking-wider">{t('stats.kpi.lowStock')}</div>
              <div className={`text-lg font-bold font-mono ${stats.productos_bajo_stock > 0 ? 'text-yellow-400' : 'text-slate-300'}`}>
                {stats.productos_bajo_stock} {t('stats.kpi.lowStockUnit')}
              </div>
            </div>
          </div>
        </div>

        {/* ── Gráfico de ventas + métodos de pago ──────────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Área trend */}
          <div className="lg:col-span-2 bg-slate-800 border border-slate-700 rounded-xl p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                <TrendingUp size={15} className="text-blue-400" /> {t('stats.chart.title')}
              </h3>
              <div className="flex gap-1">
                {(['semana', 'mes', 'personalizado'] as const).map((p) => (
                  <button key={p} onClick={() => setPeriodo(p)}
                    className={`px-2.5 py-1 text-xs rounded font-medium transition-colors ${periodo === p ? 'bg-blue-600 text-white' : 'bg-slate-700 text-slate-400 hover:text-white'}`}>
                    {p === 'semana' ? t('stats.chart.7d') : p === 'mes' ? t('stats.chart.30d') : t('stats.chart.range')}
                  </button>
                ))}
              </div>
            </div>
            {periodo === 'personalizado' && (
              <div className="flex gap-2 mb-4">
                <input type="date" value={desde} onChange={(e) => setDesde(e.target.value)} className="input text-xs" />
                <span className="text-slate-500 self-center">—</span>
                <input type="date" value={hasta} onChange={(e) => setHasta(e.target.value)} className="input text-xs" />
              </div>
            )}
            {ventasPeriodo.length === 0 ? (
              <div className="flex items-center justify-center h-52 text-slate-600 text-sm">{t('stats.chart.noData')}</div>
            ) : (
              <ResponsiveContainer width="100%" height={210}>
                <AreaChart data={ventasPeriodo} margin={{ top: 5, right: 5, bottom: 0, left: 0 }}>
                  <defs>
                    <linearGradient id="gradTotal" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                  <XAxis dataKey="fecha" tick={{ fill: '#64748b', fontSize: 11 }} tickFormatter={dayLabel} />
                  <YAxis tick={{ fill: '#64748b', fontSize: 11 }} tickFormatter={fmtShort} width={52} />
                  <Tooltip content={<CustomTooltipCurrency />} />
                  <Area type="monotone" dataKey="total" name="Total" stroke="#3b82f6" strokeWidth={2} fill="url(#gradTotal)" dot={false} activeDot={{ r: 4, fill: '#3b82f6' }} />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>

          {/* Métodos de pago hoy */}
          <div className="bg-slate-800 border border-slate-700 rounded-xl p-5 flex flex-col">
            <h3 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
                <DollarSign size={15} className="text-emerald-400" /> {t('stats.payMethods')}
            </h3>
            {pieData.length === 0 ? (
              <div className="flex-1 flex items-center justify-center text-slate-600 text-sm">{t('stats.noSalesToday')}</div>
            ) : (
              <>
                <ResponsiveContainer width="100%" height={150}>
                  <PieChart>
                    <Pie data={pieData} cx="50%" cy="50%" innerRadius={40} outerRadius={68} dataKey="value" paddingAngle={3}>
                      {pieData.map((entry, index) => <Cell key={index} fill={entry.fill} stroke="transparent" />)}
                    </Pie>
                    <Tooltip formatter={(v: number) => formatCurrency(v)} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="space-y-2 mt-2">
                  {pieData.map((d, i) => (
                    <div key={i} className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2">
                        <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: d.fill }} />
                        <span className="text-slate-400">{d.name}</span>
                        <span className="text-slate-600">({d.cantidad})</span>
                      </div>
                      <span className="font-mono text-white">{formatCurrency(d.value)}</span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>

        {/* ── Top productos + Ventas por hora ──────────────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Top productos */}
          <div className="bg-slate-800 border border-slate-700 rounded-xl p-5">
            <h3 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
                <Package size={15} className="text-amber-400" /> {t('stats.topProducts')}
            </h3>
            {(stats.top_productos ?? []).length === 0 ? (
              <div className="flex items-center justify-center h-40 text-slate-600 text-sm">{t('stats.noTopProducts')}</div>
            ) : (
              <div className="space-y-3">
                {stats.top_productos.slice(0, 7).map((p, i) => {
                  const pct = maxProductoTotal > 0 ? (p.total / maxProductoTotal) * 100 : 0;
                  return (
                    <div key={i}>
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="text-xs text-slate-600 font-mono w-4 shrink-0">#{i + 1}</span>
                          <span className="text-sm text-slate-300 truncate">{p.nombre}</span>
                        </div>
                        <div className="text-right shrink-0 ml-2">
                          <span className="text-sm font-mono text-white">{formatCurrency(p.total)}</span>
                          <span className="text-xs text-slate-500 ml-1.5">{p.cantidad} u.</span>
                        </div>
                      </div>
                      <div className="h-1.5 bg-slate-700 rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all"
                          style={{ width: `${pct}%`, backgroundColor: COLORS[i % COLORS.length] }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Ventas por hora hoy */}
          <div className="bg-slate-800 border border-slate-700 rounded-xl p-5">
            <h3 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
                <Clock size={15} className="text-violet-400" /> {t('stats.hourly')}
            </h3>
            {(stats.ventas_por_hora ?? []).length === 0 ? (
              <div className="flex items-center justify-center h-48 text-slate-600 text-sm">{t('stats.noHourly')}</div>
            ) : (
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={stats.ventas_por_hora} margin={{ top: 5, right: 5, bottom: 0, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                  <XAxis dataKey="hora" tick={{ fill: '#64748b', fontSize: 10 }} tickFormatter={(h) => `${h}h`} />
                  <YAxis tick={{ fill: '#64748b', fontSize: 10 }} width={30} />
                  <Tooltip content={<CustomTooltipCurrency />} />
                  <Bar dataKey="cantidad" name="Cantidad" fill="#8b5cf6" radius={[3, 3, 0, 0]} maxBarSize={28} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* ── Alertas de stock ──────────────────────────────────────── */}
        {(stats.alertas_stock ?? []).length > 0 && (
          <div className="bg-yellow-500/5 border border-yellow-500/20 rounded-xl p-4">
            <h3 className="text-sm font-semibold text-yellow-400 mb-3 flex items-center gap-2">
                <AlertTriangle size={15} /> {t('stats.stockAlerts')}
            </h3>
            <div className="grid grid-cols-2 lg:grid-cols-5 gap-2">
              {stats.alertas_stock.map((a, i) => (
                <div key={i} className="bg-slate-800 rounded-lg p-3 border border-yellow-500/10">
                  <div className="text-xs text-slate-400 truncate mb-1">{a.nombre}</div>
                  <div className="text-lg font-bold font-mono text-yellow-400">{a.stock_actual}</div>
                  <div className="text-xs text-slate-600">{t('stats.minLabel')} {a.stock_minimo}</div>
                </div>
              ))}
            </div>
          </div>
        )}

      </div>
    </div>
  );
};
