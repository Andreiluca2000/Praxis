# Primul val: Versichertenpauschale, cronici și diabetici (de aprobat de Andree)

Stare 30.10.2026. Regulile sunt în aplicație, dar **inactive**: au `status: draft` și aprobarea nu e dată. Până la aprobare, aplicația se comportă exact ca înainte. Testele care arată ce face fiecare regulă sunt în `tests/chroniker.test.ts`, pe cazuri sintetice cu da / nu / nicht prüfbar.

## 1. Ce aprobi

| Cifra | Când o propune programul | Sursa (cu locator) |
|---|---|---|
| **03000** (Versichertenpauschale, prima primire în trimestru) | Toate condițiile: medicul bifează „Pflichtinhalte dokumentiert” (contact personal sau video azi); în trimestru nu există încă 03000, 03030, 03100, 01600, 01601 sau 01610; în trimestrul **anterior** nu e 03100; în aceeași zi nu e 01436 și nici o pauschală de Notdienst (01210–01218). Fără trimestrul anterior citit: „nicht prüfbar”. Grupa de vârstă schimbă doar valoarea, nu cifra; 03040 o adaugă KV-ul. | KBV, EBM 4/2026, secțiunea 3.2.1, p. 179 (03000), p. 180 (excluderi, Notdienst, Definitionsauftrag, trimestrul după 03100), p. 182 (03030 în loc de 03000) |
| **03220** (Chroniker-Zuschlag) | Toate trei condițiile: (1) diagnoză cronică **sigură (G)** din lista de la punctul 2, în trimestrul curent; (2) continuitate: în ultimele 4 trimestre (inclusiv cel curent) cel puțin 3 trimestre cu contact pentru aceeași boală, din care 2 cu contact personal, **sau** 03100 facturat cu exact două trimestre înainte pentru aceeași boală; (3) medicul bifează „Pflichtinhalte dokumentiert” (contactul personal de azi). O dată pe trimestru. | KBV, EBM 4/2026, p. 196 (continuitate, excepția 03100) și p. 197 (03220) |
| **03221** (zuschlag la 03220) | Aceleași condiții ca la 03220, 03220 deja trecut în trimestru **și** o confirmare proprie: cel puțin două contacte personale în trimestru și verificarea sau ajustarea tratamentului după ghid. Bifa generală „Pflichtinhalte” nu ajunge. O dată pe trimestru. | KBV, EBM 4/2026, p. 196 și p. 198 (03221) |
| **90325** (DMP Diabetes Typ 2, KV Nordrhein, Folgedokumentation, 10,00 €) | E11 sigur (G), KV = Nordrhein, plus trei confirmări: cabinetul are aprobarea DMP, pacientul e înscris în DMP și documentația **pentru acest trimestru** a fost trimisă complet și la timp. Nu se propune dacă în trimestru există deja 90324 sau 90325D. | KV Nordrhein, Vergütungsvereinbarung DMP DM2, versiunea din 01.07.2025, §1 alin. 1 și 5 (p. 2), §2 alin. 1, 2 și 6 (p. 3–4). [PDF kvno.de](https://www.kvno.de/fileadmin/shared/pdf/online/amtliche_bekanntmachungen/2025/20250724_verguetung_diab_2.pdf), sha256 `f245f747…6e89` |

**Neupatient** (răspunsul lui Andree: „nou și nu-l cunoaștem deloc”) apare doar ca informație, fără cifră: regula TSVG pentru pacienți noi a fost abrogată din 01.01.2023 (GKV-Finanzstabilisierungsgesetz). Variante:
- „bekannt” (cu data ultimului contact găsit);
- „kein früherer Kontakt seit …” (numai cu istoric confirmat);
- „nicht prüfbar”.

„Niciodată” se poate spune doar cu tot istoricul. Programul calculează informația (`report.patient`), dar nu o afișează încă; afișarea e o schimbare în UI, cu înainte/după.

Ce **nu** face programul:
- Nu propune **90324** (Einschreibung, 25 €), pentru că nu poate ști când are loc înscrierea. O numără doar la limita pe trimestru.
- Nu are DMP Diabetes **Typ 1**: e un acord separat, pentru valul următor.
- Nu acoperă excepțiile de la continuitate pentru nou-născuți și sugari sau la schimbarea Hausarzt. În aceste cazuri programul nu propune nimic, adică greșește spre prudență.

## 2. Lista de boli cronice (de verificat, scurtat sau completat)

EBM cere pentru 03220/03221 o „lebensverändernde chronische Erkrankung” sigură, dar **nu dă o listă de coduri ICD**. Lista din `data/billing/reviewed/chronic-dx.json` e o propunere a mea și declanșează doar indicații și propuneri, nu e normă. Conține 40 de categorii, printre care:
- E10–E14 (diabet);
- I10–I13 (hipertensiune);
- I25, I48, I50, I69, I70;
- J44 (BPOC), J45 (astm);
- E03, E05, E78, E66;
- N18, K50, K51, K70, K74;
- G20, G30, F03, G35, G40, F20, F31, F33;
- M05, M06, M80, M81;
- B20, C18, C50, C61.

Pentru DMP se folosește E11. Lista pozitivă obligatorie a KV Nordrhein (§1 alin. 5) nu e publică, așa că nu e inclusă.

Aceeași listă pornește și **R1** (diagnoză ↔ cifră), ca indicație în Fertig și în Quartalsprüfung KVDT:
- 03220/03221 fără diagnoză cronică sigură;
- diagnoză cronică sigură fără 03220;
- E11 sigur fără cifră DMP (doar cu KV Nordrhein).

## 3. Presupuneri pe care le confirmi

1. **Un trimestru cu 03000, 03030 sau 03100 înseamnă contact Arzt-Patient și se numără ca personal.** Cifrele de laborator singure nu se numără. Un trimestru doar cu video ar fi numărat greșit ca personal; dacă vrei mai strict, spune-mi.
2. **Behandlungsfall = trimestrul calendaristic.** E mai strict: la o schimbare de casă de asigurări în trimestru, programul poate cere clarificare în plus, dar nu aprobă greșit.
3. **Bifa „Pflichtinhalte dokumentiert” e una singură pentru toată verificarea Fertig** și acoperă contactul de azi (03000, 03220). 03221 are o confirmare separată.
4. **Excluderile „nicht neben” pe ședință sunt verificate pe toată ziua calendaristică.** Asta e mai strict: programul poate să nu propună cifra, dar nu propune una greșită.

## 4. Ce mai blochează „bereit” și după aprobare

| Ce lipsește | Efect | Cine / cum |
|---|---|---|
| **Statutul HZV al pacientului.** DURIA nu-l exportă. | Toate propunerile EBM (03220/03221) rămân „nicht prüfbar: HZV unbekannt”. DMP nu e afectat. | Andree: cabinetul are pacienți HZV? Dacă nu are deloc, se poate seta o dată pentru tot cabinetul (schimbare în UI, cu înainte/după). |
| **Exportul BDT pe ultimele 4 trimestre.** | Fără el, 03220/03221 (și 03000, care cere trimestrul anterior) rămân „nicht prüfbar: Vorquartale fehlen”. | **De întrebat la hotline-ul DURIA** cum se exportă BDT pentru un pacient pe mai multe trimestre. Apoi în aplicație trebuie bifa „Export enthält die letzten 4 Quartale” (schimbare în UI, cu înainte/după). |
| **Confirmările DMP** (cabinetul are aprobarea DMP, pacientul e înscris, documentația trimestrului e trimisă) și **confirmarea pentru 03221**. | 90325 și 03221 rămân „Klärung”, fără să poată fi preluate. | Schimbare în UI (FactPanel), cu înainte/după. |
| **KV-ul nu se salvează.** | Alegerea „Nordrhein” din Einstellungen se pierde la fiecare logare. Regulile DMP și indicația DMP nu se mai aplică până o alegi din nou. | De reparat (salvare în configurație, partea Rust). Până atunci, alegi Nordrhein după fiecare logare. |

## 5. Calea tehnică a aprobării

Aprobarea ta înseamnă aceste modificări, făcute de Claude la cererea ta, cu Kürzel-ul tău și data:

1. În `data/billing/reviewed/hausarzt-welle1.json`, pentru fiecare regulă aprobată:
   - `"status": "active"`;
   - `reviews.billing` și `reviews.clinical` primesc `"state": "approved"`, `"reviewer": "<Kürzel>"`, `"reviewed_at": "2026-10-30T10:00:00Z"` (format dată + oră) și o motivare;
   - la surse, `"license_status": "permitted_for_local_use"` (EBM și acordul KVNO sunt documente publice).
2. În `data/billing/reviewed/chronic-dx.json`: `review.state: "approved"`, cu reviewer și dată, după ce ai corectat lista.
3. Verificare cu `pnpm validate:data && pnpm test`, apoi un installer nou. Schema refuză o regulă activă fără aprobare. Un pachet stricat e ignorat întreg, iar atunci nu apare nicio propunere de cifre.
4. Regulile EBM sunt valabile până la 31.12.2026 (EBM 4/2026). Pentru trimestrul 1/2027 se verifică EBM-ul nou și se prelungesc.

Cum ajunge pachetul în aplicație: `ui/session.ts` îl încarcă în modul operativ (`src/engine/catalogue.ts`). Simulatorul rămâne pe DEMO.
