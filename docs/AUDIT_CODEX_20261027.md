# Audit Claude al livrării Codex din 26–27.10.2026

Data: 27.10.2026. Auditor: sesiune Claude separată, la cererea utilizatorului. Obiect: conținutul Abrechnung necomis din `data/billing/**`, `schemas/billing-*.schema.json`, `scripts/*.py`, `scripts/verify-*` și documentele `docs/BILLING_*`, `REMAINING_WORK_20261026.md`, `STATUS_CODEX.md`. Baza este commitul `0e53bec` din 25.10.

Auditul confruntă datele cu sursele salvate local: EBM Q4/2026 (KBV, PDF, SHA-256 `609f6353…`), GOÄ Anlage și §§ 4, 5, 6, 12 (gesetze-im-internet.de), G-BA GU-RL/KFE-RL/MVV-RL și explicațiile KVHB/BÄK/KBV păstrate de Codex. Textul a fost extras local cu PyMuPDF/lxml. Nu s-au folosit date de pacienți. Auditul nu este o revizie profesională de Abrechnung și nu aprobă nicio regulă.

## Concluzie pe scurt

Livrarea Codex este **în general corectă și bine trasabilă**. Toate cele 13 verificatoare Python, verificatorul TS și `pnpm check` trec. Toate ancorele au hash valid și apar în sursa citată. Eșantionul nu a găsit nicio cifră de punctaj, nicio limită de vârstă și nicio listă de excluderi inventată. Problemele găsite sunt de **interpretare**, **completitudine** și **documente neactualizate**, nu de fabricare.

| Gravitate | Număr | Pe scurt |
|---|---:|---|
| Ridicată | 1 | Iterația 1.11.0 a registrului de intervale era neterminată: generatorul și datele nu mai corespundeau |
| Medie | 3 | 271/272: limita normativă „insgesamt … zweimal” nu mai era modelată; limita pe Krankheitsfall a lui 03043 lipsea din parametri; surse fără licență revizuită |
| Scăzută | 5 | Numere vechi în documente; ancoră incompletă la 01731; GOÄ 50/51 lângă 45/46 nemodelat; surse secundare vechi sau din altă regiune; pagina KVWL salvată dar necitată |

## 1. Verificatoarele rulate

Toate au fost rulate pe starea necomisă, înainte de orice modificare Claude.

| Comandă | Rezultat |
|---|---|
| `verify-billing-combinations.py` | OK: 58 clauze, 62 ancore, 24 scenarii |
| `verify-billing-knowledge.py` | PASS: 5.955 intrări, SQLite/FTS/JSON consistente, 31 carduri, HZV respins |
| `verify-billing-release.py` | OK: 5.955 poziții, dependențe, 0 reguli operative |
| `verify-billing-scope-resolutions.py` | OK: 922 perechi (813 EBM/109 GOÄ), 2.142 ancore |
| `verify-chroniker-dossier.py` | OK: 25 clauze, 37 ancore, 26 coduri ICD terminale, 41 scenarii |
| `verify-content.py` | PASS: ICD (22 hashuri, 16.905 coduri), 31 drafturi, 7 surse billing, surse legale |
| `verify-goae-review.py` | OK: 56 clauze, 74 ancore, 47 profiluri, 60 + 53 scenarii |
| `verify-hausarzt-scope.py` | OK: 138 ținte (80/58), 31 clauze, 35 ancore, 22 scenarii |
| `verify-optional-hausarzt.py` | OK: 66 clauze, 70 ancore, 13 liste, 52 scenarii |
| `verify-pauschalen-review.py` | OK: 49 clauze, 14 cifre, 80 ancore, 18 scenarii |
| `verify-prevention-review.py` | OK: 32 clauze, 40 ancore, 28 scenarii |
| `verify-visits-review.py` | OK: 87 clauze, 21 cifre, 105 ancore, 27 scenarii |
| `verify-wounds-review.py` | OK: 70 clauze, 14 cifre, 78 ancore, 27 scenarii |
| `npx tsx scripts/verify-billing-drafts.ts` | PASS: 31 drafturi valide și inactive; 140 verificări ale condițiilor |
| `pnpm check` | typecheck OK, **143 teste în 20 de fișiere**, `validate:data` OK |

Verificări suplimentare făcute de Claude, independent de verificatoarele Codex:

