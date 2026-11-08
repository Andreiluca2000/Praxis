import { describe, expect, it } from 'vitest';
import { doneToday, parseTime, reminderDue, snooze } from '../src/kvdt/day-reminder.js';

const at = (h: number, m: number, day = 8) => new Date(2026, 10, day, h, m);

describe('Erinnerung Tagesabschluss', () => {
  it('aus ohne Einstellung oder mit ungültiger Uhrzeit', () => {
    expect(reminderDue(at(19, 0), null, {})).toBe(false);
    expect(reminderDue(at(19, 0), '25:00', {})).toBe(false);
    expect(parseTime('18:00')).toBe(1080);
    expect(parseTime('8:00')).toBeNull();
  });

  it('fällig ab der Uhrzeit, nicht davor', () => {
    expect(reminderDue(at(17, 59), '18:00', {})).toBe(false);
    expect(reminderDue(at(18, 0), '18:00', {})).toBe(true);
    expect(reminderDue(at(21, 30), '18:00', {})).toBe(true);
  });

  it('„Später“ 30 Minuten, „Prüfen“/„Heute nicht“ bis morgen', () => {
    const s = snooze(at(18, 5));
    expect(reminderDue(at(18, 20), '18:00', s)).toBe(false);
    expect(reminderDue(at(18, 35), '18:00', s)).toBe(true);
    const d = doneToday(at(18, 5));
    expect(reminderDue(at(22, 0), '18:00', d)).toBe(false);
    expect(reminderDue(at(18, 0, 9), '18:00', d)).toBe(true);
  });
});
