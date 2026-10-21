# Documenten in toptuinen.app: soorten, vaste teksten en de factuurketen

> **Uitgangspunten** (zie ook `../README.md`):
> 1. toptuinen.app bestaat al en staat gedeeltelijk. Het **offerteprogramma** en het **factuurprogramma** bevatten misschien al documentsoorten, nummering of teksten. Kijk eerst wat er is en breid dat uit. Bouw niets dubbel.
> 2. De **huidige stack van toptuinen.app is leidend**. Botst iets in dit document met de stack of met hoe de app nu werkt, dan gaat de app voor.
> 3. **Ricardo beslist alles** en pakt dit vanaf nu op. Dit document beschrijft wat het moet doen en waarom; alles wat als advies, voorstel of [KEUZE] staat, beslist Ricardo.

## Wat
Alle documentsoorten die Top Tuinen gebruikt (offerte, orderbevestiging, aanbetaling, termijn- en eindfactuur, creditfactuur, herinnering, bestelformulier, leveringsbon, meetdocument, brief) komen in toptuinen.app.

- Ze hebben **dezelfde opbouw** als de offerte: `tekst → tabel → tekst` (zie `../offerte/`).
- Elke soort heeft **vaste teksten die één keer zijn vastgesteld** en daarna altijd kloppen.
- Documenten hangen aan elkaar als een **keten**: offerte → aanbetaling → termijn → eindfactuur.

## Lees eerst
- `HERO-documenttypes-spec.md`: de 18 types in HERO met hun instellingen, de dialoog "Document maken" en hoe termijnen nu gaan
- `standaardteksten.md`: alle 27 huidige teksten, wat er mis is, en een **voorstel voor de vaste set** per soort
- `../offerte/OFFERTE-MODULE.md`: de basis (regels, btw, totalen, nummering)

## Stap 0: breng eerst de bestaande app in kaart (bouw nog niets)
1. Welke documentsoorten zitten er al in het offerte- en factuurprogramma? Hoe werken daar de nummering, de PDF en het versturen per e-mail?
2. Is er al een plek voor bedrijfsinstellingen (IBAN, e-mail, telefoon, KvK, btw-nummer, betaaltermijn, logo, algemene voorwaarden)?
3. Is er al een koppeling tussen een offerte en zijn facturen?

Maak daarna een **koppeltabel** (HERO-type → bestaand onderdeel of "nieuw") en een **bouwplan**, en leg die voor aan Ricardo.

---

## 1. Welke soorten (voorstel, [KEUZE] = beslist Ricardo)

| Soort in toptuinen.app | Komt uit HERO | Voorstel |
|---|---|---|
| Offerte (variant **aanleg** en **onderhoud**) | Offerte-aanleg, Offerte-onderhoud, Jaarlijkse offerte | Houden. Jaarlijkse offerte wordt de variant onderhoud [KEUZE] |
| Orderbevestiging | Orderbevestiging | Houden |
| Termijnfactuur (aanbetaling / termijn) | Aanbetaling + het losse artikel "Termijnbetaling conform offerte …" | **Nieuw, en automatisch** (zie §3) |
| Factuur (aanleg / onderhoud) | Factuur - Aanleg, Factuur - Onderhoud | Houden |
| Eindfactuur | "Laatste factuur" | Houden, met de eerdere termijnen eraf (zie §3) |
| Btw verlegd | Factuur BTW-verlegd | **Een optie op de factuur**, geen eigen soort. De verplichte tekst komt er dan automatisch in en het btw-nummer van de klant is verplicht. |
| Creditfactuur | Creditfactuur | Houden, altijd vanuit een bestaande factuur |
| Herinnering | 1e Herinnering | Houden, altijd vanuit een factuur die over de vervaldatum is. Onderwerp "Herinnering nr." (nu "Mahnung Nr.") |
| Bestelformulier (aan de leverancier) | Bestelformulier | Houden [KEUZE: bestellen of een prijs aanvragen] |
| Leveringsbon | Leveringsbon | Houden |
| Meetdocument | Meetdocument | Houden [KEUZE: wordt het gebruikt?] |
| Brief | Brief, Algemeen | Samenvoegen tot één "Brief" |
| Bouwplaatsrapport / Werkrapport | Bouwplaatsrapport, Werkrapport (inactief) | Later, als werkbon vanuit de planning en de medewerker-app. Daar zijn datum, locatie, team en uren al bekend. |
| Calculatie | Calculatie | Laten vallen. Wat er in de offerte aan marge en uren zit, is intern al zichtbaar. |

