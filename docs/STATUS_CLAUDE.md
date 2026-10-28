# Stadiul programării (Claude)
## Etapa (28.10.2026): KI-Assistent prin Claude API – etapa 1 (doar date sintetice), plan în `docs/CLAUDE_INTEGRATION_PLAN.md`
- **Abonamentul Claude nu se poate lega în program:** Anthropic nu permite login claude.ai sau limitele unui abonament în produse terțe fără aprobare (Agent SDK overview, verificat). Se folosește Claude API.
- **Rust `src-tauri/src/ai.rs`:**
  - **cererea:** doar spre `https://api.anthropic.com/v1/messages`, `anthropic-version: 2026-10-21`, fără `temperature`/`top_p`/`top_k`, cu `output_config.effort`; modele permise `claude-opus-5-5` (implicit), `claude-sonnet-5-5`, `claude-haiku-5-5`;
  - **instrucțiunea de sistem:** textul e date între `<daten>`, nu instrucțiuni (protecție la prompt injection);
  - **`minimize()`:** înlocuiește pseudonimele `P-…`, e-mailurile, numerele de ≥ 7 cifre (telefon) și formatul KVNR cu „[entfernt]”, limită 8000 de caractere; datele clinice și datele calendaristice rămân;
  - **`parse_response()`:** erorile HTTP devin mesaje clare, `stop_reason: refusal` e tratat ca refuz;
  - **jurnalul `ki-protokoll.jsonl`:** fără conținut;
  - **cheia:** în Windows Credential Manager (`keyring`, per utilizator Windows), niciodată în fișier sau în fereastră.
- **Comenzi:**
  - `ai_status` (niciodată cheia);
  - `ai_set_key` și `ai_delete_key` (doar medic; formatul `sk-ant-…` e verificat);
  - `ai_test` (doar medic; **un singur text sintetic fix**; etapa 1 nu trimite nimic din fișă);
  - `ai_preview`, care construiește corpul cererii cu aceeași funcție, dar nu trimite nimic.
- **Setări:** `AppConfig.ai` (`provider` aus/claude, implicit „aus”), validate la `update_config`. CSP-ul ferestrei rămâne fără acces la internet.
- **UI `ui/AiSettings.tsx`** în Einstellungen: furnizor, model, effort, cheie (doar intrare), „Verbindung testen”, previzualizarea „Was würde gesendet?”, jurnalul ultimelor 10 apeluri.
- **Teste:** Rust 33 (6 noi în `ai_tests.rs`, cu KeyStore în memorie). În release: cheie de test inventată → Credential Manager → nu apare în fereastră → previzualizare fără identificatori → setare invalidă refuzată → MFA refuzat la cheie și test → curățenie (fără cheie, KI pe „aus”). **Testul de conexiune cu Anthropic nu e verificat** (cere cheia reală a cabinetului).
- **Urmează:** etapa 2, extracția faptelor din dictare (ieșire structurată, „unsicher”, confirmare de medic), după DPA/ZDR/DPIA. Cheia e acum per utilizator Windows; pentru tot cabinetul trebuie decis (fiecare medic cu cheia lui sau o cheie comună prin serviciu/admin).


## Etapa (28.10.2026): Praxisregeln (după macheta aprobată, salvare doar ca admin)
- **Motor** (`src/rules/`):
  - `model.ts`: 4 tipuri (Erinnerung, Pflichtangabe uhrzeit/dauer/pflichtinhalte, Hausregel Kombination zi/Behandlungsfall, Vorschlag zurückhalten). Validarea conținutului e strictă: câmp necunoscut sau tip necunoscut înseamnă eroare. Versiuni imuabile `entwurf → aktiv → archiv`: activarea e doar de medic, cu motiv obligatoriu, iar versiunea activă anterioară trece în arhivă. „Gültig ab” e respectat. `praxisregeln.json` se citește fail-closed: un fișier stricat înseamnă nicio regulă, cu mesaj vizibil.
  - `evaluate.ts`: pe prestațiile înregistrate și pe propunerile din Fertig. **Garanția e testată pe toate combinațiile:** o propunere doar coboară (bereit → klärung → info) și nu primește intrări noi.
  - `review.ts`: conflicte (același declanșator, Erinnerung + Zurückhalten, dublură cu un Ausschluss oficial din dosare) și simulare pe cazuri KVDT, cu „neu gegenüber aktiv”.
