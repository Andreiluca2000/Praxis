import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { validateRulePackage, validateSettings } from '../validation/validate.js';

/** Prüft die mitgelieferten Daten gegen Schemas und semantische Regeln. Exit-Code 1 bei Fehlern. */
const root = (p: string) => fileURLToPath(new URL(`../../${p}`, import.meta.url));
const load = (p: string): unknown => JSON.parse(readFileSync(root(p), 'utf8'));

const checks = [
  ['config/practice.example.json', validateSettings(load('config/practice.example.json'))],
  ['data/billing/rules.example.json', validateRulePackage(load('data/billing/rules.example.json'))],
] as const;

let failed = false;
for (const [file, res] of checks) {
  console.log(`${res.ok ? 'OK    ' : 'FEHLER'} ${file}`);
  for (const e of res.errors) console.log(`       - ${e}`);
  failed ||= !res.ok;
}
process.exit(failed ? 1 : 0);
