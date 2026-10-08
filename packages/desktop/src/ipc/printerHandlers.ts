import { BrowserWindow, ipcMain } from 'electron';
import { imprimirTicket } from '../services/ticketPrinter';

export function registerPrinterHandlers(): void {
  ipcMain.handle('printer:list', async () => {
    const window = BrowserWindow.getAllWindows().find((candidate) => !candidate.isDestroyed());
    if (!window) return [];
    const printers = await window.webContents.getPrintersAsync();
    return printers.map((printer) => ({
      name: printer.name,
      displayName: printer.displayName,
      description: printer.description,
      isDefault: printer.isDefault,
      paperSize: (printer as typeof printer & { paperSize?: string; options?: Record<string, unknown> }).paperSize
        || String((printer as typeof printer & { options?: Record<string, unknown> }).options?.paperSize || ''),
    }));
  });

  ipcMain.handle('printer:imprimir-ticket', (_event, sale: Record<string, unknown>, config: Record<string, string>) =>
    imprimirTicket(sale, config));
}