# Cheia Claude API: acasă → cabinet

29.10.2026. Cheia API stă în Windows Credential Manager (DPAPI), legată de **utilizatorul Windows și de calculator**. De aceea o cheie pusă acasă nu apare singură pe serverul cabinetului. Ea se mută cu un **fișier de transfer criptat cu o parolă** aleasă de tine.

## De ce așa (decizia)

- Cheia se vede o singură dată, la creare, pe platform.claude.com. Trebuie să ajungă cumva la cabinet: mai bine criptată decât pe hârtie, în e-mail sau pe un stick în clar.
- Fișierul: **Argon2id** (64 MiB, 3 treceri) derivă din parolă o cheie de 256 de biți, iar **AES-256-GCM** criptează cheia API. Parametrii și „sarea” sunt autentificați (o modificare înseamnă refuz). La import, fișierele cu protecție slabă sunt refuzate.
- Cheia nu ajunge niciodată în fereastră (în afară de câmpul de introducere), în git, în loguri, în jurnalul KI sau în `arbeitsplatz.json`. Exportul și importul le face Rust, cu dialogul de fișiere al sistemului; fereastra trimite doar parola de transfer.
- Alternativa „o tastezi direct pe server” rămâne posibilă (câmpul „Claude-API-Schlüssel”), dar cere să ai cheia în clar la cabinet.

## Acasă

1. Instalează programul și creează contul de medic (prima configurare).
2. **Einstellungen → KI-Assistent:** lipește cheia `sk-ant-…` → „Speichern”.
3. Opțional: „Ein · Claude API” → „Verbindung testen” (trimite doar un text sintetic fix). Apoi poți pune din nou „Aus”.
4. **Schlüssel auf einen anderen Rechner übertragen:** o parolă de transfer de minimum 12 caractere (o propoziție e ideală), scrisă de două ori → „Exportieren …” → salvezi `ki-schluessel.praxiskey`.
5. Duci **fișierul** (stick, e-mail către tine) și **parola** pe căi separate. Parola nu stă în același e-mail sau pe același stick.

## La cabinet (server, RDP)

1. Te loghezi ca medic în program, sub utilizatorul tău Windows.
2. **Einstellungen → KI-Assistent:** scrii parola de transfer → „Aus Datei übernehmen …” → alegi fișierul. Cheia ajunge în Credential Manager-ul utilizatorului tău Windows de pe server.
3. „Ein · Claude API” → „Verbindung testen”.
4. **Ștergi fișierul de transfer** de pe stick sau din e-mail. Nu e periculos fără parolă, dar nu mai e nevoie de el.

**Fiecare utilizator Windows separat.** Și cheia, și comutatorul KI sunt per utilizator Windows (fiecare RDP are al lui). Dacă un alt medic vrea KI, importă același fișier sub contul lui Windows, cu aceeași parolă, și își pornește comutatorul.

## Comutatorul KI

- Implicit **„Aus”**. Oprit înseamnă că programul nu trimite nimic spre internet. Funcția de trimitere refuză înainte de orice conexiune; testul Rust `ausgeschaltet_geht_keine_anfrage_hinaus` verifică asta cu un transport simulat care numără apelurile (0 când e oprit).
- Doar medicii îl pot schimba. Cheia poate fi importată și cu KI oprit.
- Fereastra nu are oricum acces la internet (CSP). Doar Rust vorbește cu `api.anthropic.com`.

## Dacă ceva nu merge

- „Transfer-Passwort falsch oder Datei beschädigt.”: parola e greșită sau fișierul a fost modificat. Exportă din nou acasă.
- „Transferdatei mit unzulässigen Schutzparametern.”: fișierul nu e creat de program. Exportă din nou.
- Cheia compromisă sau parola pierdută: revoci cheia pe platform.claude.com, creezi una nouă și repeți pașii. „Entfernen” șterge cheia din Credential Manager.
