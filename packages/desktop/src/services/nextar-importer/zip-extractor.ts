/**
 * zip-extractor.ts
 * Descomprime el backup .zip de Nextar y extrae los archivos .nx1 relevantes
 * a un directorio temporal.
 */

const AdmZip = require('adm-zip');
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';

export interface ExtractedFiles {
  tempDir: string;
  /** mapa baseName.toLowerCase() → ruta completa */
  files: Record<string, string>;
  cleanup: () => void;
}

const TARGET_FILES = new Set([
  'produto.nx1',
  'cliente.nx1',
  'tran.nx1',
  'stock.nx1',
  'categoria.nx1',
  'subcategoria.nx1',
  'unidade.nx1',
  'caixa.nx1',
  'usuario.nx1',
  'imagens.nx1',
  'inventario.nx1',
  'inventarioitens.nx1',
  'especie.nx1',
  'departamento.nx1',
  'marca.nx1',
  'credito.nx1',
  'recebiveis.nx1',
  'debito.nx1',
  'movest.nx1',
  'alteracaopreco.nx1',
  'alteracaoprecoitens.nx1',
  'prodfor.nx1',
]);

export function extractNextarBackup(zipPath: string): ExtractedFiles {
  if (!fs.existsSync(zipPath)) {
    throw new Error(`Archivo no encontrado: ${zipPath}`);
  }

  const tempDir = path.join(os.tmpdir(), `ariespos_nextar_${Date.now()}`);
  fs.mkdirSync(tempDir, { recursive: true });

  const zip = new AdmZip(zipPath);
  const entries = zip.getEntries() as { entryName: string; getData: () => Buffer }[];
  const files: Record<string, string> = {};

  for (const entry of entries) {
    const baseName = path.basename(entry.entryName).toLowerCase();
    if (TARGET_FILES.has(baseName)) {
      const destPath = path.join(tempDir, baseName);
      try {
        const data = entry.getData();
        fs.writeFileSync(destPath, data);
        files[baseName] = destPath;
      } catch {
        // Ignorar entradas que fallen al extraer
      }
    }
  }

  const cleanup = () => {
    try {
      fs.rmSync(tempDir, { recursive: true, force: true });
    } catch { /* ignorar */ }
  };

  return { tempDir, files, cleanup };
}

/** Busca el ZIP más reciente en un directorio dado */
export function findLatestZip(dirPath: string): string | null {
  if (!fs.existsSync(dirPath)) return null;
  const zips = fs.readdirSync(dirPath)
    .filter((f) => f.toLowerCase().endsWith('.zip'))
    .map((f) => ({ name: f, mtime: fs.statSync(path.join(dirPath, f)).mtime.getTime() }))
    .sort((a, b) => b.mtime - a.mtime);
  return zips.length > 0 ? path.join(dirPath, zips[0].name) : null;
}
