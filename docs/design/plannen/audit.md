# Design-audit Top Tuinen OS — fase 1 (alleen lezen)

Datum: 14 aug 2026 · Auditor: audit-agent (impeccable:audit) · Viewports: 1600×900, 768×1024, 375×812 · Thema's: dark (app-default) én light (next-themes, `localStorage.theme`).
Meetmethode: contrast per element gemeten in de browser via canvas-conversie (lab() → sRGB), effectieve achtergrond samengesteld over de hele ancestor-keten; WCAG 2.1 AA-drempels (4,5:1 normaal, 3:1 groot). Horizontale scroll gemeten als `scrollWidth` vs `clientWidth` per element.

**Let op:** paginatitel "/meldingen" toonde tijdens de schouw "Meldingen ZZTEST" — vermoedelijk een tijdelijke marker van het team `naamgeving`. Niet als bevinding meegeteld.

## Anti-patterns-oordeel

Geen AI-slop: geen paarse gradients, geen glassmorphism, geen gratuite card-grids; het `SectiePaneel`-patroon wordt consequent gebruikt (klantdossier), typografie en spacing zijn beheerst. **Maar:** het dashboard gebruikt hard-coded dark-hexes (`bg-[#141414]`, `border-white/[0.06]`, `text-amber-400`) buiten het tokensysteem om — precies het theming-anti-pattern dat light mode sloopt. En de "Aandacht nodig"-banner zet gedimde grijze/ambertekst op een amberkleurige tint (gray-on-color).

## Samenvatting

- **1 kritiek, 6 hoog, 7 middel, 3 laag.**
- Belangrijkste drie: (1) light mode op /dashboard is onleesbaar (gemeten 1,07:1), (2) het leads-kanban scrollt horizontaal op élk formaat incl. 1600px — schending van de harde CLAUDE.md-regel, (3) op mobiel scrollen /offertes, /uren, /facturen, /klanten en /instellingen allemaal zijwaarts.
- Dark mode (het default-thema) is qua contrast opvallend schoon: /leads, /klanten, /offertes, /uren, /facturen, /instellingen en /meldingen hadden **nul** AA-fouten in de meting.

## 1. Bevindingen per pagina

### /dashboard
| Sev | Bevinding | Meting |
|---|---|---|
| **KRITIEK** | Light mode: KPI-kaarten en bento-panelen houden `bg-[#141414]` terwijl de tekst het thema volgt (near-black). "€ 22.457", "Offerte Pipeline", "36%", "Offerte afgewezen" zijn onzichtbaar. | fg 10,10,10 op bg 20,20,20 = **1,07:1** (vereist 4,5) |
| HOOG | Light mode: knoppen "Nieuwe Aanleg" / "Nieuw Onderhoud" — `text-green-400` op `bg-green-500/10` zonder light-variant. | **1,62:1** en **1,34:1** |
| HOOG | Light mode: prioriteitsbadges hoog/middel/laag (`text-red-400/amber-400/blue-400` op `bg-*-500/15`). | 2,24 / 1,49 / **2,14:1** |
| MIDDEL | Dark mode: "Details →" (`text-muted-foreground/50`, 11px) en "4/11 geaccepteerd" (`/60`, 10px). | **2,71:1** en **3,36:1** |
| MIDDEL | Dark mode: pipeline-sublabels "Geaccept."/"Voorcalc." (10px muted op tintvlak). | 2,43–2,47:1 |
| MIDDEL | Links "Bekijk alle →" (66×17) en "Details →" (49×17) onder 24px doelhoogte. | WCAG 2.2 AA 2.5.8 |
| + | Headinghiërarchie klopt (h1→h2→h3), skip-link aanwezig, 0 naamloze knoppen, geen h-scroll op 375. | — |

