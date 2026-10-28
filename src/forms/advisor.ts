import { getForm, rule } from './catalog.js';
import { befoerderungB, extractFacts } from './facts.js';
import { searchCatalog } from './katalog.js';
import { checkMuster02, proposeMuster02 } from './muster02.js';
import { checkMuster04, proposeMuster04 } from './muster04.js';
import { checkMuster06, proposeMuster06 } from './muster06.js';
import { checkMuster09, proposeMuster09 } from './muster09.js';
import { checkMuster10, proposeMuster10 } from './muster10.js';
import { checkMuster10A, labGemeinschaft, proposeMuster10A } from './muster10a.js';
import { checkMuster12, proposeMuster12 } from './muster12.js';
import { checkMuster13, proposeMuster13 } from './muster13.js';
import { checkMuster19, proposeMuster19 } from './muster19.js';
import { checkMuster20, proposeMuster20 } from './muster20.js';
import { checkMuster21, proposeMuster21 } from './muster21.js';
import { checkMuster26, proposeMuster26 } from './muster26.js';
import { checkMuster27, proposeMuster27 } from './muster27.js';
import { checkMuster52, proposeMuster52 } from './muster52.js';
import { checkMuster55, proposeMuster55 } from './muster55.js';
import { checkMuster61, proposeMuster61 } from './muster61.js';
import { checkMuster63, proposeMuster63 } from './muster63.js';
import { checkMuster64, proposeMuster64 } from './muster64.js';
import { checkMuster65, proposeMuster65 } from './muster65.js';
import { specialtyIn } from './specialties.js';
import { checkWeitere, isWeitere, proposeWeitere, weitereIntents } from './weitere.js';
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
  ['hkp', /\b(häusliche\w* krankenpflege|hkp|pflegedienst\w*|behandlungspflege|verbandswechsel|verbandwechsel|kompressionsstrümpfe|medikamentengabe|wundversorgung)\b/iu],
  ['kinderkrank', /\b(kind(?:er)?krank\w*|krankes kind|kind(?:es)? (?:ist )?krank|kinderkrankengeld|krankengeld (?:bei|wegen) (?:erkrankung|krankheit) (?:des|eines) kindes|betreuung des (?:kranken |erkrankten )?kindes|muster\s*21)\b/iu],
  ['wiedereingliederung', /\b(wiedereingliederung\w*|hamburger modell|stufenweise\w* (?:wieder)?(?:eingliederung|wiederaufnahme)|muster\s*20)\b/iu],
  ['chroniker', /\b(chroniker\w*|schwerwiegende\w* chronische\w* erkrankung|belastungsgrenze|zuzahlungsbefreiung|1\s*%-?(?:regel|grenze)|muster\s*55)\b/iu],
  ['notfallschein', /\b(notfallschein|vertretungsschein|notfalldienst\w*|bereitschaftsdienst\w*|urlaubsvertretung|krankheitsvertretung|muster\s*19)\b/iu],
  ['au_bericht', /\b(muster\s*52|bericht (?:für|an) die (?:krankenkasse|kasse)|anfrage der (?:krankenkasse|kasse)|fortbestehen der (?:au|arbeitsunfähigkeit)|au-?bericht|kasse fragt)\b/iu],
  ['sapv', /\b(sapv|spezialisierte\w* ambulante\w* palliativ\w*|palliativ-?team|palliativdienst|palliative care team|muster\s*63)\b/iu],
  ['mutterschaft', /\b(fehlgeburt\w*|frühgeburt\w*|missed abortion|totgeburt\w*|mutterschaftsgeld|behinderung des kindes|muster\s*9)\b/iu],
  ['soziotherapie', /\b(soziotherapie\w*|muster\s*26)\b/iu],
  ['betreuungsplan', /\b(soziotherapeutische\w* betreuungsplan|betreuungsplan|muster\s*27)\b/iu],
  ['attest_kind', /\b(attest kind|ärztliche\w* attest (?:für das )?kind|muster\s*65)\b/iu],
  ['mutter_vater_vorsorge', /\b((?:mutter|vater)-?kind-?(?:kur|leistung|maßnahme|vorsorge)|mütterkur|mutterkur|väterkur|vaterkur|vorsorge für (?:mütter|väter)|müttergenesung\w*|muster\s*64)\b/iu],
  ['reha', /\b(reha|rehabilitation\w*|anschlussheilbehandlung|ahb|reha-?antrag)\b/iu],
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
  // Im Bericht an die Kasse (Muster 52) sind Überweisung, Reha usw. Inhalt des Berichts, kein eigener Wunsch.
  if (out.some((o) => o.intent === 'au_bericht')) return out.filter((o) => o.intent === 'au_bericht');
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

