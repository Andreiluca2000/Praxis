import { checkbox, exactlyOne, formatIssues, isChecked, issue, pickOne, prop, textOf } from './build.js';
import { getForm } from './catalog.js';
import { cleanPhrase } from './common.js';
import { cue, icdCodes, labeledSegments, reasonPhrase, segment, uni } from './text.js';
import type { FieldProposal, FormField, FormIssue, FormProposal, FormValues, PatientFacts } from './types.js';

/**
 * Muster 61 – Teil A (Beratung/Prüfung des Reha-Trägers) oder Teil B–E (Verordnung medizinischer Rehabilitation), Stand 7.2022.
 * Erläuterungen 01/2026, S. 103–118. Teil A und Teil B–E schließen sich aus.
 */
const form = getForm('muster-61');

const ROWS = ['lernen', 'aufgaben', 'kommunikation', 'transfer', 'stehen', 'treppen', 'mob_sonst', 'essen', 'kleiden', 'waschen', 'baden', 'toilette', 'sv_sonst', 'haeuslich', 'interpersonell', 'lebensbereiche', 'gemeinschaft'];
const MOB = ['transfer', 'stehen', 'treppen', 'mob_sonst'];
const SV = ['essen', 'kleiden', 'waschen', 'baden', 'toilette', 'sv_sonst'];
const COLS = ['k', 'e', 'h', 'n'];
const TESTS: Record<string, string[]> = {
  mobilitaet: ['t_tug', 't_chair', 't_hand_kg', 't_hand_kpa', 't_demmi', 't_tinetti'],
  kognition: ['t_mmst', 't_gds', 't_uhr'],
  schmerz: ['t_schmerz'],
  herz_lunge: ['t_ergo', 't_fev1', 't_vk', 't_nyha'],
};
const TEST_RE: [string, RegExp][] = [
  ['t_tug', /\btug\s*:?\s*(\d{1,3})/iu], ['t_chair', /\bchair[- ]?rise\s*:?\s*(\d{1,3})/iu], ['t_hand_kg', /\bhandkraft\s*:?\s*(\d{1,3})\s*kg/iu],
  ['t_demmi', /\bdemmi\s*:?\s*(\d{1,3})/iu], ['t_tinetti', /\btinetti\s*:?\s*(\d{1,2})/iu], ['t_mmst', /\b(?:mmst|mmse)\s*:?\s*(\d{1,2})/iu],
  ['t_gds', /\bgds\s*(?:15)?\s*:?\s*(\d{1,2})/iu], ['t_uhr', /\buhrentest\s*:?\s*(\d)/iu], ['t_schmerz', /\b(?:schmerz(?:skala)?|nrs|vas)\s*:?\s*(\d{1,2})\s*\/\s*10/iu],
  ['t_ergo', /\bergometrie\s*:?\s*(\d{2,3})\s*w/iu], ['t_fev1', /\bfev1\s*:?\s*(\d{1,3})\s*%/iu], ['t_vk', /\bvk\s*:?\s*(\d{1,3})\s*%/iu], ['t_nyha', /\bnyha\s*:?\s*(i{1,3}v?|[1-4])\b/iu],
];

const pageOf = (f: FormField) => f.page ?? 0;
const onPage = (p: number[]) => form.fields.filter((f) => p.includes(pageOf(f)));

function alter(text: string): number | null {
  const m = uni(/\b(\d{2,3})\s*(?:jahre|j\.|-?jährig\w*)\b/iu).exec(text);
  return m ? Number(m[1]) : null;
}

/** Teil A: Beratung oder Prüfung des Trägers. Sonst Teil B–E (Zuständigkeit der Kasse klar). */
function teilA(text: string): { modus: 'a_beratung' | 'a_pruefung' | null; evidence: string | null } {
  const pruef = cue(/\b(prüfung des (?:zuständigen )?(?:reha-?)?trägers|rentenversicherung\w*|drv|erwerbsfähig\w*|erwerbsminderung|berufstätig\w*|arbeitsfähig\w* gefährdet)\b/iu, text);
  if (pruef) return { modus: 'a_pruefung', evidence: pruef };
  const ber = cue(/\b(beratung\w*|kinder-?reha\w*|onkologische reha\w*)\b/iu, text);
  return ber ? { modus: 'a_beratung', evidence: ber } : { modus: null, evidence: null };
}

