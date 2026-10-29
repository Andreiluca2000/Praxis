import { describe, expect, it } from 'vitest';
import chronicJson from '../data/billing/reviewed/chronic-dx.json';
import exampleJson from '../data/billing/rules.example.json';
import reviewedJson from '../data/billing/reviewed/hausarzt-welle1.json';
import { runFertig, type FertigInput } from '../src/core/fertig.js';
import type { BilledService, Facts, Kv, Rule, RulePackage } from '../src/domain/types.js';
import type { DocumentedDiagnosis, DuriaSnapshot } from '../src/duria/adapter.js';
import { concatBytes, xdtLine } from '../src/duria/xdt.js';
import { loadCatalogue, rulesFor } from '../src/engine/catalogue.js';
import { deriveChronicFacts, type ChronicList } from '../src/engine/chronic.js';
import { checkChronicCoding } from '../src/engine/dx-expectations.js';
import { evaluateRule } from '../src/engine/evaluate.js';
import { checkQuarter } from '../src/kvdt/quarter-check.js';
import { validateRulePackage } from '../src/validation/validate.js';
import { confirmed, input as evalInput, settings, testRule } from './fixtures.js';

/**
 * Welle 1: Versichertenpauschale 03000, Chroniker 03220/03221, DMP Diabetes Typ 2 (KV Nordrhein), R1 Diagnose ↔ Ziffer, Neupatient.
 * Synthetische Fälle. Ausgeliefert ist der Katalog seit 29.10.2026 vom Arzt freigegeben; der Zustand „nicht freigegeben“
 * wird im Test nachgebildet (Kopie mit Entwurfsstatus).
 */

const SHIPPED = loadCatalogue(reviewedJson, chronicJson);
const LIST = chronicJson as ChronicList;
const APPROVED_LIST: ChronicList = { ...LIST, review: { state: 'approved', reviewer: 'TEST', reviewed_at: '2026-10-30T09:00:00Z', rationale: 'Test' } };

/** Nachbildung der ärztlichen Freigabe (nur Test): aktiv, beide Prüfungen freigegeben, Quelle lokal nutzbar. */
const approve = (r: Rule): Rule => ({
  ...r, status: 'active',
  reviews: {
    billing: { state: 'approved', reviewer: 'TEST', reviewed_at: '2026-10-30T09:00:00Z', rationale: 'Test' },
    clinical: { state: 'approved', reviewer: 'TEST', reviewed_at: '2026-10-30T09:00:00Z', rationale: 'Test' },
  },
  sources: r.sources.map((s) => ({ ...s, license_status: 'permitted_for_local_use' })),
});
const APPROVED: RulePackage = { ...SHIPPED.reviewed!, rules: SHIPPED.reviewed!.rules.map(approve) };

/** Zustand vor der Freigabe (nur Test): Entwurf, Prüfungen offen, Quelle offen. */
const pend = { state: 'pending' as const, reviewer: null, reviewed_at: null, rationale: 'Test' };
const PENDING: RulePackage = {
  ...SHIPPED.reviewed!,
  rules: SHIPPED.reviewed!.rules.map((r) => ({ ...r, status: 'draft', reviews: { billing: pend, clinical: pend }, sources: r.sources.map((s) => ({ ...s, license_status: 'pending' })) })),
};
const PENDING_LIST: ChronicList = { ...LIST, review: pend };

const DATE = '2026-11-12';
const svc = (code: string, date: string): BilledService => ({ code, system: 'EBM', date, state: 'active', session: null, evidence: [{ ref: `s:${code}:${date}` }] });
const dx = (code: string, date: string | null, certainty = 'G'): DocumentedDiagnosis => ({ code, certainty, side: null, date, ref: `d:${code}:${date}` });

/** Verlauf: ein Kontakt (03000) mit gesichertem E11.9 je angegebenem Quartalstag. */
const visits = (...days: string[]) => ({ services: days.map((d) => svc('03000', d)), diagnoses: days.map((d) => dx('E11.9', d)) });
const THREE_QUARTERS = visits('2026-05-10', '2026-08-10', DATE);
const HISTORY = { from: '2026-01-01', to: DATE };

