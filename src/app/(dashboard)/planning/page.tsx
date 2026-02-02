"use client";

import { useMemo, Suspense } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { useQuery } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Separator } from "@/components/ui/separator";
import { SidebarTrigger } from "@/components/ui/sidebar";
import {
  Calendar,
  Loader2,
  FolderKanban,
  ChevronRight,
  Clock,
  Users,
  CalendarDays,
  Play,
  CheckCircle2,
  ClipboardCheck,
} from "lucide-react";
import { useCurrentUser } from "@/hooks/use-current-user";
import { useIsAdmin } from "@/hooks/use-users";

// Project status configuration
const statusConfig = {
  gepland: {
    label: "Gepland",
    icon: Calendar,
    color: "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-400",
    borderColor: "border-blue-200 dark:border-blue-800",
  },
  in_uitvoering: {
    label: "In Uitvoering",
    icon: Play,
    color: "bg-orange-100 text-orange-700 dark:bg-orange-950 dark:text-orange-400",
    borderColor: "border-orange-200 dark:border-orange-800",
  },
  afgerond: {
    label: "Afgerond",
    icon: CheckCircle2,
    color: "bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-400",
    borderColor: "border-green-200 dark:border-green-800",
  },
  nacalculatie_compleet: {
    label: "Nacalculatie",
    icon: ClipboardCheck,
    color: "bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-purple-400",
    borderColor: "border-purple-200 dark:border-purple-800",
  },
  gefactureerd: {
    label: "Gefactureerd",
    icon: CheckCircle2,
    color: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400",
    borderColor: "border-emerald-200 dark:border-emerald-800",
  },
  voorcalculatie: {
    label: "Voorcalculatie",
    icon: Calendar,
    color: "bg-slate-100 text-slate-700 dark:bg-slate-950 dark:text-slate-400",
    borderColor: "border-slate-200 dark:border-slate-800",
  },
} as const;

type ProjectStatus = keyof typeof statusConfig;

// Type for project from API
interface ProjectVoortgang {
  projectId: string;
  projectNaam: string;
  klantNaam: string;
  klantAdres: string;
  type: string;
  status: string;
  statusLabel: string;
  createdAt: number;
  geplandeUren: number;
  gewerktUren: number;
  voortgangPercentage: number;
  resterendeUren: number;
  totaalTaken: number;
  afgerondeTaken: number;
  taakVoortgang: number;
  dagenSindsStart: number;
  geschatteDagen: number;
  dagenOver: number | null;
  teamleden: string[];
  laatsteActiviteit: string | null;
}

// Helper to get week number
function getWeekNumber(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
}

// Helper to get Monday of a week
function getMondayOfWeek(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  return new Date(d.setDate(diff));
}

// Status badge component
function StatusBadge({ status }: { status: string }) {
  const config = statusConfig[status as ProjectStatus] || statusConfig.gepland;
  const Icon = config.icon;

  return (
    <Badge variant="outline" className={config.color}>
      <Icon className="h-3 w-3 mr-1" />
      {config.label}
    </Badge>
  );
}

