# Plan: Tagesabschluss (verificare automată la sfârșitul zilei)

28.10.2026 · plan. **Stare 29.10.2026:** etapele 0–2 construite (întrebări DURIA 20–24; lista zilei în `src-tauri/src/daylist.rs`, comenzi `day_list`/`day_close`; motorul `src/kvdt/day-check.ts`). Etapa 3: doar machetă, așteaptă OK-ul lui Andree; ecranul nu e în aplicație. KI în Tagesabschluss (secțiunea 6): Rust și motorul gata, etapa 2 blocată. Ideea lui Andree: pentru fiecare pacient chemat azi, programul își notează numărul de pacient din DURIA (nu numele); seara verifică toți pacienții zilei: ce cifre lipsesc, ce cifre sunt greșite sau incompatibile.

## Pe scurt: se poate?

**Da, tehnic se poate.** Logica de verificare există deja: perechi, reguli pe zi și pe caz, frecvențe, Praxisregeln, diagnoze fără G/V/A/Z, propunerile din „Fertig”. Trei lucruri însă **nu depind de noi** și trebuie lămurite cu DURIA înainte (pasul 0):
1. **Știe programul cine a fost „aufgerufen”?** DURIA trimite un fișier GDT doar când cineva pornește programul extern pentru un pacient, nu automat la fiecare chemare din calendar sau sala de așteptare. Fără o setare în DURIA („GDT bei Aufruf automatisch senden”), lista zilei ar fi incompletă.
2. **De unde vin datele finale ale zilei?** Fișierul GDT de la chemare conține starea de *atunci*. Cifrele și notițele scrise după aceea nu sunt în el. Seara avem nevoie de un export nou.
3. **Cum ajunge medicul la pacient din raport?** Fereastra nu vede intenționat nici numele, nici numărul real (DS-01).

## Cum ar funcționa

### 1. Lista zilei (în timpul zilei)
- La fiecare chemare GDT, Rust notează: numărul DURIA, **ora chemării**, stația și Kürzel-ul utilizatorului. **Fără nume, fără data nașterii.**
- Numărul real rămâne **doar în Rust**, ca acum. Fereastra vede pseudonimul și ora („Patient von 09:42 · PC07 · AL”).
- **Stocare:** în memorie, plus o copie criptată pe disc cu Windows DPAPI (legată de utilizatorul Windows), ca lista să supraviețuiască unei reporniri. **Ștearsă automat** după Tagesabschluss sau după 24 h. Fără copie necriptată, fără loguri cu numere.

### 2. Datele de seară (sursa, în ordinea preferinței)
- **A. Fișierul KVDT (trimestrul până azi)**, filtrat pe ziua de azi și pe pacienții din listă. Conține toate cifrele și diagnozele, deci e ideal pentru „ce e greșit / incompatibil”. Nu conține textul din fișă. Trebuie confirmat cu DURIA că se poate genera oricând, nu doar la sfârșit de trimestru.
- **B. Export BDT pe zi** (dacă DURIA îl oferă): conține și notițele, deci se poate verifica și „ce lipsește din ce e documentat”.
- **C. Fără export:** doar ce s-a văzut la chemare. Rezultatul e marcat clar ca „unvollständig”.

### 3. Ce verifică
- **Greșit / incompatibil (sigur):** perechi pe ședință, Ausschlüsse pe zi/caz/Krankheitsfall, frecvențe depășite, cifră fără diagnoză, diagnoză fără G/V/A/Z, Praxisregeln (Erinnerung/Pflichtangabe).
- **Posibil lipsă (doar propunere):** din documentația zilei (sursa B), cu aceeași logică din „Fertig”. **Nimic nu devine automat „bereit”.** Faptele din text rămân „necunoscute” până le confirmă medicul, exact ca acum.
- **Rezultatul pe pacient:** verde (nimic), galben (de clarificat), roșu (Ausschluss/limită), gri (date incomplete).

### 4. Ecranul „Tagesabschluss”
- Listă cu toți pacienții zilei: ora chemării, stația, medicul, numărul de constatări; filtre „nur rot/gelb”.
- Click pe un pacient deschide detaliile: aceleași carduri ca în Behandlung, cu dovezile.
- **Ca să găsești pacientul în DURIA:** după ora chemării și ordinea din lista zilei a DURIA. Opțional, după o decizie Datenschutz documentată, butonul „Patientennummer anzeigen” afișează numărul real, doar pentru medic, doar la cerere și cu audit.
- Corecturile rămân **manuale în DURIA** (lista de corecturi existentă). Trimiterea înapoi (GDT 6310) doar după confirmarea DURIA și doar de medic.

