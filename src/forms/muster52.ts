import { exactlyOne, formatIssues, isChecked, issue, pickOne, prop, textOf } from './build.js';
import { getForm } from './catalog.js';
import { icdIssues, personalien, stempel } from './common.js';
import { letzteTaetigkeit } from './muster20.js';
import { specialtyIn } from './specialties.js';
import { cue, icdCodes, labeledSegments, segment, ttmmjj, uni } from './text.js';
import type { FieldProposal, FormIssue, FormProposal, FormValues, PatientFacts } from './types.js';

/**
 * Muster 52 – Bericht für die Krankenkasse bei Fortbestehen der Arbeitsunfähigkeit (Stand 4.2025).
 * Erläuterungen 01/2026, S. 88–91. Nur auf Anfrage der Krankenkasse.
 */
const form = getForm('muster-52');
const ICD_FIELDS = ['icd1', 'icd2', 'icd3', 'icd4', 'icd5', 'icd6'] as const;
const MASSNAHMEN = ['konservativ', 'operativ', 'heilmittel', 'sonstige'] as const;
const CHECKS = ['stw_geplant', 'stw_eingeleitet', 'reha_geplant', 'reha_beantragt', 'schulung_geplant', 'schulung_eingeleitet'] as const;

const text_ = (id: string, value: string | null, evidence: string | null, why: string, ifEmpty: string): FieldProposal =>
  value ? prop(form, id, 'vorgeschlagen', value, why, evidence) : prop(form, id, 'leer', null, ifEmpty);

/** geplant / eingeleitet (bzw. beantragt) aus der Beschreibung. */
function stand(text: string, re: RegExp, groupId: string, geplant: string, weiter: string, label: string): FieldProposal[] {
  const ev = cue(re, text);
  if (!ev) return pickOne(form, groupId, null, `${label}: nur wenn vorgesehen.`, null).map((p) => ({ ...p, state: 'leer' as const, value: false }));
  const tail = new RegExp(`${re.source}[^.;]{0,40}?\\b(eingeleitet|beantragt|läuft|laufend|begonnen|bewilligt)\\b`, 'iu');
  const done = uni(tail).exec(text);
  return pickOne(form, groupId, done ? weiter : geplant, `${label} ${done ? 'bereits eingeleitet bzw. beantragt' : 'geplant'}.`, done?.[0] ?? ev);
}

function sonstige(text: string): { value: string | null; evidence: string | null } {
  const seg = segment(labeledSegments(text), 'sonstige', 'sonstiges');
  if (seg) return { value: seg, evidence: seg };
  const found = [...text.matchAll(uni(/\b(rückenschule|ernährungsberatung|suchttherapie|psychotherapie\w*|reha-?sport|rehabilitationssport|funktionstraining|betriebliche\w* eingliederungsmanagement|bem)\b/giu))].map((m) => m[0]);
  return found.length ? { value: [...new Set(found)].join(', '), evidence: found.join(', ') } : { value: null, evidence: null };
}

function erwerbsminderung(text: string): FieldProposal[] {
  const nein = uni(/\b(?:kein\w*|nicht)\s+(?:hinweis\w*\s+auf\s+(?:eine\s+)?)?(?:bestehende\w*\s+oder\s+)?(?:drohende\w*\s+)?erwerbsminderung\b/iu).exec(text);
  if (nein) return pickOne(form, 'erwerbsminderung', 'em_nein', 'Kein Hinweis auf bestehende oder drohende Erwerbsminderung.', nein[0]);
  const ja = cue(/\b(erwerbsminderung\w*|em-?rente|erwerbsminderungsrente|rentenantrag|erwerbsunfähig\w*)\b/iu, text);
  if (ja) return pickOne(form, 'erwerbsminderung', 'em_ja', 'Hinweis auf bestehende oder drohende Erwerbsminderung.', ja);
  return pickOne(form, 'erwerbsminderung', null, 'Besteht oder droht eine Erwerbsminderung? Das beurteilt der Arzt.', null);
}

