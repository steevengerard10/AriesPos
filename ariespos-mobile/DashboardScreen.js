import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  RefreshControl, StyleSheet, ActivityIndicator,
} from 'react-native';
import { statsAPI } from '../api/stats';
import { ventasAPI } from '../api/ventas';
import { useSocket } from '../hooks/useSocket';

const COLORES = {
  fondo: '#0f172a',
  tarjeta: '#1e293b',
  borde: '#334155',
  primario: '#6366f1',
  verde: '#22c55e',
  amarillo: '#f59e0b',
  rojo: '#ef4444',
  texto: '#f1f5f9',
  textoSub: '#94a3b8',
};

function StatCard({ titulo, valor, subtitulo, color = COLORES.primario, prefijo = '' }) {
  return (
    <View style={[styles.card, { borderLeftColor: color }]}>
      <Text style={styles.cardTitulo}>{titulo}</Text>
      <Text style={[styles.cardValor, { color }]}>
        {prefijo}{valor ?? '—'}
      </Text>
      {subtitulo ? <Text style={styles.cardSub}>{subtitulo}</Text> : null}
    </View>
  );
}

function AlertaItem({ alerta }) {
  const color = alerta.tipo === 'error' ? COLORES.rojo
    : alerta.tipo === 'warning' ? COLORES.amarillo
    : COLORES.verde;

  return (
    <View style={[styles.alertaRow, { borderLeftColor: color }]}>
      <Text style={[styles.alertaTitulo, { color }]}>{alerta.titulo}</Text>
      <Text style={styles.alertaMensaje}>{alerta.mensaje}</Text>
    </View>
  );
}