- **Schemele validează datele:** cele 12 perechi schemă/fișier trec cu `jsonschema` Draft 2020-12, fără erori. Dosarul `rules.draft.2026-q4.json` folosește o referință `urn:` rezolvată numai de `verify-content.py`, care trece.
- **ID-uri:** niciun duplicat în cele 13 colecții (31, 58, 56, 138, 66, 49, 32, 31, 922, 87, 70 elemente).
- **Proveniență:** 2.842 de referințe `path` + `sha256` în dosare și manifeste; **toate fișierele există și toate hashurile corespund**. Fiecare PDF/HTML din `data/billing/` este referit cu hash.
- **Liste de excluderi EBM:** un script Claude a reexpandat toate intervalele „X bis Y” din ancore cu indexul EBM și le-a comparat cu `counterpart_codes` în toate dosarele. **Nicio listă nu are coduri lipsă sau în plus** (singura diferență raportată, 01732/01746, era un artefact al scriptului de control: 01746 apare în a doua ancoră, care descrie excepția BAG).
- **Profiluri GOÄ:** toate cele 47 de punctaje corespund tabelului GOÄ. Coloana euro din HTML este istorică în **DM** („Gebühr in DM”); Codex folosește corect punctul de 5,82873 cenți din §5. Încadrarea în factor redus (2, 250, 605, 605a, 651, 654) și standard (652, 253, 271, 272) corespunde listei din Abschnitt A.

## 2. Eșantion de clauze confruntate cu sursa

Au fost citite toate clauzele din dosarele pauschale, cronici, GOÄ și prevenție, iar **circa 80 dintre ele, din 8 dosare, au fost confruntate frază cu frază** cu paginile EBM/GOÄ/G-BA. Separat, toate listele de excluderi EBM și cele 47 de profiluri GOÄ au fost verificate automat.

| Dosar | Clauze confruntate | Rezultat |
|---|---|---|
| Pauschale (03000, 03008, 03010, 03020, 03030, 03040–03048) | 20 | Corecte. Punctaje 128/179, praguri 400/1200 cazuri, deduceri 13/18 și adaosuri 9/13 puncte, vaccinări <10 → 40 %, 25 % în Q4 la criteriul 4, 03041/03042 = 2–7/≥8 criterii: toate conform p. 187–193 |
| Cronici (03100, 03110, 03220–03222) | 12 | Corecte: vârsta 18 – sub 75 ani, 3 din 4 trimestre, excepția „mai mult de unul și cel mult trei trimestre”, 8 % din 03100, excluderea altei Praxis în trimestrul curent și următor (p. 177–198) |
| Vizite (01410, 01413, 01102) | 6 | Corecte: definiția vizitei, Wegepauschale, 01102 + 01413 doar în cămine cu personal, listele 01410/01413 (p. 42, 53–57) |
| Răni (02300–02302) | 10 | Corecte: max. 5 pe zi pentru D22/T01, anestezia locală inclusă, 21 de zile după 31.2, liste zi/caz/ședință (p. 157–161) |
| Combinații | 8 | Corecte; excepția BAG interdisciplinară 01732/01745/01746 este păstrată |
| GOÄ (1, 2, 3, 4, 5–8, 15, 29, 34, 50, 51, A–H, K2, 200, 2000–2008, 253, 271, 272) | 18 | Corecte, cu excepția interpretării 271/272 de mai jos |
| Prevenție (01731, 01732, 01734, 01745–01748, 03241, 03321, 03322, 03324, 03330) | 6 | Corecte; ancora incompletă la 01731 de mai jos |
| Registrul de intervale | principiul + 6 surse | Interpretarea „nicht neben” fără alt interval = aceeași ședință este susținută literal de glosarul KVHB pentru EBM și de BÄK/Brück pentru GOÄ |

## 3. Probleme găsite, cu dovezi

### 3.1 Ridicată — iterația 1.11.0 a registrului de intervale era neterminată

