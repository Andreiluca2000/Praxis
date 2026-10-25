import { useState, type FormEvent } from 'react';
import { api } from './platform.js';

/** Anmeldung bzw. Ersteinrichtung (erstes Konto = Arzt). */
export function Login({ needsSetup, onDone }: { needsSetup: boolean; onDone: () => void }) {
  const [kuerzel, setKuerzel] = useState('');
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      if (needsSetup) await api.createAccount(kuerzel, name, 'arzt', password);
      await api.login(kuerzel, password);
      setPassword('');
      onDone();
    } catch (err) {
      setError(String(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="login">
      <form className="card" onSubmit={submit}>
        <h1>Praxis-Assistent</h1>
        {needsSetup && <p className="muted">Ersteinrichtung: Legen Sie das erste Arztkonto an. Weitere Konten (Arzt/MFA) danach unter Einstellungen.</p>}
        <label>Kürzel<input autoFocus value={kuerzel} onChange={(e) => setKuerzel(e.target.value)} maxLength={6} required /></label>
        {needsSetup && <label>Name<input value={name} onChange={(e) => setName(e.target.value)} required /></label>}
        <label>Passwort<input type="password" value={password} onChange={(e) => setPassword(e.target.value)} minLength={8} required /></label>
        {error && <p className="error" role="alert">{error}</p>}
        <button className="primary" disabled={busy}>{needsSetup ? 'Konto anlegen und anmelden' : 'Anmelden'}</button>
      </form>
    </main>
  );
}
