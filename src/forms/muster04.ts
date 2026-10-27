import { checkbox, exactlyOne, formatIssues, isChecked, issue, pickOne, prop, textOf } from './build.js';
import { getForm } from './catalog.js';
import { personalien, stempel } from './common.js';
import { befoerderungB } from './facts.js';
import { specialtyIn } from './specialties.js';
import { cue, dateAfter, uni } from './text.js';
import type { FieldProposal, FormIssue, FormProposal, FormValues, PatientFacts } from './types.js';

/** Muster 4 – Verordnung einer Krankenbeförderung (Stand 7.2020). Regeln: Erläuterungen Januar 2026, S. 17–23. */
const form = getForm('muster-04');

const KTW = /\b(KTW|krankentransportwagen|krankentransport|liegendtransport|fachgerecht\w* (?:lagern|tragen|heben)|medizinisch-?fachliche betreuung)\b/iu;

type Grund = 'a_stationaer' | 'a_vornach' | 'b_ambulant' | 'c_anderer' | 'd_hochfrequent' | 'e_mobilitaet' | 'f_ktw';

function grund(text: string, facts: PatientFacts): { id: Grund | null; reason: string; evidence: string | null; cText: string | null } {
  const none = { cText: null };
  const vornach = cue(/\b(vor-?\s*\/?\s*(?:und\s+)?nachstationär\w*|vorstationär\w*|nachstationär\w*)/iu, text);
  if (vornach) return { id: 'a_vornach', reason: 'Fahrt zur vor- bzw. nachstationären Behandlung – genehmigungsfrei.', evidence: vornach, ...none };
  const stat = cue(/\b(stationär\w*|einweisung|krankenhausaufnahme|aufnahme ins krankenhaus|krankenhausbehandlung|entlassung)\b/iu, text);
  if (stat) return { id: 'a_stationaer', reason: 'Fahrt zur stationären Krankenhausbehandlung – genehmigungsfrei.', evidence: stat, ...none };
  const anderer = cue(/\b(hospiz\w*|kurzzeitpflege|verlegung\w*|rettungsfahrt|stationsersetzend\w*)/iu, text);
  if (anderer) return { id: 'c_anderer', reason: 'Anderer genehmigungsfreier Grund – Anlass in die Freitextzeile.', evidence: anderer, cText: anderer };
  if (facts.hochfrequent) return { id: 'd_hochfrequent', reason: `Hochfrequente Behandlung (${facts.hochfrequent.value}) – genehmigungspflichtig.`, evidence: facts.hochfrequent.evidence, ...none };
  const b = befoerderungB(facts);
  if (b.ok === true) {
    const ktw = cue(KTW, text);
    if (ktw) return { id: 'f_ktw', reason: `${b.why}, aber KTW nötig – KTW-Fahrten sind unter f) zu verordnen (genehmigungspflichtig).`, evidence: ktw, ...none };
    return { id: 'b_ambulant', reason: `Fahrt zur ambulanten Behandlung genehmigungsfrei: ${b.why} (nur Taxi/Mietwagen).`, evidence: b.evidence, ...none };
  }
  const ktw = cue(KTW, text);
  if (ktw) return { id: 'f_ktw', reason: 'KTW wegen fachlicher Betreuung bzw. Einrichtung – genehmigungspflichtig.', evidence: ktw, ...none };
  return { id: null, reason: b.ok === false ? `${b.why}; für ambulante Fahrten ggf. e) (vergleichbare Mobilitätsbeeinträchtigung, mind. 6 Monate) prüfen.` : `Grund der Fahrt unklar (${b.why}).`, evidence: b.evidence, ...none };
}

