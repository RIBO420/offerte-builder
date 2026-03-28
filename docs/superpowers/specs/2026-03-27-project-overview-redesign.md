# Project Overview Page Redesign

## Problem

The current project detail page (`src/app/(dashboard)/projecten/[id]/page.tsx`) has poor visual hierarchy and requires excessive scrolling:

1. **Duplicated data** — Quick stats row (4 cards) repeats the same numbers shown in the module cards below
2. **Poor hierarchy** — All sections look equally important; no clear "at a glance" story
3. **Oversized module cards** — Each module gets a full Card with header, description, data, and button — but most only contain a link
4. **Werklocatie empty state** — Takes ~200px of vertical space to say "niet ingesteld"
5. **Gekoppelde Offerte section** — Full-width card for one line of info

## Design Goals

- **Primary**: Show project status (which phase) and whether it's on track (uren/planning progress) at a glance
- **Secondary**: Provide quick navigation to all modules without requiring scrolling
- **Constraint**: Everything should fit on one screen without scrolling (for typical desktop viewports)

## Design

### Layout Structure (top to bottom)

```
┌──────────────────────────────────────────────────────────┐
│  ← Project Naam [Badge]                                  │
│    TOPTUINEN2026-029 · Klant Naam · Aangemaakt datum     │
├──────────────────────────────────────────────────────────┤
│  ████░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░  │
│  Gepland    In Uitvoering    Afgerond    Nacalc.   Fact. │
├──────────────────────────────────────────────────────────┤
│  ⚠ Budget waarschuwing — 85% verbruikt  (conditional)   │
├─────────────────────────┬────────────────────────────────┤
│  UREN VOORTGANG         │  PLANNING VOORTGANG            │
│  0.0 / 13.5 uur         │  0 / 6 taken                   │
│  ████████░░░░░░░░░ 0%   │  ░░░░░░░░░░░░░░░░░ 0%         │
│  1.0 dagen · 2 team     │  0 afgerond · 6 open           │
├─────────────────────────┴────────────────────────────────┤
│  MODULES                                                 │
│  [📋 Planning 0/6] [⏱ Uitvoering 0.0h] [€ Kosten]      │
│  [📊 Nacalculatie] [📄 Offerte] [📍 Werklocatie]        │
└──────────────────────────────────────────────────────────┘
```

### 1. Header

- Back button (ghost icon) + project name (h1) + status badge inline
- Second line: offerte nummer, klant naam, creation date — all as muted metadata
- **Removes**: Separate `Gekoppelde Offerte` card at bottom (info moves to header subtitle)

### 2. Progress Stepper

- Replace the current circle-based stepper with a **thin segmented bar** (5 segments, 4px height)
- Active segment gets the blue fill, completed segments also filled
- Labels underneath in small text, active label highlighted
- **Removes**: The large `ProjectProgressStepper` component wrapped in a Card

### 3. Budget Warning Banner (conditional)

- Keep existing behavior: only shows when `budgetStatus.drempel80` is true
- Amber border/bg for 80% threshold, red for 100%
- Shows percentage, actual vs budget amounts, small progress bar
- No change in logic, just ensure it sits between stepper and focus cards

### 4. Focus Cards (2 cards, side by side)

**Uren Voortgang Card:**
- Icon (Clock from lucide) in a small colored badge (blue bg)
- Label: "UREN VOORTGANG" (uppercase, muted, small)
- Big number: `{totaalGeregistreerdeUren}` / `{normUrenTotaal}` uur
- Progress bar (8px, blue gradient)
- Footer: `{geschatteDagen} dagen geschat` · `{teamGrootte} teamleden`

**Planning Voortgang Card:**
- Icon (ListChecks from lucide) in a small colored badge (green bg)
- Label: "PLANNING VOORTGANG" (uppercase, muted, small)
- Big number: `{afgerondeTaken}` / `{totaleTaken}` taken
- Progress bar (8px, green gradient)
- Footer: `{afgerond} afgerond` · `{open} open`

Both cards: `border border-border rounded-xl p-5 bg-card` styling, no hover effects.

### 5. Module Pill Navigation

A flex-wrap row of clickable pill-shaped links, each containing:
- Lucide icon (not emoji — per project conventions)
- Module name (small, semibold)
- One-line context text (muted, smaller)
- Chevron right arrow

**Modules in order:**
1. **Planning** → links to `/projecten/[id]/planning` — shows `{done}/{total} taken`
2. **Uitvoering** → links to `/projecten/[id]/uitvoering` — shows `{uren} / {begroot} uur`
3. **Kosten** → links to `/projecten/[id]/kosten` — shows "Live tracking"
4. **Nacalculatie** → links to `/projecten/[id]/nacalculatie` — shows deviation % or "Niet beschikbaar"
5. **Offerte** → links to `/offertes/[offerteId]` — shows offerte nummer
6. **Werklocatie** → opens werklocatie dialog/sheet — shows address or "Niet ingesteld"

**Context-aware highlighting:** The module that corresponds to the current project phase gets a highlighted border (blue/primary). Logic:
- `gepland` → Planning highlighted
- `in_uitvoering` → Uitvoering highlighted
- `afgerond` → Nacalculatie highlighted
- `nacalculatie_compleet` → Factuur pill appears (green highlight)

**Factuur pill:** Only appears when `project.status === 'nacalculatie_compleet'`, with green styling.

### 6. Werklocatie Handling

- The `WerklocatieCard` component stays as-is but is no longer rendered inline on the overview page
- Instead, clicking the "Werklocatie" pill opens the werklocatie in a Sheet (slide-over panel) or navigates to a sub-route
- Decision: Use a **Sheet** (slide-over) since the werklocatie form is already a dialog-style component

## What Gets Removed

| Current Element | Action |
|---|---|
| Quick Stats row (4 cards) | **Removed** — data consolidated into focus cards |
| Module Cards grid (5-6 large cards) | **Replaced** by pill navigation |
| Werklocatie full-width section | **Moved** to Sheet triggered by pill |
| Gekoppelde Offerte card | **Removed** — info in header + pill |
| ProjectProgressStepper (circle-based) | **Replaced** by thin segmented bar |

## What Stays

- Budget warning banner (conditional, same logic)
- All navigation links (same destinations)
- All data queries (same Convex calls)
- Loading/error states (same skeleton + not found)
- Breadcrumb header (unchanged)

## Files to Modify

1. **`src/app/(dashboard)/projecten/[id]/page.tsx`** — Full rewrite of the page layout
2. **`src/components/project/project-progress-stepper.tsx`** — May be simplified or replaced with inline thin bar

## Files NOT Modified

- `src/components/project/werklocatie-card.tsx` — Still used, just rendered in a Sheet
- `convex/projecten.ts` — No backend changes
- `convex/projectKosten.ts` — No backend changes
- Any sub-pages (planning, uitvoering, kosten, nacalculatie) — Unchanged

## Responsive Behavior

- **Desktop (md+):** Two focus cards side by side, pills wrap to 2 rows if needed
- **Mobile (<md):** Focus cards stack vertically, pills become full-width stacked list
