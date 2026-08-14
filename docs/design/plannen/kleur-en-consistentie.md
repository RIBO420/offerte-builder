# Kleur & Consistentie — tokenplan Top Tuinen OS

*Fase 1 (alleen lezen) — token-eigenaar designteam, 14 aug 2026.*
*Schouw: /dashboard, /leads, /klanten, /offertes, /projecten, /meldingen, /instellingen, /configurator/gazon — beide themes, 1600×900.*

---

## 1. Inventaris huidig palet + inconsistenties

### 1.1 Het tokenbestand is kleurloos
`src/app/globals.css` is de enige tokenbron. Alle kerntokens hebben **chroma 0**:

- Light (r. 202–233): `--background: oklch(1 0 0)` (puur wit), `--primary: oklch(0.205 0 0)` (bijna-zwart), alle secondary/muted/accent/border grijs.
- Dark (r. 319–351): idem grijs; `--border: oklch(1 0 0 / 20%)` (wit-alpha i.p.v. kleur).
- De enige "merkkleur" in de kerntokens is `--sidebar-primary` dark: `oklch(0.488 0.243 264.376)` — **paarsblauw** (r. 346), het AI-cliché, botst frontaal met het groene merk.
- Gevolg in de UI: primaire knoppen zijn zwart, KPI-strips grijs, /instellingen volledig kleurloos. Het groen zit alleen in het logo en her en der hardcoded klassen.

### 1.2 Statustokens bestaan, maar bijna niemand gebruikt ze
- globals.css definieert complete offerte- én projectstatustokens incl. dark (r. 249–299, 367–416). Alleen de offertes-module gebruikt ze, via `src/lib/constants/statuses.ts` + `src/components/ui/status-badge.tsx`.
- **40 bestanden** definiëren daarnaast een eigen `statusConfig`/`STATUS_COLORS` met rauwe Tailwind-klassen (lijst in §5): projecten, facturen, inkoop, contracten, planning, archief, verlof, wagenpark, garanties, portaal, configurator/status, leads, meldingen.
- **Token/UI-mismatch:** `--status-gepland` is paars (hue 290) en `--status-in-uitvoering` cyaan (hue 200), maar /projecten toont Gepland **blauw** en In Uitvoering **oranje** via eigen klassen. Dezelfde status heeft dus per scherm een andere kleur.
- Scope-tokens (`--scope-*`): netjes gedefinieerd, elk precies 1× gebruikt — prima basis.

### 1.3 Hardcoded kleurklassen (± 2.000+ treffers in src/)
Toppers: `text-green-400` ×143, `text-green-600` ×140, `text-red-400` ×87, `text-amber-400` ×74, `bg-green-100` ×68, `bg-blue-100` ×51, `bg-amber-50` ×39, `bg-purple-100` ×20 …
Zwaarste bestanden: `projecten/[id]/nacalculatie/page.tsx` (40), `analytics/financieel-overzicht.tsx` (37), `facturen/page.tsx` (32), `configurator/status/page.tsx` (30), `factuur-sidebar.tsx` (30), `empty-states.tsx` (26), plus de analytics-map en vrijwel elk scope-formulier.

