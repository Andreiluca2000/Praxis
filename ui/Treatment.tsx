import { ArrowRight, ClipboardList, Download, NotebookPen, Stethoscope, UserRound, X } from 'lucide-react';
import { useEffect, useReducer, useState } from 'react';
import type { AnalysisResponse } from '../src/core/analyze.js';
import type { FertigReport } from '../src/core/fertig.js';
import { correctionText, proposeCorrections, type Correction } from '../src/corrections/corrections.js';
import { emptyConfirmation, toFacts, type FactConfirmation } from '../src/facts/confirm.js';
import { CorrectionsPanel } from './CorrectionsPanel.js';
import type { NoteForm, PublicAccount } from '../src/notes/note.js';
import { Dictation } from './Dictation.js';
import { FactPanel } from './FactPanel.js';
import { FertigPanel } from './FertigPanel.js';
import { NoteCard } from './NoteCard.js';
import { loadPairDossier } from './pairDossier.js';
import { PatientPairs } from './PatientPairs.js';
import { api, type ExportFilter, type SanitizedExport } from './platform.js';
import { today, type TreatmentSession } from './session.js';

/** Hauptansicht der Behandlung: Patient aus DURIA, Diktat/Notizen, „Fertig“. */
export function Treatment({ session, user, billingEnabled }: { session: TreatmentSession; user: PublicAccount; billingEnabled: boolean }) {
  const [, rerender] = useReducer((n: number) => n + 1, 0);
  const [date, setDate] = useState(today());
  const [analysis, setAnalysis] = useState<AnalysisResponse | null>(null);
  const [quarter, setQuarter] = useState(false);
  const [report, setReport] = useState<FertigReport | null>(null);
  const [confirmation, setConfirmation] = useState<FactConfirmation>(emptyConfirmation());
  const [corrections, setCorrections] = useState<Correction[]>([]);
  const [fertigBusy, setFertigBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const [filter, setFilter] = useState<ExportFilter | null>(null);
  const [pairError, setPairError] = useState('');

  function load(x: SanitizedExport) {
    try {
      setAnalysis(session.load(x.data, x.format, date, x.token));
      setFilter(x.filter);
      setConfirmation(emptyConfirmation());
      setCorrections([]);
      setReport(null);
      setMsg(x.patientIds > 1 ? 'Export enthält mehrere Patienten – gesperrt.' : '');
    } catch (e) { setMsg(String(e)); }
    rerender();
  }

  // Paar-Dossier (Entwurf) nur im Simulator laden; es gilt für alle Patienten dieser Sitzung.
  useEffect(() => {
    if (session.mode !== 'simulation') return session.setPairRegistry(null);
    loadPairDossier().then((r) => {
      if ('error' in r) setPairError(r.error); else session.setPairRegistry(r);
      rerender();
    }).catch((e) => setPairError(String(e)));
  }, [session, session.mode]);

  // Übergabe, die schon vor dem Öffnen dieser Ansicht eingegangen ist (z. B. direkt nach der Anmeldung).
  useEffect(() => {
    api.takeIncoming().then((x) => { if (x) load(x); }).catch((e) => setMsg(String(e)));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // DURIA legt beim Aufruf eine GDT-Datei ab → Rust bereinigt sie → automatisch laden.
  useEffect(() => {
    const unlisten = api.onGdt(load);
    return () => { unlisten.then((f) => f()); };
  });

  async function openFile() {
    try {
      const f = await api.pickExport();
      if (f) load(f);
    } catch (e) { setMsg(String(e)); }
  }

  // Behandlungstag geändert → Angaben dieses Tages neu ermitteln (bestätigte Angaben gelten nur für ihren Tag).
  useEffect(() => {
    if (!session.hasPatient) return;
    try {
      setAnalysis(session.reanalyse(date, {}, null));
      setConfirmation(emptyConfirmation());
      setReport(null);
    } catch (e) { setMsg(String(e)); }
  }, [date]); // eslint-disable-line react-hooks/exhaustive-deps

  async function onText(text: string, form: NoteForm) {
    await session.notes.add(user, text, form, date);
    rerender();
  }

  async function release(id: string) {
    try {
      const n = session.notes.release(user, id);
      rerender();
      setMsg(await session.send(n));
    } catch (e) { setMsg(String(e)); }
  }

  /** „Fertig“: läuft im Hintergrund; die Oberfläche bleibt bedienbar. */
  function fertig() {
    setFertigBusy(true);
    // Nur ausdrücklich bestätigte Angaben gehen in die Prüfung.
    session.fertig(date, toFacts(confirmation), quarter)
      .then((r) => {
        setReport(r);
        // Korrekturvorschläge (Diktat vs. DURIA, Konflikte) zur Liste hinzufügen – noch nicht festgelegt.
        const snap = session.snapshot;
        const proposals = proposeCorrections({
          date, report: r, notes: session.notes.list,
          recordedDiagnoses: snap?.diagnoses ?? [], recordedServices: snap?.services ?? [],
        });
        setCorrections((old) => {
          const known = new Set(old.map(correctionText));
          return [...old, ...proposals.filter((p) => !known.has(correctionText(p)))];
        });
      }, (e) => setMsg(String(e)))
      .finally(() => setFertigBusy(false));
  }

  const snap = analysis?.snapshot;
  const pairReport = session.hasPatient ? session.pairs() : null;
  function confirmPair(clauseId: string, day: string) {
    try { session.confirmSeparate(user, clauseId, day); setReport(null); } catch (e) { setMsg(String(e)); }
    rerender();
  }
  return (
    <div className="stack">
      <section className="card">
        <div className="row">
          <h2 style={{ margin: 0 }}><UserRound size={22} aria-hidden="true" />Patient</h2>
          <span className={`pill ${session.hasPatient ? 'candidate' : 'not_applicable'}`}>
            {session.hasPatient ? `Kontext ${analysis?.context?.patientToken.slice(0, 8)}…` : 'kein Patient geladen'}
          </span>
          <span className="spacer" />
          <label>Behandlungstag<input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></label>
          <button onClick={openFile}><Download size={17} aria-hidden="true" />Export öffnen …</button>
          {session.hasPatient && <button className="soft" onClick={() => { session.clear(); setAnalysis(null); setReport(null); rerender(); }}><X size={17} aria-hidden="true" />Schließen</button>}
        </div>
        {!session.hasPatient && <p className="muted">Patient in DURIA aufrufen (GDT) oder Export öffnen. Name und Geburtsdatum werden nicht übernommen.</p>}
        {snap && (
          <>
            <div className="stats">
              <div className="stat"><span className="ico"><ClipboardList size={19} aria-hidden="true" /></span><div><span>Leistungen</span><b>{snap.services.length}</b></div></div>
              <div className="stat"><span className="ico"><Stethoscope size={19} aria-hidden="true" /></span><div><span>Diagnosen</span><b>{snap.diagnoses.length}</b></div></div>
              <div className="stat"><span className="ico"><NotebookPen size={19} aria-hidden="true" /></span><div><span>Notizen</span><b>{snap.noteCount}</b></div></div>
            </div>
            <p className="muted">
              Verworfene Identitätsfelder {(filter?.dropped ?? 0) + snap.droppedIdentityFields}
              {filter && filter.redacted > 0 && <> · {filter.redacted} Namen/Daten im Text ersetzt</>}
              {filter && filter.unknown > 0 && <> · {filter.unknown} nicht vorgesehene Felder nicht übernommen</>}
            </p>
            {filter && filter.invalid > 0 && <p className="warn">⚠ {filter.invalid} Zeilen ohne gültigen Aufbau wurden nicht übernommen – Export ggf. unvollständig.</p>}
            {snap.warnings.map((w, i) => <p key={i} className="warn">⚠ {w}</p>)}
          </>
        )}
        {analysis?.blocked && <p className="error">Analyse gesperrt: {analysis.blocked}</p>}
      </section>

      {pairError && session.mode === 'simulation' && <p className="error" role="alert">Kombinationsprüfung (Entwurf) nicht verfügbar: {pairError}</p>}
      {pairReport && pairReport.findings.length > 0 && (
        <PatientPairs report={pairReport} isArzt={user.role === 'arzt'}
          onConfirm={(f) => confirmPair(f.clauseId, f.date)}
          onRevoke={(f) => { session.revokeSeparate(f.clauseId, f.date); setReport(null); rerender(); }} />
      )}

      {session.hasPatient && analysis && (
        <FactPanel mentions={analysis.mentions} value={confirmation} user={user} onChange={(c) => { setConfirmation(c); setReport(null); }} />
      )}

      <Dictation disabled={false} onText={onText} />

      {session.notes.list.map((n) => (
        <NoteCard key={n.id} note={n} user={user}
          onReform={(f) => session.notes.reform(n.id, f).then(rerender)}
          onEdit={(p) => { session.notes.edit(user, n.id, p); rerender(); }}
          onRelease={() => release(n.id)} />
      ))}

      <section className="card fertig-bar">
        <div className="fertig-info">
          <label className="inline"><input type="checkbox" checked={quarter} onChange={(e) => setQuarter(e.target.checked)} /> Export enthält das ganze Quartal</label>
          <span className="muted">Ohne Quartalsdaten bleiben Ziffern mit Quartals-/Häufigkeitsgrenzen „nicht prüfbar“.</span>
        </div>
        <span className="spacer" />
        <button className="primary big" disabled={!session.hasPatient || fertigBusy} onClick={fertig}>{fertigBusy ? 'Prüft im Hintergrund …' : <>Fertig <ArrowRight size={18} aria-hidden="true" /></>}</button>
      </section>

      {report && (
        <FertigPanel report={report} isArzt={user.role === 'arzt'} billingEnabled={billingEnabled}
          onSubmit={(entries) => session.sendBilling(user, entries)} />
      )}
      {session.hasPatient && (
        <CorrectionsPanel list={corrections} onChange={setCorrections} user={user} date={date} recorded={session.snapshot?.diagnoses ?? []} />
      )}
      {msg && <p className="muted" role="status">{msg}</p>}
    </div>
  );
}
