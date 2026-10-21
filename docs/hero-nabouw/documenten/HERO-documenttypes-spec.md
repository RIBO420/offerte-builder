# HERO documenttypes en "Document maken": reverse engineering (Top Tuinen)

> **Uitgangspunten:** zie `../README.md`. toptuinen.app bestaat al en staat gedeeltelijk (onder andere een offerte- en factuurprogramma); de huidige stack van toptuinen.app is leidend; Ricardo beslist alles. Dit bestand beschrijft alleen wat er in HERO te zien was.

- **Datum:** 20-10-2026
- **Bron:**
  - de knop Nieuw → Document
  - Documenten → Configurator, alle 18 types (alleen gelezen)
  - Documenten → Teksten & Titel
- **Methode:** de dialoog geopend en zonder iets aan te maken weer gesloten. De instellingen per type uitgelezen van de pagina van elk type.
- **Zekerheid:** hoog voor de instellingen en de teksten. Hoe een aanbetaling of eindfactuur precies wordt opgebouwd, heb ik niet zelf doorlopen (dat maakt een echt document aan); dat komt uit de code van de editor en de uitleg in de dialoog.

---

## 1. Dialoog "Document maken"

| Veld | Opties |
|---|---|
| Project / Contactpersoon | zoeken, met een `+` om er een nieuw aan te maken |
| Type | 14 types (zie §2; Creditfactuur, Calculatie en 1e Herinnering staan er niet bij, die ontstaan uit een ander document) |
| De posten overnemen | **Geen postenoverdracht** (een leeg document) · **Posten overnemen (zonder referentie)** · **Maken als vervolgdocument** |

**Uitleg in HERO, kort samengevat:**

- **Posten overnemen (zonder referentie):** kopieert de posten uit een of meer documenten. De brondocumenten worden niet gekoppeld. Voor (deel)facturen raadt HERO dit af.
- **Maken als vervolgdocument:** de brondocumenten worden wél gekoppeld. Zo ziet de klant naar welk document je verwijst, en worden eerdere deelfacturen correct meegenomen.

## 2. De 18 documenttypes

