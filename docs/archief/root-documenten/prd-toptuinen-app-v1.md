# PRD toptuinen.app — v1.0

**Datum:** 7 juli 2026
**Opsteller:** Romeo Savelberg (Sais Works), namens Y. Top Tuinen B.V.
**Voor:** Ricardo — implementatie via Claude Code
**Basis:** alleen-lezen nulmeting van de live app (7 juli 2026) + vastgestelde bouwstenencatalogus (7 juli 2026, review Romeo)
**Status:** v1.2.1 — 8 juli 2026. De bouwopdracht voor Ricardo is afgesplitst naar de losse **gap-spec** (`gap-spec-ricardo.md`); dit document is de achtergrond en onderbouwing daarbij. Planning, deadlines en HERO-uitfasering staan hier bewust niet in. Dit is geen herbouwopdracht: de bestaande calculatie-engine en aanleg-wizard blijven ongewijzigd. De fase-indeling is afhankelijkheidsvolgorde, geen prioritering — alles wordt gebouwd. Veldnamen in dit document zijn voorstellen; map ze op het bestaande schema, hernoem waar het schema al iets equivalents heeft.

---

## Leeswijzer

Dit document is de **achtergrond**: waarom de keuzes zijn zoals ze zijn, en hoe de onderdelen samenhangen. De concrete bouwopdracht staat in de losse **gap-spec** — begin daar.

**Dit is geen herbouwopdracht.** Het skelet van de app staat en werkt. Beschreven wordt wat ontbreekt en hoe de bestaande delen aan elkaar geknoopt worden. Wat werkt, blijft — expliciet inbegrepen: de bestaande onderhoud-calculatie-engine en de aanleg-wizard.

**Twee secties bepalen de rest.** §0 (principes) en §1 (fase 0: werkitem, rollen, Leads/Klanten). Fase 0 is weinig code maar alles hangt eraan; bouw het vooraf, niet parallel.

**Bijlagen zijn brondocumentatie.** A = de vastgestelde bouwstenencatalogus (startvulling voor het catalogusbeheer). B = wat HERO vandaag doet, gesorteerd op overnemen / verbeteren / bewust anders. C = nulmeting van de bestaande uren-app.

**Wat écht anders is dan een standaardpakket** — als je één ding onthoudt, dit: (1) één werkitem-record verschijnt in het klantdossier én op het planbord, nooit gekopieerd; (2) de kantoor↔klant-scheiding is een systeemeigenschap, geen werkafspraak — de knop bestaat niet en de API weigert; (3) er is geen opmaakbalk, de huisstijl zit in code; (4) een nieuwe dienst toevoegen is een record aanmaken, nooit een verbouwing.

**Veldnamen zijn voorstellen.** Map ze op het bestaande Supabase-schema; hernoem waar het schema al iets equivalents heeft.

**Klaar = de acceptatietest gehaald** (§8), niet "het scherm staat er".

**Als iets onduidelijk of onverstandig lijkt:** vraag het, bouw het niet vast. §7 is de lijst met wat wij zelf nog niet weten.

---

## 0. Context en diagnose

De app staat er breed en consistent: uniforme modules met KPI-kaarten, filters, status-tabs en export. De Offerte Builder (aanleg) is het verst ontwikkeld. Maar de keten offerte → project → planning/uren → factuur → archief draait **alleen voor aanleg**. De twee grootste gaten:

1. **Onderhoud heeft geen plannbaar object.** Contracten is een leeg omhulsel, Planning hangt uitsluitend aan projecten, uren schrijven kan alleen vanuit een project. De helft van het bedrijfsmodel (onderhoud, reiniging) heeft in de software geen drager.
2. **Het CRM stopt na de lead.** Zodra iemand klant is, is er geen centrale plek waar gelogd wordt wat er met die klant gebeurt (gebeld, geappt, offerte gestuurd, klacht, schade). Dat is de dagelijkse pijn van kantoor.

Dit document beschrijft de oplossing in vier fases, met **fase 0 als architectuurfundament dat vóór al het andere vastgelegd moet worden** — het is weinig code, maar bepaalt alles erna.

### Leidende principes (bindend voor alle fases)

1. **Eén record, twee weergaven.** Het werkitem in het CRM en de klus op het planbord zijn hetzelfde database-record. Nooit dubbele administratie.
2. **De software volgt het bedrijf.** Een nieuwe dienst toevoegen = een record aanmaken in de catalogus, nooit een verbouwing van code.
3. **Huisstijl in code, niet in knoppen.** Offertes/facturen/mails renderen uit het ttbrand-systeem. Gebruikers wijzigen inhoud (velden, tekstblokken), nooit opmaak. Er bestaan geen font- of size-knoppen.
4. **Structureel onmogelijk in plaats van goed opletten.** De kantoor↔klant-scheiding is een systeemeigenschap (rechten + gescheiden objecten), geen werkafspraak.
5. **Alles logt automatisch op de klanttijdlijn.** Handmatig loggen is de aanvulling, niet de basis.
6. **Leermodus.** Elk veld met rekenlogica krijgt een (i)-toelichting van maximaal twee zinnen (voorbeeld: margefactor, §2.5b).
7. **Handmatig fundament eerst, AI-lagen daarna.** Fase 1 verzamelt de schone data waar fase 3/4-intelligentie op draait.

---

## 0b. Volgorde van bouwen

**Alles in dit document wordt gebouwd.** De fase-indeling is afhankelijkheidsvolgorde, geen prioriteitenlijst: fase 0 is fundament (het werkitem moet bestaan voordat er een planbord op kan), de catalogus moet er zijn voordat er contracten uit rollen, en de AI-lagen hebben eerst een seizoen echte data nodig. Binnen die randvoorwaarden bepaalt Ricardo tempo en indeling.

Planning, deadlines en de HERO-uitfasering staan bewust **niet** in dit document; die worden apart afgestemd tussen Romeo, Yannick en Ricardo. De bouwopdracht voor Ricardo is de losse **gap-spec** — dit document is de achtergrond daarbij.

**Dit is geen herbouwopdracht.** Het meeste staat er al. Wat hier beschreven wordt zijn de ontbrekende stukken en de koppelingen ertussen. Wat werkt, blijft — expliciet inbegrepen: de bestaande onderhoud-calculatie-engine en de aanleg-wizard.

---

## 1. Fase 0 — Architectuurfundament

### 1.1 Werkitem-entiteit

Eén entiteit `werkitem` met een `type`-veld:

- `project` (aanleg) — bestaat de facto al als "Projecten". Blijft in de UI **Project** heten.
- `onderhoudsbeurt` — **nieuw**. De losse beurt (snoeibeurt, voorjaarsbeurt, reinigingsbeurt). Heet in de UI **Onderhoudsbeurt**. Ontstaat uit een contract (§2.1) of wordt los aangemaakt.

De gebruiker ziet het woord "werkitem" nooit; dat is de interne verzamelnaam.

Gedeelde kernvelden (voorstel):

| Veld | Toelichting |
|---|---|
| `id`, `klant_id`, `type` | verplicht |
| `titel` | bv. "Voorjaarsbeurt 2026", "Aanleg achtertuin" |
| `status` | project: gepland / in uitvoering / afgerond / nacalculatie (bestaat al). beurt: gepland / uitgevoerd / gefactureerd / vervallen |
| `geplande_start`, `geplande_eind`, `team_id` | nullable; gezet door het planbord |
| `geschatte_uren` | uit offerte/receptuur |
| `offerte_id`, `factuur_id`, `contract_id` | nullable koppelingen; `contract_id` alleen bij beurten |
| `adres` | default = klantadres, overschrijfbaar |

Projecten behouden daarnaast de eerder gespecificeerde grondverzet-velden (`ontgraven_volume_m3`, `mba_status`, `dso_referentie`) — toevoegen als die nog niet in het schema staan.

**Geen vrij notitieveld op het werkitem.** Notities gaan via de tijdlijn (§2.3), anders ontstaan er twee waarheden.

