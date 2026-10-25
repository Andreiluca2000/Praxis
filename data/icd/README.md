# ICD-10-GM 2026: surse oficiale pentru import

Livrare Codex, 25.10.2026. Fișierul solicitat este **`icd10gm2026syst_claml_20250912.xml`**, extras fără modificări din arhiva oficială BfArM `icd10gm2026syst-claml.zip`. Nu este o pagină HTML și nu este încă baza de date importată a aplicației.

| Fișier | Rol |
|---|---|
| `manifest.json` | Proveniență, versiune, SHA-256, dimensiuni, componente și inventarul arhivelor |
| `icd10gm2026syst_claml_20250912.xml` | Systematisches Verzeichnis, ClaML 2.0.0, versiunea 2026, publicat 12.09.2025 |
| `icd10gm2026syst-claml.zip` | Arhiva oficială completă, inclusiv documentația și anexele |
| `icd10gm2026syst-meta.zip` | Arhiva oficială completă cu metadatele |
| `metadata/icd10gm2026syst_kodes.txt` | Coduri și titluri compuse, indicatori terminali, utilizare §295/§301 și alte metadate |
| `icd10gm2026syst_claml_liesmich.txt` | Instrucțiuni oficiale ClaML; codare Windows-1252 |
| `icd10gm2026syst_metadaten_liesmich.txt` | Schema oficială a celor 28 de coloane; UTF-8 cu BOM |
| `ClaML2.0.0.xsd`, `w3c-xml.xsd` | Schema livrată de BfArM și dependența oficială W3C pentru validare offline |
| `icd10gm2026syst-corrigenda-20260128.pdf` | Corrigenda oficială, inclusiv cele șapte corecții ale limitelor de vârstă |
| `corrigenda-20260128.json` | Instrucțiuni derivate din corrigenda, cu verificarea valorilor vechi înainte de aplicare |
| `SOURCE_NOTICE.txt`, `bfarm-downloadbedingungen-20250801.pdf` | Atribuire și condițiile oficiale de utilizare |

Sursă: [BfArM Downloads](https://www.bfarm.de/DE/Kodiersysteme/Services/Downloads/_node.html), secțiunea ICD-10-GM 2026. Arhivele au fost obținute prin formularul oficial de confirmare. Linkurile exacte sunt în manifest. Hashurile sunt calculate local; nu sunt semnături sau hashuri publicate de BfArM.

## Contractul manifestului

Schema este `../../schemas/icd-source-manifest.schema.json`, versiunea `1.0.0`. Căile din manifest sunt relative la **acest director**. Importatorul trebuie să refuze căi absolute, ieșirea din director, fișiere lipsă, dimensiuni/hashuri greșite sau versiuni nesuportate. `artifacts[].archive_member` leagă un fișier extras de membrul exact din ZIP. `original_bytes=true` înseamnă octeți originali ai sursei, nu conținut aprobat clinic.

`components` spune explicit ce este disponibil. Nu sunt livrate indexul alfabetic, trecerea de la ediția anterioară sau ediții istorice. Nu trebuie pretins că sunt acoperite toate sinonimele. `validated_application_database=false` rămâne astfel până când Claude implementează și verifică importatorul.

## Rezultate de structură

- 12.606 elemente `Class`: 22 capitole, 250 blocuri și 12.334 categorii.
- 53 `Modifier` și 273 `ModifierClass`.
- 16.905 rânduri de cod în metadate: 14.370 terminale și 2.535 neterminale, toate cu 28 de coloane.

Numărul elementelor `Class` **nu** reprezintă toate codurile finale. Unele coduri sunt generate cu modificatori. Metadatele ajută la reconcilierea setului final; nu înlocuiesc includerile, excluderile și instrucțiunile din ClaML.

## Pașii importatorului Claude

1. Verifică schema manifestului, SHA-256, CRC ZIP, versiunea `Title` și schema XML. Parsează fără rețea, DTD sau entități externe. Schema W3C se rezolvă exclusiv local. Tratează explicit neconcordanța XSD descrisă mai jos; nu permite generic orice eroare de schemă.
2. Importă ierarhia, `ModifiedBy`/`ModifierClass`, rubricile, referințele și condițiile moștenite. Nu aplatiza excluderile într-o simplă listă de sinonime. Confruntă codurile expandate cu metadatele; diferențele intră în carantină.
3. Aplică `corrigenda-20260128.json` **numai copiei derivate**. Sunt trei modificări XML și șapte celule ale metadatelor. Cere exact o potrivire și valoarea veche așteptată; altfel oprește importul. Înregistrează hashul original, identificatorul corecției și hashul rezultatului. Originalele din acest director rămân intacte.
4. Păstrează separat: codul normalizat, forma oficială cu semne, terminalitatea, permisiunile de utilizare și titlul. În TXT: coloana 2 = T/N; 6 = codul cu semne; 7 = codul fără semne; 9 = titlul compus; **13 = §295, 14 = §301**. Numerotarea este de la 1. Folosește descrierile complete din readme-ul metadatelor, nu o interpretare proprie a literelor.
5. Nu confunda „neterminal” cu interdicție universală de codificare ambulatorie: anumite coduri neterminale au utilizare specificată în coloana §295. Nu confunda terminalitatea cu G/V/A/Z; acestea se aleg separat de medic, fără G implicit.
6. Fă importul într-o bază nouă, verifică și apoi schimbă atomic versiunea activă. La eroare păstrează catalogul valid precedent. Nu utiliza ediția 2026 pentru servicii din alte ediții fără o regulă explicită de versiune.
7. Testează coduri explicite și formate prin modificatori, umlaut, semne de cod, ierarhie, referințe, corecțiile U10.90/U10.91/E66.*5 și reproducibilitatea importului. Căutarea ICD identifică termeni de clasificare; nu stabilește singură un diagnostic clinic din simptome.

BfArM precizează că erorile de vârstă din corrigenda nu au fost corectate în fișierele publicate. În aceeași PDF există și corecții mai vechi ale fișierelor de conversie, care nu fac parte din această livrare. Documentația oficială indică versiunea de referință a Systematisches Verzeichnis pentru neconcordanțe.

### Neconcordanță între XML și schema oficială

Validarea strictă a originalului cu XSD-ul livrat produce **o eroare**: atributul `xml:space="default"` de pe rădăcina `ClaML`, linia 2, nu este admis de schema livrată. Nu este un eșec de descărcare: XML-ul extras are exact octeții din ZIP. O copie exclusiv în memorie, pentru validare, fără acel singur atribut de pe rădăcină trece XSD. Nu s-a modificat XML-ul sau XSD-ul pe disc. Scriptul acceptă doar această neconcordanță exactă și refuză orice eroare suplimentară. Claude trebuie să decidă și să documenteze explicit această excepție în carantina importatorului; nu se poate raporta „originalul trece XSD fără erori”.

## Utilizare și verificare

Condițiile din 01.08.2025, secțiunea I și anexa ei, cer respectarea regulilor privind modificarea și atribuirea, precum și condiții la distribuire. Păstrează `SOURCE_NOTICE.txt` și PDF-ul condițiilor lângă conținut. O corecție derivată trebuie identificată ca atare; nu se prezintă drept arhivă originală BfArM. Nu există în această livrare o aprobare generală de distribuire a produsului.

Din rădăcina proiectului:

```powershell
python -X utf8 scripts/verify-content.py
```

Verificatorul folosește Python 3.11+, `lxml` și `jsonschema`, fără acces la rețea și fără date de pacient. Nu este un importator clinic.
