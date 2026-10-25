//! Lokale Spracherkennung: Aufnahme (WebM/Opus aus dem Fenster) → ffmpeg → 16 kHz WAV → whisper-cli → Text.
//! Audio verlässt den Rechner nicht; temporäre Dateien werden immer gelöscht.

use std::fs;
use std::os::windows::process::CommandExt;
use std::path::{Path, PathBuf};
use std::process::Command;

const CREATE_NO_WINDOW: u32 = 0x0800_0000;

pub const DEFAULT_PROMPT: &str = "Hausarztpraxis. Anamnese, Befund, Diagnose, Procedere. Auskultation, Blutdruck, RR, EKG, Labor, AU, Überweisung, Wiedervorstellung, Verdacht auf, Zustand nach.";

#[derive(Clone, Debug, serde::Serialize, serde::Deserialize)]
pub struct VoiceConfig {
    pub whisper_exe: PathBuf,
    pub model: PathBuf,
    pub ffmpeg: PathBuf,
    pub language: String,
    pub threads: u32,
    pub prompt: String,
}

pub fn missing(cfg: &VoiceConfig) -> Vec<String> {
    [&cfg.whisper_exe, &cfg.model].iter().filter(|p| !p.exists()).map(|p| p.display().to_string()).collect()
}

struct TempDir(PathBuf);
impl Drop for TempDir {
    fn drop(&mut self) {
        let _ = fs::remove_dir_all(&self.0);
    }
}

fn run(exe: &Path, args: &[&str]) -> Result<String, String> {
    let out = Command::new(exe).args(args).creation_flags(CREATE_NO_WINDOW).output().map_err(|e| format!("{}: {e}", exe.display()))?;
    if !out.status.success() {
        return Err(format!("{} fehlgeschlagen: {}", exe.display(), String::from_utf8_lossy(&out.stderr).lines().last().unwrap_or("")));
    }
    Ok(String::from_utf8_lossy(&out.stdout).into_owned())
}

pub fn transcribe(audio: &[u8], cfg: &VoiceConfig) -> Result<String, String> {
    let m = missing(cfg);
    if !m.is_empty() {
        return Err(format!("Spracherkennung nicht installiert: {}", m.join(", ")));
    }
    let nanos = std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).map(|d| d.as_nanos()).unwrap_or(0);
    let dir = TempDir(std::env::temp_dir().join(format!("praxis-voice-{}-{nanos}", std::process::id())));
    fs::create_dir_all(&dir.0).map_err(|e| e.to_string())?;
    let input = dir.0.join("in.webm");
    let wav = dir.0.join("in.wav");
    fs::write(&input, audio).map_err(|e| e.to_string())?;
    let (i, w) = (input.to_string_lossy().to_string(), wav.to_string_lossy().to_string());
    run(&cfg.ffmpeg, &["-y", "-loglevel", "error", "-i", &i, "-ar", "16000", "-ac", "1", "-c:a", "pcm_s16le", &w])?;
    let model = cfg.model.to_string_lossy().to_string();
    let threads = cfg.threads.to_string();
    let text = run(&cfg.whisper_exe, &["-m", &model, "-f", &w, "-l", &cfg.language, "-t", &threads, "-nt", "-np", "--prompt", &cfg.prompt])?;
    Ok(clean(&text))
}

/// Entfernt Zeitmarken und typische Halluzinationen bei Stille.
pub fn clean(raw: &str) -> String {
    raw.lines()
        .map(|l| {
            let l = l.trim();
            if l.starts_with('[') {
                l.find(']').map(|i| l[i + 1..].trim()).unwrap_or(l)
            } else {
                l
            }
        })
        .filter(|l| !l.is_empty() && !matches!(*l, "(Musik)" | "(Stille)" | "(Applaus)") && !l.starts_with("Untertitel im Auftrag") && !l.starts_with("Untertitel von"))
        .collect::<Vec<_>>()
        .join(" ")
        .split_whitespace()
        .collect::<Vec<_>>()
        .join(" ")
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn bereinigung() {
        assert_eq!(clean("[00:00.000 --> 00:02.000]  Husten seit drei Tagen.\n(Musik)\nUntertitel im Auftrag des ZDF\n"), "Husten seit drei Tagen.");
    }

    #[test]
    fn fehlende_installation_wird_gemeldet() {
        let cfg = VoiceConfig { whisper_exe: "C:/fehlt/w.exe".into(), model: "C:/fehlt/m.bin".into(), ffmpeg: "ffmpeg".into(), language: "de".into(), threads: 2, prompt: String::new() };
        assert!(transcribe(b"x", &cfg).unwrap_err().contains("nicht installiert"));
    }
}
