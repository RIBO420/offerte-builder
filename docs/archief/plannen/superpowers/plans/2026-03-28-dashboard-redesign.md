# Dashboard Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restructure the admin dashboard from 11 fragmented sections to 5 cohesive sections with modern UI polish, consolidated data fetching, and zero duplicate metrics.

**Architecture:** Single consolidated Convex query replaces 3 overlapping queries. New dashboard components (AandachtNodig, FinancieelGrid, PipelineBento, VlootBadge) replace the current mix of inline JSX and role-based sub-dashboards. Framer Motion staggerChildren replaces manual delay calculations.

**Tech Stack:** Next.js 16 (App Router), Convex (backend), React 19, Tailwind CSS 4, shadcn/ui, Framer Motion, Vitest

**Spec:** `docs/superpowers/specs/2026-03-28-dashboard-redesign-design.md`
**Mockup:** `.superpowers/brainstorm/96336-1774653102/final-design-v2.html`

---

## File Structure

### New Files
| File | Responsibility |
|------|---------------|
| `convex/dashboard.ts` | Consolidated admin dashboard query |
| `src/hooks/use-dashboard.ts` | Hook wrapping the consolidated query |
| `src/components/dashboard/aandacht-nodig.tsx` | Combined warnings + action required |
| `src/components/dashboard/financieel-grid.tsx` | 2x3 metric grid with sparklines, badges, animated numbers |
| `src/components/dashboard/pipeline-bento.tsx` | Bento layout: pipeline, conversie, project status, activiteit, projecten |
| `src/components/dashboard/vloot-badge.tsx` | Compact fleet status badge |
| `src/lib/greeting.ts` | Time-of-day greeting utility |
| `src/__tests__/greeting.test.ts` | Tests for greeting utility |

### Modified Files
| File | Changes |
|------|---------|
| `src/app/(dashboard)/dashboard/page.tsx` | Complete rewrite of admin section using new components |

### Files to Keep (no changes)
| File | Reason |
|------|--------|
| `src/components/dashboard/voorman-dashboard.tsx` | Medewerker dashboard, unchanged |
| `src/components/dashboard/warnings-feed.tsx` | Still used by medewerker dashboard |
| `src/components/ui/animated-number.tsx` | Used as-is |
| `src/components/ui/sparkline.tsx` | Used as-is |
| `src/components/ui/donut-chart.tsx` | Used as-is |
| `src/components/ui/empty-state.tsx` | Used as-is |

---

## Task 1: Time-of-day greeting utility

**Files:**
- Create: `src/lib/greeting.ts`
- Create: `src/__tests__/greeting.test.ts`

- [ ] **Step 1: Write tests for greeting utility**

```typescript
// src/__tests__/greeting.test.ts
import { describe, it, expect, vi, afterEach } from "vitest";
import { getGreeting } from "@/lib/greeting";

describe("getGreeting", () => {
  afterEach(() => { vi.useRealTimers(); });

  it("returns Goedemorgen before 12:00", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 2, 28, 9, 0));
    expect(getGreeting("Ricardo")).toBe("Goedemorgen, Ricardo");
  });

  it("returns Goedemiddag between 12:00 and 18:00", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 2, 28, 14, 0));
    expect(getGreeting("Ricardo")).toBe("Goedemiddag, Ricardo");
  });

  it("returns Goedenavond after 18:00", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 2, 28, 20, 0));
    expect(getGreeting("Ricardo")).toBe("Goedenavond, Ricardo");
  });

  it("returns Welkom without name", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 2, 28, 10, 0));
    expect(getGreeting()).toBe("Goedemorgen");
  });
});
```

- [ ] **Step 2: Run tests, verify they fail**

Run: `npm run test:run -- src/__tests__/greeting.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Implement greeting utility**

```typescript
// src/lib/greeting.ts
export function getGreeting(name?: string): string {
  const hour = new Date().getHours();
  let greeting: string;

  if (hour < 12) greeting = "Goedemorgen";
  else if (hour < 18) greeting = "Goedemiddag";
  else greeting = "Goedenavond";

  return name ? `${greeting}, ${name}` : greeting;
}
```

- [ ] **Step 4: Run tests, verify they pass**

Run: `npm run test:run -- src/__tests__/greeting.test.ts`
Expected: 4 tests PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/greeting.ts src/__tests__/greeting.test.ts
git commit -m "feat(dashboard): add time-of-day greeting utility"
```

