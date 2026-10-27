use crate::patient::{make_line, redact, PatientVault};

fn bdt(id: &str) -> Vec<u8> {
    [
        make_line("8000", b"6200"), make_line("3000", id.as_bytes()), make_line("3101", b"Mustermann"),
        make_line("3103", b"01011970"), make_line("5000", b"12112026"), make_line("6220", "Übelkeit".as_bytes()),
    ]
    .concat()
}

#[test]
fn bereinigt_identitaet_und_pseudonymisiert() {
    let mut v = PatientVault::new();
    let s = v.sanitize(&bdt("99001"));
    let text = String::from_utf8_lossy(&s.data).to_string();
    assert!(!text.contains("Mustermann") && !text.contains("01011970") && !text.contains("99001"));
    assert_eq!(s.dropped, 2);
    assert_eq!(s.patient_ids, 1);
    assert!(text.contains(s.token.as_deref().unwrap()));
    let line = text.lines().find(|l| &l[3..7] == "3000").unwrap();
    assert_eq!(line[..3].parse::<usize>().unwrap(), line.len() + 2);
}

#[test]
fn gleiche_nummer_gleiches_pseudonym_neue_instanz_anderes() {
    let a = PatientVault::new();
    assert_eq!(a.pseudonym("99001"), a.pseudonym(" 99001 "));
    assert_ne!(a.pseudonym("99001"), PatientVault::new().pseudonym("99001"));
}

#[test]
fn mehrere_patienten_kein_token() {
    let mut v = PatientVault::new();
    let s = v.sanitize(&[bdt("99001"), bdt("99002")].concat());
    assert_eq!(s.patient_ids, 2);
    assert!(s.token.is_none());
}

#[test]
fn ausgang_bekommt_echte_nummer_und_richtige_satzlaenge() {
    let mut v = PatientVault::new();
    let t = v.sanitize(&bdt("99001")).token.unwrap();
    let out = [make_line("8000", b"6310"), make_line("8100", b"00000"), make_line("3000", t.as_bytes()), make_line("6228", b"Text")].concat();
    let real = v.restore(&out, &t).unwrap();
    let text = String::from_utf8_lossy(&real).to_string();
    assert!(text.contains("99001") && !text.contains(&t));
    let len8100: usize = text.lines().find(|l| &l[3..7] == "8100").unwrap()[7..].parse().unwrap();
    assert_eq!(len8100, real.len());
}

#[test]
fn ausgang_gesperrt_bei_fremdem_oder_geschlossenem_patienten() {
    let mut v = PatientVault::new();
    let t = v.sanitize(&bdt("99001")).token.unwrap();
    let other = v.pseudonym("99002");
    assert!(v.restore(&[make_line("8000", b"6310"), make_line("3000", other.as_bytes())].concat(), &t).is_err());
    v.close();
    assert!(v.restore(&[make_line("8000", b"6310"), make_line("3000", t.as_bytes())].concat(), &t).is_err());
}

#[test]
fn kvdt_viele_patienten_je_eigenes_pseudonym() {
    let v = PatientVault::new();
    let s = v.sanitize_many(&[bdt("99001"), bdt("99002"), bdt("99001")].concat());
    let text = String::from_utf8_lossy(&s.data).to_string();
    assert_eq!(s.patient_ids, 2);
    assert_eq!(s.dropped, 6);
    assert_eq!(s.unknown, 3); // 6220 Freitext gehört nicht zur Quartalsprüfung
    assert!(!text.contains("Übelkeit"));
    assert!(!text.contains("99001") && !text.contains("Mustermann"));
    assert!(text.contains(&v.pseudonym("99001")) && text.contains(&v.pseudonym("99002")));
}

#[test]
fn hl7_pid3_wird_ersetzt_und_geprueft() {
    let mut v = PatientVault::new();
    let t = v.sanitize(&bdt("99001")).token.unwrap();
    let msg = format!("MSH|^~\\&|PRAX\rPID|1||{t}^^^PRAXIS^PI\rDG1|1||J20.9^^I10GM\r");
    let out = String::from_utf8(v.restore_hl7(msg.as_bytes(), &t).unwrap()).unwrap();
    assert!(out.contains("PID|1||99001^^^PRAXIS^PI") && !out.contains(&t));
    let foreign = format!("MSH|x\rPID|1||{}^^^PRAXIS^PI\r", v.pseudonym("99002"));
    assert!(v.restore_hl7(foreign.as_bytes(), &t).is_err());
}

