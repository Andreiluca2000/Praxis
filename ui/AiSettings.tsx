import { ArrowLeftRight, CheckCircle2, Download, Eye, KeyRound, PlugZap, ShieldAlert, Sparkles, Trash2, Upload } from 'lucide-react';
import { useEffect, useState } from 'react';
import { api, type AiConfig, type AiPreview, type AiStatus } from './platform.js';

const MODEL_LABEL: Record<string, string> = {
  'claude-opus-5-5': 'Claude Opus 5.5 – Standard',
  'claude-sonnet-5-5': 'Claude Sonnet 5.5 – günstiger',
  'claude-haiku-5-5': 'Claude Haiku 5.5 – am günstigsten',
};

/** Erfundener Beispieltext für die Vorschau – zeigt, was vor dem Senden entfernt wird. */
const SAMPLE = 'Pat. P-0123456789abcdef0123 kam erneut, Rückruf unter 0221/1234567. Husten seit 3 Tagen, kein Fieber. '
  + 'Ausführliches Gespräch über Therapie, ca. 20 Min. Diagnose akute Bronchitis.';

const when = (secs: number) => new Date(secs * 1000).toLocaleString('de-DE', { dateStyle: 'short', timeStyle: 'short' });

/**
 * Einstellungen des KI-Assistenten (Claude API, optional). Stufe 1: Schlüssel hinterlegen, Verbindung mit einem
 * synthetischen Text testen, Vorschau „Was würde gesendet?“. Aus der Kartei wird noch nichts gesendet.
 */
