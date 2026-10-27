import { describe, expect, it } from 'vitest';
import { analyse, check, propose } from '../src/forms/advisor.js';
import { valuesOf } from '../src/forms/build.js';
import { getForm } from '../src/forms/catalog.js';
import { needOf, needReason } from '../src/forms/gaps.js';
import type { FieldState, FormId } from '../src/forms/types.js';

// Synthetische Beschreibungen.
function gaps(formId: FormId, text: string) {
  const a = analyse(text);
  const p = propose(formId, text, a.facts, new Date('2026-10-28T10:00:00'));
  const values = valuesOf(p.fields);
  const states = Object.fromEntries(p.fields.map((f) => [f.fieldId, f.state])) as Record<string, FieldState>;
  const issues = check(formId, values, a.facts);
  const form = getForm(formId);
  return (ids: string[]) => needOf(form, ids, values, states, issues);
}

describe('Offene Angaben: fehlt (!), Entscheidung (?), empfohlen', () => {
  it('Muster 6 ohne Anlass: Diagnose fehlt, Zweck ist zu entscheiden, Befund empfohlen', () => {
    const need = gaps('muster-06', 'Überweisung Kardiologie');
    expect(need(['diagnose'])).toBe('fehlt');
    expect(need(['auftragsleistung', 'konsil', 'mitbehandlung'])).toBe('entscheidung');
    expect(need(['befund'])).toBe('empfohlen');
    expect(need(['auftrag'])).toBe('fehlt'); // nichts gefunden, die Regel erwartet einen Auftrag
    expect(need(['ueberweisung_an'])).toBeNull();
    expect(need(['op_datum'])).toBeNull(); // bleibt bewusst leer
    expect(need(['stempel'])).toBeNull();
  });

  it('Muster 6 mit Anlass und Konsil: nichts fehlt außer dem Freiwilligen', () => {
    const need = gaps('muster-06', 'Überweisung Kardiologie zum Konsil wegen Belastungsdyspnoe');
    expect(need(['diagnose'])).toBeNull();
    expect(need(['auftragsleistung', 'konsil', 'mitbehandlung'])).toBeNull();
    expect(need(['auftrag'])).toBeNull();
  });

  it('Muster 4: fehlender Behandlungstag bei genehmigungspflichtiger Fahrt ist eine Pflichtangabe', () => {
    const need = gaps('muster-04', 'Fahrt zur Dialyse, Taxi, Hin- und Rückfahrt');
    expect(need(['behandlung_vom'])).toBe('fehlt');
    expect(need(['behandlungsstaette'])).toBe('fehlt');
  });

  it('Begründung nennt, wo gesucht wurde', () => {
    expect(needReason('fehlt', true)).toBe('Nicht gefunden – weder in der Beschreibung noch in der Kartei. Bitte ergänzen.');
    expect(needReason('fehlt', false)).toContain('kein Patient geöffnet');
    expect(needReason('entscheidung', true)).toContain('selbst entscheiden');
  });
});
