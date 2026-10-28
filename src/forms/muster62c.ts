import { isChecked, issue, textOf, validTTMMJJ } from './build.js';
import { getForm } from './catalog.js';
import type { GenericSpec } from './generic.js';
import { fromTTMMJJ } from './text.js';
import type { FormIssue, FormValues } from './types.js';

/**
 * Muster 62C – Behandlungsplan außerklinische Intensivpflege (Stand 1.2023), Anlage zu Muster 62B. Erläuterungen 01/2026, S. 128–130.
 * Fachregeln: Therapieziele, Notfallmanagement, MRE-Status, Angaben zu jeder angekreuzten Fachmaßnahme, Sauerstoff mit Flow und Dauer,
 * Behandlungspflege mit Häufigkeit und Dauer.
 */
const form = () => getForm('muster-62c');
const STUNDEN_MAX = 24;
const PFLEGE_ZEILEN = [1, 2, 3] as const;
const O2 = [['o2_beatmung_flow', 'o2_beatmung_dauer'], ['o2_spontan_flow', 'o2_spontan_dauer'], ['o2_mobilitaet_flow', 'o2_mobilitaet_dauer']] as const;

export const SPEC_62C: GenericSpec = {
  required: ['therapieziele', 'notfallmanagement'],
  text: { therapieziele: ['therapieziele', 'therapieziel', 'ziele', 'ziel'], notfallmanagement: ['notfallmanagement', 'notfall'], bedarfsmedikamente: ['bedarfsmedikation', 'medikation', 'medikamente'], vitalparameter_1: ['vitalparameter'] },
  check: {
    mre_ja: /\b(mrsa|mre|vre|[34]\s*-?mrgn|esbl)\b/iu,
    trachealkanuele: /\b(tracheostoma|trachealkanüle\w*)\b/iu,
    sekretmanagement: /\bsekret\w*/iu,
    absaug_ja: /\babsaug\w*/iu,
    beatmungsgeraet: /\bbeatm\w*/iu,
    sauerstoff: /\b(sauerstoff\w*|o2-?gabe)\b/iu,
    dysphagie: /\b(dysphagie\w*|schluckstörung\w*)\b/iu,
    heilmittel_logopaedie: /\b(logopäd\w*|schlucktherap\w*)\b/iu,
    heilmittel_physiotherapie: /\b(physiotherap\w*|krankengymnastik|atemtherap\w*)\b/iu,
    heilmittel_ergotherapie: /\bergotherap\w*/iu,
    vitalparameter: /\bvitalparameter\b/iu,
  },
  extra: (v: FormValues) => {
    const f = form();
    const out: FormIssue[] = [];
    const add = (level: FormIssue['level'], text: string, ids: string[], rule: string) => out.push(issue(f, level, text, ids, rule));
    const on = (id: string) => isChecked(v, id);
    const need = (cond: boolean, ids: string[], text: string, rule: string) => { if (cond && ids.every((id) => !textOf(v, id))) add('fehlt', text, ids, rule); };
    const pair = (ja: string, nein: string, label: string, rule: string) => { if (on(ja) && on(nein)) add('unzulaessig', `${label}: entweder ja oder nein.`, [ja, nein], rule); };
    if (!on('mre_ja') && !on('mre_nein')) add('fehlt', 'MRE-Besiedelung: ja oder nein ankreuzen.', ['mre_ja', 'mre_nein'], 'm62c.therapieziele');
    pair('mre_ja', 'mre_nein', 'MRE-Besiedelung', 'm62c.therapieziele');
    need(on('mre_ja'), ['mre_keim'], 'MRE-Besiedelung: Keim angeben.', 'm62c.therapieziele');
    if (!textOf(v, 'bedarfsmedikamente')) add('hinweis', 'Bedarfsmedikamente mit Namen, Dosierung und möglichst präzisem Bedarfsgrund angeben (falls vorgesehen).', ['bedarfsmedikamente'], 'm62c.bedarfsmedikamente');
    need(on('vitalparameter'), ['vitalparameter_1', 'vitalparameter_2'], 'Zu erfassende Vitalparameter benennen (ggf. mit Grenzwerten, bei denen der Verordner zu informieren ist).', 'm62c.vitalparameter');
    if (on('trachealkanuele')) {
      if (!on('tracheotomie_dilatativ') && !on('tracheotomie_chirurgisch')) add('fehlt', 'Tracheotomie: dilatativ oder chirurgisch ankreuzen.', ['tracheotomie_dilatativ', 'tracheotomie_chirurgisch'], 'm62c.fachmassnahmen');
      need(true, ['kanuele_hersteller'], 'Trachealkanüle: Hersteller angeben.', 'm62c.fachmassnahmen');
      need(true, ['kanuele_durchmesser'], 'Trachealkanüle: Innendurchmesser (mm) angeben.', 'm62c.fachmassnahmen');
      if (!on('befeuchtung_passiv') && !on('befeuchtung_aktiv')) add('fehlt', 'Befeuchtung: passiv oder aktiv ankreuzen.', ['befeuchtung_passiv', 'befeuchtung_aktiv'], 'm62c.fachmassnahmen');
    }
    pair('absaug_ja', 'absaug_nein', 'Absauggerät', 'm62c.fachmassnahmen');
    need(on('absaug_ja'), ['absaug_haeufigkeit'], 'Absauggerät: Häufigkeit pro Tag angeben.', 'm62c.fachmassnahmen');
    pair('inhalation_ja', 'inhalation_nein', 'Inhalationsgerät', 'm62c.fachmassnahmen');
    need(on('inhalation_ja'), ['inhalation_haeufigkeit'], 'Inhalationsgerät: Häufigkeit pro Tag angeben.', 'm62c.fachmassnahmen');
    need(on('inhalation_ja'), ['inhalation_medikament'], 'Inhalationsgerät: Medikament bzw. Substanz angeben.', 'm62c.fachmassnahmen');
    need(on('dysphagie'), ['dysphagie_text'], 'Dysphagiemanagement: Angaben ergänzen.', 'm62c.fachmassnahmen');
    need(on('beatmungsgeraet'), ['beatmungsgeraet_einstellungen'], 'Beatmungsgerät: Einstellungen angeben.', 'm62c.fachmassnahmen');
    need(on('hygiene'), ['hygiene_text'], 'Spezielle Hygienemaßnahmen: Angaben ergänzen.', 'm62c.fachmassnahmen');
    if (on('sauerstoff')) {
      if (!['sauerstoff_ja', 'sauerstoff_nein', 'sauerstoff_notfall'].some(on)) add('fehlt', 'Sauerstoffinsufflation: ja, nein oder Notfallversorgung ankreuzen.', ['sauerstoff_ja', 'sauerstoff_nein', 'sauerstoff_notfall'], 'm62c.fachmassnahmen');
      if (on('sauerstoff_ja') && !O2.some(([fl, d]) => textOf(v, fl) && textOf(v, d))) add('fehlt', 'Sauerstoffinsufflation: Flow (l/min) und Dauer (h/tgl.) mindestens für eine Situation angeben.', O2.flat(), 'm62c.fachmassnahmen');
    }
    const o2Summe = O2.reduce((s, [, d]) => s + (Number(textOf(v, d).replace(',', '.')) || 0), 0);
    if (o2Summe > STUNDEN_MAX) add('unzulaessig', `Sauerstoff: die Dauer ergibt zusammen ${o2Summe} Stunden täglich (höchstens 24).`, O2.map(([, d]) => d), 'm62c.fachmassnahmen');
    for (const i of PFLEGE_ZEILEN) {
      if (!textOf(v, `pflege_leistung_${i}`)) continue;
      if (!['tgl', 'wtl', 'mtl'].some((h) => textOf(v, `pflege_${h}_${i}`))) add('fehlt', `Behandlungspflege Zeile ${i}: Häufigkeit (täglich, wöchentlich oder monatlich) angeben.`, ['tgl', 'wtl', 'mtl'].map((h) => `pflege_${h}_${i}`), 'm62c.behandlungspflege');
      const vom = textOf(v, `pflege_vom_${i}`);
      const bis = textOf(v, `pflege_bis_${i}`);
      if (!vom || !bis) add('fehlt', `Behandlungspflege Zeile ${i}: Dauer (vom – bis) angeben.`, [`pflege_vom_${i}`, `pflege_bis_${i}`], 'm62c.behandlungspflege');
      else if (validTTMMJJ(vom) && validTTMMJJ(bis) && fromTTMMJJ(bis) < fromTTMMJJ(vom)) add('unzulaessig', `Behandlungspflege Zeile ${i}: „bis“ liegt vor „vom“.`, [`pflege_vom_${i}`, `pflege_bis_${i}`], 'm62c.behandlungspflege');
    }
    add('hinweis', 'Behandlungspflege im Zusammenhang mit der AKI ist Teil der AKI – nicht zusätzlich auf Muster 12 verordnen.', [], 'm62c.behandlungspflege');
    return out;
  },
};
