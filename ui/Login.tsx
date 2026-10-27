import { ArrowRight, BadgeCheck, Eye, EyeOff, IdCard, Lock, Plus, ShieldCheck, User, UserRound } from 'lucide-react';
import { useState, type FormEvent, type ReactNode } from 'react';
import { api } from './platform.js';

type Tab = 'anmelden' | 'registrieren';

function Field({ icon, children }: { icon: ReactNode; children: ReactNode }) {
  return <div className="field">{icon}{children}</div>;
}

function PasswordInput({ label, value, onChange, autoFocus }: { label: string; value: string; onChange: (v: string) => void; autoFocus?: boolean }) {
  const [show, setShow] = useState(false);
  return (
    <label>
      {label}
      <Field icon={<Lock size={18} aria-hidden="true" />}>
        <input type={show ? 'text' : 'password'} value={value} onChange={(e) => onChange(e.target.value)} minLength={8} required autoFocus={autoFocus} />
        <button type="button" className="link reveal" onClick={() => setShow(!show)} aria-label={show ? 'Passwort verbergen' : 'Passwort anzeigen'}>
          {show ? <EyeOff size={18} /> : <Eye size={18} />}
        </button>
      </Field>
    </label>
  );
}

/**
 * Anmeldung und Registrierung getrennt (Reiter). Ersteinrichtung: nur Registrierung des ersten Arztkontos.
 * Weitere Konten gibt ein Arzt mit Kürzel und Passwort frei; auf dem Server dürfen nur Administratoren
 * die Kontendatei ändern (scripts/server-einrichten.ps1) – die Meldung dazu kommt aus dem Backend.
 */
