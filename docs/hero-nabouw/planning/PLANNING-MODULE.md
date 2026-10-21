# Planbord voor toptuinen.app

> **Uitgangspunten** (zie ook `../README.md`):
> 1. toptuinen.app bestaat al en staat gedeeltelijk. Een deel hiervan kan al in het **roosterprogramma** zitten (medewerkers, beschikbaarheid, verlof, uren). Kijk eerst wat er is en vul daarna aan.
> 2. De **huidige stack van toptuinen.app is leidend**. Botst iets in dit document met de stack of met hoe de app nu werkt, dan gaat de app voor.
> 3. **Ricardo beslist alles** en pakt dit vanaf nu op. Dit document beschrijft wat het moet doen en waarom; alles wat als advies, voorstel of [KEUZE] staat, beslist Ricardo.

## Wat
Een planbord waarop de planner in één oogopslag ziet **welk team waar bezig is**, ook als de bezetting van dat team per dag wisselt. Hij plant aangenomen klussen in door ze vanuit een **opdrachtenbakje** naar het bord te slepen. Kaartjes kun je vrij verslepen (horizontaal en verticaal) en per **kwartier** langer of korter maken. Alles is gekoppeld aan de app die de medewerkers gebruiken.

## Lees eerst
- `HERO-planning-spec.md`: hoe HERO het nu doet en hoe Top Tuinen het gebruikt, met de cijfers uit 4 weken hoogseizoen
- `hero-planning-datamodel.json`: het datamodel van HERO als voorbeeld, plus de gebruikscijfers

## Waarom het beter moet (uit de HERO-analyse)
| Probleem in HERO | Oorzaak | Wat het hier moet worden |
|---|---|---|
| Je ziet niet wat een team doet | Een team is alleen een kleur; de rijen zijn medewerkers | Teams zijn rijen; de medewerkers per dag zijn de bezetting van die rij |
| Slepen en vergroten springt per 3 uur (in de weekweergave) of per dag (in de maandweergave) | Er is geen aparte stap ingesteld, dus de stap is de kolombreedte | De stap is altijd **15 minuten** (in de weergave van 2 weken of een maand: 1 uur, zie I-3), los van de kolombreedte |
| Je kunt niet vanuit een lijst naar het bord slepen | `droppable: false` | Een opdrachtenbakje waaruit je naar het bord sleept |
| Een placeholder "NOG IN TE VULLEN" | Er is geen bakje | Het bakje |
| "48 manuur gepland" in de beschrijving | Er zijn geen begrote uren | Begroot, gepland en resterend per klus, en de capaciteit per team per dag |
| De reistijd wordt dagelijks met de hand gekopieerd | Er zijn geen standaardblokken | Standaardblokken per team of per dag |
| Verlof wordt een "Kantoor"-afspraak | Er is geen afwezigheid op het bord | Verlofaanvragen vanuit de medewerker-app staan meteen op het bord: **aangevraagd** als waarschuwing, **goedgekeurd** als blokkade (zie ontwerpbeslissing 3) |
| Een klus van meerdere dagen = een losse afspraak per dag | Een afspraak loopt nooit over meerdere dagen | Eén klus die over meerdere dagen te verdelen is |

---

## Stap 0: breng eerst de bestaande app in kaart (bouw nog niets)
Zoek dit uit en rapporteer het:
1. Wat zit er al in het **roosterprogramma**:
   - medewerkers, teams of groepen
   - werktijden, beschikbaarheid, verlof en ziekte
   - urenregistratie
   - een planning- of kalenderweergave
2. Bestaat er al een **medewerker-app** (of een mobiele weergave)? Hoe komen wijzigingen daar nu terecht: live, door te verversen, of via meldingen?
3. Welke **klant-, project- en offertestatussen** zijn er? Welke status betekent "aangenomen"? Die is de bron voor het bakje.
4. Zit er al een **kalender- of sleepbibliotheek** in de stack?

Maak daarna:
- een **koppeltabel**: begrip uit dit document → bestaand onderdeel van de app, of "nieuw"
- een **bouwplan in kleine stappen**

Leg beide voor aan Ricardo voordat je gaat bouwen.

---

## Ontwerpbeslissing 1: teams

**De vraag:** maak je eerst vaste teams aan ("die dag is dat team A of team B"), of laat je het leeg en koppel je daarna de medewerkers?

