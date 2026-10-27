import { Ambulance, CircleAlert, CircleCheck, Files, Hospital, Info, Send, Stethoscope, TriangleAlert, WandSparkles } from 'lucide-react';
import { useMemo, useState } from 'react';
import { analyse, check, propose } from '../../src/forms/advisor.js';
import { valuesOf } from '../../src/forms/build.js';
import { getForm } from '../../src/forms/catalog.js';
import type { Analysis, FieldProposal, FieldValue, FormDefinition, FormField, FormId, FormIssue, FormProposal, FormRule } from '../../src/forms/types.js';
import { LAYOUTS } from './layouts.js';
import { type Mark, ScheinSvg } from './ScheinSvg.js';
import './forms.css';

const EXAMPLES: [string, string][] = [
  ['Überweisung Kardiologie', 'Überweisung zum Kardiologen wegen Belastungsdyspnoe, dringend. Pflegegrad 4, Rollstuhl.'],
  ['Einweisung bei Pneumonie', 'Einweisung wegen V. a. Pneumonie, Notfall. Befund: SpO2 88 %. Allergie: Penicillin'],
  ['Taxi zur Dialyse', 'Taxi zur Dialyse 3x pro Woche, Hin- und Rückfahrt'],
];

const ICON: Record<FormId, typeof Send> = { 'muster-06': Send, 'muster-02': Hospital, 'muster-04': Ambulance };
const STATE_LABEL: Record<Mark['state'], string> = { vorgeschlagen: 'vorgeschlagen', unbekannt: 'bitte wählen', arzt: 'Arzt', duria: 'aus DURIA', leer: 'leer', geaendert: 'geändert' };
const SOURCE: Record<string, string> = { erlaeuterungen: 'KBV-Erläuterungen 01/2026', vordruckvereinbarung: 'Vordruckvereinbarung 05/2026', mustersammlung: 'Mustersammlung 05/2026' };

type Work = { proposal: FormProposal; values: Record<string, FieldValue>; edited: ReadonlySet<string> };

/** Eine Zeile der Prüfliste: ein Feld oder eine ganze Ankreuzgruppe. */
type Item = { key: string; label: string; fields: FormField[]; select: 'genau_eins' | 'beliebig' | null; rule: FormRule | null };

const short = (label: string) => label.replace(/ – nur.*$/, '').replace(/\s*\((?:Begründung|z\.\s?B\.).*\)$/, '');

function factPills(a: Analysis): string[] {
  const f = a.facts;
  const out: string[] = [];
  if (f.pflegegrad) out.push(`Pflegegrad ${f.pflegegrad.value}`);
  if (f.merkzeichen) out.push(`Merkzeichen ${f.merkzeichen.value.join(', ')}`);
  for (const x of f.ausstattung?.value ?? []) out.push(x === 'rollstuhl' ? 'Rollstuhl' : x === 'tragestuhl' ? 'Tragestuhl' : 'liegend');
  if (f.hochfrequent) out.push(f.hochfrequent.value === 'dialyse' ? 'Dialyse' : f.hochfrequent.value === 'chemotherapie' ? 'Chemotherapie' : 'Strahlentherapie');
  if (f.notfall) out.push('Notfall');
  if (f.unfall) out.push('Unfall');
  if (f.arbeitsunfall) out.push('Arbeitsunfall');
  if (f.versorgungsleiden) out.push('Versorgungsleiden');
  if (f.dringend) out.push('dringend');
  if (f.auBis) out.push(f.auBis.value ? `AU bis ${f.auBis.value}` : 'AU');
  return out;
}

/** Felder in Lesereihenfolge, Ankreuzgruppen zusammengefasst. */
function itemsOf(form: FormDefinition): Item[] {
  const order = [...form.fields].sort((a, b) => a.box.y - b.box.y || a.box.x - b.box.x);
  const out: Item[] = [];
  for (const f of order) {
    const g = f.group ? form.groups.find((x) => x.id === f.group) : undefined;
    if (g) {
      if (out.some((i) => i.key === g.id)) continue;
      out.push({ key: g.id, label: g.label, fields: order.filter((x) => x.group === g.id), select: g.select, rule: g.rule });
    } else out.push({ key: f.id, label: short(f.label), fields: [f], select: null, rule: f.rules[0] ?? null });
  }
  return out;
}

function Issue({ i }: { i: FormIssue }) {
  const Icon = i.level === 'unzulaessig' ? CircleAlert : i.level === 'fehlt' ? TriangleAlert : Info;
  return (
    <li className={`fx-issue ${i.level}`}>
      <Icon size={17} aria-hidden="true" />
      <div>
        <b>{i.level === 'unzulaessig' ? 'So nicht möglich:' : i.level === 'fehlt' ? 'Fehlt:' : 'Hinweis:'}</b> {i.text}
        {i.rule && <small>{SOURCE[i.rule.source.artifact]} · {i.rule.source.locator}</small>}
      </div>
    </li>
  );
}

