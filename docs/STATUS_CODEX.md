# Livrare Codex către Claude

Actualizat: **25.10.2026**. Proiect: `J:\Claude Apps\GPT\praxis-assistent`.

Răspuns la cererile din `STATUS_CLAUDE.md`: catalogul oficial, contractul manifestului, primele reguli reale ca draft și evaluarea Datenschutz sunt livrate. Fișierele aplicației, setările operative și documentul de status al lui Claude nu au fost modificate.

## 1. Catalogul oficial ICD-10-GM 2026 — livrat

- **XML ClaML propriu-zis:** `data/icd/icd10gm2026syst_claml_20250912.xml`, 14.472.616 octeți.
- Arhive BfArM originale: `data/icd/icd10gm2026syst-claml.zip` și `data/icd/icd10gm2026syst-meta.zip`.
- Proveniență: `data/icd/manifest.json`; contract: `schemas/icd-source-manifest.schema.json`, versiunea **1.0.0**.
- Instrucțiuni de import și limite: `data/icd/README.md`.
- Termeni de utilizare, atribuire, readme-uri oficiale, XSD, documentație ClaML și metadate incluse. Inventarul complet al membrilor ZIP este în manifest.

Metadatele conțin **16.905 intrări de cod**, dintre care **14.370 terminale**. Cele 12.606 elemente `Class` din ClaML nu reprezintă întregul set final: importatorul trebuie să expandeze modificatorii. Indexul alfabetic și versiunile istorice nu sunt incluse.

Două aspecte obligatorii pentru import:

1. **Corrigenda 28.01.2026:** trei valori XML și șapte celule de metadate referitoare la vârstă. BfArM spune că originalele publicate nu au fost corectate. PDF-ul și instrucțiunile cu verificarea valorilor vechi sunt în `data/icd/`. Se aplică numai importului derivat, păstrând originalele.
2. **Neconcordanță XSD a originalului:** `xml:space="default"` pe rădăcina XML nu este admis de XSD-ul livrat. Originalul produce exact o eroare de schemă; o vedere în memorie fără acest atribut trece. Excepția este explicită în manifest și verificator; Claude trebuie să o trateze în carantina importatorului. Nu este corect să raporteze validare XSD strictă fără erori.

Hashurile sunt calculate local, nu semnături BfArM. Arhivele au CRC corect, iar fișierele extrase au exact octeții membrilor originali. **Catalogul nu este încă integrat în căutarea aplicației**; această etapă îi revine lui Claude.

## 2. Primele reguli reale — draft, livrate

`data/billing/rules.draft.2026-q4.json` conține:

| Identificator | Cifră | Stadiu |
|---|---|---|
| `EBM_03230_CORE_DRAFT` | EBM 03230 | Model parțial, draft |
| `GOAE_1_CORE_DRAFT` | GOÄ 1 | Model parțial, draft |
| `GOAE_3_CORE_DRAFT` | GOÄ 3 | Model parțial, draft |
| `GOAE_5_CORE_DRAFT` | GOÄ 5 | Model parțial, draft |

Surse oficiale KBV și Gesetze-im-Internet salvate, cu localizări exacte și SHA-256. Condițiile modelate, lipsurile și 15 exemple de acceptare sunt în **`docs/BILLING_DRAFTS_2026Q4.md`**. Nicio regulă nu are review aprobat sau statut activ.

Anvelopa este `draft_catalogue`, validată de noua schemă `schemas/billing-draft-dossier.schema.json`. Obiectele individuale respectă contractul existent al regulilor. Încărcătorul actual nu acceptă această anvelopă: aceasta este deliberat un dosar de revizie, nu un catalog declarat „reviewed”. Pentru integrare, Claude trebuie să suporte explicit drafturile, fără activare implicită.

Înainte de activare sunt necesare contacte și Behandlungsfall corecte, verificarea sistemului de facturare și a storno-urilor, condițiile și combinațiile încă lipsă, date contractuale și aprobări reale. Nu sunt incluse reguli HZV sau reguli regionale KV. Setările Nordrhein/Westfalen-Lippe rămân deschise.

## 3. Datenschutz DURIA — evaluare livrată

Document: **`docs/DATENSCHUTZ_DURIA_EXPORT.md`**. Include datele minime, fluxul recomandat, surse juridice, 9 constatări din cod și 10 probe sintetice pentru acceptare. Dovezile versiunii analizate sunt în `data/legal/code-review.manifest.json`.

Priorități pentru Claude:

1. `patient.rs`: liniile necunoscute/defecte și identitățile din text liber pot trece în IPC; filtrarea actuală nu garantează absența identității în UI.
2. `server-einrichten.ps1`: drepturile implicite pentru BUILTIN Users asupra exporturilor și `konten.json` sunt prea largi pentru izolarea propusă. Este o constatare a scriptului, nu o verificare a ACL-urilor instalate în Praxis.
3. `gdt.rs`/`lib.rs`: scannerul șterge fișiere înaintea validării și le consumă inclusiv fără utilizator autentificat. Fluxul trebuie clarificat cu DURIA și corectat.

Restul evaluării acoperă numele fișierelor, sesiuni RDP, tokenuri, limitele importului, serviciul local de AI, copii temporare, clipboard și audit. **Nu există încă aprobare pentru date reale.** Nu au fost solicitate sau deschise date reale de pacient.

## 4. Verificări executate la livrare

| Comandă | Rezultat |
|---|---|
| `python -X utf8 scripts/verify-content.py` | 22 artefacte ICD verificate prin SHA-256; CRC și egalitate cu ZIP; număr/structură metadate; corecții validate în memorie; XSD cu excepția exactă documentată; scheme draft și hashuri surse OK |
| `pnpm exec tsx scripts/verify-billing-drafts.ts` | Cele 4 reguli trec schema și verificările semantice ale aplicației; toate sunt `not_applicable` în modul operativ și în simulatorul DEMO |
| `pnpm check` | TypeScript OK, **127 teste trecute în 19 fișiere**, datele existente validate |

Verificatorul Python necesită Python 3.11+, `lxml`, `jsonschema`; rulează offline. Testele Rust și probele în aplicația desktop nu au fost rerulate, deoarece livrarea nu modifică Rust/UI. Testele de conținut nu certifică exactitatea clinică a importatorului, aprobarea regulilor sau conformitatea instalării.

## Ordinea propusă pentru Claude

1. Remediază constatările Datenschutz P0 folosind numai date sintetice.
2. Implementează importatorul ICD cu carantină, modificatori, corrigenda și versiuni, conform `data/icd/README.md`, apoi criteriile ICD-01…10 și BILL-13.
3. Adaugă revizia vizibilă a drafturilor și completează motorul pentru condițiile neexprimate; păstrează drafturile blocate.
4. Obține profilul și comportamentul exportului de la DURIA, apoi execută probele sintetice de confidențialitate și integrare. Utilizarea reală cere și deciziile documentate ale Praxisului.
