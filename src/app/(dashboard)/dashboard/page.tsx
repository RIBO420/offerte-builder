"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  FileText,
  Plus,
  Shovel,
  Trees,
  TrendingUp,
  Clock,
  CheckCircle,
  ArrowRight,
  Sparkles,
  BarChart3,
  GitBranch,
} from "lucide-react";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbPage,
} from "@/components/ui/breadcrumb";
import { Separator } from "@/components/ui/separator";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { StatusBadge } from "@/components/ui/status-badge";
import { StatsGrid } from "@/components/ui/stats-grid";
import { PipelineView } from "@/components/ui/pipeline-view";
import { RecentOffertesListSkeleton } from "@/components/skeletons";
import { useCurrentUser } from "@/hooks/use-current-user";
import { useDashboardData } from "@/hooks/use-offertes";
import type { OfferteStatus } from "@/lib/constants/statuses";

// Section badge component for consistent styling
function SectionBadge({ icon: Icon, children }: { icon: React.ElementType; children: React.ReactNode }) {
  return (
    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-medium mb-4">
      <Icon className="h-3.5 w-3.5" />
      {children}
    </div>
  );
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("nl-NL", {
    style: "currency",
    currency: "EUR",
  }).format(amount);
}

function formatDate(timestamp: number): string {
  return new Intl.DateTimeFormat("nl-NL", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(timestamp));
}

