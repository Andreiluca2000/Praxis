# Primele reguli reale de Abrechnung — dosar de verificare

25.10.2026. Livrare pentru Claude și responsabilul medical/de Abrechnung al Praxisului. Date: `data/billing/rules.draft.2026-q4.json`; surse originale și hashuri: `data/billing/sources.manifest.json`.

**Toate cele patru reguli sunt `draft`, cu verificările billing și clinical `pending`. Sunt modele parțiale, nu recomandări facturabile și nu un catalog EBM/GOÄ complet.** Nu am schimbat setările, încărcătorul sau motorul aplicației și nu am activat aceste reguli. GOÄ este identificată tehnic prin `GOAE`.

## Contract și integrare

Anvelopa folosește `content_kind: draft_catalogue`, schema `schemas/billing-draft-dossier.schema.json`, versiunea 1.0.0. Fiecare obiect din `rules` respectă contractul existent `billing-rule.schema.json#/$defs/rule`. Am ales o anvelopă separată deoarece contractul curent oferă doar `synthetic_example` și `reviewed_catalogue`; un dosar neaprobat nu trebuie prezentat drept catalog verificat.

Încărcătorul curent nu trebuie alimentat direct cu acest dosar. Claude poate implementa afișarea pentru revizie sau suport explicit pentru anvelopa draft. Conversia către un pachet operativ se face doar după completarea condițiilor și aprobări reale, fără modificarea automată a statusului. `scripts/verify-billing-drafts.ts` verifică forma și condițiile de blocare folosind temporar, numai în memorie, anvelopa veche. Nu salvează un pachet „reviewed” și nu acordă aprobări.

Intervalul de lucru este 01.10–31.12.2026. Pentru EBM reprezintă ediția Q4/2026. Pentru GOÄ este **intervalul ales pentru această revizie**, nu data intrării în vigoare a legii și nu expirarea legală a cifrelor. Reguli pentru trimestre anterioare sau 2027 necesită alte versiuni/surse. Drepturile de reutilizare în produs/distribuire sunt `pending`; acestea nu au fost deduse din simplul acces public.

`jurisdiction: DE` înseamnă prevederi naționale. Nu confirmă drepturi contractuale locale în Nordrhein sau Westfalen-Lippe. Alegerea KV rămâne deschisă în setări. Nu sunt livrate reguli HZV: ele cer contractul, versiunea, participarea Praxisului, înscrierea pacientului la data prestației și Ziffernkranz. Un caz HZV nu trece automat pe EBM.

## EBM 03230