function diagnosen(prefix: string, text: string, facts: PatientFacts): FieldProposal[] {
  const phrase = cleanPhrase(segment(labeledSegments(text), 'diagnose') ?? reasonPhrase(text));
  const codes = icdCodes(text).filter((c) => c.certainty);
  const urs = facts.arbeitsunfall ? '1' : facts.unfall ? '3' : facts.versorgungsleiden ? '4' : null;
  const out: FieldProposal[] = [];
  for (let i = 1; i <= 6; i += 1) {
    const c = codes[i - 1];
    out.push(i === 1 && phrase ? prop(form, `${prefix}dx${i}`, 'arzt', phrase, 'Als Funktionsdiagnose formulieren (z. B. „Coxarthrose re. mit eingeschränkter Gehfähigkeit“) – der Arzt bestätigt.', phrase)
      : prop(form, `${prefix}dx${i}`, i === 1 ? 'unbekannt' : 'leer', null, i === 1 ? 'Rehabilitationsbegründende Funktionsdiagnose angeben.' : i <= 3 ? 'Weitere begründende Funktionsdiagnose nur bei Bedarf.' : 'Weitere rehabilitationsrelevante (bei Geriatrie: geriatrietypische) Diagnose.'));
    out.push(c ? prop(form, `${prefix}icd${i}`, 'arzt', `${c.icd} ${c.certainty}`, 'ICD-10-GM aus der Beschreibung – der Arzt bestätigt.', c.evidence)
      : prop(form, `${prefix}icd${i}`, i === 1 ? 'unbekannt' : 'leer', null, i === 1 ? 'ICD-10-GM-Kode der Diagnose (vom Arzt, mit Sicherheit).' : 'Nur mit Diagnose.'));
    out.push(i === 1 && urs ? prop(form, `${prefix}urs${i}`, 'vorgeschlagen', urs, 'Mögliche Ursache laut Beschreibung (1 Arbeitsunfall, 3 Schädigung durch Dritte, 4 Kriegs-/Wehrdienstfolge).', facts.arbeitsunfall?.evidence ?? facts.unfall?.evidence ?? facts.versorgungsleiden?.evidence ?? null)
      : prop(form, `${prefix}urs${i}`, 'leer', null, 'Nur angeben, wenn eine der Ursachen 1–5 zutrifft.'));
  }
  return out;
}

