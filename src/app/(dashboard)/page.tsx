"use client";

import Link from "next/link";
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
  Loader2,
} from "lucide-react";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbPage,
} from "@/components/ui/breadcrumb";
import { Separator } from "@/components/ui/separator";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Badge } from "@/components/ui/badge";
import { useCurrentUser } from "@/hooks/use-current-user";
import { useOffertes } from "@/hooks/use-offertes";

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

const statusColors: Record<string, string> = {
  concept: "bg-gray-100 text-gray-800",
  definitief: "bg-blue-100 text-blue-800",
  verzonden: "bg-yellow-100 text-yellow-800",
  geaccepteerd: "bg-green-100 text-green-800",
  afgewezen: "bg-red-100 text-red-800",
};

export default function DashboardPage() {
  const { user, clerkUser, isLoading: isUserLoading } = useCurrentUser();
  const { stats, recentOffertes, isLoading: isOffertesLoading } = useOffertes();

  const isLoading = isUserLoading || isOffertesLoading;

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

      <div className="flex flex-1 flex-col gap-4 p-4 md:gap-8 md:p-8">
        <div className="grid gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight md:text-3xl">
              Welkom{clerkUser?.firstName ? `, ${clerkUser.firstName}` : ""}!
            </h1>
            <p className="text-muted-foreground">
              Beheer je offertes en maak nieuwe aanleg- of onderhoudsoffertes.
            </p>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="grid gap-4 md:grid-cols-2">
          <Card className="border-2 border-dashed hover:border-primary hover:bg-muted/50 transition-colors">
            <Link href="/offertes/nieuw/aanleg" className="block">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                    <Shovel className="h-5 w-5 text-primary" />
                  </div>
                  Nieuwe Aanleg Offerte
                </CardTitle>
                <CardDescription>
                  Voor nieuwe tuinprojecten en renovaties met grondwerk,
                  bestrating, borders, houtwerk en meer.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button className="w-full">
                  <Plus className="mr-2 h-4 w-4" />
                  Start Aanleg Offerte
                </Button>
              </CardContent>
            </Link>
          </Card>

          <Card className="border-2 border-dashed hover:border-primary hover:bg-muted/50 transition-colors">
            <Link href="/offertes/nieuw/onderhoud" className="block">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-green-100 dark:bg-green-900/20">
                    <Trees className="h-5 w-5 text-green-600" />
                  </div>
                  Nieuwe Onderhoud Offerte
                </CardTitle>
                <CardDescription>
                  Voor periodiek tuinonderhoud met gras, borders, heggen, bomen
                  en overige werkzaamheden.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button variant="secondary" className="w-full">
                  <Plus className="mr-2 h-4 w-4" />
                  Start Onderhoud Offerte
                </Button>
              </CardContent>
            </Link>
          </Card>
        </div>

        {/* Stats Overview */}
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Totaal Offertes
              </CardTitle>
              <FileText className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <>
                  <div className="text-2xl font-bold">{stats?.totaal || 0}</div>
                  <p className="text-xs text-muted-foreground">
                    {stats?.totaalWaarde
                      ? formatCurrency(stats.totaalWaarde)
                      : "Nog geen offertes"}
                  </p>
                </>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Concepten</CardTitle>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <>
                  <div className="text-2xl font-bold">
                    {stats?.concept || 0}
                  </div>
                  <p className="text-xs text-muted-foreground">In bewerking</p>
                </>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Verzonden</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <>
                  <div className="text-2xl font-bold">
                    {stats?.verzonden || 0}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Wachten op reactie
                  </p>
                </>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Geaccepteerd
              </CardTitle>
              <CheckCircle className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <>
                  <div className="text-2xl font-bold">
                    {stats?.geaccepteerd || 0}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {stats?.geaccepteerdWaarde
                      ? formatCurrency(stats.geaccepteerdWaarde)
                      : "Opdrachten"}
                  </p>
                </>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Recent Activity */}
        <Card>
          <CardHeader>
            <CardTitle>Recente Offertes</CardTitle>
            <CardDescription>
              Je laatst aangemaakte en bewerkte offertes
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
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
                      <Badge className={statusColors[offerte.status]}>
                        {offerte.status}
                      </Badge>
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
      </div>
    </>
  );
}
