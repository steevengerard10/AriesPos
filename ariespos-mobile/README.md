# ARIESPos Mobile v2 — Guía de integración

## Archivos nuevos

```
src/
  api/
    client.js        ← fetch wrapper con timeout y baseURL desde AsyncStorage
    ventas.js        ← ventasAPI: crear, listar, fiados, cobrar
    productos.js     ← productosAPI: CRUD completo + búsqueda + barcode
    stats.js         ← statsAPI: dashboard, ventas, top productos, métodos de pago
    index.js         ← barrel export

  hooks/
    useSocket.js     ← hook completo de Socket.IO (reemplaza o convive con useAppUpdates)
    useCart.js       ← lógica del carrito desacoplada de la UI

  screens/
    DashboardScreen.js   ← resumen en tiempo real, fiados, accesos rápidos
    POSScreen.js         ← carrito + búsqueda + scanner + modal de pago
    ProductosScreen.js   ← lista, búsqueda, CRUD, filtro stock bajo
    EstadisticasScreen.js← gráficos nativos (sin librerías externas), métodos de pago
    ConfigScreen.js      ← URL del servidor, test de conexión, modo offline

  navigation/
    AppNavigator.js  ← tab navigator de 5 pantallas (reemplaza el básico existente)
```

## Pasos para integrar

### 1. Instalar dependencias faltantes (si no están)
```bash
npx expo install @react-navigation/bottom-tabs @react-navigation/stack
```

### 2. Actualizar src/index.js
```js
// Antes
import AppNavigator from './navigation/AppNavigator';
export default function App() {
  return <AppNavigator />;
}
```

### 3. Verificar rutas del servidor Express

La app espera estas rutas en `192.168.1.63:3001`:

| Módulo | Rutas requeridas |
|--------|-----------------|
| Stats  | `GET /api/stats/dashboard`, `GET /api/stats/ventas`, `GET /api/stats/top-productos`, `GET /api/stats/metodos-pago`, `GET /api/stats/caja` |
| Ventas | `POST /api/ventas`, `GET /api/ventas`, `GET /api/ventas/fiados`, `PUT /api/ventas/:id/cancelar`, `PUT /api/ventas/:id/cobrar-fiado` |
| Productos | `GET /api/productos`, `GET /api/productos/:id`, `GET /api/productos/barcode/:codigo`, `POST /api/productos`, `PUT /api/productos/:id`, `PUT /api/productos/:id/stock`, `DELETE /api/productos/:id` |
| Health | `GET /api/health` (opcional, para test de conexión) |

### 4. Eventos Socket.IO esperados

| Evento (servidor → móvil) | Cuándo se emite |
|--------------------------|-----------------|
| `venta:nueva`            | Cuando se registra una venta (desde desktop o móvil) |
| `stock:bajo`             | Cuando un producto baja del umbral (`{ mensaje: string }`) |
| `alerta`                 | Alertas genéricas (`{ titulo, mensaje, tipo: 'info'|'warning'|'error' }`) |

### 5. AsyncStorage keys usados

| Key          | Valor               |
|--------------|---------------------|
| `serverUrl`  | URL del servidor Express |
| `modoOffline`| `'true'` / `'false'` |

---

## Compatibilidad

- No se modificó `serverStore` ni `useAppUpdates` existentes
- `useSocket.js` es un hook nuevo independiente; puede convivir con la lógica anterior o reemplazarla gradualmente
- El `AppNavigator` nuevo es un reemplazo directo del básico; si el existente tiene pantallas extra, agregarlas a `TABS` en `navigation/AppNavigator.js`
- Expo SDK 50 ✓, expo-barcode-scanner ✓, Socket.IO client ✓
