import type { IsoDate } from './types.js';

const ISO = /^(\d{4})-(\d{2})-(\d{2})$/;

/** Prüft ein Kalenderdatum streng (keine Zeitzone, kein 31.02.). */
export function isIsoDate(value: unknown): value is IsoDate {
  if (typeof value !== 'string') return false;
  const m = ISO.exec(value);
  if (!m) return false;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const dt = new Date(Date.UTC(y, mo - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === mo - 1 && dt.getUTCDate() === d;
}

function parts(date: IsoDate): [number, number, number] {
  if (!isIsoDate(date)) throw new Error(`Ungültiges Datum: ${String(date)}`);
  const [y, m, d] = date.split('-').map(Number) as [number, number, number];
  return [y, m, d];
}

function fmt(dt: Date): IsoDate {
  return dt.toISOString().slice(0, 10);
}

export function addDays(date: IsoDate, days: number): IsoDate {
  const [y, m, d] = parts(date);
  return fmt(new Date(Date.UTC(y, m - 1, d + days)));
}

/** Kalenderquartal, das `date` enthält, verschoben um `back` Quartale zurück. */
export function quarterStart(date: IsoDate, back = 0): IsoDate {
  const [y, m] = parts(date);
  const q = Math.floor((m - 1) / 3) - back;
  return fmt(new Date(Date.UTC(y, q * 3, 1)));
}

export function quarterEnd(date: IsoDate): IsoDate {
  const [y, m] = parts(date);
  const q = Math.floor((m - 1) / 3);
  return fmt(new Date(Date.UTC(y, q * 3 + 3, 0)));
}

export function yearStart(date: IsoDate, back = 0): IsoDate {
  const [y] = parts(date);
  return `${String(y - back).padStart(4, '0')}-01-01`;
}

export function yearEnd(date: IsoDate): IsoDate {
  const [y] = parts(date);
  return `${String(y).padStart(4, '0')}-12-31`;
}

/** Lexikografischer Vergleich ist für validierte ISO-Daten korrekt. */
export function inRange(date: IsoDate, from: IsoDate, to: IsoDate | null): boolean {
  return date >= from && (to === null || date <= to);
}
