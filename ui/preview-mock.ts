/**
 * NUR für Bildschirmvorschau im Browser (pnpm ui:dev mit ?preview): ersetzt das Rust-Backend durch Attrappen.
 * Wird nur mit ?preview geladen und wird in der Desktop-App nie aktiv.
 */
import { mockIPC } from '@tauri-apps/api/mocks';
import { concatBytes, xdtLine } from '../src/duria/xdt.js';

/** Erfundener, bereits „bereinigter“ GDT-Satz für ?preview=patient (wie ihn Rust liefern würde). */
function syntheticExport() {
  const data = concatBytes([
    xdtLine('8000', '6310'), xdtLine('9206', '3'), xdtLine('3000', 'P-vorschau01'), xdtLine('6200', '27102026'),
    xdtLine('6220', 'Frau [entfernt] klagt seit 3 Tagen über Husten, kein Fieber.'),
    xdtLine('6001', 'J20.9'), xdtLine('6003', 'G'), xdtLine('5000', '27102026'), xdtLine('5001', '03230'),
  ]);
  return { name: 'DURIA-Übergabe', format: 'gdt', data: Array.from(data), token: 'P-vorschau01', patient_ids: 1, dropped: 4, unknown: 2, invalid: 0, redacted: 2, revision: 'vorschau' };
}

export function installPreviewMock() {
  const user = { kuerzel: 'AL', name: 'Dr. Vorschau', role: 'arzt', active: true, createdAt: '' };
  const config = {
    inbox_dir: 'C:\\ProgramData\\Praxis-Assistent\\gdt\\%CLIENTNAME%\\eingang',
    outbox_dir: 'C:\\ProgramData\\Praxis-Assistent\\gdt\\%CLIENTNAME%\\ausgang',
    outbox_file: 'PRAX_DUR.gdt', writeback_enabled: false, billing_writeback_enabled: false, billing_channel: 'gdt',
    mode: 'simulation', ollama_model: null, voice: { threads: 4, language: 'de' },
  };
  // ?preview=login bzw. ?preview=setup zeigt die Anmeldung bzw. Ersteinrichtung.
  const screen = new URLSearchParams(location.search).get('preview');
  const loggedOut = screen === 'login' || screen === 'setup';
  let delivered = false;
  mockIPC((cmd) => {
    if (cmd === 'status') {
      return { needs_setup: screen === 'setup', user: loggedOut ? null : user, accounts: loggedOut ? [] : [user], config, voice_missing: [], session: 'PC07:AL' };
    }
    if (cmd.startsWith('plugin:event')) return 0;
    if (cmd === 'take_incoming' && screen === 'patient' && !delivered) { delivered = true; return syntheticExport(); }
    return null;
  });
}
