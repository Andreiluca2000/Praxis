import { formatIssues, issue, prop, textOf, validTTMMJJ } from './build.js';
import { getForm } from './catalog.js';
import { personalien, stempel } from './common.js';
import { fromTTMMJJ, labeledSegments, segment, toTTMMJJ, ttmmjj, uni } from './text.js';
import type { FieldProposal, FormIssue, FormProposal, FormValues, PatientFacts } from './types.js';

/**
 * Muster 20 – Stufenweise Wiedereingliederung in das Erwerbsleben (Wiedereingliederungsplan, Stand 1.2019).
 * Erläuterungen 01/2026, S. 64–65. Der Plan ist eine Prognose; Versicherte/r und Arbeitgeber erklären ihr Einverständnis selbst.
 */
const form = getForm('muster-20');
const ROWS = [1, 2, 3, 4] as const;
const MAX_DAYS = 183;

type Stufe = { vom: string | null; bis: string | null; std: string; evidence: string };

const HOURS = String.raw`(\d{1,2}(?:[,.]5)?)\s*(?:h|std\.?|stunden)\b`;
const DATE = String.raw`(\d{1,2})\.(\d{1,2})\.(\d{4}|\d{2})?`;

const hours = (v: string) => v.replace('.', ',');
const addDays = (v: string, n: number) => { const d = fromTTMMJJ(v); d.setDate(d.getDate() + n); return ttmmjj(d); };

/** Stufen mit Datum: „ab 03.11. 4 Std. tgl., ab 17.11. 6 Std.“ bzw. „03.11.–16.11.26 4 h“. */
function datedSteps(text: string, today: Date): Stufe[] {
  const year = String(today.getFullYear());
  const re = uni(new RegExp(String.raw`\b(?:ab|vom)?\s*${DATE}(?:\s*(?:bis|-|–)\s*${DATE})?(?:(?!\d+\s*(?:woche|tag))[^.;]){0,30}?${HOURS}`, 'giu'));
  const out: Stufe[] = [];
  for (const m of text.matchAll(re)) {
    const y = m[3] ?? m[6] ?? year;
    out.push({ vom: toTTMMJJ(m[1]!, m[2]!, y), bis: m[4] ? toTTMMJJ(m[4], m[5]!, m[6] ?? y) : null, std: hours(m[7]!), evidence: m[0].trim() });
  }
  // Ohne „bis“ endet eine Stufe am Tag vor der nächsten.
  return out.map((s, i) => (s.bis || !out[i + 1]?.vom ? s : { ...s, bis: addDays(out[i + 1]!.vom!, -1) }));
}

/** Stufen als Dauer: „2 Wochen 4 h, 2 Wochen 6 h“ – mit Beginn („Beginn 03.11.“) werden daraus Daten. */
function durationSteps(text: string, today: Date): Stufe[] {
  const re = uni(new RegExp(String.raw`\b(\d{1,2})\s*(wochen?|tage?)\s*(?:je|à|mit|zu|jeweils)?\s*${HOURS}`, 'giu'));
  const start = uni(new RegExp(String.raw`\b(?:beginn|start|ab|ab dem)\s*(?:am\s*)?${DATE}`, 'iu')).exec(text);
  let cur = start ? toTTMMJJ(start[1]!, start[2]!, start[3] ?? String(today.getFullYear())) : null;
  const out: Stufe[] = [];
  for (const m of text.matchAll(re)) {
    const days = Number(m[1]) * (/woche/iu.test(m[2]!) ? 7 : 1);
    const vom = cur;
    const bis = vom ? addDays(vom, days - 1) : null;
    out.push({ vom, bis, std: hours(m[3]!), evidence: m[0].trim() });
    cur = bis ? addDays(bis, 1) : null;
  }
  return out;
}

