import Database from 'better-sqlite3';
import * as path from 'path';
import { app } from 'electron';

let db: Database.Database;

export function getDb(): Database.Database {
  if (!db) {
    throw new Error('Base de datos no inicializada. Llama initDatabase() primero.');
  }
  return db;
}

export async function initDatabase(): Promise<void> {
  const userDataPath = app.getPath('userData');
  const dbPath = path.join(userDataPath, 'ariespos.db');

  console.log(`[DB] Inicializando base de datos en: ${dbPath}`);

  db = new Database(dbPath, {
    verbose: process.env.NODE_ENV === 'development' ? console.log : undefined,
  });

  // Optimizaciones SQLite
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  db.pragma('synchronous = NORMAL');
  db.pragma('cache_size = -64000');

  // Crear tablas
  runMigrations(db);

  // Datos iniciales si es primera ejecución
  seedInitialData(db);

  console.log('[DB] Base de datos lista.');
}

function runMigrations(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS __migrations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      executed_at TEXT DEFAULT (datetime('now'))
    );
  `);

  const migrations: { name: string; sql?: string; run?: (db: Database.Database) => void }[] = [
    {
      name: '001_initial_schema',
      sql: `
        CREATE TABLE IF NOT EXISTS categorias (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          nombre TEXT NOT NULL,
          color TEXT DEFAULT '#6366f1'
        );

        CREATE TABLE IF NOT EXISTS productos (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          codigo TEXT NOT NULL UNIQUE,
          codigo_barras TEXT DEFAULT '',
          nombre TEXT NOT NULL,
          categoria_id INTEGER REFERENCES categorias(id) ON DELETE SET NULL,
          precio_costo REAL DEFAULT 0,
          precio_venta REAL NOT NULL DEFAULT 0,
          precio2 REAL DEFAULT 0,
          precio3 REAL DEFAULT 0,
          stock_actual REAL DEFAULT 0,
          stock_minimo REAL DEFAULT 0,
          unidad_medida TEXT DEFAULT 'unidad',
          fraccionable INTEGER DEFAULT 0,
          en_catalogo INTEGER DEFAULT 0,
          imagen_path TEXT,
          activo INTEGER DEFAULT 1,
          created_at TEXT DEFAULT (datetime('now')),
          updated_at TEXT DEFAULT (datetime('now'))
        );

        CREATE TABLE IF NOT EXISTS clientes (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          nombre TEXT NOT NULL,
          telefono TEXT DEFAULT '',
          email TEXT DEFAULT '',
          direccion TEXT DEFAULT '',
          documento TEXT DEFAULT '',
          limite_credito REAL DEFAULT 0,
          created_at TEXT DEFAULT (datetime('now'))
        );

        CREATE TABLE IF NOT EXISTS usuarios (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          nombre TEXT NOT NULL,
          pin TEXT NOT NULL,
          rol TEXT DEFAULT 'vendedor' CHECK(rol IN ('admin','vendedor','readonly')),
          activo INTEGER DEFAULT 1
        );

        CREATE TABLE IF NOT EXISTS ventas (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          numero TEXT NOT NULL UNIQUE,
          tipo TEXT DEFAULT 'venta' CHECK(tipo IN ('venta','pedido','cotizacion','devolucion')),
          estado TEXT DEFAULT 'completada',
          fecha TEXT NOT NULL,
          hora TEXT NOT NULL,
          cliente_id INTEGER REFERENCES clientes(id) ON DELETE SET NULL,
          vendedor_id INTEGER REFERENCES usuarios(id) ON DELETE SET NULL,
          subtotal REAL DEFAULT 0,
          descuento REAL DEFAULT 0,
          total REAL DEFAULT 0,
          metodo_pago TEXT DEFAULT 'efectivo',
          es_fiado INTEGER DEFAULT 0,
          observaciones TEXT DEFAULT '',
          created_at TEXT DEFAULT (datetime('now'))
        );

        CREATE TABLE IF NOT EXISTS venta_items (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          venta_id INTEGER NOT NULL REFERENCES ventas(id) ON DELETE CASCADE,
          producto_id INTEGER REFERENCES productos(id) ON DELETE SET NULL,
          cantidad REAL NOT NULL,
          precio_unitario REAL NOT NULL,
          descuento REAL DEFAULT 0,
          total REAL NOT NULL
        );

        CREATE TABLE IF NOT EXISTS stock_movimientos (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          producto_id INTEGER REFERENCES productos(id) ON DELETE SET NULL,
          tipo TEXT NOT NULL CHECK(tipo IN ('entrada','salida','ajuste')),
          cantidad REAL NOT NULL,
          motivo TEXT DEFAULT '',
          venta_id INTEGER REFERENCES ventas(id) ON DELETE SET NULL,
          fecha TEXT DEFAULT (datetime('now'))
        );

        CREATE TABLE IF NOT EXISTS caja_sesiones (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          fecha_apertura TEXT DEFAULT (datetime('now')),
          fecha_cierre TEXT,
          monto_inicial REAL DEFAULT 0,
          monto_final REAL,
          usuario_id INTEGER REFERENCES usuarios(id) ON DELETE SET NULL
        );

        CREATE TABLE IF NOT EXISTS caja_movimientos (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          sesion_id INTEGER NOT NULL REFERENCES caja_sesiones(id) ON DELETE CASCADE,
          tipo TEXT NOT NULL CHECK(tipo IN ('ingreso','egreso')),
          monto REAL NOT NULL,
          descripcion TEXT DEFAULT '',
          metodo_pago TEXT DEFAULT 'efectivo',
          venta_id INTEGER REFERENCES ventas(id) ON DELETE SET NULL,
          fecha TEXT DEFAULT (datetime('now'))
        );

        CREATE TABLE IF NOT EXISTS cuentas_pagar (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          descripcion TEXT NOT NULL,
          proveedor TEXT DEFAULT '',
          monto_total REAL NOT NULL,
          monto_pagado REAL DEFAULT 0,
          vencimiento TEXT,
          estado TEXT DEFAULT 'pendiente' CHECK(estado IN ('pendiente','parcial','pagado'))
        );

        CREATE TABLE IF NOT EXISTS configuracion (
          clave TEXT PRIMARY KEY,
          valor TEXT NOT NULL
        );

        CREATE INDEX IF NOT EXISTS idx_productos_codigo ON productos(codigo);
        CREATE INDEX IF NOT EXISTS idx_productos_codigo_barras ON productos(codigo_barras);
        CREATE INDEX IF NOT EXISTS idx_ventas_fecha ON ventas(fecha);
        CREATE INDEX IF NOT EXISTS idx_ventas_tipo ON ventas(tipo);
        CREATE INDEX IF NOT EXISTS idx_ventas_cliente ON ventas(cliente_id);
        CREATE INDEX IF NOT EXISTS idx_venta_items_venta ON venta_items(venta_id);
        CREATE INDEX IF NOT EXISTS idx_stock_movimientos_producto ON stock_movimientos(producto_id);
        CREATE INDEX IF NOT EXISTS idx_caja_movimientos_sesion ON caja_movimientos(sesion_id);
      `,
    },
    {
      name: '002_clientes_apellido',
      sql: `ALTER TABLE clientes ADD COLUMN apellido TEXT DEFAULT '';`,
    },
    {
      name: '003_stock_tracking',
      sql: `
        ALTER TABLE stock_movimientos ADD COLUMN stock_previo REAL;
        ALTER TABLE stock_movimientos ADD COLUMN stock_nuevo REAL;
      `,
    },
    {
      name: '004_marca_proveedor',
      sql: `
        ALTER TABLE productos ADD COLUMN marca TEXT DEFAULT '';
        ALTER TABLE productos ADD COLUMN proveedor TEXT DEFAULT '';
      `,
    },
    {
      name: '005_monto_pagado',
      sql: `
        ALTER TABLE ventas ADD COLUMN monto_pagado REAL DEFAULT 0;
      `,
    },
    {
      name: '006_nextar_ids',
      sql: `
        ALTER TABLE productos  ADD COLUMN nextar_id INTEGER;
        ALTER TABLE clientes   ADD COLUMN nextar_id INTEGER;
        ALTER TABLE ventas     ADD COLUMN nextar_id INTEGER;
        ALTER TABLE categorias ADD COLUMN nextar_id INTEGER;
        CREATE INDEX IF NOT EXISTS idx_productos_nextar ON productos(nextar_id);
        CREATE INDEX IF NOT EXISTS idx_clientes_nextar  ON clientes(nextar_id);
        CREATE INDEX IF NOT EXISTS idx_ventas_nextar    ON ventas(nextar_id);
      `,
    },
    {
      name: '007_combos',
      sql: `
        CREATE TABLE IF NOT EXISTS combos (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          nombre TEXT NOT NULL,
          descripcion TEXT DEFAULT '',
          precio REAL DEFAULT 0,
          activo INTEGER DEFAULT 1,
          created_at TEXT DEFAULT (datetime('now'))
        );
        CREATE TABLE IF NOT EXISTS combo_items (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          combo_id INTEGER NOT NULL REFERENCES combos(id) ON DELETE CASCADE,
          producto_id INTEGER NOT NULL REFERENCES productos(id) ON DELETE CASCADE,
          cantidad REAL NOT NULL DEFAULT 1,
          precio_unitario REAL NOT NULL DEFAULT 0
        );
        CREATE INDEX IF NOT EXISTS idx_combo_items_combo ON combo_items(combo_id);
      `,
    },
    {
      name: '008_libro_caja',
      sql: `
        CREATE TABLE IF NOT EXISTS libro_caja_dias (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          fecha TEXT NOT NULL UNIQUE,
          libro REAL DEFAULT 0,
          caja REAL DEFAULT 0,
          egresos REAL DEFAULT 0,
          tarjetas REAL DEFAULT 0,
          cambio REAL DEFAULT 1500,
          transferencias REAL DEFAULT 0,
          gastos_tarjeta REAL DEFAULT 0,
          notas TEXT DEFAULT '',
          created_at TEXT DEFAULT (datetime('now')),
          updated_at TEXT DEFAULT (datetime('now'))
        );

        CREATE TABLE IF NOT EXISTS libro_caja_turnos (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          dia_id INTEGER NOT NULL REFERENCES libro_caja_dias(id) ON DELETE CASCADE,
          numero INTEGER DEFAULT 1,
          fecha_apertura TEXT DEFAULT (datetime('now')),
          fecha_cierre TEXT,
          usuario_id INTEGER REFERENCES usuarios(id) ON DELETE SET NULL,
          monto_apertura REAL DEFAULT 0,
          monto_cierre REAL,
          notas TEXT DEFAULT ''
        );

        CREATE TABLE IF NOT EXISTS libro_caja_billetes (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          dia_id INTEGER NOT NULL REFERENCES libro_caja_dias(id) ON DELETE CASCADE,
          denominacion INTEGER NOT NULL,
          cantidad INTEGER DEFAULT 0,
          UNIQUE(dia_id, denominacion)
        );

        CREATE TABLE IF NOT EXISTS libro_caja_egresos (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          dia_id INTEGER NOT NULL REFERENCES libro_caja_dias(id) ON DELETE CASCADE,
          proveedor TEXT NOT NULL,
          monto REAL NOT NULL,
          fecha TEXT DEFAULT (datetime('now'))
        );

        CREATE INDEX IF NOT EXISTS idx_libro_caja_dias_fecha ON libro_caja_dias(fecha);
        CREATE INDEX IF NOT EXISTS idx_libro_caja_turnos_dia ON libro_caja_turnos(dia_id);
        CREATE INDEX IF NOT EXISTS idx_libro_caja_billetes_dia ON libro_caja_billetes(dia_id);
        CREATE INDEX IF NOT EXISTS idx_libro_caja_egresos_dia ON libro_caja_egresos(dia_id);
      `,
    },
    {
      name: '009_egreso_medio_pago',
      run: (db: Database.Database) => {
        // La tabla puede no existir si migration 008 corrió antes de que se agregara libro_caja_egresos
        const tableExists = db.prepare(
          `SELECT name FROM sqlite_master WHERE type='table' AND name='libro_caja_egresos'`
        ).get();
        if (!tableExists) {
          // Crear tabla desde cero con medio_pago incluido
          db.exec(`
            CREATE TABLE libro_caja_egresos (
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              dia_id INTEGER NOT NULL REFERENCES libro_caja_dias(id) ON DELETE CASCADE,
              proveedor TEXT NOT NULL,
              monto REAL NOT NULL,
              medio_pago TEXT NOT NULL DEFAULT 'efectivo',
              fecha TEXT DEFAULT (datetime('now'))
            );
            CREATE INDEX IF NOT EXISTS idx_libro_caja_egresos_dia ON libro_caja_egresos(dia_id);
          `);
        } else {
          // Verificar si la columna ya existe
          const cols = db.prepare(`PRAGMA table_info(libro_caja_egresos)`).all() as { name: string }[];
          if (!cols.some(c => c.name === 'medio_pago')) {
            db.exec(`ALTER TABLE libro_caja_egresos ADD COLUMN medio_pago TEXT NOT NULL DEFAULT 'efectivo';`);
          }
        }
      },
    },
    {
      name: '010_extra_caja',
      run: (db: Database.Database) => {
        const cols = db.prepare(`PRAGMA table_info(libro_caja_dias)`).all() as { name: string }[];
        if (!cols.some(c => c.name === 'extra_caja')) {
          db.exec(`ALTER TABLE libro_caja_dias ADD COLUMN extra_caja REAL DEFAULT 0;`);
        }
      },
    },
  ];

  const executedMigrations: { name: string }[] = db
    .prepare('SELECT name FROM __migrations')
    .all() as { name: string }[];
  const executedNames = new Set(executedMigrations.map((m) => m.name));

  for (const migration of migrations) {
    if (!executedNames.has(migration.name)) {
      console.log(`[DB] Ejecutando migración: ${migration.name}`);
      if (migration.run) {
        migration.run(db);
      } else if (migration.sql) {
        db.exec(migration.sql);
      }
      db.prepare('INSERT INTO __migrations (name) VALUES (?)').run(migration.name);
      console.log(`[DB] Migración completada: ${migration.name}`);
    }
  }
}

function seedInitialData(db: Database.Database): void {
  // Usuario admin por defecto
  const adminExists = db.prepare('SELECT id FROM usuarios WHERE rol = ?').get('admin');
  if (!adminExists) {
    db.prepare(`
      INSERT INTO usuarios (nombre, pin, rol, activo) VALUES (?, ?, ?, 1)
    `).run('Administrador', '1234', 'admin');
    console.log('[DB] Usuario admin creado (PIN: 1234)');
  }

  // Categoría por defecto
  const catExists = db.prepare('SELECT id FROM categorias LIMIT 1').get();
  if (!catExists) {
    db.prepare(`INSERT INTO categorias (nombre, color) VALUES (?, ?)`).run('General', '#6366f1');
    db.prepare(`INSERT INTO categorias (nombre, color) VALUES (?, ?)`).run('Bebidas', '#0ea5e9');
    db.prepare(`INSERT INTO categorias (nombre, color) VALUES (?, ?)`).run('Alimentos', '#22c55e');
    db.prepare(`INSERT INTO categorias (nombre, color) VALUES (?, ?)`).run('Limpieza', '#f59e0b');
    db.prepare(`INSERT INTO categorias (nombre, color) VALUES (?, ?)`).run('Electronicos', '#8b5cf6');
  }

  // Configuración por defecto
  const configDefaults: Record<string, string> = {
    nombre_negocio: 'Mi Negocio',
    direccion: '',
    telefono: '',
    email: '',
    moneda: 'ARS',
    simbolo_moneda: '$',
    formato_ticket: '80mm',
    puerto_servidor: '3001',
    tema: 'dark',
    vista_productos: 'grid',
    impresora: '',
    iva_porcentaje: '21',
    mostrar_iva: '0',
    logo_path: '',
  };

  const insertConfig = db.prepare(`
    INSERT OR IGNORE INTO configuracion (clave, valor) VALUES (?, ?)
  `);

  for (const [clave, valor] of Object.entries(configDefaults)) {
    insertConfig.run(clave, valor);
  }

  console.log('[DB] Datos iniciales verificados.');

  // ── Clientes de ejemplo ──────────────────────────────────────────────
  // Corre una sola vez: verifica por la venta demo FDEMO-001
  const demoExist = db.prepare(`SELECT id FROM ventas WHERE numero = 'FDEMO-001'`).get();
  if (!demoExist) {
    const insertCliente = db.prepare(`
      INSERT INTO clientes (nombre, telefono, email, direccion, documento, limite_credito)
      VALUES (@nombre, @telefono, @email, @direccion, @documento, @limite_credito)
    `);

    const clientesDemoData = [
      { nombre: 'María González',   telefono: '11-4567-8901', email: 'maria.g@gmail.com',    direccion: 'Av. Corrientes 1234', documento: '28.456.789', limite_credito: 5000  },
      { nombre: 'Juan Pérez',        telefono: '11-5678-9012', email: '',                      direccion: 'Belgrano 567',         documento: '32.123.456', limite_credito: 3000  },
      { nombre: 'Carlos Rodríguez',  telefono: '11-6789-0123', email: 'carlos.r@hotmail.com', direccion: 'San Martín 890',       documento: '25.789.012', limite_credito: 2000  },
      { nombre: 'Laura Martínez',    telefono: '11-7890-1234', email: 'laura.m@yahoo.com',    direccion: 'Mitre 456',            documento: '30.456.123', limite_credito: 10000 },
      { nombre: 'Kiosco El Sol',     telefono: '11-8901-2345', email: '',                      direccion: 'Rivadavia 2345',       documento: '30-12345678-9', limite_credito: 15000 },
      { nombre: 'Pedro Sánchez',     telefono: '11-9012-3456', email: '',                      direccion: '',                     documento: '27.321.654', limite_credito: 1000  },
    ];

    for (const c of clientesDemoData) { insertCliente.run(c); }

    // Insertar fiados de demo para probar "cobro del fiado"
    const ahora = new Date();
    const fecha = ahora.toISOString().split('T')[0];
    const hora  = ahora.toTimeString().split(' ')[0];

    const maria  = db.prepare(`SELECT id FROM clientes WHERE nombre = 'María González' ORDER BY id DESC LIMIT 1`).get() as { id: number } | undefined;
    const juan   = db.prepare(`SELECT id FROM clientes WHERE nombre = 'Juan Pérez' ORDER BY id DESC LIMIT 1`).get() as { id: number } | undefined;
    const kiosco = db.prepare(`SELECT id FROM clientes WHERE nombre = 'Kiosco El Sol' ORDER BY id DESC LIMIT 1`).get() as { id: number } | undefined;

    const insertVenta = db.prepare(`
      INSERT OR IGNORE INTO ventas (numero, tipo, estado, fecha, hora, cliente_id, subtotal, descuento, total, metodo_pago, es_fiado, observaciones)
      VALUES (@numero, 'venta', 'fiado', @fecha, @hora, @cliente_id, @total, 0, @total, 'fiado', 1, @obs)
    `);
    const insertItem = db.prepare(`
      INSERT INTO venta_items (venta_id, producto_id, cantidad, precio_unitario, descuento, total)
      VALUES (?, NULL, 1, ?, 0, ?)
    `);

    if (maria) {
      const r = insertVenta.run({ numero: 'FDEMO-001', fecha, hora, cliente_id: maria.id, total: 2500, obs: 'Compras del mes · demo' });
      if (r.lastInsertRowid) insertItem.run(r.lastInsertRowid, 2500, 2500);
    }
    if (juan) {
      const r = insertVenta.run({ numero: 'FDEMO-002', fecha, hora, cliente_id: juan.id, total: 1800, obs: 'Mercadería · demo' });
      if (r.lastInsertRowid) insertItem.run(r.lastInsertRowid, 1800, 1800);
    }
    if (kiosco) {
      const r1 = insertVenta.run({ numero: 'FDEMO-003', fecha, hora, cliente_id: kiosco.id, total: 5200, obs: 'Pedido semanal · demo' });
      if (r1.lastInsertRowid) insertItem.run(r1.lastInsertRowid, 5200, 5200);
      const r2 = insertVenta.run({ numero: 'FDEMO-004', fecha, hora, cliente_id: kiosco.id, total: 3100, obs: 'Pedido quincenal · demo' });
      if (r2.lastInsertRowid) insertItem.run(r2.lastInsertRowid, 3100, 3100);
    }

    console.log('[DB] Clientes de ejemplo y fiados demo creados.');
  }
}

export function getDbPath(): string {
  const userDataPath = app.getPath('userData');
  return path.join(userDataPath, 'ariespos.db');
}
