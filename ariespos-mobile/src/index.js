import React, { useEffect, useMemo } from 'react';
import { ActivityIndicator, View, Text, StyleSheet } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import Toast from 'react-native-toast-message';
import { AuthProvider, useAuth } from './context/AuthContext';
import { CartProvider } from './context/CartContext';
import { ServerProvider, useServer } from './context/ServerContext';
import LoginScreen from './screens/LoginScreen';
import POSScreen from './screens/POSScreen';
import ProductsScreen from './screens/ProductsScreen';
import ClientesScreen from './screens/ClientesScreen';
import FiadosScreen from './screens/FiadosScreen';
import CajaScreen from './screens/CajaScreen';
import StockScreen from './screens/StockScreen';
import VentasHoyScreen from './screens/VentasHoyScreen';
import ReportesScreen from './screens/ReportesScreen';
import SettingsScreen from './screens/SettingsScreen';

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

function MainTabs() {
  const { role } = useAuth();

  const tabs = useMemo(() => {
    const commonTabs = [
      { name: 'POS', component: POSScreen, icon: '🛒', title: 'POS' },
      { name: 'Clientes', component: ClientesScreen, icon: '👥', title: 'Clientes' },
      { name: 'Fiados', component: FiadosScreen, icon: '📜', title: 'Fiados' },
      { name: 'Stock', component: StockScreen, icon: '📦', title: 'Stock' },
    ];

    if (role === 'admin') {
      return [
        ...commonTabs,
        { name: 'Productos', component: ProductsScreen, icon: '🛍️', title: 'Productos' },
        { name: 'Caja', component: CajaScreen, icon: '💼', title: 'Caja' },
        { name: 'VentasHoy', component: VentasHoyScreen, icon: '📅', title: 'Ventas Hoy' },
        { name: 'Reportes', component: ReportesScreen, icon: '📈', title: 'Reportes' },
        { name: 'Settings', component: SettingsScreen, icon: '⚙️', title: 'Ajustes' },
      ];
    }

    return commonTabs;
  }, [role]);

  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarStyle: { backgroundColor: '#0f1117', borderTopColor: '#2e3247', borderTopWidth: 1, paddingBottom: 4, paddingTop: 4 },
        tabBarActiveTintColor: '#6c63ff',
        tabBarInactiveTintColor: '#6b6f80',
        tabBarLabelStyle: { fontSize: 11, fontWeight: '700' },
      }}
    >
      {tabs.map((tab) => (
        <Tab.Screen
          key={tab.name}
          name={tab.name}
          component={tab.component}
          options={{
            tabBarIcon: () => <Text style={{ fontSize: 18 }}>{tab.icon}</Text>,
            tabBarLabel: tab.title,
          }}
        />
      ))}
    </Tab.Navigator>
  );
}

function AppNavigator() {
  const { isAuthenticated, isReady } = useAuth();
  const { mode, lastError } = useServer();

  if (!isReady) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#6c63ff" />
        <Text style={styles.loadingText}>Inicializando AriesPOS Mobile...</Text>
      </View>
    );
  }

  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {!isAuthenticated ? (
          <Stack.Screen name="Login" component={LoginScreen} />
        ) : (
          <Stack.Screen name="Main" component={MainTabs} />
        )}
      </Stack.Navigator>
      {mode === 'emergency' ? (
        <View style={styles.emergencyBanner}>
          <Text style={styles.emergencyText}>⚠️ MODO EMERGENCIA ACTIVO</Text>
        </View>
      ) : null}
      {lastError ? (
        <View style={styles.toastInline}>
          <Text style={styles.toastInlineText}>{lastError}</Text>
        </View>
      ) : null}
    </NavigationContainer>
  );
}

export default function App() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <AuthProvider>
        <ServerProvider>
          <CartProvider>
            <AppNavigator />
            <Toast />
          </CartProvider>
        </ServerProvider>
      </AuthProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    backgroundColor: '#0f1117',
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: '#e8eaf6',
    marginTop: 12,
    fontSize: 16,
  },
  emergencyBanner: {
    position: 'absolute',
    top: 20,
    left: 16,
    right: 16,
    backgroundColor: '#ff9800',
    paddingVertical: 10,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 100,
  },
  emergencyText: {
    color: '#1a1d27',
    fontWeight: '800',
  },
  toastInline: {
    position: 'absolute',
    bottom: 90,
    left: 16,
    right: 16,
    backgroundColor: '#e53935',
    borderRadius: 10,
    padding: 12,
    zIndex: 100,
  },
  toastInlineText: {
    color: '#fff',
    fontWeight: '700',
  },
});
