import { checkbox, exactlyOne, formatIssues, issue, prop, textOf } from './build.js';
import { cleanPhrase, icdIssues } from './common.js';
import { cue, icdCodes, labeledSegments, norm, quarterQJJ, reasonPhrase, segment, ttmmjj } from './text.js';
import type { FieldProposal, FilledBy, FormDefinition, FormField, FormIssue, FormValues, PatientFacts } from './types.js';

/**
 * Ausfüllhilfe für Vordrucke ohne eigene Logik: Vorschlag und Prüfung allein aus der Felddefinition
 * (Personalien aus DURIA, Stempel vom Arzt, Ausstellungsdatum heute, Abschnitte „Stichwort: …“, ICD mit Sicherheit,
 * Ankreuzgruppen „genau eins“). Vordruckeigene Regeln ergänzt `extra` (siehe weitere.ts).
 */

export interface GenericSpec {
  /** Feld → Stichwörter der Beschreibung („Befund: …“). */
  text?: Record<string, string[]>;
  /** Ankreuzfeld → Stichwort in der Beschreibung. */
  check?: Record<string, RegExp>;
  /** Pflichtfelder (leer = „fehlt“). */
  required?: string[];
  /** Mindestens eines dieser Felder ist auszufüllen bzw. anzukreuzen. */
  oneOf?: { ids: string[]; text: string }[];
  /** Weitere Vorschläge, die die allgemeinen überschreiben. */
  propose?: (text: string, facts: PatientFacts, today: Date) => FieldProposal[];
  /** „genau eins“-Gruppen, die nur unter Bedingungen zu beantworten sind (prüft `extra`). */
  optionalGroups?: string[];
  /** Weitere Prüfungen. */
  extra?: (values: FormValues, facts: PatientFacts) => FormIssue[];
}

const OTHERS: Partial<Record<FilledBy, string>> = {
  versicherter: 'Füllt die/der Versicherte aus.',
  arbeitgeber: 'Füllt der Arbeitgeber aus.',
  krankenhaus: 'Füllt das Krankenhaus aus.',
  leistungserbringer: 'Füllt die Krankenkasse bzw. der Leistungserbringer aus.',
};

const isIcd = (f: FormField) => /icd|diagnoseschlüssel/iu.test(f.label) && f.kind === 'text';
const isDiagnose = (f: FormField) => f.kind === 'text' && /^(?:[\dIVX.]+\s*)?(?:verordnungsrelevante\s+|relevante\s+)?diagnose/iu.test(f.label) && !/icd-10-?code\)?\s*\d*$/iu.test(f.label);
const isToday = (f: FormField) => f.kind === 'date' && /^(ausstellungsdatum|datum)$/iu.test(f.label.trim());
const practice = (f: FormField) => f.filled_by === 'arzt' || f.filled_by === 'praxis';

function own(form: FormDefinition, f: FormField, text: string, facts: PatientFacts, today: Date, spec: GenericSpec, state: { dx: number; codes: string[] }): FieldProposal {
  const seg = labeledSegments(text);
  if (f.kind === 'personalien') return f.filled_by === 'duria' ? prop(form, f.id, 'duria', 'aus DURIA', 'Personalien kommen aus der eGK über DURIA; Name und Anschrift sind in diesem Fenster nicht vorhanden.') : prop(form, f.id, 'leer', null, OTHERS[f.filled_by] ?? 'Füllt die Praxis aus.');
  if (!practice(f)) return prop(form, f.id, 'leer', f.kind === 'checkbox' ? false : null, OTHERS[f.filled_by] ?? 'Nicht von der Praxis auszufüllen.');
  if (f.kind === 'stempel') return prop(form, f.id, 'arzt', null, 'Stempel und persönliche Unterschrift des Arztes – erst nach vollständigem Ausfüllen.');
  if (f.kind === 'letter' && f.filled_by === 'duria') return prop(form, f.id, 'duria', 'aus DURIA', 'Wird von der eGK gelesen.');
  if (f.kind === 'quarter') return prop(form, f.id, 'vorgeschlagen', quarterQJJ(today), 'Quartal der Ausstellung (heute).');
  if (isToday(f)) return prop(form, f.id, 'vorgeschlagen', ttmmjj(today), 'Ausstellungsdatum (heute).');
  if (f.kind === 'checkbox') {
    if (f.id === 'unfall') return checkbox(form, f.id, facts.unfall?.evidence ?? null, 'Wegen oder als Folge eines Unfalls.');
    if (f.id === 'arbeitsunfall') return checkbox(form, f.id, facts.arbeitsunfall?.evidence ?? null, 'Arbeitsunfall.');
    if (f.id === 'ser' || f.id === 'sk_bvg') return checkbox(form, f.id, facts.versorgungsleiden?.evidence ?? null, 'Anerkannte Schädigungsfolge (SER/BVG).');
    const re = spec.check?.[f.id];
    return checkbox(form, f.id, re ? cue(re, text) : null, 'Aus der Beschreibung.');
  }
  const keys = spec.text?.[f.id];
  const v = keys ? segment(seg, ...keys) : null;
  if (v) return prop(form, f.id, f.filled_by === 'arzt' ? 'arzt' : 'vorgeschlagen', v, 'Aus der Beschreibung übernommen – bitte prüfen.', v);
  if (isIcd(f)) {
    const c = state.codes.shift();
    return c ? prop(form, f.id, 'arzt', c, 'ICD-10-GM mit Sicherheit – der Arzt bestätigt.', c) : prop(form, f.id, 'leer', null, 'ICD-10-GM nur vom Arzt, mit Sicherheit (G/V/A/Z).');
  }
  if (isDiagnose(f)) {
    state.dx += 1;
    if (state.dx > 1) return prop(form, f.id, 'leer', null, 'Weitere Diagnose nur bei Bedarf.');
    const phrase = cleanPhrase(segment(seg, 'diagnose') ?? reasonPhrase(text));
    const codes = form.fields.some(isIcd) ? [] : state.codes.splice(0);
    const value = [phrase, ...codes].filter(Boolean).join(' – ') || null;
    return value ? prop(form, f.id, 'arzt', value, 'Wörtlich aus der Beschreibung – der Arzt bestätigt. ICD nur mit Sicherheit G/V/A/Z.', value)
      : prop(form, f.id, 'unbekannt', null, 'Diagnose trägt der Arzt ein; die App erfindet keine Diagnose.');
  }
  return prop(form, f.id, 'leer', null, 'Nur bei Bedarf.');
}

