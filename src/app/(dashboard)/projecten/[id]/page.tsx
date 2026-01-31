"use client";

import { use } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQuery } from "convex/react";
import { api } from "../../../../../convex/_generated/api";
import { Id } from "../../../../../convex/_generated/dataModel";
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
  ArrowLeft,
  Loader2,
  Calendar,
  Clock,
  Users,
  ListTodo,
  ClipboardCheck,
  FileText,
  ChevronRight,
  Calculator,
} from "lucide-react";
import { ProjectProgressStepper, type ProjectStatus } from "@/components/project/project-progress-stepper";

// Project status colors - voorcalculatie is now at offerte level
const statusColors: Record<string, string> = {
  gepland: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-100",
  in_uitvoering: "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-100",
  afgerond: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100",
  nacalculatie_compleet: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-100",
};

// Project status labels - voorcalculatie is now at offerte level
const statusLabels: Record<string, string> = {
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

  // Get project with all details
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

  // Calculate planning progress
  const planningVoortgang = planningTaken.length > 0
    ? Math.round((planningTaken.filter((t) => t.status === "afgerond").length / planningTaken.length) * 100)
    : 0;

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

      <div className="flex flex-1 flex-col gap-6 p-4 md:gap-8 md:p-8">
        {/* Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" asChild>
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
              <p className="text-muted-foreground">
                Aangemaakt op {formatDate(project.createdAt)}
              </p>
            </div>
          </div>
        </div>

        {/* Project Progress Stepper */}
        <Card className="p-4 md:p-6">
          <ProjectProgressStepper
            projectId={id}
            currentStatus={project.status as ProjectStatus}
            hasPlanning={planningTaken.length > 0}
            hasUrenRegistraties={projectDetails.totaalGeregistreerdeUren > 0}
            hasNacalculatie={!!nacalculatie}
          />
        </Card>

        {/* Quick Stats */}
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="pb-2">
              <CardDescription className="flex items-center gap-1">
                Voorcalculatie
                <span className="text-xs text-muted-foreground/70">(van offerte)</span>
              </CardDescription>
            </CardHeader>
            <CardContent>
              {voorcalculatie ? (
                <div className="space-y-1">
                  <p className="text-2xl font-bold">
                    {voorcalculatie.geschatteDagen.toFixed(1)} dagen
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {voorcalculatie.normUrenTotaal} uur totaal
                  </p>
                </div>
              ) : (
                <p className="text-muted-foreground">Niet beschikbaar</p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Team</CardDescription>
            </CardHeader>
            <CardContent>
              {voorcalculatie ? (
                <div className="flex items-center gap-2">
                  <Users className="h-5 w-5 text-muted-foreground" />
                  <span className="text-2xl font-bold">
                    {voorcalculatie.teamGrootte}
                  </span>
                  <span className="text-muted-foreground">personen</span>
                </div>
              ) : (
                <p className="text-muted-foreground">-</p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Planning</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-2xl font-bold">{planningVoortgang}%</span>
                  <span className="text-sm text-muted-foreground">
                    {planningTaken.filter((t) => t.status === "afgerond").length}/{planningTaken.length} taken
                  </span>
                </div>
                <Progress value={planningVoortgang} className="h-2" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Geregistreerde uren</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <Clock className="h-5 w-5 text-muted-foreground" />
                <span className="text-2xl font-bold">
                  {projectDetails.totaalGeregistreerdeUren.toFixed(1)}
                </span>
                <span className="text-muted-foreground">uur</span>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Module Cards */}
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {/* Voorcalculatie Reference Card - Data comes from offerte */}
          <Card className="hover:shadow-lg transition-shadow bg-muted/30">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calculator className="h-5 w-5" />
                Voorcalculatie
                <Badge variant="outline" className="ml-auto text-xs font-normal">
                  van offerte
                </Badge>
              </CardTitle>
              <CardDescription>
                Uren- en dagenschatting (uit offerte)
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {voorcalculatie ? (
                <div className="grid grid-cols-2 gap-4 text-center">
                  <div>
                    <p className="text-2xl font-bold">
                      {voorcalculatie.geschatteDagen.toFixed(1)}
                    </p>
                    <p className="text-sm text-muted-foreground">dagen</p>
                  </div>
                  <div>
                    <p className="text-2xl font-bold">
                      {voorcalculatie.teamGrootte}
                    </p>
                    <p className="text-sm text-muted-foreground">personen</p>
                  </div>
                </div>
              ) : (
                <div className="text-center py-2">
                  <p className="text-sm text-muted-foreground">
                    Geen voorcalculatie in offerte
                  </p>
                </div>
              )}
              {offerte && (
                <Button asChild variant="outline" className="w-full">
                  <Link href={`/offertes/${offerte._id}`}>
                    Bekijk in Offerte
                    <ChevronRight className="ml-2 h-4 w-4" />
                  </Link>
                </Button>
              )}
            </CardContent>
          </Card>

          {/* Planning Module */}
          <Card className={`hover:shadow-lg transition-shadow ${project.status === 'gepland' ? 'ring-2 ring-primary' : ''}`}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ListTodo className="h-5 w-5" />
                Planning
              </CardTitle>
              <CardDescription>
                Beheer taken en bekijk projectplanning
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>Voortgang</span>
                  <span>{planningVoortgang}%</span>
                </div>
                <Progress value={planningVoortgang} className="h-2" />
              </div>
              <div className="flex justify-between text-sm text-muted-foreground">
                <span>{planningTaken.length} taken</span>
                <span>
                  {planningTaken.filter((t) => t.status === "afgerond").length} afgerond
                </span>
              </div>
              {project.status === 'gepland' && planningTaken.length === 0 && (
                <p className="text-xs text-primary font-medium text-center">
                  Start hier met planning
                </p>
              )}
              <Button asChild className="w-full" variant={project.status === 'gepland' ? 'default' : 'outline'}>
                <Link href={`/projecten/${id}/planning`}>
                  Naar Planning
                  <ChevronRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
            </CardContent>
          </Card>

          {/* Uren Registratie Module */}
          <Card className={`hover:shadow-lg transition-shadow ${project.status === 'in_uitvoering' ? 'ring-2 ring-primary' : ''}`}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="h-5 w-5" />
                Uren Registratie
              </CardTitle>
              <CardDescription>
                Registreer en importeer gewerkte uren
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4 text-center">
                <div>
                  <p className="text-2xl font-bold">
                    {projectDetails.totaalGeregistreerdeUren.toFixed(1)}
                  </p>
                  <p className="text-sm text-muted-foreground">Geregistreerd</p>
                </div>
                <div>
                  <p className="text-2xl font-bold">
                    {voorcalculatie?.normUrenTotaal?.toFixed(1) || "-"}
                  </p>
                  <p className="text-sm text-muted-foreground">Begroot</p>
                </div>
              </div>
              <Button asChild variant="outline" className="w-full">
                <Link href={`/projecten/${id}/uitvoering`}>
                  Naar Uitvoering
                  <ChevronRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
            </CardContent>
          </Card>

          {/* Nacalculatie Module */}
          <Card className={`hover:shadow-lg transition-shadow ${project.status === 'afgerond' || project.status === 'nacalculatie_compleet' ? 'ring-2 ring-primary' : ''}`}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ClipboardCheck className="h-5 w-5" />
                Nacalculatie
              </CardTitle>
              <CardDescription>
                Vergelijk werkelijk vs. begroot
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {nacalculatie ? (
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Afwijking uren</span>
                    <span
                      className={
                        nacalculatie.afwijkingPercentage > 0
                          ? "text-red-600"
                          : nacalculatie.afwijkingPercentage < 0
                            ? "text-green-600"
                            : ""
                      }
                    >
                      {nacalculatie.afwijkingPercentage > 0 ? "+" : ""}
                      {nacalculatie.afwijkingPercentage.toFixed(1)}%
                    </span>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Nog geen nacalculatie beschikbaar
                </p>
              )}
              <Button asChild variant="outline" className="w-full">
                <Link href={`/projecten/${id}/nacalculatie`}>
                  Naar Nacalculatie
                  <ChevronRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Linked Offerte */}
        {offerte && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Gekoppelde Offerte
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">{offerte.offerteNummer}</p>
                  <p className="text-sm text-muted-foreground">
                    {offerte.klant.naam} - {offerte.type}
                  </p>
                </div>
                <Button asChild variant="outline">
                  <Link href={`/offertes/${offerte._id}`}>
                    Bekijk Offerte
                  </Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </>
  );
}