---

## Task 2: Consolidated Convex dashboard query

**Files:**
- Create: `convex/dashboard.ts`
- Create: `src/hooks/use-dashboard.ts`

**Context:** Currently 3 queries fetch overlapping data. This task creates one query returning everything.

- [ ] **Step 1: Create consolidated query**

Create `convex/dashboard.ts`. This query combines data from `getFullDashboardData` (convex/offertes.ts:175-439), `getDirectieStats` (convex/directieDashboard.ts:22-176), and the vloot summary from `getMateriaalmanStats` (convex/materiaalmanDashboard.ts:17-163).

Structure:
```typescript
// convex/dashboard.ts
import { query } from "./_generated/server";
import { requireAuthUserId } from "./users";

// Copy getQuarterBounds and QUARTER_MS from directieDashboard.ts

export const getAdminDashboardData = query({
  args: {},
  handler: async (ctx) => {
    const userId = await requireAuthUserId(ctx);

    // Fetch ALL tables in one parallel batch
    const [offertes, projecten, facturen, urenReg, voertuigen, machines, voorraad, qcChecks] =
      await Promise.all([
        ctx.db.query("offertes").withIndex("by_user", (q) => q.eq("userId", userId)).collect(),
        ctx.db.query("projecten").withIndex("by_user", (q) => q.eq("userId", userId)).collect(),
        ctx.db.query("facturen").withIndex("by_user", (q) => q.eq("userId", userId)).collect(),
        ctx.db.query("urenRegistraties").withIndex("by_user", (q) => q.eq("userId", userId)).collect(),
        ctx.db.query("voertuigen").withIndex("by_user", (q) => q.eq("userId", userId)).collect(),
        ctx.db.query("machines").withIndex("by_user", (q) => q.eq("userId", userId)).collect(),
        ctx.db.query("voorraad").withIndex("by_user", (q) => q.eq("userId", userId)).collect(),
        ctx.db.query("kwaliteitsControles").withIndex("by_user", (q) => q.eq("userId", userId)).collect(),
      ]);

    // Compute all stats from the fetched data (reuse computation logic from existing queries)
    // Return combined result matching all dashboard needs

    return {
      // From getFullDashboardData
      offerteStats, recentOffertes, revenueStats, acceptedWithoutProject,
      projectStats, activeProjects,
      // From getDirectieStats (unique data only)
      financieel: { openstaandBedrag, vervaldeAantal, vervaldenBedrag },
      kwartaalVergelijking: { gefactureerdThisQ, gefactureerdPrevQ },
      urenDezeMaand,
      // From getMateriaalmanStats (summary only)
      vlootSummary: { hasIssues, issueCount, summary },
    };
  },
});
```

**Important**: Reference the existing query implementations:
- `convex/offertes.ts` lines 175-439 for offerte/project/revenue computation
- `convex/directieDashboard.ts` lines 22-176 for financieel/kwartaal computation
- `convex/materiaalmanDashboard.ts` lines 17-163 for vloot summary

Copy the computation logic, don't import it (Convex functions are isolated).

- [ ] **Step 2: Verify query compiles with Convex dev**

Run: `npx convex dev` (should sync without errors)
Check: No TypeScript errors in the new file

- [ ] **Step 3: Create the dashboard hook**

```typescript
// src/hooks/use-dashboard.ts
"use client";

import { useQuery } from "convex/react";
import { useMemo } from "react";
import { api } from "../../convex/_generated/api";
import { useCurrentUser } from "./use-current-user";

export function useAdminDashboardData() {
  const { user } = useCurrentUser();
  const data = useQuery(
    api.dashboard.getAdminDashboardData,
    user?._id ? {} : "skip"
  );

  return useMemo(() => ({
    ...data,
    isLoading: user !== undefined && data === undefined,
  }), [data, user]);
}
```

