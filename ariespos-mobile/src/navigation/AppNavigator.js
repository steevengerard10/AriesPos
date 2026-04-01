import React, { useState } from 'react';
import LoginScreen from '../screens/LoginScreen';
import VentaScreen from '../screens/VentaScreen';
import CarritoScreen from '../screens/CarritoScreen';
import ServerModeScreen from '../screens/ServerModeScreen';
import { productos } from '../data/productos';
import { clientes } from '../data/clientes';
import ClienteSelector from '../components/ClienteSelector';
import VentaOpciones from '../components/VentaOpciones';
import CobroModal from '../components/CobroModal';
import { Modal, View, Text, TouchableOpacity, StyleSheet } from 'react-native';

const TAB_VENTA = 'venta';
const TAB_CARRITO = 'carrito';
const TAB_SERVER = 'servidor';

export default function AppNavigator({ alerts, onScan, scanning, handleBarCodeScanned }) {
  const [user, setUser] = useState(null);
  const [carrito, setCarrito] = useState([]);
  const [pantalla, setPantalla] = useState(TAB_VENTA);
  const [clienteSel, setClienteSel] = useState(null);
  const [showCliente, setShowCliente] = useState(false);
  const [esFiado, setEsFiado] = useState(false);
  const [descuento, setDescuento] = useState('0');
  const [observaciones, setObservaciones] = useState('');

  const handleAdd = (producto, cantidad) => {
    setCarrito(prev => {
      const existe = prev.find(i => i.id === producto.id);
      if (existe) {
        return prev.map(i => i.id === producto.id ? { ...i, cantidad: i.cantidad + cantidad, total: (i.cantidad + cantidad) * i.precio_unitario } : i);
      }
      return [...prev, { ...producto, cantidad, total: cantidad * producto.precio_unitario }];
    });
  };
  const handleRemove = (id) => {
    setCarrito(prev => prev.filter(i => i.id !== id));
  };
  const [showCobro, setShowCobro] = useState(false);
  const [ultimoMetodo, setUltimoMetodo] = useState(null);
  const handleCobrar = () => setShowCobro(true);
  const handleConfirmCobro = (metodo) => {
    setUltimoMetodo(metodo);
    setShowCobro(false);
    // Aquí podrías enviar la venta al backend
    alert(`Venta cobrada con ${metodo}`);
    setCarrito([]);
    setClienteSel(null);
    setEsFiado(false);
    setDescuento('0');
    setObservaciones('');
  };

  if (!user) {
    return <LoginScreen onLogin={setUser} />;
  }
  return (
    <View style={{flex:1}}>
      {pantalla === TAB_VENTA ? (
        <VentaScreen
          productos={productos}
          onAdd={handleAdd}
          carrito={carrito}
          onRemove={handleRemove}
          onCobrar={handleCobrar}
          clienteSel={clienteSel}
          setShowCliente={setShowCliente}
          esFiado={esFiado}
          setEsFiado={setEsFiado}
          descuento={descuento}
          setDescuento={setDescuento}
          observaciones={observaciones}
          setObservaciones={setObservaciones}
          onVerCarrito={() => setPantalla(TAB_CARRITO)}
        />
      ) : pantalla === TAB_CARRITO ? (
        <CarritoScreen
          carrito={carrito}
          onRemove={handleRemove}
          onCobrar={handleCobrar}
          onBack={() => setPantalla(TAB_VENTA)}
        />
      ) : (
        <ServerModeScreen />
      )}
      <Modal visible={showCliente} animationType="slide" transparent>
        <View style={{flex:1, justifyContent:'center', alignItems:'center', backgroundColor:'rgba(0,0,0,0.2)'}}>
          <ClienteSelector clientes={clientes} clienteSel={clienteSel} setClienteSel={c => { setClienteSel(c); setShowCliente(false); }} onClose={() => setShowCliente(false)} />
        </View>
      </Modal>
      <CobroModal
        visible={showCobro}
        total={carrito.reduce((s, i) => s + i.total, 0) - (parseFloat(descuento)||0)}
        onClose={() => setShowCobro(false)}
        onConfirm={handleConfirmCobro}
        esFiado={esFiado}
      />
      {/* Barra de tabs inferior */}
      <View style={navStyles.tabBar}>
        <TouchableOpacity style={navStyles.tab} onPress={() => setPantalla(TAB_VENTA)}>
          <Text style={[navStyles.tabText, pantalla === TAB_VENTA && navStyles.tabActive]}>🛒 Venta</Text>
        </TouchableOpacity>
        <TouchableOpacity style={navStyles.tab} onPress={() => setPantalla(TAB_CARRITO)}>
          <Text style={[navStyles.tabText, pantalla === TAB_CARRITO && navStyles.tabActive]}>
            🧾 Carrito {carrito.length > 0 ? `(${carrito.length})` : ''}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity style={navStyles.tab} onPress={() => setPantalla(TAB_SERVER)}>
          <Text style={[navStyles.tabText, pantalla === TAB_SERVER && navStyles.tabActive]}>📡 Servidor</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const navStyles = StyleSheet.create({
  tabBar: {
    flexDirection: 'row',
    backgroundColor: '#1e2130',
    borderTopWidth: 1,
    borderTopColor: '#2d3748',
    paddingBottom: 8,
    paddingTop: 8,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 4,
  },
  tabText: {
    color: '#6b7280',
    fontSize: 13,
    fontWeight: '500',
  },
  tabActive: {
    color: '#60a5fa',
    fontWeight: '700',
  },
});
