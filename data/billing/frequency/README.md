# Limite de frecvență și volum din legendele EBM — completare Claude

27.10.2026, orizont Q4/2026. Dosar draft, nerevizuit profesional, neoperativ.

Auditul livrării Codex (`docs/AUDIT_CODEX_20261027.md`) a comparat frecvențele din legendele celor 91 de ținte EBM Hausarzt cu parametrii din toate dosarele. Patru coduri aveau limite din legendă care nu erau exprimate nicăieri ca parametri; acest dosar le adaugă, cu ancore exacte în EBM Q4/2026 (PDF KBV, SHA-256 `609f6353…`).

| Clauză | Cod | Regulă | Sursă |
|---|---|---|---|
| `01435_CASE_FREQUENCY` | 01435 | o dată în Behandlungsfall | p. 61 |
| `01435_CHILD_FREQUENCY` | 01435 | de două ori în Behandlungsfall până la împlinirea vârstei de 12 ani; vârsta la prima solicitare din trimestru | p. 61, p. 32 |
| `03230_TIME_UNIT` | 03230 | câte o unitate pentru fiecare 10 minute încheiate, minimum 10 minute | p. 199 |
| `03230_PRACTICE_VOLUME` | 03230 | volum al Praxisului: 64 de puncte × cazurile de tratament (Nr. 10 Präambel 3.1) | p. 176 |
| `33042_CASE_LIMIT` | 33042 | cel mult de două ori în Behandlungsfall | p. 848 |
| `32001_HAUSARZT_POINTS` | 32001 | Wirtschaftlichkeitsbonus, capitolul 3: 19 puncte pe caz ca valoare din tabel; KV adaugă și reduce | p. 782 |

Limitele celorlalte ținte erau deja modelate: pauschale (03000–03048), cronici (03100–03222, ca text și fapte necesare), răni (02300–02314, 40901/40902), geriatrie/paliație (03360–03373), 35110 și regulile draft din `rules.draft.2026-q4.json`.

## Reguli pentru integrare

- O limită nu aprobă niciodată facturarea; peste limită → conflict, sub limită → doar „nu încalcă această clauză”.
- Numărarea cere istoricul complet al cazului, trimestrului și Praxisului. Istoric incomplet → `not_verified`.
- `03230_PRACTICE_VOLUME` limitează remunerarea, nu documentarea: depășirea volumului nu este o cifră greșită a medicului.
- `32001` este adăugat de KV; lipsa lui în export nu este o omisiune de transmis.
- Nu se transferă în GOÄ sau HZV.

## Reproducere

```powershell
python -X utf8 scripts/build-frequency-review.py
python -X utf8 scripts/build-billing-release.py
python -X utf8 scripts/verify-frequency-review.py
```

Probe pentru aplicație: 03230 cu 9 minute → nicio unitate; cu 25 de minute → două unități; 01435 de două ori în același caz la 40 de ani → conflict, la 11 ani → în limită; 33042 de trei ori în același caz → conflict; 32001 lipsă din exportul medicului → nu este propus ca cifră lipsă.
