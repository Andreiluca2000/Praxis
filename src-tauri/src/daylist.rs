//! Tagesliste für den Tagesabschluss: welche Patienten heute über den GDT-Eingang aufgerufen wurden.
//! - Je Aufruf nur: Patientennummer (DURIA), Zeitpunkt, Arbeitsplatz (%CLIENTNAME%), Kürzel des Benutzers.
//!   Kein Name, kein Geburtsdatum, keine Inhalte.
//! - Die echte Nummer bleibt in Rust; das Fenster sieht nur Pseudonym, Zeitpunkt, Arbeitsplatz und Kürzel.
//! - Auf der Platte nur mit Windows-DPAPI verschlüsselt (an den angemeldeten Windows-Benutzer gebunden).
//!   Ohne DPAPI (oder wenn das Speichern scheitert) bleibt die Liste nur im Arbeitsspeicher.
//! - Gelöscht nach dem Tagesabschluss oder spätestens 24 Stunden nach dem Aufruf. Die Frist prüft das laufende
//!   Programm (beim Start, etwa jede Minute, bei jeder Anzeige); ist es länger aus, bleibt die verschlüsselte Datei
//!   bis zum nächsten Start liegen und wird dann gelöscht, ohne gelesen zu werden.
//! - Die Nummer erscheint nie in Meldungen, `Debug`-Ausgaben oder Protokollen.

use crate::patient::PatientVault;
use serde::{Deserialize, Serialize};
use std::fmt;
use std::fs;
use std::path::PathBuf;
use zeroize::{Zeroize, Zeroizing};

/// Höchste Aufbewahrung je Aufruf.
pub const KEEP_SECS: u64 = 24 * 60 * 60;
/// Schutz vor einer unbegrenzt wachsenden Liste (ein Arbeitsplatz hat weit weniger Aufrufe am Tag).
pub const MAX_ENTRIES: usize = 2000;
/// Größere Dateien sind sicher keine Tagesliste.
const MAX_FILE_BYTES: u64 = 1024 * 1024;
const FORMAT: &str = "tagesliste-1";
/// Zusätzlicher DPAPI-Zweck: dieselbe Benutzerkennung allein reicht nicht, um die Datei mit einem anderen Programm zu öffnen.
const ENTROPY: &[u8] = b"Praxis-Assistent/Tagesliste/1";
/// Spielraum für leicht abweichende Uhren (Aufruf „in der Zukunft“ gilt bis dahin noch als gültig).
const CLOCK_SLACK_SECS: u64 = 5 * 60;

#[derive(Serialize, Deserialize, Clone)]
struct Entry {
    id: String,
    at: u64,
    station: String,
    kuerzel: String,
}

impl Drop for Entry {
    fn drop(&mut self) {
        self.id.zeroize();
    }
}

impl fmt::Debug for Entry {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        f.debug_struct("Entry").field("id", &"[entfernt]").field("at", &self.at).field("station", &self.station).field("kuerzel", &self.kuerzel).finish()
    }
}

#[derive(Serialize, Deserialize)]
struct Stored {
    format: String,
    entries: Vec<Entry>,
}

/// Was das Fenster je Aufruf sieht: Pseudonym statt Nummer, Zeitpunkt in Sekunden seit 1970 (Anzeige in Ortszeit im Fenster).
#[derive(Serialize, Clone, Debug, PartialEq)]
pub struct DayView {
    pub token: String,
    pub at: u64,
    pub station: String,
    pub kuerzel: String,
}

/// Verschlüsselung der Datei; in Tests auch durch eine fehlschlagende Attrappe ersetzbar.
pub trait Protector: Send + Sync {
    fn protect(&self, plain: &[u8]) -> Result<Vec<u8>, String>;
    fn unprotect(&self, sealed: &[u8]) -> Result<Vec<u8>, String>;
}

/// Windows-DPAPI, Bereich „aktueller Benutzer“, ohne Rückfragen.
pub struct Dpapi;

