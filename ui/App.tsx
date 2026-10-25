import { useCallback, useEffect, useRef, useState } from 'react';
import { validateSettings } from '../src/validation/validate.js';
import { Login } from './Login.js';
import { api, type Status } from './platform.js';
import { TreatmentSession } from './session.js';
import { Settings } from './Settings.js';
import { Treatment } from './Treatment.js';

type View = 'behandlung' | 'einstellungen';

export function App() {
  const [status, setStatus] = useState<Status | null>(null);
  const [view, setView] = useState<View>('behandlung');
  const [notice, setNotice] = useState('');
  const [, force] = useState(0);
  const session = useRef<TreatmentSession | null>(null);

  const refresh = useCallback(async () => {
    try {
      const s = await api.status();
      setStatus(s);
      if (s.user && !session.current) session.current = new TreatmentSession(s.session, s.config);
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
  if (!status.user || !session.current) return <Login needsSetup={status.needs_setup} onDone={refresh} />;

  const s = session.current;
  async function logout() {
    s.clear(); // Patientendaten verwerfen
    await api.logout();
    session.current = null;
    await refresh();
  }

  function setKv(kv: 'Nordrhein' | 'Westfalen-Lippe' | null) {
    const v = validateSettings({ ...s.settings, region: { ...s.settings.region, kv } });
    if (v.ok && v.value) { s.settings = v.value; force((n) => n + 1); }
  }

  return (
    <>
      <header className="top">
        <h1>Praxis-Assistent</h1>
        <nav>
          <button aria-current={view === 'behandlung' ? 'page' : undefined} onClick={() => setView('behandlung')}>Behandlung</button>
          <button aria-current={view === 'einstellungen' ? 'page' : undefined} onClick={() => setView('einstellungen')}>Einstellungen</button>
        </nav>
        <span className="spacer" />
        <span className="who"><strong>{status.user.kuerzel}</strong> · {status.user.role === 'arzt' ? 'Arzt' : 'MFA'}</span>
        <button className="link" onClick={logout}>Abmelden</button>
      </header>
      <div className={`banner ${status.config.mode === 'simulation' ? 'sim' : ''}`} role="note">
        {status.config.mode === 'simulation' ? 'SIMULATOR – DEMO-Regeln, keine echten Abrechnungsziffern. ' : ''}
        Nur synthetische Daten bis zur Datenschutz-Freigabe. Vorschläge werden nur nach Bestätigung übernommen.
      </div>
      {notice && <div className="notice" role="status">{notice} <button className="link" onClick={() => setNotice('')}>×</button></div>}
      <main className="content">
        {view === 'behandlung'
          ? <Treatment session={s} user={status.user} billingEnabled={status.config.billing_writeback_enabled} />
          : <Settings status={status} kv={s.settings.region.kv} onKv={setKv} onChanged={refresh} />}
      </main>
    </>
  );
}