| Type | Basistype | Map | Nummerreeks | Project naar stap (na aanmaken) | Opmaak | Standaard inleiding | Standaard afsluiting | Voorvoegsel onderwerp | Boeking | Actief |
|---|---|---|---|---|---|---|---|---|---|---|
| Offerte-aanleg | Offerte | Offerte | Offerte | Contracttoekenning | Modern / Calibri | Offerte- Inleiding Top Tuinen | Offerte - Afsluiting Top Tuinen | Offerte nr. | nee | ✓ |
| Offerte-onderhoud | **Reparatieopdracht** | Offerte | Offerte | Contracttoekenning | Modern / Calibri | Offerte- Inleiding Top Tuinen | Offerte - Afsluiting … - Onderhoud | Offerte nr. | nee | ✓ |
| Jaarlijkse offerte | Offerte | **Algemeen** | Offerte | (geen) | **Klassiek / Arial** | **geen** | **geen** | Offerte Nr. | nee | ✓ |
| Orderbevestiging | Opdrachtbevestiging | Orderbevestiging | eigen (OB) | Opdrachtbevestiging | Modern / Calibri | Orderbevestiging - Inleiding | Orderbevestiging - Afsluiting | Bestelbevestiging nr. | nee | ✓ |
| Aanbetaling | Factuur | Facturen | **Factuur** | Klant factuur (deelfactuur: Start uitvoering) | **Klassiek / Arial** | **geen** | **geen** | – | ja | ✓ |
| Factuur - Aanleg | Factuur | Facturen | Factuur | Klant factuur (deelfactuur: Start uitvoering) | Modern / Calibri | Factuur - Inleiding | Factuur - Afsluiting | – | ja | ✓ |
| Factuur - Onderhoud | Factuur | Facturen | Factuur | Klant factuur (deelfactuur: Start uitvoering) | **Klassiek / Arial** | Factuur - Onderhoud - Inleiding | Factuur - Afsluiting | – | ja | ✓ |
| Factuur BTW-verlegd | Factuur | Facturen | Factuur | Klant factuur (deelfactuur: Start uitvoering) | **Klassiek / Arial** | **geen** | **geen** ⚠️ | – | ja | ✓ |
| Creditfactuur | Creditnota | Facturen | Factuur | (geen) | Modern / Calibri | Inleiding tot creditfactuur | geen | Credit factuur nr. | ja | ✓ |
| 1e Herinnering | Herinnering | Herinnering | eigen (H) | (geen) | Modern / Calibri | geen* | geen* | **"Mahnung Nr."** ⚠️ (Duits) | nee | ✓ |
| Bestelformulier | Bestelformulier | Bestelformulier | eigen (BF) | (geen) | Modern / Calibri | Bestelformulier - Inleiding | geen | Bestelformulier nr. | nee | ✓ |
| Leveringsbon | Leveringsbon | Leveringsbon | eigen (L) | (geen) | Modern / Calibri | Leveringsbon - Inleiding | Leveringsbon - afsluiting | Leveringsbon nr. | nee | ✓ |
| Werkrapport | Leveringsbon | Werkrapport | eigen (W) | (geen) | Modern / Calibri | Werkrapport - Inleiding | Werkrapport - afsluiting | Werkrapport nr. | nee | **inactief** |
| Bouwplaatsrapport | Bouwplaatsrapport | Bouwplaatsrapport | eigen (BR) | Start van de implementatie | Modern / Calibri | Bouwplaatsrapport Top Tuinen | geen | Bouwplaatsrapport nr. | nee | ✓ |
| Meetdocument | Afmetingen | Meetdocument | eigen (M) | (geen) | Modern / Calibri | Meting - inleiding | Meting - Afsluiting | Meting nr. | nee | ✓ |
| Calculatie | Calculatie | Calculatie | eigen (C) | – | Modern / Calibri | Offerte- Inleiding | Offerte - Afsluiting | – | – | – |
| Brief | Brief | "Briefe" (Duits) | eigen (B) | (geen) | Modern / Calibri | Introductie - generiek | geen | Brief-Nr. | nee | ✓ |
| Algemeen | Algemeen | Algemeen | eigen (A) | (geen) | Modern / Calibri | geen | geen | Algemeen Nr. | nee | ✓ |

\* De teksten "Herinnering - Inleiding" en "Herinnering - aflsuiting" bestaan wel, maar hangen niet als standaard aan het type. Mogelijk worden ze via de herinneringsinstellingen in Boekhouding gebruikt; dat heb ik niet gecontroleerd.

**Nummerreeksen:** de reeks "Offerte" wordt gedeeld door 3 types. De reeks "Factuur" wordt gedeeld door 5 types, inclusief de creditfactuur. De standen van de reeksen staan hier bewust niet in; die worden bij livegang ingevuld.

**De projectstap verandert automatisch na het aanmaken:**

| Document | Project gaat naar |
|---|---|
| Offerte | Contracttoekenning |
| Orderbevestiging | Opdrachtbevestiging |
| Deelfactuur of bouwplaatsrapport | Start uitvoering |
| Factuur | Klant factuur |

## 3. Termijnfacturen (afgeleid uit de code en het gebruik)

- **Soorten factuur die HERO in de code kent:**
  - aanbetaling, als vast bedrag of percentage, met een regel als "Aanbetaling 50% van Offerte nr. X"
  - deelfactuur
  - cumulatieve deelfactuur
  - **eindfactuur** ("Laatste factuur" in het overzicht): het totaal min de eerdere termijnen ("abzüglich", "Restsumme", "Summe aller Rechnungen")
- Er is een **overzicht van facturen en betalingen** per offerte, met de melding "berekend X van Y".
- **Hoe Top Tuinen het in de praktijk doet:** in de artikellijst staat een artikel "Termijnbetaling conform offerte 00736" (€ 277,25, "11/12"), dat **11x** gebruikt is. Termijnen worden dus deels met de hand gemaakt via een artikel, in plaats van via de vervolgdocument-functie.
- **De betalingscondities in de offertetekst:** 50% aanbetaling na gunning, 30% bij de start, 20% bij oplevering.

## 4. Standaardteksten
Alle 27 teksten, met de gevonden fouten en een voorstel voor een vaste set, staan in `standaardteksten.md`.
