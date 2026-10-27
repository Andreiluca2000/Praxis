//! GDT-Austausch mit DURIA über Dateien.
//! - Eingang: nur mit angemeldetem Benutzer lesen; erst nach erfolgreicher Prüfung und Übergabe löschen.
//!   Unvollständige, ungültige, zu große oder veraltete Dateien gehen in einen Quarantäne-Unterordner
//!   (gleiche Rechte wie der Eingang) und werden dort nach kurzer Frist gelöscht.
//! - Ausgang: exklusiv und atomar schreiben; existiert die letzte Datei noch, wartet man auf DURIA.
//! Pfade dürfen `%CLIENTNAME%`/`%USERNAME%` enthalten (Terminalserver: ein Ordner je RDP-Sitzung).

use crate::patient::{length_ok, lines, split_line};
use std::collections::HashMap;
use std::fs;
use std::path::{Path, PathBuf};
use std::time::{Duration, SystemTime};

/// Gleiche Grenze wie beim Einlesen über den Auswahldialog.
pub const MAX_INBOX_BYTES: u64 = 20 * 1024 * 1024;
/// Ältere Übergaben gehören vermutlich zu einem früheren Patientenaufruf und werden nicht geöffnet.
pub const MAX_AGE: Duration = Duration::from_secs(10 * 60);
pub const QUARANTINE_DIR: &str = "quarantaene";
pub const QUARANTINE_KEEP: Duration = Duration::from_secs(24 * 60 * 60);

/// Ersetzt %VAR% durch Umgebungsvariablen (nur Buchstaben/Ziffern/_ im Namen).
/// Fehlt eine Variable oder ist sie leer, wäre der Ordner nicht mehr eindeutig → Fehler statt Sammelordner.
/// Ausnahme wie bei `config::client_name`: ohne RDP-Sitzung gilt für %CLIENTNAME% der Rechnername.
pub fn expand_env(path: &str) -> Result<String, String> {
    let lookup = |name: &str| {
        let get = |n: &str| std::env::var(n).ok().filter(|v| !v.trim().is_empty());
        get(name).or_else(|| if name.eq_ignore_ascii_case("CLIENTNAME") { get("COMPUTERNAME") } else { None })
    };
    let mut out = String::new();
    let mut rest = path;
    while let Some(start) = rest.find('%') {
        out.push_str(&rest[..start]);
        let after = &rest[start + 1..];
        match after.find('%') {
            Some(end) if after[..end].chars().all(|c| c.is_ascii_alphanumeric() || c == '_') && end > 0 => {
                let name = &after[..end];
                match lookup(name) {
                    Some(v) => out.push_str(&v),
                    None => return Err(format!("Ordner nicht eindeutig: %{name}% ist nicht gesetzt.")),
                }
                rest = &after[end + 1..];
            }
            _ => {
                out.push('%');
                rest = after;
            }
        }
    }
    out.push_str(rest);
    Ok(out)
}

fn is_gdt_name(name: &str) -> bool {
    let lower = name.to_lowercase();
    if [".gdt", ".bdt", ".dat", ".txt"].iter().any(|e| lower.ends_with(e)) {
        return true;
    }
    // GDT-Konvention mit laufender Endung, z. B. "DURPRAX.001"
    matches!(lower.rsplit_once('.'), Some((_, ext)) if ext.len() == 3 && ext.chars().all(|c| c.is_ascii_digit()))
}

/// Meldet Dateien, deren Größe und Änderungszeit seit dem letzten Aufruf gleich geblieben sind.
/// Liest und löscht nichts – das entscheidet der Aufrufer nach Anmeldung und Prüfung.
pub struct InboxScanner {
    dir: PathBuf,
    seen: HashMap<PathBuf, (u64, Option<SystemTime>)>,
}

impl InboxScanner {
    pub fn new(dir: &Path) -> Self {
        InboxScanner { dir: dir.to_path_buf(), seen: Default::default() }
    }

    pub fn dir(&self) -> &Path {
        &self.dir
    }

