import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Toast from 'react-native-toast-message';
import apiClient from '../api/client';

export default function FiadosScreen() {
  const [fiados, setFiados] = useState([]);
  const [filter, setFilter] = useState('pendiente');
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const response = await apiClient.get('/api/fiados');
      setFiados(Array.isArray(response.data) ? response.data : []);
    } catch (error) {
      Toast.show({ type: 'error', text1: 'Error', text2: error.message || 'No se pudo cargar fiados' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const filtered = useMemo(() => fiados.filter((item) => filter === 'todos' ? true : (item.estado || 'pendiente').toLowerCase() === filter), [fiados, filter]);

  const cobrar = async (fiado) => {
    try {
      await apiClient.put(`/api/fiados/${fiado.id}/cobrar`);
      setFiados((current) => current.map((item) => item.id === fiado.id ? { ...item, estado: 'cobrado' } : item));
      Toast.show({ type: 'success', text1: 'Fiado cobrado', text2: 'Se marcó como pagado' });
    } catch (error) {
      Toast.show({ type: 'error', text1: 'Error', text2: error.message || 'No se pudo cobrar' });
    }
  };

  return (
    <View style={styles.screen}>
      <Text style={styles.title}>Fiados</Text>
      <View style={styles.filterRow}>
        {['pendiente', 'cobrado', 'todos'].map((option) => (
          <Pressable key={option} onPress={() => setFilter(option)} style={[styles.filterChip, filter === option && styles.filterChipActive]}>
            <Text style={[styles.filterText, filter === option && styles.filterTextActive]}>{option}</Text>
          </Pressable>
        ))}
      </View>

      {loading ? (
        <View style={styles.loadingBox}><ActivityIndicator size="large" color="#6c63ff" /><Text style={styles.loadingText}>Cargando...</Text></View>
      ) : (
        <ScrollView showsVerticalScrollIndicator={false}>
          {filtered.map((fiado) => (
            <View key={String(fiado.id)} style={styles.card}>
              <View style={styles.cardInfo}>
                <Text style={styles.clientName}>{fiado.cliente || fiado.clienteId || 'Cliente'}</Text>
                <Text style={styles.meta}>Saldo: ${Number(fiado.total || 0).toFixed(2)}</Text>
                <Text style={styles.meta}>Estado: {fiado.estado || 'pendiente'}</Text>
              </View>
              {fiado.estado !== 'cobrado' ? (
                <Pressable onPress={() => cobrar(fiado)} style={styles.cobrarButton}><Text style={styles.cobrarText}>[Cobrar]</Text></Pressable>
              ) : null}
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
  filterRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 10,
  },
  filterChip: {
    borderRadius: 999,
    backgroundColor: '#252836',
    borderWidth: 1,
    borderColor: '#2e3247',
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  filterChipActive: {
    backgroundColor: '#6c63ff',
    borderColor: '#6c63ff',
  },
  filterText: {
    color: '#b0b3c1',
    fontWeight: '800',
    textTransform: 'capitalize',
  },
  filterTextActive: {
    color: '#fff',
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
    backgroundColor: '#1a1d27',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#2e3247',
    padding: 12,
    marginBottom: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  clientName: {
    color: '#fff',
    fontWeight: '900',
  },
  meta: {
    color: '#b0b3c1',
    marginTop: 3,
  },
  cobrarButton: {
    backgroundColor: '#4caf50',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  cobrarText: {
    color: '#fff',
    fontWeight: '900',
  },
});