function teilB(text: string, facts: PatientFacts, alt: number | null): FieldProposal[] {
  const seg = labeledSegments(text);
  const rentner = cue(/\b(rentner\w*|altersrent\w*|im ruhestand|berentet)\b/iu, text) ?? (alt && alt >= 67 ? `${alt} Jahre` : null);
  const hm = cue(/\b(rollator|rollstuhl|gehstock|unterarmgehstütze\w*|hörgerät\w*|prothese\w*|orthese\w*)\b/iu, text);
  const keineHm = cue(/\bkeine hilfsmittel\b/iu, text);
  const hmNicht = cue(/\b(heilmittel (?:nicht ausreichend|ausgeschöpft)|physiotherapie (?:ohne erfolg|nicht ausreichend)|ambulante therapie (?:nicht ausreichend|ausgeschöpft))\b/iu, text);
  const tests = TEST_RE.map(([id, re]) => [id, uni(re).exec(text)] as const);
  return [
    rentner && !facts.arbeitsunfall ? prop(form, 'b_erwerb', 'vorgeschlagen', true, `Kein Hinweis auf Erwerbsfähigkeit oder Arbeitsunfall (${rentner}) – bitte bestätigen.`, rentner)
      : prop(form, 'b_erwerb', 'unbekannt', null, 'Ankreuzen, wenn es weder um die Erwerbsfähigkeit noch um Arbeitsunfall/Berufskrankheit geht – sonst ist meist ein anderer Träger zuständig (Teil A).'),
    prop(form, 'b_gleichrangig', 'leer', false, 'Nur bei gleichrangiger Zuständigkeit (z. B. Kinder- oder onkologische Reha für Altersrentner) nach Beratung.'),
    ...diagnosen('', text, facts),
    segment(seg, 'anamnese') ? prop(form, 'anamnese', 'arzt', segment(seg, 'anamnese')!, 'Aus der Beschreibung.', null) : prop(form, 'anamnese', 'unbekannt', null, 'Anamnese mit Beginn, Verlauf, Krankenhaus- und Facharztbehandlung.'),
    segment(seg, 'befund', 'befunde') ? prop(form, 'befunde', 'arzt', segment(seg, 'befund', 'befunde')!, 'Aus der Beschreibung.', null) : prop(form, 'befunde', 'unbekannt', null, 'Rehabilitationsrelevante Schädigungen und Befunde (Untersuchungs-/Assessmentergebnisse).'),
    ...tests.map(([id, m]) => (m ? prop(form, id, 'arzt', m[1]!.toUpperCase(), 'Testergebnis aus der Beschreibung.', m[0], 'm61.be_funktionstests') : prop(form, id, 'leer', null, 'Bei geriatrischer Reha mindestens zwei Tests aus verschiedenen Bereichen.', null, 'm61.be_funktionstests'))),
    segment(seg, 'therapie', 'bisherige therapie', 'maßnahmen', 'bisherige maßnahmen') ? prop(form, 'interventionen', 'arzt', segment(seg, 'therapie', 'bisherige therapie', 'maßnahmen', 'bisherige maßnahmen')!, 'Aus der Beschreibung.', null)
      : prop(form, 'interventionen', 'unbekannt', null, 'Bisherige Interventionen, Schulungen, Heilmittel der letzten 6 Monate.'),
    checkbox(form, 'hm_nicht_ausreichend', hmNicht, 'Heilmittel reichen zur Erreichung des Behandlungsziels nicht aus.', 'm61.be_interventionen'),
    ...(hm ? pickOne(form, 'hilfsmittel', 'hilfsmittel_ja', 'Rehabilitationsrelevantes Hilfsmittel genannt.', hm) : keineHm ? pickOne(form, 'hilfsmittel', 'hilfsmittel_nein', 'Keine Hilfsmittel.', keineHm) : pickOne(form, 'hilfsmittel', null, 'Hilfsmittel ja oder nein ankreuzen.', null)),
    hm ? prop(form, 'hilfsmittel_text', 'vorgeschlagen', hm, 'Welches Hilfsmittel.', hm, 'm61.be_interventionen') : prop(form, 'hilfsmittel_text', 'leer', null, 'Nur bei „ja“.', null, 'm61.be_interventionen'),
  ];
}

