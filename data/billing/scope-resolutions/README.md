# Clarificări de interval pentru perechi exacte

27.10.2026, orizont de revizie Q4/2026. `rules.review.json`, schema **1.11.0**, conține **1.265 perechi: 1.087 EBM + 178 GOÄ**, cu **3.215 ancore**, toate draft/inactive. Completarea Claude din 27.10 este descrisă în secțiunea „Schema 1.11.0” de la final. Numărul ancorelor include reutilizarea aceleiași surse pentru perechi diferite. Clarificarea intervalului nu este evaluare de eligibilitate. Data de sfârșit a orizontului nu pretinde că GOÄ expiră la 31.12.2026.

| Cod | Parteneri | Interval al excluderii |
|---|---|---|
| 03100 | 03360, 03362 | Aceeași ședință |
| 03100 | 03370, 03371, 03372, 03373 | Aceeași ședință |
| 03100 | 01436, 38200, 38205 | Aceeași ședință |

01436 este partener de referință; nu se adaugă la cele 138 de ținte Hausarzt. O ședință distinctă elimină numai această excludere, fără să dovedească îndeplinirea celorlalte condiții.

Surse: textul EBM Q4/2026, pagina PDF 185, [explicația KBV](https://www.kbv.de/praxis/abrechnung/chronikerpauschale) pentru geriatrie/paliație și [explicația KVSA](https://www.kvsa.de/praxis/abrechnung/wichtige-infos/versorgungspauschale) care enumeră inclusiv 01436/38200/38205. Copiile locale și SHA-256 sunt în manifestele `../sources.manifest.json` și `../optional-hausarzt/sources.manifest.json`. Explicația KVSA privește intervalul normei EBM naționale, fără a selecta un contract regional pentru Praxisul din NRW.

## EBM: perechi Hausarzt cu servicii paliative

| Coduri Hausarzt | Parteneri de referință | Perechi exacte |
|---|---|---:|
| 03220, 03230, 03360, 03362 | fiecare cu 37300, 37302, 37305, 37306 | 16 |
| 03371, 03372, 03373 | fiecare cu 37305, 37306 | 6 |

Cele 22 de perechi au intervalul `session`. Dovezile păstrează excluderea din ambele sensuri în EBM Q4/2026, paginile 198–209 și 1017–1019, și [explicația oficială KVB INFOS 10/2017](https://www.kvb.de/fileadmin/kvb/Mitglieder/Service/Informationsservice/KVB-INFOS/2017-DS/KVB-INFOS-10-2017.pdf), paginile PDF 9–10 (tipărite 153–154). Copia PDF și hashul sunt în manifestul local. Paragraful pentru 37305/37306 continuă pe pagina următoare; ambele pagini sunt verificate textual și au fost inspectate vizual.

Sursa KVB este o explicație istorică, verificată față de perechile din norma națională actuală. Nu importăm punctaje, prețuri, condiții istorice sau reguli regionale bavareze. Nu deducem un interval general pentru orice formulare „neben”. `source_pack` și `source_record_ids` leagă fiecare pereche de dosarul inițial, al cărui interval brut rămâne păstrat.

03371/37302 rămâne excludere pe Behandlungsfall; 03370/37300 are interval Krankheitsfall în norma actuală, fără suprascriere pe ședință. 03230/35100, 03360/30984 și 03371/37400 au primit ulterior clarificarea pe ședință în lotul de îngrijire descris mai jos. 37300/37302/37305/37306 rămân referințe, fără extinderea selecției Hausarzt.

Lotul paliativ inițial a clarificat 22 de perechi, fără să închidă atunci integral listele. Completarea de îngrijire adaugă și ceilalți parteneri expliciți. Auditul curent are **12 înregistrări deschise / 75 de liste clarificate**; listele cu secțiuni întregi excluse rămân deschise.

## EBM: investigații și delegare NäPA

| Cod Hausarzt | Parteneri cu excludere pe ședință |
|---|---|
| 03241 | 13253, 27323 |
| 03321 | 13251, 17330, 17332 |
| 03322 | 13252, 27322 |
| 03324 | 13254, 27324 |
| 03330 | 13255, 27330 |
| 03062 | 03063, 37535, 37635 |
| 03063 | 03062, 37535, 37635 |
| 38100 / 38105 | fiecare cu 37535 și 37635 |
| 38200 / 38205 | fiecare cu 38202 și 38207; relațiile cu 03100 erau deja clarificate |

Sunt 24 de perechi distincte noi: 11 pentru investigații și 13 pentru delegare. Dublura 03062/03063 păstrează ambele clauze normative, fără dublarea perechii. Toate listele sunt confruntate exact cu PDF-ul EBM Q4/2026. [Glosarul oficial KV Bremen](https://www.kvhb.de/praxen/abrechnung-honorar/ebm-glossar) explică intervalul pe ședință atunci când excluderea nu numește alt interval. Nu este o regulă tarifară regională Bremen. Builderul folosește liste explicite; nu rescrie automat orice clauză ce conține „neben”.

Cele cinci liste de investigații și șase liste de delegare au acum intervalele tuturor perechilor explicite clarificate. Condițiile de eligibilitate nu sunt prin aceasta complete. 38202/38207 și ceilalți parteneri de specialitate nu devin ținte Hausarzt; cele 138 de poziții selectate rămân aceleași.

Perechile 03062/38100, 03063/38105 și 38100/38105 își păstrează excluderea pe întreaga zi. Asocierea unei vizite delegate cu vizita medicului rămâne condiționată; o pereche cu interval clarificat nu anulează condițiile `only_with`, justificarea sau autorizarea NäPA.

### Identificarea ședinței pentru Claude

[KVWL, explicația privind Uhrzeitangabe](https://www.kvwl.de/mitglieder/abrechnung-honorar/ebm/ebm-aenderungen-und-hinweise/hinweise-zu-bestehenden-regelungen), arată că pauzele de așteptare și intervențiile personalului din aceeași consultație nu creează automat ședințe noi. Descrie revenirea din inițiativa pacientului după încheierea consultației și plecarea din Praxis ca un contact distinct; executarea ulterioară a analizelor după recoltare nu constituie o nouă prezentare. Copia este inclusă cu hash în manifest.

Motorul trebuie să păstreze dovezile pentru contactul distinct; două ore de facturare sau două rânduri din Kartei nu sunt suficiente singure. Această explicație privește consultația în Praxis: nu inventăm o definiție identică pentru toate vizitele la domiciliu sau contactele telefonice. Contextul insuficient rămâne `not_verified`. Nici acest document, nici registrul nu grupează automat contactele pacientului.

## EBM: Hausbesuche și solicitări neprevăzute

Cele nouă liste pentru **01100, 01101, 01102, 01410, 01411, 01412, 01413, 01415 și 01418** au primit 131 de perechi distincte cu interval `session`. Sunt 166 de mențiuni normative de perechi înainte de eliminarea duplicatelor. Fiecare pereche păstrează clauzele sursă relevante; 297 de ancore suplimentare leagă listele EBM Q4/2026, paginile 41–42 și 55–57, de explicația oficială KVHB a intervalului. Listele exacte sunt în `rules.review.json`; intervalele numerice din normă sunt expandate și verificate față de selecția explicită din `ebm_visit_scopes.py`.

Nouă înregistrări din dosarul vizitelor și cele două liste duplicate 01410/01413 din dosarul combinațiilor ies din coada intervalelor. Aceasta nu înseamnă 11 servicii devenite eligibile: rămân de verificat prestația efectivă, solicitarea, ora, pacientul, medicul, contractul și celelalte condiții.

Păstrăm distinct:

- **01102/01413:** asociere condiționată de instituția descrisă de EBM, personal de îngrijire și solicitare specială; nu apare ca interdicție necondiționată și nu devine permisiune automată de sâmbătă.
- **01100/01101/01102 cu 01955/01956:** excluderi pe întreaga zi, păstrate separat de noile intervale pe ședință. 01418/01955 are propria clauză; nu moștenește intervalul zilei din altă pereche.
- **01410/01413:** revizia perechii privește același pacient. Vizita inițială la un pacient și Mitbesuch la altul nu sunt două servicii incompatibile în aceeași fișă. Legătura cu vizita inițială nu cere introducerea acelei cifre în fișa celui de-al doilea pacient.
- **HZV:** nu preia automat aceste excluderi EBM sau intervalele lor; contractul concret rămâne necunoscut.

## EBM: cronici, geriatrie, paliație și psihosomatică

Sunt adăugate **160 de perechi distincte** din listele 03220, 03230, 03360, 03362, 03370–03373, 35100, 35110 și 33012 (ecografie tiroidiană). Cele 393 de ancore suplimentare păstrează norma EBM Q4/2026 și interpretarea KVHB. Textul 35100 continuă de la pagina PDF 908 la 909; ambele fragmente sunt verificate împreună, inclusiv intervalele numerice de coduri.

Opt înregistrări își au acum toate intervalele perechilor explicite clarificate: 03220/03360/03362 în dosarul combinațiilor și 33012/03370/03371/03372/03373 în dosarul opțional. Cele trei liste 03230/35100/35110 rămân deschise deoarece conțin și excluderi pentru secțiunile 35.2.1/35.2.2, respectiv 35.2. Nu deducem apartenența unui cod din prefix. De exemplu, interogarea 35100/35401 returnează necesitatea verificării secțiunii, fără o pereche exactă inventată.

Perechile 35100/35110 și 03230 cu 35100/35110 sunt clarificate pe ședință. Cerința de timp suplimentar la asocierea unor servicii diagnostice/terapeutice nu înlătură aceste excluderi explicite. Autorizarea pentru Psychosomatische Grundversorgung, documentarea și durata rămân condiții independente; simpla prezență a unui diagnostic nu este suficientă pentru facturare.

Păstrăm neschimbate excluderile pe Behandlungsfall pentru 35100/35110 cu 08521, pe Krankheitsfall pentru 03370/37300 și pe Behandlungsfall pentru 03371/37302. Pentru 33012, relația cu 31695 rămâne pe zi, iar cea cu 26330 pe caz. Limita de până la trei prestații 35110 pe zi nu înseamnă că trei repetări sunt automat eligibile.

`source_record_ids` se referă la dosarul principal indicat de `source_pack`. Când aceeași pereche este enunțată reciproc în alt dosar, păstrăm și dovada sa normativă în `evidence`, fără a crea o a doua pereche sau a modifica traseul inițial al trimiterii. Nicio poziție de specialitate nu este promovată la țintă Hausarzt.

## EBM: răni și mică chirurgie

Lotul adaugă **426 de perechi distincte și 986 de ancore**, din listele 02300/02301/02302/02310/02311/02312/02313. Intervalele numerice și fragmentele normative sunt confruntate exact cu EBM Q4/2026, paginile PDF 158–163. Interpretarea intervalului pe ședință folosește glosarul KVHB. Cele patru liste 02310–02313 ies din coada intervalelor; listele 02300–02302 rămân deschise pentru excluderile pe secțiuni. Nu extindem selecția Hausarzt: 02350/02360 și partenerii de specialitate rămân referințe.

**Contract nou, schema 1.10.0:** fiecare pereche din `source_pack: wounds` are `exception_record_ids`, cu referințe exclusiv în `wounds/rules.review.json`. Trei perechi între 02300/02301/02302 trimit la `MINOR_MULTIPLE_EXCEPTION`; șase perechi ale acestora cu 05330/05331 trimit la `ANESTHESIA_DIFFERENT_ACTOR`. Celelalte 417 au lista goală. Schema respinge omiterea sau schimbarea excepțiilor celor nouă perechi. Nu trata `relation: excludes` drept interdicție necondiționată dacă există o excepție de evaluat.

Excepția intervențiilor multiple păstrează plafonul comun de cinci pe zi și cere diagnosticul și prestațiile relevante documentate; nu este un plafon separat pentru fiecare cod. Excepția anesteziei cere verificarea medicului operator, a anestezistului și a specialităților. Dovezile ambelor excepții sunt incluse în perechile relevante (paginile PDF 157 și 38). Prezența unui ICD sau a două conturi de utilizator nu confirmă aceste condiții.

`review-wound-combination.py` păstrează `exceptions_to_review` integral și separat; numai excluderea explicită a perechii primește `session`, cu `parameters.source_scope` și `scope_resolution_ids`. Excluderile pe zi, Behandlungsfall și cele 21 de zile postoperatorii rămân neschimbate. Registrul nu identifică automat pacientul, rana, medicul sau ședința. Patru înregistrări din dosarul rănilor rămân deschise: cele trei liste cu secțiuni și clauza condiționată a anesteziei.

## EBM: laborator, prevenție și pauschale

Sunt adăugate **41 de perechi distincte și 88 de ancore** din zece liste: 32025/32026/32027/32033/32150, 32880/32881/32882 și 03000/03030. Sunt 47 de mențiuni înaintea eliminării celor șase dubluri între laboratorul local și cel preventiv. Fiecare pereche duplicată păstrează ambele enunțuri normative, deși `source_pack` și `source_record_ids` identifică numai dosarul principal. Norma este verificată la paginile PDF 180, 183, 784, 785, 792 și 793; interpretarea temporală folosește glosarul KVHB. Toate cele zece liste ies din coada intervalelor, fără a deveni modele complete de eligibilitate.

Schema dosarului de prevenție trece la **1.1.0**, adăugând `parameters.relation: excludes` pentru cele trei liste explicite de laborator. Același câmp este explicitat pentru cele două liste din pauschale; schema acestui dosar permitea deja parametri descriptivi. Marcajele originale `unresolved_neben` se păstrează, iar intervalul verificat se citește din registrul comun. Nu sunt schimbate intervalele calendaristice de screening sau ferestrele pe caz/trimestre.

`review-billing-code.py` expune perechile prin `scope_clarifications` la ambele coduri; cele 41 de perechi au 82 de verificări direcționale prin acest utilitar. Căutarea combinațiilor preia și clarificările 01732/32025 și 01732/32033, păstrând separat excepția 01732/01745. Lipsa unei perechi, de exemplu 32880/32881, nu reprezintă aprobare de asociere.

Explicația KVWL citată mai sus rămâne esențială pentru laborator: prelucrarea ulterioară a probei nu dovedește o nouă prezentare. Nu separa artificial recoltarea și analiza ca două ședințe. Indicația, materialul, metoda, serviciile efectiv efectuate și istoricul trebuie evaluate separat. Pentru 03030, ora serii nu este suficientă: solicitarea neprevăzută și prestațiile asociate rămân obligatorii. 03000/03030 și relațiile cu 03100 își păstrează excluderile pe caz, respectiv condițiile trimestrului următor.

## GOÄ: consultații, examinări și vizite

| Clauza normativă | Parteneri excluși în același contact medic–pacient |
|---|---|
| 4 | 30, 34, 801, 806, 807, 816, 817, 835 |
| 5 | 6, 7, 8 |
| 6 | 5, 7, 8 |
| 7 | 5, 6, 8 |
| 8 | 5, 6, 7, 800 |
| 29 | 1, 3, 5, 6, 7, 8 |
| 34 | 1, 3, 4, 15, 30 |
| 50 | 1, 5, 48, 52 |
| 51 | 1, 5, 48, 52 |

Cele nouă liste reprezintă **33 de perechi distincte**, după eliminarea duplicatelor simetrice. Fiecare păstrează clauzele normative care au generat-o în `source_record_ids`. Partenerii din alte specialități rămân referințe; lista Hausarzt are în continuare 138 de poziții.

Listele sunt verificate în [Anlage GOÄ](https://www.gesetze-im-internet.de/go__1982/anlage.html). Intervalul este o interpretare bazată pe [explicația Bundesärztekammer din 03.06.2011](https://www.bundesaerztekammer.de/themen/aerzte/honorar/goae/goae-ratgeber/abschnitt-b-grundleistungen-und-allgemeine-leistungen/neben-gebuehrenrechtlich), salvată cu hash în `sources.manifest.json`. Explicația este distinctă de norma legală și nu constituie o modificare a acesteia. În același contact, schimbarea bolii discutate nu anulează excluderea.

Acest lot nu interpretează automat Nr. 3 cu alte servicii, componentele examinării sau perfuziile. Limitele pe zi, pe Behandlungsfall și condițiile repetării rămân separate. Auditul din `docs/BILLING_OPEN_SCOPES.md` separă acum **12 înregistrări deschise** de **75 de liste cu interval clarificat**, din 87 de înregistrări inițiale. Listele clarificate nu sunt reguli aprobate de facturare.

## GOÄ: suplimente pentru consultații și vizite

| Perechi suplimentare | Număr distinct | Interval |
|---|---:|---|
| Fiecare dintre A/B/C/D/K1 cu fiecare dintre E/F/G/H/K2 | 25 | Aceeași Inanspruchnahme, pentru același pacient |
| A cu B/C/D și B cu C | 4 | Același contact/ședință |
| E cu F/G/H și F cu G | 4 | Același contact/ședință |

Cele **33 de perechi noi** folosesc norma GOÄ și explicațiile BÄK. [Zuschläge kombinieren, 28.07.2006](https://www.bundesaerztekammer.de/themen/aerzte/honorar/goae/goae-ratgeber/abschnitt-b-grundleistungen-und-allgemeine-leistungen/zuschlaege-kombinieren) delimitează grupele pentru același pacient și aceeași Inanspruchnahme. Copia este păstrată în manifest, fără a importa sumele din exemplele istorice în calculatorul de tarife.

Registrul are în total 430 perechi cu `session` și 25 cu `inanspruchnahme`. `source_pack` identifică dosarul din care provin `source_record_ids`; acestea nu sunt întotdeauna în dosarul de combinații. Utilitarul GOÄ aplică intervalul numai relațiilor `exclusion`, păstrând intervalul brut în `combination.source_scope` și legătura în `scope_resolution_ids`.

H+F/H+G rămân combinații condiționate de zi/oră și de celelalte cerințe. E+45/46 păstrează excepția Belegarzt. Reducerea E–H lângă 51 este o regulă de factor, nu o interdicție, și nu se extinde la K2. Referințele I/J din grupa normativă nu devin tarife sau ținte inventate; lista care le conține rămâne parțial deschisă.

## Investigații tehnice, completare 27.10

Șapte perechi suplimentare sunt clarificate pe ședință: 605 cu 610/612 și 410 cu 412/413/415/417/418. Se păstrează norma GOÄ și interpretarea BÄK în fiecare pereche. 605a nu este adăugat automat la excluderile lui 605; 420 rămâne supliment cu condiții proprii, iar 417 rămâne cod specific de referință, fără înlocuire automată cu 410.

ECG-urile 650–653 nu primesc o astfel de suprascriere generală. Dosarul opțional are acum trei clauze din explicația BÄK din 28.04.2017: controale distincte necesare medical, investigație ulterioară indicată de rezultatul inițial și documentarea recomandată pe factură. Textul normativ de excludere rămâne vizibil împreună cu aceste condiții. Vezi `../optional-hausarzt/README.md`.

## Excluderi generale ale examinării 5–8

Cele patru examinări 5/6/7/8 au fiecare nouă parteneri normativi excluși: 600, 601, 1203, 1204, 1228, 1240, 1400, 1401 și 1414. Sunt **36 de perechi exacte**, cu norma GOÄ B Allgemeine Bestimmungen 8 și interpretarea BÄK a intervalului aceluiași contact. Partenerii rămân referințe; nu extind selecția Hausarzt.

Nu se deduce o excludere generală a tuturor investigațiilor tehnice: 651/652, 605 și 410 nu sunt adăugate acestei liste. Regulile privind componentele incluse și prestațiile independente se verifică separat. Perechile noi închid intervalul unei singure liste din audit.

## Contractul de integrare pentru Claude

Registrul comun rezolvă **numai perechea exactă și sistemul indicat**, simetric, în orizontul de revizie Q4/2026. Nu se deduce apartenența la secțiuni după prefix și nu se extinde regula la toate aparițiile termenului „neben”. Listele originale rămân în dosarele lor, inclusiv intervalele încă nerezolvate ale altor parteneri.

`billing_scope_resolutions.py` verifică hashul din manifestul livrării. Șase interogări offline expun `scope_clarifications`: combinații, cod individual, vizite, modul opțional, perechi GOÄ și răni. În căutarea combinațiilor, intervalul efectiv este în `pair_scope_details`; `scope` al listei originale rămâne fidel sursei. Interogările vizitelor și modulului opțional păstrează intervalul original separat atunci când aplică clarificarea. Utilitarul GOÄ poate returna clarificarea din registrul comun chiar dacă `pair_rules` nu conține o regulă în propriul dosar. Absența unei potriviri nu înseamnă compatibilitate.

**Blocaj de integrare:** drafturile vechi 03360/03362 au o fereastră `visit`, pe care motorul actual o interpretează calendaristic. Nu activa aceste drafturi înainte de a introduce identificarea ședinței și de a integra clarificarea exactă. Afișarea dosarului în UI nu remediază motorul. Dacă ședința este necunoscută, rezultatul trebuie să rămână „nu se poate verifica”; nu presupune o singură ședință pentru toate serviciile zilei.

Probe necesare în aplicație (încă neexecutate):

1. 03100 + fiecare partener, același pacient și aceeași ședință: detectează excluderea în ambele ordini.
2. Aceeași zi, ședințe distincte documentate: nu raporta această excludere pe zi; verifică restul condițiilor separat.
3. Ședință necunoscută: nu aproba și nu transforma automat intervalul în zi sau trimestru.
4. 03100 + 03360 + 03370: aplică fiecare dintre cele trei clarificări pe baza dovezii proprii. 03360/03370 are acum o dovadă separată; nu rezultă prin tranzitivitate din perechile cu 03100.
5. 38200 + 38202: aplică excluderea pe ședință și păstrează filtrul Hausarzt; 38202 nu devine țintă.
6. HZV, alt pacient, altă perioadă: nu aplica automat dosarul; nu transfera perechile EBM în GOÄ sau invers.
7. GOÄ 34 + 1 în același contact, boli diferite: păstrează excluderea.
8. GOÄ 5 + 6 în contacte distincte documentate în aceeași zi: nu aplica automat excluderea pe întreaga zi; verifică separat necesitatea repetării și orele pe factură.
9. GOÄ 34 + 1 + 817: clarifică numai 34/1; intervalul 34/817 rămâne nerezolvat în acest lot.
10. GOÄ 2 + 34: păstrează regula proprie per Inanspruchnahme. GOÄ 3 + 250: păstrează lista restrictivă și verificarea ei separată.
11. GOÄ 4 + 801: prezintă relația, fără să adaugi 801 la țintele Hausarzt.
12. A+E sau K1+K2 la același pacient în aceeași Inanspruchnahme: detectează excluderea. Aceleași suplimente la doi pacienți diferiți dintr-o familie nu formează automat o pereche exclusă între fișe.
13. H+F la o prestație duminică la 20:30: afișează condițiile combinației, fără aprobare din simpla oră. H+F miercuri la prânz nu devine permis prin existența clauzei.
14. H+G la 23:00 într-o zi eligibilă H: păstrează condițiile; F+G în același contact păstrează excluderea.
15. E+45/46: cere verificarea rolului Belegarzt și a celorlalte condiții; nu anula automat excluderea pentru orice medic și nu ignora excepția.
16. E/F/G/H legate de 51: verifică factorul 0,5; K2 nu primește automat această reducere. I/J rămân referințe fără tarif inventat.

17. 605+610/612 în aceeași ședință: aplică excluderea exactă; 605a nu moștenește automat această relație.
18. 410+417: verifică excluderea și codul specific organului; 410+420 păstrează relația bază/supliment.
19. 651+652: diferențiază ECG-ul de repaus inclus în ergometrie de investigația ulterioară indicată de anomaliile primului ECG. Două ore diferite nu sunt singure dovada independenței.
20. 650+651: revizie a controalelor distincte medical necesare; nu dubla aceeași examinare numai fiindcă una este mai cuprinzătoare. Nu extinde această interpretare la 653.

21. 5/6/7/8 cu fiecare dintre cei nouă parteneri normativi: aplică excluderea în același contact, fără extindere automată pe zi sau la alți pacienți.
22. 5/6/7/8 cu 651/652, 605 sau 410: nu inventa o excludere din clauza componentelor; verifică celelalte condiții separat.

23. Cele 22 de perechi EBM paliative, în ambele ordini: verifică aceeași ședință; pentru ședințe distincte documentate nu transforma relația într-o excludere pe zi. Dacă lipsește identificarea ședinței, păstrează „nu se poate verifica”.
24. 03371/37302: păstrează excluderea pe Behandlungsfall, inclusiv în ședințe distincte. Nu o confunda cu 03371/37305 sau 03371/37306.
25. 03230 + 37305 + 35100: aplică intervalul pe ședință pentru 03230/37305 și 03230/35100 din dovezile fiecărei perechi. Nu inventa relația 37305/35100. Codurile 37xxx nu devin automat sugestii de servicii lipsă, iar HZV nu moștenește perechile EBM.

26. Cele 24 de perechi pentru investigații/delegare: verifică ambele ordini și identificarea ședinței. 03330/13254 nu moștenește interdicția 03330/13255.
27. 03062/38100 sau 38100/38105 în ședințe diferite ale aceleiași zile: păstrează excluderea pe zi; nu folosi intervalul 03062/03063 pentru toate serviciile delegate.
28. 03062/01410: prezintă separat condițiile vizitei medicului și vizitei delegate; nu transforma relația condiționată în permisiune sau interdicție simplă.
29. Consultație întreruptă pentru așteptare, îngrijire de către personal sau analiza ulterioară a probei: nu crea automat o ședință nouă. Revenirea distinctă documentată se verifică separat; dacă dovezile lipsesc, nu decide pe baza orei singure.

30. Cele 131 de perechi Hausbesuch/solicitări neprevăzute: detectează excluderea în ambele ordini numai cu pacientul, actorul și ședința relevante. O oră târzie nu dovedește singură o solicitare neprevăzută.
31. 01102 + 01413 + 01410: 01102/01413 păstrează condițiile instituționale, în timp ce perechile cu 01410 își păstrează excluderile pe ședință. Nu transfera excepția la întregul grup.
32. 01101/01955 dimineața/seara în aceeași zi: păstrează excluderea pe zi. 01418/01955 nu moștenește această perioadă; verifică separat relația sa pe ședință și restul cerințelor.
33. 01410 la pacientul A, 01413 la pacientul B: nu genera excludere între fișe și nu cere 01410 în fișa B. Dacă legătura cu vizita inițială nu poate fi stabilită fără expunerea identității altui pacient, afișează necesitatea verificării manuale.

34. 35100/35110 sau 03230/35110 în aceeași ședință: timpul suplimentar documentat nu anulează excluderea explicită. Verifică separat calificarea, conținutul, documentarea și durata fiecărui serviciu.
35. 35100/35401 ori 03230/35401: afișează verificarea apartenenței la secțiune; nu declara perechea permisă sau interzisă doar din prefix. Existența unei alte perechi exacte în aceeași listă nu rezolvă secțiunea.
36. 35110/08521 în ședințe distincte ale aceluiași caz: păstrează excluderea pe caz. Nu transforma limita zilnică de trei pentru 35110 într-o aprobare automată; păstrează separat 33012/31695 pe zi și 03370/37300 pe Krankheitsfall.

37. 02300/02301 cu prestații multiple și diagnostic relevant: evaluează excepția înainte de concluzie; plafonul este cinci în total pe zi, inclusiv când prestațiile sunt în ședințe diferite.
38. 02300/02311 sau 02300/05320: nu transfera excepțiile intervențiilor multiple ori ale anesteziei către aceste perechi.
39. 02301/05331: distinge același medic de medici din specialități diferite; dacă actorul sau specialitatea lipsesc, păstrează necesitatea reviziei. Două conturi nu sunt dovada a doi medici eligibili.
40. 02310/02313 în aceeași ședință versus ședințe distincte: aplică numai intervalul perechii și verifică separat celelalte condiții. 02310/02311 rămâne excludere pe Behandlungsfall.
41. 02300/09329 în ședințe distincte ale aceleiași zile și 02300/31600 în perioada postoperatorie: nu scurta intervalul explicit la ședință.
42. O pereche exactă 02300/02311 plus un cod cu apartenență neconfirmată la secțiunile excluse: afișează separat perechea, secțiunea și excepțiile relevante. Nu activa 02350/02360 ca ținte Hausarzt și nu transfera regulile în HZV.

43. 32025/32880 sau 32033/32882 din aceeași prezentare: analiza efectuată după plecarea pacientului nu creează o ședință distinctă. Dacă datele despre recoltare/contact lipsesc, păstrează necesitatea verificării.
44. 01732/32025 versus 01732/01745: prima pereche are interval clarificat; a doua păstrează excepția sa pentru structura/actorul relevant. Nu transfera această excepție la laborator.
45. 32026/32113 și 32027/32117: verifică perechea exactă; nu inventa excluderea 32025/32026. A doua recoltare sau o altă oră nu dovedește automat o a doua prestație eligibilă.
46. 03000/01436 sau 03030/01436 în aceeași ședință: verifică excluderea. 03000/03030 în ședințe distincte ale aceluiași caz păstrează excluderea pe caz.
47. 03030 la o oră de seară, fără dovada solicitării neprevăzute și a prestației asociate: nu propune automat cifra. Păstrează verificarea trimestrului după 03100 și separarea HZV.

## Reproducere

```powershell
python -X utf8 scripts/build-billing-scope-resolutions.py
python -X utf8 scripts/build-billing-release.py
python -X utf8 scripts/build-hausarzt-scope.py
python -X utf8 scripts/build-billing-open-scopes.py
python -X utf8 scripts/verify-billing-scope-resolutions.py
python -X utf8 scripts/verify-billing-release.py
```

Verificatorul controlează schema draft, cele 3.215 ancore din originalele cu hash verificat, ambele sensuri ale celor 1.265 de perechi, izolarea perechilor/sistemelor, cele șase interogări și refuzul fișierului modificat. Lotul laborator/pauschale include 82 de interogări direcționale, verificarea tuturor dovezilor reciproce, păstrarea excepției de screening cutanat și a condițiilor pe caz/trimestru. Lotul rănilor include 852 de interogări în ambele sensuri, izolarea celor nouă excepții, verificări negative de schemă și verificarea suprapunerilor cu excluderile explicite pe zi/caz/postoperator din dosare. Lotul îngrijire/psihosomatică include 320 de interogări în ambele sensuri și păstrează secțiunile nerezolvate, frecvențele și intervalele pe caz. Lotul Hausbesuche include 262 de interogări în ambele sensuri și păstrează condițiile 01102/01413, limitele pe zi și legătura vizitei la alt pacient. Lotul investigații/delegare include 48 de interogări în ambele sensuri și păstrarea limitelor pe zi/asocierilor condiționate. Lotul paliativ include 44 de interogări în ambele sensuri, verificarea limitării exacte a grupelor în schemă și păstrarea excluderii 03371/37302 pe caz. Sunt verificate și limitele pe zi, regula Nr. 2, condițiile H+F/H+G, excepția E+45/46 și factorul legat de 51. Interogările nu evaluează automat orele, pacientul sau dreptul de facturare; cele 47 de scenarii de mai sus rămân probe de integrare pentru Claude. Nu este validare clinică sau acceptanță DURIA.

## Schema 1.11.0 — completare Claude, 27.10.2026

Auditul Claude (`docs/AUDIT_CODEX_20261027.md`) a găsit generatorul deja trecut la 1.11.0, cu 19 perechi noi, dar datele, schema și verificatorul rămăseseră la 1.10.0. Iterația a fost terminată și extinsă:

- **01732** cu 27310, 32057, 32060–32063 și 37800 (7 perechi EBM), cu enunțul reciproc adăugat la 01732/32025 și 01732/32033. Interval: aceeași ședință, glosarul KVHB. Excepția BAG 01732/01745 pe caz rămâne separată.
- **F, G, H** cu 45, 46, 48 și 52 (12 perechi GOÄ), interpretarea BÄK. Excepția Belegarzt pentru E lângă 45/46 nu se transferă.
- **Psihoterapie GOÄ** (Abschnitt B, Allg. Best. 4): 1, 3 și 34 cu 804, 806–808, 812, 817, 835, 849, 861–864, 870, 871, 886, 887 (48 de perechi). Pozițiile 805, 809, 810 și 811 din intervalul normei nu există în tabelul GOÄ: rămân trimiteri nerezolvate, fără pereche și fără tarif. 22 și 30 nu sunt ținte Hausarzt și nu sunt împerecheate.
- **Perfuzii 271–276**: 271 și 272 cu ceilalți membri ai grupei (9 perechi), aceeași ședință. Plafonul normativ zilnic 271 + 272 (cel mult două, `normative_total_per_day` în dosarul GOÄ 1.2.0), accesul vascular și separarea în timp rămân verificări distincte. Pentru 274 se păstrează și anotarea proprie a poziției.

Coada `docs/BILLING_OPEN_SCOPES.md` nu mai cere perechi pentru trimiterile din `unresolved_code_references` ale registrului. Astfel se închid și suplimentele A–D/K1 lângă E–J/K2 (I și J nu există în tabel). Rezultat intermediar: 18 înregistrări deschise, 69 de liste clarificate.

### Secțiuni EBM, completare Claude

`section_membership` din `rules.review.json` fixează membrii a 8 secțiuni, derivați din PDF de `scripts/ebm_section_membership.py`: titlurile de secțiune sunt rânduri bold la marginea stângă, iar titlurile GOP sunt rânduri regulate de cinci cifre la x = 77 pt. Derivarea trebuie să găsească exact cele 3.179 GOP ale indexului, fiecare pe pagina indexată; verificatorul o repetă la fiecare rulare și compară lista fixată.

| Secțiune | GOP | Folosită pentru |
|---|---:|---|
| 18.3 | 7 (18310–18340, 18700) | 02300 |
| 30.5 | 2 (30500, 30501) | 02300, 02301, 02302 |
| 31.5.3 | 11 (31820–31828, 31840, 31841) | 02300 |
| 34.5 | 5 (34500, 34501, 34503–34505) | 02300 |
| 36.5.3 | 12 (36820–36829, 36840, 36841) | 02300 |
| 35.2.1 / 35.2.2 | 12 / 56 | 03230 |
| 35.2 | 79 (inclusiv 35.2.3) | 35100, 35110 |

Secțiunile sunt citate în aceeași frază „nicht neben” fără interval ca listele deja clarificate, deci se aplică glosarul KVHB (ședință). Legendele membrilor au fost căutate pe toate paginile secțiunilor: enunțurile reciproce sunt tot „nicht neben” simplu, fără zi sau caz. Fiecare pereche are câmpul `via_section`, ancora normei, ancora titlului de secțiune și glosarul. Perechile din dosarul rănilor au `exception_record_ids: []`; excepția anesteziei privește numai 05330/05331.

Generatorul cozii închide o listă cu secțiuni numai când toate secțiunile au membri fixați și toate perechile membrilor sunt clarificate. Rezultat final: **12 înregistrări deschise, 75 de liste clarificate**. Probe: 02300 + 30500 în aceeași ședință → excludere; 02301 + 31820 → nicio clarificare (31.5.3 nu este citată la 02301); 03230 + 35571 → nicio clarificare (35.2.3 nu este citată la 03230); 35100 + 35571 → excludere.

Probe noi pentru aplicație: 34 + 849 în aceeași ședință → excludere; 34 dimineața și 849 la alt contact → nicio excludere din această pereche, celelalte condiții rămân; 1 + 805 → cod necunoscut, nu verificat; 271 + 272 în aceeași ședință → excludere; 271 și 272 la contacte diferite → permis de această pereche, dar a treia perfuzie 271/272 din zi încalcă plafonul normativ; F + 48 → excludere în același contact; E + 45 la Belegarzt → rămâne excepție condiționată.
