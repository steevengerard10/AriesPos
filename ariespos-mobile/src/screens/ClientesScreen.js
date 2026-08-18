import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import Toast from 'react-native-toast-message';
import apiClient from '../api/client';
import { useServer } from '../context/ServerContext';
import { getEmergencyServer } from '../emergency/getEmergencyServer';

const emptyForm = { nombre: '', telefono: '', email: '', saldo: '0' };

export default function ClientesScreen() {
  const { mode } = useServer();
  const [clients, setClients] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [selectedClient, setSelectedClient] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState(emptyForm);

  const loadData = async () => {
    setLoading(true);
    try {
      if (mode === 'emergency') {
        const emergencyServer = getEmergencyServer();
        const data = await emergencyServer.getClientes?.();
        setClients(data || []);
      } else {
        const response = await apiClient.get('/api/clientes');
        setClients(Array.isArray(response.data) ? response.data : []);
      }
    } catch (error) {
      Toast.show({ type: 'error', text1: 'Error', text2: error.message || 'No se pudo cargar clientes' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [mode]);

  const filtered = clients.filter((client) => `${client.nombre || client.name} ${client.telefono || ''}`.toLowerCase().includes(search.toLowerCase()));

  const openCreate = () => {
    setForm(emptyForm);
    setSelectedClient(null);
    setShowModal(true);
  };

  const openEdit = (client) => {
    setSelectedClient(client);
    setForm({
      nombre: client.nombre || client.name,
      telefono: client.telefono || '',
      email: client.email || '',
      saldo: String(client.saldo || 0),
    });
    setShowModal(true);
  };

  const saveClient = () => {
    if (selectedClient) {
      setClients((current) => current.map((item) => item.id === selectedClient.id ? { ...item, ...form, saldo: Number(form.saldo) } : item));
    } else {
      setClients((current) => [{ id: `client_${Date.now()}`, ...form, saldo: Number(form.saldo) }, ...current]);
    }
    setShowModal(false);
    Toast.show({ type: 'success', text1: 'Cliente guardado', text2: 'Cambios actualizados' });
  };

  const deleteClient = (client) => {
    setClients((current) => current.filter((item) => item.id !== client.id));
    Toast.show({ type: 'info', text1: 'Cliente eliminado', text2: client.nombre || client.name });
  };

  return (
    <View style={styles.screen}>
      <View style={styles.headerRow}>
        <Text style={styles.title}>Clientes</Text>
        <Pressable onPress={openCreate} style={styles.fab}><Text style={styles.fabText}>＋</Text></Pressable>
      </View>

      <TextInput
        value={search}
        onChangeText={setSearch}
        placeholder="Buscar cliente"
        placeholderTextColor="#6b6f80"
        style={styles.searchInput}
      />

      {loading ? (
        <View style={styles.loadingBox}><ActivityIndicator size="large" color="#6c63ff" /><Text style={styles.loadingText}>Cargando...</Text></View>
      ) : (
        <ScrollView showsVerticalScrollIndicator={false}>
          {filtered.map((client) => (
            <Pressable key={String(client.id)} onPress={() => setSelectedClient(client)} style={styles.clientCard}>
              <View style={styles.clientInfo}>
                <Text style={styles.clientName}>{client.nombre || client.name}</Text>
                <Text style={styles.clientMeta}>{client.telefono || 'Sin teléfono'} • {client.email || 'Sin email'}</Text>
              </View>
              <View style={styles.actionColumn}>
                <Pressable onPress={() => openEdit(client)} style={styles.editButton}><Text style={styles.editButtonText}>Editar</Text></Pressable>
                <Pressable onPress={() => deleteClient(client)} style={styles.deleteButton}><Text style={styles.deleteButtonText}>Eliminar</Text></Pressable>
              </View>
            </Pressable>
          ))}
        </ScrollView>
      )}

      {selectedClient ? (
        <View style={styles.detailCard}>
          <Text style={styles.detailTitle}>Historial y fiados</Text>
          <Text style={styles.detailText}>Cliente: {selectedClient.nombre || selectedClient.name}</Text>
          <Text style={styles.detailText}>Saldo pendiente: ${Number(selectedClient.saldo || 0).toFixed(2)}</Text>
        </View>
      ) : null}

      <Modal visible={showModal} animationType="slide" transparent onRequestClose={() => setShowModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>{selectedClient ? 'Editar cliente' : 'Agregar cliente'}</Text>
            <TextInput value={form.nombre} onChangeText={(val) => setForm((current) => ({ ...current, nombre: val }))} style={styles.modalInput} placeholder="Nombre" placeholderTextColor="#6b6f80" />
            <TextInput value={form.telefono} onChangeText={(val) => setForm((current) => ({ ...current, telefono: val }))} style={styles.modalInput} placeholder="Teléfono" placeholderTextColor="#6b6f80" />
            <TextInput value={form.email} onChangeText={(val) => setForm((current) => ({ ...current, email: val }))} style={styles.modalInput} placeholder="Email" placeholderTextColor="#6b6f80" />
            <TextInput value={form.saldo} onChangeText={(val) => setForm((current) => ({ ...current, saldo: val }))} style={styles.modalInput} placeholder="Saldo" keyboardType="numeric" placeholderTextColor="#6b6f80" />
            <View style={styles.modalButtons}>
              <Pressable onPress={() => setShowModal(false)} style={styles.cancelButton}><Text style={styles.cancelButtonText}>Cancelar</Text></Pressable>
              <Pressable onPress={saveClient} style={styles.saveButton}><Text style={styles.saveButtonText}>Guardar</Text></Pressable>
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
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  title: {
    color: '#fff',
    fontSize: 24,
    fontWeight: '900',
  },
  fab: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#6c63ff',
    justifyContent: 'center',
    alignItems: 'center',
  },
  fabText: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '900',
  },
  searchInput: {
    backgroundColor: '#1a1d27',
    color: '#fff',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#2e3247',
    paddingHorizontal: 12,
    paddingVertical: 10,
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
  clientCard: {
    backgroundColor: '#1a1d27',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#2e3247',
    padding: 12,
    marginBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
  },
  clientInfo: {
    flex: 1,
  },
  clientName: {
    color: '#fff',
    fontWeight: '900',
    fontSize: 15,
  },
  clientMeta: {
    color: '#b0b3c1',
    marginTop: 3,
  },
  actionColumn: {
    gap: 8,
  },
  editButton: {
    backgroundColor: '#6c63ff',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  editButtonText: {
    color: '#fff',
    fontWeight: '800',
  },
  deleteButton: {
    backgroundColor: '#e53935',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  deleteButtonText: {
    color: '#fff',
    fontWeight: '800',
  },
  detailCard: {
    marginTop: 10,
    backgroundColor: '#1a1d27',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#2e3247',
    padding: 12,
  },
  detailTitle: {
    color: '#fff',
    fontWeight: '900',
    marginBottom: 8,
  },
  detailText: {
    color: '#b0b3c1',
    marginBottom: 4,
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
    padding: 16,
    borderWidth: 1,
    borderColor: '#2e3247',
  },
  modalTitle: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '900',
    marginBottom: 10,
  },
  modalInput: {
    backgroundColor: '#1a1d27',
    borderWidth: 1,
    borderColor: '#2e3247',
    color: '#fff',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 10,
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 10,
  },
  cancelButton: {
    flex: 1,
    borderRadius: 10,
    backgroundColor: '#252836',
    paddingVertical: 12,
    alignItems: 'center',
  },
  cancelButtonText: {
    color: '#fff',
    fontWeight: '800',
  },
  saveButton: {
    flex: 1,
    borderRadius: 10,
    backgroundColor: '#4caf50',
    paddingVertical: 12,
    alignItems: 'center',
  },
  saveButtonText: {
    color: '#fff',
    fontWeight: '800',
  },
});