- [ ] **Step 4: Commit**

```bash
git add convex/dashboard.ts src/hooks/use-dashboard.ts
git commit -m "feat(dashboard): add consolidated admin dashboard query and hook"
```

---

## Task 3: AandachtNodig component

**Files:**
- Create: `src/components/dashboard/aandacht-nodig.tsx`

**Context:** Combines the current "Actie vereist" (accepted offertes without project) and WarningsFeed (proactive warnings) into one conditional section.

- [ ] **Step 1: Create the component**

Props interface:
```typescript
interface AandachtNodigProps {
  acceptedWithoutProject: Array<{
    _id: string;
    offerteNummer: string;
    klantNaam: string;
  }>;
  warnings: Array<{
    id: string;
    type: string;
    prioriteit: "hoog" | "middel" | "laag";
    titel: string;
    beschrijving: string;
    actie?: string;
  }>;
}
```

Design reference: Spec Section 2. Uses:
- `border-left: 3px solid amber-500` accent
- Count badge pill next to title
- Each accepted offerte: name + number + "Start Project" button (links to `/projecten/nieuw?offerte={id}`)
- Each warning: title + priority badge + description + optional "Bekijk" link
- Framer Motion `AnimatePresence` for smooth list transitions
- If both arrays empty → component returns `null`

Reference the existing implementations:
- Action required section: `src/app/(dashboard)/dashboard/page.tsx` lines 377-433
- Warning items: `src/components/dashboard/warnings-feed.tsx`

- [ ] **Step 2: Verify it renders in isolation**

Temporarily import in the dashboard page to verify it renders correctly. Check dark mode styling.

- [ ] **Step 3: Commit**

```bash
git add src/components/dashboard/aandacht-nodig.tsx
git commit -m "feat(dashboard): add AandachtNodig combined alerts component"
```

---

## Task 4: FinancieelGrid component

**Files:**
- Create: `src/components/dashboard/financieel-grid.tsx`

**Context:** The 2x3 metric grid with sparklines, animated numbers, percentage badges. This is the most visually complex new component.

- [ ] **Step 1: Create MetricCard sub-component**

Inside `financieel-grid.tsx`, create an internal `MetricCard` component:

```typescript
interface MetricCardProps {
  title: string;
  value: number;
  format?: "currency" | "number" | "percentage";
  icon: React.ReactNode;
  iconColor: string;
  trendPercentage?: number; // +100, -5, etc.
  trendDirection?: "up" | "down" | "flat";
  subtitle?: string; // "Mrt 2026", "Q1 2026"
  subtitleColor?: string; // "text-green-500" for positive states
  sparklineData?: number[];
  sparklineColor?: string;
}
```

Uses:
- `AnimatedNumber` (from `@/components/ui/animated-number`) for the value
- `Sparkline` (from `@/components/ui/sparkline`) with `showArea={true}` as absolute-positioned background
- Percentage badge pill (top-right): `bg-green-500/12 text-green-400` or `bg-blue-500/12 text-blue-400`
- Font: `text-[28px] font-extrabold tracking-tight leading-none`
- Card: `bg-[#141414] border border-white/[0.06] rounded-xl p-4`
- Hover: `hover:-translate-y-px hover:shadow-md transition-all duration-200`

- [ ] **Step 2: Create FinancieelGrid wrapper**

```typescript
interface FinancieelGridProps {
  // From consolidated query
  totaleOmzet: number;
  actieveProjecten: number;
  totaalProjecten: number;
  afgerondeProjecten: number;
  openstaandeOffertes: number;
  openstaandBedrag: number;
  vervaldeAantal: number;
  vervaldenBedrag: number;
  gefactureerdThisQ: number;
  gefactureerdPrevQ: number;
  urenDezeMaand: number;
  // Trend data
  omzetTrend?: { percentage: number; direction: "up" | "down" | "flat" };
  gefactureerdTrend?: { percentage: number; direction: "up" | "down" | "flat" };
}
```

