import { getForm, rule } from './catalog.js';
import { befoerderungB, extractFacts } from './facts.js';
import { searchCatalog } from './katalog.js';
import { checkMuster02, proposeMuster02 } from './muster02.js';
import { checkMuster04, proposeMuster04 } from './muster04.js';
import { checkMuster06, proposeMuster06 } from './muster06.js';
import { checkMuster10, proposeMuster10 } from './muster10.js';
import { checkMuster13, proposeMuster13 } from './muster13.js';
import { specialtyIn } from './specialties.js';
import { cue, headOf, norm, uni } from './text.js';
import type { Analysis, FormId, FormIssue, FormProposal, FormSuggestion, FormValues, Intent, PatientFacts } from './types.js';

/**
 * Einstieg der Formularhilfe: aus der freien Beschreibung (Wunsch + Lage des Patienten) werden
 * passende Vordrucke vorgeschlagen, ausgefüllt und geprüft. Alles lokal und regelbasiert;
 * nichts wird gedruckt, signiert oder übermittelt.
 */

const INTENTS: [Intent, RegExp][] = [
  ['befoerderung', /\b(taxi\w*|mietwagen|transport\w*|krankenfahrt\w*|krankenbeförderung|beförderung|fahrt(?:en)?|KTW|RTW|NAW|liegendtransport)\b/iu],
  ['einweisung', /\b(einweis\w*|krankenhausbehandlung|stationär\w*|ins krankenhaus|in die klinik|klinikeinweisung|notaufnahme)\b/iu],
  ['ueberweisung', /\b(überweis\w*|facharzt\w*|konsil\w*|mitbehandlung|weiterbehandlung)\b/iu],
  ['labor', /\b(labor\w*|blutbild|blutentnahme|blutabnahme|blutwerte|urinkultur|serologie)\b/iu],
  ['heilmittel', /\b(heilmittel\w*|physiotherap\w*|physio|krankengymnastik|manuelle therapie|lymphdrainage|ergotherap\w*|logopädi\w*|podolog\w*|ernährungstherap\w*|sprachtherap\w*|stimmtherap\w*|schlucktherap\w*)\b/iu],
];

function intents(text: string): { intent: Intent; evidence: string }[] {
  const out: { intent: Intent; evidence: string }[] = [];
  // Nur der Wunsch zählt, nicht Abschnitte wie „Befund: Laborwerte unauffällig“.
  const head = headOf(text);
  for (const [intent, re] of INTENTS) {
    const m = cue(re, head);
    if (m) out.push({ intent, evidence: m });
  }
  // „Überweisung ans Labor“ ist Muster 10, nicht Muster 6 – außer es ist auch ein anderes Fachgebiet genannt.
  if (out.some((o) => o.intent === 'labor') && !specialtyIn(head)) {
    const i = out.findIndex((o) => o.intent === 'ueberweisung');
    if (i >= 0) out.splice(i, 1);
  }
  // „zum Kardiologen“ ohne das Wort Überweisung – bei „Taxi zum Neurologen“ ist es nur das Fahrtziel
  if (!out.some((o) => o.intent === 'ueberweisung' || o.intent === 'befoerderung')) {
    const spec = uni(/\b(?:zum|zur|an den|an die|beim)\s+\S+/iu).test(text) ? specialtyIn(text) : null;
    if (spec) out.push({ intent: 'ueberweisung', evidence: spec.evidence });
  }
  // „ambulante OP im Krankenhaus“ ist eine Überweisung (Muster 6), keine Einweisung
  if (uni(/\bambulante?n?\s+op(?:eration)?\b/iu).test(text)) return out.filter((o) => o.intent !== 'einweisung').concat(out.some((o) => o.intent === 'ueberweisung') ? [] : [{ intent: 'ueberweisung' as const, evidence: 'ambulante OP' }]);
  return out;
}

const FORM_OF: Record<Intent, FormId> = { ueberweisung: 'muster-06', einweisung: 'muster-02', befoerderung: 'muster-04', labor: 'muster-10', heilmittel: 'muster-13' };

function suggestion(formId: FormId, role: FormSuggestion['role'], why: string, evidence: string | null, ruleId: string | null): FormSuggestion {
  const form = getForm(formId);
  return { formId, role, title: `Muster ${form.muster} – ${form.title}`, why, evidence, rule: ruleId ? rule(form, ruleId) : null };
}

