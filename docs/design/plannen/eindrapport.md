# Eindrapport designprogramma — Top Tuinen OS

*14 augustus 2026. Alle tien werkstromen uit het goedgekeurde [masterplan](masterplan.md)
zijn uitgevoerd, geverifieerd en lokaal gecommit (niets gepusht). Na elke werkstroom:
typecheck, lint en 2958 unit-tests groen.*

## Wat er is veranderd, in cijfers

| Meting | Vóór | Ná |
|---|---|---|
| Dashboard-contrast light mode (slechtste paar) | **1,07:1** (onleesbaar) | ≥4,5:1, meest 5,7–19,8 |
| Pagina's met horizontale scroll (375/768/1600) | 7 (leads, meldingen, offertes, uren, facturen, klanten, instellingen) | **0** — overal sw=cw |
| Ad-hoc chromatische kleurklassen in modules | 1365 (+138 factuurwerkscherm) | **0** — alles op tokens |
| Lokale statuskleur-maps | 28 maps in 24 bestanden | **1 bron** (`statuses.ts`) |
| Merkkleur in het tokenbestand | geen (zinc, chroma 0) | Loof & Leem: groen hue 152 + terracotta, licht én donker |
| Offertedetail JS (prod, netwerk) | 5177 KB totaal | **4362 KB** (−815; react-pdf alleen nog lazy) |
| /rapportages initieel JS (prod) | 2182 KB | **1354 KB** (−828) |
| Eerste render na login | seconden spinner-op-zwart | shell-silhouet direct in de server-HTML |
| Configurator-E2E | — | **45/45 groen** (aangepast aan nieuwe stapvolgorde) |
| Statusplekken op offertedetail | 4 | 2 |
| "Nieuwe offerte"-ingangen | 5 verspreid | 1 (de TT-004-dialoog, nu vindbaar + ⌘N) |

## De richting

**"Vakwerk in het groen"** op het **Loof & Leem**-palet: licht-eerst (dark blijft
volwaardig als bosavond), één merkgroen geankerd op het mobiel-groen #4ADE80, warme
groengetinte neutralen, terracotta als enige warme accent, **Fraunces** voor koppen
en heldcijfers, Geist als werkpaard. Zelfde status = zelfde kleur, overal — gemeten
tot op identieke lab-waarden. De klantkant (configurator) is een keuzepagina met
échte Top Tuinen-foto's geworden; gegevens worden pas ná de prijsindicatie gevraagd.

## Commits per werkstroom

| WS | Commit(s) |
|---|---|
| WS1 bugs & quick wins | `da2183c` |
| WS2 tokens & typografie | `f56ea77` |
| WS3 dashboard | `bff8355` |
| WS4 statusbron + kanban | `8d8aabd` |
| WS5 responsive/a11y | `295aa33` |
| WS6 distill werkschermen | `d404d1a` (+ nazorg `2aa8f44`, `3564dcd`) |
| WS7 lege staten & microcopy | `3e2a46e` |
| WS8 performance | `844eebc`, `264e696`, `4acab13`, `c3379fc`, `0d56ddf` (O14-onderzoek) |
| WS9 configurator & portaal | `3975571` |
| WS10 kleur-sweep | `2e5f2b5`, `1497fef`, `5c8ae8a`, `abe6159`, `3e1fb65`, `ee5f35e` |
| Orchestrator | `ce200d0` (CLAUDE.md gelaagd) · `7a74f89` (dev-cacheheaders) · `d2efb66` (docs) · `635c39b` (trendtokens AA) |

## Bijvangst (niet gepland, wel gefikst)

- **Dev-cachewortel**: `immutable`-headers op `/_next/static` golden ook in dev —
  de bron van álle stale-chunk-ellende. Nu productie-only (`7a74f89`).
- **Turbopack-chunkbug**: dode code verwijderen kan een clientmodule uit de graph
  laten vallen; gedocumenteerd met workaround (`3564dcd`, docs/dev/dev-omgeving.md).
- **Preview draait alleen `next dev`** — na convex-wijzigingen is
  `npx convex dev --once` nodig (gedocumenteerd).
- Pre-existing bugs opgeruimd: offertedetail-knoppen buiten beeld <1150px,
  platgedrukte dialoogtegels, `water_elektra`-labellek, recharts-`hsl(var())`.

## Nog open

1. **B8 — telefoonnummer configurator-footer**: placeholder staat er nog; echt
   nummer komt van Ricardo.
2. **Wizard-E2E's** falen data-afhankelijk (dev-deployment heeft geen pakketten,
   knop heet daardoor "Beginnen" i.p.v. "Start vanaf nul") — pre-existing; hangt
   samen met het oude punt "pakketten moeten nog samengesteld".
3. **E2E-auth stuk** (pre-existing) — aanpak-suggestie in docs/dev/dev-omgeving.md.
4. **O14** (providers per route-groep) is bewust alleen onderzocht:
   [o14-onderzoek.md](o14-onderzoek.md).

## Verificatiegrondslag

Contrast via canvas/lab→sRGB-meting (niet geschat), horizontale scroll via
scrollWidth==clientWidth op drie formaten, kleurgelijkheid via computed styles
tegen een dashboard-referentie, bundles via netwerk-JS op een productie-build
met gestopte dev-server, gedrag via Playwright (configurator) en handmatige
flows in de ingelogde preview. Sidebar-tellers vóór=ná de query-fusie.
