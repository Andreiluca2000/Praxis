import { isChecked, issue, prop, textOf, validTTMMJJ } from './build.js';
import { getForm } from './catalog.js';
import type { GenericSpec } from './generic.js';
import { cue, fromTTMMJJ, periodIn, toTTMMJJ, uni } from './text.js';
import type { FieldProposal, FormIssue, FormValues } from './types.js';

/**
 * Muster 62B – Verordnung außerklinischer Intensivpflege (AKI-RL, Stand 1.2023). Erläuterungen 01/2026, S. 123–127.
 * Fachregeln: Potenzialerhebung (Muster 62A, höchstens 3 Monate alt) bei Beatmung/Trachealkanüle, Erstverordnung bis 5 Wochen,
 * Folgeverordnung bis 6 (bzw. 12) Monate, nicht rückwirkend, Leistungsumfang bis 24 Stunden, klinischer Status vollständig.
 */
const form = () => getForm('muster-62b');
const ERST_TAGE = 35;
const FOLGE_TAGE = 183;
const FOLGE_TAGE_OHNE_POTENZIAL = 366;
const ERHEBUNG_TAGE = 92;
const STUNDEN_MAX = 24;
const TAG_MS = 86_400_000;

const days = (a: Date, b: Date) => Math.round((b.getTime() - a.getTime()) / TAG_MS) + 1;

