# Designkritiek Top Tuinen OS — "waarom voelt dit generiek?"

*Fase 1 — alleen lezen. Visueel geschouwd op 1600×900 (dark, system-thema), dev-server met demodata, ingelogd als staf. Aanvullend op het bestaande tokenplan `kleur-en-consistentie.md` — dit document is de holistische kritiek + richting; dat document is de kleur-uitvoering.*

## Anti-patronen-oordeel: ZAKT (nu nog)

De vraag "zou iemand direct geloven dat AI dit maakte?" — ja, onmiddellijk. De vingerafdrukken:

1. **Het tokenbestand is letterlijk kleurloos.** `globals.css` is het onaangeraakte shadcn-zinc-thema: `--primary: oklch(0.205 0 0)` — chroma 0. Het merk (groen, wit boomlogo) bestaat alleen in het logoblokje linksboven en in de publieke configurator. Het product zelf heeft géén merkkleur.
2. **Standaardfont van de starter.** Geist (het Next.js-defaultfont) voor álles: koppen, body, cijfers. Geen displayfont, geen karakter, hiërarchie alleen via groter/vetter.
3. **Dark mode met neon-accenten op zwart.** KPI-iconen in blauw/oranje/groen/paars cirkeltjes (projecten), pipelinebalk oranje/blauw/groen/rood, felgroene totaalbedragen — de klassieke 2024-AI-dashboardlook.
4. **Identieke kaartgrids + hero-metric-sjabloon.** Dashboard: zes gelijke kaarten met groot getal, klein label, trendchip. Offertes: vier stat-tegels met icoontje. Projecten: idem vier. Leads: idem vier onderaan. Overal hetzelfde ritme, dezelfde padding, dezelfde rand.
5. **Badge-confetti.** Elke rij klanten draagt 2–3 gekleurde badges (waarvan "Particulier" blauw én nogmaals lowercase "particulier" eronder). Kleur decoreert, communiceert niet.

**Wat de test wél doorstaat** (en dat is substantieel): de informatie-architectuur is doordacht, de microcopy is menselijk Nederlands, en er zijn eigen patronen (SectiePaneel, workflow-stepper, samenvattingsrail, modules-strip) die géén AI-sjabloon zijn. Het skelet is goed; de huid is generiek.

---

## 1. Oordeel per pagina

### /dashboard — goede architectuur, schreeuwerige uitvoering
**Gezien:** "Goedemiddag, Test" (sympathiek), daaronder een amberkleurig "Aandacht nodig"-blok met 4 meldingen, dan 6 KPI-kaarten ("Totale Omzet € 33.095" in fel groen met −21% chip, "Gefactureerd dit Q € 59.277" +243%), pipelinebalk in 4 kleuren, conversie-donut 36%, projectstatus-donut met 4-kleurenlegenda, activiteitenfeed met rode/groene bedragen, 3 projectkaarten met oranje voortgangsbalken, en één compacte regel "Vloot & Materieel — Alles operationeel".

- **Sterk:** de volgorde (aandacht → cijfers → pipeline → activiteit) is precies wat een hovenier 's ochtends wil; het vloot-regeltje bewijst dat compact kan; de begroeting geeft toon.
- **Zwak:** het amberblok kleurt álle vier meldingen even urgent — "hoog", "middel" én "laag" baden in hetzelfde amber; het grootste vlak van de pagina is een waarschuwing. De omzet staat in fel groen terwijl de trend −21% is — kleur zegt "goed nieuws", cijfer zegt slecht. Zes identieke kaarten betekent: niets springt eruit. De twee donuts + gekleurde pipelinebalk gebruiken vier hue-systemen door elkaar.
- **Primaire actie onvindbaar:** "Nieuwe Aanleg" en "Nieuw Onderhoud" staan als twee gelijkwaardige outline-knopjes rechtsboven; geen enkele knop op de pagina is duidelijk dé actie.

### /leads — kanban prima, bron schreeuwt harder dan waarde
**Gezien:** 5 kolommen (Nieuw/Contact gehad/Offerte verstuurd/Gewonnen/Verloren) met gekleurde stippen blauw/oranje/paars/groen/rood; leadkaarten met paarse linkerrand + paars "Handmatig"-badge of blauw "Website"-badge; bedragen (€ 890, € 14.500) klein en grijs; stat-tegels onderaan.