function Editor({ item, values, onChange }: { item: Item; values: Record<string, FieldValue>; onChange: (id: string, v: FieldValue) => void }) {
  if (item.select === 'genau_eins') {
    return (
      <div className="fx-choices" role="radiogroup" aria-label={item.label}>
        {item.fields.map((f) => (
          <label key={f.id} className={`fx-choice ${values[f.id] === true ? 'on' : ''}`}>
            <input type="radio" name={item.key} checked={values[f.id] === true}
              onChange={() => item.fields.forEach((o) => onChange(o.id, o.id === f.id))} />
            {short(f.label)}
          </label>
        ))}
      </div>
    );
  }
  return (
    <>
      {item.fields.map((f) => {
        const v = values[f.id] ?? null;
        if (f.kind === 'checkbox') return <label key={f.id} className="inline"><input type="checkbox" checked={v === true} onChange={(e) => onChange(f.id, e.target.checked)} />{short(f.label)}</label>;
        if (f.kind === 'stempel') return null;
        return f.lines && f.lines > 1
          ? <textarea key={f.id} rows={f.lines} value={typeof v === 'string' ? v : ''} onChange={(e) => onChange(f.id, e.target.value)} />
          : <input key={f.id} value={typeof v === 'string' ? v : ''} placeholder={f.format ?? ''} onChange={(e) => onChange(f.id, e.target.value)} />;
      })}
    </>
  );
}

/** ?text=… füllt die Beschreibung nur im Entwicklungsserver vor (Bildschirmvorschau mit ?preview=1&view=formulare). */
const devText = () => (import.meta.env.DEV ? new URLSearchParams(location.search).get('text') ?? '' : '');