function teilC(text: string): FieldProposal[] {
  const kontext = segment(labeledSegments(text), 'kontext', 'lebensumstände') ?? uni(/[^.;]*\b(lebt allein|alleinlebend|lebt mit\b|pflegeheim|seniorenheim|pflegt (?:den|die|seinen|ihre)\w*)[^.;]*/iu).exec(text)?.[0]?.trim() ?? null;
  const bmi = uni(/\bbmi\s*:?\s*(\d{2}(?:[.,]\d)?)/iu).exec(text);
  const belastbar = cue(/\b(belastbar|rehafähig\w*|rehabilitationsfähig\w*)\b/iu, text);
  const fields: FieldProposal[] = [];
  for (const r of ROWS) for (const c of COLS) fields.push(prop(form, `f_${r}_${c}`, 'arzt', null, 'Je Lebensbereich ein Kreuz – Einschätzung des Arztes.', null, 'm61.be_beeintraechtigungen'));
  fields.push(prop(form, 'f_mobilitaet_keine', 'leer', false, 'Übergeordnet ankreuzen, wenn die Mobilität insgesamt nicht beeinträchtigt ist.', null, 'm61.be_beeintraechtigungen'));
  fields.push(prop(form, 'f_selbstversorgung_keine', 'leer', false, 'Übergeordnet ankreuzen, wenn die Selbstversorgung insgesamt nicht beeinträchtigt ist.', null, 'm61.be_beeintraechtigungen'));
  fields.push(prop(form, 'f_mob_sonst_text', 'leer', null, 'Nur bei „sonstige“.'), prop(form, 'f_sv_sonst_text', 'leer', null, 'Nur bei „sonstige“.'));
  fields.push(kontext ? prop(form, 'kontext', 'arzt', kontext, 'Lebensumstände aus der Beschreibung.', kontext) : prop(form, 'kontext', 'unbekannt', null, 'Lebensumstände, Förderfaktoren und Barrieren (z. B. allein lebend, pflegende Angehörige).'));
  fields.push(checkbox(form, 'r_bewegung', cue(/\b(bewegungsmangel|fehlhaltung)\b/iu, text), 'Risikofaktor Bewegungsmangel/Fehlhaltung.', 'm61.be_kontextfaktoren'));
  fields.push(bmi ? prop(form, 'r_bmi', 'vorgeschlagen', bmi[1]!.replace(',', '.').split('.')[0]!, 'BMI aus der Beschreibung.', bmi[0], 'm61.be_kontextfaktoren') : prop(form, 'r_bmi', 'leer', null, 'Optional.', null, 'm61.be_kontextfaktoren'));
  fields.push(checkbox(form, 'r_ernaehrung', cue(/\b(mangelernährung|fehlernährung|kachexie)\b/iu, text), 'Risikofaktor Fehl-/Mangelernährung.', 'm61.be_kontextfaktoren'));
  fields.push(checkbox(form, 'r_medikamente', cue(/\b(polypharmazie|medikamentenmissbrauch)\b/iu, text), 'Risikofaktor Medikamente.', 'm61.be_kontextfaktoren'));
  fields.push(checkbox(form, 'r_nikotin', cue(/\b(raucher\w*|nikotin\w*|rauchen)\b/iu, text), 'Risikofaktor Nikotin.', 'm61.be_kontextfaktoren'));
  fields.push(checkbox(form, 'r_sonst', cue(/\b(alkohol\w*|suchtmittel|sucht)\b/iu, text), 'Sonstiger Risikofaktor (z. B. Suchtmittel).', 'm61.be_kontextfaktoren'));
  fields.push(prop(form, 'r_sonst_text', cue(/\b(alkohol\w*|suchtmittel|sucht)\b/iu, text) ? 'unbekannt' : 'leer', null, 'Sonstigen Risikofaktor benennen.', null, 'm61.be_kontextfaktoren'));
  fields.push(...(belastbar ? pickOne(form, 'rehafaehig', 'rf_ja', 'Ausreichende Belastbarkeit genannt.', belastbar) : pickOne(form, 'rehafaehig', null, 'Rehabilitationsfähigkeit beurteilen (ja/nein).', null)));
  return fields;
}

