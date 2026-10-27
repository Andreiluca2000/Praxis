import { loadPairRegistry, type PairRegistry } from '../src/engine/pairs.js';

let cached: Promise<PairRegistry | { error: string }> | null = null;

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
