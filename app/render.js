// Darstellung. Alle Inhalte per textContent (kein HTML aus Daten → kein Einschleusen von Code).
export const $ = (id) => document.getElementById(id);
export const el = (tag, props = {}, ...children) => {
  const n = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) {
    if (k === 'class') n.className = v;
    else if (k.startsWith('aria-')) n.setAttribute(k, v);
    else n[k] = v;
  }
  for (const c of children) n.append(c instanceof Node ? c : document.createTextNode(String(c ?? '')));
  return n;
};

export const OUTCOME = {
  candidate: 'Möglicherweise fehlend – bitte prüfen',
  documentation_incomplete: 'Dokumentation unvollständig',
  not_verifiable: 'Nicht prüfbar',
  billing_conflict: 'Konflikt',
  excluded: 'Ausgeschlossen',
  already_billed: 'Bereits erfasst',
  not_applicable: 'Nicht anwendbar',
};
export const STATUS = {
  performed: 'erbracht', planned: 'geplant', recommended: 'empfohlen', refused: 'abgelehnt', external: 'extern',
  historical: 'früher', negated: 'verneint', family_history: 'Familienanamnese', unknown: 'unklar',
};
const STATE = { fulfilled: 'erfüllt', not_fulfilled: 'nicht erfüllt', unknown: 'unbekannt' };

export function renderReadout(data) {
  const s = data.snapshot;
  const body = $('readout-body');
  body.replaceChildren(
    el('p', {}, `Leistungen: ${s.services.length} · Diagnosen: ${s.diagnoses.length} · Notizen: ${s.noteCount} · verworfene Identitätsfelder: ${s.droppedIdentityFields}`),
    data.context
      ? el('p', { class: 'muted' }, `Kontext ${data.context.patientToken.slice(0, 8)}… · Revision ${data.context.revision.slice(0, 8)}… · geöffnet ${new Date(data.context.openedAt).toLocaleTimeString('de-DE')}`)
      : '',
    ...s.warnings.map((w) => el('p', { class: 'warn' }, `⚠ ${w}`)),
    data.blocked ? el('p', { class: 'error' }, `Analyse gesperrt: ${data.blocked}`) : '',
  );
  if (s.diagnoses.length) {
    body.append(el('table', {},
      el('thead', {}, el('tr', {}, el('th', {}, 'ICD'), el('th', {}, 'Sicherheit'), el('th', {}, 'Seite'), el('th', {}, 'Datum'))),
      el('tbody', {}, ...s.diagnoses.map((d) =>
        el('tr', {}, el('td', {}, d.code), el('td', {}, d.certainty ?? '–'), el('td', {}, d.side ?? '–'), el('td', {}, d.date ?? 'unbekannt')))),
    ));
  }
  $('readout').classList.remove('hidden');
}

export function renderMentions(mentions, confirmations) {
  const box = $('mentions-body');
  box.replaceChildren();
  $('mentions').classList.toggle('hidden', mentions.length === 0);
  for (const m of mentions) {
    const select = el('select', { 'aria-label': 'Status bestätigen' },
      el('option', { value: '' }, '– nicht bestätigen –'),
      ...['performed', 'planned', 'recommended', 'refused', 'external', 'historical'].map((k) => el('option', { value: k }, STATUS[k])),
    );
    select.value = confirmations[m.ref]?.status ?? '';
    select.addEventListener('change', () => {
      confirmations[m.ref] = select.value ? { status: select.value, ref: m.ref } : null;
    });
    const hint = [
      `Vorschlag: ${STATUS[m.status]}`,
      m.cue ? `Hinweis „${m.cue}“` : null,
      m.eventDate ? `Datum ${m.eventDate}` : null,
      m.durationMinutes !== null ? `${m.durationMinutes} Min. genannt` : null,
    ].filter(Boolean).join(' · ');
    box.append(el('div', { class: 'finding' },
      el('p', {}, `„${m.text}“`),
      el('p', { class: 'muted' }, hint),
      el('label', {}, 'Bestätigter Status', select),
    ));
  }
}

export function renderFindings(findings, simulated) {
  const box = $('results-body');
  box.replaceChildren();
  $('results').classList.remove('hidden');
  $('results').classList.toggle('sim', simulated);
  if (simulated) box.append(el('p', { class: 'warn' }, 'SIMULATOR – DEMO-Regeln, keine echten Abrechnungsziffern.'));
  if (findings.length === 0) {
    box.append(el('p', { class: 'muted' }, 'Keine operativen Regeln geladen. Freigegebene EBM/GOÄ/HZV-Regeln liegen noch nicht vor.'));
    return;
  }
  for (const f of findings) {
    box.append(el('div', { class: 'finding' },
      el('div', { class: 'head' },
        el('span', { class: `pill ${f.outcome}` }, OUTCOME[f.outcome]),
        el('strong', {}, f.codes.join(', ')),
        el('span', { class: 'muted' }, `${f.billingSystem} · Regel ${f.ruleId}@${f.ruleVersion} · ${f.serviceDate}`)),
      el('p', {}, f.explanation),
      f.conditions.length ? el('ul', { class: 'conds' }, ...f.conditions.map((c) => el('li', { class: c.state }, `${c.label}: ${STATE[c.state]} – ${c.reason}`))) : '',
      ...f.blockers.map((b) => el('p', { class: 'warn' }, `• ${b}`)),
      ...f.conflicts.map((c) => el('p', { class: 'error' }, `Konflikt: ${c}`)),
      ...f.coverage.filter((c) => !c.complete).map((c) => el('p', { class: 'warn' }, `Datenumfang (${c.domain}): ${c.reason}`)),
      f.existingEntries.length ? el('p', { class: 'muted' }, `Bereits erfasst: ${f.existingEntries.map((e) => `${e.code} am ${e.date}`).join(', ')}`) : '',
    ));
  }
}
