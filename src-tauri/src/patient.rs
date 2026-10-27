//! Patientendaten-Grenze: Nur hier wird die echte Patientennummer gesehen.
//! - Eingang: xDT gegen eine Liste erlaubter Felder filtern (alles Unbekannte bleibt in Rust),
//!   Identitätsfelder entfernen, FK 3000 → Pseudonym, bekannte Identitätswerte im Freitext ersetzen.
//! - Ausgang: im Fenster erzeugte GDT-Datei enthält nur das Pseudonym; hier wird es durch die echte Nummer ersetzt.
//! Das Fenster erhält nie Name, Geburtsdatum, Anschrift oder Patientennummer aus strukturierten Feldern.
//! Freitext bleibt personenbezogen: Namen von Angehörigen o. ä. sind nicht erkennbar und werden nicht entfernt.

use hmac::{Hmac, Mac};
use sha2::{Digest, Sha256};
use std::collections::HashMap;

type HmacSha256 = Hmac<Sha256>;

/// Felder mit Personenidentität (xDT): Name, Vorname, Geburtsdatum, Titel, Anschrift, Telefon u. a.
pub const IDENTITY_FIELDS: &[&str] = &[
    "3100", "3101", "3102", "3103", "3104", "3105", "3106", "3107", "3108", "3110", "3112", "3113", "3114", "3119", "3622", "3626", "3628",
];
pub const PATIENT_ID_FIELD: &str = "3000";
const REDACTED: &[u8] = b"[entfernt]";

/// Erlaubte Felder je Einlesezweck. Alles andere (unbekannte FK, unlesbare oder falsch lange Zeilen)
/// wird hier verworfen und nur gezählt. Erweiterung nur durch Revision dieser Liste (z. B. nach DURIA-Bestätigung).
pub struct FieldProfile {
    pub pass: &'static [&'static str],
    /// Freitext: geht ins Fenster, bekannte Identitätswerte derselben Datei werden vorher ersetzt.
    pub free_text: &'static [&'static str],
}

/// GDT/BDT eines Patienten: Satzart, Zeichensatz, Kennungen, Leistungen, Diagnosen, Befund-/Notiztext.
pub const SINGLE_PATIENT: FieldProfile = FieldProfile {
    pass: &["8000", "9206", "9218", "8315", "8316", "8402", "6302", "4101", "5000", "5001", "5005", "6000", "6001", "6003", "6004", "6200"],
    free_text: &["6205", "6220", "6227", "6228", "6230"],
};

/// KVDT-Quartalsdatei: nur was die Quartalsprüfung liest, kein Freitext.
pub const KVDT: FieldProfile = FieldProfile {
    pass: &["8000", "9206", "9218", "4101", "5000", "5001", "5005", "6001", "6003", "6004"],
    free_text: &[],
};

pub struct Sanitized {
    pub data: Vec<u8>,
    pub token: Option<String>,
    pub patient_ids: usize,
    /// Entfernte Identitätsfelder.
    pub dropped: usize,
    /// Verworfene Zeilen mit nicht erlaubter Feldkennung.
    pub unknown: usize,
    /// Verworfene Zeilen ohne gültigen xDT-Aufbau oder mit falscher Längenangabe.
    pub invalid: usize,
    /// Ersetzte Identitätswerte im Freitext.
    pub redacted: usize,
    pub revision: String,
}

/// Schlüssel lebt nur im Arbeitsspeicher dieser Programminstanz.
pub struct PatientVault {
    key: [u8; 32],
    /// Pseudonym → echte Nummer, nur solange der Patient geöffnet ist.
    open: HashMap<String, String>,
}

fn hex(bytes: &[u8]) -> String {
    bytes.iter().map(|b| format!("{b:02x}")).collect()
}

/// xDT-Zeile: 3 Ziffern Länge + 4 Ziffern Feldkennung + Inhalt (+ CR LF).
pub(crate) fn split_line(line: &[u8]) -> Option<(&[u8], &[u8])> {
    if line.len() < 7 || !line[..7].iter().all(u8::is_ascii_digit) {
        return None;
    }
    Some((&line[3..7], &line[7..]))
}

/// Wie der Parser im Fenster: angegebene Länge = Zeile + CR LF (0 = nicht angegeben).
pub(crate) fn length_ok(line: &[u8]) -> bool {
    let declared: usize = std::str::from_utf8(&line[..3]).ok().and_then(|s| s.parse().ok()).unwrap_or(usize::MAX);
    declared == 0 || declared == line.len() + 2
}

pub(crate) fn make_line(fk: &str, value: &[u8]) -> Vec<u8> {
    let len = 3 + 4 + value.len() + 2;
    let mut out = format!("{len:03}{fk}").into_bytes();
    out.extend_from_slice(value);
    out.extend_from_slice(b"\r\n");
    out
}

