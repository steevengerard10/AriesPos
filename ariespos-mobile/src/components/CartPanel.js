import React from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import CartItem from './CartItem';

const paymentOptions = ['Efectivo', 'Tarjeta', 'Transferencia', 'Fiado'];

export default function CartPanel({ visible, onClose, items, onIncrease, onDecrease, onRemove, customer, customers = [], onCustomerChange, paymentMethod, onPaymentChange, receivedCash, onReceivedCashChange, discount, onDiscountChange, note, onNoteChange, total, subtotal, tax, onCheckout, isTablet }) {
  const content = (
    <View style={styles.panel}>
      <View style={styles.headerRow}>
        <Text style={styles.panelTitle}>Carrito</Text>
        <Text style={styles.counter}>{items.length} items</Text>
      </View>

      <Text style={styles.sectionLabel}>Cliente</Text>
      <View style={styles.selectWrap}>
        {customers.map((client) => (
          <Pressable
            key={client.id}
            onPress={() => onCustomerChange(client)}
            style={[styles.optionChip, customer?.id === client.id && styles.optionChipActive]}
          >
            <Text style={styles.optionText}>{client.nombre}</Text>
          </Pressable>
        ))}
      </View>

      <Text style={styles.sectionLabel}>Método de pago</Text>
      <View style={styles.selectWrap}>
        {paymentOptions.map((option) => (
          <Pressable
            key={option}
            onPress={() => onPaymentChange(option)}
            style={[styles.optionChip, paymentMethod === option && styles.optionChipActive]}
          >
            <Text style={styles.optionText}>{option}</Text>
          </Pressable>
        ))}
      </View>

      <View style={styles.sectionRow}>
        <Text style={styles.sectionLabel}>Efectivo recibido</Text>
        <TextInput
          value={receivedCash}
          onChangeText={onReceivedCashChange}
          keyboardType="numeric"
          placeholder="0.00"
          placeholderTextColor="#6b6f80"
          style={styles.input}
        />
      </View>

      <View style={styles.sectionRow}>
        <Text style={styles.sectionLabel}>Descuento</Text>
        <TextInput
          value={discount}
          onChangeText={onDiscountChange}
          keyboardType="numeric"
          placeholder="0"
          placeholderTextColor="#6b6f80"
          style={styles.input}
        />
      </View>

      <Text style={styles.sectionLabel}>Nota</Text>
      <TextInput
        value={note}
        onChangeText={onNoteChange}
        multiline
        numberOfLines={3}
        placeholder="Observaciones"
        placeholderTextColor="#6b6f80"
        style={styles.textArea}
      />

      <ScrollView style={styles.cartList} showsVerticalScrollIndicator={false}>
        {items.map((item) => (
          <CartItem
            key={item.id}
            item={item}
            onIncrease={onIncrease}
            onDecrease={onDecrease}
            onRemove={onRemove}
          />
        ))}
      </ScrollView>

      <View style={styles.summaryBox}>
        <View style={styles.summaryRow}><Text style={styles.summaryLabel}>Subtotal</Text><Text style={styles.summaryValue}>${subtotal.toFixed(2)}</Text></View>
        <View style={styles.summaryRow}><Text style={styles.summaryLabel}>Impuesto</Text><Text style={styles.summaryValue}>${tax.toFixed(2)}</Text></View>
        <View style={styles.summaryRow}><Text style={styles.summaryLabel}>Descuento</Text><Text style={styles.summaryValue}>-${Number(discount || 0).toFixed(2)}</Text></View>
        <View style={styles.summaryRow}><Text style={styles.summaryLabel}>Cambio</Text><Text style={styles.summaryValue}>${(paymentMethod === 'Efectivo' ? Number(receivedCash || 0) - total : 0).toFixed(2)}</Text></View>
        <View style={[styles.summaryRow, styles.summaryTotalRow]}><Text style={styles.summaryTotalLabel}>TOTAL</Text><Text style={styles.summaryTotalValue}>${total.toFixed(2)}</Text></View>
      </View>

      <Pressable onPress={onCheckout} style={styles.checkoutButton}>
        <Text style={styles.checkoutText}>[Cobrar]</Text>
      </Pressable>
    </View>
  );

  if (visible === false && !isTablet) {
    return null;
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        {content}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  panel: {
    backgroundColor: '#0f1117',
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    padding: 16,
    maxHeight: '90%',
    borderWidth: 1,
    borderColor: '#2e3247',
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  panelTitle: {
    color: '#e8eaf6',
    fontWeight: '900',
    fontSize: 20,
  },
  counter: {
    color: '#6c63ff',
    fontWeight: '800',
  },
  sectionLabel: {
    color: '#b0b3c1',
    fontSize: 12,
    fontWeight: '800',
    marginTop: 10,
    marginBottom: 6,
  },
  selectWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  optionChip: {
    borderRadius: 999,
    backgroundColor: '#252836',
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: '#2e3247',
  },
  optionChipActive: {
    backgroundColor: '#6c63ff',
    borderColor: '#6c63ff',
  },
  optionText: {
    color: '#e8eaf6',
    fontSize: 11,
    fontWeight: '800',
  },
  sectionRow: {
    marginTop: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: '#2e3247',
    borderRadius: 10,
    color: '#fff',
    paddingHorizontal: 10,
    paddingVertical: 10,
    backgroundColor: '#1a1d27',
  },
  textArea: {
    borderWidth: 1,
    borderColor: '#2e3247',
    borderRadius: 10,
    color: '#fff',
    paddingHorizontal: 10,
    paddingVertical: 10,
    minHeight: 60,
    backgroundColor: '#1a1d27',
    textAlignVertical: 'top',
  },
  cartList: {
    marginTop: 12,
    maxHeight: 220,
  },
  summaryBox: {
    marginTop: 12,
    backgroundColor: '#1a1d27',
    borderRadius: 12,
    padding: 12,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  summaryLabel: {
    color: '#b0b3c1',
    fontSize: 12,
  },
  summaryValue: {
    color: '#e8eaf6',
    fontSize: 12,
    fontWeight: '800',
  },
  summaryTotalRow: {
    marginTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#2e3247',
    paddingTop: 8,
  },
  summaryTotalLabel: {
    color: '#fff',
    fontWeight: '900',
    fontSize: 14,
  },
  summaryTotalValue: {
    color: '#6c63ff',
    fontWeight: '900',
    fontSize: 16,
  },
  checkoutButton: {
    marginTop: 12,
    backgroundColor: '#4caf50',
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
  },
  checkoutText: {
    color: '#fff',
    fontWeight: '900',
    fontSize: 15,
  },
});
