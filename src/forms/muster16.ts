import { isChecked, issue, prop, textOf } from './build.js';
import { getForm } from './catalog.js';
import type { GenericSpec } from './generic.js';
import { cue, labeledSegments, segment, toTTMMJJ, uni } from './text.js';
import type { FieldProposal, FormIssue, FormValues, PatientFacts } from './types.js';

/**
 * Muster 16 – Arzneiverordnungsblatt (Stand 10.2014). Erläuterungen 01/2026, S. 57–61.
 * Fachregeln: höchstens drei Verordnungen je Blatt, keine Betäubungsmittel (BtM-Rezept), keine T-Rezept-Wirkstoffe,
 * Arznei- und Hilfsmittel getrennt, Seh-/Hörhilfen nie, Dosierung bei verschreibungspflichtigen Mitteln, Gebühr.
 */
const form = () => getForm('muster-16');
const ZEILEN = ['verordnung_1', 'verordnung_2', 'verordnung_3'] as const;
const MAX_ZEILEN = 3;

const BTM = /\b(morphin\w*|oxycodon\w*|hydromorphon\w*|fentanyl\w*|tapentadol\w*|buprenorphin\w*|methadon\w*|levomethadon\w*|pethidin\w*|piritramid\w*|methylphenidat\w*|lisdexamfetamin\w*|dexamfetamin\w*|dronabinol\w*|nabilon\w*|cannabis\w*|btm)\b/iu;
const T_REZEPT = /\b(lenalidomid\w*|pomalidomid\w*|thalidomid\w*)\b/iu;
const SEH_HOER = /\b(brille\w*|kontaktlinse\w*|hörgerät\w*|hörhilfe\w*)\b/iu;
const HILFSMITTEL = /\b(kompressionsstr[uü]mpf\w*|rollator\w*|gehstock|unterarmgehstütze\w*|bandage\w*|orthese\w*|inkontinenz\w*|einlage\w*|inhalationsgerät\w*|milchpumpe|stoma\w*)\b/iu;
const DIGA = /\b(diga|digitale\w* gesundheitsanwendung\w*)\b/iu;
const IMPFSTOFF = /\b(impfstoff\w*|vakzin\w*|grippeimpfung|influenza-?impf\w*)\b/iu;
const DOSIERUNG = /(\b\d+(?:[,.]\d+)?\s*-\s*\d+(?:[,.]\d+)?\s*-\s*\d+(?:[,.]\d+)?(?:\s*-\s*\d+(?:[,.]\d+)?)?\b|≫[^≪]*≪|\bdj\b|medikationsplan|\b\d+\s*x\s*(?:tgl|täglich|wöchentl)\w*|\bnach (?:plan|schema)\b|\bbei bedarf\b)/iu;

/** Verordnungszeilen aus „Präparate: A; B; C“ (Semikolon oder Zeilenumbruch trennt). */
function zeilen(text: string): string[] {
  const seg = segment(labeledSegments(text), 'präparate', 'medikation', 'medikamente');
  return seg ? seg.split(/\s*[;\n]\s*/u).map((s) => s.trim()).filter(Boolean) : [];
}

function gebuehr(text: string, facts: PatientFacts): FieldProposal[] {
  const f = form();
  const frei = facts.zuzahlungsbefreit?.evidence
    ?? (facts.kindAlter && facts.kindAlter.value < 18 ? facts.kindAlter.evidence : null)
    ?? (facts.ssw ? facts.ssw.evidence : cue(/\b(schwanger\w*|entbindung\w*)\b/iu, text))
    ?? facts.arbeitsunfall?.evidence ?? facts.versorgungsleiden?.evidence ?? cue(DIGA, text);
  return frei
    ? [prop(f, 'gebuehr_frei', 'vorgeschlagen', true, 'Gebührenfrei (z. B. unter 18, Schwangerschaft, Unfallversicherung, Versorgungsleiden, DiGA, Zuzahlungsbefreiung).', frei), prop(f, 'geb_pfl', 'leer', false, 'Gebührenfrei.')]
    : [prop(f, 'geb_pfl', 'vorgeschlagen', true, 'Grundsätzlich gebührenpflichtig.', null), prop(f, 'gebuehr_frei', 'leer', false, 'Nur bei den Befreiungsgründen.')];
}

