import React from 'react';
import { View, Text, Button, StyleSheet, FlatList } from 'react-native';

export default function HomeScreen({ alerts, onScan, scanning, BarCodeScanner, handleBarCodeScanned }) {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>ARIESPos Mobile</Text>
      <Button title="Escanear código de barras" onPress={onScan} />
      {scanning && (
        <BarCodeScanner
          onBarCodeScanned={handleBarCodeScanned}
          style={StyleSheet.absoluteFillObject}
        />
      )}
      <Text style={styles.subtitle}>Alertas recientes:</Text>
      <FlatList
        data={alerts}
        keyExtractor={item => item.id.toString()}
        renderItem={({ item }) => (
          <View style={styles.alert}>
            <Text style={{fontWeight:'bold'}}>{item.type}</Text>
            <Text>{item.message}</Text>
            {item.detail ? <Text style={{color:'#888'}}>{item.detail}</Text> : null}
          </View>
        )}
      />
      <Text style={{marginTop:20, color:'#aaa'}}>Versión demo - UI completa en desarrollo</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'flex-start',
    paddingTop: 60,
    paddingHorizontal: 10,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 20,
  },
  subtitle: {
    fontSize: 18,
    marginTop: 30,
    marginBottom: 10,
    alignSelf: 'flex-start',
  },
  alert: {
    backgroundColor: '#f9f9f9',
    borderColor: '#eee',
    borderWidth: 1,
    borderRadius: 8,
    padding: 10,
    marginBottom: 8,
    width: 340,
  },
});
