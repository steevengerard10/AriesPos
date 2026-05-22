/**
 * Zona horaria para formatear fechas/horas según configuración (`zona_horaria` en SQLite).
 * `auto` o vacío usa la zona detectada por el sistema (Intl).
 */
let tzConfigSnap: Record<string, string> = {};

export function setAppTimeZoneConfig(config: Record<string, string>): void {
  tzConfigSnap = config ? { ...config } : {};
}

export function getResolvedIanaTimezone(): string {
  const raw = (tzConfigSnap.zona_horaria || '').trim();
  const z = raw.toLowerCase();
  if (!raw || z === 'auto') {
    try {
      return Intl.DateTimeFormat().resolvedOptions().timeZone;
    } catch {
      return 'UTC';
    }
  }
  return raw;
}