export function proposeGeneric(form: FormDefinition, description: string, facts: PatientFacts, today: Date, spec: GenericSpec = {}): FieldProposal[] {
  const text = norm(description);
  const state = { dx: 0, codes: icdCodes(text).filter((c) => c.certainty).map((c) => `${c.icd} ${c.certainty}`) };
  const base = form.fields.map((f) => own(form, f, text, facts, today, spec, state));
  const override = new Map((spec.propose?.(text, facts, today) ?? []).map((p) => [p.fieldId, p]));
  const out = base.map((p) => override.get(p.fieldId) ?? p);
  // „genau eins“ ohne Treffer: alle Felder der Gruppe sind zu entscheiden.
  for (const g of form.groups.filter((x) => x.select === 'genau_eins' && !spec.optionalGroups?.includes(x.id))) {
    const ids = form.fields.filter((f) => f.group === g.id && practice(f)).map((f) => f.id);
    if (!ids.length || out.some((p) => ids.includes(p.fieldId) && p.value === true)) continue;
    for (const [i, p] of out.entries()) if (ids.includes(p.fieldId)) out[i] = prop(form, p.fieldId, 'unbekannt', null, `${g.label}: nicht aus der Beschreibung erkennbar – bitte wählen.`, null, g.rule.id);
  }
  return out;
}

/** Erste Regel der Felder bzw. ihrer Ankreuzgruppe – für die Fundstelle einer Meldung. */
function ruleOf(form: FormDefinition, ids: string[]): string | null {
  for (const id of ids) {
    const f = form.fields.find((x) => x.id === id);
    const r = f?.rules[0]?.id ?? form.groups.find((g) => g.id === f?.group)?.rule.id;
    if (r) return r;
  }
  return null;
}

export function checkGeneric(form: FormDefinition, values: FormValues, facts: PatientFacts, spec: GenericSpec = {}): FormIssue[] {
  const out: FormIssue[] = [];
  const add = (i: FormIssue | null) => { if (i) out.push(i); };
  const au = form.notes.find((n) => /arbeitsunfall|arbeitsunfäll/iu.test(`${n.id} ${n.text}`) && /nicht/iu.test(n.text));
  if (facts.arbeitsunfall && au) add(issue(form, 'unzulaessig', `Arbeitsunfall, Berufskrankheit oder Schülerunfall („${facts.arbeitsunfall.evidence}“): ${au.text}`, [], au.id));
  for (const g of form.groups.filter((x) => x.select === 'genau_eins' && !spec.optionalGroups?.includes(x.id))) {
    if (form.fields.some((f) => f.group === g.id && practice(f))) add(exactlyOne(form, values, g.id, g.rule.id));
  }
  for (const id of spec.required ?? []) {
    const f = form.fields.find((x) => x.id === id);
    if (f && !textOf(values, id) && values[id] !== true) add(issue(form, 'fehlt', `${f.label.replace(/\s*\(.*$/u, '')}: bitte angeben.`, [id], ruleOf(form, [id])));
  }
  for (const o of spec.oneOf ?? []) {
    if (!o.ids.some((id) => values[id] === true || textOf(values, id))) add(issue(form, 'fehlt', o.text, o.ids, ruleOf(form, o.ids)));
  }
  out.push(...icdIssues(form, values, form.fields.filter((f) => isIcd(f) || isDiagnose(f)).map((f) => f.id)));
  out.push(...(spec.extra?.(values, facts) ?? []));
  out.push(...formatIssues(form, values).filter((i) => i.fieldIds.every((id) => practice(form.fields.find((f) => f.id === id)!))));
  return out;
}
