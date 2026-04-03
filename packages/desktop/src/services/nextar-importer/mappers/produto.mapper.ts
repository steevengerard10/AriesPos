/**
 * produto.mapper.ts
 * Transforma un RawProduct (extraído del binario NX1) al formato de la DB ARIESPos.
 */

import type { RawProduct } from '../nx1-reader';

// Mapa de unidades Nextar → ARIESPos
const UNIT_MAP: Record<string, string> = {
  'pieza': 'unidad', 'un': 'unidad', 'unid': 'unidad', 'unidade': 'unidad',
  'kg': 'kg', 'kilo': 'kg', 'quilograma': 'kg',
  'gramo': 'gramo', 'gr': 'gramo', 'g': 'gramo', 'grama': 'gramo',
  'litro': 'litro', 'lt': 'litro', 'l': 'litro',
  'ml': 'ml', 'mililitro': 'ml',
  'metro': 'metro', 'mt': 'metro', 'm': 'metro',
  'cm': 'cm',
  'caja': 'caja', 'cx': 'caja',
  'pack': 'pack', 'paquete': 'pack',
  'fardo': 'fardo',
  'docena': 'docena', 'dz': 'docena',
};

const FRACTIONAL_UNITS = new Set(['kg', 'gramo', 'litro', 'ml', 'metro', 'cm']);

export interface MappedProduct {
  codigo: string;
  codigoBarras: string | null;
  nombre: string;
  precioVenta: number;
  precioCosto: number;
  stockActual: number;
  unidadMedida: string;
  fraccionable: number;  // 0 | 1 for SQLite
  activo: number;
  categoriaNombre: string;  // nombre crudo para buscar/crear categoría
}

export function mapProducto(raw: RawProduct, index: number): MappedProduct {
  const unidadRaw = raw.unidadMedida.toLowerCase().trim();
  const unidad = UNIT_MAP[unidadRaw] || 'unidad';
  const fraccionable = raw.fraccionable || FRACTIONAL_UNITS.has(unidad) ? 1 : 0;

  // Prioridad: código interno Nextar → código de barras → número secuencial
  const codigo = (raw.codigo || '').trim()
    || (raw.codigoBarras || '').trim()
    || String(index + 1);

  return {
    codigo,
    codigoBarras: raw.codigoBarras && raw.codigoBarras.trim() !== '' ? raw.codigoBarras.trim() : null,
    nombre: raw.nombre.trim(),
    precioVenta: raw.precioVenta,
    precioCosto: raw.precioCosto || 0,
    stockActual: raw.stockActual || 0,
    unidadMedida: unidad,
    fraccionable,
    activo: 1,
    categoriaNombre: raw.categoria?.trim() || '',
  };
}