function teilD(text: string, alt: number | null): FieldProposal[] {
  const ziele = segment(labeledSegments(text), 'ziel', 'ziele', 'rehaziel', 'rehaziele');
  const form_ = cue(/\b(ambulant-?mobil\w*|mobile reha\w*)\b/iu, text) ? ['rf_mobil', 'mobile Rehabilitation'] as const
    : cue(/\b(ambulant\w*)\b/iu, text) ? ['rf_ambulant', 'ambulant'] as const
      : cue(/\b(stationär\w*)\b/iu, text) ? ['rf_stationaer', 'stationär'] as const
        : cue(/\b(mutter-?kind)\b/iu, text) ? ['rf_mutter_kind', 'Mutter-Kind'] as const
          : cue(/\b(vater-?kind)\b/iu, text) ? ['rf_vater_kind', 'Vater-Kind'] as const : null;
  const schwer = cue(/\b(orthopädisch\w*|kardiolog\w*|neurolog\w*|onkolog\w*|psychosomatisch\w*|pneumolog\w*|geriatrisch\w*|gastroenterolog\w*)\b/iu, text);
  const geriatrisch = cue(/\bgeriatri\w*/iu, text) ?? (alt && alt >= 70 ? `${alt} Jahre` : null);
  const reise = [['reise_oeffentlich', /\b(öffentliche\w*|bus|bahn)\b/iu], ['reise_pkw', /\b(pkw|auto)\b/iu], ['reise_begleit', /\b(begleitperson|begleitung)\b/iu]] as const;
  return [
    ziele ? prop(form, 'ziele', 'arzt', ziele, 'Rehabilitationsziele aus der Beschreibung.', ziele) : prop(form, 'ziele', 'unbekannt', null, 'Realistische, konkrete Rehabilitationsziele angeben.'),
    prop(form, 'ziele_patient', 'leer', null, 'Nur wenn die Ziele des Patienten abweichen.', null, 'm61.be_ziele'),
    ...(cue(/\b(gute|positive)\s+prognose\b/iu, text) ? pickOne(form, 'prognose', 'prog_ja', 'Positive Prognose genannt.', 'Prognose') : pickOne(form, 'prognose', null, 'Rehabilitationsprognose: ja oder eingeschränkt.', null)),
    prop(form, 'prog_text', 'leer', null, 'Nur bei eingeschränkter Prognose.', null, 'm61.be_prognose'),
    ...pickOne(form, 'rehaform', form_?.[0] ?? null, form_ ? `Rehabilitationsform: ${form_[1]}.` : 'Empfohlene Rehabilitationsform wählen.', form_?.[1] ?? null),
    schwer ? prop(form, 'schwerpunkt', 'vorgeschlagen', schwer, 'Schwerpunkt/Indikation.', schwer, 'm61.be_rehaform') : prop(form, 'schwerpunkt', 'unbekannt', null, 'Inhaltlichen Schwerpunkt angeben (z. B. orthopädisch, kardiologisch, geriatrisch).', null, 'm61.be_rehaform'),
    geriatrisch ? prop(form, 'geriatrisch', 'vorgeschlagen', true, 'Geriatrische Rehabilitation – mindestens zwei Funktionstests und geriatrietypische Diagnosen nötig.', geriatrisch) : prop(form, 'geriatrisch', 'leer', false, 'Nur bei geriatrischer Reha.'),
    checkbox(form, 'bem_pflegend', cue(/\b(pflegende\w* angehörige\w*|pflegt (?:den|die|seinen|ihre)\w*)/iu, text), 'Patient ist pflegende/r Angehörige/r.', 'm61.be_rehaform'),
    prop(form, 'bem_andere', 'leer', false, 'Weitere Anforderungen an die Einrichtung.', null, 'm61.be_rehaform'),
    prop(form, 'bem_text', 'leer', null, 'z. B. Barrierefreiheit, Allergiefaktoren, besondere Kostformen.', null, 'm61.be_rehaform'),
    checkbox(form, 'wf_neu', cue(/\bneue\w* indikation\b/iu, text), 'Vor Ablauf der Wartefrist: neue Indikation.', 'm61.be_wartefrist'),
    checkbox(form, 'wf_verschlimmerung', cue(/\bverschlimmerung\b/iu, text), 'Vor Ablauf der Wartefrist: Verschlimmerung.', 'm61.be_wartefrist'),
    checkbox(form, 'entlastung', cue(/\b(entlastung|distanzierung|wohnortfern\w*)\b/iu, text), 'Zeitweise Entlastung vom sozialen Umfeld nötig.', 'm61.be_entlastung'),
    checkbox(form, 'haeuslich_gesichert', cue(/\bhäusliche versorgung (?:ist )?gesichert\b/iu, text), 'Häusliche Versorgung gesichert (bei ambulanter Reha).', 'm61.be_ambulant'),
    ...reise.map(([id, re]) => checkbox(form, id, cue(re, text), 'Reisefähigkeit.', 'm61.be_reisefaehigkeit')),
    checkbox(form, 'pb_mitaufnahme', cue(/\bmitaufnahme\b/iu, text), 'Mitaufnahme der/des Pflegebedürftigen gewünscht.', 'm61.be_pflegebeduerftige'),
    checkbox(form, 'pb_koordination', cue(/\bkurzzeitpflege\b/iu, text), 'Koordination der Versorgung der/des Pflegebedürftigen.', 'm61.be_pflegebeduerftige'),
    segment(labeledSegments(text), 'hinweis', 'hinweise') ? prop(form, 'sonstiges', 'arzt', segment(labeledSegments(text), 'hinweis', 'hinweise')!, 'Aus der Beschreibung.', null) : prop(form, 'sonstiges', 'leer', null, 'Optional: besondere Hinweise, Rückruf erbeten.', null, 'm61.be_sonstiges'),
  ];
}

const leerAll = (ids: FormField[], why: string): FieldProposal[] => ids.map((f) => prop(form, f.id, f.filled_by === 'duria' ? 'duria' : 'leer', f.filled_by === 'duria' ? 'aus DURIA' : f.kind === 'checkbox' ? false : null, f.filled_by === 'duria' ? 'Personalien aus der eGK.' : why));

