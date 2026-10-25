# Specificație pentru Claude și integrarea DURIA2

Acest proiect pregătește baza de cunoștințe și contractele de date pentru un asistent intern de Hausarztpraxis. Prima versiune urmărește căutarea în ICD-10-GM și verificări explicabile de Abrechnung. Claude implementează aplicația și adaptorul DURIA; acest pachet definește ce trebuie implementat și verificat.

Data specificației: 25 octombrie 2026. În acest moment nu există în acest pachet o integrare DURIA activă, o validare clinică sau un motor de facturare autorizat pentru utilizare reală. Pentru conținutul efectiv importat și verificările executate se consultă README-ul și rapoartele de import din proiect.

## Configurația stabilită cu utilizatorul

| Parametru | Cerință |
| --- | --- |
| Tip cabinet | Hausarztpraxis în Nordrhein-Westfalen |
| Software existent | DURIA2; interfața și versiunea exactă instalată trebuie confirmate |
| KV | Necunoscută inițial; `null`, cu opțiuni Nordrhein și Westfalen-Lippe |
| Sisteme | GKV/EBM și Privat/GOÄ, separate în configurare și rezultate |
| HZV | Modul opțional, dezactivat implicit, activabil din setări |
| Contract HZV | Necesită identificare, versiune, perioadă și confirmarea participării relevante |
| Prioritate | Căutare ICD și verificări Abrechnung |
| Limba interfeței | Germană; documentația de proiect poate fi în română |

Activarea modulului HZV nu confirmă participarea cabinetului, înscrierea pacientului sau aplicabilitatea unui contract. Lipsa KV blochează concluziile dependente de regiune, nu căutarea în catalogul ICD sau funcțiile care nu depind de regiune. Lipsa contextului HZV nu permite trecerea tacită la EBM.

## Limitele primei versiuni

MVP-ul include căutarea unui cod pentru un diagnostic deja documentat, afișarea informațiilor din catalog și examinarea documentației pentru posibile omisiuni sau conflicte de facturare. Rezultatele sunt propuneri verificabile de către persoana competentă.

MVP-ul nu include stabilirea unui diagnostic din simptome, ordonarea diagnosticului diferențial, recomandări terapeutice, înregistrarea consultației, generarea documentelor oficiale, semnarea sau transmiterea facturilor. Acestea sunt module ulterioare, cu cerințe și validare proprii. Macheta din `design/` este un concept de navigare, nu dovada implementării modulelor afișate.

Nu se introduc date reale de pacienți în repository, fixture-uri, exemple, capturi, loguri de dezvoltare sau prompturi pentru instrumentele de programare. Dezvoltarea și testele acestui pachet folosesc date sintetice.

## Ce conține baza și ce nu trebuie presupus

Catalogul ICD trebuie derivat dintr-o ediție oficială identificată, cu denumirile oficiale păstrate și cu trasabilitate la fișierul-sursă. Nu se presupune că toate fișierele posibile ale ediției sunt importate: disponibilitatea sistematicii, sinonimelor alfabetice, incluziunilor, excluderilor și instrucțiunilor trebuie declarată separat în manifest.

Structura de billing și exemplele de reguli din acest pachet reprezintă un contract de implementare. Exemplele sunt inactive și nu reprezintă un catalog EBM/GOÄ/HZV complet. Un exemplu sintetic nu poate fi promovat într-o regulă reală prin simpla schimbare a unui flag.

Fiecare ediție de date are sursă, versiune, dată de achiziție, perioadă de aplicabilitate când este stabilită, amprentă a fișierului și situația drepturilor de utilizare. Data descărcării nu ține locul datei de intrare în vigoare. O ediție publicată pentru anul următor nu se activează înainte de perioada aplicabilă.

## Fluxul ICD

1. Primește textul diagnosticului documentat sau un cod introdus de utilizator.
2. Caută în ediția solicitată și afișează denumirea oficială, structura și instrucțiunile efectiv disponibile.
3. Arată separat sinonimele/editorialele de textul oficial și indică proveniența lor.
4. Distinge un cod terminal de o categorie incompletă; nu afișează o categorie ca și cum ar fi un cod complet validat pentru cazul concret.
5. Permite verificarea preciziei, lateralității unde este relevantă și a marcajului G/V/A/Z fără alegerea automată a lui G.
6. Returnează codul, versiunea și referința; nu afirmă că existența codului confirmă diagnosticul.

Căutarea trebuie să suporte diacritice germane, diferențe de majuscule și termeni incompleți. Fără rezultate, răspunsul este explicit; nu se generează un cod nou. Expansiunea prin sinonime trebuie să rămână separată de o recomandare clinică.

## Fluxul Abrechnung

1. Utilizatorul selectează perioada: zi, interval, trimestru sau întreaga fișă.
2. Adaptorul oferă evenimentele documentate și prestațiile deja înregistrate, împreună cu datele și proveniența lor.
3. Extragerea păstrează diferența dintre efectuat, planificat, recomandat, refuzat, negat, efectuat extern și istoric/copiat. Absența menționării unui fapt nu devine automat negarea lui.
4. Sistemul selectează ediția regulii aplicabilă datei prestației și contextului de asigurare/contract.
5. Verifică întreg intervalul cerut de regulă. O verificare inițiată pentru azi poate necesita date din întreg trimestrul; lipsa acestora trebuie raportată.
6. Evaluează fiecare condiție cu trei stări: îndeplinită, neîndeplinită, necunoscută.
7. Afișează constatarea, pasajele justificative, condițiile lipsă și sursa regulii.
8. O persoană autorizată verifică rezultatul. MVP-ul nu scrie și nu transmite automat coduri.

