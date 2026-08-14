# Distill — versimpelingsplan Top Tuinen OS

*Fase 1 (alleen lezen) — distill-agent designteam, 14 aug 2026.*
*Schouw: /dashboard, /klanten + klantdossier (Bouwbedrijf Frissen B.V.), /offertes + offertedetail (TOPTUINEN2026-114), "Nieuwe offerte"-dialoog (Cmd+N) + aanleg-wizard stap 2, /projecten + projectdetail (Parkeerterrein Frissen), /instellingen (alle 10 tabs). Viewport 1600×900, dark, ingelogd als e2e-staf.*

Uitgangspunt: doelgroep is kantoorstaf van één hoveniersbedrijf die deze schermen dagelijks tientallen keren opent. Elke herhaling die één keer per bezoek 2 seconden kost, kost per week minuten. Simpel ≠ kaal: functionaliteit blijft, obstakels gaan weg.

---

## 1. Per scherm: de kern, en wat die verstopt

### 1.1 Dashboard — kern: "wat vraagt vandaag mijn actie, en hoe staat de zaak ervoor?"

Geteld op het scherm: ~20 gelijkwaardige blokken over 1,9 schermhoogte. Concreet gezien:

- **"Aandacht nodig" (4 items, o.a. 2× dubbele planning Lars Hendriks, vervallen factuur €17.307)** is het enige blok dat om áctie vraagt — en staat qua gewicht gelijk aan alles eronder. Technisch broos bovendien: een voorouder-div blijft op `opacity: 0` staan tot de entrance-animatie draait (in een verborgen/pre-gerenderde tab dus onzichtbaar).
- **Zelfde getal, drie plekken.** "Actieve Projecten 3 (2 afgerond / 11 totaal)" staat als KPI-card, nogmaals als Project Status-donut (Projecten 11: Gepland 5 / In uitvoering 3 / Afgerond 2 / Nacalculatie 1), en nogmaals als drie project-voortgangscards onderaan.
- **Pipeline-card telt zichzelf twee keer.** De segmentbar (oranje/blauw/groen/rood) toont 4/4/4/3 en direct daaronder staan vier stat-boxen met exact dezelfde 4/4/4/3.
- **Conversie dubbel.** Conversie Rate-donut (36%, "Gem. € 8.274") — hetzelfde conversiegetal + gemiddelde staat óók als KPI-card op /offertes.
- **Openstaande Offertes "4 wachtend op reactie"** herhaalt de pipeline-kolom "Verzonden 4".
- Recente Activiteit (5 offerte-events met bedragen) is een derde blik op dezelfde offertes als de pipeline erboven.

Kern-diagnose: het dashboard beantwoordt "hoe staat het ervoor" vier keer en "wat moet ik doen" één keer, klein.

### 1.2 /klanten — kern: klant vinden en openen

- **Dubbele kop.** Paginakop "Klanten / Beheer je klantenbestand" + cardkop "Klantenlijst / 27 klanten in je bestand". De teller 27 staat vier keer in beeld: sidebar-badge, "Alle (27)"-pill, cardkop, en impliciet in de tabel.
- **Type twee keer per rij.** Elke rij toont de klantType-badge ("Particulier") én de tags als badges eronder — en de seed-tags zíjn het type ("particulier", "zakelijk", "contract"). Bouwbedrijf Frissen: "Onderhoud" + "Zakelijk" + "zakelijk" + "contract".
- **Tot 6 badges naast één naam** (page.tsx r. 621–659): herinnering-bel, pipeline, type, taken-teller, "Portaal actief"/"Uitgenodigd" — plus de tagregel.
- Icoontjes vóór elke adres-/telefoon-/e-mailcel: 3 iconen × 27 rijen = 81 herhaalde tekentjes die niets onderscheiden (de kolomkop zegt het al).

### 1.3 Klantdossier /klanten/[id] — kern: "wat speelt er bij deze klant, wat is de volgende actie?"

Het SectiePaneel-patroon en de compacte lege staten werken hier goed — de secties zelf zijn niet het probleem. Wel:

- **Naam dubbel** (breadcrumb + H1), **badges dubbel** (zelfde 4-badge-stapel als de lijst, incl. de type/tag-doublure).
- **CIJFERS-blok (rechterrail) herhaalt de hoofdkolom.** "Offertes 1 / Totale waarde € 22.972,27" staat 40px naast de OFFERTES-sectie die exact dezelfde offerte met exact hetzelfde bedrag toont. "Geaccepteerd 0 / Waarvan geaccepteerd € 0,00" is dubbel nul.
- **Twee bijna identieke composers direct onder elkaar**: TAKEN ("Nieuwe taak — bijv. terugbellen…") en TIJDLIJN ("Wat is er afgesproken…"). Beide één regel met icoon; nieuw personeel moet raden welke regel wat doet.
- **TIJDLIJN toont zoekveld + Filter-knop terwijl er "Nog niets vastgelegd" staat** — controls zonder iets om op te werken.

### 1.4 /offertes — kern: offerte vinden/openen; secundair: nieuwe maken

- **Drie parallelle "nieuwe offerte"-systemen in de app**: (a) hier drie losse knoppen Vrij / Onderhoud / Aanleg, (b) de NewOfferteDialog met 8 werkzaamheid-tegels (alleen via Cmd+N bereikbaar), (c) dashboard-knoppen "Nieuwe Aanleg" / "Nieuw Onderhoud". De dialoog is het beste ontwerp (TT-004: tegels → juiste wizard met scope voorgeselecteerd) en is nauwelijks vindbaar; de knoppen eromheen omzeilen hem.
- **"Concepten opruimen"** staat als permanente headerknop naast de creatieknoppen — een schoonmaakactie op dezelfde rang als de hoofdactie.
- **Mini-dashboard van 4 KPI-cards** (Totale waarde / Gemiddelde / Conversieratio / Open) tussen toolbar en tabel; conversie staat ook op /dashboard. Je komt hier voor een offerte, niet voor statistiek.
- **"Selecteer alle zichtbare (21)"-knop** (page.tsx r. 384) dupliceert de selecteer-alles-checkbox in de tabelkop (offerte-table.tsx r. 92).
- Statustabs herhalen de tellers die de pipeline-KPI's ook al geven.

### 1.5 Offertedetail /offertes/[id] — kern: inhoud + status + volgende stap

- **Status vier keer**: badge naast de titel ("Geaccepteerd"), groene banner ("Offerte geaccepteerd! … Start project"), workflow-stepper met vinkjes (Concept → … → Geaccepteerd), én een "Status"-knop in de header. Banner + stepper zitten nota bene in één component (offerte-workflow-stepper.tsx).
- **PDF twee keer**: "Bekijk PDF" én "PDF" als aparte headerknoppen (naast Status, Nieuwe versie, "..."). Vijf controls op één headerregel.
- **Scope-chips twee keer**: Werkzaamheden-card toont de 3 scope-chips; de Offerteregels-tabel herhaalt per regel dezelfde chip (8 regels = 8 extra chips).
- **Raw key lekt**: chip toont `water_elektra` — `scopeLabels` in `[id]/components/utils.ts` mist die entry en `scopeLabels[scope] || scope` (scopes-card.tsx r. 48, offerte-regels-card.tsx r. 76) valt terug op de databasesleutel.
- **Twee tijdlijnen naast elkaar in de rechterrail**: "Tijdlijn" (3 datums) + "Klantactiviteit" (3 events met datums) — één verhaal, twee cards.

### 1.6 "Nieuwe offerte"-dialoog + aanleg-wizard

- De dialoog zelf is het sterkste scherm van de schouw: één vraag, 8 tegels, sneltoets-hint. Niet aankomen (behalve vindbaarheid, zie 1.4).
- **Wizard toont drie voortgangsindicatoren tegelijk**: "Stap 2 van 5"-tekst, progressbar met percentage (40%), én de 5-bollen-stepper. Eén stepper volstaat.
- **Samenvatting-rail herhaalt op stap 2 letterlijk de twee velden ernaast** (Klant —, Bereikbaarheid: Goed, Scopes 0). Een samenvatting die niets samenvat.
- **Dubbele tegelkeuze**: net in de dialoog een werkzaamheid-tegel gekozen, direct daarna een visueel identiek raster van 9 scope-tegels. Functioneel verschillend (TT-004), maar de vormgeving zegt "dit heb je net al gedaan".
- Rechts stapelen drie navigatieknoppen (Volgende / Terug naar Template / Annuleren) onder de samenvatting.

### 1.7 /projecten + projectdetail — kern: voortgang zien + naar de juiste module

