# Stadiul programării (Claude)
## Etapa (27.10.2026): prima integrare Abrechnung, perechi „nicht nebeneinander je Sitzung”
- **Motor** (`src/engine/pairs.ts`): citește strict dosarul Codex `data/billing/scope-resolutions/rules.review.json` (schema 1.11.0, 998 de perechi: 820 EBM + 178 GOÄ). Excepțiile vin din `wounds/rules.review.json`. Registrul e refuzat complet dacă schema e necunoscută, dacă statusul nu e draft sau e operativ, dacă lipsește perioada de valabilitate, dacă are o clauză cu altă structură, o pereche dublă sau o excepție lipsă.
- **Ședința nu e o zi:** `BilledService.session` vine din FK 5006 (ora, citită în KVDT și în adaptorul GDT/BDT; Rust o lasă acum să treacă). Aceeași oră înseamnă aceeași ședință, deci **Ausschluss**. Ora lipsă sau diferită înseamnă **„Sitzung nicht prüfbar”**: niciodată toată ziua, dar nici permis, pentru că ora singură nu dovedește o ședință separată. Perechile cu `exception_record_ids` dau mereu **„Ausnahme prüfen”**, cu textul din normă. Nu se aplică pe cazuri HZV, între sisteme EBM/GOÄ, pe stornări sau în afara Q4/2026.
- **Unde:** la verificarea trimestrială KVDT, în secțiunea „Kombinationen je Sitzung”, **doar în simulator** (drafturile n-au efect operativ). Perechile nu intră la erori. Fiecare are dovada (locatorul + citatul din normă) și mențiunea că o pereche lipsă nu înseamnă „kombinierbar”. Dosarul se încarcă la nevoie, ca fișier separat de 2,7 MB.
- **Teste** `tests/pairs.test.ts` (18, pe dosarul real): probele 1, 2, 3, 4, 6, 7, 12, 23, 24, 25, 26, 29, 36, 37, 38, 39, 40, 41, plus încărcarea fail-closed și KVDT cu 5006. TS 161, Rust 24.
- **Aplicația reală** (release, cont de test, KVDT sintetic): 03100/03360 la aceeași oră = Ausschluss; 03100/03370 fără oră = nicht prüfbar; 02300/02301 = Ausnahme prüfen; 0 erori; nicio identitate afișată.
- **Încă nu e făcut:** perechile în vizualizarea „Behandlung” (un pacient); intervale pe zi, Behandlungsfall, Krankheitsfall, Arztgruppenfall și postoperatorii din celelalte dosare; confirmarea manuală „ședințe separate documentate”; verificarea hash-ului dosarului față de `release/manifest.json` (la verificare datele se schimbau, sesiunea de audit era încă activă); probele GOÄ cu ore (13, 14, 16) și cele cu actor sau alt pacient (30, 33, 39 complet).


