// packages/desktop/src/main/server/client-proxy.ts
// En modo cliente, todas las operaciones de DB se envían al servidor
// El servidor ejecuta la operación y devuelve el resultado

import { ipcMain } from 'electron'
import { getServerSocket } from './index'

// Función helper para hacer llamadas al servidor desde el cliente
export function callServer<T>(event: string, data?: any): Promise<T> {
  return new Promise((resolve, reject) => {
    const socket = getServerSocket()
    if (!socket || !socket.connected) {
      reject(new Error('Sin conexión al servidor. Verificá que la PC servidor esté encendida.'))
      return
    }

    const timeout = setTimeout(() => {
      reject(new Error('Tiempo de espera agotado. El servidor no respondió.'))
    }, 10000)

    socket.emit(event, data, (response: any) => {
      clearTimeout(timeout)
      if (response?.error) {
        reject(new Error(response.error))
      } else {
        resolve(response)
      }
    })
  })
}

// Registrar handlers IPC que redirigen al servidor en modo cliente
export function registerClientProxyHandlers() {
  const proxyEvents = [
    'products:getAll',
    'products:create',
    'products:update',
    'products:delete',
    'products:search',
    'sales:create',
    'sales:getAll',
    'stock:update',
    'stock:getAll',
    'clients:getAll',
    'clients:create',
    'caja:open',
    'caja:close',
    'caja:getMovimientos',
    'stats:getToday',
  ]

  for (const event of proxyEvents) {
    ipcMain.handle(event, async (_, data) => {
      return callServer(event, data)
    })
  }
}
