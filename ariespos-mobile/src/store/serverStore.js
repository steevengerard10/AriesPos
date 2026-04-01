import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = 'ariespos_server_url';
const DEFAULT_URL = 'http://192.168.1.100:3001';

let _url = DEFAULT_URL;
let _listeners = [];

export const serverStore = {
  getUrl: () => _url,

  setUrl: async (url) => {
    _url = url;
    await AsyncStorage.setItem(STORAGE_KEY, url);
    _listeners.forEach((fn) => fn(_url));
  },

  loadSaved: async () => {
    try {
      const saved = await AsyncStorage.getItem(STORAGE_KEY);
      if (saved) _url = saved;
    } catch { /* silencioso */ }
    return _url;
  },

  subscribe: (fn) => {
    _listeners.push(fn);
    return () => { _listeners = _listeners.filter((l) => l !== fn); };
  },
};
