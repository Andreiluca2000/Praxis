import { formatIssues, isChecked, issue, prop, textOf } from './build.js';
import { getForm } from './catalog.js';
import { cleanPhrase, icdIssues, personalien, stempel } from './common.js';
import { cue, icdCodes, labeledSegments, reasonPhrase, segment, ttmmjj } from './text.js';
import type { FieldProposal, FormIssue, FormProposal, FormValues, PatientFacts } from './types.js';

/**
 * Muster 65 – Ärztliches Attest Kind (Stand 10.2018). Erläuterungen 01/2026, S. 139–141.
 * Bescheinigt die Behandlungsnotwendigkeit eines Kindes, das bei Vorsorge/Reha für Mütter oder Väter mit aufgenommen wird.
 */
const form = getForm('muster-65');
const ROWS = [1, 2, 3] as const;

const text_ = (id: string, value: string | null, why: string, ifEmpty: string, state: 'unbekannt' | 'leer' = 'unbekannt'): FieldProposal =>
  value ? prop(form, id, 'arzt', value, why, value) : prop(form, id, state, null, ifEmpty);

export function proposeMuster65(text: string, facts: PatientFacts, today: Date): FormProposal {
  const seg = labeledSegments(text);
  const codes = icdCodes(text).filter((c) => c.certainty);
  const phrase = cleanPhrase(segment(seg, 'diagnose') ?? reasonPhrase(text))?.replace(/\s*[A-TV-Z]\d{2}(?:\.\d{1,2})?\s*[GVAZ]?\b/gu, '').trim() || null;
  const weitere = segment(seg, 'weitere informationen') ?? ([facts.pflegegrad && `Pflegegrad ${facts.pflegegrad.value}`, facts.kindBehindert && 'Behinderung'].filter(Boolean).join(', ') || null);
  const einrichtung = segment(seg, 'anforderungen', 'einrichtung');
  const fields: FieldProposal[] = [
    personalien(form),
    text_('anamnese', segment(seg, 'anamnese'), 'Anamnese des Kindes aus der Beschreibung.', 'Kurze Anamnese und bisheriger Verlauf einschließlich der Beschwerden des Kindes.'),
    text_('gesundheitsstoerungen', segment(seg, 'gesundheitsstörungen', 'gesundheitsstörung', 'beschwerden'), 'Gesundheitsstörungen aus der Beschreibung.', 'Gesundheitsstörungen (z. B. gehäufte Atemwegsinfekte, Übergewicht, psychische Auffälligkeiten) – bei Bedarf.', 'leer'),
    ...ROWS.flatMap((i) => [
      i === 1 && phrase ? prop(form, 'erkrankung_1', 'arzt', phrase, 'Leistungsbegründende Erkrankung – der Arzt bestätigt.', phrase, 'm65.erkrankungen')
        : prop(form, `erkrankung_${i}`, i === 1 && !codes[0] ? 'unbekannt' : 'leer', null, i === 1 && !codes[0] ? 'Leistungsbegründende Erkrankung in der Reihenfolge ihrer Bedeutung.' : 'Klartext zur Diagnose – optional.', null, 'm65.erkrankungen'),
      codes[i - 1] ? prop(form, `icd_${i}`, 'arzt', `${codes[i - 1]!.icd} ${codes[i - 1]!.certainty}`, 'ICD-10-GM mit Sicherheit – der Arzt bestätigt.', codes[i - 1]!.evidence, 'm65.erkrankungen')
        : prop(form, `icd_${i}`, i === 1 ? 'unbekannt' : 'leer', null, i === 1 ? 'Diagnoseschlüssel ICD-10-GM (vom Arzt, mit Sicherheit).' : 'Nur bei weiterer Erkrankung.', null, 'm65.erkrankungen'),
    ]),
    text_('weitere_informationen', weitere, 'Weitere relevante Informationen (z. B. Behinderung, Entwicklungsverzögerung, Pflegegrad).', 'Nur bei Bedarf (Behinderung, Entwicklungsverzögerung, Pflegegrad).', 'leer'),
    text_('krankenbehandlung', segment(seg, 'bisherige therapie', 'bisherige behandlung', 'krankenbehandlung', 'therapie', 'medikation'), 'Bisherige Krankenbehandlung aus der Beschreibung.', 'Bisherige Leistungen der Krankenbehandlung (ärztlich/psychotherapeutisch, Arznei- und Heilmittel).'),
    text_('interventionen', segment(seg, 'interventionen', 'empfohlen', 'empfehlung'), 'Empfohlene Interventionen aus der Beschreibung.', 'Empfohlene Interventionen während der Maßnahme (z. B. Ernährungsberatung, Entspannung, Sport).'),
    einrichtung ? prop(form, 'zuweisung_ja', 'vorgeschlagen', true, 'Besondere Anforderungen an die Einrichtung.', einrichtung) : prop(form, 'zuweisung_ja', 'leer', false, 'Nur bei besonderen Anforderungen (z. B. Klima, Barrierefreiheit, Kostform).'),
    einrichtung ? prop(form, 'zuweisung_text', 'arzt', einrichtung, 'Anforderungen an die Einrichtung aus der Beschreibung.', einrichtung) : prop(form, 'zuweisung_text', 'leer', null, 'Nur bei „ja“.'),
    prop(form, 'datum', 'vorgeschlagen', ttmmjj(today), 'Ausstellungsdatum (heute).'),
    stempel(form),
  ];
  return { formId: 'muster-65', fields, generator: 'regelbasiert' };
}

