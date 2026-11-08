import type { IsoDate, PracticeSettings, RulePackage } from '../domain/types.js';
import type { ChronicList } from '../engine/chronic.js';
import type { PairRegistry } from '../engine/pairs.js';
import type { WindowRuleSet } from '../engine/window-rules.js';
import { checkCase, quarterRange, readKvdt } from '../kvdt/quarter-check.js';
import type { ActiveRule } from '../rules/model.js';
import { reduziereKvdt } from './schutz.js';

/**
 * Fallprüfung für Claude: dieselben Prüfungen wie die Quartalsprüfung der App (`checkCase`),
 * aber die Ausgabe enthält NUR Summen über alle Fälle der Praxis.
 * - Kein Fall, kein Pseudonym, keine Laufnummer, kein Leistungstag (Datumsangaben → „[Tag]“).
 * - Gruppen mit weniger als MIN_GRUPPE Fällen werden nur gezählt („seltene Befunde“), ohne Ziffern oder Text.
 * - Einzelfälle prüft die Praxis selbst in der App (Quartalsprüfung / Tagesabschluss).
 */

export const MIN_GRUPPE = 5;
export const MAX_GRUPPEN = 60;
export const MAX_ZIFFERN = 80;

export type Anzahl = number | 'unter 5';
const anzahl = (n: number): Anzahl => (n >= MIN_GRUPPE ? n : 'unter 5');

export interface BefundGruppe {
  art: string;
  schwere: 'fehler' | 'hinweis' | 'entwurf';
  text: string;
  faelle: number;
}

export interface Uebersicht {
  hinweis: string;
  quartal: { von: IsoDate; bis: IsoDate } | null;
  tag: IsoDate | null;
  modus: 'operational' | 'simulation';
  faelle: number;
  faelleMitBefund: Anzahl;
  jeArt: Record<string, Anzahl>;
  befunde: BefundGruppe[];
  selten: { gruppen: number; faelle: Anzahl };
  ziffern: { ziffer: string; faelle: number }[];
  lesefehler: number;
  nichtGeprueft: string[];
}

export interface PruefKontext {
  settings: PracticeSettings;
  rules: RulePackage;
  mode: 'operational' | 'simulation';
  pairs: PairRegistry | null;
  windows: WindowRuleSet | null;
  practice: ActiveRule[];
  chronic: ChronicList | null;
  /** Grund, warum die Entwurfs-Dossiers fehlen (nur Simulator). */
  dossierFehler?: string;
}

/** Datumsangaben und Zeilennummern aus einem Befundtext entfernen, damit gleiche Befunde zusammenfallen. */
export function neutralisiere(text: string): string {
  return text
    .replace(/\b\d{4}-\d{2}-\d{2}\b/g, '[Tag]')
    .replace(/\b\d{1,2}\.\d{1,2}\.\d{2,4}\b/g, '[Tag]')
    .replace(/\(Zeile \d+\)/g, '')
    .replace(/\b\d{7,}\b/g, '[entfernt]')
    .replace(/\s+/g, ' ')
    .trim();
}

function nichtGeprueft(k: PruefKontext): string[] {
  const out: string[] = [];
  if (k.mode === 'operational') out.push('Kombinationen und Zeiträume (Entwurfs-Dossiers): nur im Simulator.');
  else if (!k.pairs) out.push(`Kombinationen und Zeiträume: Dossier nicht geladen${k.dossierFehler ? ` (${k.dossierFehler})` : ''}.`);
  if (k.rules.content_kind === 'synthetic_example') out.push('Abrechnungsregeln: nur DEMO-Regeln (Simulator).');
  if (!k.chronic) out.push('Diagnose ↔ Ziffer (R1): Liste chronischer Erkrankungen nicht freigegeben.');
  out.push('Patienten ohne KV-Schein (HZV, privat): nicht in der KVDT-Datei.');
  return out;
}