| Optie | Hoe | Voordeel | Nadeel |
|---|---|---|---|
| **A. Vaste teams** | Team A = altijd dezelfde 3 man | Simpel | Klopt niet met de praktijk: de bezetting wisselt per dag (zie de spec, §1 punt 4). Bij ziekte moet je alles met de hand bijwerken. |
| **B. Geen teams** | Medewerkers per klus koppelen | Maximaal flexibel | Je ziet niet "wat doet team X". Dat is precies het probleem van nu. |
| **C. Teams als rijen met een dagbezetting** (advies) | Je maakt een team één keer aan (naam, kleur, vaste kern). **Per dag** heeft elk team een bezetting, die vooraf gevuld wordt vanuit de vorige werkdag of de standaard. Een klus plan je op een **team**; de medewerkers volgen vanzelf uit de bezetting van die dag. | Je ziet het team én de mensen. Bij ziekte pas je op één plek de bezetting aan en schuiven alle klussen van die dag mee. | Iets meer logica: een medewerker die één klus bij een ander team doet, heeft een uitzondering per klus nodig. |

**Advies: C.** Dit klopt alleen als de teams een vaste kern hebben met wisselende helpers. De data uit 4 weken hoogseizoen laat precies dat zien: per team één vaste kernpersoon en daarnaast wisselende helpers. Mijn oordeel verandert als blijkt dat teams per klus en niet per dag van samenstelling wisselen. Dan is B met een "groep"-weergave beter.

**Antwoord op de vraag "eerst aanmaken of leeg laten":** allebei, op een ander niveau.
- **Teams** maak je één keer aan. Het zijn de rijen.
- **De dagbezetting** wordt automatisch voorgesteld en je past hem aan door medewerkers te slepen.
- Een team mag op een dag leeg zijn. Het krijgt dan een "onbemand"-waarschuwing als er klussen op staan.

**De medewerkerweergave** is een afgeleide weergave van dezelfde data: een knop "Teams | Medewerkers". In de medewerker-app ziet iedereen "mijn dag".

---

## Ontwerpbeslissing 2: het opdrachtenbakje

- **Waar komen klussen vandaan:**
  - een offerte of project die op "aangenomen" komt, wordt automatisch een klus in het bakje
  - daarnaast een knop **"Nieuwe klus"** voor werk zonder offerte (onderhoud, kleine klussen)
- **Wat een klus bevat:**
  - klant, adres, titel en omschrijving
  - **begrote uren** (manuren; uit de offerte of met de hand ingevuld)
  - een gewenste periode of deadline, prioriteit
  - eventueel een gewenst team, notities, materiaal en machines
- **Weergave:** een inklapbaar paneel naast het bord.
  - zoeken en filteren
  - tabbladen *Te plannen · Deels gepland · Op afroep*
  - per kaart de begrote uren, wat er al gepland is en wat er nog resteert
- **Inplannen:**
  - sleep een kaart naar een teamrij op een tijdstip; er ontstaat een blok, standaard tot het eind van de dagtijd of tot de resterende uren op zijn
  - het restant blijft in het bakje staan ("16 u resterend")
  - een klus die helemaal gepland is, verdwijnt uit *Te plannen*
- **Een klus van meerdere dagen:** een blok over meerdere dagen uitrekken, of **"verdeel over dagen"** gebruiken. Dat maakt per werkdag een blok binnen de dagtijden.
- **Terugzetten:** een blok terugslepen naar het bakje maakt dat deel weer "te plannen".

---

## Ontwerpbeslissing 3: verlof en afwezigheid

**Wat:** een medewerker vraagt verlof aan in de medewerker-app. De aanvraag staat **meteen** op het planbord, ook als hij nog niet is goedgekeurd. Bij het vooruitplannen zie je dan direct: "hij heeft vakantie aangevraagd".

| Status | Hoe het op het bord staat | Kun je die persoon inplannen? |
|---|---|---|
| **Aangevraagd** | Een kaartje met een gestreepte achtergrond of stippellijn, plus het soort ("Vakantie aangevraagd") | Ja, maar met een waarschuwing |
| **Goedgekeurd** | Een effen blok, plus het soort ("Vakantie") | Nee, het blokkeert |
| **Afgewezen** | Verdwijnt van het bord (blijft wel in de geschiedenis) | Ja, gewoon |
| **Ziek** (gemeld, geen aanvraag) | Een effen blok "Ziek" | Nee, het blokkeert |