- De **bron** van een lead (Website/Handmatig) krijgt het meeste visuele gewicht (badge + gekleurde rand), terwijl **bedrag en ouderdom** — waar een verkoper op stuurt — klein grijs onderaan staan. Paars is bovendien nergens een merkkleur.
- De vijfde kolom "Verloren" valt op 1600px half buiten beeld; het bord scrollt zijwaarts — de huisregel "nooit zijwaarts scrollen" geldt hier blijkbaar niet, maar het voelt wel zo.
- Kolomstippen introduceren een 5-kleuren-mapping die nergens anders terugkomt.

### /klanten + klantdossier — het beste patroon van de app zit hier, onopgemaakt
**Gezien (lijst):** twee rijen filterchips (7 + 6 chips, allemaal even grijs), tabel-in-kaart met per rij "Opgeleverd" (groen), "Particulier" (blauw) én een tweede lowercase "particulier"-chip, afgekapte e-mailadressen, potlood + ellipsknop.
**Gezien (dossier Anouk Willems):** SectiePaneel-opbouw — TAKEN (composer-regel "Nieuwe taak — bijv. terugbellen over de poort"), TIJDLIJN met zoek/filter, ONDERHOUD, OFFERTES, FACTUREN; rechterrail GEGEVENS/CIJFERS/INSTELLINGEN met rode GDPR-link onderaan.

- Het dossier is structureel het volwassenste scherm: rustige uppercase kopjes, compacte lege staten, composer met placeholder-voorbeeld. Maar het is 100% grijs — geen enkele merkbeleving, en de hiërarchie tussen kopje/inhoud is zó vlak dat alles even belangrijk lijkt.
- Lijst: dertien filterchips vóór de eerste klantnaam is cognitieve tol; de dubbele particulier-badge is ruis; badgekleuren (groen=opgeleverd, blauw=particulier) delen geen systeem met de rest van de app.

### /offertes + offertedetail — vier knoppen, geen begin
**Gezien (lijst):** rechtsboven "Concepten opruimen", "Vrij", "Onderhoud", "Aanleg" (vier knoppen, geen duidelijk startpunt — de dialog met 8 werkzaamheden zit alleen achter ⌘N); 4 stat-tegels; status-tabs; tabel met rode/groene statusbadges en blauwe "Bekijk Project"-links.
**Gezien (detail TOPTUINEN2026-114):** groene succesbanner + "Start project"-knop, workflow-stepper met vinkjes (Concept → Voorcalculatie → Verzonden → Geaccepteerd) — **dit is goed ontwerp**; daaronder een plots blauw/navy "Voorcalculatie"-paneel met blauwe "Ingevuld"-badge; scope-badges Gras (groen), Houtwerk (oranje) en… **`water_elektra`** — de rauwe database-key met underscore, zichtbaar voor kantoor; totalenpaneel met marge-meter (groen), gestapelde balk blauw/geel/oranje/grijs, felgroen eindbedrag; in de header zowel "Bekijk PDF" als "PDF" (dubbel).

- De detailpagina laadde bovendien **±5 seconden als volledig zwart scherm** (Convex-queries zonder skeleton) — de duurste pagina van de app begint als een zwart gat.
- Het totalenpaneel stapelt vier kleursystemen (meter, balk, bedrag, badges) op 300px.

### "Nieuwe offerte"-dialoog + wizardstap 1–2 — juiste flow, vlakke tegels
**Gezien:** dialog met 8 werkzaamheid-tegels in 2 kolommen (Tuinaanleg … Overige diensten over de volle breedte), hint "Druk op de letter in de hoek om direct te kiezen"; wizard "Nieuwe Aanleg Offerte — Stap 1 van 5: Snelstart" met voortgangsbalk, 5-stappen-stepper, lege staat met "Beginnen" en "mijn sjablonen"; stap 2 met Klantgegevens, "Algemene Parameters" (slider "Klantvriendelijkheid: 1 Lastig — 5 Makkelijk"), samenvattingsrail rechts met vinkjes en "Volgende: Scope Details".
- De 8 tegels zijn allemaal even groot en even grijs — "Tuinaanleg" (corebusiness) en "Overige diensten" hebben identiek gewicht. De beloofde sneltoets-letter "in de hoek" is visueel onvindbaar.
- De samenvattingsrail en het draft-herstel ("…gevonden van 54 minuten geleden. Wil je verder gaan waar je gebleven was?") zijn uitstekende UX — maar de herstel-dialog verscheen tijdens de schouw twee keer achter elkaar.
- "Klantvriendelijkheid" met schaal "Lastig→Makkelijk" is intern jargon dat in een klantdossier pijnlijk wordt als de klant ooit meekijkt.

