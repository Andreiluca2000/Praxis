import type { IsoDate } from '../domain/types.js';

/**
 * Praxisregeln: eigene Regeln der Praxis ÜBER EBM/GOÄ. Es gibt nur Arten, die erinnern, Angaben verlangen oder
 * Vorschläge zurückhalten – keine Art kann einen Ausschluss aufheben, eine Höchstzahl erhöhen oder etwas freigeben.
 * Gespeichert praxisweit als praxisregeln.json (nur Regeln und Verlauf, keine Patientendaten).
 */

export type PracticeRuleType = 'erinnerung' | 'pflicht' | 'kombination' | 'zurueck';
export type Requirement = 'uhrzeit' | 'dauer' | 'pflichtinhalte';
export type Priority = 'wichtig' | 'hinweis';
export type VersionStatus = 'entwurf' | 'aktiv' | 'archiv';

export interface PracticeRuleContent {
  type: PracticeRuleType;
  title: string;
  system: 'EBM' | 'GOAE';
  codes: string[];
  text: string;
  priority: Priority;
  validFrom: IsoDate;
  /** Nur „kombination“: Partnerziffern und Zeitraum. */
  partnerCodes?: string[];
  scope?: 'calendar_day' | 'behandlungsfall';
  /** Nur „pflicht“: welche Angabe vorliegen muss. */
  requirement?: Requirement;
}

export interface RuleVersion {
  version: number;
  status: VersionStatus;
  content: PracticeRuleContent;
  createdBy: string;
  createdAt: string;
  activatedBy?: string;
  activatedAt?: string;
  /** Änderungsgrund bei der Aktivierung (Pflicht). */
  reason?: string;
}

export interface PracticeRule { id: string; versions: RuleVersion[] }
export interface PracticeRuleFile { schema_version: '1.0.0'; rules: PracticeRule[] }

export const EMPTY_FILE: PracticeRuleFile = { schema_version: '1.0.0', rules: [] };
export const TYPE_LABEL: Record<PracticeRuleType, string> = {
  erinnerung: 'Erinnerung', pflicht: 'Pflichtangabe', kombination: 'Hausregel Kombination', zurueck: 'Vorschlag zurückhalten',
};
export const REQUIREMENT_LABEL: Record<Requirement, string> = {
  uhrzeit: 'Uhrzeit der Leistung', dauer: 'Dauer in Minuten (bestätigt)', pflichtinhalte: 'Pflichtinhalte dokumentiert (bestätigt)',
};

const CODE = /^[0-9A-Z]{1,6}[a-z]?$/;
const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const isDate = (v: unknown): v is IsoDate => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v);
const codeList = (v: unknown) => Array.isArray(v) && v.length > 0 && v.length <= 30 && v.every((c) => typeof c === 'string' && CODE.test(c));

/** Fehler im Inhalt einer Regel (leer = gültig). Wird beim Laden und vor dem Speichern geprüft. */
export function contentErrors(c: unknown): string[] {
  if (!isObj(c)) return ['Regel fehlt.'];
  const e: string[] = [];
  if (!['erinnerung', 'pflicht', 'kombination', 'zurueck'].includes(String(c.type))) e.push('Unbekannte Art der Regel.');
  if (typeof c.title !== 'string' || !c.title.trim() || c.title.length > 80) e.push('Titel: 1–80 Zeichen.');
  if (c.system !== 'EBM' && c.system !== 'GOAE') e.push('System: EBM oder GOÄ.');
  if (!codeList(c.codes)) e.push('Auslöser: mindestens eine gültige Ziffer.');
  if (typeof c.text !== 'string' || !c.text.trim() || c.text.length > 400) e.push('Text: 1–400 Zeichen.');
  if (c.priority !== 'wichtig' && c.priority !== 'hinweis') e.push('Wichtigkeit fehlt.');
  if (!isDate(c.validFrom)) e.push('„Gültig ab“ fehlt.');
  if (c.type === 'kombination') {
    if (!codeList(c.partnerCodes)) e.push('Kombination: Partnerziffern fehlen.');
    if (c.scope !== 'calendar_day' && c.scope !== 'behandlungsfall') e.push('Kombination: Zeitraum fehlt.');
  } else if (c.partnerCodes !== undefined || c.scope !== undefined) e.push('Partnerziffern/Zeitraum nur bei „Kombination“.');
  if (c.type === 'pflicht') {
    if (!['uhrzeit', 'dauer', 'pflichtinhalte'].includes(String(c.requirement))) e.push('Pflichtangabe: welche Angabe?');
  } else if (c.requirement !== undefined) e.push('Pflichtangabe nur bei „Pflichtangabe“.');
  const known = new Set(['type', 'title', 'system', 'codes', 'text', 'priority', 'validFrom', 'partnerCodes', 'scope', 'requirement']);
  for (const k of Object.keys(c)) if (!known.has(k)) e.push(`Unbekanntes Feld „${k}“.`);
  return e;
}

