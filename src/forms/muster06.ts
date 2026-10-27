import { checkbox, exactlyOne, formatIssues, isChecked, issue, pickOne, prop, textOf } from './build.js';
import { getForm } from './catalog.js';
import { diagnose, icdIssues, labeled, personalien, stempel } from './common.js';
import { proceduresIn, specialtyIn } from './specialties.js';
import { cue, dateAfter, quarterQJJ, reasonPhrase, segment, labeledSegments, uni } from './text.js';
import type { FieldProposal, FormIssue, FormProposal, FormValues, PatientFacts } from './types.js';

/** Muster 6 – Überweisungsschein (Stand 10.2019). Regeln: Erläuterungen Januar 2026, S. 26–29. */
const form = getForm('muster-06');

function art(text: string, reason: string | null): FieldProposal[] {
  const prae = cue(/\b(präventiv\w*|prävention|vorsorge\w*|früherkennung\w*|check-?up)/iu, text);
  if (prae) return pickOne(form, 'art', 'praeventiv', 'Überweisung zur Prävention.', prae);
  const beleg = cue(/\bbeleg(?:arzt|ärztlich)\w*/iu, text);
  if (beleg) return pickOne(form, 'art', 'belegaerztlich', 'Hinzuziehung bei belegärztlicher Behandlung.', beleg);
  const asv = cue(/\b(ASV|116b)\b/u, text);
  if (asv) return pickOne(form, 'art', 'par116b', 'Zuweisung zur Behandlung nach § 116b SGB V (ASV) – innerhalb des ASV-Teams nicht nötig.', asv, 'm06.asv');
  if (reason) return pickOne(form, 'art', 'kurativ', 'Abklärung bzw. Behandlung einer Erkrankung oder Beschwerde ist kurativ.', reason);
  return pickOne(form, 'art', null, 'Aus der Beschreibung geht nicht hervor, ob kurativ oder präventiv.', null);
}

type Zweck = 'auftragsleistung' | 'konsil' | 'mitbehandlung';

function zweck(text: string, procedures: string[], radiology: boolean): { id: Zweck | null; reason: string; evidence: string | null } {
  const explicit: [RegExp, Zweck, string][] = [
    [/\bauftragsleistung\w*|\bauftrag\s*:/iu, 'auftragsleistung', 'Ausdrücklich als Auftrag genannt.'],
    [/\bkonsil\w*/iu, 'konsil', 'Ausdrücklich als Konsiliaruntersuchung genannt.'],
    [/\b(mit-?\/?\s*weiterbehandlung|mitbehandlung|weiterbehandlung|übernahme der behandlung)\b/iu, 'mitbehandlung', 'Ausdrücklich zur Mit- bzw. Weiterbehandlung.'],
    [/\bambulante?n?\s+op(?:eration)?\b/iu, 'mitbehandlung', 'Bei Überweisung zur ambulanten Operation ist „Mit-/Weiterbehandlung“ anzukreuzen.'],
  ];
  for (const [re, id, reason] of explicit) {
    const m = cue(re, text);
    if (m) return { id, reason, evidence: m };
  }
  const durchfuehrung = cue(/\b(zur durchführung|bitte um (?:durchführung|ein(?:e|en)?))\b/iu, text);
  if (procedures.length && (radiology || durchfuehrung)) {
    return { id: 'auftragsleistung', reason: `Konkrete Leistung genannt (${procedures.join(', ')}) – Auftrag nach Art und Umfang.`, evidence: durchfuehrung ?? procedures.join(', ') };
  }
  const abklaerung = cue(/\b(abklärung|mitbeurteilung|zur frage|ausschluss|diagnostik)\b/iu, text);
  if (abklaerung) return { id: 'konsil', reason: 'Diagnostische Abklärung, über deren Umfang der Facharzt entscheidet.', evidence: abklaerung };
  return { id: null, reason: 'Bitte wählen: Auftragsleistung (Leistung genau bestimmt), Konsiliaruntersuchung (Abklärung, Facharzt wählt die Diagnostik) oder Mit-/Weiterbehandlung (auch Therapie).', evidence: null };
}

