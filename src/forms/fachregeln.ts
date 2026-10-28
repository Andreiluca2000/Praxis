import { isChecked, issue, prop, textOf, validTTMMJJ } from './build.js';
import { getForm } from './catalog.js';
import type { GenericSpec } from './generic.js';
import { cue, fromTTMMJJ, toTTMMJJ, ttmmjj, uni } from './text.js';
import type { FieldProposal, FormId, FormIssue, FormValues, PatientFacts } from './types.js';

/**
 * Fachregeln für Vordrucke mit wenigen eigenen Regeln (Muster 3, 5, 7, 11, 22, 28, 36, 50, 51, 53, 62A, 70, 70A).
 * Jede Meldung trägt die Regel mit Fundstelle aus data/forms/muster-NN.json (KBV-Erläuterungen bzw. Aufdruck).
 */

type Add = (level: FormIssue['level'], text: string, ids: string[], rule: string) => void;

/** Prüfungen mit kurzer Schreibweise: `add`, `on` (angekreuzt), `has` (ausgefüllt). */
function rules(id: FormId, body: (v: FormValues, add: Add, on: (x: string) => boolean, has: (x: string) => boolean, facts: PatientFacts) => void) {
  return (v: FormValues, facts: PatientFacts): FormIssue[] => {
    const f = getForm(id);
    const out: FormIssue[] = [];
    body(v, (level, text, ids, rule) => out.push(issue(f, level, text, ids, rule)), (x) => isChecked(v, x), (x) => Boolean(textOf(v, x)), facts);
    return out;
  };
}

const TAG_MS = 86_400_000;
const NAEGELE_TAGE = 280;
const SCHWANGERSCHAFT_MAX_TAGE = 300;
const NEUN = /^\d{9}$/;
const heute = () => { const d = new Date(); d.setHours(0, 0, 0, 0); return d; };
const tage = (a: string, b: string) => Math.round((fromTTMMJJ(b).getTime() - fromTTMMJJ(a).getTime()) / TAG_MS);

export const SPEC_03: Partial<GenericSpec> = {
  propose: (text, _f, today) => {
    const f = getForm('muster-03');
    const out: FieldProposal[] = [prop(f, 'untersuchung_am', 'vorgeschlagen', ttmmjj(today), 'Tag der eigenen Untersuchung (heute).', null, 'm03.untersuchung')];
    const et = uni(/\b(?:entbindungstermin|errechnete\w* termin|et|geburtstermin)\b\D{0,20}?(\d{1,2})\.(\d{1,2})\.(\d{4}|\d{2})?/iu).exec(text);
    const lp = uni(/\b(?:letzte\w* (?:periode|regel|menstruation)|lp|lmp)\b\D{0,10}?(\d{1,2})\.(\d{1,2})\.(\d{4}|\d{2})/iu).exec(text);
    if (et) out.push(prop(f, 'entbindung_am', 'arzt', toTTMMJJ(et[1]!, et[2]!, et[3] ?? String(today.getFullYear())), 'Mutmaßlicher Tag der Entbindung – der Arzt bestätigt.', et[0], 'm03.daten'));
    else if (lp) {
      const d = fromTTMMJJ(toTTMMJJ(lp[1]!, lp[2]!, lp[3]!) ?? ttmmjj(today));
      d.setDate(d.getDate() + NAEGELE_TAGE);
      out.push(prop(f, 'entbindung_am', 'arzt', ttmmjj(d), 'Aus der letzten Periode + 280 Tage (Naegele) berechnet – der Arzt prüft (Zyklus, Ultraschall).', lp[0], 'm03.daten'));
    }
    return out;
  },
  extra: rules('muster-03', (v, add, _on, has) => {
    const u = textOf(v, 'untersuchung_am');
    const e = textOf(v, 'entbindung_am');
    if (validTTMMJJ(u) && validTTMMJJ(e) && fromTTMMJJ(e) <= fromTTMMJJ(u)) add('unzulaessig', 'Der mutmaßliche Entbindungstag liegt nicht nach dem Untersuchungstag.', ['entbindung_am'], 'm03.daten');
    if (validTTMMJJ(u) && fromTTMMJJ(u) > heute()) add('unzulaessig', 'Untersuchungstag liegt in der Zukunft – das Zeugnis setzt eine erfolgte Untersuchung voraus.', ['untersuchung_am'], 'm03.untersuchung');
    if (validTTMMJJ(u) && validTTMMJJ(e) && tage(u, e) > SCHWANGERSCHAFT_MAX_TAGE) add('hinweis', 'Der Entbindungstermin liegt mehr als 300 Tage nach der Untersuchung – bitte prüfen.', ['entbindung_am'], 'm03.daten');
    if (!has('feststellungen')) add('hinweis', 'Für spätere Streitfälle in der Kartei festhalten: letzte Periode, erste Kindsbewegung, Stand des Fundus uteri.', [], 'm03.dokumentation');
  }),
};

