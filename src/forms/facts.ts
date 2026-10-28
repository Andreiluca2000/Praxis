import { cue, dateAfter, norm, URGENT, uni } from './text.js';
import type { Fact, PatientFacts } from './types.js';

/**
 * Tatsachen über die Lage des Patienten aus der freien Beschreibung („Pflegegrad 5, Rollstuhl, Dialyse 3×/Woche“).
 * Nur ausdrücklich Genanntes zählt; Verneinungen („kein Unfall“) werden nicht übernommen.
 * Ergebnisse sind Vorschläge – Nachweise (Bescheid, Ausweis) prüft die Praxis.
 */

const yes = (evidence: string | null): Fact<true> | null => (evidence ? { value: true, evidence } : null);

function pflegegrad(text: string): PatientFacts['pflegegrad'] {
  const m = uni(/\b(?:pflegegrad|PG)\s*(?:von\s*)?([1-5])\b/iu).exec(text);
  if (!m) return null;
  return { value: Number(m[1]) as 1 | 2 | 3 | 4 | 5, evidence: m[0] };
}

function merkzeichen(text: string): PatientFacts['merkzeichen'] {
  const m = uni(/\b(?:merkzeichen|schwerbehindertenausweis|sb-ausweis|ausweis)\b([^.;:]{0,40})/iu).exec(text);
  if (!m) return null;
  const found = new Set<'aG' | 'Bl' | 'H' | 'G'>();
  for (const t of m[1]!.matchAll(/(?<![\p{L}])(aG|Bl|BI|H|G)(?![\p{L}])/gu)) found.add(t[1] === 'BI' ? 'Bl' : (t[1] as 'aG' | 'Bl' | 'H' | 'G'));
  return found.size ? { value: [...found], evidence: m[0].trim() } : null;
}

function ausstattung(text: string): PatientFacts['ausstattung'] {
  const out: ('rollstuhl' | 'tragestuhl' | 'liegend')[] = [];
  const ev: string[] = [];
  const r = cue(/\brollstuhl\w*/iu, text);
  if (r) { out.push('rollstuhl'); ev.push(r); }
  const t = cue(/\btragestuhl\w*/iu, text);
  if (t) { out.push('tragestuhl'); ev.push(t); }
  const l = cue(/\b(liegend\w*|bettlägerig\w*|liegendtransport)/iu, text);
  if (l) { out.push('liegend'); ev.push(l); }
  return out.length ? { value: out, evidence: ev.join(', ') } : null;
}

function hochfrequent(text: string): PatientFacts['hochfrequent'] {
  const d = cue(/\b(hämo|peritoneal)?dialyse\w*/iu, text);
  if (d) return { value: 'dialyse', evidence: d };
  const s = cue(/\b(strahlentherapie|bestrahlung\w*|radiatio)\b/iu, text);
  if (s) return { value: 'strahlentherapie', evidence: s };
  const c = cue(/\b(chemo\w*)\b/iu, text);
  return c ? { value: 'chemotherapie', evidence: c } : null;
}

function kindAlter(text: string): PatientFacts['kindAlter'] {
  const KIND = String.raw`(?:kind\w*|sohn|tochter|junge|mädchen|enkel\w*)`;
  const JAHRE = String.raw`(?:j\.|jahre?n?|jährig\w*|lj\.?)`;
  const m = uni(new RegExp(String.raw`\b${KIND}\b[^.;]{0,25}?\b(\d{1,2})\s*-?\s*${JAHRE}|\b(\d{1,2})\s*-?\s*${JAHRE}\s+(?:alte[rsn]?\s+)?${KIND}`, 'iu')).exec(text);
  if (m) return { value: Number(m[1] ?? m[2]), evidence: m[0].trim() };
  const baby = cue(/\b(säugling\w*|baby\w*|neugeboren\w*|kleinkind\w*)/iu, text);
  return baby ? { value: 0, evidence: baby } : null;
}

function ssw(text: string): PatientFacts['ssw'] {
  const m = uni(/\b(\d{1,2})(?:\s*\+\s*\d)?\s*\.?\s*(?:ssw|schwangerschaftswoche)\b|\b(?:ssw|schwangerschaftswoche)\s*(\d{1,2})\b/iu).exec(text);
  if (!m) return null;
  const n = Number(m[1] ?? m[2]);
  return n >= 1 && n <= 45 ? { value: n, evidence: m[0].trim() } : null;
}