export function FormsView({ initial = devText() }: { initial?: string }) {
  const [text, setText] = useState(initial);
  const [analysis, setAnalysis] = useState<Analysis | null>(() => (initial ? analyse(initial) : null));
  const [work, setWork] = useState<Partial<Record<FormId, Work>>>(() => (initial ? build(initial, analyse(initial)) : {}));
  const [active, setActive] = useState<FormId | null>(() => (initial ? analyse(initial).suggestions[0]?.formId ?? null : null));
  const [selected, setSelected] = useState<string | null>(null);

  function build(t: string, a: Analysis): Partial<Record<FormId, Work>> {
    const out: Partial<Record<FormId, Work>> = {};
    for (const s of a.suggestions) {
      const proposal = propose(s.formId, t, a.facts, new Date());
      out[s.formId] = { proposal, values: valuesOf(proposal.fields), edited: new Set() };
    }
    return out;
  }

  function run(t = text) {
    const a = analyse(t);
    setAnalysis(a);
    setWork(build(t, a));
    setActive(a.suggestions[0]?.formId ?? null);
    setSelected(null);
  }

  const w = active ? work[active] : undefined;
  const form = active ? getForm(active) : null;
  const issues = useMemo(() => (active && w && analysis ? check(active, w.values, analysis.facts) : []), [active, w, analysis]);

  function change(fieldId: string, v: FieldValue) {
    if (!active) return;
    setWork((prev) => {
      const cur = prev[active];
      if (!cur) return prev;
      return { ...prev, [active]: { ...cur, values: { ...cur.values, [fieldId]: v }, edited: new Set([...cur.edited, fieldId]) } };
    });
  }

  // Sichtbare Zeilen: alles, was nicht einfach leer bleibt oder aus DURIA kommt.
  const props = new Map((w?.proposal.fields ?? []).map((p) => [p.fieldId, p]));
  const items = form ? itemsOf(form) : [];
  const levelOf = (ids: string[]) => {
    const lv = issues.filter((i) => i.fieldIds.some((id) => ids.includes(id))).map((i) => i.level);
    return lv.includes('unzulaessig') ? 'unzulaessig' as const : lv.includes('fehlt') ? 'fehlt' as const : null;
  };
  const visible = items.filter((it) => it.fields.some((f) => {
    const p = props.get(f.id);
    return (p && p.state !== 'leer' && p.state !== 'duria') || w?.edited.has(f.id) || w?.values[f.id] === true;
  }) || levelOf(it.fields.map((f) => f.id)) !== null);
  const marks: Record<string, Mark> = {};
  visible.forEach((it, idx) => {
    const ps = it.fields.map((f) => props.get(f.id)).filter((p): p is FieldProposal => Boolean(p));
    const edited = it.fields.some((f) => w?.edited.has(f.id));
    const state = edited ? 'geaendert' : ps.some((p) => p.state === 'unbekannt') ? 'unbekannt' : ps.find((p) => p.state !== 'leer')?.state ?? 'vorgeschlagen';
    const issue = levelOf(it.fields.map((f) => f.id));
    // Das Abzeichen einer Gruppe steht am angekreuzten Feld, sonst am ersten.
    const anchor = it.fields.find((f) => w?.values[f.id] === true) ?? it.fields[0]!;
    it.fields.forEach((f) => { marks[f.id] = { n: idx + 1, first: f.id === anchor.id, state, issue }; });
  });
  const quiet = items.filter((it) => !visible.includes(it) && it.fields.every((f) => props.get(f.id)?.state === 'leer')).map((it) => it.label);

  const counts = { unzulaessig: issues.filter((i) => i.level === 'unzulaessig').length, fehlt: issues.filter((i) => i.level === 'fehlt').length };
  const layout = active ? LAYOUTS[active] : null;
  const landscape = layout ? layout.width > layout.height : false;
  const factList = analysis ? factPills(analysis) : [];
  const catalog = analysis ? analysis.catalog.filter((h) => !analysis.suggestions.length || h.matched.length >= 2) : [];

  function rowValue(it: Item): { text: string; empty: boolean } {
    if (!w) return { text: '', empty: true };
    const checked = it.fields.filter((f) => f.kind === 'checkbox' && w.values[f.id] === true);
    if (it.select === 'genau_eins') return checked[0] ? { text: short(checked[0].label), empty: false } : { text: 'bitte wählen', empty: true };
    if (it.select === 'beliebig') return checked.length ? { text: checked.map((f) => short(f.label)).join(', '), empty: false } : { text: 'nichts ankreuzen', empty: false };
    const f = it.fields[0]!;
    const v = w.values[f.id];
    if (f.kind === 'checkbox') return { text: v === true ? 'ankreuzen' : 'nicht ankreuzen', empty: false };
    if (f.kind === 'stempel') return { text: 'Stempel und Unterschrift – erst nach dem Ausfüllen', empty: false };
    if (typeof v === 'string' && v) return { text: v, empty: false };
    return { text: props.get(f.id)?.state === 'arzt' ? 'trägt der Arzt ein' : 'bitte ergänzen', empty: true };
  }

  const side = form && w && (
    <aside className={`card fx-side ${landscape ? 'wide' : ''}`}>
      <div>
        <h3>Prüfung</h3>
        {issues.filter((i) => i.level !== 'hinweis').length === 0
          ? <p className="fx-ok"><CircleCheck size={17} aria-hidden="true" />Nichts Unzulässiges, nichts fehlt – Vorschläge bestätigen.</p>
          : <ul className="fx-issues">{issues.filter((i) => i.level !== 'hinweis').map((i) => <Issue key={i.text} i={i} />)}</ul>}
        {issues.some((i) => i.level === 'hinweis') && (
          <details className="fx-hints"><summary>{issues.filter((i) => i.level === 'hinweis').length} Hinweise zur Ausstellung</summary>
            <ul className="fx-issues">{issues.filter((i) => i.level === 'hinweis').map((i) => <Issue key={i.text} i={i} />)}</ul>
          </details>
        )}
      </div>
      <div>
        <h3>Was auf den Schein kommt</h3>
        <ul className="fx-rows">
          {visible.map((it) => {
            const m = marks[it.fields[0]!.id]!;
            const cls = m.issue === 'unzulaessig' ? 'bad' : m.issue === 'fehlt' || m.state === 'unbekannt' ? 'open' : m.state;
            const open = it.fields.some((f) => f.id === selected);
            const p = it.fields.map((f) => props.get(f.id)).find((x) => x && (x.value === true || x.state === 'unbekannt')) ?? props.get(it.fields[0]!.id);
            const v = rowValue(it);
            return (
              <li key={it.key} className={`fx-row ${open ? 'on' : ''}`}>
                <button type="button" className="fx-row-head" aria-expanded={open} onClick={() => setSelected(open ? null : it.fields[0]!.id)}>
                  <span className={`fx-badge ${cls}`}>{m.n}</span>
                  <span className="fx-row-main">
                    <span className="fx-row-label">{it.label}</span>
                    <span className={`fx-row-value ${v.empty ? 'empty' : ''}`}>{v.text}</span>
                  </span>
                  <span className={`fx-state ${cls}`}>{m.issue === 'unzulaessig' ? 'nicht möglich' : STATE_LABEL[m.state]}</span>
                </button>
                {open && (
                  <div className="fx-row-body">
                    <Editor item={it} values={w.values} onChange={change} />
                    {p && <p>{p.reason}</p>}
                    {p?.evidence && <p className="muted">Aus Ihrer Beschreibung: „{p.evidence}“</p>}
                    {(p?.rule ?? it.rule) && <p className="fx-rule">{(p?.rule ?? it.rule)!.text}<small>{SOURCE[(p?.rule ?? it.rule)!.source.artifact]} · {(p?.rule ?? it.rule)!.source.locator}</small></p>}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
        {quiet.length > 0 && <p className="muted fx-quiet"><b>Bleibt leer:</b> {quiet.join(' · ')}</p>}
      </div>
    </aside>
  );

  return (
    <div className="stack forms">
      <section className="card">
        <h2><Files size={22} aria-hidden="true" />Formulare <span className="muted">Ausfüllhilfe für KBV-Vordrucke</span></h2>
        <div className="fx-ask">
          <textarea value={text} rows={3} onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) run(); }}
            placeholder="Was soll ausgestellt werden – und was ist mit dem Patienten? z. B. „Überweisung zum Kardiologen wegen Belastungsdyspnoe, dringend. Pflegegrad 4.“" />
          <button className="primary big" onClick={() => run()} disabled={!text.trim()}><WandSparkles size={18} aria-hidden="true" />Vorschlagen</button>
        </div>
        {!analysis && (
          <div className="row fx-examples"><span className="muted">Beispiele:</span>
            {EXAMPLES.map(([label, e]) => <button key={label} className="link" title={e} onClick={() => { setText(e); run(e); }}>{label}</button>)}
          </div>
        )}
        {analysis && (
          <div className="row fx-facts">
            <span className="muted">Erkannt:</span>
            {factList.map((p) => <span key={p} className="pill candidate">{p}</span>)}
            {!factList.length && <span className="muted">keine besonderen Angaben</span>}
            <span className="spacer" />
            <span className="muted">Nur lokal ausgewertet · nichts wird gedruckt oder gesendet</span>
          </div>
        )}
      </section>

      {analysis?.blockers.map((b) => <div key={b.text} className="note-box"><Info size={18} aria-hidden="true" />{b.text}</div>)}

      {analysis && analysis.suggestions.length > 0 && (
        <div className="fx-picks" role="tablist" aria-label="Passende Vordrucke">
          {analysis.suggestions.map((s) => {
            const Icon = ICON[s.formId];
            const f = getForm(s.formId);
            return (
              <button key={s.formId} role="tab" aria-selected={active === s.formId} className={`fx-pick ${active === s.formId ? 'on' : ''}`}
                onClick={() => { setActive(s.formId); setSelected(null); }}>
                <span className="ico"><Icon size={19} aria-hidden="true" /></span>
                <span className="fx-pick-text"><b>Muster {f.muster} · {f.title}</b><span>{s.role === 'hauptsache' ? 'gewünscht' : s.why}</span></span>
                {s.role === 'zusaetzlich' && <span className="pill not_verifiable">passt dazu</span>}
              </button>
            );
          })}
        </div>
      )}
      {analysis && analysis.suggestions.length === 0 && (
        <section className="card"><p className="muted" style={{ margin: 0 }}>Kein ausfüllbarer Vordruck erkannt. Bitte ausdrücklich schreiben, z. B. „Überweisung …“, „Einweisung …“ oder „Taxi …“.</p></section>
      )}
      {catalog.length > 0 && (
        <div className="row fx-catalog"><Stethoscope size={16} aria-hidden="true" /><span className="muted">Im Katalog (nur Regeln, noch keine Vorschau):</span>
          {catalog.map((h) => <span key={h.entry.muster} className="pill" title={h.entry.purpose ?? ''}>Muster {h.entry.muster} · {h.entry.title}</span>)}
        </div>
      )}

      {form && w && active && layout && (
        <div className={`fx-main ${landscape ? 'landscape' : ''}`}>
          <section className="card fx-sheet">
            <div className="row">
              <h2 style={{ margin: 0 }}>Muster {form.muster} · {form.title}</h2>
              <span className="pill">Stand {form.form_version}</span>
              <span className="spacer" />
              {counts.unzulaessig > 0 ? <span className="pill billing_conflict">{counts.unzulaessig} nicht möglich</span>
                : counts.fehlt > 0 ? <span className="pill not_verifiable">{counts.fehlt} fehlt</span>
                  : <span className="pill candidate">vollständig</span>}
            </div>
            <ScheinSvg form={form} layout={layout} values={w.values} marks={marks} selected={selected} onSelect={setSelected} />
            <p className="muted fx-foot">Nachbildung zur Orientierung – keine Druckvorlage. Klick auf ein Feld zeigt Grund und Quelle.</p>
          </section>
          {side}
        </div>
      )}
    </div>
  );
}