### 1.4 Hex-eilanden (drie losse kleursystemen naast de tokens)
1. **Dashboard-bento**: `src/components/dashboard/financieel-grid.tsx` r. 46 `bg-[#141414] border-white/[0.06]` en `pipeline-bento.tsx` (#141414, #22c55e, #3b82f6, #f59e0b, #ef4444, #a855f7). **Visueel bevestigd: deze cards blijven pikzwart in light mode** — het hele blok "Financieel & Operationeel" + "Projecten & Pipeline" negeert het thema.
2. **Klantportaal**: 15+ bestanden onder `src/app/portaal/(portal)/` hardcoden het mobiele "Premium Organic"-thema (#4ADE80 ×59, #2a3e2a ×51, #1a2e1a ×44, #111a11, #16a34a) — als hex, dus niet themebaar en niet gedeeld met de tokens.
3. **Configurator** (`(public)/configurator/`): eigen altijd-donkere groene wereld — qua merk juist goed, qua techniek hex.

### 1.5 Kanban & badges ad hoc
- Leads: kolomstippen `bg-blue-500` / `bg-amber-500` … (`kanban-board.tsx` r. 52–53); "Website"-badge blauw, "Handmatig" paars + `border-l-purple-500` (`lead-card.tsx` r. 43–59, 138).
- Meldingen: eigen kolom- en labelkleuren (Klacht oranje, Servicecerzoek blauw, Schade rood).
- Klanten: pipeline-/typebadges groen/blauw/paars ad hoc (`klanten/page.tsx`).

### 1.6 Losse bugs/afwijkingen
- **Recharts-bug**: globals.css r. 436–462 gebruikt `hsl(var(--popover))` etc., maar de tokens zijn oklch-waarden → `hsl(oklch(…))` is ongeldige CSS; de tooltip-styling valt stil terug op defaults.
- Puur wit (`--background` light) en zwartgebaseerde selection/scrollbars: geen merktint.
- Dark-mode chartkleuren (r. 339–343) beginnen met paarsblauw `oklch(0.488 0.243 264)` als chart-1.
- Shadows, radii, spacing en easing zijn **wél** goed getokeniseerd (§ shadow/duration/ease-tokens); slechts een handvol `rounded-[Npx]`-uitzonderingen. Normalisatie hoeft hier vrijwel niets.

---

## 2. Voorgesteld tokenpalet (OKLCH, light + dark)

**Concept: "Loof & Leem".** Eén merkgroen (hue 152, geankerd op mobiel #4ADE80) draagt de identiteit; neutrals krijgen dezelfde groene ondertoon (chroma 0.006–0.015, nooit puur wit/zwart); terracotta/oker (hue 55–90) is het warme tegenwicht (hout, aarde — past de hovenier). Geen cyan, geen paarsblauw. Verdeling 60/30/10: groengetinte neutrals dragen, merkgroen stuurt (acties, actief, positief), terracotta accentueert (voortgang, aandacht).

```css
:root {
  --background: oklch(0.982 0.006 140);      /* warm groenig off-white */
  --foreground: oklch(0.19 0.015 150);
  --card: oklch(0.998 0.003 140);
  --card-foreground: var(--foreground);
  --popover: oklch(0.998 0.003 140);
  --popover-foreground: var(--foreground);
  --primary: oklch(0.44 0.11 152);           /* loofgroen — knoppen, actief, links */
  --primary-foreground: oklch(0.98 0.01 145);
  --secondary: oklch(0.955 0.01 140);
  --secondary-foreground: oklch(0.25 0.02 150);
  --muted: oklch(0.955 0.008 140);
  --muted-foreground: oklch(0.45 0.015 150);
  --accent: oklch(0.94 0.025 145);           /* salie-hover */
  --accent-foreground: oklch(0.24 0.04 150);
  --accent-warm: oklch(0.68 0.13 60);        /* terracotta — voortgang/attentie */
  --destructive: oklch(0.55 0.20 27);
  --border: oklch(0.905 0.012 140);
  --input: oklch(0.905 0.012 140);
  --ring: oklch(0.60 0.11 152);
  --chart-1: oklch(0.55 0.13 152);  /* groen */
  --chart-2: oklch(0.62 0.12 60);   /* terracotta */
  --chart-3: oklch(0.55 0.09 245);  /* steenblauw */
  --chart-4: oklch(0.72 0.13 90);   /* oker */
  --chart-5: oklch(0.50 0.08 175);  /* mosteal */
  --sidebar: oklch(0.965 0.008 140);
  --sidebar-foreground: oklch(0.25 0.015 150);
  --sidebar-primary: var(--primary);
  --sidebar-primary-foreground: var(--primary-foreground);
  --sidebar-accent: oklch(0.93 0.02 145);
  --sidebar-accent-foreground: oklch(0.24 0.04 150);
  --sidebar-border: oklch(0.90 0.012 140);
  --sidebar-ring: var(--ring);
}

.dark { /* "bosavond" — groengetint donker, geen puur zwart */
  --background: oklch(0.17 0.012 150);
  --foreground: oklch(0.95 0.01 140);
  --card: oklch(0.215 0.014 150);
  --card-foreground: var(--foreground);
  --popover: oklch(0.215 0.014 150);
  --popover-foreground: var(--foreground);
  --primary: oklch(0.78 0.15 152);           /* #4ADE80-familie, deelt merk met mobiel */
  --primary-foreground: oklch(0.17 0.05 152);
  --secondary: oklch(0.29 0.015 150);
  --secondary-foreground: oklch(0.95 0.01 140);
  --muted: oklch(0.26 0.014 150);
  --muted-foreground: oklch(0.72 0.015 145);
  --accent: oklch(0.30 0.03 150);
  --accent-foreground: oklch(0.95 0.01 140);
  --accent-warm: oklch(0.75 0.13 60);
  --destructive: oklch(0.70 0.19 25);
  --border: oklch(0.30 0.015 150);           /* kleur i.p.v. wit-alpha */
  --input: oklch(0.28 0.015 150);
  --ring: oklch(0.65 0.13 152);
  --chart-1: oklch(0.72 0.15 152);
  --chart-2: oklch(0.72 0.13 60);
  --chart-3: oklch(0.68 0.10 245);
  --chart-4: oklch(0.80 0.13 90);
  --chart-5: oklch(0.65 0.09 175);
  --sidebar: oklch(0.195 0.014 150);
  --sidebar-foreground: oklch(0.90 0.01 140);
  --sidebar-primary: var(--primary);         /* paarsblauw vervalt */
  --sidebar-primary-foreground: var(--primary-foreground);
  --sidebar-accent: oklch(0.27 0.02 150);
  --sidebar-accent-foreground: oklch(0.95 0.01 140);
  --sidebar-border: oklch(0.28 0.015 150);
  --sidebar-ring: var(--ring);
}
```

### Statussemantiek (één reeks voor alles)
Bestaande viertallen (`bg/text/border/dot`) blijven; alleen hues en receptuur wijzigen. Receptuur light: bg `L0.93 C0.045`, text `L0.32 C0.10`, border `L0.75 C0.08`, dot `L0.55 C0.16`; dark: bg `L0.26 C0.05`, text `L0.85 C0.09`, border `L0.42 C0.08`, dot `L0.68 C0.14` (alle op de status-hue). Voorbeeld:

```css
--status-geaccepteerd: oklch(0.93 0.045 152);
--status-geaccepteerd-text: oklch(0.32 0.10 152);
--status-geaccepteerd-border: oklch(0.75 0.08 152);
--status-geaccepteerd-dot: oklch(0.55 0.16 152);
```

| Betekenis | Hue | Geldt voor |
|---|---|---|
| Neutraal/concept | 150, C≤0.01 | offerte concept, factuur concept |
| Informatie/gepland | 245 steenblauw | voorcalculatie, project gepland, lead nieuw, factuur verzonden, servicemelding |
| Onderweg/wachten | 85 oker | offerte verzonden, lead contact, factuur herinnering, melding in behandeling |
| Actief/uitvoering | 70 amber | project in uitvoering, lead offerte verstuurd |
| Succes | 152 merkgroen | geaccepteerd, afgerond, lead gewonnen, factuur betaald, melding opgelost |
| Financieel afgerond | 160 diepgroen | gefactureerd |
| Analyse | 175 mosteal | nacalculatie |
| Negatief | 30 terracottarood | afgewezen, verloren, vervallen, schade |

Nieuw toe te voegen tokengroepen: `--status-betaald`, `--status-vervallen`, `--status-herinnering` (facturen), `--lead-nieuw/-contact/-offerte/-gewonnen/-verloren` (kanban) en `--melding-*`. **Paars verdwijnt volledig** behalve `--scope-specials`.

Contrast: alle text-op-bg-paren ≥ 4.5:1, dots/borders ≥ 3:1; kleur nooit als enige drager (dot + label blijven samen). Verifiëren met de bestaande axe-suite (`src/__tests__/a11y/`).

---

## 3. Migratieplan per bestand

**Stap A — tokens (1 bestand).** `src/app/globals.css`: palet uit §2 erin, statusreceptuur vervangen, nieuwe status-/lead-/meldinggroepen + `--accent-warm` toevoegen aan `@theme inline`, recharts-blok `hsl(var(--x))` → `var(--x)` (bugfix §1.6), selection/scrollbar groentint.

**Stap B — één statusbron.** `src/lib/constants/statuses.ts` uitbreiden met project-, factuur-, lead- en meldingstatussen (tokens, geen palletklassen); `src/components/ui/status-badge.tsx` als enige badge-renderer. Daarna de 40 statusConfig-bestanden (§5) hun lokale maps laten vervangen door imports.

**Stap C — dashboard themebaar.** `financieel-grid.tsx`, `pipeline-bento.tsx`, overige `src/components/dashboard/*`: `bg-[#141414]`/`border-white/[0.06]`/hex-sparklines → `bg-card`/`border-border`/`var(--chart-*)`; donut- en pipelinekleuren op statusreeks.

**Stap D — kanban.** `src/components/leads/kanban-board.tsx`, `lead-card.tsx`, `lead-detail-modal.tsx`, `pipeline-stats.tsx` op `--lead-*`; meldingen-bord op `--melding-*`.

**Stap E — portaal.** Hexwaarden in `src/app/portaal/(portal)/**` vervangen door een `.portal`-scope in globals.css die dezelfde tokennamen dark-vast invult (het portaal blijft de donkergroene merkwereld, maar dan uit tokens die het merk delen met web + mobiel).

**Stap F — sweep per module.** Ad-hoc `green/blue/amber/purple-*` naar semantische tokens in: analytics-map, facturen, nacalculatie, factuur-sidebar, empty-states, onboarding-checklist, import-dialog, gebruikers, archief, configurator/status, scope-forms. Vuistregel: positief→`trend-positive`/primary, negatief→`trend-negative`/destructive, info→status-hue 245, waarschuwing→hue 85, voortgang→`accent-warm`.

**Werkwijze:** tokens eerst (A), dan B; C–F kunnen parallel per module. Na elke stap beide themes bekijken; bij ontbrekende CSS-regels eerst dev-server herstarten (bekende Tailwind v4/Turbopack-valkuil, zie CLAUDE.md). Geen wijziging aan `offertes.type` of andere logica — dit plan raakt uitsluitend presentatie.

---

## 4. Prioritering

| Prio | Wat | Waarom |
|---|---|---|
| P1 | Stap A (globals.css) + recharts-fix | Alles erft mee; grootste zichtbare sprong (merkgroen primary, getinte neutrals, paarsblauw weg) voor 1 bestand werk |
| P2 | Stap C (dashboard) | Enige echte themebreuk (zwarte cards in light mode); eerste scherm dat iedereen ziet |
| P3 | Stap B + D (statusbron, kanban) | Heft de status-kleurmismatch en 40 duplicaten op |
| P4 | Stap E + F (portaal, module-sweep) | Veel bestanden, laag risico, goed parallelliseerbaar |

---

## 5. Geraakte bestanden

```
src/app/globals.css
src/lib/constants/statuses.ts
src/lib/planning-templates.ts
src/components/ui/status-badge.tsx
src/components/dashboard/financieel-grid.tsx
src/components/dashboard/pipeline-bento.tsx
src/components/dashboard/aandacht-nodig.tsx
src/components/dashboard/mijn-taken.tsx
src/components/dashboard/vloot-badge.tsx
src/components/dashboard/voorman-dashboard.tsx
src/components/dashboard/warnings-feed.tsx
src/components/leads/kanban-board.tsx
src/components/leads/kanban-column.tsx
src/components/leads/lead-card.tsx
src/components/leads/lead-detail-modal.tsx
src/components/leads/pipeline-stats.tsx
src/components/empty-states.tsx
src/components/onboarding/onboarding-checklist.tsx
src/components/import/relatie-import-dialog.tsx
src/components/analytics/financieel-overzicht.tsx
src/components/analytics/calculatie-vergelijking.tsx
src/components/analytics/secondary-kpi-cards.tsx
src/components/analytics/project-prestaties.tsx
src/components/analytics/medewerker-productiviteit.tsx
src/components/portaal/portaal-project-progress.tsx
src/components/portaal/portaal-factuur-card.tsx
src/components/portaal/portaal-offerte-card.tsx
src/components/verlof/verlof-kalender.tsx
src/components/project/taken-lijst.tsx
src/components/project/qc-checklist-card.tsx
src/components/tijdlijn/klant-tijdlijn.tsx
src/app/(dashboard)/dashboard/page.tsx
src/app/(dashboard)/klanten/page.tsx
src/app/(dashboard)/facturen/page.tsx
src/app/(dashboard)/archief/page.tsx
src/app/(dashboard)/gebruikers/page.tsx
src/app/(dashboard)/planning/page.tsx
src/app/(dashboard)/verlof/page.tsx
src/app/(dashboard)/inkoop/page.tsx
src/app/(dashboard)/inkoop/[id]/page.tsx
src/app/(dashboard)/contracten/page.tsx
src/app/(dashboard)/contracten/[id]/page.tsx
src/app/(dashboard)/wagenpark/page.tsx
src/app/(dashboard)/wagenpark/[id]/page.tsx
src/app/(dashboard)/garanties/[id]/page.tsx
src/app/(dashboard)/projecten/page.tsx
src/app/(dashboard)/projecten/[id]/page.tsx
src/app/(dashboard)/projecten/[id]/nacalculatie/page.tsx
src/app/(dashboard)/projecten/[id]/factuur/page.tsx
src/app/(dashboard)/projecten/[id]/factuur/components/factuur-sidebar.tsx
src/app/(dashboard)/projecten/[id]/factuur/components/types.ts
src/app/(dashboard)/projecten/[id]/uitvoering/components/progress-indicator.tsx
src/app/(dashboard)/offertes/[id]/voorcalculatie/page.tsx
src/app/(dashboard)/offertes/components/offerte-row.tsx
src/app/(dashboard)/offertes/components/status-tabs.tsx
src/app/(dashboard)/instellingen/components/boekhouding-sync-log.tsx
src/app/(public)/configurator/status/page.tsx
src/app/(public)/configurator/layout.tsx
src/app/portaal/(portal)/layout.tsx
src/app/portaal/(portal)/projecten/page.tsx
src/app/portaal/(portal)/projecten/[id]/page.tsx
src/app/portaal/(portal)/offertes/[id]/page.tsx
src/app/portaal/(portal)/facturen/page.tsx
src/app/portaal/(portal)/facturen/[id]/page.tsx
src/app/portaal/(portal)/documenten/page.tsx
src/app/portaal/(portal)/meldingen/page.tsx
src/app/portaal/(portal)/berichten/loading.tsx
src/app/portaal/(portal)/chat/page.tsx
src/app/portaal/(portal)/profiel/page.tsx
src/components/offerte/scope-forms/* (sweep, laag risico)
src/components/offerte/onderhoud-forms/* (sweep, laag risico)
```
