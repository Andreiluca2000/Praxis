import type { DocumentedDiagnosis, NoteEntry } from '../duria/adapter.js';
import type { IsoDate } from '../domain/types.js';
import { extractFacts } from './facts.js';
import type { FieldValue, FormId } from './types.js';

/**
 * Vorbefüllen aus dem geöffneten Patienten (DURIA-Export, bereits pseudonymisiert – DS-01).
 * Es wird nur angeboten, nie still übernommen: Die Person wählt aus, was auf den Schein soll.
 * Diagnosen nur mit dokumentierter Sicherheit G/V/A/Z – ohne Sicherheit wird nichts ergänzt.
 */

export type KarteiKind = 'diagnose' | 'eintrag' | 'tatsache';

export interface KarteiItem {
  id: string;
  kind: KarteiKind;
  /** Was übernommen würde, z. B. „I10.90 G Essentielle Hypertonie“ oder der Karteitext. */
  text: string;
  /** Herkunft für die Anzeige, z. B. „DURIA-Diagnose vom 27.10.2026“. */
  source: string;
  /** Vorschlag: angehakt, wenn es zur heutigen Behandlung gehört. */
  preselected: boolean;
  /** Nicht übernehmbar (z. B. Diagnose ohne Sicherheit) – nur zur Information. */
  blocked: string | null;
}

export interface KarteiInput {
  diagnoses: readonly DocumentedDiagnosis[];
  notes: readonly NoteEntry[];
  serviceDate: IsoDate;
  /** ICD-Titel aus dem Katalog (optional). */
  title?: (code: string) => string | null;
}

const CERTAINTY = new Set(['G', 'V', 'A', 'Z']);
const de = (d: IsoDate | null) => (d ? `${d.slice(8, 10)}.${d.slice(5, 7)}.${d.slice(0, 4)}` : 'ohne Datum');

function diagnoseItems(input: KarteiInput): KarteiItem[] {
  const seen = new Set<string>();
  const out: KarteiItem[] = [];
  // Neueste zuerst; je Kode nur der jüngste Eintrag.
  const sorted = [...input.diagnoses].sort((a, b) => (b.date ?? '').localeCompare(a.date ?? ''));
  for (const d of sorted) {
    const code = d.code.trim().toUpperCase();
    if (!code || seen.has(code)) continue;
    seen.add(code);
    const certainty = d.certainty?.trim().toUpperCase() ?? '';
    const title = input.title?.(code) ?? null;
    const side = d.side?.trim() ? ` ${d.side.trim().toUpperCase()}` : '';
    const ok = CERTAINTY.has(certainty);
    out.push({
      id: `dx:${code}`,
      kind: 'diagnose',
      text: `${code} ${ok ? certainty : '–'}${side}${title ? ` ${title}` : ''}`,
      source: `DURIA-Diagnose vom ${de(d.date)}`,
      preselected: ok && d.date === input.serviceDate,
      blocked: ok ? null : 'Diagnosesicherheit (G/V/A/Z) fehlt in DURIA – wird nicht übernommen.',
    });
  }
  return out;
}

function noteItems(input: KarteiInput): KarteiItem[] {
  return input.notes
    .filter((n) => n.text.trim())
    .sort((a, b) => (b.date ?? '').localeCompare(a.date ?? ''))
    .slice(0, 6)
    .map((n, i) => ({
      id: `note:${n.ref || i}`,
      kind: 'eintrag' as const,
      text: n.text.replace(/\s+/g, ' ').trim(),
      source: `Karteieintrag vom ${de(n.date)}`,
      preselected: n.date === input.serviceDate,
      blocked: null,
    }));
}

