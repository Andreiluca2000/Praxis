import { Bell, CalendarCheck, CalendarClock, ClipboardCheck, Files, Info, LogOut, Plus, Settings2, SlidersHorizontal, Stethoscope, WandSparkles } from 'lucide-react';
import { FormsView } from './forms/FormsView.js';
import { IcdSearch } from './IcdSearch.js';
import { QuarterCheck } from './QuarterCheck.js';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Login } from './Login.js';
import { api, type Status } from './platform.js';
import { today, TreatmentSession } from './session.js';
import { activeRules } from '../src/rules/model.js';
import { PraxisregelnView } from './rules/PraxisregelnView.js';
import { Settings } from './Settings.js';
import { Tagesabschluss } from './Tagesabschluss.js';
import { KiAuftrag } from './KiAuftrag.js';
import { doneToday, reminderDue, snooze, SNOOZE_MIN, type ReminderState } from '../src/kvdt/day-reminder.js';
import { Treatment } from './Treatment.js';

type View = 'behandlung' | 'tagesabschluss' | 'ki-auftrag' | 'quartal' | 'diagnosen' | 'formulare' | 'regeln' | 'einstellungen';

/** Seitennavigation nach dem Codex-Entwurf (praxis-assistent-konzept.html); nur fertige Bereiche sind aktiv. */
const NAV: { id: View | 'diagnosen' | 'formulare' | 'regeln'; label: string; icon: typeof Stethoscope; ready: boolean }[] = [
  { id: 'behandlung', label: 'Behandlung & Abrechnung', icon: ClipboardCheck, ready: true },
  { id: 'tagesabschluss', label: 'Tagesabschluss', icon: CalendarClock, ready: true },
  { id: 'ki-auftrag', label: 'KI-Auftrag', icon: WandSparkles, ready: true },
  { id: 'quartal', label: 'Quartalsprüfung (KVDT)', icon: CalendarCheck, ready: true },
  { id: 'diagnosen', label: 'Diagnosen & ICD', icon: Stethoscope, ready: true },
  { id: 'formulare', label: 'Formulare', icon: Files, ready: true },
  { id: 'regeln', label: 'Praxisregeln', icon: SlidersHorizontal, ready: true },
  { id: 'einstellungen', label: 'Einstellungen', icon: Settings2, ready: true },
];

/** Zustand der Tagesabschluss-Erinnerung (nur Datum/Zeitpunkt, keine Patientendaten) im Speicher dieses Fensters. */
const REMINDER_KEY = 'praxis.tagesabschluss.erinnerung';
function readReminder(): ReminderState {
  try { return JSON.parse(localStorage.getItem(REMINDER_KEY) ?? '{}') as ReminderState; } catch { return {}; }
}
function writeReminder(r: ReminderState) {
  try { localStorage.setItem(REMINDER_KEY, JSON.stringify(r)); } catch { /* ohne Speicher: Erinnerung kommt erneut */ }
}

