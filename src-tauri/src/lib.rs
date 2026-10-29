//! Praxis-Assistent – schlankes Rust-Backend (Tauri 2).
//! Zuständig nur für Systemzugriffe: Konten, GDT-Dateien, Spracherkennung, Einstellungen.
//! Fachlogik (Prüfmotor, xDT, Fertig) läuft als TypeScript im Fenster und ist dort getestet.

mod accounts;
mod ai;
mod ai_transfer;
#[cfg(test)]
mod ai_tests;
#[cfg(test)]
mod accounts_tests;
mod commands;
mod config;
mod gdt;
mod patient;
#[cfg(test)]
mod patient_tests;
mod voice;

use accounts::{AccountStore, PublicAccount};
use patient::PatientVault;
use config::{load_config, AppConfig};
use std::collections::HashSet;
use std::path::{Path, PathBuf};
use std::sync::Mutex;
use std::time::Duration;
use tauri::{Emitter, Manager};

pub struct AppState {
    pub accounts: Mutex<AccountStore>,
    pub user: Mutex<Option<PublicAccount>>,
    pub config: Mutex<AppConfig>,
    pub config_file: PathBuf,
    /// Echte Patientennummer nur hier; das Fenster sieht nur Pseudonyme.
    pub vault: Mutex<PatientVault>,
    /// Letzte bereinigte Übergabe aus DURIA, bis das Fenster sie abholt (nur im Arbeitsspeicher).
    /// Das Ereignis ist nur ein Hinweis – so geht nichts verloren, wenn das Fenster gerade erst lädt.
    pub pending: Mutex<Option<SanitizedExport>>,
    /// Ablage des Claude-API-Schlüssels (Windows-Anmeldeinformationsverwaltung).
    pub keys: Box<dyn ai::KeyStore>,
    /// KI-Protokoll ohne Inhalte (je Windows-Benutzer).
    pub ai_audit_file: PathBuf,
}

/// Bereinigte Daten für das Fenster (ohne Identität, Patientennummer pseudonymisiert).
#[derive(serde::Serialize, Clone)]
pub struct SanitizedExport {
    pub name: String,
    /// "gdt" oder "bdt" – ersetzt die frühere Erkennung über den Dateinamen, der das Fenster nicht mehr erreicht.
    pub format: &'static str,
    pub data: Vec<u8>,
    pub token: Option<String>,
    pub patient_ids: usize,
    pub dropped: usize,
    /// Verworfene Zeilen mit nicht erlaubter Feldkennung bzw. ohne gültigen Aufbau (nur gezählt).
    pub unknown: usize,
    pub invalid: usize,
    /// Im Freitext ersetzte Identitätswerte.
    pub redacted: usize,
    pub revision: String,
}

/// `label` ist eine neutrale Bezeichnung, nie der Dateiname (der kann den Patientennamen enthalten).
pub fn sanitize_for_window(state: &AppState, label: &str, format: &'static str, raw: &[u8]) -> SanitizedExport {
    let s = state.vault.lock().unwrap().sanitize(raw);
    SanitizedExport {
        name: label.into(),
        format,
        data: s.data,
        token: s.token,
        patient_ids: s.patient_ids,
        dropped: s.dropped,
        unknown: s.unknown,
        invalid: s.invalid,
        redacted: s.redacted,
        revision: s.revision,
    }
}

/// Merkt sich, worüber schon informiert wurde – sonst käme alle 1,2 s dieselbe Meldung.
#[derive(Default)]
struct InboxNotices {
    waiting: HashSet<PathBuf>,
    /// Übergeben, aber nicht löschbar: nicht ein zweites Mal übergeben.
    consumed: HashSet<PathBuf>,
    dir_error: Option<String>,
}