export const SPEC_05: Partial<GenericSpec> = {
  extra: rules('muster-05', (_v, add, on, has, facts) => {
    if (on('belegaerztlich') && (!has('belegarzt_von') || !has('belegarzt_bis'))) add('fehlt', 'Belegärztliche Behandlung: Zeitraum des stationären Aufenthalts angeben.', ['belegarzt_von', 'belegarzt_bis'], 'm05.belegarzt_zeitraum');
    if (on('psychotherapie') && !has('anerkennungsbescheid')) add('fehlt', 'Anerkannte Psychotherapie: Datum des Anerkennungsbescheids der Krankenkasse eintragen.', ['anerkennungsbescheid'], 'm05.psychotherapie');
    if (facts.ssw && !has('entbindung')) add('hinweis', 'Bei Mutterschaftsvorsorge den mutmaßlichen Entbindungstag (TTMMJJ) angeben.', ['entbindung'], 'm05.mutterschaft');
    if (facts.unfall && !on('unfall')) add('hinweis', 'Unfall erwähnt: Unfallfeld ankreuzen, damit die Kasse Kosten bei Dritten geltend machen kann.', ['unfall'], 'm05.unfall');
    add('hinweis', 'Die Patientin/der Patient bestätigt die Versicherung mit Datum und Unterschrift (entfällt u. a. vor dem 15. Lebensjahr).', [], 'm05.patient_unterschrift');
  }),
};

export const SPEC_07: Partial<GenericSpec> = {
  extra: rules('muster-07', (_v, add) => {
    add('hinweis', 'Muster 7 stellt die Psychotherapeutin/der Psychotherapeut aus; der Konsiliararzt antwortet mit Muster 22 spätestens drei Wochen nach der Untersuchung.', [], 'm07.ausfuellen');
  }),
};

export const SPEC_11: Partial<GenericSpec> = {
  required: ['datum_untersuchung'],
  oneOf: [{ ids: ['diagnose', 'befunde'], text: 'Diagnose angeben – oder, falls noch keine Diagnose möglich ist, die Befunde.' }],
  propose: (text, _f, today) => {
    const f = getForm('muster-11');
    return cue(/\b(heute untersucht|untersuchung heute|heutige untersuchung)\b/iu, text) ? [prop(f, 'datum_untersuchung', 'vorgeschlagen', ttmmjj(today), 'Beurteilung nach dem Krankheitszustand am Untersuchungstag (heute).', null, 'm11.beurteilung')] : [];
  },
  extra: rules('muster-11', (_v, add, on, has, facts) => {
    if (on('mitbehandlung_ja') && on('mitbehandlung_nein')) add('unzulaessig', 'Mitbehandlung: entweder ja oder nein.', ['mitbehandlung_ja', 'mitbehandlung_nein'], 'm11.zweck');
    if (on('mitbehandlung_ja') && !has('mitbehandlung_fachbereich')) add('fehlt', 'Mitbehandlung: Fachbereich angeben.', ['mitbehandlung_fachbereich'], 'm11.zweck');
    if (has('arbeitsfaehig_ab') && has('voraussichtlich_arbeitsfaehig_ab')) add('hinweis', '„Arbeitsfähig ab“ und „voraussichtlich arbeitsfähig ab“ zugleich angegeben – bitte prüfen.', ['arbeitsfaehig_ab', 'voraussichtlich_arbeitsfaehig_ab'], 'm11.beurteilung');
    if (facts.auBis) add('hinweis', 'Endet die Arbeitsunfähigkeit spätestens am Tag der MD-Begutachtung, ist der Vordruck nicht auszufüllen.', [], 'm11.nicht_ausfuellen');
    add('hinweis', 'Vorhandene Befunde mitgeben, um Wiederholungsuntersuchungen zu vermeiden; Röntgenbilder u. Ä. gegen Rückgabe.', [], 'm11.befunde');
  }),
};