export default function DashboardScreen({ navigation }) {
  const { connected, on } = useSocket();
  const [datos, setDatos] = useState(null);
  const [fiados, setFiados] = useState([]);
  const [alertas, setAlertas] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(null);
  const [refreshing, setRefreshing] = useState(false);

  const cargarDatos = useCallback(async () => {
    try {
      setError(null);
      const [dash, fiadosData] = await Promise.all([
        statsAPI.dashboard(),
        ventasAPI.getFiados(),
      ]);
      setDatos(dash);
      setFiados(fiadosData?.fiados ?? []);
    } catch (e) {
      setError(e.message);
    } finally {
      setCargando(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    cargarDatos();
  }, [cargarDatos]);

  // Actualizaciones en tiempo real via Socket.IO
  useEffect(() => {
    const unsubVenta = on('venta:nueva', () => cargarDatos());
    const unsubStock = on('stock:bajo', (data) => {
      setAlertas((prev) => [
        { id: Date.now(), tipo: 'warning', titulo: 'Stock bajo', mensaje: data.mensaje },
        ...prev.slice(0, 4),
      ]);
    });
    const unsubAlerta = on('alerta', (data) => {
      setAlertas((prev) => [
        { id: Date.now(), ...data },
        ...prev.slice(0, 4),
      ]);
    });

    return () => { unsubVenta?.(); unsubStock?.(); unsubAlerta?.(); };
  }, [on, cargarDatos]);

  const onRefresh = () => {
    setRefreshing(true);
    cargarDatos();
  };

  const fmt = (n) => {
    if (n == null) return '—';
    return Number(n).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  if (cargando) {
    return (
      <View style={styles.centrado}>
        <ActivityIndicator size="large" color={COLORES.primario} />
        <Text style={styles.textoSub}>Cargando dashboard…</Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.contenedor}
      contentContainerStyle={styles.scroll}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORES.primario} />}
    >
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.titulo}>ARIESPos</Text>
          <Text style={styles.subtitulo}>Dashboard — Hoy</Text>
        </View>
        <View style={[styles.dot, { backgroundColor: connected ? COLORES.verde : COLORES.rojo }]}>
          <Text style={styles.dotText}>{connected ? 'EN VIVO' : 'OFFLINE'}</Text>
        </View>
      </View>

      {error && (
        <View style={styles.errorBox}>
          <Text style={styles.errorTexto}>⚠ {error}</Text>
          <TouchableOpacity onPress={cargarDatos}><Text style={styles.retryTexto}>Reintentar</Text></TouchableOpacity>
        </View>
      )}

      {/* Stat cards */}
      <View style={styles.grid}>
        <StatCard
          titulo="Ventas del día"
          valor={datos?.ventasHoy ?? 0}
          subtitulo={`${datos?.cantidadVentas ?? 0} transacciones`}
          color={COLORES.verde}
          prefijo="$"
        />
        <StatCard
          titulo="Fiados pendientes"
          valor={fmt(datos?.fiadosPendientes)}
          subtitulo={`${fiados.length} clientes`}
          color={COLORES.amarillo}
          prefijo="$"
        />
        <StatCard
          titulo="Productos vendidos"
          valor={datos?.productosVendidos ?? 0}
          color={COLORES.primario}
        />
        <StatCard
          titulo="Ticket promedio"
          valor={fmt(datos?.ticketPromedio)}
          color="#a78bfa"
          prefijo="$"
        />
      </View>

      {/* Accesos rápidos */}
      <Text style={styles.seccionTitulo}>Acciones rápidas</Text>
      <View style={styles.acciones}>
        <TouchableOpacity style={[styles.botonAccion, { backgroundColor: COLORES.primario }]}
          onPress={() => navigation.navigate('POS')}>
          <Text style={styles.botonIcon}>🛒</Text>
          <Text style={styles.botonTexto}>Nueva venta</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.botonAccion, { backgroundColor: '#0f766e' }]}
          onPress={() => navigation.navigate('Productos')}>
          <Text style={styles.botonIcon}>📦</Text>
          <Text style={styles.botonTexto}>Productos</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.botonAccion, { backgroundColor: '#b45309' }]}
          onPress={() => navigation.navigate('Estadisticas')}>
          <Text style={styles.botonIcon}>📊</Text>
          <Text style={styles.botonTexto}>Estadísticas</Text>
        </TouchableOpacity>
      </View>

      {/* Alertas recientes */}
      {alertas.length > 0 && (
        <>
          <Text style={styles.seccionTitulo}>Alertas recientes</Text>
          {alertas.map((a) => <AlertaItem key={a.id} alerta={a} />)}
        </>
      )}

      {/* Fiados pendientes */}
      {fiados.length > 0 && (
        <>
          <Text style={styles.seccionTitulo}>Fiados pendientes</Text>
          {fiados.slice(0, 5).map((f) => (
            <View key={f.id} style={styles.fiadoRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.fiadoNombre}>{f.clienteNombre ?? 'Sin nombre'}</Text>
                <Text style={styles.fiadoFecha}>{f.fecha}</Text>
              </View>
              <Text style={[styles.fiadoMonto, { color: COLORES.amarillo }]}>${fmt(f.total)}</Text>
            </View>
          ))}
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  contenedor: { flex: 1, backgroundColor: COLORES.fondo },
  scroll: { padding: 16, paddingBottom: 32 },
  centrado: { flex: 1, backgroundColor: COLORES.fondo, justifyContent: 'center', alignItems: 'center', gap: 12 },
  textoSub: { color: COLORES.textoSub, fontSize: 14 },

  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  titulo: { color: COLORES.texto, fontSize: 22, fontWeight: '800' },
  subtitulo: { color: COLORES.textoSub, fontSize: 13 },
  dot: { borderRadius: 12, paddingHorizontal: 8, paddingVertical: 4 },
  dotText: { color: '#fff', fontSize: 10, fontWeight: '700' },

  errorBox: {
    backgroundColor: '#450a0a', borderRadius: 10, padding: 12,
    marginBottom: 12, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
  },
  errorTexto: { color: COLORES.rojo, fontSize: 13, flex: 1 },
  retryTexto: { color: COLORES.primario, fontSize: 13, fontWeight: '600' },

  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 20 },
  card: {
    backgroundColor: COLORES.tarjeta, borderRadius: 12,
    padding: 14, flex: 1, minWidth: '45%',
    borderLeftWidth: 3,
  },
  cardTitulo: { color: COLORES.textoSub, fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 },
  cardValor: { fontSize: 22, fontWeight: '800' },
  cardSub: { color: COLORES.textoSub, fontSize: 11, marginTop: 2 },

  seccionTitulo: { color: COLORES.texto, fontSize: 15, fontWeight: '700', marginBottom: 10, marginTop: 8 },

  acciones: { flexDirection: 'row', gap: 10, marginBottom: 20 },
  botonAccion: { flex: 1, borderRadius: 12, paddingVertical: 14, alignItems: 'center', gap: 4 },
  botonIcon: { fontSize: 22 },
  botonTexto: { color: '#fff', fontSize: 12, fontWeight: '600' },

  alertaRow: {
    backgroundColor: COLORES.tarjeta, borderRadius: 8,
    padding: 12, marginBottom: 6, borderLeftWidth: 3,
  },
  alertaTitulo: { fontWeight: '700', fontSize: 13, marginBottom: 2 },
  alertaMensaje: { color: COLORES.textoSub, fontSize: 12 },

  fiadoRow: {
    backgroundColor: COLORES.tarjeta, borderRadius: 8,
    padding: 12, marginBottom: 6, flexDirection: 'row', alignItems: 'center',
  },
  fiadoNombre: { color: COLORES.texto, fontSize: 14, fontWeight: '600' },
  fiadoFecha: { color: COLORES.textoSub, fontSize: 11 },
  fiadoMonto: { fontSize: 16, fontWeight: '700' },
});
