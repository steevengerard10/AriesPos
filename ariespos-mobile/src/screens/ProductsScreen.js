import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import Toast from 'react-native-toast-message';
import apiClient from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useServer } from '../context/ServerContext';
import { getEmergencyServer } from '../emergency/getEmergencyServer';

const emptyForm = {
  nombre: '',
  precio: '0',
  categoria: '',
  barcode: '',
  stock: '0',
  imagen: '',
};

export default function ProductsScreen() {
  const { role } = useAuth();
  const { mode } = useServer();
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  const [form, setForm] = useState(emptyForm);

  const loadProducts = async () => {
    setLoading(true);
    try {
      if (mode === 'emergency') {
        const emergencyServer = getEmergencyServer();
        const data = await emergencyServer.getProducts?.();
        const cats = await emergencyServer.getCategorias?.();
        setProducts(data || []);
        setCategories(cats || []);
      } else {
        const [productResponse, categoryResponse] = await Promise.all([
          apiClient.get('/api/productos'),
          apiClient.get('/api/categorias'),
        ]);
        setProducts(Array.isArray(productResponse.data) ? productResponse.data : []);
        setCategories(Array.isArray(categoryResponse.data) ? categoryResponse.data : []);
      }
    } catch (error) {
      Toast.show({ type: 'error', text1: 'Error', text2: error.message || 'No se pudo cargar productos' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadProducts();
  }, [mode]);

  const filtered = products.filter((product) => `${product.nombre || product.name} ${product.categoria || product.category}`.toLowerCase().includes(search.toLowerCase()));

  const openCreate = () => {
    setEditingProduct(null);
    setForm(emptyForm);
    setShowModal(true);
  };

  const openEdit = (product) => {
    setEditingProduct(product);
    setForm({
      nombre: product.nombre || product.name,
      precio: String(product.precio || product.precio_unitario || 0),
      categoria: product.categoria || product.category || '',
      barcode: product.barcode || '',
      stock: String(product.stock ?? product.cantidad ?? 0),
      imagen: product.imagen || product.image || '',
    });
    setShowModal(true);
  };

  const saveProduct = async () => {
    const payload = {
      nombre: form.nombre,
      precio: Number(form.precio),
      categoria: form.categoria,
      barcode: form.barcode,
      stock: Number(form.stock),
      imagen: form.imagen,
    };

    try {
      if (editingProduct) {
        await apiClient.put(`/api/productos/${editingProduct.id}`, payload);
      } else {
        const nextProduct = { id: `local_${Date.now()}`, ...payload };
        setProducts((current) => [nextProduct, ...current]);
      }
      setShowModal(false);
      await loadProducts();
      Toast.show({ type: 'success', text1: 'Producto guardado', text2: 'Actualización aplicada' });
    } catch (error) {
      Toast.show({ type: 'error', text1: 'Error', text2: error.message || 'No se pudo guardar' });
    }
  };

  const deleteProduct = async (product) => {
    try {
      if (editingProduct) {
        await apiClient.put(`/api/productos/${product.id}`, { ...product, stock: 0 });
      }
      setProducts((current) => current.filter((item) => item.id !== product.id));
      Toast.show({ type: 'info', text1: 'Producto eliminado', text2: product.nombre || product.name });
    } catch (error) {
      Toast.show({ type: 'error', text1: 'Error', text2: error.message || 'No se pudo eliminar' });
    }
  };

  if (role !== 'admin') {
    return <View style={styles.accessDenied}><Text style={styles.accessDeniedText}>Acceso restringido</Text></View>;
  }

  return (
    <View style={styles.screen}>
      <View style={styles.headerRow}>
        <Text style={styles.title}>Productos</Text>
        <Pressable onPress={openCreate} style={styles.fab}><Text style={styles.fabText}>＋</Text></Pressable>
      </View>

      <TextInput
        value={search}
        onChangeText={setSearch}
        placeholder="Buscar producto"
        placeholderTextColor="#6b6f80"
        style={styles.searchInput}
      />

      {loading ? (
        <View style={styles.loadingBox}><ActivityIndicator size="large" color="#6c63ff" /><Text style={styles.loadingText}>Cargando...</Text></View>
      ) : (
        <ScrollView showsVerticalScrollIndicator={false}>
          {filtered.map((product) => (
            <View key={String(product.id)} style={styles.productCard}>
              <View style={styles.productInfo}>
                <Text style={styles.productName}>{product.nombre || product.name}</Text>
                <Text style={styles.productMeta}>{product.categoria || product.category || 'General'} • ${Number(product.precio || product.precio_unitario || 0).toFixed(2)}</Text>
                <Text style={styles.productMeta}>Stock: {product.stock ?? product.cantidad ?? 0}</Text>
                {Number(product.stock ?? product.cantidad ?? 0) <= 5 ? <Text style={styles.lowStockBadge}>Bajo stock</Text> : null}
              </View>
              <View style={styles.actionColumn}>
                <Pressable onPress={() => openEdit(product)} style={styles.editButton}><Text style={styles.editButtonText}>Editar</Text></Pressable>
                <Pressable onPress={() => deleteProduct(product)} style={styles.deleteButton}><Text style={styles.deleteButtonText}>Eliminar</Text></Pressable>
              </View>
            </View>
          ))}
        </ScrollView>
      )}

      <Modal visible={showModal} animationType="slide" transparent onRequestClose={() => setShowModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>{editingProduct ? 'Editar producto' : 'Agregar producto'}</Text>
            <TextInput value={form.nombre} onChangeText={(val) => setForm((current) => ({ ...current, nombre: val }))} style={styles.modalInput} placeholder="Nombre" placeholderTextColor="#6b6f80" />
            <TextInput value={form.precio} onChangeText={(val) => setForm((current) => ({ ...current, precio: val }))} style={styles.modalInput} placeholder="Precio" keyboardType="numeric" placeholderTextColor="#6b6f80" />
            <TextInput value={form.categoria} onChangeText={(val) => setForm((current) => ({ ...current, categoria: val }))} style={styles.modalInput} placeholder="Categoría" placeholderTextColor="#6b6f80" />
            <TextInput value={form.barcode} onChangeText={(val) => setForm((current) => ({ ...current, barcode: val }))} style={styles.modalInput} placeholder="Barcode" placeholderTextColor="#6b6f80" />
            <TextInput value={form.stock} onChangeText={(val) => setForm((current) => ({ ...current, stock: val }))} style={styles.modalInput} placeholder="Stock" keyboardType="numeric" placeholderTextColor="#6b6f80" />
            <TextInput value={form.imagen} onChangeText={(val) => setForm((current) => ({ ...current, imagen: val }))} style={styles.modalInput} placeholder="URL imagen" placeholderTextColor="#6b6f80" />

            <View style={styles.modalButtons}>
              <Pressable onPress={() => setShowModal(false)} style={styles.cancelButton}><Text style={styles.cancelButtonText}>Cancelar</Text></Pressable>
              <Pressable onPress={saveProduct} style={styles.saveButton}><Text style={styles.saveButtonText}>Guardar</Text></Pressable>
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
  productCard: {
    backgroundColor: '#1a1d27',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#2e3247',
    padding: 12,
    marginBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
  },
  productInfo: {
    flex: 1,
  },
  productName: {
    color: '#fff',
    fontWeight: '900',
    fontSize: 15,
  },
  productMeta: {
    color: '#b0b3c1',
    marginTop: 3,
  },
  lowStockBadge: {
    marginTop: 6,
    alignSelf: 'flex-start',
    borderRadius: 999,
    backgroundColor: 'rgba(255,193,7,0.18)',
    color: '#ffc107',
    paddingHorizontal: 8,
    paddingVertical: 4,
    fontSize: 10,
    fontWeight: '800',
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
