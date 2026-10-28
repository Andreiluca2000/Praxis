import { isChecked, issue, prop, textOf } from './build.js';
import { getForm } from './catalog.js';
import type { GenericSpec } from './generic.js';
import { cue } from './text.js';
import type { FieldProposal, FormIssue, FormValues } from './types.js';

/**
 * Muster 15 – Ohrenärztliche Verordnung einer Hörhilfe (Stand 10.2014). Erläuterungen 01/2026, S. 56.
 * Fachregeln: ton- und sprachaudiometrische Untersuchung als Voraussetzung, Tinnitus mit Frequenz und Verdeckbarkeit,
 * Seite eindeutig, Nachversorgung begründet, Ohrbefund je Ohr, Zweckmäßigkeit erst nach Anpassung bestätigen.
 */
const form = () => getForm('muster-15');
const SEITEN = ['hoerhilfe_rechts', 'hoerhilfe_links', 'hoerhilfe_beiderseits'] as const;
const OHREN = [
  { seite: 'rechts', gang: ['gehoergang_normal_r', 'gehoergang_erweitert_r', 'gehoergang_eng_r'], fell: ['trommelfell_intakt_r', 'trommelfell_durchloechert_r', 'trommelfell_feucht_r'] },
  { seite: 'links', gang: ['gehoergang_normal_l', 'gehoergang_erweitert_l', 'gehoergang_eng_l'], fell: ['trommelfell_intakt_l', 'trommelfell_durchloechert_l', 'trommelfell_feucht_l'] },
] as const;

