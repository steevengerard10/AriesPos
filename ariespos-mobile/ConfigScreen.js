import React, { useState, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, ActivityIndicator, Alert, ScrollView, Switch,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { api } from '../api/client';

const COLORES = {
  fondo: '#0f172a', tarjeta: '#1e293b', borde: '#334155',
  primario: '#6366f1', verde: '#22c55e', amarillo: '#f59e0b',
  rojo: '#ef4444', texto: '#f1f5f9', textoSub: '#94a3b8',
};

function Campo({ label, value, onChange, keyboardType = 'default', secureTextEntry = false, placeholder = '' }) {
  return (
    <View style={cfg.campo}>
      <Text style={cfg.campoLabel}>{label}</Text>
      <TextInput
        style={cfg.campoInput}
        value={value}
        onChangeText={onChange}
        keyboardType={keyboardType}
        secureTextEntry={secureTextEntry}
        placeholder={placeholder}
        placeholderTextColor={COLORES.textoSub}
        autoCapitalize="none"
        autoCorrect={false}
      />
    </View>
  );
}

export default function ConfigScreen() {
  const [serverUrl, setServerUrl] = useState('http://192.168.1.63:3001');
  const [testando, setTestando] = useState(false);
  const [estadoConexion, setEstadoConexion] = useState(null); // null | 'ok' | 'error'
  const [modoOffline, setModoOffline] = useState(false);
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    AsyncStorage.multiGet(['serverUrl', 'modoOffline']).then(([[, url], [, offline]]) => {
      if (url) setServerUrl(url);
      if (offline) setModoOffline(offline === 'true');
    });
  }, []);

  const testConexion = async () => {
    setTestando(true);
    setEstadoConexion(null);
    try {
      await api.get('/api/health');
      setEstadoConexion('ok');
    } catch {
      // Intentar con /api/stats/dashboard como fallback
      try {
        await api.get('/api/stats/dashboard');
        setEstadoConexion('ok');
      } catch {
        setEstadoConexion('error');
      }
    } finally {
      setTestando(false);
    }
  };

  const guardarConfig = async () => {
    if (!serverUrl.trim()) {
      Alert.alert('URL requerida', 'Ingresá la dirección del servidor.');
      return;
    }
    setGuardando(true);
    try {
      await AsyncStorage.multiSet([
        ['serverUrl', serverUrl.trim()],
        ['modoOffline', String(modoOffline)],
      ]);
      Alert.alert('✓ Configuración guardada');
    } catch (e) {
      Alert.alert('Error al guardar', e.message);
    } finally {
      setGuardando(false);
    }
  };

  return (
    <ScrollView style={cfg.contenedor} contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
      <Text style={cfg.titulo}>Configuración</Text>

      {/* Conexión al servidor */}
      <View style={cfg.seccion}>
        <Text style={cfg.seccionTitulo}>Servidor desktop</Text>

        <Campo
          label="URL del servidor"
          value={serverUrl}
          onChange={setServerUrl}
          keyboardType="url"
          placeholder="http://192.168.1.63:3001"
        />

        <TouchableOpacity
          style={[cfg.boton, cfg.botonSecundario]}
          onPress={testConexion}
          disabled={testando}
        >
          {testando
            ? <ActivityIndicator color={COLORES.primario} />
            : <Text style={cfg.botonSecundarioText}>Probar conexión</Text>
          }
        </TouchableOpacity>

        {estadoConexion === 'ok' && (
          <View style={[cfg.estadoBox, { backgroundColor: '#052e16' }]}>
            <Text style={{ color: COLORES.verde }}>✓ Conexión exitosa</Text>
          </View>
        )}
        {estadoConexion === 'error' && (
          <View style={[cfg.estadoBox, { backgroundColor: '#450a0a' }]}>
            <Text style={{ color: COLORES.rojo }}>✕ No se pudo conectar. Verificá la URL y que el desktop esté encendido.</Text>
          </View>
        )}
      </View>

      {/* Modo offline */}
      <View style={cfg.seccion}>
        <Text style={cfg.seccionTitulo}>Modo de operación</Text>
        <View style={cfg.switchRow}>
          <View style={{ flex: 1 }}>
            <Text style={cfg.switchLabel}>Modo offline / admin independiente</Text>
            <Text style={cfg.switchDesc}>La app usa su propia base de datos local cuando el desktop no está disponible.</Text>
          </View>
          <Switch
            value={modoOffline}
            onValueChange={setModoOffline}
            trackColor={{ true: COLORES.primario }}
            thumbColor="#fff"
          />
        </View>
      </View>

      {/* Info de la app */}
      <View style={cfg.seccion}>
        <Text style={cfg.seccionTitulo}>Información</Text>
        <View style={cfg.infoFila}>
          <Text style={cfg.infoLabel}>App</Text>
          <Text style={cfg.infoValor}>ARIESPos Mobile</Text>
        </View>
        <View style={cfg.infoFila}>
          <Text style={cfg.infoLabel}>Versión</Text>
          <Text style={cfg.infoValor}>2.0.0</Text>
        </View>
        <View style={cfg.infoFila}>
          <Text style={cfg.infoLabel}>SDK</Text>
          <Text style={cfg.infoValor}>Expo 50</Text>
        </View>
      </View>

      {/* Guardar */}
      <TouchableOpacity
        style={[cfg.boton, cfg.botonPrimario, guardando && { opacity: 0.6 }]}
        onPress={guardarConfig}
        disabled={guardando}
      >
        {guardando
          ? <ActivityIndicator color="#fff" />
          : <Text style={cfg.botonPrimarioText}>Guardar configuración</Text>
        }
      </TouchableOpacity>
    </ScrollView>
  );
}

const cfg = StyleSheet.create({
  contenedor: { flex: 1, backgroundColor: COLORES.fondo },
  titulo: { color: COLORES.texto, fontSize: 22, fontWeight: '800', marginBottom: 20 },

  seccion: {
    backgroundColor: COLORES.tarjeta, borderRadius: 14,
    padding: 16, marginBottom: 14, borderWidth: 1, borderColor: COLORES.borde,
  },
  seccionTitulo: { color: COLORES.texto, fontSize: 15, fontWeight: '700', marginBottom: 14 },

  campo: { marginBottom: 12 },
  campoLabel: { color: COLORES.textoSub, fontSize: 12, marginBottom: 4, textTransform: 'uppercase', letterSpacing: 0.5 },
  campoInput: {
    backgroundColor: COLORES.fondo, color: COLORES.texto,
    borderRadius: 8, padding: 12, fontSize: 15,
    borderWidth: 1, borderColor: COLORES.borde,
  },

  estadoBox: { borderRadius: 8, padding: 10, marginTop: 8 },

  switchRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  switchLabel: { color: COLORES.texto, fontSize: 14, fontWeight: '600', marginBottom: 4 },
  switchDesc: { color: COLORES.textoSub, fontSize: 12, lineHeight: 17 },

  infoFila: {
    flexDirection: 'row', justifyContent: 'space-between',
    paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: COLORES.borde,
  },
  infoLabel: { color: COLORES.textoSub, fontSize: 14 },
  infoValor: { color: COLORES.texto, fontSize: 14 },

  boton: { borderRadius: 12, padding: 16, alignItems: 'center', marginTop: 4 },
  botonPrimario: { backgroundColor: COLORES.primario, marginTop: 8 },
  botonPrimarioText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  botonSecundario: { backgroundColor: COLORES.fondo, borderWidth: 1, borderColor: COLORES.primario },
  botonSecundarioText: { color: COLORES.primario, fontWeight: '600' },
});
