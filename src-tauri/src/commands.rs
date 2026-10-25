//! Kommandos, die das Fenster aufrufen darf. Jede Aktion prüft Anmeldung bzw. Arztrolle.

use crate::accounts::{PublicAccount, Role};
use crate::config::{self, save_config, AppConfig};
use crate::{gdt, voice, AppState};
use std::path::PathBuf;
use tauri::State;

fn require_user(state: &State<AppState>) -> Result<PublicAccount, String> {
    state.user.lock().unwrap().clone().ok_or_else(|| "Bitte anmelden.".to_string())
}

fn require_arzt(state: &State<AppState>) -> Result<PublicAccount, String> {
    let u = require_user(state)?;
    if u.role != Role::Arzt {
        return Err("Nur Ärzte dürfen das.".into());
    }
    Ok(u)
}

#[derive(serde::Serialize)]
pub struct Status {
    needs_setup: bool,
    user: Option<PublicAccount>,
    accounts: Vec<PublicAccount>,
    config: AppConfig,
    voice_missing: Vec<String>,
    session: String,
}

#[tauri::command]
pub fn status(state: State<AppState>) -> Status {
    let user = state.user.lock().unwrap().clone();
    let accounts = state.accounts.lock().unwrap();
    let config = state.config.lock().unwrap().clone();
    Status {
        needs_setup: accounts.is_empty(),
        accounts: if matches!(&user, Some(u) if u.role == Role::Arzt) { accounts.list() } else { vec![] },
        voice_missing: voice::missing(&config.voice),
        session: format!("{}:{}", config::client_name(), user.as_ref().map(|u| u.kuerzel.as_str()).unwrap_or("-")),
        user,
        config,
    }
}

#[tauri::command]
pub fn create_account(state: State<AppState>, kuerzel: String, name: String, role: Role, password: String) -> Result<PublicAccount, String> {
    let by = state.user.lock().unwrap().clone();
    state.accounts.lock().unwrap().create(&kuerzel, &name, role, &password, by.as_ref())
}

#[tauri::command]
pub fn set_account_active(state: State<AppState>, kuerzel: String, active: bool) -> Result<(), String> {
    let by = require_arzt(&state)?;
    state.accounts.lock().unwrap().set_active(&kuerzel, active, &by)
}

#[tauri::command]
pub fn login(state: State<AppState>, kuerzel: String, password: String) -> Result<PublicAccount, String> {
    let user = state.accounts.lock().unwrap().login(&kuerzel, &password).ok_or("Kürzel oder Passwort falsch.")?;
    *state.user.lock().unwrap() = Some(user.clone());
    Ok(user)
}

#[tauri::command]
pub fn logout(state: State<AppState>) {
    *state.user.lock().unwrap() = None;
}

/// Datei aus dem Auswahldialog lesen (nur GDT/BDT, max. 20 MB).
#[tauri::command]
pub fn read_export(state: State<AppState>, path: String) -> Result<Vec<u8>, String> {
    require_user(&state)?;
    let p = PathBuf::from(&path);
    let ext = p.extension().map(|e| e.to_string_lossy().to_lowercase()).unwrap_or_default();
    if !["gdt", "bdt", "dat", "txt"].contains(&ext.as_str()) {
        return Err("Nur GDT/BDT-Dateien.".into());
    }
    if std::fs::metadata(&p).map_err(|e| e.to_string())?.len() > 20 * 1024 * 1024 {
        return Err("Datei zu groß.".into());
    }
    std::fs::read(&p).map_err(|e| e.to_string())
}

/// Rückweg zu DURIA. Verzeichnis und Dateiname kommen nur aus der Konfiguration, nie aus dem Fenster.
#[tauri::command]
pub fn gdt_write(state: State<AppState>, data: Vec<u8>) -> Result<String, String> {
    require_arzt(&state)?;
    let cfg = state.config.lock().unwrap().clone();
    if !cfg.writeback_enabled {
        return Err("Rückweg zu DURIA ist deaktiviert.".into());
    }
    let dir = PathBuf::from(gdt::expand_env(&cfg.outbox_dir));
    gdt::write_exclusive(&dir, &cfg.outbox_file, &data).map(|s| s.to_string())
}

#[tauri::command]
pub async fn transcribe(state: State<'_, AppState>, audio: Vec<u8>) -> Result<String, String> {
    require_user(&state)?;
    let cfg = state.config.lock().unwrap().voice.clone();
    // Rechenintensiv → eigener Thread, die Oberfläche bleibt bedienbar.
    tauri::async_runtime::spawn_blocking(move || voice::transcribe(&audio, &cfg)).await.map_err(|e| e.to_string())?
}

#[tauri::command]
pub fn update_config(state: State<AppState>, patch: serde_json::Value) -> Result<AppConfig, String> {
    require_arzt(&state)?;
    let mut cfg = state.config.lock().unwrap();
    let mut value = serde_json::to_value(&*cfg).map_err(|e| e.to_string())?;
    config::merge(&mut value, &patch);
    *cfg = serde_json::from_value(value).map_err(|e| format!("Ungültige Einstellung: {e}"))?;
    save_config(&state.config_file, &cfg)?;
    Ok(cfg.clone())
}
