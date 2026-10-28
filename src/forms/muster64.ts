import { checkbox, exactlyOne, formatIssues, isChecked, issue, pickOne, prop, textOf } from './build.js';
import { getForm } from './catalog.js';
import { cleanPhrase, icdIssues, personalien, stempel } from './common.js';
import { cue, icdCodes, labeledSegments, reasonPhrase, segment, ttmmjj, uni } from './text.js';
import type { FieldProposal, FormIssue, FormProposal, FormValues, PatientFacts } from './types.js';

/**
 * Muster 64 – Verordnung medizinischer Vorsorge für Mütter oder Väter gemäß § 24 SGB V (Stand 10.2018, Teil A und B).
 * Erläuterungen 01/2026, S. 133–138. Reha für Mütter/Väter ist Muster 61; das Attest für mitaufgenommene Kinder Muster 65.
 */
const form = getForm('muster-64');
const ROWS = [1, 2, 3] as const;
const KIND_GRUND = ['attest', 'beziehung', 'psychosozial'] as const;

/** Kontextfaktoren (Teil A, II. C.) → Stichwörter. */
const KONTEXT: readonly [string, RegExp][] = [
  ['k_mehrfach', /\b(mehrfachbelast\w*|doppelbelast\w*|beruf und familie)\b/iu],
  ['k_unterstuetzung', /\b(keine unterstützung|mangelnde\w* unterstützung|ohne unterstützung)\b/iu],
  ['k_erziehung', /\b(erziehungsschwierigkeit\w*|erziehungsprobleme?)\b/iu],
  ['k_alltag', /\b(alltagsprobleme?|problembewältigung)\b/iu],
  ['k_grundkompetenz', /\b(grundkompetenz\w*)\b/iu],
  ['k_betreuungsaufwand', /\b(chronisch krank\w* kind\w*|behindert\w* kind\w*|verhaltensauffällig\w*|frühgeboren\w*|mehrlinge?|zwillinge|drillinge)\b/iu],
  ['k_anerkennung', /\b(fehlende\w* anerkennung)\b/iu],
  ['k_partner', /\b(trennung\w*|scheidung\w*|eheprobleme?|partnerprobleme?|partnerschaftskonflikt\w*)\b/iu],
  ['k_pflege', /\b(pflege (?:von|der|des) (?:angehörig\w*|mutter|vater|eltern|schwieger\w*)|pflegt (?:die|den|ihre|seine) (?:mutter|vater|eltern|schwieger\w*))\b/iu],
  ['k_tod', /\b(tod (?:des|der) (?:partner\w*|ehemann\w*|ehefrau|mutter|vater\w*)|verwitwet)\b/iu],
  ['k_teenager', /\b(teenager-?schwangerschaft|minderjährige mutter)\b/iu],
  ['k_isolation', /\b(soziale\w* isolation|sozial isoliert|einsam\w*)\b/iu],
  ['k_finanzen', /\b(finanzielle\w* sorgen|schulden|geldsorgen)\b/iu],
  ['k_zeitdruck', /\b(zeitdruck)\b/iu],
  ['k_allein', /\b(alleinerziehend\w*|allein erziehend\w*)\b/iu],
  ['k_beziehung', /\b((?:mutter|vater)-?kind-?beziehung\w*|bindungsstörung\w*)\b/iu],
  ['k_ueberforderung', /\b(überforder\w*)\b/iu],
  ['k_sprache', /\b(sprachliche\w* verständigungs\w*|sprachbarriere\w*|kaum deutsch)\b/iu],
  ['k_arbeitszeiten', /\b(schichtdienst|schichtarbeit|nachtdienst\w*|unregelmäßige\w* arbeitszeiten)\b/iu],
  ['k_arbeitsplatz', /\b(arbeitsplatzverlust|drohende\w* kündigung|arbeitslos\w*)\b/iu],
  ['k_gleichberechtigung', /\b(nicht gleichberechtigt\w*)\b/iu],
];

