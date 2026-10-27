# Plan: Praxisregeln (reguli proprii ale cabinetului)

28.10.2026 · stadiu: **construit** după macheta aprobată de Andree (varianta A: salvare doar ca administrator). Cod: `src/rules/`, `ui/rules/`, comenzile Rust `rules_read`/`rules_write`. Macheta temporară `ui/mock/` a fost ștearsă.

## Scop

Cabinetul își adaugă propriile reguli peste EBM/GOÄ: amintiri, informații obligatorii și reguli interne mai stricte. Cerința din `REMAINING_WORK_20261026.md`: editor, versiuni, priorități, simulare, audit și conflicte. **O regulă internă nu poate transforma o interdicție din normă într-o permisiune.**

## Patru tipuri de reguli (nu există alte tipuri, deci nicio regulă nu poate „relaxa” ceva)

| Tip | Ce face | Unde apare |
|---|---|---|
| Erinnerung | Text afișat când o cifră e propusă sau înregistrată | Fertig (sub propunere), Behandlung, KVDT ca Hinweis |
| Pflichtangabe | Fără o informație cerută (de ex. ora, durata, „Pflichtinhalte”), propunerea rămâne „Klärung nötig” | Fertig |
| Hausregel Kombination | Avertizare suplimentară când două cifre apar în aceeași zi sau în același Behandlungsfall | Behandlung, KVDT ca Hinweis |
| Vorschlag zurückhalten | Cifra nu mai e propusă niciodată ca „bereit”, doar ca Hinweis (decizia cabinetului) | Fertig |

**Limite impuse de cod, nu doar de text:**
- O Praxisregel nu poate șterge sau slăbi un Ausschluss oficial, o limită de frecvență sau o condiție „nicht prüfbar”.
- Poate doar să adauge un text sau să coboare o propunere de la „bereit” la „klärung”/„info”.
- Rezultatul unei Praxisregel nu e niciodată „Fehler” în KVDT.

## Versiuni și flux

`Entwurf → Simulation → Aktivieren (doar medic, motiv obligatoriu) → Archiv`
- O versiune activată nu se mai modifică. Orice modificare creează o versiune nouă (v1, v2…), iar istoricul păstrează cine, când și de ce.
- Rezultatele arată regula și versiunea, de exemplu „Praxisregel 03230 v4”.
- Prioritate: „Wichtig” înaintea „Hinweis”, apoi după nume.
- „Gültig ab” permite activarea de la o dată anume.

## Simulare și conflicte

- **Simularea** rulează pe fișierul KVDT deschis (pseudonimizat, doar citire) sau pe cazuri sintetice. Arată numărul de cazuri, numărul de potriviri și ce s-a schimbat față de versiunea activă. Nu salvează nimic despre pacienți.
- **Conflictele detectate:**
  - același declanșator la două reguli (propune comasarea);
  - o „Hausregel Kombination” care repetă deja un Ausschluss oficial (informare: „steht schon im EBM”);
  - o cifră care nu e în catalogul EBM/GOÄ;
  - o „Erinnerung” și un „Vorschlag zurückhalten” pe aceeași cifră (informare).

## Date și drepturi

- **Fișierul:** `praxisregeln.json` în `C:\ProgramData\Praxis-Assistent` (la fel ca `konten.json`). Conține doar reguli și istoric, **fără date de pacienți**. Se validează cu o schemă proprie și se încarcă fail-closed: un fișier stricat înseamnă nicio regulă internă activă, cu mesaj vizibil.
- **Decizie de luat (recomandarea mea: A):**
  - **A.** Scriere doar ca administrator, ca la conturi (DS-02). Mai sigur, e același model, dar activarea cere pornirea programului ca admin.
  - **B.** Un subfolder `regeln\` în care grupul cabinetului poate scrie, cu audit în fișier. Mai comod, dar orice utilizator Windows ar putea modifica regulile, deci și ascunde propuneri.

## Etape de construcție

1. **Motor + schemă + teste:** model, validare, evaluare pe prestații și propuneri, garanțiile de „doar mai strict”, conflicte.
2. **UI Listă + Editor:** după machetă, cu taburile Aktiv / Entwürfe / Archiv.
3. **Simulare + activare + istoric.**
4. **Integrare:** în Fertig, Behandlung (cardul de combinații) și KVDT.
5. **Build + verificare în aplicația reală** (conturi și reguli de test), STATUS, commit.
