import { isChecked, issue, prop, textOf, validTTMMJJ } from './build.js';
import { getForm } from './catalog.js';
import { checkGeneric, proposeGeneric, type GenericSpec } from './generic.js';
import { SPEC_08, SPEC_08A } from './muster08.js';
import { SPEC_15 } from './muster15.js';
import { SPEC_16 } from './muster16.js';
import { SPEC_25 } from './muster25.js';
import { SPEC_39 } from './muster39.js';
import { SPEC_56 } from './muster56.js';
import { SPEC_62B } from './muster62b.js';
import { SPEC_62C } from './muster62c.js';
import { cue, fromTTMMJJ, periodIn, toTTMMJJ, ttmmjj, uni } from './text.js';
import type { FormId, FormIssue, FormProposal, FormValues, PatientFacts } from './types.js';

/**
 * Weitere Vordrucke auf der allgemeinen Ausfüllhilfe (generic.ts): Stichwörter für den Vorschlag, Pflichtfelder und
 * vordruckeigene Prüfungen. Felddaten und Regeln mit Fundstelle stehen in data/forms/muster-NN.json.
 */

export type WeitereId = 'muster-03' | 'muster-05' | 'muster-07' | 'muster-08' | 'muster-08a' | 'muster-11' | 'muster-15' | 'muster-16' | 'muster-22' | 'muster-25'
  | 'muster-28' | 'muster-36' | 'muster-39' | 'muster-50' | 'muster-51' | 'muster-53' | 'muster-56' | 'muster-62a' | 'muster-62b' | 'muster-62c'
  | 'muster-70' | 'muster-70a' | 'muster-85' | 'muster-86';

interface Weiterer extends GenericSpec {
  /** Wann der Vordruck gewünscht ist (Wunsch-Teil der Beschreibung). */
  intent: RegExp;
}

/** Datum direkt nach einem Stichwort, auch mit Zwischenwörtern („ET am 12.03.2027“). */
function dateAfterWord(word: string, text: string, today: Date): { value: string | null; evidence: string } | null {
  const m = uni(new RegExp(String.raw`\b(?:${word})\b\D{0,20}?(\d{1,2})\.(\d{1,2})\.(\d{4}|\d{2})?`, 'iu')).exec(text);
  return m ? { value: toTTMMJJ(m[1]!, m[2]!, m[3] ?? String(today.getFullYear())), evidence: m[0] } : null;
}

const both = (form: FormId, a: string, b: string, text: string, rule: string | null = null) => (values: FormValues): FormIssue[] =>
  isChecked(values, a) && isChecked(values, b) ? [issue(getForm(form), 'unzulaessig', text, [a, b], rule ?? getForm(form).fields.find((f) => f.id === a)?.rules[0]?.id ?? null)] : [];

