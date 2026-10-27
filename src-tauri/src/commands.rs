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
    state.vault.lock().unwrap().close();
    *state.pending.lock().unwrap() = None;
}

/// Wartende Übergabe aus DURIA abholen (einmalig). Nur für den angemeldeten Benutzer.
#[tauri::command]
pub fn take_incoming(state: State<AppState>) -> Result<Option<crate::SanitizedExport>, String> {
    require_user(&state)?;
    Ok(state.pending.lock().unwrap().take())
}

#[tauri::command]
pub fn close_patient(state: State<AppState>) {
    state.vault.lock().unwrap().close();
    *state.pending.lock().unwrap() = None;
}

/// Datei aus dem Auswahldialog lesen (nur GDT/BDT, max. 20 MB) – das Fenster erhält nur die bereinigte Fassung.
#[tauri::command]
pub fn read_export(state: State<AppState>, path: String) -> Result<crate::SanitizedExport, String> {
    require_user(&state)?;
    let p = PathBuf::from(&path);
    let ext = p.extension().map(|e| e.to_string_lossy().to_lowercase()).unwrap_or_default();
    if !["gdt", "bdt", "dat", "txt"].contains(&ext.as_str()) {
        return Err("Nur GDT/BDT-Dateien.".into());
    }
    if std::fs::metadata(&p).map_err(|e| e.to_string())?.len() > 20 * 1024 * 1024 {
        return Err("Datei zu groß.".into());
    }
    let raw = std::fs::read(&p).map_err(|e| e.to_string())?;
    // Ins Fenster nur eine neutrale Bezeichnung, nie der Dateiname.
    Ok(crate::sanitize_for_window(&state, "Ausgewählte Datei", if ext == "bdt" { "bdt" } else { "gdt" }, &raw))
}

/// Rückweg zu DURIA. Verzeichnis und Dateiname kommen nur aus der Konfiguration, nie aus dem Fenster.
#[tauri::command]
pub fn gdt_write(state: State<AppState>, data: Vec<u8>, token: String) -> Result<String, String> {
    require_arzt(&state)?;
    let channel = state.config.lock().unwrap().billing_channel.clone();
    // HL7-Nachrichten beginnen mit "MSH|"; sie gehen nur über den ausdrücklich gewählten HL7-Weg.
    if data.starts_with(b"MSH|") {
        if channel != "hl7" {
            return Err("HL7 ist als Übertragungsweg nicht ausgewählt.".into());
        }
        let cfg = state.config.lock().unwrap().clone();
        if !cfg.billing_writeback_enabled {
            return Err("Übernahme von Ziffern/Diagnosen ist deaktiviert.".into());
        }
        let msg = state.vault.lock().unwrap().restore_hl7(&data, &token)?;
        let dir = PathBuf::from(gdt::expand_env(&cfg.outbox_dir)?);
        let name = format!("{}.hl7", cfg.outbox_file.trim_end_matches(".gdt"));
        return gdt::write_exclusive(&dir, &name, &msg).map(|s| s.to_string());
    }
    // Pseudonym → echte Patientennummer erst hier, unmittelbar vor dem Schreiben.
    let data = state.vault.lock().unwrap().restore(&data, &token)?;
    let cfg = state.config.lock().unwrap().clone();
    if !cfg.writeback_enabled && !cfg.billing_writeback_enabled {
        return Err("Rückweg zu DURIA ist deaktiviert.".into());
    }
    // Abrechnungsdaten (5001 Ziffer / 6001 Diagnose) nur mit eigenem Schalter.
    let has_billing = gdt::contains_field(&data, "5001") || gdt::contains_field(&data, "6001");
    if has_billing && !cfg.billing_writeback_enabled {
        return Err("Übernahme von Ziffern/Diagnosen ist deaktiviert.".into());
    }
    if !has_billing && !cfg.writeback_enabled {
        return Err("Notiz-Rückweg zu DURIA ist deaktiviert.".into());
    }
    let dir = PathBuf::from(gdt::expand_env(&cfg.outbox_dir)?);
    gdt::write_exclusive(&dir, &cfg.outbox_file, &data).map(|s| s.to_string())
}

/// KVDT-Quartalsdatei lesen (nur Lesen, max. 200 MB). Fenster erhält Pseudonyme statt Patientennummern.
#[derive(serde::Serialize)]
pub struct SanitizedKvdt {
    name: String,
    data: Vec<u8>,
    patients: usize,
    dropped: usize,
    unknown: usize,
    invalid: usize,
}

#[tauri::command]
pub fn read_kvdt(state: State<AppState>, path: String) -> Result<SanitizedKvdt, String> {
    require_arzt(&state)?;
    let p = PathBuf::from(&path);
    if std::fs::metadata(&p).map_err(|e| e.to_string())?.len() > 200 * 1024 * 1024 {
        return Err("Datei zu groß.".into());
    }
    let raw = std::fs::read(&p).map_err(|e| e.to_string())?;
    let s = state.vault.lock().unwrap().sanitize_many(&raw);
    Ok(SanitizedKvdt { name: "KVDT-Datei".into(), data: s.data, patients: s.patient_ids, dropped: s.dropped, unknown: s.unknown, invalid: s.invalid })
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
