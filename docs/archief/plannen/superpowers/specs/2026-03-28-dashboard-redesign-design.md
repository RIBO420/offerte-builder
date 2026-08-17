# Dashboard Redesign — Design Spec

## Summary

Restructure the admin dashboard from 11 fragmented sections to 5 cohesive sections. Remove all duplicate data, consolidate 3 Convex queries into 1, and apply modern UI polish (animated numbers, sparklines, bento grid, contextual colors).

## Problem

The current dashboard has:
- **11 sections** stacked vertically — too much scrolling
- **7 duplicate metrics** shown in multiple places (Totale Omzet, Actieve Projecten, Openstaande Offertes, Conversie Rate, Gem. Offerte Waarde, Voorraad Alerts, QC Checks)
- **3 separate Convex queries** fetching overlapping data (offertes fetched 3x)
- **3 separate loading spinners** creating a janky waterfall effect
- Existing UI components (AnimatedNumber, Sparkline, DataCard, EmptyState) not utilized on the dashboard

## Design

### Section 1: Welcome + Quick Start (inline)

Left: time-of-day greeting ("Goedemorgen/Goedemiddag/Goedenavond, Ricardo") with subtitle ("12 offertes • 7 projecten").
Right: Two CTA buttons inline — "Nieuwe Aanleg" and "Nieuw Onderhoud" with green accent styling.

Saves an entire section by combining welcome + quick actions on one row. Quick start is always visible without scrolling.

### Section 2: Aandacht Nodig (conditional)

Combined section merging the current "Actie vereist" (accepted offertes without project) and "WarningsFeed" (proactive warnings) into one block.

- Only renders when there are items. No empty state — section doesn't exist when empty.
- Uses `border-left: 3px solid amber-500` accent instead of gradient background.
- Count badge next to title.
- Each item shows: description + action button ("Start Project" or "Bekijk").
- Priority badges on warnings (hoog/middel/laag).

### Section 3: Financieel & Operationeel (2x3 grid)

Six metric cards in a 3-column, 2-row grid. All unique KPIs in one place:

| Row 1 | Row 2 |
|-------|-------|
| Totale Omzet (green, sparkline, +% badge) | Openstaand (amber, overdue alerts) |
| Actieve Projecten (orange) | Gefactureerd dit Q (blue, sparkline, +% badge) |
| Openstaande Offertes (blue) | Uren deze Maand (orange) |

Card design:
- **28px / font-weight 800** primary values with `-0.03em` letter-spacing
- **Percentage badge pills** (top-right): green/blue pill with mini sparkline icon and percentage text
- **Sparkline backgrounds**: gradient area charts behind Totale Omzet and Gefactureerd dit Q (opacity 0.12)
- **Contextual value colors**: Totale Omzet in green-500, others in foreground
- **Period context**: "Mrt 2026", "Q1 2026" as subtle text below values
- **AnimatedNumber** on all numeric values (count-up on load)
- **Subtle hover**: `-translate-y-px` + `shadow-md` on hover
- Cards use `bg-[#141414]` with `border rgba(255,255,255,0.06)`

Data sources:
- Totale Omzet, Actieve Projecten, Openstaande Offertes: from `useFullDashboardData()`
- Openstaand, Gefactureerd dit Q, Uren deze Maand: from `getDirectieStats` (to be consolidated)

### Section 4: Projecten & Pipeline (bento grid)

Bento layout with varied card sizes for visual hierarchy.

**Row 1** (Pipeline 2fr + Conversie Rate 1fr):
- **Offerte Pipeline** (large card, 2fr): Title + segmented progress bar (color per status) + 5-column grid showing count per status with subtle background tints. Status colors: slate=concept, amber=voorcalculatie, blue=verzonden, green=geaccepteerd, red=afgewezen.
- **Conversie Rate** (small card, 1fr): Mini radial chart (SVG circle) with percentage in center. Below: "8/8 geaccepteerd" + integrated badge showing "Gem. € 5.242" (saves a separate card for average value).

**Row 2** (Project Status 1fr + Recente Activiteit 1fr):
- **Project Status**: Donut chart (existing DonutChart component) with legend beside it showing status breakdown with counts.
- **Recente Activiteit**: Timeline with dot indicators (6px circles) instead of large round icons. Each entry: action description + offerte number + time ago + amount in contextual color.

**Row 3** (Lopende Projecten, 2-column):
- Project cards with folder icon, name, klant, percentage, progress bar, and uren stats.
- Only renders when there are active projects.

### Section 5: Vloot & Materieel Badge (conditional)

Compact single-line status bar at the bottom.

- **All OK**: Green dot + "Vloot & Materieel — alles operationeel" + "Details →" link
- **Issues**: Red/amber dot + count of issues + "Bekijk →" link. Clicking navigates to the fleet/material detail page.

