import { CheckCircle2, Pencil, Play, ShieldCheck, X } from 'lucide-react';
import { useState, type KeyboardEvent } from 'react';
import { contentErrors, REQUIREMENT_LABEL, type PracticeRuleContent, type PracticeRuleType, type Requirement } from '../../src/rules/model.js';
import { TYPE_HINT, TYPE_ICON, TypePill } from './shared.js';
import { TYPE_LABEL } from '../../src/rules/model.js';

/** Ziffern als Chips; Eingabe mit Enter, Komma oder Leerzeichen. */
function CodesInput({ value, onChange, label }: { value: string[]; onChange: (v: string[]) => void; label: string }) {
  const [draft, setDraft] = useState('');
  const add = () => {
    const parts = draft.split(/[\s,;]+/).map((x) => x.trim().toUpperCase()).filter(Boolean);
    if (parts.length) onChange([...new Set([...value, ...parts])]);
    setDraft('');
  };
  const onKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (['Enter', ',', ' ', ';'].includes(e.key)) { e.preventDefault(); add(); }
    if (e.key === 'Backspace' && !draft && value.length) onChange(value.slice(0, -1));
  };
  return (
    <label>{label}
      <div className="chips-input">
        {value.map((c) => (
          <span key={c} className="chip">{c}<button type="button" aria-label={`${c} entfernen`} onClick={() => onChange(value.filter((x) => x !== c))}><X size={12} /></button></span>
        ))}
        <input className="code-input" value={draft} onChange={(e) => setDraft(e.target.value)} onKeyDown={onKey} onBlur={add} placeholder="Ziffer hinzufügen …" />
      </div>
    </label>
  );
}