### /projecten + projectdetail — decoratieve iconen, één gele schreeuw
**Gezien (lijst):** 4 stat-kaarten met gekleurde cirkel-iconen (blauw kalender, oranje play, groen vinkje, paars — het "grote icoontjes boven elke kop"-antipatroon), tabel met blauwe "Gepland"- en oranje "In Uitvoering"-badges. Rijen ogen niet klikbaar (geen link-affordance; mijn eerste klik deed niets zichtbaars).
**Gezien (detail Beregening en gazon Peeters):** status-tabstrip (goed), twee voortgangskaarten — uren met bláúwe balk, planning met gróéne balk (kleurverschil zonder betekenis), compacte modules-strip (Planning/Uitvoering/Kosten/Nacalculatie/Offerte/Werklocatie — goed patroon), en dan: een knalgele balk "ZICHTBAAR VOOR KLANT" boven het klantgesprek met daaronder een donkerblauw intern-composerblok. Het gele blok is het luidste element van de hele pagina — een metadata-waarschuwing die belangrijker oogt dan het project zelf.

### /meldingen — hetzelfde bord als leads, verwisselbaar
**Gezien:** kanban Nieuw/In behandeling/Wacht op derden/Opgelost met wéér een andere stip-mapping (blauw/amber/paars/groen); kaarten met rode "Klacht"-, blauwe "Serviceverzoek"-, rode "Schade"-badges. Op afstand is dit bord niet van het leadsbord te onderscheiden — terwijl de emotionele lading (klachten!) totaal anders is. *(Terzijde: de paginatitel toonde tijdens de schouw "Meldingen ZZTEST" — sessie-artefact van een parallelle agent, geen productfout; string staat niet in de code.)*

### /instellingen — muur van invoervelden
**Gezien:** 10 tabs (Tarieven … Beveiliging); "Marge per scope" is een grid van 9+ identieke %-veldjes (Grondwerk 15, Bestrating 15, …) zonder groepering, uitleg of afwijking-markering. Functioneel compleet, visueel een spreadsheet zonder spreadsheet-voordelen. Laagste prioriteit, maar typerend: geen enkele pagina heeft een rustpunt of anker.

### /configurator (publiek) — de enige plek mét merk, maar 404 aan de voordeur
**Gezien:** `/configurator` zelf = **"Pagina niet gevonden"** (er bestaan alleen `/configurator/gazon`, `/boomschors`, `/verticuteren` — geen keuzepagina). `/configurator/gazon`: donkere pagina, logo + "ONLINE CONFIGURATOR" in groen kapitaal, groene voortgangsbalk en stapnummers, netjes gecentreerd formulier ("Uw gegevens", poortbreedte-veld met uitstekende uitlegtekst), footer met placeholder **"+31 (0)00 000 0000"**.
- Dit is nota bene het klantgerichte scherm en het is een donker developer-tool-formulier. Geen tuinfoto, geen sfeer, geen bewijs van vakwerk — terwijl juist híer de klant moet denken "deze mensen maken mooie dingen". Een hovenier die groen verkoopt, toont een pikzwart scherm.
- Wel: de 4-stappenstructuur, de poortbreedte-microcopy en de groene accenten zijn de beste merkaanzet van de hele codebase.

---

## 2. Voorgestelde designrichting

**Concept A (aanbevolen): "Vakwerk in het groen" — licht-eerst, bosgroen als as.**
Top Tuinen verkoopt buitenlicht, groen en vakmanschap; de software moet als de werf voelen, niet als een crypto-dashboard.
- **Kleur:** warm krijtwit als grond (licht getinte neutralen, geen puur wit), **diep bosgroen** als enige primaire kleur (knoppen, actieve nav, focus, links), één warm accent (terracotta/amber) exclusief voor waarschuwingen, en de volledige statusreeks uit één systeem — zie het uitgewerkte OKLCH-palet in `kleur-en-consistentie.md`. Blauw en paars verdwijnen volledig. Dark mode blijft als ontworpen "avondmodus" op dezelfde groene as (voorman in de bus), niet als default-op-zwart.
- **Typografie:** een display-serif met karakter voor paginakoppen en grote bedragen (bijv. Fraunces of Gambetta via `next/font` — organisch, ambachtelijk), Geist mag blijven als werkpaard voor UI-tekst; tabulaire cijfers voor alle bedragen.
- **Karakter:** het boomlogo verdient een systeem — een subtiel blad/tak-lijnmotief als achtergrond van lege staten en de login, een groene "grasrand" (2px) als actieve-staat-indicator in de sidebar, seizoensgevoelige begroeting op het dashboard. Eén onvergetelijk element: de offerte-stepper als groeiende tak (knop → blad → bloei) — het bestaande stepper-patroon leent zich er al voor.
- **Vlak-discipline:** stat-tegels vervangen door één gedifferentieerde cijferregel (één heldcijfer groot, rest als compacte regel), kaarten alleen waar echt een object staat; SectiePaneel wordt de norm voor alle dossiers.

