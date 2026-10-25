/**
 * Einlesen der amtlichen ICD-10-GM-Dateien (BfArM) – plattformneutral, nur Textverarbeitung.
 * Codeliste: Metadaten `icd10gm2026syst_kodes.txt` (enthält auch die über Modifikatoren gebildeten Codes).
 * Inklusiva/Exklusiva: ClaML. Abgleich und Korrekturen: ./verify.ts.
 */

export interface KodesRow {
  level: number;
  terminal: boolean;
  chapter: string;
  code: string; // Spalte 7: ohne Strich/Stern/Ausrufezeichen, mit Punkt
  display: string; // Spalte 6: amtliche Schreibweise
  title: string; // Spalte 9: zusammengesetzter Klassentitel
  p295: string; // Spalte 13: P/O/Z/V
  sex: string; // Spalte 20: 9/M/W
  ageLow: string; // Spalte 22
  ageHigh: string; // Spalte 23
  ifsg: string; // Spalte 27
}

export const KODES_COLUMNS = 28;

export function parseKodes(text: string): KodesRow[] {
  const rows: KodesRow[] = [];
  const lines = text.replace(/^\uFEFF/, '').split(/\r?\n/).filter((l) => l.length > 0);
  lines.forEach((line, i) => {
    const c = line.split(';');
    if (c.length !== KODES_COLUMNS) throw new Error(`Metadaten Zeile ${i + 1}: ${c.length} statt ${KODES_COLUMNS} Spalten.`);
    const col = (n: number) => c[n - 1]!;
    if (!['T', 'N'].includes(col(2))) throw new Error(`Metadaten Zeile ${i + 1}: Spalte 2 ist „${col(2)}“ (erwartet T/N).`);
    rows.push({
      level: Number(col(1)), terminal: col(2) === 'T', chapter: col(4), code: col(7), display: col(6), title: col(9),
      p295: col(13), sex: col(20), ageLow: col(22), ageHigh: col(23), ifsg: col(27),
    });
  });
  return rows;
}

export interface ClamlClass {
  kind: string;
  modified: boolean;
  inclusions: string[];
  exclusions: string[];
}

const ENTITIES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" };
function decode(s: string): string {
  return s.replace(/&(#x[0-9a-f]+|#\d+|amp|lt|gt|quot|apos);/gi, (_, e: string) =>
    e[0] === '#' ? String.fromCodePoint(e[1]?.toLowerCase() === 'x' ? parseInt(e.slice(2), 16) : Number(e.slice(1))) : ENTITIES[e.toLowerCase()]!);
}

/** Text eines Labels: Fragmente mit Leerzeichen, Verweise als „(Code)“, übrige Tags entfernt. */
export function labelText(inner: string): string {
  return decode(
    inner
      .replace(/<Reference[^>]*>([\s\S]*?)<\/Reference>/g, ' ($1)')
      .replace(/<\/Fragment>\s*<Fragment[^>]*>/g, ' ')
      .replace(/<[^>]+>/g, ' '),
  ).replace(/\s+/g, ' ').replace(/\(\s+/g, '(').replace(/\s+\)/g, ')').trim();
}

export function parseClaml(xml: string, expectedVersion: string): Map<string, ClamlClass> {
  if (/<!DOCTYPE|<!ENTITY/i.test(xml)) throw new Error('ClaML: DTD/Entitäten sind nicht erlaubt (Sicherheitsprüfung).');
  if (!new RegExp(`<Title[^>]*\\bversion="${expectedVersion}"`).test(xml)) {
    throw new Error(`ClaML: Version ${expectedVersion} nicht im Title-Element gefunden.`);
  }
  const classes = new Map<string, ClamlClass>();
  const classRe = /<Class code="([^"]+)" kind="([^"]+)"[^>]*>([\s\S]*?)<\/Class>/g;
  const rubricRe = /<Rubric kind="(inclusion|exclusion)"[^>]*>([\s\S]*?)<\/Rubric>/g;
  for (const m of xml.matchAll(classRe)) {
    const [, code, kind, body] = m as unknown as [string, string, string, string];
    if (classes.has(code)) throw new Error(`ClaML: Klasse ${code} doppelt.`);
    const c: ClamlClass = { kind, modified: /<ModifiedBy\b/.test(body), inclusions: [], exclusions: [] };
    for (const r of body.matchAll(rubricRe)) {
      const label = /<Label[^>]*>([\s\S]*?)<\/Label>/.exec(r[2]!)?.[1];
      if (!label) continue;
      const text = labelText(label);
      if (text) (r[1] === 'inclusion' ? c.inclusions : c.exclusions).push(text);
    }
    classes.set(code, c);
  }
  return classes;
}
