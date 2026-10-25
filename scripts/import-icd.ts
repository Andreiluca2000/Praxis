/**
 * Import ICD-10-GM 2026 → data/icd/catalog-2026.json (abgeleitete Datei).
 * Schritte (data/icd/README.md): Manifest + SHA-256 prüfen → Metadaten + ClaML lesen → Corrigenda nur auf die Kopie
 * → Abgleich (jede Abweichung = Abbruch) → in temporäre Datei schreiben → atomar umbenennen.
 * Originaldateien werden nie verändert. Bei Fehler bleibt der bisherige Katalog aktiv.
 */
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { isAbsolute, join, normalize as normPath, resolve } from 'node:path';
import { buildEntries, type IcdCatalog } from '../src/icd/catalog.js';
import { parseClaml, parseKodes } from '../src/icd/parse.js';
import { applyMetadataPatches, reconcile, verifyXmlPatches, type MetadataPatch, type XmlPatch } from '../src/icd/verify.js';

const DIR = resolve('data/icd');
const OUT = join(DIR, 'catalog-2026.json');
const fail = (msg: string): never => { console.error(`QUARANTÄNE – Import abgebrochen: ${msg}`); process.exit(1); };

interface Artifact { path: string; bytes: number; sha256: string }
const manifest = JSON.parse(readFileSync(join(DIR, 'manifest.json'), 'utf8')) as {
  schema_version: string; version: string; effective_from: string; effective_to: string; artifacts: Artifact[];
};
if (manifest.schema_version !== '1.0.0') fail(`Manifest-Version ${manifest.schema_version} nicht unterstützt.`);
if (manifest.version !== '2026') fail(`Ausgabe ${manifest.version} nicht unterstützt.`);

function checked(path: string): Buffer {
  if (isAbsolute(path) || normPath(path).startsWith('..')) fail(`Unzulässiger Pfad im Manifest: ${path}`);
  const a = manifest.artifacts.find((x) => x.path === path) ?? fail(`${path} fehlt im Manifest.`);
  const file = join(DIR, path);
  if (!existsSync(file)) fail(`${path} fehlt.`);
  const buf = readFileSync(file);
  if (buf.length !== a.bytes) fail(`${path}: Größe ${buf.length} statt ${a.bytes}.`);
  const sha = createHash('sha256').update(buf).digest('hex');
  if (sha !== a.sha256) fail(`${path}: SHA-256 stimmt nicht.`);
  return buf;
}

const CLAML = 'icd10gm2026syst_claml_20250912.xml';
const KODES = 'metadata/icd10gm2026syst_kodes.txt';
const CORR = 'corrigenda-20260128.json';
const xmlBuf = checked(CLAML);
const kodesBuf = checked(KODES);
const corr = JSON.parse(checked(CORR).toString('utf8')) as { id: string; xml_patches: XmlPatch[]; metadata_patches: MetadataPatch[] };

// Bekannte, dokumentierte Abweichung des Originals: xml:space="default" am Wurzelelement (XSD lässt es nicht zu).
// Sie betrifft die Inhalte nicht; der Importer prüft nur, dass genau diese eine Besonderheit vorliegt.
const xml = xmlBuf.toString('utf8');
const root = /<ClaML\b[^>]*>/.exec(xml)?.[0] ?? fail('Kein ClaML-Wurzelelement.');
if (!/xml:space="default"/.test(root)) console.warn('Hinweis: dokumentierte Wurzel-Abweichung (xml:space) nicht mehr vorhanden.');

try {
  const rows = parseKodes(kodesBuf.toString('utf8'));
  const classes = parseClaml(xml, manifest.version);
  const log = [...verifyXmlPatches(xml, corr.xml_patches), ...applyMetadataPatches(rows, corr.metadata_patches)];
  const errors = reconcile(rows, classes);
  if (errors.length) fail(`${errors.length} Abweichungen, z. B. ${errors.slice(0, 3).join(' | ')}`);
  const entries = buildEntries(rows, classes);
  const terminal = entries.filter((e) => e.terminal).length;
  if (entries.length !== 16905 || terminal !== 14370) fail(`Anzahl ${entries.length}/${terminal} statt 16905/14370 laut Manifest.`);

  const catalog: IcdCatalog = {
    format: 1, dataset: 'ICD-10-GM', version: manifest.version, validFrom: manifest.effective_from, validTo: manifest.effective_to,
    source: {
      claml: CLAML, clamlSha256: createHash('sha256').update(xmlBuf).digest('hex'),
      metadata: KODES, metadataSha256: createHash('sha256').update(kodesBuf).digest('hex'),
      corrigenda: [corr.id, ...log],
    },
    importedAt: new Date().toISOString(), importer: 'praxis-assistent import-icd 1.0', entries,
  };
  const tmp = `${OUT}.tmp`;
  writeFileSync(tmp, JSON.stringify(catalog));
  renameSync(tmp, OUT);
  console.log(`OK: ${entries.length} Kodes (${terminal} endständig) → ${OUT}`);
  for (const l of log) console.log(`  Korrektur: ${l}`);
} catch (e) {
  fail(e instanceof Error ? e.message : String(e));
}