/** Für die Formulare wichtige Tatsachen aus den Karteieinträgen (Pflegegrad, Merkzeichen, Rollstuhl …). */
function factItems(input: KarteiInput): KarteiItem[] {
  const out: KarteiItem[] = [];
  const add = (key: string, text: string, n: NoteEntry) => {
    if (!out.some((o) => o.id === `fact:${key}`)) out.push({ id: `fact:${key}`, kind: 'tatsache', text, source: `Karteieintrag vom ${de(n.date)}`, preselected: true, blocked: null });
  };
  for (const n of [...input.notes].sort((a, b) => (b.date ?? '').localeCompare(a.date ?? ''))) {
    const f = extractFacts(n.text);
    if (f.pflegegrad) add('pflegegrad', `Pflegegrad ${f.pflegegrad.value}`, n);
    if (f.merkzeichen) add('merkzeichen', `Merkzeichen ${f.merkzeichen.value.join(', ')}`, n);
    if (f.mobilitaetDauerhaft) add('mobilitaet', 'dauerhafte Mobilitätsbeeinträchtigung', n);
    for (const a of f.ausstattung?.value ?? []) add(a, a === 'rollstuhl' ? 'Rollstuhl' : a === 'tragestuhl' ? 'Tragestuhl' : 'liegend', n);
    if (f.hochfrequent) add('hochfrequent', f.hochfrequent.value === 'dialyse' ? 'Dialyse' : f.hochfrequent.value === 'chemotherapie' ? 'Chemotherapie' : 'Strahlentherapie', n);
    if (f.zuzahlungsbefreit) add('zuzahlung', 'von der Zuzahlung befreit', n);
    if (f.versorgungsleiden) add('ser', 'Versorgungsleiden (SER)', n);
  }
  return out;
}

export function karteiOffer(input: KarteiInput): KarteiItem[] {
  return [...factItems(input), ...diagnoseItems(input), ...noteItems(input)];
}

/** Felder, in die Diagnosen bzw. Karteitext eines Vordrucks gehören. */
const TARGETS: Partial<Record<FormId, { diagnose: string | null; eintrag: string | null }>> = {
  'muster-06': { diagnose: 'diagnose', eintrag: 'befund' },
  'muster-02': { diagnose: 'diagnose', eintrag: 'untersuchungsergebnisse' },
  'muster-04': { diagnose: null, eintrag: null },
  'muster-10': { diagnose: 'diagnose', eintrag: 'befund' },
  'muster-10a': { diagnose: null, eintrag: 'zusatzangaben' },
  'muster-13': { diagnose: 'diagnose', eintrag: 'therapieziele' },
  'muster-12': { diagnose: null, eintrag: 'hinweise' },
  'muster-61': { diagnose: 'dx1', eintrag: 'anamnese' },
  'muster-21': { diagnose: null, eintrag: null },
  'muster-20': { diagnose: null, eintrag: null },
  'muster-55': { diagnose: 'icd1', eintrag: null },
  'muster-19': { diagnose: 'diagnosen', eintrag: 'befunde' },
  'muster-52': { diagnose: 'icd1', eintrag: 'funktion' },
  'muster-63': { diagnose: 'diagnosen', eintrag: 'beschreibung' },
  'muster-09': { diagnose: null, eintrag: null },
  'muster-26': { diagnose: 'diagnose', eintrag: 'faehigkeit' },
  'muster-27': { diagnose: null, eintrag: 'ziele' },
  'muster-64': { diagnose: 'icd1', eintrag: 'anamnese' },
  'muster-65': { diagnose: 'icd_1', eintrag: 'anamnese' },
};

/** Satz, der der Beschreibung angehängt wird, damit die gewählten Tatsachen in die Regeln eingehen. */
export function factSentence(chosen: readonly KarteiItem[]): string {
  const facts = chosen.filter((i) => i.kind === 'tatsache' && !i.blocked).map((i) => i.text);
  return facts.length ? `Aus der Kartei: ${facts.join(', ')}.` : '';
}

/**
 * Feldwerte aus der Auswahl. Bestehender Text bleibt erhalten, Kartei-Inhalt wird angehängt
 * (nichts wird überschrieben). Gibt nur die geänderten Felder zurück.
 */
export function applyKartei(formId: FormId, values: Readonly<Record<string, FieldValue>>, chosen: readonly KarteiItem[]): Record<string, string> {
  const t = TARGETS[formId] ?? { diagnose: null, eintrag: null };
  const out: Record<string, string> = {};
  const join = (field: string, parts: string[]) => {
    if (!parts.length) return;
    const cur = typeof values[field] === 'string' ? (values[field] as string).trim() : '';
    const fresh = parts.filter((p) => !cur.includes(p));
    if (fresh.length) out[field] = [cur, ...fresh].filter(Boolean).join('; ');
  };
  if (t.diagnose) join(t.diagnose, chosen.filter((i) => i.kind === 'diagnose' && !i.blocked).map((i) => i.text));
  if (t.eintrag) join(t.eintrag, chosen.filter((i) => i.kind === 'eintrag').map((i) => i.text));
  return out;
}
