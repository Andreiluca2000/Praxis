# Plan: Praxis-Assistent față de „Arzt Dashboard” și „EBM+”

29.10.2026 · **doar cercetare și plan**, nimic construit. Cerința lui Andree: Praxis-Assistent să facă ce fac aceste două programe, la fel sau mai bine.

**Cum se citește:** fiecare afirmație despre cele două produse are sursa în paranteză, ca [A1], [E2] etc. (lista e la final). **Fapt** = scrie așa pe pagina sursei. **Presupunere** = concluzia mea, marcată explicit. Paginile producătorilor sunt materiale de marketing, nu teste independente. N-am instalat și n-am încercat niciunul dintre programe.

---

## 1. Ce sunt cele două produse

### 1.1 Arzt Dashboard (medheads IT GmbH, Leipzig*)

\* Leipzig e o presupunere, dedusă din prefixul de telefon 0341 [A1].

**Fapte**
- **Ce face:** verifică automat facturarea pentru Hausärzte, Fachärzte și MVZ: EBM, HZV și contracte speciale. Scopul e să evite Regress-ul și să găsească potențial. Medicul rămâne responsabil, iar fiecare propunere trebuie verificată individual [A1][A2].
- **Cum lucrează:** e un sistem de reguli, nu un LLM, fără chat [A3]. Producătorul declară 22.346 de „Regress-Regeln”, 1.938 de propuneri de optimizare, 773 de cabinete, 17 experți de reguli și 24 de specialități [A1].
- **Rezultatele sunt împărțite în categorii.** Cifrele de mai jos sunt valori demo de pe pagină [A1]:

  | Categorie | Ce înseamnă | Exemplu demo |
  |---|---|---|
  | Nachtrag | prestații neînregistrate | 41 de cazuri, +4.820 € |
  | Potential | prestații care se mai pot factura | 612 cazuri, +151.300 € |
  | Prüfen | diagnoze lipsă sau nesigure | 96 de indicii |
  | Regress | ce va fi tăiat | 24 de cazuri, −2.940 € |
  | Arzneimittel-Regress | substanțe peste Richtgröße | 14 preparate, −14.700 € |
- **Alte module** [A1]:
  - **Praxisentwicklung:** comparație pe trimestre EBM/HZV/GOÄ, cu Fallwert și creștere, plus grafic;
  - **tabel de cifre:** sumă, categorie, număr de pacienți;
  - **Chroniker-Analyse:** 03220, 03221, 03360;
  - **Gesprächsziffern-Analyse:** 03230, 03230V, 35100, 35110, cu cota reală față de cota-țintă, pierderea maximă prin Abstaffelung și tabele pe medic;
  - **„Prüf- und Plausibilitätszeiten”;**
  - **fișe de pacient** cu diagnoze și istoric;
  - **Fachgruppenvergleich;**
  - **dale KPI:** Umsatz, Behandlungsfälle, Fallwert.
- **Exemplul citat de Andree:** geriatrische Diagnostik 03360/03362 la pacienți peste 70 de ani, nefacturată deși condițiile erau îndeplinite [A3][A4].
- **„Arzt Dashboard Live”:** propunerile apar chiar înaintea tratamentului, în fluxul PVS. Un clic pe pacient deschide regulile lui [A1].
- **Legătura cu PVS** [A1][A5]:
  - **direct, prin baza de date:** EL, Medatixx, Medical Office, Medistar, T2med, tomedo, x.concept, x.vianova/x.isynet;
  - **prin fișierul KVDT (.con):** Albis, **DURIA**, M1, turbomed și altele.

  Producătorul spune că rezultatele sunt identice pe ambele căi.
