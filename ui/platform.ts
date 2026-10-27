import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { open } from '@tauri-apps/plugin-dialog';
import type { PublicAccount } from '../src/notes/note.js';
import type { FileSink } from '../src/duria/writeback.js';

/** Einzige Stelle, an der das Fenster mit dem Rust-Backend spricht. */

export interface AppConfig {
  inbox_dir: string;
  outbox_dir: string;
  outbox_file: string;
  writeback_enabled: boolean;
  /** Ziffern/Diagnosen per GDT an DURIA – erst nach Bestätigung durch DURIA einschalten. */
  billing_writeback_enabled: boolean;
  /** Übertragungsweg für Ziffern/Diagnosen. */
  billing_channel: 'gdt' | 'hl7';
  mode: 'simulation' | 'operational';
  ollama_model: string | null;
  voice: { threads: number; language: string };
}

export interface Status {
  needs_setup: boolean;
  user: PublicAccount | null;
  accounts: PublicAccount[];
  config: AppConfig;
  voice_missing: string[];
  session: string;
}

export const api = {
  status: () => invoke<Status>('status'),
  createAccount: (kuerzel: string, name: string, role: 'arzt' | 'mfa', password: string) =>
    invoke<PublicAccount>('create_account', { kuerzel, name, role, password }),
  setAccountActive: (kuerzel: string, active: boolean) => invoke<void>('set_account_active', { kuerzel, active }),
  login: (kuerzel: string, password: string) => invoke<PublicAccount>('login', { kuerzel, password }),
  logout: () => invoke<void>('logout'),
  transcribe: async (audio: Blob) => invoke<string>('transcribe', { audio: Array.from(new Uint8Array(await audio.arrayBuffer())) }),
  updateConfig: (patch: Partial<AppConfig>) => invoke<AppConfig>('update_config', { patch }),
  /** Rust liest und bereinigt die Datei; das Fenster erhält nie Identitätsdaten oder die echte Patientennummer. */
  async pickExport(): Promise<SanitizedExport | null> {
    const path = await open({ multiple: false, directory: false, filters: [{ name: 'GDT/BDT', extensions: ['gdt', 'bdt', 'dat', 'txt'] }] });
    if (typeof path !== 'string') return null;
    return toExport(await invoke<RawSanitized>('read_export', { path }));
  },
  /** Wartende Übergabe aus DURIA (einmalig abholen); `null`, wenn nichts wartet. */
  async takeIncoming(): Promise<SanitizedExport | null> {
    const r = await invoke<RawSanitized | null>('take_incoming');
    return r ? toExport(r) : null;
  },
  /** Das Ereignis ist nur ein Hinweis; die Daten werden abgeholt, damit beim Laden des Fensters nichts verloren geht. */
  onGdt: (fn: (x: SanitizedExport) => void) => listen('gdt-incoming', async () => {
    const x = await api.takeIncoming();
    if (x) fn(x);
  }),
  closePatient: () => invoke<void>('close_patient'),
  onNotice: (fn: (msg: string) => void) => listen<string>('notice', (e) => fn(e.payload)),
};

interface RawSanitized {
  name: string; data: number[]; token: string | null; patient_ids: number; dropped: number;
  unknown: number; invalid: number; redacted: number; revision: string;
}
/** Was Rust vor der Übergabe entfernt hat (nur Anzahlen, nie Inhalte). */
export interface ExportFilter { dropped: number; unknown: number; invalid: number; redacted: number }
export interface SanitizedExport { name: string; data: Uint8Array; token: string | null; patientIds: number; dropped: number; filter: ExportFilter; revision: string }
const toExport = (r: RawSanitized): SanitizedExport => ({
  name: r.name, data: Uint8Array.from(r.data), token: r.token, patientIds: r.patient_ids, dropped: r.dropped,
  filter: { dropped: r.dropped, unknown: r.unknown, invalid: r.invalid, redacted: r.redacted }, revision: r.revision,
});

/**
 * Rückweg zu DURIA: Pfad und Dateiname bestimmt das Backend. Die Datei enthält nur das Pseudonym;
 * Rust ersetzt es unmittelbar vor dem Schreiben durch die echte Nummer (nur für den geöffneten Patienten).
 */
export const tauriSink = (token: string): FileSink => ({
  async writeExclusive(_dir, _name, data) {
    return (await invoke<string>('gdt_write', { data: Array.from(data), token })) as 'written' | 'exists';
  },
});
