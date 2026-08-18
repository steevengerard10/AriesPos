/**
 * ARIESPos API Client
 * Todas las llamadas REST al servidor Express del desktop
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

const DEFAULT_TIMEOUT = 8000;

async function getBaseURL() {
  const stored = await AsyncStorage.getItem('serverUrl');
  return stored || 'http://192.168.1.63:3001';
}

async function request(path, options = {}) {
  const baseURL = await getBaseURL();
  const url = `${baseURL}${path}`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT);

  try {
    const res = await fetch(url, {
      headers: { 'Content-Type': 'application/json', ...options.headers },
      signal: controller.signal,
      ...options,
      body: options.body ? JSON.stringify(options.body) : undefined,
    });

    clearTimeout(timer);

    if (!res.ok) {
      const err = await res.json().catch(() => ({ message: `HTTP ${res.status}` }));
      throw new Error(err.message || `HTTP ${res.status}`);
    }

    return res.json();
  } catch (err) {
    clearTimeout(timer);
    if (err.name === 'AbortError') throw new Error('Tiempo de conexión agotado');
    throw err;
  }
}

export const api = {
  get:    (path, headers) => request(path, { method: 'GET', headers }),
  post:   (path, body)    => request(path, { method: 'POST', body }),
  put:    (path, body)    => request(path, { method: 'PUT', body }),
  delete: (path)          => request(path, { method: 'DELETE' }),
};
