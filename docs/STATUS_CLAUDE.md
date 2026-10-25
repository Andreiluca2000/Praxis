# Stadiul programării (Claude)

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
