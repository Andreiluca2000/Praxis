import { checkbox, exactlyOne, formatIssues, isChecked, issue, pickOne, prop, textOf } from './build.js';
import { getForm } from './catalog.js';
import { diagnose, labeled, personalien, stempel } from './common.js';
import { BEREICH_FIELD, type BereichId, bereich, type Diagnosegruppe, gruppe, gruppeAusBeispielen, heilmittelIn, HEILMITTEL, norm } from './heilmittel.js';
import { cue, icdCodes, labeledSegments, segment, uni } from './text.js';
import type { FieldProposal, FormIssue, FormProposal, FormValues, PatientFacts } from './types.js';

/**
 * Muster 13 – Heilmittelverordnung (Stand 10.2020). Ausfüllregeln: Erläuterungen 01/2026, S. 51–55;
 * Diagnosegruppen, Leitsymptomatik, Heilmittel und Höchstmengen: Heilmittel-Richtlinie (Heilmittelkatalog).
 */
const form = getForm('muster-13');

const BEREICHE: [BereichId, RegExp][] = [
  ['physiotherapie', /\b(physiotherap\w*|physio|krankengymnastik|manuelle therapie|lymphdrainage|massage\w*|bewegungstherapie)\b/iu],
  ['ergotherapie', /\b(ergotherap\w*|ergo)\b/iu],
  ['stimm_sprech_sprach_schluck', /\b(logopäd\w*|sprachtherap\w*|sprechtherap\w*|stimmtherap\w*|schlucktherap\w*)\b/iu],
  ['podologie', /\b(podolog\w*)\b/iu],
  ['ernaehrungstherapie', /\b(ernährungstherap\w*)\b/iu],
];

function bereichIn(text: string): { id: BereichId; evidence: string } | null {
  for (const [id, re] of BEREICHE) {
    const m = cue(re, text);
    if (m) return { id, evidence: m };
  }
  return null;
}

/** Ausdrücklich genannte Diagnosegruppe („WS“, „EX“, „SO 1“) oder eine, deren Beispieldiagnose im Text steht. */
function gruppeIn(id: BereichId, text: string): { g: Diagnosegruppe; evidence: string; explicit: boolean } | null {
  for (const g of bereich(id)?.diagnosegruppen ?? []) {
    const code = norm(g.code).replace(/^([A-Z]+)(\d+)$/, '$1\\s?$2');
    const m = uni(new RegExp(`\\b${code}\\b`, 'u')).exec(text);
    if (m) return { g, evidence: m[0], explicit: true };
  }
  const b = gruppeAusBeispielen(id, text);
  return b ? { g: b.gruppe, evidence: b.evidence, explicit: false } : null;
}

function leitsymptomatik(text: string, g: Diagnosegruppe | null): FieldProposal[] {
  const m = uni(/\b(?:leitsymptomatik|ls)\s*:?\s*([abc](?:\s*(?:,|und|\+|\/)\s*[abc])*)\b/iu).exec(text);
  const keys = m ? [...m[1]!.toLowerCase().matchAll(/[abc]/g)].map((x) => x[0]) : [];
  const free = segment(labeledSegments(text), 'leitsymptomatik');
  const individuell = cue(/\bpatientenindividuell\w*/iu, text);
  const known = g?.leitsymptomatik.map((l) => `${l.key}) ${l.text}`).join(' · ') ?? '';
  const fields = (['a', 'b', 'c'] as const).map((k) => keys.includes(k)
    ? prop(form, `ls_${k}`, 'vorgeschlagen', true, `Leitsymptomatik ${k}${g ? `: ${g.leitsymptomatik.find((l) => l.key === k)?.text ?? '–'}` : ''}.`, m![0], 'm13.leitsymptomatik')
    : prop(form, `ls_${k}`, keys.length || individuell ? 'leer' : 'unbekannt', keys.length || individuell ? false : null,
      keys.length || individuell ? 'Nicht genannt.' : `Leitsymptomatik wählen${known ? ` – laut Katalog: ${known}` : ''}.`, null, 'm13.leitsymptomatik'));
  fields.push(individuell
    ? prop(form, 'ls_individuell', 'vorgeschlagen', true, 'Patientenindividuelle Leitsymptomatik – als Freitext angeben.', individuell, 'm13.leitsymptomatik')
    : prop(form, 'ls_individuell', keys.length ? 'leer' : 'unbekannt', keys.length ? false : null, keys.length ? 'Nicht genannt.' : 'Alternativ eine patientenindividuelle Leitsymptomatik als Freitext.', null, 'm13.leitsymptomatik'));
  fields.push(free
    ? prop(form, 'ls_text', 'vorgeschlagen', free, 'Aus „Leitsymptomatik:“ in der Beschreibung.', free, 'm13.leitsymptomatik')
    : prop(form, 'ls_text', individuell ? 'unbekannt' : 'leer', null, individuell ? 'Patientenindividuelle Leitsymptomatik als Freitext ergänzen.' : 'Klartext freiwillig (Buchstabe genügt).', null, 'm13.leitsymptomatik'));
  return fields;
}

