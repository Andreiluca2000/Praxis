import { type KeyboardEvent, useRef, useState } from 'react';
import type { Need } from '../../src/forms/gaps.js';
import type { FieldState, FieldValue, FormDefinition, FormField, IssueLevel } from '../../src/forms/types.js';
import type { FormLayout } from './layouts.js';

/**
 * Nachbildung eines KBV-Vordrucks als SVG: Linien, Schreibflächen und Beschriftungen wie auf dem Original,
 * die Einträge in „Druckerschrift“ an ihrem Platz. Nur zur Orientierung – keine Druckvorlage.
 */

/** n = Nummer in der Prüfliste (eine Ankreuzgruppe teilt sich eine Nummer; first = dort steht das Abzeichen). */
export type Mark = { n: number; first: boolean; state: FieldState | 'geaendert' | 'kartei'; issue: IssueLevel | null; need: Need | null };

type Props = {
  form: FormDefinition;
  layout: FormLayout;
  /** Seite bei mehrseitigen Vordrucken. */
  page?: number;
  values: Readonly<Record<string, FieldValue>>;
  marks: Readonly<Record<string, Mark>>;
  selected: string | null;
  onSelect: (fieldId: string) => void;
  /** Direkt auf dem Vordruck ankreuzen oder schreiben – dieselbe Quelle wie die Prüfliste. */
  onChange: (fieldId: string, value: FieldValue) => void;
};

/** Auf dem Vordruck bearbeitbar: alles außer Personalien, Stempel und Angaben aus DURIA. */
const editable = (f: FormField) => f.kind !== 'personalien' && f.kind !== 'stempel' && f.filled_by !== 'duria';

const INK = '#1c2b5c';
const LINE = '#e3342f';
const GHOST = '#f6c8c1';
const MONO = '"Cascadia Mono", Consolas, "Courier New", monospace';

type PxBox = { x: number; y: number; w: number; h: number };

/** Platz für das Nummern-Abzeichen: links vom Feld, sonst rechts, sonst innen oben – ohne Beschriftungen oder andere Felder zu verdecken. */
function badgeAt(layout: FormLayout, b: PxBox, others: readonly PxBox[]): [number, number] {
  const cy = b.y + Math.min(b.h, 14) / 2;
  const free = (x: number, y: number) => x > 7 && x < layout.width - 7 && layout.labels.every((l) => {
    const lw = l.t.length * l.s * 0.52;
    return x + 6.5 < l.x || x - 6.5 > l.x + lw || y + 6.5 < l.y - l.s * 0.8 || y - 6.5 > l.y + 1;
  }) && others.every((o) => o === b || x < o.x || x > o.x + o.w || y < o.y || y > o.y + o.h);
  const options: [number, number][] = [[b.x - 9, cy], [b.x + b.w + 9, cy], [b.x - 9, b.y - 6], [b.x + 7, b.y + 7]];
  return options.find(([x, y]) => free(x, y)) ?? options[options.length - 1]!;
}

function wrap(text: string, maxChars: number, maxLines: number): string[] {
  const out: string[] = [];
  let line = '';
  for (const word of text.split(/\s+/)) {
    const next = line ? `${line} ${word}` : word;
    if (next.length > maxChars && line) { out.push(line); line = word; } else line = next;
  }
  if (line) out.push(line);
  if (out.length > maxLines) {
    const kept = out.slice(0, maxLines);
    kept[maxLines - 1] = `${kept[maxLines - 1]!.slice(0, maxChars - 1)}…`;
    return kept;
  }
  return out;
}

const markClass = (m: Mark | undefined) => (m
  ? `mark-${m.issue === 'unzulaessig' ? 'bad' : m.need === 'fehlt' ? 'fehlt' : m.need === 'entscheidung' || m.state === 'unbekannt' ? 'open' : m.need === 'empfohlen' ? 'empfohlen' : m.state}`
  : '');

/** Abzeichen: „!“ = Angabe fehlt, „?“ = selbst entscheiden, sonst die Nummer der Zeile in der Prüfliste. */
export const badgeText = (m: Mark) => (m.issue === 'unzulaessig' ? '✕' : m.need === 'fehlt' ? '!' : m.need === 'entscheidung' ? '?' : String(m.n));

