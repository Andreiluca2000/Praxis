import type { IsoDate } from '../src/domain/types.js';
import { karteiText, release, type DiagnosisMention, type Note, type NoteForm, type PublicAccount } from '../src/notes/note.js';
import { ollamaModel, summarize } from '../src/notes/summarize.js';

/** Notizen der laufenden Behandlung (nur im Arbeitsspeicher). */
export class NoteBook {
  list: Note[] = [];

  constructor(private readonly modelName: () => string | null) {}

  private model() {
    const name = this.modelName();
    return name ? ollamaModel(name) : null;
  }

  clear() { this.list = []; }

  async add(user: PublicAccount, transcript: string, form: NoteForm, serviceDate: IsoDate): Promise<Note> {
    const s = await summarize(transcript, form, this.model());
    const note: Note = {
      id: crypto.randomUUID(), serviceDate, author: user.kuerzel, authorRole: user.role, form, transcript, text: s.text,
      diagnoses: s.diagnoses.map((text): DiagnosisMention => ({ text, icd: null, certainty: null, confirmedBy: null })),
      status: 'entwurf', releasedBy: null, releasedAt: null, generator: s.generator,
    };
    this.list = [...this.list, note];
    return note;
  }

  /** Andere Form (Wortlaut/Kurz/Lang) aus demselben Transkript – ohne neu zu diktieren. */
  async reform(id: string, form: NoteForm): Promise<void> {
    const n = this.find(id);
    if (n.status === 'freigegeben') return;
    const s = await summarize(n.transcript, form, this.model());
    this.replace({ ...n, form, text: s.text, generator: s.generator });
  }

  edit(user: PublicAccount, id: string, patch: { text?: string; diagnoses?: DiagnosisMention[] }) {
    const n = this.find(id);
    if (n.status === 'freigegeben') return;
    // Diagnose gilt nur als bestätigt, wenn ein Arzt einen ICD-Code eingetragen hat.
    const diagnoses = patch.diagnoses?.map((d) => {
      const icd = d.icd?.trim().toUpperCase() || null;
      return { ...d, icd, confirmedBy: icd && user.role === 'arzt' ? user.kuerzel : null };
    });
    this.replace({ ...n, ...(patch.text !== undefined ? { text: patch.text } : {}), ...(diagnoses ? { diagnoses } : {}) });
  }

  release(user: PublicAccount, id: string): Note {
    const released = release(this.find(id), user);
    this.replace(released);
    return released;
  }

  text(id: string): string { return karteiText(this.find(id)); }

  private find(id: string): Note {
    const n = this.list.find((x) => x.id === id);
    if (!n) throw new Error('Notiz nicht gefunden.');
    return n;
  }

  private replace(n: Note) { this.list = this.list.map((x) => (x.id === n.id ? n : x)); }
}