- `scripts/build-billing-scope-resolutions.py` și `scripts/checkup_visit_base_scopes.py` au fost modificate la 17:41, **după** ultima generare a datelor (17:07) și după `STATUS_CODEX.md` (17:13).
- Generatorul scrie `schema_version: 1.11.0` și adaugă 19 perechi (01732 cu 27310/32057/32060–32063/37800 și F/G/H cu 45/46/48/52). Datele livrate au încă **1.10.0 și 922 de perechi**. Schema acceptă numai `1.10.0`, iar verificatorul cere exact 922.
- **Consecință:** orice regenerare cerută de README („după orice schimbare a datelor”) rupea lanțul de verificare. Documentele numărau încă `EBM_01732_EXCLUDES_UNSPECIFIED_NEBEN` și `F/G/H_BASE_EXCLUSIONS` ca deschise, deși munca era aproape făcută.

### 3.2 Medie — 271/272: plafonul normativ înlocuit cu o interpretare secundară

- Norma (GOÄ C II, `goae-anlage-20261025.html`): *„Die Leistungen nach Nummer 271 oder 272 sind je Gefäßzugang einmal, insgesamt jedoch nicht mehr als zweimal je Behandlungstag berechnungsfähig.”*
- Codex (`goae/constraints.review.json`, `271_272_ACCESS_DAY_LIMIT`, schema 1.1.0) a retras limita comună și modelează numai `max_per_code_per_day: 2`, pe baza unui GOÄ-Ratgeber din Deutsches Ärzteblatt (2019): *„jeweils je Behandlungstag nur zweimal”*. Schema respinge explicit câmpurile pentru limita comună.
- Textul normativ spune „insgesamt”. Articolul BÄK este o explicație secundară, iar „jeweils” nu înlătură formularea legală. Modelul Codex nu blochează 2 × 271 + 1 × 272 în aceeași zi: le trimite doar la revizie ca „coduri mixte”. Codex însuși cere ca norma să nu fie înlocuită de o preferință. **Corectura este descrisă la secțiunea 5.**

### 3.3 Medie — limita pe Krankheitsfall a 03043 nu era parametrizată

- EBM p. 191: 03043 *„einmal im Behandlungsfall, höchstens zweimal im Krankheitsfall”*; p. 189: 03040 *„einmal im Behandlungsfall”*.
- În `pauschalen/rules.review.json`, `03043_BASE` și `03040_BASE` au textul doar în ancoră; parametrii nu conțin frecvența. Un motor care citește parametrii nu vede limita de două ori în Krankheitsfall (patru trimestre). Celelalte dosare (03100/03110) o modelează.

### 3.4 Medie — licențele surselor nu sunt revizuite

- `sources.manifest.json` și `prevention/sources.manifest.json`: `license_review: "pending"`. Manifestele `goae`, `optional-hausarzt`, `scope-resolutions` și `wounds` nu au deloc câmp de licență.
- În repository sunt copiate integral pagini KVB (Bavaria), KVSA (Sachsen-Anhalt), KVHB, KVWL, KBV și articole BÄK/DÄ. Pentru uz intern pot fi acceptabile, dar distribuirea lor (de exemplu într-un installer) trebuie verificată. **Rămâne deschis**, nu se poate închide tehnic.

### 3.5 Scăzută

1. **Numere vechi în documente.** `STATUS_CODEX.md`, paragraful „Închiderea profilurilor aritmetice GOÄ”, spune „35 rămase deschise și 52 cu interval clarificat” (real: 25/62). `REMAINING_WORK_20261026.md`, blocul 4, spune „16 clauze încă deschise din dosarul de combinații (din 28 inițiale)” și „inventarul de 69” (real: 6 deschise în combinații, 87 de înregistrări marcate). Secțiunea de validare menționează șase verificatoare, deși există 13.
2. **Ancoră incompletă la 01731.** `prevention/MALE_CANCER_INTERVAL` modelează un interval pe **an calendaristic**, dar citează numai „jährlich” din KFE-RL § 2. Fraza care susține anul calendaristic, *„Er kann ab Beginn des jeweiligen Kalenderjahres wahrgenommen werden”*, este pe aceeași pagină și lipsea.
3. **GOÄ 50/51 lângă 45/46.** Norma *„darf anstelle oder neben einer Leistung nach Nummer 45 oder 46 nicht berechnet werden”* nu este modelată. Impactul pentru Hausarzt este mic: 45/46 sunt vizite în spital.
4. **Surse secundare vechi sau din altă regiune.** KVB INFOS 10/2017 (Bavaria, EBM 2017) susține 18 perechi paliative, iar KVSA susține perechile 03100. Concluzia (ședință) este acoperită oricum de glosarul KVHB și de textul KBV. Sursele trebuie tratate ca explicații, nu ca normă NRW, așa cum notează și Codex.
5. **`kvwl-sitzung-20261027.html`** este salvată și are hash, dar nu este citată de nicio clauză. Pagina este o listă de știri KVWL, nu o definiție a ședinței; descrierea din README („explicația KVWL a ședinței”) este exagerată.