function snapshot(services: BilledService[], diagnoses: DocumentedDiagnosis[]): DuriaSnapshot {
  return { patientId: 'P-test', multiplePatients: false, services, diagnoses, notes: [], coverage: [], warnings: [], droppedIdentityFields: 0, vendorConfirmed: false };
}

const DOC_OK: Facts = { 'documentation.required_components_complete': confirmed(true) };

function fertig(over: Partial<FertigInput> & { data?: { services: BilledService[]; diagnoses: DocumentedDiagnosis[] } } = {}, kv: Kv | null = null, pkg = APPROVED) {
  const { data = THREE_QUARTERS, ...rest } = over;
  const input: FertigInput = {
    serviceDate: DATE, snapshot: snapshot(data.services, data.diagnoses), notes: [], confirmedFacts: DOC_OK,
    quarterExportConfirmed: true, hzvContractId: null, hzvStatus: 'not_enrolled', chronicList: APPROVED_LIST, history: HISTORY, ...rest,
  };
  return runFertig(input, settings({ region: { country: 'DE', bundesland: 'NRW', kv } }), pkg, 'operational');
}
const proposal = (r: ReturnType<typeof fertig>, code: string) => r.proposals.find((p) => p.finding?.codes.includes(code));

describe('Welle 1 – Katalog und Freigabe', () => {
  it('ausgelieferter Katalog ist gültig und vom Arzt freigegeben (alle Regeln aktiv, Liste freigegeben)', () => {
    expect(SHIPPED.errors).toEqual([]);
    expect(SHIPPED.reviewed?.content_kind).toBe('reviewed_catalogue');
    expect(SHIPPED.reviewed?.rules.map((r) => r.id)).toEqual(['EBM_03000_W1', 'EBM_03220_W1', 'EBM_03221_W1', 'KVNO_DMP_DM2_90325_W1']);
    expect(SHIPPED.reviewed?.rules.every((r) => r.status === 'active' && r.reviews.billing.state === 'approved' && r.reviews.clinical.state === 'approved' && r.reviews.billing.reviewer === 'Andree')).toBe(true);
    expect(SHIPPED.chronic?.review).toMatchObject({ state: 'approved', reviewer: 'Andree' });
    expect(validateRulePackage(SHIPPED.reviewed!).errors).toEqual([]);
  });

  it('ohne Freigabe: operativ keine Ziffer und kein R1-Hinweis', () => {
    const r = fertig({ chronicList: PENDING_LIST }, 'Nordrhein', PENDING);
    expect(r.proposals).toEqual([]);
  });

  it('freigegebene Kopie besteht die Schemaprüfung für aktive Regeln', () => {
    expect(validateRulePackage(APPROVED).errors).toEqual([]);
  });

  it('fehlerhafter Katalog wird verworfen; operativ bleibt das wirkungslose Beispiel', () => {
    const bad = loadCatalogue({ ...reviewedJson, content_kind: 'erfunden' }, { ...chronicJson, categories: [] });
    expect(bad.reviewed).toBeNull();
    expect(bad.chronic).toBeNull();
    expect(bad.errors).toHaveLength(2);
    const example = exampleJson as RulePackage;
    expect(rulesFor('operational', example, bad)).toBe(example);
    expect(rulesFor('simulation', example, SHIPPED)).toBe(example);
    expect(rulesFor('operational', example, SHIPPED)).toBe(SHIPPED.reviewed);
  });
});

describe('Chroniker-Fakten aus Diagnosen und Verlauf', () => {
  it('zählt Quartale mit Kontakt und derselben gesicherten Erkrankung', () => {
    const f = deriveChronicFacts({ serviceDate: DATE, ...THREE_QUARTERS, diagnoses: THREE_QUARTERS.diagnoses.map((d) => ({ ...d })), list: LIST, history: HISTORY });
    expect(f['diagnosis.chronic_confirmed']?.value).toBe(true);
    expect(f['history.chronic_contact_quarters']?.value).toBe(3);
    expect(f['history.personal_contact_quarters']?.value).toBe(3);
  });

  it('ohne bestätigten Verlauf: Kontinuität unbekannt', () => {
    const f = deriveChronicFacts({ serviceDate: DATE, ...THREE_QUARTERS, list: LIST, history: null });
    expect(f['history.chronic_contact_quarters']).toBeUndefined();
  });

  it('Verdachtsdiagnose (V) gilt nicht als gesichert', () => {
    const f = deriveChronicFacts({ serviceDate: DATE, services: [svc('03000', DATE)], diagnoses: [dx('E11.9', DATE, 'V')], list: LIST, history: HISTORY });
    expect(f['diagnosis.chronic_confirmed']?.value).toBe(false);
  });

  it('eine andere chronische Erkrankung in den Vorquartalen zählt nicht als „dieselbe“', () => {
    const data = { services: [svc('03000', '2026-05-10'), svc('03000', '2026-08-10'), svc('03000', DATE)], diagnoses: [dx('I10.00', '2026-05-10'), dx('I10.00', '2026-08-10'), dx('E11.9', DATE)] };
    const f = deriveChronicFacts({ serviceDate: DATE, ...data, list: LIST, history: HISTORY });
    expect(f['history.chronic_contact_quarters']?.value).toBe(1);
  });
});

