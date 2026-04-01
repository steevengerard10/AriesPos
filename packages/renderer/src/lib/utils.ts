export function cn(...classes: (string | undefined | null | false)[]): string {
  return classes.filter(Boolean).join(' ');
}

export function formatCurrency(amount: number, symbol = '$'): string {
  return `${symbol} ${amount.toLocaleString('es-AR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export function formatDate(dateStr: string): string {
  if (!dateStr) return '';
  const date = new Date(dateStr + (dateStr.includes('T') ? '' : 'T00:00:00'));
  return date.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

export function formatDateTime(dateStr: string): string {
  if (!dateStr) return '';
  return new Date(dateStr).toLocaleString('es-AR');
}

export function today(): string {
  return new Date().toISOString().split('T')[0];
}

export function weekAgo(): string {
  const d = new Date();
  d.setDate(d.getDate() - 7);
  return d.toISOString().split('T')[0];
}

export function monthStart(): string {
  const d = new Date();
  d.setDate(1);
  return d.toISOString().split('T')[0];
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