function mittel(text: string, g: Grund | null): { id: string | null; reason: string; evidence: string | null } {
  const naw = cue(/\b(NAW|NEF|notarzt\w*)\b/iu, text);
  if (naw) return { id: 'naw', reason: 'Notarztwagen bzw. -einsatzfahrzeug.', evidence: naw };
  const rtw = cue(/\b(RTW|rettungswagen)\b/iu, text);
  if (rtw) return { id: 'rtw', reason: 'Rettungswagen für Notfallpatienten.', evidence: rtw };
  const rth = cue(/\b(RTH|rettungshubschrauber|hubschrauber)\b/iu, text);
  if (rth) return { id: 'andere', reason: 'Anderes Beförderungsmittel.', evidence: rth };
  const ktw = cue(KTW, text);
  if (ktw || g === 'f_ktw') return { id: 'ktw', reason: 'KTW, weil fachliche Betreuung oder Einrichtung nötig ist.', evidence: ktw };
  const taxi = cue(/\b(taxi\w*|mietwagen)\b/iu, text);
  if (taxi) return { id: 'taxi', reason: 'Taxi/Mietwagen ohne fachliche Betreuung.', evidence: taxi };
  if (g === 'b_ambulant') return { id: 'taxi', reason: 'Bei b) ist nur Taxi/Mietwagen möglich.', evidence: null };
  return { id: null, reason: 'Beförderungsmittel wählen (Taxi/Mietwagen, KTW, RTW, NAW/NEF).', evidence: null };
}

function fahrten(text: string): FieldProposal[] {
  const beide = cue(/\b(hin-?\s*und\s*rückfahrt|hin und zurück|hin- und rück)/iu, text);
  const nurRueck = cue(/\bnur\s+(?:die\s+)?rückfahrt\b/iu, text);
  const nurHin = cue(/\bnur\s+(?:die\s+)?hinfahrt\b/iu, text);
  if (beide) return [checkbox(form, 'hinfahrt', beide, 'Hinfahrt.'), checkbox(form, 'rueckfahrt', beide, 'Rückfahrt.')];
  if (nurRueck) return [prop(form, 'hinfahrt', 'leer', false, 'Nur die Rückfahrt.', nurRueck), checkbox(form, 'rueckfahrt', nurRueck, 'Nur die Rückfahrt.')];
  if (nurHin) return [checkbox(form, 'hinfahrt', nurHin, 'Nur die Hinfahrt.'), prop(form, 'rueckfahrt', 'leer', false, 'Nur die Hinfahrt.', nurHin)];
  const hint = 'Hin- und Rückfahrt getrennt prüfen.';
  return [prop(form, 'hinfahrt', 'unbekannt', null, hint), prop(form, 'rueckfahrt', 'unbekannt', null, hint)];
}

function zuzahlung(facts: PatientFacts): FieldProposal[] {
  const frei = facts.arbeitsunfall ?? facts.versorgungsleiden ?? facts.zuzahlungsbefreit;
  return frei
    ? pickOne(form, 'zuzahlung', 'zuzahlungsfrei', 'Zuzahlungsfrei: Unfallversicherung, Versorgungsleiden oder nachgewiesene Befreiung.', frei.evidence)
    : pickOne(form, 'zuzahlung', 'zuzahlungspflicht', 'Krankenbeförderung ist grundsätzlich zuzahlungspflichtig.', null);
}