- **Rust:** `rules_read` (orice utilizator logat) și `rules_write` (doar medic, format și mărime verificate, scriere atomică). Fișierul read-only primește mesajul „nur mit Administratorrechten” (varianta A, ca la conturi). Fișierul e `C:\ProgramData\Praxis-Assistent\praxisregeln.json` și conține doar reguli și istoric, fără date de pacienți.
- **UI** (`ui/rules/`, după macheta aprobată): listă Aktiv/Entwürfe/Archiv (prioritate, nume, badge „Überschneidung”, Abschalten), editor (4 tipuri, chips de cifre, limite, previzualizare), simulare (KVDT, conflicte, activare cu motiv, istoric). MFA vede doar în citire.
- **Integrare:** Fertig (`practiceNotes`, regulile se aplică și în modul operativ, pentru că sunt decizia cabinetului), cardul „Praxisregeln” în Behandlung, KVDT ca `praxisregel`/„Hinweis” (niciodată „Fehler”). Previzualizarea dev are reguli de exemplu.
- **Teste:** `tests/practice-rules.test.ts` (11). TS 247, Rust 27. **În release** (conturi de test, ProgramData temporar): regulă nouă din UI → simulare → activare blocată fără motiv → activare → istoric cu TST și motiv → hint în Behandlung → MFA doar citire, `rules_write` refuzat; fișierul nu are date de pacienți.
- **Încă nu:** testul pe server cu drepturi reale (scrierea ca utilizator normal trebuie să dea mesajul de admin); opțiunea de a simula pe cazuri sintetice fără KVDT; ștergerea definitivă a unei reguli (acum doar arhivare).


## Etapa (28.10.2026): CSP fără `unsafe-eval`, limită la parolă, reguli pe zi/caz/Krankheitsfall și frecvență
- **Validatoare precompilate** (`src/validation/standalone.ts` → `pnpm build:validators` → `src/validation/validators.generated.js` + `.d.ts`): Ajv standalone ESM, fără `new Function` la rulare. `require`-urile Ajv rămase devin `import`, compatibile Node + Vite. Testul `tests/validators.test.ts` cere ca fișierul generat să corespundă schemelor și să nu conțină `require`/`new Function`. `validate.ts` folosește doar codul generat. **CSP-ul din `tauri.conf.json` a revenit la cel strict** (fără `'unsafe-eval'`). Verificat în release: antetul CSP real nu conține `unsafe-eval`, UI-ul se încarcă, 0 încălcări.
- **Limită de încercări** (`AccountStore::attempt`): după 5 greșeli pe același Kürzel (inclusiv Kürzel necunoscute), blocare de 30 s, apoi dublare până la 15 min. Se aplică la login și la aprobarea medicului la Register. Contorul stă în memorie (o repornire îl resetează). Hash-urile din `konten.json` rămân citibile pe server (risc rămas, documentat la DS-02). Test Rust `sperre_nach_fehlversuchen`; în release: „Zu viele Fehlversuche – bitte in 29 s erneut versuchen.”
- **Reguli cu interval** (`src/engine/window-rules.ts`), din dosarele optional-hausarzt, pauschalen, prevention, primary-care, visits, wounds și frequency (necomise, Codex):
  - **Ce intră:** clauzele `combination`/`excludes` cu `calendar_day`, `calendar_week`, Behandlungsfall, `krankheitsfall` (trimestrul curent + 3) și `postoperative_21_days`. Acum: 31 de excluderi și 8 limite de frecvență (zi / ședință / Behandlungsfall).
  - **Ce nu intră:** „nicht neben” fără interval (47) nu devine zi, doar se numără. Secțiunile EBM se aplică numai cu apartenență dovedită (`section_membership`).
  - **Perioada postoperatorie:** începe cu un Eingriff din 31.2, nedovedit, deci rezultatul e mereu „nicht prüfbar” (fără Ausschluss inventat).
  - **Excepțiile:** dau „Ausnahme prüfen” doar pentru perechea exactă din clauza condiționată. Euristica largă dădea alarme false (03062/38100).
  - **Behandlungsfall:** în KVDT un Schein contează ca un Behandlungsfall complet; în Behandlung, doar cu bifa „Export enthält das ganze Quartal”.
  - **Ce încă nu se numără:** multiplicatorul FK 5005.
