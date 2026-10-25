import { useEffect, useState } from 'react';
import { usageNotes } from '../src/icd/catalog.js';
import type { IcdIndex } from '../src/icd/search.js';
import { karteiText, type DiagnosisMention, type Note, type NoteForm, type PublicAccount } from '../src/notes/note.js';
import { loadIcd } from './icd-store.js';
import { IcdSearch } from './IcdSearch.js';

interface Props {
  note: Note;
  user: PublicAccount;
  onReform: (form: NoteForm) => void;
  onEdit: (patch: { text?: string; diagnoses?: DiagnosisMention[] }) => void;
  onRelease: () => void;
}

const FORM = { wortlaut: 'Wortlaut', kurz: 'Kurz', lang: 'Ausführlich' } as const;

/** Eine Notiz: Form wechseln, Text korrigieren, Diagnosen kodieren, freigeben (nur Arzt). */
export function NoteCard({ note, user, onReform, onEdit, onRelease }: Props) {
  const [copied, setCopied] = useState(false);
  const [picker, setPicker] = useState<number | null>(null);
  const [idx, setIdx] = useState<IcdIndex | null>(null);
  const locked = note.status === 'freigegeben';
  const isArzt = user.role === 'arzt';
  useEffect(() => { if (note.diagnoses.length) loadIcd().then(setIdx, () => undefined); }, [note.diagnoses.length]);

  /** Prüft einen eingegebenen Kode gegen den amtlichen Katalog. */
  const icdState = (code: string | null) => {
    if (!code || !idx) return null;
    const e = idx.get(code);
    if (!e) return { ok: false, text: 'nicht im ICD-10-GM 2026' };
    const notes = usageNotes(e);
    return { ok: e.terminal && e.p295 !== 'V', text: notes.length ? `${e.title} – ${notes.join(' ')}` : e.title };
  };

  const setDiag = (i: number, patch: Partial<DiagnosisMention>) =>
    onEdit({ diagnoses: note.diagnoses.map((d, j) => (j === i ? { ...d, ...patch } : d)) });

  async function copy() {
    await navigator.clipboard.writeText(karteiText(note));
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <article className={`note ${locked ? 'locked' : ''}`}>
      <header className="row">
        <strong>[{note.author}]</strong>
        <span className="pill">{FORM[note.form]}</span>
        <span className="muted">{note.generator === 'regelbasiert' ? 'regelbasiert' : note.generator.replace('lokal:', 'lokales Modell: ')}</span>
        <span className={`pill ${locked ? 'candidate' : 'not_verifiable'}`}>{locked ? `freigegeben von ${note.releasedBy}` : 'Entwurf'}</span>
        <span className="spacer" />
        {!locked && (['wortlaut', 'kurz', 'lang'] as const).filter((f) => f !== note.form).map((f) => (
          <button key={f} className="link" onClick={() => onReform(f)}>als {FORM[f]}</button>
        ))}
      </header>
      <textarea value={note.text} readOnly={locked} rows={Math.min(12, Math.max(3, note.text.split('\n').length + 1))} onChange={(e) => onEdit({ text: e.target.value })} />
      {note.diagnoses.length > 0 && (
        <table>
          <thead><tr><th>Im Diktat genannt</th><th>ICD-10-GM</th><th>Sicherheit</th><th>Bestätigt</th></tr></thead>
          <tbody>
            {note.diagnoses.map((d, i) => {
              const s = icdState(d.icd);
              return (
              <tr key={i}>
                <td>{d.text}</td>
                <td>
                  <div className="row" style={{ gap: 6 }}>
                    <input value={d.icd ?? ''} placeholder="z. B. J20.9" disabled={locked || !isArzt} onChange={(e) => setDiag(i, { icd: e.target.value })} size={8} />
                    {!locked && isArzt && <button className="link" onClick={() => setPicker(i)}>ICD suchen</button>}
                  </div>
                  {s && <div className={s.ok ? 'muted' : 'warn'} style={{ fontSize: 12 }}>{s.ok ? '✔ ' : '⚠ '}{s.text}</div>}
                </td>
                <td>
                  <select value={d.certainty ?? ''} disabled={locked || !isArzt} onChange={(e) => setDiag(i, { certainty: (e.target.value || null) as DiagnosisMention['certainty'] })}>
                    <option value="">–</option><option>G</option><option>V</option><option>A</option><option>Z</option>
                  </select>
                </td>
                <td>{d.confirmedBy ?? '–'}</td>
              </tr>
              );
            })}
          </tbody>
        </table>
      )}
      {picker !== null && (
        <div className="dialog" role="dialog" aria-modal="true" onClick={(e) => e.target === e.currentTarget && setPicker(null)}>
          <section className="card">
            <div className="row"><h2 style={{ margin: 0 }}>ICD-Kode für „{note.diagnoses[picker]?.text}“</h2><span className="spacer" /><button className="link" onClick={() => setPicker(null)}>Schließen</button></div>
            <IcdSearch initial={(note.diagnoses[picker]?.text ?? '').replace(/^(Diagnose|Verdacht auf|V\.a\.|Zustand nach|Z\.n\.)\s*/i, '')}
              onPick={(e) => { setDiag(picker, { icd: e.code }); setPicker(null); }} />
          </section>
        </div>
      )}
      <footer className="row">
        <button onClick={copy}>{copied ? 'Kopiert ✓' : 'Text kopieren'}</button>
        {isArzt && !locked && <button className="primary" onClick={onRelease}>Freigeben {`→ DURIA`}</button>}
        {!isArzt && !locked && <span className="muted">Freigabe durch Arzt erforderlich.</span>}
      </footer>
    </article>
  );
}
