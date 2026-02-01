"use client";

import { useMemo, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import {
  Card,
  CardContent,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  FileText,
  Shovel,
  Trees,
  ArrowRight,
  FolderKanban,
  Euro,
  HardHat,
  AlertCircle,
  TrendingUp,
  Receipt,
  Clock,
  CheckCircle2,
} from "lucide-react";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbPage,
} from "@/components/ui/breadcrumb";
import { Separator } from "@/components/ui/separator";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { PipelineView } from "@/components/ui/pipeline-view";
import { useCurrentUser } from "@/hooks/use-current-user";
import { useDashboardData } from "@/hooks/use-offertes";
import { useQuery } from "convex/react";
import { api } from "../../../../convex/_generated/api";

// Memoized formatter
const currencyFormatter = new Intl.NumberFormat("nl-NL", {
  style: "currency",
  currency: "EUR",
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

function formatCurrency(amount: number): string {
  return currencyFormatter.format(amount);
}

export default function DashboardPage() {
  const router = useRouter();
  const { clerkUser, user } = useCurrentUser();
  const { stats, isLoading: isOffertesLoading } = useDashboardData();

  // Fetch project stats
  const projectStats = useQuery(
    api.projecten.getStats,
    user?._id ? {} : "skip"
  );

  // Fetch active projects with progress
  const activeProjects = useQuery(
    api.projecten.getActiveProjectsWithProgress,
    user?._id ? {} : "skip"
  );

  // Fetch revenue stats
  const revenueStats = useQuery(
    api.offertes.getRevenueStats,
    user?._id ? {} : "skip"
  );

  // Fetch accepted offertes without a project (action required)
  const acceptedWithoutProject = useQuery(
    api.offertes.getAcceptedOffertesWithoutProject,
    user?._id ? {} : "skip"
  );

  // Fetch facturen stats
  const facturenStats = useQuery(
    api.facturen.getStats,
    user?._id ? {} : "skip"
  );

  // Fetch recent facturen
  const recentFacturen = useQuery(
    api.facturen.getRecent,
    user?._id ? { limit: 5 } : "skip"
  );

  // Memoized pipeline stages data
  const pipelineStages = useMemo(() => [
    { id: "concept", label: "Concept", count: stats?.concept || 0 },
    { id: "voorcalculatie", label: "Voorcalculatie", count: stats?.voorcalculatie || 0 },
    { id: "verzonden", label: "Verzonden", count: stats?.verzonden || 0 },
    { id: "geaccepteerd", label: "Geaccepteerd", count: stats?.geaccepteerd || 0 },
    { id: "afgewezen", label: "Afgewezen", count: stats?.afgewezen || 0 },
  ], [stats?.concept, stats?.voorcalculatie, stats?.verzonden, stats?.geaccepteerd, stats?.afgewezen]);

  const handleStageClick = useCallback((stageId: string) => {
    router.push(`/offertes?status=${stageId}`);
  }, [router]);

  const hasActionRequired = acceptedWithoutProject && acceptedWithoutProject.length > 0;
  const hasActiveProjects = activeProjects && activeProjects.length > 0;
  const hasFacturen = facturenStats && facturenStats.totaal > 0;

  return (
    <>
      <header className="flex h-16 shrink-0 items-center gap-2 border-b px-4">
        <SidebarTrigger className="-ml-1" />
        <Separator orientation="vertical" className="mr-2 h-4" />
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbPage>Dashboard</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>
      </header>

      <div className="flex flex-1 flex-col gap-8 p-6 md:p-8 max-w-6xl">
        {/* Welcome + Quick Actions */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4"
        >
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">
              Welkom{clerkUser?.firstName ? `, ${clerkUser.firstName}` : ""}
            </h1>
            <p className="text-muted-foreground mt-1">
              {stats?.totaal || 0} offertes • {projectStats?.totaal || 0} projecten
            </p>
          </div>
          <div className="flex gap-2">
            <Button asChild size="sm">
              <Link href="/offertes/nieuw/aanleg">
                <Shovel className="mr-2 h-4 w-4" />
                Nieuwe Aanleg
              </Link>
            </Button>
            <Button asChild variant="outline" size="sm">
              <Link href="/offertes/nieuw/onderhoud">
                <Trees className="mr-2 h-4 w-4" />
                Nieuw Onderhoud
              </Link>
            </Button>
          </div>
        </motion.div>

        {/* Key Metrics - Single Row */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.1 }}
          className="grid grid-cols-2 md:grid-cols-4 gap-4"
        >
          {/* Total Revenue */}
          <Card className="p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-100 dark:bg-emerald-900/30">
                <Euro className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
              </div>
              <div>
                <p className="text-xl font-bold">
                  {revenueStats ? formatCurrency(revenueStats.totalAcceptedValue) : "—"}
                </p>
                <p className="text-xs text-muted-foreground">Totale omzet</p>
              </div>
            </div>
          </Card>

          {/* Conversion Rate */}
          <Card className="p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-100 dark:bg-blue-900/30">
                <TrendingUp className="h-5 w-5 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <p className="text-xl font-bold">
                  {revenueStats ? `${revenueStats.conversionRate}%` : "—"}
                </p>
                <p className="text-xs text-muted-foreground">Conversie</p>
              </div>
            </div>
          </Card>

          {/* Active Projects */}
          <Card className="p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-orange-100 dark:bg-orange-900/30">
                <HardHat className="h-5 w-5 text-orange-600 dark:text-orange-400" />
              </div>
              <div>
                <p className="text-xl font-bold">
                  {projectStats ? (projectStats.in_uitvoering || 0) : "—"}
                </p>
                <p className="text-xs text-muted-foreground">In uitvoering</p>
              </div>
            </div>
          </Card>

          {/* Pending Quotes */}
          <Card className="p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-purple-100 dark:bg-purple-900/30">
                <FileText className="h-5 w-5 text-purple-600 dark:text-purple-400" />
              </div>
              <div>
                <p className="text-xl font-bold">
                  {stats ? (stats.verzonden || 0) : "—"}
                </p>
                <p className="text-xs text-muted-foreground">Wacht op reactie</p>
              </div>
            </div>
          </Card>
        </motion.div>

        {/* Action Required - Only if there are items */}
        {hasActionRequired && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.15 }}
          >
            <Card className="border-amber-200 dark:border-amber-900/50 bg-amber-50/50 dark:bg-amber-950/20">
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-3">
                  <AlertCircle className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                  <h3 className="font-medium text-sm text-amber-800 dark:text-amber-300">
                    Actie vereist ({acceptedWithoutProject.length})
                  </h3>
                </div>
                <div className="space-y-2">
                  {acceptedWithoutProject.slice(0, 3).map((offerte) => (
                    <div
                      key={offerte._id}
                      className="flex items-center justify-between bg-white dark:bg-white/5 rounded-lg px-3 py-2 border border-amber-200/50 dark:border-amber-800/30"
                    >
                      <div className="min-w-0">
                        <p className="font-medium text-sm truncate">{offerte.klantNaam}</p>
                        <p className="text-xs text-muted-foreground">{offerte.offerteNummer}</p>
                      </div>
                      <Button
                        asChild
                        size="sm"
                        variant="ghost"
                        className="shrink-0 text-amber-700 dark:text-amber-400 hover:text-amber-800 hover:bg-amber-100 dark:hover:bg-amber-900/30"
                      >
                        <Link href={`/projecten/nieuw?offerte=${offerte._id}`}>
                          Start Project
                          <ArrowRight className="ml-1 h-3 w-3" />
                        </Link>
                      </Button>
                    </div>
                  ))}
                  {acceptedWithoutProject.length > 3 && (
                    <Button asChild variant="ghost" size="sm" className="w-full text-amber-700 dark:text-amber-400">
                      <Link href="/offertes?status=geaccepteerd">
                        Bekijk alle {acceptedWithoutProject.length}
                        <ArrowRight className="ml-1 h-3 w-3" />
                      </Link>
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}

        {/* Offerte Pipeline */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.2 }}
        >
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-medium text-sm text-muted-foreground">Offerte Pipeline</h2>
            <Button asChild variant="ghost" size="sm" className="text-muted-foreground hover:text-foreground">
              <Link href="/offertes">
                Bekijk alle
                <ArrowRight className="ml-1 h-3 w-3" />
              </Link>
            </Button>
          </div>
          <Card className="p-4">
            <PipelineView
              stages={pipelineStages}
              onStageClick={handleStageClick}
            />
          </Card>
        </motion.div>

        {/* Active Projects - Only if there are any */}
        {hasActiveProjects && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.25 }}
          >
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-medium text-sm text-muted-foreground">Lopende Projecten</h2>
              <Button asChild variant="ghost" size="sm" className="text-muted-foreground hover:text-foreground">
                <Link href="/projecten">
                  Bekijk alle
                  <ArrowRight className="ml-1 h-3 w-3" />
                </Link>
              </Button>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              {activeProjects.slice(0, 4).map((project) => (
                <Link
                  key={project._id}
                  href={`/projecten/${project._id}`}
                  className="group"
                >
                  <Card className="p-4 transition-all hover:shadow-md hover:border-orange-300 dark:hover:border-orange-800">
                    <div className="flex items-center gap-3 mb-3">
                      <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-orange-100 dark:bg-orange-900/30">
                        <FolderKanban className="h-4 w-4 text-orange-600 dark:text-orange-400" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm truncate group-hover:text-orange-600 dark:group-hover:text-orange-400 transition-colors">
                          {project.naam}
                        </p>
                        <p className="text-xs text-muted-foreground truncate">
                          {project.klantNaam}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-medium text-orange-600 dark:text-orange-400">
                          {project.voortgang}%
                        </p>
                      </div>
                    </div>
                    {/* Progress bar */}
                    <div className="h-1.5 w-full bg-orange-100 dark:bg-orange-950/50 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-orange-500 rounded-full transition-all duration-500"
                        style={{ width: `${project.voortgang}%` }}
                      />
                    </div>
                    <div className="flex justify-between mt-1.5 text-xs text-muted-foreground">
                      <span>{project.totaalUren} / {project.begroteUren} uur</span>
                    </div>
                  </Card>
                </Link>
              ))}
            </div>
          </motion.div>
        )}

        {/* Facturen Section - Only if there are facturen */}
        {hasFacturen && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.3 }}
          >
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-medium text-sm text-muted-foreground">Facturen Overzicht</h2>
              <Button asChild variant="ghost" size="sm" className="text-muted-foreground hover:text-foreground">
                <Link href="/facturen">
                  Bekijk alle
                  <ArrowRight className="ml-1 h-3 w-3" />
                </Link>
              </Button>
            </div>

            {/* Facturen Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
              {/* Total Facturen Amount */}
              <Card className="p-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-100 dark:bg-blue-900/30">
                    <Receipt className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                  </div>
                  <div>
                    <p className="text-xl font-bold">
                      {formatCurrency(facturenStats.totaalBedrag)}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Totaal gefactureerd ({facturenStats.totaal})
                    </p>
                  </div>
                </div>
              </Card>

              {/* Openstaand */}
              <Card className="p-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-100 dark:bg-amber-900/30">
                    <Clock className="h-5 w-5 text-amber-600 dark:text-amber-400" />
                  </div>
                  <div>
                    <p className="text-xl font-bold">
                      {formatCurrency(facturenStats.openstaandBedrag)}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Openstaand ({facturenStats.verzonden})
                    </p>
                  </div>
                </div>
              </Card>

              {/* Betaald */}
              <Card className="p-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-100 dark:bg-emerald-900/30">
                    <CheckCircle2 className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                  </div>
                  <div>
                    <p className="text-xl font-bold">
                      {formatCurrency(facturenStats.betaaldBedrag)}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Betaald ({facturenStats.betaald})
                    </p>
                  </div>
                </div>
              </Card>
            </div>

            {/* Recent Facturen List */}
            {recentFacturen && recentFacturen.length > 0 && (
              <Card className="p-4">
                <h3 className="font-medium text-sm mb-3">Recente Facturen</h3>
                <div className="space-y-2">
                  {recentFacturen.map((factuur) => (
                    <Link
                      key={factuur._id}
                      href={`/facturen/${factuur._id}`}
                      className="flex items-center justify-between py-2 px-3 rounded-lg hover:bg-muted/50 transition-colors group"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className={`flex h-8 w-8 items-center justify-center rounded-lg ${
                          factuur.status === "betaald"
                            ? "bg-emerald-100 dark:bg-emerald-900/30"
                            : factuur.status === "verzonden"
                            ? "bg-amber-100 dark:bg-amber-900/30"
                            : factuur.status === "vervallen"
                            ? "bg-red-100 dark:bg-red-900/30"
                            : "bg-gray-100 dark:bg-gray-900/30"
                        }`}>
                          <Receipt className={`h-4 w-4 ${
                            factuur.status === "betaald"
                              ? "text-emerald-600 dark:text-emerald-400"
                              : factuur.status === "verzonden"
                              ? "text-amber-600 dark:text-amber-400"
                              : factuur.status === "vervallen"
                              ? "text-red-600 dark:text-red-400"
                              : "text-gray-600 dark:text-gray-400"
                          }`} />
                        </div>
                        <div className="min-w-0">
                          <p className="font-medium text-sm truncate group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                            {factuur.factuurnummer}
                          </p>
                          <p className="text-xs text-muted-foreground truncate">
                            {factuur.klantNaam}
                          </p>
                        </div>
                      </div>
                      <div className="text-right shrink-0 ml-4">
                        <p className="text-sm font-medium">
                          {formatCurrency(factuur.totaalInclBtw)}
                        </p>
                        <p className={`text-xs ${
                          factuur.status === "betaald"
                            ? "text-emerald-600 dark:text-emerald-400"
                            : factuur.status === "verzonden"
                            ? "text-amber-600 dark:text-amber-400"
                            : factuur.status === "vervallen"
                            ? "text-red-600 dark:text-red-400"
                            : "text-muted-foreground"
                        }`}>
                          {factuur.status === "concept" && "Concept"}
                          {factuur.status === "definitief" && "Definitief"}
                          {factuur.status === "verzonden" && "Verzonden"}
                          {factuur.status === "betaald" && "Betaald"}
                          {factuur.status === "vervallen" && "Vervallen"}
                        </p>
                      </div>
                    </Link>
                  ))}
                </div>
              </Card>
            )}
          </motion.div>
        )}

        {/* Empty state - Only if no projects and no action required */}
        {!hasActionRequired && !hasActiveProjects && !isOffertesLoading && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.3, delay: 0.3 }}
            className="text-center py-12"
          >
            <FolderKanban className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
            <h3 className="font-medium text-muted-foreground">Geen actieve projecten</h3>
            <p className="text-sm text-muted-foreground/80 mt-1">
              Start een nieuwe offerte om aan de slag te gaan
            </p>
          </motion.div>
        )}
      </div>
    </>
  );
}