const units = (text: string, name: string): string | null => {
  const n = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const m = uni(new RegExp(`\\b(\\d{1,2})\\s*(?:x|×|mal)?\\s*${n}\\b|\\b${n}\\s*(?:x|×)?\\s*(\\d{1,2})\\s*(?:x|×|mal|einheiten|be)\\b`, 'iu')).exec(text);
  return m ? (m[1] ?? m[2] ?? null) : null;
};

function heilmittelRows(text: string, g: Diagnosegruppe | null, id: BereichId | null): FieldProposal[] {
  const pool = g ? g.vorrangig : (id ? bereich(id)?.diagnosegruppen.flatMap((x) => x.vorrangig) ?? [] : []);
  const extra = g ? g.ergaenzend : (id ? bereich(id)?.diagnosegruppen.flatMap((x) => x.ergaenzend) ?? [] : []);
  const found = heilmittelIn(text, [...new Set(pool)]).slice(0, 3);
  const zusatz = heilmittelIn(text, [...new Set(extra)].filter((x) => !found.includes(x)))[0] ?? null;
  const global = uni(/\b(\d{1,2})\s*(?:einheiten|behandlungseinheiten|be)\b/iu).exec(text)?.[1] ?? null;
  const max = g?.hoechstmenge_je_vo;
  const menge = `Anzahl nach Einzelfall${max ? ` – Höchstmenge je Verordnung laut Katalog (${g!.code}): ${max}` : ''}.`;
  const out: FieldProposal[] = [];
  for (let i = 0; i < 3; i += 1) {
    const hm = found[i];
    const n = `hm${i + 1}`;
    if (!hm) {
      out.push(i === 0 && !zusatz
        ? prop(form, n, 'unbekannt', null, `Vorrangiges Heilmittel wählen${pool.length ? ` – laut Katalog: ${[...new Set(pool)].join(', ')}` : ''}.`, null, 'm13.heilmittel')
        : prop(form, n, 'leer', null, 'Weiteres vorrangiges Heilmittel nur bei Bedarf (höchstens drei).', null, 'm13.heilmittel'));
      out.push(prop(form, `${n}_einheiten`, 'leer', null, 'Nur zusammen mit einem Heilmittel.', null, 'm13.einheiten'));
      continue;
    }
    const long = HEILMITTEL.abkuerzungen[hm];
    const doppel = uni(/\bdoppelbehandlung\b/iu).test(text) ? ' als Doppelbehandlung' : '';
    out.push(prop(form, n, 'vorgeschlagen', `${label(hm)}${doppel}`, 'Vorrangiges Heilmittel laut Katalog der Diagnosegruppe.', hm, 'm13.heilmittel'));
    const u = units(text, hm) ?? (long ? units(text, long) : null) ?? (found.length === 1 ? global : null);
    out.push(u ? prop(form, `${n}_einheiten`, 'vorgeschlagen', u, menge, u, 'm13.einheiten') : prop(form, `${n}_einheiten`, 'unbekannt', null, menge, null, 'm13.einheiten'));
  }
  if (zusatz) {
    const long = HEILMITTEL.abkuerzungen[zusatz];
    out.push(prop(form, 'ergaenzend', 'vorgeschlagen', label(zusatz), 'Ergänzendes Heilmittel laut Katalog.', zusatz, 'm13.ergaenzend'));
    const u = units(text, zusatz) ?? (long ? units(text, long) : null);
    out.push(u ? prop(form, 'ergaenzend_einheiten', 'vorgeschlagen', u, 'Höchstens so viele wie die vorrangigen Heilmittel zusammen.', u, 'm13.ergaenzend_menge')
      : prop(form, 'ergaenzend_einheiten', 'unbekannt', null, 'Einheiten des ergänzenden Heilmittels (höchstens Summe der vorrangigen).', null, 'm13.ergaenzend_menge'));
  } else {
    out.push(prop(form, 'ergaenzend', 'leer', null, 'Ergänzendes Heilmittel nur bei Bedarf (höchstens eines).', null, 'm13.ergaenzend'));
    out.push(prop(form, 'ergaenzend_einheiten', 'leer', null, 'Nur mit ergänzendem Heilmittel.', null, 'm13.ergaenzend_menge'));
  }
  return out;
}

