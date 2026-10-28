import { checkbox, exactlyOne, formatIssues, isChecked, issue, pickOne, prop, textOf, validTTMMJJ } from './build.js';
import { getForm } from './catalog.js';
import { personalien, stempel } from './common.js';
import { cue, dateAfter, icdCodes, labeledSegments, segment, toTTMMJJ, uni } from './text.js';
import type { FieldProposal, FormIssue, FormProposal, FormValues, PatientFacts } from './types.js';

/** Muster 12 – Verordnung häuslicher Krankenpflege (Stand 7.2024). Erläuterungen 01/2026, S. 43–50. */
const form = getForm('muster-12');

/** Zeilen der Tabelle: Kästchen, ob die Pflegefachkraft Häufigkeit/Dauer festlegen darf (Spalte vorhanden). */
const ROWS: { id: string; pfk: boolean }[] = [
  { id: 'medibox', pfk: false }, { id: 'medigabe', pfk: false }, { id: 'injektion', pfk: false }, { id: 'bz', pfk: false },
  { id: 'kstrumpf_an', pfk: true }, { id: 'kverband_an', pfk: true }, { id: 'stuetz', pfk: true },
  { id: 'wund_akut', pfk: true }, { id: 'wund_chronisch', pfk: false },
  { id: 'sonst1', pfk: true }, { id: 'sonst2', pfk: true }, { id: 'grundpflege', pfk: true }, { id: 'hauswirtschaft', pfk: true },
];

const ttmmjj = (d: Date) => `${String(d.getDate()).padStart(2, '0')}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getFullYear()).slice(2)}`;
const fromTTMMJJ = (v: string) => new Date(2000 + Number(v.slice(4, 6)), Number(v.slice(2, 4)) - 1, Number(v.slice(0, 2)));

function zeitraum(text: string, today: Date): { vom: string | null; bis: string | null; evidence: string | null } {
  const m = uni(/\b(?:vom\s*)?(\d{1,2})\.(\d{1,2})\.(\d{4}|\d{2})\s*(?:bis|-|–)\s*(\d{1,2})\.(\d{1,2})\.(\d{4}|\d{2})\b/iu).exec(text);
  if (m) return { vom: toTTMMJJ(m[1]!, m[2]!, m[3]!), bis: toTTMMJJ(m[4]!, m[5]!, m[6]!), evidence: m[0] };
  const d = uni(/\b(?:für|über)\s+(\d{1,2})\s*(tage?|wochen?)\b/iu).exec(text);
  if (!d) return { vom: null, bis: null, evidence: null };
  const days = Number(d[1]) * (/woche/iu.test(d[2]!) ? 7 : 1);
  const end = new Date(today); end.setDate(end.getDate() + days - 1);
  return { vom: ttmmjj(today), bis: ttmmjj(end), evidence: d[0] };
}

function haeufigkeit(text: string): string | null {
  const parts = [...text.matchAll(uni(/\b(\d{1,2})\s*(?:x|×|mal)\s*(tgl\.?|täglich|wtl\.?|wöchentlich|pro woche|mtl\.?|monatlich)/giu))];
  if (!parts.length) return null;
  return parts.map((p) => `${p[1]}x ${/^t/iu.test(p[2]!) ? 'tgl.' : /^m/iu.test(p[2]!) ? 'mtl.' : 'wtl.'}`).join(', ');
}

