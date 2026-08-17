# Project Overview Page Redesign — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign the project detail overview page to show status + budget tracking at a glance, replacing duplicated stats and oversized cards with two focus cards and compact pill navigation.

**Architecture:** Single page rewrite of `src/app/(dashboard)/projecten/[id]/page.tsx`. The current ~590-line page with duplicated stats rows, large module cards, inline werklocatie, and separate offerte card is replaced by a compact layout: thin progress bar, two focus cards (uren + planning), and a pill-based module navigator. Werklocatie moves into a Sheet. No backend changes.

**Tech Stack:** Next.js App Router ("use client"), Convex (useQuery), shadcn/ui (Card, Badge, Progress, Sheet, Button), Lucide icons, Tailwind CSS v4

---

## File Map

| File | Action | Responsibility |
|---|---|---|
| `src/components/project/thin-progress-bar.tsx` | **Create** | Thin 5-segment progress bar with labels, replacing circle stepper |
| `src/components/project/project-focus-cards.tsx` | **Create** | Two side-by-side focus cards (Uren + Planning) |
| `src/components/project/module-pills.tsx` | **Create** | Flex-wrap pill navigation with context-aware highlighting |
| `src/app/(dashboard)/projecten/[id]/page.tsx` | **Rewrite** | Compose new components, remove old layout |
| `src/components/project/project-progress-stepper.tsx` | **No change** | Kept for potential use in other pages; no longer imported by overview |

---

### Task 1: Create Thin Progress Bar Component

**Files:**
- Create: `src/components/project/thin-progress-bar.tsx`

- [ ] **Step 1: Create the component file**

```tsx
"use client";

import Link from "next/link";
import { cn } from "@/lib/utils";

export type ProjectStatus =
  | "voorcalculatie"
  | "gepland"
  | "in_uitvoering"
  | "afgerond"
  | "nacalculatie_compleet"
  | "gefactureerd";

const STATUS_ORDER: ProjectStatus[] = [
  "gepland",
  "in_uitvoering",
  "afgerond",
  "nacalculatie_compleet",
  "gefactureerd",
];

const STATUS_LABELS: Record<string, string> = {
  gepland: "Gepland",
  in_uitvoering: "In Uitvoering",
  afgerond: "Afgerond",
  nacalculatie_compleet: "Nacalculatie",
  gefactureerd: "Gefactureerd",
};

interface ThinProgressBarProps {
  projectId: string;
  projectStatus: ProjectStatus;
}

export function ThinProgressBar({ projectId, projectStatus }: ThinProgressBarProps) {
  const effectiveStatus = projectStatus === "voorcalculatie" ? "gepland" : projectStatus;
  const activeIndex = STATUS_ORDER.indexOf(effectiveStatus);

  const stepHrefs: (string | null)[] = [
    `/projecten/${projectId}/planning`,
    activeIndex >= 1 ? `/projecten/${projectId}/uitvoering` : null,
    `/projecten/${projectId}`,
    activeIndex >= 2 ? `/projecten/${projectId}/nacalculatie` : null,
    activeIndex >= 3 ? `/projecten/${projectId}/factuur` : null,
  ];

  return (
    <nav aria-label="Project voortgang" className="w-full">
      {/* Segmented bar */}
      <div className="flex gap-1 mb-2">
        {STATUS_ORDER.map((status, i) => (
          <div
            key={status}
            className={cn(
              "h-1 flex-1 rounded-full transition-colors",
              i <= activeIndex ? "bg-primary" : "bg-muted"
            )}
          />
        ))}
      </div>

      {/* Labels */}
      <div className="flex justify-between">
        {STATUS_ORDER.map((status, i) => {
          const isActive = i === activeIndex;
          const isCompleted = i < activeIndex;
          const isFuture = i > activeIndex;
          const href = stepHrefs[i];
          const label = STATUS_LABELS[status];

          const labelClasses = cn(
            "text-[11px] font-medium transition-colors",
            isActive && "text-primary",
            isCompleted && "text-muted-foreground",
            isFuture && "text-muted-foreground/50"
          );

          if (href && !isFuture) {
            return (
              <Link
                key={status}
                href={href}
                className={cn(labelClasses, "hover:text-primary/80")}
              >
                {label}
              </Link>
            );
          }

          return (
            <span key={status} className={labelClasses}>
              {label}
            </span>
          );
        })}
      </div>
    </nav>
  );
}
```

