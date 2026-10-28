import { isChecked, issue, prop, textOf } from './build.js';
import { getForm } from './catalog.js';
import type { GenericSpec } from './generic.js';
import { cue, toTTMMJJ, uni } from './text.js';
import type { FieldProposal, FormIssue, FormValues } from './types.js';

/**
 * Muster 39 – Krebsfrüherkennung Zervix-Karzinom (oKFE-Richtlinie). Erläuterungen 01/2026, S. 83–85.
 * Fachregeln: Alterskategorie bestimmt den Auftrag (unter 35 Zytologie, ab 35 Ko-Testung; HPV-Test in der Abklärung ab 30),
 * Ja/Nein-Fragen eindeutig, Auffälligkeiten im Freitext erläutern.
 */
const form = () => getForm('muster-39');
const ALTER = ['alter_20_29', 'alter_30_34', 'alter_ab_35'] as const;
const AUFTRAG = ['auftrag_primaer', 'auftrag_abklaerung', 'auftrag_zytologie', 'auftrag_hpv', 'auftrag_ko'] as const;
const PAARE: readonly [string, string, string, string][] = [
  ['vor_nein', 'vor_ja', 'Frühere Krebsfrüherkennungsuntersuchung', 'm39.anamnese'],
  ['op_nein', 'op_ja', 'Gynäkologische OP, Strahlen- oder Chemotherapie', 'm39.anamnese'],
  ['gravid_nein', 'gravid_ja', 'Gravidität', 'm39.jetzt'],
  ['ausfluss_nein', 'ausfluss_ja', 'Ausfluss / pathologische Blutung', 'm39.jetzt'],
  ['iup_nein', 'iup_ja', 'IUP', 'm39.jetzt'],
  ['hormon_nein', 'hormon_ja', 'Ovulationshemmer / Hormonanwendung', 'm39.jetzt'],
  ['befund_unauffaellig', 'befund_auffaellig', 'Klinischer Befund', 'm39.klinischer_befund'],
];

/** Ja/Nein-Paar aus der Beschreibung: „ja“ bei Treffer, „nein“ bei ausdrücklicher Verneinung. */
function paar(text: string, nein: string, ja: string, re: RegExp, neinRe: RegExp): FieldProposal[] {
  const f = form();
  const n = uni(neinRe).exec(text)?.[0] ?? null;
  const j = n ? null : cue(re, text);
  if (!j && !n) return [];
  return [prop(f, ja, j ? 'vorgeschlagen' : 'leer', Boolean(j), j ? 'Aus der Beschreibung.' : 'Verneint.', j), prop(f, nein, n ? 'vorgeschlagen' : 'leer', Boolean(n), n ? 'Ausdrücklich verneint.' : 'Bejaht.', n)];
}

