# HERO-nabouw: besluiten en stand

Wat Ricardo besloten heeft op basis van de stukken in deze map. Bij strijd met een
`*-MODULE.md` gaat dit bestand voor. Bijwerken zodra er iets verandert.

## Antwoorden van de klant (21-10-2026, via sales)

| Vraag | Antwoord |
|---|---|
| Blijft HERO in de overgang facturen/boekhouding doen? | **Nee.** Zoveel mogelijk data uit HERO importeren, zodat ze direct in toptuinen.app verder kunnen. Boekhoudpakket nog onbekend (waarschijnlijk Exact). |
| Nummering | **Doorlopen vanuit HERO** (offerte `01399` → `01400`, factuur `FACT01129` → `FACT01130`). |
| Klanten buiten NL? | Waarschijnlijk **België en Duitsland** → verplichte vermelding voor EU-klanten (btw verlegd / intracommunautair) is MUST, niet SHOULD. |
| Btw-restmethode eindfactuur bevestigd door boekhouder? | Nog niet. Bouwen volgens het advies, bevestiging vragen. |
| Planbord op welk apparaat? | Vooral **laptop**, maar **tablet moet goed werken** (aanraken: slepen/vergroten met touch). |
| Wie mag documenten afronden en versturen? | **Directie en kantoor** (`requireKantoor` / `assertKanNaarKlantVersturen`). |
| Jaarlijkse offerte | Wordt een **variant van onderhoud**. |
| Meetdocument | Onbekend → niet bouwen tot er vraag naar is. |
| Standaardteksten | **De klant moet ze zelf in de app kunnen aanpassen.** Set C uit `documenten/standaardteksten.md` is de startinhoud. |

## Besluiten

1. **Gaten vullen, niet nabouwen.** De app heeft al: vrije builder met btw per regel,
   facturen met deelfacturen/creditnota/herinneringsladder, weekbord met teams als rijen,
   `teamBemanning` (dagbezetting), opdrachtenbak, verlofaanvragen, Expo-app.
2. **Rekenen:** btw per tarief afronden, gelijk aan HERO en aan `facturatieLogica`
   (`berekenBtwPerTarief` in `convex/vrijeOfferteBerekening.ts`). Acceptatietest:
   `src/__tests__/unit/convex/hero-fixture-01399.test.ts`.
3. **Marge-semantiek blijft zoals de PRD** (marge op verkoopprijs in de vrije builder).
   Opgeslagen worden inkoop- en verkoopprijs; de HERO-opslag wordt bij import niet
   bewaard maar volgt uit die twee. Aanpassen alleen als de klant erom vraagt.
4. **Nummering:** formaat "doorlopend" of "jaar" per reeks, instelbaar voorvoegsel en
   volgend nummer (Instellingen → Nummering, alleen directie, kan nooit terug).
   Creditnota's delen de factuurteller. → `convex/lib/documentNummer.ts`.
   Het nummer wordt nog bij het aanmaken uitgegeven, niet pas bij afronden (zie open punten).
5. **Teksten:** platte tekst met eenvoudige opsommingen, geen opmaakeditor. Placeholders
   in de bestaande `{{…}}`-notatie van de mailtriggers.
6. **Planbord:** verder op @dnd-kit, geen FullCalendar.

## Fasering

| Fase | Inhoud | Stand |
|---|---|---|
| 0 | Docs in de repo, koppeltabel, besluiten | klaar |
| 1 | Rekentest 01399, btw per tarief, nummerreeksen + startnummer | klaar |
| 1b | Begrote manuren in de vrije builder; "opslaan in prijsboek" voor losse regels | open |
| 2 | Tekstbibliotheek per documentsoort: inleiding/afsluiting, placeholders, momentopname bij versturen, lege placeholder blokkeert, bewerkscherm voor de klant | open |
| 3 | Factuurketen: termijnschema per offerte, termijnfactuur per btw-tarief, eindfactuur met restmethode, btw verlegd + EU-vermelding, verplichte gegevens | open |
| 4 | Planbord op tijdas: 15-min stap, vergroten aan twee kanten, begroot/gepland/resterend, verlof op het bord, standaardblok reistijd, undo, touch | open |
| 5 | HERO-import: klanten, projecten, open offertes, facturen/openstaande posten, herbruikbare artikelen (>5x gebruikt) | wacht op exportbestanden uit HERO |
| 6 | SHOULD: versies, sjablonen, posten kopiëren, orderbevestiging, bestelformulier, leveringsbon | later |

## Open punten

- Factuurnummer wordt nu bij het **aanmaken van het concept** uitgegeven. Een verwijderd
  concept laat dan een gat in de reeks. Voor facturen moet het nummer pas bij definitief
  maken komen (fase 3).
- Welke export levert HERO (CSV/XLSX per onderdeel)? Nodig voor fase 5.
- Boekhoudpakket bevestigen (Exact?) voordat de koppeling gebouwd wordt.
- EU-vermelding en btw-restmethode laten vaststellen door de boekhouder.
