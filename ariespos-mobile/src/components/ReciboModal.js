import React from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';

export default function ReciboModal({ visible, onClose, sale, onPrint }) {
  if (!sale) return null;

  const renderItem = (item) => `${item.quantity}x ${item.nombre || item.name} - $${Number(item.total || 0).toFixed(2)}`;

  const buildHtml = () => `
    <html>
      <body style="font-family:Segoe UI, sans-serif; padding:20px; color:#111;">
        <h2>ARIESPOS</h2>
        <p>Venta: ${sale.id || 'N/A'}</p>
        <p>Metodo: ${sale.metodoPago || 'Efectivo'}</p>
        <ul>
          ${sale.items.map((item) => `<li>${renderItem(item)}</li>`).join('')}
        </ul>
        <p><strong>Total: $${Number(sale.total || 0).toFixed(2)}</strong></p>
      </body>
    </html>
  `;

  const handlePrint = async () => {
    try {
      const { printAsync } = await import('expo-print');
      await printAsync({ html: buildHtml() });
      if (onPrint) onPrint();
    } catch (error) {
      console.error(error);
    }
  };

  const handleShare = async () => {
    try {
      const { printToFileAsync } = await import('expo-print');
      const { shareAsync } = await import('expo-sharing');
      const file = await printToFileAsync({ html: buildHtml() });
      await shareAsync(file.uri);
    } catch (error) {
      console.error(error);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.sheet}>
          <Text style={styles.title}>Recibo de venta</Text>
          <Text style={styles.subtitle}>#{sale.id || 'N/A'}</Text>
          <Text style={styles.text}>Método: {sale.metodoPago || 'Efectivo'}</Text>
          {sale.items?.map((item) => (
            <Text key={item.id} style={styles.itemLine}>{renderItem(item)}</Text>
          ))}
          <Text style={styles.total}>TOTAL: ${Number(sale.total || 0).toFixed(2)}</Text>

          <View style={styles.actions}>
            <Pressable onPress={handlePrint} style={styles.actionButton}><Text style={styles.actionText}>Imprimir</Text></Pressable>
            <Pressable onPress={handleShare} style={styles.secondaryButton}><Text style={styles.secondaryText}>Compartir</Text></Pressable>
          </View>

          <Pressable onPress={onClose} style={styles.closeButton}><Text style={styles.closeText}>Cerrar</Text></Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  sheet: {
    width: '90%',
    backgroundColor: '#0f1117',
    borderRadius: 18,
    padding: 18,
    borderWidth: 1,
    borderColor: '#2e3247',
  },
  title: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '900',
  },
  subtitle: {
    color: '#b0b3c1',
    marginTop: 4,
  },
  text: {
    color: '#e8eaf6',
    marginTop: 10,
  },
  itemLine: {
    color: '#b0b3c1',
    marginTop: 6,
  },
  total: {
    color: '#6c63ff',
    marginTop: 12,
    fontSize: 18,
    fontWeight: '900',
  },
  actions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 16,
  },
  actionButton: {
    flex: 1,
    backgroundColor: '#4caf50',
    paddingVertical: 12,
    alignItems: 'center',
    borderRadius: 10,
  },
  secondaryButton: {
    flex: 1,
    backgroundColor: '#252836',
    paddingVertical: 12,
    alignItems: 'center',
    borderRadius: 10,
  },
  actionText: {
    color: '#fff',
    fontWeight: '900',
  },
  secondaryText: {
    color: '#e8eaf6',
    fontWeight: '800',
  },
  closeButton: {
    marginTop: 12,
    alignItems: 'center',
    paddingVertical: 10,
  },
  closeText: {
    color: '#6c63ff',
    fontWeight: '800',
  },
});