export function proposeMuster04(text: string, facts: PatientFacts): FormProposal {
  const g = grund(text, facts);
  const m = mittel(text, g.id);
  const vom = dateAfter(/\b(?:termin|behandlungstag|behandlung)\s*(?:am|vom)?/i, text);
  const bis = dateAfter(/\bbis\s+voraussichtlich/i, text);
  const freq = uni(/\b(\d{1,2})\s*(?:x|×|mal)\s*(?:pro|\/|die|in der)\s*woche/iu).exec(text);
  const spec = specialtyIn(text);
  const statte = spec ? `Fachrichtung: ${spec.name}` : null;
  const aus = facts.ausstattung?.value ?? [];
  const ausEv = facts.ausstattung?.evidence ?? null;
  const fields: FieldProposal[] = [
    ...zuzahlung(facts),
    personalien(form),
    checkbox(form, 'unfall', facts.unfall?.evidence ?? null, 'Unfall bzw. Unfallfolge.', 'm04.kennzeichen'),
    checkbox(form, 'arbeitsunfall', facts.arbeitsunfall?.evidence ?? null, 'Arbeitsunfall oder Berufskrankheit – zu Lasten der Unfallversicherung.', 'm04.arbeitsunfall'),
    checkbox(form, 'versorgungsleiden', facts.versorgungsleiden?.evidence ?? null, 'Anerkannte Schädigungsfolge (SER/BVG).', 'm04.ser'),
    ...fahrten(text),
    ...pickOne(form, 'grund', g.id, g.reason, g.evidence),
    g.cText ? prop(form, 'c_text', 'vorgeschlagen', g.cText, 'Anlass des anderen Grundes.', g.cText, 'm04.c') : prop(form, 'c_text', 'leer', null, 'Nur bei c) anderer Grund.', null, 'm04.c'),
    vom?.value ? prop(form, 'behandlung_vom', 'vorgeschlagen', vom.value, '(Voraussichtlicher) Behandlungstag.', vom.evidence) : prop(form, 'behandlung_vom', 'unbekannt', null, 'Behandlungstag eintragen; fehlt er bei genehmigungsfreien Fahrten, Begründung unter 4.'),
    freq ? prop(form, 'frequenz', 'vorgeschlagen', freq[1]!, 'Behandlungsfrequenz pro Woche.', freq[0], 'm04.behandlungstag') : prop(form, 'frequenz', 'leer', null, 'Nur bei Serienbehandlung.', null, 'm04.behandlungstag'),
    bis?.value ? prop(form, 'behandlung_bis', 'vorgeschlagen', bis.value, 'Voraussichtliches Ende der Serie.', bis.evidence, 'm04.behandlungstag') : prop(form, 'behandlung_bis', 'leer', null, 'Nur bei Serienbehandlung.', null, 'm04.behandlungstag'),
    statte ? prop(form, 'behandlungsstaette', 'vorgeschlagen', statte, 'Fachrichtung des Vertragsarztes ist als Behandlungsstätte zulässig; nächsterreichbare geeignete Stelle.', spec?.evidence ?? null)
      : prop(form, 'behandlungsstaette', 'unbekannt', null, 'Behandlungsstätte (Name, Ort oder Fachrichtung) ergänzen.'),
    ...pickOne(form, 'mittel', m.id, m.reason, m.evidence),
    m.id === 'ktw' ? prop(form, 'ktw_grund', 'arzt', null, 'Art und Ausmaß der Funktionsstörung angeben (nicht nur die Diagnose), ggf. mit ICD-10.', null, 'm04.ktw')
      : prop(form, 'ktw_grund', 'leer', null, 'Nur bei KTW.', null, 'm04.ktw'),
    checkbox(form, 'rollstuhl', aus.includes('rollstuhl') ? ausEv : null, 'Nicht gehfähig, Beförderung im eigenen Rollstuhl.', 'm04.ausstattung'),
    checkbox(form, 'tragestuhl', aus.includes('tragestuhl') ? ausEv : null, 'Nicht gehfähig, sitzend mit Tragestuhl.', 'm04.ausstattung'),
    checkbox(form, 'liegend', aus.includes('liegend') ? ausEv : null, 'Nur liegend transportierbar.', 'm04.ausstattung'),
    m.id === 'andere' ? prop(form, 'andere_text', 'vorgeschlagen', m.evidence, 'Anderes Beförderungsmittel.', m.evidence, 'm04.andere') : prop(form, 'andere_text', 'leer', null, 'Nur bei „andere“.', null, 'm04.andere'),
    prop(form, 'begruendung', 'arzt', null, g.id === 'e_mobilitaet' || g.id === 'd_hochfrequent'
      ? 'Bei vergleichbarem Ausnahmefall oder e) Pflicht: Vergleichbarkeit begründen (ggf. ICD-10).'
      : 'Sonstiges, z. B. Beginn der stationären Behandlung, Wartezeit, Begleitperson, fehlender Behandlungstag.'),
    stempel(form),
  ];
  return { formId: 'muster-04', fields, generator: 'regelbasiert' };
}

