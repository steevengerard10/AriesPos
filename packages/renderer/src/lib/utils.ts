import { getResolvedIanaTimezone } from './dateTz';

export function cn(...classes: (string | undefined | null | false)[]): string {
  return classes.filter(Boolean).join(' ');
}

function parseFlexibleLocalDate(dateStr: string): Date {
  if (!dateStr) return new Date(NaN);
  const s = String(dateStr).trim();
  if (s.includes('T')) return new Date(s);
  if (/^\d{4}-\d{2}-\d{2}\s+\d/.test(s)) {
    return new Date(s.replace(' ', 'T'));
  }
  const dOnly = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
  if (dOnly) {
    const y = parseInt(dOnly[1], 10);
    const m = parseInt(dOnly[2], 10);
    const d = parseInt(dOnly[3], 10);
    return new Date(Date.UTC(y, m - 1, d, 12, 0, 0));
  }
  return new Date(s);
}

export function formatCurrency(amount: number, symbol = '$'): string {
  const safe = typeof amount === 'number' && isFinite(amount) ? amount : 0;
  return `${symbol} ${safe.toLocaleString('es-AR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export function formatDate(dateStr: string): string {
  if (!dateStr) return '';
  const date = parseFlexibleLocalDate(dateStr);
  if (Number.isNaN(date.getTime())) return '';
  const tz = getResolvedIanaTimezone();
  return date.toLocaleDateString('es-AR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    timeZone: tz,
  });
}

export function formatDateTime(dateStr: string): string {
  if (!dateStr) return '';
  const date = parseFlexibleLocalDate(dateStr);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleString('es-AR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    timeZone: getResolvedIanaTimezone(),
  });
}

/** Hora actual (relojes en cabeceras) según zona configurada */
export function formatNowTime(dt: Date = new Date()): string {
  return dt.toLocaleTimeString('es-AR', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    timeZone: getResolvedIanaTimezone(),
  });
}

export function formatNowTimeShort(dt: Date = new Date()): string {
  return dt.toLocaleTimeString('es-AR', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: getResolvedIanaTimezone(),
  });
}

/** Fecha larga tipo “sábado, 9 de mayo de 2026” */
export function formatLocaleDateFull(dt: Date = new Date()): string {
  return dt.toLocaleDateString('es-AR', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    timeZone: getResolvedIanaTimezone(),
  });
}

/** Solo día corto con mes abreviado (dashboard) */
export function formatDayShort(dateStr: string): string {
  if (!dateStr) return '';
  const date = parseFlexibleLocalDate(dateStr.includes('T') ? dateStr : `${dateStr}T12:00:00`);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString('es-AR', {
    day: '2-digit',
    month: 'short',
    timeZone: getResolvedIanaTimezone(),
  });
}

/** Hora HH:mm desde fecha ISO completa */
export function formatTimeHm(isoOrDbDatetime: string): string {
  if (!isoOrDbDatetime) return '';
  const date = parseFlexibleLocalDate(isoOrDbDatetime);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleTimeString('es-AR', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: getResolvedIanaTimezone(),
  });
}

export function toLocalDateISO(date: Date = new Date()): string {
  const tz = getResolvedIanaTimezone();
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: tz,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);
  const map = Object.fromEntries(parts.filter((p) => p.type !== 'literal').map((p) => [p.type, p.value]));
  const year = map.year ?? date.getFullYear();
  const month = map.month ?? String(date.getMonth() + 1).padStart(2, '0');
  const day = map.day ?? String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function today(): string {
  return toLocalDateISO(new Date());
}

export function weekAgo(): string {
  const d = new Date();
  d.setDate(d.getDate() - 7);
  return toLocalDateISO(d);
}

export function monthStart(): string {
  const d = new Date();
  d.setDate(1);
  return toLocalDateISO(d);
}

export function downloadCSV(content: string, filename: string): void {
  const blob = new Blob(['\ufeff' + content], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function downloadJSON(data: unknown, filename: string): void {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function generateTicketHTML(venta: Record<string, unknown>, items: Record<string, unknown>[], config: Record<string, string>): string {
  const symbol = config.simbolo_moneda || '$';
  const negocio = config.nombre_negocio || 'Mi Negocio';
  const direccion = config.direccion || '';
  const tel = config.telefono || '';
  
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; font-family: monospace; }
    body { width: ${config.formato_ticket === '58mm' ? '58mm' : '80mm'}; font-size: 10pt; }
    .center { text-align: center; }
    .title { font-size: 12pt; font-weight: bold; }
    hr { border: none; border-top: 1px dashed #000; margin: 4px 0; }
    table { width: 100%; border-collapse: collapse; }
    td { padding: 1px 2px; font-size: 9pt; }
    .right { text-align: right; }
    .bold { font-weight: bold; }
    .total { font-size: 11pt; font-weight: bold; }
  </style>
</head>
<body>
  <div class="center">
    <div class="title">${negocio}</div>
    ${direccion ? `<div>${direccion}</div>` : ''}
    ${tel ? `<div>Tel: ${tel}</div>` : ''}
  </div>
  <hr>
  <div>Nro: ${venta.numero}</div>
  <div>Fecha: ${venta.fecha} ${venta.hora}</div>
  ${venta.cliente_nombre ? `<div>Cliente: ${venta.cliente_nombre}</div>` : ''}
  <hr>
  <table>
    <tr><td><b>Producto</b></td><td class="right"><b>Cant</b></td><td class="right"><b>Total</b></td></tr>
    ${items.map(i => `
      <tr>
        <td>${i.producto_nombre}</td>
        <td class="right">${i.cantidad}</td>
        <td class="right">${symbol}${Number(i.total).toFixed(2)}</td>
      </tr>
    `).join('')}
  </table>
  <hr>
  ${Number(venta.descuento) > 0 ? `<div class="right">Descuento: -${symbol}${Number(venta.descuento).toFixed(2)}</div>` : ''}
  <div class="right total">TOTAL: ${symbol}${Number(venta.total).toFixed(2)}</div>
  <div class="right">Pago: ${venta.metodo_pago}</div>
  <hr>
  <div class="center">¡Gracias por su compra!</div>
  <div class="center">Powered by ARIESPos</div>
</body>
</html>`;
}