export function proposeMuster61(text: string, facts: PatientFacts, today: Date): FormProposal {
  const a = teilA(text);
  const alt = alter(text);
  const datum = `${String(today.getDate()).padStart(2, '0')}${String(today.getMonth() + 1).padStart(2, '0')}${String(today.getFullYear()).slice(2)}`;
  const kk = form.fields.filter((f) => f.id.startsWith('a_kk_')).map((f) => prop(form, f.id, 'leer', false, 'Füllt die Krankenkasse aus.'));
  if (a.modus) {
    const fields: FieldProposal[] = [
      prop(form, 'personalien_a', 'duria', 'aus DURIA', 'Personalien aus der eGK.'),
      ...diagnosen('a_', text, facts),
      ...pickOne(form, 'a_anfrage', a.modus, a.modus === 'a_pruefung' ? 'Erwerbsfähigkeit betroffen bzw. Träger unklar – Prüfung durch die Kasse erbitten; nur Teil A übermitteln.' : 'Beratung über Reha-Leistungen angezeigt; nur Teil A übermitteln.', a.evidence),
      prop(form, 'a_anmerkungen', 'leer', null, 'Optional: Rückruf, weitere Teilhabebedarfe.', null, 'm61.a_anmerkungen'),
      prop(form, 'a_datum', 'vorgeschlagen', datum, 'Datum der Ausstellung (heute).', null, 'm61.a_nur_teil_a'),
      prop(form, 'a_stempel', 'arzt', null, 'Stempel und Unterschrift – erst nach dem Ausfüllen.', null, 'm61.a_nur_teil_a'),
      ...kk,
      ...leerAll(onPage([1, 2, 3, 4]), 'Teil B–E wird bei Teil A nicht ausgefüllt.'),
    ];
    return { formId: 'muster-61', fields, generator: 'regelbasiert' };
  }
  const fields: FieldProposal[] = [
    ...leerAll(onPage([0]).filter((f) => !f.id.startsWith('a_kk_')), 'Teil A entfällt, wenn die Zuständigkeit der Kasse klar ist.'), ...kk,
    prop(form, 'personalien', 'duria', 'aus DURIA', 'Personalien aus der eGK.'),
    ...teilB(text, facts, alt),
    prop(form, 'personalien_c', 'duria', 'aus DURIA', 'Personalien aus der eGK.'),
    ...teilC(text),
    prop(form, 'personalien_d', 'duria', 'aus DURIA', 'Personalien aus der eGK.'),
    ...teilD(text, alt),
    prop(form, 'personalien_e', 'duria', 'aus DURIA', 'Personalien aus der eGK.'),
    ...pickOne(form, 'einw1', null, 'Patient entscheidet: Einwilligung zur Übermittlung der MD-Stellungnahme an den Verordner.', null),
    ...pickOne(form, 'einw2', null, 'Patient entscheidet: Einwilligung zur Übermittlung der Leistungsentscheidung an Angehörige/Einrichtungen.', null),
    prop(form, 'e_datum', 'vorgeschlagen', datum, 'Datum der Verordnung (heute).', null, 'm61.be_einwilligungen'),
    prop(form, 'stempel', 'arzt', null, 'Stempel und Unterschrift – erst nach dem Ausfüllen.'),
    prop(form, 'versicherte', 'leer', null, 'Füllt die/der Versicherte selbst aus (nur bei Einwilligung 2).'),
  ];
  return { formId: 'muster-61', fields, generator: 'regelbasiert' };
}

const filled = (values: FormValues, f: FormField) => (f.kind === 'checkbox' ? values[f.id] === true : Boolean(textOf(values, f.id)));

