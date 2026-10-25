import { useEffect, useMemo, useState } from 'react';
import { usageNotes, type IcdEntry } from '../src/icd/catalog.js';
import type { IcdIndex, SearchHit } from '../src/icd/search.js';
import { loadIcd } from './icd-store.js';

/**
 * ICD-10-GM-Suche (amtlicher Katalog BfArM). Findet Klassifikationsbegriffe zu einer dokumentierten Diagnose –
 * stellt keine Diagnose aus Symptomen. Optional mit Auswahl (z. B. aus einer Notiz).
 */
export function IcdSearch({ onPick, initial = '' }: { onPick?: (e: IcdEntry) => void; initial?: string }) {
  const [idx, setIdx] = useState<IcdIndex | null>(null);
  const [error, setError] = useState('');
  const [q, setQ] = useState(initial || (import.meta.env.DEV ? new URLSearchParams(location.search).get('q') ?? '' : ''));
  const [selected, setSelected] = useState<IcdEntry | null>(null);

  useEffect(() => {
    loadIcd().then((i) => {
      setIdx(i);
      const pre = import.meta.env.DEV ? new URLSearchParams(location.search).get('code') : null; // nur Vorschau
      if (pre) setSelected(i.get(pre));
    }, (e) => setError(String(e)));
  }, []);
  const hits: SearchHit[] = useMemo(() => (idx && q.trim().length >= 2 ? idx.search(q, 40) : []), [idx, q]);

  if (error) return <p className="error">ICD-Katalog konnte nicht geladen werden: {error}</p>;
  if (!idx) return <p className="muted">ICD-10-GM wird geladen …</p>;

  const show = (code: string) => { const e = idx.get(code); if (e) setSelected(e); };

  return (
    <div className="icd">
      <div className="row">
        <input autoFocus value={q} onChange={(e) => { setQ(e.target.value); setSelected(null); }} placeholder="Diagnose oder Kode, z. B. „akute Bronchitis“ oder J20" style={{ flex: 1 }} />
        <span className="muted">ICD-10-GM {idx.catalog.version} · {idx.size.toLocaleString('de-DE')} Kodes · BfArM</span>
      </div>
      <div className="icd-grid">
        <ul className="icd-hits" role="listbox" aria-label="Treffer">
          {q.trim().length >= 2 && hits.length === 0 && <li className="muted">Kein Treffer. Es wird kein Kode erfunden.</li>}
          {hits.map((h) => (
            <li key={h.entry.code} role="option" aria-selected={selected?.code === h.entry.code}
              className={selected?.code === h.entry.code ? 'on' : ''} onClick={() => setSelected(h.entry)}>
              <strong>{h.entry.display}</strong> {h.entry.title}
              {!h.entry.terminal && <span className="pill">nicht endständig</span>}
              {h.matchedIn === 'inklusivum' && <div className="muted">über Inklusivum: „{h.matchedText}“</div>}
            </li>
          ))}
        </ul>
        {selected && (
          <div className="icd-detail">
            <h3>{selected.display} – {selected.title}</h3>
            {usageNotes(selected).map((n) => <p key={n} className="warn">{n}</p>)}
            {selected.children.length > 0 && (
              <><h4>Spezifischere Kodes</h4>
                <ul>{selected.children.map((c) => <li key={c}><button className="link" onClick={() => show(c)}>{c} {idx.get(c)?.title}</button></li>)}</ul></>
            )}
            {selected.inclusions.length > 0 && <><h4>Inklusiva</h4><ul>{selected.inclusions.map((t) => <li key={t}>{t}</li>)}</ul></>}
            {selected.exclusions.length > 0 && <><h4>Exklusiva</h4><ul>{selected.exclusions.map((t) => <li key={t}>{t}</li>)}</ul></>}
            {onPick && (
              <button className="primary" disabled={selected.p295 === 'V'} onClick={() => onPick(selected)}>
                {selected.code} übernehmen
              </button>
            )}
            <p className="muted">Diagnosesicherheit (G/V/A/Z) wird separat vom Arzt gewählt.</p>
          </div>
        )}
      </div>
    </div>
  );
}