describe('03220 Chroniker-Zuschlag', () => {
  it('ja: drei von vier Quartalen mit persönlichem Kontakt → Vorschlag 03220', () => {
    const p = proposal(fertig(), '03220');
    expect(p?.readiness).toBe('bereit');
    expect(p?.entries).toMatchObject([{ type: 'ziffer', system: 'EBM', code: '03220' }]);
  });

  it('nein: nur zwei Quartale → kein Vorschlag', () => {
    expect(proposal(fertig({ data: visits('2026-08-10', DATE) }), '03220')).toBeUndefined();
  });

  it('nicht prüfbar: ohne Vorquartale nie „bereit“', () => {
    const p = proposal(fertig({ history: null }), '03220');
    expect(p?.readiness).toBe('klaerung');
    expect(p?.entries).toEqual([]);
    expect(p?.detail).toContain('Vorquartale');
  });

  it('nicht prüfbar: HZV-Status unbekannt', () => {
    const p = proposal(fertig({ hzvStatus: 'unknown' }), '03220');
    expect(p?.readiness).toBe('klaerung');
    expect(p?.finding?.outcome).toBe('not_verifiable');
    expect(p?.detail).toContain('HZV');
  });

  it('nicht prüfbar: Pflichtinhalte (persönlicher Kontakt) nicht bestätigt', () => {
    expect(proposal(fertig({ confirmedFacts: {} }), '03220')?.readiness).toBe('klaerung');
  });

  it('ohne chronische Diagnose: kein Vorschlag und kein Rauschen', () => {
    const r = fertig({ data: { services: [svc('03000', DATE)], diagnoses: [dx('J06.9', DATE)] } });
    expect(r.proposals).toEqual([]);
  });

  it('Ausnahme: 03100 zwei Quartale zuvor wegen derselben Erkrankung', () => {
    const data = { services: [svc('03100', '2026-05-10'), svc('03000', DATE)], diagnoses: [dx('E11.9', '2026-05-10'), dx('E11.9', DATE)] };
    expect(proposal(fertig({ data }), '03220')?.readiness).toBe('bereit');
  });

  it('bereits erfasst: kein zweiter Vorschlag im Quartal', () => {
    const data = { ...THREE_QUARTERS, services: [...THREE_QUARTERS.services, svc('03220', '2026-10-05')] };
    expect(proposal(fertig({ data }), '03220')).toBeUndefined();
  });
});

describe('03221 Zuschlag zu 03220', () => {
  const WITH_03220 = { ...THREE_QUARTERS, services: [...THREE_QUARTERS.services, svc('03220', '2026-10-05')] };

  it('ja: 03220 erfasst und intensive Betreuung bestätigt → 03221 vorgeschlagen', () => {
    const confirmedFacts = { ...DOC_OK, 'documentation.intensive_care_confirmed': confirmed(true) };
    expect(proposal(fertig({ data: WITH_03220, confirmedFacts }), '03221')?.readiness).toBe('bereit');
  });

  it('nicht prüfbar: nur die allgemeine Bestätigung „Pflichtinhalte“ reicht für 03221 nicht', () => {
    const p = proposal(fertig({ data: WITH_03220 }), '03221');
    expect(p?.readiness).toBe('klaerung');
    expect(p?.entries).toEqual([]);
  });

  it('nein: ohne 03220 kein 03221', () => {
    expect(proposal(fertig(), '03221')).toBeUndefined();
  });
});

