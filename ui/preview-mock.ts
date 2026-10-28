/**
 * NUR für Bildschirmvorschau im Browser (pnpm ui:dev mit ?preview): ersetzt das Rust-Backend durch Attrappen.
 * Wird nur mit ?preview geladen und wird in der Desktop-App nie aktiv.
 */
import { mockIPC } from '@tauri-apps/api/mocks';
import { concatBytes, xdtLine } from '../src/duria/xdt.js';
import { activate, EMPTY_FILE, saveDraft, type PracticeRuleContent } from '../src/rules/model.js';

/** Erfundene Praxisregeln für die Vorschau (aktive Erinnerung, aktive Hausregel, ein Entwurf). */
function samplePracticeRules(): string {
  const by = { kuerzel: 'AL', role: 'arzt' as const };
  const t = '2026-10-12T09:00:00Z';
  const rule = (c: Omit<PracticeRuleContent, 'system' | 'validFrom'>) => ({ system: 'EBM' as const, validFrom: '2026-10-01', ...c });
  let f = EMPTY_FILE;
  let r = saveDraft(f, null, rule({ type: 'erinnerung', title: 'Gesprächsdauer bei 03230', codes: ['03230'], text: 'Gesprächsdauer in Minuten in der Karteikarte notieren (mind. 10 Minuten je Einheit).', priority: 'wichtig' }), by, t);
  f = activate(r.file, r.ruleId, 1, by, 'Hinweis der Abrechnungsberatung', t);
  r = saveDraft(f, null, rule({ type: 'kombination', title: '03230 nicht neben 35100', codes: ['03230'], partnerCodes: ['35100'], scope: 'calendar_day', text: 'Praxisintern: Gespräch und psychosomatische Leistung nicht am selben Tag abrechnen.', priority: 'hinweis' }), by, t);
  f = activate(r.file, r.ruleId, 1, by, 'Praxisabsprache 10/2026', t);
  r = saveDraft(f, null, rule({ type: 'zurueck', title: '01435 nur nach Rücksprache', codes: ['01435'], text: 'Die Praxis rechnet 01435 nicht automatisch ab.', priority: 'hinweis' }), by, t);
  return JSON.stringify(r.file);
}

/** Erfundener, bereits „bereinigter“ GDT-Satz für ?preview=patient (wie ihn Rust liefern würde). */
function syntheticExport() {
  const data = concatBytes([
    xdtLine('8000', '6310'), xdtLine('9206', '3'), xdtLine('3000', 'P-vorschau01'), xdtLine('6200', '27102026'),
    xdtLine('6220', 'Frau [entfernt] klagt seit 3 Tagen über Husten, kein Fieber.'),
    xdtLine('6001', 'J20.9'), xdtLine('6003', 'G'), xdtLine('5000', '27102026'),
    // Paare für die Vorschau: 03100 + 03360 zur gleichen Uhrzeit (Ausschluss), 03230 + 35100 ohne Uhrzeit (nicht prüfbar).
    xdtLine('5001', '03100'), xdtLine('5006', '0930'), xdtLine('5001', '03360'), xdtLine('5006', '0930'),
    xdtLine('5001', '03230'), xdtLine('5001', '35100'),
    // Ausschluss am selben Tag trotz verschiedener Uhrzeiten (Zeitraum-Regel aus dem Dossier „visits“).
    xdtLine('5001', '01101'), xdtLine('5006', '0800'), xdtLine('5001', '01955'), xdtLine('5006', '1900'),
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
    ai: { provider: 'aus', model: 'claude-opus-5-5', effort: 'low' },
  };
  // ?preview=login bzw. ?preview=setup zeigt die Anmeldung bzw. Ersteinrichtung.
  const screen = new URLSearchParams(location.search).get('preview');
  const loggedOut = screen === 'login' || screen === 'setup';
  let delivered = false;
  let aiKey = false;
  let practiceRules: string | null = samplePracticeRules();
  mockIPC((cmd, args) => {
    if (cmd === 'status') {
      return { needs_setup: screen === 'setup', user: loggedOut ? null : user, accounts: loggedOut ? [] : [user], config, voice_missing: [], session: 'PC07:AL' };
    }
    if (cmd.startsWith('plugin:event')) return 0;
    if (cmd === 'rules_read') return practiceRules;
    if (cmd === 'ai_status') return { config: config.ai, models: ['claude-opus-5-5', 'claude-sonnet-5-5', 'claude-haiku-5-5'], key_present: aiKey, audit: aiKey ? [{ at: 1793170000, user: 'AL', feature: 'verbindungstest', model: 'claude-opus-5-5', input_tokens: 61, output_tokens: 2, ok: true, note: '' }] : [] };
    if (cmd === 'ai_set_key') { aiKey = true; return null; }
    if (cmd === 'ai_delete_key') { aiKey = false; return null; }
    if (cmd === 'ai_preview') return { body: JSON.stringify({ model: config.ai.model, max_tokens: 4096, system: '…', messages: [{ role: 'user', content: `<daten>\n${String((args as { text: string }).text).replace(/P-[0-9a-f]{20}|\d{3,4}\/\d{5,}/g, '[entfernt]')}\n</daten>` }], output_config: { effort: config.ai.effort } }, null, 2), redactions: 2, truncated: false, chars: 180 };
    if (cmd === 'update_config') { Object.assign(config, (args as { patch: Record<string, unknown> }).patch); return config; }
    if (cmd === 'rules_write') { practiceRules = (args as { json: string }).json; return null; }
    if (cmd === 'take_incoming' && screen === 'patient' && !delivered) { delivered = true; return syntheticExport(); }
    return null;
  });
}
