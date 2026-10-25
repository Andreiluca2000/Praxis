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
    pub mode: String, // "simulation" | "operational"
    pub ollama_model: Option<String>,
    pub voice: VoiceConfig,
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
        mode: "simulation".into(),
        ollama_model: None,
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
