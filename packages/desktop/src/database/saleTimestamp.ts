const ARGENTINA_TIME_ZONE = 'America/Argentina/Buenos_Aires';

export function getSaleTimestamp(date = new Date()): {
  fecha: string;
  hora: string;
  created_at: string;
} {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: ARGENTINA_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map(({ type, value }) => [type, value]));

  return {
    fecha: `${values.year}-${values.month}-${values.day}`,
    hora: `${values.hour}:${values.minute}:${values.second}`,
    created_at: date.toISOString(),
  };
}
