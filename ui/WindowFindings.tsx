import { CalendarRange } from 'lucide-react';
import type { WindowFinding, WindowVerdict } from '../src/engine/window-rules.js';
import { PairEvidence } from './PairEvidence.js';

const VERDICT: Record<WindowVerdict, { label: string; pill: string }> = {
  excluded: { label: 'Ausschluss', pill: 'billing_conflict' },
  limit_exceeded: { label: 'Höchstzahl überschritten', pill: 'billing_conflict' },
  exception_review: { label: 'Ausnahme prüfen', pill: 'not_verifiable' },
  not_verifiable: { label: 'nicht prüfbar', pill: 'not_applicable' },
};

type Row = WindowFinding & { caseIndex?: number; patientToken?: string | null };

/**
 * Ausschlüsse mit Zeitraum (Tag, Woche, Behandlungsfall, Krankheitsfall, 21 Tage postoperativ) und Höchstanzahlen
 * aus den Codex-Dossiers (Entwurf). „nicht neben“ ohne Zeitraum ist nur gezählt, nicht geprüft.
 */
export function WindowFindings({ findings, skipped }: { findings: Row[]; skipped: Record<string, number> }) {
  const notChecked = Object.entries(skipped).reduce((n, [, v]) => n + v, 0);
  return (
    <div className="window-findings">
      <h3><CalendarRange size={18} aria-hidden="true" />Ausschlüsse je Tag, Woche und Fall · Höchstanzahlen <span className="muted">Entwurf</span></h3>
      {findings.length === 0 && <p className="muted">Keine Treffer.</p>}
      {findings.map((f, i) => (
        <div key={`${f.clauseId}-${f.codes.join('+')}-${f.dates.join(',')}-${i}`} className="finding">
          <div className="row">
            <span className={`pill ${VERDICT[f.verdict].pill}`}>{VERDICT[f.verdict].label}</span>
            <strong>{f.codes.join(' + ')}</strong>
            <span className="muted">{f.dates.join(', ')}</span>
            {f.caseIndex !== undefined && <span className="muted">· Fall #{f.caseIndex + 1}{f.patientToken ? ` · ${f.patientToken.slice(0, 10)}` : ''}</span>}
          </div>
          <p style={{ margin: '8px 0 0' }}>{f.text}</p>
          <details>
            <summary>Beleg ({f.clauseId} · {f.dossier})</summary>
            <PairEvidence items={f.evidence} />
          </details>
        </div>
      ))}
      {notChecked > 0 && (
        <p className="muted">
          Nicht geprüft ({notChecked} Klauseln): {Object.entries(skipped).map(([k, v]) => `${k} ${v}`).join(' · ')} – diese bleiben zur Prüfung durch die Abrechnung.
        </p>
      )}
    </div>
  );
}
