import { Mic, Square } from 'lucide-react';
import { useRef, useState } from 'react';
import type { NoteForm } from '../src/notes/note.js';
import { api } from './platform.js';

/**
 * Diktat: Aufnahme im Fenster (Opus), Erkennung lokal im Backend (whisper.cpp).
 * Alternativ Text eintippen – gleiche Weiterverarbeitung.
 */
export function Dictation({ disabled, onText }: { disabled: boolean; onText: (text: string, form: NoteForm) => Promise<void> }) {
  const [form, setForm] = useState<NoteForm>('kurz');
  const [state, setState] = useState<'idle' | 'recording' | 'working'>('idle');
  const [typed, setTyped] = useState('');
  const [error, setError] = useState('');
  const recorder = useRef<MediaRecorder | null>(null);
  const chunks = useRef<Blob[]>([]);

  async function start() {
    setError('');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
      const rec = new MediaRecorder(stream, { mimeType: 'audio/webm;codecs=opus' });
      chunks.current = [];
      rec.ondataavailable = (e) => e.data.size && chunks.current.push(e.data);
      rec.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        setState('working');
        try {
          const text = await api.transcribe(new Blob(chunks.current, { type: 'audio/webm' }));
          chunks.current = [];
          if (!text) throw new Error('Kein Sprachinhalt erkannt.');
          await onText(text, form);
        } catch (err) {
          setError(String(err));
        } finally {
          setState('idle');
        }
      };
      rec.start();
      recorder.current = rec;
      setState('recording');
    } catch (err) {
      setError(`Mikrofon nicht verfügbar (${String(err)}). Bei Remote Desktop: „Aufnahme von diesem Computer“ aktivieren.`);
    }
  }

  async function submitTyped() {
    if (!typed.trim()) return;
    setState('working');
    try {
      await onText(typed, form);
      setTyped('');
    } catch (err) {
      setError(String(err));
    } finally {
      setState('idle');
    }
  }

  return (
    <section className="card">
      <h2><Mic size={22} aria-hidden="true" />Diktat</h2>
      <div className="row">
        <fieldset className="segmented" aria-label="Form der Notiz">
          {(['wortlaut', 'kurz', 'lang'] as const).map((f) => (
            <label key={f} className={form === f ? 'on' : ''}>
              <input type="radio" name="form" value={f} checked={form === f} onChange={() => setForm(f)} />
              {{ wortlaut: 'Wortlaut', kurz: 'Kurz', lang: 'Ausführlich' }[f]}
            </label>
          ))}
        </fieldset>
        {state === 'recording'
          ? <button className="danger" onClick={() => recorder.current?.stop()}><Square size={14} fill="currentColor" aria-hidden="true" />Aufnahme beenden</button>
          : <button disabled={disabled || state === 'working'} onClick={start}><span className="dot" aria-hidden="true" />Diktat starten</button>}
        {state === 'working' && <span className="muted">Wird lokal erkannt …</span>}
      </div>
      <div className="row" style={{ marginTop: 10 }}>
        <textarea placeholder="Hier erscheint der Diktattext – oder Text eingeben …" value={typed} onChange={(e) => setTyped(e.target.value)} rows={2} disabled={disabled} />
        <button onClick={submitTyped} disabled={disabled || state !== 'idle' || !typed.trim()}>Übernehmen</button>
      </div>
      {error && <p className="error" role="alert">{error}</p>}
    </section>
  );
}
