# Claude ca AI al aplicației: puntea pe serverul cabinetului

09.11.2026 · construit și testat doar cu date inventate. Încă **nepornit pe server**.

## Ce am hotărât cu Andree (09.11.2026)

- **Legătura A:** Claude Code rulează **pe serverul RDP**, lângă DURIA și Praxis-Assistent. Ajunge la date **doar prin „punte”** (`praxis-bruecke.mjs`, un server MCP local), care folosește motorul Fallprüfung al aplicației. Nu poate citi singur dosare, nu are linie de comandă, nu are internet în afară de legătura lui cu Anthropic.
- **Contul:** întâi abonamentul Claude al lui Andree, **fără AVV** cu Anthropic. De aceea Claude vede **doar sume pe tot cabinetul** (de ex. „Fall ohne Diagnose: 14 Fälle”), **niciodată caz cu caz**. Grupurile sub 5 cazuri apar doar ca număr, fără cifre și fără text.
- **Decizie finală (09.11.2026, Andree are credit API):** Claude Code pe server cu **contul API (Console)**, nu cu abonamentul. Contul API intră sub condițiile comerciale Anthropic, care includ acordul de prelucrare (DPA, baza pentru AVV).
  - **Cheia (alegerea lui Andree, 09.11.2026):** o cheie API separată doar pentru server (nu cea a aplicației), cu limită de cheltuieli în Console. Pe server stă ca variabilă `ANTHROPIC_API_KEY` **doar pentru utilizatorul Windows al lui Andree** (Start → „Umgebungsvariablen für dieses Konto bearbeiten” → Neu). Nu se scrie în PowerShell (rămâne în istoric), în fișiere, în chat sau în repo. Dacă scapă: se șterge în Console și se face alta.
  - Alternativa fără cheie în clar: `/login` → cont Console.
  - `managed-settings.json` fixează modelele Opus/Sonnet/Haiku 5.5 (implicit Opus 5.5). Fable e lăsat afară, pentru că nu are ZDR.
  - Opțional: `forceLoginOrgUUID` cu ID-ul organizației Console a cabinetului (din platform.claude.com → Settings → Organization). La Console doar preselectează organizația, nu o verifică.
  - Puntea rămâne tot la sume. Caz cu caz abia după: ZDR cerut la Anthropic, DSFA, OK-ul responsabilului de protecția datelor, apoi poarta „Stufe 2” din aplicație (`ai_stage2_unlock`); unealta pentru asta nu e construită.
- **Sarcinile:** Andree le scrie într-o secțiune nouă din Praxis-Assistent („Prozesse”). Puntea le citește și scrie răspunsul. **Ecranul din aplicație nu e construit încă**: vine ca machetă, apoi după OK-ul lui Andree.
- Prin ecranul RDP (capturi) nu lucrăm: acolo se văd nume de pacienți.

## Ce face puntea

| Unealtă | Intră | Iese spre Claude |
|---|---|---|
| `status` | setările aplicației | KI pornit/oprit, modul, KV, regulile încărcate |
| `fallpruefung_uebersicht` | calea fișierului KVDT, opțional o zi | sume: cazuri, erori pe tip, grupuri ≥ 5 cazuri, cifre ≥ 5 cazuri |
| `regeln_zu_ziffer` | o cifră EBM | regulile și citatul normei |
| `fall_simulieren` | un caz **inventat** | ce găsește motorul |
| `auftraege_lesen` | fișierul de sarcini | sarcinile deschise (text curățat) |
| `auftrag_beantworten` | id, text, stare | doar „salvat” |

## Protecția datelor (cum e construită)

1. **Comutatorul KI al aplicației** (Einstellungen → KI-Assistent) e poarta. Oprit sau fișier de setări lipsă/stricat = puntea nu dă nimic (`KI ist ausgeschaltet`).
2. **Fișierul KVDT e redus ca în aplicație** (`sanitize_many` din Rust): rămân doar câmpurile de verificare (cifre, zile, ICD, siguranță, latură, trimestru). Numele, data nașterii, adresa, KVNR se aruncă; numărul pacientului devine un număr de ordine valabil doar în acel apel.
3. **Rezultatul e doar sumă:** fără caz, fără număr de ordine, fără zi a prestației (datele devin „[Tag]”), fără număr de rând.
4. **Ultima verificare:** înainte de orice răspuns, puntea caută în text numele, străzile, data nașterii etc. din fișier. Dacă găsește ceva, **blochează** răspunsul (`Ausgabe gesperrt`).
5. **Textul sarcinilor** trece prin aceeași curățare ca KI-ul aplicației (telefon, e-mail, KVNR, pseudonime). **Numele nu pot fi recunoscute sigur**: în sarcini nu se scriu nume de pacienți.
6. **Jurnal fără conținut:** `%AppData%\de.praxis.assistent\claude-bruecke-protokoll.jsonl` (ora, unealta, reușit/nu).
7. **Claude Code închis:** setările de pe server permit doar uneltele punții (vezi mai jos).

