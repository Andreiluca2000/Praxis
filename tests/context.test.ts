import { describe, expect, it } from 'vitest';
import { ContextRegistry } from '../src/duria/context.js';

const raw = (s: string) => Buffer.from(s);

describe('Patientenkontext – ACCEPTANCE.md CTX-01…04', () => {
  it('CTX-01: Analyse auf Patient A, danach Patient B geöffnet → Übernahme gesperrt', () => {
    const reg = new ContextRegistry();
    const a = reg.open('PC1', '99001', raw('a'), 'gdt');
    reg.open('PC1', '99002', raw('b'), 'gdt');
    expect(reg.verify('PC1', a)).toEqual({ ok: false, reason: 'patient_changed' });
  });

  it('CTX-02: zwei Arbeitsplätze bleiben getrennt', () => {
    const reg = new ContextRegistry();
    const a = reg.open('PC1', '99001', raw('a'), 'gdt');
    reg.open('PC2', '99002', raw('b'), 'gdt');
    expect(reg.verify('PC1', a)).toEqual({ ok: true });
    expect(reg.verify('PC2', a)).toEqual({ ok: false, reason: 'session_mismatch' });
  });

  it('CTX-03: Daten nach dem Lesen geändert → Revision abweichend', () => {
    const reg = new ContextRegistry();
    const a = reg.open('PC1', '99001', raw('v1'), 'gdt');
    reg.open('PC1', '99001', raw('v2'), 'gdt');
    expect(reg.verify('PC1', a)).toEqual({ ok: false, reason: 'revision_changed' });
  });

  it('CTX-04: Kontext abgelaufen/geschlossen → kein Rückgriff auf den letzten Stand', () => {
    let t = 0;
    const reg = new ContextRegistry(1000, () => t);
    const a = reg.open('PC1', '99001', raw('a'), 'gdt');
    t = 5000;
    expect(reg.verify('PC1', a)).toEqual({ ok: false, reason: 'expired' });
    const b = reg.open('PC1', '99001', raw('a'), 'gdt');
    reg.close('PC1');
    expect(reg.verify('PC1', b)).toEqual({ ok: false, reason: 'no_context' });
  });

  it('Pseudonym enthält die Patientennummer nicht', () => {
    const reg = new ContextRegistry();
    expect(reg.open('PC1', '99001', raw('a'), 'gdt').patientToken).not.toContain('99001');
  });
});
