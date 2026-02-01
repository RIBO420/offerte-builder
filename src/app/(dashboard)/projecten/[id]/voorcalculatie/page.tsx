"use client";

import { use } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { useReducedMotion } from "@/hooks/use-accessibility";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
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
  ArrowLeft,
  Loader2,
  Calculator,
  FolderKanban,
  FileText,
  ExternalLink,
  Users,
  Clock,
  Calendar,
  Info,
} from "lucide-react";
import { useProjectVoorcalculatie } from "@/hooks/use-voorcalculatie";
import { UrenOverzicht } from "@/components/project/uren-overzicht";
import { ProjectProgressStepper, type ProjectStatus } from "@/components/project/project-progress-stepper";
import { Id } from "../../../../../../convex/_generated/dataModel";

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
  const reducedMotion = useReducedMotion();

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
        <header className="flex h-16 shrink-0 items-center gap-2 border-b px-4">
          <SidebarTrigger className="-ml-1" />
          <Separator orientation="vertical" className="mr-2 h-4" />
          <Breadcrumb>
            <BreadcrumbList>
              <BreadcrumbItem>
                <BreadcrumbLink href="/dashboard">Dashboard</BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                <BreadcrumbLink href="/projecten">Projecten</BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                <BreadcrumbPage>Laden...</BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
        </header>
        <div className="flex flex-1 items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </>
    );
  }

  if (!project || !offerte) {
    return (
      <>
        <header className="flex h-16 shrink-0 items-center gap-2 border-b px-4">
          <SidebarTrigger className="-ml-1" />
          <Separator orientation="vertical" className="mr-2 h-4" />
          <Breadcrumb>
            <BreadcrumbList>
              <BreadcrumbItem>
                <BreadcrumbLink href="/dashboard">Dashboard</BreadcrumbLink>
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
      <header className="flex h-16 shrink-0 items-center gap-2 border-b px-4">
        <SidebarTrigger className="-ml-1" />
        <Separator orientation="vertical" className="mr-2 h-4" />
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink href="/dashboard">Dashboard</BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbLink href="/projecten">Projecten</BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbLink href={`/projecten/${id}`}>
                {project.naam}
              </BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbPage>Voorcalculatie</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>
      </header>

      <motion.div
        initial={reducedMotion ? false : { opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: reducedMotion ? 0 : 0.5, ease: "easeOut" }}
        className="flex flex-1 flex-col gap-6 p-4 md:gap-8 md:p-8"
      >
        {/* Header */}
        <motion.div
          initial={reducedMotion ? false : { opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{
            duration: reducedMotion ? 0 : 0.4,
            delay: reducedMotion ? 0 : 0.1,
          }}
          className="flex items-center justify-between"
        >
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" asChild>
              <Link href={`/projecten/${id}`}>
                <ArrowLeft className="h-4 w-4" />
              </Link>
            </Button>
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-blue-100 dark:bg-blue-950 flex items-center justify-center">
                <Calculator className="h-5 w-5 text-blue-700 dark:text-blue-400" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-2xl font-bold tracking-tight">
                    Voorcalculatie
                  </h1>
                  <Badge variant="outline" className="text-xs">
                    Referentie
                  </Badge>
                </div>
                <p className="text-muted-foreground">
                  {project.naam} - {offerte.offerteNummer}
                </p>
              </div>
            </div>
          </div>

          <Button asChild variant="outline">
            <Link href={`/offertes/${offerte._id}`}>
              <FileText className="mr-2 h-4 w-4" />
              Bekijk Offerte
              <ExternalLink className="ml-2 h-3 w-3" />
            </Link>
          </Button>
        </motion.div>

        {/* Info Banner */}
        <motion.div
          initial={reducedMotion ? false : { opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{
            duration: reducedMotion ? 0 : 0.4,
            delay: reducedMotion ? 0 : 0.15,
          }}
        >
          <Card className="bg-blue-50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-800">
            <CardContent className="flex items-start gap-3 py-4">
              <Info className="h-5 w-5 text-blue-600 dark:text-blue-400 mt-0.5 shrink-0" />
              <div>
                <p className="font-medium text-blue-900 dark:text-blue-100">
                  Voorcalculatie uit offerte
                </p>
                <p className="text-sm text-blue-700 dark:text-blue-300 mt-1">
                  De voorcalculatie wordt beheerd in de offerte. Deze pagina toont de gegevens
                  als referentie voor het project. Wijzigingen kunnen worden aangebracht in de
                  offerte zelf.
                </p>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Progress Stepper - Shows actual project status from database */}
        <Card className="p-4 md:p-6">
          <ProjectProgressStepper
            projectId={id}
            projectStatus={project.status as ProjectStatus}
            hasPlanning={false}
            hasUrenRegistraties={false}
            hasNacalculatie={false}
          />
        </Card>

        {/* Main Content */}
        {voorcalculatie ? (
          <>
            {/* Summary Stats */}
            <motion.div
              initial={reducedMotion ? false : { opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{
                duration: reducedMotion ? 0 : 0.4,
                delay: reducedMotion ? 0 : 0.2,
              }}
              className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4"
            >
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
            </motion.div>

            {/* Uren Overzicht */}
            <motion.div
              initial={reducedMotion ? false : { opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{
                duration: reducedMotion ? 0 : 0.4,
                delay: reducedMotion ? 0 : 0.3,
              }}
            >
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
            </motion.div>
          </>
        ) : (
          <motion.div
            initial={reducedMotion ? false : { opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{
              duration: reducedMotion ? 0 : 0.4,
              delay: reducedMotion ? 0 : 0.2,
            }}
          >
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
          </motion.div>
        )}
      </motion.div>
    </>
  );
}
