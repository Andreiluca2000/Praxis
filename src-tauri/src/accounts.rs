//! Benutzerkonten (Arzt / MFA) mit Kürzel. Passwort nur als Argon2id-Hash.
//! Die Datei liegt praxisweit (ProgramData auf dem Terminalserver), damit das Kürzel überall gleich ist.

use argon2::password_hash::{rand_core::OsRng, PasswordHash, PasswordHasher, PasswordVerifier, SaltString};
use argon2::Argon2;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::fs;
use std::path::{Path, PathBuf};
use std::time::{Duration, Instant};

/// Nach so vielen Fehlversuchen je Kürzel wird gesperrt; jede weitere Fehleingabe verdoppelt die Sperre.
pub const FREE_ATTEMPTS: u32 = 5;
pub const FIRST_LOCK: Duration = Duration::from_secs(30);
pub const MAX_LOCK: Duration = Duration::from_secs(15 * 60);

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum Role {
    Arzt,
    Mfa,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
struct Account {
    kuerzel: String,
    name: String,
    role: Role,
    hash: String,
    active: bool,
    #[serde(rename = "createdAt")]
    created_at: String,
}

/// Was die Oberfläche sehen darf (ohne Hash).
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct PublicAccount {
    pub kuerzel: String,
    pub name: String,
    pub role: Role,
    pub active: bool,
    #[serde(rename = "createdAt")]
    pub created_at: String,
}

impl From<&Account> for PublicAccount {
    fn from(a: &Account) -> Self {
        PublicAccount { kuerzel: a.kuerzel.clone(), name: a.name.clone(), role: a.role, active: a.active, created_at: a.created_at.clone() }
    }
}

pub struct AccountStore {
    file: PathBuf,
    accounts: Vec<Account>,
    /// Fehlversuche je Kürzel (nur im Arbeitsspeicher dieser Programminstanz): Anzahl und Sperre bis.
    failures: HashMap<String, (u32, Option<Instant>)>,
}

fn now_stamp() -> String {
    let secs = std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).map(|d| d.as_secs()).unwrap_or(0);
    format!("unix:{secs}")
}

fn valid_kuerzel(k: &str) -> bool {
    (1..=6).contains(&k.chars().count()) && k.chars().all(|c| c.is_alphabetic())
}

impl AccountStore {
    pub fn open(file: &Path) -> Result<Self, String> {
        let accounts = if file.exists() {
            let text = fs::read_to_string(file).map_err(|e| format!("Konten nicht lesbar: {e}"))?;
            serde_json::from_str(&text).map_err(|e| format!("Kontendatei beschädigt: {e}"))?
        } else {
            Vec::new()
        };
        Ok(AccountStore { file: file.to_path_buf(), accounts, failures: HashMap::new() })
    }

    /// Speichert die neue Fassung; erst danach gilt sie auch im Speicher (kein Konto, das nur bis zum Neustart lebt).
    fn commit(&mut self, accounts: Vec<Account>) -> Result<(), String> {
        let failed = |e: std::io::Error| match e.kind() {
            // Auf dem Server dürfen nur Administratoren die Kontendatei ändern (scripts/server-einrichten.ps1).
            std::io::ErrorKind::PermissionDenied => {
                "Konten können nur mit Administratorrechten geändert werden (Programm per Rechtsklick „Als Administrator ausführen“).".to_string()
            }
            _ => format!("Konten nicht speicherbar: {e}"),
        };
        if let Some(dir) = self.file.parent() {
            fs::create_dir_all(dir).map_err(failed)?;
        }
        let tmp = self.file.with_extension("tmp");
        let json = serde_json::to_string_pretty(&accounts).map_err(|e| e.to_string())?;
        fs::write(&tmp, json).map_err(failed)?;
        fs::rename(&tmp, &self.file).map_err(failed)?;
        self.accounts = accounts;
        Ok(())
    }

    pub fn is_empty(&self) -> bool {
        self.accounts.is_empty()
    }

    pub fn list(&self) -> Vec<PublicAccount> {
        self.accounts.iter().map(PublicAccount::from).collect()
    }