Renders a `grid grid-cols-3 gap-2` with 6 MetricCards:
1. Totale Omzet (green value, sparkline, +% badge)
2. Actieve Projecten (orange icon, "X afgerond / Y totaal")
3. Openstaande Offertes (blue icon)
4. Openstaand (amber icon, overdue alert in subtitle)
5. Gefactureerd dit Q (blue sparkline, +% badge, "Q1 2026")
6. Uren deze Maand (orange icon)

Section header: `text-xs text-muted-foreground uppercase tracking-widest font-medium`

- [ ] **Step 3: Verify visual match with mockup**

Compare rendering with `.superpowers/brainstorm/96336-1774653102/final-design-v2.html` Section 3.

- [ ] **Step 4: Commit**

```bash
git add src/components/dashboard/financieel-grid.tsx
git commit -m "feat(dashboard): add FinancieelGrid component with sparklines and animated numbers"
```

---

## Task 5: PipelineBento component

**Files:**
- Create: `src/components/dashboard/pipeline-bento.tsx`

**Context:** Bento grid layout combining pipeline, conversie rate, project status, recente activiteit, and lopende projecten.

- [ ] **Step 1: Create the bento layout structure**

Top-level component with props:
```typescript
interface PipelineBentoProps {
  // Offerte stats
  offerteStats: { concept: number; voorcalculatie: number; verzonden: number; geaccepteerd: number; afgewezen: number; totaal: number; };
  // Revenue
  conversionRate: number;
  totalAcceptedCount: number;
  averageOfferteValue: number;
  // Projects
  projectStats: { totaal: number; gepland: number; in_uitvoering: number; afgerond: number; nacalculatie_compleet: number; gefactureerd: number; };
  activeProjects: Array<{ _id: string; naam: string; klantNaam: string; voortgang: number; totaalUren: number; begroteUren: number; }>;
  // Activity
  recentOffertes: Array<{ _id: string; offerteNummer: string; klant: { naam: string }; status: string; totalen: { totaalInclBtw: number }; updatedAt: number; }>;
}
```

Grid structure:
```
Row 1: [Pipeline card 2fr] [Conversie Rate 1fr]
Row 2: [Project Status 1fr] [Recente Activiteit 1fr]
Row 3: [Lopende Project cards - 2 cols]
```

- [ ] **Step 2: Implement SegmentedProgressBar sub-component**

Internal component for the pipeline's colored progress bar:
```typescript
function SegmentedBar({ segments }: { segments: Array<{ value: number; color: string; label: string }> }) {
  const total = segments.reduce((sum, s) => sum + s.value, 0);
  if (total === 0) return null;
  return (
    <div className="flex h-2.5 rounded-full overflow-hidden gap-0.5">
      {segments.filter(s => s.value > 0).map((s, i) => (
        <div key={i} className="rounded-sm" style={{ flex: s.value, backgroundColor: s.color }} title={`${s.label}: ${s.value}`} />
      ))}
    </div>
  );
}
```

- [ ] **Step 3: Implement Pipeline card (large)**

Uses SegmentedBar + 5-column grid with counts per status. Each status cell has subtle background tint. Geaccepteerd gets green tint.

- [ ] **Step 4: Implement Conversie Rate card (mini radial)**

SVG circle chart showing conversion percentage. Below: count text + badge with avg offerte value.
Reuse approach from mockup: two overlapping `<circle>` elements (track + fill) with `stroke-dasharray`.

- [ ] **Step 5: Implement Project Status card**

Use existing `DonutChart` component from `@/components/ui/donut-chart`. Pass segments with project status data. Use CSS variables for chart colors: `hsl(var(--chart-1))` etc.
Legend displayed beside the donut (not below).

- [ ] **Step 6: Implement Recente Activiteit card**

Timeline with dot indicators (6px colored circles). Each entry:
- Status dot (green=geaccepteerd, blue=verzonden, etc.)
- Action text + offerte number + time ago
- Amount in contextual color

Reuse `formatTimeAgo` from existing dashboard page. Copy to `src/lib/format/time.ts` if not already there.