export function proposeMuster13(text: string, facts: PatientFacts): FormProposal {
  const b = bereichIn(text);
  const gi = b ? gruppeIn(b.id, text) : null;
  const g = gi?.g ?? null;
  const codes = icdCodes(text).filter((c) => c.certainty);
  const freq = uni(/\b(\d(?:\s*-\s*\d)?)\s*(?:x|×|mal)\s*(?:pro\s+woche|\/\s*woche|wöchentlich|in der woche|die woche)/iu).exec(text);
  const hbNein = uni(/\b(kein|keine|ohne)\s+hausbesuch\w*/iu).exec(text);
  const hbJa = hbNein ? null : cue(/\b(hausbesuch\w*|bettlägerig\w*|kann die praxis nicht aufsuchen|immobil\w*)\b/iu, text);
  const fields: FieldProposal[] = [
    ...(facts.zuzahlungsbefreit
      ? pickOne(form, 'zuzahlung', 'zuzahlungsfrei', 'Befreiung genannt – Nachweis prüfen.', facts.zuzahlungsbefreit.evidence)
      : pickOne(form, 'zuzahlung', null, 'Zuzahlung: Befreiung bzw. Alter des Patienten prüfen und ankreuzen.', null)),
    checkbox(form, 'unfall', facts.unfall?.evidence ?? null, 'Unfallfolgen (kein Arbeitsunfall).'),
    checkbox(form, 'bvg', facts.versorgungsleiden?.evidence ?? null, 'Anerkannte Schädigungsfolge (SER/BVG).', 'm13.ser'),
    personalien(form),
    ...pickOne(form, 'bereich', b ? BEREICH_FIELD[b.id] : null, b ? 'Heilmittelbereich aus der Beschreibung.' : 'Heilmittelbereich wählen (nur einer).', b?.evidence ?? null),
    codes.length ? prop(form, 'icd', 'arzt', codes.map((c) => `${c.icd} ${c.certainty}`).join(', '), 'ICD-10-GM-Code(s) aus der Beschreibung – der Arzt bestätigt.', codes.map((c) => c.evidence).join(', '))
      : prop(form, 'icd', 'unbekannt', null, 'Therapierelevante Diagnose als ICD-10-GM-Code (vom Arzt, mit Sicherheit).'),
    diagnose(form, text),
    g ? prop(form, 'diagnosegruppe', 'vorgeschlagen', g.code, gi!.explicit ? `Diagnosegruppe ${g.code} – ${g.name}.` : `Naheliegend: ${g.code} – ${g.name} (Beispieldiagnose „${gi!.evidence}“ im Katalog) – bitte prüfen.`, gi!.evidence)
      : prop(form, 'diagnosegruppe', 'unbekannt', null, b ? `Diagnosegruppe wählen – im Bereich: ${(bereich(b.id)?.diagnosegruppen ?? []).map((x) => x.code).join(', ')}.` : 'Diagnosegruppe nach Heilmittelkatalog wählen.'),
    ...leitsymptomatik(text, g),
    ...heilmittelRows(text, g, b?.id ?? null),
    checkbox(form, 'therapiebericht', cue(/\btherapiebericht\w*/iu, text), 'Therapiebericht wird angefordert.'),
    ...(hbNein ? pickOne(form, 'hausbesuch', 'hausbesuch_nein', 'Kein Hausbesuch.', hbNein[0])
      : hbJa ? pickOne(form, 'hausbesuch', 'hausbesuch_ja', 'Patient kann die Praxis aus medizinischen Gründen nicht aufsuchen – bitte bestätigen.', hbJa)
        : pickOne(form, 'hausbesuch', null, 'Hausbesuch ja oder nein ankreuzen.', null)),
    freq ? prop(form, 'frequenz', 'vorgeschlagen', `${freq[1]!.replace(/\s+/g, '')}x wöchentlich`, 'Therapiefrequenz aus der Beschreibung.', freq[0])
      : prop(form, 'frequenz', 'unbekannt', null, `Therapiefrequenz angeben${g?.frequenz ? ` – Empfehlung laut Katalog: ${g.frequenz}` : ''}.`),
    checkbox(form, 'dringlich', facts.dringend?.evidence ?? null, 'Behandlung muss innerhalb von 14 Tagen beginnen.'),
    labeled(form, text, 'therapieziele', ['therapieziel', 'therapieziele', 'befund', 'befunde'], 'Freiwillig: Therapieziel und weitere Befunde.'),
    prop(form, 'ik', 'leer', null, 'Füllt der Heilmittelerbringer aus.'),
    stempel(form),
  ];
  return { formId: 'muster-13', fields, generator: 'regelbasiert' };
}

