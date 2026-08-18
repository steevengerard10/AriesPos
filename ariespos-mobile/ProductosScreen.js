import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, TextInput, FlatList, TouchableOpacity,
  Modal, StyleSheet, ActivityIndicator, Alert, Switch,
} from 'react-native';
import { productosAPI } from '../api/productos';

const COLORES = {
  fondo: '#0f172a', tarjeta: '#1e293b', borde: '#334155',
  primario: '#6366f1', verde: '#22c55e', amarillo: '#f59e0b',
  rojo: '#ef4444', texto: '#f1f5f9', textoSub: '#94a3b8',
};

const STOCK_BAJO = 5;

function ProductoCard({ producto, onEditar, onEliminar }) {
  const stockBajo = Number(producto.stock) <= STOCK_BAJO;

  return (
    <View style={ps.card}>
      <View style={{ flex: 1 }}>
        <Text style={ps.nombre} numberOfLines={1}>{producto.nombre}</Text>
        <View style={ps.infoRow}>
          <Text style={ps.precio}>${Number(producto.precio).toFixed(2)}</Text>
          <Text style={[ps.stock, stockBajo && { color: COLORES.amarillo }]}>
            Stock: {producto.stock}{stockBajo ? ' ⚠' : ''}
          </Text>
        </View>
        {producto.categoria && (
          <Text style={ps.categoria}>{producto.categoria}</Text>
        )}
      </View>
      <View style={ps.acciones}>
        <TouchableOpacity style={ps.editarBtn} onPress={() => onEditar(producto)}>
          <Text style={ps.editarText}>Editar</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => onEliminar(producto)}>
          <Text style={ps.eliminarText}>✕</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

function ModalProducto({ visible, producto, onGuardar, onCerrar }) {
  const [nombre, setNombre] = useState('');
  const [precio, setPrecio] = useState('');
  const [stock, setStock] = useState('');
  const [costo, setCosto] = useState('');
  const [categoria, setCategoria] = useState('');
  const [codigoBarras, setCodigoBarras] = useState('');
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    if (producto) {
      setNombre(producto.nombre ?? '');
      setPrecio(String(producto.precio ?? ''));
      setStock(String(producto.stock ?? ''));
      setCosto(String(producto.costo ?? ''));
      setCategoria(producto.categoria ?? '');
      setCodigoBarras(producto.codigoBarras ?? '');
    } else {
      setNombre(''); setPrecio(''); setStock('');
      setCosto(''); setCategoria(''); setCodigoBarras('');
    }
  }, [producto, visible]);

  const guardar = async () => {
    if (!nombre.trim() || !precio.trim()) {
      Alert.alert('Campos requeridos', 'Nombre y precio son obligatorios.');
      return;
    }
    setGuardando(true);
    try {
      await onGuardar({
        nombre: nombre.trim(),
        precio: parseFloat(precio),
        stock: parseInt(stock) || 0,
        costo: parseFloat(costo) || undefined,
        categoria: categoria.trim() || undefined,
        codigoBarras: codigoBarras.trim() || undefined,
      });
    } finally {
      setGuardando(false);
    }
  };

  const Campo = ({ label, value, onChange, keyboardType = 'default', placeholder = '' }) => (
    <View style={ps.campo}>
      <Text style={ps.campoLabel}>{label}</Text>
      <TextInput
        style={ps.campoInput}
        value={value}
        onChangeText={onChange}
        keyboardType={keyboardType}
        placeholder={placeholder}
        placeholderTextColor={COLORES.textoSub}
      />
    </View>
  );

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={ps.modalOverlay}>
        <View style={ps.modalContenido}>
          <Text style={ps.modalTitulo}>{producto ? 'Editar producto' : 'Nuevo producto'}</Text>

          <Campo label="Nombre *" value={nombre} onChange={setNombre} placeholder="Ej: Coca-Cola 500ml" />
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <View style={{ flex: 1 }}>
              <Campo label="Precio *" value={precio} onChange={setPrecio} keyboardType="decimal-pad" placeholder="0.00" />
            </View>
            <View style={{ flex: 1 }}>
              <Campo label="Stock" value={stock} onChange={setStock} keyboardType="number-pad" placeholder="0" />
            </View>
          </View>
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <View style={{ flex: 1 }}>
              <Campo label="Costo" value={costo} onChange={setCosto} keyboardType="decimal-pad" placeholder="0.00" />
            </View>
            <View style={{ flex: 1 }}>
              <Campo label="Categoría" value={categoria} onChange={setCategoria} placeholder="Ej: Bebidas" />
            </View>
          </View>
          <Campo label="Código de barras" value={codigoBarras} onChange={setCodigoBarras} keyboardType="number-pad" />

          <View style={ps.modalBotones}>
            <TouchableOpacity style={ps.modalCancelar} onPress={onCerrar} disabled={guardando}>
              <Text style={ps.modalCancelarText}>Cancelar</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[ps.modalGuardar, guardando && { opacity: 0.6 }]} onPress={guardar} disabled={guardando}>
              {guardando
                ? <ActivityIndicator color="#fff" />
                : <Text style={ps.modalGuardarText}>Guardar</Text>
              }
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

