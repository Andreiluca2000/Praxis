import { Combine } from 'lucide-react';
import { useState } from 'react';
import type { QuarterCombinations } from '../src/kvdt/quarter-check.js';
import { PairEvidence as Evidence, VERDICT } from './PairEvidence.js';
import { WindowFindings } from './WindowFindings.js';

/** Paare „nicht nebeneinander je Sitzung“ aus dem Entwurfs-Dossier – Hinweise zur Prüfung, keine Entscheidung. */
export function CombinationsPanel({ combinations }: { combinations: QuarterCombinations }) {
  const [onlyExcluded, setOnlyExcluded] = useState(false);
  const shown = combinations.findings.filter((f) => !onlyExcluded || f.verdict === 'excluded');
  const excluded = combinations.findings.filter((f) => f.verdict === 'excluded').length;

  return (
    <section className="card">
      <div className="row">
        <h2 style={{ margin: 0 }}><Combine size={22} aria-hidden="true" />Kombinationen je Sitzung <span className="muted">Entwurf · nicht freigegeben</span></h2>
        <span className={`pill ${excluded ? 'billing_conflict' : 'candidate'}`}>{excluded} Ausschlüsse</span>
        <span className="pill">{combinations.findings.length - excluded} zu prüfen</span>
        <span className="spacer" />
        <label className="inline"><input type="checkbox" checked={onlyExcluded} onChange={(e) => setOnlyExcluded(e.target.checked)} /> nur Ausschlüsse</label>
      </div>
      <p className="warn">
        ⚠ Grundlage ist ein ungeprüfter Entwurf (Dossier {combinations.schemaVersion}, nur Q4/2026). Ergebnisse sind Hinweise für die
        Abrechnungsprüfung, keine Entscheidung. Ein fehlendes Paar bedeutet nicht „kombinierbar“ – „nicht neben“ ohne Zeitraum und
        Abschnitte ohne belegte Zuordnung werden nicht geprüft (siehe unten).
      </p>
      {combinations.outOfRange > 0 && <p className="muted">{combinations.outOfRange} Leistungstage außerhalb Q4/2026 wurden nicht geprüft.</p>}
      {shown.length === 0 && <p className="muted">Keine Paare aus dem Dossier gefunden.</p>}
      <table>
        <thead><tr><th>Fall</th><th>Patient</th><th>Tag</th><th>Art</th><th>Befund</th></tr></thead>
        <tbody>
          {shown.map((f, i) => (
            <tr key={`${f.caseIndex}-${f.clauseId}-${f.date}-${i}`}>
              <td>#{f.caseIndex + 1}</td>
              <td className="muted">{f.patientToken?.slice(0, 10) ?? '–'}</td>
              <td>{f.date}</td>
              <td><span className={`pill ${VERDICT[f.verdict].pill}`}>{VERDICT[f.verdict].label}</span></td>
              <td>
                {f.text} <span className="muted">({f.sessionNote})</span>
                <details>
                  <summary>Beleg ({f.clauseId})</summary>
                  <Evidence items={f.evidence} />
                  {f.exceptions.map((x) => (
                    <div key={x.id}><strong>Ausnahme {x.id}</strong><Evidence items={x.evidence} /></div>
                  ))}
                </details>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <WindowFindings findings={combinations.windowFindings} skipped={combinations.windowSkipped} />
    </section>
  );
}