describe('DMP Diabetes Typ 2 – KV Nordrhein (90325)', () => {
  const dmp: Facts = { ...DOC_OK, 'dmp.practice_participation': confirmed(true), 'dmp.patient_enrolled': confirmed(true), 'dmp.documentation_transmitted': confirmed(true) };

  it('ja: Teilnahme, Einschreibung und Dokumentation bestätigt → 90325 als KV-Ziffer', () => {
    const p = proposal(fertig({ confirmedFacts: dmp }, 'Nordrhein'), '90325');
    expect(p?.readiness).toBe('bereit');
    expect(p?.entries).toMatchObject([{ system: 'KV', code: '90325' }]);
  });

  it('nicht prüfbar: Einschreibung unbekannt → Klärung, keine Übernahme', () => {
    const p = proposal(fertig({}, 'Nordrhein'), '90325');
    expect(p?.readiness).toBe('klaerung');
    expect(p?.entries).toEqual([]);
  });

  it('nein: andere KV oder schon dokumentiert im Quartal (Ausschluss, kein Konflikt)', () => {
    expect(proposal(fertig({ confirmedFacts: dmp }, 'Westfalen-Lippe'), '90325')).toBeUndefined();
    const data = { ...THREE_QUARTERS, services: [...THREE_QUARTERS.services, svc('90324', '2026-10-05')] };
    expect(proposal(fertig({ confirmedFacts: dmp, data }, 'Nordrhein'), '90325')).toBeUndefined();
  });

  it('HZV unbekannt sperrt die DMP-Ziffer nicht (KV-Vertrag, nicht EBM)', () => {
    expect(proposal(fertig({ confirmedFacts: dmp, hzvStatus: 'unknown' }, 'Nordrhein'), '90325')?.readiness).toBe('bereit');
  });
});

describe('R1 – Diagnose ↔ Ziffer', () => {
  const Q4 = { from: '2026-10-01', to: '2026-12-31' };

  it('Zuschlag ohne gesicherte chronische Diagnose', () => {
    const h = checkChronicCoding({ services: [svc('03220', DATE)], diagnoses: [{ code: 'J06.9', certainty: 'G', date: DATE, ref: 'x' }], list: LIST, quarter: Q4, undatedInQuarter: false, kv: null });
    expect(h.map((x) => x.kind)).toEqual(['zuschlag_ohne_diagnose']);
  });

  it('gesicherte chronische Diagnose ohne 03220; DMP nur mit KV Nordrhein', () => {
    const args = { services: [svc('03000', DATE)], diagnoses: [{ code: 'E11.9', certainty: 'G', date: DATE, ref: 'x' }], list: LIST, quarter: Q4, undatedInQuarter: false };
    expect(checkChronicCoding({ ...args, kv: null }).map((x) => x.kind)).toEqual(['chroniker_ohne_zuschlag']);
    expect(checkChronicCoding({ ...args, kv: 'Nordrhein' }).map((x) => x.kind)).toEqual(['chroniker_ohne_zuschlag', 'dmp_ohne_ziffer']);
  });

  it('alles passend: kein Hinweis', () => {
    const h = checkChronicCoding({
      services: [svc('03000', DATE), svc('03220', DATE), svc('90325', DATE)], diagnoses: [{ code: 'E11.9', certainty: 'G', date: DATE, ref: 'x' }],
      list: LIST, quarter: Q4, undatedInQuarter: false, kv: 'Nordrhein',
    });
    expect(h).toEqual([]);
  });

  it('Fertig: Hinweis mit freigegebener Liste, auch wenn die Ziffernregeln noch nicht freigegeben sind', () => {
    const r = fertig({}, null, PENDING);
    expect(r.proposals.map((p) => p.title)).toEqual(['Diagnose ↔ Ziffer: 03220']);
    expect(r.proposals[0]?.entries).toEqual([]);
  });

  it('Quartalsprüfung (KVDT): Hinweise je Fall, nie Fehler; ohne Freigabe keine', () => {
    const file = concatBytes([
      xdtLine('8000', 'con0'), xdtLine('9206', '3'),
      xdtLine('8000', '0101'), xdtLine('3000', 'P-a'), xdtLine('4101', '42026'),
      xdtLine('5000', '05102026'), xdtLine('5001', '03220'), xdtLine('6001', 'J06.9'), xdtLine('6003', 'G'),
      xdtLine('8000', '0101'), xdtLine('3000', 'P-b'), xdtLine('4101', '42026'),
      xdtLine('5000', '06102026'), xdtLine('5001', '03000'), xdtLine('6001', 'I10.90'), xdtLine('6003', 'G'),
      xdtLine('8000', 'con9'),
    ]);
    const noRules: RulePackage = { schema_version: '0.1.0', package_id: 'X', package_version: '1', content_kind: 'reviewed_catalogue', rules: [testRule({ procedure_codes: ['UNUSED'] })] };
    const r = checkQuarter(file, settings(), noRules, 'operational', null, null, [], APPROVED_LIST);
    const r1 = r.findings.filter((f) => f.kind === 'diagnose_ziffer');
    expect(r1.map((f) => `${f.patientToken}:${f.severity}`)).toEqual(['P-a:hinweis', 'P-b:hinweis']);
    expect(checkQuarter(file, settings(), noRules, 'operational', null, null, [], PENDING_LIST).findings.some((f) => f.kind === 'diagnose_ziffer')).toBe(false);
  });
});