const SPECS: Record<WeitereId, Weiterer> = {
  'muster-03': {
    intent: /\b(mutmaßliche\w* (?:tag der )?entbindung|entbindungstermin\w*|zeugnis über den mutmaßlichen|mutterschutzfrist\w*|muster\s*3)\b/iu,
    required: ['entbindung_am', 'untersuchung_am'],
    text: { feststellungen: ['befund', 'befunde', 'hinweise', 'hinweis'] },
    propose: (text, _f, today) => {
      const form = getForm('muster-03');
      const et = dateAfterWord('entbindungstermin|errechnete\\w* termin|et|entbindung|geburtstermin', text, today);
      return [
        et?.value ? prop(form, 'entbindung_am', 'arzt', et.value, 'Mutmaßlicher Tag der Entbindung – der Arzt bestätigt.', et.evidence) : prop(form, 'entbindung_am', 'unbekannt', null, 'Mutmaßlichen Tag der Entbindung eintragen (TTMMJJ).'),
        prop(form, 'untersuchung_am', 'vorgeschlagen', ttmmjj(today), 'Tag der eigenen Untersuchung (heute).'),
      ];
    },
    extra: (v) => {
      const a = textOf(v, 'untersuchung_am');
      const b = textOf(v, 'entbindung_am');
      return validTTMMJJ(a) && validTTMMJJ(b) && fromTTMMJJ(b) <= fromTTMMJJ(a)
        ? [issue(getForm('muster-03'), 'unzulaessig', 'Der mutmaßliche Entbindungstag liegt nicht nach dem Untersuchungstag.', ['entbindung_am'], 'm03.daten')] : [];
    },
  },
  'muster-05': {
    intent: /\b(abrechnungsschein|muster\s*5)\b/iu,
    required: ['quartal', 'diagnose1'],
    check: { belegaerztlich: /\bbeleg(?:arzt|ärztlich)\w*/iu, konsiliar: /\babklärung somatischer ursachen\b/iu, psychotherapie: /\banerkannte\w* psychotherapie\b/iu },
    propose: (text) => {
      const form = getForm('muster-05');
      const beleg = cue(/\bbeleg(?:arzt|ärztlich)\w*/iu, text);
      return [prop(form, beleg ? 'belegaerztlich' : 'ambulant', 'vorgeschlagen', true, beleg ? 'Belegärztliche Behandlung.' : 'Ambulante Behandlung.', beleg ?? null),
        prop(form, beleg ? 'ambulant' : 'belegaerztlich', 'leer', false, 'Nicht zutreffend.'),
        prop(form, 'leistungen_links', 'leer', null, 'Gebührenordnungspositionen trägt die Praxis über das PVS ein – die Formularhilfe schlägt keine Abrechnungsziffern vor.'),
        prop(form, 'leistungen_rechts', 'leer', null, 'Gebührenordnungspositionen über das PVS.')];
    },
  },
  'muster-07': {
    intent: /\b(muster\s*7|abklärung somatischer ursachen|somatische\w* abklärung|konsiliarüberweisung)\b/iu,
    required: ['diagnosen'],
    text: { diagnosen: ['diagnose', 'indikation'], information: ['befund', 'befunde', 'hinweise', 'hinweis', 'fragestellung'] },
  },
  'muster-08': {
    intent: /\b(brille\w*|sehhilfe\w*|kontaktlinse\w*|brillengläser|muster\s*8)\b/iu,
    ...SPEC_08,
  },
  'muster-08a': {
    intent: /\b(vergrößernde\w* sehhilfe\w*|lupe\w*|lupenbrille\w*|fernrohrbrille\w*|bildschirmlesegerät\w*|muster\s*8\s*a)\b/iu,
    ...SPEC_08A,
  },
  'muster-11': {
    intent: /\b(bericht für den (?:medizinischen dienst|md|mdk)|md-?bericht|mdk-?bericht|anfrage (?:des|vom) (?:md|mdk)|muster\s*11)\b/iu,
    required: ['diagnose', 'befunde'],
    text: { befunde: ['befund', 'befunde'], besondere_hinweise: ['hinweise', 'hinweis'] },
    check: { beigefuegt_ekg: /\bekg\b/iu, beigefuegt_labor: /\blabor\w*/iu, beigefuegt_roentgen: /\b(röntgen\w*|mrt|ct)\b/iu, beigefuegt_ultraschall: /\b(ultraschall\w*|sonographie|sonografie)\b/iu, beigefuegt_bericht: /\b(arztbrief\w*|entlassungsbericht\w*|krankenhausbericht\w*)\b/iu },
    extra: both('muster-11', 'mitbehandlung_ja', 'mitbehandlung_nein', 'Mitbehandlung: entweder ja oder nein.'),
  },
  'muster-15': {
    intent: /\b(hörgerät\w*|hörhilfe\w*|hörsystem\w*|tinnitusmasker|tinnitusinstrument|muster\s*15)\b/iu,
    ...SPEC_15,
  },
  'muster-16': {
    intent: /\b(kassenrezept|rosa rezept|arzneiverordnungsblatt|muster\s*16|rezept (?:für|über))\b/iu,
    ...SPEC_16,
  },
  'muster-22': {
    intent: /\b(konsiliarbericht\w*|muster\s*22)\b/iu,
    required: ['bericht'],
    text: { bericht: ['befund', 'befunde', 'anamnese'], massnahmen: ['maßnahmen'] },
    oneOf: [{ ids: ['psych_erforderlich', 'psych_nicht_erforderlich', 'psych_erfolgt', 'psych_veranlasst'], text: 'Psychiatrische bzw. kinder- und jugendpsychiatrische Abklärung: zutreffendes ankreuzen.' }],
  },
  'muster-25': {
    intent: /\b(ambulante\w* vorsorge\w* (?:in|im) (?:einem |anerkannten )?kurort\w*|badekur|kurarzt\w*|kur (?:in|im) (?:einem )?kurort|muster\s*25)\b/iu,
    ...SPEC_25,
  },
  'muster-28': {
    intent: /\b(indikationsstellung (?:für )?soziotherapie|überweisung zur soziotherapie|muster\s*28)\b/iu,
    required: ['diagnose'],
    check: { kh_vermieden: /\bvermieden|vermeiden\b/iu, kh_verkuerzt: /\bverkürz\w*/iu, kh_nicht_ausfuehrbar: /\bnicht ausführbar\b/iu },
    oneOf: [{ ids: ['kh_vermieden', 'kh_verkuerzt', 'kh_nicht_ausfuehrbar'], text: 'Krankenhausbehandlung: vermieden, verkürzt oder nicht ausführbar ankreuzen.' }],
  },
  'muster-36': {
    intent: /\b(präventionsempfehlung|primärprävention|präventionskurs\w*|muster\s*36)\b/iu,
    check: { bewegung: /\b(bewegung\w*|sport\w*|rückenschule)\b/iu, ernaehrung: /\b(ernährung\w*|abnehmen|übergewicht\w*|gewichtsreduktion)\b/iu, stress: /\b(stress\w*|entspannung\w*)\b/iu, sucht: /\b(rauch\w*|nikotin\w*|alkohol\w*|sucht\w*)\b/iu },
    text: { hinweise: ['hinweise', 'hinweis'] },
    oneOf: [{ ids: ['bewegung', 'ernaehrung', 'stress', 'sucht', 'sonstiges'], text: 'Mindestens ein Handlungsfeld ankreuzen oder unter „Sonstiges“ angeben.' }],
  },
  'muster-39': {
    intent: /\b(zervix\w*|pap-?abstrich\w*|ko-?test\w*|hpv-?test\w*|gebärmutterhalskrebs\w*|muster\s*39)\b/iu,
    ...SPEC_39,
  },
  'muster-50': { intent: /\b(zuständigkeit einer anderen krankenkasse|anfrage (?:zum|wegen) kassenwechsel|muster\s*50)\b/iu },
  'muster-51': { intent: /\b(zuständigkeit eines sonstigen kostenträgers|muster\s*51)\b/iu },
  'muster-53': {
    intent: /\b(zusammenhang von (?:au|arbeitsunfähigkeits)\w*|vorerkrankung\w*anfrage|dieselbe krankheit|muster\s*53)\b/iu,
    extra: (v) => (isChecked(v, 'dieselbe_ja') && !textOf(v, 'dieselbe_ziffern')
      ? [issue(getForm('muster-53'), 'fehlt', '„Dieselbe Krankheit – ja“: Ziffer(n) der betreffenden Krankheiten angeben.', ['dieselbe_ziffern'], null)] : []),
  },
  'muster-56': {
    intent: /\b(rehasport\w*|rehabilitationssport\w*|funktionstraining\w*|herzsport\w*|herzgruppe\w*|muster\s*56)\b/iu,
    ...SPEC_56,
  },
  'muster-62a': {
    intent: /\b(beatmungsentwöhnung\w*|dekanülierung\w*|potenzialerhebung|weaning-?potenzial|muster\s*62\s*a)\b/iu,
    required: ['datum_erhebung'],
    text: { massnahmen: ['maßnahmen'], begruendung: ['begründung'], erlaeuterungen: ['hinweise', 'hinweis'] },
    oneOf: [{ ids: ['vor_beatmung', 'vor_dekanuelierung', 'persp_beatmung', 'persp_dekanuelierung', 'nicht_beatmung', 'nicht_dekanuelierung'], text: 'Ergebnis ankreuzen: Potenzial liegt vor, kann perspektivisch vorliegen oder liegt nicht vor.' }],
  },
  'muster-62b': {
    intent: /\b(außerklinische\w* intensivpflege|aki-?verordnung|intensivpflege\w*|muster\s*62\s*b)\b/iu,
    ...SPEC_62B,
  },
  'muster-62c': {
    intent: /\b(behandlungsplan (?:für die )?(?:außerklinische\w* )?intensivpflege|aki-?behandlungsplan|muster\s*62\s*c)\b/iu,
    ...SPEC_62C,
  },
  'muster-70': {
    intent: /\b(künstliche\w* befruchtung|kinderwunschbehandlung|ivf|icsi|insemination|muster\s*70)\b/iu,
    required: ['indikation'],
    text: { indikation: ['indikation', 'indikationen', 'diagnose'] },
    check: { ivf: /\bivf\b|in-vitro-fertilisation/iu, icsi: /\bicsi\b/iu, insem_spontan: /\binsemination im spontanzyklus\b/iu, insem_stimulation: /\binsemination nach (?:hormoneller )?stimulation\b/iu, gift: /\bgift\b|gameten-?transfer/iu },
    oneOf: [{ ids: ['insem_spontan', 'insem_stimulation', 'ivf', 'gift', 'icsi'], text: 'Geplante Behandlungsmaßnahme ankreuzen.' }],
  },
  'muster-70a': {
    intent: /\b(folge-?behandlungsplan|muster\s*70\s*a)\b/iu,
    required: ['indikation', 'vorplan_datum'],
    text: { indikation: ['indikation', 'indikationen', 'diagnose'] },
    check: { ivf: /\bivf\b|in-vitro-fertilisation/iu, icsi: /\bicsi\b/iu, gift: /\bgift\b|gameten-?transfer/iu },
    oneOf: [{ ids: ['insem_spontan', 'insem_stimulation', 'ivf', 'gift', 'icsi'], text: 'Geplante Behandlungsmaßnahme ankreuzen.' }],
  },
  'muster-85': { intent: /\b(ruhen des (?:leistungs)?anspruchs|ruhende\w* anspruch|muster\s*85)\b/iu },
  'muster-86': { intent: /\b(weiterleitungsbogen|muster\s*86)\b/iu },
};

