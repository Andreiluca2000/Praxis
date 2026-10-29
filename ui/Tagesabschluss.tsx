import { CalendarClock, Lock, Sparkles } from 'lucide-react';
import { invoke } from '@tauri-apps/api/core';
import { open as openDialog } from '@tauri-apps/plugin-dialog';
import { Fragment, useCallback, useEffect, useMemo, useState } from 'react';
import type { IsoDate, PracticeSettings, RulePackage } from '../src/domain/types.js';
import type { ChronicList } from '../src/engine/chronic.js';
import { explainRequest, type DayAiRequest } from '../src/kvdt/day-ai.js';
import { checkDay, type DayCall, type DayItem, type DayPatient, type DayReport, type DayStatus } from '../src/kvdt/day-check.js';
import type { ActiveRule } from '../src/rules/model.js';
import { loadPairDossier, loadWindowDossiers } from './pairDossier.js';
import { api, type AiConfig, type AiPreview } from './platform.js';
import { today } from './session.js';

const STATUS: Record<DayStatus, { label: string; pill: string }> = {
  rot: { label: 'Fehler', pill: 'billing_conflict' },
  gelb: { label: 'Klären', pill: 'not_verifiable' },
  grau: { label: 'nicht prüfbar', pill: '' },
  gruen: { label: 'ohne Befund', pill: 'candidate' },
};

const STAGE2_LOCKED = 'Gesperrt (Stufe 2): Kartei- und Diktattext geht erst an die KI, wenn ein Arzt in den Einstellungen bestätigt hat, '
  + 'dass AVV/DPA mit Anthropic, Zero Data Retention und die Datenschutz-Folgenabschätzung (DSFA) vorliegen.';
const STAGE2_NO_SOURCE = 'Stufe 2 ist freigegeben, aber es gibt noch keinen Text des Tages: dafür braucht es einen BDT-Export pro Tag aus DURIA.';

