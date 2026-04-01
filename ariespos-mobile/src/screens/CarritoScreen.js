import React from 'react';
import { View, Text, FlatList, Button, StyleSheet } from 'react-native';

export default function CarritoScreen({ carrito, onRemove, onCobrar, onBack }) {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Carrito de ventas</Text>
      <FlatList
        data={carrito}
        keyExtractor={item => item.id.toString()}
        renderItem={({ item }) => (
          <View style={styles.carritoItem}>
            <Text>{item.nombre} × {item.cantidad}</Text>
            <Text>${item.total}</Text>
            <Button title="Quitar" onPress={() => onRemove(item.id)} />
          </View>
        )}
        style={{maxHeight: 300}}
      />
      <Text style={styles.total}>Total: ${carrito.reduce((s, i) => s + i.total, 0)}</Text>
      <Button title="Cobrar" onPress={onCobrar} disabled={carrito.length === 0} />
      <Button title="Volver a ventas" onPress={onBack} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, backgroundColor: '#fff' },
  title: { fontSize: 24, fontWeight: 'bold', marginBottom: 10 },
  carritoItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 6 },
  total: { fontSize: 20, fontWeight: 'bold', marginVertical: 16, alignSelf: 'flex-end' },
});
