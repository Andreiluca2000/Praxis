import { loadPairRegistry, type PairRegistry } from '../src/engine/pairs.js';
import { loadWindowRules, type WindowRuleSet } from '../src/engine/window-rules.js';

let cached: Promise<PairRegistry | { error: string }> | null = null;
let windowsCached: Promise<WindowRuleSet | { error: string }> | null = null;

/**
 * Codex-Dossier der Paare je Sitzung (Entwurf) – erst bei Bedarf geladen (eigener Baustein, ~2,7 MB).
 * Die Ausnahmen der Paare stehen im Wunden-Dossier und werden mitgeladen.
 */
export function loadPairDossier(): Promise<PairRegistry | { error: string }> {
  cached ??= Promise.all([
    import('../data/billing/scope-resolutions/rules.review.json'),
    import('../data/billing/wounds/rules.review.json'),
  ]).then(([pairs, wounds]) => loadPairRegistry(pairs.default, [wounds.default]))
    .catch((e: unknown) => ({ error: `Dossier nicht lesbar: ${String(e)}` }));
  return cached;
}

/**
 * Ausschlüsse je Tag/Woche/Behandlungsfall/Krankheitsfall und Höchstanzahlen aus den übrigen Codex-Dossiers (Entwurf).
 * Die belegte Abschnittszugehörigkeit kommt aus dem Paar-Dossier.
 */
export function loadWindowDossiers(): Promise<WindowRuleSet | { error: string }> {
  windowsCached ??= Promise.all([
    import('../data/billing/scope-resolutions/rules.review.json'),
    import('../data/billing/optional-hausarzt/rules.review.json'),
    import('../data/billing/pauschalen/rules.review.json'),
    import('../data/billing/prevention/rules.review.json'),
    import('../data/billing/primary-care/rules.review.json'),
    import('../data/billing/visits/rules.review.json'),
    import('../data/billing/wounds/rules.review.json'),
    import('../data/billing/frequency/rules.review.json'),
  ]).then(([sr, ...rest]) => {
    const names = ['optional-hausarzt', 'pauschalen', 'prevention', 'primary-care', 'visits', 'wounds', 'frequency'];
    const membership = (sr.default as { section_membership?: Record<string, { codes: string[] }> }).section_membership ?? {};
    const sections = Object.fromEntries(Object.entries(membership).map(([k, v]) => [k, v.codes]));
    return loadWindowRules(rest.map((m, i) => ({ name: names[i]!, raw: m.default })), sections);
  }).catch((e: unknown) => ({ error: `Dossiers nicht lesbar: ${String(e)}` }));
  return windowsCached;
}