/// Eine bereite Datei aus dem Eingang verarbeiten. Die Anmeldung bleibt dabei gesperrt,
/// damit ein gleichzeitiges Abmelden nicht zwischen Prüfung und Übergabe fällt (PRIV-05).
fn handle_incoming(app: &tauri::AppHandle, state: &AppState, scanner: &mut gdt::InboxScanner, path: &Path, seen: &mut InboxNotices) {
    let notice = |text: &str| {
        let _ = app.emit("notice", text.to_string());
    };
    if seen.consumed.contains(path) {
        return;
    }
    let user = state.user.lock().unwrap();
    if user.is_none() {
        // Ohne Anmeldung wird die Datei weder gelesen noch gelöscht.
        if seen.waiting.insert(path.to_path_buf()) {
            notice("Eine Übergabe aus DURIA wartet – bitte anmelden.");
        }
        return;
    }
    seen.waiting.remove(path);
    let inbox = scanner.dir().to_path_buf();
    let hold = |why: &str| {
        let moved = gdt::quarantine(path, &inbox).map(|_| " Sie wurde für 24 Stunden zurückgehalten.").unwrap_or(" Bitte Eingangsordner prüfen.");
        notice(&format!("Übergabe aus DURIA nicht geöffnet: {why}.{moved}"));
    };
    if gdt::is_stale(path, gdt::MAX_AGE) {
        return hold("älter als 10 Minuten, gehört vermutlich zu einem früheren Aufruf");
    }
    let data = match gdt::read_exclusive(path) {
        Ok(Some(d)) => d,
        Ok(None) => return scanner.forget(path), // DURIA schreibt noch
        Err(e) if e.kind() == std::io::ErrorKind::InvalidData => return hold("Datei zu groß"),
        Err(_) => return notice("Übergabe aus DURIA konnte nicht gelesen werden."),
    };
    if let Err(why) = gdt::validate_xdt(&data) {
        return hold(&format!("unvollständig oder ungültig ({why})"));
    }
    // Rohdaten verlassen Rust nicht: nur die bereinigte Fassung wartet auf das Fenster.
    *state.pending.lock().unwrap() = Some(sanitize_for_window(state, "DURIA-Übergabe", "gdt", &data));
    drop(user);
    let _ = app.emit("gdt-incoming", ());
    if std::fs::remove_file(path).is_err() {
        seen.consumed.insert(path.to_path_buf());
        notice("Übergabe gelesen, aber nicht aus dem Eingang entfernt – bitte Eingangsordner prüfen.");
    }
}

/// Beobachtet das GDT-Eingangsverzeichnis (je RDP-Sitzung eigener Ordner) und meldet neue Dateien.
fn start_inbox(app: tauri::AppHandle) {
    std::thread::spawn(move || {
        let mut scanner: Option<(String, gdt::InboxScanner)> = None;
        let mut seen = InboxNotices::default();
        for tick in 0u64.. {
            std::thread::sleep(Duration::from_millis(1200));
            let state = app.state::<AppState>();
            let configured = state.config.lock().unwrap().inbox_dir.clone();
            let dir = match gdt::expand_env(&configured) {
                Ok(d) => d,
                Err(e) => {
                    if seen.dir_error.as_ref() != Some(&e) {
                        let _ = app.emit("notice", format!("DURIA-Eingang deaktiviert: {e}"));
                        seen.dir_error = Some(e);
                    }
                    scanner = None;
                    continue;
                }
            };
            seen.dir_error = None;
            if scanner.as_ref().map(|(d, _)| d != &dir).unwrap_or(true) {
                let _ = std::fs::create_dir_all(&dir);
                scanner = Some((dir.clone(), gdt::InboxScanner::new(Path::new(&dir))));
                seen = InboxNotices::default();
            }
            let Some((_, s)) = scanner.as_mut() else { continue };
            if tick % 50 == 0 {
                gdt::purge_quarantine(s.dir(), gdt::QUARANTINE_KEEP);
            }
            for path in s.ready() {
                handle_incoming(&app, &state, s, &path, &mut seen);
            }
            seen.waiting.retain(|p| p.exists());
            seen.consumed.retain(|p| p.exists());
        }
    });
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .setup(|app| {
            let resource_root = app.path().resource_dir().unwrap_or_else(|_| PathBuf::from("."));
            let user_dir = app.path().app_config_dir().map_err(|e| e.to_string())?;
            let (config, config_file) = load_config(&user_dir, &resource_root)?;
            let accounts = AccountStore::open(&config::shared_dir().join("konten.json"))?;
            app.manage(AppState {
                accounts: Mutex::new(accounts),
                user: Mutex::new(None),
                config: Mutex::new(config),
                config_file,
                vault: Mutex::new(PatientVault::new()),
                pending: Mutex::new(None),
                keys: Box::new(ai::CredentialManager),
                ai_audit_file: user_dir.join("ki-protokoll.jsonl"),
            });
            start_inbox(app.handle().clone());
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::status,
            commands::create_account,
            commands::register_account,
            commands::set_account_active,
            commands::login,
            commands::logout,
            commands::read_export,
            commands::take_incoming,
            commands::close_patient,
            commands::read_kvdt,
            commands::gdt_write,
            commands::transcribe,
            commands::update_config,
            commands::rules_read,
            commands::ai_status,
            commands::ai_set_key,
            commands::ai_delete_key,
            commands::ai_test,
            commands::ai_preview,
            commands::ai_export_key,
            commands::ai_import_key,
            commands::rules_write,
        ])
        .run(tauri::generate_context!())
        .expect("Praxis-Assistent konnte nicht starten");
}