- **Lijst: 4 KPI-cards herhalen exact de statustabs eronder** (Gepland 5 / In Uitvoering 3 / Afgerond 2 / Nacalculatie 1 — twee keer dezelfde vier getallen binnen 150px).
- **Detail: voortgang dubbel.** Focus-card "Uren voortgang 69.9/86.0" naast module-tile "Uitvoering 69.9/86.0 uur"; focus-card "Planning 2/7 taken" naast tile "Planning 2/7 taken".
- **Status dubbel**: badge in de titel + fasebalk (Gepland → … → Gefactureerd).
- **Twee navigatiesystemen**: module-tiles op de pagina én een "Project Tools"-groep (Kosten tracking, Kwaliteit) die in de sidebar verschijnt — deels overlappend met de tile "Kosten".
- **Leeg Klantgesprek domineert**: amber banner "ZICHTBAAR VOOR KLANT" + composer + toggle voor 0 berichten — het luidste element van de pagina waarschuwt voor iets dat er niet is.

### 1.8 /instellingen — kern: een tarief of instelling snel vinden en aanpassen

- **10 tabs + 4 verstopte instellingenpagina's.** Machinebeheer, Catalogus onderhoud, Tekstblokken en Mail-triggers leven onder `/instellingen/*` maar staan alléén in het profielmenu ("Assets & Data", app-sidebar.tsx r. 114–129) — twee navigatiesystemen voor één instellingendomein. De subtitel "Beheer je tarieven, normuren en correctiefactoren" dekt 3 van de 10 tabs.
- **Beveiliging-tab bevat nul instellingen**: twee statische infokaarten (2FA staat op /profiel; sessietimeout staat in Clerk). Een tab die alleen uitlegt dat je ergens anders moet zijn.
- **Herinneringen-tab bevat twee overlappende systemen**: de debiteurenladder (automatisch, dagen vanaf verzenddatum, eigen "Ladder opslaan") én handmatige herinnering/aanmaning-velden (dagen vanaf vervaldatum, eigen "Opslaan"), met bovenaan een uitlegblok dat het verschil moet uitleggen. Dat uitlegblok ís het bewijs van de complexiteit.
- **Voorwaarden op drie plekken**: Koppelingen-tab bevat "Algemene Voorwaarden" (PDF-upload — geen koppeling), Huisstijl-tab heeft "Voorwaardenteksten" (3 accordions), en er is een aparte pagina /instellingen/tekstblokken.
- **Correctiefactoren: Status-kolom toont bij álle ±30 rijen "Standaard"** — een kolom zonder informatie.
- Deelfacturen en E-mail Templates zijn hele tabs rond een lege lijst (prima inhoud, maar de lege staat mag kleiner).

---

## 2. Concrete versimpelingen per bestand/component

### Dashboard
| Wat | Waar | Ingreep |
|---|---|---|
| Stat-boxen onder segmentbar weg | `src/components/dashboard/pipeline-bento.tsx` | De bar krijgt labels+tellers ín of direct onder de segmenten; de vier losse boxen vervallen. |
| Project Status-donut weg | `pipeline-bento.tsx` | Info zit al in KPI "Actieve Projecten" en in /projecten-tabs. Ruimte gaat naar "Aandacht nodig". |
| KPI's 6 → 4 | `src/components/dashboard/financieel-grid.tsx` | "Openstaande Offertes" (dubbel met pipeline) en "Uren deze Maand" (staat op /uren en /rapportages) vervallen of worden één samengestelde regel. |
| "Aandacht nodig" naar de kop, altijd zichtbaar | `src/components/dashboard/aandacht-nodig.tsx` + `dashboard/page.tsx` | Bovenaan naast de begroeting; entrance-animatie vervangen door animatie die niet op `opacity: 0` kan blijven hangen (CSS-only, of `whileInView` met fallback). |
| Voortgangscards + Recente Activiteit samenvoegen | `pipeline-bento.tsx` | Eén "Actueel"-kolom: lopende projecten (voortgang) + laatste offerte-events, i.p.v. twee losse blokken. |

### Klanten
| Wat | Waar | Ingreep |
|---|---|---|
| Cardkop "Klantenlijst / 27 klanten…" weg | `src/app/(dashboard)/klanten/page.tsx` | Tabel direct onder de filterpills; teller leeft al in "Alle (27)". |
| Tag-doublures onderdrukken | `klanten/page.tsx` + `klanten/[id]/page.tsx` | Tags die (case-insensitief) gelijk zijn aan het klantType-label of aan "contract"-met-Onderhoud-status niet als extra badge renderen. Idem in de seed (`convex/demoSeed.ts`): tags niet vullen met het type. |
| Celiconen weg | `klanten/page.tsx` | MapPin/Phone/Mail-iconen uit de datacellen; kolomkoppen volstaan. |
| Badge-budget per rij | `klanten/page.tsx` r. 621–659 | Max: pipeline + type + één signaal (herinnering óf taken óf portaal); rest naar tooltip/detail. |