### 1.2 Rollenmodel + kantoor↔klant-scheiding

Rollen: `kantoor` (Yannick, Mickey, Romeo, Elke), `voorman`, `medewerker`, `klant`. (ZZP-variant van medewerker volgt met de HR-module, fase 3.)

Bindende regels, af te dwingen met Supabase RLS-policies:

- Alleen `kantoor` heeft de capability *versturen naar klant* (mail, portaalbericht). Voor andere rollen **bestaat de verstuurknop niet in de UI** en weigert de API het.
- `klant` ziet uitsluitend het eigen dossier (RLS op `klant_id`).
- **Interne threads en klantthreads zijn twee gescheiden objecten/tabellen** — niet één thread met een zichtbaarheidsvlag. Een query-fout mag nooit interne communicatie kunnen lekken.

Dit rollenmodel moet staan vóórdat het klantenportaal (fase 2) gebouwd wordt, en vóórdat de bestaande Chat-module wordt omgebouwd (§2.3) — juist omdat die chat er al is, is het lekrisico anders reëel.

### 1.3 Leads en Klanten scheiden

- Twee aparte menu-items: **Leads** (het bestaande kanban-bord, potentiële klanten) en **Klanten** (bestaande klanten).
- De teller-badge toont daarna het juiste aantal per item (lost het verwarrende "45" op).
- Lead → kolom Gewonnen = promotie naar klantrecord + aanmaak eerste werkitem of offerte. Geen dubbele records: de lead wórdt de klant.
- Klanten-kanban (wens Yannick): eerste opzet met kolommen *actief contract / lopend project / slapend / aandacht nodig*. **Eerst toetsen bij Mickey** (§7.1) — mogelijk dekt het cases-bord (§2.4) deze behoefte al en kan dit simpeler.

---

## 2. Fase 1 — De kern werkend maken

### 2.1 Onderhoudscontract → beurtengenerator, en de losse beurt

Onderhoud kent **twee vormen**, allebei zichtbaar als losse regels op de klantkaart:

**A. Onderhoudscontract** — de bestaande (lege) Contracten-module wordt de motor:

- Contract bevat: klant, gekozen bouwstenen uit de catalogus (bijlage A) met **frequentie per bouwsteen**, prijs per beurt, looptijd, opzegtermijn, en een zichtbare **indexatieclausule** (AV V2.0 art. 5.3, geldt bij looptijd > 3 maanden).
- **Facturatiemodus per contract** (veld, drie opties): (1) **per bezoek** — elk afgerond bezoek genereert een deelfactuur met de uitgevoerde beurten van die dag als regels (default; voorbeeld: contract met 15 maaibeurten + 15 borstelrondes); (2) **maandelijkse verzamelfactuur** van alle uitgevoerde beurten in die maand; (3) **vast maandbedrag** (jaarprijs ÷ 12, los van uitvoering). Voedt de facturatie-engine (§2.8).
- **Generator:** bij activeren van het contract worden beurten (werkitems type `onderhoudsbeurt`) aangemaakt voor een rollende planningshorizon van 12 maanden, met inachtneming van het seizoensvenster per bouwsteen. Nachtelijke job vult de horizon aan.
- Gegenereerde beurten landen ongepland in de **planbord-wachtrij** (§2.2).
- Geaccepteerde onderhoud-offerte → voorgevuld concept-contract (één klik activeren).

**B. Losse beurt (zonder contract)** — veel klanten hebben geen contract maar wel een ritme: 1× per jaar een snoeibeurt, 3× per jaar een onderhoudsbeurt. Dit is géén contract en mag er ook niet één worden.

- Een losse beurt is een `onderhoudsbeurt` direct onder de klant, met eigen bouwstenen, prijs en optioneel een **ritme** (aantal keer per jaar, of een terugkeerpatroon zoals "elke 2 weken", met seizoensvenster).
- Zonder ritme: eenmalig. Met ritme: het systeem weet wanneer de volgende aan de beurt is, maar plant hem **niet automatisch in** — de klant moet er meestal eerst mee instemmen (zie de attendering hieronder).
- Op de klantkaart staan losse beurten en contracten naast elkaar, elk als eigen regel met eigen historie, offerte en facturen. Nooit samengevoegd.

**Planningsattendering (nieuw).** Zodra het moment nadert dat een beurt gepland moet worden — het seizoensvenster opent, of het ritme geeft aan dat het weer tijd is — verschijnt er automatisch een **taak voor kantoor**: "Snoeibeurt klant X inplannen — venster opent over 14 dagen."

- De taak verschijnt op het cases-/takenbord (§2.4) met de klant, de beurt en de reden.
- Vanuit de taak kan kantoor met één klik de **inplan-mail** naar de klant sturen (sjabloon uit §2.7, standaard: bevestiging vragen + voorstel voor een periode).
- Reageert de klant, dan wordt de beurt aangemaakt/vrijgegeven en verschijnt hij in de planbord-wachtrij.
- Instelbaar per beurt: hoeveel dagen vooraf, en of de attendering wel of niet nodig is (klanten met een contract hoeven meestal niet bevestigd te worden).
- Zonder reactie na X dagen: de taak escaleert (blijft staan, kleurt op). Geen automatische mails naar de klant zonder dat kantoor kijkt — de kantoor↔klant-regel blijft gelden (§1.2).

Dit mechanisme draait op dezelfde vervallogica-engine als certificaten en APK's (§3.3): item + datum + waarschuwtermijn + ontvanger. Fase 1 bouwt de eenvoudige versie (taak + mailknop); de engine zelf wordt in fase 2 gegeneraliseerd.

### 2.2 Planbord (module Planning)

Twee weergaven op dezelfde data (principe 1): het **weekbord** voor het overzicht en de **route-dagkaart** voor de dag zelf. Een "route" is geen aparte entiteit maar de geordende werkitems van één team op één dag, aangevuld met standaardblokken.

**Weergave 1 — weekbord (resource-timeline):** rijen = teams/voormannen, kolommen = dagen. Tijdvensters: dag / 3 dagen / week / 14 dagen / 4 weken / maand (de bestaande periodetoggle wordt functioneel).

- Slepen = verplaatsen (dag/team), randen trekken = duur aanpassen.
- **Dupliceren naar een andere dag met behoud van teamsamenstelling en tijden** (expliciete wens Yannick).
- Splitsen van een klus over meerdere dagen of teams.
- **Wachtrij-zijbalk ("opdrachtenbak")** met ongeplande werkitems: projecten uit geaccepteerde offertes, gegenereerde beurten én afgesplitste rest-taken (§2.6). Slepen uit de bak = plannen; een werkitem uit het bord halen (min-knop of terugslepen) = terug in de bak.
- Terugkerende beurten verschijnen in de bak **alleen in de weken waarin ze relevant zijn** (frequentie + seizoensvenster uit het contract, §2.1).
- **Ziekte/uitval-scenario:** team van een dag loskoppelen → alle opdrachten van die dag in één keer terug in de bak om te herverdelen over andere teams.
- Bij het plannen van een dag filtert de bak op **beschikbaarheidsvenster van de klant** (bv. "alleen donderdag", datumbereik) en toont het **voorkeursteam** — twee nieuwe velden op klant/werkitem (de vaste hovenier kent de tuin).
- **Afwezigheidsblokken** (verlof, ziekte, feestdag) als niet-klant-blokken die capaciteit blokkeren — fase 1 handmatig geplaatst, vanaf fase 3 gevoed door de HR-module.
- **Geen iCal-brug.** Besluit Romeo (8 juli 2026): harde overstap, de app wordt de enige agenda. Communiceer vooraf naar het team dat de HERO-feed uit Google Calendar verdwijnt op de overstapdatum.
- Teams zijn echte entiteiten met een **bemanning per dag** (wie zit vandaag in team 1) — nodig voor uren per persoon en zichtbare individuele afwezigheid. Bewust anders dan HERO, waar "team" slechts een kleurlabel is los van de toegewezen medewerkers (bijlage B).

