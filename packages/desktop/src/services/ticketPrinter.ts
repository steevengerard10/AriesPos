import { BrowserWindow } from 'electron';

type TicketConfig = Record<string, string>;
type TicketRecord = Record<string, unknown>;

const escapeHtml = (value: unknown): string => String(value ?? '')
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&#39;');

const money = (value: unknown, symbol: string): string => `${symbol}${(Number(value) || 0).toLocaleString('es-AR', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})}`;

export function generateTicketHTML(venta: TicketRecord, config: TicketConfig): { html: string; pageSize: { width: number; height: number } | 'A4' } {
  const items = Array.isArray(venta.items) ? venta.items as TicketRecord[] : [];
  const format = config.ticket_ancho || config.formato_ticket || '80';
  const widthMm = format === '58' || format === '58mm' ? 58 : format === 'A4' ? 210 : 80;
  const isA4 = format === 'A4';
  const symbol = config.simbolo_moneda || '$';
  const negocio = config.ticket_nombre_negocio || config.nombre_negocio || 'Mi Negocio';
  const direccion = config.ticket_direccion ?? config.direccion ?? '';
  const telefono = config.ticket_telefono ?? config.telefono ?? '';
  const mensajeCabecera = config.ticket_mensaje_cabecera || '';
  const mensajePie = config.ticket_mensaje_pie || config.ticket_mensaje || 'Gracias por su compra';
  const showDate = config.ticket_mostrar_fecha !== 'false';
  const showNumber = config.ticket_mostrar_numero !== 'false';
  const showSeller = config.ticket_mostrar_vendedor !== 'false';
  const showCuit = config.ticket_mostrar_cuit === 'true';
  const logo = /^data:image\/(?:png|jpeg);base64,[A-Za-z0-9+/]+={0,2}$/.test(config.logo_negocio || '')
    ? config.logo_negocio
    : '';
  const date = showDate ? `<div>Fecha: ${escapeHtml(venta.fecha)} ${escapeHtml(venta.hora)}</div>` : '';
  const number = showNumber ? `<div>Ticket: ${escapeHtml(venta.numero)}</div>` : '';
  const seller = showSeller && venta.vendedor_nombre ? `<div>Vendedor: ${escapeHtml(venta.vendedor_nombre)}</div>` : '';
  const cuit = showCuit && config.cuit ? `<div>CUIT: ${escapeHtml(config.cuit)}</div>` : '';
  const subtotal = Number(venta.subtotal) || items.reduce((sum, item) => sum + (Number(item.precio_unitario) || 0) * (Number(item.cantidad) || 0), 0);
  const descuento = Number(venta.descuento) || 0;
  const recargo = Number(venta.recargo) || 0;
  const total = Number(venta.total) || 0;
  const rows = items.map((item) => {
    const name = escapeHtml(item.producto_nombre || item.nombre || 'Producto');
    const quantity = Number(item.cantidad) || 0;
    const unitPrice = Number(item.precio_unitario) || 0;
    const lineTotal = Number(item.total) || quantity * unitPrice;
    return `<tr><td class="product">${name}<small>${money(unitPrice, symbol)} c/u</small></td><td class="qty">${quantity}</td><td class="price">${money(lineTotal, symbol)}</td></tr>`;
  }).join('');
  const pageSize = isA4
    ? 'A4'
    : { width: widthMm * 1000, height: Math.max(140_000, 105_000 + items.length * 18_000) };

  const html = `<!doctype html><html><head><meta charset="utf-8"><style>
    @page { size: ${isA4 ? 'A4' : `${widthMm}mm auto`}; margin: ${isA4 ? '14mm' : '2mm'}; }
    * { box-sizing: border-box; }
    body { width: ${isA4 ? '100%' : `${widthMm - 4}mm`}; margin: 0 auto; color: #111; font-family: ${isA4 ? 'Arial, sans-serif' : 'monospace'}; font-size: ${isA4 ? '11pt' : '9pt'}; }
    .center { text-align: center; }
    .business { font-size: ${isA4 ? '20pt' : '12pt'}; font-weight: 700; }
    .logo { max-width: ${isA4 ? '36mm' : '24mm'}; max-height: ${isA4 ? '24mm' : '16mm'}; object-fit: contain; margin: 0 auto 3mm; }
    .message { margin: 2mm 0; white-space: pre-wrap; }
    .rule { border-top: 1px dashed #222; margin: 3mm 0; }
    table { width: 100%; border-collapse: collapse; }
    th, td { padding: ${isA4 ? '2.5mm' : '1mm'} 1mm; }
    th { border-bottom: 1px solid #444; text-align: left; }
    .product { width: 60%; overflow-wrap: anywhere; }
    .product small { display:block; color:#444; font-size:0.85em; }
    .qty { text-align: right; white-space: nowrap; }
    .price { text-align: right; white-space: nowrap; }
    .sum { display:flex; justify-content:space-between; margin: 1.5mm 0; }
    .total { font-size: ${isA4 ? '18pt' : '13pt'}; font-weight: 800; border-top: 1px solid #222; padding-top: 2mm; }
    .footer { text-align:center; margin-top: 5mm; white-space: pre-wrap; }
    .cut-space { height: ${isA4 ? '0' : '14mm'}; }
    @media print { .cut-space { page-break-after: always; } }
  </style></head><body>
    <header class="center">
      ${logo ? `<img class="logo" src="${logo}" alt="Logo">` : ''}
      <div class="business">${escapeHtml(negocio)}</div>
      ${direccion ? `<div>${escapeHtml(direccion)}</div>` : ''}
      ${telefono ? `<div>Tel: ${escapeHtml(telefono)}</div>` : ''}
      ${cuit}
      ${mensajeCabecera ? `<div class="message">${escapeHtml(mensajeCabecera)}</div>` : ''}
    </header>
    <div class="rule"></div>
    ${number}${date}${seller}
    ${venta.cliente_nombre ? `<div>Cliente: ${escapeHtml(venta.cliente_nombre)}</div>` : ''}
    <div class="rule"></div>
    <table><thead><tr><th>Producto</th><th class="qty">Cant.</th><th class="price">Total</th></tr></thead><tbody>${rows}</tbody></table>
    <div class="rule"></div>
    <div class="sum"><span>Subtotal</span><span>${money(subtotal, symbol)}</span></div>
    ${descuento > 0 ? `<div class="sum"><span>Descuento</span><span>-${money(descuento, symbol)}</span></div>` : ''}
    ${recargo > 0 ? `<div class="sum"><span>Recargo</span><span>+${money(recargo, symbol)}</span></div>` : ''}
    <div class="sum total"><span>TOTAL</span><span>${money(total, symbol)}</span></div>
    <div class="sum"><span>Método de pago</span><span>${escapeHtml(venta.metodo_pago || '')}</span></div>
    <div class="footer">${escapeHtml(mensajePie)}</div>
    <div class="cut-space"></div>
  </body></html>`;
  return { html, pageSize };
}

