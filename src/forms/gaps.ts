import type { FieldState, FieldValue, FormDefinition, FormIssue } from './types.js';

/**
 * Was am Vordruck noch offen ist, und warum:
 * - fehlt: Pflichtangabe, die weder in der Beschreibung noch in der Kartei gefunden wurde („!“)
 * - entscheidung: es gibt mehrere zulässige Möglichkeiten, die Person entscheidet („?“)
 * - empfohlen: freiwillige Angabe, nicht gefunden (grau)
 */
export type Need = 'fehlt' | 'entscheidung' | 'empfohlen';

const filled = (v: FieldValue | undefined) => v === true || (typeof v === 'string' && v.trim() !== '');

export function needOf(
  form: FormDefinition,
  fieldIds: readonly string[],
  values: Readonly<Record<string, FieldValue>>,
  states: Readonly<Record<string, FieldState>>,
  issues: readonly FormIssue[],
): Need | null {
  const fields = form.fields.filter((f) => fieldIds.includes(f.id));
  const group = fields[0]?.group ? form.groups.find((g) => g.id === fields[0]!.group) : undefined;
  const missing = issues.some((i) => i.level === 'fehlt' && i.fieldIds.some((id) => fieldIds.includes(id)));
  if (group?.select === 'genau_eins') {
    return fields.some((f) => values[f.id] === true) ? (missing ? 'fehlt' : null) : 'entscheidung';
  }
  if (missing) return 'fehlt';
  const f = fields[0];
  if (!f || fields.length > 1 || f.kind === 'checkbox' || f.kind === 'stempel' || f.kind === 'personalien' || f.filled_by === 'duria') return null;
  if (filled(values[f.id]) || states[f.id] === 'leer') return null;
  // „unbekannt“ = die Regeln erwarten hier etwas, gefunden wurde nichts.
  return states[f.id] === 'unbekannt' ? 'fehlt' : 'empfohlen';
}

/** Begründung in einfachen Worten; berücksichtigt, ob ein Patient (Kartei) geöffnet ist. */
export function needReason(need: Need, karteiOpen: boolean): string {
  const where = karteiOpen ? 'weder in der Beschreibung noch in der Kartei' : 'nicht in der Beschreibung (kein Patient geöffnet)';
  if (need === 'fehlt') return `Nicht gefunden – ${where}. Bitte ergänzen.`;
  if (need === 'entscheidung') return `Kein eindeutiger Hinweis – ${where}. Bitte selbst entscheiden.`;
  return `Nicht gefunden – ${where}. Freiwillig, aber empfohlen.`;
}
