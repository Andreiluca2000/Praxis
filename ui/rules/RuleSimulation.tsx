import { invoke } from '@tauri-apps/api/core';
import { open } from '@tauri-apps/plugin-dialog';
import { AlertTriangle, Bell, CheckCircle2, ClipboardCheck, FolderOpen, History, Play, Plus, ShieldCheck } from 'lucide-react';
import { useEffect, useState } from 'react';
import { readKvdt } from '../../src/kvdt/quarter-check.js';
import type { PracticeRule, PracticeRuleFile } from '../../src/rules/model.js';
import { detectConflicts, simulate, type Conflict, type SimulationCase, type SimulationResult } from '../../src/rules/review.js';
import { loadPairDossier, loadWindowDossiers } from '../pairDossier.js';
import { fmtDate, TypePill } from './shared.js';

/**
 * Simulation einer Entwurfsfassung an einer KVDT-Datei (Pseudonyme, nur lesen), Widerspruchsprüfung,
 * Aktivierung durch einen Arzt mit Pflichtgrund, Verlauf aller Fassungen.
 */
export function RuleSimulation({ file, rule, isArzt, onActivate, onEdit, onBack }: {
  file: PracticeRuleFile;
  rule: PracticeRule;
  isArzt: boolean;
  onActivate: (version: number, reason: string) => Promise<void>;
  onEdit: () => void;
  onBack: () => void;
}) {
  const draft = rule.versions.findLast((v) => v.status === 'entwurf') ?? null;
  const active = rule.versions.find((v) => v.status === 'aktiv') ?? null;
  const shown = draft ?? active ?? rule.versions.at(-1)!;
  const [result, setResult] = useState<SimulationResult | null>(null);
  const [source, setSource] = useState('');
  const [conflicts, setConflicts] = useState<Conflict[] | null>(null);
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  // Widersprüche auch gegen die amtlichen Entwurfs-Dossiers (nur zur Information).
  useEffect(() => {
    let alive = true;
    void Promise.all([loadPairDossier(), loadWindowDossiers()]).then(([p, w]) => {
      if (!alive) return;
      setConflicts(detectConflicts(file, rule.id, shown.content, { pairs: 'error' in p ? null : p, windows: 'error' in w ? null : w }));
    });
    return () => { alive = false; };
  }, [file, rule.id, shown.content]);

  async function openKvdt() {
    setError('');
    const path = await open({ multiple: false, directory: false, filters: [{ name: 'KVDT', extensions: ['con', 'CON', 'xkm', 'txt', 'dat'] }] });
    if (typeof path !== 'string') return;
    setBusy(true);
    try {
      const r = await invoke<{ data: number[] }>('read_kvdt', { path });
      const cases: SimulationCase[] = readKvdt(Uint8Array.from(r.data)).cases.map((c) => ({ index: c.index, patientToken: c.patientToken, services: c.services }));
      setResult(simulate(shown.content, cases, draft && active ? active.content : null));
      setSource(`KVDT-Datei · ${cases.length} Fälle (Pseudonyme, nur gelesen)`);
    } catch (e) { setError(String(e)); } finally { setBusy(false); }
  }

  async function activateDraft() {
    if (!draft) return;
    setBusy(true);
    setError('');
    try { await onActivate(draft.version, reason); setReason(''); } catch (e) { setError(String(e)); } finally { setBusy(false); }
  }

  const history = [...rule.versions].reverse();
  return (
    <div className="stack">
      <section className="card">
        <div className="row">
          <h2 style={{ margin: 0 }}><Play size={22} aria-hidden="true" />Simulation <span className="muted">{shown.content.title} · {draft ? `Entwurf v${draft.version}` : `v${shown.version}`}{draft && active ? ` gegenüber aktiv v${active.version}` : ''}</span></h2>
          <span className="spacer" />
          <TypePill t={shown.content.type} />
        </div>
        <p className="muted">{source || 'Zum Testen eine KVDT-Datei öffnen. Es wird nichts gespeichert oder geändert; Patienten erscheinen nur als Pseudonym.'}</p>
        <div className="row">
          <button onClick={openKvdt} disabled={busy || !isArzt}><FolderOpen size={17} aria-hidden="true" />KVDT-Datei öffnen …</button>
          {!isArzt && <span className="muted">Die Simulation mit KVDT-Daten ist Ärzten vorbehalten.</span>}
        </div>
        {result && (
          <>
            <div className="stats">
              <div className="stat"><span className="ico"><ClipboardCheck size={19} aria-hidden="true" /></span><div><span>Fälle geprüft</span><b>{result.cases}</b></div></div>
              <div className="stat"><span className="ico"><Bell size={19} aria-hidden="true" /></span><div><span>Treffer</span><b>{result.hits}</b></div></div>
              <div className="stat"><span className="ico"><Plus size={19} aria-hidden="true" /></span><div><span>neu gegenüber aktiv</span><b>{result.newHits}</b></div></div>
            </div>
            {result.examples.length > 0 && (
              <>
                <h3 className="sub">Beispiele</h3>
                <table>
                  <thead><tr><th>Fall</th><th>Patient</th><th>Tag</th><th>Ziffern</th><th>Ergebnis</th></tr></thead>
                  <tbody>
                    {result.examples.map((x) => (
                      <tr key={x.index}>
                        <td>#{x.index + 1}</td><td className="muted">{x.patientToken?.slice(0, 10) ?? '–'}…</td><td>{fmtDate(x.date)}</td><td>{x.codes.join(' · ')}</td>
                        <td><TypePill t={shown.content.type} />{x.isNew && <> <span className="pill">neu</span></>}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </>
            )}
          </>
        )}
      </section>

      <section className="card">
        <h2><AlertTriangle size={22} aria-hidden="true" />Prüfung auf Widersprüche</h2>
        {conflicts === null && <p className="muted">Prüft …</p>}
        {conflicts?.length === 0 && <div className="finding"><div className="row"><span className="pill candidate">in Ordnung</span>Keine Überschneidung mit anderen Praxisregeln oder EBM/GOÄ-Entwurfs-Dossiers.</div></div>}
        {conflicts?.map((c, i) => (
          <div key={i} className="finding"><div className="row"><span className={`pill ${c.kind === 'official_duplicate' ? '' : 'not_verifiable'}`}>{{ same_trigger: 'Überschneidung', remind_and_hold: 'gleichzeitig', official_duplicate: 'schon geregelt' }[c.kind]}</span>{c.text}</div></div>
        ))}
      </section>

      <section className="card activate">
        <h2><ShieldCheck size={22} aria-hidden="true" />Aktivieren</h2>
        {draft ? (
          <>
            <label>Änderungsgrund (Pflicht)<input value={reason} onChange={(e) => setReason(e.target.value)} disabled={!isArzt} maxLength={200} /></label>
            <div className="row">
              <span className="muted">Nur Ärzte. Gespeichert wird praxisweit – auf dem Server nur mit Administratorrechten (wie die Konten).</span>
              <span className="spacer" />
              <button onClick={onEdit}>Zurück zum Entwurf</button>
              {isArzt && <button className="primary" disabled={busy || !reason.trim()} onClick={activateDraft}><CheckCircle2 size={17} aria-hidden="true" />v{draft.version} aktivieren</button>}
            </div>
          </>
        ) : <p className="muted">Kein Entwurf zum Aktivieren. Änderungen entstehen als neue Fassung über „Bearbeiten“.</p>}
        {error && <p className="error" role="alert">{error}</p>}
        <h3 className="sub"><History size={17} aria-hidden="true" />Verlauf</h3>
        <ul className="history">
          {history.map((v) => (
            <li key={v.version}>
              <b>v{v.version}</b> {v.status === 'entwurf' ? 'Entwurf' : v.status === 'aktiv' ? 'aktiv' : 'archiviert'}
              {v.activatedAt ? ` · aktiviert ${fmtDate(v.activatedAt)} · ${v.activatedBy}` : ` · erstellt ${fmtDate(v.createdAt)} · ${v.createdBy}`}
              {v.reason ? ` · „${v.reason}“` : ''}
            </li>
          ))}
        </ul>
        <div className="row"><button className="link" onClick={onBack}>← Zur Liste</button></div>
      </section>
    </div>
  );
}
