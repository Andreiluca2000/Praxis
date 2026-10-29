import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { open } from '@tauri-apps/plugin-dialog';
import type { PublicAccount } from '../src/notes/note.js';
import type { FileSink } from '../src/duria/writeback.js';
import type { DayAiRequest } from '../src/kvdt/day-ai.js';
import type { DayCall } from '../src/kvdt/day-check.js';

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
  /** KI-Assistent über die Claude API – standardmäßig aus. */
  ai: AiConfig;
  /** KV der Praxis; gespeichert, damit regionale Regeln (DMP) nach der Abmeldung gelten. */
  kv: 'Nordrhein' | 'Westfalen-Lippe' | null;
  /** Praxis hat die KV-Genehmigung für DMP Diabetes Typ 2. */
  dmp_dm2_teilnahme: boolean;
}

export interface AiConfig {
  provider: 'aus' | 'claude'; model: string; effort: 'low' | 'medium' | 'high';
  /** Freigabe KI-Stufe 2 (Kartei-Text); nur über eigenen Arzt-Dialog in Rust änderbar. */
  stage2?: { by: string; at: number; avv: boolean; zdr: boolean; dsfa: boolean } | null;
}
export interface AiAuditEntry { at: number; user: string; feature: string; model: string; input_tokens: number; output_tokens: number; ok: boolean; note: string }
export interface AiStatus { config: AiConfig; models: string[]; key_present: boolean; audit: AiAuditEntry[] }
export interface AiPreview { body: string; redactions: number; truncated: boolean; chars: number }
export interface AiTestResult { ok: boolean; model: string; answer: string; input_tokens: number; output_tokens: number }

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
  /** Registrierung auf dem Anmeldebildschirm; weitere Konten nur mit Freigabe durch ein Arztkonto. */
  registerAccount: (a: { kuerzel: string; name: string; role: 'arzt' | 'mfa'; password: string; approverKuerzel?: string; approverPassword?: string }) =>
    invoke<PublicAccount>('register_account', { kuerzel: a.kuerzel, name: a.name, role: a.role, password: a.password, approverKuerzel: a.approverKuerzel ?? null, approverPassword: a.approverPassword ?? null }),
  /** Praxisregeln (praxisweit). Lesen: jeder Angemeldete; Speichern: nur Ärzte, auf dem Server nur als Administrator. */
  rulesRead: () => invoke<string | null>('rules_read'),
  rulesWrite: (json: string) => invoke<void>('rules_write', { json }),
  /** KI-Assistent: der Schlüssel geht nur hinein (Credential Manager), nie zurück ins Fenster. */
  aiStatus: () => invoke<AiStatus>('ai_status'),
  aiSetKey: (key: string) => invoke<void>('ai_set_key', { key }),
  aiDeleteKey: () => invoke<void>('ai_delete_key'),
  aiTest: () => invoke<AiTestResult>('ai_test'),
  aiPreview: (text: string) => invoke<AiPreview>('ai_preview', { text }),
  /** Transferdatei (Argon2id + AES-256-GCM): Rust wählt die Datei per Dialog; `false` = abgebrochen. */
  aiExportKey: (password: string) => invoke<boolean>('ai_export_key', { password }),
  aiImportKey: (password: string) => invoke<boolean>('ai_import_key', { password }),
  /** KI im Tagesabschluss: Vorschau (sendet nichts) und Anfrage; Rust prüft Schalter, Stufe-2-Freigabe und minimiert. */
  aiDayPreview: (request: DayAiRequest) => invoke<AiPreview>('ai_day_preview', { request }),
  aiDayAsk: (request: DayAiRequest) => invoke<string>('ai_day_ask', { request }),
  /** Stufe 2 (Kartei-Text) nur nach Bestätigung von AVV/DPA, ZDR und DSFA durch einen Arzt. */
  aiStage2Unlock: (c: { avv: boolean; zdr: boolean; dsfa: boolean }) => invoke<AppConfig>('ai_stage2_unlock', c),
  aiStage2Lock: () => invoke<AppConfig>('ai_stage2_lock'),
  /** Tagesliste (nur Arzt): Pseudonym, Zeit, Platz, Kürzel – nie die Patientennummer. */
  dayList: () => invoke<DayCall[]>('day_list'),
  /** Geprüfte Aufrufe bis `upto` (Sekunden) löschen; spätere bleiben. */
  dayClose: (upto: number) => invoke<void>('day_close', { upto }),
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
  name: string; format: 'gdt' | 'bdt'; data: number[]; token: string | null; patient_ids: number; dropped: number;
  unknown: number; invalid: number; redacted: number; revision: string;
}
/** Was Rust vor der Übergabe entfernt hat (nur Anzahlen, nie Inhalte). */
export interface ExportFilter { dropped: number; unknown: number; invalid: number; redacted: number }
export interface SanitizedExport { name: string; format: 'gdt' | 'bdt'; data: Uint8Array; token: string | null; patientIds: number; dropped: number; filter: ExportFilter; revision: string }
const toExport = (r: RawSanitized): SanitizedExport => ({
  name: r.name, format: r.format, data: Uint8Array.from(r.data), token: r.token, patientIds: r.patient_ids, dropped: r.dropped,
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