    pub fn ready(&mut self) -> Vec<PathBuf> {
        let mut out = Vec::new();
        let Ok(entries) = fs::read_dir(&self.dir) else { return out };
        let mut present = Vec::new();
        for entry in entries.flatten() {
            let path = entry.path();
            if !path.is_file() || !is_gdt_name(&entry.file_name().to_string_lossy()) {
                continue;
            }
            let Ok(meta) = entry.metadata() else { continue };
            let stamp = (meta.len(), meta.modified().ok());
            present.push(path.clone());
            if self.seen.get(&path) == Some(&stamp) {
                out.push(path);
            } else {
                self.seen.insert(path, stamp);
            }
        }
        self.seen.retain(|p, _| present.contains(p));
        out
    }

    /// Nach einem Fehlversuch (z. B. Datei noch geöffnet) neu messen.
    pub fn forget(&mut self, path: &Path) {
        self.seen.remove(path);
    }
}

/// Liest die Datei nur, wenn kein anderer Prozess sie geöffnet hat (Windows: Freigabemodus 0).
/// `Ok(None)` = schreibt noch jemand daran.
pub fn read_exclusive(path: &Path) -> std::io::Result<Option<Vec<u8>>> {
    use std::io::Read;
    let mut opts = fs::OpenOptions::new();
    opts.read(true);
    #[cfg(windows)]
    {
        use std::os::windows::fs::OpenOptionsExt;
        opts.share_mode(0);
    }
    let mut file = match opts.open(path) {
        Ok(f) => f,
        // ERROR_SHARING_VIOLATION (32) / ERROR_LOCK_VIOLATION (33)
        Err(e) if matches!(e.raw_os_error(), Some(32) | Some(33)) => return Ok(None),
        Err(e) => return Err(e),
    };
    if file.metadata()?.len() > MAX_INBOX_BYTES {
        return Err(std::io::Error::new(std::io::ErrorKind::InvalidData, "zu groß"));
    }
    let mut data = Vec::new();
    file.by_ref().take(MAX_INBOX_BYTES + 1).read_to_end(&mut data)?;
    Ok(Some(data))
}

/// Aufbauprüfung vor jeder Verarbeitung. Meldungen nennen nie Inhalt oder Dateinamen.
pub fn validate_xdt(data: &[u8]) -> Result<(), &'static str> {
    let mut record_len = 0usize;
    let mut declared: Option<usize> = None;
    let mut records = 0usize;
    let close = |len: usize, declared: Option<usize>| match declared {
        Some(d) if d != len => Err("Satzlänge (FK 8100) stimmt nicht"),
        _ => Ok(()),
    };
    for line in lines(data) {
        let Some((fk, value)) = split_line(line) else { return Err("Zeile ohne xDT-Aufbau") };
        if !length_ok(line) {
            return Err("Zeilenlänge stimmt nicht");
        }
        if fk == b"8000" {
            if records > 0 {
                close(record_len, declared)?;
            }
            records += 1;
            record_len = 0;
            declared = None;
        } else if records == 0 {
            return Err("Datei beginnt nicht mit Satzart (FK 8000)");
        }
        if fk == b"8100" {
            declared = std::str::from_utf8(value).ok().and_then(|v| v.trim().parse().ok());
            if declared.is_none() {
                return Err("Satzlänge (FK 8100) unlesbar");
            }
        }
        record_len += line.len() + 2;
    }
    if records == 0 {
        return Err("keine Satzart gefunden");
    }
    close(record_len, declared)
}

/// Älter als `max_age` (Änderungszeit)?
pub fn is_stale(path: &Path, max_age: Duration) -> bool {
    fs::metadata(path).and_then(|m| m.modified()).map(|t| t.elapsed().map(|e| e > max_age).unwrap_or(false)).unwrap_or(false)
}

