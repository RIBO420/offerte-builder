# Ontwerpvisie: de urenpagina opnieuw — van tabel naar controlekamer

**Status:** UX-onderzoek + ontwerpvisie (geen implementatieplan)
**Datum:** 17 aug 2026
**Opdracht Ricardo:** "volledig redesign. doe research en maak het beste ui en ux voor een urenpagina."
**Scope:** `/uren` (web, kantoor-kant). De veld-invoer (`/veld`, mobiel `uren.tsx`) blijft de invoerkant; dit stuk gaat over wat er dáárna met die uren gebeurt.

---

## 0. Vertrekpunt: waarom de huidige pagina niet meer klopt

De huidige `/uren` (`src/app/(dashboard)/uren/page.tsx`, 745 r.) is een pre-designprogramma-pagina: vier generieke statkaarten ("Deze Week", "Totaal", "Registraties"), twee voortgangsbalk-kaarten, en daaronder één grote gepagineerde tabel met zeven filtercontrols.

**Wat de screenshots laten zien** (1440px en 390px, 17 aug — `scratchpad/uren-huidig-desktop.png` / `uren-huidig-mobiel.png`):

- Het eerste en grootste cijfer van de pagina is **"Deze Week — 0,0"**. De pagina opent met een nul als heldcijfer, zonder te vertellen of dat een probleem is (niemand heeft ingediend?) of ruis (het is maandagochtend). Een cijfer zonder oordeel, op de belangrijkste plek.
- **Vier identieke witte kaarten met gelijke visuele rang** — Deze Week 0,0 · Deze Maand 124,0 · Totaal 346,3 · Registraties 44. "Registraties: 44" is een database-teller die geen enkele gebruiker iets zegt; "Totaal 346,3" is een all-time-getal dat elke week iets groter wordt en nooit een handeling uitlokt. Alles even zwaar = niets belangrijk; precies het "egale muurtje" dat het dashboard-masterplan verbiedt.
- **"Uren per Project"**: top-5 voortgangsbalken met percentages van het all-time-totaal ("93,2 uur (27%)"), met afgeknipte projectnamen ("Tuinaanleg Dohmen — terras …"). De balk suggereert voortgang maar meet aandeel-in-een-archief — zonder normuren ernaast betekent 27% niets.
- **Generieke `<Card>`-stapels** met een decoratief lucide-icoon rechtsboven — niet de kopbalk-panelen (`SectiePaneel kopbalk`) die dashboard en klantdossier inmiddels dragen. De pagina heet bovendien "Uren Overzicht" met als ondertitel "Bekijk alle geregistreerde uren…": een etiket, geen antwoord.
- **Boven de vouw op 1440×900 staat nul werk.** De tabel — de enige plek met echte registraties — begint pas onder twee schermen statistiek. Op mobiel (390px) is het eerste volledige telefoonscherm letterlijk vier gestapelde statkaarten met "0,0" bovenaan; de registraties liggen vele duimvegen diep.

Daarachter liggen drie fundamentele problemen:

1. **Hij toont het verkeerde datamodel.** De tabel leest `api.urenRegistraties.listGlobal` — het oude model (decimale uren per project). Het echte urenverhaal leeft inmiddels in `urenSegmenten` (§8.10): tijdsegmenten met begin/eind, zeven categorieën (werken, pauze, reistijd, teammeeting, onderhoud materiaal, BES-afvalrit, anders), status `concept → bevestigd → ingediend`, dag-op-slot via `urenDagen`, audit in `urenLogboek`, en planning-afgeleide **voorstellen** ("loggen wordt bevestigen"). De pagina die "Uren" heet, kijkt langs de echte uren heen.
2. **Hij beantwoordt geen vraag.** Vier statkaarten zeggen *dat* er uren zijn, niet *of ze kloppen*, *wie achterloopt* of *wat afwijkt*. Alles wat kantoor werkelijk moet doen (controleren, corrigeren, heropenen, exporteren) zit verstopt achter de tabel of ontbreekt. De `getWieIsAchter`-query en de heropen/correctie-mutations bestaan al — de pagina gebruikt ze niet.
3. **Hij is een archief, geen werkscherm.** Sorteervolgorde "nieuwste eerst" + paginering + filterbatterij is de UX van naslag. Maar uren zijn een *proces* met een ritme (elke dag indienen, elke week de loonronde) en een werkvoorraad (dagen die nog niet binnen zijn, dagen die afwijken). Dat proces heeft geen enkel scherm.

