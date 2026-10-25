import { useState, type FormEvent } from 'react';
import { api, type Status } from './platform.js';

/** Konten (nur Arzt), Arbeitsplatz, KV. Keine Patientendaten. */
export function Settings({ status, kv, onKv, onChanged }: {
  status: Status;
  kv: string | null;
  onKv: (kv: 'Nordrhein' | 'Westfalen-Lippe' | null) => void;
  onChanged: () => void;
}) {
  const isArzt = status.user?.role === 'arzt';
  const [acc, setAcc] = useState({ kuerzel: '', name: '', role: 'mfa' as 'arzt' | 'mfa', password: '' });
  const [msg, setMsg] = useState('');

  async function createAccount(e: FormEvent) {
    e.preventDefault();
    try {
      const a = await api.createAccount(acc.kuerzel, acc.name, acc.role, acc.password);
      setMsg(`Konto ${a.kuerzel} angelegt.`);
      setAcc({ kuerzel: '', name: '', role: 'mfa', password: '' });
      onChanged();
    } catch (err) { setMsg(String(err)); }
  }

  async function patch(p: Parameters<typeof api.updateConfig>[0]) {
    try { await api.updateConfig(p); onChanged(); } catch (err) { setMsg(String(err)); }
  }

  return (
    <div className="stack">
      <section className="card">
        <h2>Praxis</h2>
        <div className="row">
          <label>Bundesland<input value="Nordrhein-Westfalen" disabled /></label>
          <label>KV
            <select value={kv ?? ''} disabled={!isArzt} onChange={(e) => onKv((e.target.value || null) as 'Nordrhein' | 'Westfalen-Lippe' | null)}>
              <option value="">– noch nicht gewählt –</option><option>Nordrhein</option><option>Westfalen-Lippe</option>
            </select>
          </label>
          <label>Modus
            <select value={status.config.mode} disabled={!isArzt} onChange={(e) => patch({ mode: e.target.value as 'simulation' | 'operational' })}>
              <option value="simulation">Simulator (DEMO-Regeln)</option><option value="operational">Prüfung</option>
            </select>
          </label>
        </div>
        <p className="muted">Ohne KV werden regionale Regeln nicht geprüft. Ein Wechsel macht frühere Ergebnisse ungültig.</p>
      </section>

      <section className="card">
        <h2>Arbeitsplatz <span className="muted">{status.session}</span></h2>
        <dl className="kv">
          <dt>GDT-Eingang</dt><dd>{status.config.inbox_dir}</dd>
          <dt>GDT-Ausgang</dt><dd>{status.config.outbox_dir}\{status.config.outbox_file}</dd>
          <dt>Rückweg zu DURIA</dt>
          <dd>
            <label className="inline"><input type="checkbox" checked={status.config.writeback_enabled} disabled={!isArzt}
              onChange={(e) => patch({ writeback_enabled: e.target.checked })} /> aktiv (erst nach Bestätigung durch DURIA einschalten)</label>
          </dd>
          <dt>Spracherkennung</dt><dd>{status.voice_missing.length ? <span className="error">fehlt: {status.voice_missing.join(', ')}</span> : 'lokal (whisper.cpp) bereit'}</dd>
          <dt>Zusammenfassung</dt>
          <dd>
            <input placeholder="lokales Ollama-Modell, leer = regelbasiert" defaultValue={status.config.ollama_model ?? ''} disabled={!isArzt}
              onBlur={(e) => patch({ ollama_model: e.target.value.trim() || null })} />
          </dd>
        </dl>
      </section>

      {isArzt && (
        <section className="card">
          <h2>Konten</h2>
          <table>
            <thead><tr><th>Kürzel</th><th>Name</th><th>Rolle</th><th>Status</th><th /></tr></thead>
            <tbody>
              {status.accounts.map((a) => (
                <tr key={a.kuerzel}>
                  <td><strong>{a.kuerzel}</strong></td><td>{a.name}</td><td>{a.role === 'arzt' ? 'Arzt' : 'MFA'}</td>
                  <td>{a.active ? 'aktiv' : 'deaktiviert'}</td>
                  <td><button className="link" onClick={() => api.setAccountActive(a.kuerzel, !a.active).then(onChanged, (e) => setMsg(String(e)))}>{a.active ? 'deaktivieren' : 'aktivieren'}</button></td>
                </tr>
              ))}
            </tbody>
          </table>
          <form className="row" onSubmit={createAccount} style={{ marginTop: 12 }}>
            <label>Kürzel<input value={acc.kuerzel} maxLength={6} onChange={(e) => setAcc({ ...acc, kuerzel: e.target.value })} required size={6} /></label>
            <label>Name<input value={acc.name} onChange={(e) => setAcc({ ...acc, name: e.target.value })} required /></label>
            <label>Rolle<select value={acc.role} onChange={(e) => setAcc({ ...acc, role: e.target.value as 'arzt' | 'mfa' })}><option value="mfa">MFA</option><option value="arzt">Arzt</option></select></label>
            <label>Startpasswort<input type="password" minLength={8} value={acc.password} onChange={(e) => setAcc({ ...acc, password: e.target.value })} required /></label>
            <button className="primary">Konto anlegen</button>
          </form>
        </section>
      )}
      {msg && <p className="muted" role="status">{msg}</p>}
    </div>
  );
}
