# Hausarzt: servicii incluse și laborator local

26.10.2026. **31 de clauze, 14 coduri referite, 35 de ancore EBM**. Patru celule din coloana VP au fost verificate vizual și prin coordonatele PDF: 02100/02101, 02350/02360. Capturile de lucru sunt în `tmp/pdfs/`; originalul PDF rămâne neschimbat. Pentru injecțiile IV/IM/SC, perfuzia SC și recoltarea venoasă, coloana VP a fost verificată vizual pe paginile corespunzătoare din Anhang 1.

Acest pachet evită dezvoltarea inutilă a unui modul de perfuzii de specialitate pentru Praxisul Hausarzt. În contextul obișnuit, serviciile incluse nu devin automat cifre EBM lipsă. Pentru Privat se verifică separat GOÄ; pentru Notdienst, contextul propriu; pentru HZV, contractul aplicabil.

Laboratorul selectat: 32025/32026/32027, 32030/32031/32033, 32128/32135/32150/32151/32152; plus condițiile de atribuire KV pentru 32001. Aspecte reprezentate:

- diferența efectuare în Praxis / solicitare la laborator extern / Laborgemeinschaft;
- condiția rezultatului în maximum o oră pentru 32025–32027;
- metodele relevante și interdicția folosirii 32030 pentru bandeleta urinară;
- minimum cinci parametri pentru 32033;
- excluderile cu Check-up și laboratorul preventiv;
- limita de vârstă din legenda 32152;
- excluderea generală 32.2 pe zi față de 31.1.2/34291;
- 32001 adăugat de KV și contactul personal în ruta trimestrului următor 03100.

Nu este un laborator complet sau un calculator Wirtschaftlichkeitsbonus. Nu se deduce eligibilitatea din prezența unui rezultat în Karteikarte. Metodele, indicația, controlul calității, efectuarea, contextul și autorizațiile aplicabile necesită revizie. Regula de facturare 32150 nu este folosită ca algoritm clinic sau ca motiv de amânare a evaluării unei urgențe.

```powershell
python -X utf8 scripts/build-primary-care-review.py
python -X utf8 scripts/build-billing-release.py
python -X utf8 scripts/build-hausarzt-scope.py
python -X utf8 scripts/verify-hausarzt-scope.py
python -X utf8 scripts/verify-billing-release.py
python -X utf8 scripts/review-billing-code.py --system EBM --code 32025 --details
```

Verificatorul controlează schemele, ancorele, proveniența, cele patru marcaje VP și 22 de scenarii de domeniu Hausarzt. Nu testează motorul aplicației, performanța clinică a testelor sau eligibilitatea unui pacient. Dosarul rămâne `draft`, `pending`, `operational:false`.

## Clarificări comune, 27.10.2026

Registrul `../scope-resolutions/rules.review.json`, schema 1.10.0, clarifică intervalele perechilor explicite din laboratorul local (32025/32026/32027/32033/32150), laboratorul preventiv (32880/32881/32882) și listele 03000/03030. Lotul are 41 de perechi distincte și păstrează dovezile reciproce. Marcajele sursă rămân pentru trasabilitate; `review-billing-code.py` expune intervalele în `scope_clarifications`. Prelucrarea probei mai târziu nu dovedește o ședință nouă. Ferestrele pe caz/trimestre, conținutul prestațiilor și eligibilitatea rămân separate. Detalii și probe pentru Claude: `../scope-resolutions/README.md`.