### /leads (kanban — bekende twijfelplek: **bevestigd stuk**)
| Sev | Bevinding | Meting |
|---|---|---|
| **HOOG** | Board `flex gap-4 pb-4 overflow-x-auto` met 5 kolommen van vaste 280px = 1464px. Scrollt horizontaal op **1600px** (container 1272), op 768 (container 440) en op 375 (container 343; 124 elementen buiten beeld, kolom "Verloren" onbereikbaar zonder zijwaarts scrollen). | 1464 vs 1272/440/343 |
| LAAG | Breadcrumb-home-link 16×16. | <24px |
| + | Contrast dark én light: 0 fouten. Kaarten zijn dnd-kit met `tabindex=0`, `role=button`, `aria-roledescription=draggable` — toetsenbord-sleepbaar. | — |

### /klanten + klantdossier
| Sev | Bevinding | Meting |
|---|---|---|
| **HOOG** | Mobiel 375: actiebalk "Exporteren / Importeren / Nieuwe Klant" (`flex items-center gap-2`, geen `flex-wrap`) is 419px → `<main>` scrollt 60px zijwaarts. | main sw 435 vs cw 375 |
| MIDDEL | Klantdossier: "Wat is taken/tijdlijn/…?"-infoknopjes 14×14 (wel keurig van aria-labels voorzien). | <24px |
| LAAG | Naam-links in tabelrijen 20px hoog (rij zelf is 63px) — inline-link-uitzondering, laag. | 28 stuks |
| + | Contrast dark: 0 fouten (245 elementen). Alle inputs gelabeld; taak-composer heeft label. | — |

### /offertes + offertedetail
| Sev | Bevinding | Meting |
|---|---|---|
| **HOOG** | Mobiel 375: offertetabel 704px breed én status-tabsbalk 767px → beide zijwaarts scrollend; actieknoppenrij loopt buiten beeld. | main sw 698 vs 375 |
| MIDDEL | Detail: scope-tag "Houtwerk" in dark. | **3,75:1** |
| + | Lijst dark: 0 contrastfouten (198 elementen). Statusstepper-icons + labels op detail helder. | — |

### /projecten + projectdetail
| Sev | Bevinding | Meting |
|---|---|---|
| **HOOG** | Tabelrijen zijn klikbaar (`cursor-pointer`, `onClick` → detail) maar zijn géén link en hebben geen `tabindex`/`role` → onbereikbaar met toetsenbord, onzichtbaar voor screenreaders als navigatie. Geen href = ook geen cmd-klik/nieuw tabblad. | role: none, tabindex: null |
| **HOOG** | Detail: statusstepper-labels (inactief, 11px) in beide thema's onder AA. | dark **2,7:1**, light **2,3:1** |
| MIDDEL | Detail dark: "1.0 dagen geschat" 4,0:1; "MODULES"-kopje 4,24:1 (11px). Light: "1.0 dagen geschat" 3,45:1; amber "Nog geen berichten…" (`text-amber-800/70`) 3,62:1. | — |

### /meldingen (kanban)
- **MIDDEL:** zelfde board-patroon (`flex gap-4 pb-4 overflow-x-auto`, 4 kolommen = 1168px). Past op 1600 (geen scroll), maar scrollt op 768 (440) en 375 (343). Zelfde fix als /leads.
- Contrast dark én light: 0 fouten. Kaarten dnd-kit-toegankelijk (8 stuks). Filter-switch 32×18 maar gelabeld.

### /uren
- **HOOG (mobiel):** urentabel gebruikt de kale shadcn `Table` (met `overflow-x-auto`-wrapper uit `ui/table.tsx`): 771px in 293px container → zijwaarts scrollen. Niet de eigen `ResponsiveTable` gebruikt.
- Desktop dark: 0 contrastfouten (218 elementen).

### /facturen
- **HOOG (mobiel):** `<main>` scrollt 36px (header-knoppenrij) én status-tabsbalk 580px in 343px.
- Desktop dark: 0 contrastfouten.