export function extractFacts(description: string): PatientFacts {
  const text = norm(description);
  const arbeitsunfall = cue(/\b(arbeitsunfall\w*|berufskrankheit\w*|schul(?:e)?unfall\w*|schülerunfall\w*|kita-?unfall|bg-fall|berufsgenossenschaft\w*|d-arzt\w*|durchgangsarzt\w*)/iu, text);
  const wegeunfall = cue(/\b(wegeunfall\w*|auf dem (?:arbeits)?weg zur arbeit)/iu, text);
  const unfall = arbeitsunfall || wegeunfall ? null : cue(/\b(unfall\w*|sturz|gestürzt|verkehrsunfall\w*|sportunfall\w*|haushaltsunfall\w*)\b/iu, text);
  // „AU“ nur großgeschrieben (sonst trifft es „ausziehen“).
  const au = dateAfter(/(?:\bAU\b|\b[Aa]rbeitsunfähig(?:keit)?)/, text);
  return {
    pflegegrad: pflegegrad(text),
    merkzeichen: merkzeichen(text),
    mobilitaetDauerhaft: yes(cue(/\b(dauerhafte?n?\s+(?:mobilitätsbeeinträchtigung|beeinträchtigung der mobilität)|pflegestufe\s*(?:2|ii|zwei)|kann nicht (?:allein|selbstständig|selbständig|eigenständig) (?:fahren|öffentliche verkehrsmittel))/iu, text)),
    ausstattung: ausstattung(text),
    hochfrequent: hochfrequent(text),
    notfall: yes(cue(/\b(notfall\w*|notaufnahme|lebensbedrohlich\w*|reanimation\w*|notarzt\w*)/iu, text)),
    unfall: yes(unfall),
    arbeitsunfall: yes(arbeitsunfall),
    wegeunfall: yes(wegeunfall),
    versorgungsleiden: yes(cue(/\b(SER|BVG|OEG)\b/u, text) ??cue(/\b(versorgungsleiden|schädigungsfolge\w*|opferentschädigung\w*|impfschaden)\b/iu, text)),
    zuzahlungsbefreit: yes(cue(/\b(zuzahlungsbefreit\w*|befreiungsausweis|von (?:der )?zuzahlung befreit|befreit von (?:der )?zuzahlung)/iu, text)),
    eingeschraenkterAnspruch: yes(cue(/\b(ruhende[rn]? (?:leistungs)?anspruch|anspruch ruht|eingeschränkte[rn]? leistungsanspruch|16 abs\.? ?3a|beitragsrückst\w*)/iu, text)),
    reha: yes(cue(/\b(reha|rehabilitation\w*|anschlussheilbehandlung|AHB|kur|vorsorgeeinrichtung|rehaklinik)\b/iu, text)),
    nurPflege: yes(cue(/\b((?:nur|rein|ausschließlich) pflegerisch\w*|zu hause nicht (?:mehr )?(?:versorgt|versorgbar)|soziale indikation|keine versorgung zu hause)/iu, text)),
    kosmetisch: yes(cue(/\b(schönheits\w*|kosmetisch\w*|ästhetisch\w*)/iu, text)),
    dringend: yes(cue(URGENT, text)),
    fahrtOhneGrund: yes(cue(/\b((?:rezept|verordnung|befund\w*|überweisung)\s+(?:abholen|holen)|termin\w*\s+(?:abstimmen|vereinbaren)|befunde? erfragen|(?:ins|zum|in das) pflegeheim|tagespflege)/iu, text)),
    auBis: au ? { value: au.value, evidence: au.evidence } : null,
    kindAlter: kindAlter(text),
    kindBehindert: yes(cue(/\b(behindert\w*|behinderung\w*|mehrfachbehindert\w*|schwerbehindert\w*)/iu, text)),
    mitaufnahme: yes(cue(/\b(mitaufnahme|mit aufgenommen|begleitperson|rooming-?in)\b/iu, text)),
    ssw: ssw(text),
    mehrlinge: yes(cue(/\b(mehrling\w*|zwilling\w*|drilling\w*|gemini)\b/iu, text)),
    kitaUnfall: yes(cue(/\b(kita-?unfall\w*|schulunfall\w*|schülerunfall\w*|kindergartenunfall\w*|unfall (?:in|im|auf) (?:der|dem)?\s*(?:kita|schule|kindergarten|schulweg|pausenhof|sportunterricht))/iu, text)),
  };
}

/** Pflegegrad bzw. Merkzeichen, die nach Muster 4 b) genehmigungsfreie Fahrten zur ambulanten Behandlung tragen. */
export function befoerderungB(facts: PatientFacts): { ok: boolean | null; why: string; evidence: string | null } {
  const mz = facts.merkzeichen?.value.filter((m) => m !== 'G') ?? [];
  if (mz.length) return { ok: true, why: `Merkzeichen ${mz.join(', ')}`, evidence: facts.merkzeichen!.evidence };
  const pg = facts.pflegegrad;
  if (pg && pg.value >= 4) return { ok: true, why: `Pflegegrad ${pg.value}`, evidence: pg.evidence };
  if (pg && pg.value === 3) {
    if (facts.mobilitaetDauerhaft || facts.merkzeichen?.value.includes('G')) {
      return { ok: true, why: 'Pflegegrad 3 mit dauerhafter Mobilitätsbeeinträchtigung', evidence: `${pg.evidence}; ${facts.mobilitaetDauerhaft?.evidence ?? facts.merkzeichen!.evidence}` };
    }
    return { ok: null, why: 'Pflegegrad 3 – dauerhafte Mobilitätsbeeinträchtigung (mind. 6 Monate) noch zu prüfen', evidence: pg.evidence };
  }
  if (pg) return { ok: false, why: `Pflegegrad ${pg.value} reicht für b) nicht`, evidence: pg.evidence };
  return { ok: null, why: 'kein Pflegegrad 3–5 und kein Merkzeichen aG, Bl oder H genannt', evidence: null };
}