export const SPEC_22: Partial<GenericSpec> = {
  required: ['bericht', 'arztnummer', 'betriebsstaettennummer', 'name_therapeut'],
  propose: () => {
    const f = getForm('muster-22');
    return [prop(f, 'chiffre_buchstabe', 'duria', 'aus DURIA', 'Chiffre: Anfangsbuchstabe des Familiennamens – aus den Personalien.', null, 'm22.chiffre'),
      prop(f, 'chiffre_geburtsdatum', 'duria', 'aus DURIA', 'Chiffre: Geburtsdatum – aus den Personalien.', null, 'm22.chiffre')];
  },
  extra: rules('muster-22', (v, add, on, has) => {
    for (const [id, label] of [['arztnummer', 'Arztnummer'], ['betriebsstaettennummer', 'Betriebsstättennummer']] as const) {
      if (has(id) && !NEUN.test(textOf(v, id))) add('unzulaessig', `${label} des überweisenden Therapeuten hat 9 Ziffern (aus Muster 7).`, [id], 'm22.egk_ueberweisender');
    }
    if (on('psych_erforderlich') && on('psych_nicht_erforderlich')) add('unzulaessig', 'Psychiatrische Abklärung: entweder erforderlich oder nicht erforderlich.', ['psych_erforderlich', 'psych_nicht_erforderlich'], 'm22.psych_abklaerung');
    if (on('psych_nicht_erforderlich') && (on('psych_erfolgt') || on('psych_veranlasst'))) add('unzulaessig', '„nicht erforderlich“ und zugleich „erfolgt“ bzw. „veranlasst“.', ['psych_nicht_erforderlich', 'psych_erfolgt', 'psych_veranlasst'], 'm22.psych_abklaerung');
    if (on('mitbehandlung') && !has('art_massnahme')) add('fehlt', 'Ärztliche Mitbehandlung: Art der Maßnahme angeben.', ['art_massnahme'], 'm22.kontraindikation');
    if (has('bericht') && !uni(/\b(befund\w*|beschwerden|anamnese)\b/iu).test(textOf(v, 'bericht'))) add('hinweis', 'Pflichtangaben: aktuelle Beschwerden, relevante Anamnese und insbesondere der somatische Befund.', ['bericht'], 'm22.pflichtangaben');
    add('hinweis', 'Bericht spätestens drei Wochen nach der Untersuchung übermitteln; 22d direkt an die Krankenkasse (ohne Berichtsangaben).', [], 'm22.frist');
  }),
};

export const SPEC_28: Partial<GenericSpec> = {
  extra: rules('muster-28', (_v, add, on) => {
    const kh = ['kh_vermieden', 'kh_verkuerzt', 'kh_nicht_ausfuehrbar'].filter(on);
    if (kh.length > 1) add('unzulaessig', 'Krankenhausbehandlung: nur die zutreffende Angabe ankreuzen.', kh, 'm28.krankenhaus');
    add('hinweis', 'Überweisung zur Indikationsstellung bei begründetem Verdacht; keine Genehmigung der Kasse nötig. Ein hinzugezogener Leistungserbringer hat höchstens 5 Einheiten.', [], 'm28.voraussetzung');
  }),
};

export const SPEC_36: Partial<GenericSpec> = {
  extra: rules('muster-36', (_v, add) => {
    add('hinweis', 'Die Empfehlung begründet keinen Anspruch; die Patientin/der Patient informiert sich bei der Kasse über anerkannte Präventionsangebote.', [], 'm36.zweck');
  }),
};