const FORM_OF: Record<Intent, FormId> = { ueberweisung: 'muster-06', einweisung: 'muster-02', befoerderung: 'muster-04', labor: 'muster-10', heilmittel: 'muster-13', hkp: 'muster-12', reha: 'muster-61', kinderkrank: 'muster-21', wiedereingliederung: 'muster-20', chroniker: 'muster-55', notfallschein: 'muster-19', au_bericht: 'muster-52', sapv: 'muster-63', mutterschaft: 'muster-09', soziotherapie: 'muster-26', betreuungsplan: 'muster-27', mutter_vater_vorsorge: 'muster-64', attest_kind: 'muster-65' };

function suggestion(formId: FormId, role: FormSuggestion['role'], why: string, evidence: string | null, ruleId: string | null): FormSuggestion {
  const form = getForm(formId);
  return { formId, role, title: `Muster ${form.muster} – ${form.title}`, why, evidence, rule: ruleId ? rule(form, ruleId) : null };
}

function suggestions(text: string, facts: PatientFacts): FormSuggestion[] {
  const found = intents(text);
  const out: FormSuggestion[] = found.map((f) => suggestion(FORM_OF[f.intent], 'hauptsache', `Gewünscht: „${f.evidence}“.`, f.evidence, null));
  const has = (id: FormId) => out.some((s) => s.formId === id);
  for (const w of weitereIntents(headOf(text))) if (!has(w.formId)) out.push(suggestion(w.formId, 'hauptsache', `Gewünscht: „${w.evidence}“.`, w.evidence, null));
  // „Überweisung zur Indikationsstellung für Soziotherapie“ ist Muster 28, nicht die Verordnung (26/27).
  if (has('muster-28')) for (const id of ['muster-06', 'muster-26', 'muster-27'] as const) { const i = out.findIndex((s) => s.formId === id); if (i >= 0) out.splice(i, 1); }
  // Intensivpflege: der Behandlungsplan (62C) liegt der Verordnung (62B) bei.
  if (has('muster-62b') && !has('muster-62c')) out.push(suggestion('muster-62c', 'zusaetzlich', 'Der Behandlungsplan (Muster 62C) ist der Verordnung beizufügen.', null, 'm62c.beilage'));
  // Allgemeinlabor über die Laborgemeinschaft: Muster 10A statt Muster 10.
  const lg = cue(/\b(laborgemeinschaft|muster\s*10\s*a|anforderungsschein)\b/iu, text);
  const m10 = out.findIndex((s) => s.formId === 'muster-10');
  if (lg) {
    if (m10 >= 0) out.splice(m10, 1);
    if (!has('muster-10a')) out.push(suggestion('muster-10a', 'hauptsache', `Gewünscht: „${lg}“.`, lg, null));
  } else if (m10 >= 0) {
    const gl = labGemeinschaft(text);
    if (gl) out.push(suggestion('muster-10a', 'alternativ', `Bezieht die Praxis das Allgemeinlabor über eine Laborgemeinschaft: Muster 10A (${gl}).`, gl, 'm10a.auftragsfeld'));
  }
  // Soziotherapie: Verordnung (26) und Betreuungsplan (27) gehen zusammen an die Kasse.
  if (has('muster-26') && !has('muster-27')) out.push(suggestion('muster-27', 'zusaetzlich', 'Der Betreuungsplan (Muster 27) wird zusammen mit der Verordnung der Kasse vorgelegt.', null, 'm27.vorlage'));
  // Mutter-/Vater-Kind-Vorsorge mit behandlungsbedürftigem Kind: Ärztliches Attest Kind (65).
  const kindKrank = has('muster-64') && !has('muster-65') ? cue(/\b(kind\w*|sohn|tochter)\b[^.;]{0,40}?\b(asthma|neurodermitis|adipositas|übergewicht\w*|adhs|entwicklungsverzöger\w*|chronisch\w*|behindert\w*|verhaltensauffällig\w*|infekt\w*)/iu, text) : null;
  if (kindKrank) out.push(suggestion('muster-65', 'zusaetzlich', 'Mitaufgenommenes Kind ist behandlungsbedürftig: Ärztliches Attest Kind (Muster 65).', kindKrank, 'm65.zweck'));
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
  if (facts.reha && uni(/\b(einweis\w*|krankenhaus\w*)\b/iu).test(text)) {
    out.push({ level: 'hinweis', text: `„${facts.reha.evidence}“: Medizinische Rehabilitation wird mit Muster 61 verordnet, nicht mit Muster 2.`, fieldIds: [], rule: rule(getForm('muster-02'), 'm02.reha') });
  }
  return out;
}

