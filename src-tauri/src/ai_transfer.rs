//! Übertragung des Claude-API-Schlüssels zwischen Rechnern (z. B. von zu Hause auf den Praxisserver).
//! Die Windows-Anmeldeinformationsverwaltung ist an Benutzer und Rechner gebunden (DPAPI) – der Schlüssel
//! wandert deshalb nur als passwortverschlüsselte Datei: Argon2id leitet aus dem Transfer-Passwort einen
//! 256-Bit-Schlüssel ab, AES-256-GCM verschlüsselt und schützt die Kopfdaten (Parameter, Salt) gegen Änderung.
//! Die Datei enthält weder den Schlüssel noch das Passwort im Klartext; beim Import landet der Schlüssel
//! direkt wieder in der Anmeldeinformationsverwaltung, nie im Fenster, in einer Datei oder im Protokoll.

use aes_gcm::aead::{Aead, KeyInit, Payload};
use aes_gcm::{Aes256Gcm, Nonce};
use argon2::{Algorithm, Argon2, Params, Version};
use serde::{Deserialize, Serialize};
use zeroize::Zeroizing;

pub const FORMAT: &str = "praxis-assistent-ki-schluessel";
pub const VERSION: u32 = 1;
pub const FILE_EXTENSION: &str = "praxiskey";
/// Mindestlänge des Transfer-Passworts (die Datei kann offline angegriffen werden).
pub const MIN_PASSWORD_CHARS: usize = 12;
/// Größer ist eine Transferdatei nie – größere Dateien werden nicht gelesen.
pub const MAX_FILE_BYTES: u64 = 4096;
/// Argon2id beim Export: 64 MiB, 3 Durchläufe (einmalige Aktion, darf eine halbe Sekunde dauern).
pub const EXPORT_MEMORY_KIB: u32 = 64 * 1024;
pub const EXPORT_ITERATIONS: u32 = 3;
/// Beim Import angenommene Grenzen: schwächere Dateien werden abgelehnt, extreme Werte auch (Speicherschutz).
const MIN_MEMORY_KIB: u32 = 19 * 1024;
const MAX_MEMORY_KIB: u32 = 256 * 1024;
const MIN_ITERATIONS: u32 = 2;
const MAX_ITERATIONS: u32 = 10;
const SALT_BYTES: usize = 16;
const NONCE_BYTES: usize = 12;

const WRONG: &str = "Transfer-Passwort falsch oder Datei beschädigt.";

#[derive(Debug, Serialize, Deserialize, Clone, PartialEq)]
pub struct TransferFile {
    pub format: String,
    pub version: u32,
    pub kdf: String,
    pub memory_kib: u32,
    pub iterations: u32,
    pub parallelism: u32,
    pub salt: String,
    pub nonce: String,
    pub ciphertext: String,
}

impl TransferFile {
    /// Zusätzlich authentifizierte Daten: jede Änderung an Format, Parametern oder Salt lässt die Entschlüsselung scheitern.
    fn aad(&self) -> String {
        format!("{}|{}|{}|m={}|t={}|p={}|{}", self.format, self.version, self.kdf, self.memory_kib, self.iterations, self.parallelism, self.salt)
    }
}

pub fn check_password(password: &str) -> Result<(), String> {
    if password.chars().count() < MIN_PASSWORD_CHARS {
        return Err(format!("Transfer-Passwort: mindestens {MIN_PASSWORD_CHARS} Zeichen."));
    }
    Ok(())
}

fn derive(password: &str, salt: &[u8], memory_kib: u32, iterations: u32, parallelism: u32) -> Result<Zeroizing<[u8; 32]>, String> {
    let params = Params::new(memory_kib, iterations, parallelism, Some(32)).map_err(|_| WRONG.to_string())?;
    let mut out = Zeroizing::new([0u8; 32]);
    Argon2::new(Algorithm::Argon2id, Version::V0x13, params)
        .hash_password_into(password.as_bytes(), salt, out.as_mut())
        .map_err(|_| WRONG.to_string())?;
    Ok(out)
}

fn random<const N: usize>() -> Result<[u8; N], String> {
    let mut b = [0u8; N];
    getrandom::getrandom(&mut b).map_err(|_| "Zufallszahlen nicht verfügbar.".to_string())?;
    Ok(b)
}

fn hex(bytes: &[u8]) -> String {
    bytes.iter().map(|b| format!("{b:02x}")).collect()
}

