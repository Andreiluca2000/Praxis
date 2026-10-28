import { issue, prop, textOf } from './build.js';
import { icdCodes, labeledSegments, reasonPhrase, segment } from './text.js';
import type { FieldProposal, FormDefinition, FormIssue, FormValues } from './types.js';

/** Was in jedem Vordruck gleich ist: Personalien aus DURIA, Diagnose nur vom Arzt, Unterschrift. */

export function personalien(form: FormDefinition): FieldProposal {
  return prop(form, 'personalien', 'duria', 'aus DURIA',
    'Personalien kommen aus der eGK über DURIA; Name und Anschrift sind in diesem Fenster nicht vorhanden (Datenschutz).');
}

export function stempel(form: FormDefinition): FieldProposal {
  return prop(form, 'stempel', 'arzt', null, 'Stempel und persönliche Unterschrift des Arztes – erst nach vollständigem Ausfüllen.');
}

/**
 * Diagnose wörtlich aus der Beschreibung („Diagnose: …“, sonst „wegen …“/„V. a. …“). ICD-Kodes nur,
 * wenn der Arzt sie mit Sicherheit (G/V/A/Z) genannt hat. Der Arzt bestätigt immer.
 */
export function diagnose(form: FormDefinition, text: string, fieldId = 'diagnose'): FieldProposal {
  const seg = segment(labeledSegments(text), 'diagnose');
  const phrase = cleanPhrase(seg ?? reasonPhrase(text));
  const codes = icdCodes(text).filter((c) => c.certainty).map((c) => `${c.icd} ${c.certainty}`);
  const value = [phrase, ...codes.filter((c) => !phrase?.includes(c))].filter(Boolean).join(' – ') || null;
  return value
    ? prop(form, fieldId, 'arzt', value, 'Wörtlich aus der Beschreibung übernommen – der Arzt bestätigt Diagnose bzw. Verdachtsdiagnose. ICD nur mit Sicherheit G/V/A/Z.', seg ?? phrase ?? codes.join(', '))
    : prop(form, fieldId, 'arzt', null, 'Diagnose bzw. Verdachtsdiagnose trägt der Arzt ein; die App erfindet keine Diagnose.');
}

/** Ein angeschnittener ICD-Kode am Ende („Lumbalgie M54“ aus „M54.5 G“) gehört nicht zum Diagnosetext. */
export function cleanPhrase(phrase: string | null): string | null {
  return phrase?.replace(/\s+[A-TV-Z]\d{2}$/u, '') ?? null;
}

/** Textfeld aus einem Abschnitt „Befund: …“ usw.; sonst trägt der Arzt ein. */
export function labeled(form: FormDefinition, text: string, fieldId: string, keys: string[], ifEmpty: string): FieldProposal {
  const v = segment(labeledSegments(text), ...keys);
  return v
    ? prop(form, fieldId, 'arzt', v, 'Aus der Beschreibung übernommen – bitte prüfen.', v)
    : prop(form, fieldId, 'arzt', null, ifEmpty);
}

/** ICD-Kodes in Diagnosefeldern brauchen die Sicherheit (G/V/A/Z) – wie überall in der App. */
export function icdIssues(form: FormDefinition, values: FormValues, fieldIds: string[]): FormIssue[] {
  const out: FormIssue[] = [];
  for (const id of fieldIds) {
    for (const c of icdCodes(textOf(values, id))) {
      if (!c.certainty) out.push(issue(form, 'fehlt', `ICD ${c.icd}: Diagnosesicherheit (G/V/A/Z) fehlt – der Arzt ergänzt sie.`, [id], null));
    }
  }
  return out;
}