function leistungsform(text: string): FieldProposal[] {
  const vater = cue(/\b(vater|väter|vaters)\b/iu, text);
  const mitKind = cue(/\b((?:mutter|vater)-?kind\w*|mit (?:dem |den |ihrem |ihren |seinem |seinen )?(?:kind|kindern|sohn|tochter)|kinder? (?:soll(?:en)? )?mit)\b/iu, text);
  if (mitKind) return pickOne(form, 'leistungsform', vater ? 'vater_kind' : 'mutter_kind', 'Gemeinsame Leistung mit Kind(ern) – nur bei eigener Vorsorgebedürftigkeit, nicht bei eigener Reha-Indikation des Kindes.', mitKind);
  const mutter = cue(/\b(mutter|mütter|mütterkur|mutterkur)\b/iu, text);
  if (vater) return pickOne(form, 'leistungsform', 'vaeter', 'Väter-Leistung.', vater);
  if (mutter) return pickOne(form, 'leistungsform', 'muetter', 'Mütter-Leistung.', mutter);
  return pickOne(form, 'leistungsform', null, 'Leistungsform (Mütter-/Väter- oder Mutter-/Vater-Kind-Leistung) empfehlen.', null);
}

function kinder(text: string, mitKind: boolean): FieldProposal[] {
  const krank = cue(/\b((?:kind\w*|sohn|tochter)[^.;]{0,30}?(?:asthma|neurodermitis|adipositas|übergewicht|adhs|entwicklungs\w*|chronisch\w*|behindert\w*|verhaltensauffällig\w*)|attest kind)\b/iu, text);
  return ROWS.flatMap((i) => {
    const first = i === 1 && mitKind;
    return [
      prop(form, `kind${i}_name`, first ? 'unbekannt' : 'leer', null, first ? 'Name des mitaufzunehmenden Kindes eintragen (nicht in diesem Fenster).' : 'Nur bei weiteren Kindern.', null, 'm64.kinder'),
      prop(form, `kind${i}_geb`, first ? 'unbekannt' : 'leer', null, first ? 'Geburtsdatum des Kindes (TTMMJJ).' : 'Nur bei weiteren Kindern.', null, 'm64.kinder'),
      first && krank ? prop(form, `kind${i}_attest`, 'vorgeschlagen', true, 'Behandlungsbedürftigkeit des Kindes – dann Ärztliches Attest Kind (Muster 65).', krank, 'm64.kinder')
        : prop(form, `kind${i}_attest`, first ? 'unbekannt' : 'leer', first ? null : false, first ? 'Grund der Aufnahme ankreuzen.' : 'Nur bei weiteren Kindern.', null, 'm64.kinder'),
      prop(form, `kind${i}_beziehung`, first && !krank ? 'unbekannt' : 'leer', first && !krank ? null : false, 'Belastete Mutter-/Vater-Kind-Beziehung – ggf. ankreuzen.', null, 'm64.kinder'),
      prop(form, `kind${i}_psychosozial`, first && !krank ? 'unbekannt' : 'leer', first && !krank ? null : false, 'Psychosoziale Gründe/Betreuung notwendig – ggf. ankreuzen.', null, 'm64.kinder'),
    ];
  });
}

const text_ = (id: string, value: string | null, why: string, ifEmpty: string, state: 'unbekannt' | 'leer' = 'unbekannt'): FieldProposal =>
  value ? prop(form, id, 'arzt', value, why, value) : prop(form, id, state, null, ifEmpty);