Het redesign is dus geen restyling van een tabel, maar het bouwen van het scherm dat nog nooit bestaan heeft: **de kantoorzijde van de urenketen.**

---

## 1. Persona's en kerntaken

### Kantoor (directie / projectleider) — "Kan de loonronde door?"
Opent de pagina op vrijdagmiddag of maandagochtend. Kerntaken: zien wie z'n dagen nog niet heeft ingediend, afwijkende dagen beoordelen (10,5 uur werken? geen pauze? reistijd van 2 uur?), corrigeren of heropenen (met logboek), en exporteren naar de loonadministratie. Zijn hoofdvraag is **niet** "hoeveel uren zijn er?" maar **"wat moet ik nog doen voordat ik dit kan doorzetten?"** Secundair: uren per werkitem voor nacalculatie — maar dat is een rapportagevraag, geen urenpaginavraag.

### Voorman — "Staat de dag van mijn ploeg erin?"
De voorman rijdt 's ochtends uit met zijn ploeg en de dag verloopt voor iedereen vrijwel gelijk: zelfde stops, zelfde pauze, zelfde terugrit. Aan het eind van de dag (of in de bus terug) wil hij in één beweging de ploegdag bevestigen — de planning-voorstellen kloppen meestal al — en alleen de afwijkingen per man aanpassen (Jan was om 14:00 naar de tandarts). Zijn hoofdvraag: **"klopt de voorgestelde dag, en wie wijkt af?"** Op het dashboard bestaat al de check per teamlid (`heeftUren` ✓/✗ in `voorman-dashboard.tsx`); de handeling erachter ontbreekt op web.

### Medewerker — "Klopt mijn week, en heb ik alles ingediend?"
Kijkt terug, niet vooruit: zijn eigen dagen als tijdlijn, welke dag nog open staat, wat kantoor eventueel gecorrigeerd heeft (transparantie uit het logboek voorkomt loonstrook-discussies). Hoofdvraag: **"staat alles erin en is het ingediend?"** Invoer doet hij in `/veld` of mobiel; hier hoeft hij hooguit een vergeten dag te kunnen openen.

**Ontwerpconsequentie:** dit zijn drie verschillende schermen die toevallig dezelfde route delen. Eén pagina die per rol een ander gezicht toont (zoals het dashboard al doet met `VoormanDashboard`) is eerlijker dan één compromis-tabel met rolvinkjes (`isAdmin && …`) zoals nu.

---

## 2. Wat de besten doen — extern onderzoek, vertaald naar de hovenier

- **Weekstaat als grid** (Harvest, Toggl): rijen = projecten/mensen, kolommen = ma–zo, celtotalen. Sterk voor kantoorwerkers die zelf schrijven; zwak voor buitenploegen — en een breed grid botst frontaal met onze regel "nooit zijwaarts scrollen".
- **Indienen + vergrendelen** (Harvest timesheet locking, Toggl approvals): de periode wordt een *document* met een status en een audit-log. Precies wat `urenDagen` + `urenLogboek` al zijn — wij vergrendelen alleen per **dag**, wat beter past bij een buitenbedrijf (de dag is de natuurlijke eenheid: uitrijden, werken, terug).
- **Voorman schrijft voor de ploeg** (Workyard "group punch", ClockShark CrewClock, mJobTime crew grid): in de bouwsector is dé oplossing dat één man de hele ploeg in één handeling schrijft en daarna per persoon afwijkt. Ons planningsmodel maakt dit nóg sterker: wij hoeven niet eens te *schrijven* — de voorstellen staan er al, er hoeft alleen bevestigd en afgeweken te worden.
- **Controle op afwijking, niet op alles** ("manage by exception", Workday/Dayforce-praktijk): kantoor moet niet 40 schone dagen doorklikken om er 3 vreemde te vinden. Het systeem markeert wat afwijkt (te lang, geen pauze, geen werkitem-koppeling, gat in de dag, handmatig i.p.v. voorstel) en de rest stroomt stil door. Dit is het grootste UX-cadeau dat we kantoor kunnen geven en het ontbreekt in vrijwel alle mkb-tools.
- **Hoveniersspecifiek** (geen tool doet dit goed): regen- en uitvaldagen zijn geen "0 uren vergeten" maar een bewuste registratie (loods/onderhoud materiaal/teammeeting — categorieën die we al hebben); onderhoudsrondes hebben veel korte stops per dag (segmentenlijst, geen één-project-regel); en de scheiding projecturen vs. indirecte tijd (BES, loods) is precies waar nacalculatie op drijft.

