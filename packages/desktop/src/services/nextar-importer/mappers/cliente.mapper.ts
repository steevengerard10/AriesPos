/**
 * cliente.mapper.ts
 * Transforma RawCliente al formato de clientes de ARIESPos.
 */

import type { RawCliente } from '../nx1-reader';

export interface MappedCliente {
  nombre: string;
  apellido: string;
  telefono: string;
  email: string;
  direccion: string;
  documento: string;
  limiteCredito: number;
}

export function mapCliente(raw: RawCliente): MappedCliente {
  // Intentar separar nombre y apellido si el formato es "Apellido, Nombre"
  let nombre = raw.nombre.trim();
  let apellido = '';

  if (nombre.includes(',')) {
    const parts = nombre.split(',').map((s) => s.trim());
    apellido = parts[0] || '';
    nombre = parts[1] || parts[0] || '';
  } else if (nombre.includes(' ')) {
    const parts = nombre.split(' ');
    nombre = parts[0];
    apellido = parts.slice(1).join(' ');
  }

  return {
    nombre,
    apellido,
    telefono: raw.telefono.trim(),
    email: raw.email.trim(),
    direccion: raw.direccion.trim(),
    documento: '',
    limiteCredito: 0,
  };
}
