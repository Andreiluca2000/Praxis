import type { BilledService } from '../domain/types.js';
import { checkCase, quarterRange, readKvdt } from './quarter-check.js';
import type { DayCheckInput, DayItem, DayPatient } from './day-check.js';

/**
 * KI im Tagesabschluss – Fensterseite. KI schlägt vor und erklärt, sie entscheidet nie.
 * - Die Anfrage baut und prüft Rust (`ai_day.rs`): Hauptschalter, Stufe-2-Freigabe, Minimierung, Vorschau, Protokoll.
 * - Hier nur: Anfrage zusammenstellen (Stufe 1 ohne Text, ohne Pseudonym) und die Antwort mit Prüfmotor und Katalog prüfen.
 * - Jeder Vorschlag bleibt „unsicher“, bis der Arzt annimmt oder verwirft. Es gibt keinen Zustand „bereit“,
 *   und nichts wird nach DURIA geschrieben: Angenommenes landet nur in der Korrekturliste (manuell in DURIA).
 */

/** Wie `DayAiRequest` in Rust (serde, `stage` als Kennung). */
export type DayAiRequest =
  | { stage: 'erklaeren'; kind: DayItem['kind']; codes: string[]; verdict: string }
  | { stage: 'genau_lesen'; codes_today: string[]; text: string };

const EBM = /\b\d{5}[A-Z]?\b/g;
const ICD = /\b[A-Z]\d{2}(?:\.\d{1,2})?\b/g;

/** Ziffern und ICD aus dem Text eines Befunds (Stufe 1 schickt nur diese plus den Prüftext). */
export function codesIn(text: string): string[] {
  return [...new Set([...(text.match(EBM) ?? []), ...(text.match(ICD) ?? [])])];
}

/** Stufe 1: einen Befund erklären lassen – ohne Pseudonym, ohne Kartei-Text (Datum entfernt Rust). */
export function explainRequest(item: DayItem): DayAiRequest {
  return { stage: 'erklaeren', kind: item.kind, codes: codesIn(item.text).slice(0, 20), verdict: item.text };
}

/** Stufe 2 („genau lesen“): Dokumentation des Tages; Rust sendet sie nur mit Freigabe und minimiert sie. */
export function readRequest(p: DayPatient, text: string): DayAiRequest {
  return { stage: 'genau_lesen', codes_today: p.servicesToday.slice(0, 20), text };
}

export interface AiProposalRaw { ziffer: string; begruendung: string; beleg: string }

/** Antwort der Stufe 2 lesen (festes JSON-Format); alles andere → Fehler, kein Vorschlag. */
export function parseAiProposals(answer: string): { proposals: AiProposalRaw[]; hints: string[] } | { error: string } {
  const json = answer.slice(answer.indexOf('{'), answer.lastIndexOf('}') + 1);
  let v: unknown;
  try { v = JSON.parse(json); } catch { return { error: 'KI-Antwort ist kein lesbares JSON – kein Vorschlag übernommen.' }; }
  const o = v as { vorschlaege?: unknown; hinweise?: unknown };
  if (!Array.isArray(o.vorschlaege)) return { error: 'KI-Antwort ohne „vorschlaege“ – kein Vorschlag übernommen.' };
  const str = (x: unknown) => (typeof x === 'string' ? x.trim().slice(0, 500) : '');
  const proposals = o.vorschlaege.slice(0, 20).flatMap((p: unknown): AiProposalRaw[] => {
    const r = p as Record<string, unknown>;
    const ziffer = str(r?.ziffer).toUpperCase();
    return ziffer ? [{ ziffer, begruendung: str(r.begruendung), beleg: str(r.beleg) }] : [];
  });
  const hints = Array.isArray(o.hinweise) ? o.hinweise.map(str).filter(Boolean).slice(0, 10) : [];
  return { proposals, hints };
}

export type AiDecision = 'offen' | 'angenommen' | 'verworfen';

export interface AiProposal {
  code: string;
  reason: string;
  evidence: string;
  /** Immer „unsicher“: KI-Vorschläge werden nie von selbst „bereit“. */
  certainty: 'unsicher';
  decision: AiDecision;
  /** Ergebnis von Prüfmotor und Katalog für die Ziffer, als wäre sie heute erfasst. */
  checks: DayItem[];
  /** Hinweise zur Plausibilität (Format, bereits erfasst, Beleg im Text, freigegebene Regel). */
  notes: string[];
}