export function fallpruefungUebersicht(raw: Uint8Array, k: PruefKontext, tag?: IsoDate): { uebersicht: Uebersicht; identitaet: string[] } {
  const red = reduziereKvdt(raw);
  const { cases, parseErrors } = readKvdt(red.daten);
  const fileQuarter = cases.map((c) => quarterRange(c.quarter)).find((q) => q !== null) ?? null;
  const gruppen = new Map<string, BefundGruppe & { ids: Set<number> }>();
  const ziffern = new Map<string, Set<number>>();
  const mitBefund = new Set<number>();
  let betrachtet = 0;

  const add = (caseIndex: number, art: string, schwere: BefundGruppe['schwere'], text: string) => {
    const t = neutralisiere(text);
    const key = `${schwere}|${art}|${t}`;
    const g = gruppen.get(key) ?? { art, schwere, text: t, faelle: 0, ids: new Set<number>() };
    g.ids.add(caseIndex);
    gruppen.set(key, g);
    mitBefund.add(caseIndex);
  };

  for (const c of cases) {
    const leistungen = tag ? c.services.filter((s) => s.date === tag) : c.services;
    if (tag && leistungen.length === 0) continue;
    betrachtet++;
    for (const s of leistungen) {
      const set = ziffern.get(s.code) ?? new Set<number>();
      set.add(c.index);
      ziffern.set(s.code, set);
    }
    const r = checkCase(c, { settings: k.settings, rules: k.rules, mode: k.mode, pairs: k.pairs, windows: k.windows, practice: k.practice, chronic: k.chronic, fileQuarter, day: tag });
    for (const f of r.findings) add(c.index, f.kind, f.severity, f.text);
    for (const f of r.pairFindings) if (f.verdict !== 'separate_confirmed') add(c.index, `kombination:${f.verdict}`, 'entwurf', `${f.codes.join(' + ')}: ${f.text}`);
    for (const f of r.windowFindings) add(c.index, `zeitraum:${f.verdict}`, 'entwurf', `${f.codes.join(' + ')}: ${f.text}`);
  }

  const alle = [...gruppen.values()].map((g) => ({ ...g, faelle: g.ids.size }));
  const gross = alle.filter((g) => g.faelle >= MIN_GRUPPE).sort((a, b) => b.faelle - a.faelle);
  const klein = alle.filter((g) => g.faelle < MIN_GRUPPE);
  const seltenIds = new Set(klein.flatMap((g) => [...g.ids]));
  const jeArt: Record<string, Set<number>> = {};
  for (const g of alle) for (const id of g.ids) (jeArt[g.art] ??= new Set<number>()).add(id);

  return {
    identitaet: red.identitaet,
    uebersicht: {
      hinweis: `Nur Summen über alle Fälle. Gruppen unter ${MIN_GRUPPE} Fällen nur gezählt. Einzelfälle prüft die Praxis in der App. Alles ist Vorschlag, nichts wird abgerechnet.`,
      quartal: fileQuarter ? { von: fileQuarter.from, bis: fileQuarter.to } : null,
      tag: tag ?? null,
      modus: k.mode,
      faelle: betrachtet,
      faelleMitBefund: anzahl(mitBefund.size),
      jeArt: Object.fromEntries(Object.entries(jeArt).map(([a, s]) => [a, anzahl(s.size)])),
      befunde: gross.slice(0, MAX_GRUPPEN).map(({ art, schwere, text, faelle }) => ({ art, schwere, text, faelle })),
      selten: { gruppen: klein.length + Math.max(0, gross.length - MAX_GRUPPEN), faelle: anzahl(seltenIds.size) },
      ziffern: [...ziffern.entries()].map(([ziffer, s]) => ({ ziffer, faelle: s.size }))
        .filter((z) => z.faelle >= MIN_GRUPPE).sort((a, b) => b.faelle - a.faelle).slice(0, MAX_ZIFFERN),
      lesefehler: red.lesefehler + parseErrors.length,
      nichtGeprueft: nichtGeprueft(k),
    },
  };
}
