//! Benutzerkonten (Arzt / MFA) mit Kürzel. Passwort nur als Argon2id-Hash.
//! Die Datei liegt praxisweit (ProgramData auf dem Terminalserver), damit das Kürzel überall gleich ist.

use argon2::password_hash::{rand_core::OsRng, PasswordHash, PasswordHasher, PasswordVerifier, SaltString};
use argon2::Argon2;
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::{Path, PathBuf};

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
        Ok(AccountStore { file: file.to_path_buf(), accounts })
    }

    fn save(&self) -> Result<(), String> {
        if let Some(dir) = self.file.parent() {
            fs::create_dir_all(dir).map_err(|e| e.to_string())?;
        }
        let tmp = self.file.with_extension("tmp");
        let json = serde_json::to_string_pretty(&self.accounts).map_err(|e| e.to_string())?;
        fs::write(&tmp, json).map_err(|e| format!("Konten nicht speicherbar: {e}"))?;
        fs::rename(&tmp, &self.file).map_err(|e| format!("Konten nicht speicherbar: {e}"))
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
        self.accounts.push(account);
        self.save()?;
        Ok(public)
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
        let account = self.accounts.iter_mut().find(|a| a.kuerzel == kuerzel).ok_or("Konto nicht gefunden.")?;
        if !active && account.role == Role::Arzt && account.active && active_doctors == 1 {
            return Err("Das letzte aktive Arztkonto kann nicht deaktiviert werden.".into());
        }
        account.active = active;
        self.save()
    }
}
