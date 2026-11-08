//! KI-Auftrag (optional, nur Arzt): Der Arzt beschreibt in Worten, was gesucht werden soll.
//! - Gesendet wird NUR sein Text (gekürzt, Kennungen entfernt) und die feste Beschreibung des Filters.
//!   Keine Patientendaten, kein Pseudonym, keine Ziffern aus echten Fällen.
//! - Claude antwortet mit einem FILTER (JSON), nie mit Patienten. Das Fenster prüft ihn streng gegen das Schema
//!   (`src/kvdt/ki-filter.ts`) und wendet ihn lokal an; Treffer bleiben „unsicher“ bis zur Entscheidung des Arztes.
//! - Hauptschalter aus → keine Anfrage. Vorschau aus derselben Funktion; Protokoll ohne Inhalt.

use crate::ai::{build_request, ensure_enabled, minimize, send, AiConfig, AiReply, Transport};
use serde_json::Value;

/// Höchstlänge des Auftrags (Zeichen): eine Suchbeschreibung, kein Kartei-Text.
pub const MAX_AUFTRAG_CHARS: usize = 500;
pub const FEATURE: &str = "ki-auftrag";

/// Feste Beschreibung des Filters – muss zu `parseKiFilter` im Fenster passen.
pub const FILTER_TASK: &str = "Der Arzt beschreibt zwischen <daten> und </daten>, welche Abrechnungsfälle seiner Praxis gesucht werden sollen. \
Übersetze das in GENAU EIN JSON-Objekt nach diesem Schema und antworte mit nichts anderem (kein Text, keine Erklärung): \
{\"version\":1,\"titel\":\"kurzer Titel, höchstens 80 Zeichen\",\"zeitraum\":\"tag\"|\"quartal\",\"bedingungen\":[ 1 bis 8 Bedingungen, alle müssen zutreffen ]}. \
Bedingungen: \
{\"art\":\"diagnose\",\"icd\":[\"ICD-10-GM-Präfix, z. B. E11\"],\"vorhanden\":true|false,\"sicherheit\":[\"G\",\"V\",\"A\",\"Z\"] (optional)}; \
{\"art\":\"ziffer\",\"system\":\"EBM\"|\"GOAE\",\"ziffern\":[\"z. B. 03220\"],\"vorhanden\":true|false} (vorhanden=false: keine der Ziffern abgerechnet); \
{\"art\":\"befund\",\"befunde\":[eine oder mehrere aus: keine_diagnose, diagnose_ohne_sicherheit, leistung_ohne_datum, datum_ausserhalb_quartal, regel, praxisregel, diagnose_ziffer, kombination, zeitraum]}; \
{\"art\":\"alter\",\"min\":Zahl,\"max\":Zahl}; {\"art\":\"geschlecht\",\"wert\":\"w\"|\"m\"|\"d\"}. \
„zeitraum“: \"tag\" für heute aufgerufene Patienten, sonst \"quartal\". Nenne nur Ziffern und ICD-Codes, die zur Beschreibung passen; \
gib nie Patienten, Namen oder Daten aus. Was sich nicht abbilden lässt, lässt du weg.";

/// Anfrage bauen: nur der (minimierte, gekürzte) Text des Arztes plus die feste Filterbeschreibung.
pub fn build_auftrag(cfg: &AiConfig, text: &str) -> Result<(Value, usize, bool, usize), String> {
    let trimmed = text.trim();
    if trimmed.is_empty() {
        return Err("Bitte beschreiben, was gesucht werden soll.".into());
    }
    let truncated = trimmed.chars().count() > MAX_AUFTRAG_CHARS;
    let short: String = trimmed.chars().take(MAX_AUFTRAG_CHARS).collect();
    let (data, redactions, _) = minimize(&short);
    let chars = data.chars().count();
    Ok((build_request(cfg, FILTER_TASK, &data, 1024), redactions, truncated, chars))
}

/// Einziger Weg zur Anfrage: erst der Hauptschalter, dann bauen, dann senden.
pub async fn ask_auftrag<T: Transport>(transport: &T, cfg: &AiConfig, key: &str, text: &str) -> Result<AiReply, String> {
    ensure_enabled(cfg)?;
    let (body, ..) = build_auftrag(cfg, text)?;
    send(transport, cfg, key, &body).await
}
