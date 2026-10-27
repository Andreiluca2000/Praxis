# Hausbesuch, solicitări neprevăzute și delegare

26.10.2026. Dosar parțial de revizie EBM Q4/2026: **87 de clauze, 21 de cifre, 105 ancore în PDF-ul oficial KBV**. Sunt incluse 01100/01101/01102, 01410/01411/01412/01413/01415/01418, 03060–03065, 38100/38105 și 38200/38202/38205/38207. Ultimele două rute la domiciliu sunt incluse și pentru a preveni folosirea pe un profil Hausarzt nepermis de normă.

`rules.review.json` rămâne `draft`, `review:pending`, `operational:false`, `complete:false`. Sursa originală, localizările și SHA-256 provin din `../sources.manifest.json`. Nu este un catalog activ pentru motorul aplicației. Nu include reguli GOÄ/HZV, tarife regionale de drum sau conținutul complet al anexelor BMV-Ä.

## Distincții necesare în motor

- **01100/01101:** caracter neprevăzut, tratament curativ, orar și excluderea consultațiilor/programărilor din intervalele descrise. **01102** are propria rută de sâmbătă; nu moștenește automat toate condițiile 01100.
- **01411/01412:** execuție fără întârziere după solicitare. 01412 are și ruta întreruperii Sprechstunde cu părăsirea Praxisului; nu este numai cod de noapte. **01415** cere execuție în ziua solicitării, instituție și personal de îngrijire. **01418** privește serviciul organizat și cere ora solicitării.
- **01413 + 01102:** combinație numai în condițiile instituției/personalului/solicitării speciale descrise; nici interdicție universală, nici permisiune generală.
- **01413 și 38105:** legătură cu prima vizită la alt pacient. Nu adăuga `requires_code` pe fișa pacientului curent. Dovada legăturii poate necesita un eveniment de tură validat; exportul individual poate fi insuficient. Nu importa identitatea celuilalt pacient doar pentru această dovadă.
- **03063:** există și ruta postoperatorie de la a doua vizită 31600; nu impune obligatoriu un alt pacient în această rută.
- **03062/03063 cu vizita medicului:** excepție pentru caz individual justificat, în contextul vizitei delegate separate. Păstrează excepția lângă lista restrictivă a prestațiilor suplimentare din Präambel 3.2.1.2 Nr.6.
- **03062/03063 față de 38100/38105:** excluderi explicite pentru întreaga zi. 38100 și 38105 se exclud, de asemenea, în ziua de tratament a aceluiași pacient; nu interpreta acest lucru ca interdicție pentru pacienți diferiți din aceeași tură.
- **38100/38105:** manevrele ordonate au propria posibilitate de facturare și condiții proprii; nu copia lista restrictivă de la 03062/03063. Costurile de drum sunt deja incluse în aceste patru cifre de vizite delegate.
- **03060/03061/03064/03065:** adăugate de KV. Plafonul comun 03060/03061 este la nivelul Praxisului/trimestrului; nu per pacient. Absența în exportul local nu dovedește o omisiune a medicului.
- **38200/38205:** rute instituționale permise specialităților Hausarzt enumerate, cu autorizări și condiții. **38202/38207:** nu se propun pe acel profil Hausarzt; lista specialităților admise rămâne obligatorie.

Excluderile fără interval explicit `nicht neben` păstrează `unresolved_neben`. Cele 24 de liste de excluderi din dosar sunt confruntate automat, inclusiv extinderea intervalelor de cifre, cu textul oficial. Numărul lor nu se adună la dosarul anterior ca și cum nu ar exista suprapuneri.

## Interogare și verificare

```powershell
python -X utf8 scripts/build-visits-review.py
python -X utf8 scripts/build-billing-release.py
python -X utf8 scripts/verify-visits-review.py
python -X utf8 scripts/verify-billing-release.py
python -X utf8 scripts/review-billing-code.py --system EBM --code 01413 --details
python -X utf8 scripts/review-visit-combination.py --first 01413 --second 01102
python -X utf8 scripts/review-visit-combination.py --first 03062 --second 01410
python -X utf8 scripts/review-visit-combination.py --first 38100 --second 03063
```

