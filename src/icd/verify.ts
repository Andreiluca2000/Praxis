import type { ClamlClass, KodesRow } from './parse.js';

/**
 * Korrekturen (Corrigenda) und Abgleich ClaML ↔ Metadaten. Jede Abweichung = Abbruch (Quarantäne).
 * Korrekturen gelten nur für die abgeleitete Kopie; die Originaldateien bleiben unverändert.
 */

export interface MetadataPatch { code: string; column_one_based: number; expected_old: string; new: string; expected_matches: number }
export interface XmlPatch { selector: string; attribute: string; expected_old: string; new: string; expected_matches: number }

const COLUMN_FIELD: Record<number, keyof KodesRow> = { 13: 'p295', 20: 'sex', 22: 'ageLow', 23: 'ageHigh' };

/** Alter Wert muss exakt so oft passen wie angegeben, sonst Abbruch. */
export function applyMetadataPatches(rows: KodesRow[], patches: MetadataPatch[]): string[] {
  const log: string[] = [];
  for (const p of patches) {
    const field = COLUMN_FIELD[p.column_one_based];
    if (!field) throw new Error(`Korrektur ${p.code}: Spalte ${p.column_one_based} wird nicht unterstützt.`);
    const hits = rows.filter((r) => r.code === p.code);
    if (hits.length !== p.expected_matches) throw new Error(`Korrektur ${p.code}: ${hits.length} Treffer statt ${p.expected_matches}.`);
    for (const r of hits) {
      if (r[field] !== p.expected_old) {
        throw new Error(`Korrektur ${p.code} Spalte ${p.column_one_based}: alter Wert „${String(r[field])}“ statt „${p.expected_old}“.`);
      }
      (r as unknown as Record<string, unknown>)[field] = p.new;
      log.push(`${p.code} Spalte ${p.column_one_based}: ${p.expected_old} → ${p.new}`);
    }
  }
  return log;
}

/**
 * Die XML-Korrekturen betreffen nur Altersangaben; der Katalog übernimmt Altersgrenzen aus den (korrigierten)
 * Metadaten. Geprüft wird, dass der erwartete alte Wert im Original genau einmal vorkommt.
 */
export function verifyXmlPatches(xml: string, patches: XmlPatch[]): string[] {
  const log: string[] = [];
  for (const p of patches) {
    const sel = /^\.\/(Class|ModifierClass)\[@code='([^']+)'\](?:\[@modifier='([^']+)'\])?\/Meta\[@name='([^']+)'\]$/.exec(p.selector);
    if (!sel) throw new Error(`XML-Korrektur: Selektor nicht unterstützt: ${p.selector}`);
    const [, el, code, modifier, meta] = sel as unknown as [string, string, string, string | undefined, string];
    const open = modifier ? `<${el} code="${code}" modifier="${modifier}"` : `<${el} code="${code}"`;
    const blocks = xml.split(open).slice(1).map((b) => b.slice(0, b.indexOf(`</${el}>`)));
    const hits = blocks.filter((b) => b.includes(`<Meta name="${meta}" value="${p.expected_old}"/>`));
    if (hits.length !== p.expected_matches) {
      throw new Error(`XML-Korrektur ${p.selector}: ${hits.length} Treffer mit altem Wert statt ${p.expected_matches}.`);
    }
    log.push(`${el} ${code}${modifier ? ` (${modifier})` : ''} ${meta}: ${p.expected_old} → ${p.new} (über Metadaten übernommen)`);
  }
  return log;
}

/** Abgleich ClaML ↔ Metadaten. Liefert Fehlerliste (leer = in Ordnung). */
export function reconcile(rows: KodesRow[], classes: Map<string, ClamlClass>): string[] {
  const errors: string[] = [];
  const codes = new Set<string>();
  for (const r of rows) {
    if (codes.has(r.code)) errors.push(`Metadaten: Code ${r.code} doppelt.`);
    codes.add(r.code);
  }
  for (const [code, c] of classes) {
    if (c.kind === 'category' && !codes.has(code)) errors.push(`ClaML-Kategorie ${code} fehlt in den Metadaten.`);
  }
  for (const r of rows) {
    if (classes.has(r.code)) continue;
    // Über Modifikator gebildeter Code: eine Vorgängerklasse muss existieren und ModifiedBy tragen.
    const candidates = [r.code.slice(0, -1), r.code.slice(0, -1).replace(/\.$/, ''), r.code.slice(0, -2).replace(/\.$/, '')];
    if (!candidates.some((b) => classes.get(b)?.modified)) errors.push(`Metadaten-Code ${r.code} ist weder ClaML-Klasse noch Modifikator-Ableitung.`);
  }
  return errors;
}