**Weergave 2 — route-dagkaart (één team, één dag, chronologisch — spec Mickey):**

- Kop: datum + toegewezen team (loskoppelbaar/omwisselbaar).
- Rijen van boven naar beneden: vertrek loods → reistijdblok → klantblok → pauze → klantblok → … → loods-afsluitblok (aanhanger/afval legen, materieel verzorgen, defecten melden → koppelt aan Machinepark §3.3) → einde-dag-check.
- **Klantblok = één geheel:** klant, adres, bijzonderheden en de taken (bouwstenen van die beurt, elk met code en normtijd) reizen mee bij verplaatsen, omwisselen of kopiëren. Eén taak kan uit het blok worden losgemaakt en apart in de bak gezet.
- **Tijdcascade:** reistijden tussen stops worden berekend (Google Maps Distance Matrix); past de planner een tijd of duur handmatig aan (+15 min bij een klus), dan schuift alles erna automatisch door. Handmatige correcties blijven altijd leidend.
- **Standaardblokken** (vertrektijd loods, pauze, loods-afronding) zijn instelbaar en worden bij het aanmaken van een dag automatisch geplaatst.
- Dit is tegelijk de **dagkaart van de voorman** (mobiel): taken afvinken (§2.6), meerwerk melden (§2.6), veldtaken uit meldingen (§2.4), route-knop met materiaalcheck (§2.6).

**Dagregie vs. plannen:** dezelfde dagkaart in twee modi — **Vandaag** (live regie: vinkjes en statussen van de voormannen komen binnen, kantoor stuurt bij) en **Planvenster** (morgen en verder). Geen twee systemen; één schakelaar met datumkeuze.

**Gedrag:**
- Plannen zet `team_id` + datums + volgorde op het werkitem en logt automatisch een tijdlijn-event ("Ingepland: team 1, 14 mei").
- Seizoensvenster-bewaking: plannen buiten het venster van een bouwsteen geeft een **waarschuwing, geen blokkade**.
- Wijzigingen verschijnen stil op de dagkaart van het team, zonder notificatie-spam.

**Techniek:** weekbord starten met **DayPilot Lite** (open source, Apache-licentie; ondersteunt wachtrij→bord-slepen, meerdaagse events, undo/redo); de route-dagkaart is een eigen lijstcomponent op dezelfde data. Abstraheer de databinding (events/resources als eigen adapter) zodat een latere wissel naar bv. Bryntum geen datamigratie vergt.

**Route-intelligentie gefaseerd:** fase 1 = reistijdberekening + tijdcascade + handmatig ordenen; fase 2 = "stel volgorde voor"-knop (eenvoudige heuristiek, planner beslist); volautomatische volgorde-optimalisatie en herplanning = fase 4 (§4.4). Bewust zo: de praktijkervaring (Connexxion) leert dat de realiteit afwijkt van wat de rekenmachine denkt — de planner houdt de regie, het systeem rekent en schuift.

**Volgorde:** de AI-lagen (§4.4) bouwen voort op dit handmatige bord — ze hebben eerst een seizoen schone data nodig (geocodeerde adressen, echte klusduren, wie-kan-wat). Audit-logging van planwijzigingen hoort wel meteen bij het bord zelf.

### 2.3 Klanttijdlijn (ombouw van de Chat-module)

Per klant één doorzoekbare tijdlijn. Entry-velden: auteur, timestamp, **kanaal** (telefoon / whatsapp / e-mail / intern / systeem), tekst, optioneel `werkitem_id`, optioneel `melding_id`, bijlagen (foto's).

- **Auto-events** vanuit het systeem: offerte verzonden/geaccepteerd, ingepland, beurt afgerond, factuur verzonden/betaald, melding aangemaakt/status gewijzigd, contract geactiveerd.
- Filters: per werkitem, per kanaal. Vrij zoeken.
- Het vrije **Notities-veld op de klantkaart wordt uitgefaseerd**; bestaande inhoud migreert als één tijdlijn-entry ("genoteerd vóór tijdlijn"). Eén waarheid.
- De bestaande Chat-tabs **Team / Mededelingen / DM blijven interne chat**. De tabs **Klanten / Projecten worden weergaven van de tijdlijn** — zelfde data, andere ingang, géén tweede opslag.
- WhatsApp: fase 1 handmatig (kanaal-tag + samenvatting/plak). Business-API-koppeling is fase 3+ (§4.3). E-mail wordt in fase 3 automatisch gekoppeld via de Gmail API.

**Acceptatie ("Pietje-test"):** kantoor beantwoordt "wie heeft wat met klant X besproken, wanneer, via welk kanaal, over welke klus" binnen 30 seconden.

### 2.4 Meldingen / cases — intern bord

Nieuw object `melding`:

| Veld | Toelichting |
|---|---|
| `klant_id` | verplicht |
| `werkitem_id` | optioneel ("klacht over de voorjaarsbeurt") |
| `type` | serviceverzoek / klacht / **schade** |
| `kanaal` | telefoon / whatsapp / e-mail / portaal / intern |
| `omschrijving`, `fotos` | |
| `eigenaar` | **precies één, verplicht** — dit beantwoordt "wie pakt dit op" |
| `status` | nieuw / in behandeling / wacht op derden / opgelost |
| `aangemaakt_door`, `deadline` | deadline optioneel |

- **Bord** met de vier statuskolommen + filter "mijn cases". Teller-badge in het menu.
- **@tag van een medewerker** (bv. @Michel) maakt een veldtaak die automatisch op diens dagkaart verschijnt **zodra zijn team bij die klant gepland staat** (koppeling met planbord). Zijn antwoord landt in de interne case-thread; alleen kantoor koppelt terug naar de klant.
- Elke melding en elke statuswissel logt automatisch op de klanttijdlijn.
- Een melding kan **promoveren tot werkitem** (bv. klacht → herstelbeurt) met behoud van de koppeling melding↔werkitem.
- Routing-defaults: klacht → eigenaar kantoor; serviceverzoek → beoordeling planning-wachtrij; schade → kantoor + verzekeringsvlag.
- Fase 1 = alleen interne aanmaak. Klant-instroom via het portaal volgt in fase 2 op **hetzelfde object en hetzelfde bord**.

### 2.5 Offertes — herprioritering

**Twee routes, één uitgang (besluit Romeo, 8 juli 2026).** Offertes maken kan op twee manieren, naar keuze van de opsteller:

- **Route 1 — gestructureerd (de bestaande engine).** De onderhoud-wizard met pakketten, bouwstenen en frequenties (§2.5a). Snel, consistent, genereert automatisch contract en beurten. De standaardroute voor onderhoud.
- **Route 2 — vrij (HERO-stijl).** De regel-editor: artikelen uit het bestand aanklikken of vrije regels typen, prijs en marge per regel (§2.5b). Voor alles wat niet in een pakket past: aanleg, eenmalige klussen, maatwerk.

Beide routes produceren **hetzelfde offerte-record en hetzelfde gerenderde document** (ttbrand). De vrijheid zit uitsluitend in de *inhoud* — regels, teksten, prijzen — nooit in de *opmaak* (principe 3) en nooit in wat er uit de keten komt.

**Overgang naar de keten bij acceptatie (geldt voor beide routes).** Een geaccepteerde offerte moet altijd uitmonden in werkitems, anders staat er getekend werk dat nergens ingepland of gefactureerd wordt:

- Route 1: contract + gegenereerde beurten (§2.1), automatisch.
- Route 2: bij accepteren koppelt kantoor de regels aan één of meer werkitems. Regels die zijn gekoppeld aan een bouwsteen mét frequentie kunnen alsnog een contract met beurten vormen; overige regels worden een eenmalig project of een losse onderhoudsbeurt.
- Een offerte kan nooit op "geaccepteerd" zonder ten minste één werkitem. Dit is een harde validatie, geen herinnering.

**a) Onderhoud-wizard uitbreiden met de bouwstenencatalogus (bijlage A).**
Bovenin drie pakket-tegels: **Onderhoud Tuin / Reiniging / Compleet**. Daaronder bouwstenen als aan/uit-regels met per bouwsteen een frequentie; de builder rekent frequentie × prijs per beurt automatisch door naar jaarprijs en maandbedrag. Reiniging is een **receptuur met vaste stapvolgorde** (borstelen → reinigen → invegen) en een **zand-keuzeregel** met twee prijzen (onkruidvrij voegzand / straatzand). De catalogus is data (principe 2): bouwstenen beheren = records beheren.

