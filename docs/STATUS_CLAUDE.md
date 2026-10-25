# Stadiul programării (Claude)
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
