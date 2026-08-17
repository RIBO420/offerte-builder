"use client";

import Link from "next/link";
import { REVEAL_KLASSE } from "@/components/pagina-reveal";
import { useQuery, useConvexAuth } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import {
  Card,
  CardContent,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  ArrowRight,
  FolderKanban,
  Clock,
  Truck,
  Wrench,
} from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { DashboardSkeleton } from "@/components/ui/skeleton-card";
import { useCurrentUser } from "@/hooks/use-current-user";
import { useFullDashboardData } from "@/hooks/use-offertes";
import { useIsAdmin } from "@/hooks/use-users";
import { useOnboarding } from "@/hooks/use-onboarding";
import { WelcomeModal, OnboardingChecklist } from "@/components/onboarding";
import { VoormanDashboard } from "@/components/dashboard/voorman-dashboard";
import { WarningsFeed } from "@/components/dashboard/warnings-feed";
import { MijnTaken, useMijnTaken } from "@/components/dashboard/mijn-taken";
import { useAdminDashboardData } from "@/hooks/use-dashboard";
import { AandachtNodig } from "@/components/dashboard/aandacht-nodig";
import {
  Cijferbalk,
  berekenVerschilPct,
} from "@/components/dashboard/cijferbalk";
import {
  ConversiePaneel,
  PipelinePaneel,
} from "@/components/dashboard/pipeline-paneel";
import {
  LaatsteOffertesPaneel,
  LopendWerkPaneel,
} from "@/components/dashboard/werk-panelen";
import {
  BentoBlok,
  DAGSTAAT_SPAN,
  DagstaatBento,
  DagstaatReveal,
  DagstaatRevealStijl,
} from "@/components/dashboard/dagstaat-bento";
import { DagstaatKop } from "@/components/dashboard/dagstaat-kop";
import { DagstaatSkelet } from "@/components/dashboard/dagstaat-skelet";
import { NieuweOfferteSplitButton } from "@/components/offerte/nieuwe-offerte-split-button";
import { VlootBadge } from "@/components/dashboard/vloot-badge";
import { getGreeting } from "@/lib/greeting";