export function proposeMuster64(text: string, facts: PatientFacts, today: Date): FormProposal {
  const seg = labeledSegments(text);
  const codes = icdCodes(text).filter((c) => c.certainty);
  const phrase = cleanPhrase(segment(seg, 'diagnose') ?? reasonPhrase(text))?.replace(/\s*[A-TV-Z]\d{2}(?:\.\d{1,2})?\s*[GVAZ]?\b/gu, '').trim() || null;
  const form_ = leistungsform(text);
  const mitKind = form_.some((p) => (p.fieldId === 'mutter_kind' || p.fieldId === 'vater_kind') && p.value === true);
  const heilmittel = cue(/\b(heilmittel\w* (?:nicht ausreichend|reich\w* nicht|nicht zielführend|ohne (?:ausreichenden )?erfolg)|physiotherapie (?:ohne erfolg|erfolglos))\b/iu, text);
  const einrichtung = segment(seg, 'anforderungen', 'einrichtung');
  const wartefrist = cue(/\b(wartefrist|vor ablauf (?:von|der) 4 jahre\w*|letzte (?:kur|vorsorge\w*) vor (?:weniger als )?[1-3] jahren)\b/iu, text);
  const sonstiges = segment(seg, 'sonstiges', 'hinweise', 'hinweis') ?? (facts.ssw ? `Schwangerschaft (${facts.ssw.evidence})` : null);
  const fields: FieldProposal[] = [
    personalien(form),
    text_('risiko', segment(seg, 'risikofaktoren', 'risikofaktor', 'gesundheitsstörungen', 'gesundheitsstörung'), 'Gesundheitsstörungen und Risikofaktoren aus der Beschreibung.', 'Vorsorgerelevante Gesundheitsstörungen einschließlich Risikofaktoren (empfohlen).', 'leer'),
    ...ROWS.flatMap((i) => [
      i === 1 && phrase ? prop(form, 'dx1', 'arzt', phrase, 'Vorsorgerelevante Erkrankung – der Arzt bestätigt.', phrase, 'm64.diagnosen')
        : prop(form, `dx${i}`, i === 1 ? 'unbekannt' : 'leer', null, i === 1 ? 'Vorsorgerelevante Erkrankung in der Reihenfolge ihrer Bedeutung.' : 'Weitere Erkrankung nur bei Bedarf.', null, 'm64.diagnosen'),
      codes[i - 1] ? prop(form, `icd${i}`, 'arzt', `${codes[i - 1]!.icd} ${codes[i - 1]!.certainty}`, 'ICD-10-GM mit Sicherheit – der Arzt bestätigt.', codes[i - 1]!.evidence, 'm64.diagnosen')
        : prop(form, `icd${i}`, i === 1 ? 'unbekannt' : 'leer', null, i === 1 ? 'Diagnoseschlüssel ICD-10-GM (vom Arzt, mit Sicherheit).' : 'Nur bei weiterer Erkrankung.', null, 'm64.diagnosen'),
    ]),
    text_('anamnese', segment(seg, 'anamnese'), 'Anamnese aus der Beschreibung.', 'Kurze Angaben zur Anamnese und zum bisherigen Verlauf einschließlich Beschwerden.'),
    text_('beeintraechtigungen', segment(seg, 'beeinträchtigungen', 'beeinträchtigung', 'einschränkungen', 'einschränkung'), 'Vorübergehende Beeinträchtigungen aus der Beschreibung.', 'Vorübergehende Beeinträchtigungen der Aktivitäten/Teilhabe (z. B. Stress, Haushalt, Familienleben).'),
    ...KONTEXT.map(([id, re]) => checkbox(form, id, cue(re, text), 'Kontextfaktor aus der Beschreibung.')),
    text_('kontext_text', segment(seg, 'kontextfaktoren', 'kontextfaktor', 'kontext', 'lebensumstände'), 'Weitere Kontextfaktoren aus der Beschreibung.', 'Andere Kontextfaktoren nur bei Bedarf.', 'leer'),
    prop(form, 'personalien_b', 'duria', 'aus DURIA', 'Name, Kostenträgerkennung und Versicherten-Nr. auf Teil B – aus DURIA.'),
    text_('interventionen', segment(seg, 'bisherige therapie', 'bisherige behandlung', 'krankenbehandlung', 'therapie', 'medikation'), 'Bisherige Interventionen aus der Beschreibung.', 'Bisherige ärztliche/psychotherapeutische Interventionen einschließlich Arznei- und Heilmitteltherapie.'),
    heilmittel ? prop(form, 'heilmittel_nicht_ausreichend', 'vorgeschlagen', true, 'Heilmittel reichen zur Erreichung des Behandlungsziels nicht aus.', heilmittel)
      : prop(form, 'heilmittel_nicht_ausreichend', 'unbekannt', null, 'Bestätigen, dass das Ziel mit weiteren Heilmitteln nicht erreichbar ist – entscheidet der Arzt.'),
    text_('andere_massnahmen', segment(seg, 'bisherige maßnahmen', 'maßnahmen'), 'Bisherige andere Maßnahmen aus der Beschreibung.', 'Bisherige andere Maßnahmen (z. B. Schulungen, Beratung, Selbsthilfe) – bei Bedarf.', 'leer'),
    text_('ziele', segment(seg, 'vorsorgeziele', 'vorsorgeziel', 'ziele', 'ziel', 'therapieziele', 'therapieziel'), 'Vorsorgeziele aus der Beschreibung.', 'Vorsorgeziele angeben (z. B. Bewältigungsstrategien erlernen, Chronifizierung vermeiden).'),
    ...form_,
    ...kinder(text, mitKind),
    einrichtung ? checkbox(form, 'einrichtung_ja', einrichtung, 'Anforderungen an die Einrichtung.') : prop(form, 'einrichtung_ja', 'leer', false, 'Nur bei besonderen Anforderungen (z. B. Klima, Barrierefreiheit, Kostform).'),
    einrichtung ? prop(form, 'einrichtung', 'arzt', einrichtung, 'Anforderungen an die Einrichtung aus der Beschreibung.', einrichtung) : prop(form, 'einrichtung', 'leer', null, 'Nur bei „ja, folgende“.'),
    wartefrist ? prop(form, 'wartefrist_ja', 'vorgeschlagen', true, 'Vor Ablauf der Wartefrist von 4 Jahren – Dringlichkeit erläutern.', wartefrist) : prop(form, 'wartefrist_ja', 'leer', false, 'Nur wenn die Leistung vor Ablauf der 4-Jahres-Frist dringend notwendig ist.'),
    wartefrist ? prop(form, 'wartefrist', 'unbekannt', null, 'Medizinische Dringlichkeit vor Ablauf der Wartefrist gesondert erläutern.', wartefrist) : prop(form, 'wartefrist', 'leer', null, 'Nur bei „ja, Erläuterung“.'),
    text_('sonstiges', sonstiges, 'Besondere Hinweise (z. B. Reisefähigkeit, Schwangerschaft).', 'Besondere Hinweise nur bei Bedarf.', 'leer'),
    prop(form, 'rueckruf', 'leer', null, 'Nur wenn die Kasse vor der Entscheidung zurückrufen soll (Telefonnummer der Praxis).'),
    prop(form, 'datum', 'vorgeschlagen', ttmmjj(today), 'Ausstellungsdatum (heute).'),
    stempel(form),
  ];
  return { formId: 'muster-64', fields, generator: 'regelbasiert' };
}

