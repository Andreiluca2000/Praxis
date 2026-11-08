import type { IsoDate } from '../domain/types.js';

/**
 * Erinnerung „Tagesabschluss jetzt prüfen?“ (nur solange das Programm offen ist, kein Windows-Dienst).
 * Fällig ab der eingestellten Uhrzeit, einmal am Tag; „Später“ verschiebt um SNOOZE_MIN Minuten, „Heute nicht“ bis morgen.
 */
export const SNOOZE_MIN = 30;

export interface ReminderState {
  /** Tag, an dem „Prüfen“ oder „Heute nicht“ gewählt wurde. */
  doneDay?: IsoDate | undefined;
  /** „Später“: nicht vor diesem Zeitpunkt (ms seit 1970). */
  snoozeUntil?: number | undefined;
}

export const localIsoDay = (d: Date): IsoDate =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

/** „HH:MM“ → Minuten seit Mitternacht; ungültig → null. */
export function parseTime(t: string | null | undefined): number | null {
  const m = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(t ?? '');
  return m ? Number(m[1]) * 60 + Number(m[2]) : null;
}

export function reminderDue(now: Date, setting: string | null | undefined, state: ReminderState): boolean {
  const at = parseTime(setting);
  if (at === null) return false;
  if (state.doneDay === localIsoDay(now)) return false;
  if (state.snoozeUntil !== undefined && now.getTime() < state.snoozeUntil) return false;
  return now.getHours() * 60 + now.getMinutes() >= at;
}

export function snooze(now: Date): ReminderState {
  return { snoozeUntil: now.getTime() + SNOOZE_MIN * 60_000 };
}

export function doneToday(now: Date): ReminderState {
  return { doneDay: localIsoDay(now) };
}