export default function ProductosScreen() {
  const [productos, setProductos] = useState([]);
  const [busqueda, setBusqueda] = useState('');
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [productoEditar, setProductoEditar] = useState(null);
  const [soloStockBajo, setSoloStockBajo] = useState(false);

  const cargar = useCallback(async (texto = busqueda) => {
    try {
      setError(null);
      const data = await productosAPI.listar(texto);
      setProductos(data?.productos ?? []);
    } catch (e) {
      setError(e.message);
    } finally {
      setCargando(false);
    }
  }, [busqueda]);

  useEffect(() => { cargar(); }, []);

  const buscarDebounced = useCallback((texto) => {
    setBusqueda(texto);
    clearTimeout(buscarDebounced._t);
    buscarDebounced._t = setTimeout(() => cargar(texto), 400);
  }, [cargar]);

  const abrirNuevo = () => { setProductoEditar(null); setModalVisible(true); };
  const abrirEditar = (p) => { setProductoEditar(p); setModalVisible(true); };
  const cerrarModal = () => setModalVisible(false);

  const guardar = async (datos) => {
    try {
      if (productoEditar) {
        await productosAPI.editar(productoEditar.id, datos);
      } else {
        await productosAPI.crear(datos);
      }
      cerrarModal();
      cargar();
    } catch (e) {
      Alert.alert('Error al guardar', e.message);
    }
  };

  const confirmarEliminar = (p) => {
    Alert.alert(
      'Eliminar producto',
      `¿Eliminar "${p.nombre}"? Esta acción no se puede deshacer.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar', style: 'destructive',
          onPress: async () => {
            try {
              await productosAPI.eliminar(p.id);
              cargar();
            } catch (e) {
              Alert.alert('Error', e.message);
            }
          },
        },
      ]
    );
  };

  const productosFiltrados = soloStockBajo
    ? productos.filter((p) => Number(p.stock) <= STOCK_BAJO)
    : productos;

  return (
    <View style={ps.contenedor}>
      {/* Búsqueda y acciones */}
      <View style={ps.topBar}>
        <TextInput
          style={ps.input}
          placeholder="Buscar productos…"
          placeholderTextColor={COLORES.textoSub}
          value={busqueda}
          onChangeText={buscarDebounced}
        />
        <TouchableOpacity style={ps.nuevoBtn} onPress={abrirNuevo}>
          <Text style={ps.nuevoBtnText}>+ Nuevo</Text>
        </TouchableOpacity>
      </View>

      {/* Filtros */}
      <View style={ps.filtroRow}>
        <Text style={ps.filtroLabel}>Solo stock bajo ⚠</Text>
        <Switch
          value={soloStockBajo}
          onValueChange={setSoloStockBajo}
          trackColor={{ true: COLORES.amarillo }}
          thumbColor="#fff"
        />
        <Text style={ps.filtroCount}>{productosFiltrados.length} productos</Text>
      </View>

      {error && (
        <View style={ps.errorBox}>
          <Text style={ps.errorTexto}>⚠ {error}</Text>
          <TouchableOpacity onPress={() => cargar()}>
            <Text style={{ color: COLORES.primario }}>Reintentar</Text>
          </TouchableOpacity>
        </View>
      )}

      {cargando ? (
        <ActivityIndicator color={COLORES.primario} style={{ marginTop: 40 }} />
      ) : (
        <FlatList
          data={productosFiltrados}
          keyExtractor={(i) => String(i.id)}
          renderItem={({ item }) => (
            <ProductoCard
              producto={item}
              onEditar={abrirEditar}
              onEliminar={confirmarEliminar}
            />
          )}
          contentContainerStyle={{ padding: 12, paddingBottom: 24 }}
          ListEmptyComponent={
            <Text style={[ps.textoSub, { textAlign: 'center', marginTop: 40 }]}>
              No hay productos
            </Text>
          }
        />
      )}

      <ModalProducto
        visible={modalVisible}
        producto={productoEditar}
        onGuardar={guardar}
        onCerrar={cerrarModal}
      />
    </View>
  );
}

const ps = StyleSheet.create({
  contenedor: { flex: 1, backgroundColor: COLORES.fondo },
  topBar: { flexDirection: 'row', padding: 12, gap: 8 },
  input: {
    flex: 1, backgroundColor: COLORES.tarjeta, color: COLORES.texto,
    borderRadius: 10, padding: 12, fontSize: 15,
    borderWidth: 1, borderColor: COLORES.borde,
  },
  nuevoBtn: { backgroundColor: COLORES.primario, borderRadius: 10, padding: 12, justifyContent: 'center' },
  nuevoBtnText: { color: '#fff', fontWeight: '700' },

  filtroRow: {
    flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingBottom: 8, gap: 10,
  },
  filtroLabel: { color: COLORES.textoSub, fontSize: 13, flex: 1 },
  filtroCount: { color: COLORES.textoSub, fontSize: 12 },

  errorBox: {
    backgroundColor: '#450a0a', margin: 12, borderRadius: 10,
    padding: 12, flexDirection: 'row', justifyContent: 'space-between',
  },
  errorTexto: { color: COLORES.rojo, fontSize: 13 },
  textoSub: { color: COLORES.textoSub, fontSize: 14 },

  card: {
    backgroundColor: COLORES.tarjeta, borderRadius: 10,
    padding: 14, marginBottom: 8,
    flexDirection: 'row', alignItems: 'center',
    borderWidth: 1, borderColor: COLORES.borde,
  },
  nombre: { color: COLORES.texto, fontSize: 15, fontWeight: '600', marginBottom: 4 },
  infoRow: { flexDirection: 'row', gap: 14, alignItems: 'center' },
  precio: { color: COLORES.verde, fontWeight: '700', fontSize: 15 },
  stock: { color: COLORES.textoSub, fontSize: 12 },
  categoria: { color: COLORES.primario, fontSize: 11, marginTop: 2 },
  acciones: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  editarBtn: { backgroundColor: COLORES.primario, borderRadius: 7, paddingHorizontal: 10, paddingVertical: 6 },
  editarText: { color: '#fff', fontSize: 12, fontWeight: '600' },
  eliminarText: { color: COLORES.rojo, fontSize: 18, paddingHorizontal: 4 },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' },
  modalContenido: {
    backgroundColor: COLORES.tarjeta, borderTopLeftRadius: 20, borderTopRightRadius: 20,
    padding: 20, paddingBottom: 36,
  },
  modalTitulo: { color: COLORES.texto, fontSize: 18, fontWeight: '800', marginBottom: 16 },
  campo: { marginBottom: 12 },
  campoLabel: { color: COLORES.textoSub, fontSize: 12, marginBottom: 4, textTransform: 'uppercase', letterSpacing: 0.5 },
  campoInput: {
    backgroundColor: COLORES.fondo, color: COLORES.texto,
    borderRadius: 8, padding: 10, fontSize: 15,
    borderWidth: 1, borderColor: COLORES.borde,
  },
  modalBotones: { flexDirection: 'row', gap: 10, marginTop: 8 },
  modalCancelar: { flex: 1, backgroundColor: COLORES.borde, borderRadius: 10, padding: 14, alignItems: 'center' },
  modalCancelarText: { color: COLORES.texto, fontWeight: '600' },
  modalGuardar: { flex: 2, backgroundColor: COLORES.primario, borderRadius: 10, padding: 14, alignItems: 'center' },
  modalGuardarText: { color: '#fff', fontWeight: '700', fontSize: 15 },
});
