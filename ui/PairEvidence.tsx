import type { PairEvidence as Item, PairVerdict } from '../src/engine/pairs.js';

/** Anzeige der Paar-Befunde, gemeinsam für Quartalsprüfung und Behandlung. */
export const VERDICT: Record<PairVerdict, { label: string; pill: string }> = {
  excluded: { label: 'Ausschluss', pill: 'billing_conflict' },
  exception_review: { label: 'Ausnahme prüfen', pill: 'not_verifiable' },
  not_verifiable: { label: 'Sitzung nicht prüfbar', pill: 'not_applicable' },
  separate_confirmed: { label: 'Getrennte Sitzungen bestätigt', pill: 'candidate' },
};

/** Belege als Zitat des Normtexts mit Fundstelle. */
export function PairEvidence({ items }: { items: Item[] }) {
  return (
    <ul className="evidence">
      {items.map((e, i) => (
        <li key={i}>
          <span className="muted">{e.url ? <a href={e.url} target="_blank" rel="noreferrer">{e.locator}</a> : e.locator}</span>
          {e.anchor && <blockquote>„{e.anchor}“</blockquote>}
        </li>
      ))}
    </ul>
  );
}
