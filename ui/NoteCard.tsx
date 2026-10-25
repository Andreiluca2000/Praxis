import { useState } from 'react';
import { karteiText, type DiagnosisMention, type Note, type NoteForm, type PublicAccount } from '../src/notes/note.js';

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
  const locked = note.status === 'freigegeben';
  const isArzt = user.role === 'arzt';

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
            {note.diagnoses.map((d, i) => (
              <tr key={i}>
                <td>{d.text}</td>
                <td><input value={d.icd ?? ''} placeholder="z. B. J20.9" disabled={locked || !isArzt} onChange={(e) => setDiag(i, { icd: e.target.value })} size={8} /></td>
                <td>
                  <select value={d.certainty ?? ''} disabled={locked || !isArzt} onChange={(e) => setDiag(i, { certainty: (e.target.value || null) as DiagnosisMention['certainty'] })}>
                    <option value="">–</option><option>G</option><option>V</option><option>A</option><option>Z</option>
                  </select>
                </td>
                <td>{d.confirmedBy ?? '–'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <footer className="row">
        <button onClick={copy}>{copied ? 'Kopiert ✓' : 'Text kopieren'}</button>
        {isArzt && !locked && <button className="primary" onClick={onRelease}>Freigeben {`→ DURIA`}</button>}
        {!isArzt && !locked && <span className="muted">Freigabe durch Arzt erforderlich.</span>}
      </footer>
    </article>
  );
}
