import React, { useState } from 'react';
import { View, Text, FlatList, TextInput, TouchableOpacity, StyleSheet, Button } from 'react-native';

export default function ClienteSelector({ clientes, clienteSel, setClienteSel, onClose }) {
  const [busqueda, setBusqueda] = useState('');
  const filtrados = clientes.filter(c => c.nombre.toLowerCase().includes(busqueda.toLowerCase()));
  return (
    <View style={styles.modal}>
      <Text style={styles.title}>Seleccionar cliente</Text>
      <TextInput
        style={styles.input}
        placeholder="Buscar cliente"
        value={busqueda}
        onChangeText={setBusqueda}
      />
      <FlatList
        data={filtrados}
        keyExtractor={item => item.id.toString()}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={[styles.item, clienteSel?.id === item.id && styles.itemSel]}
            onPress={() => setClienteSel(item)}
          >
            <Text>{item.nombre}</Text>
            {item.saldo_deuda > 0 && <Text style={{color:'red'}}>Deuda: ${item.saldo_deuda}</Text>}
          </TouchableOpacity>
        )}
        style={{maxHeight: 200}}
      />
      <Button title="Cerrar" onPress={onClose} />
    </View>
  );
}

const styles = StyleSheet.create({
  modal: { backgroundColor: '#fff', padding: 20, borderRadius: 12, elevation: 5 },
  title: { fontSize: 20, fontWeight: 'bold', marginBottom: 10 },
  input: { borderWidth: 1, borderColor: '#ccc', borderRadius: 8, padding: 8, marginBottom: 10 },
  item: { padding: 10, borderBottomWidth: 1, borderColor: '#eee' },
  itemSel: { backgroundColor: '#e0f7fa' },
});
