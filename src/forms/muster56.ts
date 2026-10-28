import { isChecked, issue, prop, textOf } from './build.js';
import { getForm } from './catalog.js';
import type { GenericSpec } from './generic.js';
import { cue, uni } from './text.js';
import type { FieldProposal, FormIssue, FormValues } from './types.js';

/**
 * Muster 56 – Antrag auf Kostenübernahme für Rehabilitationssport / Funktionstraining (Stand 1.2023, BAR-Rahmenvereinbarung).
 * Erläuterungen 01/2026, S. 95–101. Fachregeln: Art, Sportart bzw. Trocken-/Wassergymnastik, Umfang nach Richtwerten,
 * Wochenfrequenz (höchstens drei, ab drei mit Begründung), Herzgruppe mit Umfang, Folgeverordnung mit Begründung.
 */
const form = () => getForm('muster-56');
const SPORTART = ['sport_gymnastik', 'sport_schwimmen', 'sport_ausdauer', 'sport_bewegungsspiele', 'sport_sonstige'] as const;
const SPORT_UMFANG = ['sport_50', 'sport_120', 'sport_28', 'sport_laenger'] as const;
const FT_DAUER = ['ft_12', 'ft_24', 'ft_laenger'] as const;
const HERZ_UMFANG = ['herz_erst', 'herz_folge', 'herz_kinder'] as const;
const WOCHE = { sport: ['woche_sport_1', 'woche_sport_2', 'woche_sport_3'], trocken: ['woche_trocken_1', 'woche_trocken_2', 'woche_trocken_3'], wasser: ['woche_wasser_1', 'woche_wasser_2', 'woche_wasser_3'] } as const;
const MAX_PRO_WOCHE = 3;
const RHEUMA = /\b(rheumatoide\w* arthritis|chronische\w* polyarthritis|morbus bechterew|spondylitis ankylosans|spondyloarthritis|psoriasis-?arthritis|kollagenose\w*|lupus|vaskulitis)\b/iu;

const anzahl = (ids: readonly string[], v: FormValues) => ids.filter((id) => isChecked(v, id));
const pro = (ids: readonly string[], v: FormValues) => ids.reduce((sum, id, i) => sum + (isChecked(v, id) ? i + 1 : 0), 0);