/** Editor einer Regel (neue Regel oder nächste Fassung). Speichert als Entwurf; „Simulieren“ speichert und öffnet die Simulation. */
export function RuleEditor({ initial, subtitle, readOnly, onSave, onCancel }: {
  initial: PracticeRuleContent;
  subtitle: string;
  readOnly: boolean;
  onSave: (c: PracticeRuleContent, thenSimulate: boolean) => Promise<void>;
  onCancel: () => void;
}) {
  const [c, setC] = useState<PracticeRuleContent>(initial);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const set = (patch: Partial<PracticeRuleContent>) => setC((old) => ({ ...old, ...patch }));

  function setType(type: PracticeRuleType) {
    const { partnerCodes: _p, scope: _s, requirement: _r, ...rest } = c;
    setC({
      ...rest, type,
      ...(type === 'kombination' ? { partnerCodes: c.partnerCodes ?? [], scope: c.scope ?? 'calendar_day' } : {}),
      ...(type === 'pflicht' ? { requirement: c.requirement ?? 'dauer' } : {}),
    });
  }

  async function save(thenSimulate: boolean) {
    const errs = contentErrors(c);
    if (errs.length) return setError(errs.join(' '));
    setBusy(true);
    setError('');
    try { await onSave(c, thenSimulate); } catch (e) { setError(String(e)); } finally { setBusy(false); }
  }

  return (
    <div className="editor-grid">
      <section className="card">
        <h2><Pencil size={22} aria-hidden="true" />Regel bearbeiten <span className="muted">{subtitle}</span></h2>
        <label>Titel<input value={c.title} onChange={(e) => set({ title: e.target.value })} maxLength={80} disabled={readOnly} /></label>
        <span className="muted" style={{ fontWeight: 500 }}>Art der Regel</span>
        <div className="type-picker" role="radiogroup" aria-label="Art der Regel">
          {(Object.keys(TYPE_LABEL) as PracticeRuleType[]).map((k) => {
            const Icon = TYPE_ICON[k];
            return (
              <button key={k} type="button" role="radio" aria-checked={c.type === k} className={`type-option ${c.type === k ? 'on' : ''}`} onClick={() => setType(k)} disabled={readOnly}>
                <span className="nav-ico"><Icon size={19} aria-hidden="true" /></span>
                <span><strong>{TYPE_LABEL[k]}</strong><small>{TYPE_HINT[k]}</small></span>
              </button>
            );
          })}
        </div>
        <div className="two-cols">
          <CodesInput label="Auslöser (Ziffern)" value={c.codes} onChange={(codes) => set({ codes })} />
          <label>System
            <select value={c.system} onChange={(e) => set({ system: e.target.value as 'EBM' | 'GOAE' })} disabled={readOnly}><option value="EBM">EBM</option><option value="GOAE">GOÄ</option></select>
          </label>
        </div>
        {c.type === 'kombination' && (
          <div className="two-cols">
            <CodesInput label="zusammen mit (Partnerziffern)" value={c.partnerCodes ?? []} onChange={(partnerCodes) => set({ partnerCodes })} />
            <label>Zeitraum
              <select value={c.scope} onChange={(e) => set({ scope: e.target.value as 'calendar_day' | 'behandlungsfall' })} disabled={readOnly}>
                <option value="calendar_day">am selben Tag</option><option value="behandlungsfall">im selben Behandlungsfall</option>
              </select>
            </label>
          </div>
        )}
        {c.type === 'pflicht' && (
          <label>Welche Angabe muss vorliegen?
            <select value={c.requirement} onChange={(e) => set({ requirement: e.target.value as Requirement })} disabled={readOnly}>
              {(Object.keys(REQUIREMENT_LABEL) as Requirement[]).map((r) => <option key={r} value={r}>{REQUIREMENT_LABEL[r]}</option>)}
            </select>
          </label>
        )}
        <label>Text für Arzt und MFA
          <textarea value={c.text} onChange={(e) => set({ text: e.target.value })} rows={3} maxLength={400} disabled={readOnly} />
        </label>
        <div className="two-cols">
          <label>Wichtigkeit
            <fieldset className="segmented" aria-label="Wichtigkeit">
              {(['hinweis', 'wichtig'] as const).map((p) => (
                <label key={p} className={c.priority === p ? 'on' : ''}>
                  <input type="radio" name="prio" checked={c.priority === p} onChange={() => set({ priority: p })} disabled={readOnly} />{p === 'wichtig' ? 'Wichtig' : 'Hinweis'}
                </label>
              ))}
            </fieldset>
          </label>
          <label>Gültig ab<input type="date" value={c.validFrom} onChange={(e) => set({ validFrom: e.target.value })} disabled={readOnly} /></label>
        </div>
        {error && <p className="error" role="alert">{error}</p>}
        <div className="row" style={{ marginTop: 6 }}>
          <button type="button" className="link" onClick={onCancel}>Abbrechen</button>
          <span className="spacer" />
          {!readOnly && <button type="button" onClick={() => save(false)} disabled={busy}>Als Entwurf speichern</button>}
          {!readOnly && <button type="button" className="primary" onClick={() => save(true)} disabled={busy}><Play size={17} aria-hidden="true" />Simulieren</button>}
        </div>
      </section>
      <div className="stack">
        <section className="card">
          <h2><ShieldCheck size={22} aria-hidden="true" />Grenzen dieser Regel</h2>
          <ul className="checks">
            <li><CheckCircle2 size={17} aria-hidden="true" />Macht nur strenger oder erinnert</li>
            <li><CheckCircle2 size={17} aria-hidden="true" />Hebt keinen EBM/GOÄ-Ausschluss auf</li>
            <li><CheckCircle2 size={17} aria-hidden="true" />Erhöht keine Höchstzahl</li>
            <li><CheckCircle2 size={17} aria-hidden="true" />Gilt erst nach Simulation und ärztlicher Freigabe</li>
          </ul>
        </section>
        <section className="card">
          <h2>So erscheint sie</h2>
          <div className="finding">
            <div className="row"><TypePill t={c.type} label="Praxisregel" /><strong>{c.codes.join(', ') || '—'}</strong></div>
            <p className="rule-text">{c.text || '…'}</p>
          </div>
          <p className="muted">In „Fertig“ unter dem Vorschlag, in Behandlung und Quartalsprüfung als Hinweis – nie als Fehler.</p>
        </section>
      </div>
    </div>
  );
}