**Prijsmodel (besluit Romeo, 8 juli 2026).** Per bouwsteen twee mogelijkheden, en de prijs is op elke regel handmatig overschrijfbaar:
- **Uurbasis** (default): geschatte uren × **uurtarief**, nu €65 ex btw. Het uurtarief is een **instelling** met ingangsdatum, geen hardcoded getal.
- **Vaste prijs**: een vast bedrag per beurt (bv. een standaard reinigingsbeurt of maaibeurt).

Normuren per bouwsteen zijn **optioneel** en dienen alleen als hulpsuggestie bij de urenschatting. Ze worden niet vooraf ingevuld maar groeien uit de nacalculatie-loop (§3.4): na één seizoen echte urendata weet het systeem wat een bouwsteen daadwerkelijk kost. Tot die tijd schat de mens en rekent de app. Ditzelfde geldt voor de kostenregels (afvoer, voorrijkosten, minimum-bezoektarief) — vaste bedragen, instelbaar.

**De bestaande onderhoud-calculatie-engine blijft zoals hij is.** Deze paragraaf beschrijft geen herbouw: alleen de catalogus-vulling, het prijsmodel en het beheerscherm (§2.5f) komen erbij. Ricardo: niet refactoren wat werkt.

**f) Catalogusbeheer — tarieven in de app, niet in een document (besluit Romeo, 8 juli 2026).**
Geen import van een extern bestand: de bouwstenen en tarieven worden **in de app zelf ingevuld en beheerd** door kantoor. Één beheerscherm onder Instellingen, zichtbaar voor de kantoor-rol:

- Lijst met bouwstenen, gegroepeerd per categorie (bijlage A is de startvulling — 23 records, eenmalig invoeren).
- Per bouwsteen: naam, **code** (kort, bv. HS), categorie, soort, **prijsmodel** (op uren / vaste prijs), uren óf vast bedrag, default frequentie per jaar, seizoensvenster, btw-code, actief-vlag, optionele opmerking.
- Bij "op uren" toont het scherm de uitkomst live: uren × uurtarief (leermodus, principe 6).
- **Uurtarief** als aparte instelling met ingangsdatum; historische offertes en contracten behouden het tarief dat gold op hun datum.
- Nieuwe bouwsteen toevoegen = record aanmaken. Geen code, geen deploy (principe 2).
- Prijswijziging = nieuwe waarde met ingangsdatum; lopende contracten volgen de indexatieclausule (§2.1), niet de nieuwe tarieflijst.

De UI-spec voor dit scherm ligt klaar als werkend HTML-prototype (`mickey-onderhoud-prijzen-tijden.html`): veldindeling, uur/vast-schakelaar en live-berekening zijn daarin uitgewerkt. Ricardo kan dit als referentie gebruiken.

**b) Vrije offerte- én factuur-builder** (HERO-simpel; dezelfde regel-editor maakt offertes én losse facturen):
- Regels met product/dienst: **aanklikken uit het artikelbestand vult de regel direct** met naam, eenheid, inkoopprijs en btw-code (vrije regel kan ook) — daarnaast aantal, **marge %** en verkoopprijs, live doorgerekend.
- De artikel-picker toont per artikel naam, prijs, korte omschrijving én een **gebruiksteller** ("116× gebruikt"), gesorteerd op meest gebruikt — zo staan de veelgebruikte regels altijd bovenaan.
- **Tekstblokkenbibliotheek** voor aanhef, voorwaarden en standaardteksten: inhoud herbruikbaar en beheerbaar door kantoor, opmaak ligt vast in de template. **Startvulling:** de bestaande standaardteksten uit HERO (offerte-, factuur- en e-mailteksten) overnemen — als **platte tekst**, opmaak bewust achterlatend.
- Naast de regels een live **overzichtsblok**: posten, werkuren, inkoop, marge (€ en %), netto en bruto — meerekenend tijdens het bouwen.
- Margefactor = 1 ÷ (1 − marge). (i)-toelichting bij het veld: *"30% marge → ×1,43 · 40% → ×1,67. Let op: 40% opslag óp inkoop (×1,40) lijkt hetzelfde maar is maar 28,6% marge."*
- Hoofdstukken met subtotalen; korting per regel en op totaal.
- **Btw-code per regel**: 9% (levende planten/sierteelt) / 21% (arbeid, materialen). Btw-code is een veld op het product.
- Output rendert uit ttbrand (principe 3). **Er is géén opmaakbalk**: lettertype, groottes en indeling liggen vast in de template. De HERO-praktijk van drie lettertypen in één offerte is hiermee structureel onmogelijk, niet slechts afgeraden.

**c) Productbestand** onder de bestaande **Leveranciers-module**: producten met leverancier, inkoopprijs, eenheid, btw-code, actief-vlag en een **gebruiksteller**. Import van leverancierslijsten via kolommapping (voorbeeldbestand nodig, §7.4), mét **ontdubbeling en validatie**: waarschuwing bij near-duplicates, en geen marge-berekening op inkoopprijs €0 zonder expliciete "prijs op regel"-vlag (voorkomt HERO's "Infinity%"). Migratiestap: HERO's artikelmaster (492 artikelen) eerst exporteren en **schonen** — die staat vol dubbelen, spelfout-varianten en €0-prijzen (bijlage B) — en dan pas importeren. Artikelbeheer beleggen bij een klein aantal mensen.

**d) Aanleg-wizard blijft ongewijzigd** (werkt, geen doorontwikkeling nodig). Aanlegoffertes kunnen ook via route 2 (de vrije builder) — dat dekt maatwerk zonder extra bouwwerk. De AI-intake bouwt later op deze wizard voort (§4.1).

**e) Auto-save wizard:** mag blijven, maar concepten tellen niet mee in pipeline-KPI's, er komt een zichtbare indicator "concept opgeslagen", en een opruimactie voor verweesde concepten (zie ook §5.3).

**Acceptatie (schaduw-offerte):** Mickey bouwt dezelfde onderhoudsofferte in de app en op zijn huidige manier; uitkomsten worden naast elkaar gelegd tot de afwijking verklaard en acceptabel is.

### 2.6 Uren op beurten, ochtendcheck + afrondingsflow

**Bestaande veld-app:** de losse uren-app "Top Tuinen Hub" (toptuinen-uren.vercel.app) wordt **nagebouwd als veld-rol binnen toptuinen.app**, op dezelfde database — besluit Romeo, 8 juli 2026. Geen aparte app, geen eigen klanten, geen eigen HERO-sync. De bestaande app blijft draaien tot de veld-rol live is en wordt daarna uitgezet. Haar bewezen flows (hieronder) zijn de spec voor de herbouw; bijlage C bevat de volledige nulmeting.