export default function DashboardPage() {
  const { clerkUser, user, isLoading: isUserLoading } = useCurrentUser();
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

  // Zelfde abonnement als het takenpaneel (Convex dedupliceert op query+args);
  // de kop heeft alleen de teller nodig.
  const mijnTaken = useMijnTaken();

  // Proactive warnings (used by admin AandachtNodig) — wait for Convex auth so we
  // don't fire this during the brief Clerk→Convex token handshake on first load.
  const { isAuthenticated } = useConvexAuth();
  const warnings =
    useQuery(api.proactiveWarnings.getWarnings, isAuthenticated ? {} : "skip") ?? [];

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

  // Wait until the user's role is known before choosing a dashboard variant.
  // useIsAdmin() returns false while loading, so without this gate the medewerker
  // view flashes for admins/directie before the role resolves.
  if (isUserLoading || !user) {
    return (
      <>
        <PageHeader />
        <div className="flex flex-1 flex-col gap-6 p-6 md:p-8 max-w-7xl">
          <DashboardSkeleton />
        </div>
      </>
    );
  }

  // Show skeleton while primary data is loading (medewerker only — admin handles its own)
  if (isLoading && !offerteStats && !isAdmin) {
    return (
      <>
        <PageHeader />
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

      <PageHeader />

      {/* Medewerker Dashboard */}
      {!isAdmin && (
        <div className="flex flex-1 flex-col gap-6 p-6 md:p-8 max-w-7xl">
          <>
            {/* Welcome Section (medewerker) */}
            <div className={REVEAL_KLASSE}>
              <h1 className="text-2xl md:text-3xl font-bold tracking-tight">
                Welkom{clerkUser?.firstName ? `, ${clerkUser.firstName}` : ""}
              </h1>
              <p className="text-muted-foreground mt-1">
                {projectStats?.totaal || 0} projecten
              </p>
            </div>

            {/* Onboarding Checklist (medewerker) */}
            {shouldShowChecklist && (
              <div className={REVEAL_KLASSE}>
                <OnboardingChecklist
                  steps={onboardingSteps}
                  completedSteps={onboardingCompletedSteps}
                  totalSteps={onboardingTotalSteps}
                  progressPercentage={onboardingProgress}
                  isComplete={onboardingComplete}
                  onDismiss={dismissOnboarding}
                />
              </div>
            )}

            {/* Voorman Dashboard — Daily planning (SOD-002) */}
            <VoormanDashboard />

            {/* Proactive Warnings for medewerkers (SOD-004) */}
            <WarningsFeed />

            {/* Klanttaken die aan mij zijn toegewezen (rendert niets als leeg) */}
            <MijnTaken />

            {/* Primary CTA - Uren Registreren */}
            <div className={REVEAL_KLASSE}>
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
                    {/* Les 3+6: dé gevulde hoofdknop van het medewerker-
                        dashboard, in primary — geen rauwe paletkleur. */}
                    <Button asChild size="lg">
                      <Link href="/projecten">
                        Naar Projecten
                        <ArrowRight className="ml-2 h-4 w-4" aria-hidden="true" />
                      </Link>
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Mijn Projecten Section */}
            <div className={REVEAL_KLASSE}>
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
            </div>

            {/* Quick Links Section for Medewerkers */}
            <div className={REVEAL_KLASSE}>
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
            </div>
          </>
        </div>
      )}

      {/* ── Admin: de dagstaat ───────────────────────────────────────────
          Werk vóór cijfers, cijfers vóór naslag. De volgorde in de DOM ís de
          prioriteitsvolgorde, zodat mobiel (één kolom) exact dezelfde lezing
          krijgt als de bento op breed — indikken, niet verstoppen.

          `@container/dagstaat` staat hier: de blokken kiezen hun kolomspan op
          de breedte van deze wrapper, niet op de viewport. Geen `max-w-7xl`
          meer — die kapte op 1680px 136px zinvolle breedte af en duwde de
          pagina daarmee juist langer. */}
      {isAdmin && (
        <div className="@container/dagstaat flex flex-1 flex-col gap-4 p-6 md:p-8">
          {adminData.isLoading ? (
            <DagstaatSkelet />
          ) : (
            <>
              <DagstaatRevealStijl />
              <DagstaatReveal stap={0}>
                <DagstaatKop
                  groet={getGreeting(clerkUser?.firstName ?? undefined)}
                  cijfers={{
                    aandacht:
                      (adminData.acceptedWithoutProject ?? []).length +
                      warnings.length,
                    takenOpen: mijnTaken?.length ?? 0,
                    projectenLopend: adminData.projectStats?.in_uitvoering ?? 0,
                    offertesPipeline: adminData.offerteStats?.totaal ?? 0,
                  }}
                  actie={
                    /* Ingang "nieuwe offerte" — eigendom van offerte-entree-bouw
                       (commit 4c2e64e), bewust zonder className: de knop bepaalt
                       zijn eigen vorm, de dagstaat alleen zijn plek. */
                    <NieuweOfferteSplitButton />
                  }
                />
              </DagstaatReveal>

              {/* Onboarding staat buiten de bento: hij is tijdelijk en zou het
                  raster anders elke keer opnieuw indelen. */}
              {shouldShowChecklist && (
                <DagstaatReveal stap={1}>
                  <OnboardingChecklist
                    steps={onboardingSteps}
                    completedSteps={onboardingCompletedSteps}
                    totalSteps={onboardingTotalSteps}
                    progressPercentage={onboardingProgress}
                    isComplete={onboardingComplete}
                    onDismiss={dismissOnboarding}
                  />
                </DagstaatReveal>
              )}

              <DagstaatBento>
                {/* Werkstrook: wat je moet dóén staat boven wat je moet wéten. */}
                <BentoBlok span={DAGSTAAT_SPAN.aandacht} stap={1}>
                  <AandachtNodig
                    acceptedWithoutProject={adminData.acceptedWithoutProject ?? []}
                    warnings={warnings.map(
                      (w: {
                        id: string;
                        type: string;
                        prioriteit: "hoog" | "middel" | "laag";
                        titel: string;
                        beschrijving: string;
                        actie?: string;
                      }) => ({
                        id: w.id,
                        type: w.type,
                        prioriteit: w.prioriteit,
                        titel: w.titel,
                        beschrijving: w.beschrijving,
                        actie: w.actie,
                      })
                    )}
                  />
                </BentoBlok>

                <BentoBlok span={DAGSTAAT_SPAN.taken} stap={2}>
                  <MijnTaken verbergAlsLeeg={false} />
                </BentoBlok>

                {/* Cijferstrook — gevoed door de gedeelde omzetdefinities, dus
                    dashboard en /rapportages tonen nooit een andere omzet. */}
                <BentoBlok span={DAGSTAAT_SPAN.cijfers} stap={3}>
                  <Cijferbalk
                    getekendeOmzet={adminData.revenueStats?.totalAcceptedValue ?? 0}
                    omzetTrendPct={berekenVerschilPct(
                      adminData.kwartaalVergelijking?.revenueThisQ,
                      adminData.kwartaalVergelijking?.revenuePrevQ
                    )}
                    openstaandBedrag={adminData.financieel?.openstaandBedrag ?? 0}
                    vervaldeAantal={adminData.financieel?.vervaldeAantal ?? 0}
                    vervaldenBedrag={adminData.financieel?.vervaldenBedrag ?? 0}
                    gefactureerdDitKwartaal={
                      adminData.kwartaalVergelijking?.gefactureerdThisQ ?? 0
                    }
                    gefactureerdTrendPct={berekenVerschilPct(
                      adminData.kwartaalVergelijking?.gefactureerdThisQ,
                      adminData.kwartaalVergelijking?.gefactureerdPrevQ
                    )}
                    actieveProjecten={adminData.projectStats?.in_uitvoering ?? 0}
                    afgerondeProjecten={adminData.projectStats?.afgerond ?? 0}
                    totaalProjecten={adminData.projectStats?.totaal ?? 0}
                  />
                </BentoBlok>

                <BentoBlok span={DAGSTAAT_SPAN.pipeline} stap={4}>
                  <PipelinePaneel
                    stats={
                      adminData.offerteStats ?? {
                        concept: 0,
                        voorcalculatie: 0,
                        verzonden: 0,
                        geaccepteerd: 0,
                        afgewezen: 0,
                        totaal: 0,
                      }
                    }
                  />
                </BentoBlok>

                <BentoBlok span={DAGSTAAT_SPAN.conversie} stap={5}>
                  <ConversiePaneel
                    rate={adminData.revenueStats?.conversionRate ?? 0}
                    aantalGetekend={adminData.revenueStats?.totalAcceptedCount ?? 0}
                    aantalVerstuurd={
                      (adminData.offerteStats?.verzonden ?? 0) +
                      (adminData.offerteStats?.geaccepteerd ?? 0) +
                      (adminData.offerteStats?.afgewezen ?? 0)
                    }
                    gemiddeldeWaarde={
                      adminData.revenueStats?.averageOfferteValue ?? 0
                    }
                  />
                </BentoBlok>

                <BentoBlok span={DAGSTAAT_SPAN.lopendWerk} stap={6}>
                  <LopendWerkPaneel projecten={adminData.activeProjects ?? []} />
                </BentoBlok>

                <BentoBlok span={DAGSTAAT_SPAN.laatsteOffertes} stap={7}>
                  <LaatsteOffertesPaneel offertes={adminData.recentOffertes ?? []} />
                </BentoBlok>

                <BentoBlok span={DAGSTAAT_SPAN.vloot} stap={8}>
                  <VlootBadge
                    hasIssues={adminData.vlootSummary?.hasIssues ?? false}
                    issueCount={adminData.vlootSummary?.issueCount ?? 0}
                    summary={adminData.vlootSummary?.summary ?? "Alles operationeel"}
                  />
                </BentoBlok>
              </DagstaatBento>
            </>
          )}
        </div>
      )}
    </>
  );
}
