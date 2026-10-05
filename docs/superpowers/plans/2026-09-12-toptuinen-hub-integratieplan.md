# Top Tuinen Hub → Top Tuinen OS: onderzoek en integraal implementatieplan

Datum: 12 september 2026. Oorspronkelijk onderzoeksplan; implementatiebewijs staat in de auditmatrix en testoverdracht.

**Bijgestelde opdracht:** afronden met onze eigen medewerkers, klanten, projecten en planning. HERO en historische gegevensimport uit de andere app vallen buiten de oplevering. De toegevoegde connector, importschermen, cron en bronimporter zijn verwijderd; bestaande OS-gegevens en beide eigen urenbronnen blijven behouden. F14/F15 zijn expliciet vervallen op gebruikersverzoek, geen openstaande bouw- of configuratievoorwaarde.

**Actuele eindstatus:** zie de [F01–F51-eindmatrix](../implementation/2026-09-12-hub-eindstatus-f01-f51.md) voor aangesloten functies en bewuste equivalenten; de inventaristabellen hieronder beschrijven het oorspronkelijke implementatieplan.
## 1. Opdracht en advies

Neem **alle functionaliteit en alle gebruikersflows** van `saisworks/toptuinen-uren` op in Top Tuinen OS. Dat omvat medewerker, voorman, kantoor, beheer, exports, foutafhandeling en behoud van onze bestaande historische gegevens. Externe koppelingen en historische bronappimport zijn door de bijgestelde opdracht uitgesloten. Behoud onze eigen UI, UX, navigatieprincipes, huisstijl, rollen, Clerk-authenticatie en Convex-backend. De expliciete aanvulling van Ricardo is de **aanhangervulling bij terugkomst**.

Het advies is een functionele herimplementatie binnen onze bestaande domeinen. De andere app is vanilla JavaScript + Supabase + een PWA; onze app is Next.js + Expo + Convex + Clerk. De bron levert waardevolle bedrijfsregels, flows, exportcontracten en testgevallen. Onze bestaande componenten, werkitems, klantdossiers en autorisatie blijven het fundament.

Er is veel overlap, maar een scherm of tabel met dezelfde naam betekent nog geen volledige dekking. Vooral aanhangerregistratie, protocollen, losse krachten zonder account, exportpariteit en betrouwbare offline verwerking vragen gericht werk. Daarnaast zijn de nieuwe velduren en de oudere projecturen bij ons nog verschillende gegevensbronnen. Die koppeling moet worden opgelost voordat we de overname als voltooid beschouwen.

**Eindresultaat:** een medewerker kan alle relevante handelingen uit de bron in onze app uitvoeren; een voorman en kantoor kunnen de vervolgacties uitvoeren; dezelfde registratie komt correct terug in planning, dossier, controle en afgesproken exports. Geen functie wordt alleen als losse knop toegevoegd.

## 2. Onderzoeksbasis en beperkingen