- Urenregistratie mogelijk op **elk werkitem** (nu alleen op projecten).
- **Urensegmenten:** een werkdag bestaat uit segmenten met categorie (werken / pauze / reistijd / teammeeting / onderhoud materiaal / **afvalverwerker (BES)** / anders), begin- en eindtijd en een koppeling aan een werkitem. Het BES-segment (rit naar en lossen bij de afvalverwerker) koppelt aan het werkitem of de klant waar het groenafval vandaan komt, zodat de werkelijke afvoertijd naast de gefactureerde afvoerkosten komt te staan (bouwsteen 21, bijlage A) en meeloopt in de nacalculatie (§3.4). Valt er niets toe te wijzen, dan gaat het als indirecte tijd naar het loods-afsluitblok (§2.2). De dagkaart (§2.2) **vult segmenten voor**: geplande reistijd-, pauze- en klantblokken worden voorgestelde segmenten die de medewerker alleen bevestigt of corrigeert — loggen wordt bevestigen. De losse werktype-labels uit de Hub vervallen: het werkitem draagt het type al.
- **Dag indienen:** de medewerker dient de dag in; kantoor kan een ingediende dag heropenen en corrigeren (met audit-log) — bestaande Hub-flow.
- **Achterstanden & afwijkingen:** een **achterstand** is een gepland bezoek waarvoor helemaal niets gelogd is; een **afwijking** is wel gelogd maar wijkt af van de geplande tijd, boven een instelbare drempel (voorstel: >15 minuten of >20%) — beide definities zijn een aanname, te bevestigen door Mickey. Beide verschijnen op een kantoor-widget **"Wie is achter"**. Dit bewaakt de volledigheid waarop de facturatie-engine (§2.8) en de nacalculatie-loop (§3.4) draaien: wat niet gelogd is, wordt niet gefactureerd.
- **Foto's per opdracht** landen als bijlage op de klanttijdlijn bij het werkitem (§2.3).
- **Route-knop** op de dagkaart/het werkitem: toont eerst de **materiaaldelta-checklist**, daarna pas door naar Maps.
- Delta = (materiaal/machine-koppeling van de geplande bouwstenen — dezelfde receptuurdata als de offerte) mínus (standaardinventaris van de bus, vastgelegd per bus in Vloot/Voorraad). Voorbeeld: standaardbus heeft alles behalve grasmaaier → checklist toont alleen "grasmaaier".
- Afvinken wordt gelogd (wie, wanneer) — geen discussie achteraf, wel een leerpunt.
- **UX-eisen veld:** "Buiten"-modus voor fel daglicht (bestaat in de Hub, behouden) en het **noodprotocol** als vaste snelkoppeling in de veld-app; de inhoud ervan wordt beheerd in de SOP-bibliotheek (§4.2), de veld-app is een weergave.
- **Excel-urenexport** blijft bestaan tot de loonaanlevering aan Hans anders geregeld is.

**Afrondingsflow (einde klus, in de veld-app) — op taakniveau:** elk werkitem bestaat uit taken (de bouwstenen van die beurt, elk met code en normtijd). Bij het uitklokken ziet de voorman de takenlijst en zet per taak een status: **afgerond ✓ / begonnen-niet-af ◐ / niet gestart ○**, met optioneel een korte notitie.
- **Alles afgerond** → werkitem `uitgevoerd`, auto-event op de tijdlijn, door naar de facturatie-engine (§2.8). Er zit geen tussenpersoon meer in deze stap.
- **Eén of meer taken niet af (◐ of ○)** → die taken worden **automatisch afgesplitst als rest-opdracht**, mét klantmetadata en resterende normtijd, en verschijnen met een rest-label in de wachtrij (§2.2). Het werkitem sluit als `deels uitgevoerd`; het uitgevoerde deel gaat wél door naar facturatie volgens de facturatiemodus. Kantoor ziet exact wát er nog moet én hoeveel uur, en plant het rest-blokje goedkoop bij.
- **Meerwerk ter plekke** kan alleen ná akkoord van planning: de voorman stuurt vanuit de dagkaart een meerwerk-verzoek (taak + geschatte tijd); planning keurt goed (tijd erbij, cascade schuift door) of zet het als nieuwe opdracht in de bak voor een beter moment.

### 2.7 Transactionele mails

Eén tabel `mail_triggers`: **event → sjabloon → vertraging → ontvanger**. Nieuwe mails toevoegen = record toevoegen, geen code (principe 2).

Fase 1-events: lead ontvangen via website (ontvangstbevestiging: "aanvraag ontvangen, binnen X uur reactie"), offerte verzonden, inplanning bevestigd (optioneel per klant), offerte-opvolging na Y dagen, en de **inplan-mail** bij een planningsattendering (§2.1: "het is weer tijd voor uw snoeibeurt — schikt periode X?"). Sjablonen in huisstijl; tekstblokken beheerbaar door kantoor, met de bestaande HERO-standaardteksten als startvulling (platte tekst). Mails naar klanten worden altijd door kantoor verstuurd of goedgekeurd, nooit volautomatisch (§1.2).

### 2.8 Facturatie-engine onderhoud — "Te versturen"-wachtrij

Sluit de keten contract → beurt → uitvoering → factuur zonder tussenpersoon, maar mét een laatste menselijke check:

- Een afgeronde beurt (§2.6, antwoord "Ja") genereert **automatisch een concept-factuur** volgens de facturatiemodus van het contract (§2.1): per bezoek één factuur met de beurten van die dag als regels, óf toevoeging aan de maandverzamelfactuur, óf geen actie (vast maandbedrag draait op eigen schema).
- Concepten landen in een filter **"Te versturen"**. De factuurstatus wordt gesplitst in twee velden (HERO-pariteit, bijlage B): **documentstatus** (concept → definitief → verzonden) en **betaalstatus** (open → gedeeltelijk betaald → betaald / vervallen / geannuleerd) — de enkele statusflow uit de nulmeting wordt hierop aangepast, want deelbetalingen passen niet in één keten. Kantoor doet de laatste check en verstuurt, ook in bulk.
- Elke factuur krijgt naast de factuurdatum een **datum van dienst** (uitvoeringsdatum van de beurt) en een koppeling naar referentiedocument (offerte/contract) én werkitem.
- **Default is human-in-the-loop.** Per contract komt een toggle **"direct versturen zonder check"** voor klanten/contracten waar dat vertrouwd is — bewust als latere stap, want één verkeerde automatische factuur kost een creditnota en klantvertrouwen.
- Verzonden/betaald logt automatisch op de klanttijdlijn (§2.3) en voedt de debiteurenladder (§3.2).
- **Randvoorwaarde:** dit vereist dat onderhoudsfacturen in de app leven — daarmee is dit hét concrete argument in de HERO-migratiebeslissing (§7.2) om minimaal de onderhoudsfacturatie naar de app te halen.

---

## 3. Fase 2

### 3.1 Klantenportaal

