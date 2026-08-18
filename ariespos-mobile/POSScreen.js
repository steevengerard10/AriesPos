import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View, Text, TextInput, FlatList, TouchableOpacity,
  Modal, ScrollView, StyleSheet, ActivityIndicator,
  Alert, KeyboardAvoidingView, Platform,
} from 'react-native';
import { productosAPI } from '../api/productos';
import { ventasAPI } from '../api/ventas';
import { useCart } from '../hooks/useCart';

const COLORES = {
  fondo: '#0f172a', tarjeta: '#1e293b', borde: '#334155',
  primario: '#6366f1', verde: '#22c55e', amarillo: '#f59e0b',
  rojo: '#ef4444', texto: '#f1f5f9', textoSub: '#94a3b8',
};

const METODOS_PAGO = [
  { id: 'efectivo',      label: 'Efectivo',       icon: '💵' },
  { id: 'tarjeta',       label: 'Tarjeta',         icon: '💳' },
  { id: 'transferencia', label: 'Transferencia',   icon: '🏦' },
  { id: 'qr',            label: 'QR',              icon: '📱' },
  { id: 'fiado',         label: 'Fiado',           icon: '📋' },
];

function ProductoBusqueda({ onAgregar }) {
  const [busqueda, setBusqueda] = useState('');
  const [resultados, setResultados] = useState([]);
  const [buscando, setBuscando] = useState(false);
  const debounceRef = useRef(null);

  const buscar = useCallback((texto) => {
    setBusqueda(texto);
    clearTimeout(debounceRef.current);
    if (!texto.trim()) { setResultados([]); return; }
    debounceRef.current = setTimeout(async () => {
      setBuscando(true);
      try {
        const data = await productosAPI.listar(texto);
        setResultados(data?.productos ?? []);
      } catch { setResultados([]); }
      finally { setBuscando(false); }
    }, 350);
  }, []);

  const seleccionar = (prod) => {
    onAgregar(prod);
    setBusqueda('');
    setResultados([]);
  };

  return (
    <View style={bs.busquedaContenedor}>
      <View style={bs.inputRow}>
        <TextInput
          style={bs.input}
          placeholder="Buscar producto…"
          placeholderTextColor={COLORES.textoSub}
          value={busqueda}
          onChangeText={buscar}
          autoCorrect={false}
        />
        {buscando && <ActivityIndicator color={COLORES.primario} style={{ position: 'absolute', right: 12 }} />}
      </View>

      {resultados.length > 0 && (
        <View style={bs.dropdown}>
          {resultados.slice(0, 6).map((p) => (
            <TouchableOpacity key={p.id} style={bs.dropdownItem} onPress={() => seleccionar(p)}>
              <View style={{ flex: 1 }}>
                <Text style={bs.dropdownNombre}>{p.nombre}</Text>
                <Text style={bs.dropdownStock}>Stock: {p.stock}</Text>
              </View>
              <Text style={bs.dropdownPrecio}>${Number(p.precio).toFixed(2)}</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}
    </View>
  );
}

function ItemCarrito({ item, onCambiarCantidad, onQuitar }) {
  return (
    <View style={bs.itemRow}>
      <View style={{ flex: 1 }}>
        <Text style={bs.itemNombre} numberOfLines={1}>{item.nombre}</Text>
        <Text style={bs.itemPrecio}>${item.precioUnitario.toFixed(2)} c/u</Text>
      </View>
      <View style={bs.cantidadControl}>
        <TouchableOpacity style={bs.cantBtn} onPress={() => onCambiarCantidad(item.productoId, item.cantidad - 1)}>
          <Text style={bs.cantBtnText}>−</Text>
        </TouchableOpacity>
        <Text style={bs.cantValor}>{item.cantidad}</Text>
        <TouchableOpacity style={bs.cantBtn} onPress={() => onCambiarCantidad(item.productoId, item.cantidad + 1)}>
          <Text style={bs.cantBtnText}>+</Text>
        </TouchableOpacity>
      </View>
      <Text style={bs.itemSubtotal}>${(item.precioUnitario * item.cantidad).toFixed(2)}</Text>
      <TouchableOpacity onPress={() => onQuitar(item.productoId)} style={bs.quitarBtn}>
        <Text style={bs.quitarText}>✕</Text>
      </TouchableOpacity>
    </View>
  );
}

export default function POSScreen({ navigation }) {
  const cart = useCart();
  const [escaneando, setEscaneando] = useState(false);
  const [permisoCamara, setPermisoCamara] = useState(null);
  const [modalPago, setModalPago] = useState(false);
  const [procesando, setProcesando] = useState(false);
  const [notas, setNotas] = useState('');
  const [ScannerComponent, setScannerComponent] = useState(null);

  useEffect(() => {
    let mounted = true;

    (async () => {
      try {
        const { default: ScannerModule } = await import('expo-barcode-scanner');
        if (!mounted) return;

        setScannerComponent(() => ScannerModule);
        const { status } = await ScannerModule.requestPermissionsAsync();
        setPermisoCamara(status === 'granted');
      } catch (error) {
        console.error('No se pudo cargar el escáner', error);
        setPermisoCamara(false);
      }
    })();

    return () => {
      mounted = false;
    };
  }, []);

  const handleBarcode = useCallback(async ({ data: codigo }) => {
    setEscaneando(false);
    try {
      const result = await productosAPI.getByBarcode(codigo);
      if (result?.producto) {
        cart.agregar(result.producto);
      } else {
        Alert.alert('No encontrado', `No hay producto con código ${codigo}`);
      }
    } catch (e) {
      Alert.alert('Error', e.message);
    }
  }, [cart]);

  const confirmarVenta = useCallback(async () => {
    if (cart.isEmpty) return;
    setProcesando(true);
    try {
      const payload = { ...cart.buildPayload(), notas };
      await ventasAPI.crearVenta(payload);
      cart.vaciar();
      setNotas('');
      setModalPago(false);
      Alert.alert('✓ Venta registrada', 'La venta fue guardada correctamente.', [
        { text: 'Nueva venta', style: 'default' },
        { text: 'Ir al dashboard', onPress: () => navigation.navigate('Dashboard') },
      ]);
    } catch (e) {
      Alert.alert('Error al registrar venta', e.message);
    } finally {
      setProcesando(false);
    }
  }, [cart, notas, navigation]);

  if (escaneando) {
    if (!ScannerComponent) {
      return (
        <View style={[bs.scannerContenedor, { justifyContent: 'center', alignItems: 'center' }]}>
          <ActivityIndicator color={COLORES.primario} size="large" />
          <Text style={{ color: COLORES.texto, marginTop: 10 }}>Cargando escáner...</Text>
        </View>
      );
    }

    return (
      <View style={bs.scannerContenedor}>
        <ScannerComponent
          onBarCodeScanned={handleBarcode}
          style={StyleSheet.absoluteFillObject}
        />
        <View style={bs.scannerOverlay}>
          <View style={bs.scannerFrame} />
          <Text style={bs.scannerTexto}>Apuntá al código de barras</Text>
          <TouchableOpacity style={bs.cancelarScan} onPress={() => setEscaneando(false)}>
            <Text style={bs.cancelarScanText}>Cancelar</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={bs.contenedor}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      {/* Búsqueda + scanner */}
      <View style={bs.topBar}>
        <ProductoBusqueda onAgregar={cart.agregar} />
        <TouchableOpacity
          style={[bs.scanBtn, !permisoCamara && { opacity: 0.4 }]}
          onPress={() => permisoCamara && setEscaneando(true)}
        >
          <Text style={{ fontSize: 22 }}>📷</Text>
        </TouchableOpacity>
      </View>

      {/* Carrito */}
      {cart.isEmpty ? (
        <View style={bs.carritoVacio}>
          <Text style={{ fontSize: 48 }}>🛒</Text>
          <Text style={bs.carritoVacioTexto}>El carrito está vacío</Text>
          <Text style={bs.textoSub}>Buscá un producto o escaneá un código</Text>
        </View>
      ) : (
        <FlatList
          data={cart.items}
          keyExtractor={(i) => String(i.productoId)}
          renderItem={({ item }) => (
            <ItemCarrito
              item={item}
              onCambiarCantidad={cart.setCantidad}
              onQuitar={cart.quitar}
            />
          )}
          style={bs.lista}
          contentContainerStyle={{ paddingBottom: 8 }}
        />
      )}

      {/* Footer con total */}
      {!cart.isEmpty && (
        <View style={bs.footer}>
          <View style={bs.totalRow}>
            <Text style={bs.totalLabel}>{cart.totales.cantidadItems} ítem(s)</Text>
            <Text style={bs.totalValor}>${cart.totales.total.toFixed(2)}</Text>
          </View>
          <View style={bs.footerBotones}>
            <TouchableOpacity style={bs.vaciarBtn} onPress={cart.vaciar}>
              <Text style={bs.vaciarText}>Vaciar</Text>
            </TouchableOpacity>
            <TouchableOpacity style={bs.cobrarBtn} onPress={() => setModalPago(true)}>
              <Text style={bs.cobrarText}>Cobrar ${cart.totales.total.toFixed(2)}</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Modal de pago */}
      <Modal visible={modalPago} animationType="slide" transparent>
        <View style={bs.modalOverlay}>
          <View style={bs.modalContenido}>
            <Text style={bs.modalTitulo}>Confirmar venta</Text>

            <Text style={bs.modalSeccion}>Método de pago</Text>
            <View style={bs.metodosGrid}>
              {METODOS_PAGO.map((m) => (
                <TouchableOpacity
                  key={m.id}
                  style={[bs.metodoBtn, cart.metodoPago === m.id && bs.metodoBtnActivo]}
                  onPress={() => cart.setMetodoPago(m.id)}
                >
                  <Text style={{ fontSize: 20 }}>{m.icon}</Text>
                  <Text style={[bs.metodoBtnText, cart.metodoPago === m.id && { color: '#fff' }]}>
                    {m.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={bs.modalSeccion}>Notas (opcional)</Text>
            <TextInput
              style={bs.notasInput}
              placeholder="Observaciones…"
              placeholderTextColor={COLORES.textoSub}
              value={notas}
              onChangeText={setNotas}
              multiline
            />

            <View style={bs.modalResumen}>
              <Text style={bs.resumenLabel}>Total a cobrar</Text>
              <Text style={bs.resumenTotal}>${cart.totales.total.toFixed(2)}</Text>
            </View>

            <View style={bs.modalBotones}>
              <TouchableOpacity
                style={bs.modalCancelar}
                onPress={() => setModalPago(false)}
                disabled={procesando}
              >
                <Text style={bs.modalCancelarText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[bs.modalConfirmar, procesando && { opacity: 0.6 }]}
                onPress={confirmarVenta}
                disabled={procesando}
              >
                {procesando
                  ? <ActivityIndicator color="#fff" />
                  : <Text style={bs.modalConfirmarText}>Confirmar venta</Text>
                }
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const bs = StyleSheet.create({
  contenedor: { flex: 1, backgroundColor: COLORES.fondo },
  topBar: { flexDirection: 'row', padding: 12, gap: 8, alignItems: 'flex-start' },
  busquedaContenedor: { flex: 1, zIndex: 10 },
  inputRow: { position: 'relative', justifyContent: 'center' },
  input: {
    backgroundColor: COLORES.tarjeta, color: COLORES.texto, borderRadius: 10,
    padding: 12, fontSize: 15, borderWidth: 1, borderColor: COLORES.borde,
  },
  dropdown: {
    backgroundColor: COLORES.tarjeta, borderRadius: 10,
    borderWidth: 1, borderColor: COLORES.borde,
    position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 100,
  },
  dropdownItem: {
    flexDirection: 'row', alignItems: 'center', padding: 12,
    borderBottomWidth: 1, borderBottomColor: COLORES.borde,
  },
  dropdownNombre: { color: COLORES.texto, fontSize: 14, fontWeight: '600' },
  dropdownStock: { color: COLORES.textoSub, fontSize: 11 },
  dropdownPrecio: { color: COLORES.verde, fontWeight: '700', fontSize: 15 },

  scanBtn: {
    backgroundColor: COLORES.tarjeta, borderRadius: 10,
    padding: 12, borderWidth: 1, borderColor: COLORES.borde,
    alignItems: 'center', justifyContent: 'center',
  },

  lista: { flex: 1, paddingHorizontal: 12 },
  itemRow: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: COLORES.tarjeta,
    borderRadius: 10, padding: 12, marginBottom: 6, gap: 8,
  },
  itemNombre: { color: COLORES.texto, fontSize: 14, fontWeight: '600' },
  itemPrecio: { color: COLORES.textoSub, fontSize: 12 },
  cantidadControl: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  cantBtn: {
    backgroundColor: COLORES.borde, borderRadius: 6,
    width: 28, height: 28, alignItems: 'center', justifyContent: 'center',
  },
  cantBtnText: { color: COLORES.texto, fontSize: 18, lineHeight: 20 },
  cantValor: { color: COLORES.texto, fontSize: 16, fontWeight: '700', minWidth: 24, textAlign: 'center' },
  itemSubtotal: { color: COLORES.verde, fontWeight: '700', fontSize: 14, minWidth: 60, textAlign: 'right' },
  quitarBtn: { padding: 4 },
  quitarText: { color: COLORES.rojo, fontSize: 14 },

  carritoVacio: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 8 },
  carritoVacioTexto: { color: COLORES.texto, fontSize: 18, fontWeight: '600' },
  textoSub: { color: COLORES.textoSub, fontSize: 13 },

  footer: {
    backgroundColor: COLORES.tarjeta, padding: 16,
    borderTopWidth: 1, borderTopColor: COLORES.borde,
  },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 },
  totalLabel: { color: COLORES.textoSub, fontSize: 15 },
  totalValor: { color: COLORES.texto, fontSize: 22, fontWeight: '800' },
  footerBotones: { flexDirection: 'row', gap: 10 },
  vaciarBtn: {
    flex: 1, backgroundColor: COLORES.borde,
    borderRadius: 10, padding: 14, alignItems: 'center',
  },
  vaciarText: { color: COLORES.texto, fontWeight: '600' },
  cobrarBtn: {
    flex: 2, backgroundColor: COLORES.primario,
    borderRadius: 10, padding: 14, alignItems: 'center',
  },
  cobrarText: { color: '#fff', fontWeight: '700', fontSize: 16 },

  scannerContenedor: { flex: 1 },
  scannerOverlay: {
    ...StyleSheet.absoluteFillObject, justifyContent: 'center', alignItems: 'center',
  },
  scannerFrame: {
    width: 260, height: 160, borderWidth: 3,
    borderColor: COLORES.primario, borderRadius: 12, marginBottom: 24,
  },
  scannerTexto: { color: '#fff', fontSize: 16, fontWeight: '600', marginBottom: 24 },
  cancelarScan: { backgroundColor: 'rgba(0,0,0,0.7)', padding: 16, borderRadius: 10 },
  cancelarScanText: { color: '#fff', fontWeight: '700' },

  modalOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'flex-end',
  },
  modalContenido: {
    backgroundColor: COLORES.tarjeta, borderTopLeftRadius: 20, borderTopRightRadius: 20,
    padding: 20, paddingBottom: 36,
  },
  modalTitulo: { color: COLORES.texto, fontSize: 20, fontWeight: '800', marginBottom: 16 },
  modalSeccion: { color: COLORES.textoSub, fontSize: 12, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 },
  metodosGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 },
  metodoBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: COLORES.borde, borderRadius: 10, padding: 10, paddingHorizontal: 14,
  },
  metodoBtnActivo: { backgroundColor: COLORES.primario },
  metodoBtnText: { color: COLORES.textoSub, fontWeight: '600' },
  notasInput: {
    backgroundColor: COLORES.fondo, color: COLORES.texto,
    borderRadius: 10, padding: 12, fontSize: 14,
    borderWidth: 1, borderColor: COLORES.borde, marginBottom: 16,
    minHeight: 60,
  },
  modalResumen: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', marginBottom: 16,
  },
  resumenLabel: { color: COLORES.textoSub, fontSize: 15 },
  resumenTotal: { color: COLORES.verde, fontSize: 28, fontWeight: '800' },
  modalBotones: { flexDirection: 'row', gap: 10 },
  modalCancelar: {
    flex: 1, backgroundColor: COLORES.borde,
    borderRadius: 10, padding: 16, alignItems: 'center',
  },
  modalCancelarText: { color: COLORES.texto, fontWeight: '600' },
  modalConfirmar: {
    flex: 2, backgroundColor: COLORES.verde,
    borderRadius: 10, padding: 16, alignItems: 'center',
  },
  modalConfirmarText: { color: '#fff', fontWeight: '700', fontSize: 16 },
});
