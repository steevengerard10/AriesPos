// ariespos-mobile/src/hooks/useAppUpdates.js
import { useEffect, useState } from 'react';
import { Alert } from 'react-native';

export function useAppUpdates() {
  const [isChecking, setIsChecking] = useState(false);

  useEffect(() => {
    // Solo verificar en producción (no en Expo Go / desarrollo)
    if (__DEV__) return;

    let mounted = true;

    const check = async () => {
      try {
        // expo-updates se importa dinámicamente para no romper en Expo Go
        const Updates = await import('expo-updates');
        if (!mounted) return;

        setIsChecking(true);
        const update = await Updates.checkForUpdateAsync();

        if (!mounted) return;
        if (update.isAvailable) {
          Alert.alert(
            '🆕 Nueva versión disponible',
            'Hay una actualización de ARIESPos. ¿Querés instalarla ahora?',
            [
              { text: 'Después', style: 'cancel' },
              {
                text: 'Actualizar ahora',
                onPress: async () => {
                  try {
                    await Updates.fetchUpdateAsync();
                    await Updates.reloadAsync();
                  } catch {
                    Alert.alert('Error', 'No se pudo instalar la actualización. Intentá más tarde.');
                  }
                },
              },
            ]
          );
        }
      } catch {
        // Sin internet o expo-updates no disponible — silencioso
      } finally {
        if (mounted) setIsChecking(false);
      }
    };

    // Esperar 5 segundos para no bloquear el arranque
    const timer = setTimeout(check, 5000);
    return () => {
      mounted = false;
      clearTimeout(timer);
    };
  }, []);

  return { isChecking };
}
