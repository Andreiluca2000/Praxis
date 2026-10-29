//! KI im Tagesabschluss (optional). KI schlägt vor und erklärt, sie entscheidet nie:
//! jede Antwort ist „unsicher“, geht im Fenster durch Prüfmotor und Katalog und wird nie nach DURIA geschrieben.
//! - Hauptschalter (`ai.provider`) aus → keine Anfrage verlässt das Programm, auch nicht mit Stufe-2-Freigabe.
//! - Stufe 1 (erlaubt): nur Ziffern/ICD, Art des Befunds und Text des Prüfmotors. Kein Kartei-Text, keine Nummer,
//!   kein Pseudonym, kein genaues Datum – Rust entfernt Datumsangaben und Kennungen zusätzlich.
//! - Stufe 2 („genau lesen“: Kartei-/Diktattext): nur mit eigener Freigabe durch einen Arzt (AVV, ZDR, DSFA bestätigt);
//!   Standard gesperrt. Text wird mit `minimize()` gekürzt und von Kennungen befreit.
//! - Was gesendet würde, baut dieselbe Funktion wie die echte Anfrage (Vorschau). Protokoll ohne Inhalt.

use crate::ai::{build_request, ensure_enabled, minimize, send, stage2_open, AiConfig, AiReply, Transport};
use serde::Deserialize;
use serde_json::Value;

/// Höchstzahl Ziffern/ICD je Anfrage (Stufe 1 erklärt einen Befund, nicht einen ganzen Tag).
pub const MAX_CODES: usize = 20;
/// Stufe 1: Länge des Prüftextes (ein Befund).
const MAX_VERDICT_CHARS: usize = 600;
/// Erlaubte Befundarten (wie im Prüfmotor `src/kvdt/day-check.ts`).
pub const KINDS: &[&str] = &[
    "keine_diagnose", "diagnose_ohne_sicherheit", "leistung_ohne_datum", "datum_ausserhalb_quartal", "regel", "praxisregel",
    "diagnose_ziffer", "kein_schein", "keine_leistung_am_tag", "tag_fehlt_in_datei", "datei_unvollstaendig", "kombination", "zeitraum",
];

pub const STAGE1_TASK: &str = "Erkläre dem Arzt in einfachem Deutsch, was der Prüfbefund zu diesen Ziffern bedeutet und was er \
in DURIA prüfen oder dokumentieren sollte. Höchstens 6 Sätze. Nenne keine neuen Ziffern als sicher; Vorschläge kennzeichnen als „zu prüfen“.";
pub const STAGE2_TASK: &str = "Lies den Auszug aus der Dokumentation genau. Antworte nur mit JSON: \
{\"vorschlaege\":[{\"ziffer\":\"…\",\"begruendung\":\"…\",\"beleg\":\"wörtliches Zitat aus dem Auszug\"}],\"hinweise\":[\"…\"]}. \
Nur Leistungen, die im Auszug belegt sind; fehlt etwas, nenne es unter „hinweise“. Alles ist ein Vorschlag, den der Arzt prüft.";

/// Anfrage aus dem Fenster. Das Fenster kennt keine Patientennummer; Rust prüft trotzdem alles nach.
#[derive(Deserialize, Debug)]
#[serde(tag = "stage", rename_all = "snake_case")]
pub enum DayAiRequest {
    /// Stufe 1: einen Befund erklären.
    Erklaeren { kind: String, codes: Vec<String>, verdict: String },
    /// Stufe 2: Dokumentation des Tages genau lesen und Ziffern vorschlagen.
    GenauLesen { codes_today: Vec<String>, text: String },
}

impl DayAiRequest {
    pub fn feature(&self) -> &'static str {
        match self {
            DayAiRequest::Erklaeren { .. } => "tagesabschluss-stufe1",
            DayAiRequest::GenauLesen { .. } => "tagesabschluss-stufe2",
        }
    }
}

/// Fertig gebaute Anfrage plus Angaben für die Vorschau.
pub struct Built {
    pub body: Value,
    pub redactions: usize,
    pub truncated: bool,
    pub chars: usize,
}

/// Ziffer (EBM/GOÄ) oder ICD-10-GM: nur Buchstaben, Ziffern, Punkt; kurz.
fn valid_code(c: &str) -> bool {
    (1..=12).contains(&c.len()) && c.chars().all(|ch| ch.is_ascii_alphanumeric() || ch == '.')
}

