import type { IsoDate } from '../domain/types.js';

/**
 * Regelbasierte Erkennung des Status einer erwähnten Maßnahme (ACCEPTANCE.md FACT-01…10).
 * Absichtlich konservativ: Ergebnisse sind IMMER 'uncertain' und müssen vom Benutzer bestätigt
 * werden, bevor der Prüfmotor sie als Fakt verwendet. Text wird nie als Anweisung ausgeführt.
 */

export type MentionStatus =
  | 'performed' | 'planned' | 'recommended' | 'refused' | 'external' | 'historical' | 'negated' | 'family_history' | 'unknown';

export interface Mention {
  status: MentionStatus;
  cue: string | null;
  eventDate: IsoDate | null;
  durationMinutes: number | null;
  verification: 'uncertain';
  ref: string;
}

const CUES: [MentionStatus, RegExp][] = [
  ['family_history', /\b(mutter|vater|schwester|bruder|eltern|gro(ß|ss)(mutter|vater)|familienanamnese|fa:)\b/i],
  ['negated', /\b(kein(e|en|em|er)?\s+(hinweis|anhalt|zeichen)|ausgeschlossen|negativ für|nicht nachweisbar|o\.?\s?b\.?)\b/i],
  ['refused', /\b(lehnt\b.*\bab|abgelehnt|verweigert|wünscht keine?)\b/i],
  ['recommended', /\b(empfohlen|empfehle|empfehlung|sollte|anzuraten|noch nicht erfolgt)\b/i],
  ['planned', /\b(geplant|vereinbart|nächste woche|demnächst|wiedervorstellung|termin am|vorgesehen)\b/i],
  ['external', /\b(im krankenhaus|in der klinik|beim facharzt|extern|auswärts|durch (den|die) (kollegen|kollegin)|laut (arzt)?brief|befund von)\b/i],
  ['historical', /\b(gestern|vorgestern|letzte woche|im (januar|februar|märz|april|mai|juni|juli|august|september|oktober|november|dezember)|z\.?\s?n\.?|zustand nach|anamnestisch|vor \d+ (tagen|wochen|monaten|jahren))\b/i],
  ['performed', /\b(heute|durchgeführt|erfolgt|erbracht|gemacht|abgenommen|untersucht|verabreicht|angelegt)\b/i],
];

const MONTHS = ['januar', 'februar', 'märz', 'april', 'mai', 'juni', 'juli', 'august', 'september', 'oktober', 'november', 'dezember'];

/** Explizite Datumsangabe im Text (TT.MM.JJJJ) hat Vorrang vor dem Notizdatum (FACT-08). */
function explicitDate(text: string): IsoDate | null {
  const m = /\b(\d{1,2})\.(\d{1,2})\.(\d{4})\b/.exec(text);
  if (!m) return null;
  const iso = `${m[3]}-${m[2]!.padStart(2, '0')}-${m[1]!.padStart(2, '0')}`;
  return new Date(`${iso}T00:00:00Z`).toISOString().startsWith(iso) ? iso : null;
}

/** Nur ausdrückliche Minutenangaben; „lange Beratung“ ergibt keine Zahl (FACT-09). */
export function extractDuration(text: string): number | null {
  const m = /\b(\d{1,3})\s*(min\.?|minuten)\b/i.exec(text);
  return m ? Number(m[1]) : null;
}

export function classifyMention(text: string, noteDate: IsoDate | null, ref: string): Mention {
  const clean = text.normalize('NFC');
  let status: MentionStatus = 'unknown';
  let cue: string | null = null;
  for (const [s, re] of CUES) {
    const m = re.exec(clean);
    if (m) { status = s; cue = m[0]; break; }
  }
  const explicit = explicitDate(clean);
  const monthMention = MONTHS.some((mo) => new RegExp(`\\bim ${mo}\\b`, 'i').test(clean));
  let eventDate: IsoDate | null = explicit ?? (status === 'performed' && !monthMention ? noteDate : null);
  // Eine im Text genannte frühere Durchführung bleibt historisch, auch wenn „durchgeführt“ vorkommt.
  if (explicit && noteDate && explicit < noteDate && status === 'performed') status = 'historical';
  if (status === 'historical' && !explicit) eventDate = null;
  return { status, cue, eventDate, durationMinutes: extractDuration(clean), verification: 'uncertain', ref };
}