export function App() {
  const [status, setStatus] = useState<Status | null>(null);
  // ?view=… nur für die Bildschirmvorschau im Entwicklungsserver.
  const [view, setView] = useState<View>(() => (import.meta.env.DEV && (new URLSearchParams(location.search).get('view') as View)) || 'behandlung');
  const [notice, setNotice] = useState('');
  const session = useRef<TreatmentSession | null>(null);
  const [remind, setRemind] = useState(false);
  // Erinnerung nur für Ärzte und nur, solange das Programm offen ist (kein Windows-Dienst).
  const reminderAt = status?.user?.role === 'arzt' ? status.config.tagesabschluss_uhrzeit ?? null : null;
  useEffect(() => {
    if (!reminderAt) { setRemind(false); return; }
    const check = () => setRemind(reminderDue(new Date(), reminderAt, readReminder()));
    check();
    const id = setInterval(check, 30_000);
    return () => clearInterval(id);
  }, [reminderAt]);
  const answerReminder = (r: ReminderState, open = false) => {
    writeReminder(r);
    setRemind(false);
    if (open) setView('tagesabschluss');
  };

  const refresh = useCallback(async () => {
    try {
      const s = await api.status();
      setStatus(s);
      if (s.user && !session.current) {
        session.current = new TreatmentSession(s.session, s.config);
        await session.current.loadPractice();
      }
      session.current?.setConfig(s.config);
      if (!s.user) session.current = null;
    } catch (e) { setNotice(String(e)); }
  }, []);

  useEffect(() => { void refresh(); }, [refresh]);
  useEffect(() => {
    const un = api.onNotice(setNotice);
    return () => { un.then((f) => f()); };
  }, []);

  if (!status) return <main className="login"><p className="muted">Lädt …</p></main>;
  if (!status.user || !session.current) {
    return (
      <>
        {notice && <div className="notice" role="status">{notice}</div>}
        <Login needsSetup={status.needs_setup} onDone={refresh} />
      </>
    );
  }

  const s = session.current;
  async function logout() {
    s.clear(); // Patientendaten verwerfen
    await api.logout();
    session.current = null;
    await refresh();
  }

  const duria = status.config.writeback_enabled || status.config.billing_writeback_enabled ? 'DURIA verbunden (GDT)' : 'DURIA nur lesend';

  return (
    <div className="shell">
      <header className="top">
        <div className="brand"><span className="logo" aria-hidden="true"><Plus size={20} strokeWidth={3} /></span>Praxis-Assistent</div>
        <span className="status-pill">{status.config.mode === 'simulation' ? 'Simulator' : 'Prüfung'} · {duria}</span>
        <span className="spacer" />
        <span className="who"><span className="avatar" aria-hidden="true">{status.user.kuerzel.slice(0, 2)}</span><strong>{status.user.kuerzel}</strong> · {status.user.role === 'arzt' ? 'Arzt' : 'MFA'}</span>
        <button className="link icon" onClick={logout} title="Abmelden"><LogOut size={16} /> Abmelden</button>
      </header>
      <div className="layout">
        <nav className="sidebar" aria-label="Arbeitsbereiche">
          <small>ARBEITSPLATZ</small>
          {NAV.map(({ id, label, icon: Icon, ready }) => (
            <button key={id} aria-current={view === id ? 'page' : undefined} disabled={!ready}
              title={ready ? undefined : 'Folgt in einer späteren Version'}
              onClick={() => ready && setView(id as View)}>
              <span className="nav-ico" aria-hidden="true"><Icon size={19} /></span>{label}
              {!ready && <span className="soon">bald</span>}
            </button>
          ))}
          <p className="footnote">Nur synthetische Daten bis zur Datenschutz-Freigabe.<br />Vorschläge nur nach ärztlicher Bestätigung.</p>
        </nav>
        <main className="content">
          {status.config.mode === 'simulation' && <div className="note-box"><Info size={18} aria-hidden="true" />Simulator – DEMO-Regeln, keine echten Abrechnungsziffern.</div>}
          {notice && <div className="notice" role="status">{notice} <button className="link" onClick={() => setNotice('')}>×</button></div>}
          {remind && (
            <div className="guard" role="status" style={{ alignItems: 'center', margin: '0 0 18px' }}>
              <Bell size={18} aria-hidden="true" />
              <strong>{reminderAt} – Tagesabschluss jetzt prüfen?</strong>
              <span className="spacer" />
              <button className="primary" onClick={() => answerReminder(doneToday(new Date()), true)}>Prüfen</button>
              <button onClick={() => answerReminder(snooze(new Date()))}>Später ({SNOOZE_MIN} Min.)</button>
              <button className="link" onClick={() => answerReminder(doneToday(new Date()))}>Heute nicht</button>
            </div>
          )}
          {view === 'behandlung' && <Treatment session={s} user={status.user} billingEnabled={status.config.billing_writeback_enabled} />}
          {view === 'tagesabschluss' && (status.user.role === 'arzt'
            ? <Tagesabschluss settings={s.settings} rules={s.rules} mode={status.config.mode} practice={activeRules(s.practice, today())} chronic={s.catalogue.chronic} ai={status.config.ai} />
            : <section className="card"><p className="muted">Der Tagesabschluss ist Ärzten vorbehalten.</p></section>)}
          {view === 'ki-auftrag' && (status.user.role === 'arzt'
            ? <KiAuftrag settings={s.settings} rules={s.rules} mode={status.config.mode} practice={activeRules(s.practice, today())} chronic={s.catalogue.chronic} ai={status.config.ai} />
            : <section className="card"><p className="muted">Der KI-Auftrag ist Ärzten vorbehalten.</p></section>)}
          {view === 'quartal' && (status.user.role === 'arzt'
            ? <QuarterCheck settings={s.settings} rules={s.rules} mode={status.config.mode} practice={activeRules(s.practice, today())} chronic={s.catalogue.chronic} />
            : <section className="card"><p className="muted">Die Quartalsprüfung ist Ärzten vorbehalten.</p></section>)}
          {view === 'diagnosen' && <section className="card"><h2><Stethoscope size={22} aria-hidden="true" />Diagnosen & ICD-10-GM</h2><IcdSearch /></section>}
          {view === 'formulare' && <FormsView kartei={s.snapshot ? { diagnoses: s.snapshot.diagnoses, notes: s.snapshot.notes, serviceDate: today() } : null} />}
          {view === 'regeln' && <PraxisregelnView session={s} user={status.user} />}
          {view === 'einstellungen' && <Settings status={status} onChanged={refresh} />}
        </main>
      </div>
    </div>
  );
}
