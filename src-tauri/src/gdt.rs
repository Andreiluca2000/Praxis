//! GDT-Austausch mit DURIA über Dateien.
//! - Eingang: Datei lesen und SOFORT löschen (keine Ablage von Patientendaten).
//! - Ausgang: exklusiv und atomar schreiben; existiert die letzte Datei noch, wartet man auf DURIA.
//! Pfade dürfen `%CLIENTNAME%`/`%USERNAME%` enthalten (Terminalserver: ein Ordner je RDP-Sitzung).

use std::fs;
use std::path::{Path, PathBuf};

/// Ersetzt %VAR% durch Umgebungsvariablen (nur Buchstaben/Ziffern/_ im Namen).
pub fn expand_env(path: &str) -> String {
    let mut out = String::new();
    let mut rest = path;
    while let Some(start) = rest.find('%') {
        out.push_str(&rest[..start]);
        let after = &rest[start + 1..];
        match after.find('%') {
            Some(end) if after[..end].chars().all(|c| c.is_ascii_alphanumeric() || c == '_') && end > 0 => {
                let name = &after[..end];
                out.push_str(&std::env::var(name).unwrap_or_default());
                rest = &after[end + 1..];
            }
            _ => {
                out.push('%');
                rest = after;
            }
        }
    }
    out.push_str(rest);
    out
}

fn is_gdt_name(name: &str) -> bool {
    let lower = name.to_lowercase();
    if [".gdt", ".bdt", ".dat", ".txt"].iter().any(|e| lower.ends_with(e)) {
        return true;
    }
    // GDT-Konvention mit laufender Endung, z. B. "DURPRAX.001"
    matches!(lower.rsplit_once('.'), Some((_, ext)) if ext.len() == 3 && ext.chars().all(|c| c.is_ascii_digit()))
}

pub struct Incoming {
    pub name: String,
    pub data: Vec<u8>,
}

/// Liefert fertige Dateien (Größe stabil seit dem letzten Aufruf) und löscht sie.
pub struct InboxScanner {
    dir: PathBuf,
    sizes: std::collections::HashMap<PathBuf, u64>,
}

impl InboxScanner {
    pub fn new(dir: &Path) -> Self {
        InboxScanner { dir: dir.to_path_buf(), sizes: Default::default() }
    }

    pub fn scan(&mut self) -> Vec<Result<Incoming, String>> {
        let mut out = Vec::new();
        let Ok(entries) = fs::read_dir(&self.dir) else { return out };
        for entry in entries.flatten() {
            let path = entry.path();
            let name = entry.file_name().to_string_lossy().to_string();
            if !path.is_file() || !is_gdt_name(&name) {
                continue;
            }
            let Ok(meta) = entry.metadata() else { continue };
            let size = meta.len();
            if self.sizes.get(&path) != Some(&size) {
                self.sizes.insert(path, size);
                continue;
            }
            self.sizes.remove(&path);
            out.push(fs::read(&path).map_err(|e| format!("{name}: {e}")).and_then(|data| {
                fs::remove_file(&path).map_err(|e| format!("{name} konnte nicht gelöscht werden: {e}"))?;
                Ok(Incoming { name, data })
            }));
        }
        out
    }
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

    fn tmpdir(tag: &str) -> PathBuf {
        let nanos = std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).unwrap().as_nanos();
        let d = std::env::temp_dir().join(format!("praxis-gdt-{tag}-{nanos}"));
        fs::create_dir_all(&d).unwrap();
        d
    }

    #[test]
    fn env_expansion() {
        std::env::set_var("PRAXIS_TEST_CLIENT", "PC07");
        assert_eq!(expand_env(r"D:\gdt\%PRAXIS_TEST_CLIENT%\in"), r"D:\gdt\PC07\in");
        assert_eq!(expand_env("100% sicher"), "100% sicher");
    }

    #[test]
    fn eingang_erst_bei_stabiler_groesse_und_dann_geloescht() {
        let d = tmpdir("in");
        fs::write(d.join("DURPRAX.001"), b"abc").unwrap();
        fs::write(d.join("notiz.docx"), b"x").unwrap();
        let mut s = InboxScanner::new(&d);
        assert!(s.scan().is_empty()); // erste Messung
        let got = s.scan();
        assert_eq!(got.len(), 1);
        assert_eq!(got[0].as_ref().unwrap().data, b"abc");
        assert!(!d.join("DURPRAX.001").exists());
        assert!(d.join("notiz.docx").exists());
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
