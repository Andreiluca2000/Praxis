# Prevenție și investigații — dosar parțial Q4/2026

`rules.review.json` conține **32 de clauze draft**, **20 de coduri menționate** și **40 de ancore în surse**. Include Check-up, laboratorul aferent, screeningul hepatitei, screeningul cutanat, screeningul anevrismului aortei abdominale, examinarea clinică preventivă pentru bărbați și conținuturi tehnice ECG/TA/spirografie.

Sursele noi sunt **PDF-urile G-BA propriu-zise**, cu SHA-256, versiune și dată de intrare în vigoare în `sources.manifest.json`. GU-RL: în vigoare din 12.02.2021. KFE-RL: în vigoare din 12.03.2026. Documentul de serviciu KFE pentru 01.01.2027 nu a fost folosit ca normă aplicabilă în 2026. EBM este originalul Q4/2026 din manifestul existent.

Toate clauzele sunt neoperative și necesită revizie. Codurile menționate includ și baze sau coduri cu reduceri; menționarea nu dovedește acoperirea integrală a eligibilității lor. Nu există reguli contractuale regionale/HZV sau echivalențe automate GOÄ în acest dosar.

```powershell
python -X utf8 scripts/preview-prevention-window.py --code 01732 --on 2026-10-01 --last 2023-12-31 --age 35
python -X utf8 scripts/preview-prevention-window.py --code 01745 --on 2026-10-01 --last 2025-01-01 --age 35
python -X utf8 scripts/preview-prevention-window.py --code 01748 --on 2026-10-01 --age 65 --sex male
python -X utf8 scripts/verify-prevention-review.py
```

Comenzile se rulează din rădăcina proiectului. Utilitarul verifică numai o componentă de interval pentru o prestație din perioada pachetului, nu facturabilitatea. Rezultatul global este întotdeauna `not_verified`. Fără istoric anterior nu presupune că o prestație unică nu a fost făcută. Pentru 01745/01746 trebuie stabilit ultimul screening relevant indiferent de cod sau furnizor. Datele calculate pentru ani viitori sunt proiecții calendaristice, nu activări ale unor ediții viitoare.

Diferențe importante:

- Check-up 35+: următorii doi ani calendaristici după anul examinării sunt excluși; nu se folosește automat un interval de 36 luni de la aceeași zi.
- Screening cutanat: un an calendaristic intermediar, cu condițiile de vârstă și autorizare. Sub 35 ani cere contract separat.
- EBM 1.7.2 Nr.3 prevede excepția pentru anumite combinații 01732/01745/01746 în aceeași BAG interdisciplinară. Dosarul anterior de combinații și motivarea draftului 01732 au fost completate cu această sursă. Schema veche nu evaluează automat condiția excepției; draftul rămâne blocat.
- Screening AAA și consilierea sunt prestații distincte, o singură dată fiecare în condițiile prevăzute. Asocierea 01748 cu 33042/33043 are reduceri specifice, nu o interdicție generală.
- Înregistrarea Holter ECG de 18 ore și monitorizarea TA de 20 ore sunt durate ale înregistrării, nu durate de conversație. Examenul ECG de efort nu este un ECG simplu de repaus; Peak-Flow nu dovedește spirografia completă.

Regenerare: `python -X utf8 scripts/build-prevention-review.py`. Verificarea controlează sursele, schema, 40 de ancore, parametrii tehnici, legătura excepției cu dosarul anterior și **28 de scenarii ale verificatorului calendaristic**. Necesită `pymupdf` și `jsonschema`. Aceste scenarii nu sunt teste ale motorului aplicației sau revizie clinică.

Pentru Claude: implementează condițiile complete, istoricul între furnizori, autorizațiile, conținutul documentat, separarea screening/diagnostic curativ și excepția BAG înainte de activare. Documentarea screeningului cutanat printr-un text generat nu înlocuiește documentarea în software certificat cerută de sursă. Nu propune o prestație lipsă numai din vârstă sau din dreptul la screening.

## Clarificări comune, 27.10.2026

Registrul `../scope-resolutions/rules.review.json`, schema 1.10.0, clarifică intervalele perechilor explicite din laboratorul local (32025/32026/32027/32033/32150), laboratorul preventiv (32880/32881/32882) și listele 03000/03030. Lotul are 41 de perechi distincte și păstrează dovezile reciproce. Marcajele sursă rămân pentru trasabilitate; `review-billing-code.py` expune intervalele în `scope_clarifications`. Prelucrarea probei mai târziu nu dovedește o ședință nouă. Ferestrele pe caz/trimestre, conținutul prestațiilor și eligibilitatea rămân separate. Detalii și probe pentru Claude: `../scope-resolutions/README.md`.

Schema prevenirii 1.1.0 adaugă relația explicită `excludes` celor trei liste de laborator, păstrând 32 de clauze și 40 de ancore.
