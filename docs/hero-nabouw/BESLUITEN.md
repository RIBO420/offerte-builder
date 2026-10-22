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
7. **Teksten (fase 2):** `tekstblokken.aanhef` = Inleiding, `voorwaarden` = Afsluiting
   (alleen nieuwe labels, geen datamigratie). Per documentsoort één standaard.
   Placeholders in `convex/lib/documentTekst.ts` (`{{klant.naam}}`, `{{bedrijf.iban}}`,
   …); oude `{{klant_naam}}` blijft als alias werken. Startset = deel C van
   `standaardteksten.md`, te laden met "Standaardteksten laden" (voegt alleen toe).
   Momentopname: offerte bij `verzonden`, factuur bij `definitief`/versturen,
   creditfactuur bij aanmaken. Lege of onbekende placeholder blokkeert; de
   facturatie-engine verstuurt dan niet automatisch maar laat een concept staan.
   Termijnen (geldigheid offerte, betaaltermijn) staan onder Instellingen →
   Nummering & termijnen.

8. **Factuurketen (fase 3):** het termijnschema hoort bij de offerte (aanleg:
   eerste sjabloon uit Instellingen → Deelfacturen, anders 50/30/20; onderhoud geen).
   Na acceptatie maakt het blok Facturatie op de offerte termijn 1, 2, … als
   concept; de laatste termijn is de eindfactuur (hele offerte min eerdere termijnen,
   btw restmethode). Zonder schema één factuur. Factureren vraagt een project (daar
   staat de factuurpagina; meerdere facturen per project via `?factuur=`).
   Eindfactuur pas als de termijnen definitief zijn. → `convex/factuurKeten.ts`,
   `convex/lib/termijnFacturatie.ts`.
9. **Factuurnummer pas bij definitief** (of direct versturen); een concept heet
   "Concept". Creditnota's krijgen hun nummer bij aanmaken (meteen definitief).
10. **Btw verlegd** is een keuze op de conceptfactuur: Nederland of EU-bedrijf. Btw 0,
    vermelding uit Instellingen → Nummering & termijnen, btw-nummer klant verplicht.
    Geen landveld op de klant: kantoor kiest per factuur.
11. **Verplichte gegevens** bij definitief/versturen: naam, adres, KvK- en btw-nummer
    van het bedrijf; naam en adres van de klant; minimaal één regel. De
    facturatie-engine verstuurt anders niet automatisch.

12. **Tijdbord (fase 4)** is een nieuwe weergave naast het weekbord
    (`/planning/tijdbord`), tot Top Tuinen hem goedkeurt. Datamodel ongewijzigd: een klus
    heeft een datumbereik en één dagvenster (bv. ma–wo, elke dag 08:00–16:00), zodat
    dagkaart en medewerker-app blijven werken. Rand trekken binnen de dag = tijd, naar
    een andere dag = dagen erbij/eraf. Een klus met per dag andere tijden = splitsen
    (weekbord). Uit de bak plant het bord meteen alle begrote uren (zoveel werkdagen als
    nodig) in plaats van een restant in de bak te laten. Stap 15 min; als een kwartier
    smaller wordt dan ~2,5 px (2 weken, of week op een tablet) 1 uur. Werkdag en uren per
    dag: Instellingen → Planning. Verlof: aanvraag = gestreept + waarschuwing,
    goedgekeurd/ziek = telt niet mee in de bemanning en `setBemanning` weigert; reden
    alleen voor kantoor. Undo/redo per sessie in de browser.
    SHOULD's ook gebouwd: shift/ctrl-klik = meerdere blokken (samen slepen of met
    pijltjes), alt-slepen = kopie, rechtsklik of "Acties" = slecht weer → volgende
    werkdag / kopie volgende werkdag / verdeel over losse dagen / terug naar de bak,
    klik op een lege plek = klus uit de bak hier plannen, capaciteit per team-dag,
    gewerkte uren en bezig/klaar uit de app op het blok, verlof goedkeuren/afwijzen
    vanaf het bord met de gevolgen in beeld. Meldingen naar de medewerker-app: bij een
    wijziging die vandaag/morgen raakt, gebundeld na 2 minuten, in-app + push (achter
    de guard); ook bij een verlofbesluit. Splitsen verdeelt nu ook de begrote uren.

