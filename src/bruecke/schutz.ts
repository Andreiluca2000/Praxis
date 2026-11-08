import { parseXdt, xdtLine, concatBytes } from '../duria/xdt.js';

/**
 * Schutz der Claude-Brücke: Alles, was die Brücke ausgibt, geht über Claude Code an Anthropic.
 * Ohne AVV mit Anthropic (Entscheidung Andree, 09.11.2026: Abonnement, kein AVV) gilt deshalb:
 * - Die KVDT-Datei wird wie in Rust (`sanitize_many`) auf die Prüffelder reduziert, bevor der Motor sie sieht.
 *   Patientennummern werden zu Laufnummern dieses Aufrufs; Namen, Geburtsdatum, Anschrift, KVNR werden verworfen.
 * - Vor jeder Ausgabe prüft `pruefeAusgabe`, ob ein Identitätswert der Datei im Text steht. Wenn ja: gesperrt.
 * - Freitext (z. B. ein Auftrag aus der App) läuft durch `minimieren` (wie `ai::minimize` in Rust).
 */

/** Felder, die die Quartalsprüfung liest (gleich wie `patient::KVDT` in Rust). */
export const KVDT_PRUEFFELDER = ['8000', '9206', '9218', '4101', '5000', '5001', '5005', '5006', '6001', '6003', '6004'];
/** Identitätsfelder (gleich wie `patient::IDENTITY_FIELDS` in Rust) plus Patientennummer. */
export const IDENTITAETSFELDER = ['3000', '3100', '3101', '3102', '3103', '3104', '3105', '3106', '3107', '3108', '3110', '3112', '3113', '3114', '3119', '3622', '3626', '3628'];

export interface ReduzierteDatei {
  /** KVDT nur mit Prüffeldern; FK 3000 = Laufnummer „F-1“, „F-2“ … (nur in diesem Aufruf gültig). */
  daten: Uint8Array;
  /** Identitätswerte der Datei (klein geschrieben) für die Ausgabeprüfung. Verlassen die Brücke nie. */
  identitaet: string[];
  patienten: number;
  verworfeneFelder: number;
  lesefehler: number;
}

const nurZiffern = (v: string) => /^\d+$/.test(v);

export function reduziereKvdt(raw: Uint8Array): ReduzierteDatei {
  const parsed = parseXdt(raw);
  const nummern = new Map<string, string>();
  const identitaet = new Set<string>();
  const teile: Uint8Array[] = [];
  let verworfen = 0;
  for (const rec of parsed.records) {
    for (const f of rec.fields) {
      const v = f.value.trim();
      if (IDENTITAETSFELDER.includes(f.fk)) {
        // Reine Zahlen unter 7 Stellen (PLZ, kurze Patientennummern) kollidieren mit Ziffern und Fallzahlen;
        // sie kommen ohnehin nie in die Ausgabe (verworfen bzw. durch Laufnummern ersetzt).
        if (v.length >= 3 && !(nurZiffern(v) && v.length < 7)) identitaet.add(v.toLowerCase());
        if (f.fk === '3103' && /^\d{8}$/.test(v)) identitaet.add(`${v.slice(0, 2)}.${v.slice(2, 4)}.${v.slice(4)}`);
        if (f.fk === '3000') {
          if (!nummern.has(v)) nummern.set(v, `F-${nummern.size + 1}`);
          teile.push(xdtLine('3000', nummern.get(v)!));
        } else verworfen++;
        continue;
      }
      // Neu geschrieben wird in ISO 8859-15; der Zeichensatz-Hinweis muss dazu passen.
      if (f.fk === '9206') teile.push(xdtLine('9206', '3'));
      else if (KVDT_PRUEFFELDER.includes(f.fk)) teile.push(xdtLine(f.fk, f.value));
      else verworfen++;
    }
  }
  return { daten: concatBytes(teile), identitaet: [...identitaet].sort((a, b) => b.length - a.length), patienten: nummern.size, verworfeneFelder: verworfen, lesefehler: parsed.errors.length };
}

const WORTZEICHEN = /[\p{L}\p{N}]/u;

/** Steht ein Identitätswert als ganzes Wort im Text? Dann darf der Text nicht hinaus. */
export function enthaeltIdentitaet(text: string, identitaet: readonly string[]): boolean {
  const t = text.toLowerCase();
  for (const v of identitaet) {
    let i = t.indexOf(v);
    while (i !== -1) {
      const vor = i > 0 ? t[i - 1]! : ' ';
      const nach = i + v.length < t.length ? t[i + v.length]! : ' ';
      if (!WORTZEICHEN.test(vor) && !WORTZEICHEN.test(nach)) return true;
      i = t.indexOf(v, i + 1);
    }
  }
  return false;
}

export class AusgabeGesperrt extends Error {
  constructor() {
    super('Ausgabe gesperrt: Sie enthielte möglicherweise Patientendaten. Bitte in der App prüfen; an Claude geht nichts.');
  }
}

/** Letzte Kontrolle vor der Ausgabe (fail closed). */
export function pruefeAusgabe(text: string, identitaet: readonly string[]): string {
  if (enthaeltIdentitaet(text, identitaet)) throw new AusgabeGesperrt();
  return text;
}

/**
 * Wie `ai::minimize` in Rust: Pseudonyme `P-…`, E-Mail-Adressen, Nummern ab 7 Ziffern (Telefon, Versichertennummer)
 * und das KVNR-Format (Buchstabe + 9 Ziffern) → „[entfernt]“. Namen lassen sich so nicht sicher erkennen.
 */
export function minimieren(text: string, max = 2000): { text: string; entfernt: number } {
  let entfernt = 0;
  const out = text.slice(0, max).split(/(\s+)/).map((wort) => {
    if (/^\s*$/.test(wort)) return wort;
    const kern = wort.replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, '');
    if (!kern) return wort;
    const ziffern = kern.replace(/[+\-/()]/g, '');
    const pseudonym = /^P-[0-9a-f]{20}$/i.test(kern);
    const mail = kern.includes('@') && kern.includes('.');
    const nummer = ziffern.length >= 7 && /^\d+$/.test(ziffern);
    const kvnr = /^[A-Z]\d{9}$/.test(kern);
    if (pseudonym || mail || nummer || kvnr) {
      entfernt++;
      return wort.replace(kern, '[entfernt]');
    }
    return wort;
  }).join('');
  return { text: out, entfernt };
}
