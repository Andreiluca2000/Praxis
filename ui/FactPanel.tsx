import { ClipboardCheck } from 'lucide-react';
import type { Mention } from '../src/facts/extract.js';
import { conflicts, SERVICE_STATUSES, suggestedStatus, type ChronicConfirmation, type FactConfirmation, type ServiceStatus } from '../src/facts/confirm.js';
import type { PublicAccount } from '../src/notes/note.js';

const LABEL: Record<ServiceStatus, string> = {
  performed: 'erbracht (heute, hier)', planned: 'geplant', recommended: 'empfohlen', refused: 'abgelehnt', external: 'extern', historical: 'früher',
};
const HINT: Record<string, string> = { negated: 'Verneinung', family_history: 'Familienanamnese', unknown: 'unklar' };

/** Welche Chroniker-/DMP-Bestätigungen zum Patienten passen (aus gesicherten Diagnosen und KV). */
export interface ChronicPrompt { chronic: boolean; dmp: boolean; pending: boolean }

const CHRONIC_LABEL: Record<ChronicConfirmation, string> = {
  intensiveCare: '03221: mind. zwei persönliche Kontakte im Quartal und Behandlung leitliniengerecht überprüft/angepasst',
  dmpEnrolled: 'Patient ist im DMP Diabetes Typ 2 eingeschrieben',
  dmpDocumented: 'DMP-Dokumentation für dieses Quartal vollständig und fristgerecht übermittelt',
};

/**
 * Angaben aus der Karteikarte bestätigen. Erkanntes ist nur ein Vorschlag;
 * „Fertig“ verwendet ausschließlich, was hier bestätigt wurde.
 */
export function FactPanel({ mentions, value, user, chronic, onChange }: {
  mentions: (Mention & { text: string })[];
  value: FactConfirmation;
  user: PublicAccount;
  chronic: ChronicPrompt;
  onChange: (c: FactConfirmation) => void;
}) {
  const shown: ChronicConfirmation[] = [...(chronic.chronic ? ['intensiveCare' as const] : []), ...(chronic.dmp ? ['dmpEnrolled' as const, 'dmpDocumented' as const] : [])];
  const setChronic = (key: ChronicConfirmation, on: boolean) => {
    const rest = Object.fromEntries(Object.entries(value.chronic).filter(([k]) => k !== key));
    onChange({ ...value, chronic: on ? { ...rest, [key]: { by: user.kuerzel } } : rest });
  };
  const decisionFor = (ref: string) => value.decisions.find((d) => d.ref === ref);
  const setDecision = (ref: string, status: ServiceStatus | null | undefined) => {
    const rest = value.decisions.filter((d) => d.ref !== ref);
    onChange({ ...value, decisions: status === undefined ? rest : [...rest, { ref, status, by: user.kuerzel }] });
  };
  const textDurations = mentions.filter((m) => m.durationMinutes !== null);
  const warn = conflicts(value);

  return (
    <section className="card">
      <h2><ClipboardCheck size={22} aria-hidden="true" />Angaben aus der Karteikarte <span className="muted">bitte bestätigen – nur Bestätigtes wird geprüft</span></h2>
      {mentions.length === 0 && <p className="muted">Für den Behandlungstag wurden keine Einträge in der Karteikarte gefunden.</p>}
      {mentions.map((m) => {
        const d = decisionFor(m.ref);
        const suggestion = suggestedStatus(m);
        return (
          <div key={m.ref} className={`finding ${d ? (d.status ? 'angenommen' : 'verworfen') : ''}`}>
            <p>„{m.text}“</p>
            <div className="row">
              <span className="muted">
                Vorschlag: {suggestion ? LABEL[suggestion] : HINT[m.status] ?? 'unklar'}{m.cue ? ` (Hinweis „${m.cue}“)` : ''}
                {m.eventDate ? ` · Datum ${m.eventDate}` : ''}
              </span>
              <span className="spacer" />
              <select aria-label="Status bestätigen" value={d ? d.status ?? 'none' : ''}
                onChange={(e) => setDecision(m.ref, e.target.value === '' ? undefined : e.target.value === 'none' ? null : e.target.value as ServiceStatus)}>
                <option value="">– offen –</option>
                <option value="none">nicht verwenden</option>
                {SERVICE_STATUSES.map((s) => <option key={s} value={s}>{LABEL[s]}</option>)}
              </select>
              {!d && suggestion && <button onClick={() => setDecision(m.ref, suggestion)}>Vorschlag bestätigen</button>}
            </div>
          </div>
        );
      })}
      <div className="row" style={{ marginTop: 14 }}>
        <label>Dauer laut Dokumentation (Minuten)
          <input type="number" min={0} step={1} placeholder="unbekannt" style={{ width: 120 }}
            value={value.durationMinutes?.value ?? ''}
            onChange={(e) => onChange({ ...value, durationMinutes: e.target.value === '' ? null : { value: Number(e.target.value), by: user.kuerzel, source: 'benutzer', ref: `benutzer:${user.kuerzel}:dauer` } })} />
        </label>
        {textDurations.map((m) => (
          <button key={m.ref} className="link" onClick={() => onChange({ ...value, durationMinutes: { value: m.durationMinutes!, by: user.kuerzel, source: 'text', ref: m.ref } })}>
            {m.durationMinutes} Min. aus dem Text übernehmen
          </button>
        ))}
        <label className="inline">
          <input type="checkbox" checked={value.componentsComplete?.value ?? false}
            onChange={(e) => onChange({ ...value, componentsComplete: e.target.checked ? { value: true, by: user.kuerzel } : null })} />
          Pflichtinhalte der Leistung dokumentiert
        </label>
      </div>
      <p className="muted">Ohne Angabe bleibt die Dauer unbekannt; es wird nichts geschätzt.</p>
      {shown.length > 0 && (
        <div style={{ display: 'grid', gap: 6, marginTop: 10 }}>
          <strong>Chroniker / DMP</strong>
          {shown.map((k) => (
            <label key={k} className="inline">
              <input type="checkbox" checked={Boolean(value.chronic[k])} onChange={(e) => setChronic(k, e.target.checked)} />
              {CHRONIC_LABEL[k]}
            </label>
          ))}
          <span className="muted">Nicht angehakt bleibt „unbekannt“ – die Ziffer wird dann nicht vorgeschlagen.{chronic.pending ? ' Wirkt erst nach ärztlicher Freigabe der Regeln (Welle 1).' : ''}</span>
        </div>
      )}
      {warn.map((w) => <p key={w} className="warn">⚠ {w}</p>)}
    </section>
  );
}