/// Verschiebt die Datei unter neutralem Namen in den Quarantäne-Unterordner des Eingangs.
pub fn quarantine(path: &Path, inbox: &Path) -> Result<(), String> {
    let dir = inbox.join(QUARANTINE_DIR);
    fs::create_dir_all(&dir).map_err(|_| "Quarantäne-Ordner nicht anlegbar.".to_string())?;
    let nanos = SystemTime::now().duration_since(SystemTime::UNIX_EPOCH).map(|d| d.as_nanos()).unwrap_or(0);
    fs::rename(path, dir.join(format!("q-{nanos}.xdt"))).map_err(|_| "Datei konnte nicht in die Quarantäne verschoben werden.".to_string())
}

/// Löscht Quarantäne-Dateien, die älter als `keep` sind.
pub fn purge_quarantine(inbox: &Path, keep: Duration) {
    let Ok(entries) = fs::read_dir(inbox.join(QUARANTINE_DIR)) else { return };
    for entry in entries.flatten() {
        if entry.path().is_file() && is_stale(&entry.path(), keep) {
            let _ = fs::remove_file(entry.path());
        }
    }
}

/// Enthält die xDT-Datei eine Zeile mit dieser Feldkennung? (Zeile = 3 Ziffern Länge + 4 Ziffern FK)
pub fn contains_field(data: &[u8], fk: &str) -> bool {
    data.split(|&b| b == b'\n').any(|line| line.len() >= 7 && &line[3..7] == fk.as_bytes())
}

