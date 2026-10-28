import { getField, rule } from './catalog.js';
import type { FieldProposal, FieldState, FieldValue, FormDefinition, FormIssue, FormValues, IssueLevel } from './types.js';

/** Bausteine für Vorschläge und Prüfungen; jede Aussage trägt ihre Regel mit Fundstelle. */

export function prop(form: FormDefinition, fieldId: string, state: FieldState, value: FieldValue, reason: string, evidence: string | null = null, ruleId?: string): FieldProposal {
  const field = getField(form, fieldId);
  const r = ruleId ? rule(form, ruleId) : field.rules[0] ?? (field.group ? form.groups.find((g) => g.id === field.group)?.rule ?? null : null);
  return { fieldId, state, value, reason, evidence, rule: r };
}

/** Ankreuzgruppe „genau eins“: gewähltes Feld ankreuzen, die anderen leer; ohne Wahl alle „unbekannt“. */
export function pickOne(form: FormDefinition, groupId: string, chosen: string | null, reason: string, evidence: string | null, ruleId?: string): FieldProposal[] {
  const ids = form.fields.filter((f) => f.group === groupId).map((f) => f.id);
  const g = form.groups.find((x) => x.id === groupId);
  if (!g) throw new Error(`${form.id}: Gruppe ${groupId} fehlt.`);
  return ids.map((id) => {
    if (!chosen) return prop(form, id, 'unbekannt', null, reason, null, ruleId ?? g.rule.id);
    return id === chosen
      ? prop(form, id, 'vorgeschlagen', true, reason, evidence, ruleId)
      : prop(form, id, 'leer', false, `Nicht ankreuzen – „${getField(form, chosen).label}“ ist gewählt.`, null, g.rule.id);
  });
}

export const checkbox = (form: FormDefinition, fieldId: string, evidence: string | null, yesReason: string, ruleId?: string): FieldProposal =>
  evidence
    ? prop(form, fieldId, 'vorgeschlagen', true, yesReason, evidence, ruleId)
    : prop(form, fieldId, 'leer', false, 'Kein Hinweis in der Beschreibung – nicht ankreuzen.', null, ruleId);

export function issue(form: FormDefinition, level: IssueLevel, text: string, fieldIds: string[], ruleId: string | null): FormIssue {
  return { level, text, fieldIds, rule: ruleId ? rule(form, ruleId) : null };
}

export const isChecked = (values: FormValues, id: string): boolean => values[id] === true;
export const textOf = (values: FormValues, id: string): string => (typeof values[id] === 'string' ? (values[id] as string).trim() : '');

/** Prüft eine „genau eins“-Gruppe: keine Wahl = fehlt, mehrere = unzulässig. */
export function exactlyOne(form: FormDefinition, values: FormValues, groupId: string, ruleId: string): FormIssue | null {
  const ids = form.fields.filter((f) => f.group === groupId).map((f) => f.id);
  const on = ids.filter((id) => isChecked(values, id));
  const label = form.groups.find((g) => g.id === groupId)?.label ?? groupId;
  if (on.length === 0) return issue(form, 'fehlt', `${label}: genau ein Feld ankreuzen.`, ids, ruleId);
  if (on.length > 1) return issue(form, 'unzulaessig', `${label}: nur ein Feld ankreuzen (angekreuzt: ${on.map((id) => getField(form, id).label).join(', ')}).`, on, ruleId);
  return null;
}

const TTMMJJ = /^(\d{2})(\d{2})(\d{2})$/;

/** TTMMJJ mit gültigem Kalenderdatum. */
export function validTTMMJJ(v: string): boolean {
  const m = TTMMJJ.exec(v);
  if (!m) return false;
  const iso = `20${m[3]}-${m[2]}-${m[1]}`;
  const d = new Date(`${iso}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().startsWith(iso);
}

/** Formatprüfung aller Datums- und Quartalsfelder eines Vordrucks. */
export function formatIssues(form: FormDefinition, values: FormValues): FormIssue[] {
  const out: FormIssue[] = [];
  for (const f of form.fields) {
    const v = textOf(values, f.id);
    if (!v) continue;
    if (f.format === 'TTMMJJ' && !validTTMMJJ(v)) out.push(issue(form, 'unzulaessig', `${f.label}: Datum als TTMMJJ eintragen (z. B. 311026), „${v}“ ist kein gültiges Datum.`, [f.id], f.rules[0]?.id ?? null));
    if (f.format === 'QJJ' && !/^[1-4]\d{2}$/.test(v)) out.push(issue(form, 'unzulaessig', `${f.label}: Quartal als QJJ eintragen (z. B. 426 für 4/2026).`, [f.id], f.rules[0]?.id ?? null));
    if (f.format === 'hhmm' && !/^([01]\d|2[0-3])[0-5]\d$/.test(v)) out.push(issue(form, 'unzulaessig', `${f.label}: Uhrzeit als hhmm eintragen (z. B. 0815).`, [f.id], f.rules[0]?.id ?? null));
    if (f.kind === 'number' && !/^\d{1,2}$/.test(v)) out.push(issue(form, 'unzulaessig', `${f.label}: nur eine Zahl eintragen.`, [f.id], null));
  }
  return out;
}

/** Werte aus dem Vorschlag (Ausgangspunkt für die Bearbeitung in der Oberfläche). */
export function valuesOf(fields: FieldProposal[]): Record<string, FieldValue> {
  return Object.fromEntries(fields.map((f) => [f.fieldId, f.value]));
}
