import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';

const apiClient = axios.create({
  timeout: 20000,
  headers: {
    'Content-Type': 'application/json',
  },
});

const normalizeUrl = (url) => {
  const trimmed = (url || '').trim().replace(/\/$/, '');
  return trimmed || 'http://192.168.1.100:3001';
};

export const setBaseUrl = async (url) => {
  const normalized = normalizeUrl(url);
  await AsyncStorage.setItem('serverUrl', normalized);
  apiClient.defaults.baseURL = normalized;
};

export const setPin = async (pin) => {
  const value = pin || '';
  await AsyncStorage.setItem('pin', value);
  if (value) {
    apiClient.defaults.headers.common.Authorization = `Basic ${globalThis.btoa ? globalThis.btoa(`${value}:${value}`) : Buffer.from(`${value}:${value}`).toString('base64')}`;
  } else {
    delete apiClient.defaults.headers.common.Authorization;
  }
};

const restoreDefaults = async () => {
  const savedServerUrl = await AsyncStorage.getItem('serverUrl');
  const savedPin = await AsyncStorage.getItem('pin');
  apiClient.defaults.baseURL = normalizeUrl(savedServerUrl);
  if (savedPin) {
    apiClient.defaults.headers.common.Authorization = `Basic ${globalThis.btoa ? globalThis.btoa(`${savedPin}:${savedPin}`) : Buffer.from(`${savedPin}:${savedPin}`).toString('base64')}`;
  }
};

apiClient.interceptors.request.use(async (config) => {
  await restoreDefaults();
  if (!config.baseURL && apiClient.defaults.baseURL) {
    config.baseURL = apiClient.defaults.baseURL;
  }
  if (apiClient.defaults.headers.common.Authorization) {
    config.headers.Authorization = apiClient.defaults.headers.common.Authorization;
  }
  return config;
});

export const testConnection = async (serverUrl) => {
  const url = normalizeUrl(serverUrl);
  const response = await axios.get(`${url}/api/ping`, { timeout: 15000 });
  return response;
};

restoreDefaults().catch(() => undefined);

export default apiClient;