describe('HZV-Status im Prüfmotor', () => {
  it('unbekannt oder HZV ohne Vertrag → EBM nicht prüfbar', () => {
    const ok = { 'service.status': confirmed('performed'), 'documentation.duration_minutes': confirmed(12) };
    expect(evaluateRule(testRule(), { ...evalInput(ok), hzvStatus: 'unknown' }, settings(), 'operational').outcome).toBe('not_verifiable');
    expect(evaluateRule(testRule(), { ...evalInput(ok), hzvStatus: 'enrolled' }, settings(), 'operational').outcome).toBe('not_verifiable');
    expect(evaluateRule(testRule(), { ...evalInput(ok), hzvStatus: 'not_enrolled' }, settings(), 'operational').outcome).toBe('candidate');
  });
});

describe('03000 Versichertenpauschale', () => {
  const FIRST = { services: [svc('03000', '2026-08-10')], diagnoses: [dx('J06.9', DATE)] };

  it('ja: erster Kontakt im Quartal, Vorquartal gelesen ohne 03100 → 03000', () => {
    const p = proposal(fertig({ data: FIRST }), '03000');
    expect(p?.readiness).toBe('bereit');
    expect(p?.entries).toMatchObject([{ code: '03000', system: 'EBM' }]);
  });

  it('nicht prüfbar: ohne Vorquartal (Folgequartal nach 03100) nie „bereit“', () => {
    const p = proposal(fertig({ data: FIRST, history: null }), '03000');
    expect(p?.readiness).toBe('klaerung');
    expect(p?.finding?.outcome).toBe('not_verifiable');
  });

  it('nein: 03030 im Quartal oder 03100 im Vorquartal → kein Vorschlag und keine Fehlermeldung', () => {
    const with03030 = { ...FIRST, services: [...FIRST.services, svc('03030', '2026-10-20')] };
    expect(fertig({ data: with03030 }).proposals).toEqual([]);
    const after03100 = { ...FIRST, services: [svc('03100', '2026-08-10')] };
    expect(fertig({ data: after03100 }).proposals).toEqual([]);
  });

  it('nein: 03000 schon im Quartal erfasst', () => {
    expect(proposal(fertig({ data: { ...FIRST, services: [svc('03000', '2026-10-05')] } }), '03000')).toBeUndefined();
  });

  it('KVDT: aktive Vorschlagsregeln erzeugen bei 03030-Fällen keinen falschen Fehler', () => {
    const file = concatBytes([
      xdtLine('8000', 'con0'), xdtLine('9206', '3'),
      xdtLine('8000', '0101'), xdtLine('3000', 'P-c'), xdtLine('4101', '42026'),
      xdtLine('5000', '05102026'), xdtLine('5001', '03030'), xdtLine('6001', 'J06.9'), xdtLine('6003', 'G'),
      xdtLine('8000', 'con9'),
    ]);
    const r = checkQuarter(file, settings(), APPROVED, 'operational', null, null, [], APPROVED_LIST);
    expect(r.bySeverity.fehler).toBe(0);
  });
});