export const SPEC_39: GenericSpec = {
  text: { erlaeuterungen: ['befund', 'befunde', 'hinweise'] },
  check: { auftrag_primaer: /\bprimärscreening\b/iu, auftrag_abklaerung: /\babklärung\w*/iu, auftrag_ko: /\bko-?test\w*/iu, auftrag_hpv: /\bhpv-?test\b/iu, auftrag_zytologie: /\bzytologie\b/iu },
  required: ['letzte_periode'],
  oneOf: [
    { ids: [...AUFTRAG], text: 'Auftrag ankreuzen (Primärscreening oder Abklärungsdiagnostik; Zytologie, HPV-Test oder Ko-Testung).' },
  ],
  propose: (text) => {
    const f = form();
    const out: FieldProposal[] = [];
    const m = uni(/\b(\d{2})\s*(?:j\.|jahre?|jährig\w*)/iu).exec(text);
    if (m) {
      const a = Number(m[1]);
      const id = a >= 35 ? 'alter_ab_35' : a >= 30 ? 'alter_30_34' : a >= 20 ? 'alter_20_29' : null;
      if (id) out.push(...ALTER.map((x) => (x === id ? prop(f, x, 'vorgeschlagen', true, `Alter ${a} Jahre – maßgeblich ist das Alter am Behandlungstag.`, m[0]) : prop(f, x, 'leer', false, 'Andere Alterskategorie.'))));
      // Primärscreening: unter 35 nur Zytologie, ab 35 Ko-Testung.
      if (id && cue(/\b(primärscreening|vorsorge\w*|früherkennung\w*|routine\w*)\b/iu, text) && !cue(/\babklärung\w*/iu, text)) {
        const ko = a >= 35;
        out.push(prop(f, 'auftrag_primaer', 'vorgeschlagen', true, 'Primärscreening.', m[0]),
          prop(f, ko ? 'auftrag_ko' : 'auftrag_zytologie', 'vorgeschlagen', true, ko ? 'Ab 35 Jahren Ko-Testung (Zytologie und HPV).' : 'Unter 35 Jahren nur Zytologie.', m[0], 'm39.zytologie_befund'));
      }
    }
    const lp = uni(/\b(?:letzte\w* (?:periode|regel|menstruation)|lp|lmp)\b\D{0,10}?(\d{1,2})\.(\d{1,2})\.(\d{4}|\d{2})?/iu).exec(text);
    if (lp) out.push(prop(f, 'letzte_periode', 'vorgeschlagen', toTTMMJJ(lp[1]!, lp[2]!, lp[3] ?? String(new Date().getFullYear())), 'Letzte Periode.', lp[0]));
    else if (cue(/\b(postmenopaus\w*|menopause|keine periode)\b/iu, text)) out.push(prop(f, 'letzte_periode', 'leer', null, 'Postmenopausal – im Freitext vermerken.'));
    out.push(...paar(text, 'gravid_nein', 'gravid_ja', /\b(schwanger\w*|gravid\w*|\d+\.?\s*ssw)\b/iu, /\bnicht schwanger\b/iu),
      ...paar(text, 'iup_nein', 'iup_ja', /\b(iup|spirale|kupferspirale|hormonspirale)\b/iu, /\bkeine spirale\b|\bkein iup\b/iu),
      ...paar(text, 'hormon_nein', 'hormon_ja', /\b(pille|ovulationshemmer\w*|hormon\w*|hrt)\b/iu, /\bkeine (?:pille|hormone?)\b/iu),
      ...paar(text, 'befund_unauffaellig', 'befund_auffaellig', /\b(auffällig\w*|kontaktblutung|portioektopie|läsion\w*)\b/iu, /\bunauffällig\w*/iu),
      ...paar(text, 'vor_nein', 'vor_ja', /\b(letzte\w* (?:vorsorge|abstrich|früherkennung)|vorbefund\w*|pap\s*[ivx]+)\b/iu, /\b(erstmals|erste vorsorge|noch nie)\b/iu));
    const impf = cue(/\b(hpv-?geimpft|hpv-?impfung (?:vollständig|komplett))\b/iu, text);
    if (impf) out.push(prop(f, 'impf_vollstaendig', 'vorgeschlagen', true, 'HPV-Impfung vollständig.', impf));
    return out;
  },
  extra: (v: FormValues) => {
    const f = form();
    const out: FormIssue[] = [];
    const add = (level: FormIssue['level'], text: string, ids: string[], rule: string) => out.push(issue(f, level, text, ids, rule));
    const on = (id: string) => isChecked(v, id);
    for (const [n, j, label, rule] of PAARE) {
      if (on(n) && on(j)) add('unzulaessig', `${label}: entweder ja oder nein.`, [n, j], rule);
    }
    if (!on('vor_ja') && !on('vor_nein')) add('fehlt', 'Frühere Krebsfrüherkennungsuntersuchung: ja oder nein ankreuzen.', ['vor_ja', 'vor_nein'], 'm39.anamnese');
    if (!on('befund_unauffaellig') && !on('befund_auffaellig')) add('fehlt', 'Klinischer Befund: unauffällig oder auffällig ankreuzen.', ['befund_unauffaellig', 'befund_auffaellig'], 'm39.klinischer_befund');
    if (on('vor_ja') && !textOf(v, 'vor_datum')) add('fehlt', 'Frühere Untersuchung: Monat/Jahr der letzten Untersuchung (MMJJ) angeben.', ['vor_datum'], 'm39.anamnese');
    if (on('op_ja') && !textOf(v, 'op_welche')) add('fehlt', 'Gynäkologische OP, Strahlen- oder Chemotherapie: angeben, welche.', ['op_welche'], 'm39.anamnese');
    if (on('befund_auffaellig') && !textOf(v, 'erlaeuterungen')) add('fehlt', 'Auffälliger klinischer Befund: im Freitextfeld erläutern.', ['erlaeuterungen'], 'm39.klinischer_befund');
    if (on('auftrag_primaer') && on('auftrag_abklaerung')) add('unzulaessig', 'Entweder Primärscreening oder Abklärungsdiagnostik beauftragen.', ['auftrag_primaer', 'auftrag_abklaerung'], 'm39.auftrag');
    const unter35 = on('alter_20_29') || on('alter_30_34');
    if (on('auftrag_primaer') && unter35 && (on('auftrag_ko') || on('auftrag_hpv'))) add('unzulaessig', 'Primärscreening unter 35 Jahren: nur Zytologie, kein HPV-Test bzw. keine Ko-Testung.', ['auftrag_ko', 'auftrag_hpv'], 'm39.zytologie_befund');
    if (on('auftrag_primaer') && on('alter_ab_35') && on('auftrag_zytologie') && !on('auftrag_ko')) add('hinweis', 'Primärscreening ab 35 Jahren ist die Ko-Testung (Zytologie plus HPV); nur Zytologie bei aufgespaltener Ko-Testung.', ['auftrag_ko'], 'm39.auftrag');
    if (on('auftrag_abklaerung') && on('alter_20_29') && (on('auftrag_hpv') || on('auftrag_ko'))) add('hinweis', 'HPV-Test in der Abklärung ist ab 30 Jahren vorgesehen.', ['auftrag_hpv', 'auftrag_ko'], 'm39.zytologie_befund');
    add('hinweis', 'Den linken Teil (❶–❻) füllt die gynäkologische Praxis aus; Ergebnis und Empfehlung trägt die Zytologie ein.', [], 'm39.arbeitsteilung');
    return out;
  },
};
