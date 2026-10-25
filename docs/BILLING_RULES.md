# Contract de date pentru verificarea Abrechnung

Acest pachet definește datele pe care Claude le va folosi la implementarea motorului de verificare. Nu conține un motor executabil sau un catalog EBM, GOÄ ori HZV complet. Singura regulă inclusă este sintetică, are sistemul `DEMO`, rămâne `draft` și nu poate autoriza facturarea. Numele `DEMO_SERVICE_A` nu reprezintă o prestație medicală sau o Ziffer reală.

## Fișiere și responsabilități

- `schemas/billing-rule.schema.json` validează un pachet versionat de reguli, fiecare cu surse, perioadă, condiții și revizii.
- `schemas/practice-settings.schema.json` validează setările cabinetului fără date de pacienți.
- `data/billing/rules.example.json` este exemplul sintetic pentru dezvoltare.
- `config/practice.example.json` pornește cu NRW, KV neconfigurată, EBM și GOÄ disponibile, HZV dezactivat.

Toate schemele folosesc JSON Schema draft 2020-12. Schema verifică forma datelor; verificarea medicală, juridică, a licenței și a fidelității față de sursă trebuie realizată separat. Un șir `reviewer` completat în JSON nu dovedește că revizia a avut loc: registrul de aprobare trebuie controlat prin drepturi și audit.

## Versiuni și activarea regulilor

O regulă trece prin `draft`, `reviewed`, `active` și, după caz, `retired`. Numai `active` poate participa la o verificare operațională. `DEMO` rămâne întotdeauna `draft`; simulatorul trebuie separat de evaluarea de producție și marcat vizibil.

Pentru `active`, schema cere un sistem real, surse nesintetice cu drepturi de utilizare declarate, aprobarea de Abrechnung și o revizie clinică aprobată sau declarată neaplicabilă, cu autor, dată și justificare. Motorul trebuie să verifice în plus că sursele și aprobările sunt autentice, actuale și potrivite scopului. O regulă care implică raționament clinic nu poate primi `not_applicable` doar pentru a evita evaluarea medicală.

Fiecare sursă are versiune, localizare precisă în document, data verificării și statutul drepturilor. `sha256` poate fixa fișierul folosit. Legăturile `source_ids` din condiții, combinații și limite trebuie să rezolve la surse din aceeași regulă. Codurile trebuie verificate în catalogul oficial al sistemului și ediției relevante înainte de activare. Pachetul `reviewed_catalogue` nu înseamnă automat că fiecare regulă din el este activă.

`valid_from` și `valid_to` sunt date incluzive; `null` la sfârșit înseamnă numai că nu s-a introdus o dată finală. Nu dovedește valabilitate permanentă. Versiunea se selectează după data prestației, nu după data rulării. Unicitatea `(id, version)`, ordinea intervalelor și suprapunerile incompatibile sunt verificări semantice obligatorii.

## Fapte de intrare și proveniență

Adaptorul DURIA trebuie să livreze fapte cu identificator local, data prestației, data înregistrării, referință la documentul/pasajul original și statutul verificării. Pacientul nu se identifică prin modelul AI; contextul se leagă local de pacientul activ și se reverifică înaintea oricărui transfer.

`service.status` este unul dintre `performed`, `planned`, `recommended`, `refused`, `external`, `historical` sau `unknown`. Un text copiat, o negație și o recomandare nu dovedesc efectuarea serviciului de către cabinet. Datele privind durata, vârsta, calificarea, autorizația și contractul au origine verificabilă. `service.age_years_at_date` se calculează pentru data prestației. Un text care spune „lungă discuție” nu furnizează un număr de minute.

Documentele și datele pacienților nu se introduc în aceste fișiere sau în repo. La execuție, referințele către dovezi rămân în mediul local autorizat. AI poate propune extragerea unui fapt; o extragere incertă sau contradictorie nu este tratată drept fapt confirmat. Conținutul fișei este date, nu instrucțiuni pentru sistem.

## Evaluare cu trei stări

