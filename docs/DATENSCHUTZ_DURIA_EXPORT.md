# Evaluare Datenschutz: citirea exporturilor DURIA

Stadiu: analiză de proiect și revizie statică, **25.10.2026**. Nu reprezintă certificare sau aprobare juridică pentru producție. Sunt evaluate codul disponibil și fluxurile GDT/BDT/KVDT; nu au fost deschise exporturi reale de pacient și nu au fost inspectate serverul Praxisului, ACL-urile instalate, traficul de rețea sau backupurile. Fișierele și hashurile codului revizuit sunt în `data/legal/code-review.manifest.json`.

**Concluzie: prototipul nu îndeplinește încă obiectivul „identitățile nu ajung în fereastră” și nu poate fi descris global ca „fără date pe disc”.** Sunt necesare în special corectarea filtrării înainte de IPC, izolarea drepturilor Windows și clarificarea consumului fișierelor din inbox. Această revizie nu a schimbat codul lui Claude sau setările serverului.

## Ce înseamnă legal citirea locală

Citirea și analiza sunt prelucrări de date, chiar dacă se fac numai în RAM. Înlocuirea numărului pacientului cu un token nu anonimizează informația medicală legată de acesta. Faptul că produsul este folosit numai în Praxis nu creează o excepție generală. Trebuie stabilite scopul, necesitatea, temeiul din art. 6 și excepția pentru date de sănătate din art. 9; pentru îngrijire pot fi relevante art. 9(2)(h), 9(3), §22 BDSG și obligația de confidențialitate. Nu rezultă că este obligatoriu sau suficient un consimțământ generic pentru orice funcție. [GDPR](https://eur-lex.europa.eu/eli/reg/2016/679/ojv), [§22 BDSG](https://www.gesetze-im-internet.de/bdsg_2018/__22.html), [§203 StGB](https://www.gesetze-im-internet.de/stgb/__203.html).

Praxisul trebuie să includă fluxul în registrul prelucrărilor, să actualizeze informarea pacienților și măsurile tehnice și organizatorice, să controleze accesul și să evalueze necesitatea unei Datenschutz-Folgenabschätzung. Furnizorii care pot accesa datele necesită analiza rolului contractual, a art. 28 și a obligațiilor de confidențialitate. Nu orice service IT este automat împuternicit; contează activitatea și accesul efectiv. Aceste obligații și exemplele pentru cabinete sunt explicate în [ghidul KBV](https://www.kbv.de/praxis/praxisfuehrung/datenschutz).

Temeiul exact, necesitatea întregului KVDT și riscul funcțiilor AI trebuie stabilite de Praxis împreună cu responsabilul Datenschutz/juristul. Evaluarea art. 35 se documentează înaintea utilizării reale. Rolurile posibile de dispozitiv medical pentru diagnosticul diferențial reprezintă o evaluare separată; acest raport despre export nu o rezolvă.

## Fluxul propus și datele strict necesare

`DURIA → export dedicat/protejat → parser Rust → validare + minimizare → obiecte tipizate prin IPC → motor local/UI → ștergerea contextului de lucru`.

Importul de coduri ICD publice nu are nevoie de date de pacient. Pentru verificarea facturării este preferabil un export limitat la pacientul și perioada selectate. Verificarea întregului trimestru KVDT trebuie să fie o operație separată, autorizată și justificată, cu o limită clară a populației și scopului.

| Date | Necesitate și tratament recomandat |
|---|---|
| Nume, adresă, telefon, e-mail, număr de asigurat | Nu sunt necesare motorului de reguli. Refuzate/eliminate în Rust înainte de IPC, inclusiv din câmpuri neprevăzute, fișiere și mesaje de eroare |
| Identificator DURIA | Necesar numai în granița de integrare pentru asociere. În UI, token opac limitat la context; maparea reversibilă numai în RAM, cu invalidare la schimbarea pacientului/logout |
| Data nașterii | Nu se trimite ca atare. Dacă o regulă are prag de vârstă, calculează în Rust vârsta la data prestației sau intervalul necesar. Lipsa informației rămâne „necunoscut” |
| Sex sau alte caracteristici clinice | Numai dacă regula concretă le cere. Nu se deduc din nume și nu se importă global fără necesitate |
| Diagnoze | Cod, versiune ICD, G/V/A/Z, lateralitate dacă relevantă, data și starea activă/corectată. Conținutul rămâne date de sănătate |
| Prestații facturate | Cod, sistem EBM/GOAE/HZV, dată/oră/contact, număr de unități, stare activă/storno și referința locală la dovadă. Nu sunt necesare date bancare sau identități administrative |
| Contextul prestației | Efectuat/planificat/negat etc., durată, mod, conținut obligatoriu și referința dovezii. Nu se inventează date pentru completarea unei reguli |
| Asigurare/HZV | Tipul relevant, identificatorul contractului/versiunii și participarea/înscrierea la data prestației; fără numărul asigurării |
| Istoric | Numai fereastra necesară regulii. Datele serviciului pot fi indispensabile pentru caz și trimestru; nu sunt înlocuite arbitrar cu date fictive |
| Text liber | Inițial doar câmpurile și pasajele relevante. Poate conține numele pacientului, aparținătorilor sau alte identități; eliminarea câmpurilor standard nu îl face anonim. Preferă fapte structurate validate în Rust; dacă UI necesită text, tratează-l ca date personale în aceeași zonă protejată |
| Numele/calea fișierului | Nu este dovadă clinică; afișează o etichetă neutră, nu numele original |
| Variația sursei | Token de revizie limitat la sesiune pentru invalidarea rezultatelor. Un hash simplu al exportului nu este garanție de anonimizare |

Lista de FK-uri va fi stabilită pentru profilul DURIA confirmat de furnizor. Nu inventăm o listă definitivă din GDT generic și nu presupunem că un export conține tot ce lipsește din interfață. Câmpurile necunoscute nu trec automat mai departe. O extensie de format se acceptă printr-o revizie explicită a profilului.

## Constatări concrete din cod

P0 = blocant pentru folosirea exporturilor reale în acest design; P1 = necesar înainte de pilotul cu date reale. Prioritățile reprezintă evaluarea acestei revizii, nu incidente deja observate.

| ID | Prioritate și dovezi | Consecință și remediere pentru Claude |
|---|---|---|
| DS-01 | **P0**, `src-tauri/src/patient.rs:76–124`: `sanitize`/`sanitize_many` elimină o listă de FK-uri, dar ramura `_` transmite liniile necunoscute și neparsabile | Un nume în text liber, câmp necunoscut sau linie defectă ajunge în octeții IPC. Parsează și validează în Rust înaintea transmiterii; folosește o listă de câmpuri permise și DTO-uri tipizate. Nu promite anonimizare pentru textul liber |
| DS-02 | **P0**, `scripts/server-einrichten.ps1:17,29,35`: grupul implicit este BUILTIN Users, cu Modify moștenit pe rădăcina comună și R/W/D pentru `konten.json` | Dacă scriptul este rulat cu aceste valori, utilizatorii Windows incluși pot accesa directoarele celorlalți și modifica datele conturilor. Rolurile din aplicație nu compensează aceste drepturi. Separă ACL-urile per principal/stație, protejează conturile printr-un serviciu/administrator și testează accesul între utilizatori reali. Nu s-au verificat ACL-urile serverului existent |
| DS-03 | **P0**, `src-tauri/src/gdt.rs:59–76`, `src-tauri/src/lib.rs:61–74`: scannerul citește și șterge fișierele înaintea validării și înainte de tratarea stării autentificate | Inboxul nu este numai citit. În lipsa autentificării, fișierul este deja consumat și se afișează inclusiv numele său. Nu procesa fără sesiune validă; stabilește cu DURIA dacă folderul conține copii consumabile. Nu șterge sursa originală. Confirmă consumul numai după validare și preluare; la eșec păstrează o copie protejată cu termen scurt și alertă neutră |
| DS-04 | **P1**, `commands.rs:78–90,140–149`, `lib.rs:44–46` | Numele original al fișierului este transmis în fereastră; unele erori pot conține căi. Înlocuiește cu o etichetă opacă și mesaje neutre, fără conținutul fișierului |
| DS-05 | **P1**, `gdt.rs`, `config.rs`, expansiunea `%CLIENTNAME%` | Numele clientului RDP nu este o graniță de securitate. Variabile lipsă sau clienți cu nume identice pot produce același director. Folosește o identitate de sesiune controlată și ACL-uri per principal; refuză configurații ambigue. Verifică și căile canonice/reparse points |
| DS-06 | **P1**, `patient.rs:61–70,103–105` | Cheia HMAC este creată per instanță; `close()` golește maparea, dar nu rotește cheia. Pseudonimele rămân corelabile între importuri ale aceleiași instanțe. Documentează domeniul tokenului, rotește contextul la schimbarea sesiunii și invalidează răspunsurile întârziate |
| DS-07 | **P1**, `commands.rs:78–90,140–149`, `gdt.rs:59–76` | Importul manual verifică 20 MB, KVDT 200 MB, dar scannerul automat nu are aceeași limită; două citiri de aceeași dimensiune nu dovedesc finalizarea fișierului. Aplică limite înainte de alocare, validare de structură/lungimi/encodare și un protocol de finalizare confirmat de DURIA |
| DS-08 | **P1**, `src/notes/summarize.ts:69–88`, `src-tauri/tauri.conf.json:24` | Există un client pentru Ollama la 127.0.0.1:11434 și permisiune CSP. Nu rezultă că date au fost deja trimise, dar loopback este un serviciu separat. Verifică izolarea, procesele, logurile, păstrarea prompturilor și accesul RDP înainte de a permite date clinice; modelul nu are voie să execute instrucțiuni găsite în fișă |
| DS-09 | **P1**, `src-tauri/src/voice.rs:48–52`, butoanele clipboard din UI | În afara citirii exportului, audio este scris temporar pe disc, iar copierea poate alimenta istoricul/sincronizarea clipboardului. Aceste fluxuri necesită politici și teste separate; afirmația globală „nimic nu se scrie pe disc” este incorectă |

Controalele utile deja prezente includ filtrarea unor identități structurate, token HMAC cu cheie aleatoare în memorie, Argon2id pentru parole, restricția de rol la KVDT și întrerupătoare pentru scriere. Ele reduc unele riscuri, dar nu închid constatările de mai sus.

## „Fără păstrare” — obiectiv verificabil

- **Fișa sursă DURIA** rămâne documentația medicală oficială, cu propriile obligații de păstrare. Eliminarea copiilor de lucru nu înseamnă ștergerea fișei.
- **Copii de export**: numai într-un folder dedicat, cu ACL restrâns și volum protejat; definește cine le creează, când sunt consumate și cum se curăță după eșec. Importul manual actual nu șterge sursa, scannerul automat o șterge prea devreme. Cele două fluxuri necesită politici distincte.
- **Contextul RAM/UI**: golește notele, faptele, rezultatele, mapările și joburile la închidere/logout/schimbare. Rezultatele întârziate din alt context se resping. Ștergerea unei referințe JavaScript nu este o garanție de ștergere fizică din RAM.
- **Disc și sistem**: verifică temp, crash dump, pagefile/hibernare, WebView cache, backup, indexare Windows, antivirus, remote support și RDP. Criptarea și accesul restrâns sunt necesare când platforma poate produce copii. Nu putem certifica „zero urmă” din codul aplicației.
- **Loguri**: fără text clinic, nume, identificatori DURIA, nume de fișiere sau prompturi. Pentru audit păstrează numai ceea ce este justificat — actor, moment, versiune de reguli/catalog, decizie și referință protejată unde este necesară — cu acces și termen documentate. Un identificator de audit corelabil rămâne dată personală.
- **Repository și dezvoltare**: numai date publice și exemple sintetice. Nu pune exporturi reale în Git, conversații de dezvoltare, rapoarte de erori sau servicii AI externe. Pseudonimizarea singură nu schimbă această limită.

## Probe de acceptare cerute pentru pilot

| Test | Date sintetice și rezultat obligatoriu |
|---|---|
| PRIV-01 | Nume/adresă/număr de asigurat în fiecare FK cunoscut: nu apar în IPC/UI/loguri |
| PRIV-02 | Aceleași identități în text liber, FK necunoscut și linie defectă: nu trec prin mecanismul declarat „fără identitate”; intrarea e refuzată/minimizată sau marcată ca text personal într-un flux protejat aprobat |
| PRIV-03 | Nume pacient în numele fișierului și cale: UI/erori conțin doar etichete neutre |
| PRIV-04 | Utilizator Windows A încearcă să citească exportul lui B sau să modifice `konten.json`: acces refuzat de sistem, nu doar de UI |
| PRIV-05 | Logout în timp ce se citește un export, respectiv pacient schimbat în timpul unui job: nicio afișare, mapare sau rezultat utilizabil în sesiunea nouă |
| PRIV-06 | CLIENTNAME lipsă/duplicat și două sesiuni RDP simultane: nu împart accidental inboxul sau contextul |
| PRIV-07 | Fișier parțial, prea mare, cu lungimi incorecte, nerecunoscut sau fără sesiune: nu este pierdut, afișat sau procesat fără validare; nu se șterge sursa |
| PRIV-08 | Închidere normală și crash: inspectează directoarele temporare, loguri, cache, clipboard și backup cu un marker sintetic; documentează urmele și politica lor |
| PRIV-09 | Captură de trafic în mediul de test: verifică toate conexiunile și inclusiv serviciile locale. Datele clinice nu pleacă pe căi neaprobate |
| PRIV-10 | KVDT cu mulți pacienți și date inutile: acces doar cu rolul necesar, izolare între pacienți, prelucrare minimă, resetare completă la închidere |

Aceste probe **nu au fost executate pe instalarea Praxisului**. Confirmarea lor, remedierea DS-01…09, profilul DURIA și analiza juridică documentată sunt condițiile propuse pentru un pilot cu date reale.

## Surse și decizii încă deschise

Sursele consultate sunt în `data/legal/sources.manifest.json`. Copii locale există pentru §22 BDSG și §203 StGB; GDPR și ghidul KBV au fost consultate prin web. Descărcările directe GDPR au răspuns fără conținut și au fost eliminate, nu prezentate drept documente oficiale salvate.

Praxisul trebuie să stabilească responsabilul prelucrării, administratorul sistemului, furnizorii cu acces și eventualele AVV, politica de păstrare și evaluarea DPIA. DURIA trebuie să confirme profilul, finalizarea și consumul exportului, schimbarea contextului pacientului, câmpurile de asigurare/contract/storno și mecanismul de confirmare. Codul nu permite deducerea acestor răspunsuri.

Pentru etapa următoare: întâi granița Rust/IPC și ACL-urile; apoi inboxul și sesiunea; după aceea probele cu date sintetice și verificarea documentelor Praxisului. Nu este necesară trimiterea unui export real către Codex pentru aceste corecturi.
