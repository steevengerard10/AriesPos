import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Dimensions, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import Toast from 'react-native-toast-message';
import apiClient from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useCart } from '../context/CartContext';
import { useServer } from '../context/ServerContext';
import { useSocket } from '../hooks/useSocket';
import ProductCard from '../components/ProductCard';
import CartPanel from '../components/CartPanel';
import ReciboModal from '../components/ReciboModal';
import StatusBar from '../components/StatusBar';
import { getEmergencyServer } from '../emergency/getEmergencyServer';

const { width } = Dimensions.get('window');

export default function POSScreen() {
  const { role, businessName } = useAuth();
  const { mode } = useServer();
  const { items, addItem, updateItemQuantity, removeItem, customer, setCustomer, paymentMethod, setPaymentMethod, receivedCash, setReceivedCash, discount, setDiscount, note, setNote, subtotal, tax, total, change, clearCart } = useCart();
  const { connected, on } = useSocket();

  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState('Todas');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [scannerVisible, setScannerVisible] = useState(false);
  const [customers, setCustomers] = useState([]);
  const [showCart, setShowCart] = useState(false);
  const [receipt, setReceipt] = useState(null);
  const [showReceipt, setShowReceipt] = useState(false);
  const [ScannerComponent, setScannerComponent] = useState(null);

  const loadData = async () => {
    setLoading(true);
    try {
      if (mode === 'emergency') {
        const emergencyServer = getEmergencyServer();
        const emergencyProducts = await emergencyServer.getProducts?.();
        const emergencyCustomers = await emergencyServer.getClientes?.();
        const emergencyCategories = await emergencyServer.getCategorias?.();
        setProducts(emergencyProducts || []);
        setCustomers(emergencyCustomers || []);
        setCategories(emergencyCategories || []);
      } else {
        const [productsResponse, categoriesResponse, clientesResponse] = await Promise.all([
          apiClient.get('/api/productos'),
          apiClient.get('/api/categorias'),
          apiClient.get('/api/clientes'),
        ]);

        const productList = Array.isArray(productsResponse.data) ? productsResponse.data : [];
        const categoryList = Array.isArray(categoriesResponse.data) ? categoriesResponse.data : [];
        const clientList = Array.isArray(clientesResponse.data) ? clientesResponse.data : [];

        setProducts(productList);
        setCategories(categoryList);
        setCustomers(clientList);
      }
    } catch (error) {
      Toast.show({ type: 'error', text1: 'Error cargando datos', text2: error.message || 'No se pudo cargar inventario' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [mode]);

  useEffect(() => {
    on('stock', (payload) => {
      setProducts((current) => current.map((item) => item.id === payload.id ? { ...item, stock: payload.stock } : item));
    });
  }, [on]);

  const filteredProducts = useMemo(() => {
    return products.filter((product) => {
      const categoryMatch = selectedCategory === 'Todas' || (product.categoria || product.category || 'General') === selectedCategory;
      const searchMatch = `${product.nombre || product.name || ''} ${product.barcode || ''}`.toLowerCase().includes(search.toLowerCase());
      return categoryMatch && searchMatch;
    });
  }, [products, selectedCategory, search]);

  const timeLabel = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  const handleScanner = async () => {
    try {
      const { default: ScannerModule } = await import('expo-barcode-scanner');
      const { status } = await ScannerModule.requestPermissionsAsync();
      if (status !== 'granted') {
        Toast.show({ type: 'error', text1: 'Permiso requerido', text2: 'Habilita cámara para escanear códigos' });
        return;
      }
      setScannerComponent(() => ScannerModule);
      setScannerVisible(true);
    } catch (error) {
      Toast.show({ type: 'error', text1: 'Error', text2: error.message || 'No se pudo abrir el escáner' });
    }
  };

  const handleBarcode = ({ data }) => {
    setScannerVisible(false);
    const found = products.find((product) => String(product.barcode || product.codigo || '').includes(data));
    if (found) {
      addItem(found, 1);
      Toast.show({ type: 'success', text1: 'Producto agregado', text2: found.nombre || found.name });
    } else {
      Toast.show({ type: 'error', text1: 'No encontrado', text2: 'Código no reconocido' });
    }
  };

  const handleCheckout = async () => {
    if (items.length === 0) {
      Toast.show({ type: 'error', text1: 'Carrito vacío', text2: 'Agrega productos antes de cobrar' });
      return;
    }

    const payload = {
      items: items.map((item) => ({
        id: item.id,
        nombre: item.nombre || item.name,
        cantidad: item.quantity,
        precio: Number(item.precio || item.precio_unitario || 0),
        subtotal: Number(item.total || 0),
      })),
      metodoPago: paymentMethod,
      clienteId: customer?.id || null,
      descuento: Number(discount || 0),
      nota: note,
      total: Number(total.toFixed(2)),
    };

    try {
      if (mode === 'emergency') {
        const emergencyServer = getEmergencyServer();
        await emergencyServer.start();
        const saleId = await emergencyServer.syncPendingSalesToDesktop?.('http://192.168.1.100:3001');
        if (!saleId) {
          await fetch('http://127.0.0.1:3001/api/ventas', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
        }
      } else {
        await apiClient.post('/api/ventas', payload);
      }
      const saleData = {
        id: `sale_${Date.now()}`,
        items,
        metodoPago: paymentMethod,
        total,
      };
      setReceipt(saleData);
      setShowReceipt(true);
      clearCart();
      await loadData();
    } catch (error) {
      const cached = JSON.parse((await import('@react-native-async-storage/async-storage')).default.getItem('pendingSales') || '[]');
      const pending = [...cached, { ...payload, createdAt: new Date().toISOString() }];
      await import('@react-native-async-storage/async-storage').then(({ default: AsyncStorage }) => AsyncStorage.setItem('pendingSales', JSON.stringify(pending)));
      Toast.show({ type: 'error', text1: 'Venta en cola', text2: 'Se guardó offline para reintentar' });
    }
  };

  const isTablet = width >= 900;

  return (
    <View style={styles.screen}>
      <StatusBar role={role} mode={mode} connected={connected} timeLabel={timeLabel} />

      <View style={styles.controlsRow}>
        <TextInput
          value={search}
          onChangeText={setSearch}
          placeholder="Buscar producto"
          placeholderTextColor="#6b6f80"
          style={styles.searchInput}
        />
        <Pressable onPress={handleScanner} style={styles.scanButton}><Text style={styles.scanButtonText}>📷</Text></Pressable>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.categoryRow}>
        {['Todas', ...categories.map((category) => category.nombre || category.name)].map((category) => (
          <Pressable
            key={category}
            onPress={() => setSelectedCategory(category)}
            style={[styles.categoryChip, selectedCategory === category && styles.categoryChipActive]}
          >
            <Text style={[styles.categoryText, selectedCategory === category && styles.categoryTextActive]}>{category}</Text>
          </Pressable>
        ))}
      </ScrollView>

      {loading ? (
        <View style={styles.loadingBox}><ActivityIndicator size="large" color="#6c63ff" /><Text style={styles.loadingText}>Cargando productos...</Text></View>
      ) : (
        <View style={styles.bodyRow}>
          <View style={[styles.productColumn, isTablet && styles.productColumnWide]}>
            <ScrollView showsVerticalScrollIndicator={false}>
              {filteredProducts.map((product) => (
                <ProductCard key={product.id} product={product} onPress={() => addItem(product, 1)} />
              ))}
            </ScrollView>
          </View>

          {isTablet ? (
            <View style={styles.cartColumn}>
              <CartPanel
                visible={true}
                onClose={() => setShowCart(false)}
                items={items}
                onIncrease={(id) => updateItemQuantity(id, (items.find((item) => item.id === id)?.quantity || 0) + 1)}
                onDecrease={(id) => updateItemQuantity(id, Math.max(0, (items.find((item) => item.id === id)?.quantity || 0) - 1))}
                onRemove={removeItem}
                customers={customers}
                customer={customer}
                onCustomerChange={setCustomer}
                paymentMethod={paymentMethod}
                onPaymentChange={setPaymentMethod}
                receivedCash={receivedCash}
                onReceivedCashChange={setReceivedCash}
                discount={discount}
                onDiscountChange={setDiscount}
                note={note}
                onNoteChange={setNote}
                subtotal={subtotal}
                tax={tax}
                total={total}
                onCheckout={handleCheckout}
                isTablet={true}
              />
            </View>
          ) : (
            <Pressable onPress={() => setShowCart(true)} style={styles.fabCart}><Text style={styles.fabCartText}>🛒 {items.length}</Text></Pressable>
          )}
        </View>
      )}

      <Modal visible={scannerVisible} animationType="slide" onRequestClose={() => setScannerVisible(false)}>
        <View style={styles.scannerContainer}>
          {ScannerComponent ? (
            <ScannerComponent onBarCodeScanned={handleBarcode} style={StyleSheet.absoluteFillObject} />
          ) : null}
          <View style={styles.scannerOverlay}>
            <Text style={styles.scannerText}>Escanea el código de barras</Text>
            <Pressable onPress={() => setScannerVisible(false)} style={styles.scannerCloseButton}><Text style={styles.scannerCloseText}>Cerrar</Text></Pressable>
          </View>
        </View>
      </Modal>

      {!isTablet ? (
        <CartPanel
          visible={showCart}
          onClose={() => setShowCart(false)}
          items={items}
          onIncrease={(id) => updateItemQuantity(id, (items.find((item) => item.id === id)?.quantity || 0) + 1)}
          onDecrease={(id) => updateItemQuantity(id, Math.max(0, (items.find((item) => item.id === id)?.quantity || 0) - 1))}
          onRemove={removeItem}
          customers={customers}
          customer={customer}
          onCustomerChange={setCustomer}
          paymentMethod={paymentMethod}
          onPaymentChange={setPaymentMethod}
          receivedCash={receivedCash}
          onReceivedCashChange={setReceivedCash}
          discount={discount}
          onDiscountChange={setDiscount}
          note={note}
          onNoteChange={setNote}
          subtotal={subtotal}
          tax={tax}
          total={total}
          onCheckout={handleCheckout}
          isTablet={false}
        />
      ) : null}

      <ReciboModal visible={showReceipt} onClose={() => setShowReceipt(false)} sale={receipt} />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#0f1117',
    padding: 12,
  },
  controlsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 10,
  },
  searchInput: {
    flex: 1,
    backgroundColor: '#1a1d27',
    color: '#fff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#2e3247',
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  scanButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#6c63ff',
    justifyContent: 'center',
    alignItems: 'center',
  },
  scanButtonText: {
    color: '#fff',
    fontSize: 18,
  },
  categoryRow: {
    marginBottom: 10,
  },
  categoryChip: {
    borderRadius: 999,
    backgroundColor: '#252836',
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginRight: 8,
    borderWidth: 1,
    borderColor: '#2e3247',
  },
  categoryChipActive: {
    backgroundColor: '#6c63ff',
    borderColor: '#6c63ff',
  },
  categoryText: {
    color: '#b0b3c1',
    fontWeight: '800',
  },
  categoryTextActive: {
    color: '#fff',
  },
  loadingBox: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: '#e8eaf6',
    marginTop: 10,
  },
  bodyRow: {
    flex: 1,
    flexDirection: 'row',
    gap: 12,
  },
  productColumn: {
    flex: 1,
  },
  productColumnWide: {
    width: width * 0.62,
  },
  cartColumn: {
    width: width * 0.38,
  },
  fabCart: {
    position: 'absolute',
    right: 16,
    bottom: 16,
    backgroundColor: '#6c63ff',
    borderRadius: 999,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  fabCartText: {
    color: '#fff',
    fontWeight: '900',
  },
  scannerContainer: {
    flex: 1,
    backgroundColor: '#000',
  },
  scannerOverlay: {
    position: 'absolute',
    bottom: 20,
    alignSelf: 'center',
    backgroundColor: 'rgba(0,0,0,0.6)',
    borderRadius: 999,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  scannerText: {
    color: '#fff',
    fontWeight: '800',
  },
  scannerCloseButton: {
    marginTop: 8,
    alignSelf: 'center',
    backgroundColor: '#6c63ff',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  scannerCloseText: {
    color: '#fff',
    fontWeight: '800',
  },
});