function leistungen(text: string) {
  const strumpf = cue(/\b(kompressionsstrümpfe|kompressionsstrumpf\w*|mts)\b/iu, text);
  const verband = cue(/\b(kompressionsverb\w*)\b/iu, text);
  return {
    medibox: cue(/\b(medikamentenbox|wochendosett\w*|dispenser|medikamente stellen|medikamente richten)\b/iu, text),
    medigabe: cue(/\b(medikamentengabe|medikamente (?:geben|verabreichen)|tabletten(?:gabe)?)\b/iu, text),
    injektion: cue(/\b(injektion\w*|spritze\w*|heparin\w*|insulin spritzen|s\.?c\.?-?gabe)\b/iu, text),
    bz: cue(/\b(blutzucker\w*|bz-?messung\w*|bz-?kontroll\w*)\b/iu, text),
    kstrumpf_an: strumpf, kstrumpf_aus: strumpf,
    kverband_an: verband, kverband_ab: verband,
    stuetz: cue(/\b(stützverband|stützende\w*\s+verb\w*|stabilisierende\w*\s+verb\w*)\b/iu, text),
    wund: cue(/\b(wund\w*|ulcus\w*|ulkus\w*|dekubitus|verbandswechsel|verbandwechsel)\b/iu, text),
    grundpflege: cue(/\b(grundpflege|körperpflege|hilfe beim waschen)\b/iu, text),
    hauswirtschaft: cue(/\b(hauswirtschaft\w*|haushaltshilfe|einkaufen)\b/iu, text),
    unterstuetzung: cue(/\b(unterstützungspflege|nach (?:dem\s+)?(?:krankenhaus|kh)-?aufenthalt|nach ambulanter op\w*)\b/iu, text),
    khvermeidung: cue(/\b(krankenhausvermeidung\w*|krankenhaus vermeiden|lehnt\s+(?:die\s+)?(?:krankenhaus)?einweisung ab)\b/iu, text),
    anleitung: cue(/\b(anleitung|anleiten|schulung)\b/iu, text),
    blanko: cue(/\b(blankoverordnung|blanko|pflegefachkraft (?:legt|bestimmt|entscheidet)\w*)\b/iu, text),
  };
}

function wunde(text: string, ev: string | null): FieldProposal[] {
  if (!ev) {
    return ['wundart', 'lokalisation', 'groesse', 'grad', 'verbandmaterial'].map((id) => prop(form, id, 'leer', null, 'Nur bei Wundversorgung.', null, 'm12.wundversorgung'));
  }
  const art = cue(/\b(ulcus cruris\w*|ulkus cruris|dekubitus|diabetisch\w* fu(?:ß|ss)\w*|op-?wunde|operationswunde|platzwunde|schürfwunde|brandwunde|ulcus|ulkus)\b/iu, text);
  const lok = uni(/\b(?:am|an der|an den|im bereich (?:des|der))\s+((?:unterschenkel|ferse|sakrum|steiß\w*|knöchel|vorfuß|fuß|zehe|hüfte|knie|rücken|bauch|oberschenkel|arm|hand)\w*(?:\s+(?:re\.?|li\.?|rechts|links|bds\.?|beidseits))?)/iu).exec(text);
  const g = uni(/\b(\d+(?:[.,]\d+)?)\s*x\s*(\d+(?:[.,]\d+)?)(?:\s*x\s*(\d+(?:[.,]\d+)?))?\s*(cm|mm)\b/iu).exec(text);
  const grad = uni(/\b(?:grad|kategorie)\s*([1-4]|i{1,3}|iv)\b/iu).exec(text);
  const mat = segment(labeledSegments(text), 'verbandmaterial', 'präparate', 'medikation');
  const dekubitus = art && /dekubitus/iu.test(art);
  return [
    art ? prop(form, 'wundart', 'arzt', art, 'Wundart aus der Beschreibung – bitte bestätigen.', art) : prop(form, 'wundart', 'unbekannt', null, 'Wundart angeben (z. B. Ulcus cruris, Dekubitus, OP-Wunde).'),
    lok ? prop(form, 'lokalisation', 'arzt', lok[1]!, 'Lokalisation aus der Beschreibung.', lok[0]) : prop(form, 'lokalisation', 'unbekannt', null, 'Lokalisation der Wunde angeben.'),
    g ? prop(form, 'groesse', 'arzt', g[0], 'Aktuelle Größe (Länge × Breite × Tiefe).', g[0]) : prop(form, 'groesse', 'unbekannt', null, 'Aktuelle Größe angeben (Länge, Breite, Tiefe).'),
    grad ? prop(form, 'grad', 'arzt', grad[1]!.toUpperCase(), 'Grad (bei Dekubitus Pflicht).', grad[0])
      : prop(form, 'grad', dekubitus ? 'unbekannt' : 'leer', null, dekubitus ? 'Bei Dekubitus den aktuellen Grad angeben.' : 'Nur bei Dekubitus.'),
    mat ? prop(form, 'verbandmaterial', 'arzt', mat, 'Präparate/Verbandmaterial aus der Beschreibung.', mat)
      : prop(form, 'verbandmaterial', 'unbekannt', null, 'Anzuwendende Präparate bzw. Verbandmaterial angeben (oder als Anlage).'),
  ];
}

