/** Validate the review dossier against the current application contract and gates.
 * No production configuration is modified and no draft is activated.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { evaluateRule } from '../src/engine/evaluate.js';
import { validateRulePackage, validateSettings } from '../src/validation/validate.js';

const read = (relative: string): unknown => JSON.parse(readFileSync(new URL(relative, import.meta.url), 'utf8'));
const dossier = read('../data/billing/rules.draft.2026-q4.json') as {
  content_kind: string; package_id: string; package_version: string; rules: unknown[];
};
assert.equal(dossier.content_kind, 'draft_catalogue');
// The legacy envelope only offers synthetic_example/reviewed_catalogue.
// This in-memory adapter tests individual rule compatibility; it is NOT a review approval or saved package.
const validated = validateRulePackage({
  schema_version: '0.1.0', package_id: dossier.package_id, package_version: dossier.package_version,
  content_kind: 'reviewed_catalogue', rules: dossier.rules,
});
assert.equal(validated.ok, true, validated.errors.join('\n'));
const settings = validateSettings(read('../config/practice.example.json'));
assert.equal(settings.ok, true, settings.errors.join('\n'));
assert.ok(validated.value && settings.value);
for (const rule of validated.value.rules) {
  assert.equal(rule.status, 'draft');
  for (const mode of ['operational', 'simulation'] as const) {
    const result = evaluateRule(rule, {
      serviceDate: '2026-10-25', facts: {}, billedServices: [], coverage: [], hzvContractId: null,
    }, settings.value, mode);
    assert.equal(result.outcome, 'not_applicable', `${rule.id} unexpectedly participates in ${mode}`);
    assert.equal(result.category, null);
  }
}
console.log(`PASS: ${validated.value.rules.length} real drafts satisfy the application rule schema and semantic checks; all are inactive in operational and DEMO simulation modes.`);
