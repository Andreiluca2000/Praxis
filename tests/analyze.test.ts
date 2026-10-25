import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { RulePackage } from '../src/domain/types.js';
import { ContextRegistry } from '../src/duria/context.js';
import { DEFAULT_MAPPING } from '../src/duria/mapping.js';
import { analyse } from '../src/server/analyze.js';
import { confirmed, settings } from './fixtures.js';
import { syntheticBdt } from './synthetic-bdt.js';

const rules = JSON.parse(readFileSync(new URL('../data/billing/rules.example.json', import.meta.url), 'utf8')) as RulePackage;
const deps = () => ({ mapping: DEFAULT_MAPPING, settings: settings(), rules, contexts: new ContextRegistry() });

describe('Gesamtablauf: Export → Erkennung → Prüfung', () => {
  it('liefert keine Identitätsdaten und keine Patientennummer an die Oberfläche', () => {
    const r = analyse(syntheticBdt(), 'bdt', { sessionId: 'S1', serviceDate: '2026-11-12', mode: 'simulation' }, deps());
    expect(JSON.stringify(r)).not.toMatch(/Mustermann|Erika|01011970|99001/);
    expect(r.blocked).toBeNull();
  });

  it('Erkennungen sind Vorschläge; ohne Bestätigung keine positiven Ergebnisse', () => {
    const r = analyse(syntheticBdt(), 'bdt', { sessionId: 'S1', serviceDate: '2026-11-12', mode: 'simulation' }, deps());
    expect(r.mentions.every((m) => m.verification === 'uncertain')).toBe(true);
    expect(r.findings.every((f) => f.outcome !== 'candidate')).toBe(true);
  });

  it('operativer Modus mit DEMO-Paket → keine Ergebnisse', () => {
    const r = analyse(syntheticBdt(), 'bdt', { sessionId: 'S1', serviceDate: '2026-11-12', mode: 'operational' }, deps());
    expect(r.findings).toEqual([]);
  });

  it('bestätigte Fakten + bestätigter Zeitraum → Simulator kann einen Kandidaten zeigen', () => {
    const r = analyse(syntheticBdt(), 'bdt', {
      sessionId: 'S1', serviceDate: '2026-11-12', mode: 'simulation',
      declaredRange: { from: '2026-10-01', to: '2026-12-31' },
      confirmedFacts: {
        'service.status': confirmed('performed'),
        'documentation.duration_minutes': confirmed(15),
        'documentation.required_components_complete': confirmed(true),
      },
    }, deps());
    expect(r.findings[0]).toMatchObject({ outcome: 'candidate', simulated: true });
  });

  it('mehrere Patienten → gesperrt, Kontext geschlossen', () => {
    const d = deps();
    const multi = Buffer.concat([syntheticBdt('99001'), syntheticBdt('99002')]);
    const r = analyse(multi, 'bdt', { sessionId: 'S1', serviceDate: '2026-11-12', mode: 'simulation' }, d);
    expect(r.blocked).toMatch(/Mehrere Patienten/);
    expect(d.contexts.current('S1')).toBeNull();
  });
});
