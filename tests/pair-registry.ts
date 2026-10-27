import { readFileSync } from 'node:fs';
import { loadPairRegistry, type PairRegistry } from '../src/engine/pairs.js';

/** Echtes Codex-Dossier (Entwurf) + Ausnahme-Quelle; Tests verwenden nur erfundene Fälle. */
export const json = (p: string) => JSON.parse(readFileSync(new URL(`../data/billing/${p}`, import.meta.url), 'utf8')) as Record<string, unknown>;
export const RAW = json('scope-resolutions/rules.review.json');
export const WOUNDS = json('wounds/rules.review.json');

const loaded = loadPairRegistry(RAW, [WOUNDS]);
if ('error' in loaded) throw new Error(loaded.error);
export const REG: PairRegistry = loaded;
