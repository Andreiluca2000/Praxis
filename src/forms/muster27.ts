import { formatIssues, issue, prop, textOf } from './build.js';
import { getForm } from './catalog.js';
import { personalien, stempel } from './common.js';
import { labeledSegments, segment, ttmmjj, uni } from './text.js';
import type { FieldProposal, FormIssue, FormProposal, FormValues, PatientFacts } from './types.js';

/**
 * Muster 27 – Soziotherapeutischer Betreuungsplan gemäß § 37a SGB V (Stand 10.2014). Erläuterungen 01/2026, S. 76.
 * Ergebnis der Abstimmung zwischen Arzt, soziotherapeutischem Leistungserbringer und Patient; Anlage zu Muster 26.
 */
const form = getForm('muster-27');
const MAX_MASSNAHMEN = 9;
const ROWS = [1, 2, 3, 4] as const;
const IK = /^\d{9}$/;

const splitList = (v: string | null): string[] => (v ? v.split(/\s*[;,]\s*|\s+und\s+/u).map((s) => s.trim()).filter(Boolean) : []);

/** „Begleitung zu Arztterminen 1x/Woche 3 Monate“ → Art, Frequenz, Zeitraum. */
function durchfuehrung(item: string): { art: string; frequenz: string | null; zeitraum: string | null } {
  const freq = uni(/\b(\d+\s*x\s*(?:\/|pro|je|im|in der)?\s*(?:woche|wöchentlich|monat|monatlich)\w*|wöchentlich|monatlich|täglich)\b/iu).exec(item);
  const zeit = uni(/\b((?:für|über)?\s*\d{1,2}\s*(?:wochen|monate)|bis\s+\d{1,2}\.\d{1,2}\.(?:\d{2,4})?)\b/iu).exec(item);
  let art = item;
  for (const m of [freq, zeit]) if (m) art = art.replace(m[0], ' ');
  return { art: art.replace(/\s+/gu, ' ').replace(/[,;:]\s*$/u, '').trim(), frequenz: freq?.[0] ?? null, zeitraum: zeit?.[0]?.trim().replace(/^(?:für|über)\s*/iu, '') ?? null };
}

export function proposeMuster27(text: string, _facts: PatientFacts, today: Date): FormProposal {
  const seg = labeledSegments(text);
  const ik = uni(/\b(?:ik|institutionskennzeichen)\D{0,10}(\d{9})\b/iu).exec(text);
  const nah = segment(seg, 'nahziele', 'nahziel');
  const fern = segment(seg, 'fernziele', 'fernziel');
  const ziele = [nah && `Nahziel: ${nah}`, fern && `Fernziel: ${fern}`].filter(Boolean).join('; ') || segment(seg, 'therapieziele', 'therapieziel', 'ziele', 'ziel');
  const mass = splitList(segment(seg, 'maßnahmen'));
  const durch = splitList(segment(seg, 'durchführung')).map(durchfuehrung);
  const fields: FieldProposal[] = [
    personalien(form),
    ik ? prop(form, 'ik', 'vorgeschlagen', ik[1]!, 'Institutionskennzeichen des soziotherapeutischen Leistungserbringers.', ik[0])
      : prop(form, 'ik', 'unbekannt', null, 'IK (9 Ziffern) des soziotherapeutischen Leistungserbringers eintragen.'),
    ziele ? prop(form, 'ziele', 'arzt', ziele, 'Therapieziele aus der Beschreibung – Nah- und Fernziele unterscheiden.', ziele)
      : prop(form, 'ziele', 'unbekannt', null, 'Therapieziele angeben – Nahziele (z. B. Belastungsfähigkeit) und Fernziele (z. B. Arbeitsfähigkeit).'),
    ...Array.from({ length: MAX_MASSNAHMEN }, (_, i) => (mass[i]
      ? prop(form, `massnahme${i + 1}`, 'arzt', mass[i]!, 'Verordnete bzw. empfohlene Maßnahme, deren Inanspruchnahme zu koordinieren ist.', mass[i]!)
      : prop(form, `massnahme${i + 1}`, i === 0 ? 'unbekannt' : 'leer', null, i === 0 ? 'Maßnahmen benennen (z. B. psychiatrische Sprechstunde, Ergotherapie, Psychotherapie).' : 'Weitere Maßnahme nur bei Bedarf.', null, 'm27.massnahmen'))),
  ];
  for (const i of ROWS) {
    const d = durch[i - 1];
    const leer = i === 1 ? 'unbekannt' : 'leer';
    fields.push(
      d?.art ? prop(form, `art${i}`, 'vorgeschlagen', d.art, 'Art der soziotherapeutischen Maßnahme.', d.art) : prop(form, `art${i}`, leer, null, i === 1 ? 'Art der soziotherapeutischen Maßnahmen angeben (z. B. „Durchführung: Begleitung zu Arztterminen 1x/Woche 3 Monate“).' : 'Weitere Zeile nur bei Bedarf.', null, 'm27.durchfuehrung'),
      d?.frequenz ? prop(form, `frequenz${i}`, 'vorgeschlagen', d.frequenz, 'Frequenz pro Woche bzw. Monat.', d.frequenz) : prop(form, `frequenz${i}`, d ? 'unbekannt' : leer, null, 'Frequenz pro Woche/Monat.', null, 'm27.durchfuehrung'),
      d?.zeitraum ? prop(form, `zeitraum${i}`, 'vorgeschlagen', d.zeitraum, 'Zeitraum.', d.zeitraum) : prop(form, `zeitraum${i}`, d ? 'unbekannt' : leer, null, 'Zeitraum.', null, 'm27.durchfuehrung'),
    );
  }
  fields.push(
    prop(form, 'datum', 'vorgeschlagen', ttmmjj(today), 'Ausstellungsdatum (heute).'),
    stempel(form),
    prop(form, 'unterschrift_therapeut', 'leer', null, 'Datum und Unterschrift des Therapeuten.'),
    prop(form, 'unterschrift_patient', 'leer', null, 'Datum und Unterschrift des Patienten.'),
  );
  return { formId: 'muster-27', fields, generator: 'regelbasiert' };
}