Samengevat: de markt bevestigt onze bestaande architectuur (dag indienen, voorstellen, logboek) en wijst één ontbrekend hoofdstuk aan: **een controle-op-afwijking-scherm voor kantoor en een ploegdag-handeling voor de voorman.**

---

## 3. Drie ontwerpconcepten

### Concept A — "De Weekstaat" (het vertrouwde, op z'n best)

**Layout (kantoor):**
- Kopregel in verhaalstijl: "Week 34 · 12 t/m 18 augustus" met weeknavigatie (← →) en de `ExportDropdown`.
- Cijferstrip (`Cel`-patroon uit `cijferbalk.tsx`): ingediende dagen / open dagen / totaal uren / waarvan indirect.
- Hoofdblok: **grid medewerkers × dagen**. Elke cel: uurtotaal + statusstip (grijs = leeg, amber = open, groen = ingediend, rood-omrand = afwijking). Rijtotaal rechts, dagtotaal onder.
- Klik op een cel → **daginspector** als zijpaneel (Sheet): de segmentenlijst van die dag (hergebruik `segmenten-lijst.tsx`), correctieknoppen, heropenen, logboekregels.
- Onder `@lg` (container query) kantelt het grid naar **weekkaarten per medewerker**: naam + zeven dagcellen als chips onder elkaar — geen horizontale scroll, wel dezelfde data.
- Medewerker ziet alleen zijn eigen rij als weekkaart; voorman zijn ploeg.

**Sterk:** universeel begrepen; het hele bedrijf in één oogopslag; sluit direct aan op de wekelijkse loonronde; relatief kleine stap vanaf bestaande componenten.
**Zwak:** een grid met 8+ medewerkers × 7 dagen wordt op ~1280px al krap zonder te scrollen; de afwijkingen — het échte werk — zijn stipjes in een zee van cellen in plaats van de hoofdrol; voor de voorman lost het niets op (hij wil een dag bevestigen, geen week bekijken).
**Hergebruik:** `SectiePaneel kopbalk`, `Cel`/cijferbalk, `segmenten-lijst`, `ExportDropdown`, `useTabState` voor `?week=`.

### Concept B — "De Controlekamer" (werkvoorraad, controle op afwijking)

Geen tabel als vertrekpunt maar **drie vragen onder elkaar**, in de geest van het rapportage-scrollverhaal (één blok = één vraag) en de dashboard-werkstrook (actie boven informatie):

**Layout (kantoor):**
1. **Kop = samenvatting, geen versiering** (dagstaat-principe): "Week 34 — 3 dagen wachten op je blik, 2 mensen zijn achter, de rest kan door." Met periode-navigatie en export.
2. **Blok 1 · "Wie is achter?"** — hergebruik en promotie van `wie-is-achter-widget.tsx`: per medewerker de ontbrekende dagen als chips, met één actie "herinnering" (of gewoon de naam van de voorman erbij: bellen werkt buiten beter dan pushen).
3. **Blok 2 · "Wat wijkt af?"** — het hart. Een verticale wachtrij van **dagkaarten**: één kaart = één medewerker-dag die een afwijkingsregel raakt (>9,5 u werken; geen pauze bij >5,5 u; segment zonder werkitem; gat >1 u midden op de dag; handmatig segment waar een voorstel stond; dag heropend geweest). Op de kaart: naam, datum, de **dagbalk** — de segmenten als gekleurde blokken op een horizontale 06:00–18:00-as, geschaald naar containerbreedte (een schaal, geen scroll) — met de afwijking in één zin eronder ("10,8 uur zonder pauze"). Acties per kaart: *In orde* (bevestigen zoals het is), *Corrigeren* (inspector opent), *Dag heropenen* (terug naar de medewerker, logboek schrijft mee).
4. **Blok 3 · "Wat kan door?"** — de stille meerderheid: "17 dagen zonder bijzonderheden" als één regel met een uitklap (compacte lijst: naam · datum · totaal · dagbalk-miniatuur) en één knop *Alles akkoord*. Daarnaast de export naar loonadministratie, die pas "groen" is als blok 1 en 2 leeg zijn — de pagina zelf ís de checklist voor de loonronde.
5. **Voetblok · archief**: periode-kiezer + compacte lijst voor terugzoeken (de enige plek waar de klassieke lijst nog leeft), plus het `urenLogboek` als tijdlijn.

