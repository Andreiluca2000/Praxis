import { describe, expect, it } from 'vitest';
import type { BilledService, Facts } from '../src/domain/types.js';
import { applyToProposals, evaluateOnServices, type ProposalLike } from '../src/rules/evaluate.js';
import {
  activate, activeRules, contentErrors, EMPTY_FILE, parseRuleFile, retire, ruleState, saveDraft,
  type Author, type PracticeRuleContent, type PracticeRuleType,
} from '../src/rules/model.js';
import { detectConflicts, simulate } from '../src/rules/review.js';
import { REG } from './pair-registry.js';

const ARZT: Author = { kuerzel: 'AL', role: 'arzt' };
const MFA: Author = { kuerzel: 'MF', role: 'mfa' };
const T = '2026-10-28T10:00:00Z';
const base = (over: Partial<PracticeRuleContent> = {}): PracticeRuleContent => ({
  type: 'erinnerung', title: 'Gesprächsdauer bei 03230', system: 'EBM', codes: ['03230'],
  text: 'Gesprächsdauer in Minuten notieren.', priority: 'wichtig', validFrom: '2026-10-01', ...over,
});
const svc = (code: string, date = '2026-11-12', session: string | null = '1000'): BilledService =>
  ({ code, system: 'EBM', date, state: 'active', session, evidence: [{ ref: `TEST:${code}` }] });
const proposal = (code: string, readiness: ProposalLike['readiness'] = 'bereit'): ProposalLike => ({
  kind: 'ziffer', readiness, entries: [{ type: 'ziffer', code, system: 'EBM', date: '2026-11-12' }],
});
function activeFile(content: PracticeRuleContent) {
  const { file, ruleId } = saveDraft(EMPTY_FILE, null, content, ARZT, T);
  return activate(file, ruleId, 1, ARZT, 'Test', T);
}

describe('Praxisregeln: Datei, Fassungen, Rechte', () => {
  it('Entwurf → Aktivieren → neue Fassung → Aktivieren archiviert die alte; nichts wird überschrieben', () => {
    const { file: f1, ruleId } = saveDraft(EMPTY_FILE, null, base(), ARZT, T);
    expect(ruleState(f1.rules[0]!)).toBe('entwurf');
    const f2 = activate(f1, ruleId, 1, ARZT, 'erste Fassung', T);
    const { file: f3 } = saveDraft(f2, ruleId, base({ text: 'Neu: mind. 10 Minuten.' }), MFA, T);
    expect(f3.rules[0]!.versions.map((v) => `${v.version}:${v.status}`)).toEqual(['1:aktiv', '2:entwurf']);
    const f4 = activate(f3, ruleId, 2, ARZT, 'Mindestdauer ergänzt', T);
    expect(f4.rules[0]!.versions.map((v) => `${v.version}:${v.status}`)).toEqual(['1:archiv', '2:aktiv']);
    expect(f4.rules[0]!.versions[0]!.content.text).toBe('Gesprächsdauer in Minuten notieren.');
    expect(f1.rules[0]!.versions).toHaveLength(1); // unveränderlich: alte Objekte bleiben gleich
    expect(parseRuleFile(JSON.parse(JSON.stringify(f4)))).toEqual(f4);
  });

  it('nur Ärzte aktivieren, Grund ist Pflicht; Abschalten archiviert', () => {
    const { file, ruleId } = saveDraft(EMPTY_FILE, null, base(), MFA, T);
    expect(() => activate(file, ruleId, 1, MFA, 'x', T)).toThrow(/Nur ein Arzt/);
    expect(() => activate(file, ruleId, 1, ARZT, '  ', T)).toThrow(/Änderungsgrund/);
    const on = activate(file, ruleId, 1, ARZT, 'ok', T);
    expect(ruleState(retire(on, ruleId, ARZT).rules[0]!)).toBe('archiv');
    expect(() => retire(on, ruleId, MFA)).toThrow();
  });

  it('gilt erst ab „Gültig ab“', () => {
    const f = activeFile(base({ validFrom: '2026-11-15' }));
    expect(activeRules(f, '2026-11-12')).toEqual([]);
    expect(activeRules(f, '2026-11-15')).toHaveLength(1);
  });

  it('streng beim Laden: fehlerhafte Datei → keine Praxisregel (fail-closed)', () => {
    const good = activeFile(base());
    expect(parseRuleFile(null)).toEqual(EMPTY_FILE);
    expect('error' in parseRuleFile({ schema_version: '2.0.0', rules: [] })).toBe(true);
    const twoActive = JSON.parse(JSON.stringify(good));
    twoActive.rules[0].versions.push({ ...twoActive.rules[0].versions[0], version: 2 });
    expect(parseRuleFile(twoActive)).toEqual({ error: expect.stringMatching(/mehr als eine aktive/) });
    const noReason = JSON.parse(JSON.stringify(good));
    delete noReason.rules[0].versions[0].reason;
    expect('error' in parseRuleFile(noReason)).toBe(true);
    const unknownField = JSON.parse(JSON.stringify(good));
    unknownField.rules[0].versions[0].content.erlaubt = true;
    expect(parseRuleFile(unknownField)).toEqual({ error: expect.stringMatching(/Unbekanntes Feld/) });
  });

  it('Inhalt wird geprüft (Art, Ziffern, Zusatzangaben passend zur Art)', () => {
    expect(contentErrors(base())).toEqual([]);
    expect(contentErrors(base({ type: 'kombination' }))).toEqual(expect.arrayContaining([expect.stringMatching(/Partnerziffern/)]));
    expect(contentErrors(base({ type: 'pflicht' }))).toEqual(expect.arrayContaining([expect.stringMatching(/welche Angabe/)]));
    expect(contentErrors(base({ codes: ['03 230'] })).length).toBeGreaterThan(0);
    expect(contentErrors({ ...base(), type: 'freigeben' }).length).toBeGreaterThan(0); // es gibt keine „lockernde“ Art
  });
});

