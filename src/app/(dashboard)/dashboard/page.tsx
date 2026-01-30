"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
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
        {/* Welcome Header - Compact */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-xl font-semibold tracking-tight md:text-2xl">
              Welkom{clerkUser?.firstName ? `, ${clerkUser.firstName}` : ""}!
            </h1>
            <p className="text-sm text-muted-foreground">
              Beheer je offertes en maak nieuwe aanleg- of onderhoudsoffertes.
            </p>
          </div>
          <div className="flex gap-2">
            <Button asChild variant="default" size="sm">
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
        </div>

        {/* Stats Overview with StatsGrid */}
        <section>
          <h2 className="text-sm font-medium text-muted-foreground mb-3">Overzicht</h2>
          <StatsGrid
            stats={statsData}
            columns={4}
            loading={!!isLoading}
          />
        </section>

        {/* Pipeline View */}
        <section>
          <h2 className="text-sm font-medium text-muted-foreground mb-3">Offerte Pipeline</h2>
          <Card className="p-4">
            <PipelineView
              stages={pipelineStages}
              onStageClick={handleStageClick}
            />
          </Card>
        </section>

        {/* Quick Actions - Enhanced */}
        <section>
          <h2 className="text-sm font-medium text-muted-foreground mb-3">Snel Starten</h2>
          <div className="grid gap-4 md:grid-cols-2">
            <Card className="card-interactive border-2 border-dashed hover:border-primary transition-colors">
              <Link href="/offertes/nieuw/aanleg" className="block p-4">
                <div className="flex items-start gap-4">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                    <Shovel className="h-6 w-6 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold">Nieuwe Aanleg Offerte</h3>
                    <p className="text-sm text-muted-foreground mt-1">
                      Voor nieuwe tuinprojecten en renovaties met grondwerk, bestrating, borders en meer.
                    </p>
                    <Button variant="default" size="sm" className="mt-3">
                      <Plus className="mr-2 h-4 w-4" />
                      Start Aanleg Offerte
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </Link>
            </Card>

            <Card className="card-interactive border-2 border-dashed hover:border-green-500 transition-colors">
              <Link href="/offertes/nieuw/onderhoud" className="block p-4">
                <div className="flex items-start gap-4">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-green-100 dark:bg-green-900/20">
                    <Trees className="h-6 w-6 text-green-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold">Nieuwe Onderhoud Offerte</h3>
                    <p className="text-sm text-muted-foreground mt-1">
                      Voor periodiek tuinonderhoud met gras, borders, heggen en overige werkzaamheden.
                    </p>
                    <Button variant="default" size="sm" className="mt-3 bg-green-600 hover:bg-green-700">
                      <Plus className="mr-2 h-4 w-4" />
                      Start Onderhoud Offerte
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </Link>
            </Card>
          </div>
        </section>

        {/* Recent Activity */}
        <section>
          <h2 className="text-sm font-medium text-muted-foreground mb-3">Recente Activiteit</h2>
        <Card className="card-interactive">
          <CardHeader>
            <CardTitle>Recente Offertes</CardTitle>
            <CardDescription>
              Je laatst aangemaakte en bewerkte offertes
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <RecentOffertesListSkeleton count={5} />
            ) : recentOffertes && recentOffertes.length > 0 ? (
              <div className="space-y-4">
                {recentOffertes.map((offerte) => (
                  <Link
                    key={offerte._id}
                    href={`/offertes/${offerte._id}`}
                    className="flex items-center justify-between rounded-lg border p-4 hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex items-center gap-4">
                      <div
                        className={`flex h-10 w-10 items-center justify-center rounded-lg ${
                          offerte.type === "aanleg"
                            ? "bg-primary/10"
                            : "bg-green-100"
                        }`}
                      >
                        {offerte.type === "aanleg" ? (
                          <Shovel className="h-5 w-5 text-primary" />
                        ) : (
                          <Trees className="h-5 w-5 text-green-600" />
                        )}
                      </div>
                      <div>
                        <p className="font-medium">{offerte.klant.naam}</p>
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
                    </div>
                  </Link>
                ))}
                <div className="flex justify-center pt-2">
                  <Button variant="outline" asChild>
                    <Link href="/offertes">Alle offertes bekijken</Link>
                  </Button>
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <FileText className="h-12 w-12 text-muted-foreground/50" />
                <h3 className="mt-4 text-lg font-semibold">Geen offertes</h3>
                <p className="mt-2 text-sm text-muted-foreground">
                  Je hebt nog geen offertes aangemaakt. Start met een nieuwe
                  offerte!
                </p>
                <div className="mt-4 flex gap-2">
                  <Button asChild size="sm">
                    <Link href="/offertes/nieuw/aanleg">
                      <Shovel className="mr-2 h-4 w-4" />
                      Aanleg
                    </Link>
                  </Button>
                  <Button asChild variant="outline" size="sm">
                    <Link href="/offertes/nieuw/onderhoud">
                      <Trees className="mr-2 h-4 w-4" />
                      Onderhoud
                    </Link>
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
        </section>
      </div>
    </>
  );
}
