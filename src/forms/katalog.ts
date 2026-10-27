import katalog from '../../data/forms/catalog.json' with { type: 'json' };
import { norm, uni } from './text.js';

/**
 * Katalog aller KBV-Vordrucke (e01 bis Muster 86) mit den Ausfüllregeln aus den Erläuterungen (Stand Januar 2026).
 * Dient der Suche „welcher Vordruck?“ und den Hinweisen „nicht Muster X, sondern Y“. Ausfüllbar sind nur Muster 2, 4, 6.
 */

export interface CatalogRule {
  id: string;
  kind: 'voraussetzung' | 'ausfuellen' | 'nicht_verwenden' | 'frist' | 'nachweis' | 'genehmigung' | 'hinweis';
  text: string;
  locator: string;
}

export interface CatalogEntry {
  muster: string;
  title: string;
  stand: string | null;
  status: 'aktiv' | 'unbesetzt';
  erlaeuterungen_pages: string;
  copies: string[];
  purpose: string | null;
  keywords: string[];
  use_instead: { when: string; muster: string; locator: string }[];
  rules: CatalogRule[];
}

export const CATALOG: readonly CatalogEntry[] = (katalog as unknown as { entries: CatalogEntry[] }).entries;

/** Vordrucke, die als ausfüllbare Vorschau hinterlegt sind. */
export const INTERACTIVE: Readonly<Record<string, string>> = { '2': 'muster-02', '4': 'muster-04', '6': 'muster-06' };

export interface CatalogHit {
  entry: CatalogEntry;
  matched: string[];
}

/** Vordrucke, deren Stichwörter oder Titel in der Beschreibung vorkommen (beste zuerst). */
export function searchCatalog(description: string, limit = 4): CatalogHit[] {
  const text = norm(description);
  const hits: CatalogHit[] = [];
  for (const entry of CATALOG) {
    if (entry.status !== 'aktiv' || entry.muster === 'allgemein') continue;
    const matched = entry.keywords.filter((k) => k.length > 2 && uni(new RegExp(`\\b${k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, 'iu')).test(text));
    const nr = uni(new RegExp(`\\b(?:muster|vordruck)\\s*${entry.muster.replace(/\s.*$/, '')}\\b`, 'iu')).exec(text);
    if (nr) matched.unshift(nr[0]);
    if (matched.length) hits.push({ entry, matched });
  }
  return hits.sort((a, b) => b.matched.length - a.matched.length).slice(0, limit);
}

export function catalogEntry(muster: string): CatalogEntry | undefined {
  return CATALOG.find((e) => e.muster === muster);
}
