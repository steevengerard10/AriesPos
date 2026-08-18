import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import Toast from 'react-native-toast-message';
import apiClient from '../api/client';

export default function StockScreen() {
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const response = await apiClient.get('/api/stock/alertas');
      setAlerts(Array.isArray(response.data) ? response.data : []);
    } catch (error) {
      Toast.show({ type: 'error', text1: 'Error', text2: error.message || 'No se pudo cargar alertas' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const updateStock = async (product, value) => {
    try {
      await apiClient.put(`/api/productos/${product.id}`, { ...product, stock: Number(value) });
      setAlerts((current) => current.map((item) => item.id === product.id ? { ...item, stock: Number(value) } : item));
      Toast.show({ type: 'success', text1: 'Stock actualizado', text2: product.nombre || product.name });
    } catch (error) {
      Toast.show({ type: 'error', text1: 'Error', text2: error.message || 'No se pudo actualizar' });
    }
  };

  return (
    <View style={styles.screen}>
      <Text style={styles.title}>Stock</Text>
      {loading ? (
        <View style={styles.loadingBox}><ActivityIndicator size="large" color="#6c63ff" /><Text style={styles.loadingText}>Cargando alertas...</Text></View>
      ) : (
        <ScrollView showsVerticalScrollIndicator={false}>
          {alerts.map((alertItem) => (
            <View key={String(alertItem.id)} style={[styles.card, Number(alertItem.stock || 0) === 0 ? styles.cardAlert : styles.cardWarning]}>
              <View style={styles.cardInfo}>
                <Text style={styles.productName}>{alertItem.nombre || alertItem.name}</Text>
                <Text style={styles.meta}>Categoría: {alertItem.categoria || alertItem.category || 'General'}</Text>
                <Text style={styles.meta}>Stock actual: {alertItem.stock}</Text>
              </View>
              <TextInput
                value={String(alertItem.stock ?? '')}
                onChangeText={(val) => setAlerts((current) => current.map((item) => item.id === alertItem.id ? { ...item, stock: Number(val || 0) } : item))}
                keyboardType="numeric"
                style={styles.stockInput}
              />
              <Pressable onPress={() => updateStock(alertItem, alertItem.stock)} style={styles.saveButton}><Text style={styles.saveText}>Guardar</Text></Pressable>
            </View>
          ))}
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
  card: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 12,
    marginBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  cardAlert: {
    backgroundColor: 'rgba(229,57,53,0.18)',
    borderColor: '#e53935',
  },
  cardWarning: {
    backgroundColor: 'rgba(255,193,7,0.14)',
    borderColor: '#ffc107',
  },
  cardInfo: {
    flex: 1,
  },
  productName: {
    color: '#fff',
    fontWeight: '900',
  },
  meta: {
    color: '#b0b3c1',
    marginTop: 3,
  },
  stockInput: {
    width: 60,
    backgroundColor: '#1a1d27',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#2e3247',
    color: '#fff',
    paddingHorizontal: 8,
    paddingVertical: 6,
    marginHorizontal: 8,
    textAlign: 'center',
  },
  saveButton: {
    backgroundColor: '#6c63ff',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  saveText: {
    color: '#fff',
    fontWeight: '800',
  },
});
