# Răni, mică chirurgie și îngrijire postoperatorie

26.10.2026. **70 de clauze pentru 14 cifre**, cu **78 de ancore** în surse: EBM Q4/2026 și PDF-ul oficial G-BA MVV-RL în vigoare din 09.09.2026. Originalul G-BA și proveniența sunt fixate în `sources.manifest.json`; EBM folosește manifestul general. Sunt incluse 02300–02302, 02310–02314, 02350, 02360, 31600 și 40901–40903.

Dosarul este `draft`, `review:pending`, `operational:false`, `complete:false`. Nu este activat în aplicație și nu este o certificare a eligibilității celor 14 cifre. GOÄ, HZV, contextul regional și maparea completă OPS/Hybrid-DRG rămân separate.

## Distincții pentru integrare

- **02300/02301/02302:** rutele de conținut sunt alternative și diferite; 02302 nu este rezervat numai copiilor. Anestezia locală/de conducere necesară este inclusă. Nu echivala puncția cu mică chirurgie.
- **Repetare/combinație:** excepția D22.-/T01.- din Präambel 2.3 Nr.4 poate permite repetare și asociere între cele trei coduri, maximum **cinci în total pe zi**. Diagnosticul și prestațiile efective trebuie documentate; nu crea diagnostice pentru facturare. Excepția nu anulează celelalte excluderi ale codurilor.
- **Anestezie:** excluderea 02300–02302 cu 05330/05331 are excepția actorilor din specialități diferite conform 5.3. Nu o extinde la 05320 sau la orice două conturi de medic.
- **02310:** manevrele pentru rană secundară/decubit și minimum trei contacte, o dată în Behandlungsfall. Unul dintre contacte poate fi video conform 4.3.1; 4.3.3/4.3.4 prevăd și contextul Arztfall. Nu transfera automat excepția video la 02360 și nu număra duplicatele textului ca contacte.
- **02311:** conținutul include necrozele extinse și încălțămintea adecvată, cu pragul/qualificările prevăzute. Pansamentul singur nu este suficient. Excepția chirurgiei/ortopediei/dermatologiei privește calificarea pentru instruire, nu o scutire universală de toate condițiile.
- **02312/02313:** per picior și ședință, cu documentația fotografică/măsurătorile prevăzute. Plafoanele sunt 4.244, respectiv 3.750 puncte și se aplică atât în Behandlungsfall, cât și în Arztfall. Nu transforma plafonul în număr fix de ședințe sau în plafon separat per rană.
- **02314:** contact personal și sistem VAC aplicat/schimbat imediat după îngrijirea rănii. G-BA cere indicație adecvată, plan medical, controale/revizuirea indicației documentate și dispozitive certificate. Verifică specialitatea și distincția dintre închiderea primară și secundară.
- **40901/40902:** suprafață până la 20 cm² inclusiv/peste 20 cm², legătură cu 02314, limită de trei pe săptămână calendaristică în legenda fiecărei cifre. Schimbarea suprafeței/codului nu este declarată ca resetare a limitei; cazurile mixte rămân pentru revizie. **40903** privește pompa per zi calendaristică; nu cere automat repetarea 02314 în fiecare zi.
- **02350:** fixare cu minimum o articulație mare și materialele specificate; un pansament obișnuit nu satisface legenda. **02360** privește tratamentul funcțional/durerii, nu anestezia unei suturi.
- **31600:** controlul și discutarea constatărilor după intervenția eligibilă; componentele de pansament/drenaj sunt incluse. Există reguli pentru zilele postoperatorii 1–21, un singur complex și acord între medicii participanți. Ruta Hybrid-DRG/88110 este temporară până la 31.12.2026; excepția fără Überweisung privește intervențiile Hybrid-DRG efectuate de spital, nu toate operațiile spitalicești.

