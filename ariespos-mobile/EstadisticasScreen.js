import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  StyleSheet, ActivityIndicator, RefreshControl,
} from 'react-native';
import { statsAPI } from '../api/stats';

const COLORES = {
  fondo: '#0f172a', tarjeta: '#1e293b', borde: '#334155',
  primario: '#6366f1', verde: '#22c55e', amarillo: '#f59e0b',
  rojo: '#ef4444', texto: '#f1f5f9', textoSub: '#94a3b8',
};

const PERIODOS = [
  { id: 'semana', label: '7 días' },
  { id: 'mes', label: '30 días' },
  { id: 'año', label: '12 meses' },
];

const COLORES_BARRA = ['#6366f1', '#818cf8', '#a5b4fc', '#c4b5fd', '#ddd6fe'];

/** Barra horizontal simple, sin dependencias externas */
function BarraHorizontal({ label, valor, maximo, color = COLORES.primario, prefijo = '$' }) {
  const pct = maximo > 0 ? (valor / maximo) * 100 : 0;
  return (
    <View style={est.barraFila}>
      <Text style={est.barraLabel} numberOfLines={1}>{label}</Text>
      <View style={est.barraPista}>
        <View style={[est.barraRelleno, { width: `${Math.max(pct, 2)}%`, backgroundColor: color }]} />
      </View>
      <Text style={est.barraValor}>{prefijo}{Number(valor).toFixed(2)}</Text>
    </View>
  );
}