function tabelle(id: string, on: string | null, pfkAllowed: boolean, blanko: boolean, freq: string | null, single: boolean): FieldProposal[] {
  const out: FieldProposal[] = [checkbox(form, id, on, 'Maßnahme aus der Beschreibung.')];
  const pfk = Boolean(on && pfkAllowed && blanko);
  if (pfkAllowed) out.push(pfk ? prop(form, `${id}_pfk`, 'vorgeschlagen', true, 'Häufigkeit und Dauer legt die Pflegefachkraft fest (Blankoverordnung).', on) : prop(form, `${id}_pfk`, 'leer', false, on ? 'Häufigkeit und Dauer legt der Arzt fest.' : 'Nur mit der Maßnahme.'));
  if (!on || pfk) {
    out.push(prop(form, `${id}_hf`, 'leer', null, pfk ? 'Keine ärztliche Angabe, wenn die Pflegefachkraft festlegt.' : 'Nur mit der Maßnahme.'));
    out.push(prop(form, `${id}_dauer`, 'leer', null, 'Nur bei Abweichung vom Gesamtzeitraum.'));
    return out;
  }
  out.push(freq && single ? prop(form, `${id}_hf`, 'vorgeschlagen', freq, 'Häufigkeit aus der Beschreibung.', freq) : prop(form, `${id}_hf`, 'unbekannt', null, 'Häufigkeit angeben (z. B. „1x tgl.“, „3x wtl.“).'));
  out.push(prop(form, `${id}_dauer`, 'leer', null, 'Nur bei Abweichung vom Gesamtzeitraum.'));
  return out;
}

