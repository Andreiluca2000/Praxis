import { CalendarCheck } from 'lucide-react';
import { invoke } from '@tauri-apps/api/core';
import { open } from '@tauri-apps/plugin-dialog';
import { useMemo, useState } from 'react';
import type { PracticeSettings, RulePackage } from '../src/domain/types.js';
import { checkQuarter, type QuarterReport } from '../src/kvdt/quarter-check.js';
import { CombinationsPanel } from './CombinationsPanel.js';
import { loadPairDossier, loadWindowDossiers } from './pairDossier.js';

const KIND: Record<string, string> = {
  keine_diagnose: 'Keine Diagnose', diagnose_ohne_sicherheit: 'Diagnose ohne Sicherheit', leistung_ohne_datum: 'Leistung ohne Datum',
  datum_ausserhalb_quartal: 'Außerhalb des Quartals', regel: 'Regelkonflikt',
};

/**
 * Quartalsprüfung der KVDT-Datei vor dem Versand an die KV. Nur lesen – es wird nichts verändert oder gesendet.
 * Patienten erscheinen nur als Pseudonym; die Zuordnung erfolgt in DURIA über die Fallnummer/Reihenfolge.
 */
export function QuarterCheck({ settings, rules, mode }: { settings: PracticeSettings; rules: RulePackage; mode: 'operational' | 'simulation' }) {
  const [report, setReport] = useState<QuarterReport | null>(null);
  const [meta, setMeta] = useState<{ name: string; patients: number; dropped: number; invalid: number } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState<'alle' | 'fehler'>('fehler');
  const [dossierError, setDossierError] = useState('');

  async function load() {
    setError('');
    const path = await open({ multiple: false, directory: false, filters: [{ name: 'KVDT', extensions: ['con', 'CON', 'xkm', 'txt', 'dat'] }] });
    if (typeof path !== 'string') return;
    setBusy(true);
    try {
      const r = await invoke<{ name: string; data: number[]; patients: number; dropped: number; invalid: number }>('read_kvdt', { path });
      setMeta({ name: r.name, patients: r.patients, dropped: r.dropped, invalid: r.invalid });
      // Prüfung im nächsten Takt, damit die Anzeige „prüft …“ sichtbar wird.
      await new Promise((ok) => setTimeout(ok, 0));
      // Paar-Dossier ist Entwurf: nur im Simulator laden und prüfen.
      const pairs = mode === 'simulation' ? await loadPairDossier() : null;
      const windows = mode === 'simulation' ? await loadWindowDossiers() : null;
      setDossierError([pairs, windows].map((x) => (x && 'error' in x ? x.error : '')).filter(Boolean).join(' '));
      setReport(checkQuarter(Uint8Array.from(r.data), settings, rules, mode,
        pairs && !('error' in pairs) ? pairs : null, windows && !('error' in windows) ? windows : null));
    } catch (e) { setError(String(e)); } finally { setBusy(false); }
  }

  const shown = useMemo(() => (report?.findings ?? []).filter((f) => filter === 'alle' || f.severity === 'fehler'), [report, filter]);
  const byCase = useMemo(() => {
    const m = new Map<number, typeof shown>();
    for (const f of shown) m.set(f.caseIndex, [...(m.get(f.caseIndex) ?? []), f]);
    return [...m];
  }, [shown]);

  return (
    <div className="stack">
      <section className="card">
        <h2><CalendarCheck size={22} aria-hidden="true" />Quartalsprüfung (KVDT) <span className="muted">vor dem Versand an die KV · nur lesen</span></h2>
        <p className="muted">Die Abrechnungsdatei aus DURIA öffnen (vor der Verschlüsselung). Es wird nichts verändert oder gesendet. Namen und Patientennummern werden vor der Prüfung entfernt.</p>
        <div className="row">
          <button className="primary" onClick={load} disabled={busy}>{busy ? 'Prüft …' : 'KVDT-Datei öffnen …'}</button>
          {meta && <span className="muted">{meta.name} · {meta.patients} Patienten · {meta.dropped} Identitätsfelder entfernt{meta.invalid > 0 ? ` · ${meta.invalid} ungültige Zeilen verworfen` : ''}</span>}
        </div>
        {error && <p className="error" role="alert">{error}</p>}
      </section>

      {report && (
        <section className="card">
          <div className="row">
            <h2 style={{ margin: 0 }}>{report.cases} Fälle{report.quarter ? ` · ${report.quarter.from} – ${report.quarter.to}` : ''}</h2>
            <span className={`pill ${report.bySeverity.fehler ? 'billing_conflict' : 'candidate'}`}>{report.bySeverity.fehler} Fehler</span>
            <span className="pill">{report.bySeverity.hinweis} Hinweise</span>
            <span className="spacer" />
            <label className="inline"><input type="checkbox" checked={filter === 'alle'} onChange={(e) => setFilter(e.target.checked ? 'alle' : 'fehler')} /> auch Hinweise</label>
          </div>
          {report.parseErrors.length > 0 && <p className="warn">⚠ {report.parseErrors.length} Zeilen konnten nicht gelesen werden – Ergebnis unvollständig.</p>}
          {byCase.length === 0 && <p className="muted">Keine Auffälligkeiten gefunden. (Ohne freigegebene EBM-Regeln werden nur formale Fehler geprüft.)</p>}
          <table>
            <thead><tr><th>Fall</th><th>Patient</th><th>Art</th><th>Befund</th></tr></thead>
            <tbody>
              {byCase.flatMap(([idx, items]) => items.map((f, i) => (
                <tr key={`${idx}-${i}`}>
                  <td>{i === 0 ? `#${idx + 1}` : ''}</td>
                  <td className="muted">{i === 0 ? f.patientToken?.slice(0, 10) ?? '–' : ''}</td>
                  <td><span className={`pill ${f.severity === 'fehler' ? 'billing_conflict' : ''}`}>{KIND[f.kind]}</span></td>
                  <td>{f.text}</td>
                </tr>
              )))}
            </tbody>
          </table>
        </section>
      )}
      {report && dossierError && <section className="card"><p className="error" role="alert">Kombinationsprüfung (Entwurf) nicht verfügbar: {dossierError}</p></section>}
      {report?.combinations && <CombinationsPanel combinations={report.combinations} />}
    </div>
  );
}