    /// Erstes Konto muss ein Arzt sein; danach legen nur aktive Ärzte Konten an.
    pub fn create(&mut self, kuerzel: &str, name: &str, role: Role, password: &str, by: Option<&PublicAccount>) -> Result<PublicAccount, String> {
        let kuerzel = kuerzel.trim().to_uppercase();
        if !valid_kuerzel(&kuerzel) {
            return Err("Kürzel: 1–6 Buchstaben.".into());
        }
        if name.trim().is_empty() {
            return Err("Name fehlt.".into());
        }
        if password.chars().count() < 8 {
            return Err("Passwort: mindestens 8 Zeichen.".into());
        }
        if self.accounts.iter().any(|a| a.kuerzel == kuerzel) {
            return Err(format!("Kürzel {kuerzel} ist bereits vergeben."));
        }
        if self.is_empty() {
            if role != Role::Arzt {
                return Err("Das erste Konto muss ein Arztkonto sein.".into());
            }
        } else if !matches!(by, Some(u) if u.active && u.role == Role::Arzt) {
            return Err("Nur Ärzte dürfen Konten anlegen.".into());
        }
        let salt = SaltString::generate(&mut OsRng);
        let hash = Argon2::default().hash_password(password.as_bytes(), &salt).map_err(|e| e.to_string())?.to_string();
        let account = Account { kuerzel, name: name.trim().into(), role, hash, active: true, created_at: now_stamp() };
        let public = PublicAccount::from(&account);
        let mut next = self.accounts.clone();
        next.push(account);
        self.commit(next)?;
        Ok(public)
    }

    /// Registrierung vom Anmeldebildschirm: erstes Konto ohne Freigabe, danach nur mit Kürzel und Passwort
    /// eines aktiven Arztkontos (`approver`). Meldet niemanden an.
    pub fn register(&mut self, kuerzel: &str, name: &str, role: Role, password: &str, approver: Option<(&str, &str)>) -> Result<PublicAccount, String> {
        let by = if self.is_empty() {
            None
        } else {
            let (k, p) = approver.unwrap_or(("", ""));
            let a = self.attempt(k, p, Instant::now()).map_err(|e| format!("Freigabe: {e}"))?;
            if a.role != Role::Arzt {
                return Err("Die Freigabe ist nur durch ein Arztkonto möglich.".into());
            }
            Some(a)
        };
        self.create(kuerzel, name, role, password, by.as_ref())
    }

    /// Anmeldung mit Sperre nach wiederholten Fehlversuchen (gilt auch für unbekannte Kürzel, damit
    /// sich vorhandene nicht an der Antwort erkennen lassen). `now` ist für Tests einstellbar.
    pub fn attempt(&mut self, kuerzel: &str, password: &str, now: Instant) -> Result<PublicAccount, String> {
        let key = kuerzel.trim().to_uppercase();
        if let Some((_, Some(until))) = self.failures.get(&key) {
            if *until > now {
                let secs = (*until - now).as_secs().max(1);
                return Err(format!("Zu viele Fehlversuche – bitte in {secs} s erneut versuchen."));
            }
        }
        match self.login(&key, password) {
            Some(user) => {
                self.failures.remove(&key);
                Ok(user)
            }
            None => {
                let entry = self.failures.entry(key).or_insert((0, None));
                entry.0 += 1;
                if entry.0 >= FREE_ATTEMPTS {
                    let lock = FIRST_LOCK.saturating_mul(1u32 << (entry.0 - FREE_ATTEMPTS).min(10)).min(MAX_LOCK);
                    entry.1 = Some(now + lock);
                }
                Err("Kürzel oder Passwort falsch.".into())
            }
        }
    }

    pub fn login(&self, kuerzel: &str, password: &str) -> Option<PublicAccount> {
        let k = kuerzel.trim().to_uppercase();
        let account = self.accounts.iter().find(|a| a.kuerzel == k && a.active)?;
        let parsed = PasswordHash::new(&account.hash).ok()?;
        Argon2::default().verify_password(password.as_bytes(), &parsed).ok()?;
        Some(PublicAccount::from(account))
    }

    pub fn set_active(&mut self, kuerzel: &str, active: bool, by: &PublicAccount) -> Result<(), String> {
        if !(by.active && by.role == Role::Arzt) {
            return Err("Keine Berechtigung.".into());
        }
        let active_doctors = self.accounts.iter().filter(|a| a.role == Role::Arzt && a.active).count();
        let mut next = self.accounts.clone();
        let account = next.iter_mut().find(|a| a.kuerzel == kuerzel).ok_or("Konto nicht gefunden.")?;
        if !active && account.role == Role::Arzt && account.active && active_doctors == 1 {
            return Err("Das letzte aktive Arztkonto kann nicht deaktiviert werden.".into());
        }
        account.active = active;
        self.commit(next)
    }
}
