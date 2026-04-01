import React from 'react';
import { View, Text, Switch, TextInput, StyleSheet } from 'react-native';

export default function VentaOpciones({ esFiado, setEsFiado, descuento, setDescuento, observaciones, setObservaciones }) {
  return (
    <View style={styles.box}>
      <View style={styles.row}>
        <Text>Fiado</Text>
        <Switch value={esFiado} onValueChange={setEsFiado} />
      </View>
      <View style={styles.row}>
        <Text>Descuento</Text>
        <TextInput
          style={styles.input}
          value={descuento}
          onChangeText={setDescuento}
          keyboardType="numeric"
          placeholder="$0"
        />
      </View>
      <View style={styles.row}>
        <Text>Observaciones</Text>
        <TextInput
          style={[styles.input, {flex:1}]}
          value={observaciones}
          onChangeText={setObservaciones}
          placeholder="Notas..."
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  box: { marginVertical: 16, padding: 12, backgroundColor: '#f7f7f7', borderRadius: 8 },
  row: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  input: { borderWidth: 1, borderColor: '#ccc', borderRadius: 8, padding: 8, marginLeft: 8, minWidth: 60 },
});