function Entry({ field, value, layout, box }: { field: FormField; value: FieldValue; layout: FormLayout; box: { x: number; y: number; w: number; h: number } }) {
  if (field.kind === 'checkbox') {
    if (value !== true) return null;
    // Ovale (Muster 10A) werden „durch Striche“ markiert, nicht angekreuzt.
    if (box.w > box.h * 2) return <line x1={box.x - 1} y1={box.y + box.h / 2} x2={box.x + box.w + 1} y2={box.y + box.h / 2} stroke={INK} strokeWidth={2.2} strokeLinecap="round" />;
    const p = Math.min(box.w, box.h) * 0.22;
    return (
      <g stroke={INK} strokeWidth={1.7} strokeLinecap="round">
        <line x1={box.x + p} y1={box.y + p} x2={box.x + box.w - p} y2={box.y + box.h - p} />
        <line x1={box.x + box.w - p} y1={box.y + p} x2={box.x + p} y2={box.y + box.h - p} />
      </g>
    );
  }
  if (typeof value !== 'string' || !value) return null;
  if (field.kind === 'personalien' || field.kind === 'stempel' || field.filled_by === 'duria') return null;
  if (field.format) {
    // Kästchenfelder (QJJ, TTMMJJ): ein Zeichen je Kästchen, wie vom Drucker gesetzt.
    const cells = field.format.length;
    // Kästchengrenzen aus den senkrechten Trennlinien des Vordrucks; sonst gleichmäßig teilen.
    const xs = layout.strokes
      .flatMap((s) => ('line' in s && s.line[0] === s.line[2] && s.line[0] > box.x + 1 && s.line[0] < box.x + box.w - 1 && Math.min(s.line[1], s.line[3]) > box.y - 3 && Math.max(s.line[1], s.line[3]) < box.y + box.h + 3 ? [s.line[0]] : []))
      .sort((a, b) => a - b);
    const exact = xs.length === cells - 1 && cells > 1;
    const cw = exact ? (xs[xs.length - 1]! - xs[0]!) / Math.max(1, xs.length - 1) : box.w / cells;
    const left = exact ? xs[0]! - cw : box.x;
    return (
      <g fill={INK} fontFamily={MONO} fontSize={Math.min(11, box.h * 0.75)} textAnchor="middle">
        {value.slice(0, cells).split('').map((c, i) => <text key={i} x={left + cw * (i + 0.5)} y={box.y + box.h * 0.78}>{c}</text>)}
      </g>
    );
  }
  // Grundlinien: weiße Schreibzeilen, sonst waagerechte Linien unter der Beschriftung, sonst gleichmäßig.
  const lines = field.lines ?? 1;
  const rows = layout.whites
    .filter(([x, y, w, h]) => x >= box.x - 2 && y >= box.y - 2 && x + w <= box.x + box.w + 2 && y + h <= box.y + box.h + 2 && h < 40)
    .sort((a, b) => a[1] - b[1])
    .map(([, y, , h]) => y + h - 4.5)
    // Zwei Schreibflächen auf derselben Zeile (z. B. „Stunden täglich“ daneben) sind eine Zeile.
    .filter((y, i, all) => i === 0 || Math.abs(y - all[i - 1]!) > 2);
  const ruled = layout.strokes
    .flatMap((s) => ('line' in s && s.line[1] === s.line[3] && s.line[1] > box.y + 9 && s.line[1] < box.y + box.h + 1 && s.line[0] < box.x + box.w && s.line[2] > box.x ? [s.line[1]] : []))
    // Linien in Höhe einer Beschriftung („Untersuchungsergebnisse ____“) sind keine Schreibzeilen.
    .filter((y) => !layout.labels.some((l) => Math.abs(l.y - y) < 6 && l.x >= box.x - 2 && l.x < box.x + box.w))
    .sort((a, b) => a - b)
    .map((y) => y - 3);
  const base = rows.length ? rows.slice(-lines) : ruled.length ? ruled : [];
  const fs = lines > 1 ? 9 : Math.min(9.5, box.h * 0.62);
  const maxChars = Math.max(4, Math.floor((box.w - 8) / (fs * 0.56)));
  const text = wrap(value, maxChars, Math.max(lines, base.length ? Math.min(base.length, lines + 1) : lines));
  return (
    <g fill={INK} fontFamily={MONO} fontSize={fs}>
      {text.map((t, i) => <text key={i} x={box.x + 5} y={base[i] ?? box.y + ((i + 1) * box.h) / (lines + 0.4) - 1}>{t}</text>)}
    </g>
  );
}