### Klantdossier
| Wat | Waar | Ingreep |
|---|---|---|
| CIJFERS-blok terugbrengen tot één regel | `klanten/[id]/page.tsx` | "1 offerte · € 22.972 · 0 geaccepteerd" als subregel onder GEGEVENS; het aparte kaartblok vervalt. |
| Tijdlijn-zoek/filter pas bij inhoud | `src/components/tijdlijn/klant-tijdlijn.tsx` | Zoekveld + Filter verbergen zolang < ~8 items (composer blijft — dat is de invoer). |
| Composers onderscheiden | `klant-taken-card.tsx` / `klant-tijdlijn.tsx` | Geen structuuringreep; alleen placeholder/icoon duidelijker verschillend. Composer-patroon zelf (CLAUDE.md) blijft ongemoeid. |
| Headerbadges | `klanten/[id]/page.tsx` r. 276–286 | Zelfde dedupe als de lijst. |

### Offertes (lijst)
| Wat | Waar | Ingreep |
|---|---|---|
| Eén "Nieuwe offerte"-knop → NewOfferteDialog | `src/app/(dashboard)/offertes/page.tsx` (headerknoppen), `src/components/new-offerte-dialog.tsx`, `shortcuts-provider.tsx` | Vrij/Onderhoud/Aanleg-knoppen vervangen door één primaire knop die de bestaande 8-tegel-dialoog opent ("Vrij" wordt daar een 9e tegel of blijft via de dialoogvoet). Dashboardknoppen (`dashboard/page.tsx`) idem. Eén ingang, drie plekken minder. |
| "Concepten opruimen" degraderen | `offertes/page.tsx` / `components/offerte-toolbar.tsx` | Naar het Presets/…-menu, of alleen tonen als concepten > 5. |
| KPI-cards → één statregel | `offertes/page.tsx` r. 325–360 | Vier cards worden één rustige regel boven de tabs ("€ 183.046 totaal · gem. € 8.716 · 57% conversie · 14 open") of vervallen. |
| "Selecteer alle zichtbare"-knop weg | `offertes/page.tsx` r. 384 | Checkbox in de tabelkop (offerte-table.tsx r. 92) doet dit al. |

### Offertedetail
| Wat | Waar | Ingreep |
|---|---|---|
| Status: van 4 naar 2 plekken | `src/components/offerte/offerte-workflow-stepper.tsx`, `[id]/components/offerte-header.tsx` | Stepper blijft (toont traject + vinkjes); de banner wordt de CTA-regel ván de stepper (één component, geen apart blok); badge naast de titel blijft; "Status"-knop verhuist naar het "..."-menu. |
| Eén PDF-knop | `offerte-header.tsx` | "Bekijk PDF" (preview-modal) blijft; download als item in "..." of in de modal. |
| Scope-chip per regel weg | `[id]/components/offerte-regels-card.tsx` r. 76 | Regels groeperen per scope (kopregel per scope) óf chip-kolom schrappen; Werkzaamheden-card blijft dé plek voor scopes. |
| `water_elektra`-label fixen | `[id]/components/utils.ts` | Entry "Water & Elektra" toevoegen aan `scopeLabels` (en map vergelijken met de centrale labelmaps — dit is precies de labelmap-drift uit CLAUDE.md stap 9). |
| Tijdlijn + Klantactiviteit samenvoegen | `[id]/components/tijdlijn-card.tsx`, `src/components/offerte/engagement-timeline.tsx` | Eén chronologische card; de drie systeemdatums worden events tussen de klant-events. |

### Wizard
| Wat | Waar | Ingreep |
|---|---|---|
| Eén voortgangsindicator | `src/components/offerte/wizard-steps.tsx` (r. 58–62, 250) | Progressbar + percentage weg; stepper + "Stap 2 van 5" blijven. |
| Samenvatting pas als er iets te vatten is | `nieuw/aanleg/components/AanlegKlantScopesStep.tsx` r. ~283 | Op stap 2 alleen een compacte scopes-teller; volledige samenvatting vanaf stap 3/review. |
| "Terug naar Template" → tekstlink | `nieuw/aanleg/components/AanlegNavigation.tsx` | Eén primaire knop (Volgende), rest tekstniveau. |
| Scope-raster visueel onderscheiden van dialoogtegels | `AanlegKlantScopesStep.tsx` | Compactere checklist-look (multi-select) i.p.v. hetzelfde grote tegelraster als de één-keuze-dialoog. |