fn unhex(s: &str) -> Result<Vec<u8>, String> {
    if s.len() % 2 != 0 || !s.bytes().all(|b| b.is_ascii_hexdigit()) {
        return Err(WRONG.into());
    }
    (0..s.len()).step_by(2).map(|i| u8::from_str_radix(&s[i..i + 2], 16).map_err(|_| WRONG.to_string())).collect()
}

/// Verschlüsselt den Schlüssel mit dem Transfer-Passwort. Ergebnis: Inhalt der Transferdatei (JSON).
pub fn seal(api_key: &str, password: &str) -> Result<String, String> {
    seal_with(api_key, password, EXPORT_MEMORY_KIB, EXPORT_ITERATIONS)
}

fn seal_with(api_key: &str, password: &str, memory_kib: u32, iterations: u32) -> Result<String, String> {
    if !crate::ai::key_looks_valid(api_key) {
        return Err("Der hinterlegte Schlüssel hat kein gültiges Format.".into());
    }
    check_password(password)?;
    let salt = random::<SALT_BYTES>()?;
    let nonce = random::<NONCE_BYTES>()?;
    let mut file = TransferFile {
        format: FORMAT.into(), version: VERSION, kdf: "argon2id".into(),
        memory_kib, iterations, parallelism: 1, salt: hex(&salt), nonce: hex(&nonce), ciphertext: String::new(),
    };
    let key = derive(password, &salt, memory_kib, iterations, 1)?;
    let aad = file.aad();
    let sealed = Aes256Gcm::new_from_slice(key.as_ref())
        .map_err(|_| WRONG.to_string())?
        .encrypt(Nonce::from_slice(&nonce), Payload { msg: api_key.trim().as_bytes(), aad: aad.as_bytes() })
        .map_err(|_| "Verschlüsselung fehlgeschlagen.".to_string())?;
    file.ciphertext = hex(&sealed);
    serde_json::to_string_pretty(&file).map_err(|e| e.to_string())
}

/// Entschlüsselt eine Transferdatei. Falsches Passwort, veränderte oder zu schwache Dateien → Fehler ohne Inhalt.
pub fn open(content: &str, password: &str) -> Result<Zeroizing<String>, String> {
    if content.len() as u64 > MAX_FILE_BYTES {
        return Err("Keine Schlüssel-Transferdatei.".into());
    }
    let file: TransferFile = serde_json::from_str(content).map_err(|_| "Keine Schlüssel-Transferdatei.".to_string())?;
    if file.format != FORMAT || file.kdf != "argon2id" {
        return Err("Keine Schlüssel-Transferdatei.".into());
    }
    if file.version != VERSION {
        return Err("Transferdatei aus einer anderen Programmversion – bitte neu exportieren.".into());
    }
    if !(MIN_MEMORY_KIB..=MAX_MEMORY_KIB).contains(&file.memory_kib)
        || !(MIN_ITERATIONS..=MAX_ITERATIONS).contains(&file.iterations)
        || !(1..=4).contains(&file.parallelism)
    {
        return Err("Transferdatei mit unzulässigen Schutzparametern.".into());
    }
    let salt = unhex(&file.salt)?;
    let nonce = unhex(&file.nonce)?;
    if salt.len() != SALT_BYTES || nonce.len() != NONCE_BYTES {
        return Err(WRONG.into());
    }
    let key = derive(password, &salt, file.memory_kib, file.iterations, file.parallelism)?;
    let aad = file.aad();
    let plain = Aes256Gcm::new_from_slice(key.as_ref())
        .map_err(|_| WRONG.to_string())?
        .decrypt(Nonce::from_slice(&nonce), Payload { msg: &unhex(&file.ciphertext)?, aad: aad.as_bytes() })
        .map(Zeroizing::new)
        .map_err(|_| WRONG.to_string())?;
    let api_key = Zeroizing::new(String::from_utf8(plain.to_vec()).map_err(|_| WRONG.to_string())?);
    if !crate::ai::key_looks_valid(&api_key) {
        return Err("Die Datei enthält keinen gültigen Claude-API-Schlüssel.".into());
    }
    Ok(api_key)
}

#[cfg(test)]
pub(crate) fn seal_for_test(api_key: &str, password: &str, memory_kib: u32, iterations: u32) -> Result<String, String> {
    seal_with(api_key, password, memory_kib, iterations)
}
