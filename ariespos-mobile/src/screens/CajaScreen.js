import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import Toast from 'react-native-toast-message';
import apiClient from '../api/client';
import { useAuth } from '../context/AuthContext';

const emptyMovement = { tipo: 'ingreso', monto: '0', concepto: '' };

export default function CajaScreen() {
  const { role } = useAuth();
  const [state, setState] = useState({ abierta: false, montoApertura: 0, saldo: 0 });
  const [movements, setMovements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [movement, setMovement] = useState(emptyMovement);

  const loadData = async () => {
    setLoading(true);
    try {
      const [estadoResponse, movimientosResponse] = await Promise.all([
        apiClient.get('/api/caja/estado'),
        apiClient.get('/api/caja/movimientos'),
      ]);
      setState({
        abierta: estadoResponse.data?.abierta ?? false,
        montoApertura: Number(estadoResponse.data?.montoApertura || 0),
        saldo: Number(estadoResponse.data?.saldo || 0),
      });
      setMovements(Array.isArray(movimientosResponse.data) ? movimientosResponse.data : []);
    } catch (error) {
      Toast.show({ type: 'error', text1: 'Error', text2: error.message || 'No se pudo cargar caja' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const abrirCaja = async () => {
    try {
      await apiClient.post('/api/caja/abrir');
      setState((current) => ({ ...current, abierta: true }));
      Toast.show({ type: 'success', text1: 'Caja abierta', text2: 'Operación registrada' });
      await loadData();
    } catch (error) {
      Toast.show({ type: 'error', text1: 'Error', text2: error.message || 'No se pudo abrir caja' });
    }
  };

  const cerrarCaja = async () => {
    try {
      await apiClient.post('/api/caja/cerrar');
      setState((current) => ({ ...current, abierta: false }));
      Toast.show({ type: 'success', text1: 'Caja cerrada', text2: 'Reporte guardado' });
      await loadData();
    } catch (error) {
      Toast.show({ type: 'error', text1: 'Error', text2: error.message || 'No se pudo cerrar caja' });
    }
  };

  const saveMovement = async () => {
    try {
      await apiClient.post('/api/caja/movimiento', {
        tipo: movement.tipo,
        monto: Number(movement.monto),
        concepto: movement.concepto,
      });
      setShowModal(false);
      setMovement(emptyMovement);
      await loadData();
      Toast.show({ type: 'success', text1: 'Movimiento registrado', text2: 'Caja actualizada' });
    } catch (error) {
      Toast.show({ type: 'error', text1: 'Error', text2: error.message || 'No se pudo registrar movimiento' });
    }
  };

  if (role !== 'admin') {
    return <View style={styles.accessDenied}><Text style={styles.accessDeniedText}>Acceso restringido</Text></View>;
  }

  return (
    <View style={styles.screen}>
      <Text style={styles.title}>Caja</Text>
      <View style={styles.summaryCard}>
        <Text style={styles.summaryLabel}>Estado</Text>
        <Text style={styles.summaryValue}>{state.abierta ? 'Abierta' : 'Cerrada'}</Text>
        <Text style={styles.summaryLabel}>Monto de apertura</Text>
        <Text style={styles.summaryValue}>${Number(state.montoApertura).toFixed(2)}</Text>
        <Text style={styles.summaryLabel}>Saldo actual</Text>
        <Text style={styles.summaryValue}>${Number(state.saldo).toFixed(2)}</Text>
      </View>

      <View style={styles.actionRow}>
        <Pressable onPress={abrirCaja} style={styles.openButton}><Text style={styles.actionText}>Abrir caja</Text></Pressable>
        <Pressable onPress={cerrarCaja} style={styles.closeButton}><Text style={styles.actionText}>Cerrar caja</Text></Pressable>
      </View>

      <View style={styles.headerRow}>
        <Text style={styles.sectionTitle}>Movimientos</Text>
        <Pressable onPress={() => setShowModal(true)} style={styles.fab}><Text style={styles.fabText}>＋</Text></Pressable>
      </View>

      {loading ? (
        <View style={styles.loadingBox}><ActivityIndicator size="large" color="#6c63ff" /><Text style={styles.loadingText}>Cargando...</Text></View>
      ) : (
        <ScrollView showsVerticalScrollIndicator={false}>
          {movements.map((movementItem) => (
            <View key={String(movementItem.id)} style={styles.movementCard}>
              <View>
                <Text style={styles.movementType}>{movementItem.tipo || 'ingreso'}</Text>
                <Text style={styles.movementConcept}>{movementItem.concepto || 'Movimiento'}</Text>
              </View>
              <Text style={styles.movementAmount}>${Number(movementItem.monto || 0).toFixed(2)}</Text>
            </View>
          ))}
        </ScrollView>
      )}

      <Modal visible={showModal} transparent animationType="slide" onRequestClose={() => setShowModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Nuevo movimiento</Text>
            <TextInput value={movement.tipo} onChangeText={(val) => setMovement((current) => ({ ...current, tipo: val }))} style={styles.modalInput} placeholder="Tipo (ingreso/egreso)" placeholderTextColor="#6b6f80" />
            <TextInput value={movement.monto} onChangeText={(val) => setMovement((current) => ({ ...current, monto: val }))} style={styles.modalInput} placeholder="Monto" keyboardType="numeric" placeholderTextColor="#6b6f80" />
            <TextInput value={movement.concepto} onChangeText={(val) => setMovement((current) => ({ ...current, concepto: val }))} style={styles.modalInput} placeholder="Concepto" placeholderTextColor="#6b6f80" />
            <View style={styles.modalButtons}>
              <Pressable onPress={() => setShowModal(false)} style={styles.cancelButton}><Text style={styles.cancelText}>Cancelar</Text></Pressable>
              <Pressable onPress={saveMovement} style={styles.saveButton}><Text style={styles.saveText}>Guardar</Text></Pressable>
            </View>
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
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#2e3247',
    padding: 14,
    marginBottom: 12,
  },
  summaryLabel: {
    color: '#b0b3c1',
    marginTop: 6,
  },
  summaryValue: {
    color: '#fff',
    fontWeight: '900',
    fontSize: 18,
  },
  actionRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 12,
  },
  openButton: {
    flex: 1,
    backgroundColor: '#4caf50',
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
  },
  closeButton: {
    flex: 1,
    backgroundColor: '#e53935',
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
  },
  actionText: {
    color: '#fff',
    fontWeight: '900',
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  sectionTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '900',
  },
  fab: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#6c63ff',
    justifyContent: 'center',
    alignItems: 'center',
  },
  fabText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '900',
  },
  movementCard: {
    backgroundColor: '#1a1d27',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#2e3247',
    padding: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  movementType: {
    color: '#fff',
    fontWeight: '900',
  },
  movementConcept: {
    color: '#b0b3c1',
    marginTop: 4,
  },
  movementAmount: {
    color: '#6c63ff',
    fontWeight: '900',
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
  accessDenied: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#0f1117',
  },
  accessDeniedText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '800',
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
    marginBottom: 10,
  },
  modalInput: {
    backgroundColor: '#1a1d27',
    borderWidth: 1,
    borderColor: '#2e3247',
    borderRadius: 10,
    color: '#fff',
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 10,
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 10,
  },
  cancelButton: {
    flex: 1,
    backgroundColor: '#252836',
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
  },
  cancelText: {
    color: '#fff',
    fontWeight: '800',
  },
  saveButton: {
    flex: 1,
    backgroundColor: '#4caf50',
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
  },
  saveText: {
    color: '#fff',
    fontWeight: '800',
  },
});
