# Masterplan designprogramma — Top Tuinen OS

*Consolidatie van de zes fase-1-plannen (audit, critique, kleur-en-consistentie, distill, onboard, optimize), 14 aug 2026. Dit document is ter goedkeuring door Ricardo vóór uitvoering. Er is nog niets gewijzigd.*

---

## 1. Designrichting: "Vakwerk in het groen", gebouwd op "Loof & Leem"

Eén richting, twee lagen die elkaar aanvullen:

- **"Vakwerk in het groen"** (critique) is het verhaal: Top Tuinen verkoopt buitenlicht, groen en vakmanschap — de software moet als de werf voelen, niet als een crypto-dashboard. Licht-eerst, één merkkleur, rust in de vlakken, karakter in koppen en merkdetails.
- **"Loof & Leem"** (kleur-en-consistentie) is de uitvoering van dat verhaal in tokens: één merkgroen (hue 152, geankerd op mobiel #4ADE80), warm groengetinte neutralen (nooit puur wit/zwart), terracotta/oker als enige warme accent, één statussemantiek voor de hele app. Blauw en paars verdwijnen (behalve steenblauw als informatiestatus en `--scope-specials`).

Concreet: het uitgewerkte OKLCH-palet uit `kleur-en-consistentie.md` §2 ís de kleuruitvoering van Concept A. Dark mode blijft bestaan als volwaardige "bosavond" op dezelfde groene as (voorman in de bus), maar light wordt de kantoor-default (keuzepunt 1). Typografie: Geist blijft werkpaard; een display-serif voor paginakoppen en grote bedragen is keuzepunt 2. Vlak-discipline: minder gelijke kaarten, één heldcijfer per scherm, `SectiePaneel` als norm.

---

## 2. Werkstromen in uitvoeringsvolgorde

Tien werkstromen, uitvoerbaar door aparte agents. Volgordeketens (uit de "Geraakte bestanden"-overlap):

```
WS1 (bugs) ──→ WS2 (tokens) ──→ WS3 (dashboard: distill → kleur)
                         ├────→ WS4 (statusbron + kanban-inhoud)
                         └────→ WS10 (kleur-sweep modules, ná WS4)
WS1 ──→ WS5 (responsive/a11y) ──→ WS6 (distill werkschermen) ──→ WS7 (lege staten) ──→ WS8 (performance)
WS1 ──→ WS5 ──→ WS9 (configurator/portaal)
```

Per bestand de bindende volgorde bij overlap:
- `globals.css`: WS1 (recharts-regel) → WS2 (nieuw palet) → consumenten (WS3/WS4/WS10)
- `financieel-grid.tsx` / `pipeline-bento.tsx` / dashboard: WS1 (#141414-fix, minimaal) → WS3, en bínnen WS3 **eerst distill (cards schrappen), dán kleur** — anders wordt er gehertokend wat daarna verdwijnt
- kanban-bestanden: WS1 (layout, geen h-scroll) → WS4 (kleuren/inhoud)
- `klanten/page.tsx`: WS1 → WS5 → WS6 → WS8 (O5)
- `offertes/page.tsx` + `offerte-header.tsx`: WS5 → WS6 → WS8 (O1/O8)
- `sectie-paneel.tsx`: WS5 (klikvlak) → WS7 (hint-prop)
- `app-sidebar.tsx`: WS3 (styling) → WS6 (Project Tools) → WS8 (O9)
- root `layout.tsx`: WS2 (font, O12) → WS8 (O14-onderzoek)
- configurator: WS1 (404/telefoon) → WS5 (CTA-contrast, aria-required) → WS9 (herontwerp)

### WS1 — Bugs & quick wins (P0)
Zie §3. Kan direct starten, blokkeert niets anders.

### WS2 — Fundament: tokens & typografie (P0, na WS1)
Doel: elk volgend bestand erft het merk; zonder dit is elke fix cosmetisch.
- `src/app/globals.css` — "Loof & Leem"-palet light+dark (§2 kleurplan), statusreceptuur, nieuwe tokengroepen (`--status-betaald/-vervallen/-herinnering`, `--lead-*`, `--melding-*`, `--accent-warm`), selection/scrollbar groentint, paarsblauwe `--sidebar-primary` weg *(kleur Stap A; critique fundament)*
- `src/app/globals.css` — focusring light ≥3:1 (`--ring` donkerder/primary-tint) *(audit fix 15)*
- `src/app/layout.tsx` — displayfont via `next/font` (`--font-display`) mits keuzepunt 2 akkoord; `Geist_Mono`-gebruik controleren, anders verwijderen/`preload: false` *(critique; optimize O12)*
- Na afloop beide themes visueel controleren; dev-server herstarten bij ontbrekende CSS-regels (CLAUDE.md-valkuil).

### WS3 — Dashboard: eerst distill, dan kleur (P1, na WS2)
Doel: het meest bekeken scherm van ~20 gelijke blokken naar één verhaal.
Fase 3a — distill *(distill §2-dashboard)*: stat-boxen onder segmentbar weg, Project Status-donut weg, KPI's 6→4, "Aandacht nodig" naar de kop + opacity-0-animatiefix, voortgangscards + Recente Activiteit fuseren (`pipeline-bento.tsx`, `financieel-grid.tsx`, `aandacht-nodig.tsx`, `dashboard/page.tsx`).
Fase 3b — kleur/expressie *(kleur Stap C; critique; audit fix 2–4)*: resterende blokken op tokens en `var(--chart-*)`, heldcijfer omzet (displayfont), trendkleur aan richting koppelen, alleen prioriteit "hoog" amber, "Details →"-links leesbaar + klikvlak ≥24px, sublabels ≥11px. Plus `app-sidebar.tsx`: actieve staat groen, logo als merkmoment, badges in één stijl *(critique)*.

### WS4 — Eén statusbron + kanban-inhoud (P1, na WS2; parallel aan WS3)
Doel: dezelfde status = dezelfde kleur, overal.
- `src/lib/constants/statuses.ts` + `status-badge.tsx` uitbreiden tot enige bron voor project-, factuur-, lead- en meldingstatussen; daarna de 40 lokale `statusConfig`-maps vervangen door imports *(kleur Stap B, bestandslijst §5 kleurplan)*
- Kanban op `--lead-*`/`--melding-*`; `lead-card.tsx`: bedrag prominent, bron-badge → klein tekstlabel, paarse rand weg; `melding-card.tsx`: klacht/schade visueel onderscheiden van serviceverzoek *(kleur Stap D; critique)*

### WS5 — Nooit zijwaarts scrollen + toegankelijkheid (P1, na WS1)
Doel: de CLAUDE.md-regel afdwingen op mobiel/tablet en de gemeten AA-fouten dichten. *(alles audit)*
- `offertes/components/status-tabs.tsx` + tabsbalken /facturen en /instellingen: onder `md` wrap of `Select` (fix 6)
- `uren/page.tsx`: kale `Table` → `ResponsiveTable` met kolom-widths (fix 7)
- Headerbalken `klanten/page.tsx` r.1078, /offertes, /facturen: `flex-wrap` of acties in `DropdownMenu` (fix 8)
- `projecten/page.tsx` r.396/516: rij-inhoud als echte `<Link>` (toetsenbord/screenreader/cmd-klik) (fix 9)
- `thin-progress-bar.tsx` stepper-labels ≥4,5:1; `scope-tag.tsx` houtwerk-variant; `sectie-paneel.tsx` infoknop klikvlak ≥24px (fixes 10, 11, 14)
- Configurator: CTA `bg-green-600` → `bg-green-700` (≈4,8:1) + `required`/`aria-required` op verplichte velden (fix 12)

### WS6 — Distill werkschermen (P2, na WS5)
Doel: doublures weg, één ingang per actie. *(alles distill, + critique waar vermeld)*
- **Offertedetail:** status 4→2 plekken (banner wordt CTA-regel van de stepper), één PDF-knop, scope-chips uit de regels-tabel, Tijdlijn + Klantactiviteit fuseren; voorcalculatie-paneel navy → neutraal+groen *(critique)*
- **Offertes-lijst:** één primaire knop "Nieuwe offerte" → `NewOfferteDialog` (ook dashboardknoppen erdoor vervangen), "Concepten opruimen" degraderen, 4 KPI-cards → één statregel, dubbele "Selecteer alle"-knop weg; dialoog: Tuinaanleg/Onderhoud groter, sneltoetsletter zichtbaar *(critique)*
- **Klanten:** cardkop weg, tag/type-dedupe (ook `convex/demoSeed.ts`), celiconen weg, badge-budget per rij; dossier: CIJFERS → één regel, headerbadge-dedupe
- **Projecten:** lijst KPI-cards weg (tabs volstaan), gekleurde cirkel-iconen weg + rij-affordance *(critique)*, detail focus-cards + module-pills fuseren, sidebar "Project Tools" weg, "ZICHTBAAR VOOR KLANT" van knalgeel naar rustige rand + oogje *(critique)*, leeg klantgesprek compact
- **Instellingen:** Beveiliging-tab weg, Herinneringen één systeem/één Opslaan, AV-upload naar Huisstijl, Status-kolom correctiefactoren weg, linkrij naar de vier verstopte pagina's, subtitel dekkend; marges gegroepeerd *(critique)*
- **Wizard (laatste, met E2E-wizardtests ernaast):** één voortgangsindicator, samenvatting pas vanaf stap 3, "Terug naar Template" → tekstlink, scope-raster als checklist-look; label "Klantvriendelijkheid (Lastig—Makkelijk)" herformuleren *(critique)*

### WS7 — Lege staten & microcopy (P2, na WS6)
Doel: elke lege plek leert wat hij doet en wat de volgende actie is. *(alles onboard)*
- `sectie-paneel.tsx`: `SectieLegeStaat` optionele `hint`-prop; daarmee tijdlijn-, onderhoud- en documenten-copy (items 3–6)
- Login `src/app/page.tsx`: "Wachtwoord vergeten?"-link + uitnodigingsregel (item 7)
- Offertes-KPI's labelen bij actieve zoek/filter (item 2, sluit aan op de WS6-statregel)
- `machinepark/page.tsx` + `verzuim/page.tsx`: actieknoppen/verwijzingen (items 10–11)
- `klant-tijdlijn.tsx`: zoek/filter verbergen zolang <±8 items *(distill, hoort inhoudelijk hier)*

### WS8 — Performance (P2, deels parallel; architectuurdeel na keuzepunt 6)
Doel: bundle- en subscriptionlekken dichten; gevoelde laadtijd. *(alles optimize)*
- Quick wins: O1 (PDF-import uit `@/components/pdf/dynamic`), O2 (`"sideEffects": ["*.css"]` in package.json), O3 (PDF-barrel splitsen), O4 (analytics-barrel), O5 (klantenfilter op `debouncedSearchTerm`), O13 (dood webpack-blok)
- Middelgroot: O6 (rij-memo `ResponsiveTable` — alleen interne memoization, gedrag ongemoeid), O7+O8 (animaties naar transform/opacity), O9 (`convex/sidebarTellingen.ts` — 4→1 subscriptions)
- Architectuur (keuzepunt 6): O11 (shell direct renderen, auth-gate om de content — heft ook het "zwarte laadgat" uit critique op), O10 (prefetch versoberen), O14 (alleen ondérzoek providers per route-groep). FOUC/licht-flits bij laden *(critique)* hier mee onderzoeken.
- Meetplan: production build vóór/na met gestopte dev-server (CLAUDE.md), route-groottes vergelijken; React Profiler voor O5/O6.

### WS9 — Configurator & portaal als merkwereld (P3, na WS5)
Doel: de klantgerichte kant wordt het visitekaartje. *(critique; onboard; kleur Stap E)*
- Volwaardige `/configurator`-indexpagina ("Waar kunnen we u mee helpen?" + drie dienstkaarten) ter vervanging van de WS1-redirect (keuzepunt 3)
- `configurator/layout.tsx` + wizards: licht thema, sfeerbeeld per dienst, formulier op wit, prijsoverzicht als "offertepapier"; naamregel: klant ziet "Top Tuinen"
- Stapvolgorde: specificaties → foto's → prijsindicatie → gegevens (keuzepunt 5); plaats-placeholder "Amsterdam" → "Echt"
- Portaal: hexwaarden onder `portaal/(portal)/**` naar een `.portal`-tokenscope in globals.css (zelfde merkwereld, wel tokens)

### WS10 — Kleur-sweep overige modules (P3/P4, na WS2+WS4; parallelliseerbaar per module)
Doel: de ±2.000 ad-hoc kleurklassen naar semantische tokens. *(kleur Stap F)*
Analytics-map, facturen, nacalculatie, factuur-sidebar, empty-states (incl. eventueel blad-lijnmotief *(critique)* — binnen de compacte variant), onboarding-checklist, import-dialog, gebruikers, archief, configurator/status, scope-forms. Vuistregel uit het kleurplan: positief→primary/trend, negatief→destructive, info→hue 245, waarschuwing→hue 85, voortgang→`accent-warm`.

---

## 3. Werkstroom 1 — Bugs & quick wins (P0, detail)

Echte fouten, klein van omvang, door meerdere agents bevestigd. Eén agent, één dag.

| # | Bug | Bestand(en) | Fix | Bron |
|---|---|---|---|---|
| B1 | Light mode dashboard onleesbaar (gemeten 1,07:1): hardcoded `bg-[#141414] border-white/[0.06]` | `financieel-grid.tsx`, `pipeline-bento.tsx`, `vloot-badge.tsx` | → `bg-card border-border`; `text-*-400` → duo's `text-*-600 dark:text-*-400` | audit (kritiek), kleur §1.4 |
| B2 | Snelactieknoppen + prioriteitsbadges onder AA in light (1,3–2,2:1) | `dashboard/page.tsx` r.361, `aandacht-nodig.tsx` r.25–39 | duo-varianten (`text-green-700 dark:text-green-400` enz.) | audit (hoog) |
| B3 | Rauwe key `water_elektra` zichtbaar op offertedetail | `offertes/[id]/components/utils.ts` | entry "Water & Elektra" in `scopeLabels`; map vergelijken met centrale labelmaps (CLAUDE.md scope-stap 9) | distill, critique |
| B4 | `hsl(var(--x))` om oklch-tokens = ongeldige CSS; recharts-tooltipstyling valt stil terug | `globals.css` r.436–462 | → `var(--x)` | kleur §1.6 |
| B5 | Kale `/configurator` = 404 in de publieke funnel | `(public)/configurator/` | nú: redirect naar `/configurator/gazon`; volwaardige index in WS9 | audit, critique, onboard |
| B6 | /klanten toont "Voeg je eerste klant toe" bij 0-filterresultaat (27 klanten aanwezig) + teller "0 klanten in je bestand" | `klanten/page.tsx` ±1204, 1219–1232 | drie varianten (zoek/filter/echt leeg) + "{n} van 27 klanten"; wis-knoppen | onboard (P1) |
| B7 | Kanban /leads (1464px op 1600-viewport!) en /meldingen scrollen horizontaal — schending CLAUDE.md-regel | `kanban-board.tsx`, `kanban-column.tsx`, `meldingen-board.tsx`, `melding-column.tsx` | kolommen `grid grid-cols-[repeat(n,minmax(0,1fr))]` + `min-w-0`/truncate; onder `lg` stapelen. Board nooit breder dan container | audit (hoog), critique |
| B8 | Placeholder "+31 (0)00 000 0000" in klantgerichte footer | `configurator/layout.tsx` | echt telefoonnummer (bij Ricardo opvragen) | critique |

*Niet in deze lijst:* "Meldingen ZZTEST" uit de audit-schouw — geverifieerd browsercache-artefact van een eerdere debugsessie; broncode is schoon. Geen actie.

---

## 4. Dedupe — elk punt in precies één werkstroom

| Bevinding | Genoemd in | Woont in |
|---|---|---|
| `/configurator` 404 | audit, critique, onboard | **WS1** (redirect); index-page in WS9 na keuzepunt 3 |
| `bg-[#141414]`-eiland dashboard | audit, kleur (critique impliciet) | **WS1** (minimale tokenfix); herindeling/expressie in WS3 |
| Kleurloos zinc-tokenbestand / geen merkkleur | critique, kleur | **WS2** |
| `water_elektra`-label | distill, critique | **WS1** |
| Kanban horizontaal scrollen | audit, critique | **WS1** (layout); kleuren/inhoud WS4 |
| Dashboard-herhaling (KPI's/donuts/stat-boxen) | distill, critique | **WS3** |
| "Aandacht nodig" te luid / alles even amber | critique, distill, audit (contrast) | **WS3** (contrastdeel in WS1-B2) |
| Versnipperde "Nieuwe offerte"-ingangen | distill, critique | **WS6** |
| Dubbele PDF-knop offertedetail | critique, distill | **WS6** |
| Status-kleurmismatch per scherm / badge-confetti | kleur, critique | **WS4** |
| Zwart laadgat / auth-waterval / FOUC | critique, optimize (B1) | **WS8** (O11) |
| Lege-staat-verbeteringen klantdossier | onboard, distill (tijdlijn-controls) | **WS7** |
| Focusring light | audit | **WS2** |
| Configurator-CTA-contrast | audit | **WS5** |

---

## 5. Keuzepunten voor Ricardo

1. **Palet & thema-default.** "Loof & Leem"-palet doorvoeren zoals gespecificeerd, en wordt light de default voor kantoor (dark blijft volwaardig)? Alternatieven: Concept B (mono-groen donker) of C (werkbon). **Aanbeveling: ja — Concept A met het Loof & Leem-palet, light-eerst.** Grootste sprong voor één bestand werk; deelt het merk met mobiel.
2. **Display-serif voor koppen en grote bedragen** (Fraunces of Gambetta via `next/font`). **Aanbeveling: ja, maar beperkt** tot paginakoppen + heldcijfers; Geist blijft UI-werkpaard. Makkelijk terug te draaien (één `--font-display`-variabele).
3. **Configurator-index: bouwen of redirecten?** **Aanbeveling: beide, in volgorde** — WS1 zet nu een redirect naar `/gazon` (klant strandt nooit meer), WS9 bouwt de echte keuzepagina met dienstkaarten.
4. **Hoe agressief mag distill schrappen?** **Aanbeveling:** doublures (distill-P1) volledig schrappen; dashboard-herindeling conform plan (donut weg, KPI 6→4); bij Instellingen alléén herplaatsen, niets functioneels schrappen; wizard-chrome als laatste en alleen met groene E2E-wizardtests.
5. **Configurator-stapvolgorde omdraaien** (gegevens pas ná de prijsindicatie). Raakt de leadfunnel. **Aanbeveling: ja in WS9**, met de bestaande configurator-E2E's als vangnet en de status-flow ongewijzigd.
6. **Performance-architectuur** (O10 prefetch versoberen, O11 auth-gate/shell, O14 providers per route-groep). **Aanbeveling: O11 en O10 uitvoeren** (grootste gevoelde winst, heft het zwarte laadgat op); O14 eerst alleen onderzoeken.
7. **Eén ingang "Nieuwe offerte"** — de losse Vrij/Onderhoud/Aanleg-knoppen en de twee dashboardknoppen vervallen ten gunste van de `NewOfferteDialog` (die nu alleen achter ⌘N zit). **Aanbeveling: ja** — de dialoog is het beste ontwerp (TT-004) en wordt eindelijk vindbaar.

---

## 6. Bewust NIET doen (afgeraden of uitgesteld)

- **Concept C "Werkbon-esthetiek"** — sterkste karakter, maar kanban/planning wringen erin; risico op tweede herontwerp. Afgewezen ten gunste van Concept A.
- **8-tegel-dialoog inhoudelijk wijzigen, `offertes.type` of scopes aanraken** — harde TT-004-regel (40+ switch-punten). Alleen vindbaarheid/gewicht (WS6).
- **SectiePaneel-/composer-patroon structureel wijzigen** — vastgelegd patroon met tests; alleen placeholder/iconen differentiëren (WS7) en klikvlak (WS5).
- **Instellingen-tabs structureel fuseren tot secties** — distill noemt het zelf "groter project, niet deze ronde". Alleen de WS6-herplaatsingen.
- **Merk-delight nu bouwen** (groeiende-tak-stepper, seizoensbegroeting, blad-lijnmotief login) — pas ná WS2/WS3, anders decoratie op een generiek fundament. Blad-motief in lege staten mag beperkt mee in WS10.
- **O14 daadwerkelijk uitvoeren** (providers verhuizen) — alleen onderzoek; `ConvexProviderWithClerk`-koppeling kan de configurator breken.
- **Fade-in-tussenstaat "optimaliseren"** — audit: eerst in prod meten, deels dev-server-artefact.
- **ResponsiveTable-gedrag wijzigen** — O6 is uitsluitend interne rij-memoization; kolomlogica en truncate-gedrag (CLAUDE.md-tabelregels) blijven ongemoeid.
- **Demodata "realistischer" maken** bij de tag-dedupe in `demoSeed.ts` — contactgegevens blijven bewust niet-routeerbaar (CLAUDE.md).
- **Dark mode verwijderen** — blijft volwaardig als bosavond-thema; alleen de default verschuift (keuzepunt 1).

---

## 7. Verificatie

Per werkstroom, vóór afronding:

1. **Groen:** `npm run typecheck`, `npm run lint`, `npm run test:run` (1986 tests). Bij WS6-wizard en WS9: relevante Playwright-E2E's (`npx playwright test configurator` draait zonder auth). Nooit `npm run build` naast een draaiende dev-server (CLAUDE.md).
2. **Contrast hermeten** met de audit-methode (canvas/lab→sRGB, effectieve achtergrond over de ancestor-keten): alle in audit gerapporteerde paren ≥4,5:1 (normaal) / ≥3:1 (groot + focusring), in **beide** themes — minimaal /dashboard, /projecten-detail, configurator-CTA. Axe-suite (`src/__tests__/a11y/`) uitbreiden met de nieuwe status-badge-tokens.
3. **Horizontale scroll:** `scrollWidth` vs `clientWidth` per pagina op 375/768/1600 voor /leads, /meldingen, /offertes, /uren, /facturen, /klanten, /instellingen: overal 0px overschrijding.
4. **Screenshots licht + donker** per geraakt scherm, vóór/na, opgeslagen onder `docs/design/verificatie/` — Ricardo keurt op beeld, niet op belofte. Meten in plaats van narekenen; verifieer de poort van de dev-server vóór het screenshotten.
5. **Bundle (WS8):** production build vóór/na met gestopte dev-server; route-groottes uit de build-output vergelijken (offertedetail −~500 KB, rapportages −~200 KB verwacht). React Profiler voor O5/O6.
6. **Cache-discipline:** verschijnt een wijziging niet, eerst dev-server herstarten en zonodig `navigate force:true` — géén code verdenken en géén nieuwe "ZZTEST"-achtige markers laten slingeren.
