import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { Ajv2020 } from 'ajv/dist/2020.js';
import addFormatsModule from 'ajv-formats';
import { describe, expect, it } from 'vitest';
import schema from '../schemas/forms-muster.schema.json' with { type: 'json' };
import catalogSchema from '../schemas/forms-catalog.schema.json' with { type: 'json' };
import { allRules, FORM_IDS, getForm } from '../src/forms/catalog.js';
import { CATALOG } from '../src/forms/katalog.js';

const root = (p: string) => fileURLToPath(new URL(`../${p}`, import.meta.url));
const addFormats = addFormatsModule as unknown as (ajv: Ajv2020) => Ajv2020;

describe('Formulardaten (data/forms)', () => {
  const ajv = addFormats(new Ajv2020({ allErrors: true, strict: true, strictTypes: false }));
  const validate = ajv.compile(schema as object);

  it.each(FORM_IDS)('%s entspricht dem Schema', (id) => {
    const data: unknown = JSON.parse(readFileSync(root(`data/forms/${id}.json`), 'utf8'));
    const ok = validate(data);
    expect(validate.errors ?? []).toEqual([]);
    expect(ok).toBe(true);
  });

  it.each(FORM_IDS)('%s: Regel- und Feldkennungen sind eindeutig, Gruppen existieren, Felder liegen auf dem Vordruck', (id) => {
    const form = getForm(id);
    const ruleIds = allRules(form).map((r) => r.id);
    // Dieselbe Kennung darf mehrfach vorkommen (Gruppe und Feld), muss dann aber dieselbe Regel sein.
    const byId = new Map<string, string>();
    for (const r of allRules(form)) {
      const key = `${r.text}|${r.source.artifact}|${r.source.locator}`;
      expect(byId.get(r.id) ?? key, r.id).toBe(key);
      byId.set(r.id, key);
    }
    const prefix = `m${form.muster.padStart(2, '0')}.`;
    for (const r of ruleIds) expect(r.startsWith(prefix)).toBe(true);
    const fieldIds = form.fields.map((f) => f.id);
    expect(new Set(fieldIds).size).toBe(fieldIds.length);
    for (const f of form.fields) {
      if (f.group) expect(form.groups.map((g) => g.id)).toContain(f.group);
      expect(f.box.x + f.box.w).toBeLessThanOrEqual(100.5);
      expect(f.box.y + f.box.h).toBeLessThanOrEqual(100.5);
    }
  });

  it('jede Fundstelle verweist auf ein Artefakt im Manifest', () => {
    const manifest = JSON.parse(readFileSync(root('data/forms/sources.manifest.json'), 'utf8')) as { artifacts: { id: string }[] };
    const ids = manifest.artifacts.map((a) => a.id);
    for (const id of FORM_IDS) for (const r of allRules(getForm(id))) expect(ids).toContain(r.source.artifact);
  });

  it('Gesamtkatalog: Schema, alle Nummern e01–86, eindeutige Regelkennungen, Fundstelle innerhalb der Seiten', () => {
    const v = ajv.compile(catalogSchema as object);
    const data = JSON.parse(readFileSync(root('data/forms/catalog.json'), 'utf8')) as unknown;
    expect(v(data), JSON.stringify(v.errors?.slice(0, 3))).toBe(true);
    const ids = CATALOG.flatMap((e) => e.rules.map((r) => r.id));
    expect(new Set(ids).size).toBe(ids.length);
    for (const m of ['e01', '2', '4', '6', '10', '12', '13', '16', '61 Teil A', '86']) expect(CATALOG.map((e) => e.muster)).toContain(m);
    for (const e of CATALOG) {
      const [from, to] = e.erlaeuterungen_pages.split('–').map(Number) as [number, number | undefined];
      for (const r of e.rules) {
        const pages = [...r.locator.matchAll(/S\. (\d+)/g)].map((m) => Number(m[1]));
        for (const p of pages) expect(p >= from - 1 && p <= (to ?? from) + 1, `${r.id}: ${r.locator}`).toBe(true);
      }
    }
  });

  it('Quelldateien stimmen mit Größe und SHA-256 des Manifests überein', () => {
    const manifest = JSON.parse(readFileSync(root('data/forms/sources.manifest.json'), 'utf8')) as { artifacts: { path: string; bytes: number; sha256: string }[] };
    for (const a of manifest.artifacts) {
      const buf = readFileSync(root(`data/forms/${a.path}`));
      expect(buf.length, a.path).toBe(a.bytes);
      expect(createHash('sha256').update(buf).digest('hex'), a.path).toBe(a.sha256);
    }
  });
});
