import type { IsoDate } from '../domain/types.js';

/** Angemeldeter Benutzer, wie ihn das Rust-Backend nach erfolgreicher Anmeldung liefert. */
export interface PublicAccount {
  kuerzel: string;
  name: string;
  role: 'arzt' | 'mfa';
  active: boolean;
  createdAt: string;
}

export const PERMISSIONS = {
  arzt: ['dictate', 'release_note', 'confirm_diagnosis', 'confirm_billing', 'manage_users'],
  mfa: ['dictate', 'prepare_note', 'view_findings'],
} as const;
export type Permission = (typeof PERMISSIONS)[PublicAccount['role']][number];

export function can(account: PublicAccount, perm: Permission): boolean {
  return account.active && (PERMISSIONS[account.role] as readonly string[]).includes(perm);
}

/**
 * Karteikarten-Notiz aus einem Diktat. Drei vom Arzt wählbare Formen:
 *  - wortlaut: exakt wie gesprochen (nur Transkription, keine Umformulierung)
 *  - kurz:     Kurzzusammenfassung
 *  - lang:     ausführliche Zusammenfassung
 * Jede Notiz trägt das Kürzel des Verfassers. Zusammenfassungen sind KI-Entwürfe,
 * bis der Arzt sie freigibt; erst dann darf sie an DURIA übergeben werden.
 */

export type NoteForm = 'wortlaut' | 'kurz' | 'lang';
export type NoteStatus = 'entwurf' | 'freigegeben';

export interface DiagnosisMention {
  /** Wie im Diktat genannt – kein Code, solange ICD-Katalog fehlt oder der Arzt nicht bestätigt. */
  text: string;
  icd: string | null;
  certainty: 'G' | 'V' | 'A' | 'Z' | null;
  confirmedBy: string | null;
}

export interface Note {
  id: string;
  serviceDate: IsoDate;
  author: string; // Kürzel
  authorRole: PublicAccount['role'];
  form: NoteForm;
  transcript: string;
  text: string;
  diagnoses: DiagnosisMention[];
  status: NoteStatus;
  releasedBy: string | null;
  releasedAt: string | null;
  generator: 'manuell' | 'regelbasiert' | `lokal:${string}`;
}

/** Text, wie er in die Karteikarte geht: mit Kürzel und Form, ohne Patientendaten. */
export function karteiText(note: Note): string {
  const form = { wortlaut: 'Diktat', kurz: 'Kurz', lang: 'Ausführlich' }[note.form];
  const diag = note.diagnoses.filter((d) => d.confirmedBy && d.icd).map((d) => `${d.icd}${d.certainty ? ` ${d.certainty}` : ''}`);
  return [`[${note.author}] ${form}: ${note.text.trim()}`, diag.length ? `Diagnosen: ${diag.join(', ')}` : '']
    .filter(Boolean)
    .join('\n');
}

export function release(note: Note, by: PublicAccount, now = new Date()): Note {
  if (by.role !== 'arzt' || !by.active) throw new Error('Nur Ärzte dürfen Notizen freigeben.');
  if (note.status === 'freigegeben') return note;
  if (!note.text.trim()) throw new Error('Leere Notiz kann nicht freigegeben werden.');
  return { ...note, status: 'freigegeben', releasedBy: by.kuerzel, releasedAt: now.toISOString() };
}
