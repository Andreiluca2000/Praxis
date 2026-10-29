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

/// Registrierung vom Anmeldebildschirm: das erste Konto (Arzt) ohne Freigabe, jedes weitere nur mit
/// Kürzel und Passwort eines aktiven Arztkontos. Niemand wird dabei angemeldet.
#[tauri::command]
pub fn register_account(
    state: State<AppState>, kuerzel: String, name: String, role: Role, password: String,
    approver_kuerzel: Option<String>, approver_password: Option<String>,
) -> Result<PublicAccount, String> {
    let (k, p) = (approver_kuerzel.unwrap_or_default(), approver_password.unwrap_or_default());
    state.accounts.lock().unwrap().register(&kuerzel, &name, role, &password, Some((&k, &p)))
}

#[tauri::command]
pub fn set_account_active(state: State<AppState>, kuerzel: String, active: bool) -> Result<(), String> {
    let by = require_arzt(&state)?;
    state.accounts.lock().unwrap().set_active(&kuerzel, active, &by)
}

#[tauri::command]
pub fn login(state: State<AppState>, kuerzel: String, password: String) -> Result<PublicAccount, String> {
    let user = state.accounts.lock().unwrap().attempt(&kuerzel, &password, std::time::Instant::now())?;
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

#[derive(serde::Serialize)]
pub struct AiStatus {
    config: crate::ai::AiConfig,
    models: Vec<&'static str>,
    key_present: bool,
    audit: Vec<crate::ai::AuditEntry>,
}

/// Zustand des KI-Assistenten: Einstellung, ob ein Schlüssel hinterlegt ist (nie der Schlüssel selbst), Protokoll.
#[tauri::command]
pub fn ai_status(state: State<AppState>) -> Result<AiStatus, String> {
    require_user(&state)?;
    Ok(AiStatus {
        config: state.config.lock().unwrap().ai.clone(),
        models: crate::ai::MODELS.to_vec(),
        key_present: state.keys.get()?.is_some(),
        audit: crate::ai::read_audit(&state.ai_audit_file, 10),
    })
}

/// Schlüssel hinterlegen (nur Arzt). Er verlässt Rust nie wieder in Richtung Fenster.
#[tauri::command]
pub fn ai_set_key(state: State<AppState>, key: String) -> Result<(), String> {
    require_arzt(&state)?;
    if !crate::ai::key_looks_valid(&key) {
        return Err("Das sieht nicht wie ein Claude-API-Schlüssel aus (beginnt mit „sk-ant-“).".into());
    }
    state.keys.set(key.trim())
}

#[tauri::command]
pub fn ai_delete_key(state: State<AppState>) -> Result<(), String> {
    require_arzt(&state)?;
    state.keys.delete()
}

#[derive(serde::Serialize)]
pub struct AiTestResult {
    ok: bool,
    model: String,
    answer: String,
    input_tokens: u64,
    output_tokens: u64,
}

/// Verbindungstest mit festem, synthetischem Text (Stufe 1 sendet nichts aus der Kartei). Nur Arzt.
#[tauri::command]
pub async fn ai_test(state: State<'_, AppState>) -> Result<AiTestResult, String> {
    let user = require_arzt(&state)?;
    let cfg = state.config.lock().unwrap().ai.clone();
    crate::ai::ensure_enabled(&cfg)?;
    let key = state.keys.get()?.ok_or("Kein Claude-API-Schlüssel hinterlegt.")?;
    let body = crate::ai::build_request(&cfg, crate::ai::TEST_TASK, crate::ai::TEST_DATA, 1024);
    let result = crate::ai::send(&crate::ai::Https, &cfg, &key, &body).await;
    let entry = crate::ai::AuditEntry {
        at: crate::ai::now_secs(), user: user.kuerzel.clone(), feature: "verbindungstest".into(), model: cfg.model.clone(),
        input_tokens: result.as_ref().map(|r| r.input_tokens).unwrap_or(0),
        output_tokens: result.as_ref().map(|r| r.output_tokens).unwrap_or(0),
        ok: result.is_ok(), note: result.as_ref().err().cloned().unwrap_or_default(),
    };
    crate::ai::append_audit(&state.ai_audit_file, &entry)?;
    let r = result?;
    Ok(AiTestResult { ok: true, model: cfg.model, answer: r.text.chars().take(200).collect(), input_tokens: r.input_tokens, output_tokens: r.output_tokens })
}

/// Schlüssel für einen anderen Rechner exportieren (nur Arzt): Rust verschlüsselt mit dem Transfer-Passwort
/// (Argon2id + AES-256-GCM) und schreibt die Datei an den Ort aus dem Speichern-Dialog. Der Schlüssel erreicht
/// das Fenster nie. `false` = Dialog abgebrochen.
#[tauri::command]
pub async fn ai_export_key(app: tauri::AppHandle, state: State<'_, AppState>, password: String) -> Result<bool, String> {
    use tauri_plugin_dialog::DialogExt;
    require_arzt(&state)?;
    crate::ai_transfer::check_password(&password)?;
    let key = zeroize::Zeroizing::new(state.keys.get()?.ok_or("Kein Claude-API-Schlüssel hinterlegt.")?);
    let sealed = tauri::async_runtime::spawn_blocking(move || crate::ai_transfer::seal(&key, &password))
        .await
        .map_err(|e| e.to_string())??;
    let ext = crate::ai_transfer::FILE_EXTENSION;
    let Some(target) = app.dialog().file()
        .set_title("KI-Schlüssel für die Praxis speichern")
        .set_file_name(format!("ki-schluessel.{ext}"))
        .add_filter("Praxis-Assistent KI-Schlüssel", &[ext])
        .blocking_save_file()
    else {
        return Ok(false);
    };
    let path = target.into_path().map_err(|_| "Speicherort nicht verfügbar.".to_string())?;
    std::fs::write(&path, sealed).map_err(|e| format!("Datei nicht speicherbar: {}", e.kind()))?;
    Ok(true)
}

/// Schlüssel aus einer Transferdatei übernehmen (nur Arzt): Rust liest die Datei aus dem Öffnen-Dialog,
/// entschlüsselt mit dem Transfer-Passwort und legt den Schlüssel in die Anmeldeinformationsverwaltung
/// dieses Windows-Benutzers. `false` = Dialog abgebrochen.
#[tauri::command]
pub async fn ai_import_key(app: tauri::AppHandle, state: State<'_, AppState>, password: String) -> Result<bool, String> {
    use tauri_plugin_dialog::DialogExt;
    require_arzt(&state)?;
    if password.is_empty() {
        return Err("Bitte das Transfer-Passwort eingeben.".into());
    }
    let ext = crate::ai_transfer::FILE_EXTENSION;
    let Some(source) = app.dialog().file()
        .set_title("KI-Schlüssel übernehmen")
        .add_filter("Praxis-Assistent KI-Schlüssel", &[ext])
        .blocking_pick_file()
    else {
        return Ok(false);
    };
    let path = source.into_path().map_err(|_| "Datei nicht verfügbar.".to_string())?;
    if std::fs::metadata(&path).map_err(|e| format!("Datei nicht lesbar: {}", e.kind()))?.len() > crate::ai_transfer::MAX_FILE_BYTES {
        return Err("Keine Schlüssel-Transferdatei.".into());
    }
    let content = std::fs::read_to_string(&path).map_err(|_| "Keine Schlüssel-Transferdatei.".to_string())?;
    let key = tauri::async_runtime::spawn_blocking(move || crate::ai_transfer::open(&content, &password))
        .await
        .map_err(|e| e.to_string())??;
    state.keys.set(&key)?;
    Ok(true)
}

#[derive(serde::Serialize)]
pub struct AiPreview {
    body: String,
    redactions: usize,
    truncated: bool,
    chars: usize,
}

/// „Was würde gesendet?“ – baut den Körper mit derselben Funktion wie der echte Aufruf, sendet aber nichts.
#[tauri::command]
pub fn ai_preview(state: State<AppState>, text: String) -> Result<AiPreview, String> {
    require_user(&state)?;
    let cfg = state.config.lock().unwrap().ai.clone();
    let (data, redactions, truncated) = crate::ai::minimize(&text);
    let body = crate::ai::build_request(&cfg, "Fakten aus dem Auszug als Vorschlag zusammenstellen (Stufe 2).", &data, 4096);
    Ok(AiPreview { chars: data.chars().count(), body: serde_json::to_string_pretty(&body).map_err(|e| e.to_string())?, redactions, truncated })
}

/// Praxisregeln lesen (jeder angemeldete Benutzer). `None` = noch keine Datei.
#[tauri::command]
pub fn rules_read(state: State<AppState>) -> Result<Option<String>, String> {
    require_user(&state)?;
    config::read_practice_rules(&config::practice_rules_file())
}

/// Praxisregeln speichern – nur Ärzte; das Fenster prüft Inhalt und Fassungen, Rust Form und Größe.
#[tauri::command]
pub fn rules_write(state: State<AppState>, json: String) -> Result<(), String> {
    require_arzt(&state)?;
    config::write_practice_rules(&config::practice_rules_file(), &json)
}

/// Tagesliste für den Tagesabschluss (nur Arzt): Pseudonym, Zeitpunkt, Arbeitsplatz, Kürzel – nie die Nummer.
/// Die Pseudonyme passen zur KVDT-Datei, die in derselben Programmsitzung gelesen wird.
#[tauri::command]
pub fn day_list(state: State<AppState>) -> Result<Vec<crate::daylist::DayView>, String> {
    require_arzt(&state)?;
    let mut list = state.daylist.lock().unwrap();
    let _ = list.expire(crate::ai::now_secs());
    let vault = state.vault.lock().unwrap();
    Ok(list.view(&vault))
}

/// Nach dem Tagesabschluss (nur Arzt): die geprüften Aufrufe (bis zum Zeitpunkt `upto` des zuletzt angezeigten) löschen.
/// Danach eingegangene Aufrufe bleiben stehen; ist die Liste leer, wird die Datei gelöscht.
#[tauri::command]
pub fn day_close(state: State<AppState>, upto: u64) -> Result<(), String> {
    require_arzt(&state)?;
    state.daylist.lock().unwrap().close_until(upto)
}

/// „Was wird gesendet?“ für die KI im Tagesabschluss – dieselbe Funktion wie die echte Anfrage, sendet nichts.
/// Stufe 2 ohne Freigabe: Fehler, es wird nicht einmal eine Vorschau gebaut.
#[tauri::command]
pub fn ai_day_preview(state: State<AppState>, request: crate::ai_day::DayAiRequest) -> Result<AiPreview, String> {
    require_arzt(&state)?;
    let cfg = state.config.lock().unwrap().ai.clone();
    let b = crate::ai_day::build_day_request(&cfg, &request)?;
    Ok(AiPreview { body: serde_json::to_string_pretty(&b.body).map_err(|e| e.to_string())?, redactions: b.redactions, truncated: b.truncated, chars: b.chars })
}

/// KI-Anfrage im Tagesabschluss (nur Arzt). Hauptschalter und Stufen-Freigabe prüft `ask_day`; Protokoll ohne Inhalt.
/// Die Antwort ist ein Vorschlag: das Fenster prüft ihn mit Motor und Katalog, er bleibt „unsicher“ bis zur Entscheidung.
#[tauri::command]
pub async fn ai_day_ask(state: State<'_, AppState>, request: crate::ai_day::DayAiRequest) -> Result<String, String> {
    let user = require_arzt(&state)?;
    let cfg = state.config.lock().unwrap().ai.clone();
    crate::ai::ensure_enabled(&cfg)?;
    let key = state.keys.get()?.ok_or("Kein Claude-API-Schlüssel hinterlegt.")?;
    let result = crate::ai_day::ask_day(&crate::ai::Https, &cfg, &key, &request).await;
    let entry = crate::ai::AuditEntry {
        at: crate::ai::now_secs(), user: user.kuerzel.clone(), feature: request.feature().into(), model: cfg.model.clone(),
        input_tokens: result.as_ref().map(|r| r.input_tokens).unwrap_or(0),
        output_tokens: result.as_ref().map(|r| r.output_tokens).unwrap_or(0),
        ok: result.is_ok(), note: result.as_ref().err().cloned().unwrap_or_default(),
    };
    crate::ai::append_audit(&state.ai_audit_file, &entry)?;
    Ok(result?.text)
}

/// KI-Stufe 2 freigeben (nur Arzt): nur wenn im Dialog AVV/DPA, ZDR und DSFA bestätigt wurden. Kürzel und Zeit werden gespeichert.
#[tauri::command]
pub fn ai_stage2_unlock(state: State<AppState>, avv: bool, zdr: bool, dsfa: bool) -> Result<AppConfig, String> {
    let user = require_arzt(&state)?;
    let approval = crate::ai_day::stage2_approval(&user.kuerzel, crate::ai::now_secs(), avv, zdr, dsfa)?;
    let mut cfg = state.config.lock().unwrap();
    cfg.ai.stage2 = Some(approval);
    save_config(&state.config_file, &cfg)?;
    Ok(cfg.clone())
}

/// KI-Stufe 2 wieder sperren (jeder Arzt).
#[tauri::command]
pub fn ai_stage2_lock(state: State<AppState>) -> Result<AppConfig, String> {
    require_arzt(&state)?;
    let mut cfg = state.config.lock().unwrap();
    cfg.ai.stage2 = None;
    save_config(&state.config_file, &cfg)?;
    Ok(cfg.clone())
}

#[tauri::command]
pub fn update_config(state: State<AppState>, patch: serde_json::Value) -> Result<AppConfig, String> {
    require_arzt(&state)?;
    let mut cfg = state.config.lock().unwrap();
    let mut value = serde_json::to_value(&*cfg).map_err(|e| e.to_string())?;
    config::merge(&mut value, &patch);
    let mut next: AppConfig = serde_json::from_value(value).map_err(|e| format!("Ungültige Einstellung: {e}"))?;
    // Die Freigabe der KI-Stufe 2 ändert nur der eigene Dialog (ai_stage2_unlock/-lock), nie die allgemeine Einstellung.
    next.ai.stage2 = cfg.ai.stage2.clone();
    crate::ai::validate_config(&next.ai)?;
    config::validate_region(&next)?;
    *cfg = next;
    save_config(&state.config_file, &cfg)?;
    Ok(cfg.clone())
}