**Voorman-gezicht** op dezelfde route: de **ploegdag** — de dag van vandaag als één gedeelde dagbalk met de voorstellen, één knop "Ploegdag bevestigen voor 4 man", daarna per man een afwijking toevoegen. **Medewerker-gezicht:** zijn eigen week als zeven dagbalken onder elkaar met indien-status en eventuele kantoorcorrecties zichtbaar gemarkeerd.

**Sterk:** de pagina doet wat kantoor moet dóén in plaats van tonen wat er is; schaalt van 4 naar 25 medewerkers zonder voller te worden (de wachtrij groeit met de afwijkingen, niet met het personeelsbestand); de dagbalk maakt in een halve seconde zichtbaar wat een tabelrij nooit vertelt (gaten, verhouding reistijd/werk, ontbrekende pauze); radicaal anders dan een tabel en toch volledig op bestaand datamodel.
**Zwak:** afwijkingsregels moeten ergens gedefinieerd (en later instelbaar) zijn — begin hardcoded en bescheiden; "wat kan door" vraagt vertrouwen in het systeem (daarom de uitklap: controleren blijft mógelijk, het hoeft alleen niet meer); vraagt een nieuwe verzamel-query (`urenControle.getWeek` o.i.d.) naast `getVeldDag`.
**Hergebruik:** `wie-is-achter-widget` (promotie van planning-widget naar hoofdblok), `segmenten-lijst` in de inspector, `SectiePaneel kopbalk`, `Cel`-strip, `AnkerNavigatie`-patroon bij lange pagina's, `ExportDropdown`, verhaal-kop uit `verhaal.tsx`. Nieuw: de **dagbalk** (één component, drie maten: hero op de kaart, mini in lijsten — herbruikbaar in `/veld`, klantdossier en nacalculatie).

### Concept C — "De Ploegenfilm" (radicaal: de dag als film, ploegen als hoofdrolspelers)

Draait de as om: niet mensen × dagen, maar **één dag, alle ploegen**, als scrollverhaal.