## 4. Neverificabil în acest audit

- **Corectitudinea clinică și profesională** a fiecărei condiții. Auditul confirmă concordanța cu textul, nu aplicarea în Praxis.
- **Secțiunile EBM** (18.3, 30.5, 31.5.3, 34.5, 35.2.1/35.2.2, 36.5.3) din excluderi: apartenența codurilor la secțiuni nu este expandată nici de Codex, nici aici.
- **Sursele regionale Nordrhein/Westfalen-Lippe și contractele HZV:** nu există încă. KV rămâne neales, HZV fără contract, conform cererii.
- **Probele de integrare din README-uri** (47 de probe pentru intervale și altele pe dosare): sunt specificate, dar nu sunt executate în aplicație.
- **Actualitatea online** a EBM Q4/2026 și GOÄ după data salvării: auditul a folosit copiile locale cu hash, nu a descărcat versiuni noi.

## 5. Ce poate încărca motorul existent (observație, cod nemodificat)

- `src/cli/validate-data.ts` validează numai `config/practice.example.json` și `data/billing/rules.example.json`. Dosarele noi nu sunt încărcate de `pnpm check`.
- `RulePackage.content_kind` acceptă numai `synthetic_example | reviewed_catalogue`. Anvelopa `draft_catalogue` este adaptată doar în memorie, de `verify-billing-drafts.ts`.
- `RuleWindow.unit` are `visit | day | quarter | year | treatment_case`. `visit` este tratat ca **zi calendaristică** (`src/engine/windows.ts`), iar `treatment_case` întoarce `null`. Dosarele folosesc însă `session` (897 de perechi la audit, 973 după completare), `inanspruchnahme`, `arztgruppenfall`, `krankheitsfall`, `postoperative_21_days`, `immediately_following_quarter`, `current_and_following_quarter`, intervale pe ani calendaristici și excluderi pentru altă Praxis. Niciuna nu are corespondent în motor.
- **Adaptarea necesară (pentru Claude-programare):** un încărcător per dosar (sau o anvelopă comună) care păstrează `draft` și `not_verified`; unități noi de interval cu „ședință” distinctă de zi; consumarea obligatorie a `exception_record_ids` (răni) și a `scope_by_counterpart`; distincția cifră adăugată de KV / cifră omisă; refuzul vechiului model 271/272. Până atunci, maparea `session → visit` ar transforma excluderile pe ședință în excluderi pe zi, adică alarme false pentru contacte separate.

## 6. Corecturi și continuare făcute de Claude

Toate modificările rămân `draft` / `pending` / neoperative. Nu s-au atins `src/`, `ui/`, `src-tauri/`, `package.json` sau `docs/STATUS_CLAUDE.md`. Nimic nu a fost comis. O copie a stării Codex dinaintea modificărilor a fost păstrată local, în afara repository-ului.

| Constatare | Corectură | Fișiere |
|---|---|---|
| 3.1 Iterația 1.11.0 neterminată | Date regenerate cu generatorul Codex; schema trecută la 1.11.0 cu perechile 01732 și F/G/H; verificatorul împarte perechile în „istorice” (922, 2.144 de ancore după enunțul reciproc 01732) și „adăugate în 1.11.0” (76), cu verificări dedicate | `scope-resolutions/rules.review.json`, `schemas/billing-scope-resolutions.schema.json`, `scripts/verify-billing-scope-resolutions.py` |
| 3.2 271/272 | Schema GOÄ 1.2.0: `normative_total_codes: [271, 272]`, `normative_total_per_day: 2`, obligatorii pentru `271_272_ACCESS_DAY_LIMIT`; rezumat și note corectate; verificatorul respinge eliminarea sau ridicarea plafonului | `scripts/goae_basic_services.py`, `build-goae-review.py`, `verify-goae-review.py`, `schemas/billing-goae-review.schema.json`, `goae/README.md` |
| 3.3 03043 | `03040_BASE`: `max_count: 1`, `scope: ebm_behandlungsfall`; `03043_BASE`: în plus `max_count_krankheitsfall: 2` | `build-pauschalen-review.py`, `verify-pauschalen-review.py` |
| 3.5.1 Numere vechi | Actualizate cu numerele reale | `STATUS_CODEX.md`, `REMAINING_WORK_20261026.md`, `BILLING_COMPLETION_CHECKLIST.md`, README-urile registrului, intervalelor și GOÄ |
| 3.5.2 01731 | Ancoră nouă: KFE-RL § 2 Satz 2, „ab Beginn des jeweiligen Kalenderjahres” | `build-prevention-review.py`, `verify-prevention-review.py` |