**Waarom een aanvraag niet blokkeert:** anders kan één aanvraag de planning weken op slot zetten voordat iemand ernaar gekeken heeft. Een waarschuwing is genoeg; de planner beslist.

**Goedkeuren vanaf het bord:**
- Klik op het kaartje en kies Goedkeuren of Afwijzen, eventueel met een opmerking.
- **Voordat je goedkeurt, laat het bord de gevolgen zien**, bijvoorbeeld: "Op die dagen staan 3 klussen op hem; Team Groen is dan dinsdag en woensdag onbemand."
- De medewerker krijgt een melding van de beslissing in de app.

**Waar het staat:**
- in de rij "Afwezig"
- in de medewerkerweergave, in zijn eigen rij
- in de kop van de teamrij, als een doorgestreepte avatar

Goedgekeurd verlof haalt de persoon automatisch uit de voorgestelde dagbezetting van zijn team.

**Soorten:**
- vakantie, bijzonder verlof, ziek, school, dokter/tandarts (de definitieve lijst stelt Top Tuinen vast)
- hele dagen, halve dagen of uren

**Privacy:** de reden zien alleen de planner en de beheerders. Collega's zien in de app alleen "afwezig". Dat is vooral belangrijk bij ziekte en medische afspraken.

**Verlofsaldo** (hoeveel uren iemand nog heeft) hoort bij het rooster en het loon, niet bij het bord. Toon het hooguit naast de knop Goedkeuren.

**Eerst kijken:** het roosterprogramma heeft misschien al verlof of een aanvraagfunctie. Dan sluit het bord daarop aan. Bouw geen tweede verlofsysteem.

---

## Hoe het bord moet werken (interactie)

| # | Eis | Waarom |
|---|---|---|
| I-1 | Een kaart **vrij verslepen**: horizontaal (tijd of dag) en verticaal (een ander team of andere medewerker) | De belangrijkste klacht |
| I-2 | **Vergroten aan beide kanten** (begin en eind) | In HERO kan dat alleen aan de eindkant |
| I-3 | **De stap is 15 minuten**, los van hoe breed de kolommen zijn. In de weergave van 2 weken of een maand is een kwartier maar een paar pixels breed. Daar wordt de stap automatisch 1 uur, en nooit een hele dag. | In de weekweergave van HERO springt een kaart per 3 uur; waarschijnlijk is dat de "driehonderd" die de planner ziet. In de maandweergave is elk kwartier raken fysiek niet te doen; daarom een stap die meeschaalt. |
| I-4 | Tijdens het slepen en vergroten **live de nieuwe tijden** in beeld | Je ziet waar je loslaat |
| I-5 | **Inzoomen**: Dag / Week / 2 weken / Maand, plus inzoomen met ctrl+scroll of een schuifje. De zoomstand blijft bewaard per planner. | Het overzicht en de precisie wisselen elkaar af |
| I-6 | **Precies bijstellen met het toetsenbord**: pijltjes = ±15 min, shift+pijl = ±1 dag; met een dubbelklik de tijden intypen | Een snelle correctie zonder te slepen |
| I-7 | **Ongedaan maken en opnieuw** (ctrl+z / ctrl+y) | Vrij slepen zonder undo is eng |
| I-8 | **Meerdere kaarten selecteren** (shift-klik of een kader trekken) en samen verplaatsen. **Alt-slepen = kopiëren.** | Een hele dag of een hele week tegelijk verschuiven |
| I-9 | **Rechtermuisknop:** kopiëren, terug naar het bakje, verdelen over dagen, **"slecht weer → naar de volgende werkdag"**, markeren als klaar | Slecht weer is al een soort afspraak in de data |
| I-10 | Een **klik op een lege plek** opent een klein invulvenster (klus zoeken of een snelle afspraak), geen groot zijpaneel | Sneller dan in HERO |
| I-11 | **Overlap wordt getoond** (een rode rand), maar niet geblokkeerd. **Goedgekeurd verlof en ziekte blokkeren wel; een verlofaanvraag geeft alleen een waarschuwing.** | De planner beslist zelf |
| I-12 | Het bord **scrollt vanzelf mee** als je een kaart naar de rand sleept | Slepen over meerdere dagen of weken |
| I-13 | **Medewerkers slepen** tussen teams in de kop van de rij, per dag | De dagbezetting aanpassen |

