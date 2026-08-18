import React, { createContext, useContext, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import apiClient, { setBaseUrl, setPin } from '../api/client';

const AuthContext = createContext();

const STORAGE_KEYS = {
  serverUrl: 'serverUrl',
  pin: 'pin',
  role: 'role',
  businessName: 'businessName',
  auth: 'authState',
};

const defaultServerUrl = 'http://192.168.1.100:3001';

function toBase64(value) {
  if (typeof globalThis.btoa === 'function') {
    return globalThis.btoa(value);
  }
  return Buffer.from(value).toString('base64');
}

export function AuthProvider({ children }) {
  const [serverUrl, setServerUrlState] = useState(defaultServerUrl);
  const [pin, setPinState] = useState('');
  const [role, setRoleState] = useState('cajero');
  const [businessName, setBusinessNameState] = useState('ARIESPOS');
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    const bootstrap = async () => {
      try {
        const savedServerUrl = await AsyncStorage.getItem(STORAGE_KEYS.serverUrl);
        const savedPin = await AsyncStorage.getItem(STORAGE_KEYS.pin);
        const savedRole = await AsyncStorage.getItem(STORAGE_KEYS.role);
        const savedBusinessName = await AsyncStorage.getItem(STORAGE_KEYS.businessName);

        const nextServerUrl = savedServerUrl || defaultServerUrl;
        const nextRole = savedRole || 'cajero';
        const nextPin = savedPin || '';

        setServerUrlState(nextServerUrl);
        setPinState(nextPin);
        setRoleState(nextRole);
        setBusinessNameState(savedBusinessName || 'ARIESPOS');
        await setBaseUrl(nextServerUrl);
        if (nextPin) {
          await setPin(nextPin);
          apiClient.defaults.headers.common.Authorization = `Basic ${toBase64(`${nextPin}:${nextPin}`)}`;
          setIsAuthenticated(true);
        }
      } catch (error) {
        console.error('Auth bootstrap error', error);
      } finally {
        setIsReady(true);
      }
    };

    bootstrap();
  }, []);

  const updateServerUrl = async (nextUrl) => {
    const normalized = nextUrl.trim().replace(/\/$/, '');
    await AsyncStorage.setItem(STORAGE_KEYS.serverUrl, normalized);
    setServerUrlState(normalized);
    await setBaseUrl(normalized);
  };

  const login = async (nextPin, nextRole, nextUrl = serverUrl) => {
    const normalized = nextUrl.trim().replace(/\/$/, '');
    await updateServerUrl(normalized);
    await AsyncStorage.setItem(STORAGE_KEYS.pin, nextPin);
    await AsyncStorage.setItem(STORAGE_KEYS.role, nextRole);
    await setPin(nextPin);
    const authorization = `Basic ${toBase64(`${nextPin}:${nextPin}`)}`;
    apiClient.defaults.headers.common.Authorization = authorization;

    try {
      await apiClient.post('/api/auth/login', { pin: nextPin, role: nextRole });
      const configResponse = await apiClient.get('/api/config');
      const business = configResponse?.data?.nombre || configResponse?.data?.businessName || 'ARIESPOS';
      await AsyncStorage.setItem(STORAGE_KEYS.businessName, business);
      setBusinessNameState(business);
    } catch (error) {
      if (error.response?.status === 401 || error.response?.status === 403) {
        throw new Error('PIN o rol inválido');
      }
      throw error;
    }

    setPinState(nextPin);
    setRoleState(nextRole);
    setIsAuthenticated(true);
  };

  const logout = async () => {
    await AsyncStorage.multiRemove([STORAGE_KEYS.pin, STORAGE_KEYS.role, STORAGE_KEYS.auth, STORAGE_KEYS.businessName]);
    delete apiClient.defaults.headers.common.Authorization;
    setPinState('');
    setRoleState('cajero');
    setBusinessNameState('ARIESPOS');
    setIsAuthenticated(false);
  };

  const testConnection = async (nextUrl = serverUrl) => {
    const normalized = nextUrl.trim().replace(/\/$/, '');
    await updateServerUrl(normalized);
    const response = await apiClient.get('/api/ping');
    return response.data;
  };

  const changePin = async (newPin) => {
    const authorization = `Basic ${toBase64(`${newPin}:${newPin}`)}`;
    apiClient.defaults.headers.common.Authorization = authorization;
    await AsyncStorage.setItem(STORAGE_KEYS.pin, newPin);
    await apiClient.put('/api/settings/pins', { pin: newPin });
    setPinState(newPin);
  };

  return (
    <AuthContext.Provider
      value={{
        serverUrl,
        pin,
        role,
        businessName,
        isAuthenticated,
        isReady,
        setServerUrl: updateServerUrl,
        login,
        logout,
        testConnection,
        changePin,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
