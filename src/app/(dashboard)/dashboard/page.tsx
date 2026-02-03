"use client";

import { useMemo } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
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
  Clock,
  Truck,
  Wrench,
  Play,
  TrendingUp,
  CheckCircle2,
  XCircle,
  Send,
  PenLine,
  Calculator,
  Target,
} from "lucide-react";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbPage,
} from "@/components/ui/breadcrumb";
import { Separator } from "@/components/ui/separator";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { DashboardSkeleton } from "@/components/ui/skeleton-card";
import { useCurrentUser } from "@/hooks/use-current-user";
import { useFullDashboardData } from "@/hooks/use-offertes";
import { useIsAdmin } from "@/hooks/use-users";
import { useOnboarding } from "@/hooks/use-onboarding";
import { WelcomeModal, OnboardingChecklist } from "@/components/onboarding";
import { VoorraadAlertCard } from "@/components/dashboard/voorraad-alert-card";
import { InkoopordersCard } from "@/components/dashboard/inkooporders-card";
import { QCStatusCard } from "@/components/dashboard/qc-status-card";
import { DonutChart } from "@/components/ui/donut-chart";
import { Progress } from "@/components/ui/progress";

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

// Time ago formatter for recent activity
function formatTimeAgo(timestamp: number): string {
  const now = Date.now();
  const diff = now - timestamp;
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (minutes < 1) return "Zojuist";
  if (minutes < 60) return `${minutes} min geleden`;
  if (hours < 24) return `${hours} uur geleden`;
  if (days === 1) return "Gisteren";
  if (days < 7) return `${days} dagen geleden`;
  if (days < 30) return `${Math.floor(days / 7)} weken geleden`;
  return `${Math.floor(days / 30)} maanden geleden`;
}

