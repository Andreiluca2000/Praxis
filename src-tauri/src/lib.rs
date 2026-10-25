//! Praxis-Assistent – schlankes Rust-Backend (Tauri 2).
//! Zuständig nur für Systemzugriffe: Konten, GDT-Dateien, Spracherkennung, Einstellungen.
//! Fachlogik (Prüfmotor, xDT, Fertig) läuft als TypeScript im Fenster und ist dort getestet.

mod accounts;
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
use std::path::PathBuf;
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
}

/// Bereinigte Daten für das Fenster (ohne Identität, Patientennummer pseudonymisiert).
#[derive(serde::Serialize, Clone)]
pub struct SanitizedExport {
    pub name: String,
    pub data: Vec<u8>,
    pub token: Option<String>,
    pub patient_ids: usize,
    pub dropped: usize,
    pub revision: String,
}

pub fn sanitize_for_window(state: &AppState, name: String, raw: &[u8]) -> SanitizedExport {
    let s = state.vault.lock().unwrap().sanitize(raw);
    SanitizedExport { name, data: s.data, token: s.token, patient_ids: s.patient_ids, dropped: s.dropped, revision: s.revision }
}

/// Beobachtet das GDT-Eingangsverzeichnis (je RDP-Sitzung eigener Ordner) und meldet neue Dateien.
fn start_inbox(app: tauri::AppHandle) {
    std::thread::spawn(move || {
        let mut scanner: Option<(String, gdt::InboxScanner)> = None;
        loop {
            std::thread::sleep(Duration::from_millis(1200));
            let state = app.state::<AppState>();
            let dir = gdt::expand_env(&state.config.lock().unwrap().inbox_dir);
            if scanner.as_ref().map(|(d, _)| d != &dir).unwrap_or(true) {
                let _ = std::fs::create_dir_all(&dir);
                scanner = Some((dir.clone(), gdt::InboxScanner::new(std::path::Path::new(&dir))));
            }
            let logged_in = state.user.lock().unwrap().is_some();
            let Some((_, s)) = scanner.as_mut() else { continue };
            for item in s.scan() {
                match item {
                    Ok(file) if logged_in => {
                        // Rohdaten verlassen Rust nicht: nur die bereinigte Fassung geht ins Fenster.
                        let clean = sanitize_for_window(&state, file.name, &file.data);
                        let _ = app.emit("gdt-incoming", clean);
                    }
                    Ok(file) => {
                        let _ = app.emit("notice", format!("GDT-Datei {} empfangen, aber niemand angemeldet – verworfen.", file.name));
                    }
                    Err(e) => {
                        let _ = app.emit("notice", e);
                    }
                }
            }
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
            });
            start_inbox(app.handle().clone());
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::status,
            commands::create_account,
            commands::set_account_active,
            commands::login,
            commands::logout,
            commands::read_export,
            commands::close_patient,
            commands::read_kvdt,
            commands::gdt_write,
            commands::transcribe,
            commands::update_config,
        ])
        .run(tauri::generate_context!())
        .expect("Praxis-Assistent konnte nicht starten");
}