### Conținut nou: intervale închise

Coada intervalelor scade de la **25 la 18 înregistrări deschise** în prima etapă (69 de liste clarificate din 87), apoi la **12** după expandarea secțiunilor EBM (vezi mai jos):

| Înregistrare închisă | Cum | Sursă |
|---|---|---|
| `combinations/EBM_01732_EXCLUDES_UNSPECIFIED_NEBEN` | 7 perechi noi, ședință (iterația Codex terminată) | EBM p. 101 + glosar KVHB |
| `goae/F_BASE_EXCLUSIONS`, `G_BASE_EXCLUSIONS`, `H_BASE_EXCLUSIONS` | 12 perechi, ședință (iterația Codex terminată) | GOÄ B V + BÄK „Neben” |
| `combinations/GOAE_PSYCH_EXCLUSIONS` | 48 de perechi noi: 1/3/34 ↔ 804, 806–808, 812, 817, 835, 849, 861–864, 870, 871, 886, 887 | GOÄ B Allg. Best. 4 + BÄK |
| `goae/271_272_GROUP_EXCLUSION` | 9 perechi noi: 271/272 ↔ 271–276, ședință; plafonul zilnic rămâne separat | GOÄ C II, anotarea la 274 + BÄK |
| `combinations/GOAE_SUPPLEMENT_GROUPS` | Toate perechile existente erau deja clarificate; I și J nu există în tabelul GOÄ | `unresolved_code_references` din registru |

Generatorul cozii (`build-billing-open-scopes.py`) nu mai cere perechi pentru trimiterile literale fără rând în tabel (805, 809, 810, 811, I, J). Acestea rămân în registru ca probleme de revizie, fără tarif inventat.

**Secțiuni EBM (a doua etapă).** `scripts/ebm_section_membership.py` derivă apartenența din aspectul PDF-ului: titlurile de secțiune sunt rânduri bold la marginea stângă, iar titlurile GOP rânduri regulate de cinci cifre la x = 77 pt. Derivarea găsește exact cele 3.179 GOP ale indexului, fiecare pe pagina indexată, iar verificatorul o repetă la fiecare rulare. Sunt fixate 8 secțiuni: 18.3 (7 GOP, inclusiv 18700), 30.5 (2), 31.5.3 (11), 34.5 (5), 35.2 (79), 35.2.1 (12), 35.2.2 (56), 36.5.3 (12). Legendele membrilor au fost căutate pe toate paginile secțiunilor: nu există enunțuri reciproce pe zi sau caz pentru subiecți. Rezultă 267 de perechi noi pe ședință (`ebm_section_scopes.py`), care închid încă 6 înregistrări: `EBM_03230_EXCLUDES_UNSPECIFIED_NEBEN`, `02300/02301/02302_EXCLUDES_UNRESOLVED_NEBEN`, `EBM_35100_EXCLUSION` și `EBM_35110_EXCLUSION`. Registrul are acum **1.265 de perechi (1.087 EBM + 178 GOÄ) și 3.215 ancore**, iar coada intervalelor **12 înregistrări deschise / 75 de liste clarificate**.

**Frecvențe din legendă (a treia etapă).** Frecvențele din legendele celor 91 de ținte EBM au fost extrase automat și comparate cu parametrii tuturor dosarelor. Patru coduri nu aveau limita modelată nicăieri: 01435 (o dată/caz, de două ori sub 12 ani), 03230 (unități de 10 minute încheiate și volumul Praxisului de 64 de puncte × cazuri, Präambel 3.1 Nr. 9), 33042 (cel mult de două ori/caz) și 32001 (19 puncte la capitolul 3). Ele sunt în dosarul nou `data/billing/frequency/` (6 clauze, 10 ancore), legat în registru și verificat de `scripts/verify-frequency-review.py`.