#[cfg(windows)]
impl Dpapi {
    fn call(input: &[u8], seal: bool) -> Result<Vec<u8>, String> {
        use windows_sys::Win32::Foundation::LocalFree;
        use windows_sys::Win32::Security::Cryptography::{CryptProtectData, CryptUnprotectData, CRYPTPROTECT_UI_FORBIDDEN, CRYPT_INTEGER_BLOB};
        let len = u32::try_from(input.len()).map_err(|_| "Tagesliste zu groß.".to_string())?;
        let data_in = CRYPT_INTEGER_BLOB { cbData: len, pbData: input.as_ptr() as *mut u8 };
        let entropy = CRYPT_INTEGER_BLOB { cbData: ENTROPY.len() as u32, pbData: ENTROPY.as_ptr() as *mut u8 };
        let mut out = CRYPT_INTEGER_BLOB { cbData: 0, pbData: std::ptr::null_mut() };
        // SAFETY: Eingaben zeigen auf gültige, für die Dauer des Aufrufs lebende Puffer; DPAPI liest sie nur.
        // Die Ausgabe gehört danach uns und wird nach dem Kopieren mit LocalFree freigegeben.
        let ok = unsafe {
            if seal {
                CryptProtectData(&data_in, std::ptr::null(), &entropy, std::ptr::null(), std::ptr::null(), CRYPTPROTECT_UI_FORBIDDEN, &mut out)
            } else {
                CryptUnprotectData(&data_in, std::ptr::null_mut(), &entropy, std::ptr::null(), std::ptr::null(), CRYPTPROTECT_UI_FORBIDDEN, &mut out)
            }
        };
        if ok == 0 || out.pbData.is_null() {
            return Err(if seal { "Tagesliste konnte nicht verschlüsselt werden." } else { "Tagesliste konnte nicht entschlüsselt werden." }.into());
        }
        // SAFETY: DPAPI liefert `cbData` gültige Bytes ab `pbData`.
        let bytes = unsafe { std::slice::from_raw_parts(out.pbData, out.cbData as usize) }.to_vec();
        // SAFETY: Klartext vor dem Freigeben überschreiben; der Puffer stammt von DPAPI (LocalAlloc).
        unsafe {
            std::ptr::write_bytes(out.pbData, 0, out.cbData as usize);
            LocalFree(out.pbData as _);
        }
        Ok(bytes)
    }
}

#[cfg(windows)]
impl Protector for Dpapi {
    fn protect(&self, plain: &[u8]) -> Result<Vec<u8>, String> {
        Dpapi::call(plain, true)
    }
    fn unprotect(&self, sealed: &[u8]) -> Result<Vec<u8>, String> {
        Dpapi::call(sealed, false)
    }
}

/// Außerhalb von Windows gibt es keine DPAPI: dann wird nichts auf die Platte geschrieben.
#[cfg(not(windows))]
impl Protector for Dpapi {
    fn protect(&self, _plain: &[u8]) -> Result<Vec<u8>, String> {
        Err("Verschlüsselung (DPAPI) nicht verfügbar.".into())
    }
    fn unprotect(&self, _sealed: &[u8]) -> Result<Vec<u8>, String> {
        Err("Verschlüsselung (DPAPI) nicht verfügbar.".into())
    }
}

/// Dateiname je Arbeitsplatz: mehrere RDP-Sitzungen desselben Windows-Benutzers überschreiben sich nicht.
pub fn file_name(station: &str) -> String {
    let safe: String = station.chars().take(40).map(|c| if c.is_ascii_alphanumeric() || c == '-' || c == '_' { c } else { '_' }).collect();
    format!("tagesliste-{}.dat", if safe.is_empty() { "PC" } else { &safe })
}

pub struct DayList {
    entries: Vec<Entry>,
    /// `None` = nur Arbeitsspeicher.
    file: Option<PathBuf>,
    protector: Box<dyn Protector>,
}

impl fmt::Debug for DayList {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        f.debug_struct("DayList").field("entries", &self.entries).field("file", &self.file.is_some()).finish()
    }
}

impl DayList {
    /// Gespeicherte Liste laden und Abgelaufenes entfernen. Unlesbare Datei → löschen, mit Hinweis (ohne Inhalt).
    pub fn open(file: Option<PathBuf>, protector: Box<dyn Protector>, now: u64) -> (DayList, Option<String>) {
        let mut list = DayList { entries: Vec::new(), file, protector };
        let mut warning = None;
        if let Some(path) = list.file.clone() {
            match list.load(&path) {
                Ok(entries) => list.entries = entries,
                Err(Some(why)) => {
                    let _ = fs::remove_file(&path);
                    warning = Some(format!("Tagesliste verworfen ({why})."));
                }
                Err(None) => {}
            }
        }
        if let Err(e) = list.expire(now) {
            warning.get_or_insert(e);
        }
        (list, warning)
    }