- Klant-rol login (particulier en zakelijk zien technisch hetzelfde). Klant ziet: eigen werkitems + status, facturen, eigen meldingen.
- Klant kan een **melding indienen** (serviceverzoek of klacht, met foto's) → landt op hetzelfde cases-bord van §2.4, met automatische ontvangstbevestiging via §2.7.
- **Klantthread** per werkitem/melding: visueel onmiskenbaar anders (banner "ZICHTBAAR VOOR KLANT", afwijkende achtergrondkleur). Versturen kan alleen door kantoor; de composer staat **standaard op intern** — extern sturen vergt twee bewuste handelingen.

### 3.2 Debiteurenladder

- Regels: factuur verzonden dag 0 → herinnering dag 14 → tweede herinnering dag 21 → dag 28 automatische **taak voor Elke** (bellen/aanmaning). Elke stap logt op de klanttijdlijn.
- Elke trede is instelbaar (interval in dagen, eigen e-mailsjabloon, escalatietype) — maar met 3–4 heldere treden in het Nederlands, niet HERO's zes half-Duitse niveaus (bijlage B).
- De ladder draait **automatisch dagelijks**; HERO's handmatige "herinneringsrun"-knop vervalt. Per factuur kan kantoor het proces altijd pauzeren of overslaan (bv. bij een betalingsafspraak).
- Het openstaande-postenoverzicht toont per factuur **"verschuldigd sinds"** met ouderdomsbadge en aanmaanniveau — de lijst ís het debiteurenoverzicht.
- **Betalingsregistratie** ondersteunt deelbedragen (betaalstatus "gedeeltelijk betaald"). Fase 2 handmatig; **bankkoppeling/reconciliatie** als fase 3-kandidaat (§7.6) — HERO heeft geen bankkoppeling, en 255 facturen handmatig afletteren is precies de achterstand die we willen voorkomen.
- **Randvoorwaarde:** de debiteurenladder werkt pas als de facturen in de app leven (§2.8). Dat is de enige afhankelijkheid.

### 3.3 Machinepark + generieke vervallogica-engine

- De dashboard-widget "Vloot & Materieel" wordt een echte module: machines en bussen, kleurcode per team, status (rood = kapot → beïnvloedt beschikbaarheid op het planbord), **standaardinventaris per bus** (input voor §2.6).
- **Middelen als planbare resource:** schaars materieel (hoogwerker, kraan) kan aan een werkitem worden gekoppeld; dubbel claimen op dezelfde dag geeft een waarschuwing op het planbord (HERO-pariteit "bronnen", bijlage B).
- Generieke engine `verval_items`: item, type (APK / keuring / certificaat / verzekering), vervaldatum, waarschuwtermijn, ontvanger-rol → melding + optioneel automatische plantaak. Voorbeeldgedrag: *"Michel, over 20 dagen moet de bus naar de APK. Staat in de planning; jij brengt hem."* Dezelfde engine bedient later de certificeringen in HR (§4.2).

### 3.4 Rapportages activeren + nacalculatie-loop

Geen nieuwbouw; valideren zodra de keten data levert. De **nacalculatie-loop**: werkelijke uren uit §2.6 stromen terug naar de receptuurnormen (het tabblad "Calculatie Analyse" bestaat al) zodat marges per klustype scherper worden.

---

## 4. Fase 3

### 4.1 AI-intake aanleg-offerte
Flow: gespreksopname behoeftebepaling → tuinvideo → transcript → **AI-conceptlijst** van werkzaamheden/materialen (reviewstap door medewerker is verplicht) → tekening → **hoeveelheden uit de tekening** (vlakken/lijnen taggen per materiaaltype: m² verharding, strekkende meters opsluitband; Moasure DXF/DWG als maatvaste onderlegger) → offerte uit de receptuur-engine. Blokkerende input: naam + exportformaat van het tekenprogramma (§7.3).

### 4.2 HR-module + medewerkerportaal
Medewerkerkaart (met werknemer/opdrachtnemer-onderscheid in het datamodel), documentenkluis (contract, loonstroken — ontstaan bij Hans, vindbaar in het portaal), certificeringen (draait op de §3.3-engine), functioneringsgesprekken-cyclus, SOP-/protocollenbibliotheek met versiebeheer. Medewerker-login met eigen zicht. AI-vraagfunctie ("waar staat mijn loonstrook?") strikt begrensd tot documenten van de ingelogde persoon: RLS + audit-log. AVG-gevoeligheid is hier het hoogst van het hele platform.

### 4.3 Gmail-koppeling
Gmail API met OAuth (geen scraping — fragiel en strijdig met Google-voorwaarden): threads syncen en op e-mailadres automatisch koppelen aan klanttijdlijn/dossier. Interim blijft een gedeelde-inbox-oplossing buiten de app (Missive/Hiver/native Google Workspace shared inbox). WhatsApp Business API optioneel daarna.

### 4.4 Planbord-AI (pas na één seizoen schone data uit fase 1)
Volgorde: (1) bezettingswaarschuwingen ("team 1 zit donderdag overvol"), (2) reistijd-volgorde van dagstops, (3) skill/certificaat-matching bij toewijzen (bron: HR-certificeringen + machinepark). De planner houdt de regie: vastgezette keuzes worden gerespecteerd, de motor optimaliseert eromheen. Kandidaat-engine: **Timefold** via REST-API naast de bestaande stack.

---

## 5. Quick fixes (kleine losse sprint, kan per direct)

1. Badge "45" telt leads i.p.v. klanten → correct na §1.3, of nu al hernoemen naar "Leads".
2. Prullenbak-icoon in lijstrijen → vervangen door **archiveren met bevestiging**; hard delete alleen via de bestaande GDPR-flow.
3. Wizard-auto-save: indicator "concept opgeslagen" + concepten buiten pipeline-KPI's + opruimactie.
4. Testrecord ("test", €100) uit de kolom Gewonnen verwijderen.
5. Datumlabels op het dashboard consistent maken ("Jul 2026" vs "Q3 2026").

---

## 6. Bijlage A — Bouwstenencatalogus onderhoud

Vastgesteld 7 juli 2026 (review Romeo, alle regels akkoord). Dit is de startvulling van de catalogus-tabel; **defaults voor frequentie, prijs per beurt en normuren vult Mickey** (§7.1).

**Voorstel record `bouwsteen`:** id, naam, **code** (kort, bv. HS = haag snoeien — voor compacte weergave op dagkaart en bord), categorie, soort (terugkerend / eenmalig / op afroep / kostenregel / keuzeregel), default_frequentie_per_jaar (nullable), seizoensvenster_van / _tot (maand, nullable), receptuurstappen (json, nullable), materiaal-/machinekoppeling (relatie naar producten & machinepark), normuren_per_eenheid (nullable), btw_code, actief.

Per klant kunnen **maten per bouwsteen** worden vastgelegd (bv. 30 m haag, 24 m² border), zodat de duur per beurt automatisch volgt uit normuren × maat; een afwijkende duur blijft per opdracht handmatig aanpasbaar en de handmatige waarde is leidend.

### Pakketten (tegels bovenin de wizard)
1. **Onderhoud Tuin** — alle groene bouwstenen
2. **Reiniging** — de reinigingsreceptuur
3. **Compleet** — onderhoud + reiniging in één contract

### Bouwstenen

| # | Bouwsteen | Categorie | Soort | Indicatie | Seizoensvenster / bijzonderheid |
|---|---|---|---|---|---|
| 1 | Gazon maaien | Gras & Gazon | terugkerend | ±26×/jaar | groeiseizoen (±mrt–nov) |
| 2 | Bemesting | Gras & Gazon | terugkerend | 3–4×/jaar | |
| 3 | Gazonanalyse | Gras & Gazon | eenmalig | | |
| 4 | Mollenbestrijding | Gras & Gazon | op afroep | | |
| 5 | Graskanten steken | Gras & Gazon | terugkerend | vaak met maaironde | |
| 6 | Verticuteren | Gras & Gazon | terugkerend | 1–2×/jaar | voorjaar/najaar |
| 7 | Bijzaaien | Gras & Gazon | eenmalig | | doorgaans na verticuteren |
| 8 | Borderonderhoud (schoffelen & wieden) | Borders & Beplanting | terugkerend | | |
| 9 | Vaste planten terugknippen | Borders & Beplanting | terugkerend | 1–2×/jaar | najaar/voorjaar |
| 10 | Mulchen / snippers aanvullen | Borders & Beplanting | terugkerend | jaarlijks | materiaalregel |
| 11 | Plaagcontrole (o.a. buxusmot) | Borders & Beplanting | terugkerend | groeiseizoen | |
| 12 | Heggen snoeien | Heggen & Bomen | terugkerend | 2×/jaar | buiten broedseizoen (indicatief 15 mrt–15 jul; wettelijk geldt de zorgplicht Wet natuurbescherming, geen vaste datums) |
| 13 | Bomen snoeien | Heggen & Bomen | terugkerend | | seizoensgebonden per soort |
| 14 | Onkruid bestrating / terras | Bestrating & Terras | terugkerend | | chemievrij (professioneel glyfosaatverbod) |
| 15 | Voegen bijwerken | Bestrating & Terras | eenmalig | | |
| 16 | Reinigingsbeurt (receptuur, 3 stappen) | Reiniging | terugkerend | | stap 1 onkruid machinaal borstelen → stap 2 reinigen (Biomix of hogedruk, per ondergrond; blauwsteen: geen roterende borstel op gezoet oppervlak, Biomix kan tijdelijke roodbruine verkleuring geven die met naspoelen/regen verdwijnt) → stap 3 invegen. Volgorde komt ook op de werkbon. |
| 17 | Invegen — zand-keuzeregel | Reiniging | keuzeregel | | klant kiest: onkruidvrij voegzand óf straatzand — twee prijzen in de offerte |
| 18 | Bladruimen | Seizoen | terugkerend | najaar | |
| 19 | Voorjaarsbeurt | Seizoen | bundel | 1×/jaar | samenstelling t.b.d. (§7.1) |
| 20 | Najaarsbeurt | Seizoen | bundel | 1×/jaar | samenstelling t.b.d. (§7.1) |
| 21 | Afvoer groenafval | Kosten & regels | kostenregel | per beurt/container | intern splitsen in **stortkosten** (per m³/kg, variabel) en **afvoertijd** (uren, gemeten via BES-segment §2.6); op de offerte als één regel te tonen |
| 22 | Voorrijkosten | Kosten & regels | kostenregel | per bezoek | **verplicht vooraf gemeld** (informatieplicht consument) |
| 23 | Minimum-bezoektarief | Kosten & regels | kostenregel | per bezoek | ondergrens zodat een klein klusje nooit onder kostprijs rijdt |

### Structuurregels van de offerte (alle zes akkoord)

1. Seizoensvenster als veld per bouwsteen (planbord bewaakt erop, §2.2).
2. Eenmalig vs. terugkerend per regel (bepaalt wat het contract als beurten genereert, §2.1).
3. Frequentie per bouwsteen → automatische jaarprijs / maandbedrag.
4. Toeslagen (hoogte, hoogwerker e.d.).
5. Btw-code per regel (9% levende planten / 21% arbeid & materiaal).
6. Indexatieclausule zichtbaar in offerte en contract (AV V2.0 art. 5.3, contracten > 3 maanden).

### Bewust uitgesloten (besluit 7 juli 2026)

Gladheidbestrijding/sneeuwruimen · winterklaar maken/voorjaarsopstart · beregeningsinstallatie-onderhoud · vijveronderhoud · tuinverlichting-check · kolken/drainage doorspuiten · rozen- & fruitbomensnoei · kunstgras reinigen & invegen · zwerfvuil-/terreinronde zakelijk.

Toevoegen kan later door een bouwsteen-record aan te maken (principe 2) — geen code nodig.

---

## Bijlage B — HERO-pariteit Planning (kijksessie 7 juli 2026)

Alleen-lezen sessies via Claude in Chrome, 7 juli 2026. Deel A (planning), deel B (offertes/artikelbestand) en deel C (facturen/herinneringen) zijn afgerond.

**Overnemen:**
- Meerdere tijdvensters op het weekbord: dag / 3 dagen / week / 14 dagen / 4 weken / maand (verwerkt in §2.2).
- **Afwezigheids- en feestdagblokken** die capaciteit blokkeren (HERO doet dit via team-brede afspraken zoals "1e Kerstdag"); fase 1 handmatig, fase 3 gevoed door HR (verwerkt in §2.2).
- **iCal-export: bewust NIET overgenomen** (besluit Romeo 8 juli 2026) — harde overstap, de app wordt de enige agenda.
- **Middelen als planbare resource** (HERO: "bronnen/brontypen") — verwerkt in §3.3, fase 2.
- Lijstweergave van afspraken (Mijn / Alle, filter en sortering per kolom) als derde, goedkope weergave op dezelfde data — fase 2.
- Klantnaam, adres én telefoon één klik diep op het blok — zat al in het klantblok-ontwerp (§2.2), hier bevestigd als dagelijkse waarde voor de buitendienst.
- "Projecten gepland" als aparte planlaag boven de teamrijen — bij ons gedekt door de wachtrij + meerdaagse projectblokken; geen aparte bouw nodig.

**Verbeteren (HERO doet het, wij doen het beter):**
- HERO's dagelijkse "REISTIJD Kantoor"-blokken worden handmatig geplaatst → bij ons automatisch: standaardblokken + berekende reistijden met tijdcascade (§2.2).
- Herhaling is in HERO niet zichtbaar in de snelle afspraakdialoog → bij ons genereert het contract de beurten (§2.1); herhaling is data, geen agenda-truc.
- Kopiëren per afspraak → bij ons dupliceren mét team en tijden, direct op het bord (§2.2).
- Bezetting aflezen = volle/lege cellen turven → fase 4 geeft echte bezettingssignalen (§4.4).

**Bewust anders (anti-eisen uit de fricties):**
- "Team" is in HERO een kleurcategorie los van de toegewezen medewerkers → bij ons een echte entiteit met bemanning per dag (§2.2).
- Twee overlappende weergaven (Planbord/Kalender) zonder duidelijke rolverdeling → weekbord en dagkaart hebben elk een expliciete functie (§2.2).
- Blokinhoud als verborgen instelling (vier configureerbare regels, apart mét/zónder project) → eerst één goed gekozen vaste blokweergave; configureerbaarheid pas bij aangetoonde behoefte.
- Dubbelzinnige statussen (tweemaal "Voltooid" in Opdrachten) → statussen per type eenduidig gedefinieerd (§1.1).
- Gemengde taal in instellingen (Duits/Nederlands) → alles Nederlands, één begrippenlijst.

**Scope-vondst voor het migratiebesluit (§7.2):** HERO draait ook **Personeelsbeheer** (verlofaanvragen, tijdregistratie, pauzebeheer, loongroepen) en een documentenmodule met sjablonen/configurator. Deze functies moeten expliciet in het beslisdocument: wat blijft in HERO tot de HR-module (fase 3) er staat, wat gaat eerder over, en wat vervalt.

### Deel B — Offertes & artikelbestand

**Overnemen:**
- **Gebruiksteller per artikel** ("116× gebruikt") in de artikel-picker, gesorteerd op meest gebruikt (verwerkt in §2.5b/c).
- **Tekstblokkenbibliotheek** voor aanhef, voorwaarden en standaardteksten — inhoud herbruikbaar, opmaak vast (§2.5b).
- Hiërarchische posities (hoofdstukken/subregels), korting én marge in € en % in het totalenblok — zat al in §2.5b, hier bevestigd.
- Live **overzichtsblok** naast de editor (posten, werkuren, inkoop, marge, netto/bruto) tijdens het bouwen (§2.5b).
- **Datum van dienst** naast de documentdatum (§2.8).

**Bewust anders / simpeler:**
- HERO's editor is een vrije tekstverwerker met volledige opmaakbalk (lettertype, grootte, kleur per tekstblok) — empirisch de bron van de drie-lettertypen-offertes. Bij ons: structuur in plaats van vrije tekst, opmaak in code, geen opmaakbalk (principe 3, §2.5b).
- HERO's meerdere verkoopprijsniveaus per artikel (klantspecifiek / standaardmarge / VK1, elk met eigen opslag-%) → bij ons één inkoopprijs + één transparant margeveld per regel met leermodus. Klantspecifieke prijsafspraken pas bouwen als de behoefte aantoonbaar is.
- De artikelmaster is vervuild: near-duplicates (drie varianten "Voorrijkosten" incl. spelfout "Voorrrijkosten"), veel €0-prijzen, "Infinity%"-marges → les verwerkt in §2.5c: importvalidatie, ontdubbeling, beheer bij weinig mensen.

### Deel C — Facturen & herinneringen

**Overnemen:**
- **Gescheiden documentstatus en betaalstatus** — inhoudelijk juist en nodig voor deelbetalingen (verwerkt in §2.8).
- **Deelbetalingen, termijnen en aanbetalingen** als volwaardige gevallen — sluit direct aan op de deelfacturatie-engine (§2.8).
- Herinneringstrap per trede instelbaar (interval, sjabloon, documenttype) en het herinneringenoverzicht als **ouderdoms-/debiteurenoverzicht** met "verschuldigd sinds"-badges (verwerkt in §3.2).
- Referentiedocument-koppeling factuur ↔ offerte/contract (§2.8).
- e-Factuur-export als latere uitbreiding — in Nederland dan **UBL/Peppol** in plaats van het Duitse XRechnung.

**Verbeteren / bewust anders:**
- HERO's aanmaanproces start met een handmatige "herinneringsrun"-knop → bij ons draait de ladder automatisch dagelijks; handmatig pauzeren per factuur blijft mogelijk (§3.2).
- Zes herinneringsniveaus met taalrommel en near-duplicates ("Zahlungserinnerung", "1. Betalingsherinnering" naast "2. Betalingsherinnering 1") → 3–4 heldere treden, alles Nederlands (§3.2).
- Betalingsregistratie is in HERO volledig handmatig, zonder bankkoppeling → fase 2 handmatig mét deelbedragen, bankkoppeling/reconciliatie als fase 3-kandidaat (§7.6).

---

## Bijlage C — Uren-app "Top Tuinen Hub" (nulmeting 8 juli 2026)

Bestaande, losse veld-app op toptuinen-uren.vercel.app (Supabase/Vercel). Kern: weekplanning met opdrachtkaarten (klant, tijdvak, adres + Maps, foto's), tijdsegmenten per dag, achterstand-signalering ("Wie is achter", afwijkingen gepland vs. gelogd), dag indienen/heropenen, noodprotocol, HERO-klantsync, Excel-urenexport, rollen Werker/Admin met voorman-vlag en kleurteams.

**Architectuurbesluit (Romeo, 8 juli 2026):** de Hub wordt **nagebouwd als veld-rol binnen toptuinen.app**, op dezelfde database (werkitems, klanten, teams). Niet ompointen, niet naast elkaar laten bestaan. Kopie-entiteiten en de eigen HERO-klantsync vervallen. De bestaande app blijft draaien tot de veld-rol live en getest is, en wordt daarna uitgezet.

**Overnemen (verwerkt in §2.6):**
- Achterstanden & afwijkingen: gepland vs. gelogd, "Wie is achter" — beschermt de facturatie-automatisering (§2.8) en de nacalculatie-loop (§3.4).
- Segmentmodel met categorieën (werken / pauze / reistijd / teammeeting / onderhoud materiaal / anders), voortaan **vooringevuld vanuit de dagkaart** (§2.2).
- Dag indienen + heropenen/corrigeren door kantoor.
- Foto's per opdracht → bijlagen op de klanttijdlijn (§2.3).
- "Buiten"-modus (fel daglicht) als UX-eis voor de veld-rol.
- Noodprotocol als vaste snelkoppeling in het veld; inhoud beheerd in de SOP-bibliotheek (§4.2).
- Excel-urenexport blijft tot de loonaanlevering (Hans) anders loopt.

**Convergeren (dubbelingen die verdwijnen):**
- Werktype-labels (Tuinaanleg / Tuinonderhoud / Service-garantie) vervallen: een segment koppelt aan een werkitem en dat draagt het type al.
- De kaartstatussen "Gemist / Wachtend / gelogd" gaan op in de werkitem-statussen + afrondingsflow (§2.6); geen aparte statusreeks.
- De HERO-klantsync in de Hub bewijst dat het sync-patroon werkt, maar vervalt: klanten leven straks in één database. (Relevant voor het migratiebesluit §7.2: óók deze sync moet t.z.t. losgekoppeld.)

- Segmentcategorie **BES = afvalverwerker** (rit + lossen groenafval). Voortaan gekoppeld aan werkitem/klant, zodat werkelijke afvoertijd tegenover de gefactureerde afvoerkosten komt te staan (§2.6, bouwsteen 21).

**Open:** exacte definitie van "afwijking" vs. "achterstand" vastleggen (§7.7).

---

## 7. Open vragen / benodigde input

| # | Wie | Wat | Blokkeert |
|---|---|---|---|
| 7.1 | Mickey | **Niet blokkerend voor de bouw.** Zodra het catalogusbeheer-scherm (§2.5f) er staat, vult Mickey de 23 bouwstenen zelf in de app in: code, prijsmodel, uren/vast bedrag, frequentie. Los daarvan nog nodig: standaardblok-tijden dagkaart, samenstelling voorjaars-/najaarsbundel, default facturatiemodus, drempel afwijking (§2.6). | §2.2, §2.8 |
| 7.2 | Romeo / Yannick | HERO-uitfasering: planning, opzegtermijn, volledige export en archivering (bewaarplicht), artikelmaster schonen vóór import. Wordt buiten dit document afgestemd. | §2.5c |
| 7.3 | Romeo | Naam + exportformaat tekenprogramma. | §4.1 |
| 7.4 | Ricardo | Supabase-schema-export (→ dit document wordt v1.1 met veld-mapping). Voorbeeld-productlijst van één leverancier (import §2.5c). | v1.1, §2.5c |
| 7.5 | Afgerond | Kijksessies HERO deel A, B en C zijn gedaan — resultaten in bijlage B, verwerkt in §2.2, §2.5, §2.8, §3.2 en §3.3. | — |
| 7.6 | Yannick/Hans | Boekhoudpakket + bankkoppeling/reconciliatie voor betalingsregistratie. Staat los van HERO, want daar draait geen boekhouding. | §3.2 |
| 7.7 | Besloten | Uren-app: **herbouwen als veld-rol binnen toptuinen.app** op dezelfde database (Romeo, 8 juli 2026). Bestaande app blijft draaien tot de veld-rol live is. Definitie afwijking vs. achterstand: aanname in §2.6, bevestiging Mickey. | — |

---

## 8. Acceptatietests

1. **Pietje-test** — "wie heeft wat met klant X besproken, via welk kanaal, over welke klus?" beantwoord binnen 30 seconden via de tijdlijn.
2. **Schaduw-offerte** — Mickey bouwt dezelfde onderhoudsofferte in de app en op zijn huidige manier; verschil verklaard en acceptabel.
3. **Misklik-test** — een voorman/medewerker kán geen bericht aan een klant sturen (knop bestaat niet, API weigert); een intern bericht kan structureel niet in een klantthread belanden.
4. **Beurten-test** — een contract met twee bouwstenen (bv. maaien ±26×, heg 2×) genereert de juiste beurten in de wachtrij, binnen de seizoensvensters.
5. **Delta-test** — een geplande klus met grasmaaier toont vóór de route-knop precies de delta-checklist "grasmaaier".
6. **Case-test** — een @Michel-tag op een melding verschijnt op zijn dagkaart bij de eerstvolgende planning bij die klant; zijn antwoord landt intern, nooit bij de klant.
7. **Catalogus-test** — een nieuwe bouwsteen toevoegen gebeurt volledig in het beheerscherm (§2.5f) door kantoor zelf; hij verschijnt zonder code-wijziging of deploy in wizard én contractvorm. Een gewijzigd uurtarief raakt lopende contracten niet.
8. **Afrondingstest** — voorman vinkt alle taken af → direct een correcte concept-factuur in "Te versturen" (juiste regels, bedrag, btw); zet hij één taak op "begonnen-niet-af" → die taak staat als rest-opdracht mét klantgegevens en resterende normtijd in de wachtrij, en het uitgevoerde deel is gefactureerd.
9. **Cascade-test** — planner zet +15 minuten op een taak bij klant A → alle vertrek- en aankomsttijden erna op de dagkaart schuiven automatisch door; klant A en B omwisselen neemt reistijden én taken als één blok mee.
10. **Urensegment-test** — een geplande dag genereert voorgestelde segmenten (reistijd, klantblokken, pauze) die de medewerker alleen bevestigt of corrigeert; een gepland bezoek dat aan het einde van de dag niet gelogd is, verschijnt op "Wie is achter".
11. **Twee-routes-test** — dezelfde klus via de wizard en via de vrije builder levert een identiek opgemaakt document op (zelfde lettertype, zelfde indeling). Een vrije offerte kan niet op "geaccepteerd" zonder dat er ten minste één werkitem uit voortkomt.
12. **Attenderingstest** — een losse snoeibeurt met ritme "1× per jaar" levert 14 dagen vóór het seizoensvenster een taak voor kantoor op, met een inplan-mail klaar om te versturen; de beurt komt pas in de wachtrij nadat kantoor hem vrijgeeft. Een losse beurt en een contract staan als aparte regels op de klantkaart.
