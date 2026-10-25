import type { EvidenceRef, Facts } from '../domain/types.js';
import type { Mention, MentionStatus } from './extract.js';

/**
 * Bestätigung erkannter Angaben durch den Benutzer → Fakten für den Prüfmotor.
 * - Nur ausdrücklich bestätigte Angaben werden zu `verification: 'confirmed'`.
 * - Widersprüchliche Bestätigungen (z. B. „erbracht“ und „abgelehnt“) bleiben als Widerspruch sichtbar → unknown.
 * - Dauer nur als ausdrücklich bestätigte Zahl (aus Text übernommen oder vom Benutzer eingetragen).
 */

/** Status, die der Benutzer einer Angabe zuweisen kann (entspricht `service.status` im Schema). */
export const SERVICE_STATUSES = ['performed', 'planned', 'recommended', 'refused', 'external', 'historical'] as const;
export type ServiceStatus = (typeof SERVICE_STATUSES)[number];

export interface MentionDecision {
  ref: string;
  /** null = „nicht verwenden“ (z. B. Verneinung, Familienanamnese, irrelevant). */
  status: ServiceStatus | null;
  by: string; // Kürzel
}

export interface FactConfirmation {
  decisions: MentionDecision[];
  durationMinutes: { value: number; by: string; source: 'text' | 'benutzer'; ref: string } | null;
  componentsComplete: { value: boolean; by: string } | null;
}

export const emptyConfirmation = (): FactConfirmation => ({ decisions: [], durationMinutes: null, componentsComplete: null });

/** Vorschlag für die Auswahlliste – Verneinung/Familie/unklar werden nicht als Leistungsstatus vorgeschlagen. */
export function suggestedStatus(m: Mention): ServiceStatus | null {
  const map: Partial<Record<MentionStatus, ServiceStatus>> = {
    performed: 'performed', planned: 'planned', recommended: 'recommended', refused: 'refused', external: 'external', historical: 'historical',
  };
  return map[m.status] ?? null;
}

export function toFacts(c: FactConfirmation): Facts {
  const facts: Facts = {};
  const used = c.decisions.filter((d): d is MentionDecision & { status: ServiceStatus } => d.status !== null);
  if (used.length > 0) {
    const statuses = [...new Set(used.map((d) => d.status))];
    const evidence: EvidenceRef[] = used.map((d) => ({ ref: d.ref }));
    facts['service.status'] = statuses.length === 1
      ? { value: statuses[0]!, verification: 'confirmed', evidence }
      : { value: statuses[0]!, verification: 'confirmed', contradictory: true, evidence };
  }
  if (c.durationMinutes && Number.isFinite(c.durationMinutes.value) && c.durationMinutes.value >= 0) {
    facts['documentation.duration_minutes'] = {
      value: c.durationMinutes.value, verification: 'confirmed', evidence: [{ ref: c.durationMinutes.ref }],
    };
  }
  if (c.componentsComplete) {
    facts['documentation.required_components_complete'] = {
      value: c.componentsComplete.value, verification: 'confirmed', evidence: [{ ref: `benutzer:${c.componentsComplete.by}` }],
    };
  }
  return facts;
}

/** Wurde etwas bestätigt, das sich widerspricht? (für die Anzeige) */
export function conflicts(c: FactConfirmation): string[] {
  const s = [...new Set(c.decisions.flatMap((d) => (d.status ? [d.status] : [])))];
  return s.length > 1 ? [`Widersprüchliche Angaben bestätigt: ${s.join(', ')} – bitte klären.`] : [];
}