const GENEHMIGUNGSPFLICHTIG = ['d_hochfrequent', 'd_vergleichbar', 'e_mobilitaet', 'f_ktw'];

function grundIssues(values: FormValues, facts: PatientFacts): FormIssue[] {
  const out: FormIssue[] = [];
  if (isChecked(values, 'b_ambulant')) {
    const b = befoerderungB(facts);
    if (b.ok === false) out.push(issue(form, 'unzulaessig', `b) ist so nicht möglich: ${b.why}. Nur bei Merkzeichen aG/Bl/H oder Pflegegrad 3 (mit dauerhafter Mobilitätsbeeinträchtigung), 4 oder 5; sonst ggf. e) mit Genehmigung.`, ['b_ambulant'], 'm04.b'));
    if (b.ok === null) out.push(issue(form, 'fehlt', `b): ${b.why}. Bescheid über den Pflegegrad bzw. Schwerbehindertenausweis muss bei der Verordnung vorliegen.`, ['b_ambulant'], 'm04.b'));
    if (isChecked(values, 'ktw')) out.push(issue(form, 'unzulaessig', 'Bei b) nur Taxi/Mietwagen – eine Fahrt mit KTW ist unter f) zu verordnen.', ['b_ambulant', 'ktw'], 'm04.b'));
  }
  if (GENEHMIGUNGSPFLICHTIG.some((id) => isChecked(values, id))) out.push(issue(form, 'hinweis', 'Genehmigungspflichtig: Der Patient legt die Verordnung vor Fahrtantritt der Krankenkasse vor.', [], 'm04.genehmigung'));
  if ((isChecked(values, 'd_vergleichbar') || isChecked(values, 'e_mobilitaet')) && !textOf(values, 'begruendung')) {
    out.push(issue(form, 'fehlt', 'Vergleichbarkeit unter 4. „Begründung/Sonstiges“ begründen, ggf. mit ICD-10.', ['begruendung'], isChecked(values, 'e_mobilitaet') ? 'm04.e' : 'm04.d_vergleichbar'));
  }
  if (isChecked(values, 'f_ktw') && !isChecked(values, 'ktw')) out.push(issue(form, 'unzulaessig', 'f) ist eine Fahrt mit KTW – unter 3. „KTW“ ankreuzen.', ['f_ktw', 'ktw'], 'm04.f'));
  if (isChecked(values, 'c_anderer') && !textOf(values, 'c_text')) out.push(issue(form, 'fehlt', 'c) anderer Grund: Anlass in die Freitextzeile eintragen.', ['c_text'], 'm04.c'));
  if (uni(/\bkatarakt\w*|grauer star\b/iu).test(textOf(values, 'c_text'))) out.push(issue(form, 'unzulaessig', 'Nicht stationsersetzende ambulante Operationen (z. B. Katarakt) sind nicht verordnungsfähig.', ['c_text'], 'm04.c'));
  if (isChecked(values, 'a_vornach')) out.push(issue(form, 'hinweis', 'Vorstationär höchstens 3 Behandlungstage in 5 Tagen vor, nachstationär höchstens 7 in 14 Tagen nach dem Aufenthalt; Beginn der stationären Behandlung unter 4.', ['a_vornach'], 'm04.a'));
  return out;
}