fn codes(list: &[String]) -> Result<Vec<String>, String> {
    if list.len() > MAX_CODES {
        return Err("KI: zu viele Ziffern in einer Anfrage.".into());
    }
    list.iter()
        .map(|c| c.trim().to_ascii_uppercase())
        .map(|c| if valid_code(&c) { Ok(c) } else { Err("KI: ungültige Ziffer – Anfrage nicht gesendet.".to_string()) })
        .collect()
}

fn is_date_token(core: &str) -> bool {
    let digits = |s: &str| !s.is_empty() && s.chars().all(|c| c.is_ascii_digit());
    // 29.10.2026, 29.10., 2026-10-29, 29102026 (xDT)
    let dotted: Vec<&str> = core.split('.').collect();
    let dashed: Vec<&str> = core.split('-').collect();
    (dotted.len() >= 2 && dotted.iter().filter(|p| !p.is_empty()).all(|p| digits(p) && p.len() <= 4) && dotted[0].len() <= 2 && dotted[1].len() <= 2)
        || (dashed.len() == 3 && dashed[0].len() == 4 && dashed.iter().all(|p| digits(p)))
        || (core.len() == 8 && digits(core) && core[4..].starts_with("20"))
}

/// Stufe 1: genaue Datumsangaben entfernen (nur „am Tag“ bleibt), dann wie überall `minimize()`.
pub fn scrub_stage1(text: &str) -> (String, usize) {
    let mut count = 0;
    // Zeiträume „2026-10-01–2026-12-31“ in zwei Wörter zerlegen.
    let spaced = text.replace('–', " – ");
    let replaced: Vec<String> = spaced
        .split(' ')
        .map(|w| {
            let core = w.trim_matches(|c: char| !c.is_alphanumeric());
            if !core.is_empty() && is_date_token(core) {
                count += 1;
                w.replace(core, "[Datum]")
            } else {
                w.to_string()
            }
        })
        .collect();
    let short: String = replaced.join(" ").chars().take(MAX_VERDICT_CHARS).collect();
    let (out, n, _) = minimize(&short);
    (out, count + n)
}

/// Baut die Anfrage. Stufe 2 nur bei offener Freigabe – sonst wird nicht einmal eine Vorschau gebaut.
pub fn build_day_request(cfg: &AiConfig, req: &DayAiRequest) -> Result<Built, String> {
    match req {
        DayAiRequest::Erklaeren { kind, codes: list, verdict } => {
            if !KINDS.contains(&kind.as_str()) {
                return Err("KI: unbekannte Befundart – Anfrage nicht gesendet.".into());
            }
            let list = codes(list)?;
            let (verdict, redactions) = scrub_stage1(verdict);
            let data = format!("Befundart: {kind}\nZiffern/ICD: {}\nPrüfbefund: {verdict}", list.join(", "));
            let chars = data.chars().count();
            Ok(Built { body: build_request(cfg, STAGE1_TASK, &data, 1024), redactions, truncated: false, chars })
        }
        DayAiRequest::GenauLesen { codes_today, text } => {
            if !stage2_open(cfg) {
                return Err("KI Stufe 2 ist gesperrt: Kartei-Text wird erst nach ärztlicher Freigabe (AVV, ZDR, DSFA) gesendet.".into());
            }
            let list = codes(codes_today)?;
            let (text, redactions, truncated) = minimize(text);
            let data = format!("Ziffern des Tages: {}\nAuszug:\n{text}", if list.is_empty() { "keine".into() } else { list.join(", ") });
            let chars = data.chars().count();
            Ok(Built { body: build_request(cfg, STAGE2_TASK, &data, 2048), redactions, truncated, chars })
        }
    }
}

/// Freigabe Stufe 2 nur mit allen drei Bestätigungen.
pub fn stage2_approval(kuerzel: &str, at: u64, avv: bool, zdr: bool, dsfa: bool) -> Result<crate::ai::Stage2Approval, String> {
    if !(avv && zdr && dsfa) {
        return Err("Stufe 2 erst freigeben, wenn AVV/DPA, Zero Data Retention und DSFA vorliegen.".into());
    }
    if kuerzel.trim().is_empty() {
        return Err("Freigabe nur durch einen angemeldeten Arzt.".into());
    }
    Ok(crate::ai::Stage2Approval { by: kuerzel.trim().into(), at, avv, zdr, dsfa })
}

/// Einziger Weg zur Anfrage: erst der Hauptschalter, dann die Stufen-Prüfung, dann das Netz.
pub async fn ask_day<T: Transport>(transport: &T, cfg: &AiConfig, key: &str, req: &DayAiRequest) -> Result<AiReply, String> {
    ensure_enabled(cfg)?;
    let built = build_day_request(cfg, req)?;
    send(transport, cfg, key, &built.body).await
}