export function checkMuster65(values: FormValues, facts: PatientFacts): FormIssue[] {
  const out: FormIssue[] = [];
  const add = (i: FormIssue | null) => { if (i) out.push(i); };
  add(issue(form, 'hinweis', 'Das Attest ersetzt nicht die Verordnung der Mutter bzw. des Vaters (Muster 64 Vorsorge, Muster 61 Reha).', [], 'm65.abgrenzung'));
  if (facts.reha && /reha|ahb|anschluss/iu.test(facts.reha.evidence)) add(issue(form, 'hinweis', `„${facts.reha.evidence}“: Hat das Kind einen eigenen Rehabilitationsbedarf, eine eigene Reha-Leistung (DRV oder GKV) beantragen bzw. verordnen.`, [], 'm65.eigener_rehabedarf'));
  if (!textOf(values, 'anamnese')) add(issue(form, 'fehlt', 'Kurze Anamnese des Kindes dokumentieren.', ['anamnese'], 'm65.anamnese'));
  const erk = ROWS.some((i) => textOf(values, `erkrankung_${i}`) || textOf(values, `icd_${i}`));
  if (!erk && !textOf(values, 'gesundheitsstoerungen')) add(issue(form, 'fehlt', 'Gesundheitsstörungen bzw. leistungsbegründende Erkrankungen angeben.', ['gesundheitsstoerungen', 'erkrankung_1', 'icd_1'], 'm65.erkrankungen'));
  out.push(...icdIssues(form, values, ROWS.map((i) => `icd_${i}`)));
  if (!textOf(values, 'krankenbehandlung')) add(issue(form, 'fehlt', 'Bisherige Krankenbehandlung des Kindes aufführen.', ['krankenbehandlung'], 'm65.krankenbehandlung'));
  if (!textOf(values, 'interventionen')) add(issue(form, 'fehlt', 'Empfohlene Interventionen für das Kind angeben.', ['interventionen'], 'm65.interventionen'));
  if (isChecked(values, 'zuweisung_ja') && !textOf(values, 'zuweisung_text')) add(issue(form, 'fehlt', 'Anforderungen an die Einrichtung benennen.', ['zuweisung_text'], 'm65.zuweisung'));
  out.push(...formatIssues(form, values));
  return out;
}
