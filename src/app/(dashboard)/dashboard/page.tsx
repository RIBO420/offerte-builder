"use client";

import Link from "next/link";
import { m } from "framer-motion";
import { useQuery } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import {
  Card,
  CardContent,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Shovel,
  Trees,
  ArrowRight,
  FolderKanban,
  Clock,
  Truck,
  Wrench,
  Home,
} from "lucide-react";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbPage,
} from "@/components/ui/breadcrumb";
import { Separator } from "@/components/ui/separator";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { DashboardSkeleton, AdminDashboardSkeleton } from "@/components/ui/skeleton-card";
import { useCurrentUser } from "@/hooks/use-current-user";
import { useFullDashboardData } from "@/hooks/use-offertes";
import { useIsAdmin } from "@/hooks/use-users";
import { useOnboarding } from "@/hooks/use-onboarding";
import { WelcomeModal, OnboardingChecklist } from "@/components/onboarding";
import { VoormanDashboard } from "@/components/dashboard/voorman-dashboard";
import { WarningsFeed } from "@/components/dashboard/warnings-feed";
import { useAdminDashboardData } from "@/hooks/use-dashboard";
import { AandachtNodig } from "@/components/dashboard/aandacht-nodig";
import { FinancieelGrid } from "@/components/dashboard/financieel-grid";
import { PipelineBento } from "@/components/dashboard/pipeline-bento";
import { VlootBadge } from "@/components/dashboard/vloot-badge";
import { getGreeting } from "@/lib/greeting";

// ── Helpers ──────────────────────────────────────────────────────────

function computeTrendPct(current?: number, previous?: number): number {
  if (!current || !previous || previous === 0) return current && current > 0 ? 100 : 0;
  return Math.round(((current - previous) / previous) * 100);
}

const itemVariants = {
  hidden: { opacity: 0, y: 8 },
  show: { opacity: 1, y: 0, transition: { duration: 0.25 } },
};

