import React, { useEffect, useState } from 'react';
import { Alert } from 'react-native';
import { io } from 'socket.io-client';
import AppNavigator from './navigation/AppNavigator';
import { serverStore } from './store/serverStore';
import { useAppUpdates } from './hooks/useAppUpdates';

export default function App() {
  const [alerts, setAlerts] = useState([]);
  const [scanning, setScanning] = useState(false);
  const [hasPermission, setHasPermission] = useState(null);
  const [serverUrl, setServerUrl] = useState(null); // null mientras carga

  // Verificar actualizaciones OTA en producción
  useAppUpdates();

  // Cargar URL guardada del almacenamiento al inicio
  useEffect(() => {
    serverStore.loadSaved().then((url) => {
      setServerUrl(url);
    });
    const unsub = serverStore.subscribe((url) => setServerUrl(url));
    return unsub;
  }, []);

  useEffect(() => {
    (async () => {
      const { status } = await require('expo-barcode-scanner').BarCodeScanner.requestPermissionsAsync();
      setHasPermission(status === 'granted');
    })();
  }, []);

  useEffect(() => {
    if (!serverUrl) return;
    const s = io(serverUrl, { reconnectionDelay: 2000, reconnectionAttempts: 10 });
    s.on('pos:alert', (data) => {
      setAlerts((prev) => [{...data, id: Date.now()}, ...prev]);
      Alert.alert('Alerta POS', data.message + (data.detail ? ('\n' + data.detail) : ''));
    });
    s.on('pos:cart-abandoned', (data) => {
      setAlerts((prev) => [{type: 'sale_cancelled', message: `Venta cancelada (${data.count} ítems)`, detail: data.items?.join(', '), id: Date.now()}, ...prev]);
      Alert.alert('Venta cancelada', `Ítems: ${data.items?.join(', ')}`);
    });
    s.on('fiados:list-changed', () => {
      // Futuro: refrescar lista de fiados si hay una pantalla de fiados activa
    });
    return () => s.disconnect();
  }, [serverUrl]);

  const handleBarCodeScanned = ({ type, data }) => {
    setScanning(false);
    Alert.alert('Código escaneado', `Tipo: ${type}\nValor: ${data}`);
    // Aquí puedes enviar el código al servidor o buscar el producto
  };

  if (hasPermission === null || serverUrl === null) {
    return null;
  }
  if (hasPermission === false) {
    return null;
  }

  return (
    <AppNavigator
      alerts={alerts}
      onScan={() => setScanning(true)}
      scanning={scanning}
      handleBarCodeScanned={handleBarCodeScanned}
    />
  );
}
