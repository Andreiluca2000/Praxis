import type { ErrorObject } from 'ajv';
// Vorkompilierte Prüfer (scripts/build-validators.ts): zur Laufzeit wird kein Code erzeugt,
// daher braucht das Fenster kein 'unsafe-eval' in der CSP. Ein Test stellt sicher, dass sie zu den Schemas passen.
import { rules as rulesValidator, settings as settingsValidator } from './validators.generated.js';
import { isIsoDate } from '../domain/dates.js';
import type { Expression, PracticeSettings, Rule, RulePackage } from '../domain/types.js';

/**
 * Zweistufige Prüfung: (1) JSON-Schema (Form), (2) semantische Pflichtprüfungen aus
 * BILLING_RULES.md, die das Schema nicht ausdrücken kann.
 */

interface CompiledValidator {
  (data: unknown): boolean;
  errors?: ErrorObject[] | null;
}

function validators(): { rules: CompiledValidator; settings: CompiledValidator } {
  return { rules: rulesValidator, settings: settingsValidator };
}

export interface ValidationResult<T> {
  ok: boolean;
  value: T | null;
  errors: string[];
}

function fmtErrors(errors: ErrorObject[] | null | undefined): string[] {
  return (errors ?? []).map((e) => `Schema ${e.instancePath || '/'}: ${e.message ?? 'ungültig'}`);
}

export function validateSettings(data: unknown): ValidationResult<PracticeSettings> {
  const v = validators().settings;
  if (!v(data)) return { ok: false, value: null, errors: fmtErrors(v.errors) };
  const s = data as PracticeSettings;
  const errors: string[] = [];
  const ids = new Set<string>();
  for (const c of s.hzv.contracts) {
    if (ids.has(c.contract_id)) errors.push(`HZV-Vertrag doppelt: ${c.contract_id}`);
    ids.add(c.contract_id);
    if (!isIsoDate(c.valid_from) || (c.valid_to !== null && !isIsoDate(c.valid_to))) {
      errors.push(`HZV-Vertrag ${c.contract_id}: ungültiges Datum`);
    } else if (c.valid_to !== null && c.valid_to < c.valid_from) {
      errors.push(`HZV-Vertrag ${c.contract_id}: Ende vor Beginn`);
    }
  }
  return { ok: errors.length === 0, value: errors.length === 0 ? s : null, errors };
}

function collectSourceIds(e: Expression, out: string[]): string[] {
  if (e.kind === 'fact') out.push(...e.source_ids);
  else if (e.kind === 'not') collectSourceIds(e.item, out);
  else e.items.forEach((i) => collectSourceIds(i, out));
  return out;
}

/** Semantische Prüfung einer einzelnen Regel (unabhängig vom Paket). */
export function semanticRuleErrors(rule: Rule): string[] {
  const p = `Regel ${rule.id}@${rule.version}`;
  const errors: string[] = [];
  if (!isIsoDate(rule.valid_from)) errors.push(`${p}: valid_from ungültig`);
  if (rule.valid_to !== null && !isIsoDate(rule.valid_to)) errors.push(`${p}: valid_to ungültig`);
  if (rule.valid_to !== null && rule.valid_to < rule.valid_from) errors.push(`${p}: Zeitraum umgekehrt`);

  const sourceIds = new Set<string>();
  for (const s of rule.sources) {
    if (sourceIds.has(s.id)) errors.push(`${p}: Quelle doppelt: ${s.id}`);
    sourceIds.add(s.id);
  }
  const referenced = [
    ...collectSourceIds(rule.eligibility, []),
    ...rule.combination_rules.flatMap((c) => c.source_ids),
    ...rule.frequency_limits.flatMap((f) => f.source_ids),
  ];
  for (const id of referenced) {
    if (!sourceIds.has(id)) errors.push(`${p}: Quellenverweis nicht auflösbar: ${id}`);
  }
  if (rule.status === 'active' && rule.reviews.clinical.state === 'not_applicable' && !rule.reviews.clinical.rationale?.trim()) {
    errors.push(`${p}: klinische Prüfung „not_applicable“ ohne Begründung`);
  }
  return errors;
}

export function validateRulePackage(data: unknown): ValidationResult<RulePackage> {
  const v = validators().rules;
  if (!v(data)) return { ok: false, value: null, errors: fmtErrors(v.errors) };
  const pkg = data as RulePackage;
  const errors = pkg.rules.flatMap(semanticRuleErrors);

  // Eindeutigkeit (id, version) und keine überlappenden Gültigkeiten gleicher id.
  const seen = new Set<string>();
  const byId = new Map<string, Rule[]>();
  for (const r of pkg.rules) {
    const key = `${r.id}@${r.version}`;
    if (seen.has(key)) errors.push(`Regel doppelt: ${key}`);
    seen.add(key);
    byId.set(r.id, [...(byId.get(r.id) ?? []), r]);
  }
  for (const [id, versions] of byId) {
    const live = versions.filter((r) => r.status !== 'retired').sort((a, b) => (a.valid_from < b.valid_from ? -1 : 1));
    for (let i = 1; i < live.length; i++) {
      const prev = live[i - 1]!;
      const cur = live[i]!;
      if (prev.valid_to === null || prev.valid_to >= cur.valid_from) {
        errors.push(`Regel ${id}: Gültigkeit von ${prev.version} und ${cur.version} überschneidet sich`);
      }
    }
  }
  return { ok: errors.length === 0, value: errors.length === 0 ? pkg : null, errors };
}
