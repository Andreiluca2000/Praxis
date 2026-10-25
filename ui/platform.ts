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
  async pickExport(): Promise<{ name: string; data: Uint8Array } | null> {
    const path = await open({ multiple: false, directory: false, filters: [{ name: 'GDT/BDT', extensions: ['gdt', 'bdt', 'dat', 'txt'] }] });
    if (typeof path !== 'string') return null;
    const bytes = await invoke<number[]>('read_export', { path });
    return { name: path.split(/[\\/]/).pop() ?? path, data: Uint8Array.from(bytes) };
  },
  onGdt: (fn: (name: string, data: Uint8Array) => void) =>
    listen<[string, number[]]>('gdt-incoming', (e) => fn(e.payload[0], Uint8Array.from(e.payload[1]))),
  onNotice: (fn: (msg: string) => void) => listen<string>('notice', (e) => fn(e.payload)),
};

/** Rückweg zu DURIA: Pfad und Dateiname bestimmt ausschließlich das Backend (Konfiguration). */
export const tauriSink: FileSink = {
  async writeExclusive(_dir, _name, data) {
    return (await invoke<string>('gdt_write', { data: Array.from(data) })) as 'written' | 'exists';
  },
};