export async function imprimirTicket(venta: TicketRecord, config: TicketConfig): Promise<{ success: true } | { success: false; error: string }> {
  const printerName = config.ticket_impresora;
  if (!printerName) return { success: false, error: 'Configurá una impresora de tickets' };
  const { html, pageSize } = generateTicketHTML(venta, config);
  const printWindow = new BrowserWindow({
    show: false,
    width: 600,
    height: 900,
    webPreferences: { sandbox: true, contextIsolation: true },
  });

  try {
    await printWindow.loadURL('about:blank');
    await printWindow.webContents.executeJavaScript(
      `document.open(); document.write(${JSON.stringify(html)}); document.close();`,
    );
    await printWindow.webContents.executeJavaScript(
      `Promise.all(Array.from(document.images, (image) => image.decode().catch(() => undefined)))`,
    );
    await new Promise<void>((resolve, reject) => {
      printWindow.webContents.print({
        silent: true,
        deviceName: printerName,
        printBackground: true,
        margins: { marginType: 'none' },
        pageSize,
      }, (success, failureReason) => success ? resolve() : reject(new Error(failureReason || 'Falló la impresión')));
    });
    return { success: true };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Falló la impresión' };
  } finally {
    if (!printWindow.isDestroyed()) printWindow.close();
  }
}