### 5. Când pornește
- **Buton „Tag abschließen”** (medic), plus o **amintire la o oră setată** (de ex. 18:00) cât timp programul e deschis.
- **Automat** doar dacă programul rulează. Pe Terminal Server ar fi nevoie de un serviciu Windows separat; propun asta abia într-o etapă ulterioară.
- **Mai mulți medici sau stații:** fiecare are lista lui (din inbox-ul lui). Pentru un raport pe tot cabinetul, sursa A (KVDT) acoperă oricum toți pacienții zilei, deci lista de chemări servește mai ales la ordinea și ora din raport.

### 6. KI în Tagesabschluss (cerința lui Andree, 29.10.2026: „genau lesen und Entscheidungen”)
- **În spatele comutatorului KI existent** (Ein/Aus, implicit „Aus”). Oprit = nicio cerere nu pleacă (testele `ausgeschaltet_geht_keine_anfrage_hinaus` și `ki_aus_kein_text_geht_hinaus_auch_mit_freigabe`).
- **KI propune și explică, nu decide.** Fiecare propunere trece prin motorul de reguli și catalog (`src/kvdt/day-ai.ts`, `reviewAiProposals`), rămâne „unsicher” până la „Annehmen”/„Verwerfen” al medicului, nu devine niciodată „bereit” și nu se scrie în DURIA (cele acceptate merg doar în lista de corecturi).
- **Etapa 1 (permisă acum):** butonul „KI erklären” la fiecare constatare. Pleacă doar: tipul constatării, cifrele/ICD-urile și textul motorului. Fără text din fișă, fără număr sau pseudonim, fără date exacte (Rust le înlocuiește cu „[Datum]” și rulează `minimize()`).
- **Etapa 2 („genau lesen”: text din fișă/dictare):** interfața și minimizarea există în Rust (`src-tauri/src/ai_day.rs`), dar sunt **BLOCATE** de o poartă separată. Doar un medic o deschide, în dialog, după ce confirmă AVV/DPA cu Anthropic, ZDR și DSFA (`ai_stage2_unlock`; se salvează Kürzel și ora). Implicit închisă. Setările generale nu o pot deschide. Cu poarta închisă nu se construiește nici măcar previzualizarea.
- **„Was wird gesendet”** apare înaintea fiecărei cereri (aceeași funcție ca cererea reală). Jurnalul KI nu conține conținut (funcție `tagesabschluss-stufe1/-stufe2`, model, tokeni).
- **Deschis:** sursa textului pentru etapa 2 în Tagesabschluss este exportul BDT pe zi (întrebarea DURIA 23); până atunci butonul rămâne și din acest motiv fără date.

## Ce NU va face
- Nu facturează și nu scrie nimic singur în DURIA.
- Nu garantează că a găsit tot: unde lipsesc date, apare „nicht prüfbar”, nu „in Ordnung”.
- Nu păstrează lista zilei după verificare și nu o trimite nicăieri.

## Datenschutz (de decis înainte de date reale)
- Scopul (verificarea facturării) și termenul (maximum 24 h) trebuie trecute în registrul de prelucrări al cabinetului. Merită verificat dacă intră în evaluarea DPIA existentă.
- Numărul DURIA e dată personală chiar fără nume: criptare DPAPI, acces doar pentru utilizatorul sesiunii, ștergere automată, test că nu apare în loguri, cache sau crash dump.

## Etape
0. **Întrebări noi la DURIA** (se adaugă în `DURIA_FRAGEN.md`):
   - Poate DURIA trimite GDT automat la fiecare chemare (Aufruf)?
   - Se poate genera KVDT oricând, cu data de azi inclusă?
   - Există export BDT pe zi?
   - Poate DURIA deschide un pacient la cererea unui program extern?
1. **Lista zilei în Rust:** chemări GDT, DPAPI, ștergere automată, teste PRIV pentru noul fișier.
2. **Motorul Tagesabschluss:** sursa A (KVDT filtrat pe zi + listă), toate verificările existente, statusul pe pacient. Teste cu zile sintetice.
3. **Ecranul Tagesabschluss** (machetă întâi, cu OK-ul lui Andree), detalii, filtre, lista de corecturi.
4. **Sursa B** (BDT pe zi) pentru „posibil lipsă”, dacă DURIA o oferă.
4b. **KI:** etapa 1 (explicații) odată cu ecranul; etapa 2 doar după AVV/ZDR/DSFA și sursa B.
5. **Ora de amintire / pornirea automată;** serviciu Windows doar dacă se dovedește necesar.
6. **Verificare în aplicația reală** cu zile sintetice, apoi pilot pe serverul cabinetului.
