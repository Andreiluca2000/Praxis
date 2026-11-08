use crate::ai::{AiConfig, Transport};
use crate::ai_auftrag::*;
use std::sync::atomic::{AtomicUsize, Ordering};

/// Attrappe für das Netz: zählt nur, wie oft gesendet worden wäre.
struct CountingTransport(AtomicUsize);
impl Transport for CountingTransport {
    async fn post(&self, _key: &str, _body: &serde_json::Value) -> Result<(u16, String), String> {
        self.0.fetch_add(1, Ordering::SeqCst);
        Ok((200, r#"{"type":"message","content":[{"type":"text","text":"{}"}],"stop_reason":"end_turn","usage":{"input_tokens":1,"output_tokens":1}}"#.into()))
    }
}

const AUFTRAG: &str = "Alle Diabetiker ohne 03220 in diesem Quartal";

fn run(cfg: &AiConfig, text: &str) -> (Result<crate::ai::AiReply, String>, usize) {
    let net = CountingTransport(AtomicUsize::new(0));
    let key = format!("sk-ant-api03-{}", "x".repeat(60));
    let r = tauri::async_runtime::block_on(ask_auftrag(&net, cfg, &key, text));
    (r, net.0.load(Ordering::SeqCst))
}

#[test]
fn ki_aus_kein_auftrag_geht_hinaus() {
    let (r, calls) = run(&AiConfig::default(), AUFTRAG);
    assert!(r.unwrap_err().contains("ausgeschaltet"));
    assert_eq!(calls, 0);
}

#[test]
fn eingeschaltet_genau_eine_anfrage_nur_text_und_schema() {
    let on = AiConfig { provider: "claude".into(), ..AiConfig::default() };
    let (body, redactions, truncated, _) = build_auftrag(&on, AUFTRAG).unwrap();
    assert_eq!((redactions, truncated), (0, false));
    assert_eq!(body["messages"][0]["content"], format!("<daten>\n{AUFTRAG}\n</daten>"));
    assert!(body["system"].as_str().unwrap().contains("GENAU EIN JSON-Objekt"));
    assert_eq!(body["messages"].as_array().unwrap().len(), 1, "keine weiteren Inhalte (keine Fälle, keine Ziffern aus der Datei)");
    let (r, calls) = run(&on, AUFTRAG);
    assert!(r.is_ok());
    assert_eq!(calls, 1);
}

#[test]
fn kennungen_im_auftrag_werden_entfernt_und_text_gekuerzt() {
    let on = AiConfig { provider: "claude".into(), ..AiConfig::default() };
    let text = "Patient P-0123456789abcdef0123, KVNR A123456789, Tel. 02421/2707300: fehlt 03220?";
    let (body, redactions, ..) = build_auftrag(&on, text).unwrap();
    let s = body.to_string();
    for secret in ["P-0123456789abcdef0123", "A123456789", "2707300"] {
        assert!(!s.contains(secret), "{secret}");
    }
    assert_eq!(redactions, 3);
    let (body, _, truncated, chars) = build_auftrag(&on, &"Suche ".repeat(200)).unwrap();
    assert!(truncated && chars <= MAX_AUFTRAG_CHARS);
    assert!(body.to_string().len() < 12_000);
    assert!(build_auftrag(&on, "   ").is_err());
}
