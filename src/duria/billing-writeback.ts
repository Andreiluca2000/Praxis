import type { BillingEntry } from '../core/fertig.js';
import { sha256Hex } from '../domain/hash.js';
import type { PublicAccount } from '../notes/note.js';
import type { ContextRegistry, PatientContext } from './context.js';
import type { FileSink, WritebackConfig } from './writeback.js';
import { concatBytes, xdtLine } from './xdt.js';

/**
 * Übernahme angenommener Vorschläge als ABRECHNUNGSDATEN (Ziffern + Diagnosen), nicht als Notiz.
 * Feldkennungen nach xDT-Standard: 5000 Leistungsdatum, 5001 GNR, 6001 ICD, 6003 Sicherheit, 6004 Seite.
 * Ob DURIA diese Felder per GDT übernimmt, ist zu bestätigen (docs/DURIA_FRAGEN.md Nr. 12) – deshalb
 * eigener Schalter `billingEnabled`, unabhängig vom Notiz-Rückweg.
 * Bedingungen: Arzt hat angenommen, Kontext unverändert, Code nicht schon erfasst, idempotent.
 */

export interface AcceptedEntry {
  entry: BillingEntry;
  acceptedBy: string; // Kürzel des Arztes
}

export type BillingWriteResult =
  | { ok: true; written: number; idempotencyKey: string }
  | { ok: false; reason: string };

/** Ein Datum je Block: xDT ordnet Ziffern/Diagnosen dem vorangehenden Datum zu. */
export function buildBillingGdt(accepted: AcceptedEntry[], patientId: string, cfg: WritebackConfig, key: string): Uint8Array {
  const enc = cfg.encoding;
  const xdtDate = (iso: string) => { const [y, m, d] = iso.split('-'); return `${d}${m}${y}`; };
  const byDate = new Map<string, AcceptedEntry[]>();
  for (const a of accepted) byDate.set(a.entry.date, [...(byDate.get(a.entry.date) ?? []), a]);

  const body: Uint8Array[] = [
    xdtLine('8315', cfg.receiverId, enc),
    xdtLine('8316', cfg.senderId, enc),
    xdtLine('9206', enc === 'cp437' ? '2' : '3', enc),
    xdtLine('9218', '02.10', enc),
    xdtLine('3000', patientId, enc),
    xdtLine('6304', `Praxis-Assistent Abrechnung ${key.slice(0, 12)}`, enc),
  ];
  for (const [date, items] of [...byDate].sort(([a], [b]) => (a < b ? -1 : 1))) {
    body.push(xdtLine('5000', xdtDate(date), enc));
    for (const { entry } of items) if (entry.type === 'ziffer') body.push(xdtLine('5001', entry.code, enc));
    body.push(xdtLine('6000', xdtDate(date), enc));
    for (const { entry } of items) {
      if (entry.type !== 'diagnose') continue;
      body.push(xdtLine('6001', entry.icd, enc), xdtLine('6003', entry.certainty, enc));
      if (entry.side) body.push(xdtLine('6004', entry.side, enc));
    }
    const who = [...new Set(items.map((i) => i.acceptedBy))].join(', ');
    body.push(xdtLine('6228', `[${who}] angenommen über Praxis-Assistent`, enc));
  }
  const head = xdtLine('8000', '6310', enc);
  const total = head.length + 14 + body.reduce((s, b) => s + b.length, 0);
  return concatBytes([head, xdtLine('8100', String(total).padStart(5, '0'), enc), ...body]);
}

export class DuriaBillingWriteback {
  private readonly written = new Set<string>();

  constructor(
    private readonly cfg: WritebackConfig & { billingEnabled: boolean },
    private readonly contexts: ContextRegistry,
    private readonly sink: FileSink,
  ) {}

  async write(
    accepted: AcceptedEntry[], user: PublicAccount, sessionId: string, analysed: PatientContext, patientId: string,
    alreadyRecorded: { codes: { code: string; date: string }[]; diagnoses: { icd: string; date: string }[] },
  ): Promise<BillingWriteResult> {
    if (!this.cfg.billingEnabled) return { ok: false, reason: 'Übernahme von Ziffern/Diagnosen nach DURIA ist nicht aktiviert.' };
    if (user.role !== 'arzt' || !user.active) return { ok: false, reason: 'Nur Ärzte dürfen Abrechnungsdaten übernehmen.' };
    if (accepted.length === 0) return { ok: false, reason: 'Nichts angenommen.' };
    if (accepted.some((a) => a.acceptedBy !== user.kuerzel)) return { ok: false, reason: 'Annahme muss vom angemeldeten Arzt stammen.' };
    if (accepted.some((a) => a.entry.type === 'ziffer' && a.entry.system === 'DEMO')) return { ok: false, reason: 'DEMO-Ziffern werden nie übernommen.' };

    const check = this.contexts.verify(sessionId, analysed);
    if (!check.ok) return { ok: false, reason: `Patientenkontext ungültig (${check.reason}) – bitte neu laden.` };
    if (this.contexts.pseudonym(patientId) !== analysed.patientToken) return { ok: false, reason: 'Patientennummer passt nicht zum Kontext.' };

    // Nichts doppelt eintragen, was DURIA bereits hat.
    const fresh = accepted.filter(({ entry: e }) => e.type === 'ziffer'
      ? !alreadyRecorded.codes.some((c) => c.code === e.code && c.date === e.date)
      : !alreadyRecorded.diagnoses.some((d) => d.icd === e.icd && d.date === e.date));
    if (fresh.length === 0) return { ok: false, reason: 'Alle angenommenen Einträge sind in DURIA bereits erfasst.' };

    const fingerprint = fresh.map(({ entry: e }) => (e.type === 'ziffer' ? `Z:${e.code}@${e.date}` : `D:${e.icd}${e.certainty}@${e.date}`)).sort().join('|');
    const key = sha256Hex(`${analysed.patientToken}|${fingerprint}`);
    if (this.written.has(key)) return { ok: false, reason: 'Diese Einträge wurden bereits übergeben (kein Duplikat).' };

    const r = await this.sink.writeExclusive(this.cfg.exchangeDir, this.cfg.fileName, buildBillingGdt(fresh, patientId, this.cfg, key));
    if (r === 'exists') return { ok: false, reason: 'DURIA hat die vorherige Übergabe noch nicht abgeholt – bitte warten.' };
    this.written.add(key);
    return { ok: true, written: fresh.length, idempotencyKey: key };
  }
}