export function Login({ needsSetup, onDone }: { needsSetup: boolean; onDone: () => void }) {
  // ?tab=registrieren nur für die Bildschirmvorschau im Entwicklungsserver.
  const devTab = import.meta.env.DEV && new URLSearchParams(location.search).get('tab') === 'registrieren';
  const [tab, setTab] = useState<Tab>(needsSetup || devTab ? 'registrieren' : 'anmelden');
  const [kuerzel, setKuerzel] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [role, setRole] = useState<'arzt' | 'mfa'>(needsSetup ? 'arzt' : 'mfa');
  const [repeat, setRepeat] = useState('');
  const [approver, setApprover] = useState('');
  const [approverPw, setApproverPw] = useState('');
  const [error, setError] = useState('');
  const [ok, setOk] = useState('');
  const [busy, setBusy] = useState(false);

  function switchTo(t: Tab) {
    setTab(t);
    setError('');
    setOk('');
    setPassword('');
    setRepeat('');
  }

  async function run(action: () => Promise<void>) {
    setError('');
    setOk('');
    setBusy(true);
    try { await action(); } catch (err) { setError(String(err)); } finally { setBusy(false); }
  }

  function login(e: FormEvent) {
    e.preventDefault();
    void run(async () => {
      await api.login(kuerzel, password);
      setPassword('');
      onDone();
    });
  }

  function register(e: FormEvent) {
    e.preventDefault();
    if (password !== repeat) return setError('Die Passwörter stimmen nicht überein.');
    void run(async () => {
      const acc = await api.registerAccount({
        kuerzel, name, role: needsSetup ? 'arzt' : role, password,
        ...(needsSetup ? {} : { approverKuerzel: approver, approverPassword: approverPw }),
      });
      setApproverPw('');
      if (needsSetup) {
        // Ersteinrichtung: das erste Arztkonto wird direkt angemeldet.
        await api.login(acc.kuerzel, password);
        setPassword('');
        setRepeat('');
        onDone();
        return;
      }
      switchTo('anmelden');
      setKuerzel(acc.kuerzel);
      setOk(`Konto ${acc.kuerzel} angelegt – bitte anmelden.`);
    });
  }

  return (
    <main className="login">
      <div>
        <section className="card auth">
          {!needsSetup && (
            <fieldset className="segmented tabs" aria-label="Anmelden oder registrieren">
              {(['anmelden', 'registrieren'] as const).map((t) => (
                <label key={t} className={tab === t ? 'on' : ''}>
                  <input type="radio" name="auth-tab" value={t} checked={tab === t} onChange={() => switchTo(t)} />
                  {t === 'anmelden' ? 'Anmelden' : 'Registrieren'}
                </label>
              ))}
            </fieldset>
          )}
          <div className="auth-head">
            <span className="logo" aria-hidden="true"><Plus size={28} strokeWidth={3} /></span>
            <h1>Praxis-Assistent</h1>
            <p className="muted">{needsSetup ? 'Ersteinrichtung: das erste Konto ist ein Arztkonto.' : tab === 'anmelden' ? 'Abrechnung prüfen. Sicher und lokal.' : 'Neues Konto für Arzt oder MFA anlegen.'}</p>
          </div>

          {tab === 'anmelden' ? (
            <form onSubmit={login}>
              <label>Kürzel
                <Field icon={<User size={18} aria-hidden="true" />}>
                  <input autoFocus value={kuerzel} onChange={(e) => setKuerzel(e.target.value)} maxLength={6} required placeholder="z. B. AL" />
                </Field>
              </label>
              <PasswordInput label="Passwort" value={password} onChange={setPassword} />
              {ok && <p className="ok" role="status"><BadgeCheck size={16} aria-hidden="true" /> {ok}</p>}
              {error && <p className="error" role="alert">{error}</p>}
              <button className="primary" disabled={busy}>Anmelden <ArrowRight size={18} aria-hidden="true" /></button>
              <p className="switch">Neues Konto? <button type="button" className="link" onClick={() => switchTo('registrieren')}>Registrieren</button> – Freigabe durch einen Arzt</p>
            </form>
          ) : (
            <form onSubmit={register}>
              <div className="two">
                <label>Kürzel
                  <Field icon={<IdCard size={18} aria-hidden="true" />}>
                    <input autoFocus value={kuerzel} onChange={(e) => setKuerzel(e.target.value)} maxLength={6} required placeholder="1–6 Buchstaben" />
                  </Field>
                </label>
                <label>Rolle
                  <Field icon={<UserRound size={18} aria-hidden="true" />}>
                    <select value={needsSetup ? 'arzt' : role} onChange={(e) => setRole(e.target.value as 'arzt' | 'mfa')} disabled={needsSetup}>
                      <option value="arzt">Arzt</option>
                      <option value="mfa">MFA</option>
                    </select>
                  </Field>
                </label>
              </div>
              <label>Name
                <Field icon={<User size={18} aria-hidden="true" />}>
                  <input value={name} onChange={(e) => setName(e.target.value)} required placeholder="Vor- und Nachname" />
                </Field>
              </label>
              <div className="two">
                <PasswordInput label="Passwort (min. 8)" value={password} onChange={setPassword} />
                <PasswordInput label="Wiederholen" value={repeat} onChange={setRepeat} />
              </div>
              {!needsSetup && (
                <fieldset>
                  <legend><ShieldCheck size={14} aria-hidden="true" /> Freigabe durch einen Arzt</legend>
                  <div className="two">
                    <label>Kürzel des Arztes
                      <Field icon={<User size={18} aria-hidden="true" />}>
                        <input value={approver} onChange={(e) => setApprover(e.target.value)} maxLength={6} required />
                      </Field>
                    </label>
                    <PasswordInput label="Passwort des Arztes" value={approverPw} onChange={setApproverPw} />
                  </div>
                </fieldset>
              )}
              {error && <p className="error" role="alert">{error}</p>}
              <button className="primary" disabled={busy}>{needsSetup ? 'Konto anlegen und anmelden' : 'Konto anlegen'} <ArrowRight size={18} aria-hidden="true" /></button>
              {!needsSetup && <p className="switch">Schon ein Konto? <button type="button" className="link" onClick={() => switchTo('anmelden')}>Anmelden</button></p>}
            </form>
          )}
        </section>
        <p className="auth-foot">Nur synthetische Daten bis zur Datenschutz-Freigabe</p>
      </div>
    </main>
  );
}