export function proposeMuster52(text: string, _facts: PatientFacts, today: Date): FormProposal {
  const seg = labeledSegments(text);
  const codes = icdCodes(text).filter((c) => c.certainty);
  const alg = cue(/\b(arbeitslos\w*|arbeitslosengeld\w*|alg\s*(?:i|1)|bezieht alg)\b/iu, text);
  const lt = letzteTaetigkeit(text);
  const woche = uni(/\b(\d{1,2})\s*(?:h|std\.?|stunden)\s*(?:\/|pro|je|in der|die)\s*woche\b|\bwochenarbeitszeit\s*(?:von\s*)?(\d{1,2})\b/iu).exec(text);
  const funktion = segment(seg, 'funktionseinschränkungen', 'funktionseinschränkung', 'einschränkungen', 'einschränkung');
  const heilmittel = segment(seg, 'heilmittel') ?? uni(/\b(physiotherapie|krankengymnastik|manuelle therapie|ergotherapie|logopädie|lymphdrainage)\b[^.;]*/iu).exec(text)?.[0]?.trim() ?? null;
  const operativ = segment(seg, 'operativ', 'op') ?? uni(/\b(?:op|operation)\s+(?:geplant|am|vorgesehen)\b[^.;]*/iu).exec(text)?.[0]?.trim() ?? null;
  const so = sonstige(text);
  const spec = specialtyIn(text);
  const keineUeberweisung = cue(/\b(keine überweisung|nicht überwiesen|ohne überweisung)\b/iu, text);
  const fields: FieldProposal[] = [
    personalien(form),
    ...ICD_FIELDS.map((id, i) => (codes[i]
      ? prop(form, id, 'arzt', `${codes[i]!.icd} ${codes[i]!.certainty}`, 'Die AU begründende Diagnose – der Arzt bestätigt.', codes[i]!.evidence, 'm52.diagnosen')
      : prop(form, id, i === 0 ? 'unbekannt' : 'leer', null, i === 0 ? 'Alle die AU begründenden Diagnosen als ICD-10-Code (vom Arzt, mit Sicherheit).' : 'Weitere Diagnose nur bei Bedarf.', null, 'm52.diagnosen'))),
    funktion ? prop(form, 'funktion', 'arzt', funktion, 'Funktionseinschränkungen aus der Beschreibung – bitte prüfen.', funktion) : prop(form, 'funktion', 'leer', null, 'Funktionseinschränkungen (empfohlen) – im Freitext.'),
    alg ? prop(form, 'taetigkeit', 'leer', null, 'Bei Arbeitslosengeld-Bezug wird 2.2 beantwortet.')
      : lt.taetigkeit ? prop(form, 'taetigkeit', 'vorgeschlagen', lt.taetigkeit, 'Zuletzt ausgeübte Beschäftigung.', lt.evidence)
        : prop(form, 'taetigkeit', 'unbekannt', null, 'Zuletzt ausgeübte Beschäftigung nicht in der Beschreibung (z. B. „Tätigkeit: Lagerist“).'),
    alg ? prop(form, 'stunden_woche', 'leer', null, 'Bei Arbeitslosengeld-Bezug wird 2.2 beantwortet.')
      : woche ? prop(form, 'stunden_woche', 'vorgeschlagen', woche[1] ?? woche[2]!, 'Regelmäßige Arbeitszeit vor der AU.', woche[0])
        : prop(form, 'stunden_woche', 'unbekannt', null, 'Regelmäßige Arbeitszeit (Stunden pro Woche) nicht genannt.'),
    alg ? prop(form, 'alg', 'vorgeschlagen', true, 'Empfänger von Arbeitslosengeld – 2.2 beantworten.', alg) : prop(form, 'alg', 'leer', false, 'Nur bei Arbeitslosengeld-Bezug.'),
  ];
  const algStd = alg ? uni(/\b(\d{1,2})\s*(?:h|std\.?|stunden)\b[^.;]{0,30}?(?:verfügung|vermittlung|arbeitsagentur|agentur)|\b(?:verfügung|vermittlung)[^.;]{0,30}?\b(\d{1,2})\s*(?:h|std\.?|stunden)/iu).exec(text) : null;
  fields.push(
    alg ? (algStd ? prop(form, 'alg_stunden', 'vorgeschlagen', algStd[1] ?? algStd[2]!, 'Stunden pro Woche, für die sie/er der Arbeitsvermittlung zur Verfügung steht.', algStd[0])
      : prop(form, 'alg_stunden', 'unbekannt', null, 'Für wie viele Stunden pro Woche steht sie/er der Arbeitsvermittlung zur Verfügung?'))
      : prop(form, 'alg_stunden', 'leer', null, 'Nur bei Arbeitslosengeld-Bezug.'),
    ...(alg ? pickOne(form, 'alg_leicht', null, 'Leichte Tätigkeiten in diesem Umfang möglich? Das beurteilt der Arzt.', null)
      : pickOne(form, 'alg_leicht', null, 'Nur bei Arbeitslosengeld-Bezug.', null).map((p) => ({ ...p, state: 'leer' as const, value: false }))),
    text_('konservativ', segment(seg, 'konservativ', 'therapie'), segment(seg, 'konservativ', 'therapie'), 'Konservative Maßnahmen aus der Beschreibung.', 'Konservative Maßnahmen (ggf. wann und welche).'),
    text_('operativ', operativ, operativ, 'Operative Maßnahme aus der Beschreibung.', 'Nur wenn eine Operation vorgesehen ist.'),
    text_('heilmittel', heilmittel, heilmittel, 'Heilmittel aus der Beschreibung.', 'Nur wenn Heilmittel verordnet sind (ggf. seit wann und welche).'),
    ...stand(text, /\b(wiedereingliederung\w*|hamburger modell)\b/iu, 'stw', 'stw_geplant', 'stw_eingeleitet', 'Stufenweise Wiedereingliederung'),
    ...stand(text, /\b(reha\w*|rehabilitation\w*|ahb|anschlussheilbehandlung)\b/iu, 'reha', 'reha_geplant', 'reha_beantragt', 'Medizinische Rehabilitation'),
    ...stand(text, /\b(patientenschulung\w*|schulung\w*|dmp-?schulung)\b/iu, 'schulung', 'schulung_geplant', 'schulung_eingeleitet', 'Patientenschulung'),
    text_('sonstige', so.value, so.evidence, 'Sonstige Maßnahmen aus der Beschreibung.', 'Sonstige Maßnahmen (z. B. Rückenschule, Psychotherapie, BEM) – nur bei Bedarf.'),
  );
  const anyMeasure = fields.some((f) => (MASSNAHMEN as readonly string[]).includes(f.fieldId) ? Boolean(f.value) : (CHECKS as readonly string[]).includes(f.fieldId) && f.value === true);
  fields.push(
    anyMeasure ? prop(form, 'keine', 'leer', false, 'Es sind Maßnahmen vorgesehen.') : prop(form, 'keine', 'unbekannt', null, 'Keine Maßnahmen genannt: Maßnahmen angeben oder „keine“ ankreuzen und begründen.'),
    prop(form, 'keine_begruendung', 'leer', null, 'Nur bei „keine“ – dann Begründung erforderlich.'),
    ...(spec ? pickOne(form, 'ueberweisung', 'ueberw_ja', `Überweisung zur fachärztlichen Mitbehandlung (${spec.name}).`, spec.evidence)
      : keineUeberweisung ? pickOne(form, 'ueberweisung', 'ueberw_nein', 'Keine fachärztliche Mitbehandlung.', keineUeberweisung)
        : pickOne(form, 'ueberweisung', null, 'Erfolgte eine Überweisung zur fachärztlichen Mitbehandlung? Nicht in der Beschreibung.', null)),
    spec ? prop(form, 'fachrichtung', 'vorgeschlagen', spec.name, 'Fachrichtung der Mitbehandlung.', spec.evidence) : prop(form, 'fachrichtung', 'leer', null, 'Nur bei „ja“.'),
    ...erwerbsminderung(text),
    prop(form, 'datum', 'vorgeschlagen', ttmmjj(today), 'Ausstellungsdatum (heute) – Antwort möglichst innerhalb von drei Werktagen.'),
    stempel(form),
  );
  return { formId: 'muster-52', fields, generator: 'regelbasiert' };
}