- [ ] **Step 7: Implement Lopende Projecten sub-section**

Conditional: only renders if `activeProjects.length > 0`. Shows max 4 project cards in 2-col grid with:
- Folder icon in orange tint
- Project name + klant name
- Percentage badge
- Progress bar
- Uren count

Use `EmptyState` component when no active projects (only in the fallback case for the full dashboard empty state, not here — this section just doesn't render).

- [ ] **Step 8: Verify visual match with mockup**

Compare with `.superpowers/brainstorm/96336-1774653102/final-design-v2.html` Section 4.

- [ ] **Step 9: Commit**

```bash
git add src/components/dashboard/pipeline-bento.tsx
git commit -m "feat(dashboard): add PipelineBento component with bento grid layout"
```

---

## Task 6: VlootBadge component

**Files:**
- Create: `src/components/dashboard/vloot-badge.tsx`

- [ ] **Step 1: Create the component**

```typescript
interface VlootBadgeProps {
  hasIssues: boolean;
  issueCount: number;
  summary: string; // "alles operationeel" or "2 blokkades, 1 voorraad alert"
}
```

Simple single-line card:
- Green dot + "Vloot & Materieel — alles operationeel" when no issues
- Red/amber dot + issue count + summary when issues exist
- "Details →" link on the right, navigates to fleet management page
- `bg-[#141414] border border-white/[0.06] rounded-[10px] px-4 py-2.5`

- [ ] **Step 2: Commit**

```bash
git add src/components/dashboard/vloot-badge.tsx
git commit -m "feat(dashboard): add VlootBadge compact status component"
```

---

## Task 7: Dashboard skeleton matching new layout

**Files:**
- Modify: `src/components/ui/skeleton-card.tsx` (add new skeleton variant)

- [ ] **Step 1: Add AdminDashboardSkeleton**

Create a skeleton that matches the new dashboard layout:
- Welcome bar skeleton (left text + right buttons)
- 2x3 grid of card skeletons (matching FinancieelGrid)
- Bento grid skeleton (2fr+1fr row, 1fr+1fr row, 2-col row)
- Single line skeleton (VlootBadge)

Use existing `Skeleton` component with appropriate dimensions. Wrap in `m.div` with same stagger animations.

- [ ] **Step 2: Commit**

```bash
git add src/components/ui/skeleton-card.tsx
git commit -m "feat(dashboard): add skeleton matching new dashboard layout"
```

---

## Task 8: Rewrite dashboard page

**Files:**
- Modify: `src/app/(dashboard)/dashboard/page.tsx`

**Context:** This is the main integration task. Replace the entire admin section with new components.

- [ ] **Step 1: Update imports**

Remove old imports:
- `DirectieDashboard`, `MateriaalmanDashboard`
- `VoorraadAlertCard`, `InkoopordersCard`, `QCStatusCard` (already removed)
- `DonutChart`, `Progress` (moved to sub-components)
- Unused Lucide icons

Add new imports:
- `useAdminDashboardData` from `@/hooks/use-dashboard`
- `AandachtNodig` from `@/components/dashboard/aandacht-nodig`
- `FinancieelGrid` from `@/components/dashboard/financieel-grid`
- `PipelineBento` from `@/components/dashboard/pipeline-bento`
- `VlootBadge` from `@/components/dashboard/vloot-badge`
- `getGreeting` from `@/lib/greeting`

- [ ] **Step 2: Replace data hook**

Replace `useFullDashboardData()` with `useAdminDashboardData()` for admin users.
Keep `useFullDashboardData()` for medewerker dashboard (it still needs it for the project list).

Or: medewerker dashboard can also use the consolidated query if the data is a superset.

- [ ] **Step 3: Rewrite admin section with stagger container**

```tsx
// Animation variants
const container = {
  hidden: {},
  show: { transition: { staggerChildren: 0.04, delayChildren: 0.1 } },
};
const item = {
  hidden: { opacity: 0, y: 8 },
  show: { opacity: 1, y: 0, transition: { duration: 0.25 } },
};

// Admin dashboard
{isAdmin && (
  <m.div variants={container} initial="hidden" animate="show" className="space-y-6">
    {/* Section 1: Welcome + Quick Start — inline */}
    <m.div variants={item} className="flex items-center justify-between">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold tracking-tight">
          {getGreeting(clerkUser?.firstName ?? undefined)}
        </h1>
        <p className="text-muted-foreground mt-1">...</p>
      </div>
      <div className="flex gap-2">
        {/* Aanleg + Onderhoud buttons with green accent */}
      </div>
    </m.div>

    {/* Section 2: Aandacht Nodig — conditional */}
    {(hasActionRequired || hasWarnings) && (
      <m.div variants={item}>
        <AandachtNodig
          acceptedWithoutProject={data.acceptedWithoutProject}
          warnings={warnings}
        />
      </m.div>
    )}

    {/* Section 3: Financieel Grid */}
    <m.div variants={item}>
      <FinancieelGrid {...financieelProps} />
    </m.div>

    {/* Section 4: Pipeline Bento */}
    <m.div variants={item}>
      <PipelineBento {...pipelineProps} />
    </m.div>

    {/* Section 5: Vloot Badge — conditional */}
    <m.div variants={item}>
      <VlootBadge {...vlootProps} />
    </m.div>
  </m.div>
)}
```

- [ ] **Step 4: Replace skeleton loading**

Replace `DashboardSkeleton` with `AdminDashboardSkeleton` for admin users.

- [ ] **Step 5: Remove all old admin inline sections**

Delete: Key Metrics row, Analytics section, Project Status + Recent Activity section, Lopende Projecten section, Snel starten section, old welcome section (all now handled by new components).

- [ ] **Step 6: TypeScript check**

Run: `npm run typecheck`
Expected: No errors

- [ ] **Step 7: Visual verification**

Run: `npm run dev`
Open dashboard, verify:
- Time-of-day greeting shows correctly
- Quick start buttons are inline with welcome
- Aandacht nodig section shows (if there are items)
- 2x3 financial grid renders with correct data
- Sparklines appear on Totale Omzet and Gefactureerd
- AnimatedNumber counts up on page load
- Percentage badges show correct trends
- Bento grid has correct proportions (pipeline larger)
- Conversie rate shows as mini radial chart
- Donut chart renders with project data
- Recente activiteit timeline works
- Lopende projecten cards show with progress
- Vloot badge shows at bottom
- All animations stagger smoothly
- Dark mode looks correct

- [ ] **Step 8: Commit**

```bash
git add src/app/(dashboard)/dashboard/page.tsx
git commit -m "feat(dashboard): rewrite admin dashboard with new component architecture"
```

---

## Task 9: Cleanup

**Files:**
- Verify: unused imports and components

- [ ] **Step 1: Check for unused dashboard component imports**

Verify these are no longer imported anywhere:
- `DirectieDashboard` — check if only used in dashboard page
- `MateriaalmanDashboard` — check if only used in dashboard page
- Old `useFullDashboardData` — check if still needed for medewerker dashboard

Do NOT delete components that are still used by the medewerker (non-admin) dashboard section.

- [ ] **Step 2: Run lint and typecheck**

```bash
npm run lint && npm run typecheck
```

- [ ] **Step 3: Run tests**

```bash
npm run test:run
```

- [ ] **Step 4: Final commit**

```bash
git add -A
git commit -m "chore(dashboard): clean up unused imports after redesign"
```

---

## Task Order & Dependencies

```
Task 1 (greeting) ─────────────────────────────────┐
Task 2 (consolidated query + hook) ─────────────────┤
Task 3 (AandachtNodig) ────────────────────────────┤
Task 4 (FinancieelGrid) ───────────────────────────┼──► Task 8 (rewrite page) ──► Task 9 (cleanup)
Task 5 (PipelineBento) ────────────────────────────┤
Task 6 (VlootBadge) ───────────────────────────────┤
Task 7 (skeleton) ─────────────────────────────────┘
```

Tasks 1-7 are independent and can be built in parallel.
Task 8 depends on all of 1-7.
Task 9 depends on 8.
