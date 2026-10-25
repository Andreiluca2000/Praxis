import { existsSync, readFileSync } from 'node:fs';
import { beforeAll, describe, expect, it } from 'vitest';
import { usageNotes, type IcdCatalog } from '../src/icd/catalog.js';
import { parseClaml, parseKodes } from '../src/icd/parse.js';
import { IcdIndex, normalize } from '../src/icd/search.js';
import { applyMetadataPatches, reconcile } from '../src/icd/verify.js';

const CATALOG = new URL('../data/icd/catalog-2026.json', import.meta.url);
const hasCatalog = existsSync(CATALOG);
let idx: IcdIndex;
beforeAll(() => { if (hasCatalog) idx = new IcdIndex(JSON.parse(readFileSync(CATALOG, 'utf8')) as IcdCatalog); });

describe.skipIf(!hasCatalog)('ICD-10-GM 2026 – ACCEPTANCE.md ICD-01…10 (amtlicher Katalog)', () => {
  it('Umfang laut Manifest', () => {
    expect(idx.size).toBe(16905);
    expect(idx.catalog.entries.filter((e) => e.terminal)).toHaveLength(14370);
  });

  it('ICD-01: Code und amtliche Bezeichnung, Ausgabe sichtbar', () => {
    const e = idx.get('J06.9')!;
    expect(e.title).toBe('Akute Infektion der oberen Atemwege, nicht näher bezeichnet');
    expect(idx.catalog.version).toBe('2026');
    expect(e.inclusions).toContain('Grippaler Infekt');
  });

  it('ICD-02: nicht existierender Code → kein Ergebnis, nichts erfunden', () => {
    expect(idx.get('J99.99')).toBeNull();
    expect(idx.get('XYZ')).toBeNull();
  });

  it('ICD-03: Kategorie mit Untercodes ist nicht endständig, Untercodes sichtbar', () => {
    const j20 = idx.get('J20')!;
    expect(j20.terminal).toBe(false);
    expect(j20.children).toContain('J20.9');
    expect(usageNotes(j20).join(' ')).toMatch(/Nicht endständig/);
    expect(idx.get('J20.-')?.code).toBe('J20');
  });

  it('ICD-04: Umlaut, Groß-/Kleinschreibung, Leerzeichen – Anzeige bleibt amtlich', () => {
    const a = idx.search('  akute   BRONCHITIS ');
    expect(a[0]?.entry.code.startsWith('J20')).toBe(true);
    const u = idx.search('übelkeit');
    const u2 = idx.search('uebelkeit');
    expect(u.map((h) => h.entry.code)).toEqual(u2.map((h) => h.entry.code));
    expect(u.length).toBeGreaterThan(0);
    expect(u.some((h) => /Übelkeit/.test(h.matchedText))).toBe(true);
    expect(normalize('Größe')).toBe('groesse');
  });

  it('ICD-05: Treffer über Inklusivum ist als solcher gekennzeichnet', () => {
    const hit = idx.search('grippaler infekt').find((h) => h.entry.code === 'J06.9')!;
    expect(hit.matchedIn).toBe('inklusivum');
    expect(hit.matchedText).toBe('Grippaler Infekt');
  });

  it('ICD-06: Katalog setzt keine Diagnosesicherheit (kein automatisches G)', () => {
    expect(Object.keys(idx.get('J20.9')!)).not.toContain('certainty');
  });

  it('ICD-07: Gültigkeit nur für 2026', () => {
    expect(idx.coversDate('2026-11-12')).toBe(true);
    expect(idx.coversDate('2025-12-31')).toBe(false);
    expect(idx.coversDate('2027-01-01')).toBe(false);
  });

  it('ICD-08: Alphabetisches Verzeichnis nicht enthalten → nur Titel/Inklusiva, keine erfundenen Synonyme', () => {
    expect(idx.search('Erkältung').every((h) => h.matchedIn !== 'code')).toBe(true);
  });

  it('Modifikator-Kodes, Stern/Ausrufezeichen-Regeln, Corrigenda', () => {
    expect(idx.get('C88.00')?.title).toMatch(/Ohne Angabe einer kompletten Remission/);
    expect(['O', 'Z', 'P', 'V']).toContain(idx.get('U99.0')?.p295 ?? 'P');
    expect(idx.get('U10.90')?.ageHigh).toBe('j018');
    expect(idx.get('E66.05')?.ageHigh).toBe('j018');
    expect(idx.catalog.source.corrigenda[0]).toBe('BFARM_ICD10GM_2026_CORRIGENDA_20260128');
  });

  it('Reihenfolge: Kategorie, dann „nicht näher bezeichnet“, dann nach Kode', () => {
    const codes = idx.search('akute bronchitis').map((h) => h.entry.code);
    expect(codes.slice(0, 3)).toEqual(['J20', 'J20.9', 'J20.0']);
  });

  it('Code-Suche mit Präfix', () => {
    const hits = idx.search('j20');
    expect(hits[0]?.entry.code).toBe('J20');
    expect(hits.every((h) => h.entry.code.startsWith('J20'))).toBe(true);
  });
});

describe('ICD-10: Import verweigert fehlerhafte Daten (Quarantäne)', () => {
  const row = (code: string, extra = '') => `4;T;X;10;J20;${code};${code};${code.replace('.', '')};Titel;T3;T4;;P;P;1;2;3;4;5;9;9;9999;9999;9;N;J;N;N${extra}`;

  it('falsche Spaltenzahl → Abbruch', () => {
    expect(() => parseKodes(row('J20.9', ';zuviel'))).toThrow(/Spalten/);
  });
  it('ClaML mit DTD/Entitäten oder falscher Version → Abbruch', () => {
    expect(() => parseClaml('<!DOCTYPE x><ClaML><Title version="2026"/></ClaML>', '2026')).toThrow(/DTD/);
    expect(() => parseClaml('<ClaML><Title name="x" version="2025"/></ClaML>', '2026')).toThrow(/Version/);
  });
  it('Korrektur mit unerwartetem alten Wert → Abbruch', () => {
    const rows = parseKodes(row('J20.9'));
    expect(() => applyMetadataPatches(rows, [{ code: 'J20.9', column_one_based: 23, expected_old: 'j017', new: 'j018', expected_matches: 1 }])).toThrow(/alter Wert/);
    expect(() => applyMetadataPatches(rows, [{ code: 'J99.9', column_one_based: 23, expected_old: '9999', new: 'x', expected_matches: 1 }])).toThrow(/Treffer/);
  });
  it('Abgleich: doppelter Code und fehlende Kategorie werden gemeldet', () => {
    const rows = parseKodes(`${row('J20.9')}\n${row('J20.9')}`);
    const classes = new Map([['J21.0', { kind: 'category', modified: false, inclusions: [], exclusions: [] }]]);
    const errs = reconcile(rows, classes);
    expect(errs.some((e) => /doppelt/.test(e))).toBe(true);
    expect(errs.some((e) => /J21\.0 fehlt/.test(e))).toBe(true);
  });
});