const ISOLIERT = /\b(elektrotherap\w*|elektrostimulation|ultraschall-?wärmetherap\w*)\b/iu;
/** Kurzname für den Vordruck: „KG (allgemeine Krankengymnastik)“ statt der langen Katalogerklärung. */
function label(hm: string): string {
  const long = HEILMITTEL.abkuerzungen[hm];
  const short = long?.split(/[;,(]/)[0]?.trim();
  return short && short.toLowerCase() !== hm.toLowerCase() ? `${hm} (${short})` : hm;
}

const n = (v: string) => (/^\d{1,2}$/.test(v) ? Number(v) : NaN);

function mengenIssues(values: FormValues, g: Diagnosegruppe | undefined): FormIssue[] {
  const out: FormIssue[] = [];
  const rows = ['hm1', 'hm2', 'hm3'].filter((id) => textOf(values, id));
  for (const id of rows) if (!textOf(values, `${id}_einheiten`)) out.push(issue(form, 'fehlt', `Behandlungseinheiten für „${textOf(values, id)}“ angeben.`, [`${id}_einheiten`], 'm13.einheiten'));
  const sum = rows.reduce((s, id) => s + (n(textOf(values, `${id}_einheiten`)) || 0), 0);
  const langfristig = uni(/\b(langfristig\w*|besonderer verordnungsbedarf|12 wochen)\b/iu).test(`${textOf(values, 'therapieziele')} ${textOf(values, 'diagnose')}`);
  if (g?.hoechstmenge_je_vo && sum > g.hoechstmenge_je_vo) {
    out.push(langfristig
      ? issue(form, 'hinweis', `Mehr als die Höchstmenge (${g.hoechstmenge_je_vo}) – nur bei langfristigem bzw. besonderem Verordnungsbedarf (bis 12 Wochen, nach Frequenz bemessen).`, rows.map((id) => `${id}_einheiten`), 'm13.langfristig')
      : issue(form, 'unzulaessig', `Zusammen ${sum} Einheiten – die Höchstmenge je Verordnung für ${g.code} ist ${g.hoechstmenge_je_vo} (Heilmittelkatalog).`, rows.map((id) => `${id}_einheiten`), 'm13.einheiten'));
  }
  if (textOf(values, 'ergaenzend')) {
    const e = n(textOf(values, 'ergaenzend_einheiten'));
    if (!textOf(values, 'ergaenzend_einheiten')) out.push(issue(form, 'fehlt', 'Behandlungseinheiten für das ergänzende Heilmittel angeben.', ['ergaenzend_einheiten'], 'm13.ergaenzend_menge'));
    else if (rows.length && e > sum) out.push(issue(form, 'unzulaessig', `Ergänzendes Heilmittel: höchstens ${sum} Einheiten (Summe der vorrangigen).`, ['ergaenzend_einheiten'], 'm13.ergaenzend_menge'));
  }
  return out;
}

export function checkMuster13(values: FormValues, facts: PatientFacts): FormIssue[] {
  const out: FormIssue[] = [];
  const add = (i: FormIssue | null) => { if (i) out.push(i); };
  if (facts.arbeitsunfall) add(issue(form, 'unzulaessig', `Arbeitsunfall/Berufskrankheit („${facts.arbeitsunfall.evidence}“): Muster 13 ist dafür nicht zu verwenden.`, [], 'm13.arbeitsunfall'));
  add(exactlyOne(form, values, 'zuzahlung', 'm13.zuzahlung'));
  add(exactlyOne(form, values, 'bereich', 'm13.bereich'));
  add(exactlyOne(form, values, 'hausbesuch', 'm13.hausbesuch'));
  const bId = (Object.entries(BEREICH_FIELD) as [BereichId, string][]).find(([, f]) => isChecked(values, f))?.[0] ?? null;
  const icd = textOf(values, 'icd');
  if (!icd) add(issue(form, 'fehlt', 'ICD-10-GM-Code der therapierelevanten Diagnose angeben (Ausnahme nur begründet).', ['icd'], 'm13.icd'));
  for (const c of icdCodes(icd)) if (!c.certainty) add(issue(form, 'fehlt', `ICD ${c.icd}: Diagnosesicherheit (G/V/A/Z) fehlt – der Arzt ergänzt sie.`, ['icd'], 'm13.icd'));
  const dg = textOf(values, 'diagnosegruppe');
  const g = dg ? gruppe(bId, dg) : undefined;
  if (!dg) add(issue(form, 'fehlt', 'Diagnosegruppe nach Heilmittelkatalog angeben.', ['diagnosegruppe'], 'm13.diagnosegruppe'));
  else if (!g) add(issue(form, 'unzulaessig', `Diagnosegruppe „${dg}“ gibt es im Heilmittelkatalog${bId ? ' für diesen Bereich' : ''} nicht.`, ['diagnosegruppe'], 'm13.diagnosegruppe'));
  const letters = (['a', 'b', 'c'] as const).filter((k) => isChecked(values, `ls_${k}`));
  if (!letters.length && !isChecked(values, 'ls_individuell') && !textOf(values, 'ls_text')) add(issue(form, 'fehlt', 'Leitsymptomatik angeben (a, b, c oder patientenindividuell).', ['ls_a', 'ls_b', 'ls_c', 'ls_individuell'], 'm13.leitsymptomatik'));
  if (isChecked(values, 'ls_individuell') && !textOf(values, 'ls_text')) add(issue(form, 'fehlt', 'Patientenindividuelle Leitsymptomatik als Freitext angeben.', ['ls_text'], 'm13.leitsymptomatik'));
  if (g) for (const k of letters) if (!g.leitsymptomatik.some((l) => l.key === k)) add(issue(form, 'unzulaessig', `Leitsymptomatik ${k} gibt es in Diagnosegruppe ${g.code} nicht.`, [`ls_${k}`], 'm13.leitsymptomatik'));
  const rows = ['hm1', 'hm2', 'hm3'].filter((id) => textOf(values, id));
  const erg = textOf(values, 'ergaenzend');
  if (!rows.length && !erg) add(issue(form, 'fehlt', 'Mindestens ein Heilmittel nach Maßgabe des Katalogs angeben.', ['hm1'], 'm13.heilmittel'));
  if (!rows.length && erg && !(bId === 'physiotherapie' && uni(ISOLIERT).test(erg))) add(issue(form, 'unzulaessig', 'Ein ergänzendes Heilmittel allein ist nur bei Elektrotherapie/-stimulation oder Ultraschall-Wärmetherapie (Physiotherapie) möglich.', ['ergaenzend', 'hm1'], 'm13.isoliert'));
  if (g) for (const id of rows) if (!heilmittelIn(textOf(values, id), g.vorrangig).length && !uni(/standardisierte heilmittelkombination/iu).test(textOf(values, id))) add(issue(form, 'hinweis', `„${textOf(values, id)}“ ist kein vorrangiges Heilmittel der Gruppe ${g.code} laut Katalog – bitte prüfen.`, [id], 'm13.heilmittel'));
  if (uni(/doppelbehandlung/iu).test(erg) || ((bId === 'podologie' || bId === 'ernaehrungstherapie') && rows.some((id) => uni(/doppelbehandlung/iu).test(textOf(values, id))))) add(issue(form, 'unzulaessig', 'Doppelbehandlung ist für ergänzende Heilmittel, Podologie und Ernährungstherapie nicht möglich.', ['ergaenzend', ...rows], 'm13.doppel'));
  if (bId === 'podologie' && rows.some((id) => uni(/\bgruppe\w*/iu).test(textOf(values, id)))) add(issue(form, 'unzulaessig', 'Podologische Behandlung nur als Einzeltherapie.', rows, 'm13.gruppe'));
  out.push(...mengenIssues(values, g));
  if (!textOf(values, 'frequenz')) add(issue(form, 'fehlt', `Therapiefrequenz angeben${g?.frequenz ? ` (Empfehlung: ${g.frequenz})` : ''}.`, ['frequenz'], 'm13.frequenz'));
  add(issue(form, 'hinweis', isChecked(values, 'dringlich') ? 'Dringlich: Behandlungsbeginn spätestens nach 14 Tagen, sonst verliert die Verordnung ihre Gültigkeit.' : 'Behandlungsbeginn innerhalb von 28 Tagen, sonst verliert die Verordnung ihre Gültigkeit.', ['dringlich'], 'm13.dringlich'));
  out.push(...formatIssues(form, values));
  return out;
}