**Concept B (alternatief, minder werk): "Mono-groen donker".** Dark blijft hoofdthema, maar alle hues behalve groen + amber worden gesaneerd. Snelste route uit de AI-look, minst onderscheidend — het blijft een donker dashboard.

**Concept C (alternatief, gedurfd): "Werkbon-esthetiek".** Papierwit, hairlines, stempel-badges, tabulaire cijfers overal — de app als premium offertemap. Sterkste karakter, maar risico dat kanban/planning erin wringen.

De publieke configurator volgt in álle concepten Concept A: licht, groen, met één grote sfeerfoto of illustratie per dienst — daar wordt geld verdiend.

---

## 3. Concrete wijzigingen per bestand/component

**Fundament (samen met `kleur-en-consistentie.md`):**
- `src/app/globals.css` — primary → bosgroen; neutralen warm tinten; chart-/statuskleuren op één as; scope-kleuren behouden maar dempen; selection/scrollbar meekleuren.
- `src/app/layout.tsx` — displayfont toevoegen via `next/font` (`--font-display`); FOUC onderzoeken: tijdens de schouw renderden /offertes en het klantdossier seconden lang volledig licht binnen het dark-thema (next-themes `defaultTheme="system"` + streaming) voordat ze donker werden.
- `src/components/app-sidebar.tsx` — actieve staat groen i.p.v. grijs, boomlogo groter merkmoment, badges (10/27/6) in één stijl.

**Dashboard:**
- `src/components/dashboard/aandacht-nodig.tsx` — alleen prioriteit "hoog" krijgt amber; middel/laag neutraal met gekleurde stip; blok maximaal ⅓ van de viewport.
- `src/components/dashboard/financieel-grid.tsx` — 6 gelijke kaarten → 1 heldcijfer (omzet, in displayfont) + compacte cijferregel; trendkleur koppelen aan richting (−21% is nu groen).
- `src/components/dashboard/pipeline-bento.tsx` — pipelinebalk en donuts naar één groenreeks; rood alleen voor "afgewezen".

**Leads & meldingen:**
- `src/components/leads/lead-card.tsx` — bedrag prominent, bron-badge → klein grijs tekstlabel, paarse rand weg.
- `src/components/leads/kanban-column.tsx`, `src/components/meldingen/melding-column.tsx` — kolomstippen uit het statussysteem; bord smaller of 4 kolommen + "Verloren" als strook zodat niets buiten beeld valt.
- `src/components/leads/pipeline-stats.tsx` — stat-tegels → één regel.
- `src/components/meldingen/melding-card.tsx` — klacht/schade visueel onderscheiden van serviceverzoek (dit bord mág urgentie tonen — de urgentie zit nu in de badges, niet in de kaart).

**Klanten:**
- `src/app/(dashboard)/klanten/page.tsx` — filterchips consolideren (status-tabs + type-dropdown), dubbele particulier-badge weg, e-mailkolom versmallen t.g.v. naam.
- `src/app/(dashboard)/klanten/[id]/page.tsx` + `src/components/ui/sectie-paneel.tsx` — sectiekoppen een groen tintje/miniatuur-icoon; rechterrail CIJFERS in tabulaire cijfers; GDPR-link naar een "gevarenzone"-blokje.