export function checkMuster52(values: FormValues, _facts: PatientFacts): FormIssue[] {
  const out: FormIssue[] = [];
  const add = (i: FormIssue | null) => { if (i) out.push(i); };
  if (!ICD_FIELDS.some((id) => textOf(values, id))) add(issue(form, 'fehlt', '1. Die AU begründende Diagnose(n) als ICD-10-Code angeben.', ['icd1'], 'm52.diagnosen'));
  out.push(...icdIssues(form, values, [...ICD_FIELDS]));
  const alg = isChecked(values, 'alg');
  if (!alg && !textOf(values, 'taetigkeit')) add(issue(form, 'fehlt', '2.1 Zuletzt ausgeübte Beschäftigung angeben (bei Arbeitslosengeld 2.2).', ['taetigkeit', 'alg'], 'm52.taetigkeit'));
  if (!alg && textOf(values, 'taetigkeit') && !textOf(values, 'stunden_woche')) add(issue(form, 'fehlt', '2.1 Regelmäßige Arbeitszeit (Stunden pro Woche) angeben.', ['stunden_woche'], 'm52.taetigkeit'));
  if (alg) {
    if (!textOf(values, 'alg_stunden')) add(issue(form, 'fehlt', '2.2 Stunden pro Woche angeben, für die sie/er der Arbeitsvermittlung zur Verfügung steht.', ['alg_stunden'], 'm52.taetigkeit'));
    add(exactlyOne(form, values, 'alg_leicht', 'm52.taetigkeit'));
    if (isChecked(values, 'stw_geplant') || isChecked(values, 'stw_eingeleitet')) add(issue(form, 'unzulaessig', 'Stufenweise Wiedereingliederung gilt nicht für Arbeitslose.', ['stw_geplant', 'stw_eingeleitet'], 'm52.wiedereingliederung'));
  }
  for (const [a, b] of [['stw_geplant', 'stw_eingeleitet'], ['reha_geplant', 'reha_beantragt'], ['schulung_geplant', 'schulung_eingeleitet']] as const) {
    if (isChecked(values, a) && isChecked(values, b)) add(issue(form, 'hinweis', 'Je Maßnahme entweder „geplant“ oder „eingeleitet/beantragt“ ankreuzen.', [a, b], 'm52.einleitung'));
  }
  const any = MASSNAHMEN.some((id) => textOf(values, id)) || CHECKS.some((id) => isChecked(values, id));
  if (isChecked(values, 'keine') && any) add(issue(form, 'unzulaessig', '„keine“ Maßnahmen angekreuzt, aber Maßnahmen eingetragen.', ['keine'], 'm52.massnahmen'));
  if (!any && !isChecked(values, 'keine')) add(issue(form, 'fehlt', '3. Vorgesehene Maßnahmen angeben – oder „keine“ ankreuzen und begründen.', ['konservativ', 'keine'], 'm52.massnahmen'));
  if (isChecked(values, 'keine') && !textOf(values, 'keine_begruendung')) add(issue(form, 'fehlt', '„keine“ Maßnahmen: Begründung erforderlich.', ['keine_begruendung'], 'm52.massnahmen'));
  add(exactlyOne(form, values, 'ueberweisung', 'm52.ueberweisung'));
  if (isChecked(values, 'ueberw_ja') && !textOf(values, 'fachrichtung')) add(issue(form, 'fehlt', '4. Fachrichtung der Mitbehandlung angeben.', ['fachrichtung'], 'm52.ueberweisung'));
  add(exactlyOne(form, values, 'erwerbsminderung', 'm52.erwerbsminderung'));
  if (!textOf(values, 'datum')) add(issue(form, 'fehlt', 'Ausstellungsdatum eintragen.', ['datum'], 'm52.frist'));
  out.push(...formatIssues(form, values));
  return out;
}