export function proposeMuster12(text: string, facts: PatientFacts, today: Date): FormProposal {
  const l = leistungen(text);
  const codes = icdCodes(text).filter((c) => c.certainty).slice(0, 4);
  const einschr = segment(labeledSegments(text), 'einschränkung', 'einschränkungen') ?? uni(/[^.;]*\b(kann|können)\b[^.;]*\bnicht\b[^.;]*/iu).exec(text)?.[0]?.trim() ?? null;
  const zr = zeitraum(text, today);
  const freq = haeufigkeit(text);
  const chronisch = l.wund ? cue(/\b(chronisch\w*|ulcus\w*|ulkus\w*|dekubitus|diabetisch\w* fu(?:ß|ss)\w*)\b/iu, text) : null;
  const akut = l.wund && !chronisch ? cue(/\b(akut\w*|postoperativ\w*|op-?wunde|operationswunde|naht\w*|platzwunde|schürfwunde)\b/iu, text) : null;
  const rows: [string, string | null, boolean][] = [
    ['medibox', l.medibox, false], ['medigabe', l.medigabe, false], ['injektion', l.injektion, false], ['bz', l.bz && !cue(/\b(intensiviert\w*|ict|basis-?bolus)\b/iu, text) ? l.bz : null, false],
    ['kstrumpf_an', l.kstrumpf_an, true], ['kverband_an', l.kverband_an, true], ['stuetz', l.stuetz, true],
    ['wund_akut', akut, true], ['wund_chronisch', chronisch, false], ['grundpflege', l.grundpflege, true], ['hauswirtschaft', l.hauswirtschaft, true],
  ];
  const selected = rows.filter(([, ev]) => ev).length;
  const blanko = Boolean(l.blanko);
  const art = cue(/\b(folgeverordnung|weiterhin|fortsetzung|verlängerung)\b/iu, text) ? 'folge' : cue(/\b(erstverordnung|erstmals|erstmalig|neu)\b/iu, text) ? 'erst' : null;
  const fields: FieldProposal[] = [
    personalien(form),
    ...[0, 1, 2, 3].map((i) => (codes[i]
      ? prop(form, `icd${i + 1}`, 'arzt', `${codes[i]!.icd} ${codes[i]!.certainty}`, 'ICD-10-GM aus der Beschreibung – der Arzt bestätigt.', codes[i]!.evidence, 'm12.diagnosen')
      : prop(form, `icd${i + 1}`, i === 0 ? 'unbekannt' : 'leer', null, i === 0 ? 'Verordnungsrelevante Diagnose als ICD-10-Code (vom Arzt, mit Sicherheit).' : 'Weitere Diagnose nur bei Bedarf.', null, 'm12.diagnosen'))),
    einschr ? prop(form, 'einschraenkungen', 'arzt', einschr, 'Aus der Beschreibung – erklärt, warum HKP nötig ist.', einschr)
      : prop(form, 'einschraenkungen', 'unbekannt', null, 'Einschränkungen angeben, die HKP erforderlich machen (z. B. Sehbehinderung, Tremor, kognitive Einschränkung).'),
    ...pickOne(form, 'art', art, art === 'folge' ? 'Folgeverordnung.' : art === 'erst' ? 'Erstverordnung – höchstens 14 Tage, sofern nicht begründet.' : 'Erst- oder Folgeverordnung wählen.', null),
    checkbox(form, 'unfall', facts.unfall?.evidence ?? null, 'Notwendigkeit infolge eines Unfalls.'),
    checkbox(form, 'ser', facts.versorgungsleiden?.evidence ?? null, 'Anerkannte Schädigungsfolge (SER).'),
    zr.vom ? prop(form, 'vom', 'vorgeschlagen', zr.vom, 'Beginn des Zeitraums.', zr.evidence) : prop(form, 'vom', blanko ? 'leer' : 'unbekannt', null, blanko ? 'Bei reiner Blankoverordnung kein ärztlicher Zeitraum.' : 'Zeitraum angeben (nicht rückwirkend).'),
    zr.bis ? prop(form, 'bis', 'vorgeschlagen', zr.bis, 'Ende des Zeitraums.', zr.evidence, 'm12.zeitraum') : prop(form, 'bis', blanko ? 'leer' : 'unbekannt', null, 'Ende des Zeitraums.', null, 'm12.zeitraum'),
    segment(labeledSegments(text), 'medikation', 'präparate')
      ? prop(form, 'praeparate', 'arzt', segment(labeledSegments(text), 'medikation', 'präparate')!, 'Präparate aus der Beschreibung.', null)
      : prop(form, 'praeparate', l.medigabe || l.medibox || l.injektion ? 'unbekannt' : 'leer', null, l.medigabe || l.medibox || l.injektion ? 'Präparate (oder Medikationsplan als Anlage) angeben.' : 'Nur bei Medikamentengabe.'),
    ...rows.flatMap(([id, ev, pfkAllowed]) => tabelle(id, ev, pfkAllowed, blanko, freq, selected === 1)),
    checkbox(form, 'inj_herrichten', l.injektion ? cue(/\b(herrichten|aufziehen)\b/iu, text) : null, 'Injektion herrichten.'),
    checkbox(form, 'inj_im', l.injektion ? cue(/\b(intramuskulär|i\.\s?m\.)\b/iu, text) : null, 'Intramuskulär.'),
    checkbox(form, 'inj_sc', l.injektion ? cue(/\b(subkutan|s\.\s?c\.|heparin\w*|insulin)\b/iu, text) : null, 'Subkutan.'),
    checkbox(form, 'bz_intensiv', l.bz ? cue(/\b(intensiviert\w*|ict|basis-?bolus)\b/iu, text) : null, 'Bei intensivierter Insulintherapie.', 'm12.blutzucker'),
    checkbox(form, 'k_rechts', l.kstrumpf_an || l.kverband_an ? cue(/\b(rechts|re\.)\b/iu, text) : null, 'Rechts.', 'm12.seite'),
    checkbox(form, 'k_links', l.kstrumpf_an || l.kverband_an ? cue(/\b(links|li\.)\b/iu, text) : null, 'Links.', 'm12.seite'),
    checkbox(form, 'k_beidseits', l.kstrumpf_an || l.kverband_an ? cue(/\b(beidseits|bds\.?|beide beine)\b/iu, text) : null, 'Beidseits.', 'm12.seite'),
    checkbox(form, 'kstrumpf_aus', l.kstrumpf_aus && !cue(/\bnur anziehen\b/iu, text) ? l.kstrumpf_aus : null, 'Kompressionsstrümpfe ausziehen.', 'm12.kompression'),
    checkbox(form, 'kverband_ab', l.kverband_ab, 'Kompressionsverbände abnehmen.', 'm12.kompression'),
    prop(form, 'stuetz_art', l.stuetz ? 'unbekannt' : 'leer', null, l.stuetz ? 'Art des Verbands angeben.' : 'Nur bei stützenden Verbänden.'),
    ...wunde(text, l.wund),
    ...[1, 2].flatMap((i) => [prop(form, `sonst${i}`, 'leer', null, 'Weitere Maßnahme des Leistungsverzeichnisses nur bei Bedarf.', null, 'm12.sonstige'),
      prop(form, `sonst${i}_pfk`, 'leer', false, 'Nur mit einer Maßnahme.'), prop(form, `sonst${i}_hf`, 'leer', null, 'Nur mit einer Maßnahme.'), prop(form, `sonst${i}_dauer`, 'leer', null, 'Nur mit einer Maßnahme.')]),
    l.anleitung ? prop(form, 'anleitung', 'unbekannt', null, 'Leistungen nennen, zu denen angeleitet werden soll.', l.anleitung) : prop(form, 'anleitung', 'leer', null, 'Nur wenn Patient/Angehörige angeleitet werden sollen.'),
    prop(form, 'anleitung_anzahl', l.anleitung ? 'unbekannt' : 'leer', null, l.anleitung ? 'Anzahl der Anleitungen.' : 'Nur mit Anleitung.', null, 'm12.anleitung'),
    prop(form, 'anleitung_pfk', 'leer', false, 'Optional: Häufigkeit/Dauer durch die Pflegefachkraft.', null, 'm12.pflegefachkraft_leistungen'),
    checkbox(form, 'unterstuetzung', l.unterstuetzung, 'Unterstützungspflege (§ 37 Abs. 1a SGB V).', 'm12.unterstuetzungspflege'),
    checkbox(form, 'khvermeidung', l.khvermeidung, 'Krankenhausvermeidungspflege (§ 37 Abs. 1 SGB V).', 'm12.kh_vermeidung'),
    segment(labeledSegments(text), 'hinweis', 'hinweise') ? prop(form, 'hinweise', 'arzt', segment(labeledSegments(text), 'hinweis', 'hinweise')!, 'Aus der Beschreibung.', null)
      : prop(form, 'hinweise', 'arzt', null, 'Freiwillig: weitere Hinweise (z. B. Begründung für längeren Zeitraum, Wundversorgung außer Haus).'),
    stempel(form),
  ];
  return { formId: 'muster-12', fields, generator: 'regelbasiert' };
}