/** Kalendertag in Ortszeit (Aufrufzeit in Sekunden seit 1970). */
const localDay = (s: number): IsoDate => {
  const d = new Date(s * 1000);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
const hhmm = (s: number) => new Date(s * 1000).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
const longDate = (d: IsoDate) => new Date(`${d}T12:00:00`).toLocaleDateString('de-DE', { weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric' });

interface AiView { key: string; req: DayAiRequest; preview: AiPreview | null; answer: string; busy: boolean; error: string }

/** KI je Befund (Stufe 1): erst „Was wird gesendet?“, dann Senden; die Antwort ist ein Vorschlag, kein Ergebnis. */
function AiExplain({ ai, onSend, onCancel }: { ai: AiView; onSend: () => void; onCancel: () => void }) {
  return (
    <div className="finding" style={{ marginTop: 4 }}>
      {!ai.answer && (
        <div className="row"><strong>Was wird gesendet?</strong><span className="muted">Stufe 1 · Protokoll ohne Inhalt</span><span className="spacer" />
          <button className="primary" disabled={ai.busy || !ai.preview} onClick={onSend}>{ai.busy ? 'Sendet …' : 'Senden'}</button>
          <button className="link" onClick={onCancel}>Abbrechen</button></div>
      )}
      {!ai.answer && ai.preview && <pre className="ai-preview">{ai.preview.body}</pre>}
      {ai.answer && (
        <>
          <div className="row"><span className="pill not_verifiable">KI-Vorschlag · unsicher</span><span className="muted">bitte selbst prüfen – nichts wird übernommen oder nach DURIA geschrieben</span>
            <span className="spacer" /><button className="link" onClick={onCancel}>Schließen</button></div>
          <p style={{ whiteSpace: 'pre-wrap', margin: '8px 0 0' }}>{ai.answer}</p>
        </>
      )}
      {ai.error && <p className="error" role="alert">{ai.error}</p>}
    </div>
  );
}

function PatientDetails({ p, aiOn, stage2Open, ai, onExplain, onSend, onCancel }: {
  p: DayPatient; aiOn: boolean; stage2Open: boolean; ai: AiView | null;
  onExplain: (key: string, item: DayItem) => void; onSend: () => void; onCancel: () => void;
}) {
  return (
    <div className="stack" style={{ gap: 8 }}>
      <p className="muted" style={{ margin: 0 }}>
        Ziffern am Tag: {p.servicesToday.join(', ') || '–'} · Diagnosen im Fall: {p.diagnoses.join(', ') || '–'} ·
        Aufrufe: {p.calls.map((c) => `${hhmm(c.at)} ${c.station}/${c.kuerzel}`).join(', ')}
      </p>
      {p.items.length === 0 && <p className="muted" style={{ margin: 0 }}>In den geprüften Regeln nichts gefunden.</p>}
      {p.items.map((it, i) => {
        const key = `${p.token}#${i}`;
        return (
          <Fragment key={key}>
            <div className="row" style={{ alignItems: 'flex-start' }}>
              <span className={`pill ${STATUS[it.level].pill}`}>{STATUS[it.level].label}</span>
              <span>{it.text}{it.draft && <span className="muted"> (Entwurf, nicht ärztlich freigegeben)</span>}</span>
              <span className="spacer" />
              <button className="link icon" disabled={!aiOn || ai?.busy}
                title={aiOn ? 'Stufe 1: nur Ziffern, ICD und Prüftext – kein Kartei-Text, keine Nummer, kein Datum' : 'KI ist ausgeschaltet (Einstellungen → KI-Assistent)'}
                onClick={() => onExplain(key, it)}><Sparkles size={15} aria-hidden="true" /> KI erklären</button>
            </div>
            {ai?.key === key && <AiExplain ai={ai} onSend={onSend} onCancel={onCancel} />}
          </Fragment>
        );
      })}
      <div className="row" style={{ alignItems: 'flex-start' }}>
        <button disabled className="icon"><Lock size={15} aria-hidden="true" /> KI: Dokumentation genau lesen</button>
        <span className="muted" style={{ flex: 1, minWidth: 260 }}>
          {stage2Open ? STAGE2_NO_SOURCE : STAGE2_LOCKED} Vorschläge daraus wären immer „unsicher“, gingen durch Prüfmotor und Katalog und würden nie nach DURIA geschrieben.
        </span>
      </div>
    </div>
  );
}

/**
 * Tagesabschluss: alle heute über GDT aufgerufenen Patienten gegen die KVDT-Datei prüfen. Nur lesen – nichts wird
 * verändert, gesendet oder „bereit“. Die Tagesliste kommt aus Rust (Pseudonym, Zeit, Platz, Kürzel – nie die Nummer).
 */
export function Tagesabschluss({ settings, rules, mode, practice = [], chronic = null, ai }: {
  settings: PracticeSettings; rules: RulePackage; mode: 'operational' | 'simulation'; practice?: ActiveRule[]; chronic?: ChronicList | null; ai: AiConfig;
}) {
  const day = today();
  const [calls, setCalls] = useState<DayCall[] | null>(null);
  const [report, setReport] = useState<DayReport | null>(null);
  const [meta, setMeta] = useState<{ patients: number; dropped: number; invalid: number } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [onlyOpen, setOnlyOpen] = useState(false);
  const [open, setOpen] = useState<string | null>(null);
  const [aiView, setAiView] = useState<AiView | null>(null);
  const [confirmClose, setConfirmClose] = useState(false);
  const [closed, setClosed] = useState('');
  const aiOn = ai.provider === 'claude';
  const stage2Open = !!ai.stage2 && ai.stage2.avv && ai.stage2.zdr && ai.stage2.dsfa;

  const reloadList = useCallback(async () => {
    const list = await api.dayList();
    setCalls(list);
    return list;
  }, []);
  useEffect(() => { reloadList().catch((e) => setError(String(e))); }, [reloadList]);

  const todays = useMemo(() => (calls ?? []).filter((c) => localDay(c.at) === day), [calls, day]);

  async function load() {
    setError('');
    setClosed('');
    const path = await openDialog({ multiple: false, directory: false, filters: [{ name: 'KVDT', extensions: ['con', 'CON', 'xkm', 'txt', 'dat'] }] });
    if (typeof path !== 'string') return;
    setBusy(true);
    try {
      const r = await invoke<{ data: number[]; patients: number; dropped: number; invalid: number }>('read_kvdt', { path });
      // Liste neu holen: Pseudonyme der Datei und der Liste stammen aus derselben Programmsitzung.
      const list = await reloadList();
      setMeta({ patients: r.patients, dropped: r.dropped, invalid: r.invalid });
      await new Promise((ok) => setTimeout(ok, 0));
      const pairs = mode === 'simulation' ? await loadPairDossier() : null;
      const windows = mode === 'simulation' ? await loadWindowDossiers() : null;
      const dossierError = [pairs, windows].map((x) => (x && 'error' in x ? x.error : '')).filter(Boolean).join(' ');
      setReport(checkDay({
        kvdt: Uint8Array.from(r.data), day, calls: list, dayOf: localDay, settings, rules, mode, practice, chronic,
        pairs: pairs && !('error' in pairs) ? pairs : null, windows: windows && !('error' in windows) ? windows : null, ...(dossierError ? { dossierError } : {}),
      }));
      setAiView(null);
    } catch (e) { setError(String(e)); } finally { setBusy(false); }
  }

  async function explain(key: string, item: DayItem) {
    const req = explainRequest(item);
    setAiView({ key, req, preview: null, answer: '', busy: true, error: '' });
    try {
      const preview = await api.aiDayPreview(req);
      setAiView({ key, req, preview, answer: '', busy: false, error: '' });
    } catch (e) { setAiView({ key, req, preview: null, answer: '', busy: false, error: String(e) }); }
  }
  async function send() {
    if (!aiView) return;
    const v = aiView;
    setAiView({ ...v, busy: true, error: '' });
    try { setAiView({ ...v, busy: false, answer: await api.aiDayAsk(v.req) }); } catch (e) { setAiView({ ...v, busy: false, error: String(e) }); }
  }

  // Nur die geprüften Aufrufe löschen: was danach eingeht, bleibt für den nächsten Abschluss.
  const upto = report ? Math.max(0, ...report.patients.flatMap((p) => p.calls.map((c) => c.at))) : 0;
  async function closeDay() {
    setBusy(true);
    try {
      await api.dayClose(upto);
      await reloadList();
      setReport(null);
      setMeta(null);
      setConfirmClose(false);
      setClosed('Tagesliste bis zum geprüften Stand gelöscht.');
    } catch (e) { setError(String(e)); } finally { setBusy(false); }
  }

  const shown = useMemo(() => (report?.patients ?? []).filter((p) => !onlyOpen || p.status === 'rot' || p.status === 'gelb'), [report, onlyOpen]);
  const stations = [...new Set(todays.map((c) => c.station))].join(', ');

  return (
    <div className="stack">
      <section className="card">
        <h2><CalendarClock size={22} aria-hidden="true" />Tagesabschluss <span className="muted">{longDate(day)} · alle heute aufgerufenen Patienten · nur lesen</span></h2>
        <p className="muted">Die KVDT-Datei aus DURIA öffnen (Prüflauf, nach der Sprechstunde erzeugt). Es wird nichts verändert oder gesendet. Namen und Patientennummern werden vor der Prüfung entfernt.</p>
        <div className="row">
          <button className="primary" onClick={() => void load()} disabled={busy}>{busy ? 'Prüft …' : 'KVDT-Datei öffnen …'}</button>
          {aiOn ? <span className="pill candidate"><Sparkles size={13} aria-hidden="true" /> KI ein · Stufe 1</span> : <span className="pill">KI aus</span>}
          <span className="pill"><Lock size={13} aria-hidden="true" /> {stage2Open ? 'Stufe 2 freigegeben' : 'Stufe 2 gesperrt'}</span>
        </div>
        <p className="muted" style={{ marginBottom: 0 }}>
          {calls === null ? 'Tagesliste wird geladen …' : `Tagesliste: ${todays.length} Aufrufe${stations ? ` · Arbeitsplätze ${stations}` : ''}`}
          {meta && ` · KVDT-Datei · ${meta.patients} Patienten · ${meta.dropped} Identitätsfelder entfernt${meta.invalid > 0 ? ` · ${meta.invalid} ungültige Zeilen verworfen` : ''}`}
        </p>
        {calls !== null && todays.length === 0 && <p className="muted">Heute noch keine Aufrufe über GDT. Die Liste füllt sich, wenn DURIA einen Patienten an das Programm übergibt.</p>}
        {error && <p className="error" role="alert">{error}</p>}
        {closed && <p className="muted" role="status">{closed}</p>}
      </section>

      {report && (
        <section className="card">
          <div className="row">
            <h2 style={{ margin: 0 }}>{report.patients.length} Patienten</h2>
            {(['rot', 'gelb', 'grau', 'gruen'] as const).map((s) => (
              <span key={s} className={`pill ${STATUS[s].pill}`}>{report.counts[s]} {STATUS[s].label}</span>
            ))}
            <span className="spacer" />
            <label className="inline"><input type="checkbox" checked={onlyOpen} onChange={(e) => setOnlyOpen(e.target.checked)} /> nur Fehler und Klären</label>
          </div>
          {!report.fileCoversDay && <p className="warn">⚠ Die Datei enthält keine Leistungen von heute – bitte nach der Sprechstunde neu erzeugen.</p>}
          <table>
            <thead><tr><th>Aufruf</th><th>Platz · Kürzel</th><th>Patient</th><th>Ziffern heute</th><th>Status</th><th>Befund</th></tr></thead>
            <tbody>
              {shown.map((p) => (
                <Fragment key={p.token}>
                  <tr onClick={() => setOpen(open === p.token ? null : p.token)} style={{ cursor: 'pointer' }} aria-expanded={open === p.token}>
                    <td><strong>{hhmm(p.calls[0]!.at)}</strong>{p.calls.length > 1 && <span className="muted"> +{p.calls.length - 1}</span>}</td>
                    <td className="muted" style={{ whiteSpace: 'nowrap' }}>{p.calls[0]!.station} · {p.calls[0]!.kuerzel}</td>
                    <td className="muted" style={{ whiteSpace: 'nowrap' }}>{p.token.slice(0, 8)}</td>
                    <td style={{ whiteSpace: 'nowrap' }}>{p.servicesToday.join(', ') || '–'}</td>
                    <td><span className={`pill ${STATUS[p.status].pill}`}>{STATUS[p.status].label}</span></td>
                    <td>{p.items[0]?.text ?? <span className="muted">In den geprüften Regeln nichts gefunden.</span>}{p.items.length > 1 && <span className="muted"> · +{p.items.length - 1} weitere</span>}</td>
                  </tr>
                  {open === p.token && (
                    <tr><td colSpan={6} style={{ background: '#fafbf9' }}>
                      <PatientDetails p={p} aiOn={aiOn} stage2Open={stage2Open} ai={aiView} onExplain={(k, it) => void explain(k, it)} onSend={() => void send()} onCancel={() => setAiView(null)} />
                    </td></tr>
                  )}
                </Fragment>
              ))}
            </tbody>
          </table>
          {report.patients.length === 0 && <p className="muted">Keine Aufrufe von heute in der Tagesliste.</p>}
          {report.unlisted > 0 && <p className="muted">{report.unlisted} weitere Patienten mit Leistungen von heute stehen nicht in der Tagesliste (ohne GDT-Aufruf) – nur in der Quartalsprüfung geprüft.</p>}
          <p className="muted">Patient in DURIA finden: über die Uhrzeit des Aufrufs und die Reihenfolge in der DURIA-Tagesliste. Korrekturen bitte in DURIA eintragen.</p>
        </section>
      )}

      {report && (
        <section className="card">
          <h2 style={{ fontSize: 16 }}>Nicht geprüft</h2>
          <ul className="muted" style={{ margin: 0, paddingLeft: 18 }}>{report.notChecked.map((t) => <li key={t}>{t}</li>)}</ul>
        </section>
      )}

      {report && report.patients.length > 0 && (
        <section className="card">
          <div className="row">
            {!confirmClose
              ? <button onClick={() => setConfirmClose(true)} disabled={busy}>Tag abschließen</button>
              : <>
                <button className="danger" onClick={() => void closeDay()} disabled={busy}>Ja, Tagesliste löschen</button>
                <button className="link" onClick={() => setConfirmClose(false)}>Abbrechen</button>
              </>}
            <span className="muted">Löscht die geprüften Aufrufe (bis {hhmm(upto)}) aus der Tagesliste dieses Arbeitsplatzes. Ohne Abschluss werden sie nach 24 Stunden automatisch gelöscht.</span>
          </div>
        </section>
      )}
    </div>
  );
}
