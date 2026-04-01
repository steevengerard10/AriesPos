import React, { useState } from 'react';
import { View, Text, Button, Modal, TouchableOpacity, StyleSheet } from 'react-native';

const metodos = [
  { id: 'efectivo', label: 'Efectivo' },
  { id: 'tarjeta', label: 'Tarjeta' },
  { id: 'mp', label: 'MercadoPago' },
  { id: 'fiado', label: 'Fiado' },
];

export default function CobroModal({ visible, total, onClose, onConfirm, esFiado }) {
  const [metodo, setMetodo] = useState('efectivo');

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={styles.bg}>
        <View style={styles.modal}>
          <Text style={styles.title}>Cobrar</Text>
          <Text style={styles.total}>Total: ${total}</Text>
          {metodos.filter(m => esFiado ? m.id === 'fiado' : m.id !== 'fiado').map(m => (
            <TouchableOpacity
              key={m.id}
              style={[styles.metodo, metodo === m.id && styles.metodoSel]}
              onPress={() => setMetodo(m.id)}
            >
              <Text>{m.label}</Text>
            </TouchableOpacity>
          ))}
          <View style={{flexDirection:'row', justifyContent:'space-between', marginTop:20}}>
            <Button title="Cancelar" onPress={onClose} />
            <Button title="Confirmar" onPress={() => onConfirm(metodo)} />
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  bg: { flex:1, backgroundColor:'rgba(0,0,0,0.2)', justifyContent:'center', alignItems:'center' },
  modal: { backgroundColor:'#fff', padding:24, borderRadius:12, width:320, elevation:5 },
  title: { fontSize:22, fontWeight:'bold', marginBottom:10 },
  total: { fontSize:18, marginBottom:16 },
  metodo: { padding:12, borderWidth:1, borderColor:'#eee', borderRadius:8, marginBottom:8 },
  metodoSel: { backgroundColor:'#e0f7fa' },
});
