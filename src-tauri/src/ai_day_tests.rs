use crate::ai::{validate_config, AiConfig, Transport};
use crate::ai_day::*;
use std::sync::atomic::{AtomicUsize, Ordering};

/// Attrappe für das Netz: zählt nur, wie oft gesendet worden wäre.
struct CountingTransport(AtomicUsize);
impl Transport for CountingTransport {
    async fn post(&self, _key: &str, _body: &serde_json::Value) -> Result<(u16, String), String> {
        self.0.fetch_add(1, Ordering::SeqCst);
        Ok((200, r#"{"type":"message","content":[{"type":"text","text":"{\"vorschlaege\":[]}"}],"stop_reason":"end_turn","usage":{"input_tokens":1,"output_tokens":1}}"#.into()))
    }
}

/// Synthetischer Kartei-Text (erfunden) mit Kennungen, die nie hinausgehen dürfen.
const KARTEI: &str = "Pat. P-0123456789abcdef0123, KVNR A123456789: Gespräch 15 Min. wegen Rückenschmerz, Befund besprochen.";
const ON: fn() -> AiConfig = || AiConfig { provider: "claude".into(), ..AiConfig::default() };

fn key() -> String {
    format!("sk-ant-api03-{}", "x".repeat(60))
}
fn read_req() -> DayAiRequest {
    DayAiRequest::GenauLesen { codes_today: vec!["03000".into()], text: KARTEI.into() }
}
fn explain_req(verdict: &str) -> DayAiRequest {
    DayAiRequest::Erklaeren { kind: "diagnose_ziffer".into(), codes: vec!["03220".into(), "E11.9".into()], verdict: verdict.into() }
}
fn open_gate(mut cfg: AiConfig) -> AiConfig {
    cfg.stage2 = Some(stage2_approval("AL", 1_793_260_800, true, true, true).unwrap());
    cfg
}
fn run(cfg: &AiConfig, req: &DayAiRequest) -> (Result<crate::ai::AiReply, String>, usize) {
    let net = CountingTransport(AtomicUsize::new(0));
    let r = tauri::async_runtime::block_on(ask_day(&net, cfg, &key(), req));
    (r, net.0.load(Ordering::SeqCst))
}

#[test]
fn stufe2_standard_gesperrt_kein_text_geht_hinaus() {
    let cfg = ON();
    assert!(cfg.stage2.is_none(), "Standard: gesperrt");
    let (r, calls) = run(&cfg, &read_req());
    assert!(r.unwrap_err().contains("gesperrt"));
    assert_eq!(calls, 0, "gesperrt: kein einziger Netzaufruf");
    // Auch keine Vorschau, die Kartei-Text enthielte.
    assert!(build_day_request(&cfg, &read_req()).is_err());
}

#[test]
fn ki_aus_kein_text_geht_hinaus_auch_mit_freigabe() {
    let cfg = open_gate(AiConfig::default());
    assert_eq!(cfg.provider, "aus");
    for req in [read_req(), explain_req("Hinweis")] {
        let (r, calls) = run(&cfg, &req);
        assert!(r.unwrap_err().contains("ausgeschaltet"));
        assert_eq!(calls, 0);
    }
}

#[test]
fn stufe2_mit_freigabe_minimiert_und_sendet_einmal() {
    let cfg = open_gate(ON());
    let built = build_day_request(&cfg, &read_req()).unwrap();
    let body = built.body.to_string();
    assert!(!body.contains("P-0123456789abcdef0123") && !body.contains("A123456789"));
    assert!(body.contains("Rückenschmerz") && body.contains("03000"));
    assert_eq!(built.redactions, 2);
    let (r, calls) = run(&cfg, &read_req());
    assert!(r.is_ok());
    assert_eq!(calls, 1);
}

#[test]
fn stufe1_ohne_datum_pseudonym_und_nummer() {
    let verdict = "Gesicherte chronische Diagnose (E11.9) ohne 03220 am 2026-10-29, 29.10.2026 und 29.10., Zeitraum 2026-10-01–2026-12-31, \
                   Pat. P-0123456789abcdef0123, Tel. 02421/2707300, xDT 29102026.";
    let built = build_day_request(&ON(), &explain_req(verdict)).unwrap();
    let body = built.body.to_string();
    for secret in ["2026-10-29", "29.10.2026", "29.10.", "2026-10-01", "2026-12-31", "P-0123456789abcdef0123", "2707300", "29102026"] {
        assert!(!body.contains(secret), "{secret} im Körper: {body}");
    }
    assert!(body.contains("E11.9") && body.contains("03220") && body.contains("[Datum]"));
    // Stufe 1 braucht keine Stufe-2-Freigabe.
    let (r, calls) = run(&ON(), &explain_req("Hinweis"));
    assert!(r.is_ok());
    assert_eq!(calls, 1);
}

#[test]
fn stufe1_nur_gueltige_ziffern_und_befundarten() {
    let bad_code = DayAiRequest::Erklaeren { kind: "regel".into(), codes: vec!["Erika Testfrau".into()], verdict: "x".into() };
    assert!(build_day_request(&ON(), &bad_code).is_err());
    let bad_kind = DayAiRequest::Erklaeren { kind: "freitext".into(), codes: vec!["03000".into()], verdict: "x".into() };
    assert!(build_day_request(&ON(), &bad_kind).is_err());
    let many = DayAiRequest::Erklaeren { kind: "regel".into(), codes: vec!["03000".into(); MAX_CODES + 1], verdict: "x".into() };
    assert!(build_day_request(&ON(), &many).is_err());
    // Stufe 1 schickt nie einen Text-Auszug: das Feld existiert nicht.
    let json = r#"{"stage":"erklaeren","kind":"regel","codes":["03000"],"verdict":"x","text":"Kartei"}"#;
    let parsed: DayAiRequest = serde_json::from_str(json).unwrap();
    assert!(!build_day_request(&ON(), &parsed).unwrap().body.to_string().contains("Kartei"));
}

#[test]
fn freigabe_stufe2_nur_mit_allen_bestaetigungen() {
    assert!(stage2_approval("AL", 1, true, true, false).is_err());
    assert!(stage2_approval("AL", 1, false, true, true).is_err());
    assert!(stage2_approval(" ", 1, true, true, true).is_err());
    let ok = stage2_approval("AL", 1, true, true, true).unwrap();
    assert_eq!(ok.by, "AL");
    // Eine unvollständige Freigabe in der Einstellungsdatei gilt nicht und wird abgelehnt.
    let mut cfg = ON();
    cfg.stage2 = Some(crate::ai::Stage2Approval { dsfa: false, ..ok });
    assert!(!crate::ai::stage2_open(&cfg));
    assert!(validate_config(&cfg).is_err());
    let (_, calls) = run(&cfg, &read_req());
    assert_eq!(calls, 0);
    // Alte Einstellungsdatei ohne „stage2“ → gesperrt.
    let old: AiConfig = serde_json::from_str(r#"{"provider":"claude","model":"claude-opus-5-5","effort":"low"}"#).unwrap();
    assert!(!crate::ai::stage2_open(&old));
}

#[test]
fn protokoll_funktion_ohne_inhalt() {
    assert_eq!(read_req().feature(), "tagesabschluss-stufe2");
    assert_eq!(explain_req("x").feature(), "tagesabschluss-stufe1");
}