#[test]
fn ausgang_mit_identitaetsfeld_abgelehnt() {
    let mut v = PatientVault::new();
    let t = v.sanitize(&bdt("99001")).token.unwrap();
    let out = [make_line("8000", b"6310"), make_line("3000", t.as_bytes()), make_line("3101", b"Name")].concat();
    assert!(v.restore(&out, &t).is_err());
}

/// Synthetische Identität eines Testpatienten (erfunden).
const NAME: &str = "Testfrau";
const VORNAME: &str = "Erika";
const GEBURT: &str = "02031961";

fn line_raw(len: &str, fk: &str, value: &str) -> Vec<u8> {
    format!("{len}{fk}{value}\r\n").into_bytes()
}

/// PRIV-01: Identität in jedem bekannten Identitätsfeld erreicht das Fenster nicht.
#[test]
fn priv01_identitaetsfelder_nie_im_fenster() {
    let mut v = PatientVault::new();
    let fields = ["3100", "3101", "3102", "3103", "3104", "3105", "3106", "3107", "3108", "3110", "3112", "3113", "3114", "3119", "3622", "3626", "3628"];
    let mut raw = vec![make_line("8000", b"6200"), make_line("3000", b"TEST_77001")];
    for fk in fields {
        raw.push(make_line(fk, format!("TEST_IDENT_{fk}").as_bytes()));
    }
    let s = v.sanitize(&raw.concat());
    let text = String::from_utf8_lossy(&s.data).to_string();
    assert!(!text.contains("TEST_IDENT_") && !text.contains("TEST_77001"));
    assert_eq!(s.dropped, fields.len());
}

/// PRIV-02: Identität im Freitext, in unbekannten Feldern und in defekten Zeilen.
#[test]
fn priv02_freitext_unbekannte_und_defekte_zeilen() {
    let mut v = PatientVault::new();
    let raw = [
        make_line("8000", b"6200"),
        make_line("3000", b"TEST_77001"),
        make_line("3101", NAME.as_bytes()),
        make_line("3102", VORNAME.as_bytes()),
        make_line("3103", GEBURT.as_bytes()),
        make_line("6200", b"12112026"),
        make_line("6220", format!("Frau {NAME}, {VORNAME} (geb. 02.03.1961), Pat.-Nr. TEST_77001, klagt über Husten").as_bytes()),
        make_line("6228", b"Rotation der Schulter frei"),
        make_line("3999", format!("{NAME} unbekanntes Feld").as_bytes()), // nicht erlaubte FK
        make_line("4111", b"TEST_Kassennummer"),                            // nicht erlaubte FK
        line_raw("099", "6220", &format!("{NAME} falsche Laenge")),         // Längenangabe falsch
        format!("Freitext ohne Aufbau {NAME}\r\n").into_bytes(),            // kein xDT
        make_line("5001", b"03230"),
    ]
    .concat();
    let s = v.sanitize(&raw);
    let text = String::from_utf8_lossy(&s.data).to_string();
    for secret in [NAME, VORNAME, GEBURT, "02.03.1961", "TEST_77001", "TEST_Kassennummer"] {
        assert!(!text.contains(secret), "{secret} im Fenster");
    }
    assert!(text.contains("Frau [entfernt], [entfernt] (geb. [entfernt])") && text.contains("klagt über Husten"));
    assert!(text.contains("03230") && text.contains("Rotation der Schulter"));
    assert_eq!((s.unknown, s.invalid, s.redacted), (2, 2, 4));
    // Jede Zeile im Ausgang hat wieder eine korrekte Längenangabe.
    for l in text.split("\r\n").filter(|l| !l.is_empty()) {
        assert_eq!(l[..3].parse::<usize>().unwrap(), l.len() + 2, "{l}");
    }
}

#[test]
fn ersetzen_nur_ganze_woerter() {
    let secrets = vec![b"rot".to_vec()];
    assert_eq!(redact(b"Rotation, Rot. ROT", &secrets), (b"Rotation, [entfernt]. [entfernt]".to_vec(), 2));
    assert_eq!(redact("Rotkäppchen".as_bytes(), &secrets).1, 0);
}
