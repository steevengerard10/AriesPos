import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

export default function ProductCard({ product, onPress }) {
  const stock = Number(product.stock ?? product.cantidad ?? 0);
  const outOfStock = stock <= 0;

  return (
    <Pressable onPress={() => onPress(product)} style={({ pressed }) => [styles.card, pressed && styles.pressed, outOfStock && styles.outOfStock]}>
      <View style={styles.headerRow}>
        <Text style={styles.category}>{product.categoria || product.category || 'General'}</Text>
        <Text style={[styles.stockBadge, outOfStock ? styles.stockBadgeEmpty : styles.stockBadgeOk]}>{stock} und</Text>
      </View>
      <Text style={styles.name}>{product.nombre || product.name}</Text>
      <Text style={styles.price}>${Number(product.precio || product.precio_unitario || 0).toFixed(2)}</Text>
      {outOfStock ? <Text style={styles.outOfStockText}>Sin stock</Text> : <Text style={styles.availableText}>Disponible</Text>}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#1a1d27',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#2e3247',
    padding: 14,
    marginBottom: 12,
  },
  pressed: {
    opacity: 0.92,
    transform: [{ scale: 0.98 }],
  },
  outOfStock: {
    opacity: 0.45,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  category: {
    color: '#b0b3c1',
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  stockBadge: {
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 4,
    fontSize: 10,
    fontWeight: '800',
  },
  stockBadgeOk: {
    backgroundColor: 'rgba(76,175,80,0.16)',
    color: '#4caf50',
  },
  stockBadgeEmpty: {
    backgroundColor: 'rgba(229,57,53,0.18)',
    color: '#e53935',
  },
  name: {
    color: '#e8eaf6',
    fontSize: 16,
    fontWeight: '800',
    marginBottom: 6,
  },
  price: {
    color: '#6c63ff',
    fontSize: 18,
    fontWeight: '800',
    marginBottom: 6,
  },
  outOfStockText: {
    color: '#e53935',
    fontSize: 11,
    fontWeight: '800',
  },
  availableText: {
    color: '#4caf50',
    fontSize: 11,
    fontWeight: '800',
  },
});
