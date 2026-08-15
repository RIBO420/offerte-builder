"use client";
import { klantNaam } from "@convex/lib/offerteKlant";

import { use, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQuery } from "convex/react";
import { api } from "../../../../../convex/_generated/api";
import { Id } from "../../../../../convex/_generated/dataModel";
import { PROJECT_STATUS_CONFIG, statusClasses } from "@/lib/constants/statuses";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { AlertTriangle, ArrowLeft, FileText } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { CopyButton } from "@/components/ui/copy-button";
import { ThinProgressBar, type ProjectStatus } from "@/components/project/thin-progress-bar";
import { ModulePills } from "@/components/project/module-pills";
import { WerklocatieCard } from "@/components/project/werklocatie-card";
import { KlantThreadPaneel } from "@/components/meldingen/klant-thread-paneel";
import { ProjectDetailSkeleton } from "@/components/skeletons";

// Statuskleuren uit de centrale bron (WS4): zelfde status = zelfde kleur.
const statusColors: Record<string, string> = Object.fromEntries(
  Object.entries(PROJECT_STATUS_CONFIG).map(([key, config]) => [
    key,
    statusClasses(config),
  ])
);

const statusLabels: Record<string, string> = Object.fromEntries(
  Object.entries(PROJECT_STATUS_CONFIG).map(([key, config]) => [key, config.label])
);

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
        <PageHeader customLabels={{ [`/projecten/${id}`]: "Project" }} />
        <ProjectDetailSkeleton />
      </>
    );
  }

  // Not found
  if (!projectDetails) {
    return (
      <>
        <PageHeader customLabels={{ [`/projecten/${id}`]: "Niet gevonden" }} />
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
      <PageHeader customLabels={{ [`/projecten/${id}`]: project.naam }} />

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
            <div className="mt-0.5 flex items-center gap-1 text-sm text-muted-foreground">
              {offerte && (
                <>
                  <span>{offerte.offerteNummer}</span>
                  <CopyButton value={offerte.offerteNummer} label="Kopieer offertenummer" />
                  <span>&middot; {klantNaam(offerte.klant)} &middot;</span>
                </>
              )}
              <span>Aangemaakt {formatDate(project.createdAt)}</span>
            </div>
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

        {/* Modules — de pills Planning/Uitvoering zíjn de voortgangscards
            (WS6-fusie): geen aparte rij met dezelfde getallen erboven. */}
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
          geschatteDagen={voorcalculatie?.geschatteDagen ?? null}
          teamGrootte={voorcalculatie?.teamGrootte ?? null}
        />

        {/* Klantthread bij dit werkitem (§3.1) — visueel onmiskenbaar
            anders dan interne threads; composer standaard intern */}
        {project.klantId && (
          <div className="max-w-2xl space-y-2">
            <h2 className="text-sm font-medium">Klantgesprek</h2>
            <KlantThreadPaneel
              klantId={project.klantId}
              werkitemId={projectId}
            />
          </div>
        )}
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