export const SPEC_62B: GenericSpec = {
  required: ['diagnose_1', 'vom', 'bis', 'stunden_je_tag'],
  check: {
    erstverordnung: /\berstverordnung\b/iu,
    folgeverordnung: /\bfolgeverordnung\b/iu,
    absaugpflicht: /\b(absaug\w*)\b/iu,
    entfall_erhebung: /\b(erhebung entfällt|zweimal (?:in folge )?kein potenzial)\b/iu,
  },
  oneOf: [{ ids: ['erstverordnung', 'folgeverordnung'], text: 'Erst- oder Folgeverordnung ankreuzen.' }],
  propose: (text, _facts, today) => {
    const f = form();
    const out: FieldProposal[] = [];
    const zr = periodIn(text, today);
    const ev = zr.evidence.join(', ') || null;
    out.push(zr.vom ? prop(f, 'vom', 'vorgeschlagen', zr.vom, 'Beginn des Verordnungszeitraums (nicht rückwirkend).', ev, 'm62b.zeitraum') : prop(f, 'vom', 'unbekannt', null, 'Verordnungszeitraum: Beginn angeben.', null, 'm62b.zeitraum'),
      zr.bis ? prop(f, 'bis', 'vorgeschlagen', zr.bis, 'Ende des Verordnungszeitraums.', ev, 'm62b.zeitraum') : prop(f, 'bis', 'unbekannt', null, 'Verordnungszeitraum: Ende angeben.', null, 'm62b.zeitraum'));
    const niv = cue(/\b(niv|nicht[- ]invasiv\w*|masken?beatmung|cpap|bipap)\b/iu, text);
    const inv = niv ? null : cue(/\b(invasiv\w*|tracheostomie-?beatmung|über (?:die )?kanüle beatmet)\b/iu, text);
    const beatmet = niv ?? inv ?? cue(/\b(beatmet|beatmung\w*|heimbeatmung)\b/iu, text);
    if (beatmet) {
      out.push(prop(f, 'beatmung', 'vorgeschlagen', true, 'Beatmung.', beatmet, 'm62b.klinischer_status'));
      if (inv) out.push(prop(f, 'form_invasiv', 'vorgeschlagen', true, 'Invasive Beatmung.', inv, 'm62b.klinischer_status'));
      if (niv) out.push(prop(f, 'form_nicht_invasiv', 'vorgeschlagen', true, 'Nicht invasive Beatmung – Maskentyp angeben.', niv, 'm62b.klinischer_status'));
    }
    const tracheo = cue(/\b(tracheostoma|trachealkanüle\w*|tracheotomiert)\b/iu, text);
    if (tracheo) out.push(prop(f, 'tracheostoma', 'vorgeschlagen', true, 'Tracheostoma.', tracheo, 'm62b.klinischer_status'));
    const std = uni(/\b(\d{1,2})\s*(?:h|std\.?|stunden)\s*(?:\/|pro|je|am)?\s*(?:tag|täglich|tgl\.?)\b|\brund um die uhr\b|\b24\s*\/\s*7\b/iu).exec(text);
    if (std) out.push(prop(f, 'stunden_je_tag', 'arzt', std[1] ?? String(STUNDEN_MAX), 'Täglich erforderliche Stunden mit ständiger Anwesenheit einer Pflegefachkraft.', std[0], 'm62b.leistungsumfang'));
    const erhebung = uni(/\b(?:potenzialerhebung|muster\s*62\s*a|erhebung)\b\D{0,15}?(\d{1,2})\.(\d{1,2})\.(\d{4}|\d{2})\b/iu).exec(text);
    if (erhebung) out.push(prop(f, 'erlaeuterungen', 'vorgeschlagen', `Potenzialerhebung (Muster 62A) vom ${erhebung[1]}.${erhebung[2]}.${erhebung[3]}`, 'Datum der Potenzialerhebung – die Verordnung setzt eine höchstens 3 Monate alte Erhebung voraus.', erhebung[0], 'm62b.potenzialerhebung'));
    return out;
  },
  extra: (v: FormValues) => {
    const f = form();
    const out: FormIssue[] = [];
    const add = (level: FormIssue['level'], text: string, ids: string[], rule: string) => out.push(issue(f, level, text, ids, rule));
    const on = (id: string) => isChecked(v, id);
    if (on('erstverordnung') && on('folgeverordnung')) add('unzulaessig', 'Entweder Erst- oder Folgeverordnung.', ['erstverordnung', 'folgeverordnung'], 'm62b.erst_folge');
    const vom = textOf(v, 'vom');
    const bis = textOf(v, 'bis');
    if (validTTMMJJ(vom) && validTTMMJJ(bis)) {
      const d = days(fromTTMMJJ(vom), fromTTMMJJ(bis));
      if (d < 1) add('unzulaessig', '„bis“ liegt vor „vom“.', ['vom', 'bis'], 'm62b.zeitraum');
      else if (on('erstverordnung') && d > ERST_TAGE) add('hinweis', `Erstverordnung über ${d} Tage: soll 5 Wochen nicht überschreiten.`, ['bis'], 'm62b.erst_folge');
      else if (on('folgeverordnung')) {
        const max = on('entfall_erhebung') ? FOLGE_TAGE_OHNE_POTENZIAL : FOLGE_TAGE;
        if (d > max) add('unzulaessig', `Folgeverordnung über ${d} Tage: längstens ${on('entfall_erhebung') ? '12' : '6'} Monate.`, ['bis'], 'm62b.folgeverordnung_dauer');
      }
      const heute = new Date();
      heute.setHours(0, 0, 0, 0);
      if (fromTTMMJJ(vom) < heute && !textOf(v, 'erlaeuterungen')) add('fehlt', 'Rückwirkende Verordnung ist grundsätzlich nicht zulässig – Ausnahme unter „Weitere Erläuterungen“ begründen.', ['vom', 'erlaeuterungen'], 'm62b.zeitraum');
    }
    const std = textOf(v, 'stunden_je_tag');
    if (std && Number(std) > STUNDEN_MAX) add('unzulaessig', `Leistungsumfang: höchstens ${STUNDEN_MAX} Stunden je Tag.`, ['stunden_je_tag'], 'm62b.leistungsumfang');
    const kanuele = on('tracheostoma');
    const beatmet = on('beatmung');
    if (beatmet) {
      if (!textOf(v, 'beatmung_seit')) add('fehlt', 'Beatmung: seit wann (TTMMJJ)?', ['beatmung_seit'], 'm62b.klinischer_status');
      if (!on('form_invasiv') && !on('form_nicht_invasiv')) add('fehlt', 'Beatmungsform ankreuzen (invasiv oder nicht invasiv).', ['form_invasiv', 'form_nicht_invasiv'], 'm62b.klinischer_status');
      if (on('form_nicht_invasiv') && !textOf(v, 'maskentyp')) add('fehlt', 'Nicht invasive Beatmung: Maskentyp angeben.', ['maskentyp'], 'm62b.klinischer_status');
      const sum = ['dauer_tag', 'dauer_nacht', 'spontan_tag', 'spontan_nacht'].reduce((s, id) => s + (Number(textOf(v, id).replace(',', '.')) || 0), 0);
      if (sum > STUNDEN_MAX) add('unzulaessig', `Beatmungs- und Spontanatmungszeiten ergeben zusammen ${sum} Stunden (höchstens 24).`, ['dauer_tag', 'dauer_nacht', 'spontan_tag', 'spontan_nacht'], 'm62b.klinischer_status');
    }
    if (kanuele && !textOf(v, 'tracheostoma_seit')) add('fehlt', 'Tracheostoma: seit wann (TTMMJJ)?', ['tracheostoma_seit'], 'm62b.klinischer_status');
    if (on('absaugpflicht') && !textOf(v, 'absaugfrequenz')) add('fehlt', 'Absaugpflicht: durchschnittliche tägliche Absaugfrequenz angeben.', ['absaugfrequenz'], 'm62b.klinischer_status');
    if (beatmet || kanuele) {
      add('hinweis', 'Beatmet bzw. trachealkanüliert: Verordnung nur mit aktueller Potenzialerhebung (Muster 62A), bei Verordnung höchstens 3 Monate alt.', [], 'm62b.potenzialerhebung');
      const m = uni(/(\d{2})\.(\d{2})\.(\d{4}|\d{2})/u).exec(textOf(v, 'erlaeuterungen'));
      const erhoben = m ? toTTMMJJ(m[1]!, m[2]!, m[3]!) : null;
      if (erhoben && validTTMMJJ(vom) && days(fromTTMMJJ(erhoben), fromTTMMJJ(vom)) > ERHEBUNG_TAGE) add('unzulaessig', 'Die Potenzialerhebung ist bei Verordnungsbeginn älter als 3 Monate.', ['erlaeuterungen'], 'm62b.potenzialerhebung');
      if (!['opt_angezeigt', 'opt_nicht_angezeigt', 'opt_abgelehnt'].some(on)) add('fehlt', 'Ankreuzen, ob Erhebungen zur Therapieoptimierung (Muster 62A) weiter angezeigt sind.', ['opt_angezeigt', 'opt_nicht_angezeigt', 'opt_abgelehnt'], 'm62b.therapieoptimierung');
    } else if (!textOf(v, 'konsilpartner')) {
      add('hinweis', 'Weder beatmet noch trachealkanüliert: AKI verordnen grundsätzlich spezialisierte Fachärzte; sonst Konsilpartner angeben.', ['konsilpartner'], 'm62b.konsilpartner');
    }
    for (const [ids, label] of [[['mitwirkung_uneingeschraenkt', 'mitwirkung_eingeschraenkt', 'mitwirkung_nicht_moeglich'], 'Mitwirkung bei AKI'], [['kommunikation_uneingeschraenkt', 'kommunikation_eingeschraenkt', 'kommunikation_nicht_moeglich'], 'Kommunikation/Verständigung'], [['ernaehrung_ja', 'ernaehrung_teilweise', 'ernaehrung_nein'], 'Orale Ernährung']] as const) {
      const n = ids.filter(on).length;
      if (n === 0) add('fehlt', `${label}: zutreffende Angabe ankreuzen.`, [...ids], 'm62b.klinischer_status');
      if (n > 1) add('unzulaessig', `${label}: nur eine Angabe ankreuzen.`, ids.filter(on), 'm62b.klinischer_status');
    }
    return out;
  },
};