Sursă: [KBV, EBM 4/2026](https://www.kbv.de/documents/praxis/abrechnung/ebm/2026-4-ebm.pdf), pagina PDF 199, aceeași pagină tipărită, GOP 03230 și toate notele sale.

Modelat: conversație efectuată, minimum zece minute și conținutul obligatoriu confirmat; lista codurilor individuale incompatibile din nota GOP și incompatibilitatea cu 30700 în Behandlungsfall. „Conținut confirmat” trebuie legat de documentarea unei discuții necesare datorită naturii și gravității bolii, cu pacientul și/sau o persoană de referință. O mențiune „Beratung”, un diagnostic sau un bifat generic nu dovedește acestea.

Rămâne de modelat înaintea activării:

- Unități pentru fiecare zece minute complete; la 20 de minute pot exista două unități dacă toate condițiile sunt îndeplinite. Verificarea simplă „cod existent azi” nu rezolvă unitățile lipsă.
- Excluderea în urgență și serviciul organizat de gardă.
- Pentru video: cerințele anexei 31b BMV-Ä și marcajul suplimentar. Nu extrapolăm automat la telefon.
- La asocierea cu GOP diagnostice/terapeutice: durata contactului trebuie să includă minimum zece minute în plus față de duratele prevăzute pentru acele GOP.
- Excluderea întregilor secțiuni **35.2.1 și 35.2.2**, care nu este încă expandată într-un set verificat de coduri. Lista individuală din JSON nu le înlocuiește.
- Delimitarea corectă a aceleiași prestații/contact și a Behandlungsfall; toate regulile generale, specialitatea, condițiile contractuale și eventualele consecințe ale regulilor de volum trebuie verificate separat.

Acesta este un schelet de verificare a cerințelor, nu dovada că orice discuție de zece minute permite 03230.

## GOÄ 1, 3 și 5

Surse: [GOÄ, Anlage, Abschnitt B](https://www.gesetze-im-internet.de/go__1982/anlage.html), Allgemeine Bestimmungen și Nr. 1–5; [GOÄ §4](https://www.gesetze-im-internet.de/go__1982/__4.html), în special alineatul 2. Copiile și hashurile sunt păstrate în dosarul de surse.

| Regulă | Ce modelează | Ce lipsește pentru o decizie completă |
|---|---|---|
| GOÄ 1 | Consiliere efectuată și documentată; inclusiv telefonică; nu inventează un prag de minute | Delimitarea față de Nr. 2 și 3, condițiile generale, istoricul Behandlungsfall și asocierea cu secțiunile C–O |
| GOÄ 3 | Consiliere aprofundată, peste nivelul obișnuit, documentată; minimum zece minute | Permisă singură sau împreună cu examinări Nr. 5, 6, 7, 8, 800, 801; schema actuală nu exprimă complet această listă de combinații permise. Repetarea în Behandlungsfall necesită justificare specială, nu este automat interzisă |
| GOÄ 5 | Examinare orientată pe simptom, efectuată și documentată; incompatibilități cu 6–8 și cele din B Allgemeine Bestimmung 8 | O convorbire telefonică nu dovedește examinarea. Lipsesc condițiile generale, istoricul și asocierea cu secțiunile C–O |

Condiții comune obligatorii de adăugat/verificat:

1. În secțiunea B, Behandlungsfall pentru aceeași boală este **o lună de la prima prezentare**, nu trimestrul și nu pur și simplu luna calendaristică. Este necesară identificarea bolii/cazului și a primei prezentări.
2. Nr. 1 și/sau 5 pot fi calculate alături de prestațiile secțiunilor C–O numai o dată în Behandlungsfall. Nu există aici o limită universală „Nr. 1 maximum o dată pe lună” sau „Nr. 5 maximum o dată pe trimestru”. De aceea `frequency_limits` rămâne gol; condiția dependentă de combinații lipsește încă.
3. Repetările în aceeași zi pentru 1, 3, 5–8 cer justificarea prin natura bolii și indicarea orelor pe factură. Pentru Nr. 3 justificarea este întotdeauna cerută, pentru celelalte la solicitare. Verificarea doar după dată nu poate distinge contactele.
4. Nr. 1 și 3 au excluderile din B Allgemeine Bestimmung 4, enumerate în JSON. Alte condiții, inclusiv vizita spitalicească (Bestimmung 5), rămân de modelat.
5. Nr. 2 nu se asociază cu alte taxe la aceeași solicitare; JSON păstrează această incompatibilitate. Simpla programare a unei consultații nu justifică facturarea consilierii.
6. Verificarea onorariului, factorilor și justificărilor, serviciilor analogice, tarifelor speciale și cerințelor facturii nu intră în aceste patru schițe.

## Lacune ale reprezentării curente care împiedică activarea

| Loc în aplicație | Consecință pentru reguli reale |
|---|---|
| `src/engine/windows.ts`, `resolveWindow` | `treatment_case` returnează `null`; `visit` este tratat ca zi. Trebuie cazuri și contacte reale; nu substitui trimestrul sau ziua fără dovadă |
| `src/engine/evaluate.ts`, `billedIn` | Filtrarea actuală se face după cod, dată și stare, fără compararea sistemului EBM/GOAE/HZV. Sistemul și contextul contractual trebuie să facă parte din identitatea prestației |
| `src/duria/adapter.ts`, linia 74 la revizie | Prestațiile importate primesc `system: EBM` și `state: active`. DURIA trebuie să confirme marcarea GOÄ/HZV și storno, înainte de verificări reale |
| `documentation.required_components_complete` | Un singur boolean nu justifică cerințe clinice diferite pentru toate cifrele. Sunt necesare fapte legate de prestație, regulă, contact și dovezi |
| `evidence.complete` / acoperire | Confirmarea utilizatorului nu dovedește că exportul conține toate facturările și toate corecturile. Istoricul incomplet trebuie să producă „nicht prüfbar”, nu „lipsește sigur” |

Aceste constatări sunt cerințe pentru implementarea lui Claude; Codex nu a modificat motorul.

## Cazuri de acceptare pentru extinderea lui Claude

Exemplele sunt sintetice. La stadiul prezent **toate regulile rămân neaplicabile operativ**, indiferent de exemplu. Rezultatele de mai jos sunt așteptări pentru viitoarea implementare completă și aprobată, nu teste deja executate clinic.

| ID | Exemplu | Comportament cerut |
|---|---|---|
| D01 | 03230, conversație confirmată de 9 minute | Nu este candidat pentru 03230 |
| D02 | 03230, durată absentă sau mențiune doar planificată | Necunoscut sau neîndeplinit, fără completare inventată |
| D03 | 03230, 20 de minute documentate, o unitate introdusă | Verifică unitățile și toate condițiile, fără dublarea codului în bloc |
| D04 | 03230 cu 35110 la același contact | Conflict; o durată suficientă nu anulează excluderea |
| D05 | 03230 cu un cod din 35.2.1 sau 35.2.2 | Conflict chiar dacă acel cod nu apare în lista individuală din draft |
| D06 | 03230, 30700 în Behandlungsfall necunoscut/incomplet | Nu poate fi verificat |
| D07 | 03230 în Notfalldienst | Excludere |
| D08 | GOÄ 1, consiliere telefonică documentată de 4 minute | Nu respinge doar fiindcă nu are zece minute; verifică restul condițiilor |
| D09 | GOÄ 3, 9 minute / 12 minute fără conținut aprofundat | Primul nu îndeplinește durata; al doilea nu dovedește prestația |
| D10 | GOÄ 3 împreună cu o prestație în afara setului permis | Conflict, dacă aceeași asociere este stabilită |
| D11 | GOÄ 3 repetată în același Behandlungsfall | Cere justificare specială; nu aplică o interdicție absolută |
| D12 | GOÄ 5 împreună cu 7 la aceeași solicitare | Conflict |
| D13 | GOÄ 1/5 lângă C–O, cu prima utilizare într-un caz început în luna anterioară | Urmărește luna de la prima prezentare pentru aceeași boală, nu luna calendaristică |
| D14 | Aceeași cifră, contacte distincte în aceeași zi; una stornată | Nu confunda contactele; nu număra storno-ul drept prestație activă |
| D15 | Caz HZV fără contract/înscriere confirmate | Nu propune automat EBM |

Verificări executabile pentru livrarea de conținut:

```powershell
python -X utf8 scripts/verify-content.py
pnpm exec tsx scripts/verify-billing-drafts.ts
```

Acestea controlează proveniența, structura, referințele și blocarea drafturilor. Aprobarea medicală, de Abrechnung și de utilizare a surselor rămâne deschisă.
