import { Combine, ShieldCheck, Undo2 } from 'lucide-react';
import { useState } from 'react';
import type { PairFinding, PairReport } from '../src/engine/pairs.js';
import type { WindowFinding } from '../src/engine/window-rules.js';
import { PairEvidence, VERDICT } from './PairEvidence.js';
import { WindowFindings } from './WindowFindings.js';

/** Für diese Befunde kann ein Arzt „getrennte Sitzungen dokumentiert“ bestätigen (bei gleicher Uhrzeit hält die Prüfung den Ausschluss). */
const CONFIRMABLE = new Set<PairFinding['verdict']>(['not_verifiable', 'exception_review']);

/**
 * Paare „nicht nebeneinander je Sitzung“ der erfassten Leistungen des geöffneten Patienten (Entwurfs-Dossier, nur Simulator).
 * Die Bestätigung getrennter Sitzungen ist eine bewusste Handlung eines Arztes mit Kürzel und Zeit – nie automatisch.
 */
export function PatientPairs({ report, isArzt, onConfirm, onRevoke, windowFindings = [], windowSkipped = {} }: {
  report: PairReport;
  isArzt: boolean;
  windowFindings?: WindowFinding[];
  windowSkipped?: Record<string, number>;
  onConfirm: (f: PairFinding) => void;
  onRevoke: (f: PairFinding) => void;
}) {
  const [asking, setAsking] = useState<string | null>(null);
  const keyOf = (f: PairFinding) => `${f.clauseId}@${f.date}`;
  const excluded = report.findings.filter((f) => f.verdict === 'excluded').length;

  return (
    <section className="card">
      <div className="row">
        <h2 style={{ margin: 0 }}><Combine size={22} aria-hidden="true" />Kombinationen je Sitzung <span className="muted">Entwurf · nicht freigegeben</span></h2>
        <span className="spacer" />
        <span className={`pill ${excluded ? 'billing_conflict' : 'candidate'}`}>{excluded} Ausschlüsse</span>
        <span className="pill">{report.findings.length - excluded} weitere</span>
      </div>
      <p className="muted">
        Grundlage ist ein ungeprüfter Entwurf (nur Q4/2026). Ein fehlendes Paar bedeutet nicht „kombinierbar“ – „nicht neben“
        ohne Zeitraum und Abschnitte ohne belegte Zuordnung werden nicht geprüft (siehe unten).
      </p>
      {report.skipped && <p className="muted">{report.skipped}</p>}
      {report.outOfRange > 0 && <p className="muted">{report.outOfRange} Leistungstage außerhalb Q4/2026 wurden nicht geprüft.</p>}
      {report.findings.map((f) => {
        const k = keyOf(f);
        return (
          <div key={`${k}-${f.verdict}`} className="finding">
            <div className="row">
              <span className={`pill ${VERDICT[f.verdict].pill}`}>{VERDICT[f.verdict].label}</span>
              <strong>{f.codes.join(' + ')}</strong>
              <span className="muted">{f.date}</span>
              <span className="spacer" />
              {CONFIRMABLE.has(f.verdict) && isArzt && asking !== k && (
                <button className="soft" onClick={() => setAsking(k)}><ShieldCheck size={16} aria-hidden="true" />Getrennte Sitzungen dokumentiert</button>
              )}
              {f.verdict === 'separate_confirmed' && isArzt && (
                <button className="link" onClick={() => onRevoke(f)}><Undo2 size={15} aria-hidden="true" />Bestätigung zurücknehmen</button>
              )}
            </div>
            <p style={{ margin: '8px 0 0' }}>{f.text} <span className="muted">({f.sessionNote})</span></p>
            {CONFIRMABLE.has(f.verdict) && !isArzt && <p className="muted">Getrennte Sitzungen kann nur ein Arzt bestätigen.</p>}
            {asking === k && (
              <div className="confirm-box" role="group" aria-label="Bestätigung getrennter Sitzungen">
                <p>In der Karteikarte sind für {f.date} <strong>zwei getrennte Sitzungen</strong> dokumentiert (eigener Anlass und Kontakt), nicht nur verschiedene Uhrzeiten?</p>
                <div className="row">
                  <button className="primary" onClick={() => { onConfirm(f); setAsking(null); }}>Ja, bestätigen</button>
                  <button onClick={() => setAsking(null)}>Abbrechen</button>
                </div>
              </div>
            )}
            <details>
              <summary>Beleg ({f.clauseId})</summary>
              <PairEvidence items={f.evidence} />
              {f.exceptions.map((x) => <div key={x.id}><strong>Ausnahme {x.id}</strong><PairEvidence items={x.evidence} /></div>)}
            </details>
          </div>
        );
      })}
      <WindowFindings findings={windowFindings} skipped={windowSkipped} />
    </section>
  );
}