/** Mini barras verticales para ventas diarias */
function GraficoBarras({ datos = [], label = 'Ventas' }) {
  const maximo = Math.max(...datos.map((d) => d.valor ?? 0), 1);

  return (
    <View style={est.grafContenedor}>
      <View style={est.grafBarras}>
        {datos.map((d, i) => {
          const pct = ((d.valor ?? 0) / maximo) * 100;
          return (
            <View key={i} style={est.grafColumna}>
              <View style={[est.grafBarra, { height: `${Math.max(pct, 2)}%`, backgroundColor: COLORES.primario }]} />
              <Text style={est.grafEtiqueta} numberOfLines={1}>{d.etiqueta}</Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}

/** Torta de texto para métodos de pago */
function TortaMetodos({ datos = [] }) {
  const total = datos.reduce((s, d) => s + (d.total ?? 0), 0);
  const coloresMetodos = {
    efectivo: COLORES.verde, tarjeta: COLORES.primario,
    transferencia: COLORES.amarillo, qr: '#06b6d4', fiado: COLORES.rojo,
  };

  return (
    <View>
      {datos.map((d, i) => {
        const pct = total > 0 ? ((d.total / total) * 100).toFixed(1) : '0';
        const color = coloresMetodos[d.metodo] ?? COLORES_BARRA[i % COLORES_BARRA.length];
        return (
          <View key={d.metodo} style={est.metodoFila}>
            <View style={[est.metodoDot, { backgroundColor: color }]} />
            <Text style={est.metodoNombre}>{d.metodo}</Text>
            <Text style={est.metodoPct}>{pct}%</Text>
            <Text style={est.metodoValor}>${Number(d.total).toFixed(2)}</Text>
          </View>
        );
      })}
    </View>
  );
}

export default function EstadisticasScreen() {
  const [periodo, setPeriodo] = useState('semana');
  const [ventas, setVentas] = useState([]);
  const [topProductos, setTopProductos] = useState([]);
  const [metodosPago, setMetodosPago] = useState([]);
  const [caja, setCaja] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);

  const cargar = useCallback(async () => {
    try {
      setError(null);
      const [ventasData, topData, metodosData, cajaData] = await Promise.all([
        statsAPI.ventas(periodo),
        statsAPI.topProductos(8),
        statsAPI.metodosPago(periodo),
        statsAPI.caja(),
      ]);
      setVentas(ventasData?.datos ?? []);
      setTopProductos(topData?.productos ?? []);
      setMetodosPago(metodosData?.datos ?? []);
      setCaja(cajaData);
    } catch (e) {
      setError(e.message);
    } finally {
      setCargando(false);
      setRefreshing(false);
    }
  }, [periodo]);

  useEffect(() => { cargar(); }, [cargar]);

  const onRefresh = () => { setRefreshing(true); cargar(); };

  const maxVenta = Math.max(...topProductos.map((p) => p.totalVendido ?? 0), 1);

  return (
    <ScrollView
      style={est.contenedor}
      contentContainerStyle={est.scroll}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORES.primario} />}
    >
      <Text style={est.titulo}>Estadísticas</Text>

      {/* Selector de período */}
      <View style={est.periodoRow}>
        {PERIODOS.map((p) => (
          <TouchableOpacity
            key={p.id}
            style={[est.periodoBtn, periodo === p.id && est.periodoBtnActivo]}
            onPress={() => setPeriodo(p.id)}
          >
            <Text style={[est.periodoBtnText, periodo === p.id && { color: '#fff' }]}>{p.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {error && (
        <View style={est.errorBox}>
          <Text style={est.errorTexto}>⚠ {error}</Text>
        </View>
      )}

      {cargando ? (
        <ActivityIndicator color={COLORES.primario} style={{ marginTop: 40 }} />
      ) : (
        <>
          {/* Resumen caja */}
          {caja && (
            <View style={est.seccion}>
              <Text style={est.seccionTitulo}>Caja del día</Text>
              <View style={est.cajaGrid}>
                {[
                  { label: 'Efectivo', valor: caja.efectivo, color: COLORES.verde },
                  { label: 'Tarjeta', valor: caja.tarjeta, color: COLORES.primario },
                  { label: 'Transferencia', valor: caja.transferencia, color: COLORES.amarillo },
                  { label: 'Total', valor: caja.total, color: COLORES.texto },
                ].map((c) => (
                  <View key={c.label} style={est.cajaCard}>
                    <Text style={est.cajaLabel}>{c.label}</Text>
                    <Text style={[est.cajaValor, { color: c.color }]}>${Number(c.valor ?? 0).toFixed(2)}</Text>
                  </View>
                ))}
              </View>
            </View>
          )}

          {/* Gráfico de ventas */}
          {ventas.length > 0 && (
            <View style={est.seccion}>
              <Text style={est.seccionTitulo}>Ventas — {PERIODOS.find(p => p.id === periodo)?.label}</Text>
              <GraficoBarras datos={ventas.map((v) => ({ valor: v.total, etiqueta: v.etiqueta ?? v.fecha }))} />
            </View>
          )}

          {/* Top productos */}
          {topProductos.length > 0 && (
            <View style={est.seccion}>
              <Text style={est.seccionTitulo}>Top productos</Text>
              {topProductos.map((p, i) => (
                <BarraHorizontal
                  key={p.id}
                  label={p.nombre}
                  valor={p.totalVendido ?? 0}
                  maximo={maxVenta}
                  color={COLORES_BARRA[i % COLORES_BARRA.length]}
                />
              ))}
            </View>
          )}

          {/* Métodos de pago */}
          {metodosPago.length > 0 && (
            <View style={est.seccion}>
              <Text style={est.seccionTitulo}>Métodos de pago</Text>
              <TortaMetodos datos={metodosPago} />
            </View>
          )}
        </>
      )}
    </ScrollView>
  );
}

const est = StyleSheet.create({
  contenedor: { flex: 1, backgroundColor: COLORES.fondo },
  scroll: { padding: 16, paddingBottom: 32 },
  titulo: { color: COLORES.texto, fontSize: 22, fontWeight: '800', marginBottom: 16 },

  periodoRow: { flexDirection: 'row', gap: 8, marginBottom: 20 },
  periodoBtn: {
    flex: 1, backgroundColor: COLORES.tarjeta,
    borderRadius: 8, padding: 10, alignItems: 'center',
    borderWidth: 1, borderColor: COLORES.borde,
  },
  periodoBtnActivo: { backgroundColor: COLORES.primario, borderColor: COLORES.primario },
  periodoBtnText: { color: COLORES.textoSub, fontWeight: '600' },

  errorBox: { backgroundColor: '#450a0a', borderRadius: 10, padding: 12, marginBottom: 12 },
  errorTexto: { color: COLORES.rojo, fontSize: 13 },

  seccion: {
    backgroundColor: COLORES.tarjeta, borderRadius: 14,
    padding: 16, marginBottom: 14, borderWidth: 1, borderColor: COLORES.borde,
  },
  seccionTitulo: { color: COLORES.texto, fontSize: 15, fontWeight: '700', marginBottom: 14 },

  cajaGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  cajaCard: {
    backgroundColor: COLORES.fondo, borderRadius: 8,
    padding: 10, flex: 1, minWidth: '45%',
  },
  cajaLabel: { color: COLORES.textoSub, fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.5 },
  cajaValor: { fontSize: 18, fontWeight: '700', marginTop: 4 },

  grafContenedor: { height: 140 },
  grafBarras: { flex: 1, flexDirection: 'row', alignItems: 'flex-end', gap: 4 },
  grafColumna: { flex: 1, alignItems: 'center', height: '100%', justifyContent: 'flex-end' },
  grafBarra: { width: '70%', borderRadius: 4, minHeight: 4 },
  grafEtiqueta: { color: COLORES.textoSub, fontSize: 8, marginTop: 4 },

  barraFila: { flexDirection: 'row', alignItems: 'center', marginBottom: 8, gap: 8 },
  barraLabel: { color: COLORES.texto, fontSize: 12, width: 100 },
  barraPista: { flex: 1, height: 8, backgroundColor: COLORES.fondo, borderRadius: 4, overflow: 'hidden' },
  barraRelleno: { height: '100%', borderRadius: 4 },
  barraValor: { color: COLORES.textoSub, fontSize: 11, width: 70, textAlign: 'right' },

  metodoFila: { flexDirection: 'row', alignItems: 'center', paddingVertical: 6, gap: 10 },
  metodoDot: { width: 10, height: 10, borderRadius: 5 },
  metodoNombre: { flex: 1, color: COLORES.texto, fontSize: 14, textTransform: 'capitalize' },
  metodoPct: { color: COLORES.textoSub, fontSize: 12, width: 40, textAlign: 'right' },
  metodoValor: { color: COLORES.verde, fontWeight: '700', fontSize: 13, width: 80, textAlign: 'right' },
});