export default function DashboardPage() {
  const router = useRouter();
  const { clerkUser, isLoading: isUserLoading } = useCurrentUser();
  const { stats, recentOffertes, isLoading: isOffertesLoading } = useDashboardData();

  const isLoading = isUserLoading || isOffertesLoading;

  // Stats data for StatsGrid with trend data
  const statsData = [
    {
      title: "Totaal Offertes",
      value: stats?.totaal || 0,
      description: stats?.totaalWaarde ? formatCurrency(stats.totaalWaarde) : "Nog geen offertes",
      icon: <FileText className="h-4 w-4" />,
      trend: { direction: "up" as const, percentage: 12, label: "vs vorige maand" },
    },
    {
      title: "Concepten",
      value: stats?.concept || 0,
      description: "In bewerking",
      icon: <Clock className="h-4 w-4" />,
      trend: { direction: "neutral" as const, percentage: 0 },
    },
    {
      title: "Verzonden",
      value: stats?.verzonden || 0,
      description: "Wachten op reactie",
      icon: <TrendingUp className="h-4 w-4" />,
      trend: { direction: "up" as const, percentage: 8, label: "vs vorige maand" },
    },
    {
      title: "Geaccepteerd",
      value: stats?.geaccepteerd || 0,
      description: stats?.geaccepteerdWaarde ? formatCurrency(stats.geaccepteerdWaarde) : "Opdrachten",
      icon: <CheckCircle className="h-4 w-4" />,
      trend: { direction: "up" as const, percentage: 15, label: "vs vorige maand" },
    },
  ];

  // Pipeline stages data
  const pipelineStages = [
    { id: "concept", label: "Concept", count: stats?.concept || 0 },
    { id: "definitief", label: "Definitief", count: stats?.definitief || 0 },
    { id: "verzonden", label: "Verzonden", count: stats?.verzonden || 0 },
    { id: "geaccepteerd", label: "Geaccepteerd", count: stats?.geaccepteerd || 0 },
    { id: "afgewezen", label: "Afgewezen", count: stats?.afgewezen || 0 },
  ];

  const handleStageClick = (stageId: string) => {
    router.push(`/offertes?status=${stageId}`);
  };

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

      <div className="flex flex-1 flex-col gap-6 p-6 md:gap-8 md:p-8">
        {/* Welcome Header - Premium Styled */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: "easeOut" }}
          className="relative overflow-hidden rounded-xl bg-gradient-to-br from-emerald-50 via-green-50 to-teal-50 dark:from-emerald-950/30 dark:via-green-950/20 dark:to-teal-950/30 p-6 border border-emerald-100 dark:border-emerald-900/50"
        >
          {/* Decorative background elements */}
          <div className="absolute top-0 right-0 -mt-4 -mr-4 h-24 w-24 rounded-full bg-gradient-to-br from-emerald-200/40 to-green-200/40 dark:from-emerald-800/20 dark:to-green-800/20 blur-2xl" />
          <div className="absolute bottom-0 left-0 -mb-4 -ml-4 h-20 w-20 rounded-full bg-gradient-to-tr from-teal-200/40 to-emerald-200/40 dark:from-teal-800/20 dark:to-emerald-800/20 blur-2xl" />

          <div className="relative flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              {/* Decorative badge */}
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.4, delay: 0.2 }}
                className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 dark:bg-emerald-900/50 px-3 py-1 text-xs font-medium text-emerald-700 dark:text-emerald-300 mb-3 border border-emerald-200 dark:border-emerald-800"
              >
                <Sparkles className="h-3 w-3" />
                Dashboard
              </motion.div>

              <motion.h1
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.4, delay: 0.1 }}
                className="text-xl font-semibold tracking-tight md:text-2xl text-gray-900 dark:text-gray-100"
              >
                Welkom{clerkUser?.firstName ? `, ${clerkUser.firstName}` : ""}!
              </motion.h1>
              <motion.p
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.4, delay: 0.2 }}
                className="text-sm text-muted-foreground mt-1"
              >
                Beheer je offertes en maak nieuwe aanleg- of onderhoudsoffertes.
              </motion.p>
            </div>
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.4, delay: 0.3 }}
              className="flex gap-2"
            >
              <Button asChild size="sm" className="bg-gradient-to-r from-emerald-600 to-green-600 hover:from-emerald-700 hover:to-green-700 text-white shadow-md shadow-emerald-500/20 transition-all duration-200 hover:shadow-lg hover:shadow-emerald-500/30">
                <Link href="/offertes/nieuw/aanleg">
                  <Shovel className="mr-2 h-4 w-4" />
                  Nieuwe Aanleg
                </Link>
              </Button>
              <Button asChild variant="outline" size="sm" className="border-emerald-200 dark:border-emerald-800 hover:bg-emerald-50 dark:hover:bg-emerald-950/50 transition-all duration-200">
                <Link href="/offertes/nieuw/onderhoud">
                  <Trees className="mr-2 h-4 w-4" />
                  Nieuw Onderhoud
                </Link>
              </Button>
            </motion.div>
          </div>
        </motion.div>

        {/* Stats Overview with StatsGrid - Premium Styled */}
        <motion.section
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.2 }}
        >
          <SectionBadge icon={BarChart3}>Overzicht</SectionBadge>
          <StatsGrid
            stats={statsData}
            columns={4}
            loading={!!isLoading}
            animated={!isLoading}
            className="[&>div>div]:dark:bg-card/80 [&>div>div]:dark:backdrop-blur-sm [&>div>div]:dark:border-white/10 [&>div>div]:transition-all [&>div>div]:duration-300 [&>div>div]:hover:shadow-lg [&>div>div]:hover:shadow-emerald-500/5 [&>div>div]:hover:border-emerald-500/20 [&>div>div]:dark:hover:border-emerald-500/30"
          />
        </motion.section>

        {/* Pipeline View - Premium Styled */}
        <motion.section
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.3 }}
        >
          <SectionBadge icon={GitBranch}>Offerte Pipeline</SectionBadge>
          <Card className="p-4 dark:bg-card/80 dark:backdrop-blur-sm dark:border-white/10 transition-all duration-300 hover:shadow-lg hover:shadow-emerald-500/5 hover:border-emerald-500/20 dark:hover:border-emerald-500/30">
            <PipelineView
              stages={pipelineStages}
              onStageClick={handleStageClick}
            />
          </Card>
        </motion.section>

        {/* Quick Actions - Enhanced with Glassmorphism */}
        <motion.section
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.4 }}
        >
          <SectionBadge icon={Sparkles}>Snel Starten</SectionBadge>
          <div className="grid gap-4 md:grid-cols-2">
            <motion.div
              whileHover={{ scale: 1.02, y: -4 }}
              transition={{ type: "spring", stiffness: 300, damping: 20 }}
              className="group relative"
            >
              <div className="absolute -inset-0.5 -z-10 rounded-xl bg-gradient-to-r from-primary/25 to-primary/15 opacity-0 blur-lg transition-opacity duration-300 group-hover:opacity-100" />
              <Card className="relative bg-white/5 backdrop-blur-sm border-white/10 dark:border-white/10 border-2 border-dashed hover:border-primary/50 transition-all duration-300 overflow-hidden">
                <Link href="/offertes/nieuw/aanleg" className="block p-4">
                  <div className="flex items-start gap-4">
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-primary to-primary/60 shadow-lg shadow-primary/25">
                      <Shovel className="h-6 w-6 text-primary-foreground" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold">Nieuwe Aanleg Offerte</h3>
                      <p className="text-sm text-muted-foreground mt-1">
                        Voor nieuwe tuinprojecten en renovaties met grondwerk, bestrating, borders en meer.
                      </p>
                      <Button variant="default" size="sm" className="mt-3">
                        <Plus className="mr-2 h-4 w-4" />
                        Start Aanleg Offerte
                        <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
                      </Button>
                    </div>
                  </div>
                </Link>
              </Card>
            </motion.div>

            <motion.div
              whileHover={{ scale: 1.02, y: -4 }}
              transition={{ type: "spring", stiffness: 300, damping: 20 }}
              className="group relative"
            >
              <div className="absolute -inset-0.5 -z-10 rounded-xl bg-gradient-to-r from-green-500/25 to-emerald-500/15 opacity-0 blur-lg transition-opacity duration-300 group-hover:opacity-100" />
              <Card className="relative bg-white/5 backdrop-blur-sm border-white/10 dark:border-white/10 border-2 border-dashed hover:border-green-500/50 transition-all duration-300 overflow-hidden">
                <Link href="/offertes/nieuw/onderhoud" className="block p-4">
                  <div className="flex items-start gap-4">
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-green-500 to-emerald-600 shadow-lg shadow-green-500/25">
                      <Trees className="h-6 w-6 text-white" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold">Nieuwe Onderhoud Offerte</h3>
                      <p className="text-sm text-muted-foreground mt-1">
                        Voor periodiek tuinonderhoud met gras, borders, heggen en overige werkzaamheden.
                      </p>
                      <Button variant="default" size="sm" className="mt-3 bg-green-600 hover:bg-green-700">
                        <Plus className="mr-2 h-4 w-4" />
                        Start Onderhoud Offerte
                        <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
                      </Button>
                    </div>
                  </div>
                </Link>
              </Card>
            </motion.div>
          </div>
        </motion.section>

        {/* Recent Activity - Enhanced with Staggered Animations */}
        <motion.section
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.5 }}
        >
          <SectionBadge icon={Clock}>Recente Activiteit</SectionBadge>
          <Card className="dark:bg-card/80 dark:backdrop-blur-sm dark:border-white/10 transition-all duration-300 hover:shadow-lg hover:shadow-emerald-500/5">
            <CardHeader>
              <CardTitle>Recente Offertes</CardTitle>
              <CardDescription>
                Je laatst aangemaakte en bewerkte offertes
              </CardDescription>
            </CardHeader>
            <CardContent>
              <AnimatePresence mode="wait">
                {isLoading ? (
                  <motion.div
                    key="skeleton"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.3 }}
                  >
                    <RecentOffertesListSkeleton count={5} />
                  </motion.div>
                ) : recentOffertes && recentOffertes.length > 0 ? (
                  <motion.div
                    key="content"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.4 }}
                    className="space-y-3"
                  >
                    {recentOffertes.map((offerte, index) => (
                      <motion.div
                        key={offerte._id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.3, delay: index * 0.08 }}
                      >
                        <Link
                          href={`/offertes/${offerte._id}`}
                          className="group flex items-center justify-between rounded-lg border p-4 transition-all duration-200 hover:bg-muted/50 hover:border-emerald-500/30 hover:shadow-md hover:shadow-emerald-500/5 dark:hover:border-emerald-500/40"
                        >
                          <div className="flex items-center gap-4">
                            <div
                              className={`flex h-10 w-10 items-center justify-center rounded-lg transition-transform duration-200 group-hover:scale-110 ${
                                offerte.type === "aanleg"
                                  ? "bg-gradient-to-br from-primary/20 to-primary/10 dark:from-primary/30 dark:to-primary/10"
                                  : "bg-gradient-to-br from-green-100 to-green-50 dark:from-green-900/30 dark:to-green-900/10"
                              }`}
                            >
                              {offerte.type === "aanleg" ? (
                                <Shovel className="h-5 w-5 text-primary" />
                              ) : (
                                <Trees className="h-5 w-5 text-green-600" />
                              )}
                            </div>
                            <div>
                              <p className="font-medium group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors">{offerte.klant.naam}</p>
                              <p className="text-sm text-muted-foreground">
                                {offerte.offerteNummer} • {offerte.klant.plaats}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-4">
                            <div className="text-right">
                              <p className="font-medium">
                                {formatCurrency(offerte.totalen.totaalInclBtw)}
                              </p>
                              <p className="text-sm text-muted-foreground">
                                {formatDate(offerte.updatedAt)}
                              </p>
                            </div>
                            <StatusBadge status={offerte.status as OfferteStatus} size="sm" />
                            <ArrowRight className="h-4 w-4 text-muted-foreground opacity-0 transition-all duration-200 group-hover:opacity-100 group-hover:translate-x-1" />
                          </div>
                        </Link>
                      </motion.div>
                    ))}
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ duration: 0.3, delay: recentOffertes.length * 0.08 + 0.1 }}
                      className="flex justify-center pt-4"
                    >
                      <Button variant="outline" asChild className="hover:border-emerald-500/50 hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors">
                        <Link href="/offertes">
                          Alle offertes bekijken
                          <ArrowRight className="ml-2 h-4 w-4" />
                        </Link>
                      </Button>
                    </motion.div>
                  </motion.div>
                ) : (
                  <motion.div
                    key="empty"
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.4 }}
                    className="relative flex flex-col items-center justify-center py-12 text-center"
                  >
                    {/* Decorative gradient background for empty state */}
                    <div className="absolute inset-0 rounded-lg bg-gradient-to-br from-emerald-50/50 via-transparent to-green-50/50 dark:from-emerald-950/20 dark:to-green-950/20" />
                    <div className="absolute top-4 right-4 h-16 w-16 rounded-full bg-gradient-to-br from-emerald-200/30 to-green-200/30 dark:from-emerald-800/10 dark:to-green-800/10 blur-xl" />
                    <div className="absolute bottom-4 left-4 h-12 w-12 rounded-full bg-gradient-to-tr from-teal-200/30 to-emerald-200/30 dark:from-teal-800/10 dark:to-emerald-800/10 blur-xl" />

                    <motion.div
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ duration: 0.4 }}
                      className="relative"
                    >
                      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-emerald-100 to-green-100 dark:from-emerald-900/50 dark:to-green-900/50 mb-4">
                        <FileText className="h-8 w-8 text-emerald-600 dark:text-emerald-400" />
                      </div>
                    </motion.div>
                    <h3 className="relative mt-2 text-lg font-semibold">Geen offertes</h3>
                    <p className="relative mt-2 text-sm text-muted-foreground max-w-xs">
                      Je hebt nog geen offertes aangemaakt. Start met een nieuwe
                      offerte!
                    </p>
                    <div className="relative mt-6 flex gap-3">
                      <Button asChild size="sm" className="bg-gradient-to-r from-emerald-600 to-green-600 hover:from-emerald-700 hover:to-green-700 text-white shadow-md shadow-emerald-500/20">
                        <Link href="/offertes/nieuw/aanleg">
                          <Shovel className="mr-2 h-4 w-4" />
                          Aanleg
                        </Link>
                      </Button>
                      <Button asChild variant="outline" size="sm" className="hover:border-green-500/50 hover:text-green-600 dark:hover:text-green-400">
                        <Link href="/offertes/nieuw/onderhoud">
                          <Trees className="mr-2 h-4 w-4" />
                          Onderhoud
                        </Link>
                      </Button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </CardContent>
          </Card>
        </motion.section>
      </div>
    </>
  );
}
