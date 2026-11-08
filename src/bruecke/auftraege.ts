import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { minimieren } from './schutz.js';

/**
 * Aufträge an Claude (Bereich „Prozesse“ in Praxis-Assistent, Oberfläche folgt nach OK von Andree).
 * Datei je Windows-Benutzer: `%AppData%\de.praxis.assistent\claude-auftraege.json`.
 * - Die App legt Aufträge an (Text vom Arzt, höchstens 2000 Zeichen); Claude liest offene Aufträge und antwortet.
 * - Auftragstexte gehen an Anthropic. Deshalb: `minimieren` beim Lesen; Namen erkennt das nicht – die App sagt es dem Arzt.
 * - Fehlerhafte Datei → nichts lesen, nichts überschreiben (fail closed).
 */

export const SCHEMA = '1.0.0';
export const MAX_TEXT = 2000;
export const MAX_ANTWORT = 8000;
export const MAX_AUFTRAEGE = 200;

export type AuftragStatus = 'offen' | 'in_arbeit' | 'erledigt' | 'abgelehnt';
export interface Auftrag {
  id: string;
  erstellt: string;
  von: string;
  text: string;
  status: AuftragStatus;
  antwort: { text: string; am: string } | null;
}
export interface AuftragsDatei { schema_version: string; auftraege: Auftrag[] }

const STATUS: AuftragStatus[] = ['offen', 'in_arbeit', 'erledigt', 'abgelehnt'];
const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

export function parseAuftraege(raw: unknown): AuftragsDatei | { fehler: string } {
  if (!isObj(raw) || raw.schema_version !== SCHEMA || !Array.isArray(raw.auftraege)) return { fehler: 'Auftragsdatei: unbekanntes Format.' };
  if (raw.auftraege.length > MAX_AUFTRAEGE) return { fehler: 'Auftragsdatei: zu viele Einträge.' };
  const ids = new Set<string>();
  const out: Auftrag[] = [];
  for (const a of raw.auftraege) {
    if (!isObj(a) || typeof a.id !== 'string' || !/^A-[0-9a-z-]{4,40}$/.test(a.id) || ids.has(a.id)) return { fehler: 'Auftragsdatei: fehlerhafte Kennung.' };
    ids.add(a.id);
    if (typeof a.erstellt !== 'string' || typeof a.von !== 'string' || !/^[A-Za-z0-9]{1,8}$/.test(a.von)) return { fehler: `Auftrag ${a.id}: Datum oder Kürzel fehlt.` };
    if (typeof a.text !== 'string' || !a.text.trim() || a.text.length > MAX_TEXT) return { fehler: `Auftrag ${a.id}: Text fehlt oder ist zu lang.` };
    if (typeof a.status !== 'string' || !STATUS.includes(a.status as AuftragStatus)) return { fehler: `Auftrag ${a.id}: unbekannter Status.` };
    let antwort: Auftrag['antwort'] = null;
    if (a.antwort !== null && a.antwort !== undefined) {
      if (!isObj(a.antwort) || typeof a.antwort.text !== 'string' || typeof a.antwort.am !== 'string' || a.antwort.text.length > MAX_ANTWORT) return { fehler: `Auftrag ${a.id}: Antwort fehlerhaft.` };
      antwort = { text: a.antwort.text, am: a.antwort.am };
    }
    out.push({ id: a.id, erstellt: a.erstellt, von: a.von, text: a.text, status: a.status as AuftragStatus, antwort });
  }
  return { schema_version: SCHEMA, auftraege: out };
}

export const auftragsDatei = (benutzer: string) => join(benutzer, 'claude-auftraege.json');

export function ladeAuftraege(benutzer: string): AuftragsDatei | { fehler: string } {
  const file = auftragsDatei(benutzer);
  if (!existsSync(file)) return { schema_version: SCHEMA, auftraege: [] };
  try {
    return parseAuftraege(JSON.parse(readFileSync(file, 'utf8')));
  } catch {
    return { fehler: 'Auftragsdatei nicht lesbar.' };
  }
}

/** Offene Aufträge für Claude – Text minimiert. */
export function offeneAuftraege(d: AuftragsDatei) {
  return d.auftraege.filter((a) => a.status === 'offen' || a.status === 'in_arbeit').map((a) => {
    const m = minimieren(a.text, MAX_TEXT);
    return { id: a.id, erstellt: a.erstellt, von: a.von, status: a.status, text: m.text, entfernt: m.entfernt };
  });
}

/** Neue Datei mit geänderter Antwort/Status (unveränderlich: die alte Struktur bleibt unberührt). */
export function beantworte(d: AuftragsDatei, id: string, text: string, status: AuftragStatus, am: string): AuftragsDatei | { fehler: string } {
  const a = d.auftraege.find((x) => x.id === id);
  if (!a) return { fehler: `Auftrag ${id} nicht gefunden.` };
  if (a.status === 'erledigt' || a.status === 'abgelehnt') return { fehler: `Auftrag ${id} ist schon abgeschlossen.` };
  if (status === 'offen') return { fehler: 'Antwort braucht den Status in_arbeit, erledigt oder abgelehnt.' };
  const m = minimieren(text, MAX_ANTWORT);
  if (!m.text.trim()) return { fehler: 'Antwort ist leer.' };
  return { ...d, auftraege: d.auftraege.map((x) => (x.id === id ? { ...x, status, antwort: { text: m.text, am } } : x)) };
}

export function speichereAuftraege(benutzer: string, d: AuftragsDatei): void {
  const file = auftragsDatei(benutzer);
  mkdirSync(dirname(file), { recursive: true });
  const tmp = `${file}.tmp`;
  writeFileSync(tmp, JSON.stringify(d, null, 2));
  renameSync(tmp, file);
}
