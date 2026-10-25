# Fragen an die technische Hotline von DURIA (02421/2707-3)

Ziel: Anbindung eines internen Praxis-Assistenten (Abrechnungsprüfung, Diktat, ICD-Suche). Das Programm liest Patientendaten und soll nach ärztlicher Freigabe Notizen sowie angenommene Ziffern und Diagnosen an DURIA übergeben. Es greift nie direkt in die Datenbank oder die DURIA-Oberfläche ein.

**Wichtigste Fragen: 16, 17, 18 und 19.**

## Schnittstelle
1. Welche Schnittstelle empfehlen Sie für ein Zusatzprogramm, das Daten des **aktuell geöffneten Patienten** liest: GDT (als „Gerät“), BDT-Export oder HL7? Gibt es eine dokumentierte API?
2. GDT: Welche Version (2.1 / 3.x)? Welche Satzarten sendet DURIA (6302 Neue Untersuchung, 6310/6311)? Austauschverzeichnis und Dateinamenskonvention (Geräte-/Praxis-Kürzel)?
3. Kann ein GDT-Aufruf außer Stammdaten auch **Leistungsziffern (FK 5001), Diagnosen (FK 6001/6003/6004) und Karteikartentext** des Tages oder eines Zeitraums enthalten?
4. BDT: Lässt sich ein Export auf **einen Patienten und einen Zeitraum** (z. B. das Quartal) beschränken? Ist garantiert, dass der Export alle Einträge des Zeitraums enthält?
5. Welche Feldkennungen nutzt DURIA für Karteikartentext (6220/6227/6228/6230 o. a.) und für Leistungsdatum (5000)?
6. Zeichensatz (FK 9206) und Datumsformat (TTMMJJJJ oder JJJJMMTT)?
7. Werden Stornos/Korrekturen von Leistungen im Export markiert? Mit welchem Feld?
8. Wie erkennt ein Zusatzprogramm den HZV-Status bzw. die Kostenträgerart (GKV/Privat) eines Falls?

## Rahmen
9. Gibt es ein Partner- oder Zertifizierungsprogramm für Zusatzsoftware und eine Testumgebung mit Demodaten?
10. Bestehen vertragliche Vorgaben (Datenschutz, Auftragsverarbeitung), wenn ein lokales Zusatzprogramm diese Daten liest?
11. Ist ein späterer **Rückweg** (Vorschläge in DURIA übernehmen) vorgesehen – z. B. GDT 6310 mit Ergebnistext? Mit Bestätigung durch den Benutzer?

## Rückweg und Terminalserver (ergänzt 25.10.2026)
12. Kann DURIA über GDT (6310) oder HL7 neben Karteikartentext auch **Leistungsziffern** und **Diagnosen (ICD + Sicherheit)** übernehmen? Wenn ja: welche Feldkennungen, und landen sie als Vorschlag oder direkt im Abrechnungsschein?
13. Gibt es eine Möglichkeit, **bestehende** Diagnosen/Ziffern über eine Schnittstelle zu korrigieren, oder nur durch den Benutzer in DURIA?
14. DURIA läuft bei uns auf einem **Terminalserver (RDP, eine Sitzung je Arbeitsplatz)**. Wie wird das GDT-Austauschverzeichnis je Sitzung/Arbeitsplatz getrennt (z. B. Umgebungsvariable `%CLIENTNAME%` oder `%USERNAME%` im Pfad)?
15. Darf ein Zusatzprogramm in derselben RDP-Sitzung laufen? Gibt es Erfahrungswerte zu RAM/CPU auf dem Server?

## Übernahme angenommener Ziffern/Diagnosen (wichtigste Frage, ergänzt 25.10.2026)
16. Das Programm erzeugt nach Freigabe durch den Arzt eine GDT-Datei (Satzart 6310) mit **FK 5000 (Datum) + 5001 (Leistungsziffer)** und **FK 6000 + 6001 (ICD) + 6003 (Sicherheit) + 6004 (Seitenlokalisation)**. Übernimmt DURIA diese Felder direkt in den Abrechnungsschein bzw. die Diagnosenliste des Falls? Oder nur als Text in die Karteikarte?
17. Falls nicht per GDT: Gibt es **HL7-Eingang** (z. B. DFT/BAR) oder eine **Partner-API**, über die ein Zusatzprogramm Ziffern und Diagnosen nach Bestätigung durch den Arzt eintragen kann?
18. Wie wird der **Fall/Schein** bestimmt, dem die Ziffer zugeordnet wird (Quartal, Kostenträger, HZV oder GKV)?

## Quartalsprüfung vor dem KV-Versand
19. Kann DURIA die **KVDT-Abrechnungsdatei** des Quartals vor der Verschlüsselung und dem Versand als Datei ausgeben (z. B. Prüflauf)? Wo liegt sie, und entspricht sie dem KBV-KVDT-Standard (Scheine 0101–0104, FK 5000/5001/6001/6003)?

## Nach der Antwort
Die bestätigte Zuordnung wird in eine eigene Datei (z. B. `config/duria-mapping.json`, Vorlage: `config/duria-mapping.example.json`) eingetragen, mit `"confirmed_by_vendor": true`. Erst dann entfällt die Warnung „nicht bestätigt“ in der Oberfläche.
