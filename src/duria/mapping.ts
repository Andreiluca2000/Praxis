import { readFileSync } from 'node:fs';
import type { XdtEncoding } from './xdt.js';

/**
 * Zuordnung der xDT-Feldkennungen. Standardwerte folgen GDT 2.1 / BDT; die tatsächlich von der
 * konkreten DURIA-Installation exportierten Felder sind mit der technischen Hotline zu bestätigen
 * (Status in `confirmed_by_vendor`). Ohne Bestätigung markiert die Oberfläche die Daten als „ungeprüft“.
 */
export interface XdtMapping {
  version: string;
  confirmed_by_vendor: boolean;
  encoding: XdtEncoding | 'auto';
  date_format: 'auto' | 'TTMMJJJJ' | 'JJJJMMTT';
  fields: {
    satzart: string;
    patient_id: string;
    /** Identitätsfelder werden beim Einlesen verworfen – nur zur Erkennung aufgelistet. */
    identity_fields_to_drop: string[];
    service_date: string;
    service_code: string;
    diagnosis_code: string;
    diagnosis_certainty: string;
    diagnosis_side: string;
    diagnosis_date: string;
    note_date: string;
    note_text: string[];
  };
  satzarten: {
    gdt_request: string[];
    bdt_patient: string[];
    bdt_treatment: string[];
  };
}

export const DEFAULT_MAPPING: XdtMapping = {
  version: '0.1.0',
  confirmed_by_vendor: false,
  encoding: 'auto',
  date_format: 'auto',
  fields: {
    satzart: '8000',
    patient_id: '3000',
    identity_fields_to_drop: ['3100', '3101', '3102', '3103', '3104', '3105', '3106', '3107', '3108', '3110', '3112', '3113', '3114', '3622', '3626', '3628'],
    service_date: '5000',
    service_code: '5001',
    diagnosis_code: '6001',
    diagnosis_certainty: '6003',
    diagnosis_side: '6004',
    diagnosis_date: '6000',
    note_date: '6200',
    note_text: ['6220', '6227', '6228', '6230', '6205'],
  },
  satzarten: {
    gdt_request: ['6302', '6310', '6311'],
    bdt_patient: ['6100'],
    bdt_treatment: ['6200'],
  },
};

export function loadMapping(path?: string): XdtMapping {
  if (!path) return DEFAULT_MAPPING;
  const user = JSON.parse(readFileSync(path, 'utf8')) as Partial<XdtMapping>;
  return {
    ...DEFAULT_MAPPING,
    ...user,
    fields: { ...DEFAULT_MAPPING.fields, ...(user.fields ?? {}) },
    satzarten: { ...DEFAULT_MAPPING.satzarten, ...(user.satzarten ?? {}) },
  };
}