/// Exklusiv + atomar: erst .tmp schreiben, dann umbenennen. "exists", wenn DURIA noch nicht abgeholt hat.
pub fn write_exclusive(dir: &Path, name: &str, data: &[u8]) -> Result<&'static str, String> {
    if name.contains(['/', '\\']) || name.contains("..") || name.is_empty() {
        return Err("Ungültiger Dateiname.".into());
    }
    fs::create_dir_all(dir).map_err(|e| format!("Ausgangsordner: {e}"))?;
    let target = dir.join(name);
    if target.exists() {
        return Ok("exists");
    }
    let tmp = dir.join(format!("{name}.tmp"));
    fs::write(&tmp, data).map_err(|e| format!("Schreiben fehlgeschlagen: {e}"))?;
    if target.exists() {
        let _ = fs::remove_file(&tmp);
        return Ok("exists");
    }
    fs::rename(&tmp, &target).map_err(|e| format!("Umbenennen fehlgeschlagen: {e}"))?;
    Ok("written")
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::patient::make_line;

    fn tmpdir(tag: &str) -> PathBuf {
        let nanos = std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).unwrap().as_nanos();
        let d = std::env::temp_dir().join(format!("praxis-gdt-{tag}-{nanos}"));
        fs::create_dir_all(&d).unwrap();
        d
    }

    /// Synthetischer GDT-Satz 6310 mit korrekter Satzlänge.
    fn gdt() -> Vec<u8> {
        let body = [make_line("3000", b"TEST_99001"), make_line("6228", b"TEST_Befund")].concat();
        let total = make_line("8000", b"6310").len() + make_line("8100", b"00000").len() + body.len();
        [make_line("8000", b"6310"), make_line("8100", format!("{total:05}").as_bytes()), body].concat()
    }

    #[test]
    fn feldkennung_erkennen() {
        let data = b"01380006310\r\n0175001TEST_A\r\n0146228Text\r\n";
        assert!(contains_field(data, "5001"));
        assert!(!contains_field(data, "6001"));
        assert!(!contains_field(b"0146228500100\r\n", "5001")); // nur an Position der FK, nicht im Inhalt
    }

    #[test]
    fn env_expansion_streng() {
        std::env::set_var("PRAXIS_TEST_CLIENT", "PC07");
        assert_eq!(expand_env(r"D:\gdt\%PRAXIS_TEST_CLIENT%\in").unwrap(), r"D:\gdt\PC07\in");
        assert_eq!(expand_env("100% sicher").unwrap(), "100% sicher");
        // PRIV-06: fehlende Variable darf nicht zu einem gemeinsamen Ordner "gdt\\in" werden.
        assert!(expand_env(r"D:\gdt\%PRAXIS_TEST_FEHLT%\in").is_err());
    }

    #[test]
    fn eingang_meldet_stabile_dateien_ohne_zu_lesen_oder_zu_loeschen() {
        let d = tmpdir("in");
        fs::write(d.join("DURPRAX.001"), b"abc").unwrap();
        fs::write(d.join("notiz.docx"), b"x").unwrap();
        let mut s = InboxScanner::new(&d);
        assert!(s.ready().is_empty()); // erste Messung
        let got = s.ready();
        assert_eq!(got, vec![d.join("DURPRAX.001")]);
        assert!(d.join("DURPRAX.001").exists()); // nichts verbraucht
        fs::write(d.join("DURPRAX.001"), b"abcdef").unwrap(); // wächst noch → nicht bereit
        assert!(s.ready().is_empty());
        let _ = fs::remove_dir_all(d);
    }

    #[test]
    fn aufbaupruefung() {
        assert!(validate_xdt(&gdt()).is_ok());
        let mut cut = gdt();
        cut.truncate(cut.len() - 6); // abgebrochene letzte Zeile
        assert!(validate_xdt(&cut).is_err());
        let wrong_len = [make_line("8000", b"6310"), make_line("8100", b"00099"), make_line("3000", b"TEST_1")].concat();
        assert_eq!(validate_xdt(&wrong_len), Err("Satzlänge (FK 8100) stimmt nicht"));
        assert!(validate_xdt(&make_line("3000", b"TEST_1")).is_err()); // ohne Satzart
        assert!(validate_xdt(b"").is_err());
        assert!(validate_xdt(b"PDF-1.4 kein xDT\r\n").is_err());
    }

    #[cfg(windows)]
    #[test]
    fn geoeffnete_datei_wird_nicht_gelesen() {
        use std::os::windows::fs::OpenOptionsExt;
        let d = tmpdir("lock");
        let p = d.join("DURPRAX.001");
        fs::write(&p, gdt()).unwrap();
        let writer = fs::OpenOptions::new().write(true).share_mode(1).open(&p).unwrap(); // DURIA schreibt noch
        assert!(read_exclusive(&p).unwrap().is_none());
        drop(writer);
        assert_eq!(read_exclusive(&p).unwrap().unwrap(), gdt());
        let _ = fs::remove_dir_all(d);
    }

    #[test]
    fn quarantaene_neutral_und_befristet() {
        let d = tmpdir("q");
        let p = d.join("Mustermann_Max.gdt");
        fs::write(&p, b"kaputt").unwrap();
        quarantine(&p, &d).unwrap();
        assert!(!p.exists());
        let names: Vec<String> = fs::read_dir(d.join(QUARANTINE_DIR)).unwrap().flatten().map(|e| e.file_name().to_string_lossy().into()).collect();
        assert_eq!(names.len(), 1);
        assert!(names[0].starts_with("q-") && !names[0].contains("Mustermann"));
        purge_quarantine(&d, Duration::from_secs(3600));
        assert_eq!(fs::read_dir(d.join(QUARANTINE_DIR)).unwrap().count(), 1); // noch in der Frist
        purge_quarantine(&d, Duration::ZERO);
        std::thread::sleep(Duration::from_millis(20));
        purge_quarantine(&d, Duration::ZERO);
        assert_eq!(fs::read_dir(d.join(QUARANTINE_DIR)).unwrap().count(), 0);
        let _ = fs::remove_dir_all(d);
    }

    #[test]
    fn ausgang_exklusiv_und_ohne_pfadausbruch() {
        let d = tmpdir("out");
        assert_eq!(write_exclusive(&d, "PRAX_DUR.gdt", b"1").unwrap(), "written");
        assert_eq!(write_exclusive(&d, "PRAX_DUR.gdt", b"2").unwrap(), "exists");
        assert_eq!(fs::read(d.join("PRAX_DUR.gdt")).unwrap(), b"1");
        assert!(write_exclusive(&d, "..\\boese.gdt", b"x").is_err());
        let _ = fs::remove_dir_all(d);
    }
}