export function checkMuster04(values: FormValues, facts: PatientFacts): FormIssue[] {
  const out: FormIssue[] = [];
  const add = (i: FormIssue | null) => { if (i) out.push(i); };
  if (facts.fahrtOhneGrund) add(issue(form, 'unzulaessig', `„${facts.fahrtOhneGrund.evidence}“: keine Fahrt ohne zwingenden medizinischen Grund bzw. zu Leistungen der Pflegeversicherung.`, [], 'm04.nicht_verordnungsfaehig'));
  add(exactlyOne(form, values, 'zuzahlung', 'm04.zuzahlung'));
  const begruendetFrei = facts.arbeitsunfall || facts.versorgungsleiden || facts.zuzahlungsbefreit || isChecked(values, 'arbeitsunfall') || isChecked(values, 'versorgungsleiden');
  if (isChecked(values, 'zuzahlungsfrei') && !begruendetFrei) add(issue(form, 'fehlt', '„Zuzahlungsfrei“ nur bei Unfallversicherung, Versorgungsleiden oder nachgewiesener Befreiung – Nachweis fehlt.', ['zuzahlungsfrei'], 'm04.zuzahlung'));
  if (isChecked(values, 'arbeitsunfall')) {
    if (isChecked(values, 'zuzahlungspflicht')) add(issue(form, 'unzulaessig', 'Bei Arbeitsunfall/Berufskrankheit „zuzahlungsfrei“ ankreuzen (zu Lasten der Unfallversicherung).', ['zuzahlungspflicht'], 'm04.zuzahlung'));
    add(issue(form, 'hinweis', 'Im Personalienfeld den zuständigen Unfallversicherungsträger benennen.', ['personalien'], 'm04.personalien'));
  }
  if (isChecked(values, 'unfall') && isChecked(values, 'arbeitsunfall')) add(issue(form, 'unzulaessig', 'Entweder „Unfall“ oder „Arbeitsunfall, Berufskrankheit“ – nicht beides.', ['unfall', 'arbeitsunfall'], 'm04.kennzeichen'));
  if (!isChecked(values, 'hinfahrt') && !isChecked(values, 'rueckfahrt')) add(issue(form, 'fehlt', 'Hinfahrt und/oder Rückfahrt ankreuzen (Notwendigkeit je Richtung prüfen).', ['hinfahrt', 'rueckfahrt'], 'm04.fahrt'));
  add(exactlyOne(form, values, 'grund', 'm04.grund'));
  out.push(...grundIssues(values, facts));
  add(exactlyOne(form, values, 'mittel', 'm04.mittel'));
  if (isChecked(values, 'ktw') && !textOf(values, 'ktw_grund')) add(issue(form, 'fehlt', 'KTW: Art und Ausmaß der Funktionsstörung angeben (z. B. Blutungsgefahr), nicht nur die Diagnose.', ['ktw_grund'], 'm04.ktw'));
  const ausstattung = ['rollstuhl', 'tragestuhl', 'liegend'].filter((id) => isChecked(values, id));
  if (ausstattung.length && !isChecked(values, 'taxi') && !isChecked(values, 'ktw')) add(issue(form, 'unzulaessig', 'Rollstuhl, Tragestuhl oder liegend nur zusammen mit Taxi/Mietwagen oder KTW.', ausstattung, 'm04.ausstattung'));
  if (isChecked(values, 'andere') && !textOf(values, 'andere_text')) add(issue(form, 'fehlt', '„andere“: Beförderungsmittel benennen (z. B. Rettungshubschrauber).', ['andere_text'], 'm04.andere'));
  if (isChecked(values, 'rtw') || isChecked(values, 'naw')) add(issue(form, 'hinweis', 'Im Notfall kann die Beförderung auch nachträglich verordnet werden.', [], 'm04.vorher'));
  const genehmigungsfrei = ['a_stationaer', 'a_vornach', 'b_ambulant', 'c_anderer'].some((id) => isChecked(values, id));
  if (!textOf(values, 'behandlung_vom')) {
    add(genehmigungsfrei
      ? issue(form, 'hinweis', 'Behandlungstag fehlt – nur im Einzelfall zulässig, dann Begründung unter 4.', ['behandlung_vom'], 'm04.behandlungstag')
      : issue(form, 'fehlt', 'Behandlungstag bzw. -frequenz angeben.', ['behandlung_vom'], 'm04.behandlungstag'));
  }
  if (!textOf(values, 'behandlungsstaette')) add(issue(form, 'fehlt', 'Behandlungsstätte angeben (Name, Ort oder Fachrichtung).', ['behandlungsstaette'], 'm04.behandlungsstaette'));
  out.push(...formatIssues(form, values));
  return out;
}