13. **Fase 6.**
    - Offertelink: een klant zonder portaal kreeg sinds maart een dode link. Nu krijgt
      elke offerte bij versturen een deeltoken; `/offerte/<token>` is een
      alleen-lezen pagina met PDF-download en de algemene voorwaarden. Akkoord gaat per
      e-mail (zoals de offertetekst vraagt) of via het portaal.
    - Algemene voorwaarden gaan automatisch als bijlage mee met de offertemail (K7).
    - Versies bewaren de volledige vrije regel, teksten, korting, termijnschema en
      uren. Terugzetten kan alleen in concept/voorcalculatie en wijzigt de status niet.
    - Sjabloon uit een vrije offerte bewaart de regels. "Posten overnemen" in de vrije
      builder haalt regels uit een sjabloon of eerdere offerte (optie: hoeveelheden 0).
    - Orderbevestiging (geaccepteerde offerte), bestelformulier (inkooporder) en
      leveringsbon (project, materiaal zonder prijzen) als PDF, met eigen vaste teksten
      in de bibliotheek. Bestelformulier heeft "bestellen" als standaard en
      "prijsaanvraag" als extra tekst (K9). Geen eigen nummerreeks: ze dragen het
      offerte-/ordernummer. Meetdocument en brief niet gebouwd (geen vraag).

14. **Artikelen uit HERO (fase 5, 22-10-2026).** Alle artikelen uit de HERO-export gaan
    het prijsboek in, **allemaal actief**, met `heroArtikelnummer` als herkenning bij een
    tweede import. Verkoopprijs = prijslijst **Standaardmarge** (IP × 1,40; in onze
    marge-semantiek 28,6%); zonder inkoopprijs is VK1 de vaste prijs, die nu ook op de
    offerteregel komt. **Categorie** volgt uit naam/beschrijving (`convex/lib/heroCategorie.ts`:
    afvoer, arbeid, gazon, beplanting, bestrating …); een door kantoor gekozen categorie
    blijft bij een volgende import staan. HTML-entiteiten uit de export worden gewone tekens.
    De 33 oude voorbeeldartikelen staan uit (`zetEigenArtikelenUit`): de scope-calculator
    zoekt daardoor geen materiaalprijzen meer en laat die regels weg, en negeert
    HERO-artikelen bij het zoeken op naam. → `convex/lib/heroArtikelen.ts`,
    `convex/heroArtikelImport.ts`, `scripts/hero-artikelen-import.mjs`. Prijslijst
    "Romeo Savelberg" (IP × 1,67) niet overgenomen.

## Fasering

| Fase | Inhoud | Stand |
|---|---|---|
| 0 | Docs in de repo, koppeltabel, besluiten | klaar |
| 1 | Rekentest 01399, btw per tarief, nummerreeksen + startnummer | klaar |
| 1b | Begrote manuren in de vrije builder; "opslaan in prijsboek" voor losse regels | klaar |
| 2 | Tekstbibliotheek per documentsoort: inleiding/afsluiting, placeholders, momentopname bij versturen, lege placeholder blokkeert, bewerkscherm voor de klant | klaar |
| 3 | Factuurketen: termijnschema per offerte, termijnfactuur per btw-tarief, eindfactuur met restmethode, btw verlegd + EU-vermelding, verplichte gegevens | klaar |
| 4 | Planbord op tijdas: 15-min stap, vergroten aan twee kanten, begroot/gepland/resterend, verlof op het bord, standaardblok reistijd, undo, touch | klaar incl. SHOULD's (Planning → Tijdbord) |
| 5 | HERO-import: klanten, projecten, open offertes, facturen/openstaande posten, herbruikbare artikelen (>5x gebruikt) | wacht op exportbestanden uit HERO |
| 6 | SHOULD: versies, sjablonen, posten kopiëren, orderbevestiging, bestelformulier, leveringsbon | klaar |

## Open punten


- Bij livegang: KvK- en btw-nummer van Top Tuinen moeten in de bedrijfsgegevens
  staan, anders kan geen factuur meer definitief.
- Btw-restmethode en de twee btw-verlegd-vermeldingen laten bevestigen door de
  boekhouder.
- Bij de livegang op productie: "Standaardteksten laden" één keer klikken en de
  bedrijfsgegevens (IBAN, e-mail, telefoon) compleet maken, anders blokkeren de
  teksten het versturen.

- Welke export levert HERO (CSV/XLSX per onderdeel)? Nodig voor fase 5.
- Boekhoudpakket bevestigen (Exact?) voordat de koppeling gebouwd wordt.
- EU-vermelding en btw-restmethode laten vaststellen door de boekhouder.
