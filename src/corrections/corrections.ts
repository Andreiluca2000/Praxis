import type { FertigReport } from '../core/fertig.js';
import type { BilledService, IsoDate } from '../domain/types.js';
import type { DocumentedDiagnosis } from '../duria/adapter.js';
import type { Note } from '../notes/note.js';

/**
 * Korrekturen an bereits in DURIA erfassten Diagnosen/Ziffern.
 * Das Programm ändert nichts selbst: Es erstellt eine klare Liste von Schritten (mit Grund und Kürzel),
 * die ein Mensch in DURIA ausführt. So bleibt die Änderungshistorie in DURIA erhalten (§ 630f BGB).
 */

export type Certainty = 'G' | 'V' | 'A' | 'Z';
export interface Dx { icd: string; certainty: Certainty | null }

export type CorrectionBody =
  | { kind: 'diagnose_aendern'; from: Dx; to: Dx }
  | { kind: 'diagnose_entfernen'; from: Dx }
  | { kind: 'ziffer_entfernen'; code: string }
  | { kind: 'pruefen'; text: string };

export type Correction = CorrectionBody & {
  id: string;
  date: IsoDate;
  reason: string;
  source: 'automatisch' | 'manuell' | 'quartal';
  createdBy: string | null; // Kürzel; null = automatischer Vorschlag, noch nicht übernommen
  status: 'offen' | 'erledigt' | 'verworfen';
  doneBy: string | null;
};

const fmtDate = (iso: IsoDate) => { const [y, m, d] = iso.split('-'); return `${d}.${m}.${y}`; };
const fmtDx = (d: Dx) => `${d.icd}${d.certainty ? ` ${d.certainty}` : ''}`;
const ICD = /^[A-Z]\d{2}(\.[0-9A-Z]{1,2})?[!*+]?$/;
let seq = 0;
const newId = () => `k${Date.now().toString(36)}${(seq++).toString(36)}`;

/** Ein Schritt als Text zum Kopieren bzw. Abhaken. */
export function correctionText(c: Correction): string {
  const who = c.createdBy ? ` [${c.createdBy}]` : '';
  const head = `${fmtDate(c.date)} · `;
  switch (c.kind) {
    case 'diagnose_aendern': return `${head}Diagnose ${fmtDx(c.from)} → ${fmtDx(c.to)} (Grund: ${c.reason})${who}`;
    case 'diagnose_entfernen': return `${head}Diagnose ${fmtDx(c.from)} entfernen (Grund: ${c.reason})${who}`;
    case 'ziffer_entfernen': return `${head}Ziffer ${c.code} entfernen/stornieren (Grund: ${c.reason})${who}`;
    case 'pruefen': return `${head}Prüfen: ${c.text} (Grund: ${c.reason})${who}`;
  }
}

/** Manuelle Korrektur durch einen Arzt. Grund ist Pflicht; neue Diagnose braucht ICD-Format und Sicherheit. */
export function createCorrection(body: CorrectionBody, date: IsoDate, reason: string, by: { kuerzel: string; role: string }): Correction {
  if (by.role !== 'arzt') throw new Error('Nur Ärzte legen Korrekturen fest.');
  if (!reason.trim()) throw new Error('Bitte einen Grund angeben.');
  if (body.kind === 'diagnose_aendern') {
    const to = { icd: body.to.icd.trim().toUpperCase(), certainty: body.to.certainty };
    if (!ICD.test(to.icd)) throw new Error(`„${to.icd}“ ist kein gültiges ICD-10-GM-Format.`);
    if (!to.certainty) throw new Error('Diagnosesicherheit (G/V/A/Z) angeben.');
    if (to.icd === body.from.icd && to.certainty === body.from.certainty) throw new Error('Keine Änderung.');
    body = { ...body, to };
  }
  return { ...body, id: newId(), date, reason: reason.trim(), source: 'manuell', createdBy: by.kuerzel, status: 'offen', doneBy: null };
}

/** Automatische Vorschläge aus Diktat (bestätigte Diagnosen) und Abschlussprüfung. Müssen übernommen werden. */
export function proposeCorrections(input: {
  date: IsoDate;
  recordedDiagnoses: DocumentedDiagnosis[];
  recordedServices: BilledService[];
  notes: Note[];
  report: FertigReport | null;
}): Correction[] {
  const out: Correction[] = [];
  const add = (body: CorrectionBody, reason: string) =>
    out.push({ ...body, id: newId(), date: input.date, reason, source: 'automatisch', createdBy: null, status: 'offen', doneBy: null });
  const dayDx = input.recordedDiagnoses.filter((d) => d.date === input.date);

  for (const note of input.notes.filter((n) => n.serviceDate === input.date)) {
    for (const d of note.diagnoses) {
      if (!d.icd || !d.certainty || !d.confirmedBy) continue;
      const icd = d.icd.toUpperCase();
      const same = dayDx.find((r) => r.code === icd);
      if (same) {
        if (same.certainty && same.certainty !== d.certainty) {
          add({ kind: 'diagnose_aendern', from: { icd, certainty: same.certainty as Certainty }, to: { icd, certainty: d.certainty } },
            `Diagnosesicherheit laut Diktat von ${d.confirmedBy}: ${d.certainty}`);
        }
        continue;
      }
      // Unspezifischer Code derselben Kategorie in DURIA (z. B. J20.9 / J20) → spezifischer laut Diktat.
      const cat = icd.slice(0, 3);
      const vague = dayDx.find((r) => r.code.slice(0, 3) === cat && r.code !== icd && (/\.9$/.test(r.code) || r.code.length === 3));
      if (vague) {
        add({ kind: 'diagnose_aendern', from: { icd: vague.code, certainty: vague.certainty as Certainty | null }, to: { icd, certainty: d.certainty } },
          `spezifischer kodiert laut Diktat von ${d.confirmedBy}`);
      }
    }
  }

  for (const p of input.report?.proposals ?? []) {
    if (p.finding?.outcome !== 'billing_conflict') continue;
    for (const conflict of p.finding.conflicts) add({ kind: 'pruefen', text: `${p.finding.codes.join(', ')} – ${conflict}` }, 'Konflikt aus der Abschlussprüfung');
  }
  return out;
}

export function adoptCorrection(c: Correction, by: { kuerzel: string; role: string }): Correction {
  if (by.role !== 'arzt') throw new Error('Nur Ärzte übernehmen Korrekturvorschläge.');
  return { ...c, createdBy: by.kuerzel };
}

/** Erledigt markieren darf auch die MFA (sie führt den Schritt in DURIA aus) – nur wenn ein Arzt ihn festgelegt hat. */
export function markDone(c: Correction, by: { kuerzel: string }): Correction {
  if (!c.createdBy) throw new Error('Vorschlag muss zuerst von einem Arzt übernommen werden.');
  return { ...c, status: 'erledigt', doneBy: by.kuerzel };
}

export function listText(list: Correction[]): string {
  return list.filter((c) => c.status === 'offen' && c.createdBy).map((c, i) => `${i + 1}. ${correctionText(c)}`).join('\n');
}