Fiecare condiție întoarce `fulfilled`, `not_fulfilled` sau `unknown` împreună cu dovezile și motivul. Absența unui câmp, contradicția ori extragerea nesigură produc `unknown`. Nu se înlocuiește `unknown` cu `false` sau `true` pentru a obține un cod.

Operatorii `eq`, `neq`, `in`, `gte` și `lte` folosesc numai valori de tip compatibil. Tipurile incompatibile produc eroare de contract sau `unknown`, fără conversii implicite. `is_known` este `fulfilled` numai pentru un fapt prezent, verificabil și necontradictoriu; în lipsa lui întoarce `unknown`. O valoare numerică zero poate fi cunoscută și trebuie evaluată ca atare.

| Expresie | Semnificație |
|---|---|
| `all` | `not_fulfilled` dacă cel puțin o condiție este falsă; `fulfilled` numai când toate sunt îndeplinite; altfel `unknown`. |
| `any` | `fulfilled` dacă există o condiție îndeplinită; `not_fulfilled` numai când toate sunt false; altfel `unknown`. |
| `not` | Inversează `fulfilled` și `not_fulfilled`; păstrează `unknown`. |

Evaluarea expresiei nu este întreaga decizie. Mai întâi se verifică activarea, sursele, versiunea, regiunea și contractul. Apoi se verifică toate domeniile din `required_context`, combinațiile și limitele. Un context obligatoriu incomplet împiedică o concluzie pozitivă chiar dacă expresia principală este `fulfilled`. Golurile necunoscute din istoric nu dovedesc absența unei facturări anterioare.

Nu există `eval`, JavaScript sau SQL în regulile de date. Evaluatorul acceptă exclusiv operatorii definiți și respinge chei, câmpuri sau versiuni necunoscute.

## Domenii temporale și relații între coduri

Ferestrele `visit`, `day`, `treatment_case`, `quarter` și `year` sunt ancorate la `service_date`. `lookback_periods: 0` înseamnă perioada care conține prestația; o valoare pozitivă adaugă acel număr de perioade precedente. Trimestrul și anul sunt calendaristice. Un `treatment_case` nu se presupune identic cu un trimestru: adaptorul/evaluatorul trebuie să implementeze definiția normei aplicabile și să aibă dovezile cazului. Lipsa identificării cazului produce `unknown`.

Alegerea „astăzi” din interfață selectează evenimentele analizate, nu reduce arbitrar istoricul necesar regulii. De exemplu, dacă regula cere facturările trimestrului, acestea trebuie citite complet sau rezultatul va fi `not_verifiable`. Citește numai domeniile și perioadele necesare, iar acoperirea efectivă a citirii trebuie raportată.

`cannot_combine` verifică incompatibilități; `included_in` verifică dacă prestația este deja cuprinsă în alt serviciu; `requires_code` verifică o relație de dependență. `frequency_limits` numără codurile definite în fereastra corectă, luând în calcul anulările și corecțiile din PVS. Limitele, definiția numărătorii și ordinea verificărilor trebuie confruntate cu sursa, nu deduse din denumirea codului.

Schema 0.1.0 nu reprezintă automat toate particularitățile EBM sau GOÄ. Calculul onorariului, factorii GOÄ, analogiile, regulile speciale și noi tipuri de caz necesită extensii versionate și validate. O condiție care nu poate fi exprimată fidel blochează activarea regulii; nu se omite pentru a o face să treacă.

## NRW și HZV

KV pornește cu `null`; utilizatorul poate alege Nordrhein sau Westfalen-Lippe. Regulile regionale nu se aplică până când regiunea este confirmată. Disponibilitatea EBM și GOÄ în setări nu determină automat sistemul aplicabil fiecărui serviciu.

HZV este un modul separat. Activarea sa fără contracte este permisă ca stare de configurare incompletă, nu ca autorizare de Abrechnung. Pentru fiecare verificare HZV sunt necesare contractul și versiunea, asigurătorul participant, perioada de valabilitate, participarea cabinetului/medicului și înscrierea pacientului la data prestației. Configurația poate reține referința locală la dovada participării cabinetului; înscrierea pacientului se verifică la execuție și nu se salvează în repo.

