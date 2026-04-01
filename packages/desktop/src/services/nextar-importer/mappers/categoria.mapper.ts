/**
 * categoria.mapper.ts
 * Transforma RawCategoria al formato de categorías de ARIESPos.
 */

import type { RawCategoria } from '../nx1-reader';

// Paleta de colores para categorías importadas
const COLORS = [
  '#6366f1', '#0ea5e9', '#22c55e', '#f59e0b', '#8b5cf6',
  '#ec4899', '#14b8a6', '#f97316', '#06b6d4', '#84cc16',
  '#f43f5e', '#a855f7', '#3b82f6', '#10b981', '#eab308',
];

export interface MappedCategoria {
  nombre: string;
  color: string;
}

export function mapCategoria(raw: RawCategoria, index: number): MappedCategoria {
  return {
    nombre: raw.nombre.trim(),
    color: COLORS[index % COLORS.length],
  };
}