const ROW_LABEL = (id: string) => form.fields.find((f) => f.id === id)?.label ?? id;

function tabellenIssues(values: FormValues): FormIssue[] {
  const out: FormIssue[] = [];
  const blanko = ROWS.some((r) => r.pfk && isChecked(values, `${r.id}_pfk`));
  for (const r of ROWS) {
    const on = r.id.startsWith('sonst') ? Boolean(textOf(values, r.id)) : isChecked(values, r.id);
    const pfk = isChecked(values, `${r.id}_pfk`);
    if (!on) continue;
    if (pfk && (textOf(values, `${r.id}_hf`) || textOf(values, `${r.id}_dauer`))) out.push(issue(form, 'unzulaessig', `${ROW_LABEL(r.id)}: legt die Pflegefachkraft fest, dürfen keine ärztlichen Angaben zu Häufigkeit/Dauer erfolgen.`, [`${r.id}_hf`, `${r.id}_dauer`], 'm12.haeufigkeit_dauer'));
    if (!pfk && !textOf(values, `${r.id}_hf`)) out.push(issue(form, 'fehlt', `${ROW_LABEL(r.id)}: Häufigkeit angeben (tgl./wtl./mtl.).`, [`${r.id}_hf`], 'm12.haeufigkeit_dauer'));
  }
  if (isChecked(values, 'wund_chronisch_pfk')) out.push(issue(form, 'unzulaessig', 'Bei chronischer Wundversorgung legt der Arzt Häufigkeit und Dauer fest.', ['wund_chronisch'], 'm12.wunde_pflegefachkraft'));
  const aerztlich = ROWS.some((r) => (r.id.startsWith('sonst') ? Boolean(textOf(values, r.id)) : isChecked(values, r.id)) && !isChecked(values, `${r.id}_pfk`));
  if (aerztlich && (!textOf(values, 'vom') || !textOf(values, 'bis'))) out.push(issue(form, 'fehlt', 'Zeitraum „vom – bis“ angeben (Maßnahmen mit ärztlich festgelegter Häufigkeit).', ['vom', 'bis'], 'm12.zeitraum'));
  if (!aerztlich && blanko && (textOf(values, 'vom') || textOf(values, 'bis'))) out.push(issue(form, 'hinweis', 'Reine Blankoverordnung: der Zeitraum wird nicht ärztlich festgelegt.', ['vom', 'bis'], 'm12.blanko'));
  return out;
}