pub(crate) fn lines(data: &[u8]) -> impl Iterator<Item = &[u8]> {
    data.split(|&b| b == b'\n').map(|l| l.strip_suffix(b"\r").unwrap_or(l)).filter(|l| !l.is_empty())
}

fn listed(list: &[&str], fk: &[u8]) -> bool {
    list.iter().any(|f| f.as_bytes() == fk)
}

fn is_identity(fk: &[u8]) -> bool {
    listed(IDENTITY_FIELDS, fk)
}

/// Buchstabe/Ziffer (Bytes ≥ 0x80 sind in CP437/ISO 8859 Umlaute) – Grenze für Wortvergleiche.
fn is_word_byte(b: u8) -> bool {
    b.is_ascii_alphanumeric() || b >= 0x80
}

/// Identitätswerte dieser Datei (ab 3 Zeichen), längste zuerst; Geburtsdatum auch als TT.MM.JJJJ.
fn identity_values(raw: &[u8]) -> Vec<Vec<u8>> {
    let mut out: Vec<Vec<u8>> = Vec::new();
    for line in lines(raw) {
        let Some((fk, value)) = split_line(line) else { continue };
        if !(is_identity(fk) || fk == PATIENT_ID_FIELD.as_bytes()) {
            continue;
        }
        let v = value.trim_ascii();
        if v.len() >= 3 {
            out.push(v.to_ascii_lowercase());
        }
        if fk == b"3103" && v.len() == 8 && v.iter().all(u8::is_ascii_digit) {
            out.push([&v[..2], b".", &v[2..4], b".", &v[4..]].concat());
        }
    }
    out.sort_by_key(|v| std::cmp::Reverse(v.len()));
    out.dedup();
    out
}

/// Ersetzt ganze Wörter, die einem Identitätswert entsprechen (ASCII ohne Groß-/Kleinschreibung).
pub(crate) fn redact(value: &[u8], secrets: &[Vec<u8>]) -> (Vec<u8>, usize) {
    let (mut out, mut count, mut i) = (Vec::with_capacity(value.len()), 0, 0);
    while i < value.len() {
        let at_start = i == 0 || !is_word_byte(value[i - 1]);
        let hit = at_start
            .then(|| {
                secrets.iter().find(|s| {
                    let end = i + s.len();
                    end <= value.len() && value[i..end].eq_ignore_ascii_case(s) && (end == value.len() || !is_word_byte(value[end]))
                })
            })
            .flatten();
        match hit {
            Some(s) => {
                out.extend_from_slice(REDACTED);
                i += s.len();
                count += 1;
            }
            None => {
                out.push(value[i]);
                i += 1;
            }
        }
    }
    (out, count)
}

impl PatientVault {
    pub fn new() -> Self {
        let mut key = [0u8; 32];
        getrandom::getrandom(&mut key).expect("Zufallszahlen nicht verfügbar");
        PatientVault { key, open: HashMap::new() }
    }

    pub fn pseudonym(&self, patient_id: &str) -> String {
        let mut mac = HmacSha256::new_from_slice(&self.key).expect("HMAC-Schlüssel");
        mac.update(patient_id.trim().as_bytes());
        format!("P-{}", &hex(&mac.finalize().into_bytes())[..20])
    }

    /// Filtert nach Profil: nur erlaubte Felder verlassen Rust; FK 3000 wird Pseudonym.
    fn filter(&self, raw: &[u8], profile: &FieldProfile) -> (Sanitized, Vec<String>) {
        let secrets = if profile.free_text.is_empty() { Vec::new() } else { identity_values(raw) };
        let mut ids: Vec<String> = Vec::new();
        let mut s = Sanitized {
            data: Vec::with_capacity(raw.len()),
            token: None,
            patient_ids: 0,
            dropped: 0,
            unknown: 0,
            invalid: 0,
            redacted: 0,
            revision: hex(&Sha256::digest(raw))[..24].to_string(),
        };
        for line in lines(raw) {
            let Some((fk, value)) = split_line(line).filter(|_| length_ok(line)) else {
                s.invalid += 1;
                continue;
            };
            if fk == PATIENT_ID_FIELD.as_bytes() {
                let id = String::from_utf8_lossy(value).trim().to_string();
                s.data.extend(make_line(PATIENT_ID_FIELD, self.pseudonym(&id).as_bytes()));
                if !ids.contains(&id) {
                    ids.push(id);
                }
            } else if is_identity(fk) {
                s.dropped += 1;
            } else if listed(profile.pass, fk) {
                s.data.extend_from_slice(line);
                s.data.extend_from_slice(b"\r\n");
            } else if listed(profile.free_text, fk) {
                let (clean, n) = redact(value, &secrets);
                s.redacted += n;
                // FK besteht nach split_line aus vier ASCII-Ziffern.
                s.data.extend(make_line(std::str::from_utf8(fk).unwrap_or("0000"), &clean));
            } else {
                s.unknown += 1;
            }
        }
        s.patient_ids = ids.len();
        (s, ids)
    }

