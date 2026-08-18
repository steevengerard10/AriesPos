import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Toast from 'react-native-toast-message';
import apiClient from '../api/client';

const chartConfig = {
  backgroundGradientFrom: '#0f1117',
  backgroundGradientTo: '#0f1117',
  decimalPlaces: 0,
  color: (opacity = 1) => `rgba(108, 99, 255, ${opacity})`,
  labelColor: (opacity = 1) => `rgba(232, 234, 246, ${opacity})`,
  propsForDots: {
    r: '4',
    strokeWidth: '2',
    stroke: '#6c63ff',
  },
};

export default function ReportesScreen() {
  const [stats, setStats] = useState({ totalVentas: 0, totalProductos: 0, totalClientes: 0 });
  const [loading, setLoading] = useState(true);
  const [cachedSales, setCachedSales] = useState([]);
  const [chartLibrary, setChartLibrary] = useState(null);

  const LineChart = chartLibrary?.LineChart;
  const PieChart = chartLibrary?.PieChart;

  useEffect(() => {
    let mounted = true;
    import('react-native-chart-kit').then((module) => {
      if (mounted) {
        setChartLibrary(module);
      }
    }).catch((error) => {
      console.error('Error loading charts', error);
    });

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const response = await apiClient.get('/api/stats');
        setStats({
          totalVentas: response.data?.totalVentas || 0,
          totalProductos: response.data?.totalProductos || 0,
          totalClientes: response.data?.totalClientes || 0,
        });
        const pending = JSON.parse((await AsyncStorage.getItem('pendingSales')) || '[]');
        setCachedSales(pending);
      } catch (error) {
        Toast.show({ type: 'error', text1: 'Error', text2: error.message || 'No se pudieron cargar reportes' });
      } finally {
        setLoading(false);
      }
    };

    load();
  }, []);

  const trendData = useMemo(() => {
    const labels = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];
    const values = labels.map((_, index) => cachedSales.slice(index * 2, (index + 1) * 2).reduce((sum, sale) => sum + Number(sale.total || 0), 0));
    return {
      labels,
      datasets: [
        {
          data: values,
          color: (opacity = 1) => `rgba(108, 99, 255, ${opacity})`,
          strokeWidth: 2,
        },
      ],
    };
  }, [cachedSales]);

  const paymentBreakdown = [
    { name: 'Efectivo', population: cachedSales.filter((sale) => sale.metodoPago === 'Efectivo').length, color: '#4caf50', legendFontColor: '#fff', legendFontSize: 12 },
    { name: 'Tarjeta', population: cachedSales.filter((sale) => sale.metodoPago === 'Tarjeta').length, color: '#6c63ff', legendFontColor: '#fff', legendFontSize: 12 },
    { name: 'Transferencia', population: cachedSales.filter((sale) => sale.metodoPago === 'Transferencia').length, color: '#ffc107', legendFontColor: '#fff', legendFontSize: 12 },
    { name: 'Fiado', population: cachedSales.filter((sale) => sale.metodoPago === 'Fiado').length, color: '#e53935', legendFontColor: '#fff', legendFontSize: 12 },
  ];

  const topProducts = useMemo(() => {
    const counts = {};
    cachedSales.forEach((sale) => {
      sale.items?.forEach((item) => {
        counts[item.nombre || item.name] = (counts[item.nombre || item.name] || 0) + Number(item.quantity || 0);
      });
    });

    return Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 5);
  }, [cachedSales]);

  return (
    <View style={styles.screen}>
      <Text style={styles.title}>Reportes</Text>
      {loading ? (
        <View style={styles.loadingBox}><ActivityIndicator size="large" color="#6c63ff" /><Text style={styles.loadingText}>Cargando...</Text></View>
      ) : (
        <ScrollView showsVerticalScrollIndicator={false}>
          <View style={styles.summaryRow}>
            {[
              { label: 'Ventas', value: stats.totalVentas },
              { label: 'Productos', value: stats.totalProductos },
              { label: 'Clientes', value: stats.totalClientes },
            ].map((item) => (
              <View key={item.label} style={styles.summaryCard}>
                <Text style={styles.summaryValue}>{item.value}</Text>
                <Text style={styles.summaryLabel}>{item.label}</Text>
              </View>
            ))}
          </View>

          <View style={styles.chartCard}>
            <Text style={styles.chartTitle}>Ventas últimas 7 días</Text>
            {LineChart ? (
              <LineChart
                data={trendData}
                width={320}
                height={220}
                chartConfig={chartConfig}
                bezier
                style={styles.chart}
              />
            ) : (
              <Text style={styles.loadingText}>Cargando gráficos...</Text>
            )}
          </View>

          <View style={styles.chartCard}>
            <Text style={styles.chartTitle}>Top 5 productos</Text>
            {topProducts.map(([name, qty]) => (
              <View key={name} style={styles.listRow}>
                <Text style={styles.listText}>{name}</Text>
                <Text style={styles.listCount}>{qty}</Text>
              </View>
            ))}
          </View>

          <View style={styles.chartCard}>
            <Text style={styles.chartTitle}>Métodos de pago</Text>
            {PieChart ? (
              <PieChart
                data={paymentBreakdown}
                width={320}
                height={220}
                chartConfig={chartConfig}
                accessor="population"
                backgroundColor="transparent"
                paddingLeft="15"
                absolute
              />
            ) : (
              <Text style={styles.loadingText}>Cargando gráficos...</Text>
            )}
          </View>
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#0f1117',
    padding: 12,
  },
  title: {
    color: '#fff',
    fontSize: 24,
    fontWeight: '900',
    marginBottom: 10,
  },
  loadingBox: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: '#e8eaf6',
    marginTop: 8,
  },
  summaryRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 10,
  },
  summaryCard: {
    flex: 1,
    backgroundColor: '#1a1d27',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#2e3247',
    padding: 12,
  },
  summaryValue: {
    color: '#fff',
    fontWeight: '900',
    fontSize: 20,
  },
  summaryLabel: {
    color: '#b0b3c1',
    marginTop: 4,
  },
  chartCard: {
    backgroundColor: '#1a1d27',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#2e3247',
    padding: 12,
    marginBottom: 10,
  },
  chartTitle: {
    color: '#fff',
    fontWeight: '900',
    marginBottom: 10,
  },
  chart: {
    borderRadius: 16,
    alignSelf: 'center',
  },
  listRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  listText: {
    color: '#e8eaf6',
    fontWeight: '700',
  },
  listCount: {
    color: '#6c63ff',
    fontWeight: '900',
  },
});
