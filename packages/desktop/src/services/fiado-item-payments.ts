import Database from 'better-sqlite3';

export interface FiadoItemSelection {
  venta_id: number;
  item_id: number;
  cantidad: number;
}

interface PendingFiadoItem extends FiadoItemSelection {
  producto_id: number | null;
  producto_nombre: string;
  cantidad: number;
  precio_unitario: number;
}

export function pagarItemsFiado(
  db: Database.Database,
  clienteId: number,
  ventaId: number,
  selections: FiadoItemSelection[],
  montoRecibido: number,
  metodo: string,
): { success: true; monto: number; montoProductos: number; varios: number; items: number } {
  const monto = Math.round(montoRecibido * 100) / 100;
  if (!Number.isFinite(monto) || monto <= 0) throw new Error('Ingresá un monto válido');
  if (!Number.isInteger(ventaId) || ventaId <= 0) throw new Error('Fiado inválido');
  if (!Array.isArray(selections)) throw new Error('Selección de productos inválida');

  const uniqueSelections = new Map<string, FiadoItemSelection>();
  for (const selection of selections) {
    if (!Number.isInteger(selection.venta_id) || selection.venta_id !== ventaId || !Number.isInteger(selection.item_id)
      || !Number.isFinite(selection.cantidad) || selection.cantidad <= 0) {
      throw new Error('Selección de productos inválida');
    }
    uniqueSelections.set(`${selection.venta_id}:${selection.item_id}`, selection);
  }
  if (uniqueSelections.size !== selections.length) throw new Error('Hay productos duplicados en la selección');

  const items: { item: PendingFiadoItem; selection: FiadoItemSelection }[] = [];
  let montoProductos = 0;
  let varios = 0;
  const fechaPago = (() => {
    const now = new Date();
    const two = (value: number) => String(value).padStart(2, '0');
    return `${now.getFullYear()}-${two(now.getMonth() + 1)}-${two(now.getDate())} ${two(now.getHours())}:${two(now.getMinutes())}:${two(now.getSeconds())}`;
  })();

  db.transaction(() => {
    const venta = db.prepare(`
      SELECT id, total, COALESCE(descuento, 0) as descuento, COALESCE(monto_pagado, 0) as monto_pagado
      FROM ventas
      WHERE id = ? AND cliente_id = ? AND es_fiado = 1 AND estado IN ('fiado', 'parcial')
    `).get(ventaId, clienteId) as { id: number; total: number; descuento: number; monto_pagado: number } | undefined;
    if (!venta) throw new Error('El fiado ya no está pendiente');

    const pendientes = db.prepare(`
      SELECT vi.cantidad,
        CASE WHEN vi.precio_cobrado IS NOT NULL THEN vi.precio_cobrado
          WHEN p.precio_venta > 0 THEN p.precio_venta ELSE vi.precio_unitario END as precio_unitario
      FROM venta_items vi
      LEFT JOIN productos p ON p.id = vi.producto_id
      WHERE vi.venta_id = ?
    `).all(ventaId) as { cantidad: number; precio_unitario: number }[];
    const totalPendiente = pendientes.reduce((sum, item) => sum + item.cantidad * item.precio_unitario, 0);
    const saldoPendiente = pendientes.length
      ? Math.max(0, totalPendiente - venta.descuento - venta.monto_pagado)
      : Math.max(0, venta.total - venta.monto_pagado);
    if (monto > saldoPendiente + 0.009) throw new Error('El monto supera el saldo pendiente del fiado');

    for (const selection of uniqueSelections.values()) {
      const item = db.prepare(`
        SELECT vi.id as item_id, vi.venta_id, vi.producto_id,
          COALESCE(p.nombre, 'Producto eliminado') as producto_nombre,
          vi.cantidad,
          CASE WHEN vi.precio_cobrado IS NOT NULL THEN vi.precio_cobrado
            WHEN p.precio_venta > 0 THEN p.precio_venta ELSE vi.precio_unitario END as precio_unitario
        FROM venta_items vi
        JOIN ventas v ON v.id = vi.venta_id
        LEFT JOIN productos p ON p.id = vi.producto_id
        WHERE vi.id = ? AND vi.venta_id = ? AND v.cliente_id = ?
          AND v.es_fiado = 1 AND v.estado IN ('fiado', 'parcial')
      `).get(selection.item_id, selection.venta_id, clienteId) as PendingFiadoItem | undefined;

      if (!item) throw new Error('Uno o más productos ya no están pendientes');
      if (selection.cantidad > item.cantidad + 0.000001) throw new Error('La cantidad seleccionada supera las unidades pendientes');
      items.push({ item, selection });
      montoProductos += Math.round(selection.cantidad * item.precio_unitario * 100) / 100;
    }

    if (montoProductos > monto + 0.009) throw new Error('El monto recibido no alcanza para las unidades seleccionadas');
    varios = Math.max(0, Math.round((monto - montoProductos) * 100) / 100);

    const sesion = db.prepare(`
      SELECT id FROM caja_sesiones WHERE fecha_cierre IS NULL ORDER BY id DESC LIMIT 1
    `).get() as { id: number } | undefined;

    const guardarPago = db.prepare(`
      INSERT INTO fiado_items_pagos (
        venta_id, venta_item_id, producto_id, producto_nombre, cantidad,
        precio_unitario, monto, metodo_pago, fecha
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    const actualizarItem = db.prepare(`
      UPDATE venta_items SET cantidad = ?, total = total * (? / cantidad)
      WHERE id = ? AND venta_id = ?
    `);
    const eliminarItem = db.prepare(`DELETE FROM venta_items WHERE id = ? AND venta_id = ?`);
    const ventasAfectadas = new Set<number>();

    for (const { item, selection } of items) {
      const cantidadRestante = Math.max(0, item.cantidad - selection.cantidad);
      const montoItem = Math.round(selection.cantidad * item.precio_unitario * 100) / 100;
      guardarPago.run(
        item.venta_id,
        item.item_id,
        item.producto_id,
        item.producto_nombre,
        selection.cantidad,
        item.precio_unitario,
        montoItem,
        metodo || 'efectivo',
        fechaPago,
      );
      if (cantidadRestante <= 0.000001) eliminarItem.run(item.item_id, item.venta_id);
      else actualizarItem.run(cantidadRestante, cantidadRestante, item.item_id, item.venta_id);
      ventasAfectadas.add(item.venta_id);
    }

    if (varios > 0) {
      guardarPago.run(ventaId, 0, null, 'Varios', 0, 0, varios, metodo || 'efectivo', fechaPago);
      db.prepare(`UPDATE ventas SET monto_pagado = COALESCE(monto_pagado, 0) + ? WHERE id = ?`).run(varios, ventaId);
      ventasAfectadas.add(ventaId);
    }

    for (const ventaId of ventasAfectadas) {
      const restante = (db.prepare(`SELECT COUNT(*) as cantidad FROM venta_items WHERE venta_id = ? AND cantidad > 0`).get(ventaId) as { cantidad: number }).cantidad;
      db.prepare(`UPDATE ventas SET estado = ? WHERE id = ?`).run(restante > 0 ? 'parcial' : 'pagado', ventaId);
    }

    if (sesion) {
      const descripcion = `Pago de fiado - Cliente #${clienteId} - ${[
        ...items.map(({ item, selection }) => `${item.producto_nombre} x${selection.cantidad}`),
        ...(varios > 0 ? [`Varios ${varios}`] : []),
      ].join(', ')}`;
      db.prepare(`
        INSERT INTO caja_movimientos (sesion_id, tipo, monto, descripcion, metodo_pago, fecha)
        VALUES (?, 'ingreso', ?, ?, ?, ?)
      `).run(sesion.id, monto, descripcion, metodo || 'efectivo', fechaPago);
    }
  })();

  return { success: true, monto, montoProductos, varios, items: items.length };
}