export function checkMuster27(values: FormValues, _facts: PatientFacts): FormIssue[] {
  const out: FormIssue[] = [];
  const add = (i: FormIssue | null) => { if (i) out.push(i); };
  const ik = textOf(values, 'ik');
  if (!ik) add(issue(form, 'fehlt', 'IK des Leistungserbringers eintragen.', ['ik'], 'm27.ik'));
  else if (!IK.test(ik)) add(issue(form, 'unzulaessig', 'Institutionskennzeichen hat 9 Ziffern.', ['ik'], 'm27.ik'));
  const ziele = textOf(values, 'ziele');
  if (!ziele) add(issue(form, 'fehlt', 'Therapieziele angeben.', ['ziele'], 'm27.therapieziele'));
  else if (!uni(/\b(nah|fern)\w*/iu).test(ziele)) add(issue(form, 'hinweis', 'Therapieziele in Nah- und Fernziele unterscheiden.', ['ziele'], 'm27.therapieziele'));
  if (!Array.from({ length: MAX_MASSNAHMEN }, (_, i) => textOf(values, `massnahme${i + 1}`)).some(Boolean)) add(issue(form, 'fehlt', 'Mindestens eine Maßnahme benennen (höchstens 9).', ['massnahme1'], 'm27.massnahmen'));
  const used = ROWS.filter((i) => ['art', 'frequenz', 'zeitraum'].some((k) => textOf(values, `${k}${i}`)));
  if (!used.length) add(issue(form, 'fehlt', 'Durchführung: Art, Frequenz pro Woche/Monat und Zeitraum angeben.', ['art1', 'frequenz1', 'zeitraum1'], 'm27.durchfuehrung'));
  for (const i of used) {
    const miss = ['art', 'frequenz', 'zeitraum'].filter((k) => !textOf(values, `${k}${i}`)).map((k) => `${k}${i}`);
    if (miss.length) add(issue(form, 'fehlt', `Durchführung Zeile ${i}: Art, Frequenz und Zeitraum vollständig angeben.`, miss, 'm27.durchfuehrung'));
  }
  add(issue(form, 'hinweis', 'Original zusammen mit der Verordnung (Muster 26) spätestens am 3. Arbeitstag der Kasse vorlegen; der Plan soll von allen Beteiligten unterschrieben werden.', [], 'm27.vorlage'));
  out.push(...formatIssues(form, values));
  return out;
}
