import { useState } from 'react';
import type { FertigProposal, FertigReport } from '../src/core/fertig.js';

/**
 * Ergebnis von „Fertig“. Jeder Vorschlag wird einzeln angenommen oder verworfen.
 * Angenommene Vorschläge werden als Text mit Kürzel zusammengestellt (Notiz an DURIA bzw. zum Kopieren) –
 * das Programm trägt nichts selbst in DURIA ein.
 */
export function FertigPanel({ report, kuerzel, isArzt, onAcceptAsNote }: {
  report: FertigReport;
  kuerzel: string;
  isArzt: boolean;
  onAcceptAsNote: (text: string) => void;
}) {
  const [decision, setDecision] = useState<Record<number, 'angenommen' | 'verworfen'>>({});
  const accepted = report.proposals.filter((p, i) => decision[i] === 'angenommen');

  const summary = accepted.map((p) => `- ${p.title}${p.detail ? ` (${p.detail})` : ''}`).join('\n');
  const text = accepted.length ? `[${kuerzel}] Angenommen nach Abschlussprüfung ${report.serviceDate}:\n${summary}` : '';

  return (
    <section className="card">
      <h2>Abschlussprüfung <span className="muted">Quartal {report.quarter.from} – {report.quarter.to}</span></h2>
      {report.proposals.length === 0 && <p className="muted">Keine Hinweise. (Ohne freigegebene Regeln werden keine Ziffern vorgeschlagen.)</p>}
      {report.proposals.map((p: FertigProposal, i) => (
        <div key={i} className={`finding ${decision[i] ?? ''}`}>
          <div className="row">
            <span className={`pill ${p.readiness === 'bereit' ? 'candidate' : p.readiness === 'klaerung' ? 'not_verifiable' : 'not_applicable'}`}>
              {{ bereit: 'Vorschlag', klaerung: 'Klärung nötig', info: 'Hinweis' }[p.readiness]}
            </span>
            <strong>{p.title}</strong>
            <span className="spacer" />
            {p.readiness !== 'info' && isArzt && (
              <>
                <button onClick={() => setDecision({ ...decision, [i]: 'angenommen' })} disabled={decision[i] === 'angenommen'}>Annehmen</button>
                <button className="link" onClick={() => setDecision({ ...decision, [i]: 'verworfen' })}>Verwerfen</button>
              </>
            )}
          </div>
          <p className="muted">{p.detail}</p>
          {p.finding && p.finding.conditions.length > 0 && (
            <ul className="conds">{p.finding.conditions.map((c, j) => <li key={j} className={c.state}>{c.label}: {c.reason}</li>)}</ul>
          )}
        </div>
      ))}
      {accepted.length > 0 && (
        <div className="row" style={{ marginTop: 12 }}>
          <button className="primary" onClick={() => onAcceptAsNote(text)}>Angenommenes als Notiz übernehmen</button>
          <button onClick={() => navigator.clipboard.writeText(text)}>Kopieren</button>
        </div>
      )}
    </section>
  );
}
