# Offertemodule voor toptuinen.app

> **Uitgangspunten** (zie ook `../README.md`):
> 1. toptuinen.app bestaat al en staat gedeeltelijk. Er is mogelijk al een **offerteprogramma** of een **factuurprogramma** waarin een deel hiervan zit. Kijk eerst wat er is en breid dat uit. Bouw niets dubbel.
> 2. De **huidige stack van toptuinen.app is leidend**. Botst iets in dit document met de stack of met hoe de app nu werkt, dan gaat de app voor.
> 3. **Ricardo beslist alles** en pakt dit vanaf nu op. Dit document beschrijft wat het moet doen en waarom; alles wat als advies, voorstel of [KEUZE] staat, beslist Ricardo.

## Wat
Bouw een offertemodule in de bestaande app **toptuinen.app**. De module volgt de offerte-editor van HERO Software, maar alleen het deel dat Top Tuinen echt gebruikt. Het doel: offertes niet meer in HERO maken, maar in de eigen app.

## Lees eerst
- `HERO-offerte-spec.md` (in deze map): de volledige reverse engineering (schermen, functies, rekenregels, MVP-scope)
- `hero-datamodel.json` (in deze map): het datamodel van HERO als voorbeeld, plus een echte offerte als testcase (`fixture_01399`)

## Stap 0: breng eerst de bestaande app in kaart (bouw nog niets)
Zoek dit uit en rapporteer het:
1. Wat er al zit in het **offerteprogramma** en het **factuurprogramma** van toptuinen.app, en wat daarvan overeenkomt met dit document.
2. Stack, mappenstructuur, database/ORM, auth, en of en hoe de app al PDF's maakt.
3. Welke entiteiten er al zijn en hoe ze heten: klanten/contacten, adressen, projecten, medewerkers, uren, tarieven of klanttarieven, facturen, bedrijfsgegevens en logo.
4. Welke UI-onderdelen er al zijn: tabellen, pop-ups, een editor voor opgemaakte tekst, formulieren.

Maak daarna:
- een **koppeltabel**: HERO-begrip (spec §5) → bestaande entiteit in de app, of "nieuw"
- een **bouwplan in kleine stappen**, te beginnen met de rekentest

Leg beide voor aan Ricardo voordat je gaat bouwen.

## Uitgangspunten
- Bouw de **MUST-lijst** in §8 van de spec eerst. Geen GAEB, UGL, IDS en geen 123 opmaakopties.
- **Gebruik wat er al is.** Gebruik de bestaande klanten en projecten; bouw er geen eigen versie van. Leg bij het afronden een **momentopname** van de klantgegevens vast in de offerte (in HERO heet dat `receiver`), zodat een oude offerte niet verandert als de klant later verandert.
- Kent de app al klanttarieven of een tarievenkaart? Dan **is dat de prijslijst**, zoals de klantspecifieke prijslijst in HERO. Bouw die niet opnieuw.
- Registreert de app al uren? Dan sluit "uren invoegen" daar later op aan (geen MVP).
- Factureert de app al? Dan is offerte → factuur (termijnen 50/30/20) de volgende stap (geen MVP).
- Een document is een lijst van blokken: `tekst → tabel(regels) → tekst`. Een regel is een **kopie** van de stamdata, geen verwijzing.
- Sla de verkoopprijs per regel op en reken de opslag terug (2 decimalen). Noem het in de interface "opslag", niet "marge".
- Btw per regel (21% of 9%), totalen per tarief, en btw per tarief afronden op 2 decimalen.
- Een concept heeft als nummer `0xxxx`. Het nummer wordt pas bij het afronden toegekend.
- **Nummering gaat verder waar HERO stopt.** Maak het startnummer per nummerreeks (offerte, factuur) een **instelling in de app**, niet hardcoded. De echte startnummers vullen we vlak voor livegang in: offerte `<STARTNUMMER_OFFERTE>`, factuur `<STARTNUMMER_FACTUUR>`. Zo ontstaan er geen dubbele nummers. Formaat in HERO: offertes vijf cijfers met voorloopnullen (bijvoorbeeld `01399`), facturen met voorvoegsel `FACT` (bijvoorbeeld `FACT01129`).
- Losse regels komen niet automatisch in de artikellijst; "opslaan in bibliotheek" is een bewuste keuze.
- **Koppeling met de planning:** een geaccepteerde offerte levert een klus op in het opdrachtenbakje (zie `../planning/PLANNING-MODULE.md`). Daarvoor heeft de offerte een veld **begrote manuren** nodig. In HERO staat bij de regels van Top Tuinen geen tijd (`time_minutes` = 0), dus dat veld moet erbij komen of met de hand worden ingevuld.

## Acceptatietest
De rekenmotor moet `fixture_01399.expected_totals` exact halen:
netto 24.699,10 · btw 5.106,17 (21%: 5.045,69 + 9%: 60,48) · bruto 29.805,27.
Schrijf deze test als eerste.

## Nog open (Ricardo beslist)
1. Blijft HERO tijdens de overgang in gebruik voor facturen en boekhouding? Zo ja: hoe komt een geaccepteerde offerte daar terecht (overtypen, of de UGL-import testen)?
2. Wat moet er uit HERO worden overgezet? Advies: de teksten niet één op één overnemen, maar de **vastgestelde set** uit `../documenten/standaardteksten.md` gebruiken. Van de 910 artikelen alleen de herbruikbare (bijvoorbeeld die vaker dan 5x gebruikt zijn).
3. Moet de PDF eruitzien als de huidige HERO-offerte, of krijgt hij meteen een nieuwe opmaak?
