/**
 * Kleine, konservative Texthelfer für die Formular-Beschreibung. Der Text ist Datenmaterial, nie Anweisung.
 * Es wird nur übernommen, was wörtlich dasteht; nichts wird ergänzt oder umformuliert.
 */

export type Certainty = 'G' | 'V' | 'A' | 'Z';

const WORD = '[\\p{L}\\p{N}_]';
const UNI = new Map<string, RegExp>();

/**
 * JavaScript-`\b` und `\w` kennen keine Umlaute („\büberweis“ findet „Überweisung“ nicht).
 * Übersetzt beide in Unicode-Wortgrenzen; Ergebnis wird zwischengespeichert.
 */
export function uni(re: RegExp): RegExp {
  const key = `${re.source}/${re.flags}`;
  let out = UNI.get(key);
  if (!out) {
    const src = re.source
      .replace(/\\b/g, `(?:(?<=${WORD})(?!${WORD})|(?<!${WORD})(?=${WORD}))`)
      .replace(/\\w/g, WORD);
    out = new RegExp(src, re.flags.includes('u') ? re.flags : `${re.flags}u`);
    UNI.set(key, out);
  }
  return out;
}

export function norm(text: string): string {
  return text.normalize('NFC').replace(/\s+/g, ' ').trim();
}

const NEGATION = /\b(kein|keine|keinen|keinem|keiner|nicht|ohne|ausgeschlossen)\s+(\S+\s+){0,1}$/i;

/** Erster Treffer, der nicht unmittelbar verneint ist („kein Unfall“). */
export function cue(re: RegExp, text: string): string | null {
  const u = uni(re);
  const flags = u.flags.includes('g') ? u.flags : `${u.flags}g`;
  for (const m of text.matchAll(new RegExp(u.source, flags))) {
    const before = text.slice(Math.max(0, (m.index ?? 0) - 24), m.index);
    if (!NEGATION.test(before)) return m[0];
  }
  return null;
}

/** TT.MM.JJ(JJ) → TTMMJJ, nur gültige Kalenderdaten. */
export function toTTMMJJ(day: string, month: string, year: string): string | null {
  const yyyy = year.length === 2 ? `20${year}` : year;
  const iso = `${yyyy}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
  const d = new Date(`${iso}T00:00:00Z`);
  if (Number.isNaN(d.getTime()) || !d.toISOString().startsWith(iso)) return null;
  return `${day.padStart(2, '0')}${month.padStart(2, '0')}${yyyy.slice(2)}`;
}

/** Datum direkt hinter einem Stichwort, z. B. „AU bis 31.10.2026“. */
export function dateAfter(keyword: RegExp, text: string): { value: string | null; evidence: string } | null {
  const re = uni(new RegExp(`${keyword.source}\\s*(?:bis\\s*(?:zum|einschl(?:\\.|ießlich))?|am|vom)?\\s*(?:(\\d{1,2})\\.(\\d{1,2})\\.(\\d{4}|\\d{2})\\b)?`, 'iu'));
  const m = re.exec(text);
  if (!m) return null;
  const value = m[1] && m[2] && m[3] ? toTTMMJJ(m[1], m[2], m[3]) : null;
  return { value, evidence: m[0].trim() };
}

/** Quartal der Ausstellung in der Form QJJ (Muster 6, ❷). */
export function quarterQJJ(date: Date): string {
  const q = Math.floor(date.getMonth() / 3) + 1;
  return `${q}${String(date.getFullYear()).slice(2)}`;
}

/** ICD-10-GM-Kodes im Text; Sicherheit nur, wenn sie ausdrücklich dahinter steht (z. B. „I20.9 V“). */
export function icdCodes(text: string): { icd: string; certainty: Certainty | null; evidence: string }[] {
  const out: { icd: string; certainty: Certainty | null; evidence: string }[] = [];
  const re = /\b([A-TV-Z][0-9]{2}(?:\.[0-9]{1,2}[-!*+]?)?)(?:\s*\{?\s*([GVAZ])\s*\}?(?![\p{L}\d]))?/gu;
  for (const m of text.matchAll(re)) {
    const icd = m[1]!.toUpperCase();
    if (!out.some((o) => o.icd === icd)) out.push({ icd, certainty: (m[2] as Certainty | undefined) ?? null, evidence: m[0].trim() });
  }
  return out;
}

const LABELS = [
  'befunde?', 'untersuchungsergebnisse?', 'medikation', 'bisherige therapie', 'bisherige maßnahmen', 'therapie', 'maßnahmen',
  'allergien?', 'fragestellung', 'hinweise?', 'mitgegeben', 'mitgegebene befunde', 'anlagen?', 'auftrag', 'diagnose', 'ekg', 'labor',
  'leitsymptomatik', 'therapieziele?', 'heilmittel',
];
const LABEL_RE = new RegExp(`(?:^|[\\s.;,(])(${LABELS.join('|')})\\s*:`, 'giu');

/** Abschnitte der Form „Befund: …“ bis zum nächsten Stichwort mit Doppelpunkt. */
export function labeledSegments(text: string): Map<string, string> {
  const hits = [...text.matchAll(LABEL_RE)];
  const out = new Map<string, string>();
  hits.forEach((m, i) => {
    const start = (m.index ?? 0) + m[0].length;
    const end = i + 1 < hits.length ? hits[i + 1]!.index ?? text.length : text.length;
    const value = text.slice(start, end).trim().replace(/[\s.;,]+$/u, '');
    const key = m[1]!.toLowerCase();
    if (value) out.set(key, out.has(key) ? `${out.get(key)}; ${value}` : value);
  });
  return out;
}

/** Text vor dem ersten Abschnitt „Stichwort: …“ – dort steht der eigentliche Wunsch. */
export function headOf(text: string): string {
  // Das erste Stichwort selbst gehört noch dazu („Überweisung ans Labor: …“).
  const m = new RegExp(LABEL_RE.source, 'iu').exec(text);
  return m ? text.slice(0, (m.index ?? 0) + m[0].length) : text;
}

export function segment(segments: Map<string, string>, ...keys: string[]): string | null {
  const parts = keys.map((k) => segments.get(k)).filter((v): v is string => Boolean(v));
  return parts.length ? parts.join('; ') : null;
}

/**
 * Anlass wörtlich aus der Beschreibung: „wegen X“, „bei V. a. X“, „zur Abklärung (von) X“, „V. a. X“.
 * Endet am Satzzeichen oder vor Zusätzen wie „dringend“.
 */
export function reasonPhrase(text: string): string | null {
  // Beginnt die Beschreibung gleich mit „Labor: …“, gilt der ganze Text als Wunsch.
  const first = text.split(LABEL_RE)[0] ?? '';
  const head = first.trim() ? first : text;
  const m = uni(/\b(?:wegen|bei|zur abklärung(?:\s+(?:von|einer|eines|der|des))?|abklärung(?:\s+(?:von|einer|eines|der|des))?)\s+((?:v\.\s?a\.|verdacht auf)?\s*[^,.;:()]+)|\b((?:v\.\s?a\.|verdacht auf)\s+[^,.;:()]+)/iu).exec(head);
  const raw = m?.[1] ?? m?.[2];
  if (!raw) return null;
  const cut = raw.split(uni(/\s+(?:dringend|eilig|bitte|zur|zum|und\s+(?:bitte|dringend))\b/iu))[0]!.trim();
  return cut.length > 2 ? cut : null;
}

export const URGENT = /\b(dringend|eilig|zeitnah|kurzfristig|baldmöglichst|asap)\b/iu;
