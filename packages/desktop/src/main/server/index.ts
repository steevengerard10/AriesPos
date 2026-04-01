import express from 'express'
import { createServer } from 'http'
import { Server } from 'socket.io'
import { io as ioClient, Socket as ClientSocket } from 'socket.io-client'
import { getDb } from '../../database/db'
// import { registerAllHandlers } from './handlers'
// import { registerMobileHandlers } from './mobile-handlers'

interface ServerOptions {
  port: number
  mode: 'server' | 'client'
  serverIP?: string
}

let serverSocket: ClientSocket | null = null  // usado en modo cliente
let io: Server | null = null                  // usado en modo servidor

// Para emitir eventos de conexión a la ventana principal
let mainWindow: Electron.BrowserWindow | null = null;
export function setMainWindow(win: Electron.BrowserWindow) {
  mainWindow = win;
}

export async function startServer(options: ServerOptions) {
  if (options.mode === 'server') {
    // ── MODO SERVIDOR ─────────────────────────────────────────
    const expressApp = express()
    const httpServer = createServer(expressApp)

    io = new Server(httpServer, {
      cors: { origin: '*', methods: ['GET', 'POST'] }
    })

    expressApp.use(express.json())

    // Ruta de ping para que los clientes verifiquen conexión
    expressApp.get('/api/ping', (req, res) => {
      // const db = getDb()
      // const config = db.prepare(
      //   "SELECT valor FROM configuracion WHERE clave = 'nombre_negocio'"
      // ).get() as { valor: string } | undefined

      res.json({
        status: 'ok',
        version: '1.0.0',
        negocio: 'ARIESPos', // config?.valor || 'ARIESPos',
        mode: 'server',
        timestamp: new Date().toISOString(),
      })
    })

    // Registrar todos los handlers de Socket.IO
    io.on('connection', (socket) => {
      console.log(`[Server] Cliente conectado: ${socket.id}`)
      // registerAllHandlers(io!, socket)
      // registerMobileHandlers(io!, socket, null)

      // Emitir cantidad de clientes conectados
      if (mainWindow && io && io.engine) {
        mainWindow.webContents.send('clients:count', io.engine.clientsCount)
      }

      socket.on('disconnect', () => {
        console.log(`[Server] Cliente desconectado: ${socket.id}`)
        if (mainWindow && io && io.engine) {
          mainWindow.webContents.send('clients:count', io.engine.clientsCount)
        }
      })
    })

    // Escuchar en todas las interfaces de red (no solo localhost)
    httpServer.listen(options.port, '0.0.0.0', () => {
      console.log(`[Server] ARIESPos servidor corriendo en puerto ${options.port}`)
      console.log(`[Server] Otras PCs pueden conectarse a: http://TU-IP:${options.port}`)
    })

  } else {
    // ── MODO CLIENTE ───────────────────────────────────────────
    serverSocket = ioClient(`http://${options.serverIP}:${options.port}`, {
      transports: ['websocket'],
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 2000,
    })

    serverSocket.on('connect', () => {
      console.log(`[Client] Conectado al servidor: ${options.serverIP}:${options.port}`)
      serverSocket?.emit('client:identify', {
        type: 'desktop-client',
        hostname: require('os').hostname(),
      })
      if (mainWindow) mainWindow.webContents.send('connection:status', 'connected')
    })

    serverSocket.on('disconnect', () => {
      console.log('[Client] Desconectado del servidor, reconectando...')
      if (mainWindow) mainWindow.webContents.send('connection:status', 'reconnecting')
    })

    serverSocket.on('connect_error', (err) => {
      console.error('[Client] Error de conexión:', err.message)
      if (mainWindow) mainWindow.webContents.send('connection:status', 'disconnected')
    })
  }
}

// Exportar para usar en los handlers
export function getServerSocket(): ClientSocket | null {
  return serverSocket
}

export function getIO(): Server | null {
  return io
}

