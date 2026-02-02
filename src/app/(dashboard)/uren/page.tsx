"use client";

import { useState, useMemo, useCallback } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { useQuery } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { useCurrentUser } from "@/hooks/use-current-user";
import { useIsAdmin } from "@/hooks/use-users";
import { useReducedMotion } from "@/hooks/use-accessibility";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ScrollableTable } from "@/components/ui/responsive-table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Clock,
  Calendar,
  CalendarDays,
  Search,
  Loader2,
  FolderKanban,
  User,
  ExternalLink,
  TrendingUp,
  Filter,
} from "lucide-react";

// Animation variants
const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1,
    },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.4,
    },
  },
};

// Format date for display
function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return new Intl.DateTimeFormat("nl-NL", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(date);
}

// Format hours with 1 decimal
function formatHours(hours: number): string {
  return hours.toFixed(1).replace(".", ",");
}

// Get date string for today
function getTodayStr(): string {
  return new Date().toISOString().split("T")[0];
}

// Get date string for N days ago
function getDaysAgoStr(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date.toISOString().split("T")[0];
}

type DateRangePreset = "week" | "month" | "quarter" | "year" | "all";

export default function UrenPage() {
  const reducedMotion = useReducedMotion();
  const { user, isLoading: isUserLoading } = useCurrentUser();
  const isAdmin = useIsAdmin();

  // State
  const [searchTerm, setSearchTerm] = useState("");
  const [dateRange, setDateRange] = useState<DateRangePreset>("month");
  const [projectFilter, setProjectFilter] = useState<string>("all");
  const [medewerkerFilter, setMedewerkerFilter] = useState<string>("all");

  // Calculate date range based on preset
  const { startDate, endDate } = useMemo(() => {
    const end = getTodayStr();
    let start: string | undefined;

    switch (dateRange) {
      case "week":
        start = getDaysAgoStr(7);
        break;
      case "month":
        start = getDaysAgoStr(30);
        break;
      case "quarter":
        start = getDaysAgoStr(90);
        break;
      case "year":
        start = getDaysAgoStr(365);
        break;
      case "all":
      default:
        start = undefined;
    }

    return { startDate: start, endDate: end };
  }, [dateRange]);

  // Query data
  const urenData = useQuery(
    api.urenRegistraties.listGlobal,
    user?._id ? { startDate, endDate } : "skip"
  );

  const statsData = useQuery(
    api.urenRegistraties.getGlobalStats,
    user?._id ? {} : "skip"
  );

  const isLoading = isUserLoading || urenData === undefined || statsData === undefined;

  // Get unique medewerkers and projects for filters
  const { uniqueMedewerkers, uniqueProjects } = useMemo(() => {
    if (!urenData) return { uniqueMedewerkers: [], uniqueProjects: [] };

    const medewerkers = [...new Set(urenData.map((u) => u.medewerker))].sort();
    const projects = [...new Set(urenData.map((u) => u.projectNaam))].sort();

    return { uniqueMedewerkers: medewerkers, uniqueProjects: projects };
  }, [urenData]);

  // Filter entries
  const filteredEntries = useMemo(() => {
    if (!urenData) return [];

    return urenData.filter((entry) => {
      // Search filter
      if (searchTerm) {
        const term = searchTerm.toLowerCase();
        const matchesSearch =
          entry.medewerker.toLowerCase().includes(term) ||
          entry.projectNaam.toLowerCase().includes(term) ||
          entry.scope?.toLowerCase().includes(term) ||
          entry.notities?.toLowerCase().includes(term);
        if (!matchesSearch) return false;
      }

      // Project filter
      if (projectFilter !== "all" && entry.projectNaam !== projectFilter) {
        return false;
      }

      // Medewerker filter (admin only)
      if (isAdmin && medewerkerFilter !== "all" && entry.medewerker !== medewerkerFilter) {
        return false;
      }

      return true;
    });
  }, [urenData, searchTerm, projectFilter, medewerkerFilter, isAdmin]);

  // Sort entries by date (most recent first)
  const sortedEntries = useMemo(() => {
    return [...filteredEntries].sort((a, b) => b.datum.localeCompare(a.datum));
  }, [filteredEntries]);

  // Calculate filtered totals
  const filteredTotals = useMemo(() => {
    const total = sortedEntries.reduce((sum, e) => sum + e.uren, 0);
    return Math.round(total * 10) / 10;
  }, [sortedEntries]);

  const handleClearFilters = useCallback(() => {
    setSearchTerm("");
    setProjectFilter("all");
    setMedewerkerFilter("all");
    setDateRange("month");
  }, []);

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
                <BreadcrumbPage>Uren</BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
        </header>
        <div className="flex flex-1 items-center justify-center">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="flex flex-col items-center gap-4"
          >
            <div className="relative">
              <div className="absolute inset-0 bg-emerald-500/20 blur-xl rounded-full" />
              <div className="relative flex h-16 w-16 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500 to-green-600">
                <Loader2 className="h-8 w-8 animate-spin text-white" />
              </div>
            </div>
            <p className="text-muted-foreground animate-pulse">Laden...</p>
          </motion.div>
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
              <BreadcrumbPage>Uren</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>
      </header>

      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        className="flex flex-1 flex-col gap-6 p-4 md:gap-8 md:p-8"
      >
        {/* Page Header */}
        <motion.div variants={itemVariants} className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight md:text-3xl">
              Uren Overzicht
            </h1>
            <p className="text-muted-foreground">
              {isAdmin
                ? "Bekijk alle geregistreerde uren per project en medewerker"
                : "Bekijk je geregistreerde uren"}
            </p>
          </div>
        </motion.div>

        {/* Stats Cards */}
        <motion.div variants={itemVariants} className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Deze Week</CardTitle>
              <Calendar className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {formatHours(statsData?.urenDezeWeek || 0)}
              </div>
              <p className="text-xs text-muted-foreground">uren geregistreerd</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Deze Maand</CardTitle>
              <CalendarDays className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {formatHours(statsData?.urenDezeMaand || 0)}
              </div>
              <p className="text-xs text-muted-foreground">uren geregistreerd</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Totaal</CardTitle>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {formatHours(statsData?.urenTotaal || 0)}
              </div>
              <p className="text-xs text-muted-foreground">uren totaal</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Registraties</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {statsData?.aantalRegistraties || 0}
              </div>
              <p className="text-xs text-muted-foreground">uren entries</p>
            </CardContent>
          </Card>
        </motion.div>

        {/* Hours per Project */}
        {statsData?.perProject && statsData.perProject.length > 0 && (
          <motion.div variants={itemVariants}>
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FolderKanban className="h-5 w-5" />
                  Uren per Project
                </CardTitle>
                <CardDescription>
                  Top {Math.min(5, statsData.perProject.length)} projecten op basis van geregistreerde uren
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {statsData.perProject.slice(0, 5).map((project) => {
                    const percentage =
                      statsData.urenTotaal > 0
                        ? (project.uren / statsData.urenTotaal) * 100
                        : 0;
                    return (
                      <div key={project.projectId} className="space-y-1">
                        <div className="flex items-center justify-between text-sm">
                          <span className="font-medium truncate max-w-[200px]" title={project.projectNaam}>
                            {project.projectNaam}
                          </span>
                          <span className="text-muted-foreground">
                            {formatHours(project.uren)} uur ({percentage.toFixed(0)}%)
                          </span>
                        </div>
                        <div className="h-2 rounded-full bg-muted overflow-hidden">
                          <div
                            className="h-full bg-primary rounded-full transition-all"
                            style={{ width: `${percentage}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}

        {/* Hours per Medewerker (Admin only) */}
        {isAdmin && statsData?.perMedewerker && statsData.perMedewerker.length > 0 && (
          <motion.div variants={itemVariants}>
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <User className="h-5 w-5" />
                  Uren per Medewerker
                </CardTitle>
                <CardDescription>
                  Overzicht van geregistreerde uren per teamlid
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {statsData.perMedewerker.map((medewerker) => (
                    <div
                      key={medewerker.naam}
                      className="flex items-center justify-between rounded-lg border p-3"
                    >
                      <div className="flex items-center gap-2">
                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10">
                          <User className="h-4 w-4 text-primary" />
                        </div>
                        <span className="font-medium">{medewerker.naam}</span>
                      </div>
                      <Badge variant="secondary">
                        {formatHours(medewerker.uren)} uur
                      </Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}

        {/* Filters and Table */}
        <motion.div variants={itemVariants}>
          <Card>
            <CardHeader>
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Clock className="h-5 w-5" />
                    Uren Registraties
                  </CardTitle>
                  <CardDescription>
                    {sortedEntries.length} registratie{sortedEntries.length !== 1 ? "s" : ""}{" "}
                    ({formatHours(filteredTotals)} uur)
                  </CardDescription>
                </div>

                {/* Filters */}
                <div className="flex flex-wrap items-center gap-2">
                  {/* Search */}
                  <div className="relative w-full sm:w-48">
                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Zoeken..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-8"
                    />
                  </div>

                  {/* Date Range */}
                  <Select
                    value={dateRange}
                    onValueChange={(value) => setDateRange(value as DateRangePreset)}
                  >
                    <SelectTrigger className="w-full sm:w-[140px]">
                      <SelectValue placeholder="Periode" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="week">Afgelopen week</SelectItem>
                      <SelectItem value="month">Afgelopen maand</SelectItem>
                      <SelectItem value="quarter">Afgelopen kwartaal</SelectItem>
                      <SelectItem value="year">Afgelopen jaar</SelectItem>
                      <SelectItem value="all">Alles</SelectItem>
                    </SelectContent>
                  </Select>

                  {/* Project Filter */}
                  <Select value={projectFilter} onValueChange={setProjectFilter}>
                    <SelectTrigger className="w-full sm:w-[160px]">
                      <SelectValue placeholder="Project" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Alle projecten</SelectItem>
                      {uniqueProjects.map((project) => (
                        <SelectItem key={project} value={project}>
                          {project}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  {/* Medewerker Filter (Admin only) */}
                  {isAdmin && uniqueMedewerkers.length > 1 && (
                    <Select value={medewerkerFilter} onValueChange={setMedewerkerFilter}>
                      <SelectTrigger className="w-full sm:w-[160px]">
                        <SelectValue placeholder="Medewerker" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Alle medewerkers</SelectItem>
                        {uniqueMedewerkers.map((medewerker) => (
                          <SelectItem key={medewerker} value={medewerker}>
                            {medewerker}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}

                  {/* Clear Filters */}
                  {(searchTerm ||
                    projectFilter !== "all" ||
                    medewerkerFilter !== "all" ||
                    dateRange !== "month") && (
                    <Button variant="ghost" size="sm" onClick={handleClearFilters}>
                      <Filter className="h-4 w-4 mr-1" />
                      Wissen
                    </Button>
                  )}
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {sortedEntries.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  {urenData?.length === 0 ? (
                    <>
                      <Clock className="h-12 w-12 text-muted-foreground/50 mb-4" />
                      <h3 className="text-lg font-medium mb-2">Nog geen uren geregistreerd</h3>
                      <p className="text-sm text-muted-foreground mb-4 max-w-sm">
                        Er zijn nog geen uren geregistreerd. Ga naar een project om je eerste uren te registreren.
                      </p>
                      <Button asChild>
                        <Link href="/projecten">
                          <FolderKanban className="h-4 w-4 mr-2" />
                          Naar Projecten
                        </Link>
                      </Button>
                    </>
                  ) : (
                    <>
                      <Filter className="h-12 w-12 text-muted-foreground/50 mb-4" />
                      <h3 className="text-lg font-medium mb-2">Geen resultaten gevonden</h3>
                      <p className="text-sm text-muted-foreground mb-4 max-w-sm">
                        Er zijn geen uren die voldoen aan de huidige filters. Probeer een andere periode of verwijder filters.
                      </p>
                      <Button variant="outline" onClick={handleClearFilters}>
                        <Filter className="h-4 w-4 mr-2" />
                        Filters wissen
                      </Button>
                    </>
                  )}
                </div>
              ) : (
                <ScrollableTable>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Datum</TableHead>
                        {isAdmin && <TableHead>Medewerker</TableHead>}
                        <TableHead>Project</TableHead>
                        <TableHead>Scope</TableHead>
                        <TableHead className="text-right">Uren</TableHead>
                        <TableHead>Notities</TableHead>
                        <TableHead className="w-[50px]"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {sortedEntries.slice(0, 100).map((entry) => (
                        <TableRow key={entry._id}>
                          <TableCell className="font-medium">
                            {formatDate(entry.datum)}
                          </TableCell>
                          {isAdmin && (
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <div className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/10">
                                  <User className="h-3 w-3 text-primary" />
                                </div>
                                {entry.medewerker}
                              </div>
                            </TableCell>
                          )}
                          <TableCell>
                            <span className="truncate max-w-[150px] block" title={entry.projectNaam}>
                              {entry.projectNaam}
                            </span>
                          </TableCell>
                          <TableCell>
                            {entry.scope ? (
                              <Badge variant="outline">{entry.scope}</Badge>
                            ) : (
                              <span className="text-muted-foreground">-</span>
                            )}
                          </TableCell>
                          <TableCell className="text-right font-medium">
                            {formatHours(entry.uren)}
                          </TableCell>
                          <TableCell>
                            <span className="text-muted-foreground truncate max-w-[150px] block" title={entry.notities || undefined}>
                              {entry.notities || "-"}
                            </span>
                          </TableCell>
                          <TableCell>
                            <Button variant="ghost" size="icon" className="h-9 w-9 sm:h-8 sm:w-8" asChild aria-label="Bekijk project">
                              <Link href={`/projecten/${entry.projectId}/uitvoering`}>
                                <ExternalLink className="h-4 w-4" />
                              </Link>
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </ScrollableTable>
              )}
              {sortedEntries.length > 100 && (
                <div className="text-center text-sm text-muted-foreground mt-4">
                  Toont de eerste 100 van {sortedEntries.length} registraties
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>
      </motion.div>
    </>
  );
}