export const SPEC_16: GenericSpec = {
  required: ['verordnung_1'],
  check: { noctu: /\b(noctu|apotheken-?notdienst|nachts? abholen)\b/iu, sonstige: /\b(postbeamtenkrankenkasse|heilfürsorge|bundeswehr|bundespolizei)\b/iu },
  propose: (text, facts) => {
    const f = form();
    const z = zeilen(text);
    const unfallTag = uni(/\b(?:arbeitsunfall|unfall)\w*\D{0,15}?(\d{1,2})\.(\d{1,2})\.(\d{4}|\d{2})\b/iu).exec(text);
    const autIdem = cue(/\b(aut[- ]idem|kein austausch|nicht austauschen)\b/iu, text);
    const out: FieldProposal[] = [
      ...gebuehr(text, facts),
      ...ZEILEN.map((id, i) => (z[i] ? prop(f, id, 'arzt', z[i]!, `Verordnung ${i + 1} aus der Beschreibung – Mittel, Menge und Dosierung prüfen.`, z[i]!, 'm16.dosierung')
        : prop(f, id, i === 0 ? 'unbekannt' : 'leer', null, i === 0 ? 'Arzneimittel mit Menge und Dosierung eintragen (z. B. „Präparate: Ramipril 5 mg N3 1-0-0“).' : 'Leerraum durchstreichen.', null, i === 0 ? 'm16.dosierung' : 'm16.faelschungssicher'))),
      prop(f, 'aut_idem_1', autIdem ? 'vorgeschlagen' : 'leer', Boolean(autIdem), autIdem ? 'Kein Austausch gegen ein wirkstoffgleiches Mittel.' : 'Nur ankreuzen, wenn nicht ausgetauscht werden darf.', autIdem, 'm16.aut_idem'),
    ];
    if (facts.arbeitsunfall) {
      out.push(prop(f, 'arbeitsunfall', 'vorgeschlagen', true, 'Zu Lasten des Unfallversicherungsträgers.', facts.arbeitsunfall.evidence, 'm16.unfall'),
        prop(f, 'unfall', 'leer', false, 'Bei Arbeitsunfall „Arbeitsunfall“ ankreuzen.', null, 'm16.unfall'),
        unfallTag ? prop(f, 'unfalltag', 'vorgeschlagen', toTTMMJJ(unfallTag[1]!, unfallTag[2]!, unfallTag[3]!) ?? null, 'Unfalltag.', unfallTag[0], 'm16.unfall') : prop(f, 'unfalltag', 'unbekannt', null, 'Unfalltag angeben.', null, 'm16.unfall'),
        prop(f, 'unfallbetrieb', 'unbekannt', null, 'Unfallbetrieb oder Arbeitgebernummer angeben.', null, 'm16.unfall'));
    }
    if (z.some((l) => HILFSMITTEL.test(l))) out.push(prop(f, 'sk_hilfsmittel', 'vorgeschlagen', '7', 'Hilfsmittel: Ziffer 7 in Feld 7.', null, 'm16.sonderkennzeichen'));
    if (z.some((l) => IMPFSTOFF.test(l))) out.push(prop(f, 'sk_impfstoff', 'vorgeschlagen', '8', 'Impfstoff (Impfvereinbarung): Ziffer 8 in Feld 8.', null, 'm16.sonderkennzeichen'));
    if (cue(/\b(sprechstundenbedarf|ssb)\b/iu, text)) out.push(prop(f, 'sk_spr_st_bedarf', 'vorgeschlagen', '9', 'Sprechstundenbedarf: Ziffer 9 in Feld 9.', null, 'm16.sonderkennzeichen'));
    return out;
  },
  extra: (v: FormValues, facts: PatientFacts) => {
    const f = form();
    const out: FormIssue[] = [];
    const add = (level: FormIssue['level'], text: string, ids: string[], rule: string) => out.push(issue(f, level, text, ids, rule));
    const lines = ZEILEN.map((id) => [id, textOf(v, id)] as const).filter(([, t]) => t);
    const all = lines.map(([, t]) => t).join(' ');
    for (const [id, t] of lines) {
      if (BTM.test(t)) add('unzulaessig', `„${t}“: Betäubungsmittel nur auf dem amtlichen BtM-Rezept, nicht auf Muster 16.`, [id], 'm16.betaeubungsmittel');
      if (T_REZEPT.test(t)) add('unzulaessig', `„${t}“: Lenalidomid, Pomalidomid, Thalidomid nur auf dem T-Rezept des BfArM.`, [id], 'm16.t_rezept');
      if (SEH_HOER.test(t)) add('unzulaessig', `„${t}“: Seh- und Hörhilfen nicht auf Muster 16 (Muster 8/8A bzw. 15).`, [id], 'm16.anzahl');
      if (!DIGA.test(t) && !HILFSMITTEL.test(t) && !IMPFSTOFF.test(t) && !DOSIERUNG.test(t)) add('hinweis', `„${t}“: bei verschreibungspflichtigen Arzneimitteln Dosierung angeben (z. B. „1-0-0“, „Dj“ oder „siehe Medikationsplan“).`, [id], 'm16.dosierung');
    }
    const hm = lines.some(([, t]) => HILFSMITTEL.test(t));
    const am = lines.some(([, t]) => !HILFSMITTEL.test(t) && !DIGA.test(t));
    if (hm && am) add('unzulaessig', 'Arznei- und Hilfsmittel auf getrennten Blättern verordnen.', lines.map(([id]) => id), 'm16.anzahl');
    if (DIGA.test(all) && lines.length > 1) add('unzulaessig', 'Digitale Gesundheitsanwendung: nur eine Anwendung je Blatt, ohne weitere Verordnungen.', lines.map(([id]) => id), 'm16.diga');
    if (isChecked(v, 'gebuehr_frei') && isChecked(v, 'geb_pfl')) add('unzulaessig', 'Entweder „Gebühr frei“ oder „Geb.-pfl.“ ankreuzen.', ['gebuehr_frei', 'geb_pfl'], 'm16.gebuehr');
    if (!isChecked(v, 'gebuehr_frei') && !isChecked(v, 'geb_pfl')) add('fehlt', '„Gebühr frei“ oder „Geb.-pfl.“ ankreuzen – grundsätzlich gebührenpflichtig.', ['gebuehr_frei', 'geb_pfl'], 'm16.gebuehr');
    if (isChecked(v, 'unfall') && isChecked(v, 'arbeitsunfall')) add('unzulaessig', 'Entweder „Unfall“ (sonstiger Unfall) oder „Arbeitsunfall“ ankreuzen.', ['unfall', 'arbeitsunfall'], 'm16.unfall');
    if (isChecked(v, 'arbeitsunfall') && (!textOf(v, 'unfalltag') || !textOf(v, 'unfallbetrieb'))) add('fehlt', 'Arbeitsunfall: Unfalltag und Unfallbetrieb bzw. Arbeitgebernummer angeben.', ['unfalltag', 'unfallbetrieb'], 'm16.unfall');
    if (facts.arbeitsunfall && !isChecked(v, 'arbeitsunfall')) add('hinweis', 'Arbeitsunfall erwähnt: zu Lasten des Unfallversicherungsträgers „Arbeitsunfall“ ankreuzen.', ['arbeitsunfall'], 'm16.unfall');
    if (uni(/\b(pille|kontrazept\w*|empfängnisverhüt\w*)\b/iu).test(all)) add('hinweis', 'Empfängnisverhütende Mittel ab dem vollendeten 22. Lebensjahr nur auf Privatrezept.', [], 'm16.privatrezept');
    for (const [id, val] of [['sk_hilfsmittel', '7'], ['sk_impfstoff', '8']] as const) {
      const t = textOf(v, id);
      if (t && t !== val) add('unzulaessig', `Sonderkennzeichen: in diesem Feld nur die Ziffer ${val}.`, [id], 'm16.sonderkennzeichen');
    }
    if (lines.length < MAX_ZEILEN) add('hinweis', 'Leerräume unter der letzten Verordnung durchstreichen; Unterschrift unmittelbar darunter.', [], 'm16.faelschungssicher');
    return out;
  },
};