function zeitraumIssues(values: FormValues): FormIssue[] {
  const out: FormIssue[] = [];
  const vom = textOf(values, 'vom');
  const bis = textOf(values, 'bis');
  if (!validTTMMJJ(vom) || !validTTMMJJ(bis)) return out;
  const a = fromTTMMJJ(vom);
  const b = fromTTMMJJ(bis);
  const days = Math.round((b.getTime() - a.getTime()) / 86_400_000) + 1;
  const today = new Date(); today.setHours(0, 0, 0, 0);
  if (days < 1) out.push(issue(form, 'unzulaessig', '„bis“ liegt vor „vom“.', ['vom', 'bis'], 'm12.zeitraum'));
  if (a < today && !textOf(values, 'hinweise')) out.push(issue(form, 'fehlt', 'Rückwirkende Verordnung ist grundsätzlich nicht zulässig – Ausnahmefall unter „Weitere Hinweise“ begründen.', ['vom', 'hinweise'], 'm12.zeitraum'));
  if (isChecked(values, 'erst') && days > 14) out.push(issue(form, 'hinweis', `Erstverordnung über ${days} Tage: soll 14 Tage nicht überschreiten; eine längere Dauer muss sich aus Diagnosen und Einschränkungen ergeben.`, ['vom', 'bis'], 'm12.erst_folge'));
  if (isChecked(values, 'bz') && days > 28) out.push(issue(form, 'unzulaessig', `Blutzuckermessung bei Erst-/Neueinstellung höchstens 4 Wochen (verordnet: ${days} Tage).`, ['bz', 'bis'], 'm12.bz_grenze'));
  return out;
}