### /instellingen
- **HOOG (mobiel/tablet):** tabsbalk met 10 tabs = 801–849px, scrollt zijwaarts op 375 én 768 (container 343/440). Op 1600 past hij (1258px).
- Desktop dark: 0 contrastfouten; alle 17 inputs gelabeld.

### /configurator (publiek)
- **MIDDEL:** `/configurator` zelf = **404** ("Pagina niet gevonden"); alleen `/configurator/gazon|boomschors|verticuteren|status|bedankt` bestaan. Een klant die de kale URL krijgt/gokt strandt.
- **HOOG:** primaire CTA "Volgende stap": wit op `bg-green-600` (#00A63E) = **3,22:1** — faalt AA bij 14px, in béíde thema's, in de publieke funnel.
- **MIDDEL:** 7 verplichte velden (visuele `*`) zonder `required`/`aria-required` (0 gemeten) — screenreaders horen de verplichting niet.
- + Geen h-scroll op 375; volgt light/dark netjes; stappenindicator duidelijk.

### App-breed
- **MIDDEL:** focusring is aanwezig (2px ring, `:focus-visible` werkt op links/knoppen), maar de ringkleur is midgrijs (lab 66 ≈ rgb 160) — op witte light-achtergrond ≈ **2,5:1** t.o.v. aangrenzend wit, onder de 3:1 uit WCAG 2.2 Focus Appearance. In dark ruim voldoende.
- **LAAG:** elke navigatie toont seconden een gedimde tussenstaat (fade-in). Deels dev-server-compile; in prod verifiëren voor er iets aan "geoptimaliseerd" wordt.
- + Positief: 0 naamloze interactieve elementen op alle gemeten pagina's; geen `img` zonder alt; skip-link ("Ga naar hoofdinhoud") aanwezig.

## 2. Concrete fixes per bestand

1. **`src/components/dashboard/financieel-grid.tsx`, `pipeline-bento.tsx`, `vloot-badge.tsx`** — vervang overal `bg-[#141414] border-white/[0.06]` door tokens (`bg-card border-border` of `dark:`-varianten). Tekstkleuren `text-*-400` → paren zoals `text-red-600 dark:text-red-400`. Dit alléén lost het kritieke light-probleem op.
2. **`src/components/dashboard/aandacht-nodig.tsx`** (r. 25–27, 39) — `PRIORITY_BADGE` naar duo-varianten: bv. `bg-red-500/15 text-red-700 dark:text-red-400`; bannercontainer amber-tinten idem.
3. **`src/app/(dashboard)/dashboard/page.tsx`** (r. 361 e.o.) — snelactieknoppen: `text-green-400` → `text-green-700 dark:text-green-400`.
4. **`src/components/dashboard/vloot-badge.tsx` / `pipeline-bento.tsx`** — "Details →"/"Bekijk alle →": minimaal `text-muted-foreground` (zonder `/50`) en `py-1` zodat het klikvlak ≥24px wordt; sublabels 10px → 11–12px reguliere muted.
5. **`src/components/leads/kanban-board.tsx` + `kanban-column.tsx`** en **`src/components/meldingen/meldingen-board.tsx` + `melding-column.tsx`** — kolommen niet vast `w-[280px]` in een `overflow-x-auto`-flex, maar `grid grid-cols-[repeat(5,minmax(0,1fr))]` op desktop met `min-w-0` + truncate in kaarten; onder `lg` stapelen (kolommen onder elkaar met telling in de kop, of één kolom met status-switcher). Regel: board mag nóóit breder zijn dan zijn container.
6. **`src/app/(dashboard)/offertes/components/status-tabs.tsx`** (en de tabsbalken op /facturen, /instellingen — shadcn `TabsList`) — onder `md`: wrap (`flex-wrap`) of vervang door een `Select`; niet `overflow-x-auto` laten staan.
7. **`src/app/(dashboard)/uren/page.tsx`** — urentabel omzetten naar `ResponsiveTable` met kolom-`width`s conform de CLAUDE.md-tabelregels (of kolommen onder `md` verbergen).
8. **`src/app/(dashboard)/klanten/page.tsx`** (r. 1078) en de vergelijkbare headerbalken op /offertes en /facturen — `flex-wrap` toevoegen (r. 612 doet dit al goed) of secundaire acties onder `md` in een `DropdownMenu`.
9. **`src/app/(dashboard)/projecten/page.tsx`** (r. 396, 516) — rij-inhoud (eerste cel) als echte `<Link href="/projecten/[id]">` renderen (patroon van klanten-/offertetabel volgen), rij-klik mag blijven als extra.
10. **`src/components/project/thin-progress-bar.tsx`** — inactieve stepper-labels van 11px extra-muted naar `text-muted-foreground` ≥12px (doel ≥4,5:1 in beide thema's).
11. **`src/components/ui/scope-tag.tsx`** — houtwerk-variant (amberbruin) één stap lichter in dark (bv. `text-amber-300`-equivalent) tot ≥4,5:1.
12. **`src/app/(public)/configurator/gazon/page.tsx`** (r. 301; zelfde knop in boomschors/verticuteren) — `bg-green-600` → `bg-green-700` (wit op #008236 ≈ 4,8:1); inputs `required`/`aria-required={true}` geven.
13. **`src/app/(public)/configurator/`** — kleine index-`page.tsx` toevoegen die de drie configurators toont (of redirect naar de meestgebruikte).
14. **`src/components/ui/sectie-paneel.tsx`** — infoknopje: icoon mag 14px blijven, maar geef de button `p-1.5`/`min-h-6 min-w-6`.
15. **Focusring** (globals/tokens — `--ring`) — in light een donkerder ringkleur (≥3:1 t.o.v. wit), bv. ring in primary-tint.

## 3. Prioritering

1. **Direct (kritiek):** fix 1–3 — light mode dashboard is voor een gebruiker met light-voorkeur onbruikbaar.
2. **Deze sprint (hoog):** fixes 5–9 en 12 (kanban-regel, mobiele h-scroll op 5 pagina's, toetsenbordtoegang projectrijen, publieke CTA-contrast).
3. **Volgende sprint (middel):** fixes 4, 10, 11, 13, 14, 15 + `aria-required`.
4. **Daarna (laag):** breadcrumb-/linkdoelen ≥24px, fade-in-gedrag in prod meten.

Suggestie vervolg-commando's: `/normalize` (theming-tokens dashboard, fixes 1–4), `/adapt` (responsive fixes 5–8), `/harden` (a11y 9, 12, aria-required), `/polish` (10–15).

## 4. Geraakte bestanden

```
src/components/dashboard/financieel-grid.tsx
src/components/dashboard/pipeline-bento.tsx
src/components/dashboard/vloot-badge.tsx
src/components/dashboard/aandacht-nodig.tsx
src/app/(dashboard)/dashboard/page.tsx
src/components/leads/kanban-board.tsx
src/components/leads/kanban-column.tsx
src/components/meldingen/meldingen-board.tsx
src/components/meldingen/melding-column.tsx
src/app/(dashboard)/offertes/components/status-tabs.tsx
src/app/(dashboard)/uren/page.tsx
src/app/(dashboard)/facturen/page.tsx
src/app/(dashboard)/klanten/page.tsx
src/app/(dashboard)/projecten/page.tsx
src/components/project/thin-progress-bar.tsx
src/components/ui/scope-tag.tsx
src/components/ui/sectie-paneel.tsx
src/components/ui/table.tsx
src/app/(public)/configurator/gazon/page.tsx
src/app/(public)/configurator/boomschors/page.tsx
src/app/(public)/configurator/verticuteren/page.tsx
src/app/(public)/configurator/ (nieuwe index-page)
src/app/globals.css (focusring-token)
src/app/(dashboard)/instellingen/page.tsx (tabsbalk)
```