**Layout:**
- Bovenaan een **dagkiezer als filmstrip**: de laatste 10 werkdagen als kleine dagtegels (datum + weer-icoon + status: compleet/open/afwijkend), vandaag rechts. Kies een dag en de pagina wordt de reconstructie van die dag.
- Per ploeg een **hoofdstuk**: de kop noemt ploeg, voorman, bus en de stops van die dag (uit de planning); daaronder de dagbalken van alle ploegleden **onder elkaar op dezelfde tijd-as**, zodat je in één blik ziet dat de ploeg synchroon liep — en waar iemand uit de pas ging. Afwijkingen als amber markering ín de balk; klik op een segment → inspector.
- Een slot-hoofdstuk "los van een ploeg" (materiaalman, zzp'ers, kantoor-medewerkers met uren).
- Onderaan: het dagtotaal als één zin ("42,5 uur, waarvan 6,2 indirect — 3 dagen nog niet ingediend") en de dagacties.
- Regen-/uitvaldag krijgt hier vanzelf gezicht: alle balken van een ploeg tonen dezelfde loods-/onderhoudskleur — de dag vertelt zijn eigen verhaal.

**Sterk:** de meest "hoveniers-eigen" weergave die er bestaat — het scherm ziet eruit zoals het bedrijf werkt (ploegen die samen uitrijden); onovertroffen voor de vraag "wat is er dínsdag gebeurd?"; prachtig als gedeelde taal tussen kantoor en voorman ("kijk even naar de dagfilm van donderdag").
**Zwak:** de loonronde is een *periode*-taak, geen *dag*-taak — voor "kan de export door?" moet je hier dagen aflopen; ploeg-samenstelling wisselt per dag, waardoor de persoon-over-de-week-vraag versnipperd raakt; duurst in nieuwe queries (dag-reconstructie over planning + segmenten + voertuigen).
**Hergebruik:** dagbalk (zelfde component als B), planning-queries (`teamVanMedewerkerOpDag`, stops uit `dagkaartVoorstellen`), verhaalstructuur uit rapportages.

---

## 4. Aanbeveling

**Concept B, "De Controlekamer" — met de dagbalk en het ploeg-denken van C als bouwstenen, en de weekkaart van A als archiefvorm.**

Motivatie:

1. **Het lost de echte taak op.** Van de drie hoofdvragen (kan de loonronde door? / klopt de ploegdag? / klopt mijn week?) beantwoordt B ze alle drie op één route met drie rolgezichten. A beantwoordt vooral "hoeveel", C vooral "wat gebeurde er" — B beantwoordt "wat moet ik doen", en dat is waar dit scherm dagelijks voor geopend wordt.
2. **Het is de logische derde in de reeks.** Rapportages werd "vier vragen", het dashboard werd "de dagstaat", het klantdossier werd "één dossier, één nav". De Controlekamer is exact dezelfde beweging voor uren: van datasoort-ordening (een tabel met alles) naar vraag-ordening (achter → afwijkend → akkoord → archief). Het voelt meteen als familie.
3. **Het bouwt op wat er al staat.** Indienen, heropenen, corrigeren, logboek, wie-is-achter, segmentenlijst, voorstellen — de hele machinekamer bestaat. B is vooral een nieuw gezicht op bestaande mutations plus één verzamel-query en één nieuwe visual (de dagbalk). Radicaal in ervaring, conservatief in fundament — bouwbaar in deze stack zonder schema-breuk.
4. **Het schaalt de goede kant op.** Top Tuinen groeit in mensen en ploegen; een tabel of grid groeit mee in drukte, een afwijkingen-wachtrij niet. De pagina wordt bij goed gedrag van het veld juist *leger* — dat is het juiste incentive voor iedereen.

Uit C neem ik mee: de **dagbalk als dé representatie van een werkdag** (overal dezelfde, van hero tot miniatuur) en, als latere uitbreiding binnen de Controlekamer, een "bekijk deze dag als ploegenfilm"-doorklik op elke dagkaart. Uit A: de **weekkaart per medewerker** als vorm van het archiefblok en van het medewerker-gezicht.

---

## 5. Keuzepunten voor Ricardo

1. **Eén route, drie gezichten — of gescheiden houden?** Mijn voorstel: `/uren` toont per rol een ander gezicht (zoals het dashboard) en `/veld` blijft puur invoer. Alternatief: `/uren` alleen kantoor maken en voorman/medewerker volledig naar `/veld`/mobiel verwijzen. Bepaalt ook wat er met de oude `urenRegistraties`-tabel gebeurt (mijn voorstel: alleen nog in het archiefblok, tot de datamigratie).
2. **Komt er een formele goedkeurstatus?** Nu kent het model open → ingediend. "In orde"/"Alles akkoord" kan puur een kantoor-kwijting in het logboek zijn (geen schemawijziging) óf een echte derde status `goedgekeurd` op `urenDagen` (zwaarder, maar nodig zodra de loonexport alleen goedgekeurde dagen mag meenemen). Dit is de enige keuze die het schema raakt.
3. **Dag- of weekritme als hartslag van de controle?** Ik heb voor week gekozen (loonronde-logica: de kop, de export en "alles akkoord" werken per week), met de dag als eenheid van beoordeling. Alternatief is een dagelijkse controle-ochtendronde — past bij een kleiner team, maar maakt van controle een dagelijkse plicht.
4. **Geld op de urenpagina?** Uurtarieven/loonkosten naast de uren tonen (directie ziet meteen wat de week kost) of uren bewust geldvrij houden en kosten bij rapportage/nacalculatie laten. Mijn neiging: geldvrij — de pagina wordt door meer rollen gezien dan de cijfers aangaan, en één bron van geldwaarheid ligt al bij rapportages.

---

## 6. Wat NIET te doen

- **Geen twee waarheden.** Nooit `urenRegistraties` en `urenSegmenten` naast elkaar op één scherm optellen — dat is de dashboard-les ("dashboard en rapportage mogen nooit verschillende omzetten tonen") in urenvorm.
- **Geen statkaarten zonder vraag.** "Totaal 346,3" en "Registraties: 44" (huidige pagina) informeren niemand en verdringen het werk — en "Deze Week 0,0" als openingscijfer is erger dan geen cijfer. Elk getal op de nieuwe pagina moet een handeling of oordeel dienen; een nul moet ofwel een alarm zijn ("niemand heeft ingediend") ofwel onzichtbaar.
- **Geen start/stop-timer.** De halve time-tracking-markt draait om de live timer; voor een ploeg in de tuin is dat fictie. Ons voorstellen-model (planning → bevestigen) is fundamenteel beter — niet verwateren met een timerknop "omdat Toggl het heeft".
- **Geen goedkeuring per segment.** Beoordeel per dag; segmenten zijn het bewijs, niet de bestuurlijke eenheid. Per-segment vinkjes zijn de snelste route naar klik-moeheid en schijncontrole.
- **Geen breed grid dat stiekem scrollt.** Medewerkers × dagen × totalen past boven ~`lg` en nergens daaronder; wie het toch wil, eindigt bij horizontale scroll of 9px-tekst. Container-queries met een echte kantel-vorm (weekkaarten), of het grid niet bouwen.
- **Geen filterbatterij als interface.** Zeven controls boven een tabel (huidig) betekent dat de pagina zelf niet weet wat belangrijk is. De structuur (achter/afwijkend/akkoord/archief) ís het filter; hooguit één periode-kiezer en één zoekveld in het archief.
- **Geen strafbank-esthetiek.** "Wie is achter" is een werklijst, geen schandpaal: neutrale toon, amber niet rood, geen ranglijstjes van te-laat-indieners. Kleur alleen functioneel (Loof & Leem): amber = wacht op actie, groen = ingediend/akkoord, rood alleen voor echte blokkades van de loonronde.
- **Geen verplichte-velden-reflex.** Elke extra verplichte notitie of reden verlaagt de invoerkwaliteit buiten. Frictie hoort bij de afwijking (kantoor vraagt na), niet bij de invoer.
- **Geen maandkalender met drag-and-drop.** Mooi in demo's, onbruikbaar met handschoenen aan en irrelevant voor kantoorcontrole.

---

## Bronnen (extern onderzoek)

- [Toggl — Overview of Timesheet Approvals](https://support.toggl.com/overview-of-timesheet-approvals) · [Toggl — Why Timesheet Approvals Matter](https://toggl.com/track/why-timesheet-approvals-matter/)
- [Harvest vs Toggl (Harvest)](https://www.getharvest.com/resources/harvest-vs-toggl) · [Beebole — time tracking tools met approval-workflows](https://beebole.com/blog/best-time-tracking-tools-with-automated-timesheet-approval)
- [Workyard — time tracking voor bouwploegen (group punch)](https://www.workyard.com/employee-time-tracking/simplest-time-tracking-app-for-construction-crews) · [Timeero — best time clock construction](https://timeero.com/post/best-time-clock-construction) · [mJobTime — crew grid entry](https://mjobtime.com/field-time-management/)
- [CloudApper — exception-based time approvals (Workday)](https://www.cloudapper.ai/ai-time-clock/workday/exception-based-time-approvals-workday/) · [idem, Dayforce](https://www.cloudapper.ai/ai-time-clock/dayforce/dayforce-timesheet-approval-automation/) · [RosterElf — timesheet approval audits](https://www.rosterelf.com/blog/timesheet-approval-audits)

**Interne referenties:** `src/app/(dashboard)/uren/page.tsx` (huidig scherm) · `convex/urenSegmenten.ts` + `convex/schema.ts` r. 1259–1325 (segmenten/dagen/logboek) · `src/components/veld/` (veld-dag, segmenten-lijst) · `src/components/planning/wie-is-achter-widget.tsx` · `src/app/(dashboard)/rapportages/components/verhaal.tsx` · `docs/design/plannen/dashboard-bento-masterplan.md` · `docs/design/plannen/klantdossier-herindeling-v7.md`.
