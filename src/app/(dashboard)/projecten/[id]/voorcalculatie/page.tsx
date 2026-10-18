"use client";

import { use } from "react";
import Link from "next/link";
import { PaginaReveal } from "@/components/pagina-reveal";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Calculator,
  FolderKanban,
  FileText,
  ExternalLink,
  Users,
  Clock,
  Calendar,
  Info,
} from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { useProjectVoorcalculatie } from "@/hooks/use-voorcalculatie";
import { UrenOverzicht } from "@/components/project/uren-overzicht";
import { ProjectKop } from "@/components/project/project-kop";
import { Id } from "../../../../../../convex/_generated/dataModel";
import { LaadIndicator } from "@/components/ui/laad-indicator";

/**
 * VoorcalculatiePage - Read-only reference view
 *
 * In the new workflow, voorcalculatie is created at the offerte level.
 * This page shows the voorcalculatie data as a reference for the project.
 */
export default function VoorcalculatiePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);

  const {
    project,
    offerte,
    voorcalculatie,
    calculation,
    isLoading,
  } = useProjectVoorcalculatie(id as Id<"projecten">);

  if (isLoading) {
    return (
      <>
        <PageHeader customLabels={{ [`/projecten/${id}/voorcalculatie`]: "Laden..." }} />
        <div className="flex flex-1 items-center justify-center">
          <LaadIndicator formaat="pagina" />
        </div>
      </>
    );
  }

  if (!project || !offerte) {
    return (
      <>
        <PageHeader customLabels={{ [`/projecten/${id}/voorcalculatie`]: "Niet gevonden" }} />

        <div className="flex flex-1 flex-col gap-6 p-4 md:gap-8 md:p-8">
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <FolderKanban className="h-12 w-12 text-muted-foreground/50" />
              <h3 className="mt-4 text-lg font-semibold">
                Project niet gevonden
              </h3>
              <p className="mt-2 text-sm text-muted-foreground">
                Het project bestaat niet of je hebt geen toegang.
              </p>
              <Button asChild className="mt-4">
                <Link href="/projecten">Terug naar Projecten</Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      </>
    );
  }

  return (
    <>
      <PageHeader customLabels={{ [`/projecten/${id}`]: project.naam }} />

      {/* Eén reveal op de buitenkant; de blokken eronder zijn gewone divs en
          staan er dus ook als er nul animatieframes vallen.
          → src/components/pagina-reveal.tsx */}
      <PaginaReveal className="flex flex-1 flex-col gap-6 p-4 md:gap-8 md:p-8">
        <ProjectKop
          projectId={id}
          actief="voorcalculatie"
          acties={
            <Button asChild variant="outline">
              <Link href={`/offertes/${offerte._id}`}>
                <FileText className="mr-2 h-4 w-4" />
                Bekijk offerte
                <ExternalLink className="ml-2 h-3 w-3" />
              </Link>
            </Button>
          }
        />

        {/* Uitleg: deze pagina is naslag, de bron is de offerte. */}
        <div className="flex items-start gap-3 rounded-lg border border-status-voorcalculatie-border bg-status-voorcalculatie px-4 py-3">
          <Info className="mt-0.5 h-4 w-4 shrink-0 text-status-voorcalculatie-text" aria-hidden="true" />
          <p className="text-sm">
            <span className="font-medium">Voorcalculatie uit de offerte.</span>{" "}
            <span className="text-status-voorcalculatie-text">
              Deze pagina is naslag voor het project; wijzigen doe je in de offerte zelf.
            </span>
          </p>
        </div>

        {/* Main Content */}
        {voorcalculatie ? (
          <>
            {/* Summary Stats */}
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-full bg-blue-100 dark:bg-blue-950 flex items-center justify-center">
                      <Clock className="h-5 w-5 text-blue-700 dark:text-blue-400" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold">{voorcalculatie.normUrenTotaal}</p>
                      <p className="text-sm text-muted-foreground">Normuren totaal</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-full bg-green-100 dark:bg-green-950 flex items-center justify-center">
                      <Calendar className="h-5 w-5 text-green-700 dark:text-green-400" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold">{voorcalculatie.geschatteDagen.toFixed(1)}</p>
                      <p className="text-sm text-muted-foreground">Geschatte dagen</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-full bg-purple-100 dark:bg-purple-950 flex items-center justify-center">
                      <Users className="h-5 w-5 text-purple-700 dark:text-purple-400" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold">{voorcalculatie.teamGrootte}</p>
                      <p className="text-sm text-muted-foreground">Team grootte</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-full bg-orange-100 dark:bg-orange-950 flex items-center justify-center">
                      <Clock className="h-5 w-5 text-orange-700 dark:text-orange-400" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold">{voorcalculatie.effectieveUrenPerDag}</p>
                      <p className="text-sm text-muted-foreground">Uur/dag effectief</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Uren Overzicht */}
            <div>
              {calculation ? (
                <UrenOverzicht
                  normUrenPerScope={calculation.normUrenPerScope}
                  normUrenTotaal={calculation.normUrenTotaal}
                  geschatteDagen={voorcalculatie.geschatteDagen}
                  bereikbaarheidFactor={calculation.bereikbaarheidFactor}
                  achterstallijkheidFactor={calculation.achterstallijkheidFactor}
                />
              ) : (
                <Card>
                  <CardHeader>
                    <CardTitle>Uren per Scope</CardTitle>
                    <CardDescription>Berekende normuren uit de offerte</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <p className="text-muted-foreground">
                      Geen gedetailleerde urenberekening beschikbaar.
                    </p>
                  </CardContent>
                </Card>
              )}
            </div>
          </>
        ) : (
          <div>
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-16">
                <Calculator className="h-12 w-12 text-muted-foreground/50" />
                <h3 className="mt-4 text-lg font-semibold">
                  Geen voorcalculatie beschikbaar
                </h3>
                <p className="mt-2 text-sm text-muted-foreground text-center max-w-md">
                  De offerte voor dit project heeft geen voorcalculatie.
                  Ga naar de offerte om een voorcalculatie toe te voegen.
                </p>
                <Button asChild className="mt-4">
                  <Link href={`/offertes/${offerte._id}`}>
                    <FileText className="mr-2 h-4 w-4" />
                    Naar Offerte
                  </Link>
                </Button>
              </CardContent>
            </Card>
          </div>
        )}
      </PaginaReveal>
    </>
  );
}
