import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { generateValidatorsSource } from '../src/validation/standalone.js';

describe('vorkompilierte Schema-Prüfer', () => {
  it('passen zu den aktuellen Schemas (sonst: pnpm build:validators)', () => {
    const file = readFileSync(new URL('../src/validation/validators.generated.js', import.meta.url), 'utf8');
    const norm = (s: string) => s.replace(/\r\n/g, '\n');
    expect(norm(file)).toBe(norm(generateValidatorsSource()));
  });

  it('enthalten kein require() und kein new Function (CSP ohne unsafe-eval)', () => {
    const file = readFileSync(new URL('../src/validation/validators.generated.js', import.meta.url), 'utf8');
    expect(file).not.toMatch(/require\(|new Function|\beval\(/);
  });
});
