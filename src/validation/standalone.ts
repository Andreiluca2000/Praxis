import { Ajv2020 } from 'ajv/dist/2020.js';
import { _ } from 'ajv';
import standaloneModule from 'ajv/dist/standalone/index.js';
import addFormatsModule from 'ajv-formats';
import billingRuleSchema from '../../schemas/billing-rule.schema.json' with { type: 'json' };
import practiceSettingsSchema from '../../schemas/practice-settings.schema.json' with { type: 'json' };

/**
 * Quelltext der vorkompilierten Prüfer. Nur zur Erzeugung (Skript/Test) – zur Laufzeit wird nichts kompiliert.
 * Die Optionen entsprechen der bisherigen Laufzeit-Prüfung (strictSchema an, nur die Stilregeln strictTypes/strictRequired aus,
 * weil die von Codex gepflegten Schemas `type` in if/then nicht wiederholen).
 */
const standaloneCode = standaloneModule as unknown as (ajv: Ajv2020, refs: Record<string, string>) => string;
const addFormats = addFormatsModule as unknown as (ajv: Ajv2020) => Ajv2020;

export const SCHEMA_IDS = { rules: 'praxis:billing-rule', settings: 'praxis:practice-settings' } as const;

export function generateValidatorsSource(): string {
  const ajv = new Ajv2020({
    allErrors: true,
    strictSchema: true,
    strictNumbers: true,
    strictTypes: false,
    strictTuples: true,
    strictRequired: false,
    allowUnionTypes: true,
    code: { source: true, esm: true, lines: true, formats: _`__formats` },
  });
  addFormats(ajv);
  ajv.addSchema(billingRuleSchema as object, SCHEMA_IDS.rules);
  ajv.addSchema(practiceSettingsSchema as object, SCHEMA_IDS.settings);
  // Ajv lässt Laufzeithilfen als `require(...)` stehen – im Fenster gibt es kein require. Daher als ES-Import;
  // Node (Standard-Import einer CJS-Datei = module.exports) und Vite (= exports.default) liefern Verschiedenes.
  const imports: string[] = [];
  const code = standaloneCode(ajv, { rules: SCHEMA_IDS.rules, settings: SCHEMA_IDS.settings })
    .replace(/const (\w+) = require\("([^"]+)"\)\.default;/g, (_m, name: string, mod: string) => {
      const ns = `__m${imports.length}`;
      imports.push(`import * as ${ns} from '${mod}.js';`);
      return `const ${name} = typeof ${ns}.default === 'function' ? ${ns}.default : ${ns}.default.default;`;
    });
  if (/require\(/.test(code)) throw new Error('Unerwartetes require() im erzeugten Prüfer.');
  return [
    '// @ts-nocheck',
    '/* eslint-disable */',
    '// ERZEUGT von scripts/build-validators.ts – nicht von Hand ändern. Neu erzeugen: pnpm build:validators',
    "import { fullFormats as __formats } from 'ajv-formats/dist/formats.js';",
    ...imports,
    code,
    '',
  ].join('\n');
}
