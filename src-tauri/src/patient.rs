//! Patientendaten-Grenze: Nur hier wird die echte Patientennummer gesehen.
//! - Eingang: xDT bereinigen (Identitätsfelder entfernen, FK 3000 → Pseudonym) und Revision bilden.
//! - Ausgang: im Fenster erzeugte GDT-Datei enthält nur das Pseudonym; hier wird es durch die echte Nummer ersetzt.
//! Das Fenster erhält nie Name, Geburtsdatum, Anschrift oder Patientennummer.

use hmac::{Hmac, Mac};
use sha2::{Digest, Sha256};
use std::collections::HashMap;

type HmacSha256 = Hmac<Sha256>;

/// Felder mit Personenidentität (xDT): Name, Vorname, Geburtsdatum, Titel, Anschrift, Telefon u. a.
pub const IDENTITY_FIELDS: &[&str] = &[
    "3100", "3101", "3102", "3103", "3104", "3105", "3106", "3107", "3108", "3110", "3112", "3113", "3114", "3119", "3622", "3626", "3628",
];
pub const PATIENT_ID_FIELD: &str = "3000";

pub struct Sanitized {
    pub data: Vec<u8>,
    pub token: Option<String>,
    pub patient_ids: usize,
    pub dropped: usize,
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

pub(crate) fn make_line(fk: &str, value: &[u8]) -> Vec<u8> {
    let len = 3 + 4 + value.len() + 2;
    let mut out = format!("{len:03}{fk}").into_bytes();
    out.extend_from_slice(value);
    out.extend_from_slice(b"\r\n");
    out
}

fn lines(data: &[u8]) -> impl Iterator<Item = &[u8]> {
    data.split(|&b| b == b'\n').map(|l| l.strip_suffix(b"\r").unwrap_or(l)).filter(|l| !l.is_empty())
}

fn is_identity(fk: &[u8]) -> bool {
    IDENTITY_FIELDS.iter().any(|f| f.as_bytes() == fk)
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

    /// Bereinigt eine xDT-Datei. Unlesbare Zeilen werden weitergereicht (der Parser meldet sie).
    pub fn sanitize(&mut self, raw: &[u8]) -> Sanitized {
        let mut ids: Vec<String> = Vec::new();
        let mut dropped = 0;
        let mut out = Vec::with_capacity(raw.len());
        for line in lines(raw) {
            match split_line(line) {
                Some((fk, value)) if fk == PATIENT_ID_FIELD.as_bytes() => {
                    let id = String::from_utf8_lossy(value).trim().to_string();
                    out.extend(make_line(PATIENT_ID_FIELD, self.pseudonym(&id).as_bytes()));
                    if !ids.contains(&id) {
                        ids.push(id);
                    }
                }
                Some((fk, _)) if is_identity(fk) => dropped += 1,
                _ => {
                    out.extend_from_slice(line);
                    out.extend_from_slice(b"\r\n");
                }
            }
        }
        let token = if ids.len() == 1 { Some(self.pseudonym(&ids[0])) } else { None };
        self.open.clear();
        if let (Some(t), Some(id)) = (&token, ids.first()) {
            self.open.insert(t.clone(), id.clone());
        }
        Sanitized { revision: hex(&Sha256::digest(raw))[..24].to_string(), data: out, token, patient_ids: ids.len(), dropped }
    }

    pub fn close(&mut self) {
        self.open.clear();
    }

    /// KVDT-Quartalsdatei (viele Patienten): Identität entfernen, jede Nummer → eigenes Pseudonym.
    /// Nur zum Lesen; es wird keine Zuordnung zurück gespeichert (kein Rückweg aus der Quartalsprüfung).
    pub fn sanitize_many(&self, raw: &[u8]) -> (Vec<u8>, usize, usize) {
        let mut out = Vec::with_capacity(raw.len());
        let (mut ids, mut dropped) = (std::collections::HashSet::new(), 0usize);
        for line in lines(raw) {
            match split_line(line) {
                Some((fk, value)) if fk == PATIENT_ID_FIELD.as_bytes() => {
                    let id = String::from_utf8_lossy(value).trim().to_string();
                    out.extend(make_line(PATIENT_ID_FIELD, self.pseudonym(&id).as_bytes()));
                    ids.insert(id);
                }
                Some((fk, _)) if is_identity(fk) => dropped += 1,
                _ => {
                    out.extend_from_slice(line);
                    out.extend_from_slice(b"\r\n");
                }
            }
        }
        (out, ids.len(), dropped)
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
