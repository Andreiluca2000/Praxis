// Pachetul pentru server: dist-bruecke/Praxis-Claude/ + Praxis-Claude.zip (după `pnpm build:bruecke`).
import { copyFileSync, existsSync, mkdirSync, rmSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const dist = join(root, 'dist-bruecke');
const out = join(dist, 'Praxis-Claude');
const bridge = join(dist, 'praxis-bruecke.mjs');
if (!existsSync(bridge)) throw new Error('Lipsește dist-bruecke/praxis-bruecke.mjs – întâi pnpm build:bruecke.');
// Dosarul nu se șterge: Andree poate ține acolo fișierul cu cheia (nu intră în zip, nu intră în git).
mkdirSync(out, { recursive: true });
copyFileSync(bridge, join(out, 'praxis-bruecke.mjs'));
for (const f of ['CLAUDE.md', 'managed-settings.json', 'installieren.ps1', 'installieren.cmd']) copyFileSync(join(root, 'bruecke-server', f), join(out, f));
const zip = join(dist, 'Praxis-Claude.zip');
rmSync(zip, { force: true });
const inZip = ['praxis-bruecke.mjs', 'CLAUDE.md', 'managed-settings.json', 'installieren.ps1', 'installieren.cmd'].map((f) => `'${join(out, f)}'`).join(',');
execFileSync('powershell.exe', ['-NoProfile', '-Command', `Compress-Archive -Path ${inZip} -DestinationPath '${zip}'`], { stdio: 'inherit' });
process.stdout.write(`Pachet: ${zip}\n`);
