# Module opționale Hausarzt — revizie EBM și GOÄ

Livrare 27.10.2026: **66 clauze, 70 ancore de sursă și 14 poziții**. Toate sunt draft, cu review pending și fără activare. Modulele sunt relevante numai dacă Praxisul efectuează serviciile și îndeplinește condițiile aplicabile.

| Sistem | Poziții | Conținut pregătit |
|---|---|---|
| EBM | 33012 | Tiroidă B-Mode, autorizație KV, documentație, excluderi per ședință/zi/caz conform sursei |
| EBM | 35100, 35110 | Conținut psihosomatic, competență, 15 minute, timp suplimentar, video condiționat, excluderi și limita zilnică 35110 |
| EBM | 03370–03373 | Definiția pacientului paliativ, plan, domiciliu, SAPV, baze, timp, unități și excluderi |
| GOÄ | 651, 652, 654 | ECG/ergometrie, numărul derivațiilor, măsurare TA minimum 18 ore și excluderi ECG |
| GOÄ | 605, 605a | Metoda spirografică, curba debit-volum documentată, relații cu 606/610/612 |
| GOÄ | 410, 420 | Organe, două planuri, documentare, o bază și cel mult trei organe suplimentare, factură |

Surse principale: originalele EBM Q4/2026 și GOÄ din `../sources/`. Două pagini explicative oficiale sunt salvate în acest director cu `sources.manifest.json`. Registrul de livrare fixează toate hashurile. Fișierele HTML sunt copii ale paginilor publice, nu transcrieri generate.

## Clarificarea 03100 și paliația

