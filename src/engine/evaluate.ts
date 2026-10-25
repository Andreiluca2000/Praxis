import { sha256Hex } from '../domain/hash.js';
import type {
  BilledService, ConditionResult, ContextDomain, CoverageReport, EvaluationInput, Finding,
  PracticeSettings, Rule, RulePackage, RuleWindow, Tri,
} from '../domain/types.js';
import { combineAll, evaluateExpression } from './expression.js';
import { checkGates, type Mode } from './gates.js';
import { categoryFor, classify } from './outcome.js';
import { isCovered, resolveWindow, type DateRange } from './windows.js';

const SAME_DAY: RuleWindow = { unit: 'day', lookback_periods: 0, anchor: 'service_date' };

/** Fingerabdruck der ergebnisrelevanten Einstellungen (CFG-03: Wechsel invalidiert Ergebnisse). */
export function settingsFingerprint(s: PracticeSettings): string {
  const relevant = { kv: s.region.kv, systems: [...s.available_billing_systems].sort(), hzv: s.hzv };
  return sha256Hex(JSON.stringify(relevant)).slice(0, 16);
}

export function isFindingStale(f: Finding, s: PracticeSettings): boolean {
  return f.settingsFingerprint !== settingsFingerprint(s);
}

interface Ctx { input: EvaluationInput; coverage: CoverageReport[] }

/** Zeitraum, falls die Domäne dort vollständig gelesen wurde; sonst null. Protokolliert die Abdeckung. */
function covered(ctx: Ctx, domain: ContextDomain, window: RuleWindow): DateRange | null {
  const range = resolveWindow(window, ctx.input.serviceDate);
  const complete = range !== null && isCovered(range, domain, ctx.input.coverage);
  const reason = range === null
    ? `Zeitfenster „${window.unit}“ nicht bestimmbar (Behandlungsfall nicht identifiziert).`
    : complete ? 'Vollständig gelesen.' : `Daten ${range.from} bis ${range.to} nicht vollständig gelesen.`;
  const dup = ctx.coverage.some((c) => c.domain === domain && c.required?.from === range?.from && c.required?.to === range?.to);
  if (!dup) ctx.coverage.push({ domain, required: range, complete, reason });
  return complete ? range : null;
}

function billedIn(ctx: Ctx, codes: string[], range: DateRange): BilledService[] {
  return ctx.input.billedServices.filter(
    (b) => b.state === 'active' && codes.includes(b.code) && b.date >= range.from && b.date <= range.to,
  );
}

export function evaluateRule(rule: Rule, input: EvaluationInput, settings: PracticeSettings, mode: Mode): Finding {
  const ctx: Ctx = { input, coverage: [] };
  const gates = checkGates(rule, input, settings, mode);
  const conflicts: string[] = [];
  let existing: BilledService[] = [];
  let conditions: ConditionResult[] = [];
  let state: Tri = 'unknown';

  if (gates.notApplicable.length === 0) {
    for (const rc of rule.required_context) covered(ctx, rc.domain, rc.window);

    // Bereits erfasst? (BILL-04) – Fenster der Abrechnungsdaten, mindestens derselbe Tag.
    const dupWindow = rule.required_context.find((r) => r.domain === 'billed_services')?.window ?? SAME_DAY;
    const dupRange = covered(ctx, 'billed_services', dupWindow);
    existing = dupRange ? billedIn(ctx, rule.procedure_codes, dupRange) : [];

    const expr = evaluateExpression(rule.eligibility, input.facts);
    conditions = [...expr.conditions, ...gates.implicit];
    const states: Tri[] = [expr.state, ...gates.implicit.map((c) => c.state)];

    for (const cr of rule.combination_rules) {
      const range = covered(ctx, 'billed_services', cr.window);
      const found = range ? billedIn(ctx, cr.with_codes, range) : [];
      if (cr.relationship === 'requires_code') {
        const s: Tri = range === null ? 'unknown' : found.length > 0 ? 'fulfilled' : 'not_fulfilled';
        conditions.push({
          label: `erfordert ${cr.with_codes.join(', ')}`, state: s, reason: cr.reason,
          evidence: found.flatMap((f) => f.evidence), source_ids: cr.source_ids,
        });
        states.push(s);
      } else if (found.length > 0) {
        const verb = cr.relationship === 'cannot_combine' ? 'nicht kombinierbar mit' : 'bereits enthalten in';
        conflicts.push(`${verb} ${found.map((f) => `${f.code} (${f.date})`).join(', ')}: ${cr.reason}`);
      }
    }

    for (const fl of rule.frequency_limits) {
      const range = covered(ctx, 'billed_services', fl.window);
      if (range && billedIn(ctx, fl.count_codes, range).length >= fl.max_count) {
        conflicts.push(`Höchstanzahl ${fl.max_count} im Zeitraum ${range.from}–${range.to} bereits erreicht.`);
      }
    }
    state = combineAll(states);
  }

  const outcome = classify({
    notApplicable: gates.notApplicable.length > 0,
    alreadyBilled: existing.length > 0,
    state,
    blocked: gates.blockers.length > 0,
    conflicts: conflicts.length > 0,
    incompleteCoverage: ctx.coverage.some((c) => !c.complete),
  });
  const missing = outcome === 'documentation_incomplete' || outcome === 'not_verifiable';

  return {
    ruleId: rule.id, ruleVersion: rule.version, billingSystem: rule.billing_system,
    contractId: rule.contract_id, serviceDate: input.serviceDate, codes: rule.procedure_codes,
    outcome, category: categoryFor(outcome, rule.result.type), conditions, coverage: ctx.coverage,
    conflicts, blockers: [...gates.notApplicable, ...gates.blockers], existingEntries: existing,
    explanation: missing ? rule.result.missing_evidence_message : rule.result.explanation,
    simulated: mode === 'simulation', requiresHumanConfirmation: true,
    settingsFingerprint: settingsFingerprint(settings),
  };
}

export function evaluatePackage(pkg: RulePackage, input: EvaluationInput, settings: PracticeSettings, mode: Mode): Finding[] {
  if (mode === 'operational' && pkg.content_kind === 'synthetic_example') return [];
  return pkg.rules.map((r) => evaluateRule(r, input, settings, mode));
}
