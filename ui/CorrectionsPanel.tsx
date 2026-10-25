import { useState } from 'react';
import {
  adoptCorrection, correctionText, createCorrection, listText, markDone, type Certainty, type Correction,
} from '../src/corrections/corrections.js';
import type { IsoDate } from '../src/domain/types.js';
import type { DocumentedDiagnosis } from '../src/duria/adapter.js';
import type { PublicAccount } from '../src/notes/note.js';

/**
 * Korrekturen an bereits erfassten Diagnosen/Ziffern als Schrittliste.
 * Ausführung durch einen Menschen in DURIA → DURIA führt die gesetzlich geforderte Änderungshistorie.
 */
export function CorrectionsPanel({ list, onChange, user, date, recorded }: {
  list: Correction[];
  onChange: (l: Correction[]) => void;
  user: PublicAccount;
  date: IsoDate;
  recorded: DocumentedDiagnosis[];
}) {
  const isArzt = user.role === 'arzt';
  const dayDx = recorded.filter((d) => d.date === date);
  const [from, setFrom] = useState('');
  const [toIcd, setToIcd] = useState('');
  const [toCert, setToCert] = useState<Certainty | ''>('');
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);

  const replace = (c: Correction) => onChange(list.map((x) => (x.id === c.id ? c : x)));
  const open = list.filter((c) => c.status === 'offen');
  const text = listText(list);

  function add(remove: boolean) {
    setError('');
    const src = dayDx.find((d) => d.code === from);
    if (!src) return setError('Bitte die zu korrigierende Diagnose wählen.');
    const fromDx = { icd: src.code, certainty: (src.certainty as Certainty | null) ?? null };
    try {
      const c = remove
        ? createCorrection({ kind: 'diagnose_entfernen', from: fromDx }, date, reason, user)
        : createCorrection({ kind: 'diagnose_aendern', from: fromDx, to: { icd: toIcd, certainty: toCert || null } }, date, reason, user);
      onChange([...list, c]);
      setToIcd(''); setToCert(''); setReason('');
    } catch (e) { setError(String(e instanceof Error ? e.message : e)); }
  }

  async function copy() {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <section className="card">
      <h2>Korrekturen in DURIA <span className="muted">werden von Hand in DURIA ausgeführt – DURIA führt die Änderungshistorie</span></h2>
      {open.length === 0 && <p className="muted">Keine offenen Korrekturen.</p>}
      {open.map((c) => (
        <div key={c.id} className={`finding ${c.createdBy ? '' : 'vorschlag'}`}>
          <div className="row">
            <span className={`pill ${c.createdBy ? 'candidate' : 'not_verifiable'}`}>{c.createdBy ? 'festgelegt' : 'Vorschlag'}</span>
            <span>{correctionText(c)}</span>
            <span className="spacer" />
            {!c.createdBy && isArzt && <button onClick={() => replace(adoptCorrection(c, user))}>Übernehmen</button>}
            {c.createdBy && <button onClick={() => replace(markDone(c, user))}>In DURIA erledigt</button>}
            <button className="link" onClick={() => replace({ ...c, status: 'verworfen' })}>Verwerfen</button>
          </div>
        </div>
      ))}
      {text && (
        <div className="row" style={{ marginTop: 10 }}>
          <button className="primary" onClick={copy}>{copied ? 'Kopiert ✓' : 'Schrittliste kopieren'}</button>
        </div>
      )}

      {isArzt && dayDx.length > 0 && (
        <div className="row" style={{ marginTop: 16 }}>
          <label>In DURIA erfasst
            <select value={from} onChange={(e) => setFrom(e.target.value)}>
              <option value="">– wählen –</option>
              {dayDx.map((d) => <option key={d.ref} value={d.code}>{d.code}{d.certainty ? ` ${d.certainty}` : ''}</option>)}
            </select>
          </label>
          <label>Neu (ICD)<input value={toIcd} onChange={(e) => setToIcd(e.target.value)} placeholder="z. B. J20.9" size={8} /></label>
          <label>Sicherheit
            <select value={toCert} onChange={(e) => setToCert(e.target.value as Certainty | '')}>
              <option value="">–</option><option>G</option><option>V</option><option>A</option><option>Z</option>
            </select>
          </label>
          <label style={{ flex: 1 }}>Grund (Pflicht)<input value={reason} onChange={(e) => setReason(e.target.value)} /></label>
          <button onClick={() => add(false)}>Änderung hinzufügen</button>
          <button className="link" onClick={() => add(true)}>Entfernen hinzufügen</button>
        </div>
      )}
      {error && <p className="error" role="alert">{error}</p>}
    </section>
  );
}
