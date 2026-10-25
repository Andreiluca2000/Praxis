/**
 * Generischer Parser für die xDT-Familie (GDT, BDT, LDT).
 * Zeilenaufbau: 3 Byte Länge + 4 Byte Feldkennung + Inhalt + CR LF.
 * Die Länge umfasst die ganze Zeile inkl. CR LF, gemessen in Bytes der Datei-Kodierung.
 */

export type XdtEncoding = 'cp437' | 'latin1' | 'iso-8859-15' | 'utf-8';

export interface XdtField {
  fk: string;
  value: string;
  line: number;
}

export interface XdtRecord {
  satzart: string;
  fields: XdtField[];
}

export interface XdtParseResult {
  records: XdtRecord[];
  /** Zeilen mit falscher Länge oder ungültigem Aufbau – werden nicht stillschweigend übernommen. */
  errors: string[];
  encoding: XdtEncoding;
}

// CP437 obere Hälfte (0x80–0xFF), wie sie in GDT-2.x-Dateien vorkommt (FK 9206 = 2).
const CP437_HIGH =
  'ÇüéâäàåçêëèïîìÄÅÉæÆôöòûùÿÖÜ¢£¥₧ƒáíóúñÑªº¿⌐¬½¼¡«»░▒▓│┤╡╢╖╕╣║╗╝╜╛┐└┴┬├─┼╞╟╚╔╩╦╠═╬╧╨╤╥╙╘╒╓╫╪┘┌█▄▌▐▀αßΓπΣσµτΦΘΩδ∞φε∩≡±≥≤⌠⌡÷≈°∙·√ⁿ²■\u00a0';

function decodeLine(bytes: Uint8Array, enc: XdtEncoding): string {
  if (enc === 'utf-8') return new TextDecoder('utf-8', { fatal: false }).decode(bytes);
  if (enc === 'latin1' || enc === 'iso-8859-15') return new TextDecoder(enc === 'latin1' ? 'latin1' : 'iso-8859-15').decode(bytes);
  let s = '';
  for (const b of bytes) s += b < 0x80 ? String.fromCharCode(b) : CP437_HIGH[b - 0x80] ?? '\ufffd';
  return s;
}

/** Zeichensatz aus FK 9206 (1 = 7-Bit, 2 = IBM CP437, 3 = ISO 8859-1/-15) – sonst Vorgabe. */
function detectEncoding(buf: Uint8Array, fallback: XdtEncoding): XdtEncoding {
  const head = new TextDecoder('latin1').decode(buf.subarray(0, 4096));
  const m = /\r?\n?\d{3}9206(\d)/.exec(head);
  if (m?.[1] === '2') return 'cp437';
  if (m?.[1] === '3') return 'iso-8859-15';
  return fallback;
}

export function parseXdt(buf: Uint8Array, opts: { encoding?: XdtEncoding; checkLength?: boolean } = {}): XdtParseResult {
  const encoding = opts.encoding ?? detectEncoding(buf, 'cp437');
  const checkLength = opts.checkLength ?? true;
  const records: XdtRecord[] = [];
  const errors: string[] = [];
  let current: XdtRecord | null = null;

  let start = 0;
  let lineNo = 0;
  while (start < buf.length) {
    let end = buf.indexOf(0x0a, start);
    if (end === -1) end = buf.length;
    const raw = buf.subarray(start, end + 1 <= buf.length ? end + 1 : buf.length);
    start = end + 1;
    lineNo++;
    let body = raw;
    while (body.length > 0 && (body[body.length - 1] === 0x0a || body[body.length - 1] === 0x0d)) body = body.subarray(0, body.length - 1);
    if (body.length === 0) continue;

    const text = decodeLine(body, encoding);
    const m = /^(\d{3})(\d{4})(.*)$/s.exec(text);
    if (!m) {
      errors.push(`Zeile ${lineNo}: kein gültiger xDT-Aufbau.`);
      continue;
    }
    const [, lenStr, fk, value] = m as unknown as [string, string, string, string];
    const declared = Number(lenStr);
    const actual = body.length + 2; // + CR LF
    if (checkLength && declared !== 0 && declared !== actual) {
      errors.push(`Zeile ${lineNo} (FK ${fk}): Länge ${declared} angegeben, ${actual} tatsächlich.`);
      continue;
    }
    if (fk === '8000') {
      current = { satzart: value.trim(), fields: [] };
      records.push(current);
    }
    if (!current) {
      errors.push(`Zeile ${lineNo} (FK ${fk}): Feld vor der ersten Satzart (8000).`);
      continue;
    }
    current.fields.push({ fk, value, line: lineNo });
  }
  return { records, errors, encoding };
}

