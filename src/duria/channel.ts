import type { BillingEntry } from '../core/fertig.js';
import type { FileSink, WritebackConfig } from './writeback.js';
import { buildBillingGdt, type AcceptedEntry } from './billing-writeback.js';
import { concatBytes } from './xdt.js';

/**
 * Austauschbarer Übertragungsweg für angenommene Ziffern/Diagnosen.
 * Prüfungen (Arzt, Kontext, Duplikate, DEMO) bleiben in DuriaBillingWriteback – hier wird nur
 * das Dateiformat erzeugt. Neuer Weg (z. B. Partner-API) = neue Implementierung, sonst nichts ändern.
 */
export interface BillingChannel {
  readonly id: 'gdt' | 'hl7';
  readonly label: string;
  /** Vom Hersteller bestätigt? Unbestätigte Wege sind in der Oberfläche als solche markiert. */
  readonly confirmedByVendor: boolean;
  build(accepted: AcceptedEntry[], patientToken: string, cfg: WritebackConfig, key: string): Uint8Array;
}

export const gdtChannel: BillingChannel = {
  id: 'gdt', label: 'GDT 6310 (FK 5001 / 6001)', confirmedByVendor: false,
  build: (accepted, token, cfg, key) => buildBillingGdt(accepted, token, cfg, key),
};

/**
 * HL7 v2.5: DFT^P03 (Leistungen als FT1) + DG1 (Diagnosen). VORBEREITET, nicht bestätigt:
 * Welche Nachricht und welche Felder DURIA annimmt, ist offen (DURIA_FRAGEN.md Nr. 17).
 * Patientenkennung in PID-3 = Pseudonym; die echte Nummer setzt das Rust-Backend (wie bei GDT).
 */
export const hl7Channel: BillingChannel = {
  id: 'hl7', label: 'HL7 v2.5 DFT^P03 (vorbereitet)', confirmedByVendor: false,
  build(accepted, token, cfg, key) {
    const esc = (s: string) => s.replace(/\\/g, '\\E\\').replace(/\|/g, '\\F\\').replace(/\^/g, '\\S\\').replace(/&/g, '\\T\\').replace(/~/g, '\\R\\');
    const ts = new Date().toISOString().replace(/[-:T]/g, '').slice(0, 14);
    const day = (iso: string) => iso.replace(/-/g, '');
    const segs = [
      `MSH|^~\\&|${esc(cfg.senderId)}|PRAXIS|${esc(cfg.receiverId)}|PRAXIS|${ts}||DFT^P03^DFT_P03|${key.slice(0, 20)}|P|2.5|||AL|NE||8859/15`,
      `EVN|P03|${ts}`,
      `PID|1||${esc(token)}^^^PRAXIS^PI`,
    ];
    let ft = 0;
    let dg = 0;
    for (const { entry, acceptedBy } of accepted) {
      if (entry.type === 'ziffer') {
        ft += 1;
        segs.push(`FT1|${ft}|||${day(entry.date)}||CG|${esc(entry.code)}^^${entry.system}||1|||||||||||||${esc(acceptedBy)}`);
      } else {
        dg += 1;
        segs.push(`DG1|${dg}||${esc(entry.icd)}^^I10GM|||F|||||||||||${entry.certainty}|${esc(acceptedBy)}`);
      }
    }
    return concatBytes([new TextEncoder().encode(segs.join('\r') + '\r')]);
  },
};

export const CHANNELS = { gdt: gdtChannel, hl7: hl7Channel } as const;
export type ChannelId = keyof typeof CHANNELS;

export function entriesLabel(entries: BillingEntry[]): string {
  return entries.map((e) => (e.type === 'ziffer' ? e.code : `${e.icd} ${e.certainty}`)).join(', ');
}

export type { FileSink };
