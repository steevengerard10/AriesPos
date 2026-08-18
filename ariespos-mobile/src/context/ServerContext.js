import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import apiClient from '../api/client';
import { useAuth } from './AuthContext';

const ServerContext = createContext();
const MODE_KEY = 'serverMode';
let emergencyServerModule = null;

const getEmergencyServer = () => {
  if (!emergencyServerModule) {
    try {
      emergencyServerModule = require('../emergency/EmergencyServer').default;
    } catch (error) {
      emergencyServerModule = null;
    }
  }
  return emergencyServerModule;
};

export function ServerProvider({ children }) {
  const { serverUrl } = useAuth();
  const [mode, setMode] = useState('desktop');
  const [isChecking, setIsChecking] = useState(false);
  const [failureCount, setFailureCount] = useState(0);
  const [lastError, setLastError] = useState('');

  useEffect(() => {
    const loadMode = async () => {
      const savedMode = await AsyncStorage.getItem(MODE_KEY);
      if (savedMode) {
        setMode(savedMode);
      }
    };

    loadMode();
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      performHealthCheck();
    }, 30000);

    performHealthCheck();

    return () => clearInterval(interval);
  }, [serverUrl]);

  const updateMode = async (nextMode) => {
    await AsyncStorage.setItem(MODE_KEY, nextMode);
    setMode(nextMode);
  };

  const performHealthCheck = async () => {
    setIsChecking(true);
    try {
      const response = await apiClient.get('/api/ping');
      if (response?.data === 'pong' || response?.status === 200) {
        setFailureCount(0);
        setLastError('');
        if (mode !== 'desktop') {
          await updateMode('desktop');
        }
      }
    } catch (error) {
      const nextFailures = failureCount + 1;
      setFailureCount(nextFailures);
      setLastError('Servidor desktop no disponible. Puedes activar modo emergencia manualmente.');
    } finally {
      setIsChecking(false);
    }
  };

  const switchToEmergency = async () => {
    try {
      const emergencyServer = getEmergencyServer();
      if (!emergencyServer) {
        throw new Error('Modo emergencia no está disponible en Expo Go');
      }

      setLastError('Modo emergencia activado');
      await updateMode('emergency');
      await emergencyServer.start({ serverUrl });
    } catch (error) {
      setLastError('No se pudo activar el modo emergencia');
      await updateMode('desktop');
      console.error('Error activating emergency mode', error);
    }
  };

  const switchToDesktop = async () => {
    try {
      const emergencyServer = getEmergencyServer();
      await emergencyServer.stop();
      await updateMode('desktop');
      setFailureCount(0);
      setLastError('');
      await emergencyServer.syncPendingSalesToDesktop(serverUrl);
    } catch (error) {
      setLastError('No se pudieron sincronizar ventas pendientes');
      console.error('Error switching back to desktop', error);
    }
  };

  const value = useMemo(() => ({
    mode,
    isChecking,
    failureCount,
    lastError,
    performHealthCheck,
    switchToEmergency,
    switchToDesktop,
  }), [mode, isChecking, failureCount, lastError]);

  return <ServerContext.Provider value={value}>{children}</ServerContext.Provider>;
}

export const useServer = () => useContext(ServerContext);
