import { AlertTriangle, Info, Pencil, Play, Plus, PowerOff, SlidersHorizontal } from 'lucide-react';
import { useMemo, useReducer, useState } from 'react';
import type { PublicAccount } from '../../src/notes/note.js';
import {
  activate, retire, ruleState, saveDraft, type PracticeRule, type PracticeRuleContent, type VersionStatus,
} from '../../src/rules/model.js';
import { detectConflicts } from '../../src/rules/review.js';
import { today, type TreatmentSession } from '../session.js';
import { RuleEditor } from './RuleEditor.js';
import { RuleSimulation } from './RuleSimulation.js';
import { fmtDate, Guard, TypePill } from './shared.js';
import './rules.css';

type Screen = { kind: 'list' } | { kind: 'edit'; ruleId: string | null } | { kind: 'sim'; ruleId: string };

const blank = (): PracticeRuleContent => ({
  type: 'erinnerung', title: '', system: 'EBM', codes: [], text: '', priority: 'hinweis', validFrom: today(),
});

/** Bereich „Praxisregeln“: Liste (Aktiv/Entwürfe/Archiv), Editor, Simulation mit Aktivierung. */
export function PraxisregelnView({ session, user }: { session: TreatmentSession; user: PublicAccount }) {
  const [, rerender] = useReducer((n: number) => n + 1, 0);
  const [tab, setTab] = useState<VersionStatus>('aktiv');
  const [screen, setScreen] = useState<Screen>({ kind: 'list' });
  const [msg, setMsg] = useState('');
  const isArzt = user.role === 'arzt';
  const file = session.practice;
  const author = { kuerzel: user.kuerzel, role: user.role };
  const now = () => new Date().toISOString();

  const byTab = useMemo(() => {
    const rank = (r: PracticeRule) => (latest(r).content.priority === 'wichtig' ? 0 : 1);
    return file.rules.filter((r) => ruleState(r) === tab).sort((a, b) => rank(a) - rank(b) || latest(a).content.title.localeCompare(latest(b).content.title));
  }, [file, tab]);
  const counts = { aktiv: 0, entwurf: 0, archiv: 0 } as Record<VersionStatus, number>;
  for (const r of file.rules) counts[ruleState(r)]++;

  async function persist(next: typeof file, okText: string) {
    await session.savePractice(next);
    setMsg(okText);
    rerender();
  }

  if (screen.kind === 'edit') {
    const rule = screen.ruleId ? file.rules.find((r) => r.id === screen.ruleId) ?? null : null;
    const initial = rule ? latest(rule).content : blank();
    const nextVersion = rule ? (latest(rule).status === 'entwurf' ? latest(rule).version : latest(rule).version + 1) : 1;
    return (
      <RuleEditor key={screen.ruleId ?? 'neu'} initial={initial} readOnly={!isArzt}
        subtitle={`${rule ? latest(rule).content.title : 'Neue Regel'} · Entwurf v${nextVersion}`}
        onCancel={() => setScreen({ kind: 'list' })}
        onSave={async (content, thenSimulate) => {
          const { file: next, ruleId } = saveDraft(file, screen.ruleId, content, author, now());
          await persist(next, `Entwurf „${content.title}“ gespeichert.`);
          setTab(ruleState(next.rules.find((r) => r.id === ruleId)!));
          setScreen(thenSimulate ? { kind: 'sim', ruleId } : { kind: 'list' });
        }} />
    );
  }

  if (screen.kind === 'sim') {
    const rule = file.rules.find((r) => r.id === screen.ruleId);
    if (!rule) return null;
    return (
      <RuleSimulation file={file} rule={rule} isArzt={isArzt}
        onBack={() => setScreen({ kind: 'list' })}
        onEdit={() => setScreen({ kind: 'edit', ruleId: rule.id })}
        onActivate={async (version, reason) => {
          await persist(activate(file, rule.id, version, author, reason, now()), `„${latest(rule).content.title}“ v${version} ist aktiv.`);
          setTab('aktiv');
          setScreen({ kind: 'list' });
        }} />
    );
  }

  return (
    <div className="stack">
      <section className="card">
        <div className="row">
          <h2 style={{ margin: 0 }}><SlidersHorizontal size={22} aria-hidden="true" />Praxisregeln <span className="muted">eigene Erinnerungen und Hausregeln</span></h2>
          <span className="spacer" />
          {isArzt && <button className="primary" onClick={() => setScreen({ kind: 'edit', ruleId: null })}><Plus size={17} aria-hidden="true" />Neue Regel</button>}
        </div>
        <Guard />
        {session.practiceError && <p className="error" role="alert">{session.practiceError} Bis zur Korrektur gilt keine Praxisregel.</p>}
        {!isArzt && <p className="readonly-note"><Info size={16} aria-hidden="true" />Praxisregeln anlegen und ändern dürfen nur Ärzte.</p>}
        {msg && <p className="muted" role="status">{msg}</p>}
        <div className="row" style={{ marginTop: 16 }}>
          <fieldset className="segmented" aria-label="Zustand">
            {(['aktiv', 'entwurf', 'archiv'] as const).map((t) => (
              <label key={t} className={tab === t ? 'on' : ''}>
                <input type="radio" name="rules-tab" checked={tab === t} onChange={() => setTab(t)} />
                {{ aktiv: 'Aktiv', entwurf: 'Entwürfe', archiv: 'Archiv' }[t]} · {counts[t]}
              </label>
            ))}
          </fieldset>
          <span className="spacer" />
          <span className="muted">Reihenfolge = Wichtigkeit, dann Name</span>
        </div>
        <div className="rule-list">
          {byTab.length === 0 && <p className="rule-empty">{tab === 'aktiv' ? 'Noch keine aktive Praxisregel.' : tab === 'entwurf' ? 'Keine Entwürfe.' : 'Archiv leer.'}</p>}
          {byTab.map((r) => {
            const v = latest(r);
            const act = r.versions.find((x) => x.status === 'aktiv');
            const pending = act && v.status === 'entwurf' ? v : null;
            const conflicts = detectConflicts(file, r.id, v.content).filter((c) => c.kind !== 'official_duplicate');
            return (
              <div key={r.id} className="rule">
                <div className="row">
                  <TypePill t={v.content.type} />
                  <strong className="rule-title">{v.content.title}</strong>
                  {v.content.priority === 'wichtig' && <span className="pill not_verifiable">Wichtig</span>}
                  {pending && <span className="pill">Entwurf v{pending.version}</span>}
                  {conflicts.length > 0 && <span className="pill billing_conflict" title={conflicts.map((c) => c.text).join('\n')}><AlertTriangle size={13} aria-hidden="true" />Überschneidung</span>}
                  <span className="spacer" />
                  <div className="rule-actions">
                    {tab !== 'archiv' && <button className="soft" onClick={() => setScreen({ kind: 'sim', ruleId: r.id })}><Play size={15} aria-hidden="true" />Simulieren</button>}
                    {isArzt && <button onClick={() => setScreen({ kind: 'edit', ruleId: r.id })}><Pencil size={15} aria-hidden="true" />{tab === 'archiv' ? 'Neue Fassung' : 'Bearbeiten'}</button>}
                    {isArzt && act && <button className="link" onClick={() => void persist(retire(file, r.id, author), `„${v.content.title}“ abgeschaltet (Verlauf bleibt).`).catch((e) => setMsg(String(e)))}><PowerOff size={15} aria-hidden="true" />Abschalten</button>}
                  </div>
                </div>
                <p className="rule-text">{(act ?? v).content.text}</p>
                <div className="row muted">
                  <span>Auslöser: {(act ?? v).content.codes.map((c) => <span key={c} className="chip">{c}</span>)}</span>
                  {(act ?? v).content.partnerCodes && <span>· mit {(act ?? v).content.partnerCodes!.join(', ')}</span>}
                  <span>· v{(act ?? v).version}</span>
                  <span>· {act?.activatedAt ? `aktiv seit ${fmtDate(act.activatedAt)} · ${act.activatedBy}` : `erstellt ${fmtDate(v.createdAt)} · ${v.createdBy}`}</span>
                  <span>· gilt ab {fmtDate((act ?? v).content.validFrom)}</span>
                </div>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}

function latest(r: PracticeRule) {
  return r.versions.at(-1)!;
}
