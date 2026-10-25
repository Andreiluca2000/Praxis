import type { IcdCatalog } from '../src/icd/catalog.js';
import { IcdIndex } from '../src/icd/search.js';

/**
 * Lädt den abgeleiteten Katalog einmal (lazy, eigenes Bundle-Stück) und hält den Index im Speicher.
 * Der Katalog enthält keine Patientendaten.
 */
let pending: Promise<IcdIndex> | null = null;

export function loadIcd(): Promise<IcdIndex> {
  pending ??= import('../data/icd/catalog-2026.json').then((m) => new IcdIndex((m.default ?? m) as unknown as IcdCatalog));
  return pending;
}