**Indeling van het bord**

- **Werkbalk:** periode, Vandaag, zoom, filters, de knop Teams | Medewerkers, zoeken.
- **Links:** het opdrachtenbakje (inklapbaar).
- **Rijen:**
  - **per team één rij.** De kop toont per dag de kleur, kleine avatars van de bezetting en de **capaciteit**, bijvoorbeeld "3 man · 24 u / 18 u gepland".
  - onderaan een rij **"Niet ingedeeld"**: de medewerkers die die dag beschikbaar zijn maar in geen team zitten. Je sleept ze zo naar een team.
  - een rij **"Afwezig"**: goedgekeurd verlof en ziekte als effen blokken, verlofaanvragen als gestreepte kaartjes (zie ontwerpbeslissing 3).
  - later eventueel rijen voor voertuigen en machines (in HERO bestaan die brontypen al, maar ze worden niet gebruikt).
- **Standaardblokken**, zoals de reistijd van 07:30 tot 08:00 per team per werkdag: één keer instellen, daarna komen ze vanzelf.
- **Dagtijden:** grijs buiten de werktijd (bij Top Tuinen nu 7:00 tot 18:00). Weekenden kun je verbergen.

---

## Koppeling met de medewerker-app
- **Eén bron van waarheid.** Het bord en de app lezen dezelfde planning. De medewerker ziet **"mijn dag" en "mijn week"**: welke klus, waar (een adres dat in navigatie opent), met wie, hoe laat, en de notities.
- **Wijzigingen komen er snel**, zonder handmatig verversen. Bij een wijziging voor vandaag of morgen krijgt de medewerker een melding. Hoe dat technisch gebeurt, beslist Ricardo, met wat de stack al kan.
- **Terugkoppeling uit de app naar het bord:** gestart, klaar en de gewerkte uren. Het kaartje toont dan de voortgang, en bij de klus zie je begroot tegenover werkelijk.
- **Leg het verleden vast.** Wie op een dag werkelijk in welk team zat, sla je per medewerker per dag op. Als je de teamsamenstelling later verandert, mogen de uren, het loon en de facturen van voorbije dagen niet meeveranderen. Wijzigen achteraf alleen na een bevestiging.

## Datamodel (advies; Ricardo beslist, en gebruik eerst wat er al is)
```
Team            { id, naam, kleur, vaste_kern[], standaard_leden[], actief }
Dagbezetting    { datum, team_id, medewerker_id }            // per dag vastgelegd
Klus            { id, klant/project, offerte_id?, titel, adres, omschrijving,
                  begrote_uren, gewenst_van, gewenst_tot, prioriteit, status }
Inplanning      { id, klus_id?, team_id?, start, eind, soort, notitie, status,
                  medewerkers_uitzondering[]? }             // soort: uitvoering | reistijd | kantoor | overleg | slecht_weer
Afwezigheid     { medewerker_id, van, tot, soort, status,     // soort: vakantie | verlof | ziek | school | ...
                  aangevraagd_op, beoordeeld_door?, beoordeeld_op?, opmerking? }
                                                             // status: aangevraagd | goedgekeurd | afgewezen
                                                             // ziek = meteen goedgekeurd; van/tot op het uur (ook halve dagen)
Standaardblok   { team_id?, weekdagen[], van, tot, soort, titel }

medewerkers van een inplanning = medewerkers_uitzondering ?? Dagbezetting(team_id, datum)
gepland(klus)   = Σ duur(inplanning) × aantal medewerkers
resterend(klus) = begrote_uren − gepland(klus)
```
Tijdzone: Europe/Amsterdam. Let op zomer- en wintertijd (HERO slaat alles op in UTC).

## Over bibliotheken (ter info)
HERO gebruikt **FullCalendar Scheduler** (betaalde licentie). De problemen in HERO komen uit de instellingen (geen aparte stap, slepen van buitenaf uitgezet), niet uit de bibliotheek zelf. Of er een bibliotheek komt, welke dat is, of dat het zelf gebouwd wordt, beslist Ricardo, passend bij de huidige stack.

---

