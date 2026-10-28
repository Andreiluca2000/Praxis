// Heilmittelkatalog aus der Heilmittel-Richtlinie des G-BA (amtliches Werk), siehe data/forms/sources.manifest.json.
import katalog from '../../data/forms/heilmittelkatalog.json' with { type: 'json' };
import { uni } from './text.js';

export type BereichId = 'physiotherapie' | 'podologie' | 'stimm_sprech_sprach_schluck' | 'ergotherapie' | 'ernaehrungstherapie';

export interface Diagnosegruppe {
  code: string;
  name: string;
  beispiele: string[];
  leitsymptomatik: { key: string; text: string }[];
  vorrangig: string[];
  ergaenzend: string[];
  standardisierte_kombination: boolean;
  hoechstmenge_je_vo: number | null;
  orientierende_menge: number | null;
  frequenz: string | null;
  hinweise: string[];
  locator: string;
}

export interface Bereich {
  id: BereichId;
  label: string;
  diagnosegruppen: Diagnosegruppe[];
}

interface Katalog {
  source: { title: string; stand: string };
  bereiche: Bereich[];
  abkuerzungen: Record<string, string>;
}

export const HEILMITTEL = katalog as unknown as Katalog;

/** Feld auf Muster 13 je Heilmittelbereich. */
export const BEREICH_FIELD: Record<BereichId, string> = {
  physiotherapie: 'physio', podologie: 'podologie', stimm_sprech_sprach_schluck: 'stimme', ergotherapie: 'ergo', ernaehrungstherapie: 'ernaehrung',
};

export const norm = (code: string) => code.replace(/\s+/g, '').toUpperCase();

export function bereich(id: BereichId): Bereich | undefined {
  return HEILMITTEL.bereiche.find((b) => b.id === id);
}

export function gruppe(id: BereichId | null, code: string): Diagnosegruppe | undefined {
  const c = norm(code);
  const pool = id ? bereich(id)?.diagnosegruppen ?? [] : HEILMITTEL.bereiche.flatMap((b) => b.diagnosegruppen);
  return pool.find((g) => norm(g.code) === c);
}

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Heilmittel-Bezeichnungen (Abkürzung und Langform) einer Liste, die im Text vorkommen. */
export function heilmittelIn(text: string, list: readonly string[]): string[] {
  const out: string[] = [];
  for (const hm of list) {
    const long = HEILMITTEL.abkuerzungen[hm];
    const names = [hm, ...(long ? [long] : [])].filter((n) => n.length >= 2);
    if (names.some((n) => uni(new RegExp(`\\b${escape(n)}\\b`, n.length <= 4 ? 'u' : 'iu')).test(text)) && !out.includes(hm)) out.push(hm);
  }
  return out;
}

/** Diagnosegruppe, deren „z. B.“-Diagnosen im Text vorkommen (nur innerhalb des Bereichs). */
export function gruppeAusBeispielen(id: BereichId, text: string): { gruppe: Diagnosegruppe; evidence: string } | null {
  for (const g of bereich(id)?.diagnosegruppen ?? []) {
    for (const b of g.beispiele) {
      const word = b.split(/[\s,(/]+/).find((w) => w.length >= 6);
      if (word && uni(new RegExp(`\\b${escape(word)}`, 'iu')).test(text)) return { gruppe: g, evidence: word };
    }
  }
  return null;
}