export function AiSettings({ isArzt, config, onChanged }: { isArzt: boolean; config: AiConfig; onChanged: () => void }) {
  const [status, setStatus] = useState<AiStatus | null>(null);
  const [key, setKey] = useState('');
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);
  const [sample, setSample] = useState(SAMPLE);
  const [preview, setPreview] = useState<AiPreview | null>(null);
  const [transferPw, setTransferPw] = useState('');
  const [transferPw2, setTransferPw2] = useState('');
  const enabled = config.provider === 'claude';

  const reload = () => api.aiStatus().then(setStatus).catch((e) => setMsg(String(e)));
  useEffect(() => { void reload(); }, [config]);

  async function run(action: () => Promise<string | void>) {
    setBusy(true);
    setMsg('');
    try { const m = await action(); if (m) setMsg(m); } catch (e) { setMsg(String(e)); } finally { setBusy(false); await reload(); }
  }
  const patch = (p: Partial<AiConfig>) => run(async () => { await api.updateConfig({ ai: { ...config, ...p } }); onChanged(); });

  return (
    <section className="card">
      <h2><Sparkles size={22} aria-hidden="true" />KI-Assistent <span className="muted">Claude API · optional · Vorschläge nur nach ärztlicher Prüfung</span></h2>
      <div className="guard" style={{ marginTop: 0 }}>
        <ShieldAlert size={20} aria-hidden="true" />
        <div>
          <strong>Ohne KI funktioniert das Programm vollständig.</strong>
          <span>Vor echten Patientendaten: Auftragsverarbeitungsvertrag mit Anthropic, Datenaufbewahrung (Zero Data Retention) und Datenschutz-Folgenabschätzung klären. Stufe 1 sendet nur einen synthetischen Verbindungstest.</span>
        </div>
      </div>

      <div className="row" style={{ marginTop: 16 }}>
        <label>KI-Assistent
          <fieldset className="segmented" aria-label="KI-Assistent ein- oder ausschalten">
            {(['aus', 'claude'] as const).map((p) => (
              <label key={p} className={config.provider === p ? 'on' : ''}>
                <input type="radio" name="ai-provider" checked={config.provider === p} disabled={!isArzt || busy} onChange={() => void patch({ provider: p })} />
                {p === 'aus' ? 'Aus' : 'Ein · Claude API'}
              </label>
            ))}
          </fieldset>
        </label>
        <label>Modell
          <select value={config.model} disabled={!isArzt || busy} onChange={(e) => void patch({ model: e.target.value })}>
            {(status?.models ?? [config.model]).map((m) => <option key={m} value={m}>{MODEL_LABEL[m] ?? m}</option>)}
          </select>
        </label>
        <label>Aufwand
          <select value={config.effort} disabled={!isArzt || busy} onChange={(e) => void patch({ effort: e.target.value as AiConfig['effort'] })}>
            <option value="low">niedrig (Auszüge)</option><option value="medium">mittel</option><option value="high">hoch</option>
          </select>
        </label>
      </div>

      <p className="muted" role="status" style={{ marginTop: 8 }}>
        {enabled ? 'Eingeschaltet: Anfragen gehen nur an die Claude API (api.anthropic.com).' : 'Ausgeschaltet: Es wird nichts ins Internet gesendet.'}
      </p>

      <div className="row" style={{ marginTop: 16 }}>
        <KeyRound size={18} aria-hidden="true" />
        {status?.key_present
          ? <span><CheckCircle2 size={15} aria-hidden="true" style={{ verticalAlign: '-2px', color: 'var(--ok)' }} /> Schlüssel hinterlegt (Windows-Anmeldeinformationsverwaltung)</span>
          : <span className="muted">Kein Schlüssel hinterlegt.</span>}
        <span className="spacer" />
        {isArzt && status?.key_present && <button className="link" disabled={busy} onClick={() => void run(async () => { await api.aiDeleteKey(); return 'Schlüssel entfernt.'; })}><Trash2 size={15} aria-hidden="true" />Entfernen</button>}
        {isArzt && <button disabled={busy || !status?.key_present || !enabled} title={enabled ? undefined : 'Erst den KI-Assistenten einschalten'} onClick={() => void run(async () => {
          const r = await api.aiTest();
          return `Verbindung in Ordnung · ${MODEL_LABEL[r.model] ?? r.model} · Antwort „${r.answer}“ · ${r.input_tokens}/${r.output_tokens} Token`;
        })}><PlugZap size={16} aria-hidden="true" />Verbindung testen</button>}
      </div>
      {isArzt && (
        <form className="row" style={{ marginTop: 10 }} onSubmit={(e) => { e.preventDefault(); void run(async () => { await api.aiSetKey(key); setKey(''); return 'Schlüssel gespeichert.'; }); }}>
          <label style={{ flex: 1 }}>Claude-API-Schlüssel (von platform.claude.com)
            <input type="password" value={key} onChange={(e) => setKey(e.target.value)} placeholder="sk-ant-…" autoComplete="off" />
          </label>
          <button className="primary" disabled={busy || !key.trim()}>Speichern</button>
        </form>
      )}
      {isArzt && (
        <>
          <h3 className="sub"><ArrowLeftRight size={17} aria-hidden="true" />Schlüssel auf einen anderen Rechner übertragen</h3>
          <p className="muted">
            Z. B. zu Hause hinterlegen und in der Praxis übernehmen. Die Datei ist mit dem Transfer-Passwort verschlüsselt (Argon2id + AES-256-GCM);
            Datei und Passwort getrennt weitergeben. In der Praxis übernimmt jeder Windows-Benutzer die Datei einmal für sich.
          </p>
          <div className="row">
            <label style={{ flex: 1 }}>Transfer-Passwort (mind. 12 Zeichen)
              <input type="password" value={transferPw} onChange={(e) => setTransferPw(e.target.value)} autoComplete="new-password" />
            </label>
            <label style={{ flex: 1 }}>Wiederholen (nur beim Exportieren)
              <input type="password" value={transferPw2} onChange={(e) => setTransferPw2(e.target.value)} autoComplete="new-password" />
            </label>
          </div>
          <div className="row" style={{ marginTop: 8 }}>
            <button disabled={busy || !status?.key_present || transferPw.length < 12 || transferPw !== transferPw2} onClick={() => void run(async () => {
              if (!await api.aiExportKey(transferPw)) return;
              setTransferPw(''); setTransferPw2('');
              return 'Transferdatei gespeichert. Datei und Passwort getrennt in die Praxis bringen.';
            })}><Download size={16} aria-hidden="true" />Exportieren …</button>
            <button disabled={busy || !transferPw} onClick={() => void run(async () => {
              if (!await api.aiImportKey(transferPw)) return;
              setTransferPw(''); setTransferPw2('');
              return 'Schlüssel übernommen und in der Windows-Anmeldeinformationsverwaltung abgelegt.';
            })}><Upload size={16} aria-hidden="true" />Aus Datei übernehmen …</button>
          </div>
        </>
      )}
      {!isArzt && <p className="muted">Einstellungen des KI-Assistenten ändern nur Ärzte.</p>}
      {msg && <p className={/^KI:|nicht|Kein|ungültig|sieht nicht|falsch|mindestens|unzulässig|ausgeschaltet/.test(msg) ? 'error' : 'muted'} role="status">{msg}</p>}

      <h3 className="sub"><Eye size={17} aria-hidden="true" />Was würde gesendet?</h3>
      <p className="muted">Vorschau aus derselben Funktion, die später sendet – Kennungen werden vorher entfernt. Es wird hier nichts gesendet.</p>
      <textarea value={sample} onChange={(e) => setSample(e.target.value)} rows={3} />
      <div className="row" style={{ marginTop: 8 }}>
        <button disabled={busy} onClick={() => void run(async () => { setPreview(await api.aiPreview(sample)); })}><Eye size={16} aria-hidden="true" />Vorschau</button>
        {preview && <span className="muted">{preview.redactions} Kennungen entfernt · {preview.chars} Zeichen{preview.truncated ? ' · gekürzt' : ''}</span>}
      </div>
      {preview && <pre className="ai-preview">{preview.body}</pre>}

      {status && status.audit.length > 0 && (
        <>
          <h3 className="sub">Protokoll <span className="muted">ohne Inhalte</span></h3>
          <table>
            <thead><tr><th>Zeit</th><th>Benutzer</th><th>Funktion</th><th>Modell</th><th>Token</th><th>Ergebnis</th></tr></thead>
            <tbody>
              {status.audit.map((a, i) => (
                <tr key={i}><td>{when(a.at)}</td><td>{a.user}</td><td>{a.feature}</td><td className="muted">{a.model}</td><td>{a.input_tokens}/{a.output_tokens}</td>
                  <td>{a.ok ? <span className="pill candidate">ok</span> : <span className="pill billing_conflict" title={a.note}>Fehler</span>}</td></tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </section>
  );
}