export const SPEC_15: GenericSpec = {
  required: ['diagnose'],
  text: { diagnose: ['diagnose'], nachversorgung_begruendung: ['begründung'] },
  check: { hoerhilfe_beiderseits: /\b(beidseit\w*|beiderseit\w*|bds\.?|beidohrig\w*)\b/iu },
  oneOf: [{ ids: [...SEITEN, 'tinnitus_rechts_khz', 'tinnitus_links_khz'], text: 'Seite der Hörhilfe (rechts, links, beiderseits) bzw. Tinnitusinstrument angeben.' }],
  propose: (text) => {
    const f = form();
    const out: FieldProposal[] = [];
    const beid = cue(/\b(beidseit\w*|beiderseit\w*|bds\.?|beidohrig\w*)\b/iu, text);
    if (!beid) {
      const r = cue(/\b(rechts|re\.)\b/iu, text);
      const l = cue(/\b(links|li\.)\b/iu, text);
      if (r && !l) out.push(prop(f, 'hoerhilfe_rechts', 'vorgeschlagen', true, 'Hörhilfe rechts.', r, 'm15.seite'));
      if (l && !r) out.push(prop(f, 'hoerhilfe_links', 'vorgeschlagen', true, 'Hörhilfe links.', l, 'm15.seite'));
    }
    const nach = cue(/\b(nachversorgung|folgeversorgung|bisherige\w* (?:hör)?gerät\w*|neues hörgerät|hörgerät (?:ist )?(?:defekt|zu alt))\b/iu, text);
    const erst = nach ? null : cue(/\b(erstversorgung|erstmals|erstes hörgerät)\b/iu, text);
    if (nach) out.push(prop(f, 'traeger_ja', 'vorgeschlagen', true, 'War schon Träger eines Gerätes – Nachversorgung begründen.', nach, 'm15.erst_nachversorgung'), prop(f, 'traeger_nein', 'leer', false, 'Nachversorgung.', null, 'm15.erst_nachversorgung'));
    if (erst) out.push(prop(f, 'traeger_nein', 'vorgeschlagen', true, 'Erstversorgung.', erst, 'm15.erst_nachversorgung'), prop(f, 'traeger_ja', 'leer', false, 'Erstversorgung.', null, 'm15.erst_nachversorgung'));
    return out;
  },
  extra: (v: FormValues) => {
    const f = form();
    const out: FormIssue[] = [];
    const add = (level: FormIssue['level'], text: string, ids: string[], rule: string) => out.push(issue(f, level, text, ids, rule));
    const on = (id: string) => isChecked(v, id);
    if (!textOf(v, 'tonaudiogramm_r') && !textOf(v, 'tonaudiogramm_l')) add('fehlt', 'Tonaudiogramm (Frequenz/Hörverlust, Unbehaglichkeitsschwelle) eintragen – Voraussetzung der Verordnung.', ['tonaudiogramm_r', 'tonaudiogramm_l'], 'm15.audiometrie');
    if (!textOf(v, 'sprachaudiogramm_r') && !textOf(v, 'sprachaudiogramm_l')) add('fehlt', 'Sprachaudiogramm (Verständlichkeit/Sprachschallpegel) eintragen – Voraussetzung der Verordnung.', ['sprachaudiogramm_r', 'sprachaudiogramm_l'], 'm15.audiometrie');
    for (const s of ['rechts', 'links'] as const) {
      const khz = textOf(v, `tinnitus_${s}_khz`);
      const db = textOf(v, `tinnitus_${s}_db`);
      if (Boolean(khz) !== Boolean(db)) add('fehlt', `Tinnitusinstrument ${s}: Frequenz (kHz) und Verdeckbarkeit (dB) angeben.`, [`tinnitus_${s}_khz`, `tinnitus_${s}_db`], 'm15.audiometrie');
    }
    if (on('hoerhilfe_beiderseits') && (on('hoerhilfe_rechts') || on('hoerhilfe_links'))) add('unzulaessig', '„beiderseits“ nicht zusätzlich zu rechts oder links ankreuzen.', [...SEITEN], 'm15.seite');
    if (on('traeger_ja') && !textOf(v, 'nachversorgung_begruendung')) add('fehlt', 'Nachversorgung: begründen, warum das bisherige Gerät nicht mehr ausreicht.', ['nachversorgung_begruendung'], 'm15.erst_nachversorgung');
    for (const o of OHREN) {
      const g = o.gang.filter(on);
      if (g.length === 0) add('fehlt', `Ohrbefund ${o.seite}: Gehörgang (normal, operativ erweitert, eng) ankreuzen.`, [...o.gang], 'm15.ohrbefund');
      if (g.length > 1) add('unzulaessig', `Ohrbefund ${o.seite}: nur eine Angabe zum Gehörgang.`, g, 'm15.ohrbefund');
      if (!o.fell.some(on)) add('fehlt', `Ohrbefund ${o.seite}: Trommelfell (intakt, durchlöchert, feucht) ankreuzen.`, [...o.fell], 'm15.ohrbefund');
      if (on(o.fell[0]) && on(o.fell[1])) add('unzulaessig', `Ohrbefund ${o.seite}: Trommelfell nicht zugleich intakt und durchlöchert.`, [o.fell[0], o.fell[1]], 'm15.ohrbefund');
    }
    if ((on('bescheinigung_hoerhilfe') || on('bescheinigung_tinnitus')) && !textOf(v, 'bescheinigung_datum')) add('fehlt', 'Ärztliche Bescheinigung: Datum eintragen.', ['bescheinigung_datum'], 'm15.zweckmaessigkeit');
    if (!on('bescheinigung_hoerhilfe') && !on('bescheinigung_tinnitus')) add('hinweis', 'Nach der Anpassung die ausreichende Hörverbesserung bzw. Zweckmäßigkeit auf dem Vordruck bestätigen.', ['bescheinigung_hoerhilfe', 'bescheinigung_tinnitus'], 'm15.zweckmaessigkeit');
    add('hinweis', 'Audiometrie vom Arzt bzw. unter seiner Verantwortung – nicht nach Angaben des Hörgeräteakustikers ausfüllen.', [], 'm15.audiometrie');
    return out;
  },
};