export const SPEC_50: Partial<GenericSpec> = {
  extra: rules('muster-50', (_v, add, on, has) => {
    if (on('name_richtig_nein') && !has('name_berichtigt') && !has('geburtsdatum_berichtigt')) add('fehlt', 'Name/Geburtsdatum falsch wiedergegeben: berichtigen.', ['name_berichtigt', 'geburtsdatum_berichtigt'], 'm50.frage_name');
    if (on('ausweis_ja') && !has('krankenkasse_name')) add('fehlt', 'Behandlungsausweis lag vor: Namen der Krankenkasse präzise angeben.', ['krankenkasse_name'], 'm50.kassenname');
    const tag = has('behandlungstag_01');
    if (has('neue_krankenkasse_name') && (!tag || !has('ebm_01'))) add('fehlt', 'Kassenwechsel: Behandlungstage mit EBM-Nr. angeben.', ['behandlungstag_01', 'ebm_01'], 'm50.kassenname');
    if (!has('neue_krankenkasse_name') && tag) add('hinweis', 'Behandlungstage mit EBM-Nr. nur bei Angabe einer neuen Krankenkasse ausfüllen.', ['behandlungstag_01'], 'm50.nur_neue_kasse');
  }),
};

const SEC1 = ['ueberweisung', 'leistungen', 'behandlung_dauert', 'spaetfolgen'] as const;
export const SPEC_51: Partial<GenericSpec> = {
  optionalGroups: [...SEC1, 'diagnose_ser'],
  extra: (v, facts) => {
    const f = getForm('muster-51');
    const ids = (g: string) => f.fields.filter((x) => x.group === g).map((x) => x.id);
    const answered = (g: string) => ids(g).filter((id) => isChecked(v, id));
    return rules('muster-51', (_v, add, on, has) => {
      const s1 = SEC1.some((g) => answered(g).length);
      const s2 = answered('diagnose_ser').length > 0 || on('au_schaedigungsfolgen') || on('au_andere');
      if (!s1 && !s2) add('fehlt', 'Den von der Kasse gefragten Sachverhalt beantworten: 1. (Unfall) und/oder 2. (Versorgungsleiden).', [...ids('ueberweisung'), ...ids('diagnose_ser')], 'm51.ausfuellen');
      if (s1) for (const g of SEC1) if (answered(g).length !== 1) add(answered(g).length ? 'unzulaessig' : 'fehlt', `Zu 1.: ${f.groups.find((x) => x.id === g)?.label ?? g} – genau eine Antwort.`, ids(g), f.groups.find((x) => x.id === g)!.rule.id);
      if (s2 && answered('diagnose_ser').length !== 1) add(answered('diagnose_ser').length ? 'unzulaessig' : 'fehlt', 'Zu 2.: Zusammenhang mit den anerkannten Versorgungsleiden – genau eine Antwort.', ids('diagnose_ser'), 'm51.frage_diagnose_ser');
      if (on('ueberw_ja') && (!answered('ueberweisung_richtung').length || !has('ueberw_arzt_name'))) add('fehlt', 'Überweisung: Richtung (an/von) sowie Name und Anschrift des Arztes angeben.', ['ueberw_an', 'ueberw_von', 'ueberw_arzt_name'], 'm51.frage_ueberweisung');
      if (on('leistungen_ja') && !has('leistungen_welche')) add('fehlt', 'Veranlasste Leistungen genau bezeichnen.', ['leistungen_welche'], 'm51.frage_leistungen');
      for (const [cb, a, b] of [['au_schaedigungsfolgen', 'au_schaedigungsfolgen_vom', 'au_schaedigungsfolgen_bis'], ['au_andere', 'au_andere_vom', 'au_andere_bis']] as const) {
        if (on(cb) && (!has(a) || !has(b))) add('fehlt', 'Arbeitsunfähigkeit/Einweisung: Zeitraum „vom … bis …“ angeben.', [a, b], 'm51.au_krankenhaus_ser');
      }
      if (!has('z1_tag_01') && !has('z2_tag_01')) add('fehlt', 'Behandlungstage mit EBM-Nr. „in jedem Fall“ ausfüllen.', ['z1_tag_01', 'z2_tag_01'], 'm51.in_jedem_fall');
    })(v, facts);
  },
};

