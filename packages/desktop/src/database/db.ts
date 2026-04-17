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
    {
      name: '011_seed_productos_arg',
      run: (db: Database.Database) => {
        // Eliminar productos previos
        db.exec(`DELETE FROM productos`);

        // Agregar categorías extra si no existen
        const ensureCat = db.prepare(`INSERT OR IGNORE INTO categorias (nombre, color) VALUES (?, ?)`);
        ensureCat.run('Golosinas', '#ec4899');
        ensureCat.run('Galletitas', '#f97316');
        ensureCat.run('Lácteos', '#06b6d4');

        const getCat = (nombre: string): number | null => {
          const row = db.prepare(`SELECT id FROM categorias WHERE nombre = ? LIMIT 1`).get(nombre) as { id: number } | undefined;
          return row ? row.id : null;
        };

        const beb  = getCat('Bebidas');
        const gol  = getCat('Golosinas');
        const gall = getCat('Galletitas');
        const lac  = getCat('Lácteos');

        const ins = db.prepare(`
          INSERT OR IGNORE INTO productos (codigo, nombre, categoria_id, precio_venta, unidad_medida, en_catalogo, activo)
          VALUES (?, ?, ?, 0, 'unidad', 1, 1)
        `);

        const productos: [string, string, number | null][] = [
          // ── COCA-COLA COMPANY ────────────────────────────────────────
          // Coca-Cola
          ['CC-001', 'Coca-Cola 237ml Lata',               beb],
          ['CC-002', 'Coca-Cola 354ml Lata',               beb],
          ['CC-003', 'Coca-Cola 500ml',                    beb],
          ['CC-004', 'Coca-Cola 1L',                       beb],
          ['CC-005', 'Coca-Cola 1.5L',                     beb],
          ['CC-006', 'Coca-Cola 2L',                       beb],
          ['CC-007', 'Coca-Cola 2.25L',                    beb],
          ['CC-008', 'Coca-Cola 3L',                       beb],
          ['CC-009', 'Coca-Cola 1.5L Retornable',          beb],
          ['CC-010', 'Coca-Cola 2L Retornable',            beb],
          ['CC-011', 'Coca-Cola Zero 354ml Lata',          beb],
          ['CC-012', 'Coca-Cola Zero 500ml',               beb],
          ['CC-013', 'Coca-Cola Zero 1.5L',                beb],
          ['CC-014', 'Coca-Cola Zero 2.25L',               beb],
          ['CC-015', 'Coca-Cola Light 354ml Lata',         beb],
          ['CC-016', 'Coca-Cola Light 1.5L',               beb],
          // Sprite
          ['SP-001', 'Sprite 354ml Lata',                  beb],
          ['SP-002', 'Sprite 500ml',                       beb],
          ['SP-003', 'Sprite 1.5L',                        beb],
          ['SP-004', 'Sprite 2.25L',                       beb],
          ['SP-005', 'Sprite 3L',                          beb],
          ['SP-006', 'Sprite Zero 354ml Lata',             beb],
          ['SP-007', 'Sprite Zero 500ml',                  beb],
          // Fanta
          ['FN-001', 'Fanta Naranja 354ml Lata',           beb],
          ['FN-002', 'Fanta Naranja 500ml',                beb],
          ['FN-003', 'Fanta Naranja 1.5L',                 beb],
          ['FN-004', 'Fanta Naranja 2.25L',                beb],
          ['FN-005', 'Fanta Naranja 3L',                   beb],
          ['FN-006', 'Fanta Limón 354ml Lata',             beb],
          ['FN-007', 'Fanta Limón 500ml',                  beb],
          ['FN-008', 'Fanta Limón 1.5L',                   beb],
          ['FN-009', 'Fanta Uva 354ml Lata',               beb],
          ['FN-010', 'Fanta Uva 500ml',                    beb],
          // Cepita
          ['CE-001', 'Cepita Naranja 200ml',               beb],
          ['CE-002', 'Cepita Naranja 1L',                  beb],
          ['CE-003', 'Cepita Naranja 1.5L',                beb],
          ['CE-004', 'Cepita Manzana 200ml',               beb],
          ['CE-005', 'Cepita Manzana 1L',                  beb],
          ['CE-006', 'Cepita Durazno 200ml',               beb],
          ['CE-007', 'Cepita Durazno 1L',                  beb],
          ['CE-008', 'Cepita Multifruta 200ml',            beb],
          ['CE-009', 'Cepita Multifruta 1L',               beb],
          ['CE-010', 'Cepita Pera 200ml',                  beb],
          ['CE-011', 'Cepita Pera 1L',                     beb],
          ['CE-012', 'Cepita Uva 200ml',                   beb],
          ['CE-013', 'Cepita Uva 1L',                      beb],
          // Dasani
          ['DA-001', 'Agua Dasani 500ml',                  beb],
          ['DA-002', 'Agua Dasani 1.5L',                   beb],
          // Powerade (Coca-Cola)
          ['PW-001', 'Powerade Naranja 500ml',             beb],
          ['PW-002', 'Powerade Limón 500ml',               beb],
          ['PW-003', 'Powerade Uva 500ml',                 beb],
          ['PW-004', 'Powerade Mountain Blast 500ml',      beb],

          // ── PEPSICO ──────────────────────────────────────────────────
          // Pepsi
          ['PP-001', 'Pepsi 250ml Lata',                   beb],
          ['PP-002', 'Pepsi 500ml',                        beb],
          ['PP-003', 'Pepsi 1.5L',                         beb],
          ['PP-004', 'Pepsi 2.25L',                        beb],
          ['PP-005', 'Pepsi 3L',                           beb],
          ['PP-006', 'Pepsi Black 250ml Lata',             beb],
          ['PP-007', 'Pepsi Black 500ml',                  beb],
          ['PP-008', 'Pepsi Black 1.5L',                   beb],
          // 7UP
          ['UP-001', '7UP 250ml Lata',                     beb],
          ['UP-002', '7UP 500ml',                          beb],
          ['UP-003', '7UP 1.5L',                           beb],
          ['UP-004', '7UP 2.25L',                          beb],
          ['UP-005', '7UP 3L',                             beb],
          ['UP-006', '7UP Free 250ml Lata',                beb],
          ['UP-007', '7UP Free 500ml',                     beb],
          // Gatorade
          ['GT-001', 'Gatorade Naranja 500ml',             beb],
          ['GT-002', 'Gatorade Limón 500ml',               beb],
          ['GT-003', 'Gatorade Uva 500ml',                 beb],
          ['GT-004', 'Gatorade Tropical 500ml',            beb],
          ['GT-005', 'Gatorade Manzana 500ml',             beb],
          ['GT-006', 'Gatorade Mandarina 500ml',           beb],
          ['GT-007', 'Gatorade Cool Blue 500ml',           beb],
          ['GT-008', 'Gatorade Naranja 1L',                beb],
          ['GT-009', 'Gatorade Limón 1L',                  beb],
          // H2OH
          ['H2-001', 'H2OH Limón 500ml',                   beb],
          ['H2-002', 'H2OH Naranja 500ml',                 beb],
          ['H2-003', 'H2OH Pomelo 500ml',                  beb],
          ['H2-004', 'H2OH Limón 1.5L',                    beb],
          // Lipton Ice Tea (PepsiCo)
          ['LI-001', 'Lipton Ice Tea Limón 500ml',         beb],
          ['LI-002', 'Lipton Ice Tea Durazno 500ml',       beb],
          ['LI-003', 'Lipton Ice Tea Limón 1.5L',          beb],
          ['LI-004', 'Lipton Ice Tea Durazno 1.5L',        beb],
          // Mirinda (PepsiCo)
          ['MI-001', 'Mirinda Naranja 250ml Lata',         beb],
          ['MI-002', 'Mirinda Naranja 500ml',              beb],
          ['MI-003', 'Mirinda Naranja 1.5L',               beb],

          // ── ARCOR – BAGLEY (Galletitas) ──────────────────────────────
          ['BG-001', 'Bagley Criollitas x200g',            gall],
          ['BG-002', 'Bagley Criollitas x100g',            gall],
          ['BG-003', 'Bagley Merengadas x160g',            gall],
          ['BG-004', 'Bagley Lincoln x210g',               gall],
          ['BG-005', 'Bagley Lincoln Vainilla x210g',      gall],
          ['BG-006', 'Bagley Oreo x160g',                  gall],
          ['BG-007', 'Bagley Oreo x312g',                  gall],
          ['BG-008', 'Bagley Pepas x250g',                 gall],
          ['BG-009', 'Bagley Pepas Membrillo x250g',       gall],
          ['BG-010', 'Bagley Traviata x180g',              gall],
          ['BG-011', 'Bagley Vocación x180g',              gall],
          ['BG-012', 'Bagley Gaucho x300g',                gall],
          ['BG-013', 'Bagley Opera x150g',                 gall],
          ['BG-014', 'Bagley Tentaciones Chocolate x180g', gall],
          ['BG-015', 'Bagley Sabritas x110g',              gall],
          ['BG-016', 'Bagley Express x180g',               gall],
          // ARCOR – Rumba (Golosinas)
          ['RU-001', 'Rumba Clásica x100g',                gol],
          ['RU-002', 'Rumba con Maní x100g',               gol],
          ['RU-003', 'Rumba Mentol x100g',                 gol],
          // ARCOR – Diversión (Golosinas)
          ['DV-001', 'Diversión Chocolate x40g',           gol],
          ['DV-002', 'Diversión con Leche x40g',           gol],
          ['DV-003', 'Diversión Maní x40g',                gol],
          // ARCOR – Golosinas varias
          ['AR-001', 'Bon o Bon x200g',                    gol],
          ['AR-002', 'Bon o Bon Unitario x16g',            gol],
          ['AR-003', 'Cofler Chocolate x55g',              gol],
          ['AR-004', 'Cofler Almendras x55g',              gol],
          ['AR-005', 'Cofler Aireado x55g',                gol],
          ['AR-006', 'Menthoplus x15g',                    gol],
          ['AR-007', 'Rocklets x25g',                      gol],
          ['AR-008', 'Rocklets x100g',                     gol],
          ['AR-009', 'Caramelos Arcor x100g',              gol],
          ['AR-010', 'Sugus x18g',                         gol],
          ['AR-011', 'Sugus x180g',                        gol],
          ['AR-012', 'Butter Toffees x420g',               gol],
          ['AR-013', 'Butter Toffees x100g',               gol],
          ['AR-014', 'Palito Arcor Chocolate x10g',        gol],
          ['AR-015', 'Arcor Frambuesa x100g',              gol],
          ['AR-016', 'Arcor Menta x100g',                  gol],
          ['AR-017', 'Topline x32g',                       gol],
          ['AR-018', 'Mogul Masticables x100g',            gol],
          ['AR-019', 'Gomitas Arcor x100g',                gol],
          ['AR-020', 'Alfajor Rocklets x45g',              gol],
          ['AR-021', 'Alfajor Bon o Bon x36g',             gol],
          ['AR-022', 'Chocolín x200g',                     gol],
          ['AR-023', 'Acerete x50g',                       gol],

          // ── MILKAUT (Lácteos) ─────────────────────────────────────────
          ['ML-001', 'Leche Milkaut Entera x1L',           lac],
          ['ML-002', 'Leche Milkaut Descremada x1L',       lac],
          ['ML-003', 'Leche Milkaut Semidescremada x1L',   lac],
          ['ML-004', 'Leche Milkaut Larga Vida Entera x1L',lac],
          ['ML-005', 'Crema de Leche Milkaut x200ml',      lac],
          ['ML-006', 'Crema de Leche Milkaut x500ml',      lac],
          ['ML-007', 'Yogur Milkaut Natural x200g',        lac],
          ['ML-008', 'Yogur Milkaut Frutado Frutilla x200g',lac],
          ['ML-009', 'Yogur Milkaut Frutado Durazno x200g',lac],
          ['ML-010', 'Yogur Milkaut Frutado Vainilla x200g',lac],
          ['ML-011', 'Yogur Milkaut Batido x1kg',          lac],
          ['ML-012', 'Queso Cremoso Milkaut x220g',        lac],
          ['ML-013', 'Queso Cremoso Milkaut x400g',        lac],
          ['ML-014', 'Ricota Milkaut x250g',               lac],
          ['ML-015', 'Manteca Milkaut x200g',              lac],
          ['ML-016', 'Manteca Milkaut x100g',              lac],

          // ── TERRABUSI (Galletitas) ────────────────────────────────────
          ['TB-001', 'Terrabusi Marineras x370g',          gall],
          ['TB-002', 'Terrabusi Marineras x185g',          gall],
          ['TB-003', 'Terrabusi Hogaza x400g',             gall],
          ['TB-004', 'Terrabusi Hogaza x200g',             gall],
          ['TB-005', 'Terrabusi Agua x200g',               gall],
          ['TB-006', 'Terrabusi Club Social x192g',        gall],
          ['TB-007', 'Terrabusi Club Social Integral x187g',gall],
          ['TB-008', 'Terrabusi Crackers x150g',           gall],
          ['TB-009', 'Terrabusi Variedad x200g',           gall],
          ['TB-010', 'Terrabusi De Hojaldre x150g',        gall],
          ['TB-011', 'Terrabusi Salvado x200g',            gall],
          ['TB-012', 'Terrabusi Chocolinas x200g',         gall],
          ['TB-013', 'Terrabusi Chocolinas x120g',         gall],
          ['TB-014', 'Terrabusi Tentación x180g',          gall],
          ['TB-015', 'Terrabusi Express x200g',            gall],
        ];

        for (const [codigo, nombre, catId] of productos) {
          ins.run(codigo, nombre, catId);
        }

        console.log(`[DB] ${productos.length} productos de Coca-Cola, PepsiCo, Arcor, Milkaut y Terrabusi insertados.`);
      },
    },
    {
      name: '012_barcodes_and_cigarrillos',
      run: (db: Database.Database) => {
        // ── Nuevas categorías ──────────────────────────────────────────
        const ensureCat = db.prepare(`INSERT OR IGNORE INTO categorias (nombre, color) VALUES (?, ?)`);
        ensureCat.run('Cigarrillos',       '#374151');
        ensureCat.run('Snacks',            '#ec4899');
        ensureCat.run('Energizantes',      '#f59e0b');
        ensureCat.run('Beb. Deportivas',   '#10b981');
        ensureCat.run('Yerbas y Tes',      '#16a34a');
        ensureCat.run('Higiene Personal',  '#7c3aed');
        ensureCat.run('Limpieza Hogar',    '#0891b2');

        const getCat = (nombre: string): number | null => {
          const row = db.prepare(`SELECT id FROM categorias WHERE nombre = ? LIMIT 1`).get(nombre) as { id: number } | undefined;
          return row ? row.id : null;
        };

        // ── Actualizar EAN de productos de bebidas ya existentes ───────
        const upd = db.prepare(`UPDATE productos SET codigo_barras = ?, marca = ? WHERE codigo = ? AND (codigo_barras IS NULL OR codigo_barras = '')`);
        // Coca-Cola
        upd.run('7790895001109', 'Coca-Cola', 'CC-001');
        upd.run('7790895001598', 'Coca-Cola', 'CC-002');
        upd.run('7790895000997', 'Coca-Cola', 'CC-003');
        upd.run('7790895001604', 'Coca-Cola', 'CC-004');
        upd.run('7790895005916', 'Coca-Cola', 'CC-005');
        upd.run('7790895009136', 'Coca-Cola', 'CC-006');
        upd.run('7790895002830', 'Coca-Cola', 'CC-007');
        upd.run('7790895003714', 'Coca-Cola', 'CC-008');
        upd.run('7790895050015', 'Coca-Cola', 'CC-009');
        upd.run('7790895050107', 'Coca-Cola', 'CC-010');
        upd.run('7790895003691', 'Coca-Cola', 'CC-011');
        upd.run('7790895050190', 'Coca-Cola', 'CC-012');
        upd.run('7790895050404', 'Coca-Cola', 'CC-013');
        upd.run('7790895050466', 'Coca-Cola', 'CC-014');
        upd.run('7790895004223', 'Coca-Cola', 'CC-015');
        upd.run('7790895054600', 'Coca-Cola', 'CC-016');
        // Sprite
        upd.run('7790895060328', 'Sprite', 'SP-001');
        upd.run('7790895060397', 'Sprite', 'SP-002');
        upd.run('7790895060403', 'Sprite', 'SP-003');
        upd.run('7790895060410', 'Sprite', 'SP-004');
        upd.run('7790895060427', 'Sprite', 'SP-005');
        upd.run('7790895060731', 'Sprite', 'SP-006');
        upd.run('7790895060748', 'Sprite', 'SP-007');
        // Fanta
        upd.run('7790895040078', 'Fanta', 'FN-001');
        upd.run('7790895040009', 'Fanta', 'FN-002');
        upd.run('7790895040016', 'Fanta', 'FN-003');
        upd.run('7790895040023', 'Fanta', 'FN-004');
        upd.run('7790895647802', 'Fanta', 'FN-005');
        upd.run('7790895040085', 'Fanta', 'FN-006');
        upd.run('7790895040092', 'Fanta', 'FN-007');
        upd.run('7790895040115', 'Fanta', 'FN-008');
        upd.run('7790895040030', 'Fanta', 'FN-009');
        upd.run('7790895040047', 'Fanta', 'FN-010');
        // Cepita
        upd.run('7790895020063', 'Cepita', 'CE-001');
        upd.run('7790895020001', 'Cepita', 'CE-002');
        // Pepsi
        upd.run('7790380011527', 'Pepsi', 'PE-001');
        upd.run('7790380001003', 'Pepsi', 'PE-002');
        upd.run('7790380001010', 'Pepsi', 'PE-003');
        upd.run('7790380002000', 'Pepsi', 'PE-004');
        upd.run('7790380001607', 'Pepsi', 'PE-005');
        upd.run('7790380002017', 'Pepsi', 'PE-006');
        upd.run('7790380001645', 'Pepsi', 'PE-007');
        upd.run('7790380001652', 'Pepsi', 'PE-008');
        // 7UP
        upd.run('7790380010001', '7UP', '7U-001');
        upd.run('7790380010018', '7UP', '7U-002');
        upd.run('7790380010025', '7UP', '7U-003');
        // Gatorade
        upd.run('7790380030001', 'Gatorade', 'GA-001');
        upd.run('7790380030018', 'Gatorade', 'GA-002');
        upd.run('7790380030025', 'Gatorade', 'GA-003');
        upd.run('7790380030032', 'Gatorade', 'GA-004');
        // Arcor
        upd.run('7790580311605', 'Arcor', 'AR-006');
        upd.run('7790580103361', 'Arcor', 'AR-005');
        upd.run('7790580127534', 'Arcor', 'AR-009');
        // Terrabusi
        upd.run('7622300742645', 'Terrabusi', 'TB-001');
        upd.run('7622300840259', 'Terrabusi', 'TB-002');
        upd.run('7622300785239', 'Terrabusi', 'TB-003');
        upd.run('7622300810009', 'Terrabusi', 'TB-015');
        upd.run('7622300820008', 'Terrabusi', 'TB-014');

        // ── Nuevos productos con EAN ───────────────────────────────────
        const cig  = getCat('Cigarrillos');
        const snk  = getCat('Snacks');
        const ene  = getCat('Energizantes');
        const dep  = getCat('Beb. Deportivas');

        const ins = db.prepare(`
          INSERT OR IGNORE INTO productos (codigo, codigo_barras, nombre, categoria_id, precio_venta, unidad_medida, en_catalogo, activo, marca)
          VALUES (?, ?, ?, ?, 0, 'unidad', 1, 1, ?)
        `);

        // ── CIGARRILLOS – PHILIP MORRIS ────────────────────────────────
        ins.run('ML-BOX20',  '7791256000015', 'Marlboro Gold x20',         cig, 'Marlboro');
        ins.run('ML-BOX10',  '7791256000022', 'Marlboro Gold x10',         cig, 'Marlboro');
        ins.run('ML-RED20',  '7791256000039', 'Marlboro Red x20',          cig, 'Marlboro');
        ins.run('ML-RED10',  '7791256000046', 'Marlboro Red x10',          cig, 'Marlboro');
        ins.run('ML-BLUE20', '7791256000053', 'Marlboro Blue x20',         cig, 'Marlboro');
        ins.run('ML-EVO20',  '7791256000060', 'Marlboro Evolution x20',    cig, 'Marlboro');
        ins.run('ML-FUS20',  '7791256000077', 'Marlboro Double Fusion x20',cig, 'Marlboro');
        ins.run('CH-RED20',  '7791256001012', 'Chesterfield Red x20',      cig, 'Chesterfield');
        ins.run('CH-RED10',  '7791256001029', 'Chesterfield Red x10',      cig, 'Chesterfield');
        ins.run('CH-BLUE20', '7791256001036', 'Chesterfield Blue x20',     cig, 'Chesterfield');
        ins.run('LM-RED20',  '7791256002001', 'L&M Red x20',               cig, 'L&M');
        ins.run('LM-BLUE20', '7791256002018', 'L&M Blue x20',              cig, 'L&M');
        ins.run('LM-SIL20',  '7791256002025', 'L&M Silver x20',            cig, 'L&M');
        ins.run('PA-SIL20',  '7791256003001', 'Parliament Silver x20',     cig, 'Parliament');
        // ── SNACKS – LAY'S / PEPSI ────────────────────────────────────
        ins.run('LA-ORI50',  '7790380040001', "Lay's Original 50g",        snk, "Lay's");
        ins.run('LA-QUE50',  '7790380040018', "Lay's Queso 50g",           snk, "Lay's");
        ins.run('LA-CHE50',  '7790380040025', "Lay's Cheddar 50g",         snk, "Lay's");
        ins.run('LA-SAL100', '7790040124974', 'Saladix Original 100g',     snk, 'Bagley');
        ins.run('LA-BBQ100', '7790040125018', 'Saladix Barbacoa 100g',     snk, 'Bagley');
        ins.run('LA-CHE100', '7790040125056', 'Saladix Cheddar 100g',      snk, 'Bagley');
        // ── ENERGIZANTES – MONSTER ────────────────────────────────────
        ins.run('MO-ORI473', '5099873002070', 'Monster Energy Original 473ml',  ene, 'Monster');
        ins.run('MO-ZER473', '5099873002087', 'Monster Energy Zero 473ml',      ene, 'Monster');
        ins.run('MO-ULT473', '5099873002094', 'Monster Energy Ultra 473ml',     ene, 'Monster');
        ins.run('MO-MAN473', '5099873002100', 'Monster Mango Loco 473ml',       ene, 'Monster');
        ins.run('RB-ORI250', '90162177',      'Red Bull Original 250ml',        ene, 'Red Bull');
        ins.run('RB-AZU250', '9002490100124', 'Red Bull Sugar Free 250ml',      ene, 'Red Bull');
        // ── BEBIDAS DEPORTIVAS – POWERADE ─────────────────────────────
        ins.run('PW-MTN500', '7790895080001', 'Powerade Mountain Blast 500ml', dep, 'Powerade');
        ins.run('PW-NAR500', '7790895080018', 'Powerade Naranja 500ml',        dep, 'Powerade');
        ins.run('PW-LIM500', '7790895080025', 'Powerade Limón 500ml',          dep, 'Powerade');
        ins.run('PW-UVA500', '7790895080032', 'Powerade Uva 500ml',            dep, 'Powerade');

        const updCat = db.prepare(`UPDATE productos SET categoria_id = ?, marca = COALESCE(NULLIF(marca,''), ?) WHERE codigo = ?`);
        updCat.run(dep, 'Gatorade', 'GA-001');
        updCat.run(dep, 'Gatorade', 'GA-002');
        updCat.run(dep, 'Gatorade', 'GA-003');
        updCat.run(dep, 'Gatorade', 'GA-004');

        console.log('[DB] Migración 012: EAN + cigarrillos + snacks + energizantes OK');
      },
    },
    {
      name: '013_libro_caja_periodos',
      run: (db: Database.Database) => {
        db.exec(`
          CREATE TABLE IF NOT EXISTS libro_caja_periodos (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            periodo TEXT NOT NULL UNIQUE,
            estado TEXT NOT NULL DEFAULT 'abierto',
            fecha_cierre TEXT,
            notas TEXT DEFAULT '',
            created_at TEXT DEFAULT (datetime('now'))
          );
          CREATE INDEX IF NOT EXISTS idx_lcp_periodo ON libro_caja_periodos(periodo);
        `);
        console.log('[DB] Migración 013: libro_caja_periodos OK');
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