/** Zuletzt ausgeübte Tätigkeit und tägliche Stunden davor (auch für Muster 52). */
export function letzteTaetigkeit(text: string): { taetigkeit: string | null; stunden: string | null; evidence: string | null } {
  const seg = segment(labeledSegments(text), 'zuletzt ausgeübte tätigkeit', 'tätigkeit', 'beruf');
  const als = seg ?? uni(/\b(?:arbeitet|tätig|beschäftigt)\s+als\s+([^,.;]+)/iu).exec(text)?.[1]?.trim() ?? null;
  const vorher = uni(new RegExp(String.raw`\b(?:vorher|bisher|zuvor|vor der au|vollzeit|normalerweise|regulär)\b[^.;]{0,30}?${HOURS}`, 'iu')).exec(text);
  // Die Stundenangabe gehört nicht in die Tätigkeitsbezeichnung.
  const taetigkeit = als?.replace(uni(new RegExp(String.raw`[,;]?\s*(?:vollzeit|vorher|bisher)?\s*${HOURS}.*$`, 'iu')), '').trim() || null;
  return { taetigkeit, stunden: vorher ? hours(vorher[1]!) : null, evidence: [als, vorher?.[0]].filter(Boolean).join('; ') || null };
}

export function proposeMuster20(text: string, _facts: PatientFacts, today: Date): FormProposal {
  const plan = segment(labeledSegments(text), 'stufenplan', 'plan') ?? text;
  const dated = datedSteps(plan, today);
  const steps = (dated.length ? dated : durationSteps(plan, today)).slice(0, ROWS.length);
  const einschr = segment(labeledSegments(text), 'einschränkungen', 'einschränkung');
  const lt = letzteTaetigkeit(text);
  const fields: FieldProposal[] = [
    personalien(form),
    lt.taetigkeit ? prop(form, 'taetigkeit', 'vorgeschlagen', lt.taetigkeit, 'Zuletzt ausgeübte Tätigkeit vor Beginn der AU.', lt.evidence)
      : prop(form, 'taetigkeit', 'unbekannt', null, 'Zuletzt ausgeübte Tätigkeit nicht in der Beschreibung (z. B. „Tätigkeit: Lagerist“).'),
    lt.stunden ? prop(form, 'stunden_vorher', 'vorgeschlagen', lt.stunden, 'Tägliche Arbeitsstunden vor Beginn der AU.', lt.evidence)
      : prop(form, 'stunden_vorher', 'unbekannt', null, 'Tägliche Arbeitsstunden vor der AU nicht genannt (z. B. „vorher 8 h täglich“).'),
  ];
  for (const i of ROWS) {
    const s = steps[i - 1];
    if (!s) {
      const first = i === 1;
      for (const k of ['vom', 'bis', 'art', 'std']) {
        fields.push(prop(form, `${k}${i}`, first ? 'unbekannt' : 'leer', null, first ? 'Stufenplan nicht erkannt – Zeitraum, Stunden und Art der Tätigkeit je Stufe angeben (z. B. „ab 03.11. 4 h, ab 17.11. 6 h“).' : 'Weitere Stufe nur bei Bedarf.'));
      }
      continue;
    }
    fields.push(
      s.vom ? prop(form, `vom${i}`, 'vorgeschlagen', s.vom, `Beginn der Stufe ${i}.`, s.evidence) : prop(form, `vom${i}`, 'unbekannt', null, `Beginn der Stufe ${i} fehlt (z. B. „Beginn 03.11.“).`),
      s.bis ? prop(form, `bis${i}`, 'vorgeschlagen', s.bis, `Ende der Stufe ${i} (Prognose).`, s.evidence) : prop(form, `bis${i}`, 'unbekannt', null, `Ende der Stufe ${i} – auch für die letzte Stufe als Prognose angeben.`, null, 'm20.gestaltung'),
      einschr ? prop(form, `art${i}`, 'vorgeschlagen', einschr, 'Art der Tätigkeit mit Belastungseinschränkungen – bitte je Stufe prüfen.', einschr)
        : prop(form, `art${i}`, i === 1 ? 'unbekannt' : 'leer', null, i === 1 ? 'Art der Tätigkeit und ggf. Einschränkungen (z. B. „nur im Sitzen“, „darf nicht heben“).' : 'Nur wenn sich die Tätigkeit ändert.', null, 'm20.gestaltung'),
      prop(form, `std${i}`, 'vorgeschlagen', s.std, `Stunden täglich in Stufe ${i}.`, s.evidence, 'm20.gestaltung'),
    );
  }
  fields.push(
    stempel(form),
    prop(form, 'erklaerung_versicherter', 'leer', null, 'Erklärt die/der Versicherte selbst (Einverständnis, Unterschrift).'),
    prop(form, 'erklaerung_arbeitgeber', 'leer', null, 'Erklärt der Arbeitgeber (Zustimmung, ggf. Voraussetzungen, Arbeitsentgelt).'),
  );
  return { formId: 'muster-20', fields, generator: 'regelbasiert' };
}

