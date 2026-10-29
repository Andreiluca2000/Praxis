//! Arbeitsplatz-Einstellungen (keine Patientendaten).
//! - Konten: praxisweit unter %ProgramData%\Praxis-Assistent (auf dem Terminalserver für alle Sitzungen gleich).
//! - Einstellungen: je Windows-Benutzer (%AppData%), damit jede RDP-Sitzung ihren eigenen GDT-Ordner hat.

use crate::voice::{VoiceConfig, DEFAULT_PROMPT};
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::{Path, PathBuf};

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct AppConfig {
    /// Eingang: DURIA legt hier GDT-Dateien ab. %CLIENTNAME% = Name des RDP-Arbeitsplatzes.
    pub inbox_dir: String,
    pub outbox_dir: String,
    pub outbox_file: String,
    pub writeback_enabled: bool,
    /// Ziffern/Diagnosen per GDT (getrennt vom Notiz-Rückweg; erst nach Bestätigung durch DURIA).
    #[serde(default)]
    pub billing_writeback_enabled: bool,
    /// Übertragungsweg für Ziffern/Diagnosen: "gdt" (Standard) oder "hl7" (vorbereitet, erst nach DURIA-Bestätigung).
    #[serde(default = "default_channel")]
    pub billing_channel: String,
    pub mode: String, // "simulation" | "operational"
    pub ollama_model: Option<String>,
    pub voice: VoiceConfig,
    /// KI-Assistent über die Claude API – standardmäßig aus.
    #[serde(default)]
    pub ai: crate::ai::AiConfig,
    /// Kassenärztliche Vereinigung der Praxis: "Nordrhein" | "Westfalen-Lippe" | null (regionale Regeln, z. B. DMP).
    #[serde(default)]
    pub kv: Option<String>,
    /// Praxis hat die KV-Genehmigung für DMP Diabetes mellitus Typ 2 (vom Arzt in den Einstellungen bestätigt).
    #[serde(default)]
    pub dmp_dm2_teilnahme: bool,
}

pub const KV_WERTE: [&str; 2] = ["Nordrhein", "Westfalen-Lippe"];

/// Nur bekannte KV-Bereiche; DMP-Teilnahme ohne KV ist bedeutungslos und wird abgelehnt.
pub fn validate_region(cfg: &AppConfig) -> Result<(), String> {
    match cfg.kv.as_deref() {
        None => {
            if cfg.dmp_dm2_teilnahme {
                return Err("DMP-Teilnahme erst nach Wahl der KV.".into());
            }
            Ok(())
        }
        Some(kv) if KV_WERTE.contains(&kv) => Ok(()),
        Some(_) => Err("Unbekannte KV.".into()),
    }
}

fn default_channel() -> String {
    "gdt".into()
}

/// Praxisweite Praxisregeln (nur Regeln und Verlauf, keine Patientendaten). Schreiben auf dem Server nur als Administrator.
pub fn practice_rules_file() -> PathBuf {
    shared_dir().join("praxisregeln.json")
}

/// Höchstgröße der Praxisregel-Datei (Schutz vor versehentlich riesigen Dateien).
pub const PRACTICE_RULES_MAX_BYTES: u64 = 2 * 1024 * 1024;

/// Atomar schreiben (erst .tmp, dann umbenennen); fehlende Rechte → verständliche Meldung.
pub fn write_practice_rules(file: &Path, json: &str) -> Result<(), String> {
    let value: serde_json::Value = serde_json::from_str(json).map_err(|_| "Praxisregeln: ungültiges Format.".to_string())?;
    if value.get("schema_version").and_then(|v| v.as_str()) != Some("1.0.0") || !value.get("rules").map(|r| r.is_array()).unwrap_or(false) {
        return Err("Praxisregeln: unbekanntes Dateiformat.".into());
    }
    if json.len() as u64 > PRACTICE_RULES_MAX_BYTES {
        return Err("Praxisregeln: Datei zu groß.".into());
    }
    let failed = |e: std::io::Error| match e.kind() {
        std::io::ErrorKind::PermissionDenied => {
            "Praxisregeln können nur mit Administratorrechten gespeichert werden (Programm per Rechtsklick „Als Administrator ausführen“).".to_string()
        }
        _ => format!("Praxisregeln nicht speicherbar: {e}"),
    };
    if let Some(dir) = file.parent() {
        fs::create_dir_all(dir).map_err(failed)?;
    }
    let tmp = file.with_extension("tmp");
    fs::write(&tmp, json).map_err(failed)?;
    fs::rename(&tmp, file).map_err(failed)
}

pub fn read_practice_rules(file: &Path) -> Result<Option<String>, String> {
    match fs::metadata(file) {
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => Ok(None),
        Err(e) => Err(format!("Praxisregeln nicht lesbar: {e}")),
        Ok(m) if m.len() > PRACTICE_RULES_MAX_BYTES => Err("Praxisregeln: Datei zu groß.".into()),
        Ok(_) => fs::read_to_string(file).map(Some).map_err(|e| format!("Praxisregeln nicht lesbar: {e}")),
    }
}

pub fn shared_dir() -> PathBuf {
    let base = std::env::var("ProgramData").unwrap_or_else(|_| "C:\\ProgramData".into());
    PathBuf::from(base).join("Praxis-Assistent")
}

/// Name des Arbeitsplatzes: in einer RDP-Sitzung der Client-PC, sonst der Rechnername.
pub fn client_name() -> String {
    std::env::var("CLIENTNAME").or_else(|_| std::env::var("COMPUTERNAME")).unwrap_or_else(|_| "PC".into())
}