export const WEITERE_IDS = Object.keys(SPECS) as WeitereId[];

export const isWeitere = (id: FormId): id is WeitereId => id in SPECS;

/** Weitere Vordrucke, deren Stichwort im Wunsch vorkommt (Reihenfolge: genauere zuerst, z. B. 8A vor 8, 70A vor 70). */
export function weitereIntents(head: string): { formId: WeitereId; evidence: string }[] {
  const out: { formId: WeitereId; evidence: string }[] = [];
  for (const id of WEITERE_IDS) {
    const ev = cue(SPECS[id].intent, head);
    if (ev) out.push({ formId: id, evidence: ev });
  }
  const has = (id: WeitereId) => out.some((o) => o.formId === id);
  const drop = (id: WeitereId) => { const i = out.findIndex((o) => o.formId === id); if (i >= 0) out.splice(i, 1); };
  if (has('muster-08a')) drop('muster-08');
  if (has('muster-70a')) drop('muster-70');
  if (has('muster-62c') && has('muster-62b') && !cue(/\bverordnung\b/iu, head)) drop('muster-62b');
  return out;
}

export function proposeWeitere(id: WeitereId, text: string, facts: PatientFacts, today: Date): FormProposal {
  return { formId: id, fields: proposeGeneric(getForm(id), text, facts, today, SPECS[id]), generator: 'regelbasiert' };
}

export function checkWeitere(id: WeitereId, values: FormValues, facts: PatientFacts): FormIssue[] {
  return checkGeneric(getForm(id), values, facts, SPECS[id]);
}

