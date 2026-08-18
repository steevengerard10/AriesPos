import AsyncStorage from '@react-native-async-storage/async-storage';

const DB_NAME = 'ariespos_emergency.db';

let dbInstance = null;
let SQLiteModule = null;

const getSQLite = () => {
  if (!SQLiteModule) {
    try {
      SQLiteModule = require('expo-sqlite');
    } catch (error) {
      SQLiteModule = null;
    }
  }

  return SQLiteModule;
};

export async function initializeDatabase() {
  const SQLite = getSQLite();
  if (!SQLite) {
    throw new Error('Modo emergencia no disponible en Expo Go');
  }

  if (!dbInstance) {
    dbInstance = SQLite.openDatabaseSync(DB_NAME);
  }

  await dbInstance.withTransactionAsync(async () => {
    dbInstance.execSync(`
      CREATE TABLE IF NOT EXISTS productos (
        id TEXT PRIMARY KEY,
        nombre TEXT,
        precio REAL,
        categoria TEXT,
        barcode TEXT,
        stock INTEGER,
        imagen TEXT,
        updated_at TEXT
      );
    `);

    dbInstance.execSync(`
      CREATE TABLE IF NOT EXISTS ventas (
        id TEXT PRIMARY KEY,
        total REAL,
        metodoPago TEXT,
        clienteId TEXT,
        nota TEXT,
        synced INTEGER DEFAULT 0,
        created_at TEXT
      );
    `);

    dbInstance.execSync(`
      CREATE TABLE IF NOT EXISTS venta_items (
        id TEXT PRIMARY KEY,
        venta_id TEXT,
        producto_id TEXT,
        cantidad INTEGER,
        precio REAL,
        subtotal REAL
      );
    `);

    dbInstance.execSync(`
      CREATE TABLE IF NOT EXISTS clientes (
        id TEXT PRIMARY KEY,
        nombre TEXT,
        telefono TEXT,
        email TEXT,
        saldo REAL
      );
    `);

    dbInstance.execSync(`
      CREATE TABLE IF NOT EXISTS fiados (
        id TEXT PRIMARY KEY,
        cliente_id TEXT,
        total REAL,
        estado TEXT,
        created_at TEXT
      );
    `);

    dbInstance.execSync(`
      CREATE TABLE IF NOT EXISTS categorias (
        id TEXT PRIMARY KEY,
        nombre TEXT
      );
    `);

    dbInstance.execSync(`
      CREATE TABLE IF NOT EXISTS config (
        key TEXT PRIMARY KEY,
        value TEXT
      );
    `);
  });

  await seedFromCache();
  return dbInstance;
}

export async function seedFromCache() {
  if (!dbInstance) {
    await initializeDatabase();
  }

  const cachedProducts = JSON.parse((await AsyncStorage.getItem('cachedProducts')) || '[]');
  const cachedClients = JSON.parse((await AsyncStorage.getItem('cachedClients')) || '[]');
  const cachedCategories = JSON.parse((await AsyncStorage.getItem('cachedCategories')) || '[]');

  for (const product of cachedProducts) {
    await dbInstance.runAsync('INSERT OR REPLACE INTO productos (id, nombre, precio, categoria, barcode, stock, imagen, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)', [
      String(product.id),
      product.nombre || product.name,
      Number(product.precio || product.precio_unitario || 0),
      product.categoria || product.category || 'General',
      product.barcode || '',
      Number(product.stock ?? 0),
      product.imagen || product.image || '',
      new Date().toISOString(),
    ]);
  }

  for (const cliente of cachedClients) {
    await dbInstance.runAsync('INSERT OR REPLACE INTO clientes (id, nombre, telefono, email, saldo) VALUES (?, ?, ?, ?, ?)', [
      String(cliente.id),
      cliente.nombre || cliente.name,
      cliente.telefono || '',
      cliente.email || '',
      Number(cliente.saldo || 0),
    ]);
  }

  for (const categoria of cachedCategories) {
    await dbInstance.runAsync('INSERT OR REPLACE INTO categorias (id, nombre) VALUES (?, ?)', [
      String(categoria.id),
      categoria.nombre || categoria.name,
    ]);
  }
}

export async function getProducts() {
  await initializeDatabase();
  return dbInstance.getAllSync('SELECT * FROM productos ORDER BY nombre');
}

export async function getClientes() {
  await initializeDatabase();
  return dbInstance.getAllSync('SELECT * FROM clientes ORDER BY nombre');
}

export async function getCategorias() {
  await initializeDatabase();
  return dbInstance.getAllSync('SELECT * FROM categorias ORDER BY nombre');
}

export async function getFiados() {
  await initializeDatabase();
  return dbInstance.getAllSync('SELECT * FROM fiados ORDER BY created_at DESC');
}

export async function getStockAlerts() {
  await initializeDatabase();
  return dbInstance.getAllSync("SELECT * FROM productos WHERE stock <= 5 ORDER BY stock ASC");
}

export async function recordSale(sale) {
  await initializeDatabase();
  const saleId = sale.id || `sale_${Date.now()}`;
  const createdAt = sale.createdAt || new Date().toISOString();

  await dbInstance.runAsync('INSERT OR REPLACE INTO ventas (id, total, metodoPago, clienteId, nota, synced, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)', [
    saleId,
    Number(sale.total || 0),
    sale.metodoPago || 'Efectivo',
    sale.clienteId || null,
    sale.nota || '',
    0,
    createdAt,
  ]);

  for (const item of sale.items || []) {
    const itemId = `${saleId}_${item.id}`;
    await dbInstance.runAsync('INSERT OR REPLACE INTO venta_items (id, venta_id, producto_id, cantidad, precio, subtotal) VALUES (?, ?, ?, ?, ?, ?)', [
      itemId,
      saleId,
      String(item.id),
      Number(item.quantity || 1),
      Number(item.precio || item.precio_unitario || 0),
      Number(item.total || 0),
    ]);

    await dbInstance.runAsync('UPDATE productos SET stock = CASE WHEN stock - ? < 0 THEN 0 ELSE stock - ? END WHERE id = ?', [
      Number(item.quantity || 1),
      Number(item.quantity || 1),
      String(item.id),
    ]);
  }

  return saleId;
}

export async function getPendingSales() {
  await initializeDatabase();
  return dbInstance.getAllSync("SELECT * FROM ventas WHERE synced = 0 ORDER BY created_at ASC");
}

export async function markSaleSynced(saleId) {
  await initializeDatabase();
  await dbInstance.runAsync('UPDATE ventas SET synced = 1 WHERE id = ?', [saleId]);
}

export async function updateProductStock(productId, stock) {
  await initializeDatabase();
  await dbInstance.runAsync('UPDATE productos SET stock = ? WHERE id = ?', [stock, String(productId)]);
}

export default {
  initializeDatabase,
  seedFromCache,
  getProducts,
  getClientes,
  getCategorias,
  getFiados,
  getStockAlerts,
  recordSale,
  getPendingSales,
  markSaleSynced,
  updateProductStock,
};