export const SPEC_53: Partial<GenericSpec> = {
  optionalGroups: ['nur_hinzugetreten', 'hinzu_dieselbe'],
  extra: rules('muster-53', (_v, add, on, has) => {
    if (on('dieselbe_ja') && !has('dieselbe_ziffern')) add('fehlt', '„Dieselbe Krankheit – ja“: Ziffer(n) der betreffenden Krankheiten angeben.', ['dieselbe_ziffern'], 'm53.frage_i_ii');
    if (on('hinzu_ja')) {
      if (!has('hinzu_krankheiten')) add('fehlt', 'Hinzugetretene Krankheit(en) angeben – nur solche, die allein Arbeitsunfähigkeit ausgelöst hätten.', ['hinzu_krankheiten'], 'm53.diagnosen');
      if (!has('hinzu_am')) add('fehlt', 'Datum angeben, an dem die Krankheit hinzugetreten ist.', ['hinzu_am'], 'm53.frage_iii');
      for (const [ja, nein, rule] of [['nur_ja', 'nur_nein', 'm53.frage_nur_hinzugetreten'], ['hinzu_dieselbe_ja', 'hinzu_dieselbe_nein', 'm53.frage_hinzugetreten_ii']] as const) {
        const n = [ja, nein].filter(on).length;
        if (n !== 1) add(n ? 'unzulaessig' : 'fehlt', 'Bei hinzugetretener Krankheit: ja oder nein ankreuzen.', [ja, nein], rule);
      }
      if (on('nur_ja') && (!has('nur_krankheiten') || !has('nur_ab'))) add('fehlt', 'AU nur noch durch hinzugetretene Krankheit: Krankheit und Datum „ab“ angeben.', ['nur_krankheiten', 'nur_ab'], 'm53.frage_nur_hinzugetreten');
      if (on('hinzu_dieselbe_ja') && !has('hinzu_dieselbe_ziffern')) add('fehlt', 'Hinzugetretene Krankheit = frühere Erkrankung: Ziffer(n) angeben.', ['hinzu_dieselbe_ziffern'], 'm53.frage_hinzugetreten_ii');
    } else if (['nur_ja', 'nur_nein', 'hinzu_dieselbe_ja', 'hinzu_dieselbe_nein'].some(on)) {
      add('hinweis', 'Fragen zur hinzugetretenen Krankheit nur beantworten, wenn unter III. „ja“ angekreuzt ist.', ['hinzu_ja'], 'm53.frage_iii');
    }
  }),
};

const SECHS_MONATE = 183;
const ZWOELF_MONATE = 366;
export const SPEC_62A: Partial<GenericSpec> = {
  required: ['massnahmen', 'datum_erhebung'],
  extra: rules('muster-62a', (v, add, on, has) => {
    for (const z of ['beatmung', 'dekanuelierung'] as const) {
      const n = [`vor_${z}`, `persp_${z}`, `nicht_${z}`].filter(on);
      if (n.length > 1) add('unzulaessig', `${z === 'beatmung' ? 'Beatmungsentwöhnung' : 'Dekanülierung'}: nur ein Ergebnis ankreuzen.`, n, 'm62a.ergebnis');
    }
    if ((on('vor_beatmung') || on('vor_dekanuelierung')) && (!has('empfehlung_einrichtung') || !has('termin'))) add('fehlt', 'Potenzial liegt vor: spezialisierte Einrichtung empfehlen und geplanten Termin angeben.', ['empfehlung_einrichtung', 'termin'], 'm62a.ergebnis');
    if ((on('persp_beatmung') || on('persp_dekanuelierung')) && !has('vorbereitende_massnahmen')) add('fehlt', 'Potenzial perspektivisch: vorbereitende Maßnahmen angeben.', ['vorbereitende_massnahmen'], 'm62a.ergebnis');
    if ((on('nicht_beatmung') || on('nicht_dekanuelierung')) && !has('begruendung')) add('fehlt', 'Potenzial liegt nicht vor: begründen.', ['begruendung'], 'm62a.ergebnis');
    if (['vor_dekanuelierung', 'persp_dekanuelierung', 'nicht_dekanuelierung'].some(on) && !has('schluckdiagnostik')) add('fehlt', 'Dekanülierung beurteilt: Befund der ärztlichen Schluckdiagnostik angeben.', ['schluckdiagnostik'], 'm62a.schluck');
    if (!on('entfall_therapieoptimierung') && !has('therapieoptimierung')) add('fehlt', 'Maßnahmen der Therapieoptimierung angeben – die Prüfung ist bei allen Versicherten notwendig.', ['therapieoptimierung'], 'm62a.therapieoptimierung');
    const a = textOf(v, 'datum_erhebung');
    const b = textOf(v, 'datum_naechste');
    if (!on('entfall_erhebung') && !b) add('fehlt', 'Termin der nächsten Erhebung angeben.', ['datum_naechste'], 'm62a.intervall');
    if (validTTMMJJ(a) && validTTMMJJ(b)) {
      const d = tage(a, b);
      const max = (on('nicht_beatmung') || on('nicht_dekanuelierung')) ? ZWOELF_MONATE : SECHS_MONATE;
      if (d < 0) add('unzulaessig', 'Die nächste Erhebung liegt vor der jetzigen.', ['datum_naechste'], 'm62a.intervall');
      else if (d > max) add('hinweis', `Nächste Erhebung nach ${d} Tagen: in der Regel alle sechs Monate (bei dauerhaft fehlendem Potenzial alle 12).`, ['datum_naechste'], 'm62a.intervall');
    }
    add('hinweis', 'Erhebung nur durch besonders qualifizierte Ärztinnen und Ärzte mit KV-Genehmigung; mindestens einmal jährlich persönlich.', [], 'm62a.qualifikation');
  }),
};