**Eén opmaak voor alles.** In HERO zijn 4 soorten Klassiek/Arial en de rest Modern/Calibri. In toptuinen.app krijgen alle documenten dezelfde huisstijl.

## 2. Vaste teksten: hoe het moet werken
- **Eén tekstbibliotheek.** Per soort (en variant) is er één standaard **inleiding** en één standaard **afsluiting**. Die komen er automatisch in te staan bij een nieuw document.
- **Bewerken per document mag**, maar de bron blijft centraal. Een wijziging in de bibliotheek geldt alleen voor nieuwe documenten.
- **Momentopname bij afronden.** Zodra een document is afgerond of verstuurd, ligt de tekst met de ingevulde placeholders vast. Past iemand later de bibliotheek aan, dan verandert een verstuurd document niet.
- **Niets getypt wat in de instellingen hoort.** IBAN, e-mail, telefoon, betaaltermijn, geldigheid van de offerte en het termijnschema komen uit placeholders (zie `standaardteksten.md`, deel A). Zo hoef je bij een nieuw rekeningnummer maar één plek aan te passen.
- **Een lege placeholder houdt het afronden tegen.** Daarmee voorkom je een PDF met "Totaalbedrag: €" of "Btw-nummer: (leeg)". De gebruiker ziet precies welk veld ontbreekt.
- **Algemene voorwaarden** gaan automatisch als bijlage mee met een offerte. Anders klopt de zin "als bijlage meegestuurd" niet.

## 3. De factuurketen (offerte → termijnen → eindfactuur)
- **Een termijnschema per offerte.**
  - Bij aanleg is de standaard **50% na gunning · 30% bij de start · 20% bij oplevering**.
  - Bij onderhoud is er geen schema (direct factureren).
  - Het schema is per offerte aan te passen, en de offertetekst toont het schema zoals het is ingesteld (`{{Offerte.termijnschema}}`).
- **Een termijnfactuur maken** is één klik vanuit de offerte: "Factureer termijn 1". De factuur verwijst naar de offerte (in HERO heet dat een vervolgdocument).
  - Er komt één regel **per btw-tarief**, bijvoorbeeld "Termijn 1 – 50% van offerte 01399 (21% btw)" en "… (9% btw)".
  - Dat vervangt het artikel "Termijnbetaling conform offerte …" dat nu met de hand wordt gebruikt.
- **De eindfactuur** toont:
  - alle posten van de offerte (plus eventueel meerwerk)
  - min de eerder gefactureerde termijnen, per btw-tarief
  - het resterende bedrag
- **Btw-afronding:** als je de btw per termijnfactuur afrondt, kan het totaal **1 cent** afwijken van de offerte (zie de acceptatietest). Advies: de eindfactuur rekent de btw per tarief uit als *de btw over het hele offertebedrag min de btw die al gefactureerd is*. De som van alle termijnen is dan precies het offertebedrag. Laat de boekhouder deze aanpak één keer bevestigen.
- **Een overzicht per offerte:** gefactureerd X van Y, betaald, openstaand, en de herinneringen.
- **Creditfactuur:** altijd vanuit een factuur. Negatieve bedragen, met een verwijzing naar het origineel, in de factuurreeks.
- **Herinnering:** vanuit een factuur die over de vervaldatum is. De verwijzingen (factuurnummer, datum, bedrag en vervaldatum) staan er automatisch in.

