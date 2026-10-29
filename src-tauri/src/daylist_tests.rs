use crate::daylist::{file_name, DayList, Dpapi, Protector, KEEP_SECS, MAX_ENTRIES};
use crate::patient::{make_line, PatientVault};
use std::fs;
use std::path::PathBuf;

/// Synthetische Patientennummer (erfunden).
const NR: &str = "TEST_77001";
const T0: u64 = 1_793_260_800; // 29.10.2026, 08:00 UTC

fn tmpfile(tag: &str) -> (PathBuf, PathBuf) {
    let nanos = std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).unwrap().as_nanos();
    let dir = std::env::temp_dir().join(format!("praxis-tag-{tag}-{nanos}"));
    (dir.join(file_name("PC07")), dir)
}

/// Speichern scheitert immer – Meldungen dürfen trotzdem keine Nummer enthalten.
struct Broken;
impl Protector for Broken {
    fn protect(&self, _: &[u8]) -> Result<Vec<u8>, String> {
        Err("Tagesliste konnte nicht verschlüsselt werden.".into())
    }
    fn unprotect(&self, _: &[u8]) -> Result<Vec<u8>, String> {
        Err("Tagesliste konnte nicht entschlüsselt werden.".into())
    }
}

fn contains(hay: &[u8], needle: &str) -> bool {
    let utf16: Vec<u8> = needle.encode_utf16().flat_map(u16::to_le_bytes).collect();
    hay.windows(needle.len()).any(|w| w == needle.as_bytes()) || hay.windows(utf16.len()).any(|w| w == utf16.as_slice())
}

/// PRIV-10: Die Nummer liegt nie im Klartext auf der Platte; nach einem Neustart ist die Liste wieder da.
#[cfg(windows)]
#[test]
fn priv10_datei_nur_verschluesselt_und_neustart() {
    let (file, dir) = tmpfile("dpapi");
    let (mut list, warn) = DayList::open(Some(file.clone()), Box::new(Dpapi), T0);
    assert!(warn.is_none());
    list.record(NR, T0, "PC07", "AL").unwrap();
    let raw = fs::read(&file).unwrap();
    assert!(!contains(&raw, NR) && !contains(&raw, "PC07") && !contains(&raw, "tagesliste-1"));
    assert!(!dir.read_dir().unwrap().any(|e| e.unwrap().path().extension().map(|x| x == "tmp").unwrap_or(false)));
    let (again, warn) = DayList::open(Some(file.clone()), Box::new(Dpapi), T0 + 60);
    assert!(warn.is_none());
    assert_eq!(again.len(), 1);
    let vault = PatientVault::new();
    assert_eq!(again.view(&vault)[0].token, vault.pseudonym(NR));
    let _ = fs::remove_dir_all(dir);
}

/// PRIV-11: Das Fenster sieht Pseudonym, Zeit, Arbeitsplatz und Kürzel – nie die Nummer.
#[test]
fn priv11_fenster_sieht_nur_pseudonym() {
    let (mut list, _) = DayList::open(None, Box::new(Dpapi), T0);
    list.record(NR, T0, "PC07", "AL").unwrap();
    let vault = PatientVault::new();
    let json = serde_json::to_string(&list.view(&vault)).unwrap();
    assert!(!json.contains(NR));
    assert!(json.contains(&vault.pseudonym(NR)) && json.contains("PC07") && json.contains("\"AL\""));
    assert!(json.contains(&T0.to_string()));
}

/// PRIV-12: Pseudonym der Tagesliste = Pseudonym derselben Nummer in der KVDT-Datei (gleiche Programmsitzung).
#[test]
fn priv12_pseudonym_passt_zur_kvdt_datei() {
    let (mut list, _) = DayList::open(None, Box::new(Dpapi), T0);
    list.record(&format!(" {NR} "), T0, "PC07", "AL").unwrap();
    let vault = PatientVault::new();
    let kvdt = [make_line("8000", b"0101"), make_line("3000", NR.as_bytes()), make_line("5000", b"29102026"), make_line("5001", b"03000")].concat();
    let text = String::from_utf8(vault.sanitize_many(&kvdt).data).unwrap();
    assert!(text.contains(&list.view(&vault)[0].token));
}

/// PRIV-13: Nummer nie in Debug-Ausgaben (Absturzmeldungen, Protokolle) und nie in Fehlermeldungen.
#[test]
fn priv13_keine_nummer_in_debug_und_meldungen() {
    let (file, dir) = tmpfile("broken");
    let (mut list, _) = DayList::open(Some(file.clone()), Box::new(Broken), T0);
    let err = list.record(NR, T0, "PC07", "AL").unwrap_err();
    assert!(!err.contains(NR));
    assert_eq!(list.len(), 1, "bleibt im Arbeitsspeicher");
    assert!(!file.exists());
    assert!(!format!("{list:?}").contains(NR));
    let _ = fs::remove_dir_all(dir);
}