/** Schreibfeld über dem Feld des Vordrucks: Enter oder Verlassen speichert, Esc bricht ab, Tab springt weiter. */
function InlineInput({ field, box, value, W, onDone }: {
  field: FormField; box: PxBox; value: string; W: number;
  /** move: Tab-Richtung, 0 = auf dem Feld bleiben, null = Fokus ging woandershin. */
  onDone: (next: string | null, move: 0 | 1 | -1 | null) => void;
}) {
  const [draft, setDraft] = useState(value);
  const done = useRef(false);
  const finish = (next: string | null, move: 0 | 1 | -1 | null) => {
    if (done.current) return;
    done.current = true;
    onDone(next, move);
  };
  const multi = (field.lines ?? 1) > 1;
  const w = Math.max(box.w, 70);
  const h = multi ? Math.max(box.h, 30) : Math.max(box.h, 15);
  const x = Math.max(2, Math.min(box.x, W - w - 2));
  const onKeyDown = (e: KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    if (e.key === 'Escape') { e.preventDefault(); finish(null, 0); }
    else if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); finish(draft, 0); }
    else if (e.key === 'Tab') { e.preventDefault(); finish(draft, e.shiftKey ? -1 : 1); }
  };
  const common = {
    className: 'schein-input', autoFocus: true, value: draft, 'aria-label': field.label,
    onChange: (e: { target: { value: string } }) => setDraft(e.target.value),
    onKeyDown, onBlur: () => finish(draft, null),
    style: { fontSize: multi ? 9 : Math.min(10, Math.max(8, box.h * 0.62)) },
  };
  return (
    <foreignObject x={x} y={box.y + (box.h - h) / 2} width={w} height={h} className="schein-edit">
      {multi
        ? <textarea {...common} />
        : <input {...common} maxLength={field.format?.length} placeholder={field.format ?? ''} inputMode={field.format ? 'numeric' : undefined} />}
    </foreignObject>
  );
}

