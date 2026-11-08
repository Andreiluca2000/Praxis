import { Eye, ShieldAlert, Sparkles, WandSparkles } from 'lucide-react';
import { invoke } from '@tauri-apps/api/core';
import { open as openDialog } from '@tauri-apps/plugin-dialog';
import { useState } from 'react';
import type { IsoDate, PracticeSettings, RulePackage } from '../src/domain/types.js';
import type { ChronicList } from '../src/engine/chronic.js';
import { applyKiFilter, decideHit, describeFilter, KI_AUFTRAG_BEISPIELE, parseKiFilter, type FilterResult, type KiFilter } from '../src/kvdt/ki-filter.js';
import { localIsoDay } from '../src/kvdt/day-reminder.js';
import type { ActiveRule } from '../src/rules/model.js';
import { loadPairDossier, loadWindowDossiers } from './pairDossier.js';
import { api, type AiConfig, type AiPreview } from './platform.js';
import { today } from './session.js';

const MAX_CHARS = 500;
const dayOf = (at: number): IsoDate => localIsoDay(new Date(at * 1000));

/**
 * KI-Auftrag: der Arzt beschreibt in Worten, was gesucht werden soll. Claude erhält nur diesen Text (Rust minimiert ihn)
 * und gibt einen Filter zurück, nie Patienten. Der Filter wird hier streng geprüft, dem Arzt lesbar gezeigt und erst
 * auf seinen Knopfdruck LOKAL auf die KVDT-Datei angewendet. Treffer bleiben „unsicher“; nichts geht nach DURIA.
 */
