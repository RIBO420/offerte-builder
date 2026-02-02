"use client";

import { useMemo } from "react";
import Link from "next/link";
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
  Clock,
  Truck,
  Wrench,
  Play,
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
  const { clerkUser } = useCurrentUser();
  const isAdmin = useIsAdmin();

  // Single batched query for ALL dashboard data - reduces 7 round-trips to 1
  const {
    offerteStats,
    revenueStats,
    acceptedWithoutProject,
    projectStats,
    activeProjects,
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
                        <Clock className="h-6 w-6" />
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
                        <ArrowRight className="ml-2 h-4 w-4" />
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
                    <ArrowRight className="ml-1 h-3 w-3" />
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
                            <FolderKanban className="h-4 w-4 text-orange-600 dark:text-orange-400" />
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
                        <div className="h-1.5 w-full bg-orange-200 dark:bg-orange-900/50 rounded-full overflow-hidden">
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
                    <FolderKanban className="h-12 w-12 text-muted-foreground/50 mb-4" />
                    <h3 className="text-lg font-medium mb-2">Geen actieve projecten</h3>
                    <p className="text-sm text-muted-foreground mb-4 max-w-sm">
                      Er zijn momenteel geen projecten in uitvoering. Bekijk alle projecten om te zien wat er gepland staat.
                    </p>
                    <Button asChild variant="outline">
                      <Link href="/projecten">
                        <FolderKanban className="mr-2 h-4 w-4" />
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
                        <Truck className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                      </div>
                      <div>
                        <p className="font-medium text-sm group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                          Wagenpark
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Beheer voertuigen en onderhoud
                        </p>
                      </div>
                      <ArrowRight className="ml-auto h-4 w-4 text-muted-foreground group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors" />
                    </div>
                  </Card>
                </Link>

                <Link href="/instellingen/machines" className="group">
                  <Card className="p-4 transition-all hover:shadow-md hover:border-green-300 dark:hover:border-green-800">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-green-100 dark:bg-green-900/30">
                        <Wrench className="h-5 w-5 text-green-600 dark:text-green-400" />
                      </div>
                      <div>
                        <p className="font-medium text-sm group-hover:text-green-600 dark:group-hover:text-green-400 transition-colors">
                          Machinepark
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Bekijk beschikbare machines
                        </p>
                      </div>
                      <ArrowRight className="ml-auto h-4 w-4 text-muted-foreground group-hover:text-green-600 dark:group-hover:text-green-400 transition-colors" />
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
                        <AlertCircle className="h-5 w-5" />
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
                              <Play className="mr-1.5 h-3.5 w-3.5" />
                              Start Project
                            </Link>
                          </Button>
                        </div>
                      ))}
                      {acceptedWithoutProject.length > 3 && (
                        <Button asChild variant="ghost" size="sm" className="w-full text-amber-700 dark:text-amber-400 hover:text-amber-800 hover:bg-amber-100 dark:hover:bg-amber-900/30">
                          <Link href="/offertes?status=geaccepteerd">
                            Bekijk alle {acceptedWithoutProject.length} offertes
                            <ArrowRight className="ml-1 h-3 w-3" />
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
                        <Shovel className="h-7 w-7 text-emerald-600 dark:text-emerald-400" />
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
                        <Trees className="h-7 w-7 text-green-600 dark:text-green-400" />
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
                    <Euro className="h-6 w-6 text-emerald-600 dark:text-emerald-400" />
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
                    <HardHat className="h-6 w-6 text-orange-600 dark:text-orange-400" />
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
                    <FileText className="h-6 w-6 text-blue-600 dark:text-blue-400" />
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

            {/* Active Projects - Only if there are any */}
            {hasActiveProjects && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: hasActionRequired ? 0.25 : 0.2 }}
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
                        <div className="h-1.5 w-full bg-orange-200 dark:bg-orange-900/50 rounded-full overflow-hidden">
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
                transition={{ duration: 0.3, delay: 0.25 }}
                className="flex flex-col items-center justify-center py-12 text-center"
              >
                <FolderKanban className="h-12 w-12 text-muted-foreground/50 mb-4" />
                <h3 className="text-lg font-medium mb-2">Geen actieve projecten</h3>
                <p className="text-sm text-muted-foreground mb-4 max-w-sm">
                  Er zijn nog geen actieve projecten. Start met het aanmaken van een nieuwe offerte om aan de slag te gaan.
                </p>
                <div className="flex gap-3">
                  <Button asChild>
                    <Link href="/offertes/nieuw/aanleg">
                      <Shovel className="mr-2 h-4 w-4" />
                      Nieuwe Aanleg
                    </Link>
                  </Button>
                  <Button asChild variant="outline">
                    <Link href="/offertes/nieuw/onderhoud">
                      <Trees className="mr-2 h-4 w-4" />
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
