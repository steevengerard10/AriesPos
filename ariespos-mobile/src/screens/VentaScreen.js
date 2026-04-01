import React, { useState } from 'react';
import { View, Text, TextInput, Button, FlatList, StyleSheet, TouchableOpacity } from 'react-native';
import VentaOpciones from '../components/VentaOpciones';

export default function VentaScreen({ productos, onAdd, carrito, onRemove, onCobrar, clienteSel, setShowCliente, esFiado, setEsFiado, descuento, setDescuento, observaciones, setObservaciones, onVerCarrito }) {
  const [busqueda, setBusqueda] = useState('');
  const [cantidad, setCantidad] = useState('1');
  const [productoSel, setProductoSel] = useState(null);

  const productosFiltrados = productos.filter(p =>
    p.nombre.toLowerCase().includes(busqueda.toLowerCase())
  );

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Venta</Text>
      <TouchableOpacity style={styles.clienteBtn} onPress={() => setShowCliente(true)}>
        <Text style={{color: clienteSel ? '#222' : '#888'}}>
          {clienteSel ? `Cliente: ${clienteSel.nombre}` : 'Seleccionar cliente'}
        </Text>
      </TouchableOpacity>
      <TextInput
        style={styles.input}
        placeholder="Buscar producto"
        value={busqueda}
        onChangeText={setBusqueda}
      />
      <FlatList
        data={productosFiltrados}
        keyExtractor={item => item.id.toString()}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={[styles.producto, productoSel?.id === item.id && styles.productoSel]}
            onPress={() => setProductoSel(item)}
          >
            <Text>{item.nombre}</Text>
            <Text style={{color:'#888'}}>${item.precio_unitario}</Text>
          </TouchableOpacity>
        )}
        style={{maxHeight: 180}}
      />
      {productoSel && (
        <View style={styles.agregarBox}>
          <Text>Cantidad:</Text>
          <TextInput
            style={styles.inputCant}
            value={cantidad}
            onChangeText={setCantidad}
            keyboardType="numeric"
          />
          <Button title="Agregar" onPress={() => {
            onAdd(productoSel, parseInt(cantidad)||1);
            setProductoSel(null);
            setCantidad('1');
          }} />
        </View>
      )}
      <VentaOpciones
        esFiado={esFiado}
        setEsFiado={setEsFiado}
        descuento={descuento}
        setDescuento={setDescuento}
        observaciones={observaciones}
        setObservaciones={setObservaciones}
      />
      <Button title="Ver carrito" onPress={onVerCarrito} disabled={carrito.length === 0} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, backgroundColor: '#fff' },
  title: { fontSize: 24, fontWeight: 'bold', marginBottom: 10 },
  clienteBtn: { alignSelf: 'flex-start', marginBottom: 8, padding: 8, borderRadius: 8, backgroundColor: '#f0f0f0' },
  input: { borderWidth: 1, borderColor: '#ccc', borderRadius: 8, padding: 8, marginBottom: 10 },
  producto: { padding: 10, borderBottomWidth: 1, borderColor: '#eee' },
  productoSel: { backgroundColor: '#e0f7fa' },
  agregarBox: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  inputCant: { borderWidth: 1, borderColor: '#ccc', borderRadius: 8, padding: 8, width: 60, marginHorizontal: 8 },
  subtitle: { fontSize: 18, fontWeight: 'bold', marginTop: 20, marginBottom: 8 },
  carritoItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 6 },
  total: { fontSize: 20, fontWeight: 'bold', marginVertical: 16, alignSelf: 'flex-end' },
});
