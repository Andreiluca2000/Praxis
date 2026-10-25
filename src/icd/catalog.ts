import type { ClamlClass, KodesRow } from './parse.js';

/**
 * ICD-10-GM-Katalog (abgeleitet aus den amtlichen BfArM-Dateien). Suche: ./search.ts.
 * Enthält nur amtliche Inhalte; keine Diagnosefindung aus Symptomen.
 */

export interface IcdEntry {
  code: string;
  display: string;
  title: string;
  terminal: boolean;
  /** §295 (ambulant): P primär, O nur Stern, Z nur Ausrufezeichen, V nicht zur Verschlüsselung. */
  p295: 'P' | 'O' | 'Z' | 'V';
  sex: '9' | 'M' | 'W';
  ageLow: string;
  ageHigh: string;
  ifsg: boolean;
  inclusions: string[];
  exclusions: string[];
  /** Spezifischere Codes (nur bei nicht-endständigen Codes). */
  children: string[];
}

export interface IcdCatalog {
  format: 1;
  dataset: 'ICD-10-GM';
  version: string;
  validFrom: string;
  validTo: string;
  source: { claml: string; clamlSha256: string; metadata: string; metadataSha256: string; corrigenda: string[] };
  importedAt: string;
  importer: string;
  entries: IcdEntry[];
}

/** Abgeleitete Codes (Modifikatoren) erben Exklusiva von ihrer ClaML-Basisklasse. */
function clamlFor(code: string, classes: Map<string, ClamlClass>): ClamlClass | undefined {
  return classes.get(code) ?? classes.get(code.slice(0, -1)) ?? classes.get(code.slice(0, -1).replace(/\.$/, ''));
}

/** Übergeordneter Code: J20.9 → J20, C88.00 → C88.0. */
export function parentCode(code: string): string | null {
  if (code.length <= 3) return null;
  return code.slice(0, -1).replace(/\.$/, '');
}

export function buildEntries(rows: KodesRow[], classes: Map<string, ClamlClass>): IcdEntry[] {
  const byParent = new Map<string, string[]>();
  for (const r of rows) {
    const p = parentCode(r.code);
    if (p) byParent.set(p, [...(byParent.get(p) ?? []), r.code]);
  }
  return rows.map((r) => {
    const own = classes.get(r.code);
    return {
      code: r.code, display: r.display, title: r.title, terminal: r.terminal,
      p295: r.p295 as IcdEntry['p295'], sex: r.sex as IcdEntry['sex'], ageLow: r.ageLow, ageHigh: r.ageHigh, ifsg: r.ifsg === 'J',
      inclusions: own?.inclusions ?? [],
      exclusions: (own ?? clamlFor(r.code, classes))?.exclusions ?? [],
      children: r.terminal ? [] : (byParent.get(r.code) ?? []),
    };
  });
}

/** Hinweise zur Verwendbarkeit in der ambulanten Abrechnung (§295) – keine Diagnoseaussage. */
export function usageNotes(e: IcdEntry): string[] {
  const notes: string[] = [];
  if (!e.terminal) {
    notes.push(e.p295 === 'P' ? 'Nicht endständig – laut §295 dennoch verwendbar; genauere Kodes prüfen.' : 'Nicht endständig – bitte einen spezifischeren Kode wählen.');
  }
  if (e.p295 === 'V') notes.push('Nach §295 nicht zur Verschlüsselung zugelassen.');
  if (e.p295 === 'O') notes.push('Nach §295 nur als Sternschlüsselnummer (*) zugelassen.');
  if (e.p295 === 'Z') notes.push('Nach §295 nur als Ausrufezeichenschlüsselnummer (!) zugelassen.');
  if (e.sex === 'M') notes.push('Geschlechtsbezug: männlich.');
  if (e.sex === 'W') notes.push('Geschlechtsbezug: weiblich.');
  if (e.ageLow !== '9999' || e.ageHigh !== '9999') notes.push(`Altersbezug: ${e.ageLow === '9999' ? '–' : e.ageLow} bis ${e.ageHigh === '9999' ? '–' : e.ageHigh}.`);
  if (e.ifsg) notes.push('Meldepflicht nach IfSG beachten.');
  return notes;
}