const ebmFormat = /^\d{5}[A-Z]?$/;

/**
 * Jeden Vorschlag mit Prüfmotor und Katalog prüfen: die Ziffer wird probehalber zum heutigen Tag des Falls gelegt;
 * neue Befunde (die es ohne die Ziffer nicht gab) gehören zum Vorschlag. Die echten Daten bleiben unverändert.
 */
export function reviewAiProposals(input: DayCheckInput, token: string, raw: AiProposalRaw[], sentText: string): AiProposal[] {
  const cases = readKvdt(input.kvdt).cases.filter((c) => c.patientToken === token);
  const fileQuarter = cases.map((c) => quarterRange(c.quarter)).find((q) => q !== null) ?? null;
  const opts = { settings: input.settings, rules: input.rules, mode: input.mode, pairs: input.pairs, windows: input.windows, practice: input.practice, chronic: input.chronic, fileQuarter, day: input.day };
  const texts = (r: ReturnType<typeof checkCase>) => [
    ...r.findings.map((f) => f.text), ...r.pairFindings.map((f) => `${f.codes.join(' + ')}: ${f.text}`), ...r.windowFindings.map((f) => `${f.codes.join(' + ')}: ${f.text}`),
  ];
  const before = new Set(cases.flatMap((c) => texts(checkCase(c, opts))));
  const billedToday = new Set(cases.flatMap((c) => c.services.filter((s) => s.date === input.day).map((s) => s.code)));
  const demo = input.rules.content_kind === 'synthetic_example';
  const approved = new Set(input.rules.content_kind === 'synthetic_example' ? [] : input.rules.rules.flatMap((r) => r.procedure_codes));

  return raw.map((p): AiProposal => {
    const notes: string[] = [];
    const checks: DayItem[] = [];
    if (!ebmFormat.test(p.ziffer)) notes.push('Keine EBM-Ziffer im bekannten Format – nicht prüfbar.');
    if (billedToday.has(p.ziffer)) notes.push('Heute bereits erfasst.');
    if (!p.beleg || !sentText.includes(p.beleg)) notes.push('Beleg steht nicht wörtlich im gesendeten Text – besonders sorgfältig prüfen.');
    notes.push(approved.has(p.ziffer) ? 'Ärztlich freigegebene Regel vorhanden.' : 'Keine freigegebene Regel – nur Hinweis.');
    if (cases.length === 0) {
      checks.push({ level: 'grau', kind: 'kein_schein', draft: false, text: 'Nicht prüfbar: kein KV-Schein in der KVDT-Datei.' });
    } else if (ebmFormat.test(p.ziffer)) {
      const service: BilledService = { code: p.ziffer, system: 'EBM', date: input.day, state: 'active', session: null, evidence: [{ ref: 'ki-vorschlag' }] };
      const [first, ...rest] = cases;
      for (const c of [{ ...first!, services: [...first!.services, service] }, ...rest]) {
        const r = checkCase(c, opts);
        const draft = new Set(texts({ ...r, findings: [] }));
        for (const t of texts(r).filter((t) => !before.has(t))) {
          // DEMO-Regeln (Simulator) sind nicht freigegeben: höchstens gelb, wie im Tagesabschluss.
          const fehler = !demo && r.findings.some((f) => f.text === t && f.severity === 'fehler');
          checks.push({ level: draft.has(t) ? 'gelb' : fehler ? 'rot' : 'gelb', kind: draft.has(t) ? 'kombination' : 'regel', draft: draft.has(t), text: t });
        }
      }
    }
    return { code: p.ziffer, reason: p.begruendung, evidence: p.beleg, certainty: 'unsicher', decision: 'offen', checks, notes };
  });
}

/** Entscheidung des Arztes – neues Objekt, die Sicherheit bleibt „unsicher“ (Annahme = Eintrag in die Korrekturliste). */
export function decide(p: AiProposal, decision: Exclude<AiDecision, 'offen'>): AiProposal {
  return { ...p, decision };
}