export function analyse(description: string): Analysis {
  const text = norm(description);
  const facts = extractFacts(text);
  const sug = suggestions(text, facts);
  const shown = new Set(sug.map((s) => getForm(s.formId).muster));
  const catalog = searchCatalog(text).filter((h) => !shown.has(h.entry.muster.split(' ')[0]!));
  return { facts, suggestions: sug, blockers: blockers(text, facts), catalog };
}

export function propose(formId: FormId, description: string, facts: PatientFacts, today: Date): FormProposal {
  const text = norm(description);
  if (isWeitere(formId)) return proposeWeitere(formId, text, facts, today);
  if (formId === 'muster-06') return proposeMuster06(text, facts, today);
  if (formId === 'muster-02') return proposeMuster02(text, facts);
  if (formId === 'muster-04') return proposeMuster04(text, facts);
  if (formId === 'muster-10') return proposeMuster10(text, facts, today);
  if (formId === 'muster-10a') return proposeMuster10A(text, facts, today);
  if (formId === 'muster-12') return proposeMuster12(text, facts, today);
  if (formId === 'muster-61') return proposeMuster61(text, facts, today);
  if (formId === 'muster-21') return proposeMuster21(text, facts, today);
  if (formId === 'muster-20') return proposeMuster20(text, facts, today);
  if (formId === 'muster-55') return proposeMuster55(text, facts);
  if (formId === 'muster-19') return proposeMuster19(text, facts, today);
  if (formId === 'muster-52') return proposeMuster52(text, facts, today);
  if (formId === 'muster-63') return proposeMuster63(text, facts, today);
  if (formId === 'muster-09') return proposeMuster09(text, facts);
  if (formId === 'muster-26') return proposeMuster26(text, facts, today);
  if (formId === 'muster-27') return proposeMuster27(text, facts, today);
  if (formId === 'muster-64') return proposeMuster64(text, facts, today);
  if (formId === 'muster-65') return proposeMuster65(text, facts, today);
  return proposeMuster13(text, facts);
}

const CHECKS: Partial<Record<FormId, (values: FormValues, facts: PatientFacts) => FormIssue[]>> = {
  'muster-06': checkMuster06, 'muster-02': checkMuster02, 'muster-04': checkMuster04, 'muster-10': checkMuster10, 'muster-10a': checkMuster10A, 'muster-13': checkMuster13, 'muster-12': checkMuster12, 'muster-61': checkMuster61, 'muster-21': checkMuster21, 'muster-20': checkMuster20, 'muster-55': checkMuster55, 'muster-19': checkMuster19, 'muster-52': checkMuster52, 'muster-63': checkMuster63, 'muster-09': checkMuster09, 'muster-26': checkMuster26, 'muster-27': checkMuster27, 'muster-64': checkMuster64, 'muster-65': checkMuster65,
};

const ORDER = { unzulaessig: 0, fehlt: 1, hinweis: 2 } as const;

/** Prüft einen Vordruck – auch nach Änderungen von Hand. Sortiert: unzulässig, fehlt, Hinweis. */
export function check(formId: FormId, values: FormValues, facts: PatientFacts): FormIssue[] {
  const issues = isWeitere(formId) ? checkWeitere(formId, values, facts) : CHECKS[formId]?.(values, facts) ?? [];
  return [...issues].sort((a, b) => ORDER[a.level] - ORDER[b.level]);
}