function rowIssues(values: FormValues): FormIssue[] {
  const out: FormIssue[] = [];
  const used = ROWS.filter((i) => ['vom', 'bis', 'art', 'std'].some((k) => textOf(values, `${k}${i}`)));
  if (!used.length) out.push(issue(form, 'fehlt', 'Stufenplan: mindestens eine Stufe mit Zeitraum, Art der Tätigkeit und Stunden täglich angeben.', ['vom1', 'bis1', 'art1', 'std1'], 'm20.gestaltung'));
  const ranges: [Date, Date, number][] = [];
  for (const i of used) {
    const miss = ['vom', 'bis', 'std'].filter((k) => !textOf(values, `${k}${i}`)).map((k) => `${k}${i}`);
    if (miss.length) out.push(issue(form, 'fehlt', `Stufe ${i}: Zeitraum (vom–bis) und Stunden täglich vollständig angeben – auch das Ende ist als Prognose einzutragen.`, miss, 'm20.gestaltung'));
    const std = textOf(values, `std${i}`).replace(',', '.');
    if (std && !(Number(std) > 0 && Number(std) <= 24)) out.push(issue(form, 'unzulaessig', `Stufe ${i}: Stunden täglich als Zahl (über 0 bis 24).`, [`std${i}`], 'm20.gestaltung'));
    const vom = textOf(values, `vom${i}`);
    const bis = textOf(values, `bis${i}`);
    if (validTTMMJJ(vom) && validTTMMJJ(bis)) {
      if (fromTTMMJJ(bis) < fromTTMMJJ(vom)) out.push(issue(form, 'unzulaessig', `Stufe ${i}: „bis“ liegt vor „vom“.`, [`vom${i}`, `bis${i}`], 'm20.gestaltung'));
      else ranges.push([fromTTMMJJ(vom), fromTTMMJJ(bis), i]);
    }
  }
  for (let k = 1; k < ranges.length; k++) {
    if (ranges[k]![0] <= ranges[k - 1]![1]) out.push(issue(form, 'hinweis', `Stufe ${ranges[k]![2]} beginnt, bevor Stufe ${ranges[k - 1]![2]} endet.`, [`vom${ranges[k]![2]}`], 'm20.gestaltung'));
  }
  if (ranges.length) {
    const days = Math.round((Math.max(...ranges.map((r) => r[1].getTime())) - Math.min(...ranges.map((r) => r[0].getTime()))) / 86_400_000) + 1;
    if (days > MAX_DAYS) out.push(issue(form, 'hinweis', `Wiedereingliederung über ${days} Tage: sollte in der Regel sechs Monate nicht überschreiten.`, ranges.map((r) => `bis${r[2]}`), 'm20.dauer'));
  }
  return out;
}

export function checkMuster20(values: FormValues, _facts: PatientFacts): FormIssue[] {
  const out: FormIssue[] = [];
  if (!textOf(values, 'taetigkeit')) out.push(issue(form, 'fehlt', 'Zuletzt ausgeübte Tätigkeit angeben.', ['taetigkeit'], 'm20.letzte_taetigkeit'));
  const vorher = textOf(values, 'stunden_vorher').replace(',', '.');
  if (!vorher) out.push(issue(form, 'fehlt', 'Tägliche Arbeitsstunden vor Beginn der AU angeben.', ['stunden_vorher'], 'm20.letzte_taetigkeit'));
  out.push(...rowIssues(values));
  if (vorher && Number(vorher) > 0) {
    for (const i of ROWS) {
      const std = Number(textOf(values, `std${i}`).replace(',', '.'));
      if (std > Number(vorher)) out.push(issue(form, 'hinweis', `Stufe ${i}: mehr Stunden täglich als vor der AU (${vorher.replace('.', ',')} h).`, [`std${i}`], 'm20.gestaltung'));
    }
  }
  out.push(issue(form, 'hinweis', 'Während der Wiedereingliederung besteht weiter Arbeitsunfähigkeit – AU-Bescheinigung fortführen.', [], 'm20.au_besteht'));
  out.push(...formatIssues(form, values));
  return out;
}