Clasificări de rezultat: posibil cod omis, documentație incompletă, diagnostic documentat cu codificare posibil absentă, conflict/dublare și imposibil de verificat. Nu se afișează o concluzie pozitivă de facturabilitate când o condiție obligatorie este necunoscută. O condiție obligatorie demonstrat neîndeplinită exclude acel candidat chiar dacă alte condiții sunt necunoscute.

Programul nu completează retrospectiv minute, manevre, gravitate sau diagnostice pentru a justifica un cod. O completare legitimă a notei rămâne o acțiune a utilizatorului cu data și autorul ei, fără retrodatare și fără rescrierea silențioasă a sursei.

## Contractul de integrare DURIA

Capabilitățile necesare trebuie confirmate cu furnizorul pentru instalarea concretă: pacient activ, evenimente datate, diagnostice, prestații introduse, context de asigurare/contract și eventual transfer controlat. Documentarea generică a unei interfețe GDT/BDT/HL7 nu dovedește disponibilitatea tuturor acestor câmpuri.

Adaptorul local primește identitatea/contextul activ de la DURIA, nu de la o inferență AI. La începutul operației fixează un token de context local, sesiunea/stația, momentul și revizia datelor citite. Tokenul nu trebuie transmis modelului extern și nu este o dovadă de anonimizare a datelor medicale.

La schimbarea pacientului, închiderea fișei, pierderea conexiunii sau expirarea contextului, rezultatele anterioare devin neeligibile pentru transfer. Înaintea unei scrieri viitoare, adaptorul verifică din nou contextul și revizia. Comparația trebuie legată de sesiunea utilizatorului; doi medici care lucrează simultan nu pot împărți un singur „pacient activ” global.

Citirile incomplete și fișierele neinterpretate se marchează ca atare. Nu se prezintă „întreaga Karteikarte verificată” dacă lipsesc atașamente, intervale sau categorii de date. Pentru transferul viitor se cer identificatori idempotenți, verificarea duplicatelor, confirmarea câmpurilor și raportarea rezultatului real.

## Reguli și trasabilitate

Orice regulă activabilă are cel puțin un identificator stabil, sistem, versiune, sursă exactă, domeniu temporal, condiții, excluderi, interval de verificare, date obligatorii, responsabil de revizie și stare de aprobare. Conținutul unei reguli oficiale nu poate fi înlocuit de o preferință internă.

Un rezultat păstrează edițiile catalogului și regulilor, versiunea logicii/modelului când este folosit, datele surselor și referințele către dovezi. În dezvoltare se păstrează numai dovezi sintetice. În produs, politica de audit și retenție trebuie aprobată înaintea datelor reale; logurile operaționale nu trebuie să conțină implicit textul clinic.

Textul din fișă sau din documente este intrare neîncredere pentru logică: nu poate activa instrumente, schimba regulile, ignora contextul pacientului ori autoriza transferuri. Actualizările se importă în staging, se compară, se verifică și se activează explicit; este necesară posibilitatea revenirii la o ediție anterioară.

## Ordinea de implementare

| Pas | Rezultat verificabil |
| --- | --- |
| 1 | Import de catalog oficial, manifest de proveniență, căutare locală fără date de pacient |
| 2 | Modele de configurare și reguli, cu exemple sintetice inactive |
| 3 | Evaluator cu trei stări și afișarea dovezilor, testat pe fixture-uri sintetice |
| 4 | Reguli reale limitate la prestațiile prioritare, cu drepturi și revizie de specialitate documentate |
| 5 | Adaptor DURIA numai pentru citire, într-un mediu de test autorizat |
| 6 | Pilot controlat după încheierea evaluărilor necesare și a criteriilor de acceptare |

## Condiții înainte de date reale și utilizare clinică

Trebuie stabilite scopul fiecărui modul, responsabilul pentru produs, încadrarea reglementară, temeiul și limitele prelucrării, rolurile furnizorilor, accesul, retenția și necesitatea unei Datenschutz-Folgenabschätzung. „Utilizare doar în cabinet” nu este o scutire generală, iar confirmarea de către medic nu înlocuiește evaluarea produsului.

Pentru funcțiile clinice ulterioare se cere validare medicală și evaluarea aplicabilității MDR/AI Act. Pentru facturare se cer surse/licențe, revizie de Abrechnung și contractele concrete. Nici măcar un test tehnic complet trecut nu dovedește singur corectitudinea clinică sau juridică.

## Surse de referință

- [BfArM ICD-10-GM 2026](https://terminologien.bfarm.de/CodeSystem-icd10gm-2026.html)
- [KBV Kodieren](https://www.kbv.de/praxis/abrechnung/kodieren)
- [KBV EBM și arhivă](https://www.kbv.de/praxis/abrechnung/ebm)
- [GOÄ în legislația federală](https://www.gesetze-im-internet.de/go__1982/)
- [Bundesärztekammer GOÄ-Novellierung](https://www.bundesaerztekammer.de/themen/aerzte/honorar/goae-novellierung)
- [HZV contracte și facturare](https://hzv.de/hzv-in-der-praxis/)
- [DURIA conectări externe](https://www.duria.de/cms/fragen_und_antworten/wiki/details/geraeteanbindungen-online-terminkalender)
- [KBV Datenschutz](https://www.kbv.de/praxis/praxisfuehrung/datenschutz)
- [MDCG software medical](https://health.ec.europa.eu/document/download/b45335c5-1679-4c71-a91c-fc7a4d37f12b_en?filename=md_mdcg_2019_11_guidance_qualification_classification_software_en.pdf)
- [MDCG excepția in-house](https://health.ec.europa.eu/system/files/2023-01/mdcg_2023-1_en.pdf)

Aceste linkuri sunt repere pentru verificare, nu substituie fișierele de catalog și textele de reguli exacte, versionate și admise pentru utilizarea din produs.