## Etapa (27.10.2026): reparațiile Datenschutz P0 (DS-01, DS-02, DS-03) + DS-04 parțial
- **DS-01 – listă de câmpuri permise** (`src-tauri/src/patient.rs`): în fereastră ajung doar FK-urile din profilul `SINGLE_PATIENT` (GDT/BDT) sau `KVDT` (fără text liber). Câmpurile necunoscute, liniile fără aspect xDT și cele cu lungime greșită rămân în Rust și sunt doar numărate (`unknown`, `invalid`). În textul liber (6205/6220/6227/6228/6230), numele, prenumele, data nașterii (și ca TT.MM.JJJJ), adresa și numărul pacientului din aceeași fișă se înlocuiesc cu „[entfernt]”, numai ca cuvinte întregi. **Limită:** numele rudelor sau alte identități din textul liber nu pot fi recunoscute; textul liber rămâne date personale.
- **DS-03 – inbox** (`gdt.rs`, `lib.rs`): fără login, fișierul nu se citește și nu se șterge (apare doar un mesaj neutru). Cu login: întâi verificarea de aspect (FK 8000 la început, lungimea liniilor, 8100 = lungimea înregistrării), apoi citire exclusivă (Windows: nu e deschis de DURIA) și limită de 20 MB. Doar după validare exportul curățat trece în memoria Rust (`pending`) și sursa se șterge. Fișierele invalide, prea mari sau mai vechi de 10 minute merg în `eingang\quarantaene\q-<timp>.xdt`, cu nume neutru, și se șterg după 24 h. Fereastra **ia singură** exportul (`take_incoming`), iar evenimentul doar anunță că există unul. Astfel nimic nu se pierde la login sau la reîncărcare. Logout și „Schließen” golesc `pending`. Lock-ul pe utilizator e ținut între verificare și predare (PRIV-05).
- **DS-04 parțial:** fereastra primește „DURIA-Übergabe” / „Ausgewählte Datei” / „KVDT-Datei” în loc de numele fișierului. Mesajele nu conțin conținut sau căi.
- **DS-05 parțial:** `expand_env` refuză o variabilă lipsă sau goală, în loc să creeze un folder comun. `%CLIENTNAME%` cade pe numele calculatorului (ca `client_name()`). Pe PC-ul de dezvoltare a rămas folderul gol `C:\ProgramData\Praxis-Assistent\gdt\eingang` creat de codul vechi; e dovada problemei.
- **DS-02 – drepturi** (`scripts/server-einrichten.ps1`): pe rădăcină, utilizatorii au doar RX, plus citirea fișierelor direct din rădăcină (`konten.json`). În `gdt\`, utilizatorii pot doar crea un subfolder, iar CREATOR OWNER = Full, deci fiecare stație e accesibilă doar celui care a creat-o. Drepturile vechi „Modify” se șterg explicit, pentru că `icacls /grant:r` nu le înlocuiește dacă moștenirea diferă. Folderele existente primesc drept explicit pentru proprietar (sau un avertisment, dacă aparțin unui admin). Noul `-NurPruefen` verifică drepturile efective. Conturile se schimbă **doar ca administrator**, iar aplicația afișează un mesaj clar. Un cont nesalvat nu mai rămâne în memorie (`AccountStore::commit`).
- **Teste:** Rust 24 (noi: PRIV-01, PRIV-02, cuvinte întregi, aspect/8100, fișier deschis, carantină, `%VAR%` lipsă, `konten.json` read-only); TS 143. Drepturile au fost testate pe un folder temporar fără admin: starea veche avea 6 probleme, cea nouă 0. Ca utilizator: `konten.json` se poate citi, dar nu scrie; nu se pot crea fișiere în rădăcină; `gdt` nu se poate lista; folderul nou al stației are doar proprietarul și SYSTEM.
- **Aplicația reală** (release, ProgramData temporar, cont de test, GDT sintetic, conectare prin debugging WebView2): fără login fișierul rămâne și apare „wartet – bitte anmelden”. După login pacientul se încarcă, cu textul „Frau [entfernt] (geb. [entfernt])”. DOM-ul și octeții IPC nu conțin nume, dată de naștere, număr sau nume de fișier. Fișierul trunchiat ajunge în carantină cu un mesaj neutru. După logout, `take_incoming` e refuzat și fișierul nou rămâne în inbox.
- **Rămân deschise:** PRIV-04 cu **doi utilizatori Windows reali** pe server (aici s-a verificat structura ACL, nu accesul altui cont); hash-urile Argon2 din `konten.json` pot fi citite de utilizatori (doar un serviciu Windows ar rezolva asta); vârsta în Rust în loc de data nașterii; DS-06…09. `'unsafe-eval'` din CSP (`tauri.conf.json`) e necesar acum pentru Ajv în fereastră (`validateSettings`/`validateRulePackage`); scoaterea lui cere validatoare precompilate (Ajv standalone). De întrebat la DURIA: dacă 8100 se completează mereu, dacă receptorul șterge fișierul (convenția GDT) și dacă poate scrie în folderul per utilizator; lista de FK-uri permise se actualizează după răspuns.


## Etapa (25.10.2026): catalogul ICD-10-GM 2026 integrat (livrare Codex)
- **Import** `pnpm import:icd` (`scripts/import-icd.ts`): verifică manifestul, mărimile și SHA-256, citește metadatele (16.905 coduri, 28 de coloane) și ClaML (12.606 clase, 9.256 incluziuni, 4.798 excluderi), fără DTD sau entități. Aplică cele 10 corecturi din 28.01.2026 doar pe copia derivată, cu verificarea valorii vechi. Compară ClaML cu metadatele: orice diferență oprește importul (carantină). Scrie apoi atomic `data/icd/catalog-2026.json` (generat, nu e în git).
- Neconcordanța XSD a originalului (`xml:space` pe rădăcină) e tratată ca excepție documentată. Originalele rămân neatinse.
- **Căutare** (`src/icd/search.ts`): cod exact sau prefix, text tolerant la umlaut, majuscule și spații, termeni incluși marcați separat, ordonare categorie → „n. n. bez.” → cod. Notele §295 (P/O/Z/V), sex, vârstă și IfSG sunt afișate. Nu setează niciodată G/V/A/Z.
- **Interfață**: pagina „Diagnosen & ICD” și butonul „ICD suchen” la fiecare diagnoză din notițe; codul introdus e verificat față de catalog.
- Teste ICD-01…10 pe catalogul real + teste de carantină: 143 TypeScript în total. Verificatorul Codex `verify-content.py` trece.
- Rămase din raportul Codex: constatările Datenschutz P0 (patient.rs, server-einrichten.ps1, scanner GDT) și integrarea drafturilor de reguli EBM/GOÄ.


## Etapa (25.10.2026): corecturi, verificarea trimestrială KVDT, cale de trimitere interschimbabilă
- **Corecturi** (`src/corrections/`, `ui/CorrectionsPanel.tsx`): listă de pași „12.11.2026 · Diagnose J06.9 G → J20.9 G (Grund: …) [AL]”, cu butoane de copiere și „In DURIA erledigt”. Propuneri automate (altă certitudine, cod mai specific din aceeași categorie, conflicte din Fertig). Trebuie preluate de un medic. Motivul e obligatoriu, formatul ICD și G/V/A/Z sunt verificate. Programul nu modifică nimic în DURIA.
- **Verificarea trimestrială KVDT** (`src/kvdt/`, `ui/QuarterCheck.tsx`, Rust `read_kvdt`): doar citire. Rust elimină identitățile și pune pseudonime pentru toți pacienții. Verifică: caz fără diagnoză, diagnoză fără certitudine, cifră fără dată sau în afara trimestrului, conflicte de reguli/limite pe trimestru. Doar pentru medici.
- **Cale interschimbabilă** (`src/duria/channel.ts`): GDT (standard) sau HL7 v2.5 DFT^P03 (pregătit). Setare `billing_channel`. Rust pune numărul real și în PID-3 la HL7. Verificările (medic, context, dubluri, DEMO) sunt aceleași pentru ambele căi. Un API viitor = încă o implementare `BillingChannel`.
- Teste: 127 TypeScript, 17 Rust.


## Etapa (25.10.2026): confirmare în fișă, date pacient doar în Rust, script pentru server
- **Confirmare** (`src/facts/confirm.ts`, `ui/FactPanel.tsx`): fiecare mențiune din fișă se confirmă (efectuat/planificat/…/nu se folosește), plus durata (din text sau introdusă) și „conținut obligatoriu documentat”. „Fertig” folosește doar ce s-a confirmat. Confirmările contradictorii rămân „necunoscut”.
- **Granița datelor pacient** (`src-tauri/src/patient.rs`): Rust citește GDT/BDT, elimină câmpurile de identitate și înlocuiește FK 3000 cu un pseudonim HMAC (biblioteci verificate `hmac`/`sha2`). Fereastra nu vede niciodată numele, data nașterii sau numărul real. La scriere, Rust pune numărul real înapoi doar pentru pacientul deschis, refuză fișierele cu câmpuri de identitate și recalculează FK 8100.
- **Server**: `scripts/server-einrichten.ps1` (rulat ca admin) creează `C:\ProgramData\Praxis-Assistent` cu drepturile corecte și verifică ffmpeg.
- Teste: 114 TypeScript, 15 Rust.


## Corectură (25.10.2026): ce e acceptat intră ca date de facturare, nu ca notiță
- „Annehmen” + „in DURIA übernehmen” trimit **cifre (FK 5000/5001) și diagnoze (FK 6000/6001/6003/6004)** într-un fișier GDT 6310, cu Kürzel-ul medicului.
- Nu se trimit cifre deja existente în DURIA. Nu se trimite nimic de două ori, nimic dacă s-a schimbat pacientul și nicio cifră DEMO. Trimite doar un medic.
- Întrerupător separat „Ziffern und Diagnosen”, oprit până când DURIA confirmă că preia aceste câmpuri (întrebările 16–18 din DURIA_FRAGEN.md).
- O diagnoză e gata de acceptat doar cu ICD **și** G/V/A/Z puse de medic.


## Etapa a treia (25.10.2026): program desktop Tauri + React
- Program Windows: `src-tauri\target\release\praxis-assistent.exe` (3,4 MB, ~170 MB RAM cu WebView2). Construire: `pnpm build`; dezvoltare: `pnpm dev`.
- Rust (doar acces la sistem): conturi Arzt/MFA cu Kürzel (Argon2id, comune în `%ProgramData%\Praxis-Assistent`), folder GDT intrare/ieșire per sesiune RDP (`%CLIENTNAME%`), transcriere locală whisper.cpp, setări per utilizator. 8 teste Rust.
- TypeScript (logica, în fereastră): motor, xDT, Fertig, notițe; fără Node, 101 teste.
- Dictare: Wortlaut / Kurz / Ausführlich din aceeași transcriere; diagnoze recunoscute → ICD + G/V/A/Z doar de medic; eliberare doar de medic → GDT 6310 cu Kürzel (dacă e activat), altfel copiere.
- „Fertig”: rulează în fundal pe tot trimestrul; propuneri acceptate/respinse individual; cele acceptate devin notiță cu Kürzel.
- Verificat în aplicația reală: pornire, ecran de prima configurare. Fluxul complet (dictare, Fertig) e testat doar prin testele de logică, nu prin clic în fereastră.



Actualizat: 25.10.2026 (etapa a doua)

## Gata
- Proiect TypeScript (Node 24, pnpm, Vitest, Ajv). `pnpm check` trece: tipuri OK, 77 teste, date validate.
- **Adaptor DURIA numai citire** (GDT/BDT): verifică lungimea liniilor, citește CP437 și ISO 8859-15, nu ghicește datele ambigue. Câmpurile de identitate (nume, data nașterii, adresă) sunt eliminate la citire. Numărul pacientului devine un pseudonim local per sesiune. Contextul e separat per stație (CTX-01…05).
- **Recunoașterea textului din fișă** (FACT-01…10): efectuat, planificat, recomandat, refuzat, extern, istoric, negat, antecedente familiale. Rezultatele rămân „nesigure” până le confirmă utilizatorul.
- **Interfață locală în germană** (`pnpm start` → http://127.0.0.1:4317): încărcare export, date citite, confirmarea mențiunilor, rezultate cu dovezi, setarea KV. Ascultă doar pe calculatorul local și respinge cererile venite din alte site-uri.
- Validare scheme Codex + verificări semantice: surse nerezolvate, versiuni duplicate/suprapuse, intervale inversate, contracte HZV.
- Motorul Abrechnung: logică cu trei stări, ferestre zi/trimestru/an cu verificarea acoperirii, dubluri, `cannot_combine`/`included_in`/`requires_code`, limite de frecvență, KV, HZV, DEMO numai în simulator, invalidare la schimbarea setărilor.

## Ajustare făcută la scheme (fără a le modifica)
Schemele sunt valide Draft 2020-12, dar nu trec modul „strict” complet al Ajv (lipsesc repetări de `type` în `if/then`). Programul folosește strict pentru cuvinte-cheie necunoscute și a oprit doar regulile de stil `strictTypes`/`strictRequired`. Codex le poate completa oricând; nu e o eroare de conținut.

## Cereri către Codex (conținut)
1. Catalogul ICD-10-GM 2026 oficial (ClaML de la BfArM) + manifest de proveniență în `data/icd/` — necesar pentru ICD-01…10.
2. Confirmarea formatului manifestului (câmpuri: sursă, versiune, sha256, componente disponibile).
3. Primele reguli reale prioritare, doar ca `draft`, cu surse exacte.
4. Evaluarea Datenschutz pentru citirea exportului DURIA (ce câmpuri sunt necesare, fără păstrarea datelor).

## De întrebat la DURIA
Lista completă: `docs/DURIA_FRAGEN.md`: interfața recomandată, câmpurile folosite, export pe un pacient și un trimestru, marcarea storno-urilor, HZV/tip de asigurare, program de parteneri și mediu de test.

## Următorii pași (Claude)
1. Modul ICD, imediat ce vine catalogul (ICD-01…10, BILL-13): import ClaML cu carantină, căutare tolerantă la umlaut, categorii vs. coduri terminale, marcaj G/V/A/Z fără G automat.
2. Supravegherea directorului GDT, după ce DURIA confirmă formatul, ca analiza să pornească din DURIA cu un clic.
3. Pornire ca program Windows (scurtătură pe desktop).
