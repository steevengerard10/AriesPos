/**
 * fiados-excel-backup.ts
 * Genera y actualiza automáticamente un archivo Excel con todas las
 * ventas fiadas. Se dispara tras cada fiado nuevo o pago registrado.
 * El archivo se guarda en Documentos/ARIESPos/ para que persista aunque
 * la app se caiga.
 */

import path from 'path';
import fs from 'fs';
import { app } from 'electron';
import type Database from 'better-sqlite3';

const XLSX = require('xlsx') as typeof import('xlsx');

// ── Helpers ─────────────────────────────────────────────────────────────────

function getBackupDir(): string {
  const dir = path.join(app.getPath('documents'), 'ARIESPos');
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  return dir;
}

export function getFiadosExcelPath(): string {
  return path.join(getBackupDir(), 'fiados_backup.xlsx');
}

function fmt(n: number): string {
  return n.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// ── Tipos de filas ───────────────────────────────────────────────────────────

interface FilaResumen {
  Cliente: string;
  Teléfono: string;
  'Saldo pendiente ($)': string;
  'Última compra': string;
  'Cant. ventas pendientes': number;
}

interface FilaDetalle {
  Fecha: string;
  Hora: string;
  'N° venta': string;
  Cliente: string;
  Productos: string;
  'Total venta ($)': string;
  'Pagado ($)': string;
  'Saldo ($)': string;
  Estado: string;
}

// ── Generador principal ──────────────────────────────────────────────────────

export function exportFiadosToExcel(db: Database.Database): string {
  // ── 1. Resumen por cliente ────────────────────────────────────────────────
  const clientesConFiado = db.prepare(`
    SELECT c.id, c.nombre, COALESCE(c.apellido,'') as apellido, COALESCE(c.telefono,'') as telefono
    FROM clientes c
    WHERE EXISTS (
      SELECT 1 FROM ventas v WHERE v.cliente_id = c.id AND v.es_fiado = 1 AND v.estado NOT IN ('pagado')
    )
    ORDER BY c.nombre
  `).all() as { id: number; nombre: string; apellido: string; telefono: string }[];

  const filasResumen: FilaResumen[] = [];

  for (const c of clientesConFiado) {
    // Saldo revalorizado (misma lógica que getSaldoActual / getAll)
    const ventas = db.prepare(`
      SELECT v.id, v.total, COALESCE(v.descuento,0) as descuento, COALESCE(v.monto_pagado,0) as monto_pagado, v.fecha
      FROM ventas v
      WHERE v.cliente_id = ? AND v.es_fiado = 1 AND v.estado NOT IN ('pagado')
      ORDER BY v.fecha DESC
    `).all(c.id) as { id: number; total: number; descuento: number; monto_pagado: number; fecha: string }[];

    let saldo = 0;
    let ultimaFecha = '';
    for (const v of ventas) {
      if (!ultimaFecha && v.fecha) ultimaFecha = v.fecha;
      const items = db.prepare(`
        SELECT vi.cantidad,
               CASE WHEN p.precio_venta > 0 THEN p.precio_venta ELSE vi.precio_unitario END as precio
        FROM venta_items vi LEFT JOIN productos p ON p.id = vi.producto_id
        WHERE vi.venta_id = ?
      `).all(v.id) as { cantidad: number; precio: number }[];

      const subtotal = items.length > 0
        ? items.reduce((s, i) => s + i.precio * i.cantidad, 0) - v.descuento
        : v.total;
      saldo += Math.max(0, subtotal - v.monto_pagado);
    }

    filasResumen.push({
      Cliente: `${c.nombre} ${c.apellido}`.trim(),
      Teléfono: c.telefono,
      'Saldo pendiente ($)': fmt(saldo),
      'Última compra': ultimaFecha || '-',
      'Cant. ventas pendientes': ventas.length,
    });
  }

  // ── 2. Detalle de ventas fiadas (todas, no solo pendientes) ──────────────
  const ventasFiadas = db.prepare(`
    SELECT v.id, v.numero, v.fecha, v.hora, v.total, COALESCE(v.monto_pagado,0) as monto_pagado,
           COALESCE(v.descuento,0) as descuento, v.estado,
           c.nombre as cliente_nombre, COALESCE(c.apellido,'') as cliente_apellido
    FROM ventas v
    LEFT JOIN clientes c ON v.cliente_id = c.id
    WHERE v.es_fiado = 1
    ORDER BY v.fecha DESC, v.hora DESC
    LIMIT 2000
  `).all() as {
    id: number; numero: string; fecha: string; hora: string;
    total: number; monto_pagado: number; descuento: number; estado: string;
    cliente_nombre: string; cliente_apellido: string;
  }[];

  const filasDetalle: FilaDetalle[] = [];

  for (const v of ventasFiadas) {
    // Obtener productos de la venta
    const items = db.prepare(`
      SELECT COALESCE(p.nombre, 'Producto eliminado') as nombre, vi.cantidad,
             CASE WHEN p.precio_venta > 0 THEN p.precio_venta ELSE vi.precio_unitario END as precio
      FROM venta_items vi LEFT JOIN productos p ON p.id = vi.producto_id
      WHERE vi.venta_id = ?
    `).all(v.id) as { nombre: string; cantidad: number; precio: number }[];

    const productosStr = items.length > 0
      ? items.map((i) => `${i.nombre} x${i.cantidad % 1 === 0 ? i.cantidad : i.cantidad.toFixed(2)}`).join(' | ')
      : '-';

    // Saldo revalorizado de esta venta
    const subtotalActual = items.length > 0
      ? items.reduce((s, i) => s + i.precio * i.cantidad, 0) - v.descuento
      : v.total;
    const saldoVenta = Math.max(0, subtotalActual - v.monto_pagado);

    const estadoLabel: Record<string, string> = {
      fiado: 'Pendiente',
      parcial: 'Pago parcial',
      pagado: 'Pagado',
      completada: 'Completado',
    };

    filasDetalle.push({
      Fecha: v.fecha,
      Hora: v.hora ? v.hora.slice(0, 5) : '',
      'N° venta': v.numero,
      Cliente: `${v.cliente_nombre || ''} ${v.cliente_apellido || ''}`.trim(),
      Productos: productosStr,
      'Total venta ($)': fmt(subtotalActual),
      'Pagado ($)': fmt(v.monto_pagado),
      'Saldo ($)': fmt(saldoVenta),
      Estado: estadoLabel[v.estado] ?? v.estado,
    });
  }

  // ── 3. Armar libro Excel ──────────────────────────────────────────────────
  const wb = XLSX.utils.book_new();

  const wsResumen = XLSX.utils.json_to_sheet(filasResumen);
  // Ancho de columnas
  wsResumen['!cols'] = [{ wch: 28 }, { wch: 16 }, { wch: 20 }, { wch: 14 }, { wch: 24 }];
  XLSX.utils.book_append_sheet(wb, wsResumen, 'Resumen por cliente');

  const wsDetalle = XLSX.utils.json_to_sheet(filasDetalle);
  wsDetalle['!cols'] = [
    { wch: 12 }, { wch: 7 }, { wch: 14 }, { wch: 24 },
    { wch: 60 }, { wch: 16 }, { wch: 14 }, { wch: 14 }, { wch: 14 },
  ];
  XLSX.utils.book_append_sheet(wb, wsDetalle, 'Detalle de ventas');

  // Hoja de auditoría: fecha de última actualización
  const wsInfo = XLSX.utils.aoa_to_sheet([
    ['ARIESPos — Backup de fiados'],
    ['Última actualización', new Date().toLocaleString('es-AR')],
    ['Total clientes con deuda', filasResumen.length],
    ['Total ventas fiadas', filasDetalle.length],
  ]);
  XLSX.utils.book_append_sheet(wb, wsInfo, 'Info');

  // ── 4. Escribir archivo ───────────────────────────────────────────────────
  const outPath = getFiadosExcelPath();
  XLSX.writeFile(wb, outPath);
  console.log(`[FiadosBackup] Excel actualizado: ${outPath}`);
  return outPath;
}
