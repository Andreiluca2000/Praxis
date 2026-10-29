# Propuneri de cifre pentru tot catalogul Hausarzt: valurile

Stare 30.10.2026. Andree vrea propuneri pentru toate cifrele și diagnozele, nu doar la diabetici. Se construiesc **pe valuri**, în ordinea frecvenței într-un cabinet de medicină de familie. Fiecare val are teste sintetice (da / nu / nicht prüfbar) și rămâne inactiv până îl aprobă medicul. Pozele cu lanțurile de cifre din DURIA, pe care le trimite Andree, **schimbă ordinea** de mai jos când ajung.

Baza de lucru este lista Codex `data/billing/hausarzt/scope.review.json`: 138 de poziții (91 EBM și 47 GOÄ), toate cu material parțial și `recommendation_enabled: false`. Înainte să intre o cifră într-un val, verific textul în EBM/GOÄ (PDF-ul oficial, cu sha256). La commit intră doar ce am verificat.

## Valul 1: gata, așteaptă aprobarea (`docs/WELLE1_FREIGABE.md`)

| Ce | Cifre | Date necesare |
|---|---|---|
| Prima primire în trimestru | 03000 | trimestrul curent + trimestrul anterior (pentru „nu după 03100”) |
| Chroniker | 03220, 03221 | ultimele 4 trimestre, diagnoză G din listă |
| Diabet / DMP Nordrhein | 90325 (90324 doar ca limită) | confirmările DMP |
| R1 diagnoză ↔ cifră | indicații în Fertig și KVDT | lista de boli cronice aprobată |
| Neupatient | doar informație (din 2023 nu mai există cifră proprie) | tot istoricul, altfel „nicht prüfbar” |

Valul 1 **nu** propune cifrele pe care le adaugă KV-ul singur: 03040/03043 (Vorhaltepauschale), 03020, 03010, 03041–03048 și 03222. Lipsa lor din export nu înseamnă că au fost uitate (EBM p. 189; dosarul Codex `pauschalen`).

## Valurile următoare (propunere de ordine)

| Val | Cifre (din lista Codex) | Ce trebuie construit în plus | Dependențe |
|---|---|---|---|
| **2. Consultații și vizite** | 03030 (contact neprevăzut), 03230 (convorbire, unități de 10 min), 01410/01411/01412/01413/01415 (Hausbesuch), 01418, 01100/01101/01102 (în afara programului) | durata confirmată (există deja în FactPanel) și ora contactului (FK 5006) | Pentru 03230, volumul Praxis (64 de puncte × cazuri) e un calcul trimestrial separat |
| **3. Prevenție** | 01732 (Check-up), 01734, 01745/01746 (Hautkrebs-Screening), 01747/01748, 01731 | **vârsta** la data prestației (în Rust, fără data nașterii în fereastră), intervalul de la ultima examinare | Istoric de 3 ani pentru intervalul Check-up, altfel „nicht prüfbar” |
| **4. Geriatrie și diagnostic tehnic** | 03360/03362, 03321/03322/03324, 03330, 03241/03242, 33012/33042/33043 | vârsta, criteriile geriatrice, legătura cu aparatul (ECG, spirometrie, ecografie) | Calificări/aprobări ale cabinetului (de confirmat de Andree) |
| **5. Laborator și Blutentnahme** | 32001, 32025–32033, 32128, 32135, 32150–32152, 32880–32882 | ce se face în cabinet față de ce se trimite (01865–01867 rămân referințe) | Recoltarea de sânge la GKV e inclusă în pauschală; la privați intră la valul 6 |
| **6. GOÄ (privați)** | 1, 3, 4, 5, 6, 7, 8, 15, 29, 34, 50, 51, 70, 75, 250, 252, 253, 271/272, 200, 204, 2000–2008, A–K2 | factorul de multiplicare și justificarea lui, exportul cazurilor private din DURIA | Sursa datelor private (KVDT nu le conține) |
| **7. Răni și mici intervenții** | 02300–02302, 02310–02314, 03370–03373, 35100/35110, 38100/38105/38200/38205, 40901–40903, 31600 | localizare și timp, excepțiile din dosarele Codex `wounds` și `combinations` | |
| **8. Alte DMP Nordrhein + HZV** | DMP Typ 1, BPOC, astm, KHK (acordurile KVNO); HZV după contract | sursele oficiale KVNO, contractul HZV, marcajul HZV din DURIA | Decizia lui Andree asupra HZV |

## Ce e comun tuturor valurilor (construit în valul 1)

- **Pachet aprobat separat** (`data/billing/reviewed/`), încărcat doar în modul operativ. Un pachet stricat e ignorat întreg.
- **`excluded_by`:** cifra partener trecută exclude propunerea, fără erori false în Quartalsprüfung.
- **HZV necunoscut:** EBM rămâne „nicht prüfbar”, niciodată „nu HZV”.
- **Fapte derivate** doar din diagnoze G și din cifre, niciodată din text liber.

## Ce trebuie de la Andree / DURIA

1. Pozele cu lanțurile de cifre: ordinea valurilor.
2. Aprobarea valului 1 (`docs/WELLE1_FREIGABE.md`).
3. HZV: cabinetul are pacienți HZV?
4. **Hotline DURIA:** export BDT pe ultimele 4 trimestre, pe pacient și pe tot cabinetul.
5. Calificările/aprobările cabinetului: DMP, ecografie, ECG de efort, spirometrie, ce laborator se face în cabinet.
