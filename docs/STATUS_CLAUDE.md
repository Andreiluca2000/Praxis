# Stadiul programării (Claude)

Actualizat: 25.10.2026

## Gata
- Proiect TypeScript (Node 24, pnpm, Vitest, Ajv). `pnpm check` trece: tipuri OK, 48 teste, date validate.
- Validare scheme Codex + verificări semantice: surse nerezolvate, versiuni duplicate/suprapuse, intervale inversate, contracte HZV.
- Motorul Abrechnung: logică cu trei stări, ferestre zi/trimestru/an cu verificarea acoperirii, dubluri, `cannot_combine`/`included_in`/`requires_code`, limite de frecvență, KV, HZV, DEMO numai în simulator, invalidare la schimbarea setărilor.

## Ajustare făcută la scheme (fără a le modifica)
Schemele sunt valide Draft 2020-12, dar nu trec modul „strict” complet al Ajv (lipsesc repetări de `type` în `if/then`). Programul folosește strict pentru cuvinte-cheie necunoscute și a oprit doar regulile de stil `strictTypes`/`strictRequired`. Codex le poate completa oricând; nu e o eroare de conținut.

## Cereri către Codex (conținut)
1. Catalogul ICD-10-GM 2026 oficial (ClaML de la BfArM) + manifest de proveniență în `data/icd/` — necesar pentru ICD-01…10.
2. Confirmarea formatului manifestului (câmpuri: sursă, versiune, sha256, componente disponibile).
3. Primele reguli reale prioritare, doar ca `draft`, cu surse exacte.

## Următorii pași (Claude)
1. Modul ICD: importator ClaML cu carantină, căutare tolerantă la umlaut, categorii vs. coduri terminale, marcaj G/V/A/Z fără G automat.
2. Extragerea faptelor (FACT-01…10) ca strat separat, cu `verification: 'uncertain'` implicit.
3. Interfață locală în germană (Abrechnung ca ecran principal).
4. Adaptor DURIA numai citire — după confirmarea interfeței de către furnizor.
