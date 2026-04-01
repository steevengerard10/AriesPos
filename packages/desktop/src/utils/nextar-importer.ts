import * as fs from 'fs';
import iconv from 'iconv-lite';

// Mapeo de columnas Nextar → campos internos ARIESPos
const NEXTAR_COLUMN_MAP: Record<string, string> = {
  'código':           'codigo',
  'codigo':           'codigo',
  'cód.':             'codigo',
  'cod.':             'codigo',
  'nombre':           'nombre',
  'descripción':      'descripcion',
  'descripcion':      'descripcion',
  'precio de venta':  'precio_venta',
  'precio venta':     'precio_venta',
  'precio':           'precio_venta',
  'p. venta':         'precio_venta',
  'precio de costo':  'precio_costo',
  'precio costo':     'precio_costo',
  'costo':            'precio_costo',
  'p. costo':         'precio_costo',
  'stock':            'stock_actual',
  'existencia':       'stock_actual',
  'stock actual':     'stock_actual',
  'stock mínimo':     'stock_minimo',
  'stock minimo':     'stock_minimo',
  'stock min':        'stock_minimo',
  'stock mín.':       'stock_minimo',
  'unidad':           'unidad_medida',
  'unidad de medida': 'unidad_medida',
  'categoría':        'categoria',
  'categoria':        'categoria',
  'rubro':            'categoria',
  'código de barras': 'codigo_barras',
  'codigo de barras': 'codigo_barras',
  'barras':           'codigo_barras',
  'ean':              'codigo_barras',
  'cod. barras':      'codigo_barras',
  'precio 2':         'precio2',
  'precio2':          'precio2',
  'precio 3':         'precio3',
  'precio3':          'precio3',
  'activo':           'activo',
  'habilitado':       'activo',
};

// Unidades que implican fraccionable = true
const FRACTIONAL_UNITS = new Set([
  'kg', 'kilo', 'kilos', 'kilogramo', 'kilogramos',
  'gramo', 'gramos', 'gr', 'g',
  'litro', 'litros', 'lt', 'l',
  'ml', 'mililitro', 'mililitros',
  'metro', 'metros', 'm',
  'cm', 'centimetro', 'centímetro',
]);

export interface NextarImportResult {
  imported: number;
  skipped: number;
  errors: string[];
  products: NextarProductRow[];
}

export interface NextarProductRow {
  codigo: string;
  nombre: string;
  descripcion: string;
  precio_venta: number;
  precio_costo: number;
  precio2: number | null;
  precio3: number | null;
  stock_actual: number;
  stock_minimo: number;
  unidad_medida: string;
  fraccionable: boolean;
  categoria: string;
  codigo_barras: string;
  activo: boolean;
}

function detectEncoding(buffer: Buffer): string {
  // BOM UTF-8
  if (buffer[0] === 0xEF && buffer[1] === 0xBB && buffer[2] === 0xBF) return 'utf8';
  // BOM UTF-16 LE
  if (buffer[0] === 0xFF && buffer[1] === 0xFE) return 'utf16le';

  // Intentar UTF-8 y ver si hay caracteres españoles válidos
  const asUtf8 = iconv.decode(buffer, 'utf8');
  const hasValidSpanish = /[áéíóúñüÁÉÍÓÚÑÜ¿¡]/.test(asUtf8);
  const hasGarbled = /Ã[¡-¿]|Â[¡-¿]|Ã±|Â°/.test(asUtf8);

  if (hasValidSpanish && !hasGarbled) return 'utf8';
  return 'win1252';
}

function detectSeparator(firstLine: string): string {
  const semicolons = (firstLine.match(/;/g) || []).length;
  const tabs = (firstLine.match(/\t/g) || []).length;
  // Contar comas que NO estén dentro de comillas (heurístico simple)
  const commas = (firstLine.match(/,/g) || []).length;
  if (tabs > semicolons && tabs > commas) return '\t';
  if (semicolons >= commas) return ';';
  return ',';
}

function parseNixtarNumber(value: string): number {
  if (!value || value.trim() === '' || value.trim() === '-') return 0;
  const cleaned = value.trim()
    .replace(/\./g, '')   // quitar separadores de miles (punto)
    .replace(',', '.');   // convertir coma decimal a punto
  const num = parseFloat(cleaned);
  return isNaN(num) ? 0 : num;
}

function parseCSVLine(line: string, sep: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === sep && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current.trim());
  return result;
}

export function importFromNextar(filePath: string): NextarImportResult {
  const result: NextarImportResult = { imported: 0, skipped: 0, errors: [], products: [] };

  const buffer = fs.readFileSync(filePath);
  const encoding = detectEncoding(buffer);
  let content = iconv.decode(buffer, encoding);

  // Remover BOM UTF-8 si existe
  content = content.replace(/^\uFEFF/, '');

  const lines = content.split(/\r?\n/).filter(l => l.trim() !== '');
  if (lines.length < 2) {
    result.errors.push('El archivo está vacío o no tiene datos suficientes.');
    return result;
  }

  const sep = detectSeparator(lines[0]);
  const headers = parseCSVLine(lines[0], sep).map(h => h.toLowerCase().replace(/"/g, '').trim());

  const columnMap: Record<number, string> = {};
  headers.forEach((header, index) => {
    const mapped = NEXTAR_COLUMN_MAP[header];
    if (mapped) columnMap[index] = mapped;
  });

  if (Object.keys(columnMap).length < 2) {
    result.errors.push(
      `No se reconocieron las columnas del archivo. Encabezados encontrados: ${headers.join(', ')}`
    );
    return result;
  }

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    if (!line.trim()) continue;

    try {
      const values = parseCSVLine(line, sep);
      const row: Record<string, string> = {};
      for (const [colIndex, fieldName] of Object.entries(columnMap)) {
        row[fieldName] = (values[parseInt(colIndex)] || '').replace(/"/g, '').trim();
      }

      if (!row.nombre) {
        result.skipped++;
        continue;
      }

      const unidad = (row.unidad_medida || 'unidad').toLowerCase().trim();
      const fraccionable = FRACTIONAL_UNITS.has(unidad) ||
        [...FRACTIONAL_UNITS].some(u => unidad.startsWith(u));

      const product: NextarProductRow = {
        codigo:       row.codigo || `IMP${String(i).padStart(5, '0')}`,
        nombre:       row.nombre,
        descripcion:  row.descripcion || '',
        precio_venta: parseNixtarNumber(row.precio_venta),
        precio_costo: parseNixtarNumber(row.precio_costo),
        precio2:      row.precio2 ? parseNixtarNumber(row.precio2) : null,
        precio3:      row.precio3 ? parseNixtarNumber(row.precio3) : null,
        stock_actual: parseNixtarNumber(row.stock_actual),
        stock_minimo: parseNixtarNumber(row.stock_minimo),
        unidad_medida: row.unidad_medida || 'unidad',
        fraccionable,
        categoria:    row.categoria || 'General',
        codigo_barras: row.codigo_barras || '',
        activo:       row.activo ? row.activo !== '0' && row.activo.toLowerCase() !== 'no' : true,
      };

      result.products.push(product);
      result.imported++;
    } catch (err) {
      result.errors.push(`Fila ${i + 1}: ${String(err)}`);
      result.skipped++;
    }
  }

  return result;
}
