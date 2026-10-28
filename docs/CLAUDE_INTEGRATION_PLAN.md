# Plan: Claude în Praxis-Assistent (API; abonamentul Claude)

28.10.2026 · **doar plan**, nimic construit. Programul rămâne complet funcțional fără AI; Claude devine un **ajutor opțional**, oprit implicit.

## 1. Abonament Claude (Pro/Max/Team) vs. Claude API

- **Abonamentul nu poate fi legat în program.** Documentația oficială Anthropic (Agent SDK overview, verificată 28.10.2026): *„Unless previously approved, Anthropic does not allow third party developers to offer claude.ai login or rate limits for their products … Use the API key authentication methods … instead.”* Login-ul claude.ai sau limitele unui abonament Pro/Max într-o aplicație proprie cer aprobarea Anthropic. Pentru date de pacienți, abonamentele de consumator nu sunt oricum potrivite (termeni de consumator, fără acord de prelucrare a datelor).
- **Ce rămâne posibil cu abonamentul:**
  - dezvoltarea programului (ce facem acum, în Claude Code);
  - folosirea manuală a chatului Claude de către personal, **fără date de pacienți**.
- **Varianta corectă pentru program: Claude API** (cont la platform.claude.com, cheie API, Commercial Terms + Data Processing Addendum). Datele trimise prin API nu sunt folosite pentru antrenare. Retenția se poate reduce prin acord cu Anthropic (*zero data retention*).

## 2. Unde ajută Claude (mereu doar propunere, confirmată de medic)

| Funcție | Fără AI (azi) | Cu Claude |
|---|---|---|
| Fapte din dictare/fișă (efectuat, durată, conținut) | Tipare fixe → „unsicher” | Extracție structurată (JSON cu schemă fixă) din textul liber → tot „unsicher” până la confirmare |
| Diagnoză în text → ICD | Căutare în catalog | Propunere de cod, **verificată în catalogul oficial**; G/V/A/Z doar de la medic |
| Rezumat Kurz/Ausführlich | Pe reguli sau Ollama local | Rezumat mai bun |
| Formulare: descriere → câmpuri | Reguli | Propuneri pentru câmpurile de text liber |
| Explicații | Text fix | „De ce e Ausschluss?”, în limbaj simplu, cu sursa din dosar |

**Ce nu face niciodată Claude:**
- nu decide facturarea;
- nu scrie în DURIA;
- nu ocolește motorul de reguli.

Orice cifră sau cod propus de Claude trece prin aceleași verificări ca restul: catalog, perechi, intervale, Praxisregeln.

## 3. Arhitectură

- **Apelul se face din Rust, nu din fereastră.** Cheia API stă în Windows Credential Manager, criptată cu DPAPI, nu în `arbeitsplatz.json` și nu în fereastră. CSP-ul ferestrei rămâne fără acces la internet. Rust vorbește doar cu `api.anthropic.com` (HTTP direct; nu există SDK Anthropic oficial pentru Rust).
- **Furnizori interschimbabili** în Einstellungen: `aus` (implicit) / `lokal` (Ollama) / `Claude API`. Activarea se face doar de medic, pe tot cabinetul, cu motiv, la fel ca la Praxisregeln.
- **Model:** `claude-opus-5-5` implicit. Pentru volume mari, cabinetul poate alege `claude-sonnet-5-5` sau `claude-haiku-5-5` (decizie de cost a cabinetului). Gândire adaptivă cu effort `low` pentru extracție. Ieșire structurată (`output_config.format`) pentru JSON valid. Se verifică mereu `stop_reason` (inclusiv `refusal`).
- **Ce se trimite, minimizat:**
  - doar fragmentul necesar (de exemplu o notiță), deja curățat de Rust (nume, data nașterii, adresă → „[entfernt]”);
  - **fără număr de pacient și fără pseudonim**;
  - fără tot dosarul.

  Înainte de trimitere există **previzualizarea „Was wird gesendet”**, apoi un jurnal de audit fără conținut (cine, când, funcție, model, nr. de tokeni).
- **Prompt injection:** textul din fișă e trimis ca date. Instrucțiunea de sistem spune că orice instrucțiune din text se ignoră, iar rezultatul e validat strict de schemă.
- **Fallback:** fără rețea, la timeout sau la refuz, programul continuă pe reguli, cu mesaj.

## 4. Condiții legale (înainte de date reale), decizia cabinetului

- **Contracte:** acord de prelucrare cu Anthropic (DPA, art. 28 GDPR). Pentru §203 StGB, Anthropic trebuie obligat contractual la confidențialitate.
- **Transfer în afara UE (SUA):** temeiul trebuie verificat (DPF/SCC). Merită cerute retenție zero (ZDR) și, dacă e disponibilă, regiune UE.
  - **Notă:** modelele Fable nu sunt disponibile cu ZDR; Opus/Sonnet/Haiku da.
- **Documente interne:** actualizarea registrului de prelucrări, a informării pacienților și a DPIA (date de sănătate, art. 9).
- **Responsabil:** cine răspunde de cheia API și de costuri.

## 5. Etape

0. Decizia cabinetului și contractele (DPA, ZDR), contul API, DPIA. **Fără asta, doar date sintetice.**
1. Rust: furnizorul Claude, cheia în Credential Manager, setarea „Claude API” cu „Verbindung testen”, jurnalul de audit, minimizarea + previzualizarea. Teste fără rețea (răspunsuri simulate).
2. **Extracția de fapte din dictare** (cel mai mare câștig), cu schemă JSON fixă, rezultat „unsicher”, confirmare de medic.
3. Propuneri ICD (validate în catalog) și rezumatul notițelor.
4. Formulare: propuneri pentru câmpurile de text.
5. **Set de evaluare** cu cazuri sintetice: cât de des are Claude dreptate față de reguli, cost per caz. Decizia pe model se ia pe date, nu pe impresie.
6. Pilot în cabinet, cu cheia cabinetului.

## 6. Cost (orientativ, de măsurat la etapa 5)

O extracție dintr-o notiță are câteva sute până la câteva mii de tokeni. Prețurile actuale (USD per milion de tokeni, intrare/ieșire): Opus 5.5 $4/$20, Sonnet 5.5 $2/$10, Haiku 5.5 $0,10/$0,50. Costul real per zi se măsoară pe cazurile sintetice înainte de pilot.