- [ ] **Step 2: Verify it compiles**

Run: `npx tsc --noEmit --pretty 2>&1 | head -20`
Expected: No errors related to `thin-progress-bar.tsx`

- [ ] **Step 3: Commit**

```bash
git add src/components/project/thin-progress-bar.tsx
git commit -m "feat(project): add thin progress bar component for overview redesign"
```

---

### Task 2: Create Focus Cards Component

**Files:**
- Create: `src/components/project/project-focus-cards.tsx`

- [ ] **Step 1: Create the component file**

```tsx
"use client";

import { Clock, ListChecks } from "lucide-react";
import { Progress } from "@/components/ui/progress";

interface FocusCardsProps {
  // Uren data
  geregistreerdeUren: number;
  normUrenTotaal: number | null;
  geschatteDagen: number | null;
  teamGrootte: number | null;
  // Planning data
  totaleTaken: number;
  afgerondeTaken: number;
}

export function ProjectFocusCards({
  geregistreerdeUren,
  normUrenTotaal,
  geschatteDagen,
  teamGrootte,
  totaleTaken,
  afgerondeTaken,
}: FocusCardsProps) {
  const urenPercentage = normUrenTotaal && normUrenTotaal > 0
    ? Math.round((geregistreerdeUren / normUrenTotaal) * 100)
    : 0;
  const planningPercentage = totaleTaken > 0
    ? Math.round((afgerondeTaken / totaleTaken) * 100)
    : 0;
  const openTaken = totaleTaken - afgerondeTaken;

  return (
    <div className="grid gap-3 md:grid-cols-2">
      {/* Uren Focus Card */}
      <div className="rounded-xl border border-border bg-card p-5">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-500/10">
              <Clock className="h-4 w-4 text-blue-500" />
            </div>
            <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Uren Voortgang
            </span>
          </div>
          <span className="text-xs text-muted-foreground">{urenPercentage}%</span>
        </div>

        <div className="flex items-baseline gap-1.5 mb-1">
          <span className="text-4xl font-extrabold tracking-tight">
            {geregistreerdeUren.toFixed(1)}
          </span>
          <span className="text-base text-muted-foreground">
            / {normUrenTotaal?.toFixed(1) ?? "—"} uur
          </span>
        </div>

        <Progress
          value={urenPercentage}
          className="h-2 mt-3 [&>div]:bg-gradient-to-r [&>div]:from-blue-500 [&>div]:to-blue-400"
        />

        <div className="flex justify-between mt-2 text-[11px] text-muted-foreground/70">
          <span>{geschatteDagen?.toFixed(1) ?? "—"} dagen geschat</span>
          <span>{teamGrootte ?? "—"} teamleden</span>
        </div>
      </div>

      {/* Planning Focus Card */}
      <div className="rounded-xl border border-border bg-card p-5">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-green-500/10">
              <ListChecks className="h-4 w-4 text-green-500" />
            </div>
            <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Planning Voortgang
            </span>
          </div>
          <span className="text-xs text-muted-foreground">{planningPercentage}%</span>
        </div>

        <div className="flex items-baseline gap-1.5 mb-1">
          <span className="text-4xl font-extrabold tracking-tight">
            {afgerondeTaken}
          </span>
          <span className="text-base text-muted-foreground">
            / {totaleTaken} taken
          </span>
        </div>

        <Progress
          value={planningPercentage}
          className="h-2 mt-3 [&>div]:bg-gradient-to-r [&>div]:from-green-500 [&>div]:to-green-400"
        />

        <div className="flex justify-between mt-2 text-[11px] text-muted-foreground/70">
          <span>{afgerondeTaken} afgerond</span>
          <span>{openTaken} open</span>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify it compiles**

Run: `npx tsc --noEmit --pretty 2>&1 | head -20`
Expected: No errors related to `project-focus-cards.tsx`

- [ ] **Step 3: Commit**

```bash
git add src/components/project/project-focus-cards.tsx
git commit -m "feat(project): add focus cards component for uren and planning progress"
```

---

### Task 3: Create Module Pills Component

**Files:**
- Create: `src/components/project/module-pills.tsx`

- [ ] **Step 1: Create the component file**

```tsx
"use client";