function teilBEIssues(values: FormValues, facts: PatientFacts): FormIssue[] {
  const out: FormIssue[] = [];
  const add = (i: FormIssue | null) => { if (i) out.push(i); };
  if (!isChecked(values, 'b_erwerb') && !isChecked(values, 'b_gleichrangig')) add(issue(form, 'fehlt', '❶ ankreuzen (weder Erwerbsfähigkeit noch Arbeitsunfall/Berufskrankheit betroffen) – sonst Teil A zur Prüfung des Trägers verwenden.', ['b_erwerb'], 'm61.be_zustaendigkeit'));
  const urs = [1, 2, 3, 4, 5, 6].map((i) => textOf(values, `urs${i}`));
  if (facts.arbeitsunfall || urs.some((u) => u === '1' || u === '2')) add(issue(form, 'unzulaessig', 'Arbeitsunfall/Berufskrankheit: zuständig ist grundsätzlich die Unfallversicherung, nicht die Krankenkasse (Teil B–E).', ['b_erwerb'], 'm61.be_zustaendigkeit'));
  for (const [i, u] of urs.entries()) if (u && !/^[1-5]$/.test(u)) add(issue(form, 'unzulaessig', `Ursache ${i + 1}: nur 1–5 eintragen.`, [`urs${i + 1}`], 'm61.be_ursachen'));
  if (!textOf(values, 'dx1')) add(issue(form, 'fehlt', 'Rehabilitationsbegründende Funktionsdiagnose angeben.', ['dx1'], 'm61.be_diagnosen'));
  if (!textOf(values, 'icd1')) add(issue(form, 'fehlt', 'ICD-10-GM-Kode zur begründenden Diagnose angeben.', ['icd1'], 'm61.be_diagnosen'));
  for (let i = 1; i <= 6; i += 1) for (const c of icdCodes(textOf(values, `icd${i}`))) if (!c.certainty) add(issue(form, 'fehlt', `ICD ${c.icd}: Diagnosesicherheit (G/V/A/Z) fehlt – der Arzt ergänzt sie.`, [`icd${i}`], 'm61.be_diagnosen'));
  if (!textOf(values, 'anamnese')) add(issue(form, 'fehlt', 'Anamnese und bisherigen Verlauf angeben.', ['anamnese'], 'm61.be_anamnese'));
  if (!textOf(values, 'befunde')) add(issue(form, 'fehlt', 'Rehabilitationsrelevante Schädigungen und Befunde angeben.', ['befunde'], 'm61.be_schaedigungen'));
  if (!textOf(values, 'interventionen')) add(issue(form, 'fehlt', 'Bisherige Interventionen/Heilmittel der letzten 6 Monate angeben.', ['interventionen'], 'm61.be_interventionen'));
  add(exactlyOne(form, values, 'hilfsmittel', 'm61.be_interventionen'));
  if (isChecked(values, 'hilfsmittel_ja') && !textOf(values, 'hilfsmittel_text')) add(issue(form, 'fehlt', 'Hilfsmittel benennen.', ['hilfsmittel_text'], 'm61.be_interventionen'));
  if (isChecked(values, 'geriatrisch')) {
    const bereiche = Object.entries(TESTS).filter(([, ids]) => ids.some((id) => textOf(values, id))).map(([b]) => b);
    if (bereiche.length < 2) add(issue(form, 'fehlt', `Geriatrische Reha: mindestens zwei Funktionstests aus unterschiedlichen Schädigungsbereichen eintragen (bisher: ${bereiche.length}).`, TESTS.mobilitaet!, 'm61.be_funktionstests'));
    add(issue(form, 'hinweis', 'Geriatrische Reha ohne Prüfung der Erforderlichkeit: mindestens 70 Jahre, eine begründende Funktionsdiagnose und zwei geriatrietypische Diagnosen.', ['geriatrisch'], 'm61.be_geriatrie'));
  }
  // F: je Lebensbereich genau ein Kreuz (übergeordnetes „keine“ ersetzt die Teilbereiche)
  const offen: string[] = [];
  for (const r of ROWS) {
    const n = COLS.filter((c) => isChecked(values, `f_${r}_${c}`)).length;
    const covered = (MOB.includes(r) && isChecked(values, 'f_mobilitaet_keine')) || (SV.includes(r) && isChecked(values, 'f_selbstversorgung_keine')) || r.endsWith('_sonst');
    if (n > 1) add(issue(form, 'unzulaessig', `F. ${form.fields.find((f) => f.id === `f_${r}_k`)!.label.split(':')[0]}: nur ein Kreuz je Bereich.`, COLS.map((c) => `f_${r}_${c}`), 'm61.be_beeintraechtigungen'));
    if (!n && !covered) offen.push(r);
  }
  if (offen.length) add(issue(form, 'fehlt', `F. Beeinträchtigungen: ${offen.length} Lebensbereiche noch nicht eingeschätzt.`, offen.map((r) => `f_${r}_k`), 'm61.be_beeintraechtigungen'));
  if (!textOf(values, 'kontext')) add(issue(form, 'fehlt', 'Lebensumstände/Kontextfaktoren angeben.', ['kontext'], 'm61.be_kontextfaktoren'));
  add(exactlyOne(form, values, 'rehafaehig', 'm61.be_rehafaehigkeit'));
  if (isChecked(values, 'rf_nein')) add(issue(form, 'unzulaessig', 'Ohne ausreichende Belastbarkeit ist der Patient nicht rehabilitationsfähig – Reha so nicht verordnungsfähig.', ['rf_nein'], 'm61.be_rehafaehigkeit'));
  if (!textOf(values, 'ziele')) add(issue(form, 'fehlt', 'Rehabilitationsziele angeben.', ['ziele'], 'm61.be_ziele'));
  add(exactlyOne(form, values, 'prognose', 'm61.be_prognose'));
  if (isChecked(values, 'prog_eingeschraenkt') && !textOf(values, 'prog_text')) add(issue(form, 'fehlt', 'Eingeschränkte Prognose: angeben, hinsichtlich wessen.', ['prog_text'], 'm61.be_prognose'));
  add(exactlyOne(form, values, 'rehaform', 'm61.be_rehaform'));
  if (!textOf(values, 'schwerpunkt')) add(issue(form, 'fehlt', 'Inhaltlichen Schwerpunkt/Indikation angeben.', ['schwerpunkt'], 'm61.be_rehaform'));
  if ((isChecked(values, 'rf_ambulant') || isChecked(values, 'rf_mobil')) && !isChecked(values, 'haeuslich_gesichert')) add(issue(form, 'fehlt', 'Ambulante Reha: ankreuzen, ob die häusliche Versorgung gesichert ist.', ['haeuslich_gesichert'], 'm61.be_ambulant'));
  if (['rf_muetter', 'rf_vaeter', 'rf_mutter_kind', 'rf_vater_kind'].some((id) => isChecked(values, id))) add(issue(form, 'hinweis', 'Mütter-/Väter-Leistung: relevante Kontextfaktoren unter II. G darstellen.', ['kontext'], 'm61.be_rehaform'));
  add(issue(form, 'hinweis', 'Vor Ablauf von vier Jahren seit der letzten Reha: Maßnahme und Dringlichkeit begründen (nicht bei Kindern unter 18).', ['wf_neu', 'wf_verschlimmerung'], 'm61.be_wartefrist'));
  add(exactlyOne(form, values, 'einw1', 'm61.be_einwilligungen'));
  add(exactlyOne(form, values, 'einw2', 'm61.be_einwilligungen'));
  if (!textOf(values, 'e_datum')) add(issue(form, 'fehlt', 'Datum der Verordnung eintragen.', ['e_datum'], 'm61.be_einwilligungen'));
  return out;
}

