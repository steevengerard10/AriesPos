import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Toast from 'react-native-toast-message';
import apiClient from '../api/client';

export default function VentasHoyScreen() {
  const [sales, setSales] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedSale, setSelectedSale] = useState(null);

  const load = async () => {
    setLoading(true);
    try {
      const response = await apiClient.get('/api/ventas/hoy');
      setSales(Array.isArray(response.data) ? response.data : []);
    } catch (error) {
      Toast.show({ type: 'error', text1: 'Error', text2: error.message || 'No se pudieron cargar ventas' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const summary = useMemo(() => {
    const totalVentas = sales.length;
    const totalMonto = sales.reduce((sum, sale) => sum + Number(sale.total || 0), 0);
    const promedio = totalVentas === 0 ? 0 : totalMonto / totalVentas;
    return { totalVentas, totalMonto, promedio };
  }, [sales]);

  return (
    <View style={styles.screen}>
      <Text style={styles.title}>Ventas hoy</Text>

      <View style={styles.summaryCard}>
        <Text style={styles.summaryValue}>{summary.totalVentas}</Text>
        <Text style={styles.summaryLabel}>ventas registradas</Text>
        <Text style={styles.summaryValue}>${summary.totalMonto.toFixed(2)}</Text>
        <Text style={styles.summaryLabel}>monto total</Text>
        <Text style={styles.summaryValue}>${summary.promedio.toFixed(2)}</Text>
        <Text style={styles.summaryLabel}>promedio por venta</Text>
      </View>

      {loading ? (
        <View style={styles.loadingBox}><ActivityIndicator size="large" color="#6c63ff" /><Text style={styles.loadingText}>Cargando...</Text></View>
      ) : (
        <ScrollView showsVerticalScrollIndicator={false}>
          {sales.map((sale) => (
            <Pressable key={String(sale.id)} onPress={() => setSelectedSale(sale)} style={styles.saleCard}>
              <View>
                <Text style={styles.saleTime}>{new Date(sale.fecha || sale.createdAt || Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</Text>
                <Text style={styles.saleMeta}>{sale.metodoPago || 'Efectivo'} • {sale.items?.length || 0} ítems</Text>
              </View>
              <Text style={styles.saleTotal}>${Number(sale.total || 0).toFixed(2)}</Text>
            </Pressable>
          ))}
        </ScrollView>
      )}

      <Modal visible={!!selectedSale} transparent animationType="slide" onRequestClose={() => setSelectedSale(null)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Detalle de venta</Text>
            <Text style={styles.modalText}>Método: {selectedSale?.metodoPago || 'Efectivo'}</Text>
            <Text style={styles.modalText}>Total: ${Number(selectedSale?.total || 0).toFixed(2)}</Text>
            {selectedSale?.items?.map((item) => (
              <Text key={String(item.id)} style={styles.modalItem}>{item.quantity}x {item.nombre || item.name} — ${Number(item.total || 0).toFixed(2)}</Text>
            ))}
            <Pressable onPress={() => setSelectedSale(null)} style={styles.modalCloseButton}><Text style={styles.modalCloseText}>Cerrar</Text></Pressable>
          </View>
        </View>
      </Modal>
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
  summaryCard: {
    backgroundColor: '#1a1d27',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#2e3247',
    padding: 14,
    marginBottom: 10,
  },
  summaryLabel: {
    color: '#b0b3c1',
    marginTop: 4,
  },
  summaryValue: {
    color: '#fff',
    fontWeight: '900',
    fontSize: 20,
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
  saleCard: {
    backgroundColor: '#1a1d27',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#2e3247',
    padding: 12,
    marginBottom: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  saleTime: {
    color: '#fff',
    fontWeight: '900',
  },
  saleMeta: {
    color: '#b0b3c1',
    marginTop: 3,
  },
  saleTotal: {
    color: '#6c63ff',
    fontWeight: '900',
    fontSize: 16,
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.6)',
    padding: 18,
  },
  modalCard: {
    backgroundColor: '#0f1117',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#2e3247',
    padding: 16,
  },
  modalTitle: {
    color: '#fff',
    fontWeight: '900',
    fontSize: 18,
  },
  modalText: {
    color: '#e8eaf6',
    marginTop: 8,
  },
  modalItem: {
    color: '#b0b3c1',
    marginTop: 6,
  },
  modalCloseButton: {
    marginTop: 12,
    backgroundColor: '#6c63ff',
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center',
  },
  modalCloseText: {
    color: '#fff',
    fontWeight: '900',
  },
});