export function checkMuster12(values: FormValues, facts: PatientFacts): FormIssue[] {
  const out: FormIssue[] = [];
  const add = (i: FormIssue | null) => { if (i) out.push(i); };
  if (facts.arbeitsunfall) add(issue(form, 'unzulaessig', `Arbeitsunfall/Berufskrankheit („${facts.arbeitsunfall.evidence}“): Muster 12 ist dafür nicht zu verwenden.`, [], 'm12.arbeitsunfall'));
  add(exactlyOne(form, values, 'art', 'm12.art'));
  const icds = ['icd1', 'icd2', 'icd3', 'icd4'].filter((id) => textOf(values, id));
  if (!icds.length) add(issue(form, 'fehlt', 'Mindestens eine verordnungsrelevante Diagnose als ICD-10-Code angeben.', ['icd1'], 'm12.diagnosen'));
  for (const id of icds) for (const c of icdCodes(textOf(values, id))) if (!c.certainty) add(issue(form, 'fehlt', `ICD ${c.icd}: Diagnosesicherheit (G/V/A/Z) fehlt – der Arzt ergänzt sie.`, [id], 'm12.diagnosen'));
  if (!textOf(values, 'einschraenkungen')) add(issue(form, 'fehlt', 'Einschränkungen angeben, die häusliche Krankenpflege erforderlich machen.', ['einschraenkungen'], 'm12.einschraenkungen'));
  const any = ROWS.some((r) => (r.id.startsWith('sonst') ? Boolean(textOf(values, r.id)) : isChecked(values, r.id))) || Boolean(textOf(values, 'anleitung')) || isChecked(values, 'bz_intensiv');
  if (!any) add(issue(form, 'fehlt', 'Mindestens eine Maßnahme verordnen.', ['medigabe'], 'm12.behandlungspflege'));
  out.push(...tabellenIssues(values), ...zeitraumIssues(values));
  if ((isChecked(values, 'medigabe') || isChecked(values, 'medibox') || isChecked(values, 'injektion')) && !textOf(values, 'praeparate')) add(issue(form, 'fehlt', 'Medikamentengabe: Präparate angeben (oder Medikationsplan als Anlage).', ['praeparate'], 'm12.medikamentengabe'));
  if (isChecked(values, 'injektion') && !isChecked(values, 'inj_im') && !isChecked(values, 'inj_sc')) add(issue(form, 'fehlt', 'Injektionen: intramuskulär oder subkutan ankreuzen.', ['inj_im', 'inj_sc'], 'm12.medikamentengabe'));
  if (uni(/\b([4-9]|\d{2})\s*x\s*tgl/iu).test(textOf(values, 'bz_hf'))) add(issue(form, 'unzulaessig', 'Blutzuckermessung bei Erst-/Neueinstellung höchstens 3x täglich.', ['bz_hf'], 'm12.bz_grenze'));
  const kompression = ['kstrumpf_an', 'kstrumpf_aus', 'kverband_an', 'kverband_ab'].some((id) => isChecked(values, id));
  if (kompression && !['k_rechts', 'k_links', 'k_beidseits'].some((id) => isChecked(values, id))) add(issue(form, 'fehlt', 'Kompressionsbehandlung: Seite angeben (rechts, links, beidseits).', ['k_rechts', 'k_links', 'k_beidseits'], 'm12.seite'));
  if (isChecked(values, 'stuetz') && !textOf(values, 'stuetz_art')) add(issue(form, 'fehlt', 'Stützende/stabilisierende Verbände: Art angeben.', ['stuetz_art'], 'm12.kompression'));
  if (isChecked(values, 'wund_akut') || isChecked(values, 'wund_chronisch')) {
    for (const id of ['wundart', 'lokalisation', 'groesse']) if (!textOf(values, id)) add(issue(form, 'fehlt', `Wundversorgung: ${ROW_LABEL(id)} angeben.`, [id], 'm12.wundversorgung'));
    if (!textOf(values, 'verbandmaterial')) add(issue(form, 'fehlt', 'Wundversorgung: Präparate/Verbandmaterial angeben (oder als Anlage).', ['verbandmaterial'], 'm12.wundversorgung'));
    if (uni(/dekubitus/iu).test(textOf(values, 'wundart')) && !textOf(values, 'grad')) add(issue(form, 'fehlt', 'Dekubitus: aktuellen Grad angeben.', ['grad'], 'm12.wundversorgung'));
  }
  const gp = isChecked(values, 'grundpflege');
  const hw = isChecked(values, 'hauswirtschaft');
  if ((gp || hw) && !isChecked(values, 'unterstuetzung') && !isChecked(values, 'khvermeidung')) add(issue(form, 'fehlt', 'Grundpflege/Hauswirtschaft nur im Rahmen der Unterstützungs- oder Krankenhausvermeidungspflege (bei Sicherungspflege nur nach Satzung der Kasse) – Rahmen ankreuzen.', ['unterstuetzung', 'khvermeidung'], 'm12.grundpflege_hauswirtschaft'));
  if (isChecked(values, 'unterstuetzung') && hw && !gp) add(issue(form, 'unzulaessig', 'Unterstützungspflege: hauswirtschaftliche Versorgung nur zusammen mit Grundpflege.', ['hauswirtschaft', 'grundpflege'], 'm12.unterstuetzung_angabe'));
  if (isChecked(values, 'unterstuetzung') && facts.pflegegrad && facts.pflegegrad.value >= 2) add(issue(form, 'unzulaessig', `Unterstützungspflege nicht bei Pflegegrad ${facts.pflegegrad.value} (nur ohne Pflegegrad 2–5).`, ['unterstuetzung'], 'm12.unterstuetzungspflege'));
  if (isChecked(values, 'unterstuetzung') || isChecked(values, 'khvermeidung')) add(issue(form, 'hinweis', 'Anspruch bis zu vier Wochen je Krankheitsfall; Verlängerung nur durch die Kasse nach Einschaltung des MD.', ['unterstuetzung', 'khvermeidung'], 'm12.unterstuetzungspflege'));
  if (textOf(values, 'anleitung') && !textOf(values, 'anleitung_anzahl')) add(issue(form, 'fehlt', 'Anleitung: Anzahl angeben.', ['anleitung_anzahl'], 'm12.anleitung'));
  add(issue(form, 'hinweis', 'Nicht zulässig, wenn der Patient oder eine Person im Haushalt die Maßnahmen selbst durchführen kann.', [], 'm12.nicht_zulaessig'));
  add(issue(form, 'hinweis', 'Genehmigung durch die Kasse: Kosten bis zur Entscheidung, wenn die Verordnung spätestens am vierten Arbeitstag nach Ausstellung vorgelegt wird.', [], 'm12.genehmigung'));
  out.push(...formatIssues(form, values));
  return out;
}
