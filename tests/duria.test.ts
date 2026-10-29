import { describe, expect, it } from 'vitest';
import { declareCoverage, readDuriaExport } from '../src/duria/adapter.js';
import { DEFAULT_MAPPING } from '../src/duria/mapping.js';
import { parseXdt, parseXdtDate, xdtLine } from '../src/duria/xdt.js';
import { evaluateRule } from '../src/engine/evaluate.js';
import { confirmed, settings, testRule } from './fixtures.js';
import { syntheticBdt } from './synthetic-bdt.js';

describe('xDT-Parser', () => {
  it('liest Zeilen mit korrekter Länge und Umlauten (ISO 8859-15 via FK 9206=3)', () => {
    const r = parseXdt(syntheticBdt());
    expect(r.errors).toEqual([]);
    expect(r.encoding).toBe('iso-8859-15');
    expect(r.records.map((x) => x.satzart)).toEqual(['6100', '6200']);
    expect(r.records[1]!.fields.find((f) => f.fk === '6220')?.value).toContain('durchgeführt');
  });

  it('CP437 (FK 9206=2) wird korrekt dekodiert', () => {
    const buf = Buffer.concat([xdtLine('8000', '6310', 'cp437'), xdtLine('9206', '2', 'cp437'), xdtLine('6220', 'Übelkeit, Größe', 'cp437')]);
    expect(parseXdt(buf).records[0]!.fields[2]!.value).toBe('Übelkeit, Größe');
  });

  it('falsche Zeilenlänge wird gemeldet und nicht übernommen', () => {
    // Beide Zeilen haben 13 Byte inkl. CR LF; die zweite gibt 099 an.
    const r = parseXdt(Buffer.from('01380006310\r\n09930001234\r\n', 'latin1'));
    expect(r.errors).toEqual([expect.stringMatching(/Länge 99 angegeben, 13 tatsächlich/)]);
    expect(r.records[0]!.fields.map((f) => f.fk)).toEqual(['8000']);
  });

  it('Datum: TTMMJJJJ eindeutig, ungültige/mehrdeutige Werte werden nicht geraten', () => {
    expect(parseXdtDate('12112026')).toBe('2026-11-12');
    expect(parseXdtDate('20261112')).toBe('2026-11-12');
    expect(parseXdtDate('31022026')).toBeNull();
    expect(parseXdtDate('12112026', 'JJJJMMTT')).toBeNull();
  });
});

describe('DURIA-Adapter (nur lesen)', () => {
  const facts = { 'service.status': confirmed('performed'), 'documentation.duration_minutes': confirmed(15) };

  it('verwirft Identitätsfelder, übernimmt Leistungen, Diagnosen und Notizen mit Datum', () => {
    const s = readDuriaExport(syntheticBdt(), DEFAULT_MAPPING, 'bdt');
    expect(s.droppedIdentityFields).toBe(3);
    expect(JSON.stringify(s)).not.toMatch(/Mustermann|Erika|01011970/);
    expect(s.services).toEqual([expect.objectContaining({ code: 'TEST_SERVICE_10_MIN', date: '2026-11-12' })]);
    expect(s.diagnoses[0]).toMatchObject({ code: 'J06.9', certainty: 'G', date: '2026-11-12' });
    expect(s.notes).toHaveLength(2);
  });

  it('Warnung solange die Feldzuordnung nicht von DURIA bestätigt ist', () => {
    expect(readDuriaExport(syntheticBdt(), DEFAULT_MAPPING, 'bdt').warnings.join(' ')).toMatch(/nicht von DURIA bestätigt/);
  });

  it('mehrere Patienten in einem Export → gesperrt', () => {
    const s = readDuriaExport(syntheticBdt('99001', [xdtLine('8000', '6200'), xdtLine('3000', '99002')]), DEFAULT_MAPPING, 'bdt');
    expect(s.multiplePatients).toBe(true);
    expect(s.patientId).toBeNull();
  });

  it('CTX-05: nur gelesene Tage gelten als abgedeckt → Quartalsregel nicht prüfbar', () => {
    const s = readDuriaExport(syntheticBdt(), DEFAULT_MAPPING, 'bdt');
    const rule = testRule({
      procedure_codes: ['TEST_X'],
      required_context: [{ domain: 'billed_services', window: { unit: 'quarter', lookback_periods: 0, anchor: 'service_date' } }],
    });
    const base = { serviceDate: '2026-11-12', facts, billedServices: s.services, hzvStatus: 'not_enrolled' as const };
    expect(evaluateRule(rule, { ...base, coverage: s.coverage }, settings(), 'operational').outcome).toBe('not_verifiable');
    const declared = { ...base, coverage: declareCoverage('2026-10-01', '2026-12-31') };
    expect(evaluateRule(rule, declared, settings(), 'operational').outcome).toBe('candidate');
  });

  it('BILL-04 über den Adapter: bereits erfasste Leistung wird nicht erneut vorgeschlagen', () => {
    const s = readDuriaExport(syntheticBdt(), DEFAULT_MAPPING, 'bdt');
    const f = evaluateRule(testRule(), { serviceDate: '2026-11-12', facts, billedServices: s.services, coverage: s.coverage, hzvStatus: 'not_enrolled' }, settings(), 'operational');
    expect(f.outcome).toBe('already_billed');
  });
});
