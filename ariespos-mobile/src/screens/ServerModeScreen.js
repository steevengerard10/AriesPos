import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
  ScrollView,
  Alert,
} from 'react-native';
import { serverStore } from '../store/serverStore';

export default function ServerModeScreen() {
  const [url, setUrl] = useState(serverStore.getUrl());
  const [saved, setSaved] = useState(serverStore.getUrl());
  const [status, setStatus] = useState('idle'); // 'idle' | 'testing' | 'ok' | 'error'
  const [serverInfo, setServerInfo] = useState(null);

  useEffect(() => {
    const unsub = serverStore.subscribe((newUrl) => {
      setSaved(newUrl);
    });
    return unsub;
  }, []);

  const handleTest = async () => {
    setStatus('testing');
    setServerInfo(null);
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);
      const res = await fetch(`${url}/api/status`, { signal: controller.signal });
      clearTimeout(timeoutId);
      if (res.ok) {
        const data = await res.json();
        setServerInfo(data);
        setStatus('ok');
      } else {
        setStatus('error');
      }
    } catch {
      setStatus('error');
    }
  };

  const handleSave = async () => {
    const trimmed = url.trim().replace(/\/$/, '');
    if (!trimmed.startsWith('http://') && !trimmed.startsWith('https://')) {
      Alert.alert('URL inválida', 'La URL debe empezar con http:// o https://');
      return;
    }
    await serverStore.setUrl(trimmed);
    setUrl(trimmed);
    Alert.alert('Guardado', 'URL del servidor actualizada. Reinicia la app para aplicar cambios.');
  };

  const statusColor = status === 'ok' ? '#22c55e' : status === 'error' ? '#ef4444' : '#6b7280';
  const statusText =
    status === 'testing' ? 'Probando conexión...' :
    status === 'ok' ? '✓ Servidor respondiendo' :
    status === 'error' ? '✗ Sin respuesta del servidor' :
    'Esperando prueba';

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Configuración del Servidor</Text>
      <Text style={styles.subtitle}>
        Configura la dirección IP del PC que actúa como servidor ARIESPos.
        En caso de corte de luz, el servidor puede migrar a otro equipo o al punto de acceso del celular.
      </Text>

      <View style={styles.card}>
        <Text style={styles.label}>URL del servidor actual</Text>
        <Text style={styles.savedUrl}>{saved}</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.label}>Nueva URL del servidor</Text>
        <TextInput
          style={styles.input}
          value={url}
          onChangeText={setUrl}
          placeholder="http://192.168.1.100:3001"
          placeholderTextColor="#6b7280"
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="url"
        />

        <View style={styles.row}>
          <TouchableOpacity
            style={[styles.btn, styles.btnSecondary, { flex: 1, marginRight: 8 }]}
            onPress={handleTest}
            disabled={status === 'testing'}
          >
            {status === 'testing' ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Text style={styles.btnText}>Probar conexión</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.btn, styles.btnPrimary, { flex: 1 }]}
            onPress={handleSave}
          >
            <Text style={styles.btnText}>Guardar</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.statusRow}>
          <View style={[styles.dot, { backgroundColor: statusColor }]} />
          <Text style={[styles.statusText, { color: statusColor }]}>{statusText}</Text>
        </View>

        {serverInfo && (
          <View style={styles.infoBox}>
            {serverInfo.negocio && <Text style={styles.infoText}>Negocio: {serverInfo.negocio}</Text>}
            {serverInfo.version && <Text style={styles.infoText}>Versión: {serverInfo.version}</Text>}
            {serverInfo.uptime && <Text style={styles.infoText}>Uptime: {Math.floor(serverInfo.uptime / 60)} min</Text>}
          </View>
        )}
      </View>

      <View style={styles.card}>
        <Text style={styles.label}>¿Cómo usar el celular como servidor de emergencia?</Text>
        <Text style={styles.helpText}>
          1. Activá el punto de acceso (hotspot) en este celular.{'\n'}
          2. Conectá las otras PCs al hotspot del celular.{'\n'}
          3. Ingresá la IP del PC servidor en el campo de arriba (normalmente 192.168.43.x).{'\n'}
          4. Las PCs verán el servidor a través de la conexión de datos del celular.{'\n\n'}
          Si el PC servidor también está fuera de línea, conectá el PC de respaldo al hotspot y cambiá la URL a su IP.
        </Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0d0f14',
  },
  content: {
    padding: 16,
    paddingBottom: 40,
  },
  title: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#f1f5f9',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 13,
    color: '#94a3b8',
    marginBottom: 20,
    lineHeight: 20,
  },
  card: {
    backgroundColor: '#1e2130',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  label: {
    fontSize: 12,
    color: '#94a3b8',
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  savedUrl: {
    fontSize: 15,
    color: '#60a5fa',
    fontFamily: 'monospace',
  },
  input: {
    backgroundColor: '#0d0f14',
    borderWidth: 1,
    borderColor: '#2d3748',
    borderRadius: 8,
    padding: 12,
    color: '#f1f5f9',
    fontSize: 14,
    fontFamily: 'monospace',
    marginBottom: 12,
  },
  row: {
    flexDirection: 'row',
    marginBottom: 12,
  },
  btn: {
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnPrimary: {
    backgroundColor: '#3b82f6',
  },
  btnSecondary: {
    backgroundColor: '#374151',
  },
  btnText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 14,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 8,
  },
  statusText: {
    fontSize: 13,
  },
  infoBox: {
    marginTop: 12,
    padding: 10,
    backgroundColor: '#0d0f14',
    borderRadius: 8,
  },
  infoText: {
    color: '#94a3b8',
    fontSize: 12,
    marginBottom: 2,
  },
  helpText: {
    color: '#94a3b8',
    fontSize: 13,
    lineHeight: 22,
  },
});
