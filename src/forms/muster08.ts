import { isChecked, issue, prop, textOf } from './build.js';
import { getForm } from './catalog.js';
import type { GenericSpec } from './generic.js';
import { cue, uni } from './text.js';
import type { FieldProposal, FormIssue, FormValues, PatientFacts } from './types.js';

/**
 * Muster 8 (Sehhilfenverordnung) und 8A (vergrößernde Sehhilfen), Stand 10.2014. Erläuterungen 01/2026, S. 31–32;
 * Hilfsmittel-Richtlinie Abschnitt E. Fachregeln: ab 18 Jahren nur bei WHO-Stufe 1 (bestkorrigierter Fernvisus besseres Auge ≤ 0,3)
 * oder als therapeutische Sehhilfe, Folgeversorgung ab 14 nur bei ≥ 0,5 dpt bzw. +20 Prozentpunkten, Refraktionswerte plausibel,
 * Keratokonus mit Hornhautradien, bei 8A Visus, Sehhilfe beim Visus und Vergrößerungsbedarf, binokulare Versorgung begründen.
 */
type Id = 'muster-08' | 'muster-08a';
const WHO1_VISUS = 0.3;
const ACHSE_MAX = 180;
const AUGEN = ['f_r', 'f_l', 'n_r', 'n_l'] as const;

/** Visus „0,2“, „0.2“ oder „20 %“ als Dezimalwert. */
function visus(v: string): number | null {
  const p = uni(/(\d+)\s*%/u).exec(v);
  if (p) return Number(p[1]) / 100;
  const d = uni(/\b(\d(?:[,.]\d{1,3})?)\b/u).exec(v);
  return d ? Number(d[1]!.replace(',', '.')) : null;
}

function common(id: Id): Pick<GenericSpec, 'required' | 'text' | 'check'> {
  return {
    required: ['menge_art', 'diagnose_begruendung'],
    text: { menge_art: ['verordnung', 'menge'], diagnose_begruendung: ['diagnose', 'begründung'] },
    check: {
      who1: /\b(who[- ]?(?:stufe\s*)?1|schwere\w* sehbeeinträchtigung)\b/iu,
      reparatur: /\breparatur\b/iu,
      ersatz: /\bersatz\w*/iu,
      erstversorgung: /\b(erstversorgung|erste brille|erstmals)\b/iu,
      folgeversorgung: /\b(folgeversorgung|neue brille|bisherige\w* (?:brille|sehhilfe))\b/iu,
      ...(id === 'muster-08' ? { aenderung_ja: /\b(änderung|veränderung)\b[^.;]{0,20}?(?:um\s*)?(?:mindestens\s*)?0[,.][5-9]\d*\s*(?:dpt|dioptrien)\b/iu } : {}),
    },
  };
}

