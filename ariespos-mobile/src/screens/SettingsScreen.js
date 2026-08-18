import React, { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import Toast from 'react-native-toast-message';
import AsyncStorage from '@react-native-async-storage/async-storage';
import apiClient from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useServer } from '../context/ServerContext';

export default function SettingsScreen() {
  const { role, changePin, logout, serverUrl, setServerUrl } = useAuth();
  const { mode, switchToEmergency, switchToDesktop } = useServer();
  const [serverInput, setServerInput] = useState(serverUrl || 'http://192.168.1.100:3001');
  const [newPin, setNewPin] = useState('');
  const [remoteUrl, setRemoteUrl] = useState('');
  const [serverInfo, setServerInfo] = useState({});
  const [theme, setTheme] = useState('dark');

  useEffect(() => {
    const load = async () => {
      try {
        const infoResponse = await apiClient.get('/api/servidor/info');
        setServerInfo(infoResponse.data || {});
        const remoteResponse = await apiClient.get('/api/settings/remote-url');
        setRemoteUrl(remoteResponse.data?.url || '');
      } catch (error) {
        Toast.show({ type: 'error', text1: 'Error', text2: error.message || 'No se pudo cargar ajustes' });
      }
    };

    load();
  }, []);

  const testServer = async () => {
    try {
      await apiClient.get('/api/ping');
      await setServerUrl(serverInput);
      Toast.show({ type: 'success', text1: 'Servidor validado', text2: 'URL guardada correctamente' });
    } catch (error) {
      Toast.show({ type: 'error', text1: 'Sin conexión', text2: 'No se pudo validar el servidor' });
    }
  };

  const handlePinChange = async () => {
    try {
      await changePin(newPin);
      Toast.show({ type: 'success', text1: 'PIN actualizado', text2: 'Se guardó el nuevo PIN' });
      setNewPin('');
    } catch (error) {
      Toast.show({ type: 'error', text1: 'Error', text2: error.message || 'No se pudo cambiar PIN' });
    }
  };

  const toggleEmergency = async () => {
    if (mode === 'emergency') {
      await switchToDesktop();
      Toast.show({ type: 'info', text1: 'Modo desktop', text2: 'Retornando al servidor principal' });
    } else {
      await switchToEmergency();
      Toast.show({ type: 'warning', text1: 'Modo emergencia', text2: 'Servidor local activado' });
    }
  };

  const doLogout = async () => {
    await logout();
    await AsyncStorage.clear();
    Toast.show({ type: 'info', text1: 'Sesión cerrada', text2: 'Volviste al login' });
  };

  return (
    <View style={styles.screen}>
      <Text style={styles.title}>Ajustes</Text>

      <View style={styles.sectionCard}>
        <Text style={styles.sectionTitle}>Servidor</Text>
        <TextInput value={serverInput} onChangeText={setServerInput} style={styles.input} placeholder="URL del servidor" placeholderTextColor="#6b6f80" />
        <View style={styles.buttonRow}>
          <Pressable onPress={testServer} style={styles.primaryButton}><Text style={styles.primaryText}>Test</Text></Pressable>
          <Pressable onPress={toggleEmergency} style={styles.secondaryButton}><Text style={styles.secondaryText}>{mode === 'emergency' ? 'Volver desktop' : 'Modo emergencia'}</Text></Pressable>
        </View>
      </View>

      {role === 'admin' ? (
        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>PIN</Text>
          <TextInput value={newPin} onChangeText={setNewPin} keyboardType="numeric" secureTextEntry style={styles.input} placeholder="Nuevo PIN" placeholderTextColor="#6b6f80" />
          <Pressable onPress={handlePinChange} style={styles.primaryButton}><Text style={styles.primaryText}>Cambiar PIN</Text></Pressable>
        </View>
      ) : null}

      <View style={styles.sectionCard}>
        <Text style={styles.sectionTitle}>Remote URL</Text>
        <Text style={styles.infoText}>{remoteUrl || 'No disponible'}</Text>
      </View>

      <View style={styles.sectionCard}>
        <Text style={styles.sectionTitle}>Tema</Text>
        <View style={styles.buttonRow}>
          <Pressable onPress={() => setTheme('dark')} style={[styles.themeButton, theme === 'dark' && styles.themeButtonActive]}><Text style={styles.themeText}>Oscuro</Text></Pressable>
          <Pressable onPress={() => setTheme('light')} style={[styles.themeButton, theme === 'light' && styles.themeButtonActive]}><Text style={styles.themeText}>Claro</Text></Pressable>
        </View>
      </View>

      <View style={styles.sectionCard}>
        <Text style={styles.sectionTitle}>Información</Text>
        <Text style={styles.infoText}>Versión: 2.2.0</Text>
        <Text style={styles.infoText}>Servidor: {serverInfo.nombre || 'ARIESPOS'}</Text>
        <Text style={styles.infoText}>Modo: {mode}</Text>
      </View>

      <Pressable onPress={doLogout} style={styles.logoutButton}><Text style={styles.logoutText}>Logout</Text></Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#0f1117',
    padding: 12,
  },
  title: {
    color: '#fff',
    fontSize: 24,
    fontWeight: '900',
    marginBottom: 10,
  },
  sectionCard: {
    backgroundColor: '#1a1d27',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#2e3247',
    padding: 12,
    marginBottom: 10,
  },
  sectionTitle: {
    color: '#fff',
    fontWeight: '900',
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#252836',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#2e3247',
    color: '#fff',
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 10,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 10,
  },
  primaryButton: {
    flex: 1,
    backgroundColor: '#6c63ff',
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center',
  },
  primaryText: {
    color: '#fff',
    fontWeight: '900',
  },
  secondaryButton: {
    flex: 1,
    backgroundColor: '#252836',
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center',
  },
  secondaryText: {
    color: '#fff',
    fontWeight: '800',
  },
  themeButton: {
    flex: 1,
    backgroundColor: '#252836',
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center',
  },
  themeButtonActive: {
    backgroundColor: '#4caf50',
  },
  themeText: {
    color: '#fff',
    fontWeight: '800',
  },
  infoText: {
    color: '#b0b3c1',
    marginBottom: 4,
  },
  logoutButton: {
    backgroundColor: '#e53935',
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
  },
  logoutText: {
    color: '#fff',
    fontWeight: '900',
  },
});