Only shows as a badge — the full MateriaalmanDashboard content moves to its own detail page (or stays as-is but only accessible via this link).

## Removed Components

| What | Why |
|------|-----|
| DirectieDashboard (as standalone) | Metrics integrated into Section 3. Component removed or refactored to export only unique data. |
| Separate "Actie vereist" section | Merged into Section 2 "Aandacht Nodig" |
| Separate WarningsFeed section | Merged into Section 2 "Aandacht Nodig" |
| Key Metrics 3-card row | Integrated into Section 3 grid |
| Separate Analytics section | Widgets redistributed into Section 4 bento grid |
| Inkoop & Kwaliteit section | Already removed. Data available in MateriaalmanDashboard. |
| MateriaalmanDashboard (inline) | Replaced by Section 5 badge. Full view accessible via link. |

## Technical Changes

### Query Consolidation

**Current**: 3 separate queries
- `useFullDashboardData()` → `api.offertes.getFullDashboardData`
- `useQuery(api.directieDashboard.getDirectieStats)` (inside DirectieDashboard)
- `useQuery(api.materiaalmanDashboard.getMateriaalmanStats)` (inside MateriaalmanDashboard)

**Target**: 1 consolidated query
- New `api.dashboard.getAdminDashboardData` that fetches all tables in parallel and returns all computed stats.
- Eliminates: offertes fetched 3x → 1x, projecten fetched 2x → 1x, facturen fetched 2x → 1x.
- Fix N+1 in materiaalman stats: pre-fetch all leveranciers, use Map lookup.

### Loading State

**Current**: 1 DashboardSkeleton + 2 separate Loader2 spinners (DirectieDashboard, MateriaalmanDashboard).

**Target**: Single cohesive skeleton that matches the exact layout of the final dashboard (6-card grid skeleton, bento skeleton, etc.). No separate spinners.

### UI Component Usage

| Component | Current Use | New Use |
|-----------|------------|---------|
| `AnimatedNumber` | Not on dashboard | All metric values |
| `Sparkline` | Not on dashboard | Totale Omzet, Gefactureerd Q cards |
| `EmptyState` | Not on dashboard | All conditional empty sections |
| `DonutChart` | Project Status only | Project Status + Conversie Rate radial |
| `Progress` | Conversion Rate only | Removed (replaced by segmented bar) |

### Animation System

Replace manual delay calculations with Framer Motion `staggerChildren`:

```tsx
const container = { hidden: {}, show: { transition: { staggerChildren: 0.04, delayChildren: 0.1 } } };
const item = { hidden: { opacity: 0, y: 8 }, show: { opacity: 1, y: 0, transition: { duration: 0.25 } } };
```

### Styling Tokens

- Card background: `#141414` (slightly lighter than page `#09090b`)
- Card border: `rgba(255,255,255, 0.06)`
- Section headers: `uppercase`, `letter-spacing: 0.06em`, `text-muted-foreground`
- Primary values: `text-[28px] font-extrabold tracking-tight leading-none`
- Trend badge: `bg-green-500/12 text-green-400 text-[11px] font-semibold px-2 py-0.5 rounded-md`
- Sparkline opacity: `0.12`

## Files to Modify

### Dashboard Page
- `src/app/(dashboard)/dashboard/page.tsx` — Complete rewrite of admin section

### New/Modified Components
- `src/components/dashboard/aandacht-nodig.tsx` — New combined warnings + action required
- `src/components/dashboard/financieel-grid.tsx` — New 2x3 metric grid with sparklines
- `src/components/dashboard/pipeline-bento.tsx` — New bento layout for pipeline + projects
- `src/components/dashboard/vloot-badge.tsx` — New compact fleet status badge

### Backend
- `convex/dashboard.ts` — New consolidated query `getAdminDashboardData`

### Modified
- `src/hooks/use-offertes.ts` — Update `useFullDashboardData` to use new consolidated query
- `src/components/ui/donut-chart.tsx` — Use CSS variables instead of hardcoded HSL colors

### Potentially Removable
- `src/components/dashboard/directie-dashboard.tsx` — If all data moves to consolidated query
- `src/components/dashboard/voorraad-alert-card.tsx` — Already unused after cleanup
- `src/components/dashboard/inkooporders-card.tsx` — Already unused after cleanup
- `src/components/dashboard/qc-status-card.tsx` — Already unused after cleanup

## Visual Reference

Mockups available at `.superpowers/brainstorm/96336-1774653102/final-design-v2.html`

Inspired by:
- Reference dashboard 1: Green accent, bento grid, sparklines in metric cards
- Reference dashboard 2 (Metric Flow): Percentage badge pills, large bold numbers, period context