import Link from "next/link";
import {
  ListTodo,
  Clock,
  Euro,
  Calculator,
  FileText,
  MapPin,
  ChevronRight,
  Receipt,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { ProjectStatus } from "@/components/project/thin-progress-bar";

interface ModulePillsProps {
  projectId: string;
  projectStatus: ProjectStatus;
  offerteId: string | null;
  offerteNummer: string | null;
  hasWerklocatie: boolean;
  werklocatieLabel: string;
  planningTaken: { total: number; done: number };
  geregistreerdeUren: number;
  normUrenTotaal: number | null;
  nacalculatieAfwijking: number | null;
  onWerklocatieClick: () => void;
}

interface PillConfig {
  key: string;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  detail: string;
  href?: string;
  onClick?: () => void;
  highlighted: boolean;
  variant?: "green";
}

export function ModulePills({
  projectId,
  projectStatus,
  offerteId,
  offerteNummer,
  werklocatieLabel,
  planningTaken,
  geregistreerdeUren,
  normUrenTotaal,
  nacalculatieAfwijking,
  onWerklocatieClick,
}: ModulePillsProps) {
  const effectiveStatus = projectStatus === "voorcalculatie" ? "gepland" : projectStatus;

  const pills: PillConfig[] = [
    {
      key: "planning",
      icon: ListTodo,
      label: "Planning",
      detail: `${planningTaken.done}/${planningTaken.total} taken`,
      href: `/projecten/${projectId}/planning`,
      highlighted: effectiveStatus === "gepland",
    },
    {
      key: "uitvoering",
      icon: Clock,
      label: "Uitvoering",
      detail: `${geregistreerdeUren.toFixed(1)} / ${normUrenTotaal?.toFixed(1) ?? "—"} uur`,
      href: `/projecten/${projectId}/uitvoering`,
      highlighted: effectiveStatus === "in_uitvoering",
    },
    {
      key: "kosten",
      icon: Euro,
      label: "Kosten",
      detail: "Live tracking",
      href: `/projecten/${projectId}/kosten`,
      highlighted: false,
    },
    {
      key: "nacalculatie",
      icon: Calculator,
      label: "Nacalculatie",
      detail: nacalculatieAfwijking !== null
        ? `${nacalculatieAfwijking > 0 ? "+" : ""}${nacalculatieAfwijking.toFixed(1)}% afwijking`
        : "Niet beschikbaar",
      href: `/projecten/${projectId}/nacalculatie`,
      highlighted: effectiveStatus === "afgerond" || effectiveStatus === "nacalculatie_compleet",
    },
  ];

  // Add factuur pill when nacalculatie is complete
  if (effectiveStatus === "nacalculatie_compleet" || effectiveStatus === "gefactureerd") {
    pills.push({
      key: "factuur",
      icon: Receipt,
      label: "Factuur",
      detail: effectiveStatus === "gefactureerd" ? "Verzonden" : "Gereed voor factuur",
      href: `/projecten/${projectId}/factuur`,
      highlighted: effectiveStatus === "nacalculatie_compleet",
      variant: "green",
    });
  }

  // Always add offerte and werklocatie
  if (offerteId) {
    pills.push({
      key: "offerte",
      icon: FileText,
      label: "Offerte",
      detail: offerteNummer ?? "Bekijk offerte",
      href: `/offertes/${offerteId}`,
      highlighted: false,
    });
  }

  pills.push({
    key: "werklocatie",
    icon: MapPin,
    label: "Werklocatie",
    detail: werklocatieLabel,
    onClick: onWerklocatieClick,
    highlighted: false,
  });

  return (
    <div>
      <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground/70 mb-2.5">
        Modules
      </p>
      <div className="flex flex-wrap gap-2">
        {pills.map((pill) => {
          const Icon = pill.icon;
          const isGreen = pill.variant === "green";

          const content = (
            <div
              className={cn(
                "flex items-center gap-2.5 rounded-lg border px-3.5 py-2.5 transition-colors",
                pill.highlighted && !isGreen && "border-primary bg-primary/5",
                pill.highlighted && isGreen && "border-green-500 bg-green-500/5",
                !pill.highlighted && "border-border hover:border-muted-foreground/30 hover:bg-muted/50"
              )}
            >
              <Icon
                className={cn(
                  "h-4 w-4 shrink-0",
                  pill.highlighted && !isGreen && "text-primary",
                  pill.highlighted && isGreen && "text-green-500",
                  !pill.highlighted && "text-muted-foreground"
                )}
              />
              <div className="min-w-0">
                <div
                  className={cn(
                    "text-sm font-medium leading-tight",
                    pill.highlighted && !isGreen && "text-primary",
                    pill.highlighted && isGreen && "text-green-500",
                    !pill.highlighted && "text-foreground"
                  )}
                >
                  {pill.label}
                </div>
                <div
                  className={cn(
                    "text-[11px] leading-tight",
                    pill.highlighted && !isGreen && "text-primary/70",
                    pill.highlighted && isGreen && "text-green-500/70",
                    !pill.highlighted && "text-muted-foreground"
                  )}
                >
                  {pill.detail}
                </div>
              </div>
              <ChevronRight
                className={cn(
                  "h-3.5 w-3.5 shrink-0",
                  pill.highlighted && !isGreen && "text-primary/50",
                  pill.highlighted && isGreen && "text-green-500/50",
                  !pill.highlighted && "text-muted-foreground/50"
                )}
              />
            </div>
          );

          if (pill.href) {
            return (
              <Link key={pill.key} href={pill.href}>
                {content}
              </Link>
            );
          }

          return (
            <button key={pill.key} onClick={pill.onClick} type="button">
              {content}
            </button>
          );
        })}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify it compiles**

Run: `npx tsc --noEmit --pretty 2>&1 | head -20`
Expected: No errors related to `module-pills.tsx`

- [ ] **Step 3: Commit**

```bash
git add src/components/project/module-pills.tsx
git commit -m "feat(project): add module pills navigation component"
```

---

### Task 4: Rewrite the Project Overview Page

**Files:**
- Modify: `src/app/(dashboard)/projecten/[id]/page.tsx` (full rewrite)

- [ ] **Step 1: Rewrite the page**

Replace the entire file content with:

```tsx
"use client";

import { use, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQuery } from "convex/react";
import { api } from "../../../../../convex/_generated/api";
import { Id } from "../../../../../convex/_generated/dataModel";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Progress } from "@/components/ui/progress";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { SidebarTrigger } from "@/components/ui/sidebar";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { AlertTriangle, ArrowLeft, FileText } from "lucide-react";
import { ThinProgressBar, type ProjectStatus } from "@/components/project/thin-progress-bar";
import { ProjectFocusCards } from "@/components/project/project-focus-cards";
import { ModulePills } from "@/components/project/module-pills";
import { WerklocatieCard } from "@/components/project/werklocatie-card";
import { ProjectDetailSkeleton } from "@/components/skeletons";

const statusColors: Record<string, string> = {
  voorcalculatie: "bg-blue-200 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  gepland: "bg-blue-200 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  in_uitvoering: "bg-amber-200 text-amber-800 dark:bg-amber-900 dark:text-amber-200",
  afgerond: "bg-green-200 text-green-800 dark:bg-green-900 dark:text-green-200",
  nacalculatie_compleet: "bg-purple-200 text-purple-800 dark:bg-purple-900 dark:text-purple-200",
};

const statusLabels: Record<string, string> = {
  voorcalculatie: "Voorcalculatie",
  gepland: "Gepland",
  in_uitvoering: "In Uitvoering",
  afgerond: "Afgerond",
  nacalculatie_compleet: "Nacalculatie Compleet",
};

function formatDate(timestamp: number): string {
  return new Date(timestamp).toLocaleDateString("nl-NL", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export default function ProjectDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const projectId = id as Id<"projecten">;
  const [werklocatieOpen, setWerklocatieOpen] = useState(false);

  const budgetStatus = useQuery(
    api.projectKosten.getBudgetStatus,
    projectId ? { projectId } : "skip"
  );

  const projectDetails = useQuery(
    api.projecten.getWithDetails,
    projectId ? { id: projectId } : "skip"
  );

  // Loading state
  if (projectDetails === undefined) {
    return (
      <>
        <header className="flex h-16 shrink-0 items-center gap-2 border-b px-4">
          <SidebarTrigger className="-ml-1" />
          <Separator orientation="vertical" className="mr-2 h-4" />
          <Breadcrumb>
            <BreadcrumbList>
              <BreadcrumbItem>
                <BreadcrumbLink href="/">Dashboard</BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                <BreadcrumbLink href="/projecten">Projecten</BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                <BreadcrumbPage>Project</BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
        </header>
        <ProjectDetailSkeleton />
      </>
    );
  }

  // Not found
  if (!projectDetails) {
    return (
      <>
        <header className="flex h-16 shrink-0 items-center gap-2 border-b px-4">
          <SidebarTrigger className="-ml-1" />
          <Separator orientation="vertical" className="mr-2 h-4" />
          <Breadcrumb>
            <BreadcrumbList>
              <BreadcrumbItem>
                <BreadcrumbLink href="/">Dashboard</BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                <BreadcrumbLink href="/projecten">Projecten</BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                <BreadcrumbPage>Niet gevonden</BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
        </header>
        <div className="flex flex-1 flex-col items-center justify-center gap-4">
          <FileText className="h-12 w-12 text-muted-foreground/50" />
          <h2 className="text-lg font-medium">Project niet gevonden</h2>
          <Button variant="outline" onClick={() => router.push("/projecten")}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Terug naar projecten
          </Button>
        </div>
      </>
    );
  }

  const { project, offerte, voorcalculatie, planningTaken, nacalculatie } = projectDetails;

  return (
    <>
      <header className="flex h-16 shrink-0 items-center gap-2 border-b px-4">
        <SidebarTrigger className="-ml-1" />
        <Separator orientation="vertical" className="mr-2 h-4" />
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink href="/">Dashboard</BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbLink href="/projecten">Projecten</BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbPage>{project.naam}</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>
      </header>

      <div className="flex flex-1 flex-col gap-5 p-4 md:p-8">
        {/* Header — project name, badge, metadata */}
        <div className="flex items-start gap-3">
          <Button
            variant="ghost"
            size="icon"
            className="mt-0.5 h-8 w-8 shrink-0"
            asChild
            aria-label="Terug naar projecten"
          >
            <Link href="/projecten">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold tracking-tight md:text-3xl">
                {project.naam}
              </h1>
              <Badge className={statusColors[project.status]}>
                {statusLabels[project.status]}
              </Badge>
            </div>
            <p className="mt-0.5 text-sm text-muted-foreground">
              {offerte && <>{offerte.offerteNummer} · {offerte.klant.naam} · </>}
              Aangemaakt {formatDate(project.createdAt)}
            </p>
          </div>
        </div>

        {/* Thin Progress Stepper */}
        <ThinProgressBar
          projectId={id}
          projectStatus={project.status as ProjectStatus}
        />

        {/* Budget Warning Banner (conditional) */}
        {budgetStatus?.drempel80 && (
          <div
            className={`flex items-center gap-3 rounded-lg border p-3 ${
              budgetStatus.drempel100
                ? "border-red-500/50 bg-red-950/20"
                : "border-amber-500/50 bg-amber-950/20"
            }`}
          >
            <AlertTriangle
              className={`h-4 w-4 shrink-0 ${
                budgetStatus.drempel100 ? "text-red-500" : "text-amber-500"
              }`}
            />
            <div className="flex-1 min-w-0">
              <p
                className={`text-sm font-medium ${
                  budgetStatus.drempel100
                    ? "text-red-400"
                    : "text-amber-400"
                }`}
              >
                {budgetStatus.drempel100
                  ? `Budget overschreden — ${budgetStatus.percentage}% verbruikt`
                  : `Budget waarschuwing — ${budgetStatus.percentage}% verbruikt`}
              </p>
              <p className="text-xs text-muted-foreground">
                €{budgetStatus.werkelijkeKosten.toLocaleString("nl-NL", { minimumFractionDigits: 2 })}
                {" van "}
                €{budgetStatus.budget.toLocaleString("nl-NL", { minimumFractionDigits: 2 })} budget
              </p>
            </div>
            <Progress
              value={Math.min(budgetStatus.percentage, 100)}
              className={`h-1.5 w-20 ${
                budgetStatus.drempel100
                  ? "[&>div]:bg-red-500"
                  : "[&>div]:bg-amber-500"
              }`}
            />
          </div>
        )}

        {/* Focus Cards */}
        <ProjectFocusCards
          geregistreerdeUren={projectDetails.totaalGeregistreerdeUren}
          normUrenTotaal={voorcalculatie?.normUrenTotaal ?? null}
          geschatteDagen={voorcalculatie?.geschatteDagen ?? null}
          teamGrootte={voorcalculatie?.teamGrootte ?? null}
          totaleTaken={planningTaken.length}
          afgerondeTaken={planningTaken.filter((t) => t.status === "afgerond").length}
        />

        {/* Module Pills */}
        <ModulePills
          projectId={id}
          projectStatus={project.status as ProjectStatus}
          offerteId={offerte?._id ?? null}
          offerteNummer={offerte?.offerteNummer ?? null}
          hasWerklocatie={!!project.werklocatie}
          werklocatieLabel={
            project.werklocatie?.adres
              ? project.werklocatie.adres
              : "Niet ingesteld"
          }
          planningTaken={{
            total: planningTaken.length,
            done: planningTaken.filter((t) => t.status === "afgerond").length,
          }}
          geregistreerdeUren={projectDetails.totaalGeregistreerdeUren}
          normUrenTotaal={voorcalculatie?.normUrenTotaal ?? null}
          nacalculatieAfwijking={nacalculatie?.afwijkingPercentage ?? null}
          onWerklocatieClick={() => setWerklocatieOpen(true)}
        />
      </div>

      {/* Werklocatie Sheet */}
      <Sheet open={werklocatieOpen} onOpenChange={setWerklocatieOpen}>
        <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Werklocatie</SheetTitle>
          </SheetHeader>
          <div className="mt-4">
            <WerklocatieCard projectId={projectId} />
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
```

- [ ] **Step 2: Verify it compiles**

Run: `npx tsc --noEmit --pretty 2>&1 | head -30`

Expected: Clean compilation or minor type adjustments needed (see Step 3).

- [ ] **Step 3: Fix type issues if any**

The `project.werklocatie` property may have a different shape than assumed. Check the Convex query response type:

Run: `grep -n "werklocatie" convex/schema.ts | head -10`

Adjust the `werklocatieLabel` prop value accordingly. If `werklocatie` is not directly on the project object, check `projectDetails` for how it's accessed and update the code.

- [ ] **Step 4: Run the dev server and visually verify**

Run: `npm run dev`

Open `http://localhost:3000/projecten/[any-project-id]` and verify:
1. Header shows project name + badge + offerte/klant metadata inline
2. Thin progress bar shows correct status segment highlighted
3. Two focus cards show uren and planning progress with bars
4. Module pills row shows all 6 modules with correct highlighting
5. Clicking "Werklocatie" pill opens the Sheet
6. Budget warning banner appears only when applicable
7. No more scrolling needed on desktop viewport

- [ ] **Step 5: Commit**

```bash
git add src/app/\(dashboard\)/projecten/\[id\]/page.tsx
git commit -m "feat(project): rewrite overview page with focus cards and pill navigation

Replaces duplicated stats rows, oversized module cards, and inline
werklocatie with a compact layout: thin progress bar, two focus cards
(uren + planning), and pill-based module navigation. Werklocatie
moved to a Sheet. All info fits on one screen without scrolling."
```

---

### Task 5: Type and Property Adjustments

**Files:**
- Modify: `src/app/(dashboard)/projecten/[id]/page.tsx` (if needed)
- Modify: `src/components/project/module-pills.tsx` (if needed)

This task handles any type mismatches discovered during compilation in Task 4.

- [ ] **Step 1: Check werklocatie property access**

Run: `grep -n "werklocatie" convex/projecten.ts | head -20`

The `project.werklocatie` field may be structured differently. Common patterns:
- `project.werklocatie?.adres` — direct field
- `projectDetails.werklocatie?.adres` — returned separately by the query

Adjust the `werklocatieLabel` prop in the page accordingly.

- [ ] **Step 2: Check WerklocatieCard props**

The `WerklocatieCard` component may expect different props when used inside a Sheet vs. standalone. Read the component's prop interface:

Run: `grep -A5 "interface\|Props" src/components/project/werklocatie-card.tsx | head -15`

If it renders its own Card wrapper, the Sheet may show a card-within-a-sheet. If so, either:
- Pass a `compact` prop if the component supports it
- Wrap differently in the Sheet

- [ ] **Step 3: Final typecheck**

Run: `npm run typecheck`
Expected: PASS (0 errors)

- [ ] **Step 4: Final build check**

Run: `npm run build 2>&1 | tail -10`
Expected: Build succeeds

- [ ] **Step 5: Commit any fixes**

```bash
git add -u
git commit -m "fix(project): resolve type issues in overview redesign"
```

---

### Task 6: Cleanup and Final Verification

**Files:**
- No new files

- [ ] **Step 1: Verify no dead imports in the old stepper**

The `ProjectProgressStepper` component is no longer imported by the overview page, but may still be used elsewhere:

Run: `grep -r "ProjectProgressStepper" src/ --include="*.tsx" --include="*.ts" -l`

If no other files import it, add a comment to the file noting it's available for other pages but currently unused. Do NOT delete it — other pages or future features may use it.

- [ ] **Step 2: Check for unused imports in the rewritten page**

Run: `npm run lint 2>&1 | grep "projecten/\[id\]/page" | head -10`

Fix any lint warnings about unused imports (Calendar, Clock from the old page, etc. should already be removed).

- [ ] **Step 3: Visual QA — all project statuses**

Test the page with projects in different statuses to verify:
- `gepland`: Planning pill highlighted, stepper shows first segment
- `in_uitvoering`: Uitvoering pill highlighted, first two segments filled
- `afgerond`: Nacalculatie pill highlighted, three segments filled
- `nacalculatie_compleet`: Factuur pill appears (green), four segments filled
- Budget warning banner when applicable

- [ ] **Step 4: Mobile responsive check**

Resize browser to mobile width and verify:
- Focus cards stack vertically
- Pills wrap naturally
- Sheet still opens correctly
- No horizontal overflow

- [ ] **Step 5: Final commit if any cleanup was needed**

```bash
git add -u
git commit -m "chore(project): cleanup overview redesign"
```
