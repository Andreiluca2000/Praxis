import { hmacSha256, randomKey, sha256Hex, toHex } from '../domain/hash.js';

/**
 * Patientenkontext je Arbeitsplatz-Sitzung (CLAUDE_HANDOFF_RO.md „Contractul de integrare DURIA“).
 * - Die Patientennummer aus DURIA wird sofort zu einem lokalen Pseudonym (HMAC mit Sitzungsschlüssel).
 * - Kein globaler „aktiver Patient“: jede Sitzung (Arbeitsplatz/Benutzer) hat ihren eigenen Kontext.
 * - Ergebnisse sind an Kontext + Datenrevision gebunden; jede Abweichung macht sie unbrauchbar für Übernahme.
 */

export interface PatientContext {
  sessionId: string;
  /** Lokales Pseudonym – verlässt den Rechner nicht, ist kein Anonymisierungsnachweis. */
  patientToken: string;
  /** Hash über die gelesenen Rohdaten (Revision). */
  revision: string;
  openedAt: string;
  source: 'gdt' | 'bdt';
}

export type ContextCheck =
  | { ok: true }
  | { ok: false; reason: 'no_context' | 'patient_changed' | 'revision_changed' | 'session_mismatch' | 'expired' };

export class ContextRegistry {
  private readonly key = randomKey();
  private readonly sessions = new Map<string, PatientContext>();

  constructor(private readonly maxAgeMs = 30 * 60 * 1000, private readonly now = () => Date.now()) {}

  pseudonym(patientId: string): string {
    return toHex(hmacSha256(this.key, patientId.trim())).slice(0, 24);
  }

  open(sessionId: string, patientId: string, raw: Uint8Array, source: PatientContext['source']): PatientContext {
    const ctx: PatientContext = {
      sessionId,
      patientToken: this.pseudonym(patientId),
      revision: sha256Hex(raw).slice(0, 24),
      openedAt: new Date(this.now()).toISOString(),
      source,
    };
    this.sessions.set(sessionId, ctx);
    return ctx;
  }

  close(sessionId: string): void {
    this.sessions.delete(sessionId);
  }

  current(sessionId: string): PatientContext | null {
    const c = this.sessions.get(sessionId);
    if (!c) return null;
    if (this.now() - Date.parse(c.openedAt) > this.maxAgeMs) {
      this.sessions.delete(sessionId);
      return null;
    }
    return c;
  }

  /** Vor jeder (künftigen) Übernahme: stimmt der aktuelle Kontext noch mit dem der Analyse überein? */
  verify(sessionId: string, analysed: PatientContext): ContextCheck {
    if (analysed.sessionId !== sessionId) return { ok: false, reason: 'session_mismatch' };
    const raw = this.sessions.get(sessionId);
    if (!raw) return { ok: false, reason: 'no_context' };
    if (!this.current(sessionId)) return { ok: false, reason: 'expired' };
    if (raw.patientToken !== analysed.patientToken) return { ok: false, reason: 'patient_changed' };
    if (raw.revision !== analysed.revision) return { ok: false, reason: 'revision_changed' };
    return { ok: true };
  }
}
