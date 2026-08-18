/**
 * AppNavigator — ARIESPos Mobile v2
 *
 * Reemplaza el navegador básico existente.
 * Mantiene compatibilidad con el serverStore y useAppUpdates ya existentes.
 *
 * Dependencias requeridas (ya deberían estar instaladas o agregar):
 *   @react-navigation/native
 *   @react-navigation/bottom-tabs
 *   @react-navigation/stack
 *   react-native-screens
 *   react-native-safe-area-context
 */
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createStackNavigator } from '@react-navigation/stack';

import DashboardScreen from '../screens/DashboardScreen';
import POSScreen from '../screens/POSScreen';
import ProductosScreen from '../screens/ProductosScreen';
import EstadisticasScreen from '../screens/EstadisticasScreen';
import ConfigScreen from '../screens/ConfigScreen';

const Tab = createBottomTabNavigator();
const Stack = createStackNavigator();

const COLORES = {
  fondo: '#0f172a', tarjeta: '#1e293b', borde: '#334155',
  primario: '#6366f1', texto: '#f1f5f9', textoSub: '#94a3b8',
};

const TABS = [
  { name: 'Dashboard', component: DashboardScreen, icon: '🏠', label: 'Inicio' },
  { name: 'POS',       component: POSScreen,        icon: '🛒', label: 'Venta' },
  { name: 'Productos', component: ProductosScreen,  icon: '📦', label: 'Stock' },
  { name: 'Estadisticas', component: EstadisticasScreen, icon: '📊', label: 'Stats' },
  { name: 'Config',    component: ConfigScreen,     icon: '⚙️', label: 'Config' },
];

function TabIcon({ icon, label, focused }) {
  return (
    <View style={[nav.tabIcon, focused && nav.tabIconFocused]}>
      <Text style={{ fontSize: focused ? 20 : 18 }}>{icon}</Text>
      <Text style={[nav.tabLabel, focused && nav.tabLabelFocused]}>{label}</Text>
    </View>
  );
}

function MainTabs() {
  return (
    <Tab.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: COLORES.tarjeta, borderBottomColor: COLORES.borde, borderBottomWidth: 1 },
        headerTitleStyle: { color: COLORES.texto, fontWeight: '700' },
        tabBarStyle: {
          backgroundColor: COLORES.tarjeta,
          borderTopColor: COLORES.borde,
          borderTopWidth: 1,
          height: 64,
          paddingBottom: 8,
        },
        tabBarShowLabel: false,
      }}
    >
      {TABS.map((tab) => (
        <Tab.Screen
          key={tab.name}
          name={tab.name}
          component={tab.component}
          options={{
            title: tab.label,
            tabBarIcon: ({ focused }) => (
              <TabIcon icon={tab.icon} label={tab.label} focused={focused} />
            ),
          }}
        />
      ))}
    </Tab.Navigator>
  );
}

export default function AppNavigator() {
  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        <Stack.Screen name="Main" component={MainTabs} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}

const nav = StyleSheet.create({
  tabIcon: { alignItems: 'center', paddingTop: 6, gap: 2 },
  tabIconFocused: {},
  tabLabel: { color: COLORES.textoSub, fontSize: 10 },
  tabLabelFocused: { color: COLORES.primario, fontWeight: '600' },
});
