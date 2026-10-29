# Startul din 30.10.2026: ce face Abrechnung în build-ul de pe `main`

Verificat pe 29.10.2026, pe `main` = `b71fba7`, din cod și din teste: `pnpm typecheck` e curat, iar `pnpm test` are 458 din 459 de teste verzi. Singurul eșec e în formulare (Muster 12, „rückwirkende Verordnung”) și nu ține de Abrechnung.

## Ce face aplicația azi

| Punct | Ce face build-ul | De unde se vede |
|---|---|---|
| Propunerea automată de cifre („Fertig”) | **Nu propune nicio cifră reală.** Aplicația încarcă doar `data/billing/rules.example.json`, care are o singură regulă DEMO. În modul operativ, pachetul DEMO e ignorat complet; în simulator rulează doar regula DEMO, cu cifra fictivă `DEMO_SERVICE_A`. | `ui/session.ts:18`, `src/engine/evaluate.ts:110`, `src/engine/gates.ts` (simulatorul acceptă doar DEMO), testul `config-demo.test.ts:53` |
| Neupatient | Nu există ca regulă sau ca fapt. Aplicația nu știe dacă pacientul e nou. | nicio regulă sau test pentru asta |
| Chroniker (03220/03221/03222, 03100/03110) | Nu sunt verificate și nu sunt propuse. Există 31 de reguli draft (`rules.draft.2026-q4.json`, cu 03220 și 03221 printre ele) și dosarul Codex `chroniker/`, dar toate sunt nerevizuite și **nu sunt încărcate** în aplicație. | `status: draft`, `reviews.billing: pending`; `ui/session.ts` nu le importă |
| Patientenanamnese făcută da/nu | Nu există ca verificare de facturare. Detectorul din diktat (`src/facts/extract.ts`) recunoaște doar dacă o măsură e făcută, planificată, refuzată etc. și cere confirmare. „Anamnese” apare doar în formulare (Muster 61/64/65). | `src/facts/extract.ts` |
| Corecturi | Merg pentru **diagnostice**. Dacă un diagnostic din diktat e confirmat de medic, aplicația propune: altă siguranță (G/V/A/Z), un cod mai specific în locul unui `.9` și „Diagnose im Diktat ohne Kodierung”. Toate sunt pași pe care îi face un om în DURIA. Pentru cifre nu propune corecturi, pentru că în modul operativ nu are reguli. | `src/corrections/corrections.ts`, `src/core/fertig.ts` (BILL-13) |
| Combinații de cifre deja trecute | Doar în **simulator** și marcate „Entwurf”. Perechile „nu împreună în aceeași ședință” și o parte din excluderile pe zi sau pe trimestru se verifică pe cifrele deja trecute în DURIA. Pot da și alarme false (vezi verificarea Opus din 28.10). | `ui/Treatment.tsx:46`, `ui/session.ts` (`windowFindings`, `pairs`) |
| Praxisregeln | Merg în **ambele moduri**. Sunt amintiri sau cerințe legate de cifrele pe care le definește cabinetul, de ex. „la 03220: verifică boala cronică și contactele din ultimele 4 trimestre”. Apar când cifra e deja trecută în DURIA și nu propun cifre noi. | `src/rules/`, meniul „Praxisregeln” |
| Quartalsprüfung KVDT | Merge pe fișierul KVDT: caz fără diagnostic, diagnostic fără siguranță, prestație fără dată sau în afara trimestrului, Praxisregeln. | `src/kvdt/quarter-check.ts` |

În plus, `config/practice.example.json` are `kv: null`. Regulile regionale (Nordrhein/Westfalen-Lippe) ar rămâne „nicht prüfbar” chiar și după aprobare, până se setează KV-ul.

## Ce lipsește pentru propuneri reale (Neupatient, Chroniker, Anamnese)

Sunt zile de lucru, nu ore, și au nevoie de decizii ale medicului. Ordinea propusă:

1. **Definiții de la Andree:** ce înseamnă „Neupatient” în cabinet (primul contact vreodată, fără contact în ultimele N trimestre sau pacient TSS) și care cifre trebuie propuse la primul val (propunere: 03000/03040 + 03220/03221, apoi restul).
2. **Revizia regulilor de către medic:** regulile draft pentru acele cifre trec în `approved` (Abrechnung + klinisch), cu sursele verificate. Fără asta, motorul refuză corect să le folosească în modul operativ (`gates.ts`, `activationProblems`).
3. **Pachetul aprobat se încarcă în aplicație:** `ui/session.ts` citește un pachet `reviewed_catalogue` în loc de exemplul DEMO, cu validare și fallback sigur dacă fișierul lipsește.
4. **Datele de care au nevoie regulile:**
   - Chroniker cere contactele din ultimele 4 trimestre, deci un export BDT pe mai multe trimestre, nu doar ziua curentă din GDT.
   - 03000 și 03100 cer vârsta, calculată la granița protejată din Rust, fără să ajungă în fereastră.
   - Statutul HZV trebuie să fie „necunoscut”, nu „nu HZV” (constatarea 3 din verificarea Opus).
5. **„Anamnese făcută” ca fapt confirmat:** diktatul o recunoaște, iar medicul confirmă în FactPanel. Regula o folosește ca „Pflichtinhalt”, la fel ca durata.
6. **Reparațiile HIGH din verificarea Opus (28.10):** încărcarea dosarului `combinations`, frecvențele pe vârstă și frâna perechilor și în modul operativ.
7. **Proba:** fiecare regulă cu cazuri sintetice „da / nu / nu se poate verifica”, apoi pacientul de test în cabinet (`PRAXISTEST_PLAN.md`).

## Recomandare pentru 30.10

- Programul rămâne în **Simulator**. Modul operativ nu aduce încă nicio cifră în plus, iar simulatorul arată în plus verificarea combinațiilor (Entwurf).
- Prima zi e proba legăturii GDT cu DURIA pe pacientul de test (`PRAXISTEST_PLAN.md`, secțiunile 2–4), plus diktat, diagnostice, formulare și Praxisregeln.
- Cifrele se trec în continuare de mână, ca până acum.