export function first(rec: XdtRecord, fk: string): string | undefined {
  return rec.fields.find((f) => f.fk === fk)?.value;
}

export function all(rec: XdtRecord, fk: string): XdtField[] {
  return rec.fields.filter((f) => f.fk === fk);
}

/**
 * xDT-Datum: GDT/BDT 2.x nutzen TTMMJJJJ, neuere KVDT-Fassungen JJJJMMTT.
 * Bei 'auto' wird nur akzeptiert, wenn genau eine Lesart ein gültiges Datum (1900–2100) ergibt.
 */
export function parseXdtDate(v: string | undefined, format: 'auto' | 'TTMMJJJJ' | 'JJJJMMTT' = 'auto'): string | null {
  if (!v || !/^\d{8}$/.test(v.trim())) return null;
  const s = v.trim();
  const mk = (y: string, m: string, d: string) => {
    const iso = `${y}-${m}-${d}`;
    const dt = new Date(`${iso}T00:00:00Z`);
    const ok = !Number.isNaN(dt.getTime()) && dt.toISOString().startsWith(iso) && Number(y) >= 1900 && Number(y) <= 2100;
    return ok ? iso : null;
  };
  const dmy = mk(s.slice(4, 8), s.slice(2, 4), s.slice(0, 2));
  const ymd = mk(s.slice(0, 4), s.slice(4, 6), s.slice(6, 8));
  if (format === 'TTMMJJJJ') return dmy;
  if (format === 'JJJJMMTT') return ymd;
  if (dmy && ymd && dmy !== ymd) return null; // mehrdeutig → nicht raten
  return dmy ?? ymd;
}

export function concatBytes(parts: Uint8Array[]): Uint8Array {
  const out = new Uint8Array(parts.reduce((s, p) => s + p.length, 0));
  let off = 0;
  for (const p of parts) { out.set(p, off); off += p.length; }
  return out;
}

// ISO 8859-15 weicht an 8 Stellen von Latin-1 ab (€, Š, š, Ž, ž, Œ, œ, Ÿ).
const LATIN9: Record<string, number> = { '€': 0xa4, Š: 0xa6, š: 0xa8, Ž: 0xb4, ž: 0xb8, Œ: 0xbc, œ: 0xbd, Ÿ: 0xbe };

function encodeText(s: string, enc: XdtEncoding): Uint8Array {
  if (enc === 'utf-8') return new TextEncoder().encode(s);
  return Uint8Array.from([...s], (ch) => {
    const c = ch.codePointAt(0)!;
    if (c < 0x80) return c;
    if (enc === 'cp437') {
      const i = CP437_HIGH.indexOf(ch);
      return i >= 0 ? 0x80 + i : 0x3f;
    }
    if (enc === 'iso-8859-15' && ch in LATIN9) return LATIN9[ch]!;
    if (enc === 'iso-8859-15' && Object.values(LATIN9).includes(c)) return 0x3f;
    return c <= 0xff ? c : 0x3f;
  });
}

/** Erzeugt eine xDT-Zeile (Tests und bestätigter Rückweg zu DURIA). Läuft ohne Node. */
export function xdtLine(fk: string, value: string, enc: XdtEncoding = 'iso-8859-15'): Uint8Array {
  const content = encodeText(value, enc);
  const len = 3 + 4 + content.length + 2;
  if (len > 999) throw new Error(`xDT-Zeile zu lang (FK ${fk}).`);
  return concatBytes([new TextEncoder().encode(String(len).padStart(3, '0') + fk), content, new Uint8Array([13, 10])]);
}