- **Pașii pentru DURIA, după ghidul lor** [A5]: Abrechnung → KV-Abrechnung → trimestrul (eventual medicul, Betriebsstätte sau Abrechnungskreis) → „Abrechnung starten (ohne Versand)”. DURIA arată apoi calea fișierului, de exemplu `C:\Duria\Abrechnungen\`.
- **Date** [A1][A2]:
  - datele pacienților rămân pe calculatorul cabinetului;
  - pentru analiză se trimit doar prestațiile și diagnozele codate, pseudonimizate și criptate (TLS 1.3), la un server Hetzner din Germania;
  - pseudonimizarea se desface doar în client.
- **Certificare:** FAQ-ul spune „zertifiziert” și „begleitet” de RiG Rechtsanwaltsgesellschaft mbH [A2]. Nu se spune ce certificare, după ce standard și de cine. KI-Syndikat observă că formularea e neclară [A3]. Declarația de confidențialitate a site-ului nu acoperă prelucrarea din program [A6]. După KI-Syndikat, există un AVV [A3]; FAQ-ul nu-l menționează [A2].
- **Preț** [A1][A2]:
  - de la 99 €/lună pentru un medic (1 BSNR, 1 LANR);
  - fiecare medic în plus: 19 €;
  - module opționale de câte 19 €: HZV (pe medic HZV), legătura cu baza de date, încă o Betriebsstätte;
  - 30 de zile gratuit; apoi reziliere la capătul ciclului de 3 luni.
- **Tehnic** [A2]: Windows 10/11 și macOS; licența e legată de BSNR și LANR, pe oricâte calculatoare; actualizări automate. Analiza acoperă trimestrul curent, ideal patru trimestre.

**Presupuneri**
- **Live nu merge cu DURIA:** pentru DURIA, Arzt Dashboard lucrează doar cu fișierul KVDT. Live-ul („înaintea tratamentului”) pare să ceară legătura directă la baza de date, care nu există pentru DURIA [A1]. Deci pentru cabinetul lui Andree ar fi doar o verificare după trimestru sau după un export manual. **De confirmat la medheads.**
- **HZV poate fi incomplet:** un testimonial vorbește despre HZV la viitor („künftig”) [A1].
- **Surse contradictorii:** KI-Syndikat scrie „keine direkte PVS-Anbindung” [A3], dar pagina producătorului numește legături directe [A1]. Probabil KI-Syndikat a descris o versiune mai veche.

### 1.2 EBM+ (adsanum healthcare GmbH, Hamburg; în spate e Conclusys, condusă de Markus Knöfler)

**Identificare (presupunere):** „EBM +” e foarte probabil `ebm-plus.de`. O căutare după „EBM +” găsește și aplicația gratuită a KBV, KBV2GO! (catalogul EBM pe telefon) [E5][E6], dar aceea e doar o carte de consultat, nu o verificare a facturării. **De confirmat cu Andree** că la EBM+ s-a gândit.

**Fapte**
- **Ce este:** un „PlugIn” pentru „toate” programele PVS certificate de KBV, o asistență digitală pentru KV-Abrechnung. Nu numește niciun PVS anume [E1][E2].
- **Regulile:** EBM-ul conține „circa 6.000” de reguli de facturare și codare, iar EBM+ ar conține „aproape toate” [E3]. Programul lucrează după ce s-au introdus prestațiile, cifrele și diagnozele [E3].
- **Afișarea e un semafor cu patru culori** [E1]:
  - **verde:** complet și corect;
  - **galben:** abateri sau plauzibilitate, de avut în vedere la codare;
  - **roșu:** risc de tăiere, erori sau excluderi;
  - **albastru:** potențial, adică prestații suplimentare.
- **Alte funcții** [E1]: ajutor la codarea diagnozelor (mai puțin risc de răspundere), cifre medicale și financiare, actualizări EBM, mai mulți utilizatori (BSNR, NBSNR, LANR).
- **Date:** „toate datele de facturare rămân în cabinet”, „100 % datenschutzkonform” [E1]. Declarația de confidențialitate acoperă doar site-ul [E4].
- **Preț:** nepublicat. Oferă o demonstrație online și un „Probe-Quartal” de trei luni [E1][E2].
- **Suport:** instalare și instruire online incluse, consultanță opțională, mentenanță de la distanță prin TeamViewer [E1][E2].
- **Ce nu se găsește public:** număr de reguli verificabil, capturi detaliate, listă de PVS, HZV, GOÄ, certificare proprie. Certificarea KBV menționată pe pagină e a PVS-ului, nu a EBM+ [E1].

**Presupuneri**
- **Nu e clar când verifică:** dacă EBM+ verifică în timpul tratamentului sau doar la trimestru nu se spune. Formularea „Quartalsabrechnung” [E3] sugerează verificarea înainte de trimiterea trimestrială.
- **Legătura cu DURIA e necunoscută:** cum se leagă un „PlugIn” de DURIA fără o interfață publică nu e explicat. Probabil tot prin export (KVDT/BDT) sau prin acces la baza de date. **De întrebat la demo.**

---

## 2. Tabel de funcții: ei / noi / gol

Legendă pentru „Noi”: ✅ există și e testat, 🟡 parțial sau doar plan, ❌ lipsește. Sursele pentru „noi” sunt `docs/STATUS_CLAUDE.md`, `REMAINING_WORK_20261026.md`, `BILLING_*`, `TAGESABSCHLUSS_PLAN.md`, `PRAXISREGELN_PLAN.md` și `FORMULARE.md`.

| Funcție | Arzt Dashboard | EBM+ | Praxis-Assistent azi | Gol / ce trebuie |
|---|---|---|---|---|
| Citește KVDT-ul trimestrului | da (.con) [A1] | neclar | ✅ `read_kvdt`, cu pseudonime în Rust | — |
| Legătură live cu DURIA în timpul tratamentului | doar KVDT pentru DURIA (presupunere) | neclar | ✅ GDT/BDT la chemare, Fertig, Behandlung | **Avantajul nostru** |
| Excluderi și perechi (Regress) | da [A1] | da, roșu [E1] | ✅ perechi pe ședință (1.265 în registru), 🟡 zi/caz/Krankheitsfall (31 de excluderi, 8 frecvențe), totul „Entwurf” | Probele din dosare, rezolvarea constatărilor Opus (loaderul `combinations`, vârsta, HZV necunoscut), aprobarea profesională |
| Diagnoză lipsă sau nesigură | „Prüfen” [A1] | galben, codare [E1] | ✅ caz fără diagnoză, diagnoză fără G/V/A/Z, ICD-10-GM 2026 | Plauzibilitatea cifră ↔ diagnoză (de ex. Chroniker fără diagnoză cronică) |
| **Cifre uitate pe tot trimestrul** (de ex. 03360/03362 > 70 de ani) | „Potential” / „Nachtrag” [A1] | albastru [E1] | 🟡 Fertig propune doar din documentația pacientului deschis | **Gol mare:** reguli de potențial pe toți pacienții din KVDT; **vârsta lipsește** (Rust scoate data nașterii; „vârsta în Rust” e deschis) |
| Valori în € | da, pe categorie [A1] | „cifre financiare” [E1] | ❌ | Punctele EBM × Orientierungswert-ul oficial (din sursa KBV, cu ediția) |
| KPI: cazuri, Fallwert, Umsatz | da [A1] | da [E1] | ❌ | Panou trimestrial, doar cu cifre agregate |
| Comparație între trimestre | da, Q1/2025–Q2/2026 [A1] | neclar | ❌ | Mai multe fișiere KVDT; se păstrează doar totalurile, fără pacienți |
| Analiza Chroniker (03220/03221) | da [A1] | neclar | 🟡 dosarul Codex cronici (25 de clauze, selectorul 03100) | Regula „diagnoză cronică în ≥ 3 trimestre” cere istoricul a 4 trimestre |
| Gesprächsziffern 03230 (volumul Praxis, Abstaffelung) | da, cota și pierderea în € [A1] | — | 🟡 dosarul `frequency`: 03230 = 64 de puncte × cazuri, încă neintegrat | Calculul cotei pe cabinet și pe LANR |
| Prüfzeiten / plauzibilitate | da [A1] | galben, „Plausibilität” [E1] | ❌ | Profilul de timp pe zi și pe trimestru, pe LANR, din timpii de verificare EBM (Anhang 3) |
| Mai mulți medici (LANR) / Betriebsstätten | da, preț pe LANR [A1] | da [E1] | 🟡 conturi pe Kürzel; KVDT nu e grupat pe LANR | Grupare pe LANR/BSNR în raport |
| HZV | modul opțional [A1] | nemenționat | 🟡 structură fără contract (decizia lui Andree) | După ce se știe contractul |
| GOÄ | doar în graficul de evoluție [A1] | nemenționat | 🟡 47 de profiluri aritmetice, 178 de perechi | Nu e prioritar pentru verificarea KV |
| Arzneimittel-Regress | da [A1] | — | ❌ | Datele de medicație nu sunt în KVDT, iar Richtgrößen/Wirkstoffvereinbarung depind de KV. **Nu acum** |
| Comparație cu specialitatea | da [A1] | — | ❌ | Cere date externe ale grupului de medici. **Nu acum** |
| Verificare zilnică (Tagesabschluss) | nemenționat | nemenționat | 🟡 plan scris | **Avantajul nostru**, de construit |
| Reguli proprii ale cabinetului | „personalizări contra cost” [A2] | — | ✅ Praxisregeln: versiuni, simulare, audit, „doar mai strict” | **Avantajul nostru** |
| Formulare Muster | — | — | ✅ 58 de vordrucke, verificare cu sursă | **Avantajul nostru** |
| Dictare → propuneri de cifre | — | — | ✅ Diktat → fapte → Fertig, cu confirmare | **Avantajul nostru** |
| Listă de corecturi pas cu pas pentru DURIA | „manual în PVS” [A3] | — | ✅ cu buton „In DURIA erledigt” | **Avantajul nostru** |
| Sursa (citatul din normă) la fiecare constatare | nemenționat | nemenționat | ✅ locator + citat, plus starea „nicht prüfbar” | **Avantajul nostru** |
| Unde se prelucrează datele | server în Germania, pseudonimizat [A2] | „rămân în cabinet” [E1] | ✅ local; KI e oprit; etapa 2 a KI doar cu AVV/DSFA | Avantajul nostru față de Arzt Dashboard (nu e nevoie de AVV pentru verificare) |
| Preț | de la 99 €/lună [A1] | nepublicat | propriu | — |
| Actualizare EBM trimestrială | automată [A2] | „regulat” [E1] | 🟡 dosarele au valabilitate (Q4/2026); procedura de actualizare e deschisă | Procedura de actualizare pe ediții |

---

## 3. Ce preluăm ca idee (fără cod, fără texte, fără design)

Preluăm **doar idei funcționale**, care sunt practică generală în verificarea facturării. Nu copiem texte, denumiri de module, culori, așezarea paginii, liste de reguli sau cifre de marketing. Regulile noastre vin din EBM, KBV și G-BA, cu sursă, prin Codex.

1. **Împărțirea constatărilor după ce are de făcut medicul**, cu denumiri proprii, de exemplu:
   - „Risiko Streichung”: excludere sau limită depășită;
   - „Zu klären”: diagnoză, oră sau durată lipsă;
   - „Vermutlich vergessen”: potențial din date;
   - „Nachtragen möglich”: documentat, dar neînregistrat.

   Plus categoria noastră „Nicht prüfbar”, pe care ei nu o au.
2. **Potențial pe tot trimestrul:** reguli de tip „condițiile par îndeplinite, cifra lipsește”, pe toți pacienții din KVDT. Exemplul lui Andree (03360/03362 la vârstă înaintată) e primul caz de test. Condițiile exacte vin din EBM, prin Codex, nu din pagina lor.
3. **Sume în €** pe fiecare constatare și pe categorie, cu calculul arătat (puncte × Orientierungswert, cu ediția).
4. **Un panou al trimestrului** cu câteva cifre (cazuri, puncte, €, Fallwert) și **evoluția pe trimestre**.
5. **Analize pe teme** care contează la Hausarzt: Chroniker, Gesprächsziffern (volumul 03230), plauzibilitatea timpilor, pe cabinet și pe medic.
6. **Rezultate pe medic (LANR)** într-un cabinet cu mai mulți medici.
7. **Probă gratuită pe un trimestru:** ideea „încarcă KVDT-ul trimestrului trecut și vezi ce s-a pierdut” e cea mai bună demonstrație. Pentru noi asta e un **mod demo**, nu un model de vânzare.

---

## 4. Unde putem fi mai buni

1. **Înainte de trimitere, nu după.** Ei verifică trimestrul încheiat (sau, pentru DURIA, doar KVDT-ul, presupunere). Noi verificăm **la pacient** (Fertig, Behandlung), **în fiecare seară** (Tagesabschluss) și **înainte de trimiterea trimestrului** (KVDT, „ohne Versand”). O cifră uitată se poate adăuga încă în trimestrul curent, nu doar se constată.
2. **Legătura directă cu DURIA prin GDT:** pacientul deschis în DURIA apare imediat, iar propunerile pornesc de la ce s-a scris și dictat azi, nu doar de la ce s-a facturat.
3. **Fiecare constatare are dovada:** citatul din normă, ediția și starea în trei variante (îndeplinit / neîndeplinit / „nicht prüfbar”). Niciun „22.346 de reguli” neverificabil; afișăm acoperirea reală, cu golurile vizibile.
4. **Reguli proprii ale cabinetului**, versionate, simulate pe KVDT și auditate, care pot doar să înăsprească. La ei, personalizarea se plătește separat [A2].
5. **Datele nu pleacă din cabinet.** Verificarea rulează local, fără server extern și fără AVV pentru facturare. KI (Claude) rămâne opțional, oprit implicit, iar etapa cu date de pacient vine doar cu AVV/DSFA.
6. **Totul într-un singur program:** facturare, ICD, formulare, dictare, corecturi. Ei acoperă doar facturarea.
7. **Lista de corecturi pentru DURIA:** pași concreți („12.11. · 03360 nachtragen · Grund …”), bifați „erledigt”, nu doar o listă de constatări.
8. **Ușor de folosit:** designul „Soft Premium” deja ales, puține cifre mari, „ce am de făcut acum” primul, detaliile la un clic.

---

## 5. Ordinea de lucru, pe etape

Efortul e **o estimare a timpului de programare Claude**, nu un termen. Nu include conținutul Codex, aprobarea profesională, răspunsurile DURIA și OK-ul lui Andree pe machete, de care depinde fiecare etapă. S ≈ 1–2 zile, M ≈ 3–5 zile, L ≈ 1–2 săptămâni.

| # | Etapă | Ce se face | Depinde de | Efort |
|---|---|---|---|---|
| 0 | **Fundația** | Vârsta (în ani, la data prestației) calculată în Rust și trimisă în locul datei nașterii, în GDT/BDT și în KVDT. Gruparea KVDT pe LANR/BSNR. Rezolvarea constatărilor Opus 1–3 (loaderul `combinations`, frecvențele pe vârstă, HZV necunoscut ⇒ „nicht prüfbar”). Completarea fluxului DURIA (secțiunea 6) | sesiunea care deține motorul; descrierea lui Andree | M |
| 1 | **Raportul trimestrial, versiunea 2** | Constatările KVDT existente împărțite în categoriile din §3.1, cu „Nicht prüfbar” vizibil; dale cu cazuri, puncte, €; listă pe pacient (pseudonim) cu acțiunea și dovada; export al listei de corecturi. Machetă întâi | Orientierungswert 2026 cu sursă (Codex); OK pe machetă | M |
| 2 | **Potențial („vermutlich vergessen”)** și **diagnoză ↔ cifre** (detaliat în §7) | Format nou de regulă „condiții → cifră așteptată” și invers, cu trei stări și sursă. Primul set Hausarzt, de la Codex: 03360/03362, 03220/03221 (cu istoric), 01732, Hautkrebs-Screening, 03040/Vorhaltepauschale, Zuschläge. Nimic nu devine automat „bereit”; e doar o propunere de verificat | Codex: condițiile exacte; 4 trimestre de KVDT pentru istoric | L |
| 3 | **Analize pe teme** | Gesprächsziffern (volumul 03230 pe cabinet și LANR, din dosarul `frequency`); plauzibilitatea timpilor pe zi și pe trimestru, din timpii de verificare EBM (pragurile din Richtlinien zur Plausibilitätsprüfung, de verificat de Codex); Chroniker | Codex: Anhang 3 EBM și pragurile | M |
| 4 | **Tagesabschluss** | Planul existent (`TAGESABSCHLUSS_PLAN.md`), cu aceleași categorii ca raportul trimestrial, ca „trimestrul” și „ziua” să arate la fel | răspunsurile DURIA (GDT la chemare, KVDT oricând) | L |
| 5 | **Evoluție între trimestre** | Mai multe KVDT-uri; se păstrează doar totaluri pe trimestru (cazuri, puncte, €, pe categorie), fără date de pacient; grafic | etapa 1 | S–M |
| 6 | **Mod demo** | Un KVDT sintetic cu pacienți inventați care arată fiecare categorie, pentru prezentări și teste | etapele 1–2 | S |
| 7 | **Mai târziu, doar cu date** | HZV (când e cunoscut contractul); GOÄ în panou; Arzneimittel-Regress (cere medicația și Richtgrößen KV Nordrhein/WL); comparația cu specialitatea (cere date publice ale KV) | contracte și surse | L (fiecare) |

**Ce e de verificat înainte să promitem ceva** (întrebări pentru o demonstrație gratuită la ei, opțional, dacă Andree vrea): cum funcționează Live-ul cu DURIA, ce reguli de potențial găsesc pe un KVDT sintetic, cum arată certificarea Arzt Dashboard (cine, după ce standard), cum se leagă EBM+ de DURIA și cât costă.

---

## 6. Flux Quartalsabrechnung DURIA – de completat

> **De completat când Andree trimite descrierea.** Până atunci, ce se știe e doar din surse terțe și trebuie confirmat.

**Ce spune o sursă terță (Arzt Dashboard, nu DURIA) [A5]:** Abrechnung → KV-Abrechnung → trimestrul (eventual medicul, Betriebsstätte, Abrechnungskreis) → „Abrechnung starten (ohne Versand)”. DURIA afișează apoi calea fișierului `.con`, de exemplu `C:\Duria\Abrechnungen\`. Întrebarea 19 din `DURIA_FRAGEN.md` acoperă același lucru.

**De aflat de la Andree, pas cu pas:**
1. Când începe Quartalsabrechnung (data, cine o face: medicul, MFA, firma de facturare)?
2. Pașii exacți în meniul DURIA, cu denumirile de pe ecran.
3. Se rulează întâi o probă („ohne Versand” sau Prüflauf)? De câte ori?
4. Ce arată KBV-Prüfmodul (erori, avertizări) și cum se corectează în DURIA?
5. Unde se salvează fișierul `.con` și cum se numește? E criptat în acel moment?
6. Cum se trimite (KV-Connect / KIM / portalul KV) și ce confirmare vine?
7. Ce se verifică manual azi, înainte de trimitere (liste, Scheine fără diagnoză, Chroniker, vizite)?
8. Cum se tratează HZV (separat, alt fișier, alt termen)?
9. Cât timp durează azi și unde se pierde cel mai mult timp?

**Unde intră Praxis-Assistent (de stabilit după descriere):**
- după proba „ohne Versand”: încărcare `.con` → raportul trimestrial (etapa 1) → lista de corecturi → corecturi în DURIA → o nouă probă → trimiterea;
- în timpul trimestrului: Tagesabschluss (etapa 4) și o probă intermediară la jumătatea trimestrului, dacă DURIA permite un KVDT oricând.

---

## 7. Cerințe noi de la Andree: diagnoză ↔ cifre (29.10.2026)

### 7.1 Ce i s-a spus lui Andree și ce confirmă sursele publice

Andree a aflat de la ChatGPT ce ar face Arzt Dashboard. **Sursa e neverificată.** Am comparat fiecare afirmație cu paginile publice.

| # | Ce i s-a spus | Confirmat public? |
|---|---|---|
| a | Scanează fișierul Quartalsabrechnung și recomandă cifrele scăpate | **Da:** KVDT `.con` [A1][A5], categoriile Nachtrag și Potential [A1] |
| b | Diagnoză fără cifre (de ex. Diabetes Typ 2 fără Chroniker sau DMP) | **Parțial:** există Chroniker-Analyse și „Zuschläge bei DMP-Komplikationen” [A1][A3]. Exemplul exact „E11 → cifre” nu apare |
| c | Cifre fără diagnoza care le justifică | **Parțial:** categoria „Prüfen: fehlende oder unsichere Diagnosen” [A1] |
| d | „HCV” → pacient HZV fără cifrele HZV | **Parțial:** modulul HZV există [A1]; regula exactă nu apare. Varianta hepatita C e la cerința R6 |
| e | Anamneză fără cifră | **Nu se găsește** |
| f | Privat (GOÄ): Blutabnahme fără cifrele GOÄ | **Nu se găsește.** GOÄ apare doar în evoluția pe trimestre [A1]. După KI-Syndikat, cabinetele private GOÄ nu sunt acoperite [A3] |
| g | PSA (valoare sau test) fără cifră | **Nu se găsește** |
| h | „Q-dry” | **Corectat de Andree (29.10):** „3 nu q 3, m-am referit la cifra 3”. E o **cifră (Ziffer) 3**, nu trimestrul 3. Ce cifră anume e întrebare deschisă (§7.8) |

Blogul Arzt Dashboard are articole despre 03360, 03220/03221, 03100, 03230/35100 și HZV, dar nu descrie verificări concrete de tipul b–g [A7]. **Concluzie:** cerințele de mai jos le tratăm ca **cerințele lui Andree**, nu ca o copie a unui produs.

### 7.2 Ce verifică azi `src/kvdt/quarter-check.ts` / `ui/QuarterCheck.tsx`

- **Pe fiecare Schein (0101–0104)** [cod]:
  - „Fall mit Leistungen, aber ohne Diagnose”;
  - „Diagnose ohne Sicherheit (G/V/A/Z)”;
  - cifră fără Leistungstag;
  - dată în afara trimestrului;
  - conflicte din regulile DEMO sau draft (`billing_conflict`);
  - Praxisregeln, ca Hinweis.
- **Doar în simulator:** perechi pe ședință și excluderi pe zi, caz sau Krankheitsfall, plus frecvențe.
- **Ce nu face încă:**
  - Nicio legătură **între o diagnoză anume și o cifră anume**, în niciun sens.
  - Toate cifrele sunt citite ca `system: 'EBM'`.
  - Fără vârstă și sex (Rust le scoate împreună cu data nașterii), fără LANR.
  - Un singur trimestru: nu există istoric.
  - FK 5005 (multiplicatorul) nu e numărat.

### 7.3 Limita surselor: ce se poate vedea din KVDT

- **KVDT e fișierul pentru KV, deci conține doar cazuri GKV/KV** [cod, comentariul din `quarter-check.ts`; fapt general KBV].
- **Pacienții privați (GOÄ) nu sunt în el.** Probabil nici cazurile HZV, care se facturează separat (de confirmat în DURIA).
- **Rezultatele de laborator nu sunt în el** (de ex. valoarea PSA), nici textul din fișă (anamneza).

Pentru f, g, e și pentru „HZV fără cifre HZV” e nevoie de **BDT** (zi sau trimestru), de exportul privat sau HZV din DURIA, ori de GDT-ul pacientului deschis. Fără aceste surse, rezultatul trebuie să fie **„nicht prüfbar”**, nu „in Ordnung”. Întrebări noi la DURIA: există export BDT pe zi sau trimestru care conține și Privat și HZV? Laboratorul (LDT) e în BDT?

### 7.4 Cerințele concrete

Două tipuri noi de regulă. Ambele sunt **doar propuneri**: niciodată „bereit” automat, niciodată „Fehler”, iar fiecare are sursa din normă.

- **R-DX→GOP („diagnoză → cifre așteptate”):** diagnoza X, cu certitudine G pusă de medic, plus condițiile Y (vârstă, sex, istoric) înseamnă că se așteaptă una dintre cifrele Z în fereastra W. Lipsește? → „Vermutlich vergessen”. Condiție neverificabilă din date? → „Nicht prüfbar” cu lista condițiilor lipsă.
- **R-GOP→DX („cifră → diagnoza care o justifică”):** cifra Z cere o diagnoză din lista X în același caz. Lipsește? → „Begründung fehlt” (categoria „Zu klären”).

| # | Cerința (de la Andree) | Tip | Sursa de date necesară | Bază existentă în `data/billing/` | Ce lipsește |
|---|---|---|---|---|---|
| R1 | Diabetes Typ 2 (E11.-) G → Chroniker 03220/03221 | DX→GOP | KVDT pe **4 trimestre** (continuitate) | `chroniker/` (25 de clauze: `03220_CONTINUITY` cere „3 din 4 trimestre”, 03221, 03222 de la KV); `rules.draft.2026-q4.json` (`EBM_03220/03221_CORE_DRAFT`) | Lista ICD „chronisch krank” pentru 03220 (lista 03100 **nu** e aceeași, scrie în README-ul chroniker); istoricul pe 4 trimestre în motor |
| R2 | Diabetes / alte boli DMP → cifre DMP | DX→GOP | KVDT + participarea la DMP | **nimic**: DMP nu apare în dosare | Cifrele DMP sunt **regionale**. **KV e acum aleasă: Nordrhein** (Andree, 29.10). Codex trebuie să aducă contractele DMP ale KV Nordrhein (Diabetes Typ 2 întâi): sursă, cifre, documentație, perioadă |
| R3 | Versorgungspauschale 03100 ↔ diagnoză din listă | GOP→DX și DX→GOP | KVDT (+ medicație, care nu e în KVDT) | `chroniker/` 03100_DIAGNOSIS (26 de coduri ICD), 03100_AGE, 03100_MEDICATION; `search-chroniker.py` | Medicația nu e în KVDT → componentă „nicht prüfbar” |
| R4 | Geriatrie 03360/03362 la vârstnici (exemplul Arzt Dashboard) | DX→GOP | KVDT + **vârsta** | `rules.draft` `EBM_03360/03362_CORE_DRAFT` (excluderi, 1×/caz, documentație); `combinations/` `EBM_03360/03362_*` | Vârsta și criteriile geriatrice din legenda 03360 (EBM p. 205) **nu sunt modelate** în eligibilitate (de completat de Codex); vârsta în Rust |
| R5 | Cifre fără diagnoză justificativă (în general) | GOP→DX | KVDT | `quarter-check` are doar „caz fără nicio diagnoză”; `wounds/` (excepția D22.-/T01.- pentru 02300–02302) | Liste cifră → ICD pe fiecare cifră Hausarzt (Codex), doar unde norma o cere; altfel nu se inventează nimic |
| R6 | „HCV” ca hepatita C: Check-up ≥ 35 fără screeningul unic de hepatită | DX→GOP (prevenție) | KVDT + istoric + vârstă | `prevention/`: `HEPATITIS_AGE_ONCE`, `HEPATITIS_REFLEX`, `CHECKUP_35_INTERVAL` (cifra 01734 e acolo) | „O singură dată” cere istoric lung → mai ales „nicht prüfbar”; vârsta |
| R7 | „HCV” ca HZV: pacient înscris în HZV fără cifrele HZV | DX→GOP (contract) | export HZV / BDT cu marcajul HZV | `hzv/`: doar șablonul de contract, fără contract (decizia lui Andree) | Contractul HZV, Ziffernkranz, marcajul de înscriere din DURIA |
| R8 | Anamneză documentată fără cifră | DX→GOP | BDT / GDT (text) + confirmare | `rules.draft` GOÄ 1/3/5; `primary-care/` (serviciile incluse în Pauschale **nu** devin cifre lipsă) | Pentru EBM, anamneza e de regulă inclusă în Versichertenpauschale → nu e regulă. Are sens doar la **GOÄ** sau la contracte HZV. **De lămurit cu Andree ce a vrut să spună** |
| R9 | Privat: Blutabnahme fără GOÄ | DX→GOP | BDT / exportul privat (KVDT nu ajunge) | `rules.draft` `GOAE_250_CORE_DRAFT`, `GOAE_252_CORE_DRAFT`; `goae/` (profiluri de factor 250…) | Sursa de date a cazurilor private din DURIA; recunoașterea „Blutabnahme” în fișă (Fertig o poate face, cu confirmare) |
| R10 | PSA (test/valoare) fără cifră | DX→GOP | BDT cu laborator (LDT) sau fișa | `prevention/` `MALE_CANCER_*` (KFE bărbați); catalogul EBM/GOÄ indexează PSA | **Lămurit (Andree, 29.10): PSA e pentru pacienții privați**, deci regula e GOÄ: PSA documentat sau ca rezultat de laborator la un pacient privat fără poziția GOÄ potrivită (laborator și eventual Blutentnahme). Codex: pozițiile GOÄ exacte, cu sursă. Date: exportul privat / BDT, nu KVDT |
| R11 | „Ziffer 3” lipsă (fostul „Q-dry”) | DX→GOP, probabil GOÄ | după variantă (§7.8): pentru GOÄ, exportul privat / BDT cu durata | `rules.draft` `GOAE_3_CORE_DRAFT` (≥ 10 min, documentație, nu lângă Nr. 2 și 804–887); `combinations/` `GOAE_3_ONLY_WITH` (Nr. 3 doar singură sau lângă 5, 6, 7, 8, 800, 801; interval nerezolvat) | Varianta exactă (§7.8); durata consultației din fișă sau dictare, confirmată de medic |

### 7.5 Unde rulează

- **Raportul trimestrial (KVDT):** R1–R6 pe toate cazurile GKV. R1, R4 și R6 au nevoie de istoric: Andree încarcă și KVDT-urile ultimelor trimestre. **Istoricul se păstrează** (decizia lui Andree, 29.10), cu regulile din §7.7.
- **Tagesabschluss:** aceleași reguli, filtrate pe ziua curentă. R8–R10 doar cu sursa B (BDT pe zi).
- **Live (Fertig / Behandlung):** R-GOP→DX ca frână („cifra are nevoie de diagnoza …”), R-DX→GOP ca propunere, cu confirmarea medicului.

### 7.6 Ce trebuie construit

1. **Codex (conținut):** un dosar nou `dx-expectations` (draft, neoperativ). Fiecare înregistrare are:
   - declanșatorul: prefixe ICD, certitudinea cerută, vârstă/sex dacă norma le cere;
   - cifrele așteptate sau diagnozele cerute;
   - fereastra;
   - condițiile care nu se văd în KVDT;
   - sistemul (EBM / GOÄ / HZV / DMP-KV);
   - ancora în normă.

   Prima tranșă: R1, R3, R4, R5 (doar unde norma cere o diagnoză), R6.
2. **Claude (motor):**
   - vârsta și sexul calculate în Rust, la data prestației, fără data nașterii;
   - sistemul cifrei (EBM/GOÄ/HZV) în `BilledService`;
   - istoric pe mai multe trimestre;
   - evaluatorul R-DX→GOP / R-GOP→DX cu trei stări;
   - categoriile „Vermutlich vergessen” și „Begründung fehlt” în raportul trimestrial și în Tagesabschluss.
3. **Andree / DURIA:** ce înseamnă „Anamnese” (încă deschis); exportul privat/HZV/BDT.

**Efort Claude:** M pentru motor și UI, după ce vine prima tranșă de conținut. Conținutul Codex și revizia profesională sunt separate (L).

### 7.7 Deciziile lui Andree (29.10.2026) și ce rezultă

| Decizie | Ce rezultă pentru lucru |
|---|---|
| **„Q-dry” = cifra 3** (corectat: nu trimestrul 3) | O cerință „Ziffer 3 lipsă” (R11). Prima analiză rămâne pe fișierul de facturare al **trimestrului curent**. Care cifră 3: întrebare deschisă în §7.8 |
| **PSA e pentru privați** | R10 devine regulă GOÄ. Nu se vede în KVDT; depinde de exportul privat din DURIA (întrebare nouă la DURIA) |
| **KV Nordrhein** | Profilul cabinetului: KV Nordrhein. Codex: contractele DMP KVNO, acordurile de vaccinare, Wegepauschalen și HVM KVNO. `REMAINING_WORK_20261026.md` spune încă „KV neales”: de actualizat de sesiunea care deține acel document |
| **Istoricul se păstrează** | **Tehnic:** pseudonimul trebuie să fie **stabil între trimestre**. Azi e HMAC per sesiune: e nevoie de o cheie HMAC permanentă, păstrată în Windows Credential Manager / DPAPI, niciodată în fișier. Se păstrează doar fapte minime pe pseudonim: trimestru, cifră, dată, ICD + certitudine, an de naștere sau grupă de vârstă (nu data nașterii), fără nume și fără text liber. Stocare criptată (DPAPI) în `ProgramData`, acces doar pentru medic. **Propunere de termen:** 12 trimestre (3 ani), cât cer intervalele Check-up/Hautkrebs; ce e mai vechi se șterge automat; „Verlauf löschen” la cerere. **Datenschutz:** de trecut în registrul de prelucrări al cabinetului (scop: verificarea facturării; termen) și în DSFA; test că nu apare în loguri. Termenul exact îl confirmă Andree |

### 7.8 Întrebare deschisă pentru Andree: care „cifră 3”?

Andree a spus „Q-dry” în lista despre Arzt Dashboard, imediat după anamneză, privați (Blutabnahme) și PSA. Apoi a corectat: „m-am referit la cifra 3”. Variantele posibile, de la cea mai probabilă:

| Variantă | Ce ar însemna regula | De ce s-ar potrivi / de ce nu | Ce avem deja |
|---|---|---|---|
| **A. GOÄ Nr. 3**, „eingehende Beratung, mindestens zehn Minuten” (**recomandarea mea**) | La un pacient privat cu consultație lungă documentată (≥ 10 min, de ex. anamneză amănunțită) lipsește Nr. 3. Sau invers: Nr. 3 e pusă lângă poziții cu care nu se poate | Apare în aceeași listă cu privați, Blutabnahme, PSA și anamneză; „Ziffer 3” e denumirea obișnuită la GOÄ. Ar lega și cerința „Anamnese” (R8) de GOÄ | `GOAE_3_CORE_DRAFT`, `GOAE_3_ONLY_WITH`, profil de factor GOÄ; durata vine din Fertig/dictare, cu confirmare |
| **B. Capitolul 3 EBM** (cifrele de medic de familie 03xxx, de ex. Versichertenpauschale 03000) | Caz GKV cu contact, dar fără Versichertenpauschale sau fără suplimentele din capitolul 3 | Se potrivește cu „Hausarzt”, dar Andree a spus „cifra 3”, nu „capitolul 3” | `pauschalen/` (49 de clauze, 03000–03048), `chroniker/` |
| **C. O cifră anume din capitolul 3 EBM** (de ex. 03230 Gespräch, 03360 Geriatrie) | La fel ca R1/R4 sau Gesprächsziffern | Ar fi spus probabil numărul întreg | `rules.draft`, `frequency/` (03230) |
| **D. GOÄ Nr. 1 sau 3 ca „Beratung” la privați, legate de anamneză** | O singură regulă pentru R8 + R11: anamneză sau consultație documentată la privat, fără Nr. 1 sau Nr. 3 | Variantă a lui A; depinde ce înseamnă „Anamnese” pentru Andree | `GOAE_1_CORE_DRAFT`, `GOAE_3_CORE_DRAFT` |
| **E. Altceva din DURIA** (o tastă rapidă, un lanț de cifre, un cod de contract HZV „3”) | Nu se poate spune fără descriere | Nu găsesc nimic public; mai puțin probabil | — |

**Întrebarea pentru Andree, într-o propoziție:** „Cifra 3 e GOÄ Nr. 3 (consultație de minimum 10 minute la privați) sau altă cifră? Și «Anamnese» înseamnă același lucru, adică privați?”

---

## 8. Surse

Accesate pe 29.10.2026. „[cod]” înseamnă codul din acest repo (`src/kvdt/quarter-check.ts`, `data/billing/*`), citit pe 29.10.2026. Dosarele `chroniker/`, `combinations/`, `goae/` și `hzv/` sunt **necomise** în git în acest moment.

- [A7] arzt-dashboard.de, blog (titluri de articole) – https://arzt-dashboard.de/blog

- [A1] arzt-dashboard.de, pagina principală (funcții, PVS, prețuri, cifre, testimoniale) – https://arzt-dashboard.de/
- [A2] arzt-dashboard.de, FAQ – https://arzt-dashboard.de/faq
- [A3] KI-Syndikat, „Arzt Dashboard” (prezentare de terță parte, după propria declarație fără test practic) – https://www.ki-syndikat.de/tools/arzt-dashboard/
- [A4] KI-Syndikat, Use-Case Abrechnungsoptimierung – https://www.ki-syndikat.de/usecases/gesundheit/20-abrechnungsoptimierung/ (din rezultatele căutării; pagina n-am deschis-o)
- [A5] arzt-dashboard.de, ghid fișier KVDT (inclusiv DURIA) – https://arzt-dashboard.de/kvdt-datei
- [A6] arzt-dashboard.de, Datenschutz (doar site-ul) – https://arzt-dashboard.de/datenschutz
- [E1] ebm-plus.de, pagina principală (semafor, funcții, firmă) – https://ebm-plus.de/
- [E2] ebm-plus.de, KV-Abrechnung (PlugIn, Probe-Quartal) – https://ebm-plus.de/kv-abrechnung/ și https://ebm-plus.de/mvz-controlling/
- [E3] ebm-plus.de, EBM-Abrechnung Leistungen („circa 6.000 de reguli”) – https://ebm-plus.de/ebm-abrechnung-leistungen/
- [E4] ebm-plus.de, Datenschutz (doar site-ul) – https://ebm-plus.de/datenschutz/
- [E5] KBV, „EBM im Internet jetzt noch komfortabler” – https://www.kbv.de/praxis/tools-und-services/praxisnachrichten/2024/09-05/Neues%20Angebot-%20EBM%20im%20Internet%20jetzt%20noch%20komfortabler
- [E6] Ärzteblatt, KBV2GO – https://www.aerzteblatt.de/nachrichten/59306/KBV2GO-neue-Smartphone-App-fuer-Niedergelassene