export function KiAuftrag({ settings, rules, mode, practice = [], chronic = null, ai }: {
  settings: PracticeSettings; rules: RulePackage; mode: 'operational' | 'simulation'; practice?: ActiveRule[]; chronic?: ChronicList | null; ai: AiConfig;
}) {
  const [text, setText] = useState('');
  const [preview, setPreview] = useState<AiPreview | null>(null);
  const [filter, setFilter] = useState<KiFilter | null>(null);
  const [result, setResult] = useState<FilterResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const aiOn = ai.provider === 'claude';

  async function run(action: () => Promise<void>) {
    setBusy(true);
    setError('');
    try { await action(); } catch (e) { setError(String(e)); } finally { setBusy(false); }
  }

  const showPreview = () => run(async () => { setFilter(null); setResult(null); setPreview(await api.aiAuftragPreview(text)); });
  const send = () => run(async () => {
    const answer = await api.aiAuftragAsk(text);
    setPreview(null);
    const parsed = parseKiFilter(answer);
    if ('errors' in parsed) throw new Error(`Die KI-Antwort ist kein gültiger Filter und wurde verworfen (${parsed.errors.slice(0, 2).join(' ')}).`);
    setFilter(parsed.filter);
  });

  const apply = () => run(async () => {
    if (!filter) return;
    const path = await openDialog({ multiple: false, directory: false, filters: [{ name: 'KVDT', extensions: ['con', 'CON', 'xkm', 'txt', 'dat'] }] });
    if (typeof path !== 'string') return;
    const r = await invoke<{ data: number[] }>('read_kvdt', { path });
    // Tagesliste nur für den Zeitraum „heute“; Pseudonyme passen, weil beides aus derselben Programmsitzung kommt.
    const calls = filter.zeitraum === 'tag' ? await api.dayList() : [];
    const pairs = mode === 'simulation' ? await loadPairDossier() : null;
    const windows = mode === 'simulation' ? await loadWindowDossiers() : null;
    setResult(applyKiFilter(filter, {
      kvdt: Uint8Array.from(r.data), day: today(), calls, dayOf, settings, rules, mode, practice, chronic,
      pairs: pairs && !('error' in pairs) ? pairs : null, windows: windows && !('error' in windows) ? windows : null,
    }));
  });

  const decide = (token: string, d: 'angenommen' | 'verworfen') =>
    setResult((r) => (r ? { ...r, hits: r.hits.map((h) => (h.token === token ? decideHit(h, d) : h)) } : r));
  const accepted = result?.hits.filter((h) => h.decision === 'angenommen') ?? [];

  return (
    <div className="stack">
      <section className="card">
        <h2><WandSparkles size={22} aria-hidden="true" />KI-Auftrag <span className="muted">in Worten suchen · Claude erstellt nur einen Filter · Suche läuft hier im Programm</span></h2>
        <div className="guard" style={{ marginTop: 0 }}>
          <ShieldAlert size={20} aria-hidden="true" />
          <div>
            <strong>Gesendet wird nur dieser Text.</strong>
            <span>Keine Namen, Geburtsdaten oder Patientennummern eingeben. Claude sieht keine Patienten und keine Ziffern aus Ihren Fällen; die Treffer sucht das Programm selbst in der KVDT-Datei.</span>
          </div>
        </div>
        <div className="row" style={{ marginTop: 14 }}>
          {KI_AUFTRAG_BEISPIELE.map((b) => <button key={b} className="soft" onClick={() => { setText(b); setPreview(null); }}>{b}</button>)}
        </div>
        <label style={{ marginTop: 12, display: 'block' }}>Was soll gesucht werden?
          <textarea value={text} onChange={(e) => { setText(e.target.value); setPreview(null); }} rows={2} maxLength={MAX_CHARS} />
        </label>
        <div className="row" style={{ marginTop: 8 }}>
          <button className="primary" disabled={!aiOn || busy || !text.trim()} title={aiOn ? undefined : 'KI ist ausgeschaltet (Einstellungen → KI-Assistent)'} onClick={() => void showPreview()}>
            <Eye size={16} aria-hidden="true" />Was wird gesendet?
          </button>
          <span className="muted">{text.length}/{MAX_CHARS} Zeichen · {aiOn ? 'KI ein' : 'KI ist ausgeschaltet (Einstellungen → KI-Assistent)'} · Protokoll ohne Inhalt</span>
        </div>
        {preview && (
          <div className="finding">
            <div className="row"><strong>Was wird gesendet?</strong><span className="muted">nur Auftrag + Filterbeschreibung · {preview.redactions} Kennungen entfernt{preview.truncated ? ' · gekürzt' : ''}</span><span className="spacer" />
              <button className="primary" disabled={busy} onClick={() => void send()}>{busy ? 'Sendet …' : 'Senden'}</button>
              <button className="link" onClick={() => setPreview(null)}>Abbrechen</button></div>
            <pre className="ai-preview" style={{ maxHeight: 220 }}>{preview.body}</pre>
          </div>
        )}
        {error && <p className="error" role="alert">{error}</p>}
      </section>

      {filter && (
        <section className="card">
          <h2 style={{ fontSize: 16 }}><Sparkles size={18} aria-hidden="true" />Filter von Claude <span className="pill not_verifiable">bitte prüfen</span></h2>
          <p style={{ margin: '0 0 8px', fontWeight: 600 }}>{describeFilter(filter, result?.quarter ?? null)}</p>
          <details><summary>Filter als JSON (gegen das Schema geprüft)</summary><pre className="ai-preview">{JSON.stringify(filter, null, 2)}</pre></details>
          <div className="row" style={{ marginTop: 10 }}>
            <button className="primary" disabled={busy} onClick={() => void apply()}>{busy ? 'Sucht …' : 'Filter anwenden (KVDT-Datei öffnen …)'}</button>
            <button className="link" onClick={() => { setFilter(null); setResult(null); }}>Verwerfen</button>
            <span className="muted">Die Suche läuft lokal in der KVDT-Datei, zusammen mit dem Prüfmotor.</span>
          </div>
        </section>
      )}

      {result && (
        <section className="card">
          <div className="row">
            <h2 style={{ margin: 0 }}>{result.hits.length} Treffer</h2>
            <span className="muted">von {result.checked} Fällen{result.quarter ? ` · Quartal ${result.quarter}` : ''}</span>
          </div>
          {result.parseErrors > 0 && <p className="warn">⚠ {result.parseErrors} Zeilen der KVDT-Datei unlesbar – Ergebnis unvollständig.</p>}
          {result.hits.length === 0 && <p className="muted">Keine Treffer. Das heißt nur: in der geöffneten Datei passt kein Fall zum Filter.</p>}
          {result.hits.length > 0 && (
            <table>
              <thead><tr><th>Patient</th><th>Status</th><th>Beleg</th><th>Prüfmotor</th><th>Entscheidung</th></tr></thead>
              <tbody>
                {result.hits.map((h) => (
                  <tr key={h.token}>
                    <td className="muted" style={{ whiteSpace: 'nowrap' }}>{h.token.slice(0, 8)}</td>
                    <td><span className="pill not_verifiable">{h.status === 'teilweise' ? 'unsicher · teilweise' : 'unsicher'}</span></td>
                    <td>{h.evidence.join(' · ')}{h.unchecked.length > 0 && <span className="muted"> · nicht prüfbar: {h.unchecked.join(', ')}</span>}</td>
                    <td className="muted">{h.findings[0] ?? '–'}</td>
                    <td style={{ whiteSpace: 'nowrap' }}>
                      {h.decision === 'offen'
                        ? <><button onClick={() => decide(h.token, 'angenommen')}>Annehmen</button> <button className="link" onClick={() => decide(h.token, 'verworfen')}>Verwerfen</button></>
                        : <span className={`pill ${h.decision === 'angenommen' ? 'candidate' : ''}`}>{h.decision}</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          {accepted.length > 0 && (
            <p><strong>Zum Nacharbeiten in DURIA ({accepted.length}):</strong> {accepted.map((h) => h.token.slice(0, 8)).join(', ')}</p>
          )}
          <p className="muted">Angenommene Treffer bitte in DURIA prüfen und dort korrigieren – das Programm trägt nichts ein. Patient in DURIA finden über das Quartal und die Fallreihenfolge.</p>
        </section>
      )}
    </div>
  );
}
