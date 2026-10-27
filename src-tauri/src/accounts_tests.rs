use crate::accounts::{AccountStore, Role};
use std::fs;
use std::path::PathBuf;

fn tmpfile(tag: &str) -> (PathBuf, PathBuf) {
    let nanos = std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).unwrap().as_nanos();
    let dir = std::env::temp_dir().join(format!("praxis-acc-{tag}-{nanos}"));
    (dir.join("konten.json"), dir)
}

#[test]
fn erstes_konto_arzt_und_rechte() {
    let (file, dir) = tmpfile("rechte");
    let mut s = AccountStore::open(&file).unwrap();
    assert!(s.create("mf", "MFA", Role::Mfa, "geheim123", None).is_err());
    let al = s.create("al", "Dr. Test", Role::Arzt, "geheim123", None).unwrap();
    assert_eq!(al.kuerzel, "AL");
    let mfa = s.create("MF", "MFA", Role::Mfa, "geheim456", Some(&al)).unwrap();
    assert!(s.create("XY", "X", Role::Mfa, "geheim789", Some(&mfa)).is_err());
    assert!(s.create("al", "Doppelt", Role::Mfa, "geheim123", Some(&al)).is_err());
    assert!(s.create("A1", "Ziffer", Role::Mfa, "geheim123", Some(&al)).is_err());
    let _ = fs::remove_dir_all(dir);
}

#[test]
fn passwort_nur_als_hash_und_login() {
    let (file, dir) = tmpfile("login");
    let mut s = AccountStore::open(&file).unwrap();
    s.create("AL", "Dr. Test", Role::Arzt, "geheim123", None).unwrap();
    let text = fs::read_to_string(&file).unwrap();
    assert!(!text.contains("geheim123"));
    assert!(text.contains("$argon2id$"));
    assert_eq!(s.login("al", "geheim123").unwrap().kuerzel, "AL");
    assert!(s.login("AL", "falsch999").is_none());
    assert!(s.login("ZZ", "geheim123").is_none());
    let reopened = AccountStore::open(&file).unwrap();
    assert!(reopened.login("AL", "geheim123").is_some());
    let _ = fs::remove_dir_all(dir);
}

#[test]
fn letzter_arzt_bleibt_aktiv_und_deaktivierte_koennen_nicht_anmelden() {
    let (file, dir) = tmpfile("aktiv");
    let mut s = AccountStore::open(&file).unwrap();
    let al = s.create("AL", "Dr. Test", Role::Arzt, "geheim123", None).unwrap();
    assert!(s.set_active("AL", false, &al).is_err());
    s.create("MF", "MFA", Role::Mfa, "geheim456", Some(&al)).unwrap();
    s.set_active("MF", false, &al).unwrap();
    assert!(s.login("MF", "geheim456").is_none());
    let _ = fs::remove_dir_all(dir);
}

/// DS-02: Darf die Kontendatei nicht geändert werden, entsteht auch im Speicher kein Konto.
#[test]
fn schreibgeschuetzte_kontendatei_kein_konto_im_speicher() {
    let (file, dir) = tmpfile("ro");
    fs::create_dir_all(&dir).unwrap();
    fs::write(&file, "[]").unwrap();
    let mut perm = fs::metadata(&file).unwrap().permissions();
    perm.set_readonly(true);
    fs::set_permissions(&file, perm.clone()).unwrap();
    let mut s = AccountStore::open(&file).unwrap();
    let err = s.create("al", "Dr. Test", Role::Arzt, "geheim123", None).unwrap_err();
    assert!(err.contains("Administratorrechten"), "{err}");
    assert!(s.is_empty() && s.login("AL", "geheim123").is_none());
    perm.set_readonly(false);
    fs::set_permissions(&file, perm).unwrap();
    let _ = fs::remove_dir_all(dir);
}

/// Registrierung vom Anmeldebildschirm: erstes Konto frei, weitere nur mit gültiger Arzt-Freigabe.
#[test]
fn registrierung_nur_mit_arzt_freigabe() {
    let (file, dir) = tmpfile("reg");
    let mut s = AccountStore::open(&file).unwrap();
    assert!(s.register("mf", "MFA", Role::Mfa, "geheim123", None).is_err()); // erstes Konto muss Arzt sein
    s.register("al", "Dr. Test", Role::Arzt, "geheim123", None).unwrap();
    assert!(s.register("mf", "MFA", Role::Mfa, "geheim456", None).is_err());
    assert!(s.register("mf", "MFA", Role::Mfa, "geheim456", Some(("AL", "falsch!!"))).unwrap_err().contains("Freigabe"));
    s.register("mf", "MFA", Role::Mfa, "geheim456", Some(("al", "geheim123"))).unwrap();
    // Eine MFA darf nicht freigeben.
    assert!(s.register("xy", "X", Role::Mfa, "geheim789", Some(("MF", "geheim456"))).unwrap_err().contains("Arztkonto"));
    assert!(s.login("MF", "geheim456").is_some());
    let _ = fs::remove_dir_all(dir);
}
