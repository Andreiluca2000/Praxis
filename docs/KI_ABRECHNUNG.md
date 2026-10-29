# KI la Abrechnung: ce face etapa 1 și ce rămâne pentru etapa 2

29.10.2026 · plan; **construit doar KI în Tagesabschluss** (vezi secțiunea „Tagesabschluss”, etapa 2 blocată). Azi KI trimite numai testul de conexiune sintetic. Comutatorul e implicit „Aus”; oprit înseamnă că nu pleacă nicio cerere (verificat în testul Rust `ausgeschaltet_geht_keine_anfrage_hinaus`). Contextul general e în `docs/CLAUDE_INTEGRATION_PLAN.md`.

## Regula de bază (ambele etape)

- KI **propune și explică**, nu decide. Facturarea o decid motorul de reguli și medicul.
- KI nu scrie în DURIA și nu ocolește motorul. Orice cifră sau cod propus trece prin aceleași verificări: catalog EBM/GOÄ/ICD, perechi, intervale, frecvențe, Praxisregeln.
- Fiecare cerere arată întâi „Was wird gesendet”. Jurnalul de audit nu conține conținut (cine, când, funcție, model, tokeni).

## Etapa 1: doar coduri și texte de reguli, fără identitate

**Ce intră în cerere:**
- coduri EBM/GOÄ și ICD-10-GM;
- textul normei din dosarele de reguli (`data/billing/…`), adică texte publice EBM/GOÄ/G-BA;
- verdictul motorului (de ex. „Ausschluss je Sitzung”, „nicht prüfbar”) și ce lipsește pentru verificare.

**Ce nu intră niciodată în etapa 1:**
- text din fișă (6220/6227/6205…), dictări, notițe;
- nume, data nașterii, număr de pacient, pseudonimul `P-…`, KVNR, adresă, telefon;
- date calendaristice exacte ale tratamentului (doar „aceeași zi”, „ziua 3 din trimestru” etc.);
- fișierul KVDT sau exportul GDT, nici măcar curățat.

**Ce poate face KI în etapa 1:**

| Funcție | Exemplu | Cum rămâne sigur |
|---|---|---|
| Explicarea unei reguli în limbaj simplu | „De ce 03100 nu merge lângă 03360 în aceeași ședință?” | Primește doar cele 2 cifre, verdictul și citatul normei; răspunsul e afișat lângă sursa din dosar |
| Întrebări despre catalog (Regelfragen) | „Ce condiții are 03230? Ce trebuie documentat?” | Doar codul și textul normei; fără pacient |
| Ce lipsește pentru o verificare | „nicht prüfbar” → ce dovadă ar trebui notată (oră, durată, conținut obligatoriu) | Lista vine din motor; KI doar o formulează |
| Formularea pentru corecturi | Text scurt pentru motivul unei corecturi („G → V, pentru că …”) | Medicul scrie/aprobă; KI nu vede fișa |
| Verificarea dosarelor de reguli (pentru dezvoltare) | Contradicții între două reguli draft, citate lipsă | Doar date de reguli, nicio dată de pacient |
| Set de evaluare pe cazuri sintetice | Cât de des are KI dreptate față de motor, cost per caz | Doar cazuri inventate |

**Punct deschis pentru cabinet (recomandare):** o listă de coduri luată dintr-un caz **real** (cifrele și ICD-urile unui pacient, chiar fără nume) rămâne pentru cabinet o dată de sănătate pseudonimizată, deci tot o dată personală (art. 4 nr. 5 și art. 9 GDPR). Recomand ca în etapa 1 KI să primească doar coduri **alese sau tastate de medic ca întrebare generală** ori din cazuri sintetice, nu lista unui pacient încărcat. Coduri dintr-un caz real abia după AVV, cu acordul responsabilului de protecția datelor.

## Etapa 2: cu date din fișă, NU se implementează acum

Cere înainte, în această ordine:
1. **AVV/DPA** cu Anthropic (art. 28 GDPR) și obligația de confidențialitate pentru §203 StGB;
2. **ZDR** (zero data retention) și verificarea transferului în SUA (DPF/SCC); regiune UE, dacă există;
3. **DSFA/DPIA** (art. 35 GDPR, date de sănătate), registrul de prelucrări, informarea pacienților;
4. decizia scrisă a cabinetului: cine răspunde de cheie și de costuri.

**Ce ar putea face atunci:**
- **fapte din fișă/dictare pentru Abrechnung:** efectuat, durată, conținut obligatoriu documentat, ședințe separate → ca „unsicher”, până confirmă medicul (schemă JSON fixă);
- **propuneri de cifre** din textul fișei, validate apoi de motor și de catalog;
- **verificarea trimestrială asistată:** explicații per caz în verificarea KVDT, cu textul minimizat de Rust (`minimize()`), fără pseudonim;
- **ICD din diagnoza scrisă**, verificat în catalogul oficial; G/V/A/Z doar de la medic.

**Ce nu face nici în etapa 2:** nu trimite tot dosarul sau tot trimestrul dintr-o dată, nu scrie în DURIA, nu transformă „unsicher” în „bereit” fără confirmarea medicului.

## Tagesabschluss: ce e construit (29.10.2026)

Cerința lui Andree: KI să poată „genau lesen” documentația zilei și să propună decizii. Deciziile:
- **Comutatorul KI rămâne poarta principală** (implicit „Aus”). Oprit = nimic nu pleacă, nici cu etapa 2 deblocată.
- **Etapa 1 (`ai_day_ask`, `stage: "erklaeren"`):**
  - o singură constatare odată: tipul, cifrele/ICD-urile, textul motorului;
  - Rust verifică formatul codurilor (max. 20) și tipul, apoi înlocuiește datele cu „[Datum]” și rulează `minimize()`;
  - nu există câmp pentru text din fișă.
- **Etapa 2 (`stage: "genau_lesen"`):**
  - textul fișei plus cifrele zilei, minimizat în Rust;
  - **blocată** până când un medic (rol `arzt`) confirmă în dialog AVV/DPA, ZDR și DSFA (`ai_stage2_unlock`);
  - închiderea se face cu `ai_stage2_lock`;
  - `update_config` nu poate schimba poarta;
  - o poartă incompletă în fișierul de setări e respinsă și tratată ca închisă.
- **Răspunsul etapei 2** e JSON fix (`vorschlaege`: ziffer, begruendung, beleg; `hinweise`). Fereastra îl verifică cu motorul (cifra pusă de probă în ziua cazului; constatările noi aparțin propunerii) și cu catalogul (format EBM, deja facturat, regulă aprobată, citat găsit în textul trimis).
  - Propunerea rămâne mereu „unsicher”. „Annehmen” o pune doar în lista de corecturi, nu în DURIA.
- **Teste:** `src-tauri/src/ai_day_tests.rs` (poartă închisă → 0 cereri; KI oprit → 0 cereri; etapa 1 fără dată, pseudonim, număr), `tests/day-ai.test.ts`.
- **Punctul deschis de mai sus rămâne:** cifrele unui caz real sunt date de sănătate pseudonimizate. Etapa 1 trimite doar cifrele unei constatări, fără identitate și fără date exacte. Andree și responsabilul de protecția datelor decid dacă e suficient înainte de AVV.

## Ordinea propusă

1. (posibil acum, după decizia cabinetului) Explicații de reguli și întrebări de catalog: doar coduri + texte de normă.
2. Set de evaluare sintetic: costul și calitatea, înainte de orice pilot.
3. După AVV/ZDR/DSFA: extracția faptelor din dictare (cel mai mare câștig), apoi propunerile de cifre.