function extra(id: Id) {
  return (v: FormValues, facts: PatientFacts): FormIssue[] => {
    const f = getForm(id);
    const r = (s: string) => `${id === 'muster-08' ? 'm08' : 'm08a'}.${s}`;
    const out: FormIssue[] = [];
    const add = (level: FormIssue['level'], text: string, ids: string[], rule: string) => out.push(issue(f, level, text, ids, rule));
    const on = (x: string) => isChecked(v, x);
    const kind = facts.kindAlter && facts.kindAlter.value < 18;
    const begr = textOf(v, 'diagnose_begruendung');
    const therapeutisch = uni(/\b(therapeutisch\w*|aniridie|lichtschutz\w*|okklusion\w*|amblyopie|keratokonus|aphakie)\b/iu).test(begr);
    if (!kind && !therapeutisch && !on('who1')) add('hinweis', 'Ab 18 Jahren nur bei schwerer Sehbeeinträchtigung beider Augen (mindestens WHO-Stufe 1, bestkorrigierter Fernvisus besseres Auge höchstens 0,3) oder als therapeutische Sehhilfe.', ['who1'], r('indikation_ab_18'));
    if (uni(/\bkeratokonus\b/iu).test(begr) && !uni(/\b(radi\w*|\d+[,.]\d+\s*mm)\b/iu).test(begr)) add('fehlt', 'Keratokonus: mindestens die zentralen Hornhautradien angeben.', ['diagnose_begruendung'], r('diagnose_begruendung'));
    if (on('reparatur') && on('ersatz')) add('hinweis', 'Reparatur und Ersatz zugleich angekreuzt – bitte prüfen.', ['reparatur', 'ersatz'], r('reparatur_ersatz'));
    for (const a of AUGEN) {
      const achse = textOf(v, `achse_${a}`);
      if (achse && Number(achse) > ACHSE_MAX) add('unzulaessig', `Achse ${a.replace('_', ' ').toUpperCase()}: 0 bis 180 Grad.`, [`achse_${a}`], r('menge_art'));
      if (textOf(v, `zylinder_${a}`) && !achse) add('fehlt', `Zylinder ${a.replace('_', ' ').toUpperCase()} ohne Achse.`, [`achse_${a}`], r('menge_art'));
    }
    if (id === 'muster-08') {
      if (on('folgeversorgung') && !kind && !therapeutisch) {
        if (!on('aenderung_ja') && !on('aenderung_nein')) add('fehlt', 'Folgeversorgung: Änderung um mindestens 0,5 Dioptrien – ja oder nein ankreuzen.', ['aenderung_ja', 'aenderung_nein'], r('folgeversorgung'));
        if (on('aenderung_nein') && !on('verbesserung_20')) add('unzulaessig', 'Folgeversorgung ohne Änderung um 0,5 Dioptrien nur bei Verbesserung der Sehschärfe um mindestens 20 Prozentpunkte (Kurzsichtigkeit).', ['aenderung_nein', 'verbesserung_20'], r('folgeversorgung'));
      }
    } else {
      for (const s of ['rechts', 'links'] as const) if (!textOf(v, `fernvisus_${s}`)) add('fehlt', `Bestkorrigierter Fernvisus ${s} angeben.`, [`fernvisus_${s}`], r('visus_vergroesserung'));
      if (!on('mit_brille') && !on('mit_kontaktlinsen')) add('fehlt', 'Angeben, mit welcher Sehhilfe der Visus bestimmt wurde (Brille und/oder Kontaktlinse).', ['mit_brille', 'mit_kontaktlinsen'], r('visus_vergroesserung'));
      if (!textOf(v, 'vergroesserungsbedarf')) add('fehlt', 'Vergrößerungsbedarf (fach) angeben.', ['vergroesserungsbedarf'], r('visus_vergroesserung'));
      const vr = visus(textOf(v, 'fernvisus_rechts'));
      const vl = visus(textOf(v, 'fernvisus_links'));
      if (on('who1') && vr !== null && vl !== null && Math.max(vr, vl) > WHO1_VISUS) add('unzulaessig', `WHO-Stufe 1 angekreuzt, aber der bessere Fernvisus beträgt ${Math.max(vr, vl).toString().replace('.', ',')} (höchstens 0,3).`, ['who1', 'fernvisus_rechts', 'fernvisus_links'], r('indikation_ab_18'));
      if (uni(/\b(binokular\w*|beidäugig\w*|beide augen)\b/iu).test(textOf(v, 'menge_art')) && !uni(/\bbinokular\w*/iu).test(begr)) add('fehlt', 'Binokulare Versorgung: Notwendigkeit unter Diagnose/Begründung begründen.', ['diagnose_begruendung'], r('binokular'));
    }
    add('hinweis', 'Nur aufgrund augenärztlicher Untersuchung; nicht nach Angaben des Optikers ausfüllen.', [], r('augenarzt'));
    return out;
  };
}

function propose08a(text: string): FieldProposal[] {
  const f = getForm('muster-08a');
  const out: FieldProposal[] = [];
  const m = uni(/\bvisus\b[^.;]{0,10}?\b(?:r|re|rechts)\.?\s*:?\s*(\d(?:[,.]\d{1,3})?)[^.;]{0,10}?\b(?:l|li|links)\.?\s*:?\s*(\d(?:[,.]\d{1,3})?)/iu).exec(text);
  if (m) out.push(prop(f, 'fernvisus_rechts', 'arzt', m[1]!, 'Bestkorrigierter Fernvisus rechts.', m[0], 'm08a.visus_vergroesserung'), prop(f, 'fernvisus_links', 'arzt', m[2]!, 'Bestkorrigierter Fernvisus links.', m[0], 'm08a.visus_vergroesserung'));
  const fach = uni(/\b(\d{1,2})\s*-?\s*fach\w*/iu).exec(text);
  if (fach) out.push(prop(f, 'vergroesserungsbedarf', 'arzt', fach[1]!, 'Vergrößerungsbedarf.', fach[0], 'm08a.visus_vergroesserung'));
  const brille = cue(/\bmit brille\b/iu, text);
  if (brille) out.push(prop(f, 'mit_brille', 'vorgeschlagen', true, 'Visus mit Brille bestimmt.', brille, 'm08a.visus_vergroesserung'));
  return out;
}

export const SPEC_08: GenericSpec = { ...common('muster-08'), extra: extra('muster-08') };
export const SPEC_08A: GenericSpec = { ...common('muster-08a'), propose: propose08a, extra: extra('muster-08a') };