    /// `Err(None)` = keine Datei vorhanden.
    fn load(&self, path: &PathBuf) -> Result<Vec<Entry>, Option<String>> {
        let meta = match fs::metadata(path) {
            Err(e) if e.kind() == std::io::ErrorKind::NotFound => return Err(None),
            Err(_) => return Err(Some("nicht lesbar".into())),
            Ok(m) => m,
        };
        if meta.len() > MAX_FILE_BYTES {
            return Err(Some("Datei zu groß".into()));
        }
        let sealed = fs::read(path).map_err(|_| Some("nicht lesbar".to_string()))?;
        let plain = Zeroizing::new(self.protector.unprotect(&sealed).map_err(|_| Some("nicht entschlüsselbar".to_string()))?);
        let stored: Stored = serde_json::from_slice(&plain).map_err(|_| Some("unbekanntes Format".to_string()))?;
        if stored.format != FORMAT {
            return Err(Some("unbekanntes Format".into()));
        }
        Ok(stored.entries)
    }

    /// Verschlüsselt schreiben (erst .tmp, dann umbenennen); leere Liste → Datei löschen.
    fn persist(&self) -> Result<(), String> {
        let Some(path) = &self.file else { return Ok(()) };
        if self.entries.is_empty() {
            return match fs::remove_file(path) {
                Err(e) if e.kind() != std::io::ErrorKind::NotFound => Err("Tagesliste konnte nicht gelöscht werden.".into()),
                _ => Ok(()),
            };
        }
        let stored = Stored { format: FORMAT.into(), entries: self.entries.clone() };
        let plain = Zeroizing::new(serde_json::to_vec(&stored).map_err(|_| "Tagesliste nicht speicherbar.".to_string())?);
        let sealed = self.protector.protect(&plain)?;
        if let Some(dir) = path.parent() {
            fs::create_dir_all(dir).map_err(|_| "Tagesliste nicht speicherbar.".to_string())?;
        }
        let tmp = path.with_extension("tmp");
        fs::write(&tmp, &sealed).and_then(|_| fs::rename(&tmp, path)).map_err(|_| {
            let _ = fs::remove_file(&tmp);
            "Tagesliste nicht speicherbar.".to_string()
        })
    }

    /// Einen Aufruf merken. Scheitert nur das Speichern, bleibt der Eintrag im Arbeitsspeicher (Meldung ohne Nummer).
    pub fn record(&mut self, patient_id: &str, at: u64, station: &str, kuerzel: &str) -> Result<(), String> {
        let id = patient_id.trim();
        if id.is_empty() {
            return Ok(());
        }
        if self.entries.len() >= MAX_ENTRIES {
            self.entries.remove(0);
        }
        self.entries.push(Entry { id: id.to_string(), at, station: station.to_string(), kuerzel: kuerzel.to_string() });
        self.persist()
    }

    /// Aufrufe älter als 24 Stunden (oder unplausibel weit in der Zukunft) entfernen.
    pub fn expire(&mut self, now: u64) -> Result<(), String> {
        let before = self.entries.len();
        self.entries.retain(|e| now.saturating_sub(e.at) < KEEP_SECS && e.at <= now + CLOCK_SLACK_SECS);
        if self.entries.len() != before || self.entries.is_empty() {
            return self.persist();
        }
        Ok(())
    }

    /// Nach dem Tagesabschluss: nur die Aufrufe bis `upto` (der zuletzt angezeigte) vergessen;
    /// später eingegangene Aufrufe bleiben für den nächsten Abschluss. Leere Liste → Datei gelöscht.
    pub fn close_until(&mut self, upto: u64) -> Result<(), String> {
        self.entries.retain(|e| e.at > upto);
        self.persist()
    }

    pub fn len(&self) -> usize {
        self.entries.len()
    }

    /// Ansicht für das Fenster: Pseudonym aus derselben Instanz wie die KVDT-Datei, damit beide zusammenpassen.
    pub fn view(&self, vault: &PatientVault) -> Vec<DayView> {
        self.entries
            .iter()
            .map(|e| DayView { token: vault.pseudonym(&e.id), at: e.at, station: e.station.clone(), kuerzel: e.kuerzel.clone() })
            .collect()
    }
}