## MVP
**MUST**
- Teams als rijen met een dagbezetting; medewerkers slepen tussen teams per dag; de knop Teams | Medewerkers
- Het opdrachtenbakje (aangenomen klussen + "Nieuwe klus") met begroot / gepland / resterend
- Slepen vanuit het bakje; vrij verslepen; vergroten aan beide kanten; een stap van 15 min; live tijden; undo
- Dag- en weekweergave plus inzoomen
- Verlof en afwezigheid op het bord: verlofaanvragen uit de medewerker-app staan er meteen op; goedgekeurd blokkeert, aangevraagd waarschuwt
- Standaardblok reistijd
- De medewerker-app toont "mijn dag" en "mijn week" uit dezelfde data

**SHOULD**
- Weergaven van 2 weken en een maand
- Meerdere kaarten selecteren, alt-slepen om te kopiëren
- Verdelen over dagen; "slecht weer → volgende werkdag"
- Capaciteit per team per dag
- Verlof goedkeuren of afwijzen vanaf het bord, met de gevolgen voor de planning in beeld en een melding aan de medewerker
- Meldingen bij een wijziging
- Gestart, klaar en uren vanuit de app terug op het bord

**WON'T (nu niet)**
- Voertuigen en machines als rijen
- ICS-import en -export
- Herhaalregels voor klantafspraken (onderhoudscontracten komen later)

## Acceptatiescenario's
1. Een klus met 16 begrote uren staat in het bakje. Je sleept hem naar Team Groen, dinsdag 08:00, met 1 man op Groen. Er ontstaat een blok van 08:00 tot 16:00 (of tot de dagtijd), en het bakje toont nog "8 u resterend".
2. In de weekweergave sleep je de rechterrand van een kaart een stukje. De eindtijd verandert met **15 minuten** en niet met 3 uur. Hetzelfde aan de linkerrand.
3. Je sleept een kaart van Team Groen naar Team Blauw. De medewerkers van die klus worden die van de dagbezetting van Blauw.
4. Je sleept een medewerker op woensdag van Blauw naar Groen. Hij staat dan bij alle Groen-klussen van woensdag. Blauw krijgt een waarschuwing "onbemand" als er nog klussen op Blauw staan.
5. Je probeert iemand met **goedgekeurd** verlof in een team te slepen. Dat kan niet, en de reden wordt getoond.
6. Ctrl+z draait de laatste verplaatsing terug.
7. Een wijziging op het bord staat zonder handmatig verversen in de medewerker-app (hoe snel: beslist Ricardo, en leg het vast).
8. Je verandert achteraf de teamsamenstelling van een voorbije dag. Dat vraagt om een bevestiging, en de al geregistreerde uren veranderen niet vanzelf.
9. Een medewerker vraagt in de app vakantie aan voor volgende week. Die staat **meteen** als gestreept kaartje "Vakantie aangevraagd" op het bord, zonder dat iemand hem eerst goedkeurt. Plan je hem toch in op die dag, dan krijg je een waarschuwing, maar het lukt wel.
10. De planner keurt de aanvraag goed. Eerst ziet hij welke klussen en teams geraakt worden; daarna wordt het kaartje een effen blok, gaat de medewerker uit de voorgestelde dagbezetting en krijgt hij een melding in de app.
11. Een collega opent de app. Hij ziet bij die medewerker alleen "afwezig", niet de reden.

## Nog open (Ricardo beslist)
1. Plant de planner alleen op een computer, of ook op een tablet of telefoon? (Op een touchscreen slepen werkt anders.)
2. Wat betekent "aangenomen" in toptuinen.app (welke status), en moet een klus dan **automatisch** in het bakje verschijnen?
3. Moet een medewerker ook op één dag in twee teams kunnen zitten (bijvoorbeeld 's ochtends A en 's middags B)? Of is een uitzondering per klus genoeg?
4. Moeten de categorieën uit HERO (Kantoor, Afspraak op locatie) mee als soorten blok, en wat betekent "school" (Team Oranje)?
5. Wie mag verlof goedkeuren: alleen de planner, of ook een eigenaar of teamleider?
6. Meldt een medewerker zich ook ziek via de app, of gaat dat telefonisch en voert de planner het in?
7. Zit er in het roosterprogramma al verlof of een verlofaanvraag? (Dat hoort bij stap 0.)