export function ScheinSvg({ form, layout, page = 0, values, marks, selected, onSelect, onChange }: Props) {
  const W = layout.width;
  const H = layout.height;
  const svgRef = useRef<SVGSVGElement>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const px = (f: FormField) => ({ x: (f.box.x / 100) * W, y: (f.box.y / 100) * H, w: (f.box.w / 100) * W, h: (f.box.h / 100) * H });
  // Lesereihenfolge (wie die Prüfliste) – so springt Tab Zeile für Zeile durch den Vordruck.
  const onPage = form.fields.filter((f) => (f.page ?? 0) === page).sort((a, b) => a.box.y - b.box.y || a.box.x - b.box.x);
  const boxes = onPage.map(px);

  /** Kreuz setzen oder entfernen; in „genau eins“-Gruppen fallen die anderen Kreuze weg. */
  function toggle(f: FormField) {
    const on = values[f.id] !== true;
    const g = f.group ? form.groups.find((x) => x.id === f.group) : undefined;
    if (on && g?.select === 'genau_eins') form.fields.filter((o) => o.group === g.id && o.id !== f.id && values[o.id] === true).forEach((o) => onChange(o.id, false));
    onChange(f.id, on);
  }

  function focusField(id: string, move: 1 | -1) {
    const all = [...(svgRef.current?.querySelectorAll<SVGGElement>('.schein-field[tabindex="0"]') ?? [])];
    const i = all.findIndex((el) => el.dataset.fid === id);
    all[i + move]?.focus();
  }

  function activate(f: FormField) {
    onSelect(f.id);
    if (!editable(f)) return;
    if (f.kind === 'checkbox') toggle(f);
    else setEditing(f.id);
  }

  function onFieldKey(e: KeyboardEvent<SVGGElement>, f: FormField) {
    if (e.key !== ' ' && e.key !== 'Enter' && e.key !== 'F2') return;
    e.preventDefault();
    activate(f);
  }

  const editField = onPage.find((f) => f.id === editing);
  const editBox = editField ? boxes[onPage.indexOf(editField)]! : null;
  const filled = form.fields.filter((f) => (f.page ?? 0) === page && f.format && typeof values[f.id] === 'string' && values[f.id]).map(px);
  return (
    <svg ref={svgRef} className="schein" viewBox={`0 0 ${W} ${H}`} role="group" aria-label={`Muster ${form.muster} – ${form.title}, direkt ausfüllbar`}>
      <rect x={0} y={0} width={W} height={H} rx={10} fill="#fff" />
      {layout.bands.map(([x, y, w, h], i) => <rect key={`b${i}`} x={x} y={y} width={w} height={h} rx={8} fill={layout.tint ?? '#fff'} />)}
      {layout.whites.map(([x, y, w, h], i) => <rect key={`w${i}`} x={x} y={y} width={w} height={h} fill="#fff" />)}
      {layout.strokes.map((s, i) => ('rect' in s
        ? <rect key={`s${i}`} x={s.rect[0]} y={s.rect[1]} width={s.rect[2]} height={s.rect[3]} rx={s.r} fill="none" stroke={LINE} strokeWidth={Math.max(0.5, s.w)} />
        : <line key={`s${i}`} x1={s.line[0]} y1={s.line[1]} x2={s.line[2]} y2={s.line[3]} stroke={LINE} strokeWidth={Math.max(0.5, s.w)} />))}
      {layout.fills.map(([x, y, w, h, c], i) => <rect key={`f${i}`} x={x} y={y} width={w} height={h} fill={c ?? LINE} />)}
      {layout.labels.filter((l) => !(l.ghost && filled.some((b) => l.x >= b.x - 2 && l.x <= b.x + b.w && l.y >= b.y && l.y <= b.y + b.h + 4))).map((l, i) => (
        <text key={`l${i}`} x={l.x} y={l.y} fontSize={l.s} fontWeight={l.b ? 700 : 400} fontStyle={l.i ? 'italic' : 'normal'}
          fill={l.white ? '#fff' : l.ghost ? GHOST : l.dark ? '#222' : LINE} className="schein-label">{l.t}</text>
      ))}

      {onPage.map((f, i) => {
        const b = boxes[i]!;
        const m = marks[f.id];
        const on = selected === f.id;
        const canEdit = editable(f);
        const box = f.kind === 'checkbox';
        return (
          <g key={f.id} data-fid={f.id} className={`schein-field ${markClass(m)} ${on ? 'on' : ''} ${canEdit ? 'edit' : ''}`}
            tabIndex={canEdit ? 0 : -1} role={canEdit ? (box ? 'checkbox' : 'textbox') : undefined}
            aria-checked={canEdit && box ? values[f.id] === true : undefined} aria-label={f.label}
            onClick={() => activate(f)} onKeyDown={(e) => onFieldKey(e, f)}>
            <rect className="hit" x={b.x - 2} y={b.y - 2} width={b.w + 4} height={b.h + 4} rx={4} />
            {f.kind === 'personalien' && (
              <g className="duria">
                <rect x={b.x + 4} y={b.y + b.h * 0.38} width={b.w - 8} height={b.h * 0.24} rx={6} />
                <text x={b.x + b.w / 2} y={b.y + b.h * 0.53} textAnchor="middle">Personalien aus DURIA (eGK)</text>
              </g>
            )}
            <Entry field={f} value={values[f.id] ?? null} layout={layout} box={b} />
            {m && m.first && (
              <g className="badge" transform={`translate(${badgeAt(layout, b, boxes).join(' ')})`}>
                <circle r={6.4} />
                <text y={2.6} textAnchor="middle">{badgeText(m)}</text>
              </g>
            )}
          </g>
        );
      })}
      {editField && editBox && (
        <InlineInput key={editField.id} field={editField} box={editBox} W={W}
          value={typeof values[editField.id] === 'string' ? values[editField.id] as string : ''}
          onDone={(next, move) => {
            const id = editField.id;
            const cur = typeof values[id] === 'string' ? values[id] : '';
            if (next !== null && next.trim() !== cur) onChange(id, next.trim());
            setEditing(null);
            if (move) requestAnimationFrame(() => focusField(id, move));
            else if (move === 0) requestAnimationFrame(() => svgRef.current?.querySelector<SVGGElement>(`[data-fid="${id}"]`)?.focus({ preventScroll: true }));
          }} />
      )}
    </svg>
  );
}