- **UI:** `ui/WindowFindings.tsx`, secțiunea „Ausschlüsse je Tag, Woche und Fall · Höchstanzahlen (Entwurf)”, în verificarea KVDT și în cardul de perechi din Behandlung, cu lista regulilor neverificate.
- **Teste** `tests/window-rules.test.ts` (12, pe dosarele reale): probele GPT 24, 27, 32, 36, 40, 41, HZV, stornări, sisteme, perioadă de valabilitate, încărcare fail-closed, KVDT. TS 226, Rust 26. **În release (KVDT sintetic):** 02310/02311 Behandlungsfall = Ausschluss; 01101/01955 aceeași zi la ore diferite = Ausschluss; 35110 de 4× = „Höchstzahl überschritten”; 0 erori.


## Etapa (27.10.2026, noaptea târziu): perechile pacientului în „Behandlung”, cu confirmarea ședințelor separate
- **Behandlung** (`ui/PatientPairs.tsx`): cardul „Kombinationen je Sitzung” pentru prestațiile pacientului deschis apare doar în simulator, cu registrul încărcat la nevoie. Fiecare pereche are verdictul ca pastilă, textul și dovada (citat din normă). Mesajul fix: o pereche lipsă nu înseamnă „kombinierbar”.
- **Confirmarea „Getrennte Sitzungen dokumentiert”:** e disponibilă doar pentru medic, doar la verdictele `not_verifiable` și `exception_review`, în doi pași (întâi o întrebare: „sunt documentate două ședințe separate, nu doar ore diferite?”). Rezultatul e `separate_confirmed`, cu Kürzel și ora, și poate fi retras. Dacă ora e aceeași, Ausschluss rămâne (o decide motorul, din `99c83f3`). Confirmările stau doar în memorie, pentru pacientul deschis. Se șterg la schimbarea pacientului, la închidere și la logout, și ajung și la „Fertig” (`confirmedSeparate`).
- **Fertig** (`ui/FertigPanel.tsx`): la fiecare cifră propusă apar perechile ei (`pairFindings`) ca pastile, marcate „Entwurf”.
- **Comun:** `ui/PairEvidence.tsx` (verdicte + dovezi), folosit și de verificarea trimestrială KVDT, care primește iconiță la titlu.
- **Dev:** `ui/pairDossier.ts` importă JSON-ul fără `with { type: 'json' }`, pentru că Vite dev livrează JSON ca modul JS și browserul refuza importul. Mock-ul `?preview=patient` conține acum perechile 03100/03360 la aceeași oră și 03230/35100 fără oră.
- **Aplicația reală** (release, conturi de test, GDT sintetic citit prin `read_export`): Ausschluss 03100/03360; 03230/35100 „nicht prüfbar” cu buton → întrebare → „bestätigt (TST, …)” → retragere; MFA vede perechile, dar nu are buton. Nume/număr: nu se văd. TS 171.