- Bronrepository: [saisworks/toptuinen-uren](https://github.com/saisworks/toptuinen-uren), vastgelegd op commit [`cf6e158b203c7a5fd5714ad8b264a6ad3bbb367d`](https://github.com/saisworks/toptuinen-uren/tree/cf6e158b203c7a5fd5714ad8b264a6ad3bbb367d). Onderzocht: router, alle 15 geregistreerde schermroutes, sheets, API-modules, pure logica, SQL-migraties, Edge Functions, exports en operationele scripts.
- Doel: de lokale werkcopy van `offerte-builder/`. Tijdens de audit veranderde HEAD door ander werk: van `a58f90d` naar onder meer `e8531ba` en `bf2e298`. Dit is dus een audit van de aangetroffen werkcopy, geen claim dat alle bevindingen één onveranderlijke targetcommit beschrijven. Bij implementatiestart eerst de betrokken bestanden opnieuw controleren.
- Bestaande lokale wijzigingen zijn behouden. Geen productiequery, migratie, accountwijziging, mail, push, commit of deployment uitgevoerd.
- Onderzoek uitgevoerd met drie specialistische agents naast de hoofdagent: bronflows, huidige backend en huidige web/native app. De hoofdagent onderzocht bronopslag, autorisatie, integraties, rapportage en de aanhangerketen en combineerde de uitkomsten.
- De bron heeft oude documentatie en ongebruikte code. De actuele importketen en render-aanroepen zijn leidend. Bijvoorbeeld: HERO-planning wordt wel aangeroepen hoewel oudere opmerkingen zeggen dat HERO vervallen is.
- Broncontrole: `node --test test/*.test.mjs` → **155 tests geslaagd, 0 mislukt**. Dit zijn lokale tests; geen bewijs dat alle flows in productie correct werken.
- Doelcontrole door backendagent: zeven bestaande suites (`veld`, `dagkaart`, `uren-afwijkingen`, `uren-controlekamer`, `export-rollen`, `auth-require-org`, `planbord`) → **284 tests geslaagd**. Tests gebruiken onder meer een nagebootste Convex-database. Geen volledige build, volledige regressiesuite, native apparaattest of browsersessie uitgevoerd.
- De werkelijke inzet van HERO, cronjobs, mailinstellingen en de actuele inhoud van de operationele database is niet vastgesteld. Die controle hoort bij de voorbereidingsfase, zonder aannames op basis van README-tekst.

Verwijzingen naar broncode hieronder zijn relatief aan de vastgelegde broncommit. Verwijzingen naar onze code zijn relatief aan de root van `offerte-builder/`. Regels zijn navigatiehulp en kunnen door het gelijktijdige werk verschuiven.

## 3. Bestaande architectuur: wat behouden blijft

| Onderdeel | Huidige basis | Richting |
|---|---|---|
| Identiteit | Clerk-organisaties; `users` gekoppeld aan `medewerkers`; zeven canonieke rollen | Bronprofielen koppelen aan medewerkers. Accountloze personen krijgen een medewerkerrecord; geen fictief Clerk-account. |
| Planning | Werkitems in `projecten`, `teamBemanning`, dagkaart en planbord | Hierop uitbreiden. Geen nieuwe schrijvers naar de voor planning verouderde `weekPlanning`/`planningTaken`. |
| Velduren | `urenSegmenten`, `urenDagen`, `urenLogboek` | Dit wordt de basis voor de overgenomen veldfunctionaliteit. |
| Oudere projecturen | `urenRegistraties`, nog gebruikt door exports en delen van nacalculatie/projectweergave | Expliciete compatibiliteit en overgang; geen onvoorwaardelijk optellen of dubbel schrijven. |
| Werk afronden | `afronding.rondWerkitemAf`: taken, restopdracht, klanttijdlijn, facturatie-effecten | Hergebruiken met een duidelijk onderscheid tussen dag indienen, bezoek terugmelden en werk definitief afronden. |
| Foto's | Convex Storage en klanttijdlijn met werkitemkoppeling | Fase vóór/na en bezoekmetadata toevoegen; bestaande dossierketen gebruiken. |
| Materieel | Voertuigen, type `aanhanger`, reserveringen, busuitrusting en materiaaldelta | Nieuwe vullingsmelding koppelen aan bestaand materieel. |
| Kantoorcontrole | Controlekamer, Ploegenfilm, eigen week en ploegdag | Hier ontbreken-informatie, correcties en rapportagereedheid toevoegen. |
| Communicatie | Chat, notificaties en bestaande mailinfrastructuur | Gerichte werkprocesgebeurtenissen en herinneringen toevoegen. |
| Overige OS-functies | Offertes, HR, voorraad, wagenpark, contracten, facturen, klantportaal | Behouden en op regressie controleren. Geen tweede implementatie vanuit de bron. |

Belangrijkste code-ingangen: `convex/auth.ts:197`, `convex/roles.ts`, `convex/schema.ts:825`, `convex/schema.ts:1061`, `convex/dagkaart.ts:273`, `convex/urenSegmenten.ts:561`, `convex/urenControle.ts:637`, `convex/afronding.ts:50`, `convex/export.ts:281`, `convex/nacalculaties.ts:75`.

### UI/UX-afspraak

De webapp behoudt Loof & Leem, `SectiePaneel`, bestaande statuscomponenten, containerqueries en de regel dat de gebruiker nooit horizontaal hoeft te scrollen. Native behoudt zijn eigen theme, grote raakvlakken, sheets, buitenmodus en huidige tabstructuur. Web en native delen domeinregels en API-contracten, geen UI-componenten.

De huidige vier native tabs blijven het uitgangspunt: Home, Uren, Chat, Profiel. Ontbrekende planning-, protocol-, overzicht- en beheerflows krijgen logische ingangen en onderliggende schermen. Niet alle kantoorfuncties worden voor medewerkers zichtbaar. Kantoor dat zelf meewerkt moet wel zijn eigen werkdag kunnen openen.

Referenties: `../PRODUCT.md`, `../DESIGN.md`, `CLAUDE.md`, `docs/dev/ui-patronen.md`, `docs/design/plannen/uren-controlekamer-plan.md`, `mobile/app/(tabs)/_layout.tsx:12`.

## 4. Aanhanger: expliciete prioriteit

### Wat de bron daadwerkelijk doet

1. Een toegewezen medewerker opent de klus en beantwoordt **“Hoe vol is de aanhanger?”**.
2. De keuze is **¼, ½, ¾ of vol**, opgeslagen als 1, 2, 3 of 4. Er is in de huidige bron **geen aparte keuze voor leeg**. `null` betekent onbeantwoord.
3. Het antwoord wordt gedeeld op de geplande klus (`planning_events.aanhanger_vol`), niet per medewerker.
4. Een collega kan aangeven **“Collega vult dit in”**. Dit is een persoonlijke uitzondering op de indiencheck; het is geen ingevulde vulling.
5. De dagcheck controleert aanhanger, klusafronding en foto's. Een gedeeld antwoord of een eigen delegatie kan de betreffende blokkade opheffen.
6. Kantoor ziet de vulling in het planningsoverzicht en het klusdetail.
7. De facturatie-export gebruikt de vulling voor stortkosten. De broncode heeft een vast bedrag van €52,50 voor vol, naar verhouding voor de kwartstappen. Dit is een aangetroffen codewaarde, geen gevalideerd actueel tarief.

Bewijs: `src/components/aanhanger-picker.js:20`, `src/sheets/segment-entry.js:187`, `src/api/planning.js:165`, migraties `20260708000023_aanhanger_vol.sql` en `20260801000033_aanhanger_overgeslagen.sql`, `src/util/dagcheck.js:69`, `src/screens/planning-overzicht.js:277`, `src/util/aanhanger.js:12`, `src/sheets/template-export.js:309`.

### Wat wij bouwen

De vraag van Ricardo gaat specifiek over **hoe vol de aanhanger teruggaat**. Daarvoor maken we een echte retourmelding. De bron heeft alleen een vulling per klus en kent geen fysieke aanhanger, terugrit of meerdere stortbezoeken.

**Medewerkerflow:**

1. Op de bestaande dagkaart staat de gebruikte aanhanger, vooraf ingevuld vanuit een reservering wanneer beschikbaar.
2. Bij de terugrit/dagafsluiting verschijnt **“Hoe vol gaat de aanhanger mee terug?”**.
3. Keuzes: **geen aanhanger mee, leeg, ¼, ½, ¾, vol**. Onbeantwoord blijft afzonderlijk herkenbaar.
4. Eén medewerker/voorman bevestigt voor de betreffende aanhanger en retourrit. Collega's zien wie de melding deed en wanneer.
5. Wie het antwoord niet kan geven, kan het aan een collega overlaten. De taak blijft zichtbaar voor de verantwoordelijke en kantoor totdat er een echt antwoord is.
6. Een offline melding blijft zichtbaar als “Nog te synchroniseren”. Na serverbevestiging is zij definitief opgeslagen. Een dubbele tik of retry maakt geen tweede melding.
7. Kantoor ziet in het dagoverzicht: aanhanger, ploeg, retourvulling, melder, tijdstip en eventuele ontbrekende informatie. Vanuit daar kan kantoor lossen/storten opvolgen of de volgende inzet voorbereiden.

**Gegevensvoorstel:** een afzonderlijk retour-/ladingrecord, bijvoorbeeld `aanhangerRetouren`, met `orgId`, `voertuigId` (verplicht behalve bij geen aanhanger; gecontroleerd type aanhanger), optionele `teamId`, verantwoordelijke medewerker, `datum`, een stabiele `retourId`, vulling 0–4 of expliciet geen aanhanger, `gemeldDoor`, waarnemingstijd én servermoment, optionele toelichting, revisie en `idempotencyKey`. De precieze tabel- en veldnamen worden in de contractfase vastgesteld. Bewaar correctiehistorie; overschrijf niet stilzwijgend wie de oorspronkelijke waarneming deed. Toon op het wagenpark de laatst gemelde vulling met tijdstip, niet als gegarandeerde actuele meting.

Een werkitem-/bezoekmelding kan daarnaast vastleggen hoeveel afval bij een klus is meegenomen. Koppel een dergelijke melding aan een aanhanger/rit waar dat bekend is. Bronwaarden zijn in het onderzoek uitsluitend **vulling per klus**, geen bewezen retourvullingen. Historische brongegevens worden binnen de bijgewerkte opdracht niet geïmporteerd.

**Essentiële rekenregel:** een retourvulling is een momentopname. Drie klanten bezoeken met dezelfde aanhanger betekent niet drie keer de laatste vulling rekenen. Kosten worden alleen geboekt op een expliciete afval-/stortregistratie met een unieke bronverwijzing en afgesproken klanttoerekening. Geen automatische factuur door het indrukken van “¾”. Het bron-exportgedrag blijft beschikbaar als afzonderlijk vastgelegd compatibiliteitsbeleid voor per-klusgegevens.

Het tarief wordt een bedrijfsinstelling met geldigheidsdatum, niet een hardcoded bedrag. De eerste versie van de retourmelding kan zonder geldbedrag live: de operationele functie is nuttig zodra de medewerker kan melden en kantoor kan opvolgen. Export- en kostenpariteit blijven wel onderdeel van het totale implementatieplan.

### Acceptatie aanhanger

- Leeg, onbeantwoord en geen aanhanger zijn aantoonbaar verschillende toestanden.
- Een melding van één collega is zichtbaar bij dezelfde ploeg/retourrit, ook op de andere client.
- Twee verschillende aanhangers of twee retour-/stortbewegingen op één dag blijven te onderscheiden.
- Alleen een bevoegde toegewezen medewerker/voorman of kantoor kan de melding wijzigen; alle gekoppelde records horen bij dezelfde organisatie.
- Delegatie laat geen ontbrekend antwoord ongemerkt verdwijnen.
- Gelijktijdige afwijkende antwoorden veroorzaken een expliciete conflict-/correctieflow.
- Herhaalde offline replay maakt geen dubbele meldingen of kosten.
- De export telt een stort-/kostenrecord eenmaal en verklaart welke klus de kosten draagt.

## 5. Contracten die vóór parallel bouwen vaststaan

### 5.1 Identiteit en rechten

Gebruik `orgId`, `medewerkerId`, `userId`, `werkitemId`, `klantId` en waar nodig `bezoekId` als referenties. Een bron-UUID en een naam blijven herkomstgegevens. Namen zijn geen permanente koppelsleutel.

De bron kent `admin`, `worker` en een extra `is_voorman`-vlag; ons systeem kent directie, projectleider, voorman, medewerker, klant, onderaannemer_zzp en materiaalman. Maak per actie een capabilitymatrix. Een bron-admin krijgt niet automatisch directierechten op financiële en HR-gegevens. Accountloze krachten blijven personen zonder toegang totdat zij via onze reguliere uitnodiging gekoppeld worden.

De huidige voorman kan bij ons ploegvoorstellen bevestigen, maar niet willekeurig alle uren van anderen wijzigen. De bron laat de voorman losse krachten zonder account aanmaken en uren voor hen schrijven. Maak hiervoor beperkte, aparte mutaties met registratie van actor én persoon voor wie is ingevoerd. Behoud bestaande ploegbevestiging; verleen geen algemene medewerkerbeheerrechten.

### 5.2 Werkitem versus bezoek

De bron heeft vaak één `planning_event` per klantbezoek. Een werkitem bij ons kan meerdere dagen/bemanningsovergangen omvatten. Foto's, gedeelde antwoorden en toewijzingen horen daarom bij een stabiele **bezoek-/uitvoeringsidentiteit**, niet alleen bij klantnaam of het huidige plandatumveld.

Contractfase bepaalt of een brongebeurtenis één bestaand werkitem kan zijn of een bezoek onder een werkitem nodig heeft. Aanbevolen: werkitem blijft het zakelijke object; een stabiele uitvoeringssleutel koppelt medewerkerstoewijzing, segmenten, foto's en terugmeldingen. Verplaatsen van een toekomstig bezoek verplaatst nooit reeds ingediende historische uren.

### 5.3 Uren en categorieën

| Broncategorie | Betekenis | Doelvoorstel |
|---|---|---|
| `werken` | Werk bij klant | `werken`, met werkitem/bezoek en klant |
| `rijden` | Reistijd | `reistijd` |
| `pauze` | Pauze, eventueel bij een klant | `pauze`, optionele klant/bezoekkoppeling behouden |
| `bes` | Lossen/storten | `afvalverwerker_bes`, met herkomst waar bekend |
| `onderhoud` | Onderhoud materieel | `onderhoud_materiaal` |
| `loods` | Loods/teammeetingtijd | Expliciete loodsclassificatie of overeengekomen subtype; niet ongemerkt alle loodsminuten als vergadering etiketteren |
| `laden` | Laden | Nieuwe categorie/subtype `laden` |
| `anders` | Overig met toelichting | `anders` |

Schema, validators, UI-labels, dagkaartvoorstellen, kleuren, filters, exports en rapportages worden gezamenlijk bijgewerkt. Broncategorie en originele werksoort blijven voor herleidbaarheid beschikbaar. Geen extra waarden toevoegen aan `offertes.type`: dat blijft uitsluitend aanleg/onderhoud.

Er komen expliciete, gedeelde berekeningen in gehele minuten:

- **Dagspan:** vroegste begintijd tot laatste eindtijd.
- **Geregistreerd:** som van geregistreerde segmenten, uitgesplitst per categorie.
- **Direct klantwerk:** alleen werken-segmenten.
- **Pauze:** afzonderlijke pauzeminuten.
- **Broncompatibel betaald:** dagspan minus pauze; dit telt gaten in de registratie mee.
- **Factureerbaar/kosten:** afzonderlijk beleid; niet automatisch gelijk aan betaald of dagspan.

Voorbeeld uit de brontest: 07:00–16:00, 30 minuten pauze en 405 minuten klantwerk geeft 540 minuten span, 510 minuten volgens de bronberekening betaald en 405 minuten effectief. Bij een gat van een uur blijft de bronspan even groot; onze huidige geregistreerde niet-pauzetijd wordt juist kleiner. Beide cijfers kunnen zinvol zijn, maar krijgen nooit hetzelfde ongedefinieerde label “uren”.

### 5.4 Eén betrouwbare rapportageketen

Aanbevolen overgang: segmenten zijn leidend voor nieuwe veldregistraties; een gedeelde rapportage-/kostenlaag leest deze en expliciet afgebakende historische projecturen. Een organisatie-/datum-/werkitembeleid bepaalt welke bron voor welk bereik geldig is. Dubbele historische records gaan naar een reconciliatielijst en worden niet op basis van een globale datum of gelijke naam blind samengevoegd.

Aanpassen: segmentexport, oudere `exportUren`, projecttotalen op web/native, `nacalculaties`, relevante analytics en onderhoudskosten. Leg elke consument vast in een migratiechecklist. Als een oude consument tijdelijk een projectuurprojectie nodig heeft, is die afgeleid en herbouwbaar, met unieke segmentbron en zonder bewerkingsmogelijkheid. Dit is een bewuste uitbreiding van de eerdere afspraak om de twee engines ongemoeid naast elkaar te houden.

### 5.5 Transacties, revisies en bedrijfsregels

- Een dag indienen controleert server-side segmenten, gedeelde klusantwoorden en persoonlijke uitzonderingen, en schrijft dagstatus + audit in één Convex-mutatie.
- Dag indienen is iets anders dan klus afronden. Import of indienactie mag geen bestaande facturatie-effecten van `rondWerkitemAf` activeren.
- Een kantoorcorrectie op een reeds beoordeelde dag maakt die beoordeling ongeldig voor de nieuwe revisie. De medewerker ziet de wijziging en reden.
- Op een ingediende dag zijn tijd, categorie, referenties, toevoegen en verwijderen vergrendeld. De bron staat notities achteraf toe; indien we die mogelijkheid overnemen, blijft het een afzonderlijke geauditeerde actie die geen tijd wijzigt.
- Voorstellen zijn geen gewerkte uren. Bevestigen maakt registraties; latere planningwijzigingen herschrijven die niet.
- Tijdcascade in een voorstel mag latere blokken verschuiven. Een pauze invoegen in reeds werkelijk geregistreerde tijd vraagt een expliciete verdeling; historische werkduur wordt niet stilzwijgend verlengd.
- Bronafwijkingen (geplande versus werkelijke tijd plus reden) worden gestructureerd bewaard, naast onze bestaande signaleringen.
- Een onvoltooide klus vraagt een reden en kan een schatting van resterende minuten bevatten. Onze restopdrachtlogica wordt hergebruikt met een unieke bronreferentie zodat opnieuw bevestigen geen tweede restopdracht maakt.

### 5.6 Offline contract

Onze huidige nieuwe mobiele urenflow is expliciet online. Oude queue-/SyncEngine-code is geen bewijs dat segmenten of foto's al betrouwbaar offline werken. Kies één werkelijk aangesloten outbox per organisatie en gebruiker, met UUID, operatie, payload, gewenste revisie, lokale tijd, retry-status en serverresultaat.

Minimale bronpariteit: segmenten aanmaken/wijzigen offline, gecachte dag/planning/protocollen, herstart en opnieuw verbinden. Binnen deze overname voegen we ook retourmeldingen en foto-uploads met zichtbare wachtrij toe. Definitief indienen/financiële acties vereisen serverbevestiging. Verkeerde revisies of inmiddels vergrendelde dagen blijven als herstelbare conflicten zichtbaar; geen consolemelding gevolgd door stil weggooien. Wisselen van gebruiker/organisatie mag nooit gegevens van de vorige gebruiker versturen of tonen.

## 6. Volledige functionele mapping

De tabellen vormen de scopebaseline. **Bestaand** betekent dat een relevante doelimplementatie is aangetroffen; volledige pariteit is pas bewezen door de bijbehorende acceptatieflow. **Uitbreiden** betekent dat een deel bestaat. **Nieuw** betekent ontbrekende samenhangende functionaliteit. **Slapend** betekent aanwezig in de broncode maar zonder actuele gebruikersingang.

### 6.1 Alle schermroutes van de bron

| Bronroute | Hoofdfunctie | Bestemming in onze UI |
|---|---|---|
| `#/vandaag` | Eigen dag, klussen, tijden, voorstel, indienen | Native Uren/Mijn dag; web `/veld` en eigen dagweergave |
| `#/planning` | Eigen planning en gemiste klussen aanvullen | Native dagkaart + persoonlijk planningsoverzicht; bestaande webplanning |
| `#/week` | Eigen week/maand, dagen en klanttotalen | Eigen urenoverzicht onder Uren, met periodekeuze |
| `#/dashboard` | Kantooroverzicht met totalen, filters en signalen | Bestaande Controlekamer en rapportage; geldvrije uren-UX behouden |
| `#/protocol` | Noodnummers en stappenplannen per doelgroep | Bestaande noodprotocolingang uitbreiden tot leesbare bibliotheek |
| `#/instellingen` | Identiteit, weergave, hulp, beheerlinks, uitloggen | Profiel/Instellingen en bestaande beheernavigatie |
| `#/klanten` | Klantbeheer en HERO-review in de bron | Bestaand Klanten; externe import uitgesloten |
| `#/medewerkers` | Rol, ploeg, actief, voorman | Bestaand Team/medewerkersbeheer |
| `#/planbord` | Klussen plannen/verplaatsen, crew, HERO-sync in de bron | Bestaand eigen planbord/dagkaart; externe sync uitgesloten |
| `#/planning-overzicht` | Kantoorweek, bemanning, omschrijving, antwoorden/foto's | Bestaande planninglijst/dagkaart en werkiteminspectie |
| `#/uren-correctie` | Dag medewerker bekijken, heropenen en corrigeren | Bestaande uren-daginspector |
| `#/indienen` | Indienstatus per persoon/dag en plandekking per maand | Controlekamer: afzonderlijk indienstatus en ontbrekende klusregistraties |
| `#/fotos` | Kantooroverzicht klusfoto's | Werkitem-/klantdossiergalerij + gefilterd kantooroverzicht |
| `#/protocol-beheer` | Protocollen/noodcontacten beheren | Instellingen/protocollen, met doelgroep en volgorde |
| `#/teams` | Ploegen beheren | Bestaand Team-/ploegbeheer |

Bron: `src/router.js:22`. Routes zijn geen maat voor het aantal flows: invoer, wijzigen, verwijderen, foutafhandeling en vervolgacties hieronder tellen afzonderlijk mee.

### 6.2 Identiteit, instellingen en appgebruik

| ID | Functionaliteit/flow uit de bron | Doeldekking en implementatie |
|---|---|---|
| F01 | Inloggen met wachtwoord, Google of e-maillink; gesloten zelfregistratie | **Uitbreiden/verifiëren.** Clerk behouden; equivalente toegangswegen configureren voor zover gewenst. Geen Supabase-auth kopiëren. Onze eigen medewerkers houden hun bestaande accountkoppeling; uitnodigingen lopen via ons accountbeheer. |
| F02 | Eerste toegang → wachtwoord kiezen of later; workerintro eenmalig, overslaan en opnieuw bekijken | **Uitbreiden.** Clerk verzorgt credentials; appintro en voltooiingsstatus per gebruiker. Niet een tweede wachtwoordformulier buiten Clerk bouwen. |
| F03 | Profiel lezen; licht/donker/automatisch/buitenmodus | **Bestaand/uitbreiden.** Onze thema's en buitenmodus behouden; voorkeuren consistent toepassen. |
| F04 | Uitloggen/accountwissel wist gebruikerscache en concepten | **Uitbreiden.** Outbox en caches op gebruiker én organisatie isoleren; beleid voor niet-verzonden werk zichtbaar maken. |
| F05 | Installeerhulp, offline shell, update op rustig moment, fout bij route laden → opnieuw proberen | **Uitbreiden.** Equivalent per platform: native versie/updatepad en webcache. Open formulieren en wachtrijen beschermen tegen updateverlies. |
| F06 | Medewerker activeren/deactiveren, rol wijzigen, voorman aanwijzen, ploeg koppelen; historie behouden | **Bestaand/uitbreiden.** Onze canonieke rollen en expliciete accountrechten gebruiken; deactiveren niet gelijkstellen aan historie verwijderen. |

Bewijs: bron `src/auth.js:4`, `src/main.js:40`, `src/main.js:192`, `src/screens/settings.js:103`, `src/screens/medewerkers.js:233`; doel `convex/team.ts:342`, `mobile/components/OrgGate.tsx:35`, `mobile/hooks/use-current-user.ts:118`.

### 6.3 Planning en voorbereiding

| ID | Functionaliteit/flow uit de bron | Doeldekking en implementatie |
|---|---|---|
| F07 | Eigen toegewezen week bekijken; vorige/volgende week; adres/route en instructies | **Uitbreiden.** Native mist een volwaardig bereikbaar planningsoverzicht; gebruik bestaande dagkaartgegevens. |
| F08 | Klusstatus gelogd/gemist/wachtend; gemiste klus openen om uren aan te vullen | **Uitbreiden.** Expliciete bezoekkoppeling; niet herkennen op alleen klantnaam/tijdoverlap. |
| F09 | Kantoor maakt/wijzigt/verwijdert klus: datum, tijden, categorie, klant, locatie, omschrijving, kantoornotitie | **Bestaand/uitbreiden.** In bestaand planbord. Schrappen van een bezoek met uitvoering bewaart historie en leidt tot annuleren/archiveren waar nodig. |
| F10 | Verslepen naar andere dag, bewerken als drag niet beschikbaar is, terugzetten bij mislukte opslag | **Bestaand/verifiëren.** Onze eigen planbordinteractie behouden; optimistic rollback en reeds geregistreerde historie testen. |
| F11 | Ploeg maken/hernoemen, kleur kiezen, activeren/deactiveren; personen per bezoek toevoegen/verwijderen; handmatige versus HERO-toewijzing | **Uitbreiden.** Dagbemanning en expliciete bezoekafwijkingen blijven op onze eigen medewerkers gebaseerd; geen externe sync. |
| F12 | Materiaalsuggesties op sleutelwoorden; handmatig benodigd materieel toevoegen; checks bekijken | **Uitbreiden.** Onze materiaaldelta en busuitrusting blijven basis; source-regels kunnen aanvullende suggesties leveren. Een suggestie is geen voorraadboeking. |
| F13 | Klant zoeken met geplande klanten bovenaan; inline klant maken; archiveren/herstellen | **Bestaand/uitbreiden.** Huidig rijker klantmodel behouden; acties en zoekrangorde aanpassen waar nuttig. |
| F14 | HERO-klanten synchroniseren → concept/review → aanpassen/activeren/negeren/bulk activeren | **Vervallen op gebruikersverzoek.** Geen HERO-connector of importreview; onze eigen klanten gebruiken. |
| F15 | HERO-planning handmatig/gepland synchroniseren; crew-matching, gewijzigde/vervallen events en sync-log | **Vervallen op gebruikersverzoek.** Geen externe planning of sync; eigen projecten, teams en planning gebruiken. |

Bewijs: bron `src/screens/planning.js:142`, `src/screens/planbord.js:46`, `src/sheets/klus-form.js:58`, `src/screens/planning-overzicht.js:214`, `src/screens/klanten.js:216`, `supabase/functions/sync-hero-planning/index.ts:166`; doel `convex/planbord.ts:306`, `convex/dagkaart.ts:273`, `convex/materiaalDelta.ts:63`.

### 6.4 Dag, uren en correcties

| ID | Functionaliteit/flow uit de bron | Doeldekking en implementatie |
|---|---|---|
| F16 | Eigen dagkiezer/kalender, tijdlijn, totalen en handmatige invoer | **Bestaand/uitbreiden.** Gebruik huidige velduren, voeg ontbrekende categorieën/metadata toe. |
| F17 | Planning → volledig bewerkbaar dagvoorstel → expliciet opslaan | **Bestaand/uitbreiden.** Huidige afgeleide voorstellen behouden; groepsbewerking en atomaire bevestiging toevoegen. |
| F18 | Vroege start, loods, laden, heenreis, meerdere klussen, tussentijdse ritten en terugreis | **Uitbreiden.** De bron gebruikt 5 min meeting + 10 min laden + 30 min reis voor de eerste klus; onze organisatie-instellingen blijven leidend, met broncompatibel preset indien gekozen. Geen onzichtbare overname van vaste tijden. |
| F19 | Tijd aanpassen via typen/±5; duur behouden bij startverschuiving; vervolgtijden schuiven | **Uitbreiden.** Hergebruik dagkaartcascade; bevestigde werkelijke tijd alleen na expliciete correctie wijzigen. |
| F20 | Extra blok invoegen: laden/lossen/rijden/winkel/onderhoud/anders met subtype en notitie | **Uitbreiden.** Zelfde categoriecontract op server, web en native; toestaan zonder fictief klantproject voor indirect werk. |
| F21 | Pauze per klus vragen, nee of duur; start kiezen, werk splitsen; pauze verwijderen | **Uitbreiden.** Benoem voorstel- versus werkelijketijdgedrag. Geen automatische lunch als bewezen gewerkte/genomen pauze. |
| F22 | Concept bewaren, dubbele tik afvangen, invoer behouden bij fout; overlap/tijdsgrenzen controleren | **Uitbreiden.** Servervalidatie, outbox, revisie en idempotentie. Lokale formuliervelden niet doorsturen als databasevelden. |
| F23 | Geplande duur versus werkelijke duur: bij meer dan 15 minuten een afwijkingsreden of overslaan | **Uitbreiden.** Vergelijk werkduur, niet alleen te laat gestart. Bewaar bronbeleid naast bestaande procentuele signaleringen. |
| F24 | Open segment wijzigen/verwijderen; ingediend segment alleen notitie aanpassen | **Bestaand/uitbreiden.** Huidige mutaties harden; audit voor uitzonderingen en correcties. |
| F25 | Dag indienen → shared klusvragen controleren → ontbrekend item openen → vergrendelen | **Uitbreiden.** Servergestuurde volledigheidscheck, atomair status+audit; geen valse blokkade door een niet-uitgevoerde klus. |
| F26 | Kantoor kiest medewerker/dag, bekijkt details, heropent en corrigeert | **Bestaand/uitbreiden.** Daginspector behouden, reden en medewerkerzichtbaarheid toevoegen, beoordeling aan revisie koppelen. |
| F27 | Eigen week én maand, dagdetails en klanttotalen | **Uitbreiden.** Web eigen week bestaat; native perioden/history op segmenten aansluiten. |

Bewijs: bron `src/util/day-plan.js:17`, `src/screens/dagvoorstel.js:167`, `src/sheets/segment-entry.js:552`, `src/sheets/deviation.js:22`, `src/screens/today.js:284`, `src/screens/week.js:238`; doel `convex/dagkaartLogica.ts`, `convex/veldLogica.ts`, `convex/urenSegmenten.ts:859`, `src/components/uren/daginspector.tsx:85`.

### 6.5 Klusuitvoering, foto's, aanhanger en voorman

| ID | Functionaliteit/flow uit de bron | Doeldekking en implementatie |
|---|---|---|
| F28 | Klus afgerond ja/nee; nee vereist reden; resterende tijd schatten | **Uitbreiden.** Bezoekterugmelding boven bestaande taakafronding/restopdracht. Resterende tijd expliciet opslaan; geen dubbele restopdracht/factuur. |
| F29 | Een collega beantwoordt; eigen uitzonderingskeuze voor afronding, aanhanger en foto | **Nieuw.** Persoonlijke delegatie en gedeeld antwoord los modelleren; onbeantwoorde gedeelde taken bij kantoor zichtbaar houden. |
| F30 | Aanhangervulling per klus met kantoorzichtbaarheid en export | **Nieuw.** Per-klusbroninformatie bewaren en koppelen aan expliciete afvalregistratie; zie hoofdstuk 4. |
| F31 | Aanvulling Ricardo: hoe vol komt de fysieke aanhanger terug? | **Nieuw, prioriteit.** Retourflow, voertuig/ploeg, geen/leeg/kwart/half/driekwart/vol, actor/tijd, offline en opvolging; niet dubbel factureren. |
| F32 | Vóór-/nafoto's maken/kiezen, meerdere uploads, fase, thumbnails/openen en foutfeedback | **Uitbreiden.** Bestaande fotoactie aansluiten op bezoekfase, uploadwachtrij en metadata. Onze dossierintegratie behouden. |
| F33 | Kantoor foto's over klussen bekijken; klant zoeken, op klusdatum filteren/resetten, uploader/uploadtijd zien en volledige foto openen | **Uitbreiden.** De huidige verborgen native Fotos-route is een stub; bouw een werkelijk gekoppelde galerie waar nodig. Doorklik naar klant/bezoek toevoegen als verbetering op de bron. |
| F34 | Voorman maakt losse kracht zonder account: naam, herkomst/platform, direct inzetbaar | **Nieuw.** Apart medewerkerrecord, actor en herkomst; later veilig aan een echt account kunnen koppelen zonder uren te dupliceren. |
| F35 | Voorman boekt tijd voor accountloze kracht, controleert overlap en bestaande registratie | **Nieuw.** Beperkte mutatie; gewerkt-door en ingevoerd-door apart. Bestaande ploegvoorstelbevestiging blijft bestaan. |

Bewijs: bron `src/components/afrond-picker.js:46`, `src/components/photo-upload.js:49`, `src/components/voorman-blok.js:34`, `supabase/migrations/20260806000037_voorman_losse_kracht.sql:105`; doel `convex/afronding.ts:50`, `mobile/components/veld/KlantblokKaart.tsx:667`, `convex/urenSegmenten.ts:1149`, `convex/schema.ts:1810`.

### 6.6 Kantoorcontrole, exports en bedrijfsvoering

| ID | Functionaliteit/flow uit de bron | Doeldekking en implementatie |
|---|---|---|
| F36 | Dag/week/maand/vrij bereik; filters medewerker/klant/type; totalen en afwijkingen | **Uitbreiden.** Bestaande Controlekamer en rapportage met eenduidige definities en paginering. |
| F37 | Indienstatus: niets/open/deels/ingediend; gepland maar geen uren apart | **Uitbreiden.** Vier bronstatussen voor migratie/diagnose; nieuwe dagmutaties voorkomen gedeeltelijk indienen. Afwezigheid is niet automatisch achterstand. |
| F38 | Maanddekking van geplande klussen per werknemer; ontbrekende bezoeken | **Uitbreiden.** Niet gelijkstellen aan indienstatus. Koppeling op bezoek-ID voorkomt valse dekking. |
| F39 | Niet-afgeronde klussen met reden en tijdschatting terug naar planning | **Uitbreiden.** Bestaande restopdrachten/werkbord; directe doorklik en traceerbaarheid. |
| F40 | Avondherinnering aan kantoor bij open/deels ingediende dagen, stil bij niets te melden | **Nieuw op bestaande infrastructuur.** Configureer datumselectie, werkdagen, Amsterdam-tijd en ontvangers; deduplicatie en afleverlog. Bronscript draait standaard droog en kijkt standaard gisteren: daadwerkelijke inzet niet bewezen. |
| F41 | Salaris-XLSX met periode/medewerkerselectie, betaald/pauze/reis; geen klantfilter | **Nieuw op segmentrapportage.** Gedeelde minutentotalen en oorspronkelijke templateformules behouden. |
| F42 | Facturatie-XLSX per klant/dag: werksoorten, ploeg, gereedmelding, stortkosten en filters | **Nieuw op segmentrapportage.** Scheid exportwerkblad van echte factuuruitgifte; onze factuurengine blijft leidend. |
| F43 | Facturatie-inhoud alles/alleen werk/werk+pauze; pauze direct of naar rato per persoon/dag | **Nieuw.** Eerst volledige dagtoerekening, daarna klantfilter; minuutrest correct verdelen. Optioneel beleid, geen wijziging van loonminuten. |
| F44 | Jaar-XLSX met klant×maand en medewerker×maand, datatabel en dekkingscontroles | **Nieuw.** Jaargrenzen, capaciteit, historische namen en één berekening per record bewijzen. |
| F45 | Formules, dropdowns, opmaak en Excel-tijdnotaties intact; expliciet falen bij rijlimiet | **Nieuw exportcontract.** Bestaande ExcelJS-installatie bewijst geen templatebehoud. Kies generatievorm na golden-fileproef; geen stil afgekapt resultaat. |
| F46 | Back-up, herstel, deployment-/RLS-/exportcontroles als operationele hulpmiddelen | **Equivalent in doelomgeving.** Eigen Convex/Storage-back-up en herstelprocedure, healthchecks en gegevenscontrole; geen bronscripts tegen ons schema draaien. |

Bewijs: bron `src/screens/dashboard.js:153`, `src/screens/indien-overzicht.js:59`, `src/util/klusdekking.js:46`, `src/sheets/uren-export.js:45`, `src/sheets/template-export.js:127`, `src/util/xlsx-template.js`, `scripts/herinnering.mjs`, `.github/workflows/herinnering.yml`; doel `convex/urenControle.ts`, `convex/export.ts:281`, `convex/notifications.ts`.

### 6.7 Protocollen en slapende functies

| ID | Functionaliteit/flow uit de bron | Doeldekking en implementatie |
|---|---|---|
| F47 | Noodcontact bellen; protocollen met aanleiding, waarschuwing, stappen, icoon en doelgroep | **Nieuw boven bestaande noodtekst.** Bibliotheek en contacten per organisatie; bereikbaar vanuit huidige noodknop, ook met gecachte data. |
| F48 | Kantoor contact/protocol maken, wijzigen, verwijderen en doelgroep bepalen | **Nieuw.** Publicatieversie/cacheversie en archief, met beheerrechten. Ordenen en activeren zijn voorgestelde doelverbeteringen; de broneditor bewaart volgorde maar biedt hiervoor geen aparte UI-acties. Gecontroleerde bedrijfsinhoud; geen persoonlijke telefoonnummers uit code hardcoden. |
| F49 | Arbeider-/voormanfilter; actuele data → cache → noodfallback | **Uitbreiden.** Offline beschikbare laatste bedrijfsversie; beperkingen/versiedatum zichtbaar. De bron is naslag, geen incidentregistratiesysteem. |
| F50 | Materiaalchecklist voor worker afvinken | **Slapend in bron, bruikbare capability.** Onze bestaande werkende materiaaldelta behouden en ontbrekende bronregels opnemen. Geen verdwenen bron-UI nabouwen. |
| F51 | Persoonlijke CSV/XLSX en oudere uitgebreide kantoor-XLSX | **Slapend in bron.** Alle onderscheidende gegevens, uitsplitsingen en CSV-mogelijkheden opnemen in onze exportlaag; via bestaande export-UX beschikbaar maken aan de juiste rollen. Geen tweede verouderd exportcentrum. |

Bewijs: bron `src/screens/protocol.js:240`, `src/screens/protocol-beheer.js:38`, `src/screens/planning.js:382`, `src/screens/week.js:111`, `src/sheets/admin-export.js:408`; doel `convex/schema.ts:632`, `convex/instellingen.ts:222`, `mobile/components/veld/NoodprotocolKnop.tsx`.

De bron bevat geen volwaardige verlof-/ziekmeldingsflow, voorraadboekhouding, betaalinning, incidentintake of fysiek aanhangerbeheer. Onze bestaande mogelijkheden hiervoor blijven behouden. Nieuwe native HR-schermen zijn geen verborgen voorwaarde om bronpariteit af te ronden; eventuele uitbreiding krijgt een eigen scopebesluit.

## 7. Bevindingen die we tijdens de overname oplossen

### In onze huidige code

1. **Native rollen lopen achter.** `mobile/hooks/use-current-user.ts:118`, `mobile/hooks/use-user-role.ts:136` en `mobile/contexts/RoleContext.tsx` gebruiken nog legacy-rollen en soms admin als fallback. Eerst canonieke rollen/capabilities en een veilige laadstatus. Dit is een geconstateerde UI-/rolmodelmismatch, op zichzelf geen bewijs van backendtoegang tot onbevoegde gegevens.
2. **Twee urenkernen.** Segmenten voeden de nieuwe veldapp; oude projecturen voeden nog andere consumenten. Zie §5.4. Dit is een hoofdafhankelijkheid, geen laatste exportfix.
3. **Segmentcorrectie valideert klantkoppeling niet overal gelijk.** `convex/urenSegmenten.ts:713` controleert gewijzigd werkitem maar mist de overeenkomstige controle op gewijzigde `klantId`. Alle referenties binnen de organisatie valideren.
4. **Kwijting kan na correctie geldig blijven.** `convex/lib/urenAfwijkingen.ts:336` trekt deze in na heropening, niet na iedere relevante segmentcorrectie. Revisiegebonden beoordeling toevoegen.
5. **Offline niet aangesloten op nieuwe velduren.** De huidige native urenflow is online; oude handlers vormen geen volledige oplossing. Zie `mobile/app/(tabs)/uren.tsx:12` en `mobile/hooks/use-offline-queue.ts:58`.
6. **Pushvoorkeuren en links lopen uiteen.** Profiel schakelt lokale voorkeuren; pushregistratie gebruikt een andere backendflow. Projectpush verwijst naar een niet-bestaande route (`mobile/hooks/use-push-notifications.ts:95`). Test gebeurtenis → ontvanger → voorkeur → juiste schermroute.
7. **Oudere mutaties hebben ruimere rechten dan nieuwe veldflows.** `convex/urenRegistraties.ts:187` en enkele HR-mutaties controleren organisatie maar niet consequent eigen medewerker. Nieuwe flows mogen daar geen omweg om de veldbeperkingen krijgen. Harden de aangeraakte routes; behandel overige HR-opruiming als expliciet nevenwerk.
8. **Bereikbaarheid is ongelijk.** Native mist overzichten die web wel heeft; materiaalman/medewerker ziet niet iedere werkroute in de sidebar. Ontwerp per rol een complete bereikbare flow, inclusief lege/fouttoestanden.

### In de bron: gewenste uitkomst overnemen, aangetroffen fouten verbeteren

- Dagvoorstel wordt met opeenvolgende losse inserts opgeslagen. Halverwege falen kan een gedeeltelijke dag opleveren. Bij ons transactioneel of als één idempotent batchcommando.
- Bronindiening vergrendelt segmenten en schrijft daarna afzonderlijk audit. Bij ons status en audit atomair.
- Bronqueue gooit afgewezen niet-netwerkmutaties na een consolemelding weg. Bij ons herstelbare conflictstatus en zichtbare gebruikersactie.
- Klussen/uren/facturatieregels worden soms op naam en datum gematcht. Bij ons vaste IDs; twee bezoeken bij dezelfde klant mogen niet samenvallen.
- Bron-dashboard behandelt materieelonderhoud anders voor factureerbaarheid dan de huidige facturatie-export. Onze rapportage krijgt één versieerbaar beleid.
- “Geen uren” en “Niet ingediend” worden in een dashboardlabel verward. Bij ons gescheiden signalen; rekening houden met daadwerkelijke planning/afwezigheid.
- Gedeelde klusantwoorden worden niet overal goed doorgegeven aan het invoerformulier. Daardoor kan een bestaand antwoord leeg lijken. Bij ons actuele gedeelde query/revisie gebruiken.
- Bij de bronresterendetijdweergave staat een mogelijke runtimefout (`src/components/afrond-picker.js:68`); lokale tests dekten die renderroute kennelijk niet. Nieuwe flowtests moeten deze tak daadwerkelijk openen.
- Bestaande materialen uit een bronklusformulier verwijderen wordt niet volledig opgeslagen. Volledige CRUD of een bewust beperktere expliciete UI, geen knop die schijnbaar slaagt.
- HERO-sync kan oude events verwijderen. Historische foto's, checks en uitvoeringsinformatie mogen bij ons niet door opschonen van de kalender verdwijnen.

## 8. Eigen gegevens en behoud van historie

De bijgewerkte opdracht gebruikt bestaande OS-medewerkers, klanten, projecten en planning. Er komt geen HERO-verbinding en er is geen historische bronappimport nodig om te testen of op te leveren. De eerdere connector en bronimporter zijn verwijderd uit de actieve app; er worden geen bronaccounts, bronplanning of bronfoto's overgezet.

Bestaande projectregistraties, dagsegmenten, klantdossiers en uitvoeringshistorie blijven behouden. De expliciete projecturenbron voorkomt dubbeltelling als onze eigen oude en nieuwe urenboeken beide gegevens bevatten. Archiveren en historische uitvoeringsbescherming blijven gelden.

De vijf importtabellen (`heroImportRijen`, `heroImportRuns`, `heroKoppelingen`, `hubHistorieBronnen`, `hubHistorieRuns`) zijn op 5 oktober 2026 uit het schema verwijderd. Ze bestonden alleen op de dev-deployment, waren daar aantoonbaar leeg (`npx convex data`) en hebben nooit op productie gestaan.

Normale back-up/herstel blijft een operationele verantwoordelijkheid van onze Convex/Storage-omgeving. Het aangepaste runbook bevat alleen die eigen back-up/restorecontrole en geen bronimportprocedure. Pilot en toestelacceptatie gebruiken onze eigen geautoriseerde werkgegevens of duidelijk gemarkeerde dev-testgegevens.

## 9. Uitvoering met een groot agentteam

### Teamindeling: 12 specialistische rollen plus één integratieleider

We verdelen het werk over onderstaande specialismen. In deze omgeving zijn vier gelijktijdige agentslots beschikbaar: **de leider + maximaal drie specialistische agents tegelijk**. Een groot team wordt dus in opeenvolgende werkblokken ingezet. Dit beperkt de scope niet; het voorkomt dat agents tegelijkertijd dezelfde schema's, routes en contracten veranderen.

| Agent | Concrete opdracht | Eigen bestanden/gebied | Afhankelijkheid en oplevering |
|---|---|---|---|
| A1 Contracten/schema | IDs, bezoekmodel, rollencontract, categorieën, revisies, DTO's, indexen | `convex/schema.ts`, gedeelde validators en contracttypes | Start eerst; enige schrijver op schema/gedeelde contracten. Oplevert datacontract en additieve migraties. |
| A2 Urenregels/backend | Voorstellen, cascade, pauzes, CRUD, afwijkingen, indienen/correcties | `convex/urenSegmenten.ts`, `veldLogica.ts`, relevante nieuwe pure helpers | Na A1; geen UI. Oplevert transactionele en geteste veldketen F16–F26. |
| A3 Eigen planning | Bezoeken, toewijzingen, klanten en klusgegevens | Eigen planbord/dagkaartbackend en kantoorcomponenten | Na A1; F07–F13, F14/F15 vervallen. |
| A4 Aanhanger/materieel | Retouren, afvaltoerekening, materiaalregels/checks | Nieuwe `convex/aanhangerRetouren.ts`, domeinhelpers; afgesproken fleetcomponenten | Na A1; eerste zichtbare prioriteit, F12/F30/F31. Geen zelfstandige factuurtrigger. |
| A5 Native medewerker | Dagvoorstel/invoer/geschiedenis/planning/klusacties in onze UX | `mobile/app/(tabs)/uren.tsx`, eigen native veld-/overzichtcomponenten | Tegen A1-contract; echte mutaties na A2/A4. F07/F16–F33. |
| A6 Web medewerker/voorman | Zelfde functies in webveld, crew- en accountloze-krachtflow | `src/components/veld/**` plus aparte voormanservice/componenten | Na rechtencontract; afstemming met A2 voor API, F29/F34/F35. |
| A7 Kantoorcontrole | Indienstatus, plandekking, correcties, achterstanden, retourinspectie | `convex/urenControle.ts`, `src/components/uren/**` | Na A1/A2/A4. Geldvrije Controlekamer behouden. F36–F39. |
| A8 Rapportage/kosten | Minutenbeleid, legacykeuze, XLSX/CSV/templates, nacalculatieconsumenten | Nieuwe gedeelde rapportagehelpers, exportlaag en toegewezen consumenten | Na A1/A2; zelfstandig eigenaar van economische mapping en golden fixtures. F41–F45/F51. |
| A9 Offline/bestanden | Eén outbox, idempotentieclient, conflictflow, caching, fotoqueue | `mobile/lib`/hooks voor sync + uploadinfrastructuur; gedeelde webadapters waar nodig | Parallel aan UI tegen contract. Wijzigt schermen via A5/A6, niet zelfstandig. F04/F05/F22/F32. |
| A10 Protocollen/onboarding | Bibliotheek, beheer, fallback, intro, voorkeuren en operationele notificaties | Nieuwe protocolservice/componenten; afgebakende profiel-/notificatiebestanden | Na rollencontract; met A9 offline fallback. F01–F06/F40/F47–F49. |
| A11 Historiebehoud/reconciliatie | Eigen urenbronnen vergelijken, back-up/herstelcontrole | Bestaande gegevens en regressietests | Geen historische bronappimport; gebruikt A8 totalen en behoudt bestaande gegevens. |
| A12 QA/security | Onafhankelijke pariteitsreview, org/roltests, E2E, platformcontrole | Integratie-/E2E-tests en reviewrapport | Doorlopend; repareert testharnas, meldt productdefecten aan eigenaar. |

De integratieleider bewaakt scope F01–F51, schema-eigendom, branchbasis, integratie, visuele schouw, besluiten en releasebewijs. Bouwagents deployen of versturen niets. Ieder werkpakket heeft eigenaar, toegestane bestanden, afhankelijke contractversie, testgevallen en een concrete demonstratieflow. Gedeelde bestanden worden niet via gelijktijdige patches aangepast. Gebruik aparte worktrees waar beschikbaar; anders streng bestandseigendom en alleen gerichte commits. Een benodigde contractwijziging gaat terug naar A1.

### Werkvolgorde en gates

| Fase | Werk | Gate voordat de volgende stap gereed kan heten |
|---|---|---|
| 0. Basis vastleggen | Actuele targetcheckout controleren; F01–F51 voorzien van scenario's; functionele keuzes en gegevensbron vastleggen; bestaande regressiebaseline | Geen onbewezen “bestaat al”; auth-testpad werkt; scope/contractversie en bestandseigendom bekend. |
| 1. Fundament | A1 + A2 + A12: rollen, referenties, bezoekidentiteit, categorieën, transactionele dag en revisies | Server kan een echte dag veilig verwerken, inclusief organisatie-/persoonsgrenzen en gelijktijdigheid. |
| 2. Eerste complete praktijkflow | A4 + A5 + A7: gepland bezoek → medewerker voert in → aanhanger retour → indienen → kantoor ziet/corrigeert | Werkende flow in onze eigen UI; gedeeld antwoord, tweede gebruiker, lege/geen aanhanger en foutgevallen bewezen. Online versie als eerste interne mijlpaal; totale offlinepariteit blijft vereist. |
| 3. Overige functionele blokken | A3/A6/A10, afgewisseld met A9: eigen planning, losse krachten, protocollen, foto's, offline, volledige persoonlijke historie | Alle medewerker-, voorman- en kantoorflows bereikbaar; adapters tegen echte contracten, geen mocks als eindoplevering. |
| 4. Rapportage en historiecontrole | A8 + A11 + A12: eigen nieuwe/legacyrapportage, drie templates, CSV en securityreview | Minuten en bedragen verklaarbaar, geen dubbeltelling, formules intact; geen bronimport als voorwaarde. |
| 5. Integratie en pilot | Leider + roulerende domeineigenaren/QA: hele weekscenario, visuele checks, echte apparaten, pilotcorrecties | Alle relevante F-ID's aantoonbaar geslaagd; kantoor kan de export controleren; geen kritieke open risico's. |
| 6. Gecontroleerde ingebruikname | Laatste delta, bron read-only, doel vrijgeven, opvolging | Rollen/accounts, historie, bestanden, planning en totalen sluiten aan; rollbackroute beschikbaar. |

Fasen zijn afhankelijkheidsstappen, geen harde kalenderbelofte. Binnen elke fase werken maximaal drie specialisten parallel; een agent kan later terugkomen voor review of integratie. Schat kalenderduur pas na fase 0 en de eerste werkende praktijkflow, omdat productiegegevens, brongebruik en testinfrastructuur nog onbekend zijn.

## 10. Acceptatie en definitie van klaar

Maak per F-ID een checklist met: actor, ingang, succespad, wijzigen/annuleren/verwijderen indien van toepassing, foutpad, offlinegedrag, serverfunctie, opgeslagen gegevens, kantoorgevolg en testbewijs. Een feature is niet klaar als alleen de UI klaar is of de backend alleen met mocks aangeroepen kan worden.

Minimale integratiescenario's:

1. **Normale dag:** toegewezen ploeg met twee klantbezoeken, laden, reizen, werk, pauze en retour; andere collega ziet gedeelde antwoorden; medewerker dient in; kantoor ziet dezelfde minuten.
2. **Afwijkende dag:** vroeger beginnen, klus duurt langer, extra winkel-/stortstop, deels werk met resttijd. Bestaande vastgezette tijden veranderen niet door nieuwe planning.
3. **Pauzerandgevallen:** begin/midden/einde, meerdere pauzes, voorstel versus opgeslagen werk, grens 23:59 en afwijzen ongeldige nachtoverschrijding; geen overlap of verdwenen minuten.
4. **Afwijkingsgrens:** precies 15 minuten versus 16 minuten, korter/langer, dezelfde duur later gestart, reden ingevuld of expliciet overgeslagen.
5. **Indienen/corrigeren:** open dag → indienen → onbevoegde create/update/delete afgewezen → kantoor heropenen/corrigeren → oude beoordeling ongeldig → opnieuw beoordelen; notitie-uitzondering apart testen.
6. **Gedeelde taken:** foto/afronding/aanhanger ingevuld door collega, delegatie door slechts één persoon, geen uren op niet-uitgevoerde klus, ontbrekend gedeeld antwoord zichtbaar bij kantoor.
7. **Aanhanger:** alle keuzes, voertuig anders dan planning, meerdere retouren op één dag, meerdere medewerkers, tussentijds lossen, concurrent conflict, correctieaudit en precies één kostenboeking per echte kostenbron.
8. **Losse kracht:** voorman maakt persoon zonder login en schrijft uren; herhaald commando maakt geen duplicaat; uren voor een bestaande accountgebruiker blijven beperkt; latere accountkoppeling bewaart historie.
9. **Offline:** zonder netwerk invoeren/foto kiezen, app sluiten/openen, netwerk terug, replay eenmaal, dag inmiddels ingediend, token verlopen, andere organisatie/account en opslagfout. Geen stil verloren werk.
10. **Eigen planning:** nieuwe/gewijzigde/geannuleerde klus, expliciete bemanning versus dagploeg en behoud van bestaande foto's/uren. Geen externe synchronisatie in de acceptatie.
11. **Rapportage:** span/geregistreerd/effectief/pauze/bron-betaald, inclusief gaten, onderhoud/laden/lossen en meerdere dagen; payrollklantfilter onmogelijk; facturatiepauze verdelen vóór klantfilter.
12. **Bestanden:** camera/gallery, vóór/na, HEIC-conversiefout, upload gedeeltelijk gelukt, metadata mislukt, opnieuw proberen, bestandstoegang van andere organisatie geweigerd.
13. **Templates:** salaris, facturatie en jaar openen correct; formules/dropdowns/opmaak blijven behouden; Excel-tijd en decimale uren/u.mm niet verwisselen; capaciteit overschrijden geeft fout; gearchiveerde identiteiten blijven herkenbaar; privénotities verschijnen niet in klantuitvoer.
14. **Protocollen:** beheer/publicatie, doelgroep, bellen, online vernieuwen, offline lezen uit laatste cache, intrekken/veranderen van inhoud zonder verouderde versie stil als actueel te presenteren.
15. **Notificatie:** juiste datum/ontvanger/voorkeur, eenmaal versturen, niets versturen zonder relevante wijziging, deeplink opent het bestaande doelrecord. Tests gebruiken testontvangers/stubs.
16. **Regressie OS:** offertes, onderhoudsbeurten, facturen, nacalculatie, klantdossier, bestaande chat, rollen en HR blijven werken. Registreren/indienen mag geen onverwachte klantmail of factuur veroorzaken.

Checks bij implementatie: `npm run typecheck`, `npm run lint`, `npm run test:run`, relevante nieuwe integratietests en gecontroleerde authenticated E2E. Bestaande auth-E2E-problemen worden eerst hersteld; native heeft nog geen aangetroffen complete testsuite, dus daar is een werkend testharnas nodig. Camera, offline herstel, biometrie, push en bruikbaarheid buiten moeten ook op echte apparaten worden geverifieerd. Visuele review vergelijkt met onze huidige UI, niet met de vormgeving van de bron.

## 11. Nog te bevestigen bedrijfskeuzes, met voorgestelde uitgangspunten

Dit zijn beslispunten voor de implementatiebriefing, geen reden om het onderzoek of het contractvoorstel stil te leggen.

| Keuze | Voorgesteld uitgangspunt |
|---|---|
| Is HERO nodig? | **Besloten: nee.** Onze eigen medewerkers/projecten/planning gebruiken; connector verwijderd. |
| Moet historie uit de andere app worden geïmporteerd? | **Besloten: geen oplevervoorwaarde.** Bestaande OS-historie blijft behouden; bronappimporter verwijderd. |
| Hoe rekent kantoor betaald/factureerbaar en pauze? | Bronberekening als aparte compatibiliteitsmaat, geen stille wijziging van onze totalen. Kantoor valideert golden exports; historie houdt toepasselijk beleid. |
| Wie meldt de aanhangerretour en wat betekent de vulling per klus? | Bestuurder/verantwoordelijke of voorman meldt eenmaal per fysieke retour. Per-klusafval blijft afzonderlijk; bedrijfsregel voor stortkosten en toerekening vastleggen. |
| Welke medewerkers gebruiken de app? | Onze bestaande OS-medewerkers en canonieke rollen; geen bronaccountmapping nodig. |
| Welke oude/slapende exports moeten bereikbaar blijven? | Onderscheidende gegevens en exportmogelijkheden behouden in onze huidige export-UX. Tijdens pilot met kantoor controleren welke templates werkelijk gebruikt worden. |

## 12. Aanbevolen eerstvolgende opdracht

Start met fase 0–2: leg contracten en rechten vast en bouw de eerste volledige medewerker→kantoorflow inclusief **aanhangerretour** in onze huidige UI. Houd F01–F51 als totale scope. Die eerste werkende keten maakt de aanpak toetsbaar, waarna de overige agents hun functies tegen bewezen contracten kunnen leveren.

Dit document bevat het oorspronkelijke onderzoek met de bijgestelde scope. Voor de inmiddels gebouwde eigen medewerkersflows en het actuele testbewijs zijn de implementatiematrix en testoverdracht leidend. Er is geen historische bronappimport of HERO-koppeling nodig voor de oplevering.