**Offertes:**
- `src/app/(dashboard)/offertes/page.tsx` — één primaire knop "Nieuwe offerte" (opent NewOfferteDialog, nu alleen via ⌘N bereikbaar); "Vrij/Onderhoud/Aanleg" de dialog in; stat-strip → cijferregel.
- `src/app/(dashboard)/offertes/[id]/` — voorcalculatie-paneel van navy naar neutraal+groen; totalenpaneel: één kleursysteem, eindbedrag in displayfont; scope-labelmap fixen (**`water_elektra` toont nu de rauwe key**); dubbele PDF-knop saneren; skeleton voor het zwarte laadgat (`loading.tsx` bestaat maar dekt de Convex-fase niet).
- `src/components/new-offerte-dialog.tsx` — Tuinaanleg/Onderhoud als grote tegels bovenaan, rest kleiner; sneltoetsletter zichtbaar maken.
- `src/components/offerte/wizard-steps.tsx` — stepper als merkmoment (tak-motief); label "Klantvriendelijkheid (Lastig—Makkelijk)" herformuleren.

**Projecten:**
- `src/app/(dashboard)/projecten/page.tsx` — gekleurde cirkel-iconen weg; rij-affordance (hover + chevron).
- `src/app/(dashboard)/projecten/[id]/page.tsx` — uren- en planningbalk zelfde kleur (groen); "ZICHTBAAR VOOR KLANT" van knalgeel naar rustige rand + oogje-icoon; modules-strip (`src/components/project/module-pills.tsx`) behouden — dit is goed.

**Instellingen:**
- `src/app/(dashboard)/instellingen/components/tarieven-tab.tsx` — marges gegroepeerd (Aanleg/Onderhoud/Overig), afwijking van standaard gemarkeerd, rest ingeklapt.

**Configurator (hoogste merkimpact):**
- `src/app/(public)/configurator/` — **indexpagina toevoegen** (keuze gazon/boomschors/verticuteren met foto's) — nu 404.
- `src/app/(public)/configurator/layout.tsx` — licht thema forceren, sfeerbeeld/illustratie, echt telefoonnummer i.p.v. "+31 (0)00 000 0000".
- `src/app/(public)/configurator/gazon/page.tsx` (+ boomschors, verticuteren) — stappen behouden, formulier op wit, groene CTA's, prijsoverzicht als "offertepapier".

**Overig:**
- `src/components/empty-states.tsx` — lege staten met blad-lijnmotief en één actieknop i.p.v. alleen tekst.

## 4. Prioritering

| Prio | Wat | Waarom eerst |
|---|---|---|
| P0 | Tokens + typografie (`globals.css`, `layout.tsx`) — mét het bestaande kleurplan | Elk ander bestand erft dit; zonder dit is elke fix cosmetisch |
| P0-bugs | `water_elektra`-label, `/configurator` 404, placeholder-telefoon, dubbele PDF-knop, licht-flits bij laden | Klein, zichtbaar, ondermijnt vertrouwen |
| P1 | Dashboard (aandacht-blok, heldcijfer, pipelinekleuren) + sidebar + offertes-lijst primaire actie | De schermen die elke dag open staan |
| P2 | Offerte-detail (totalen, navy-paneel, skeleton), projecten (iconen, geel blok), leads/meldingen badge-sanering | Diepere werkschermen |
| P3 | Configurator-herontwerp + indexpagina | Grootste merkimpact naar buiten, maar eigen mini-project |
| P4 | Klantenlijst-filters, instellingen-groepering, empty states | Polish |

## 5. Geraakte bestanden

```
src/app/globals.css
src/app/layout.tsx
src/components/app-sidebar.tsx
src/components/dashboard/aandacht-nodig.tsx
src/components/dashboard/financieel-grid.tsx
src/components/dashboard/pipeline-bento.tsx
src/components/leads/lead-card.tsx
src/components/leads/kanban-column.tsx
src/components/leads/pipeline-stats.tsx
src/components/meldingen/melding-card.tsx
src/components/meldingen/melding-column.tsx
src/app/(dashboard)/klanten/page.tsx
src/app/(dashboard)/klanten/[id]/page.tsx
src/components/ui/sectie-paneel.tsx
src/app/(dashboard)/offertes/page.tsx
src/app/(dashboard)/offertes/[id]/page.tsx
src/components/new-offerte-dialog.tsx
src/components/offerte/wizard-steps.tsx
src/app/(dashboard)/projecten/page.tsx
src/app/(dashboard)/projecten/[id]/page.tsx
src/components/project/module-pills.tsx
src/app/(dashboard)/instellingen/components/tarieven-tab.tsx
src/app/(public)/configurator/layout.tsx
src/app/(public)/configurator/gazon/page.tsx
src/app/(public)/configurator/boomschors/page.tsx
src/app/(public)/configurator/verticuteren/page.tsx
src/components/empty-states.tsx
```