function auftrag(text: string, z: Zweck | null, procedures: string[], reason: string | null, dringend: string | null): FieldProposal {
  const seg = segment(labeledSegments(text), 'auftrag');
  const tail = dringend ? ' – dringend, bitte zeitnahen Termin' : '';
  if (seg) return prop(form, 'auftrag', 'vorgeschlagen', seg + tail, 'Aus „Auftrag:“ in der Beschreibung übernommen.', seg, 'm06.auftrag');
  if (z === 'auftragsleistung' && procedures.length) {
    const v = `${procedures.join(', ')}${reason ? `; Fragestellung: ${reason}` : ''}${tail}`;
    return prop(form, 'auftrag', 'vorgeschlagen', v, 'Auftragsleistung nach Art und Umfang; der Ausführende darf nur das Angegebene erbringen.', procedures.join(', '), 'm06.auftragsleistung');
  }
  if (reason) {
    const v = `${z === 'konsil' ? 'Abklärung' : 'Fragestellung:'} ${reason}${tail}`;
    return prop(form, 'auftrag', 'vorgeschlagen', v, z === 'konsil' ? 'Bei Konsiliaruntersuchung ist der Grund der Untersuchung einzutragen.' : 'Fragestellung aus der Beschreibung.', reason, z === 'konsil' ? 'm06.konsil' : 'm06.auftrag');
  }
  return prop(form, 'auftrag', 'unbekannt', dringend ? 'dringend, bitte zeitnahen Termin' : null, 'Was soll der Empfänger tun? Leistung bzw. Grund der Untersuchung ergänzen.', dringend, 'm06.auftrag');
}

export function proposeMuster06(text: string, facts: PatientFacts, today: Date): FormProposal {
  const reason = reasonPhrase(text);
  const spec = specialtyIn(text);
  const proc = proceduresIn(text);
  const z = zweck(text, proc.names, spec?.name === 'Radiologie' || spec?.name === 'Nuklearmedizin');
  const op = dateAfter(/\bambulante?n?\s+op(?:eration)?/i, text);
  const au = facts.auBis;
  const fields: FieldProposal[] = [
    personalien(form),
    ...art(text, reason),
    prop(form, 'quartal', 'vorgeschlagen', quarterQJJ(today), 'Quartal der Ausstellung (heute).'),
    checkbox(form, 'unfall', facts.unfall?.evidence ?? null, 'Behandlung wegen oder als Folge eines Unfalls (kein Arbeitsunfall).'),
    op?.value ? prop(form, 'op_datum', 'vorgeschlagen', op.value, 'Datum der ambulanten Operation.', op.evidence)
      : prop(form, 'op_datum', 'leer', null, 'Nur bei Leistungen nach Abschnitt 31.2 EBM (ambulante OP) mit OP-Datum.'),
    prop(form, 'geschlecht', 'duria', 'aus DURIA', 'Wird von der eGK gelesen.'),
    spec ? prop(form, 'ueberweisung_an', 'vorgeschlagen', spec.name, 'Gebietsbezeichnung statt Arztname (freie Arztwahl).', spec.evidence)
      : prop(form, 'ueberweisung_an', 'unbekannt', null, 'Fachgebiet nennen (z. B. „Kardiologie“, „Orthopädie“).'),
    ...pickOne(form, 'auftragsart', z.id, z.reason, z.evidence),
    au?.value ? prop(form, 'au_bis', 'vorgeschlagen', au.value, 'Voraussichtliches Ende der bescheinigten AU – nötig, wenn die Behandlungsführung übergehen soll.', au.evidence)
      : au ? prop(form, 'au_bis', 'unbekannt', null, 'AU erwähnt, aber kein Enddatum.', au.evidence)
        : prop(form, 'au_bis', 'leer', null, 'Keine Arbeitsunfähigkeit erwähnt.'),
    checkbox(form, 'par16', facts.eingeschraenkterAnspruch?.evidence ?? null, 'Eingeschränkter Leistungsanspruch nach § 16 Abs. 3a SGB V – Empfänger informieren.'),
    diagnose(form, text),
    labeled(form, text, 'befund', ['befund', 'befunde', 'untersuchungsergebnis', 'untersuchungsergebnisse', 'ekg', 'labor', 'medikation'], 'Bisherige Befunde und Medikation helfen, Doppeluntersuchungen zu vermeiden (empfohlen).'),
    auftrag(text, z.id, proc.names, reason, facts.dringend?.evidence ?? null),
    stempel(form),
  ];
  return { formId: 'muster-06', fields, generator: 'regelbasiert' };
}