/** Liest praxisregeln.json streng: bei einem Fehler gilt keine Praxisregel (fail-closed, Meldung sichtbar). */
export function parseRuleFile(raw: unknown): PracticeRuleFile | { error: string } {
  if (raw === null || raw === undefined) return EMPTY_FILE;
  if (!isObj(raw) || raw.schema_version !== '1.0.0' || !Array.isArray(raw.rules)) return { error: 'Praxisregeln: unbekanntes Dateiformat.' };
  const ids = new Set<string>();
  for (const r of raw.rules) {
    if (!isObj(r) || typeof r.id !== 'string' || !/^R-[0-9a-z-]{4,40}$/.test(r.id) || ids.has(r.id)) return { error: 'Praxisregeln: fehlerhafte Regelkennung.' };
    ids.add(r.id);
    if (!Array.isArray(r.versions) || r.versions.length === 0) return { error: `Praxisregel ${r.id}: keine Fassung.` };
    let active = 0;
    for (const [i, v] of r.versions.entries()) {
      if (!isObj(v) || v.version !== i + 1 || !['entwurf', 'aktiv', 'archiv'].includes(String(v.status))) return { error: `Praxisregel ${r.id}: Fassung ${i + 1} fehlerhaft.` };
      const errs = contentErrors(v.content);
      if (errs.length) return { error: `Praxisregel ${r.id} v${i + 1}: ${errs[0]}` };
      if (v.status === 'aktiv') {
        active++;
        if (typeof v.activatedBy !== 'string' || typeof v.reason !== 'string' || !v.reason.trim()) return { error: `Praxisregel ${r.id} v${i + 1}: Aktivierung ohne Arzt oder Grund.` };
      }
    }
    if (active > 1) return { error: `Praxisregel ${r.id}: mehr als eine aktive Fassung.` };
  }
  return raw as unknown as PracticeRuleFile;
}

export interface ActiveRule { id: string; version: number; content: PracticeRuleContent }

/** Die aktiven Fassungen, die am Tag `date` gelten. */
export function activeRules(file: PracticeRuleFile, date: IsoDate): ActiveRule[] {
  return file.rules.flatMap((r) => r.versions
    .filter((v) => v.status === 'aktiv' && v.content.validFrom <= date)
    .map((v) => ({ id: r.id, version: v.version, content: v.content })));
}

export interface Author { kuerzel: string; role: 'arzt' | 'mfa' }

const newId = () => `R-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;

/** Neuer Entwurf (neue Regel oder nächste Fassung einer bestehenden). Ein vorhandener Entwurf wird ersetzt. */
export function saveDraft(file: PracticeRuleFile, ruleId: string | null, content: PracticeRuleContent, by: Author, now: string): { file: PracticeRuleFile; ruleId: string } {
  const errs = contentErrors(content);
  if (errs.length) throw new Error(errs.join(' '));
  if (!ruleId) {
    const id = newId();
    return { ruleId: id, file: { ...file, rules: [...file.rules, { id, versions: [{ version: 1, status: 'entwurf', content, createdBy: by.kuerzel, createdAt: now }] }] } };
  }
  const rules = file.rules.map((r) => {
    if (r.id !== ruleId) return r;
    const kept = r.versions.filter((v) => v.status !== 'entwurf' || v.version !== r.versions.length);
    const last = r.versions.at(-1)!;
    const version = last.status === 'entwurf' ? last.version : last.version + 1;
    return { ...r, versions: [...kept, { version, status: 'entwurf' as const, content, createdBy: by.kuerzel, createdAt: now }] };
  });
  return { ruleId, file: { ...file, rules } };
}

/** Aktiviert eine Fassung (nur Arzt, Grund Pflicht). Die bisher aktive Fassung wird archiviert. */
export function activate(file: PracticeRuleFile, ruleId: string, version: number, by: Author, reason: string, now: string): PracticeRuleFile {
  if (by.role !== 'arzt') throw new Error('Nur ein Arzt kann Praxisregeln aktivieren.');
  if (!reason.trim()) throw new Error('Bitte einen Änderungsgrund angeben.');
  const rule = file.rules.find((r) => r.id === ruleId);
  const target = rule?.versions.find((v) => v.version === version);
  if (!rule || !target) throw new Error('Fassung nicht gefunden.');
  if (target.status !== 'entwurf') throw new Error('Nur ein Entwurf kann aktiviert werden.');
  const versions = rule.versions.map((v) => v.version === version
    ? { ...v, status: 'aktiv' as const, activatedBy: by.kuerzel, activatedAt: now, reason: reason.trim() }
    : v.status === 'aktiv' ? { ...v, status: 'archiv' as const } : v);
  return { ...file, rules: file.rules.map((r) => (r.id === ruleId ? { ...r, versions } : r)) };
}

/** Archiviert die aktive Fassung (Regel gilt nicht mehr; Verlauf bleibt). Nur Arzt. */
export function retire(file: PracticeRuleFile, ruleId: string, by: Author): PracticeRuleFile {
  if (by.role !== 'arzt') throw new Error('Nur ein Arzt kann Praxisregeln abschalten.');
  return { ...file, rules: file.rules.map((r) => (r.id !== ruleId ? r : { ...r, versions: r.versions.map((v) => (v.status === 'aktiv' ? { ...v, status: 'archiv' as const } : v)) })) };
}

/** Zustand einer Regel für die Liste: aktiv, nur Entwurf oder archiviert. */
export function ruleState(r: PracticeRule): VersionStatus {
  if (r.versions.some((v) => v.status === 'aktiv')) return 'aktiv';
  return r.versions.at(-1)!.status === 'entwurf' ? 'entwurf' : 'archiv';
}