function suggestions(text: string, facts: PatientFacts): FormSuggestion[] {
  const found = intents(text);
  const out: FormSuggestion[] = found.map((f) => suggestion(FORM_OF[f.intent], 'hauptsache', `Gewünscht: „${f.evidence}“.`, f.evidence, null));
  const has = (id: FormId) => out.some((s) => s.formId === id);
  const b = befoerderungB(facts);
  if (!has('muster-04')) {
    if (has('muster-02') && (facts.ausstattung || (facts.pflegegrad && facts.pflegegrad.value >= 3) || facts.notfall)) {
      out.push(suggestion('muster-04', 'zusaetzlich', 'Falls eine Fahrt ins Krankenhaus nötig ist: Fahrten zur stationären Behandlung sind genehmigungsfrei (a).', facts.ausstattung?.evidence ?? facts.pflegegrad?.evidence ?? facts.notfall?.evidence ?? null, 'm04.a'));
    } else if (b.ok === true) {
      out.push(suggestion('muster-04', 'zusaetzlich', `${b.why}: Taxi/Mietwagen zur ambulanten Behandlung ist genehmigungsfrei (b).`, b.evidence, 'm04.b'));
    } else if (facts.hochfrequent) {
      out.push(suggestion('muster-04', 'zusaetzlich', `${facts.hochfrequent.evidence}: Fahrten zur hochfrequenten Behandlung sind möglich, aber genehmigungspflichtig (d).`, facts.hochfrequent.evidence, 'm04.d'));
    } else if (b.ok === null && facts.pflegegrad) {
      out.push(suggestion('muster-04', 'zusaetzlich', `${b.why}.`, b.evidence, 'm04.b'));
    }
  }
  return out;
}

function blockers(text: string, facts: PatientFacts): FormIssue[] {
  const out: FormIssue[] = [];
  const m06 = getForm('muster-06');
  if (uni(/\bmammographie-?screening\b/iu).test(text)) {
    out.push({ level: 'hinweis', text: 'Leistungen im Mammographie-Screening-Programm brauchen keine Überweisung.', fieldIds: [], rule: rule(m06, 'm06.mammographie') });
  }
  if (facts.reha) {
    out.push({ level: 'hinweis', text: `„${facts.reha.evidence}“: Medizinische Rehabilitation wird mit Muster 61 verordnet (in dieser Version noch nicht hinterlegt), nicht mit Muster 2.`, fieldIds: [], rule: rule(getForm('muster-02'), 'm02.reha') });
  }
  return out;
}

export function analyse(description: string): Analysis {
  const text = norm(description);
  const facts = extractFacts(text);
  const sug = suggestions(text, facts);
  const shown = new Set(sug.map((s) => getForm(s.formId).muster));
  const catalog = searchCatalog(text).filter((h) => !shown.has(h.entry.muster));
  return { facts, suggestions: sug, blockers: blockers(text, facts), catalog };
}

export function propose(formId: FormId, description: string, facts: PatientFacts, today: Date): FormProposal {
  const text = norm(description);
  if (formId === 'muster-06') return proposeMuster06(text, facts, today);
  if (formId === 'muster-02') return proposeMuster02(text, facts);
  if (formId === 'muster-04') return proposeMuster04(text, facts);
  if (formId === 'muster-10') return proposeMuster10(text, facts, today);
  return proposeMuster13(text, facts);
}

const CHECKS: Record<FormId, (values: FormValues, facts: PatientFacts) => FormIssue[]> = {
  'muster-06': checkMuster06, 'muster-02': checkMuster02, 'muster-04': checkMuster04, 'muster-10': checkMuster10, 'muster-13': checkMuster13,
};

const ORDER = { unzulaessig: 0, fehlt: 1, hinweis: 2 } as const;

/** Prüft einen Vordruck – auch nach Änderungen von Hand. Sortiert: unzulässig, fehlt, Hinweis. */
export function check(formId: FormId, values: FormValues, facts: PatientFacts): FormIssue[] {
  const issues = CHECKS[formId](values, facts);
  return [...issues].sort((a, b) => ORDER[a.level] - ORDER[b.level]);
}