export default function DashboardPage() {
  const { clerkUser } = useCurrentUser();
  const isAdmin = useIsAdmin();

  // Medewerker data — still uses the old batched query
  const {
    offerteStats,
    projectStats,
    activeProjects,
    isLoading,
  } = useFullDashboardData();

  // Admin data — consolidated single query
  const adminData = useAdminDashboardData();

  // Proactive warnings (used by admin AandachtNodig)
  const warnings = useQuery(api.proactiveWarnings.getWarnings) ?? [];

  // Onboarding state
  const {
    steps: onboardingSteps,
    completedSteps: onboardingCompletedSteps,
    totalSteps: onboardingTotalSteps,
    progressPercentage: onboardingProgress,
    isComplete: onboardingComplete,
    shouldShowWelcome,
    shouldShowChecklist,
    markWelcomeShown,
    dismissOnboarding,
    userName,
  } = useOnboarding();

  const hasActiveProjects = activeProjects && activeProjects.length > 0;

  // Show skeleton while primary data is loading (medewerker only — admin handles its own)
  if (isLoading && !offerteStats && !isAdmin) {
    return (
      <>
        <header className="flex h-16 shrink-0 items-center gap-2 border-b px-4">
          <SidebarTrigger className="-ml-1" />
          <Separator orientation="vertical" className="mr-2 h-4" />
          <Breadcrumb>
            <BreadcrumbList>
              <BreadcrumbItem>
                <BreadcrumbPage><Home className="size-4" /></BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
        </header>
        <div className="flex flex-1 flex-col gap-6 p-6 md:p-8 max-w-7xl">
          <DashboardSkeleton />
        </div>
      </>
    );
  }

  return (
    <>
      {/* Welcome Modal for new users */}
      <WelcomeModal
        open={shouldShowWelcome}
        onClose={markWelcomeShown}
        userName={userName}
      />

      <header className="flex h-16 shrink-0 items-center gap-2 border-b px-4">
        <SidebarTrigger className="-ml-1" />
        <Separator orientation="vertical" className="mr-2 h-4" />
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbPage><Home className="size-4" /></BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>
      </header>

      <div className="flex flex-1 flex-col gap-6 p-6 md:p-8 max-w-7xl">
        {/* Medewerker Dashboard */}
        {!isAdmin && (
          <>
            {/* Welcome Section (medewerker) */}
            <m.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3 }}
            >
              <h1 className="text-2xl md:text-3xl font-bold tracking-tight">
                Welkom{clerkUser?.firstName ? `, ${clerkUser.firstName}` : ""}
              </h1>
              <p className="text-muted-foreground mt-1">
                {projectStats?.totaal || 0} projecten
              </p>
            </m.div>

            {/* Onboarding Checklist (medewerker) */}
            {shouldShowChecklist && (
              <m.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: 0.05 }}
              >
                <OnboardingChecklist
                  steps={onboardingSteps}
                  completedSteps={onboardingCompletedSteps}
                  totalSteps={onboardingTotalSteps}
                  progressPercentage={onboardingProgress}
                  isComplete={onboardingComplete}
                  onDismiss={dismissOnboarding}
                />
              </m.div>
            )}

            {/* Voorman Dashboard — Daily planning (SOD-002) */}
            <VoormanDashboard />

            {/* Proactive Warnings for medewerkers (SOD-004) */}
            <WarningsFeed />

            {/* Primary CTA - Uren Registreren */}
            <m.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: 0.1 }}
            >
              <Card className="border-orange-200 dark:border-orange-900/50 bg-gradient-to-r from-orange-50 to-amber-50 dark:from-orange-950/30 dark:to-amber-950/30">
                <CardContent className="p-6">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="flex items-center gap-4">
                      <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-orange-500 text-white">
                        <Clock className="h-6 w-6" aria-hidden="true" />
                      </div>
                      <div>
                        <h2 className="font-semibold text-lg">Uren Registreren</h2>
                        <p className="text-sm text-muted-foreground">
                          Registreer je gewerkte uren voor actieve projecten
                        </p>
                      </div>
                    </div>
                    <Button asChild size="lg" className="bg-orange-500 hover:bg-orange-600">
                      <Link href="/projecten">
                        Naar Projecten
                        <ArrowRight className="ml-2 h-4 w-4" aria-hidden="true" />
                      </Link>
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </m.div>

            {/* Mijn Projecten Section */}
            <m.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: 0.15 }}
            >
              <div className="flex items-center justify-between mb-3">
                <h2 className="font-medium text-sm text-muted-foreground">Mijn Projecten</h2>
                <Button asChild variant="ghost" size="sm" className="text-muted-foreground hover:text-foreground">
                  <Link href="/projecten">
                    Bekijk alle
                    <ArrowRight className="ml-1 h-3 w-3" aria-hidden="true" />
                  </Link>
                </Button>
              </div>
              {hasActiveProjects ? (
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
                            <FolderKanban className="h-4 w-4 text-orange-600 dark:text-orange-400" aria-hidden="true" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-sm truncate group-hover:text-orange-600 dark:group-hover:text-orange-400 transition-colors" title={project.naam}>
                              {project.naam}
                            </p>
                            <p className="text-xs text-muted-foreground truncate" title={project.klantNaam}>
                              {project.klantNaam}
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="text-sm font-medium text-orange-600 dark:text-orange-400">
                              {project.voortgang}%
                            </p>
                          </div>
                        </div>
                        {/* Progress bar - WCAG AA compliant colors */}
                        <div
                          className="h-1.5 w-full bg-orange-200 dark:bg-orange-900/50 rounded-full overflow-hidden"
                          role="progressbar"
                          aria-valuenow={project.voortgang}
                          aria-valuemin={0}
                          aria-valuemax={100}
                          aria-label={`Projectvoortgang: ${project.voortgang}%`}
                        >
                          <div
                            className="h-full bg-orange-600 rounded-full transition-all duration-500"
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
              ) : (
                <Card className="p-8">
                  <div className="flex flex-col items-center justify-center text-center">
                    <FolderKanban className="h-12 w-12 text-muted-foreground/50 mb-4" aria-hidden="true" />
                    <h3 className="text-lg font-medium mb-2">Geen actieve projecten</h3>
                    <p className="text-sm text-muted-foreground mb-4 max-w-sm">
                      Er zijn momenteel geen projecten in uitvoering. Bekijk alle projecten om te zien wat er gepland staat.
                    </p>
                    <Button asChild variant="outline">
                      <Link href="/projecten">
                        <FolderKanban className="mr-2 h-4 w-4" aria-hidden="true" />
                        Bekijk Projecten
                      </Link>
                    </Button>
                  </div>
                </Card>
              )}
            </m.div>

            {/* Quick Links Section for Medewerkers */}
            <m.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: 0.2 }}
            >
              <h2 className="font-medium text-sm text-muted-foreground mb-3">Snelkoppelingen</h2>
              <div className="grid gap-3 md:grid-cols-2">
                <Link href="/wagenpark" className="group">
                  <Card className="p-4 transition-all hover:shadow-md hover:border-blue-300 dark:hover:border-blue-800">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-100 dark:bg-blue-900/30">
                        <Truck className="h-5 w-5 text-blue-600 dark:text-blue-400" aria-hidden="true" />
                      </div>
                      <div>
                        <p className="font-medium text-sm group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                          Wagenpark
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Beheer voertuigen en onderhoud
                        </p>
                      </div>
                      <ArrowRight className="ml-auto h-4 w-4 text-muted-foreground group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors" aria-hidden="true" />
                    </div>
                  </Card>
                </Link>

                <Link href="/instellingen/machines" className="group">
                  <Card className="p-4 transition-all hover:shadow-md hover:border-green-300 dark:hover:border-green-800">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-green-100 dark:bg-green-900/30">
                        <Wrench className="h-5 w-5 text-green-600 dark:text-green-400" aria-hidden="true" />
                      </div>
                      <div>
                        <p className="font-medium text-sm group-hover:text-green-600 dark:group-hover:text-green-400 transition-colors">
                          Machinepark
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Bekijk beschikbare machines
                        </p>
                      </div>
                      <ArrowRight className="ml-auto h-4 w-4 text-muted-foreground group-hover:text-green-600 dark:group-hover:text-green-400 transition-colors" aria-hidden="true" />
                    </div>
                  </Card>
                </Link>
              </div>
            </m.div>
          </>
        )}

        {/* Admin Dashboard */}
        {isAdmin && (
          <>
            {adminData.isLoading ? (
              <AdminDashboardSkeleton />
            ) : (
              <m.div
                variants={{
                  hidden: {},
                  show: { transition: { staggerChildren: 0.04, delayChildren: 0.1 } },
                }}
                initial="hidden"
                animate="show"
                className="space-y-6"
              >
                {/* Section 1: Welcome + Quick Start */}
                <m.div
                  variants={itemVariants}
                  className="flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                >
                  <div>
                    <h1 className="text-2xl md:text-3xl font-bold tracking-tight">
                      {getGreeting(clerkUser?.firstName ?? undefined)}
                    </h1>
                    <p className="text-muted-foreground mt-1">
                      {adminData.offerteStats?.totaal || 0} offertes • {adminData.projectStats?.totaal || 0} projecten
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button asChild variant="outline" className="border-green-500/20 bg-green-500/10 text-green-400 hover:bg-green-500/20 hover:text-green-300">
                      <Link href="/offertes/nieuw/aanleg">
                        <Shovel className="mr-2 h-4 w-4" />
                        Nieuwe Aanleg
                      </Link>
                    </Button>
                    <Button asChild variant="outline" className="border-green-500/12 bg-green-500/5 text-green-300 hover:bg-green-500/15 hover:text-green-200">
                      <Link href="/offertes/nieuw/onderhoud">
                        <Trees className="mr-2 h-4 w-4" />
                        Nieuw Onderhoud
                      </Link>
                    </Button>
                  </div>
                </m.div>

                {/* Onboarding Checklist (admin) */}
                {shouldShowChecklist && (
                  <m.div variants={itemVariants}>
                    <OnboardingChecklist
                      steps={onboardingSteps}
                      completedSteps={onboardingCompletedSteps}
                      totalSteps={onboardingTotalSteps}
                      progressPercentage={onboardingProgress}
                      isComplete={onboardingComplete}
                      onDismiss={dismissOnboarding}
                    />
                  </m.div>
                )}

                {/* Section 2: Aandacht Nodig (conditional) */}
                {((adminData.acceptedWithoutProject ?? []).length > 0 || warnings.length > 0) && (
                  <m.div variants={itemVariants}>
                    <AandachtNodig
                      acceptedWithoutProject={adminData.acceptedWithoutProject ?? []}
                      warnings={warnings.map((w: { id: string; type: string; prioriteit: "hoog" | "middel" | "laag"; titel: string; beschrijving: string; actie?: string }) => ({
                        id: w.id,
                        type: w.type,
                        prioriteit: w.prioriteit,
                        titel: w.titel,
                        beschrijving: w.beschrijving,
                        actie: w.actie,
                      }))}
                    />
                  </m.div>
                )}

                {/* Section 3: Financieel Grid */}
                <m.div variants={itemVariants}>
                  <FinancieelGrid
                    totaleOmzet={adminData.revenueStats?.totalAcceptedValue ?? 0}
                    actieveProjecten={adminData.projectStats?.in_uitvoering ?? 0}
                    totaalProjecten={adminData.projectStats?.totaal ?? 0}
                    afgerondeProjecten={adminData.projectStats?.afgerond ?? 0}
                    openstaandeOffertes={adminData.offerteStats?.verzonden ?? 0}
                    openstaandBedrag={adminData.financieel?.openstaandBedrag ?? 0}
                    vervaldeAantal={adminData.financieel?.vervaldeAantal ?? 0}
                    vervaldenBedrag={adminData.financieel?.vervaldenBedrag ?? 0}
                    gefactureerdThisQ={adminData.kwartaalVergelijking?.gefactureerdThisQ ?? 0}
                    gefactureerdPrevQ={adminData.kwartaalVergelijking?.gefactureerdPrevQ ?? 0}
                    urenDezeMaand={adminData.urenDezeMaand ?? 0}
                    omzetTrendPercentage={computeTrendPct(adminData.kwartaalVergelijking?.revenueThisQ, adminData.kwartaalVergelijking?.revenuePrevQ)}
                    gefactureerdTrendPercentage={computeTrendPct(adminData.kwartaalVergelijking?.gefactureerdThisQ, adminData.kwartaalVergelijking?.gefactureerdPrevQ)}
                  />
                </m.div>

                {/* Section 4: Pipeline Bento */}
                <m.div variants={itemVariants}>
                  <PipelineBento
                    offerteStats={adminData.offerteStats ?? { concept: 0, voorcalculatie: 0, verzonden: 0, geaccepteerd: 0, afgewezen: 0, totaal: 0 }}
                    conversionRate={adminData.revenueStats?.conversionRate ?? 0}
                    totalAcceptedCount={adminData.revenueStats?.totalAcceptedCount ?? 0}
                    totalSentForConversion={(adminData.offerteStats?.verzonden ?? 0) + (adminData.offerteStats?.geaccepteerd ?? 0) + (adminData.offerteStats?.afgewezen ?? 0)}
                    averageOfferteValue={adminData.revenueStats?.averageOfferteValue ?? 0}
                    projectStats={adminData.projectStats ?? { totaal: 0, gepland: 0, in_uitvoering: 0, afgerond: 0, nacalculatie_compleet: 0, gefactureerd: 0 }}
                    activeProjects={adminData.activeProjects ?? []}
                    recentOffertes={(adminData.recentOffertes ?? []).map((o) => ({
                      _id: o._id,
                      offerteNummer: o.offerteNummer,
                      klant: { naam: o.klantNaam },
                      status: o.status,
                      totalen: { totaalInclBtw: o.totaal },
                      updatedAt: o.updatedAt,
                    }))}
                  />
                </m.div>

                {/* Section 5: Vloot Badge */}
                <m.div variants={itemVariants}>
                  <VlootBadge
                    hasIssues={adminData.vlootSummary?.hasIssues ?? false}
                    issueCount={adminData.vlootSummary?.issueCount ?? 0}
                    summary={adminData.vlootSummary?.summary ?? "Alles operationeel"}
                  />
                </m.div>
              </m.div>
            )}
          </>
        )}
      </div>
    </>
  );
}
