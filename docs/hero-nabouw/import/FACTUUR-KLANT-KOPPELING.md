# Facturen automatisch aan de juiste klant koppelen (onderzoek 22 okt 2026)

Vraag van Ricardo: "kun je kijken of je de facturen automatisch bij de juiste
klanten kunt zetten?" Uitkomst van het onderzoek, plus het prototype dat er al
ligt. Input voor fase 5 (HERO-import), geen besluit.

## Stand nu

- **Facturen die in de app ontstaan kloppen al.** Elke route zet zelf de
  `klantId`: via project, offerte, werkitem of contract, of handmatig in de
  editor. In dev (affable-rook-669) stonden alle 19 facturen bij de juiste
  klant: geen ontbrekende of verweesde `klantId`, naam/offerte/project
  consistent, alles binnen dezelfde org (2 projectfacturen, 16 handmatig,
  1 uit de facturatie-engine). Prod is niet bekeken.
- **Het gat is de HERO-import (fase 5).** Facturen uit HERO komen binnen met
  alleen een klantblok als tekst (naam, adres, e-mail, soms een relatie- of
  KvK-nummer). Een factuur-import bestaat nog niet; die wacht op de exports.
- **Inkoop-/leveranciersfacturen** zijn geen eigen tabel: alleen een
  `factuurNummer` bij `projectKosten`, en via het project hangen ze al aan de
  klant. Daar valt niets te koppelen.

## Welke signalen betrouwbaar zijn (gemeten op 311 dev-klanten)

| Signaal | Betrouwbaar? | Waarom |
|---|---|---|
| Klant-/relatienummer | **Ja, sterkst** | 270 klanten hebben er een (HERO-relatienummer), geen dubbelen — mits de HERO-factuurexport het meelevert |
| Offerte of project op de factuur | Ja | wijst de klant direct aan |
| KvK / btw-nummer | Later | in dev bij 0 klanten ingevuld; IBAN staat niet in het schema |
| E-mail alleen | Nee | 6 mailboxen worden door meerdere klanten gedeeld (bv. twee VvE's op één domein) |
| Adres alleen | Nee | 11 paren klanten delen postcode + huisnummer (bv. bedrijf en eigenaar) |

## De matchregel

Prototype: `convex/lib/factuurKlantMatch.ts` (`matchFactuurKlant`), tests in
`src/__tests__/unit/convex/factuur-klant-match.test.ts` (19). Alleen klanten
uit dezelfde `orgId`; geanonimiseerde klanten tellen niet mee.

| Niveau | Wanneer | Wat de import doet |
|---|---|---|
| **Zeker** | offerte/project wijst de klant aan · klantnummer gelijk en naam niet duidelijk anders · KvK gelijk · btw-nummer gelijk · naam + postcode en huisnummer gelijk · naam + e-mail gelijk | `klantId` meteen zetten |
| **Waarschijnlijk** | klantnummer gelijk maar naam anders · adres of postcode gelijk en naam lijkt · e-mail gelijk · naam gelijk | opslaan zonder klant, kandidaten erbij, iemand bevestigt |
| **Geen** | niets bruikbaars | op de lijst "nog te koppelen" |

- Twee klanten allebei "zeker", of offerte en project wijzen een andere klant
  aan → wordt een voorstel, nooit automatisch.
- "Naam lijkt" vangt omgedraaide volgorde, voorletters, aanhef, rechtsvorm en
  één tikfout op.

**Proefdraai op dev (alleen lezen)**, met alleen het klantblok van elke factuur
alsof die uit HERO kwam: 18 van 19 zeker en goed; de laatste werd een voorstel
met de juiste klant erin (door een dubbele demoklant). Elke klant tegen zichzelf:
303 zeker en goed, 8 voorstellen. In geen van beide proeven een klant als
"zeker" bij de verkeerde factuur.

## Voorgestelde aanpak

1. In de HERO-factuurimport per rij `matchFactuurKlant` aanroepen met de
   klanten van de org. Zeker → `klantId` zetten; anders opslaan zonder klant
   met de kandidaten erbij.
2. Bevestigen in een blok **"Nog te koppelen"** bovenaan `/facturen`
   (`SectiePaneel` + `ResponsiveTable`): per factuur de redenen en kandidaten,
   knoppen "Koppelen", "Andere klant", "Nieuwe klant", en "Alle zekere
   koppelen".
3. **Vraag HERO om het relatie-/debiteurnummer in de factuurexport.** Zonder
   dat nummer leunt alles op naam en adres.

## Risico's

- Een fout als "zeker" gekoppelde factuur valt niemand op. Advies: bij de
  eerste import ook "zeker" als voorstel tonen en pas daarna automatisch
  koppelen.
- Het huisnummer wordt uit de adresregel gelezen (eerste getal); een
  straatnaam met een getal erin gaat dan mis.
- Bij duizenden facturen: een index op klantnummer gebruiken in plaats van per
  rij alle klanten te doorlopen.