export const SPEC_56: GenericSpec = {
  required: ['diagnose1', 'icd1', 'ziel'],
  text: { ziel: ['ziel', 'ziele', 'therapieziele', 'therapieziel'], schaedigung: ['befund', 'befunde', 'einschränkungen', 'funktionseinschränkungen'] },
  check: {
    teilhabebedarf: /\b(blind\w*|doppelamputation|querschnitt\w*|hirnverletz\w*|schwere\w* lähmung\w*)\b/iu,
    folgeverordnung: /\bfolgeverordnung\b/iu,
    herzinsuffizienzgruppe: /\bherzinsuffizienzgruppe\b/iu,
  },
  propose: (text) => {
    const f = form();
    const ft = cue(/\bfunktionstraining\w*/iu, text);
    const herz = cue(/\b(herzsport\w*|herzgruppe\w*|koronar\w*|nach (?:herz)?infarkt|kardiolog\w*)\b/iu, text);
    const out: FieldProposal[] = [
      prop(f, ft ? 'funktionstraining' : 'reha_sport', 'vorgeschlagen', true, ft ? 'Funktionstraining.' : 'Rehabilitationssport.', ft ?? cue(/\b(reha-?sport\w*|rehabilitationssport\w*|herzsport\w*|herzgruppe\w*)\b/iu, text)),
      prop(f, ft ? 'reha_sport' : 'funktionstraining', 'leer', false, 'Rehabilitationssport und Funktionstraining nicht auf einem Vordruck.', null, 'm56.auswahl'),
    ];
    const freq = uni(/\b([123])\s*x\s*(?:\/|pro|in der|je)?\s*woche\w*|\b([123])\s*x\s*wöchentlich\b/iu).exec(text);
    const n = freq ? Number(freq[1] ?? freq[2]) : null;
    if (ft) {
      const wasser = cue(/\b(wasser\w*|bewegungsbad|aqua\w*)\b/iu, text);
      const trocken = cue(/\btrocken\w*/iu, text) ?? (wasser ? null : ft);
      const rheuma = cue(RHEUMA, text);
      out.push(prop(f, 'ft_wasser', wasser ? 'vorgeschlagen' : 'leer', Boolean(wasser), wasser ? 'Wassergymnastik.' : 'Nicht gewählt.', wasser),
        prop(f, 'ft_trocken', trocken ? 'vorgeschlagen' : 'leer', Boolean(trocken), trocken ? 'Trockengymnastik.' : 'Nicht gewählt.', trocken),
        prop(f, rheuma ? 'ft_24' : 'ft_12', 'vorgeschlagen', true, rheuma ? 'Chronisch entzündlich rheumatische Erkrankung: Richtwert 24 Monate.' : 'Richtwert 12 Monate.', rheuma ?? ft, 'm56.funktionstraining_dauer'));
      if (n) out.push(prop(f, `woche_${wasser ? 'wasser' : 'trocken'}_${n}`, 'vorgeschlagen', true, `${n}x wöchentlich.`, freq![0], 'm56.wochenfrequenz'));
    } else if (herz) {
      out.push(prop(f, 'herzgruppe', 'vorgeschlagen', true, 'Herzgruppe (Visite mindestens alle sechs Wochen).', herz, 'm56.herzgruppe'),
        prop(f, cue(/\bfolgeverordnung\b/iu, text) ? 'herz_folge' : 'herz_erst', 'vorgeschlagen', true, cue(/\bfolgeverordnung\b/iu, text) ? 'Folgeverordnung: 45 Einheiten in 12 Monaten.' : 'Erstverordnung: 90 Einheiten in 24 Monaten.', herz, 'm56.herzgruppe_umfang'));
      if (n) out.push(prop(f, `woche_sport_${n}`, 'vorgeschlagen', true, `${n}x wöchentlich.`, freq![0], 'm56.wochenfrequenz'));
    } else {
      const art: [string, RegExp][] = [['sport_schwimmen', /\bschwimm\w*/iu], ['sport_ausdauer', /\b(ausdauer\w*|kraftausdauer\w*)\b/iu], ['sport_bewegungsspiele', /\bbewegungsspiel\w*/iu], ['sport_gymnastik', /\b(gymnastik|wassergymnastik)\b/iu]];
      const hit = art.find(([, re]) => cue(re, text));
      if (hit) out.push(prop(f, hit[0], 'vorgeschlagen', true, 'Rehabilitationssportart aus der Beschreibung (nur eine Art).', cue(hit[1], text), 'm56.sportart'));
      out.push(prop(f, 'sport_50', 'vorgeschlagen', true, 'Richtwert: 50 Übungseinheiten in 18 Monaten.', null, 'm56.uebungseinheiten'));
      if (n) out.push(prop(f, `woche_sport_${n}`, 'vorgeschlagen', true, `${n}x wöchentlich.`, freq![0], 'm56.wochenfrequenz'));
    }
    return out;
  },
  extra: (v: FormValues) => {
    const f = form();
    const out: FormIssue[] = [];
    const add = (level: FormIssue['level'], text: string, ids: string[], rule: string) => out.push(issue(f, level, text, ids, rule));
    const sport = isChecked(v, 'reha_sport');
    const ft = isChecked(v, 'funktionstraining');
    const herz = isChecked(v, 'herzgruppe') || isChecked(v, 'herzinsuffizienzgruppe');
    if (sport && !herz) {
      const arten = anzahl(SPORTART, v);
      if (!arten.length && !isChecked(v, 'selbstbewusstsein')) add('fehlt', 'Rehabilitationssport: Sportart ankreuzen.', [...SPORTART], 'm56.sportart');
      if (arten.length > 1) add('unzulaessig', 'Nur eine Rehabilitationssportart ankreuzen; weitere unter „Sonstige“.', arten, 'm56.sportart');
      if (isChecked(v, 'sport_sonstige') && !textOf(v, 'sport_sonstige_text')) add('fehlt', '„Sonstige“ Sportart benennen.', ['sport_sonstige_text'], 'm56.sportart');
      if (!anzahl(SPORT_UMFANG, v).length) add('fehlt', 'Umfang des Rehabilitationssports ankreuzen (Richtwert 50 Einheiten in 18 Monaten).', [...SPORT_UMFANG], 'm56.uebungseinheiten');
      if (anzahl(SPORT_UMFANG, v).length > 1) add('unzulaessig', 'Nur einen Umfang für den Rehabilitationssport ankreuzen.', anzahl(SPORT_UMFANG, v), 'm56.uebungseinheiten');
      if (isChecked(v, 'sport_vergleichbar') && (!textOf(v, 'diagnose1') || !textOf(v, 'schaedigung'))) add('fehlt', '„Andere vergleichbare Krankheit“: Erkrankung und schwere Beeinträchtigung unter ❷ und ❸ angeben.', ['diagnose1', 'schaedigung'], 'm56.vergleichbare_krankheit');
    }
    if (sport && herz) {
      if (isChecked(v, 'herzgruppe') && isChecked(v, 'herzinsuffizienzgruppe')) add('unzulaessig', 'Entweder Herzgruppe oder Herzinsuffizienzgruppe.', ['herzgruppe', 'herzinsuffizienzgruppe'], 'm56.herzgruppe');
      const u = anzahl(HERZ_UMFANG, v);
      if (u.length !== 1) add(u.length ? 'unzulaessig' : 'fehlt', 'Herzgruppe: genau einen Umfang ankreuzen (Erst-, Folgeverordnung oder Kinderherzgruppe).', [...HERZ_UMFANG], 'm56.herzgruppe_umfang');
      if (isChecked(v, 'herz_folge') && !isChecked(v, 'herz_folge_watt') && !isChecked(v, 'herz_folge_kognitiv')) add('fehlt', 'Folgeverordnung Herzgruppe: Begründung ankreuzen (Belastungsgrenze unter 1,4 Watt/kg oder kognitive/psychische Beeinträchtigung).', ['herz_folge_watt', 'herz_folge_kognitiv'], 'm56.herzgruppe_umfang');
    }
    if (ft) {
      if (!isChecked(v, 'ft_trocken') && !isChecked(v, 'ft_wasser')) add('fehlt', 'Funktionstraining: Trocken- und/oder Wassergymnastik ankreuzen.', ['ft_trocken', 'ft_wasser'], 'm56.funktionstrainingsart');
      if (anzahl(FT_DAUER, v).length !== 1) add(anzahl(FT_DAUER, v).length ? 'unzulaessig' : 'fehlt', 'Funktionstraining: genau eine Dauer ankreuzen (Richtwert 12 Monate).', [...FT_DAUER], 'm56.funktionstraining_dauer');
      if (anzahl(SPORT_UMFANG, v).length || anzahl(SPORTART, v).length) add('hinweis', 'Funktionstraining angekreuzt, aber Angaben zum Rehabilitationssport gemacht.', ['funktionstraining'], 'm56.auswahl');
    }
    if (sport && anzahl(FT_DAUER, v).length) add('hinweis', 'Rehabilitationssport angekreuzt, aber Dauer für Funktionstraining gewählt.', ['reha_sport'], 'm56.auswahl');
    // Wochenfrequenz: je Art höchstens ein Feld, insgesamt höchstens drei; drei nur mit Begründung.
    const proWoche = sport ? pro(WOCHE.sport, v) : pro(WOCHE.trocken, v) + pro(WOCHE.wasser, v);
    for (const ids of Object.values(WOCHE)) if (anzahl(ids, v).length > 1) add('unzulaessig', 'Je Art nur eine Wochenfrequenz ankreuzen.', anzahl(ids, v), 'm56.wochenfrequenz');
    if (proWoche > MAX_PRO_WOCHE) add('unzulaessig', `Höchstens ${MAX_PRO_WOCHE} Übungsveranstaltungen pro Woche (angekreuzt: ${proWoche}).`, [...WOCHE.sport, ...WOCHE.trocken, ...WOCHE.wasser].filter((id) => isChecked(v, id)), 'm56.wochenfrequenz');
    if (proWoche === MAX_PRO_WOCHE && !textOf(v, 'woche_begruendung')) add('fehlt', 'Drei Übungsveranstaltungen pro Woche nur mit Begründung.', ['woche_begruendung'], 'm56.wochenfrequenz');
    if ((sport || ft) && proWoche === 0) add('hinweis', 'Wochenfrequenz ankreuzen (1x, 2x oder mit Begründung 3x).', [...(sport ? WOCHE.sport : [...WOCHE.trocken, ...WOCHE.wasser])], 'm56.wochenfrequenz');
    if (isChecked(v, 'folgeverordnung') && !textOf(v, 'folge_begruendung')) add('fehlt', 'Folgeverordnung: begründen, warum die Übungen noch nicht selbstständig durchgeführt werden können.', ['folge_begruendung'], sport ? 'm56.folge_sport' : 'm56.folge_funktion');
    if ((isChecked(v, 'sport_laenger') || isChecked(v, 'ft_laenger')) && !textOf(v, 'schaedigung')) add('fehlt', 'Längere Leistungsdauer: kognitive oder psychische Beeinträchtigung unter ❸ angeben.', ['schaedigung'], sport ? 'm56.laengere_dauer_sport' : 'm56.laengere_dauer_funktion');
    add('hinweis', 'Die/der Versicherte holt die Genehmigung der Krankenkasse vor Beginn ein (auch bei Folgeverordnungen).', [], 'm56.genehmigung');
    return out;
  },
};