Ce rămâne deschis: chiar și sumele pe tot cabinetul sunt date despre cabinet. Recomand ca Andree și responsabilul de protecția datelor să confirme că sumele cu prag de 5 sunt suficiente fără AVV.

## Instalarea pe server (pas cu pas, ca administrator)

1. **Node.js 22 LTS** (de pe nodejs.org) și **Claude Code** (instalatorul oficial pentru Windows, versiune recentă). Cheia API ca variabilă de utilizator `ANTHROPIC_API_KEY` (vezi mai sus), apoi terminal nou.
2. Dosarul `C:\Praxis-Claude\` cu:
   - `praxis-bruecke.mjs` (construit pe PC-ul lui Andree cu `pnpm build:bruecke`, din `dist-bruecke\`);
   - `CLAUDE.md` din `bruecke-server\`.
3. **Setările care nu pot fi ocolite:** `managed-settings.json` și `managed-mcp.json` din `bruecke-server\` copiate în `C:\Program Files\ClaudeCode\` (doar administratorul le poate schimba).
   - `managed-settings.json`: permite doar uneltele punții (`mcp__praxis__*`); interzice linia de comandă, citirea/scrierea de fișiere, internetul, subagenții; modul „bypass” și „auto” sunt oprite; regulile utilizatorului sau ale proiectului nu contează.
   - `managed-mcp.json`: singurul server MCP permis e puntea (`node.exe` + `C:\Praxis-Claude\praxis-bruecke.mjs`); nimeni nu poate adăuga altul.
   - Verificare pe server: `/status` arată setările administrate, `claude mcp list` arată doar `praxis`, în Claude întrebarea „citește C:\Windows\win.ini” trebuie refuzată.
   - Dacă Node e instalat în altă parte, se schimbă calea din `managed-mcp.json`.
4. Praxis-Assistent: Einstellungen → KI-Assistent → **Ein**.
5. KVDT: în DURIA, exportul trimestrial (sau „bis heute”) într-un dosar cunoscut; Andree îi spune lui Claude calea.
6. Pornire: terminal în `C:\Praxis-Claude\` → `claude`. Prima comandă: „status”.

## Prima Fallprüfung (cu Andree)

1. `status`: KI pornit, modul, KV Nordrhein, regulile.
2. Fallprüfung pe tot trimestrul → Claude explică primele 5 erori cu numărul de cazuri.
3. Andree deschide aceleași erori în aplicație (Quartalsprüfung) și le verifică pe cazuri.
4. Fallprüfung pe ziua de azi → comparăm cu Tagesabschluss din aplicație.
5. Ce lipsește în motor (cifre, reguli, filtre) devine o listă pentru sesiunea de programare.

## Pentru programatori

- Cod: `src/bruecke/` (`schutz.ts`, `uebersicht.ts`, `regeln.ts`, `auftraege.ts`, `umgebung.ts`, `werkzeuge.ts`, `server.ts`). Motorul e cel din `src/kvdt/quarter-check.ts` (`checkCase`), neschimbat.
- Construire: `pnpm build:bruecke` → `dist-bruecke/praxis-bruecke.mjs` (un singur fișier, cu regulile și dosarele de la momentul construirii; după o schimbare de reguli se reconstruiește).
- Teste: `tests/bruecke.test.ts` (doar date inventate).
- Fișierul de sarcini: `%AppData%\de.praxis.assistent\claude-auftraege.json`, `schema_version` `1.0.0`. Atenție: aplicația și puntea scriu în același fișier; ecranul din aplicație trebuie să citească din nou fișierul înainte de fiecare scriere.
- Variabile pentru teste: `PRAXIS_BRUECKE_BENUTZER`, `PRAXIS_BRUECKE_PRAXIS`.