## Etapa (27.10.2026, noaptea): design „Soft Premium” (direcția A, aleasă de Andree) + Anmelden/Registrieren separate
- **Stil** (`ui/styles.css`, rescris): fundal ivoire `#f6f5f1`, carduri albe cu raza de 20 px și umbre fine, accent petrol `#1f6b55` și mentă `#e3f1ea`. Butoanele și taburile sunt pastile, câmpurile au raza de 12 px și un inel de focus vizibil. Fără elemente pătrate. Conceptele (Higgsfield GPT Image 2.5, 11 credite) și capturile înainte/după au fost arătate lui Andree.
- **Cadru:** iconițele din meniu stau în cercuri, elementul activ e o pastilă mentă, iar „Formulare” și „Praxisregeln” au eticheta „bald”. Utilizatorul apare ca chip cu avatar, iar banner-ul Simulator are iconiță. Toate titlurile de card au iconiță (lucide-react).
- **Behandlung:** la pacient, prestațiile, diagnosticele și notițele apar ca plăci cu cifre mari. Butoanele au iconiță, iar bara „Fertig” plutește jos, cu textul explicativ sub căsuța de bifat. Diktat are taburi tip pastilă și butonul cu punct roșu.
- **Anmelden / Registrieren** (`ui/Login.tsx`): două taburi. Ochiul arată sau ascunde parola. Prima configurare are doar înregistrarea (primul cont e cont de medic, cu login automat). Orice alt cont cere **aprobare de la medic**: Kürzel + parola unui cont de medic activ, prin comanda `register_account` → `AccountStore::register`. După înregistrare nu se face login automat; apare mesajul „Konto … angelegt – bitte anmelden”. Pe server, conturile se salvează doar cu programul pornit ca administrator (DS-02).
- **Previzualizare dev:** `?preview=login|setup|patient` și `?tab=registrieren` (doar `import.meta.env.DEV`), plus configurația `praxis-ui` (Vite 5174).
- **Teste:** Rust 25 (nou: `registrierung_nur_mit_arzt_freigabe`), TS 171. În aplicația reală (release, ProgramData temporar, conturi de test): prima configurare → aprobarea greșită e refuzată → aprobarea corectă → login MFA.
- **Încă nu e făcut:** `CombinationsPanel.tsx` are încă titlu fără iconiță (fișierul era în lucru la sesiunea paralelă); limită de încercări pentru parola medicului la aprobare (lipsește și la login); fontul rămâne Segoe UI (fără fișiere de font locale noi).


## Etapa (27.10.2026, seara): perechile în Fertig, confirmarea ședințelor separate, format GDT/BDT
- **Fix `e327b81`:** de la DS-04, numele fișierului nu mai ajunge în fereastră, deci recunoașterea `.bdt` dădea mereu GDT. Acum Rust trimite `format` (dialog: după extensie; inbox DURIA: `gdt`).
- **Fertig** (`src/core/fertig.ts`): fiecare cifră propusă e verificată cu `pairsForProposal` față de prestațiile din aceeași zi. Ședința propunerii e necunoscută, deci orice pereche face din „bereit” o **„Klärung”**: fără intrări de transferat, cu textul perechii și locatorul dovezii (`pairFindings` pentru UI-ul de mai târziu). Excepțiile (de ex. `MINOR_MULTIPLE_EXCEPTION`) apar și ele. **Abatere de la plan:** perechile acționează în Fertig în **ambele moduri**, ca frână de prudență. În simulator rulează doar reguli DEMO, iar cifrele lor nu se potrivesc niciodată cu perechile EBM/GOÄ, deci varianta „doar simulator” n-ar fi avut niciun efect. Draftul poate doar să ceară o clarificare, nu aprobă niciodată nimic.
- **Confirmarea „getrennte Sitzungen dokumentiert”** (`src/engine/pairs.ts`): `confirmedSeparate` = Map `confirmationKey(clauză, zi)` → `{ by, at }`. Perechea devine `separate_confirmed`, cu cine și când, și textul spune că restul condițiilor rămân de verificat. Confirmarea se aplică doar acelei clauze și acelei zile. Dacă ora e aceeași, Ausschluss-ul rămâne și se notează contradicția. Nimic nu se deduce automat din oră.
- **`src/core/patient-pairs.ts`:** `patientPairs(snapshot, registry, { mode, hzvContractId, confirmedSeparate })` pentru pacientul deschis. Doar în simulator; în HZV nu verifică nimic. UI-ul vine după redesign.
- **Teste:** `tests/pair-registry.ts` (încărcare comună a dosarului real), 5 noi în `pairs.test.ts`, 5 noi în `fertig.test.ts`.
- `ui/CombinationsPanel.tsx`: doar intrarea `separate_confirmed` în `VERDICT`, ca tipurile să rămână complete (de acord cu sesiunea de redesign).
- **Deschis:** UI-ul pentru confirmare și pentru perechile pacientului vine după redesign.


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