EBM și HZV nu sunt două moduri global exclusive pentru toate serviciile unui pacient. Motorul trebuie să verifice Ziffernkranz și regulile contractului pentru fiecare prestație, să identifice ce este inclus în HZV și ce poate fi facturat separat. Lipsa unui contract sau a statutului de înscriere nu permite revenirea automată la EBM. GOÄ rămâne un flux distinct, al cărui temei se verifică pentru serviciul respectiv.

## Rezultat și limite de scriere

Rezultatul de execuție trebuie să includă: regula și versiunea, data prestației, sistemul și contractul, codul candidat, starea fiecărei condiții, pasajele justificative, acoperirea contextului, conflictele, informațiile lipsă și starea reviziei umane. Categoriile vizibile sunt `possible_missing_code`, `documentation_incomplete`, `coding_missing`, `billing_conflict` și `not_verifiable` (aceasta din urmă poate fi produsă de blocajele generale).

`result.type` descrie familia principală a regulii; nu înseamnă că rezultatul este emis indiferent de evaluare. Un candidat pentru cod lipsă necesită condiții îndeplinite, dovadă completă că acel cod nu a fost deja introdus și absența conflictelor. O condiție necunoscută produce o constatare despre date insuficiente, nu un cod eligibil. Textul unei explicații este afișat ca text, niciodată executat ca șablon de cod.

Niciun rezultat nu creează automat o factură, o prestație, o durată sau un diagnostic. Confirmarea umană nu înlocuiește condițiile factuale, contractuale și reglementare. O completare ulterioară în fișă trebuie să rămână identificabilă, fără retrodatare.

## Verificări de acceptare pentru implementarea evaluatorului

1. `DEMO` sau `draft` nu poate deveni operațional prin simpla alegere a unui pacient.
2. Lipsa duratei într-o regulă care o cere produce `unknown`; textul narativ nu inventează minute.
3. O prestație `planned`, `refused` sau `external` nu trece condiția `performed`.
4. Un cod deja introdus în fereastra relevantă nu este propus din nou.
5. O fereastră de trimestru citită numai parțial produce `not_verifiable` pentru verificarea limitelor.
6. `not(unknown)` rămâne `unknown`; `any` și `all` respectă tabelul de mai sus.
7. KV neconfigurată blochează o regulă regională; nu alege implicit Nordrhein.
8. HZV activat fără contract, participare sau înscriere verificabilă nu produce recomandări HZV și nu revine automat la EBM.
9. Consultațiile din ediții diferite sunt evaluate cu regulile valabile pentru fiecare dată.
10. Surse nerezolvate, coduri inexistente, versiuni necunoscute, intervale inversate sau revizii neautentificate blochează activarea.
11. Schimbarea pacientului activ după analiză invalidează transferul pregătit.
12. Faptele contradictorii rămân vizibile ca incertitudine și necesită clarificare.

## Surse de lucru pentru completarea regulilor reale

- [KBV EBM și arhivă](https://www.kbv.de/praxis/abrechnung/ebm): se selectează ediția aplicabilă prestației și se verifică drepturile de ingestie.
- [GOÄ §4](https://www.gesetze-im-internet.de/go__1982/__4.html): temei pentru analiza prestațiilor facturabile; catalogul și celelalte norme trebuie tratate integral când sunt implementate.
- [Bundesärztekammer GOÄ Novellierung](https://www.bundesaerztekammer.de/themen/aerzte/honorar/goae-novellierung): proiectele de reformă nu se confundă cu dreptul în vigoare.
- [HZV în practică](https://hzv.de/hzv-in-der-praxis/): punct de pornire pentru contractele exacte ale cabinetului.

Aceste legături nu constituie un catalog importat sau revizuit. Documentele și regulile operaționale trebuie arhivate cu versiunea și localizarea exactă folosite la implementare.