describe('Rauschen und Fehlannahmen', () => {
  it('Laborziffern allein zählen nicht als Arzt-Patienten-Kontakt in einem Vorquartal', () => {
    const data = {
      services: [svc('32025', '2026-05-10'), svc('32025', '2026-08-10'), svc('03000', DATE)],
      diagnoses: [dx('E11.9', '2026-05-10'), dx('E11.9', '2026-08-10'), dx('E11.9', DATE)],
    };
    const f = deriveChronicFacts({ serviceDate: DATE, ...data, list: LIST, history: HISTORY });
    expect(f['history.chronic_contact_quarters']?.value).toBe(1);
    expect(proposal(fertig({ data }), '03220')).toBeUndefined();
  });

  it('Regeln freigegeben, Liste nicht: Chroniker-/DMP-Regeln ruhen, statt bei jedem Patienten „unvollständig“ zu melden', () => {
    const r = fertig({ chronicList: SHIPPED.chronic, data: { services: [svc('03000', DATE)], diagnoses: [dx('J06.9', DATE)] } }, 'Nordrhein');
    expect(r.proposals).toEqual([]);
  });

  it('R1 „Begründung fehlt“ bleibt, auch wenn die 03220-Regel „bereits erfasst“ meldet', () => {
    const r = fertig({ data: { services: [svc('03000', DATE), svc('03220', '2026-10-05')], diagnoses: [dx('J06.9', DATE)] } });
    expect(r.proposals.map((p) => p.detail)).toEqual([expect.stringContaining('03220 ohne gesicherte (G) chronische Diagnose')]);
  });

  it('kein R1-Hinweis zu 03220, wenn die 03220-Regel schon „nein“ gesagt hat', () => {
    const r = fertig({ data: visits('2026-08-10', DATE) });
    expect(r.proposals.some((p) => p.title.includes('03220'))).toBe(false);
  });
});

describe('Neupatient und erster Kontakt im Quartal (nur Information)', () => {
  it('früherer Kontakt → bekannt; sonst ohne Verlauf nicht prüfbar, mit Verlauf „kein Kontakt seit …“', () => {
    expect(fertig().patient.neupatient).toEqual({ status: 'bekannt', letzterKontakt: '2026-08-10' });
    const neu = { services: [svc('03000', DATE)], diagnoses: [] };
    expect(fertig({ data: neu, history: null }).patient.neupatient).toEqual({ status: 'nicht_pruefbar' });
    expect(fertig({ data: neu }).patient.neupatient).toEqual({ status: 'kein_frueherer_kontakt', seit: '2026-01-01' });
  });

  it('erster Kontakt im Quartal nur mit gelesenem Quartal', () => {
    const data = { services: [svc('03000', '2026-10-05')], diagnoses: [] };
    expect(fertig({ data }).patient.ersterKontaktImQuartal).toBe(false);
    expect(fertig({ data: { services: [], diagnoses: [] } }).patient.ersterKontaktImQuartal).toBe(true);
    expect(fertig({ data: { services: [], diagnoses: [] }, quarterExportConfirmed: false, history: null }).patient.ersterKontaktImQuartal).toBeNull();
  });
});

describe('Welle 1 – ausgelieferter, freigegebener Katalog in der Praxis', () => {
  const shipped = (over: Partial<FertigInput> = {}) => fertig({ chronicList: SHIPPED.chronic, hzvStatus: 'unknown', ...over }, 'Nordrhein', SHIPPED.reviewed!);

  it('HZV-Status unbekannt (DURIA liefert ihn nicht): 03220 nur „Klärung“, nie „bereit“', () => {
    const p = proposal(shipped(), '03220');
    expect(p?.readiness).toBe('klaerung');
    expect(JSON.stringify(p?.finding)).toContain('HZV');
  });

  it('ohne bestätigten Export der Vorquartale: 03220 nicht „bereit“', () => {
    const p = proposal(shipped({ hzvStatus: 'not_enrolled', history: null }), '03220');
    expect(p?.readiness).not.toBe('bereit');
  });

  it('mit Vorquartalen und bekanntem HZV-Status: 03220 „bereit“', () => {
    expect(proposal(shipped({ hzvStatus: 'not_enrolled' }), '03220')?.readiness).toBe('bereit');
  });
});