### Ce rămâne (12 înregistrări)

- **Excepții și condiții de revizie individuală (11):** 01435 și GOÄ 3 („nur neben”), E lângă 45/46 (Belegarzt), H cu F/G (sâmbătă–duminică 20–8), 01102 + 01413, NäPA 03062/03063 și excepțiile pentru medic, anestezia de alt actor. Acestea nu sunt intervale lipsă: rămân condiții care cer faptele cazului.
- **ECG 650–653 (1):** Codex le-a exclus intenționat din clarificare din cauza excepțiilor BÄK; decizia este păstrată.

### Verificare după corecturi

Toate cele 13 verificatoare Python trec (registrul de intervale: 1.265 de perechi, 3.215 ancore; cele 76 de perechi din prima etapă și cele 267 pe secțiuni sunt verificate în ambele sensuri, fără coliziune cu intervale explicite pe zi/caz, iar apartenența la secțiuni este recalculată din PDF), plus `verify-billing-drafts.ts` și `pnpm check`. Schemele validează datele, nu există ID-uri duplicate, iar toate referințele cu hash sunt corecte.

## 7. Etapa 28.10.2026: verificare Opus, logică și formulare

**Verificare independentă Opus** (agent read-only, primește codul și sursele, nu concluziile). Confirmă datele: apartenența la cele 8 secțiuni EBM, lecturile „ședință” (KVHB/BÄK), lipsa intervalelor mai stricte, plafonul normativ 271/272, cele 6 clauze de frecvență, parametrii pauschale/prevenție și ~25 de verificări punctuale. A găsit probleme în motor și în aplicație (`src/`, `ui/`), care aparțin altor sesiuni și sunt predate cu dovezi în nota `opus-review-engine-20261028.md` din dosarul comun. Pe scurt:
- încărcătorul de ferestre ignoră excluderile fără `relation` și dosarul `combinations`;
- vârsta lipsește din motor;
- HZV necunoscut este tratat ca non-HZV;
- limitele pe ședință ratează serviciile fără oră;
- `visit` este socotit zi calendaristică;
- frâna perechilor lucrează numai în simulare.

**Reparat în date și utilitare** (domeniul acestei sesiuni):
- pauschalen: `relation: excludes` pe excluderile de caz; cu motorul real, 03000 + 03100 în același trimestru dă acum `excluded`;
- prevenție: `relation: excludes` la AAA;
- 01435: limita pentru adulți devine condiționată de vârstă, deci nu mai dă încălcare falsă la copii;
- căutarea combinațiilor nu mai pierde perechea pe secțiune când se potrivește și o pereche listată;
- `review-optional-hausarzt.py` înlocuiește intervalul numai la `unresolved_neben`;
- nota EBM rătăcită pe perechile GOÄ F/G/H a fost scoasă.

**Logica formular → Abrechnung.** Dosarul nou `data/billing/form-links/` are 12 legături din legendele EBM. 01610 (Muster 55) și 01612 (Muster 22) sunt incluse în Versichertenpauschale (Präambel 3.1 Nr. 7) și nu se propun niciodată. 01611 și 01620–01624, 37700/37710 și 40128/40129 se pot propune ca „posibilă omisiune” numai după emiterea efectivă a formularului. Observație de domeniu: 01611 și 01620–01624 sunt facturabile de Hausarzt, dar nu sunt în cele 138 de ținte.

**Formulare (date).** Am făcut 26 de modele noi de vordruck din Mustersammlung 05/2026 și Erläuterungen 01/2026, fiecare cu generator, JSON și desenul formularului: 03, 05, 07, 08, 08A, 09, 11, 15, 16, 22, 25, 28, 36, 39, 50, 51, 53, 56, 62A, 62B, 62C, 65, 70, 70A, 85, 86. Au în total 869 de câmpuri, 0 erori de schemă și textul regulilor identic cu catalogul. Suprapunerea casetelor peste PDF a fost verificată vizual pentru 16, 11, 25, 51, 53, 09, 03, 05, 15, 08A și 22. Muster 26, 27 și 64 rămân la sesiunea Formulare, conform deciziei sesiunii principale. Logica, testele și legarea în aplicație le face sesiunea Formulare, care deține codul comun.
