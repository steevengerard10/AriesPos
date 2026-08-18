import { useCallback, useEffect, useRef, useState } from 'react';
import { io } from 'socket.io-client';
import AsyncStorage from '@react-native-async-storage/async-storage';

export function useSocket() {
  const [connected, setConnected] = useState(false);
  const [serverUrl, setServerUrl] = useState('http://192.168.1.100:3001');
  const socketRef = useRef(null);
  const listenersRef = useRef({});

  useEffect(() => {
    const bootstrap = async () => {
      const savedServerUrl = await AsyncStorage.getItem('serverUrl');
      if (savedServerUrl) {
        setServerUrl(savedServerUrl);
      }
    };

    bootstrap();
  }, []);

  useEffect(() => {
    if (!serverUrl) return;

    const normalizedUrl = serverUrl.replace(/\/$/, '');
    if (socketRef.current) {
      socketRef.current.disconnect();
    }

    const socket = io(normalizedUrl, {
      transports: ['websocket'],
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 2000,
    });

    socketRef.current = socket;

    socket.on('connect', () => setConnected(true));
    socket.on('disconnect', () => setConnected(false));
    socket.on('connect_error', () => setConnected(false));

    Object.entries(listenersRef.current).forEach(([event, handler]) => {
      socket.on(event, handler);
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
      setConnected(false);
    };
  }, [serverUrl]);

  const on = useCallback((event, handler) => {
    listenersRef.current[event] = handler;
    if (socketRef.current) {
      socketRef.current.on(event, handler);
    }

    return () => {
      delete listenersRef.current[event];
      if (socketRef.current) {
        socketRef.current.off(event, handler);
      }
    };
  }, []);

  const emit = useCallback((event, payload) => {
    if (socketRef.current?.connected) {
      socketRef.current.emit(event, payload);
      return true;
    }
    return false;
  }, []);

  return {
    connected,
    socket: socketRef.current,
    serverUrl,
    on,
    emit,
    changeServerUrl: setServerUrl,
  };
}
