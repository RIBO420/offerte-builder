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
        {/* Header */}
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
              {offerte && <>{offerte.offerteNummer} &middot; {offerte.klant.naam} &middot; </>}
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
                  budgetStatus.drempel100 ? "text-red-400" : "text-amber-400"
                }`}
              >
                {budgetStatus.drempel100
                  ? `Budget overschreden — ${budgetStatus.percentage}% verbruikt`
                  : `Budget waarschuwing — ${budgetStatus.percentage}% verbruikt`}
              </p>
              <p className="text-xs text-muted-foreground">
                &euro;{budgetStatus.werkelijkeKosten.toLocaleString("nl-NL", { minimumFractionDigits: 2 })}
                {" van "}
                &euro;{budgetStatus.budget.toLocaleString("nl-NL", { minimumFractionDigits: 2 })} budget
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
          hasWerklocatie={false}
          werklocatieLabel="Bekijk locatie"
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