[KBV](https://www.kbv.de/praxis/abrechnung/chronikerpauschale) explică explicit că excluderea dintre Versorgungspauschale și paliație privește **aceeași ședință**. Serviciile pot rămâne facturabile în același Behandlungsfall și în trimestrul următor, cu propriile condiții. [KVSA](https://www.kvsa.de/praxis/abrechnung/wichtige-infos/versorgungspauschale) confirmă acest context; este folosită numai ca explicație a EBM național, fără importarea regulilor regionale în NRW.

Așadar, titlul 03371 cu baza 03100 și excluderea acestei baze nu se interpretează ca o interdicție pe întreg trimestrul. Clauza `EBM_PALL_03100_SESSION` și `scope_by_counterpart` fixează această clarificare numai pentru partenerul 03100. Celelalte excluderi necalificate rămân explicit nerezolvate. Excepția de bază pentru trimestrul următor și cerința aceleiași Praxis sunt reguli separate.

## Utilizare offline

```powershell
python -X utf8 scripts/build-optional-hausarzt-review.py
python -X utf8 scripts/build-goae-review.py
python -X utf8 scripts/build-billing-release.py
python -X utf8 scripts/build-hausarzt-scope.py
python -X utf8 scripts/verify-optional-hausarzt.py
python -X utf8 scripts/review-optional-hausarzt.py --system EBM --first 03371 --second 03100
python -X utf8 scripts/review-optional-hausarzt.py --system GOAE --first 651 --second 652
```

Interogarea separă relațiile perechii, condițiile generale și apartenența la secțiuni. Pentru 03100 returnează contextul rezolvat `session` cu referința clauzei; în sursa brută rămâne formularea originală. O cerință de bază nu este o aprobare a asocierii. Perechile necunoscute, repetarea aceluiași cod și HZV nu sunt declarate facturabile. Absența unei excluderi 605a+610 în acest dosar nu dovedește permisiunea.

`verify-optional-hausarzt.py` verifică schema, hashurile și ancorele, **13 liste EBM de excludere expandate direct din textul original** și **52 de scenarii de interogare**, inclusiv ordinea inversă, separarea sistemelor și rezolvarea intervalului 03100. Acestea sunt verificări ale dosarului/utilitarului, nu teste clinice sau probe ale aplicației.

Cele șapte profiluri de calcul GOÄ sunt în dosarul GOÄ existent: 605/605a/651/654 folosesc cadrul redus, iar 652/410/420 cadrul standard. Nu se aleg automat factori și nu se interpretează coloana istorică DM ca EUR. Previzualizarea nu înlocuiește verificarea prestației.

## Clarificări EBM pe perechi — completare 27.10.2026

Registrul comun `../scope-resolutions/rules.review.json`, schema 1.8.0, completează intervalele pe ședință ale perechilor enumerate pentru 33012, 35100/35110 și 03370–03373. Listele 33012 și 03370–03373 au acum toate intervalele perechilor explicite clarificate. 35100/35110 păstrează separat excluderile pentru secțiunea 35.2: codurile din acea secțiune nu sunt deduse din prefix și nu sunt declarate automat compatibile dacă lipsesc din lista exactă.

Interogarea 35100/35110 sau 35110/03230 returnează acum `session`, păstrând `source_scope`. Cerința de timp suplimentar nu anulează aceste excluderi. 35100/35110 cu 08521 rămân pe Behandlungsfall, 03370/37300 pe Krankheitsfall, iar 03371/37302 pe Behandlungsfall. Relațiile 33012/31695 și 33012/26330 își păstrează intervalele pe zi, respectiv pe caz. Limita 35110 de trei pe zi rămâne o limită, fără aprobare automată a repetării.

Verificatorul registrului comun include 320 de interogări în ambele sensuri pentru noul lot de îngrijire/psihosomatică, inclusiv păstrarea secțiunilor, frecvențelor și intervalelor pe caz. Dosarul opțional rămâne la 66 de clauze și 70 de ancore originale; clarificările sunt păstrate separat, fără modificarea textelor normative.

## Probe pentru Claude — încă de implementat și executat

1. 35100 fără notă etiologică sau fără competența necesară nu este propus numai din durata de 15 minute. 35110 cere propria intervenție documentată.
2. 35100+35110 și 35110+03230 păstrează excluderile. Timpul suplimentar nu le anulează; 45 de minute nu produc automat trei unități 35110.
3. Video: verifică cerințele și marcajul; nu echivala telefonul cu videosprechstunde.
4. 03370 cere planul și istoricul Krankheitsfall; 03371 cere verificarea Behandlungsfall. Istoricul incomplet produce „nu se poate verifica”.
5. SAPV Vollversorgung blochează 03371–03373 conform normei, dar nu extinde aceeași clauză automat la 03370. Serviciile echivalente SAPV prestate de același medic au o regulă distinctă pentru toate patru.
6. 03372: 14/15/29/30/75/90 minute trebuie evaluate prin intervale împlinite și plafon zilnic 620 puncte, cu baza și conținutul dovedite. Nu importa acest prag în 03373, definit per vizită.
7. 03371 cu 03100: distinge aceeași ședință, altă ședință din același trimestru și trimestrul următor cu contact personal. Nu bloca trimestrul întreg și nu elimina automat una dintre cifre.
8. 33012 fără autorizația corespunzătoare sau fără imagini nu este aprobat din textul „Sono”. Identificarea pacientului rămâne în documentația medicală originală; nu devine motiv de import al datelor identificabile în asistent.
9. ECG după efort fără ergometrie documentată nu produce 652. ECG de repaus inclus în aceeași ergometrie nu justifică automat 651+652. TA pe 17 ore nu îndeplinește minimum 18 ore pentru 654.
10. La ecografie, vizualizarea incidentală a vecinătății nu produce 420. Testează 1/2/4/5 organe, aceeași regiune și segmente intestinale; 420 rămâne plafonat la trei pe ședință, cu organele pe factură.

Acest pachet închide lipsa materialului propriu pentru lista selectată, **nu revizia completă a tuturor condițiilor**. Rămân detaliile acordurilor de calitate/psihoterapie, documentele Praxisului, scenariile operative și condițiile generale/interacțiunile din alte dosare. GOÄ 417 pentru tiroidă și 2004/2005 pentru anumite răni rămân exemple de revizuit în inventarul serviciilor; lista actuală nu justifică înlocuirea lor cu coduri selectate.

## ECG și intervale tehnice — completare 27.10.2026

Schema dosarului este 1.1.0. [Explicația BÄK despre ECG, 28.04.2017](https://www.bundesaerztekammer.de/fileadmin/user_upload/_old-files/downloads/pdf-Ordner/GOAE/Elektrokardiographie.pdf) este salvată integral în `baek-ekg-20170428.pdf`, cu manifest. Cele trei clauze noi sunt de revizie, fără aprobare automată:

- `GOAE_ECG_650_651_REVIEW`: controale distincte medical necesare; aceeași examinare nu se dublează doar pentru că 651 este mai cuprinzător.
- `GOAE_ECG_651_652_STAGED`: ECG de repaus inclus în ergometrie versus investigație ulterioară indicată de rezultatul inițial, cu prestație și documentare complete.
- `GOAE_ECG_INVOICE_CONTEXT`: orele și contextul diagnosticului pot susține revizia, fără să dovedească singure facturabilitatea.

Interogarea păstrează `GOAE_ECG_EXCLUSIONS` alături de clauza condiționată relevantă. Nu aplică aceste condiții tuturor perechilor 650–653 și nu modifică intervalul ECG prin registrul comun. Trei liste pentru spirometrie/ecografie primesc în schimb clarificări exacte: 605 cu 610/612 și 410 cu 412/413/415/417/418. 605a și 420 nu sunt adăugate automat în aceste excluderi. Cele 52 de scenarii verifică și păstrarea excluderii plus contextul ECG, fără evaluare clinică sau testare DURIA.