## 4. Regels die ervoor zorgen dat een document "altijd klopt"
| Regel | Waarom |
|---|---|
| Een factuur met **btw verlegd** kun je pas afronden als er een btw-nummer van de klant is; de vermelding "Btw verlegd" staat er dan automatisch in | In HERO hangt die tekst nu niet aan het type |
| Een klant die een **bedrijf in een ander EU-land** is (met een btw-nummer) → de app voegt automatisch de wettelijke vermelding toe, die de boekhouder één keer vaststelt | Nu is dat een getypte tekst met het btw-nummer van één klant |
| Verplichte factuurgegevens (nummer, datum, gegevens van leverancier en klant, btw-nummer en KvK van het bedrijf, omschrijving, bedragen en btw per tarief) worden gecontroleerd bij het afronden | Geen factuur die niet voldoet. Laat de boekhouder de lijst bevestigen. |
| Lege placeholders houden het afronden tegen | Geen PDF met lege velden |
| De nummering gaat verder waar HERO stopt. Het startnummer per reeks is een instelling (`<STARTNUMMER_OFFERTE>`, `<STARTNUMMER_FACTUUR>`); de reeks Factuur geldt voor alle facturen inclusief creditfacturen, net als nu | Geen dubbele of ontbrekende nummers (zie `../offerte/OFFERTE-MODULE.md`) |

## 5. Projectstatus en planning
In HERO zet het aanmaken van een document het project automatisch een stap verder. Advies voor toptuinen.app:

| Gebeurtenis | Projectstatus | Gevolg |
|---|---|---|
| Offerte verstuurd | Offerte | – |
| Offerte geaccepteerd / orderbevestiging | **Aangenomen** | Er komt een **klus in het opdrachtenbakje** (zie `../planning/PLANNING-MODULE.md`) |
| Eerste termijnfactuur | Start uitvoering | – |
| Eindfactuur | Factuur | – |
| Volledig betaald | Afgesloten | – |

## MVP
**MUST**
- Offerte (aanleg en onderhoud), factuur (aanleg en onderhoud), termijnfactuur, eindfactuur, creditfactuur, herinnering
- Tekstbibliotheek met de vastgestelde set uit `standaardteksten.md`, deel C
- Placeholders uit de bedrijfsinstellingen
- Momentopname bij afronden; een lege placeholder houdt het afronden tegen
- De optie btw verlegd met de verplichte tekst en het verplichte btw-nummer
- Termijnschema per offerte en een overzicht "gefactureerd X van Y"

**SHOULD**
- Orderbevestiging, bestelformulier, leveringsbon, brief, meetdocument
- Algemene voorwaarden automatisch als bijlage
- De vermelding voor een EU-klant

**WON'T (nu niet)**
- Calculatie als document
- Bouwplaatsrapport en werkrapport (die komen later via de planning en de app)
- GAEB, UGL en XRechnung

## Acceptatietests
1. **Termijnen met gemengde btw** (offerte 01399 uit `../offerte/hero-datamodel.json`, netto 21%: 24.027,10 en 9%: 672,00):
   | Factuur | Netto 21% | Netto 9% | Btw | Bruto |
   |---|---|---|---|---|
   | Termijn 1 (50%) | 12.013,55 | 336,00 | 2.553,09 | 14.902,64 |
   | Termijn 2 (30%) | 7.208,13 | 201,60 | 1.531,85 | 8.941,58 |
   | Eindfactuur (rest) | 4.805,42 | 134,40 | **1.021,23** (niet 1.021,24) | 5.961,05 |
   | **Som** | | | **5.106,17** | **29.805,27** = de offerte |
2. Een factuur met btw verlegd zonder btw-nummer van de klant kun je niet afronden; de melding zegt welk veld ontbreekt.
3. Een standaardtekst met `{{Company.iban}}` terwijl het IBAN leeg is in de instellingen → het afronden wordt tegengehouden.
4. Je past de standaard factuurafsluiting aan nadat factuur A verstuurd is → de PDF van factuur A blijft hetzelfde.
5. Een herinnering vanuit een factuur die over de vervaldatum is, bevat het juiste factuurnummer, de datum, het bedrag en de vervaldatum.
6. Een creditfactuur vanuit factuur B krijgt het volgende nummer in de factuurreeks en verwijst naar B.

## Nog open (Ricardo beslist)
1. De keuzes K1 t/m K10 in `standaardteksten.md` (geldigheid, betaaltermijn, aanhef, u/je, ondertekening, IBAN-mededeling, AV, termijnen, bestelformulier, welke inleiding).
2. Wordt "Jaarlijkse offerte" een variant van onderhoud, of blijft het een eigen soort?
3. Wordt het meetdocument gebruikt?
4. Zijn er klanten in België of andere EU-landen? Dan moet de boekhouder de vermelding vaststellen.
5. Wie mag documenten afronden en versturen?