describe('Praxisregeln: Auswertung', () => {
  it('Erinnerung, fehlende Uhrzeit und Hausregel Kombination auf erfassten Leistungen', () => {
    const rules = [
      ...activeRules(activeFile(base()), '2026-11-12'),
      ...activeRules(activeFile(base({ type: 'pflicht', title: 'Hausbesuch mit Uhrzeit', codes: ['01410'], requirement: 'uhrzeit', text: 'Uhrzeit erfassen.' })), '2026-11-12'),
      ...activeRules(activeFile(base({ type: 'kombination', title: '03230 nicht mit 35100', codes: ['03230'], partnerCodes: ['35100'], scope: 'calendar_day', text: 'Praxisintern nicht zusammen.' })), '2026-11-12'),
    ];
    const f = evaluateOnServices(rules, [svc('03230'), svc('01410', '2026-11-12', null), svc('35100')], { behandlungsfallComplete: true });
    expect(f.map((x) => `${x.type}:${x.codes.join('+')}`).sort()).toEqual(['erinnerung:03230', 'kombination:03230+35100', 'pflicht:01410']);
    expect(evaluateOnServices(rules, [svc('01410', '2026-11-12', '0815')], { behandlungsfallComplete: true })).toEqual([]);
  });

  it('GARANTIE: Praxisregeln heben einen Vorschlag nie an und fügen keine Einträge hinzu', () => {
    const types: PracticeRuleType[] = ['erinnerung', 'pflicht', 'kombination', 'zurueck'];
    const facts: Facts[] = [{}, { 'documentation.duration_minutes': { value: 20, verification: 'confirmed', evidence: [] } }];
    const rank = { info: 0, klaerung: 1, bereit: 2 } as const;
    for (const type of types) {
      const content = base({
        type, ...(type === 'kombination' ? { partnerCodes: ['35100'], scope: 'calendar_day' as const } : {}),
        ...(type === 'pflicht' ? { requirement: 'dauer' as const } : {}),
      });
      const rules = activeRules(activeFile(content), '2026-11-12');
      for (const readiness of ['bereit', 'klaerung', 'info'] as const) {
        for (const fact of facts) {
          const before = { ...proposal('03230', readiness), entries: readiness === 'bereit' ? proposal('03230').entries : [] };
          const [after] = applyToProposals(rules, [before], { facts: fact, services: [svc('35100')] });
          expect(rank[after!.readiness]).toBeLessThanOrEqual(rank[readiness]);
          expect(after!.entries.length).toBeLessThanOrEqual(before.entries.length);
        }
      }
    }
  });

  it('„Vorschlag zurückhalten“ → nur Hinweis; Pflichtangabe Dauer → Klärung bis bestätigt', () => {
    const hold = activeRules(activeFile(base({ type: 'zurueck', title: '01435 nur nach Rücksprache', codes: ['01435'], text: 'Rücksprache.' })), '2026-11-12');
    const [p] = applyToProposals(hold, [proposal('01435')], { facts: {}, services: [] });
    expect(p).toMatchObject({ readiness: 'info', entries: [] });
    const need = activeRules(activeFile(base({ type: 'pflicht', requirement: 'dauer' })), '2026-11-12');
    expect(applyToProposals(need, [proposal('03230')], { facts: {}, services: [] })[0]!.readiness).toBe('klaerung');
    const ok = applyToProposals(need, [proposal('03230')], { facts: { 'documentation.duration_minutes': { value: 15, verification: 'confirmed', evidence: [] } }, services: [] })[0]!;
    expect(ok.readiness).toBe('bereit');
    expect(ok.entries).toHaveLength(1);
  });
});