    /// GDT/BDT eines Patienten bereinigen und den Patienten als geöffnet merken (für den Rückweg).
    pub fn sanitize(&mut self, raw: &[u8]) -> Sanitized {
        let (mut s, ids) = self.filter(raw, &SINGLE_PATIENT);
        s.token = if ids.len() == 1 { Some(self.pseudonym(&ids[0])) } else { None };
        self.open.clear();
        if let (Some(t), Some(id)) = (&s.token, ids.first()) {
            self.open.insert(t.clone(), id.clone());
        }
        s
    }

    pub fn close(&mut self) {
        self.open.clear();
    }

    /// KVDT-Quartalsdatei (viele Patienten): nur Prüffelder, jede Nummer → eigenes Pseudonym.
    /// Nur zum Lesen; es wird keine Zuordnung zurück gespeichert (kein Rückweg aus der Quartalsprüfung).
    pub fn sanitize_many(&self, raw: &[u8]) -> Sanitized {
        self.filter(raw, &KVDT).0
    }

    /// HL7-Ausgang: Pseudonym in PID-3 durch die echte Nummer ersetzen. Andere Segmente bleiben unverändert.
    pub fn restore_hl7(&self, msg: &[u8], expected_token: &str) -> Result<Vec<u8>, String> {
        let real = self.open.get(expected_token).ok_or("Patient ist nicht mehr geöffnet – bitte in DURIA neu aufrufen.")?;
        let text = std::str::from_utf8(msg).map_err(|_| "HL7-Nachricht ist kein gültiger Text.")?;
        let mut found = false;
        let mut segs = Vec::new();
        for seg in text.split('\r').filter(|s| !s.is_empty()) {
            if let Some(rest) = seg.strip_prefix("PID|") {
                let mut fields: Vec<String> = rest.split('|').map(String::from).collect();
                // PID-3 ist das dritte Feld nach "PID|" (Index 2).
                let pid3 = fields.get(2).cloned().unwrap_or_default();
                let id = pid3.split('^').next().unwrap_or("");
                if id != expected_token {
                    return Err("HL7-Nachricht gehört zu einem anderen Patienten.".into());
                }
                fields[2] = pid3.replacen(expected_token, real, 1);
                found = true;
                segs.push(format!("PID|{}", fields.join("|")));
            } else {
                segs.push(seg.to_string());
            }
        }
        if !found {
            return Err("HL7-Nachricht ohne PID-Segment.".into());
        }
        Ok(format!("{}\r", segs.join("\r")).into_bytes())
    }

    /// Ersetzt im Ausgang das Pseudonym (FK 3000) durch die echte Nummer und korrigiert FK 8100 (Satzlänge).
    pub fn restore(&self, gdt: &[u8], expected_token: &str) -> Result<Vec<u8>, String> {
        let real = self.open.get(expected_token).ok_or("Patient ist nicht mehr geöffnet – bitte in DURIA neu aufrufen.")?;
        let mut found = false;
        let mut out: Vec<Vec<u8>> = Vec::new();
        for line in lines(gdt) {
            match split_line(line) {
                Some((fk, value)) if fk == PATIENT_ID_FIELD.as_bytes() => {
                    if value != expected_token.as_bytes() {
                        return Err("Datei gehört zu einem anderen Patienten.".into());
                    }
                    found = true;
                    out.push(make_line(PATIENT_ID_FIELD, real.as_bytes()));
                }
                Some((fk, _)) if is_identity(fk) => return Err("Ausgang darf keine Identitätsfelder enthalten.".into()),
                Some(_) => out.push([line, b"\r\n"].concat()),
                None => return Err("Ungültige GDT-Zeile im Ausgang.".into()),
            }
        }
        if !found {
            return Err("Ausgang ohne Patientenkennung.".into());
        }
        let total: usize = out.iter().map(Vec::len).sum();
        for l in out.iter_mut() {
            let is_len = split_line(l.strip_suffix(b"\r\n").unwrap_or(l)).map(|(fk, _)| fk == b"8100").unwrap_or(false);
            if is_len {
                *l = make_line("8100", format!("{total:05}").as_bytes());
            }
        }
        Ok(out.concat())
    }
}
