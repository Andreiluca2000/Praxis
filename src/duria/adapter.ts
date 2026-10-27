import type { BilledService, CoverageEntry, IsoDate } from '../domain/types.js';
import type { XdtMapping } from './mapping.js';
import { first, parseXdt, parseXdtDate, type XdtRecord } from './xdt.js';

/**
 * Nur-Lese-Adapter: wandelt einen GDT/BDT-Export aus DURIA in datierte Bausteine.
 * - Identitätsfelder (Name, Geburtsdatum, Anschrift …) werden verworfen, nie gespeichert.
 * - Freitext bleibt im Arbeitsspeicher und gilt als nicht vertrauenswürdige Eingabe (FACT-10).
 * - Abdeckung meldet nur Tage, für die tatsächlich Einträge gelesen wurden (CTX-05).
 */

export interface DocumentedDiagnosis {
  code: string;
  certainty: string | null; // G/V/A/Z – wie dokumentiert, nie ergänzt
  side: string | null;
  date: IsoDate | null;
  ref: string;
}

export interface NoteEntry {
  date: IsoDate | null;
  text: string;
  ref: string;
}

export interface DuriaSnapshot {
  patientId: string | null;
  multiplePatients: boolean;
  services: BilledService[];
  diagnoses: DocumentedDiagnosis[];
  notes: NoteEntry[];
  coverage: CoverageEntry[];
  warnings: string[];
  droppedIdentityFields: number;
  vendorConfirmed: boolean;
}

export function readDuriaExport(buf: Uint8Array, mapping: XdtMapping, source: 'gdt' | 'bdt'): DuriaSnapshot {
  const parsed = parseXdt(buf, mapping.encoding === 'auto' ? {} : { encoding: mapping.encoding });
  const f = mapping.fields;
  const warnings = [...parsed.errors];
  const patientIds = new Set<string>();
  const services: BilledService[] = [];
  const diagnoses: DocumentedDiagnosis[] = [];
  const notes: NoteEntry[] = [];
  let dropped = 0;
  const known = new Set([
    f.satzart, f.patient_id, f.service_date, f.service_code, f.service_time ?? f.service_code, f.diagnosis_code, f.diagnosis_certainty,
    f.diagnosis_side, f.diagnosis_date, f.note_date, ...f.note_text, ...f.identity_fields_to_drop,
  ]);
  const unknownFks = new Set<string>();
  const date = (v: string | undefined) => parseXdtDate(v, mapping.date_format);

  parsed.records.forEach((rec: XdtRecord, ri) => {
    const pid = first(rec, f.patient_id)?.trim();
    if (pid) patientIds.add(pid);

    // xDT ist positionsgebunden: ein Datum gilt für die folgenden Einträge bis zum nächsten Datum.
    let svcDate: IsoDate | null = null;
    let noteDate: IsoDate | null = null;
    let diagDate: IsoDate | null = null;
    let lastDiag: DocumentedDiagnosis | null = null;
    let lastService: BilledService | null = null;
    for (const fld of rec.fields) {
      const ref = `${source}:${ri + 1}:${fld.line}`;
      if (f.identity_fields_to_drop.includes(fld.fk)) { dropped++; continue; }
      if (!known.has(fld.fk) && !/^[89]/.test(fld.fk)) unknownFks.add(fld.fk);

      if (fld.fk === f.service_date) svcDate = date(fld.value);
      else if (fld.fk === f.note_date) noteDate = date(fld.value);
      else if (fld.fk === f.diagnosis_date) diagDate = date(fld.value);
      else if (fld.fk === f.service_code) {
        const code = fld.value.trim();
        lastService = svcDate ? { code, system: 'EBM', date: svcDate, state: 'active', session: null, evidence: [{ ref, recorded_on: svcDate }] } : null;
        if (lastService) services.push(lastService);
        else warnings.push(`Leistung ${code} (Zeile ${fld.line}) ohne gültiges Datum – nicht übernommen.`);
      } else if (f.service_time && fld.fk === f.service_time && lastService) {
        lastService.session = fld.value.trim() || null;
      } else if (fld.fk === f.diagnosis_code) {
        lastDiag = { code: fld.value.trim().toUpperCase(), certainty: null, side: null, date: diagDate ?? svcDate ?? noteDate, ref };
        diagnoses.push(lastDiag);
      } else if (fld.fk === f.diagnosis_certainty && lastDiag) {
        lastDiag.certainty = fld.value.trim().toUpperCase() || null;
      } else if (fld.fk === f.diagnosis_side && lastDiag) {
        lastDiag.side = fld.value.trim().toUpperCase() || null;
      } else if (f.note_text.includes(fld.fk)) {
        notes.push({ date: noteDate ?? svcDate, text: fld.value, ref });
      }
    }
  });

  if (unknownFks.size > 0) warnings.push(`Nicht interpretierte Feldkennungen: ${[...unknownFks].sort().join(', ')}.`);
  if (!mapping.confirmed_by_vendor) warnings.push('Feldzuordnung noch nicht von DURIA bestätigt – Daten gelten als ungeprüft.');
  if (patientIds.size > 1) warnings.push('Export enthält mehrere Patienten – Analyse gesperrt.');
  if (patientIds.size === 0) warnings.push('Keine Patientennummer (FK 3000) gefunden – Analyse gesperrt.');

  // Abdeckung je tatsächlich gelesenem Tag; Lücken werden nicht überbrückt.
  const days = new Set<IsoDate>();
  for (const x of [...notes, ...diagnoses]) if (x.date) days.add(x.date);
  for (const s of services) days.add(s.date);
  const coverage: CoverageEntry[] = [...days].sort().flatMap((d) => [
    { domain: 'documentation' as const, from: d, to: d },
    { domain: 'billed_services' as const, from: d, to: d },
  ]);

  return {
    patientId: patientIds.size === 1 ? [...patientIds][0]! : null,
    multiplePatients: patientIds.size > 1,
    services, diagnoses, notes, coverage, warnings,
    droppedIdentityFields: dropped,
    vendorConfirmed: mapping.confirmed_by_vendor,
  };
}

/**
 * Vom Benutzer ausdrücklich bestätigt: der Export umfasst den GANZEN Zeitraum (auch Tage ohne Einträge).
 * Nur dann gilt z. B. ein Quartal als vollständig gelesen.
 */
export function declareCoverage(from: IsoDate, to: IsoDate): CoverageEntry[] {
  return [
    { domain: 'documentation', from, to },
    { domain: 'billed_services', from, to },
  ];
}
