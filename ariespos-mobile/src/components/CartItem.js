import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

export default function CartItem({ item, onIncrease, onDecrease, onRemove }) {
  return (
    <View style={styles.itemRow}>
      <View style={styles.leftBlock}>
        <Text style={styles.itemName}>{item.nombre || item.name}</Text>
        <Text style={styles.itemMeta}>${Number(item.precio || item.precio_unitario || 0).toFixed(2)} c/u</Text>
      </View>
      <View style={styles.qtyBlock}>
        <Pressable onPress={() => onDecrease(item.id)} style={styles.qtyButton}><Text style={styles.qtyText}>−</Text></Pressable>
        <Text style={styles.qtyValue}>{item.quantity}</Text>
        <Pressable onPress={() => onIncrease(item.id)} style={styles.qtyButton}><Text style={styles.qtyText}>+</Text></Pressable>
      </View>
      <Text style={styles.itemTotal}>${Number(item.total || 0).toFixed(2)}</Text>
      <Pressable onPress={() => onRemove(item.id)} style={styles.removeButton}><Text style={styles.removeText}>✕</Text></Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#252836',
    borderRadius: 12,
    padding: 10,
    marginBottom: 8,
    gap: 8,
  },
  leftBlock: {
    flex: 1.4,
  },
  itemName: {
    color: '#e8eaf6',
    fontWeight: '800',
    fontSize: 13,
  },
  itemMeta: {
    color: '#b0b3c1',
    fontSize: 10,
    marginTop: 4,
  },
  qtyBlock: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  qtyButton: {
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#2e3247',
  },
  qtyText: {
    color: '#fff',
    fontWeight: '900',
  },
  qtyValue: {
    color: '#fff',
    fontWeight: '800',
    minWidth: 18,
    textAlign: 'center',
  },
  itemTotal: {
    color: '#6c63ff',
    fontWeight: '800',
    minWidth: 60,
    textAlign: 'right',
  },
  removeButton: {
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(229,57,53,0.3)',
  },
  removeText: {
    color: '#fff',
    fontWeight: '900',
  },
});
