# Proba în cabinet: conectarea la DURIA cu pacientul de test

Scop: să aflăm dacă Praxis-Assistent se poate lega de DURIA pe serverul cabinetului și dacă funcțiile din plan merg pe un **pacient de test**. Nu e pilot: nu se lucrează cu pacienți reali, nu se facturează nimic și nu se scrie nimic în DURIA fără decizia explicită a lui Andree.

Stadiul codului la plecare: `main` pe GitHub. Verificat în cloud pe 28.10.2026: TypeScript, 309 teste și validarea datelor trec. Testele Rust se rulează doar pe Windows.

## 0. Regula cea mai importantă: Claude și datele pacienților

Tot ce citește Claude Code (fișiere, rezultatul comenzilor, capturi de ecran) ajunge la serverele Anthropic. Pe serverul cabinetului sunt date reale (§203 StGB, art. 9 DSGVO). De aceea, la cabinet:

- Claude **nu** deschide și nu listează: baza de date DURIA, exporturi BDT/KVDT reale, folderele de eingang/quarantaene cât timp pot conține fișiere de la pacienți reali, loguri DURIA, documente scanate.
- Claude lucrează doar cu: fișierele programului, `C:\ProgramData\Praxis-Assistent` (fără fișierele GDT din el), setările Windows/ACL, scriptul `server-einrichten.ps1`.
- Conținutul fișierelor GDT îl verifică **Andree pe ecran**, nu Claude. Lui Claude i se spun doar **numerele de câmp (FK)** care apar, nu valorile.
- Nicio captură de ecran cu DURIA deschis pe un pacient real.
- Doar pacientul de test, cu date inventate (de ex. „Test, Paul”, născut 01.01.1960, diagnoze și cifre puse de noi).

## 1. Acasă, înainte de plecare

