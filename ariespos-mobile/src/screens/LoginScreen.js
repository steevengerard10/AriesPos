import React, { useMemo, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import Toast from 'react-native-toast-message';
import { useAuth } from '../context/AuthContext';
import { useServer } from '../context/ServerContext';
import PinInput from '../components/PinInput';

const roles = ['cajero', 'admin'];

export default function LoginScreen() {
  const { login, testConnection, serverUrl, setServerUrl } = useAuth();
  const { switchToEmergency } = useServer();
  const [currentPin, setCurrentPin] = useState('');
  const [role, setRole] = useState('cajero');
  const [serverInput, setServerInput] = useState(serverUrl || 'http://192.168.1.100:3001');
  const [testing, setTesting] = useState(false);
  const [loggingIn, setLoggingIn] = useState(false);
  const [errorMode, setErrorMode] = useState(false);

  const canSubmit = useMemo(() => currentPin.length >= 4, [currentPin]);

  const handleTest = async () => {
    setTesting(true);
    try {
      await testConnection(serverInput);
      setErrorMode(false);
      Toast.show({ type: 'success', text1: 'Conexión OK', text2: 'Servidor desktop disponible' });
    } catch (error) {
      setErrorMode(true);
      Toast.show({ type: 'error', text1: 'Sin conexión', text2: 'Servidor no disponible, puedes usar emergencia' });
    } finally {
      setTesting(false);
    }
  };

  const handleLogin = async () => {
    if (currentPin.length < 4) {
      Toast.show({ type: 'error', text1: 'PIN incompleto', text2: 'Ingresa al menos 4 dígitos' });
      return;
    }

    setLoggingIn(true);
    try {
      await setServerUrl(serverInput);
      await login(currentPin, role, serverInput);
      Toast.show({ type: 'success', text1: 'Bienvenido', text2: `Iniciaste como ${role}` });
    } catch (error) {
      Alert.alert('Error de acceso', error.message || 'No fue posible iniciar sesión');
    } finally {
      setLoggingIn(false);
    }
  };

  const handleEmergency = async () => {
    await switchToEmergency();
    Toast.show({ type: 'info', text1: 'Modo emergencia', text2: 'Servidor local activo' });
  };

  return (
    <View style={styles.screen}>
      <View style={styles.card}>
        <Text style={styles.title}>ARIESPOS MOBILE</Text>
        <Text style={styles.subtitle}>Acceso seguro con PIN</Text>

        <View style={styles.roleRow}>
          {roles.map((item) => (
            <Pressable
              key={item}
              onPress={() => setRole(item)}
              style={[styles.roleButton, role === item && styles.roleButtonActive]}
            >
              <Text style={[styles.roleText, role === item && styles.roleTextActive]}>{item === 'admin' ? 'Admin' : 'Cajero'}</Text>
            </Pressable>
          ))}
        </View>

        <View style={styles.serverBox}>
          <Text style={styles.fieldLabel}>Servidor</Text>
          <TextInput
            value={serverInput}
            onChangeText={setServerInput}
            style={styles.input}
            placeholder="http://192.168.1.100:3001"
            placeholderTextColor="#6b6f80"
          />
          <View style={styles.actionRow}>
            <Pressable onPress={handleTest} style={styles.secondaryButton} disabled={testing}>
              <Text style={styles.secondaryButtonText}>{testing ? 'Probando...' : 'Test connection'}</Text>
            </Pressable>
            {errorMode ? (
              <Pressable onPress={handleEmergency} style={styles.emergencyButton}>
                <Text style={styles.emergencyText}>Switch to Emergency Mode</Text>
              </Pressable>
            ) : null}
          </View>
        </View>

        <Text style={styles.fieldLabel}>PIN</Text>
        <PinInput value={currentPin} onChange={setCurrentPin} onSubmit={handleLogin} disabled={loggingIn} />

        <Pressable onPress={handleLogin} disabled={!canSubmit || loggingIn} style={[styles.loginButton, (!canSubmit || loggingIn) && styles.loginButtonDisabled]}>
          <Text style={styles.loginButtonText}>{loggingIn ? 'Ingresando...' : 'Entrar'}</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#0f1117',
    justifyContent: 'center',
    padding: 18,
  },
  card: {
    backgroundColor: '#1a1d27',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#2e3247',
    padding: 18,
  },
  title: {
    color: '#fff',
    fontSize: 26,
    fontWeight: '900',
    textAlign: 'center',
  },
  subtitle: {
    color: '#b0b3c1',
    textAlign: 'center',
    marginBottom: 18,
  },
  roleRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 16,
  },
  roleButton: {
    flex: 1,
    borderRadius: 999,
    paddingVertical: 10,
    alignItems: 'center',
    backgroundColor: '#252836',
    borderWidth: 1,
    borderColor: '#2e3247',
  },
  roleButtonActive: {
    backgroundColor: '#6c63ff',
    borderColor: '#6c63ff',
  },
  roleText: {
    color: '#e8eaf6',
    fontWeight: '800',
  },
  roleTextActive: {
    color: '#fff',
  },
  serverBox: {
    marginBottom: 12,
  },
  fieldLabel: {
    color: '#b0b3c1',
    fontWeight: '800',
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#252836',
    color: '#fff',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: '#2e3247',
    marginBottom: 10,
  },
  actionRow: {
    flexDirection: 'row',
    gap: 10,
  },
  secondaryButton: {
    flex: 1,
    backgroundColor: '#252836',
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#2e3247',
  },
  secondaryButtonText: {
    color: '#e8eaf6',
    fontWeight: '800',
  },
  emergencyButton: {
    flex: 1,
    backgroundColor: '#ff9800',
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center',
  },
  emergencyText: {
    color: '#1a1d27',
    fontWeight: '900',
  },
  loginButton: {
    marginTop: 14,
    backgroundColor: '#4caf50',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  loginButtonDisabled: {
    opacity: 0.5,
  },
  loginButtonText: {
    color: '#fff',
    fontWeight: '900',
    fontSize: 15,
  },
});