export default function DashboardPage() {
  const { clerkUser } = useCurrentUser();
  const isAdmin = useIsAdmin();

  // Single batched query for ALL dashboard data - reduces 7 round-trips to 1
  const {
    offerteStats,
    revenueStats,
    acceptedWithoutProject,
    projectStats,
    activeProjects,
    recentOffertes,
    isLoading,
  } = useFullDashboardData();

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

  const hasActionRequired = acceptedWithoutProject && acceptedWithoutProject.length > 0;
  const hasActiveProjects = activeProjects && activeProjects.length > 0;

  // Calculate openstaande offertes (verzonden status)
  const openstaandeOffertes = useMemo(() => {
    return offerteStats?.verzonden || 0;
  }, [offerteStats?.verzonden]);

  // Show skeleton while primary data is loading
  if (isLoading && !offerteStats) {
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
        <div className="flex flex-1 flex-col gap-6 p-6 md:p-8 max-w-5xl">
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
              <BreadcrumbPage>Dashboard</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>
      </header>

      <div className="flex flex-1 flex-col gap-6 p-6 md:p-8 max-w-5xl">
        {/* Welcome Section */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
        >
          <h1 className="text-2xl font-semibold tracking-tight">
            Welkom{clerkUser?.firstName ? `, ${clerkUser.firstName}` : ""}
          </h1>
          <p className="text-muted-foreground mt-1">
            {isAdmin ? (
              <>{offerteStats?.totaal || 0} offertes • {projectStats?.totaal || 0} projecten</>
            ) : (
              <>{projectStats?.totaal || 0} projecten</>
            )}
          </p>
        </motion.div>

        {/* Onboarding Checklist */}
        {shouldShowChecklist && (
          <motion.div
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
          </motion.div>
        )}

        {/* Medewerker Dashboard */}
        {!isAdmin && (
          <>
            {/* Primary CTA - Uren Registreren */}
            <motion.div
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
            </motion.div>

            {/* Mijn Projecten Section */}
            <motion.div
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
            </motion.div>

            {/* Quick Links Section for Medewerkers */}
            <motion.div
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
            </motion.div>
          </>
        )}

        {/* Admin Dashboard */}
        {isAdmin && (
          <>
            {/* Action Required - Moved to top, more prominent */}
            {hasActionRequired && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: 0.1 }}
              >
                <Card className="border-amber-300 dark:border-amber-800 bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-950/40 dark:to-orange-950/40">
                  <CardContent className="p-5">
                    <div className="flex items-center gap-3 mb-4">
                      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500 text-white">
                        <AlertCircle className="h-5 w-5" aria-hidden="true" />
                      </div>
                      <div>
                        <h3 className="font-semibold text-amber-900 dark:text-amber-100">
                          Actie vereist
                        </h3>
                        <p className="text-sm text-amber-700 dark:text-amber-300">
                          {acceptedWithoutProject.length} geaccepteerde offerte{acceptedWithoutProject.length !== 1 ? 's' : ''} wacht{acceptedWithoutProject.length === 1 ? '' : 'en'} op een project
                        </p>
                      </div>
                    </div>
                    <div className="space-y-3">
                      {acceptedWithoutProject.slice(0, 3).map((offerte) => (
                        <div
                          key={offerte._id}
                          className="flex items-center justify-between bg-white dark:bg-white/10 rounded-xl px-4 py-3 border border-amber-200 dark:border-amber-800/50 shadow-sm"
                        >
                          <div className="min-w-0 flex-1">
                            <p className="font-medium truncate" title={offerte.klantNaam}>{offerte.klantNaam}</p>
                            <p className="text-sm text-muted-foreground">{offerte.offerteNummer}</p>
                          </div>
                          <Button
                            asChild
                            size="sm"
                            className="shrink-0 ml-4 bg-amber-500 hover:bg-amber-600 text-white"
                          >
                            <Link href={`/projecten/nieuw?offerte=${offerte._id}`}>
                              <Play className="mr-1.5 h-3.5 w-3.5" aria-hidden="true" />
                              Start Project
                            </Link>
                          </Button>
                        </div>
                      ))}
                      {acceptedWithoutProject.length > 3 && (
                        <Button asChild variant="ghost" size="sm" className="w-full text-amber-700 dark:text-amber-400 hover:text-amber-800 hover:bg-amber-100 dark:hover:bg-amber-900/30">
                          <Link href="/offertes?status=geaccepteerd">
                            Bekijk alle {acceptedWithoutProject.length} offertes
                            <ArrowRight className="ml-1 h-3 w-3" aria-hidden="true" />
                          </Link>
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            )}

            {/* Quick Start - Big Buttons for New Offertes */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: hasActionRequired ? 0.15 : 0.1 }}
            >
              <h2 className="font-medium text-sm text-muted-foreground mb-3">Snel starten</h2>
              <div className="grid gap-4 md:grid-cols-2">
                <Link href="/offertes/nieuw/aanleg" className="group">
                  <Card className="p-6 transition-all hover:shadow-lg hover:border-emerald-300 dark:hover:border-emerald-800 hover:-translate-y-0.5">
                    <div className="flex items-center gap-4">
                      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-100 dark:bg-emerald-900/30 group-hover:bg-emerald-200 dark:group-hover:bg-emerald-900/50 transition-colors">
                        <Shovel className="h-7 w-7 text-emerald-600 dark:text-emerald-400" aria-hidden="true" />
                      </div>
                      <div>
                        <p className="font-semibold text-lg group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors">
                          Nieuwe Aanleg Offerte
                        </p>
                        <p className="text-sm text-muted-foreground">
                          Maak een offerte voor tuinaanleg
                        </p>
                      </div>
                    </div>
                  </Card>
                </Link>

                <Link href="/offertes/nieuw/onderhoud" className="group">
                  <Card className="p-6 transition-all hover:shadow-lg hover:border-green-300 dark:hover:border-green-800 hover:-translate-y-0.5">
                    <div className="flex items-center gap-4">
                      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-green-100 dark:bg-green-900/30 group-hover:bg-green-200 dark:group-hover:bg-green-900/50 transition-colors">
                        <Trees className="h-7 w-7 text-green-600 dark:text-green-400" aria-hidden="true" />
                      </div>
                      <div>
                        <p className="font-semibold text-lg group-hover:text-green-600 dark:group-hover:text-green-400 transition-colors">
                          Nieuw Onderhoud Offerte
                        </p>
                        <p className="text-sm text-muted-foreground">
                          Maak een offerte voor tuinonderhoud
                        </p>
                      </div>
                    </div>
                  </Card>
                </Link>
              </div>
            </motion.div>

            {/* Key Metrics - 3 Cards Only */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: hasActionRequired ? 0.2 : 0.15 }}
              className="grid grid-cols-1 md:grid-cols-3 gap-4"
            >
              {/* Totale Omzet */}
              <Card className="p-5">
                <div className="flex items-center gap-4">
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-100 dark:bg-emerald-900/30">
                    <Euro className="h-6 w-6 text-emerald-600 dark:text-emerald-400" aria-hidden="true" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">
                      {revenueStats ? formatCurrency(revenueStats.totalAcceptedValue) : "..."}
                    </p>
                    <p className="text-sm text-muted-foreground">Totale Omzet</p>
                  </div>
                </div>
              </Card>

              {/* Actieve Projecten */}
              <Card className="p-5">
                <div className="flex items-center gap-4">
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-orange-100 dark:bg-orange-900/30">
                    <HardHat className="h-6 w-6 text-orange-600 dark:text-orange-400" aria-hidden="true" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">
                      {projectStats ? (projectStats.in_uitvoering || 0) : "..."}
                    </p>
                    <p className="text-sm text-muted-foreground">Actieve Projecten</p>
                  </div>
                </div>
              </Card>

              {/* Openstaande Offertes */}
              <Card className="p-5">
                <div className="flex items-center gap-4">
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-100 dark:bg-blue-900/30">
                    <FileText className="h-6 w-6 text-blue-600 dark:text-blue-400" aria-hidden="true" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">
                      {openstaandeOffertes}
                    </p>
                    <p className="text-sm text-muted-foreground">Openstaande Offertes</p>
                  </div>
                </div>
              </Card>
            </motion.div>

            {/* Analytics Widgets - Conversion Rate & Project Status */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: hasActionRequired ? 0.25 : 0.2 }}
            >
              <h2 className="font-medium text-sm text-muted-foreground mb-3">Analytics</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {/* Conversion Rate Widget */}
                <Card className="p-5">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-purple-100 dark:bg-purple-900/30">
                      <Target className="h-5 w-5 text-purple-600 dark:text-purple-400" aria-hidden="true" />
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Conversie Rate</p>
                      <p className="text-2xl font-bold">
                        {revenueStats?.conversionRate ?? 0}%
                      </p>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Progress value={revenueStats?.conversionRate ?? 0} className="h-2" />
                    <p className="text-xs text-muted-foreground">
                      {revenueStats?.totalAcceptedCount ?? 0} van {(offerteStats?.verzonden ?? 0) + (offerteStats?.geaccepteerd ?? 0) + (offerteStats?.afgewezen ?? 0)} offertes geaccepteerd
                    </p>
                  </div>
                </Card>

                {/* Average Offerte Value Widget */}
                <Card className="p-5">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-teal-100 dark:bg-teal-900/30">
                      <TrendingUp className="h-5 w-5 text-teal-600 dark:text-teal-400" aria-hidden="true" />
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Gem. Offerte Waarde</p>
                      <p className="text-2xl font-bold">
                        {revenueStats ? formatCurrency(revenueStats.averageOfferteValue) : "..."}
                      </p>
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Gebaseerd op {revenueStats?.totalAcceptedCount ?? 0} geaccepteerde offertes
                  </p>
                </Card>

                {/* Offerte Pipeline Widget */}
                <Card className="p-5">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-100 dark:bg-indigo-900/30">
                      <FileText className="h-5 w-5 text-indigo-600 dark:text-indigo-400" aria-hidden="true" />
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Offerte Pipeline</p>
                      <p className="text-2xl font-bold">{offerteStats?.totaal ?? 0}</p>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-1.5">
                        <PenLine className="h-3 w-3 text-slate-500" aria-hidden="true" />
                        <span className="text-muted-foreground">Concept</span>
                      </div>
                      <span className="font-medium">{offerteStats?.concept ?? 0}</span>
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-1.5">
                        <Calculator className="h-3 w-3 text-amber-500" aria-hidden="true" />
                        <span className="text-muted-foreground">Voorcalculatie</span>
                      </div>
                      <span className="font-medium">{offerteStats?.voorcalculatie ?? 0}</span>
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-1.5">
                        <Send className="h-3 w-3 text-blue-500" aria-hidden="true" />
                        <span className="text-muted-foreground">Verzonden</span>
                      </div>
                      <span className="font-medium">{offerteStats?.verzonden ?? 0}</span>
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-1.5">
                        <CheckCircle2 className="h-3 w-3 text-green-500" aria-hidden="true" />
                        <span className="text-muted-foreground">Geaccepteerd</span>
                      </div>
                      <span className="font-medium">{offerteStats?.geaccepteerd ?? 0}</span>
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-1.5">
                        <XCircle className="h-3 w-3 text-red-500" aria-hidden="true" />
                        <span className="text-muted-foreground">Afgewezen</span>
                      </div>
                      <span className="font-medium">{offerteStats?.afgewezen ?? 0}</span>
                    </div>
                  </div>
                </Card>
              </div>
            </motion.div>

            {/* Project Status Distribution & Recent Activity */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: hasActionRequired ? 0.3 : 0.25 }}
            >
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Project Status Distribution */}
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">Project Status Verdeling</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {projectStats && projectStats.totaal > 0 ? (
                      <div className="flex items-center justify-center">
                        <DonutChart
                          segments={[
                            { label: "Gepland", value: projectStats.gepland || 0, color: "hsl(220, 70%, 50%)" },
                            { label: "In Uitvoering", value: projectStats.in_uitvoering || 0, color: "hsl(25, 95%, 53%)" },
                            { label: "Afgerond", value: projectStats.afgerond || 0, color: "hsl(142, 76%, 36%)" },
                            { label: "Nacalculatie", value: projectStats.nacalculatie_compleet || 0, color: "hsl(280, 65%, 55%)" },
                            { label: "Gefactureerd", value: projectStats.gefactureerd || 0, color: "hsl(160, 60%, 45%)" },
                          ]}
                          size={160}
                          strokeWidth={32}
                          showTotal={true}
                          totalLabel="Projecten"
                          formatValue={(v) => String(v)}
                          showLegend={true}
                        />
                      </div>
                    ) : (
                      <div className="flex flex-col items-center justify-center py-8 text-center">
                        <FolderKanban className="h-10 w-10 text-muted-foreground/40 mb-2" aria-hidden="true" />
                        <p className="text-sm text-muted-foreground">Nog geen projecten</p>
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Recent Activity Timeline */}
                <Card>
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-sm font-medium text-muted-foreground">Recente Activiteit</CardTitle>
                      <Button asChild variant="ghost" size="sm" className="text-xs text-muted-foreground hover:text-foreground -mr-2">
                        <Link href="/offertes">
                          Bekijk alle
                          <ArrowRight className="ml-1 h-3 w-3" aria-hidden="true" />
                        </Link>
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent>
                    {recentOffertes && recentOffertes.length > 0 ? (
                      <div className="space-y-3">
                        {recentOffertes.slice(0, 5).map((offerte, index) => {
                          const statusConfig = {
                            concept: { icon: PenLine, color: "text-slate-500", bg: "bg-slate-100 dark:bg-slate-800", label: "Concept aangemaakt" },
                            voorcalculatie: { icon: Calculator, color: "text-amber-500", bg: "bg-amber-100 dark:bg-amber-900/30", label: "Voorcalculatie gemaakt" },
                            verzonden: { icon: Send, color: "text-blue-500", bg: "bg-blue-100 dark:bg-blue-900/30", label: "Offerte verzonden" },
                            geaccepteerd: { icon: CheckCircle2, color: "text-green-500", bg: "bg-green-100 dark:bg-green-900/30", label: "Offerte geaccepteerd" },
                            afgewezen: { icon: XCircle, color: "text-red-500", bg: "bg-red-100 dark:bg-red-900/30", label: "Offerte afgewezen" },
                          };
                          const config = statusConfig[offerte.status as keyof typeof statusConfig] || statusConfig.concept;
                          const StatusIcon = config.icon;
                          const timeAgo = formatTimeAgo(offerte.updatedAt);

                          return (
                            <Link
                              key={offerte._id}
                              href={`/offertes/${offerte._id}`}
                              className="flex items-start gap-3 group"
                            >
                              <div className="relative flex-shrink-0">
                                <div className={`flex h-8 w-8 items-center justify-center rounded-full ${config.bg}`}>
                                  <StatusIcon className={`h-4 w-4 ${config.color}`} aria-hidden="true" />
                                </div>
                                {index < recentOffertes.slice(0, 5).length - 1 && (
                                  <div className="absolute top-8 left-1/2 w-px h-4 bg-border -translate-x-1/2" aria-hidden="true" />
                                )}
                              </div>
                              <div className="flex-1 min-w-0 pt-0.5">
                                <p className="text-sm font-medium truncate group-hover:text-primary transition-colors">
                                  {offerte.klant.naam}
                                </p>
                                <p className="text-xs text-muted-foreground">
                                  {config.label} - {offerte.offerteNummer}
                                </p>
                                <p className="text-xs text-muted-foreground/70 mt-0.5">{timeAgo}</p>
                              </div>
                              <div className="text-right flex-shrink-0 pt-0.5">
                                <p className="text-sm font-medium tabular-nums">
                                  {formatCurrency(offerte.totalen.totaalInclBtw)}
                                </p>
                              </div>
                            </Link>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="flex flex-col items-center justify-center py-8 text-center">
                        <Clock className="h-10 w-10 text-muted-foreground/40 mb-2" aria-hidden="true" />
                        <p className="text-sm text-muted-foreground">Nog geen activiteit</p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            </motion.div>

            {/* Inkoop & Voorraad Widgets */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: hasActionRequired ? 0.35 : 0.3 }}
            >
              <h2 className="font-medium text-sm text-muted-foreground mb-3">Inkoop & Kwaliteit</h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <VoorraadAlertCard />
                <InkoopordersCard />
                <QCStatusCard />
              </div>
            </motion.div>

            {/* Active Projects - Only if there are any */}
            {hasActiveProjects && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: hasActionRequired ? 0.4 : 0.35 }}
              >
                <div className="flex items-center justify-between mb-3">
                  <h2 className="font-medium text-sm text-muted-foreground">Lopende Projecten</h2>
                  <Button asChild variant="ghost" size="sm" className="text-muted-foreground hover:text-foreground">
                    <Link href="/projecten">
                      Bekijk alle
                      <ArrowRight className="ml-1 h-3 w-3" aria-hidden="true" />
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
              </motion.div>
            )}

            {/* Empty state - Only if no projects and no action required */}
            {!hasActionRequired && !hasActiveProjects && !isLoading && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.3, delay: 0.35 }}
                className="flex flex-col items-center justify-center py-12 text-center"
              >
                <FolderKanban className="h-12 w-12 text-muted-foreground/50 mb-4" aria-hidden="true" />
                <h3 className="text-lg font-medium mb-2">Geen actieve projecten</h3>
                <p className="text-sm text-muted-foreground mb-4 max-w-sm">
                  Er zijn nog geen actieve projecten. Start met het aanmaken van een nieuwe offerte om aan de slag te gaan.
                </p>
                <div className="flex gap-3">
                  <Button asChild>
                    <Link href="/offertes/nieuw/aanleg">
                      <Shovel className="mr-2 h-4 w-4" aria-hidden="true" />
                      Nieuwe Aanleg
                    </Link>
                  </Button>
                  <Button asChild variant="outline">
                    <Link href="/offertes/nieuw/onderhoud">
                      <Trees className="mr-2 h-4 w-4" aria-hidden="true" />
                      Nieuw Onderhoud
                    </Link>
                  </Button>
                </div>
              </motion.div>
            )}
          </>
        )}
      </div>
    </>
  );
}
