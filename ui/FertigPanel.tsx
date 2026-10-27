import { CircleCheckBig } from 'lucide-react';
import { useState } from 'react';
import type { BillingEntry, FertigProposal, FertigReport } from '../src/core/fertig.js';
import { VERDICT } from './PairEvidence.js';

/**
 * Ergebnis von „Fertig“. Der Arzt nimmt jeden Vorschlag einzeln an oder verwirft ihn.
 * Angenommene Ziffern/Diagnosen gehen als ABRECHNUNGSDATEN an DURIA (nicht als Notiz).
 * „Klärung nötig“ kann erst angenommen werden, wenn alles Nötige ergänzt ist (z. B. ICD + G/V/A/Z).
 */
export function FertigPanel({ report, isArzt, billingEnabled, onSubmit }: {
  report: FertigReport;
  isArzt: boolean;
  billingEnabled: boolean;
  onSubmit: (entries: BillingEntry[]) => Promise<string>;
}) {
  const [decision, setDecision] = useState<Record<number, 'angenommen' | 'verworfen'>>({});
  const [result, setResult] = useState('');
  const [busy, setBusy] = useState(false);

  const accepted = report.proposals.flatMap((p, i) => (decision[i] === 'angenommen' ? p.entries : []));
  const label = (e: BillingEntry) =>
    e.type === 'ziffer' ? `Ziffer ${e.code} (${e.system}) am ${e.date}` : `Diagnose ${e.icd} ${e.certainty} am ${e.date}`;

  async function submit() {
    setBusy(true);
    try { setResult(await onSubmit(accepted)); } catch (e) { setResult(String(e)); } finally { setBusy(false); }
  }

  return (
    <section className="card">
      <h2><CircleCheckBig size={22} aria-hidden="true" />Abschlussprüfung <span className="muted">Quartal {report.quarter.from} – {report.quarter.to}</span></h2>
      {report.proposals.length === 0 && <p className="muted">Keine Hinweise. (Ohne freigegebene Regeln werden keine Ziffern vorgeschlagen.)</p>}
      {report.proposals.map((p: FertigProposal, i) => (
        <div key={i} className={`finding ${decision[i] ?? ''}`}>
          <div className="row">
            <span className={`pill ${p.readiness === 'bereit' ? 'candidate' : p.readiness === 'klaerung' ? 'not_verifiable' : 'not_applicable'}`}>
              {{ bereit: 'Vorschlag', klaerung: 'Klärung nötig', info: 'Hinweis' }[p.readiness]}
            </span>
            <strong>{p.title}</strong>
            <span className="spacer" />
            {p.readiness === 'bereit' && isArzt && (
              <>
                <button onClick={() => setDecision({ ...decision, [i]: 'angenommen' })} disabled={decision[i] === 'angenommen'}>Annehmen</button>
                <button className="link" onClick={() => setDecision({ ...decision, [i]: 'verworfen' })}>Verwerfen</button>
              </>
            )}
          </div>
          <p className="muted">{p.detail}</p>
          {p.entries.length > 0 && <p className="muted">Wird eingetragen: {p.entries.map(label).join(' · ')}</p>}
          {p.finding && p.finding.conditions.length > 0 && (
            <ul className="conds">{p.finding.conditions.map((c, j) => <li key={j} className={c.state}>{c.label}: {c.reason}</li>)}</ul>
          )}
          {p.practiceNotes?.map((n, j) => (
            <p key={`pr-${j}`} className="pair-hint">
              <span className={`pill ${n.type === 'zurueck' || n.type === 'pflicht' ? 'not_verifiable' : 'candidate'}`}>Praxisregel</span>{n.text} <span className="muted">({n.title}, v{n.version})</span>
            </p>
          ))}
          {p.pairFindings?.map((f) => (
            <p key={`${f.clauseId}@${f.date}`} className="pair-hint">
              <span className={`pill ${VERDICT[f.verdict].pill}`}>{VERDICT[f.verdict].label}</span>{f.text} <span className="muted">(Entwurf)</span>
            </p>
          ))}
        </div>
      ))}
      {accepted.length > 0 && (
        <div className="row" style={{ marginTop: 12 }}>
          <button className="primary" disabled={busy || !billingEnabled} onClick={submit}>
            {accepted.length} angenommene Einträge in DURIA übernehmen
          </button>
          {!billingEnabled && <span className="warn">Übernahme von Ziffern/Diagnosen ist in den Einstellungen aus (wartet auf Bestätigung durch DURIA).</span>}
        </div>
      )}
      {result && <p role="status">{result}</p>}
    </section>
  );
}