- [ ] Construiește installerul pe calculatorul de acasă: `pnpm build`. Fișierul apare în `src-tauri\target\release\bundle\nsis\` (sau `msi\`). Copiază-l pe stick.
- [ ] Pentru Diktat: copiază și folderul `tools\` (whisper + modelul), pentru că nu e în Git. Dacă nu, testăm Diktat altă dată.
- [ ] Comite și urcă raportul `docs/AUDIT_CODEX_20261027.md` (acum e doar pe calculatorul de acasă).
- [ ] Ai la îndemână parola de administrator a serverului și numărul hotline-ului DURIA: 02421/2707-3. Întrebările sunt în `docs/DURIA_FRAGEN.md`.

## 2. Instalare pe server (ca administrator)

| # | Pas | Rezultat așteptat | OK? |
|---|---|---|---|
| 2.1 | `powershell -ExecutionPolicy Bypass -File server-einrichten.ps1 -NurPruefen` | Arată ce lipsește și nu schimbă nimic | |
| 2.2 | Același script, fără `-NurPruefen` | „Rechte in Ordnung” | |
| 2.3 | Instalează aplicația din installer | Pornește, cere prima configurare | |
| 2.4 | Prima configurare: contul medicului | Login automat ca medic | |
| 2.5 | Al doilea cont (MFA), cu aprobarea medicului | Aprobare greșită refuzată, corectă acceptată | |
| 2.6 | Login greșit de 5 ori | „Zu viele Fehlversuche …” | |
| 2.7 | Setările arată modul **Simulation** | Da, nu operativ | |

## 3. Legătura GDT cu DURIA

Folderul de schimb pentru fiecare stație e `C:\ProgramData\Praxis-Assistent\gdt\<NUME-STAȚIE>\eingang` (dinspre DURIA) și `...\ausgang` (spre DURIA). `<NUME-STAȚIE>` e numele PC-ului de la care te conectezi prin RDP. În setările programului apare la „GDT-Eingang” ca `%CLIENTNAME%`. Numele real îl vezi cu `echo %CLIENTNAME%` în sesiunea RDP.

| # | Pas | Rezultat așteptat | OK? |
|---|---|---|---|
| 3.1 | În DURIA: aparat GDT nou „Praxis-Assistent”, directorul de export = `eingang`-ul de mai sus | Setare salvată. Dacă nu știi unde, sună la hotline | |
| 3.2 | Notează versiunea DURIA, versiunea GDT (2.1 / 3.x) și numele fișierului GDT pe care îl scrie DURIA | Notat | |
| 3.3 | Deschide pacientul de test în DURIA și pornește apelul către aparatul GDT | În câteva secunde, aplicația arată pacientul | |
| 3.4 | Verifică pe ecran: **numele, adresa și data nașterii nu apar** | Doar un pseudonim | |
| 3.5 | Ce a venit: prestații (cifre), diagnoze, text din Karteikarte, ora prestației | Notează ce a venit și ce lipsește (doar FK-urile, fără valori) | |
| 3.6 | Fără login în aplicație, trimite din nou din DURIA | Fișierul nu e citit și nici șters, rămâne în așteptare | |
| 3.7 | Schimbă pacientul în DURIA (al doilea pacient de test) | Rezultatul vechi devine blocat sau depășit | |
| 3.8 | Logout | Datele pacientului dispar din fereastră | |
| 3.9 | Din alt cont Windows (dacă există), încearcă să deschizi folderul altei stații | „Zugriff verweigert” | |
| 3.10 | BDT: se poate exporta doar pacientul de test, pe un trimestru? | Notat. Încearcă citirea prin dialogul „Datei öffnen” | |

Dacă la 3.3 nu vine nimic: verifică dacă DURIA a scris fișierul în alt folder sau cu altă extensie. Programul acceptă `.gdt`, `.bdt`, `.dat`, `.txt` și extensii numerice (`.001`). Fișierele invalide sau mai vechi de 10 minute merg în `quarantaene`. Pe acestea le deschide Andree, nu Claude.

## 4. Funcțiile, pe pacientul de test

Pune în DURIA, pe pacientul de test, câteva date inventate: 2–3 diagnoze (una cu „V”), prestații în aceeași zi (de ex. 03000, 03230, 35100) și un text scurt în Karteikarte.

| # | Funcție | Ce verifici | OK? |
|---|---|---|---|
| 4.1 | ICD-Suche | „Diabetes”, „Hypertonie”, un cod scris greșit: rezultate corecte, fără coduri inventate | |
| 4.2 | Behandlung | Prestațiile, diagnozele și notițele se văd ca plăci | |
| 4.3 | Kombinationen je Sitzung | Perechile apar (Ausschluss / nicht prüfbar) și au dovada | |
| 4.4 | Fertig | Propuneri marcate „Entwurf”. Nimic nu se transmite singur | |
| 4.5 | Praxisregeln | Medicul creează o regulă, simulează, o activează cu motiv. MFA doar vede | |
| 4.6 | Formulare | Muster 6 / 2 / 4 / 10 / 13: preluare din pacient cu confirmare și listă de verificare | |
| 4.7 | Diktat | Doar dacă `tools\` e instalat și microfonul RDP merge | |
| 4.8 | Notițe → DURIA (6310) | **Doar dacă Andree hotărăște:** activezi `writeback_enabled` și trimiți o notiță de test. Notează ce face DURIA cu ea | |
| 4.9 | Cifre/diagnoze → DURIA | **Rămâne oprit** până răspunde DURIA la întrebările 16–18 | — |
| 4.10 | Verificare trimestrială KVDT | **Nu cu Claude de față:** fișierul KVDT conține toți pacienții. Se testează separat | — |

## 5. Ce aducem înapoi (fără date de pacienți)

- Versiunea DURIA și GDT, numele fișierului, folderul setat.
- Lista FK-urilor primite (doar numerele, de ex. 3000, 6200, 5000, 5001, 5006, 6001, 6220…).
- Tabelele de mai sus completate cu OK / nu / observație.
- Răspunsurile hotline-ului la `docs/DURIA_FRAGEN.md`.
- Erorile apărute, cu textul mesajului (fără nume sau date de pacient).

Cu acestea se completează `config/duria-mapping.json` și se decide pasul următor.
