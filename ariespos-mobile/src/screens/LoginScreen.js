import React, { useState } from 'react';
import { View, Text, TextInput, Button, StyleSheet, Alert } from 'react-native';

export default function LoginScreen({ onLogin }) {
  const [user, setUser] = useState('');
  const [pass, setPass] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    setLoading(true);
    try {
      // Aquí deberías hacer la petición real al backend
      if ((user === 'admin' && pass === '159753') || (user === 'cajero' && pass === '1234')) {
        onLogin({ user });
      } else {
        Alert.alert('Error', 'Usuario o PIN incorrecto');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>ARIESPos</Text>
      <TextInput
        style={styles.input}
        placeholder="Usuario (admin/cajero)"
        autoCapitalize="none"
        value={user}
        onChangeText={setUser}
      />
      <TextInput
        style={styles.input}
        placeholder="PIN"
        secureTextEntry
        keyboardType="numeric"
        value={pass}
        onChangeText={setPass}
      />
      <Button title={loading ? 'Ingresando...' : 'Ingresar'} onPress={handleLogin} disabled={loading} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
    padding: 20,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    marginBottom: 40,
  },
  input: {
    width: '100%',
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
    fontSize: 18,
  },
});