export function checkMuster61(values: FormValues, facts: PatientFacts): FormIssue[] {
  const out: FormIssue[] = [];
  const add = (i: FormIssue | null) => { if (i) out.push(i); };
  const a = isChecked(values, 'a_beratung') || isChecked(values, 'a_pruefung');
  const be = onPage([1, 2, 3, 4]).some((f) => f.filled_by !== 'duria' && f.filled_by !== 'leistungserbringer' && f.id !== 'e_datum' && filled(values, f));
  if (a && be) add(issue(form, 'unzulaessig', 'Teil A (Beratung/Prüfung) und Teil B–E schließen sich aus: bei Teil A nur Teil A an die Krankenkasse übermitteln.', ['a_beratung', 'a_pruefung'], 'm61.a_nur_teil_a'));
  if (a) {
    add(exactlyOne(form, values, 'a_anfrage', 'm61.a_nur_teil_a'));
    if (!textOf(values, 'a_dx1')) add(issue(form, 'fehlt', 'Teil A: rehabilitationsbegründende Funktionsdiagnose angeben.', ['a_dx1'], 'm61.a_diagnosen'));
    if (!textOf(values, 'a_icd1')) add(issue(form, 'fehlt', 'Teil A: ICD-10-GM-Kode angeben.', ['a_icd1'], 'm61.a_diagnosen'));
    if (!textOf(values, 'a_datum')) add(issue(form, 'fehlt', 'Teil A: Datum eintragen.', ['a_datum'], 'm61.a_nur_teil_a'));
  } else {
    out.push(...teilBEIssues(values, facts));
  }
  out.push(...formatIssues(form, values));
  return out;
}
