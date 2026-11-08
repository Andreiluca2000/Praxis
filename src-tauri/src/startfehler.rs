//! Startfehler sichtbar machen: Im Release-Build gibt es kein Konsolenfenster, ein Fehler beim Start
//! (Einrichtung, WebView2, Panik) beendete das Programm bisher ohne jeden Hinweis.
//! - Meldungsfenster mit dem Grund und dem Pfad der Protokolldatei.
//! - `%LOCALAPPDATA%\de.praxis.assistent\start-fehler.txt` (je Windows-Benutzer, letzter Fehler zuerst lesbar).
//! Die Texte stammen aus Einrichtung und Systemaufrufen (Pfade, Rechte, WebView2) – keine Patientendaten.

use std::io::Write;
use std::path::PathBuf;
use std::time::{SystemTime, UNIX_EPOCH};

/// Längere Texte werden gekürzt (Meldungsfenster und Datei bleiben lesbar).
const MAX_ZEICHEN: usize = 2000;
/// Datei wird nicht unbegrenzt groß: darüber beginnt sie neu.
const MAX_DATEI_BYTES: u64 = 256 * 1024;

pub fn datei() -> Option<PathBuf> {
    std::env::var_os("LOCALAPPDATA").map(|d| PathBuf::from(d).join("de.praxis.assistent").join("start-fehler.txt"))
}

/// Text für Datei und Fenster: Version, Zeitpunkt (Sekunden seit 1970, UTC) und gekürzter Fehler.
pub fn eintrag(fehler: &str, sekunden: u64) -> String {
    let kurz: String = fehler.chars().take(MAX_ZEICHEN).collect();
    format!("[{sekunden}] Praxis-Assistent {}: {kurz}\n", env!("CARGO_PKG_VERSION"))
}

fn schreiben(text: &str) -> Option<PathBuf> {
    let pfad = datei()?;
    std::fs::create_dir_all(pfad.parent()?).ok()?;
    let anhaengen = std::fs::metadata(&pfad).map(|m| m.len() < MAX_DATEI_BYTES).unwrap_or(false);
    let mut f = std::fs::OpenOptions::new().create(true).write(true).append(anhaengen).truncate(!anhaengen).open(&pfad).ok()?;
    f.write_all(text.as_bytes()).ok()?;
    Some(pfad)
}

/// Protokolliert den Fehler und zeigt ihn an. `titel` unterscheidet Startfehler und spätere Abstürze.
pub fn melden(titel: &str, fehler: &str) {
    let sekunden = SystemTime::now().duration_since(UNIX_EPOCH).map(|d| d.as_secs()).unwrap_or(0);
    let gespeichert = schreiben(&eintrag(fehler, sekunden));
    let kurz: String = fehler.chars().take(MAX_ZEICHEN).collect();
    let abhilfe = abhilfe(fehler).map(|a| format!("\n\nWas hilft:\n{a}")).unwrap_or_default();
    let hinweis = match gespeichert {
        Some(p) => format!("\n\nDer Text steht auch in:\n{}", p.display()),
        None => String::new(),
    };
    anzeigen(titel, &format!("{titel}.\n\nGrund:\n{kurz}{abhilfe}{hinweis}"));
}

/// Bekannte Ursachen mit einem Satz zur Abhilfe (Groß-/Kleinschreibung egal).
pub fn abhilfe(fehler: &str) -> Option<&'static str> {
    let f = fehler.to_lowercase();
    if f.contains("webview") {
        Some("Microsoft Edge WebView2 Runtime fehlt oder ist beschädigt. Als Administrator den „Evergreen Standalone Installer (x64)“ von Microsoft installieren bzw. reparieren und das Programm neu starten.")
    } else if f.contains("access is denied") || f.contains("zugriff verweigert") || f.contains("os error 5") {
        Some("Keine Schreibrechte. Den Ordner C:\\ProgramData\\Praxis-Assistent (bzw. den genannten Pfad) prüfen – auf dem Server einmal server-einrichten.ps1 als Administrator ausführen.")
    } else {
        None
    }
}

/// Paniken (auch in Hintergrund-Threads) zusätzlich melden; die übliche Ausgabe bleibt erhalten.
pub fn panik_abfangen() {
    let bisher = std::panic::take_hook();
    std::panic::set_hook(Box::new(move |info| {
        melden("Praxis-Assistent: unerwarteter Fehler", &info.to_string());
        bisher(info);
    }));
}

#[cfg(windows)]
fn anzeigen(titel: &str, text: &str) {
    use windows_sys::Win32::UI::WindowsAndMessaging::{MessageBoxW, MB_ICONERROR, MB_OK, MB_SETFOREGROUND};
    let breit = |s: &str| s.encode_utf16().chain(std::iter::once(0)).collect::<Vec<u16>>();
    let (t, x) = (breit(titel), breit(text));
    // SAFETY: beide Puffer sind nullterminiert und leben bis zum Ende des Aufrufs; kein Besitzerfenster.
    unsafe {
        MessageBoxW(std::ptr::null_mut(), x.as_ptr(), t.as_ptr(), MB_OK | MB_ICONERROR | MB_SETFOREGROUND);
    }
}

#[cfg(not(windows))]
fn anzeigen(titel: &str, text: &str) {
    eprintln!("{titel}: {text}");
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn eintrag_enthaelt_version_zeit_und_kuerzt() {
        let e = eintrag(&"x".repeat(5000), 42);
        assert!(e.starts_with("[42] Praxis-Assistent "));
        assert!(e.contains(env!("CARGO_PKG_VERSION")));
        assert_eq!(e.rsplit_once(": ").unwrap().1.trim_end().len(), MAX_ZEICHEN);
        assert!(e.ends_with('\n'));
    }

    #[test]
    fn abhilfe_fuer_bekannte_ursachen() {
        assert!(abhilfe("runtime error: Could not find the webview runtime").unwrap().contains("WebView2"));
        assert!(abhilfe("Access is denied. (os error 5)").unwrap().contains("Schreibrechte"));
        assert!(abhilfe("etwas anderes").is_none());
    }
}