export function checkMuster06(values: FormValues, facts: PatientFacts): FormIssue[] {
  const out: FormIssue[] = [];
  const add = (i: FormIssue | null) => { if (i) out.push(i); };
  if (facts.arbeitsunfall) add(issue(form, 'unzulaessig', `Arbeitsunfall, Berufskrankheit oder Schülerunfall („${facts.arbeitsunfall.evidence}“): Muster 6 ist nicht zu verwenden – Ärztliche Unfallmeldung (F 1050) an den Unfallversicherungsträger.`, [], 'm06.arbeitsunfall'));
  if (facts.wegeunfall) add(issue(form, 'hinweis', `„${facts.wegeunfall.evidence}“: prüfen, ob ein Arbeitsunfall vorliegt – dann nicht Muster 6.`, [], 'm06.arbeitsunfall'));
  add(exactlyOne(form, values, 'art', 'm06.art'));
  add(exactlyOne(form, values, 'auftragsart', 'm06.auftragsart'));
  if (!textOf(values, 'quartal')) add(issue(form, 'fehlt', 'Quartal (QJJ) eintragen.', ['quartal'], 'm06.quartal'));
  const an = textOf(values, 'ueberweisung_an');
  if (!an) add(issue(form, 'fehlt', '„Überweisung an“: Gebiets-, Teilgebiets- oder Zusatzbezeichnung eintragen.', ['ueberweisung_an'], 'm06.ueberweisung_an'));
  else if (uni(/\b(dr\.?|prof\.?|herr[n]?|frau)\s+\p{Lu}/iu).test(an)) add(issue(form, 'hinweis', 'Namentliche Überweisung nur an ermächtigte Ärzte oder Einrichtungen; sonst das Fachgebiet eintragen.', ['ueberweisung_an'], 'm06.ueberweisung_an'));
  const auftrag = textOf(values, 'auftrag');
  if (isChecked(values, 'auftragsleistung') && !auftrag) add(issue(form, 'fehlt', 'Auftragsleistung: Leistung nach Art und Umfang (GOP oder genaue Bezeichnung) unter „Auftrag“ angeben.', ['auftrag'], 'm06.auftragsleistung'));
  if (isChecked(values, 'konsil') && !auftrag) add(issue(form, 'fehlt', 'Konsiliaruntersuchung: Grund der Untersuchung unter „Auftrag“ eintragen.', ['auftrag'], 'm06.konsil'));
  if (uni(/\b(labor\w*|blutbild|blutentnahme|serologie|mikrobiolog\w*)\b/iu).test(auftrag)) add(issue(form, 'hinweis', 'Für Laboruntersuchungen (In-vitro-Diagnostik) gilt Muster 10, nicht Muster 6.', ['auftrag'], 'm06.labor'));
  if (textOf(values, 'au_bis') && !isChecked(values, 'mitbehandlung')) add(issue(form, 'hinweis', '„AU bis“ ist nur nötig, wenn die Behandlungsführung auf den weiterbehandelnden Arzt übergehen soll.', ['au_bis'], 'm06.au_bis'));
  if (isChecked(values, 'unfall') && facts.arbeitsunfall) add(issue(form, 'unzulaessig', '„Unfall“ gilt nicht für Arbeitsunfälle oder Berufskrankheiten.', ['unfall'], 'm06.unfall'));
  if (isChecked(values, 'par116b')) add(issue(form, 'hinweis', 'Innerhalb des ASV-Kernteams ist keine Überweisung nötig; die Kennzeichnung erfolgt über die ASV-Teamnummer.', ['par116b'], 'm06.asv'));
  if (!textOf(values, 'diagnose')) add(issue(form, 'fehlt', 'Diagnose bzw. Verdachtsdiagnose: trägt der Arzt ein.', ['diagnose'], 'm06.diagnose'));
  out.push(...icdIssues(form, values, ['diagnose']));
  if (facts.dringend) add(issue(form, 'hinweis', 'Muster 6 hat kein Feld für Dringlichkeit; „dringend“ steht nur als Text unter „Auftrag“.', ['auftrag'], 'm06.dringlichkeit'));
  out.push(...formatIssues(form, values));
  return out;
}