Cele **28 de liste de excluderi** păstrează intervalele distincte. Listele lungi 02300/02301/02302 sunt diferite: de exemplu, 02323 apare în lista 02300, iar 18320 în lista 02301, fără a fi copiate automat în celelalte liste. Secțiunile excluse rămân și ele atașate sursei. Marcajele originale `unresolved_neben` se păstrează în surse. Registrul comun clarifică acum 426 de perechi din cele șapte liste 02300–02302/02310–02313, cu excepțiile aplicabile legate separat; secțiunile și eligibilitatea rămân de verificat.

## Interogare și reproducere

```powershell
python -X utf8 scripts/build-wounds-review.py
python -X utf8 scripts/build-billing-scope-resolutions.py
python -X utf8 scripts/build-billing-release.py
python -X utf8 scripts/verify-wounds-review.py
python -X utf8 scripts/verify-billing-release.py
python -X utf8 scripts/review-billing-code.py --system EBM --code 02310 --details
python -X utf8 scripts/review-wound-combination.py --first 02300 --second 02301
python -X utf8 scripts/review-wound-combination.py --first 02300 --second 02311
python -X utf8 scripts/review-wound-combination.py --first 31600 --second 02350
```

Interogarea perechii verifică hashurile și selectează excepțiile relevante **doar pentru perechea dată** în `exceptions_to_review`. O trimitere la o excepție în lista sursă nu este o aprobare generală. Apartenența la secțiuni nu se ghicește din prefixul cifrei; `section_constraints` cere verificare separată. Lipsa unei potriviri nu înseamnă combinație permisă. Verdictul rămâne întotdeauna `not_verified`; nu sunt evaluate pacientul, data, medicul, rana ori prestația efectuată.

Actualizare 27.10: schema intervalelor 1.10.0 cere `exception_record_ids` pentru fiecare pereche a acestui dosar. Trei perechi trimit la excepția intervențiilor multiple și șase la excepția anesteziei. Interogarea returnează `scope_clarifications`, păstrează `parameters.source_scope` și nu modifică excepțiile sau intervalele explicite pe zi/caz/postoperator. Verificatorul comun adaugă 852 de interogări în ambele sensuri; contractul și șase probe suplimentare pentru aplicație sunt în `../scope-resolutions/README.md`.

Cele **27 de scenarii de interogare/refuz** verifică excepțiile în ambele sensuri, izolarea excepției de celelalte perechi, ferestrele zi/caz/postoperator, cifre neacoperite, secțiuni neconfirmate, repetiția aceleiași cifre și separarea sistemelor. Nu sunt teste de integrare sau aprobare medicală.

## Probe necesare în aplicație

| Caz sintetic | Rezultat cerut după implementare |
|---|---|
| 02300 + 02301 cu diagnostic și prestații relevante confirmate | Revizie a excepției; numărătoare comună pe zi, fără activare automată numai din ICD |
| Șase prestații din 02300–02302 într-o zi | Detectează depășirea plafonului comun, chiar dacă fiecare cod separat are sub cinci |
| 02300 + 02311 și diagnostic D22.- | Nu extinde excepția D22.- la această pereche |
| 02300 + 05330, același medic versus medici din specialități diferite | Aplică distincția de actor; nu decide din numărul conturilor |
| 02310 cu două contacte personale și un video eligibil | Verifică excepția video și conținutul; nu respinge pentru lipsa a trei prezențe fizice |
| 02310 cu un singur contact repetat în trei rânduri | Nu număra rândurile ca trei contacte |
| 02312 cu două ulcere pe același picior în aceeași ședință | Nu multiplica după numărul ulcerelor; verifică unitatea și plafonul cazului |
| VAC la exact 20 cm² | 40901 este banda descrisă de normă; restul condițiilor și istoricul rămân obligatorii |
| Numai schimb de pansament în complexul postoperator | Nu transforma componenta inclusă în 02350 sau altă prestație separată fără conținut propriu |
| Operație spitalicească fără Überweisung și fără dovada rutei Hybrid-DRG | Nu generaliza excepția temporară |

Rămân necesare istoricul complet al contextului relevant, autorizările și calificările, sursele OPS/Hybrid-DRG aplicabile, revizia competentă și testele de integrare. Sursele de aici sunt delimitate la Q4/2026; excepțiile temporare nu se prelungesc automat.