### Projecten
| Wat | Waar | Ingreep |
|---|---|---|
| KPI-cards óf tabs (lijst) | `src/app/(dashboard)/projecten/page.tsx` | Tellers zitten al in de tabs → de vier cards vervallen. |
| Focus-cards + module-pills fuseren (detail) | `src/components/project/project-focus-cards.tsx`, `module-pills.tsx` | De pills "Planning" en "Uitvoering" wórden de voortgangscards (klikbaar); geen tweede rij met dezelfde getallen. |
| Sidebar "Project Tools" weg | `src/components/app-sidebar.tsx` (projectSubItems) | Kosten/Kwaliteit als module-pill op de pagina; één navigatiesysteem. |
| Leeg Klantgesprek compact | `src/components/meldingen/klant-thread-paneel.tsx` | Bij 0 berichten: één rustige regel + composer; amber banner pas zodra er klant-zichtbare inhoud is. |

### Instellingen
| Wat | Waar | Ingreep |
|---|---|---|
| Beveiliging-tab weg | `instellingen/page.tsx` r. 313–317, 398–470 | Infokaarten verhuizen naar /profiel (waar 2FA al staat) of naar een infoblok onder Koppelingen. 10 → 9 tabs. |
| Herinneringen: één systeem, één Opslaan | `components/herinneringen-tab.tsx`, `debiteurenladder-card.tsx` | Handmatige velden presenteren als onderdeel ván de ladder (of als "handmatig verzenden"-sectie binnen dezelfde card); één opslagactie; het uitlegblok kan dan weg. |
| AV-upload verhuizen | `components/koppelingen-tab.tsx` → `huisstijl-tab.tsx` | "Algemene Voorwaarden" bij Voorwaardenteksten; Koppelingen bevat dan alleen koppelingen. |
| Status-kolom Correctiefactoren weg | `components/factoren-tab.tsx` | Alleen een "Aangepast"-badge tonen wáár afwijkend van standaard. |
| Verstopte pagina's koppelbaar maken | `instellingen/page.tsx`, `app-sidebar.tsx` | Minimaal: op /instellingen een rustige linkrij "Meer instellingen: Machines · Catalogus · Tekstblokken · Mail-triggers". Structurele fusie (tabs → secties) is een groter project, niet in deze ronde. |
| Subtitel dekkend maken | `instellingen/page.tsx` r. 271 | "Beheer tarieven, templates en koppelingen" o.i.d. |

---

## 3. Prioritering

**P1 — pure winst, klein risico (doublures schrappen):**
1. Offertedetail: status 4→2, één PDF-knop, scope-chips per regel, `water_elektra`-label (bugfix).
2. Projecten: KPI-cards vs. tabs (lijst) en focus-cards vs. pills (detail).
3. Klanten: tag/type-dedupe + cardkop weg + celiconen.
4. Offertes-lijst: "Selecteer alle"-knop weg, KPI-cards → statregel.
5. Klantdossier: CIJFERS → één regel; tijdlijn-controls bij leeg verbergen.

**P2 — één ingang voor "nieuwe offerte"** (offertes-header, dashboardknoppen, dialoog): grootste conceptuele opruiming, raakt meerdere schermen tegelijk, dus als eigen stap.

**P3 — dashboard herindelen** (stat-boxen, donut, Aandacht-nodig naar de kop, activiteit fuseren): het meest zichtbare scherm; afstemmen met colorize (zie §4) vóór uitvoering.

**P4 — instellingen** (Beveiliging-tab, Herinneringen-fusie, AV-verhuizing): laag risico maar minder dagelijks bezocht.

**P5 — wizard-chrome** (indicatoren, samenvatting, scope-raster-look): raakt geteste flows (E2E wizards) — als laatste, met de wizard-tests ernaast.

**Bewust NIET doen:** de 8-tegel-dialoog inhoudelijk wijzigen (TT-004), `offertes.type` of scopes aanraken, het SectiePaneel/composer-patroon wijzigen, ResponsiveTable-gedrag, secties uit het klantdossier verwijderen (alleen indikken), functionaliteit uit Instellingen schrappen (alleen herplaatsen).

