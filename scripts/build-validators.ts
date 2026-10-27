/**
 * Erzeugt vorkompilierte Schema-Prüfer (Ajv „standalone“) für die Oberfläche.
 * Grund: ajv.compile() baut Code mit `new Function` – das Fenster müsste dafür `'unsafe-eval'` in der CSP erlauben.
 * Ausgabe: src/validation/validators.generated.js (wird eingecheckt; ein Test prüft, dass sie aktuell ist).
 * Aufruf: pnpm build:validators
 */
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { generateValidatorsSource } from '../src/validation/standalone.js';

const out = fileURLToPath(new URL('../src/validation/validators.generated.js', import.meta.url));
writeFileSync(out, generateValidatorsSource());
console.log(`geschrieben: ${out}`);