describe('Praxisregeln: Widersprüche und Simulation', () => {
  it('gleicher Auslöser, Erinnerung + Zurückhalten, Dopplung mit EBM-Ausschluss', () => {
    const f = activeFile(base());
    expect(detectConflicts(f, null, base({ title: 'Zweite Erinnerung' })).map((c) => c.kind)).toEqual(['same_trigger']);
    expect(detectConflicts(f, null, base({ type: 'zurueck', title: 'halten' })).map((c) => c.kind)).toEqual(['remind_and_hold']);
    const komb = base({ type: 'kombination', title: 'Haus', codes: ['03100'], partnerCodes: ['03360'], scope: 'calendar_day' });
    expect(detectConflicts(EMPTY_FILE, null, komb, { pairs: REG }).map((c) => c.kind)).toEqual(['official_duplicate']);
  });

  it('Simulation zählt Fälle und neue Treffer gegenüber der vorigen Fassung', () => {
    const cases = [
      { index: 0, patientToken: 'P-a', services: [svc('03230')] },
      { index: 1, patientToken: 'P-b', services: [svc('03230'), svc('35100')] },
      { index: 2, patientToken: 'P-c', services: [svc('03000')] },
    ];
    const r = simulate(base({ codes: ['03230', '03000'] }), cases, base());
    expect(r).toMatchObject({ cases: 3, hits: 3, newHits: 1 });
    expect(r.examples.find((e) => e.index === 2)?.isNew).toBe(true);
  });
});

describe('Praxisregeln in der KVDT-Quartalsprüfung', async () => {
  const { checkQuarter } = await import('../src/kvdt/quarter-check.js');
  const { concatBytes, xdtLine } = await import('../src/duria/xdt.js');
  const { settings } = await import('./fixtures.js');
  it('erscheinen als Hinweis, nie als Fehler – auch im operativen Modus', () => {
    const data = concatBytes([
      xdtLine('8000', 'con0'), xdtLine('9206', '3'), xdtLine('8000', '0101'), xdtLine('3000', 'P-test'), xdtLine('4101', '42026'),
      xdtLine('5000', '12112026'), xdtLine('5001', '03230'), xdtLine('6001', 'F32.1'), xdtLine('6003', 'G'), xdtLine('8000', 'con9'),
    ]);
    const rules = activeRules(activeFile(base()), '2026-11-12');
    const pkg = { schema_version: '0.1.0' as const, package_id: 'X', package_version: '1', content_kind: 'reviewed_catalogue' as const, rules: [] };
    const r = checkQuarter(data, settings(), pkg, 'operational', null, null, rules);
    expect(r.findings.filter((f) => f.kind === 'praxisregel').map((f) => f.severity)).toEqual(['hinweis']);
    expect(r.bySeverity.fehler).toBe(0);
  });
});
