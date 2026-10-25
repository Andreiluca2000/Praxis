import type { IcdCatalog, IcdEntry } from './catalog.js';

/** Umlaut-, Groß-/Kleinschreibungs- und Leerzeichen-robust (ICD-04). Die Anzeige bleibt amtlich. */
export function normalize(s: string): string {
  return s.toLowerCase()
    .replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss')
    .normalize('NFKD').replace(/\p{Diacritic}/gu, '')
    .replace(/[^a-z0-9.]+/g, ' ').replace(/\s+/g, ' ').trim();
}

const CODE_RE = /^[a-z]\d{2}(\.[0-9a-z]{0,2})?[!*+-]?$/i;
const cleanCode = (q: string) => q.trim().toUpperCase().replace(/[!*+]$/, '').replace(/\.?-$/, '');

export interface SearchHit {
  entry: IcdEntry;
  /** Worauf der Treffer beruht – Inklusiva sind amtliche Zusatzbegriffe, nicht der Titel (ICD-05). */
  matchedIn: 'code' | 'titel' | 'inklusivum';
  matchedText: string;
}

/**
 * Suche im amtlichen Katalog. Ergebnis ist ein Klassifikationsbegriff, keine Diagnose:
 * Symptome ohne dokumentierte Diagnose ergeben höchstens Symptom-Kodes (R-Kapitel), keine Krankheitsvermutung (ICD-09).
 */
export class IcdIndex {
  private readonly byCode = new Map<string, IcdEntry>();
  private readonly docs: { entry: IcdEntry; title: string; incl: string[] }[];

  constructor(readonly catalog: IcdCatalog) {
    for (const e of catalog.entries) this.byCode.set(e.code, e);
    this.docs = catalog.entries.map((e) => ({ entry: e, title: normalize(e.title), incl: e.inclusions.map(normalize) }));
  }

  get size() { return this.byCode.size; }

  /** Exakter Code (auch mit Strich/Stern/Ausrufezeichen oder Kleinbuchstaben). Unbekannt → null, nichts erfunden (ICD-02). */
  get(code: string): IcdEntry | null {
    return this.byCode.get(cleanCode(code)) ?? null;
  }

  /** Gültigkeit dieser Ausgabe für ein Leistungsdatum (ICD-07). */
  coversDate(isoDate: string): boolean {
    return isoDate >= this.catalog.validFrom && isoDate <= this.catalog.validTo;
  }

  search(query: string, limit = 30): SearchHit[] {
    const q = query.trim();
    if (!q) return [];
    if (CODE_RE.test(q)) {
      const prefix = cleanCode(q);
      const exact = this.byCode.get(prefix);
      const rest = this.catalog.entries.filter((e) => e.code.startsWith(prefix) && e !== exact);
      return (exact ? [exact, ...rest] : rest).slice(0, limit).map((entry) => ({ entry, matchedIn: 'code' as const, matchedText: entry.code }));
    }
    const words = normalize(q).split(' ').filter((w) => w.length > 1);
    if (words.length === 0) return [];
    const scored: { hit: SearchHit; score: number }[] = [];
    for (const d of this.docs) {
      if (words.every((w) => d.title.includes(w))) {
        // Titel beginnt mit dem Suchbegriff → wichtiger; „nicht näher bezeichnet“ zuerst, weil hausärztlich häufig.
        const starts = d.title.startsWith(words[0]!) ? 4 : 0;
        const nnb = /nicht naeher bezeichnet/.test(d.title) ? 1 : 0;
        const category = d.entry.code.length === 3 ? 2 : 0;
        scored.push({ hit: { entry: d.entry, matchedIn: 'titel', matchedText: d.entry.title }, score: 10 + starts + category + nnb - d.title.length / 400 });
        continue;
      }
      const i = d.incl.findIndex((t) => words.every((w) => t.includes(w)));
      if (i >= 0) scored.push({ hit: { entry: d.entry, matchedIn: 'inklusivum', matchedText: d.entry.inclusions[i]! }, score: 6 });
    }
    // Gruppiert nach Kategorie (erste drei Zeichen), Reihenfolge der Gruppen nach bestem Treffer, darin nach Kode.
    scored.sort((a, b) => b.score - a.score);
    const groupRank = new Map<string, number>();
    for (const s of scored) if (!groupRank.has(s.hit.entry.code.slice(0, 3))) groupRank.set(s.hit.entry.code.slice(0, 3), groupRank.size);
    const nnbFirst = (s: { hit: SearchHit }) => (s.hit.entry.code.length === 3 ? 0 : /nicht näher bezeichnet/.test(s.hit.entry.title) ? 1 : 2);
    return scored
      .sort((a, b) => groupRank.get(a.hit.entry.code.slice(0, 3))! - groupRank.get(b.hit.entry.code.slice(0, 3))!
        || nnbFirst(a) - nnbFirst(b) || a.hit.entry.code.localeCompare(b.hit.entry.code))
      .slice(0, limit)
      .map((s) => s.hit);
  }
}