fn defaults(resource_root: &Path) -> AppConfig {
    let tools = [resource_root.join("tools"), PathBuf::from("..").join("tools"), PathBuf::from("tools")]
        .into_iter()
        .find(|p| p.join("whisper").exists())
        .unwrap_or_else(|| resource_root.join("tools"));
    let threads = std::thread::available_parallelism().map(|n| n.get() as u32).unwrap_or(4);
    AppConfig {
        inbox_dir: shared_dir().join("gdt").join("%CLIENTNAME%").join("eingang").to_string_lossy().into(),
        outbox_dir: shared_dir().join("gdt").join("%CLIENTNAME%").join("ausgang").to_string_lossy().into(),
        outbox_file: "PRAX_DUR.gdt".into(),
        writeback_enabled: false, // erst nach Bestätigung der Dateikonvention durch DURIA
        billing_writeback_enabled: false,
        billing_channel: default_channel(),
        mode: "simulation".into(),
        ollama_model: None,
        ai: crate::ai::AiConfig::default(),
        kv: None,
        dmp_dm2_teilnahme: false,
        voice: VoiceConfig {
            whisper_exe: tools.join("whisper").join("Release").join("whisper-cli.exe"),
            model: tools.join("models").join("ggml-large-v3-turbo-q5_0.bin"),
            ffmpeg: "ffmpeg".into(),
            language: "de".into(),
            // Terminalserver: nicht alle Kerne einer einzelnen Sitzung geben.
            threads: (threads / 2).clamp(2, 8),
            prompt: DEFAULT_PROMPT.into(),
        },
    }
}

/// Rekursives Zusammenführen: gespeicherte Werte überschreiben Standardwerte.
pub fn merge(base: &mut serde_json::Value, patch: &serde_json::Value) {
    match (base, patch) {
        (serde_json::Value::Object(b), serde_json::Value::Object(p)) => {
            for (k, v) in p {
                merge(b.entry(k.clone()).or_insert(serde_json::Value::Null), v);
            }
        }
        (b, p) => *b = p.clone(),
    }
}

pub fn load_config(user_dir: &Path, resource_root: &Path) -> Result<(AppConfig, PathBuf), String> {
    let file = user_dir.join("arbeitsplatz.json");
    let base = defaults(resource_root);
    if !file.exists() {
        save_config(&file, &base)?;
        return Ok((base, file));
    }
    let saved: serde_json::Value = serde_json::from_str(&fs::read_to_string(&file).map_err(|e| e.to_string())?).map_err(|e| e.to_string())?;
    let mut value = serde_json::to_value(&base).map_err(|e| e.to_string())?;
    merge(&mut value, &saved);
    Ok((serde_json::from_value(value).map_err(|e| e.to_string())?, file))
}

pub fn save_config(file: &Path, cfg: &AppConfig) -> Result<(), String> {
    if let Some(d) = file.parent() {
        fs::create_dir_all(d).map_err(|e| e.to_string())?;
    }
    fs::write(file, serde_json::to_string_pretty(cfg).map_err(|e| e.to_string())?).map_err(|e| e.to_string())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn praxisregeln_lesen_schreiben_und_rechte() {
        let nanos = std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).unwrap().as_nanos();
        let dir = std::env::temp_dir().join(format!("praxis-rules-{nanos}"));
        let file = dir.join("praxisregeln.json");
        assert_eq!(read_practice_rules(&file).unwrap(), None);
        assert!(write_practice_rules(&file, "kein json").is_err());
        assert!(write_practice_rules(&file, r#"{"schema_version":"9","rules":[]}"#).is_err());
        write_practice_rules(&file, r#"{"schema_version":"1.0.0","rules":[]}"#).unwrap();
        assert!(read_practice_rules(&file).unwrap().unwrap().contains("1.0.0"));
        // Schreibgeschützt (wie auf dem Server für Benutzer) → Hinweis auf Administratorrechte.
        let mut perm = fs::metadata(&file).unwrap().permissions();
        perm.set_readonly(true);
        fs::set_permissions(&file, perm.clone()).unwrap();
        let err = write_practice_rules(&file, r#"{"schema_version":"1.0.0","rules":[1]}"#).unwrap_err();
        assert!(err.contains("Administratorrechten"), "{err}");
        perm.set_readonly(false);
        fs::set_permissions(&file, perm).unwrap();
        let _ = fs::remove_dir_all(dir);
    }

    #[test]
    fn kv_bleibt_gespeichert_und_wird_geprueft() {
        let nanos = std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).unwrap().as_nanos();
        let dir = std::env::temp_dir().join(format!("praxis-config-{nanos}"));
        let (mut cfg, file) = load_config(&dir, &dir).unwrap();
        assert_eq!(cfg.kv, None);
        assert!(!cfg.dmp_dm2_teilnahme);
        cfg.kv = Some("Nordrhein".into());
        cfg.dmp_dm2_teilnahme = true;
        validate_region(&cfg).unwrap();
        save_config(&file, &cfg).unwrap();
        let (again, _) = load_config(&dir, &dir).unwrap();
        assert_eq!(again.kv.as_deref(), Some("Nordrhein"));
        assert!(again.dmp_dm2_teilnahme);
        cfg.kv = Some("Bayern".into());
        assert!(validate_region(&cfg).is_err());
        cfg.kv = None;
        assert!(validate_region(&cfg).is_err(), "DMP ohne KV");
        let _ = fs::remove_dir_all(dir);
    }
}