---

## 4. Verwachte botsingen met kleur/expressie-werk (colorize)

Gelezen: `docs/design/plannen/kleur-en-consistentie.md`. Afspraken die ik voorstel:

1. **Dashboard-bento — volgorde-afspraak nodig.** Colorize wil de hex-eilanden in `financieel-grid.tsx`/`pipeline-bento.tsx` hertokenen; ik wil in diezelfde bestanden cards schrappen/fuseren. Eérst distill (minder cards), dan kleur — anders tokent colorize cards die daarna verdwijnen. Dit is de grootste overlap.
2. **Pipeline-segmentbar: kleur blijft.** Ik schrap de stat-boxen, niet de gekleurde bar — die is straks de enige plek waar de statuskleuren het verhaal dragen. Ruimte maken ≠ karakter strippen.
3. **Statusbadges.** Ik verwijder dúbbele badges (status stond 4× op offertedetail); colorize hertokent de overblijvende. Geen conflict mits zij op de overgebleven plekken werken — ik lever per scherm de "ene waarheid"-plek op (badge + stepper).
4. **Scope-chips.** Ik haal ze uit de regels-tabel; de Werkzaamheden-card wordt dé scope-plek en mag van colorize juist expressiever (scope-tokens bestaan al en zijn per stuk 1× in gebruik).
5. **Lege staten.** Ik maak lege staten kleiner (Klantgesprek, Deelfacturen, E-mail Templates); als delight/colorize daar illustratie wil toevoegen: graag, maar binnen de compacte variant (EmptyState `compact` blijft de norm op meersectie-pagina's).
6. **"Aandacht nodig" prominenter** wil ik; colorize wil semantische kleur — dit versterkt elkaar juist (amber/rood urgentie op de nieuwe toppositie), samen oppakken.
7. **Entrance-animaties**: mijn opacity-0-fix in aandacht-nodig raakt eventueel motionwerk van bolder/delight — één eigenaar aanwijzen voor de dashboard-animaties.

---

## 5. Geraakte bestanden

```
src/app/(dashboard)/dashboard/page.tsx
src/components/dashboard/financieel-grid.tsx
src/components/dashboard/pipeline-bento.tsx
src/components/dashboard/aandacht-nodig.tsx
src/app/(dashboard)/klanten/page.tsx
src/app/(dashboard)/klanten/[id]/page.tsx
src/components/tijdlijn/klant-tijdlijn.tsx
src/components/klanten/klant-taken-card.tsx
src/app/(dashboard)/offertes/page.tsx
src/app/(dashboard)/offertes/components/offerte-toolbar.tsx
src/app/(dashboard)/offertes/components/offerte-table.tsx
src/app/(dashboard)/offertes/[id]/components/offerte-header.tsx
src/app/(dashboard)/offertes/[id]/components/offerte-regels-card.tsx
src/app/(dashboard)/offertes/[id]/components/scopes-card.tsx
src/app/(dashboard)/offertes/[id]/components/tijdlijn-card.tsx
src/app/(dashboard)/offertes/[id]/components/utils.ts
src/components/offerte/offerte-workflow-stepper.tsx
src/components/offerte/engagement-timeline.tsx
src/components/offerte/wizard-steps.tsx
src/app/(dashboard)/offertes/nieuw/aanleg/components/AanlegKlantScopesStep.tsx
src/app/(dashboard)/offertes/nieuw/aanleg/components/AanlegNavigation.tsx
src/components/new-offerte-dialog.tsx
src/components/providers/shortcuts-provider.tsx
src/app/(dashboard)/projecten/page.tsx
src/app/(dashboard)/projecten/[id]/page.tsx
src/components/project/project-focus-cards.tsx
src/components/project/module-pills.tsx
src/components/meldingen/klant-thread-paneel.tsx
src/app/(dashboard)/instellingen/page.tsx
src/app/(dashboard)/instellingen/components/herinneringen-tab.tsx
src/app/(dashboard)/instellingen/components/debiteurenladder-card.tsx
src/app/(dashboard)/instellingen/components/koppelingen-tab.tsx
src/app/(dashboard)/instellingen/components/huisstijl-tab.tsx
src/app/(dashboard)/instellingen/components/factoren-tab.tsx
src/components/app-sidebar.tsx
convex/demoSeed.ts
```
