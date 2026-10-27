import { uni } from './text.js';

/**
 * Umgangssprachliche Fachrichtung → Gebietsbezeichnung für „Überweisung an“ (Muster 6, ❻: Gebiet statt Name).
 * Bezeichnungen nach der (Muster-)Weiterbildungsordnung; der Vorschlag ist immer zu bestätigen.
 */
export const SPECIALTIES: readonly [RegExp, string][] = [
  [/\bkardiolog\w*|\bherz(?:spezialist|arzt|ärztin)\b/iu, 'Innere Medizin und Kardiologie'],
  [/\bgastroenterolog\w*|\bmagen-?darm/iu, 'Innere Medizin und Gastroenterologie'],
  [/\bpneumolog\w*|\blungen(?:arzt|ärztin|facharzt)\b/iu, 'Innere Medizin und Pneumologie'],
  [/\bnephrolog\w*|\bnieren(?:arzt|ärztin|facharzt)\b/iu, 'Innere Medizin und Nephrologie'],
  [/\bendokrinolog\w*|\bdiabetolog\w*/iu, 'Innere Medizin und Endokrinologie und Diabetologie'],
  [/\brheumatolog\w*/iu, 'Innere Medizin und Rheumatologie'],
  [/\bonkolog\w*|\bhämatolog\w*/iu, 'Innere Medizin und Hämatologie und Onkologie'],
  [/\bangiolog\w*/iu, 'Innere Medizin und Angiologie'],
  [/\bgefäßchirurg\w*/iu, 'Gefäßchirurgie'],
  [/\bneurochirurg\w*/iu, 'Neurochirurgie'],
  [/\borthopäd\w*|\bunfallchirurg\w*/iu, 'Orthopädie und Unfallchirurgie'],
  [/\bchirurg\w*/iu, 'Allgemeinchirurgie'],
  [/\bneurolog\w*/iu, 'Neurologie'],
  [/\bpsychosomati\w*/iu, 'Psychosomatische Medizin und Psychotherapie'],
  [/\bpsychiat\w*/iu, 'Psychiatrie und Psychotherapie'],
  [/\bhno\b|\bhals-?nasen-?ohren/iu, 'Hals-Nasen-Ohrenheilkunde'],
  [/\baugen(?:arzt|ärztin|heilkunde|klinik)\w*|\bophthalmolog\w*/iu, 'Augenheilkunde'],
  [/\bderma\w*|\bhaut(?:arzt|ärztin|klinik)\w*/iu, 'Haut- und Geschlechtskrankheiten'],
  [/\bgyn(?:ä|ae)kolog\w*|\bfrauen(?:arzt|ärztin|heilkunde)\w*/iu, 'Frauenheilkunde und Geburtshilfe'],
  [/\burolog\w*/iu, 'Urologie'],
  [/\bnuklearmedizin\w*|\bszintigra\w*/iu, 'Nuklearmedizin'],
  [/\bradiolog\w*|\bröntgen(?:praxis|institut)\b/iu, 'Radiologie'],
  [/\bkinder(?:arzt|ärztin|heilkunde)\w*|\bpädiat\w*/iu, 'Kinder- und Jugendmedizin'],
  [/\bphysikalische und rehabilitative\b/iu, 'Physikalische und Rehabilitative Medizin'],
];

export function specialtyIn(text: string): { name: string; evidence: string } | null {
  for (const [re, name] of SPECIALTIES) {
    const m = uni(re).exec(text);
    if (m) return { name, evidence: m[0] };
  }
  return null;
}

/** Bildgebung und Funktionsdiagnostik, die als Auftragsleistung nach Art und Umfang bestimmt werden kann. */
export const PROCEDURES: readonly [RegExp, string][] = [
  [/\b(?:echokardiographie|echokardiografie|herzecho|echo)\b/iu, 'Echokardiographie'],
  [/\b(?:belastungs-?ekg|ergometrie)\b/iu, 'Belastungs-EKG'],
  [/\blangzeit-?ekg\b/iu, 'Langzeit-EKG'],
  [/\blangzeit-?(?:rr|blutdruck)\w*/iu, 'Langzeit-Blutdruckmessung'],
  [/\bmrt\b|\bkernspin\w*/iu, 'MRT'],
  [/\bct\b|\bcomputertomograph\w*/iu, 'CT'],
  [/\bröntgen\b/iu, 'Röntgen'],
  [/\bduplex\w*|\bdoppler\w*/iu, 'Duplexsonographie'],
  [/\bsonographie\b|\bsonografie\b|\bsono\b|\bultraschall\b/iu, 'Sonographie'],
  [/\blungenfunktion\w*|\bspirometrie\b|\bbodyplethysmograph\w*/iu, 'Lungenfunktionsprüfung'],
  [/\bkoloskopie\b|\bdarmspiegelung\b/iu, 'Koloskopie'],
  [/\bgastroskopie\b|\bmagenspiegelung\b/iu, 'Gastroskopie'],
  [/\bszintigraphie\b|\bszintigrafie\b/iu, 'Szintigraphie'],
  [/\beeg\b/iu, 'EEG'],
  [/\b(?:nlg|neurographie|elektroneurographie)\b/iu, 'Neurographie'],
  [/\bknochendichte\w*|\bdxa\b|\bosteodensitometrie\b/iu, 'Osteodensitometrie'],
];

export function proceduresIn(text: string): { names: string[]; evidence: string[] } {
  const names: string[] = [];
  const evidence: string[] = [];
  for (const [re, name] of PROCEDURES) {
    const m = uni(re).exec(text);
    if (m && !names.includes(name)) { names.push(name); evidence.push(m[0]); }
  }
  return { names, evidence };
}