function spec70(id: 'muster-70' | 'muster-70a'): Partial<GenericSpec> {
  const r = (s: string) => (id === 'muster-70' ? `m70.${s}` : `m70a.${s === 'indikationen' || s === 'bisherige_behandlungen' || s === 'kosten' ? `m70_${s}` : s}`);
  return {
    required: id === 'muster-70' ? ['indikation', 'kosten_b_gesamt_f', 'ort'] : ['indikation', 'vorplan_datum', 'kosten_b_gesamt_f', 'ort'],
    propose: () => [prop(getForm(id), 'personalien_mann', 'unbekannt', null, 'Daten des Ehemannes von Hand oder mit Personalfeldaufkleber eintragen (nicht bedruckbar).', null, r('personalfeld_mann'))],
    extra: rules(id, (v, add, on) => {
      const m = ['insem_spontan', 'insem_stimulation', 'ivf', 'gift', 'icsi'].filter(on);
      if (m.length > 1) add('unzulaessig', 'Nur eine geplante Behandlungsmaßnahme je Plan – bei Änderung der Methode neuer Plan.', m, r('massnahme'));
      if (on('icsi') && !uni(/\b(männlich\w*|androlog\w*|oligo\w*|astheno\w*|terato\w*|azoosperm\w*|11\.5)\b/iu).test(textOf(v, 'indikation'))) add('hinweis', 'ICSI ist bei männlicher Fertilitätsstörung (Nr. 11.5) indiziert – Indikation in der vorgegebenen Formulierung angeben.', ['indikation'], r('indikationen'));
      const bisher = textOf(v, 'bisherige_behandlungen');
      if (bisher && !uni(/\d+\s*x\s*10\.[1-5]/iu).test(bisher)) add('hinweis', 'Bisherige Behandlungen als Anzahl und Methode angeben (z. B. „5 x 10.1“).', ['bisherige_behandlungen'], r('bisherige_behandlungen'));
      if (id === 'muster-70a' && bisher && !uni(/ohne (?:eintritt einer )?schwangerschaft/iu).test(bisher)) add('fehlt', 'Folgeplan: zusätzlich die Anzahl der Versuche ohne Schwangerschaft angeben (z. B. „1 x ohne Schwangerschaft“).', ['bisherige_behandlungen'], 'm70a.position_ii');
      if (id === 'muster-70a') {
        const vp = textOf(v, 'vorplan_datum');
        if (validTTMMJJ(vp) && fromTTMMJJ(vp) > heute()) add('unzulaessig', 'Datum des vorangegangenen Plans liegt in der Zukunft.', ['vorplan_datum'], 'm70a.formularkopf');
      }
      add('hinweis', 'Kostenschätzung mit den EBM-Positionen der Bundesempfehlung; Genehmigung durch beide Krankenkassen vor Beginn; neuer Plan spätestens nach einem Jahr.', [], r('kosten'));
    }),
  };
}
export const SPEC_70 = spec70('muster-70');
export const SPEC_70A = spec70('muster-70a');
