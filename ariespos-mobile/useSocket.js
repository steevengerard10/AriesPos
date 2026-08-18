/**
 * useSocket — hook central de Socket.IO para ARIESPos Mobile
 *
 * Gestiona conexión, reconexión y eventos del servidor.
 * Compatible con la lógica existente de useAppUpdates y serverStore.
 */
import { useEffect, useRef, useState, useCallback } from 'react';
import { io } from 'socket.io-client';
import AsyncStorage from '@react-native-async-storage/async-storage';

export function useSocket() {
  const socketRef = useRef(null);
  const [connected, setConnected] = useState(false);
  const [serverUrl, setServerUrl] = useState(null);
  const listenersRef = useRef({});

  // Cargar URL guardada
  useEffect(() => {
    AsyncStorage.getItem('serverUrl').then((url) => {
      setServerUrl(url || 'http://192.168.1.63:3001');
    });
  }, []);

  // Conectar cuando tengamos la URL
  useEffect(() => {
    if (!serverUrl) return;

    const socket = io(serverUrl, {
      transports: ['websocket'],
      reconnectionDelay: 2000,
      reconnectionAttempts: Infinity,
    });

    socketRef.current = socket;

    socket.on('connect', () => setConnected(true));
    socket.on('disconnect', () => setConnected(false));
    socket.on('connect_error', () => setConnected(false));

    // Re-registrar listeners almacenados
    Object.entries(listenersRef.current).forEach(([event, handler]) => {
      socket.on(event, handler);
    });

    return () => {
      socket.disconnect();
      setConnected(false);
    };
  }, [serverUrl]);

  /** Suscribirse a un evento de socket */
  const on = useCallback((event, handler) => {
    listenersRef.current[event] = handler;
    if (socketRef.current) socketRef.current.on(event, handler);

    return () => {
      delete listenersRef.current[event];
      if (socketRef.current) socketRef.current.off(event, handler);
    };
  }, []);

  /** Emitir evento al servidor */
  const emit = useCallback((event, data) => {
    if (socketRef.current?.connected) {
      socketRef.current.emit(event, data);
      return true;
    }
    return false;
  }, []);

  /** Cambiar URL del servidor */
  const changeServer = useCallback(async (newUrl) => {
    await AsyncStorage.setItem('serverUrl', newUrl);
    setServerUrl(newUrl);
  }, []);

  return { connected, on, emit, changeServer, serverUrl };
}
