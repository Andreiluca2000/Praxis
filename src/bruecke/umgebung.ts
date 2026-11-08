import { appendFileSync, existsSync, mkdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import practiceJson from '../../config/practice.example.json';
import rulesJson from '../../data/billing/rules.example.json';
import reviewedJson from '../../data/billing/reviewed/hausarzt-welle1.json';
import chronicJson from '../../data/billing/reviewed/chronic-dx.json';
import pairsJson from '../../data/billing/scope-resolutions/rules.review.json';
import woundsJson from '../../data/billing/wounds/rules.review.json';
import optionalJson from '../../data/billing/optional-hausarzt/rules.review.json';
import pauschalenJson from '../../data/billing/pauschalen/rules.review.json';
import preventionJson from '../../data/billing/prevention/rules.review.json';
import primaryJson from '../../data/billing/primary-care/rules.review.json';
import visitsJson from '../../data/billing/visits/rules.review.json';
import frequencyJson from '../../data/billing/frequency/rules.review.json';
import type { IsoDate } from '../domain/types.js';
import { loadCatalogue, rulesFor } from '../engine/catalogue.js';
import { loadPairRegistry } from '../engine/pairs.js';
import { loadWindowRules } from '../engine/window-rules.js';
import { activeRules, parseRuleFile } from '../rules/model.js';
import { validateRulePackage, validateSettings } from '../validation/validate.js';
import type { PruefKontext } from './uebersicht.js';

/**
 * Umgebung der Brücke auf dem Terminalserver – liest dieselben Dateien wie die App, schreibt nur Protokoll und Aufträge:
 * - `%AppData%\de.praxis.assistent\arbeitsplatz.json` (je Windows-Benutzer): KI-Schalter, Modus, KV.
 * - `%ProgramData%\Praxis-Assistent\praxisregeln.json` (praxisweit): aktive Praxisregeln.
 * - Regeln und Dossiers sind in die Brücke eingebaut (gleicher Stand wie die App-Version, aus der sie gebaut wurde).
 */

export const MAX_KVDT_BYTES = 200 * 1024 * 1024;

export interface Pfade { benutzer: string; praxis: string }

export function standardPfade(env: NodeJS.ProcessEnv = process.env): Pfade {
  return {
    benutzer: env.PRAXIS_BRUECKE_BENUTZER ?? join(env.APPDATA ?? join(env.USERPROFILE ?? '.', 'AppData', 'Roaming'), 'de.praxis.assistent'),
    praxis: env.PRAXIS_BRUECKE_PRAXIS ?? join(env.ProgramData ?? 'C:\\ProgramData', 'Praxis-Assistent'),
  };
}

export interface Arbeitsplatz { kiEin: boolean; mode: 'operational' | 'simulation'; kv: string | null }

/** Fehlt oder ist die Datei fehlerhaft, gilt: KI aus (fail closed). */
export function leseArbeitsplatz(p: Pfade): Arbeitsplatz {
  const aus: Arbeitsplatz = { kiEin: false, mode: 'simulation', kv: null };
  const file = join(p.benutzer, 'arbeitsplatz.json');
  if (!existsSync(file)) return aus;
  try {
    const c = JSON.parse(readFileSync(file, 'utf8')) as { mode?: unknown; kv?: unknown; ai?: { provider?: unknown } };
    return {
      kiEin: c.ai?.provider === 'claude',
      mode: c.mode === 'operational' ? 'operational' : 'simulation',
      kv: c.kv === 'Nordrhein' || c.kv === 'Westfalen-Lippe' ? c.kv : null,
    };
  } catch {
    return aus;
  }
}

export const KI_AUS = 'Die KI ist in Praxis-Assistent ausgeschaltet (Einstellungen → KI-Assistent). Solange sie aus ist, gibt die Brücke nichts heraus.';

function validated<T>(r: { ok: boolean; value: T | null; errors: string[] }, name: string): T {
  if (!r.ok || !r.value) throw new Error(`${name} ungültig: ${r.errors.slice(0, 3).join('; ')}`);
  return r.value;
}

const heute = (): IsoDate => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

/** Prüfkontext wie in der App (`ui/session.ts`, `ui/pairDossier.ts`). */
export function ladeKontext(a: Arbeitsplatz, p: Pfade): PruefKontext & { praxisregelFehler: string } {
  const base = validated(validateSettings(practiceJson), 'Praxiseinstellungen');
  const settings = validated(validateSettings({ ...base, region: { ...base.region, kv: a.kv } }), 'Praxiseinstellungen');
  const catalogue = loadCatalogue(reviewedJson, chronicJson);
  const rules = rulesFor(a.mode, validated(validateRulePackage(rulesJson), 'Regelpaket'), catalogue);

  let praxisregelFehler = '';
  let practice: PruefKontext['practice'] = [];
  const file = join(p.praxis, 'praxisregeln.json');
  if (existsSync(file)) {
    try {
      const parsed = parseRuleFile(JSON.parse(readFileSync(file, 'utf8')));
      if ('error' in parsed) praxisregelFehler = parsed.error;
      else practice = activeRules(parsed, heute());
    } catch (e) {
      praxisregelFehler = `Praxisregeln nicht lesbar: ${String(e)}`;
    }
  }

  let pairs: PruefKontext['pairs'] = null;
  let windows: PruefKontext['windows'] = null;
  let dossierFehler: string | undefined;
  if (a.mode === 'simulation') {
    const reg = loadPairRegistry(pairsJson, [woundsJson]);
    if ('error' in reg) dossierFehler = reg.error; else pairs = reg;
    const membership = (pairsJson as { section_membership?: Record<string, { codes: string[] }> }).section_membership ?? {};
    const sections = Object.fromEntries(Object.entries(membership).map(([k, v]) => [k, v.codes]));
    const names = ['optional-hausarzt', 'pauschalen', 'prevention', 'primary-care', 'visits', 'wounds', 'frequency'];
    const raws = [optionalJson, pauschalenJson, preventionJson, primaryJson, visitsJson, woundsJson, frequencyJson];
    const w = loadWindowRules(raws.map((raw, i) => ({ name: names[i]!, raw })), sections);
    if ('error' in w) dossierFehler = w.error; else windows = w;
  }
  return { settings, rules, mode: a.mode, pairs, windows, practice, chronic: catalogue.chronic, praxisregelFehler, ...(dossierFehler ? { dossierFehler } : {}) };
}

export function leseKvdtDatei(pfad: string): Uint8Array {
  const st = statSync(pfad);
  if (!st.isFile()) throw new Error('Keine Datei.');
  if (st.size > MAX_KVDT_BYTES) throw new Error('Datei zu groß (über 200 MB).');
  return readFileSync(pfad);
}

/** Protokoll ohne Inhalt (wie `ki-protokoll.jsonl`): wann, welches Werkzeug, ob erfolgreich. */
export function protokolliere(p: Pfade, werkzeug: string, ok: boolean): void {
  try {
    const file = join(p.benutzer, 'claude-bruecke-protokoll.jsonl');
    mkdirSync(dirname(file), { recursive: true });
    appendFileSync(file, `${JSON.stringify({ zeit: new Date().toISOString(), werkzeug, ok })}\n`);
  } catch {
    // Protokoll ist Zusatz; ein Schreibfehler darf die Prüfung nicht verhindern.
  }
}