Utilitarul de perechi caută relațiile din acest dosar și aplică registrul comun `../scope-resolutions/rules.review.json` numai perechilor exacte, verificând hashurile. Pentru 03100 cu 38200/38205 returnează `session` și păstrează intervalul original în `source_scope`. Completarea din 27.10 adaugă 13 perechi de delegare: 03062/03063 între ele și fiecare cu 37535/37635, 38100/38105 fiecare cu 37535/37635, precum și 38200/38205 fiecare cu 38202/38207. Astfel, cele șase liste au intervalele tuturor perechilor explicite clarificate; condițiile de eligibilitate rămân separate. Excluderile pe zi și asocierile condiționate cu medicul nu sunt suprascrise. Returnează clauzele, intervalele și condițiile relevante; **nu evaluează pacientul și nu decide eligibilitatea**. Absența unei potriviri nu înseamnă combinație permisă. O cifră prezentă în lista `only_with` nu devine automat facturabilă. Codurile pentru alt sistem și HZV nu au fallback la EBM.

Lotul Hausbesuche/solicitări neprevăzute din 27.10 adaugă în registrul comun **131 de perechi distincte** din nouă liste: 01100–01102, 01410–01413, 01415 și 01418. Aceste liste au acum intervalele explicite clarificate pe ședință. 01102/01413 rămâne o asociere condiționată, iar 01100–01102 cu 01955/01956 păstrează excluderile pe întreaga zi. Cifrele altor specialități rămân parteneri de referință. Relația dintre vizita inițială și Mitbesuch la alt pacient nu se transformă într-o excludere între fișe.

Cele **27 de scenarii automate** verifică interogarea în ambele sensuri, excluderi explicite pe zi, excepția instituțională, vizita delegată plus vizita medicului, păstrarea listei restrictive alături de excepție, cifre neacoperite, repetarea aceleiași cifre și separarea sistemelor. Verificatorul registrului comun adaugă **262 de interogări în ambele sensuri** pentru perechile noi și verifică păstrarea condițiilor de sâmbătă și a intervalelor pe zi. Nu sunt teste de integrare în aplicație.

## Probe de acceptanță rămase pentru Claude

| Situație sintetică | Comportament necesar după implementarea contextului |
|---|---|
| 01100 propus pentru consultație programată în intervalul exclus | Nu transforma ora târzie în dovadă de solicitare neprevăzută |
| 01413 la un al doilea membru al familiei, sâmbătă, fără condițiile instituționale | Nu aplica automat excepția pentru 01102 |
| 01413 într-o instituție eligibilă, cu solicitare specială și context complet | Revizie a excepției; evită interdicția absolută |
| 01413 fără 01410 în aceeași Karteikarte, dar cu primă vizită validată la alt pacient | Nu raporta bază lipsă în fișa curentă; verifică legătura fără identități străine |
| 03063 pentru a doua vizită postoperatorie la același pacient | Verifică ruta postoperatorie, nu impune alt pacient |
| 03062 dimineața și 38100 seara la același pacient | Detectează excluderea pentru întreaga zi |
| 38100 la primul pacient și 38105 la alt pacient în aceeași tură | Nu aplica excluderea între fișe diferite |
| 03062 și 01410, cu vizite separate și justificare individuală | Revizie a excepției explicite; nu aproba doar din prezența celor două coduri |
| 03064 absent în exportul medicului | Verifică atribuirea KV, nu propune automat transmitere suplimentară |
| 38202 pe profil Hausarzt din lista limitată a Präambel 38.1 | Nu propune codul ca rută eligibilă pentru acel profil |

Rămân necesare condițiile generale, autorizațiile efective, anexele BMV-Ä, calificarea și rolul prestatorului, documentarea, istoricul și profilul contractual, revizia competentă și integrarea. Dosarul actual nu închide aceste cerințe prin simpla existență a clauzelor.
