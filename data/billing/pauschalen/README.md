# Pauschale Hausarzt — dosar de revizie

26.10.2026. **49 de clauze pentru 14 cifre**, cu **80 de ancore** verificate în PDF-ul oficial KBV Q4/2026: 03000, 03008, 03010, 03020, 03030 și 03040–03048. Sursa originală și hashul sunt cele din `../sources.manifest.json`. `rules.review.json` are `draft`, `review:pending`, `operational:false`, `complete:false`.

Conținutul acoperă contacte, frecvențe, excluderi, trimestre succesive, dependențele suplimentelor, atribuirea KV și componentele de practică ale Vorhaltepauschale. Nu constituie un model complet de eligibilitate pentru cele 14 cifre. Rămân aplicabile prevederile generale, condițiile video/TSS, denominatoarele din Präambel 3.1, acordurile externe și contextul contractului.

Pentru integrare, Claude trebuie să păstreze următoarele distincții:

- **03000/03030:** Behandlungsfall și blocarea în trimestrul următor 03100 pentru aceeași Praxis/același pacient. `nicht neben` fără interval explicit rămâne nerezolvat; nu îl transforma în „aceeași zi”.
- **03008:** Vermittlung plus Überweisung, începerea tratamentului, grupă de specialitate, tratament anterior la destinație, (N)BSNR și justificările medicale. Calculatorul inclus verifică numai componenta calendaristică.
- **03008 față de 03020 după 03100:** prima excepție admite personal/video; a doua cere contact personal. Nu reutiliza aceeași condiție pentru ambele.
- **03020, 03040–03048:** atribuite de KV. Absența din exportul local nu declanșează automat o propunere „medicul a uitat cifra”. Pentru 03010 norma spune că KV *poate* adăuga cifra; verifică procedura regională.
- **03040:** excluderi în Behandlungsfall; cu un 03030 reducerea specifică este 50%, cu două 03030 această reducere nu se aplică.
- **03043:** anumite excluderi acoperă trimestrul curent și următor; excepția actorului specialist din structuri mixte necesită identitatea profesională și sectorul prestației.
- **03041/03042 și 03044/03045:** niveluri alternative, cu excepțiile definite pentru Praxisuri specializate. Criteriile privesc întregul Praxis; pragul procentual de vaccinări este 25% în Q4, distinct de pragul absolut de 10 prestații pentru reducerea Vorhaltepauschale.
- **03046/03047/03048:** baze curente și cifre din trimestrul imediat anterior distincte. Nu se propun toate după orice 03100.
- **HZV:** excepția 03008/88196 cere verificarea conținutului contractului. Nu activează reguli HZV și nu autorizează fallback universal la EBM.

```powershell
python -X utf8 scripts/build-pauschalen-review.py
python -X utf8 scripts/build-billing-release.py
python -X utf8 scripts/verify-pauschalen-review.py
python -X utf8 scripts/verify-billing-release.py
python -X utf8 scripts/review-billing-code.py --system EBM --code 03043 --details
python -X utf8 scripts/preview-referral-window.py --need-on 2026-10-01 --treatment-on 2026-10-25
```

Ultimul exemplu identifică ziua 24: condiția medicală pentru intervalul extins și indicarea justificării sunt necesare. Rezultatul rămâne `not_verified`. Cele **18 scenarii** verifică zilele 0/1/4/5/23/24/35/36, traversarea lunii și trimestrului, date invalide și refuzul aplicării datasetului în afara Q4/2026. Nu există scriere în DURIA sau integrare în motorul aplicației prin acest dosar.

## Clarificări comune, 27.10.2026

Registrul `../scope-resolutions/rules.review.json`, schema 1.10.0, clarifică intervalele perechilor explicite din laboratorul local (32025/32026/32027/32033/32150), laboratorul preventiv (32880/32881/32882) și listele 03000/03030. Lotul are 41 de perechi distincte și păstrează dovezile reciproce. Marcajele sursă rămân pentru trasabilitate; `review-billing-code.py` expune intervalele în `scope_clarifications`. Prelucrarea probei mai târziu nu dovedește o ședință nouă. Ferestrele pe caz/trimestre, conținutul prestațiilor și eligibilitatea rămân separate. Detalii și probe pentru Claude: `../scope-resolutions/README.md`.