// Project card component
function ProjectCard({ project }: { project: ProjectVoortgang }) {
  const config = statusConfig[project.status as ProjectStatus] || statusConfig.gepland;
  const progressValue = project.taakVoortgang;

  return (
    <Link href={`/projecten/${project.projectId}/planning`} className="block group">
      <Card className={`transition-all hover:shadow-md hover:${config.borderColor}`}>
        <CardContent className="p-4">
          <div className="flex items-start justify-between gap-3 mb-3">
            <div className="flex items-center gap-3 min-w-0">
              <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${config.color}`}>
                <FolderKanban className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <h3 className="font-medium text-sm truncate group-hover:text-primary transition-colors">
                  {project.projectNaam}
                </h3>
                {project.klantNaam && (
                  <p className="text-xs text-muted-foreground truncate">{project.klantNaam}</p>
                )}
              </div>
            </div>
            <StatusBadge status={project.status} />
          </div>

          {/* Progress */}
          <div className="space-y-2 mb-3">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>Voortgang</span>
              <span className="font-medium">{progressValue}%</span>
            </div>
            <Progress value={progressValue} className="h-1.5" />
          </div>

          {/* Stats row */}
          <div className="flex items-center gap-4 text-xs text-muted-foreground">
            {project.teamleden && project.teamleden.length > 0 && (
              <div className="flex items-center gap-1">
                <Users className="h-3.5 w-3.5" />
                <span>{project.teamleden.length}</span>
              </div>
            )}
            {project.geschatteDagen > 0 && (
              <div className="flex items-center gap-1">
                <CalendarDays className="h-3.5 w-3.5" />
                <span>{project.geschatteDagen.toFixed(1)}d</span>
              </div>
            )}
            <div className="flex items-center gap-1">
              <Clock className="h-3.5 w-3.5" />
              <span>{project.gewerktUren.toFixed(1)}u</span>
            </div>
          </div>

          {/* Team members */}
          {project.teamleden && project.teamleden.length > 0 && (
            <div className="mt-2 text-xs text-muted-foreground truncate">
              {project.teamleden.slice(0, 2).join(", ")}
              {project.teamleden.length > 2 && ` +${project.teamleden.length - 2}`}
            </div>
          )}

          {/* View planning link */}
          <div className="mt-3 pt-3 border-t flex items-center justify-between">
            <span className="text-xs text-muted-foreground">
              {project.totaalTaken} taken
            </span>
            <span className="text-xs text-primary flex items-center gap-1 group-hover:underline">
              Bekijk planning
              <ChevronRight className="h-3 w-3" />
            </span>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}

// Week section component
function WeekSection({
  weekLabel,
  projects,
}: {
  weekLabel: string;
  projects: ProjectVoortgang[];
}) {
  return (
    <div className="space-y-3">
      <h3 className="text-sm font-medium text-muted-foreground flex items-center gap-2">
        <Calendar className="h-4 w-4" />
        {weekLabel}
        <Badge variant="secondary" className="ml-1">
          {projects.length}
        </Badge>
      </h3>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {projects.map((project) => (
          <ProjectCard key={project.projectId} project={project} />
        ))}
      </div>
    </div>
  );
}

export default function PlanningPage() {
  return (
    <Suspense fallback={<PlanningPageLoader />}>
      <PlanningPageContent />
    </Suspense>
  );
}

function PlanningPageLoader() {
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
              <BreadcrumbPage>Planning</BreadcrumbPage>
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

function PlanningPageContent() {
  const { user, isLoading: isUserLoading } = useCurrentUser();
  const isAdmin = useIsAdmin();

  // Fetch project details including voorcalculatie and planning data
  const projectVoortgangData = useQuery(
    api.projectRapportages.getProjectVoortgang,
    user?._id ? { alleenActief: true } : "skip"
  );

  // Get current user's name for medewerker filtering
  const medewerkerNaam = user?.name ?? null;

  // Get projects from the API response
  const projectsList: ProjectVoortgang[] = useMemo(() => {
    if (!projectVoortgangData?.projecten) return [];
    return projectVoortgangData.projecten;
  }, [projectVoortgangData]);

  // Filter projects for medewerkers - only show projects they're assigned to
  const filteredProjects = useMemo(() => {
    if (isAdmin) {
      // Admins see all active projects (gepland, in_uitvoering)
      return projectsList.filter(
        (p) => p.status === "gepland" || p.status === "in_uitvoering"
      );
    }

    // For medewerkers, filter to only their assigned projects
    if (!medewerkerNaam) {
      return [];
    }

    return projectsList.filter((p) => {
      // Check if medewerker is in the team
      const isInTeam = p.teamleden?.some(
        (naam) => naam.toLowerCase() === medewerkerNaam.toLowerCase()
      );
      // Only show active projects
      const isActive = p.status === "gepland" || p.status === "in_uitvoering";
      return isInTeam && isActive;
    });
  }, [projectsList, isAdmin, medewerkerNaam]);

  // Group projects by week based on creation date
  const projectsByWeek = useMemo(() => {
    const now = new Date();
    const currentWeek = getWeekNumber(now);
    const currentYear = now.getFullYear();

    const groups: Record<string, { label: string; projects: ProjectVoortgang[]; sortKey: number }> = {};

    for (const project of filteredProjects) {
      const projectDate = new Date(project.createdAt);
      const projectWeek = getWeekNumber(projectDate);
      const projectYear = projectDate.getFullYear();

      let label: string;
      let sortKey: number;

      if (projectYear === currentYear && projectWeek === currentWeek) {
        label = "Deze week";
        sortKey = 0;
      } else if (projectYear === currentYear && projectWeek === currentWeek + 1) {
        label = "Volgende week";
        sortKey = 1;
      } else if (projectYear === currentYear && projectWeek === currentWeek - 1) {
        label = "Vorige week";
        sortKey = -1;
      } else {
        const monday = getMondayOfWeek(projectDate);
        label = `Week ${projectWeek} - ${monday.toLocaleDateString("nl-NL", { day: "numeric", month: "short" })}`;
        sortKey = (projectYear - currentYear) * 100 + (projectWeek - currentWeek);
      }

      const key = `${projectYear}-${projectWeek}`;
      if (!groups[key]) {
        groups[key] = { label, projects: [], sortKey };
      }
      groups[key].projects.push(project);
    }

    // Sort groups by sortKey (this week first, then future weeks, then past weeks)
    return Object.values(groups).sort((a, b) => a.sortKey - b.sortKey);
  }, [filteredProjects]);

  // Stats for quick overview
  const stats = useMemo(() => {
    const gepland = filteredProjects.filter((p) => p.status === "gepland").length;
    const inUitvoering = filteredProjects.filter((p) => p.status === "in_uitvoering").length;
    const totaal = filteredProjects.length;
    return { gepland, inUitvoering, totaal };
  }, [filteredProjects]);

  const isLoading = isUserLoading || projectVoortgangData === undefined;

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
              <BreadcrumbPage>Planning</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>
      </header>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: "easeOut" }}
        className="flex flex-1 flex-col gap-6 p-4 md:gap-8 md:p-8"
      >
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.1 }}
          className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4"
        >
          <div>
            <h1 className="text-2xl font-bold tracking-tight md:text-3xl">
              Planning Overzicht
            </h1>
            <p className="text-muted-foreground">
              {isAdmin
                ? "Overzicht van alle actieve projecten en hun planningen"
                : "Jouw toegewezen projecten en planningen"}
            </p>
          </div>
          {isAdmin && (
            <Button asChild>
              <Link href="/projecten">
                <FolderKanban className="mr-2 h-4 w-4" />
                Alle Projecten
              </Link>
            </Button>
          )}
        </motion.div>

        {/* Stats Cards */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.15 }}
          className="grid gap-4 sm:grid-cols-3"
        >
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-2xl font-bold">{stats.totaal}</p>
                  <p className="text-xs text-muted-foreground">Actieve Projecten</p>
                </div>
                <div className="h-10 w-10 rounded-full flex items-center justify-center bg-primary/10">
                  <FolderKanban className="h-5 w-5 text-primary" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-2xl font-bold">{stats.gepland}</p>
                  <p className="text-xs text-muted-foreground">Gepland</p>
                </div>
                <div className="h-10 w-10 rounded-full flex items-center justify-center bg-blue-100 dark:bg-blue-950">
                  <Calendar className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-2xl font-bold">{stats.inUitvoering}</p>
                  <p className="text-xs text-muted-foreground">In Uitvoering</p>
                </div>
                <div className="h-10 w-10 rounded-full flex items-center justify-center bg-orange-100 dark:bg-orange-950">
                  <Play className="h-5 w-5 text-orange-600 dark:text-orange-400" />
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Projects by Week */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.2 }}
          className="space-y-6"
        >
          {isLoading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : filteredProjects.length === 0 ? (
            <Card className="p-8">
              <div className="text-center">
                <FolderKanban className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
                <h3 className="font-medium text-muted-foreground">
                  {isAdmin
                    ? "Geen actieve projecten"
                    : "Geen projecten toegewezen"}
                </h3>
                <p className="text-sm text-muted-foreground/80 mt-1">
                  {isAdmin
                    ? "Er zijn momenteel geen projecten in de planning of uitvoering"
                    : "Je bent nog niet toegewezen aan een project"}
                </p>
                {isAdmin && (
                  <Button asChild className="mt-4">
                    <Link href="/projecten">
                      Bekijk alle projecten
                    </Link>
                  </Button>
                )}
              </div>
            </Card>
          ) : (
            <>
              {projectsByWeek.map((group) => (
                <WeekSection
                  key={group.label}
                  weekLabel={group.label}
                  projects={group.projects}
                />
              ))}
            </>
          )}
        </motion.div>

        {/* Quick legend */}
        {filteredProjects.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.25 }}
          >
            <Card className="p-4">
              <div className="flex flex-wrap items-center gap-4 text-sm">
                <span className="text-muted-foreground font-medium">Status:</span>
                {Object.entries(statusConfig)
                  .filter(([key]) => key === "gepland" || key === "in_uitvoering")
                  .map(([key, config]) => (
                    <div key={key} className="flex items-center gap-1.5">
                      <div className={`h-2 w-2 rounded-full ${config.color}`} />
                      <span className="text-muted-foreground">{config.label}</span>
                    </div>
                  ))}
              </div>
            </Card>
          </motion.div>
        )}
      </motion.div>
    </>
  );
}
