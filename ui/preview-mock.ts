/**
 * NUR für Bildschirmvorschau im Browser (pnpm ui:dev mit ?preview): ersetzt das Rust-Backend durch Attrappen.
 * Wird nur mit ?preview geladen und wird in der Desktop-App nie aktiv.
 */
import { mockIPC } from '@tauri-apps/api/mocks';

export function installPreviewMock() {
  const user = { kuerzel: 'AL', name: 'Dr. Vorschau', role: 'arzt', active: true, createdAt: '' };
  const config = {
    inbox_dir: 'C:\\ProgramData\\Praxis-Assistent\\gdt\\%CLIENTNAME%\\eingang',
    outbox_dir: 'C:\\ProgramData\\Praxis-Assistent\\gdt\\%CLIENTNAME%\\ausgang',
    outbox_file: 'PRAX_DUR.gdt', writeback_enabled: false, billing_writeback_enabled: false, billing_channel: 'gdt',
    mode: 'simulation', ollama_model: null, voice: { threads: 4, language: 'de' },
  };
  mockIPC((cmd) => {
    if (cmd === 'status') return { needs_setup: false, user, accounts: [user], config, voice_missing: [], session: 'PC07:AL' };
    if (cmd.startsWith('plugin:event')) return 0;
    return null;
  });
}
