import { sha256Hex } from '../domain/hash.js';
import type { Note } from '../notes/note.js';
import { karteiText } from '../notes/note.js';
import type { ContextRegistry, PatientContext } from './context.js';
import { concatBytes, xdtLine, type XdtEncoding } from './xdt.js';

/**
 * Rückweg zu DURIA als GDT-Ergebnisdatei (Satzart 6310), abgelegt im Austauschverzeichnis.
 * DURIA übernimmt die Datei selbst – das Programm greift nie in die DURIA-Oberfläche ein.
 * Voraussetzungen (CTX-01…07): Arzt-Freigabe, unveränderter Kontext, idempotent.
 * Das eigentliche Schreiben übernimmt die Plattform (Tauri/Rust; in Tests Node) über `FileSink`.
 * Die konkrete Dateikonvention ist mit DURIA zu bestätigen (docs/DURIA_FRAGEN.md).
 */

export interface WritebackConfig {
  enabled: boolean;
  exchangeDir: string;
  fileName: string; // z. B. "PRAX_DUR.gdt" – laut DURIA-Konfiguration
  senderId: string; // GDT-ID des Programms (FK 8316)
  receiverId: string; // GDT-ID von DURIA (FK 8315)
  encoding: XdtEncoding;
}

/** Atomares Schreiben; 'exists', wenn DURIA die letzte Datei noch nicht abgeholt hat. */
export interface FileSink {
  writeExclusive(dir: string, name: string, data: Uint8Array): Promise<'written' | 'exists'>;
}

export type WritebackResult =
  | { ok: true; file: string; idempotencyKey: string }
  | { ok: false; reason: string };

/** GDT-Zeilen sind auf 999 Byte begrenzt → lange Texte auf mehrere 6228-Zeilen verteilen. */
function splitText(text: string, max = 60): string[] {
  const lines: string[] = [];
  for (const para of text.split(/\r?\n/)) {
    let rest = para;
    while (rest.length > max) {
      const space = rest.lastIndexOf(' ', max);
      const cut = space > 20 ? space : max;
      lines.push(rest.slice(0, cut));
      rest = rest.slice(cut).trimStart();
    }
    lines.push(rest);
  }
  return lines;
}

export function buildGdtResult(note: Note, patientId: string, cfg: WritebackConfig, key: string): Uint8Array {
  const enc = cfg.encoding;
  const [y, m, d] = note.serviceDate.split('-');
  const body = [
    xdtLine('8315', cfg.receiverId, enc),
    xdtLine('8316', cfg.senderId, enc),
    xdtLine('9206', enc === 'cp437' ? '2' : '3', enc),
    xdtLine('9218', '02.10', enc),
    xdtLine('3000', patientId, enc),
    xdtLine('6200', `${d}${m}${y}`, enc),
    xdtLine('8402', 'ALLG00', enc),
    xdtLine('6304', `Praxis-Assistent ${key.slice(0, 12)}`, enc),
    ...splitText(karteiText(note)).map((l) => xdtLine('6228', l, enc)),
  ];
  // FK 8100 = Satzlänge gesamt (inkl. 8000- und 8100-Zeile; die 8100-Zeile hat 14 Byte).
  const head = xdtLine('8000', '6310', enc);
  const total = head.length + 14 + body.reduce((s, b) => s + b.length, 0);
  return concatBytes([head, xdtLine('8100', String(total).padStart(5, '0'), enc), ...body]);
}

export class DuriaWriteback {
  private readonly written = new Set<string>();

  constructor(private readonly cfg: WritebackConfig, private readonly contexts: ContextRegistry, private readonly sink: FileSink) {}

  async write(note: Note, sessionId: string, analysed: PatientContext, patientId: string): Promise<WritebackResult> {
    if (!this.cfg.enabled) return { ok: false, reason: 'Rückweg zu DURIA ist deaktiviert (Einstellungen).' };
    if (note.status !== 'freigegeben' || !note.releasedBy) return { ok: false, reason: 'Notiz ist nicht vom Arzt freigegeben.' };
    const check = this.contexts.verify(sessionId, analysed);
    if (!check.ok) return { ok: false, reason: `Patientenkontext ungültig (${check.reason}) – bitte neu laden.` };
    if (this.contexts.pseudonym(patientId) !== analysed.patientToken) return { ok: false, reason: 'Patientennummer passt nicht zum Kontext.' };

    const key = sha256Hex(`${analysed.patientToken}|${note.id}|${note.releasedAt}`);
    if (this.written.has(key)) return { ok: false, reason: 'Diese Notiz wurde bereits übergeben (kein Duplikat).' };

    const r = await this.sink.writeExclusive(this.cfg.exchangeDir, this.cfg.fileName, buildGdtResult(note, patientId, this.cfg, key));
    if (r === 'exists') return { ok: false, reason: 'DURIA hat die vorherige Übergabe noch nicht abgeholt – bitte warten.' };
    this.written.add(key);
    return { ok: true, file: `${this.cfg.exchangeDir}\\${this.cfg.fileName}`, idempotencyKey: key };
  }
}
