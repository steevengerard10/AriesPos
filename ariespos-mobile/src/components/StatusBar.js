import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

export default function StatusBar({ role, mode, connected, timeLabel }) {
  return (
    <View style={styles.container}>
      <View style={styles.leftBlock}>
        <Text style={styles.business}>ARIESPOS</Text>
        <Text style={styles.meta}>Modo {mode === 'emergency' ? 'Emergencia' : 'Desktop'} • {role === 'admin' ? 'Admin' : 'Cajero'}</Text>
      </View>
      <View style={styles.rightBlock}>
        <View style={[styles.dot, connected ? styles.dotOnline : styles.dotOffline]} />
        <Text style={styles.clock}>{timeLabel}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#1a1d27',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#2e3247',
    padding: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  leftBlock: {
    flex: 1,
  },
  business: {
    color: '#fff',
    fontWeight: '900',
    fontSize: 16,
  },
  meta: {
    color: '#b0b3c1',
    fontSize: 11,
    marginTop: 4,
  },
  rightBlock: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  dotOnline: {
    backgroundColor: '#4caf50',
  },
  dotOffline: {
    backgroundColor: '#e53935',
  },
  clock: {
    color: '#e8eaf6',
    fontWeight: '800',
    fontSize: 12,
  },
});
