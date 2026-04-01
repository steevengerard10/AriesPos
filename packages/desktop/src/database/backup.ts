import * as fs from 'fs';
import * as path from 'path';
import { app } from 'electron';
import { getDbPath } from './db';

const MAX_BACKUPS = 30;

export function getBackupsDir(): string {
  return path.join(app.getPath('userData'), 'backups');
}

export async function autoBackup(): Promise<string> {
  const backupsDir = getBackupsDir();
  if (!fs.existsSync(backupsDir)) {
    fs.mkdirSync(backupsDir, { recursive: true });
  }

  const dbPath = getDbPath();
  if (!fs.existsSync(dbPath)) return '';

  const now = new Date();
  const timestamp = now
    .toISOString()
    .replace(/T/, '_')
    .replace(/:/g, '-')
    .replace(/\..+/, '');

  const backupFilename = `ariespos_${timestamp}.db`;
  const backupPath = path.join(backupsDir, backupFilename);

  fs.copyFileSync(dbPath, backupPath);
  console.log(`[Backup] Auto-backup creado: ${backupFilename}`);
  return backupPath;
}

export async function manualBackup(targetDir: string): Promise<string> {
  const dbPath = getDbPath();
  if (!fs.existsSync(dbPath)) throw new Error('Base de datos no encontrada');

  const now = new Date();
  const timestamp = now
    .toISOString()
    .replace(/T/, '_')
    .replace(/:/g, '-')
    .replace(/\..+/, '');

  const backupFilename = `ariespos_backup_${timestamp}.db`;
  const backupPath = path.join(targetDir, backupFilename);

  fs.copyFileSync(dbPath, backupPath);
  console.log(`[Backup] Backup manual creado: ${backupPath}`);
  return backupPath;
}

export async function scheduleBackupCleanup(): Promise<void> {
  const backupsDir = getBackupsDir();
  if (!fs.existsSync(backupsDir)) return;

  const files = fs
    .readdirSync(backupsDir)
    .filter((f) => f.endsWith('.db'))
    .map((f) => ({
      name: f,
      path: path.join(backupsDir, f),
      mtime: fs.statSync(path.join(backupsDir, f)).mtime.getTime(),
    }))
    .sort((a, b) => b.mtime - a.mtime);

  if (files.length > MAX_BACKUPS) {
    const toDelete = files.slice(MAX_BACKUPS);
    for (const file of toDelete) {
      fs.unlinkSync(file.path);
      console.log(`[Backup] Backup antiguo eliminado: ${file.name}`);
    }
  }
}

export function listBackups(): { filename: string; path: string; size: number; created_at: string }[] {
  const backupsDir = getBackupsDir();
  if (!fs.existsSync(backupsDir)) return [];

  return fs
    .readdirSync(backupsDir)
    .filter((f) => f.endsWith('.db'))
    .map((f) => {
      const filePath = path.join(backupsDir, f);
      const stat = fs.statSync(filePath);
      return {
        filename: f,
        path: filePath,
        size: stat.size,
        created_at: stat.mtime.toISOString(),
      };
    })
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
}

export async function restoreBackup(backupPath: string): Promise<void> {
  const dbPath = getDbPath();
  if (!fs.existsSync(backupPath)) throw new Error('Archivo de backup no encontrado');

  // Crear backup del estado actual antes de restaurar
  await autoBackup();

  fs.copyFileSync(backupPath, dbPath);
  console.log(`[Backup] Base de datos restaurada desde: ${backupPath}`);
}