/// PRIV-14: Löschung spätestens 24 Stunden nach dem Aufruf – im Speicher und auf der Platte.
#[cfg(windows)]
#[test]
fn priv14_loeschung_nach_24_stunden() {
    let (file, dir) = tmpfile("frist");
    let (mut list, _) = DayList::open(Some(file.clone()), Box::new(Dpapi), T0);
    list.record(NR, T0, "PC07", "AL").unwrap();
    list.record("TEST_77002", T0 + 3600, "PC07", "AL").unwrap();
    list.expire(T0 + KEEP_SECS - 1).unwrap();
    assert_eq!(list.len(), 2);
    list.expire(T0 + KEEP_SECS).unwrap();
    assert_eq!(list.len(), 1);
    list.expire(T0 + 3600 + KEEP_SECS).unwrap();
    assert_eq!(list.len(), 0);
    assert!(!file.exists());
    // Auch beim Programmstart: Abgelaufenes wird nicht wieder geladen.
    list.record(NR, T0, "PC07", "AL").unwrap();
    let (again, _) = DayList::open(Some(file.clone()), Box::new(Dpapi), T0 + KEEP_SECS + 1);
    assert_eq!(again.len(), 0);
    assert!(!file.exists());
    let _ = fs::remove_dir_all(dir);
}

/// PRIV-15: Nach dem Tagesabschluss ist alles weg.
#[cfg(windows)]
#[test]
fn priv15_loeschung_nach_tagesabschluss() {
    let (file, dir) = tmpfile("abschluss");
    let (mut list, _) = DayList::open(Some(file.clone()), Box::new(Dpapi), T0);
    list.record(NR, T0, "PC07", "AL").unwrap();
    list.record("TEST_77002", T0 + 600, "PC07", "AL").unwrap();
    // Abschluss mit Stand 08:00: der spätere Aufruf (noch nicht angezeigt) bleibt.
    list.close_until(T0).unwrap();
    assert_eq!(list.len(), 1);
    assert!(file.exists());
    list.close_until(T0 + 600).unwrap();
    assert_eq!(list.len(), 0);
    assert!(!file.exists());
    let _ = fs::remove_dir_all(dir);
}

/// PRIV-16: Fremde oder beschädigte Datei wird nicht gelesen, sondern gelöscht (Hinweis ohne Inhalt).
#[test]
fn priv16_defekte_datei_wird_geloescht() {
    let (file, dir) = tmpfile("defekt");
    fs::create_dir_all(&dir).unwrap();
    fs::write(&file, format!("{{\"format\":\"tagesliste-1\",\"entries\":[{{\"id\":\"{NR}\"}}]}}")).unwrap();
    let (list, warn) = DayList::open(Some(file.clone()), Box::new(Dpapi), T0);
    assert_eq!(list.len(), 0);
    let warn = warn.unwrap();
    assert!(warn.starts_with("Tagesliste verworfen") && !warn.contains(NR));
    assert!(!file.exists());
    let _ = fs::remove_dir_all(dir);
}

#[test]
fn leere_nummer_wird_nicht_gemerkt_und_liste_begrenzt() {
    let (mut list, _) = DayList::open(None, Box::new(Dpapi), T0);
    list.record("  ", T0, "PC07", "AL").unwrap();
    assert_eq!(list.len(), 0);
    for i in 0..MAX_ENTRIES + 5 {
        list.record(&format!("TEST_{i}"), T0, "PC07", "AL").unwrap();
    }
    assert_eq!(list.len(), MAX_ENTRIES);
    let vault = PatientVault::new();
    assert_eq!(list.view(&vault)[0].token, vault.pseudonym("TEST_5"), "älteste zuerst verworfen");
}

#[test]
fn aufruf_weit_in_der_zukunft_wird_verworfen() {
    let (mut list, _) = DayList::open(None, Box::new(Dpapi), T0);
    list.record(NR, T0 + 3600, "PC07", "AL").unwrap();
    list.expire(T0).unwrap();
    assert_eq!(list.len(), 0);
}

#[test]
fn dateiname_ohne_pfadzeichen() {
    assert_eq!(file_name("PC07"), "tagesliste-PC07.dat");
    assert_eq!(file_name("..\\x/y"), "tagesliste-___x_y.dat");
    assert_eq!(file_name(""), "tagesliste-PC.dat");
}
