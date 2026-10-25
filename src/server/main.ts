import { readFileSync } from 'node:fs';
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { fileURLToPath } from 'node:url';
import type { PracticeSettings, RulePackage } from '../domain/types.js';
import { ContextRegistry } from '../duria/context.js';
import { loadMapping } from '../duria/mapping.js';
import { validateRulePackage, validateSettings } from '../validation/validate.js';
import { analyse, type AnalysisRequest } from './analyze.js';

/**
 * Lokaler Server – bindet ausschließlich an 127.0.0.1 (kein Netzwerkzugriff von außen).
 * Keine Speicherung von Exporten oder Ergebnissen; keine Klartext-Protokollierung.
 */

const root = (p: string) => fileURLToPath(new URL(`../../${p}`, import.meta.url));
const PORT = Number(process.env.PRAXIS_PORT ?? 4317);
const MAX_UPLOAD = 20 * 1024 * 1024;

function loadJson<T>(path: string, validate: (d: unknown) => { ok: boolean; value: T | null; errors: string[] }): T {
  const res = validate(JSON.parse(readFileSync(path, 'utf8')));
  if (!res.ok || !res.value) throw new Error(`${path} ungültig:\n${res.errors.join('\n')}`);
  return res.value;
}

let settings: PracticeSettings = loadJson(process.env.PRAXIS_SETTINGS ?? root('config/practice.example.json'), validateSettings);
const rules: RulePackage = loadJson(process.env.PRAXIS_RULES ?? root('data/billing/rules.example.json'), validateRulePackage);
const mapping = loadMapping(process.env.PRAXIS_MAPPING);
const contexts = new ContextRegistry();

/** Feste Liste ausgelieferter Dateien – keine Pfade aus der Anfrage (kein Verzeichnis-Ausbruch). */
const STATIC: Record<string, [string, string]> = {
  '/': ['index.html', 'text/html; charset=utf-8'],
  '/app.js': ['app.js', 'text/javascript; charset=utf-8'],
  '/render.js': ['render.js', 'text/javascript; charset=utf-8'],
  '/styles.css': ['styles.css', 'text/css; charset=utf-8'],
};

function send(res: ServerResponse, status: number, body: unknown, type = 'application/json; charset=utf-8'): void {
  res.writeHead(status, {
    'Content-Type': type,
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
    'Content-Security-Policy': "default-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:",
    'Referrer-Policy': 'no-referrer',
  });
  res.end(typeof body === 'string' || Buffer.isBuffer(body) ? body : JSON.stringify(body));
}

async function readBody(req: IncomingMessage): Promise<Buffer> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of req) {
    size += (chunk as Buffer).length;
    if (size > MAX_UPLOAD) throw new Error('Datei zu groß.');
    chunks.push(chunk as Buffer);
  }
  return Buffer.concat(chunks);
}

/** Nur Anfragen vom eigenen Rechner und von der eigenen Seite (Schutz gegen fremde Webseiten). */
function sameOrigin(req: IncomingMessage): boolean {
  const host = req.headers.host ?? '';
  const origin = req.headers.origin;
  return /^(127\.0\.0\.1|localhost):\d+$/.test(host) && (!origin || origin === `http://${host}`);
}

const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url ?? '/', 'http://localhost');
    if (!sameOrigin(req)) return send(res, 403, { error: 'Nur lokaler Zugriff.' });

    const asset = req.method === 'GET' ? STATIC[url.pathname] : undefined;
    if (asset) return send(res, 200, readFileSync(root(`app/${asset[0]}`)), asset[1]);
    if (req.method === 'GET' && url.pathname === '/api/status') {
      return send(res, 200, { settings, rulePackage: { id: rules.package_id, version: rules.package_version, kind: rules.content_kind, count: rules.rules.length }, mappingConfirmed: mapping.confirmed_by_vendor });
    }
    if (req.method === 'POST' && url.pathname === '/api/settings/kv') {
      const { kv } = JSON.parse((await readBody(req)).toString('utf8')) as { kv: unknown };
      const next = { ...settings, region: { ...settings.region, kv } };
      const v = validateSettings(next);
      if (!v.ok || !v.value) return send(res, 400, { error: v.errors.join('; ') });
      settings = v.value;
      return send(res, 200, { settings });
    }
    if (req.method === 'POST' && url.pathname === '/api/analyse') {
      const meta = JSON.parse(decodeURIComponent(req.headers['x-analysis'] as string ?? '%7B%7D')) as AnalysisRequest & { source?: 'gdt' | 'bdt' };
      if (!meta.sessionId || !/^\d{4}-\d{2}-\d{2}$/.test(meta.serviceDate ?? '')) return send(res, 400, { error: 'Sitzung oder Datum fehlt.' });
      const raw = await readBody(req);
      return send(res, 200, analyse(raw, meta.source === 'gdt' ? 'gdt' : 'bdt', { ...meta, mode: meta.mode === 'simulation' ? 'simulation' : 'operational' }, { mapping, settings, rules, contexts }));
    }
    send(res, 404, { error: 'Nicht gefunden.' });
  } catch (e) {
    send(res, 500, { error: e instanceof Error ? e.message : 'Interner Fehler.' });
  }
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`Praxis-Assistent läuft lokal: http://127.0.0.1:${PORT}`);
  console.log('Hinweis: Entwicklungsstand – nur synthetische Daten verwenden.');
});
