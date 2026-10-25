import { $, renderFindings, renderMentions, renderReadout } from './render.js';

const sessionId = sessionStorage.getItem('praxis-session') ?? crypto.randomUUID();
sessionStorage.setItem('praxis-session', sessionId);

let lastFile = null;
let confirmations = {}; // ref → { status, ref } – nur vom Benutzer bestätigte Angaben

// ---------- Navigation ----------
document.querySelectorAll('nav button').forEach((b) =>
  b.addEventListener('click', () => {
    document.querySelectorAll('nav button').forEach((x) => x.removeAttribute('aria-current'));
    b.setAttribute('aria-current', 'page');
    for (const v of ['abrechnung', 'icd', 'einstellungen']) $(`view-${v}`).classList.toggle('hidden', v !== b.dataset.view);
  }),
);

// ---------- Formular ----------
$('date').value = new Date().toISOString().slice(0, 10);
const syncForm = () => {
  $('from').disabled = $('to').disabled = !$('declare').checked;
  $('run').disabled = !lastFile || !$('date').value;
};
$('declare').addEventListener('change', syncForm);
$('date').addEventListener('change', () => { confirmations = {}; syncForm(); });
$('file').addEventListener('change', (e) => {
  lastFile = e.target.files[0] ?? null;
  confirmations = {};
  $('duration').value = '';
  if (lastFile?.name.toLowerCase().endsWith('.gdt')) $('source').value = 'gdt';
  syncForm();
});
$('run').addEventListener('click', () => run());
$('rerun').addEventListener('click', () => run());

/** Nur bestätigte Angaben werden zu Fakten; widersprüchliche Bestätigungen bleiben sichtbar unklar. */
function confirmedFacts() {
  const facts = {};
  const list = Object.values(confirmations).filter(Boolean);
  if (list.length > 0) {
    const unique = [...new Set(list.map((c) => c.status))];
    facts['service.status'] = {
      value: unique[0],
      verification: 'confirmed',
      ...(unique.length > 1 ? { contradictory: true } : {}),
      evidence: list.map((c) => ({ ref: c.ref })),
    };
  }
  const d = $('duration').value;
  if (d !== '' && Number.isFinite(Number(d))) {
    facts['documentation.duration_minutes'] = { value: Number(d), verification: 'confirmed', evidence: [{ ref: 'benutzer:dauer' }] };
  }
  return facts;
}

async function run() {
  $('error').textContent = '';
  if (!lastFile) return;
  const meta = {
    sessionId,
    serviceDate: $('date').value,
    source: $('source').value,
    mode: $('mode').value,
    declaredRange: $('declare').checked && $('from').value && $('to').value ? { from: $('from').value, to: $('to').value } : null,
    confirmedFacts: confirmedFacts(),
  };
  try {
    const res = await fetch('/api/analyse', {
      method: 'POST',
      headers: { 'Content-Type': 'application/octet-stream', 'X-Analysis': encodeURIComponent(JSON.stringify(meta)) },
      body: await lastFile.arrayBuffer(),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error ?? res.statusText);
    renderReadout(data);
    renderMentions(data.mentions, confirmations);
    renderFindings(data.findings, meta.mode === 'simulation');
  } catch (e) {
    $('error').textContent = `Fehler: ${e.message}`;
  }
}

// ---------- Einstellungen ----------
async function loadStatus() {
  const s = await (await fetch('/api/status')).json();
  $('kv').value = s.settings.region.kv ?? '';
  $('settings-info').textContent =
    `Regelpaket: ${s.rulePackage.id} ${s.rulePackage.version} (${s.rulePackage.kind}, ${s.rulePackage.count} Regel/n) · ` +
    `HZV: ${s.settings.hzv.enabled ? 'aktiv' : 'aus'} · DURIA-Feldzuordnung ${s.mappingConfirmed ? 'bestätigt' : 'nicht bestätigt'}`;
}
$('kv').addEventListener('change', async () => {
  const res = await fetch('/api/settings/kv', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ kv: $('kv').value || null }),
  });
  if (res.ok) {
    $('results').classList.add('hidden'); // CFG-03: alte Ergebnisse ungültig
    await loadStatus();
  }
});
loadStatus();
syncForm();
