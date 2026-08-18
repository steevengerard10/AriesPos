import AsyncStorage from '@react-native-async-storage/async-storage';
import { Buffer } from 'buffer';

let emergencyDBModule = null;
let TcpSocket = null;
let serverInstance = null;
let isRunning = false;

const getEmergencyDB = () => {
  if (!emergencyDBModule) {
    try {
      emergencyDBModule = require('./EmergencyDB');
    } catch (error) {
      emergencyDBModule = null;
    }
  }
  return emergencyDBModule;
};

const getTcpSocket = () => {
  if (!TcpSocket) {
    try {
      TcpSocket = require('react-native-tcp-socket');
    } catch (error) {
      TcpSocket = null;
    }
  }

  return TcpSocket;
};

const parseBody = async (socket, request, contentLength) => {
  const chunks = [];
  let total = 0;
  while (total < contentLength) {
    const chunk = await new Promise((resolve) => socket.once('data', resolve));
    chunks.push(chunk);
    total += chunk.length;
  }
  return Buffer.concat(chunks).toString('utf8');
};

const sendResponse = (socket, statusCode, payload, headers = {}) => {
  const content = typeof payload === 'string' ? payload : JSON.stringify(payload);
  const responseHeaders = {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(content),
    'Connection': 'close',
    ...headers,
  };

  const headerLines = Object.entries(responseHeaders).map(([key, value]) => `${key}: ${value}`).join('\r\n');
  socket.write(`HTTP/1.1 ${statusCode} OK\r\n${headerLines}\r\n\r\n${content}`);
  socket.end();
};

const routeRequest = async (request, socket) => {
  const emergencyDB = getEmergencyDB();
  const path = request.url.split('?')[0];

  if (request.method === 'GET' && path === '/api/ping') {
    sendResponse(socket, 200, 'pong');
    return;
  }

  if (request.method === 'GET' && path === '/api/productos') {
    const productos = await emergencyDB.getProducts();
    sendResponse(socket, 200, productos);
    return;
  }

  if (request.method === 'GET' && path === '/api/clientes') {
    const clientes = await emergencyDB.getClientes();
    sendResponse(socket, 200, clientes);
    return;
  }

  if (request.method === 'GET' && path === '/api/categorias') {
    const categorias = await emergencyDB.getCategorias();
    sendResponse(socket, 200, categorias);
    return;
  }

  if (request.method === 'GET' && path === '/api/stock/alertas') {
    const alertas = await emergencyDB.getStockAlerts();
    sendResponse(socket, 200, alertas);
    return;
  }

  if (request.method === 'POST' && path === '/api/ventas') {
    const body = await parseBody(socket, request, Number(request.headers['content-length'] || 0));
    const payload = JSON.parse(body);
    const saleId = await emergencyDB.recordSale(payload);
    sendResponse(socket, 200, { ok: true, saleId });
    return;
  }

  if (request.method === 'GET' && path === '/api/fiados') {
    const fiados = await emergencyDB.getFiados();
    sendResponse(socket, 200, fiados);
    return;
  }

  if (request.method === 'PUT' && path.startsWith('/api/fiados/')) {
    sendResponse(socket, 200, { ok: true });
    return;
  }

  sendResponse(socket, 404, { error: 'Not found' });
};

export async function startEmergencyServer() {
  if (isRunning) return serverInstance;

  const TcpSocketModule = getTcpSocket();
  if (!TcpSocketModule) {
    throw new Error('Modo emergencia no está disponible en Expo Go');
  }

  const emergencyDB = getEmergencyDB();
  if (!emergencyDB) {
    throw new Error('Modo emergencia no está disponible en Expo Go');
  }

  await emergencyDB.initializeDatabase();

  serverInstance = TcpSocketModule.createServer((socket) => {
    let buffer = Buffer.alloc(0);
    socket.on('data', async (chunk) => {
      buffer = Buffer.concat([buffer, chunk]);
      const delimiter = buffer.indexOf('\r\n\r\n');
      if (delimiter === -1) return;

      const header = buffer.toString('utf8', 0, delimiter);
      const [requestLine, ...headerLines] = header.split('\r\n');
      const [, path] = requestLine.split(' ');
      const headers = {};
      headerLines.forEach((line) => {
        const [key, value] = line.split(':');
        if (key && value) headers[key.trim().toLowerCase()] = value.trim();
      });

      const contentLength = Number(headers['content-length'] || 0);
      const bodyStart = delimiter + 4;
      const body = contentLength > 0 ? buffer.slice(bodyStart, bodyStart + contentLength).toString('utf8') : '';
      const request = {
        method: requestLine.split(' ')[0],
        url: path,
        headers,
        body,
      };

      buffer = buffer.slice(bodyStart + contentLength);
      await routeRequest(request, socket);
    });
  });

  serverInstance.listen({ port: 3001, host: '0.0.0.0' }, () => {
    isRunning = true;
  });

  return serverInstance;
}

export async function stopEmergencyServer() {
  if (!serverInstance) return;
  serverInstance.close();
  serverInstance = null;
  isRunning = false;
}

export async function syncPendingSalesToDesktop(desktopUrl) {
  const emergencyDB = getEmergencyDB();
  const pendingSales = await emergencyDB.getPendingSales();
  for (const sale of pendingSales) {
    const items = await new Promise((resolve) => resolve([]));
    await fetch(`${desktopUrl.replace(/\/$/, '')}/api/ventas`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        id: sale.id,
        items: [],
        metodoPago: sale.metodoPago,
        clienteId: sale.clienteId,
        nota: sale.nota,
        total: sale.total,
      }),
    });
    await emergencyDB.markSaleSynced(sale.id);
  }
}

export const emergencyServer = {
  start: startEmergencyServer,
  stop: stopEmergencyServer,
  syncPendingSalesToDesktop,
  getStatus: () => ({ isRunning }),
};

export default emergencyServer;