export function checkMuster64(values: FormValues, facts: PatientFacts): FormIssue[] {
  const out: FormIssue[] = [];
  const add = (i: FormIssue | null) => { if (i) out.push(i); };
  if (facts.reha && /reha|ahb|anschluss/iu.test(facts.reha.evidence)) add(issue(form, 'hinweis', `„${facts.reha.evidence}“: Rehabilitation für Mütter/Väter wird auf Muster 61 verordnet; Vorsorge nur ohne längerfristige (über 6 Monate) Aktivitätsbeeinträchtigungen.`, [], 'm64.abgrenzung'));
  if (!textOf(values, 'dx1') && !textOf(values, 'icd1')) add(issue(form, 'fehlt', 'Vorsorgerelevante Erkrankung(en) mit ICD-10-GM angeben.', ['dx1', 'icd1'], 'm64.diagnosen'));
  out.push(...icdIssues(form, values, ['icd1', 'icd2', 'icd3']));
  if (!textOf(values, 'anamnese')) add(issue(form, 'fehlt', 'Kurze Angaben zur Anamnese.', ['anamnese'], 'm64.anamnese'));
  if (!textOf(values, 'beeintraechtigungen')) add(issue(form, 'fehlt', 'Vorübergehende Beeinträchtigungen der Aktivitäten/Teilhabe angeben.', ['beeintraechtigungen'], 'm64.beeintraechtigungen'));
  const kontext = form.fields.filter((f) => f.group === 'kontext').map((f) => f.id);
  if (!kontext.some((id) => isChecked(values, id)) && !textOf(values, 'kontext_text')) add(issue(form, 'fehlt', 'Mindestens einen Kontextfaktor ankreuzen oder erläutern.', kontext, 'm64.kontextfaktoren'));
  if (!textOf(values, 'interventionen')) add(issue(form, 'fehlt', 'Bisherige Krankenbehandlung angeben.', ['interventionen'], 'm64.krankenbehandlung'));
  if (!isChecked(values, 'heilmittel_nicht_ausreichend')) add(issue(form, 'fehlt', 'Bestätigen, dass das Behandlungsziel mit weiteren Heilmitteln nicht erreichbar ist.', ['heilmittel_nicht_ausreichend'], 'm64.krankenbehandlung'));
  if (!textOf(values, 'ziele')) add(issue(form, 'fehlt', 'Vorsorgeziele angeben.', ['ziele'], 'm64.vorsorgeziele'));
  add(exactlyOne(form, values, 'leistungsform', 'm64.leistungsform'));
  const mitKind = isChecked(values, 'mutter_kind') || isChecked(values, 'vater_kind');
  for (const i of ROWS) {
    const named = textOf(values, `kind${i}_name`) || textOf(values, `kind${i}_geb`);
    const gruende = KIND_GRUND.filter((g) => isChecked(values, `kind${i}_${g}`));
    if (i === 1 && mitKind && !named) add(issue(form, 'fehlt', 'Mutter-/Vater-Kind-Leistung: Name und Geburtsdatum des Kindes angeben.', ['kind1_name', 'kind1_geb'], 'm64.kinder'));
    if ((named || gruende.length) && !mitKind) add(issue(form, 'hinweis', `Kind ${i} angegeben, aber keine Mutter-/Vater-Kind-Leistung angekreuzt.`, ['mutter_kind', 'vater_kind'], 'm64.leistungsform'));
    if (named && !gruende.length) add(issue(form, 'fehlt', `Kind ${i}: Grund der Aufnahme ankreuzen.`, KIND_GRUND.map((g) => `kind${i}_${g}`), 'm64.kinder'));
    if (isChecked(values, `kind${i}_attest`)) add(issue(form, 'hinweis', `Kind ${i}: Behandlungsbedürftigkeit – Ärztliches Attest Kind (Muster 65) beifügen.`, [`kind${i}_attest`], 'm64.kinder'));
  }
  if (isChecked(values, 'einrichtung_ja') && !textOf(values, 'einrichtung')) add(issue(form, 'fehlt', 'Anforderungen an die Einrichtung benennen.', ['einrichtung'], 'm64.einrichtung'));
  if (isChecked(values, 'wartefrist_ja') && !textOf(values, 'wartefrist')) add(issue(form, 'fehlt', 'Dringlichkeit vor Ablauf der 4-Jahres-Wartefrist erläutern.', ['wartefrist'], 'm64.wartefrist'));
  add(issue(form, 'hinweis', 'Die Kasse erbringt Vorsorge nur bei ausreichender physischer und psychischer Belastbarkeit (Aufdruck Teil A).', [], 'm64.belastbarkeit'));
  out.push(...formatIssues(form, values));
  return out;
}
