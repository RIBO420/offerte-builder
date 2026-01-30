"use client";

import { SidebarTrigger } from "@/components/ui/sidebar";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Download, BarChart3 } from "lucide-react";
import { useAnalytics } from "@/hooks/use-analytics";
import {
  KpiCards,
  OfferteTrendChart,
  RevenueChart,
  ScopeMarginChart,
  TopKlantenTable,
  AnalyticsDateFilter,
} from "@/components/analytics";
import { AnalyticsSkeleton } from "@/components/skeletons";
import { exportAnalyticsReport } from "@/lib/excel-export";

export default function RapportagesPage() {
  const {
    kpis,
    maandelijkseTrend,
    kwartaalOmzet,
    scopeMarges,
    topKlanten,
    exportData,
    isLoading,
    datePreset,
    setPreset,
  } = useAnalytics();

  const handleExport = () => {
    if (!kpis) return;
    exportAnalyticsReport(
      kpis,
      topKlanten,
      scopeMarges,
      exportData,
      "top-tuinen-rapportage"
    );
  };

  return (
    <>
      {/* Header */}
      <header className="flex h-16 shrink-0 items-center gap-2 border-b px-4">
        <SidebarTrigger className="-ml-1" />
        <Separator orientation="vertical" className="mr-2 h-4" />
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink href="/">Dashboard</BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbPage>Rapportages</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>
      </header>

      <div className="flex flex-1 flex-col gap-4 p-4 md:gap-6 md:p-6">
        {/* Page Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <BarChart3 className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight">Rapportages</h1>
              <p className="text-muted-foreground">
                Analyseer je offerte prestaties en omzet
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <AnalyticsDateFilter
              currentPreset={datePreset}
              onPresetChange={setPreset}
            />
            <Button
              onClick={handleExport}
              disabled={isLoading || !kpis}
              className="gap-2"
            >
              <Download className="h-4 w-4" />
              Export Excel
            </Button>
          </div>
        </div>

        {isLoading ? (
          <AnalyticsSkeleton />
        ) : kpis ? (
          <>
            {/* KPI Cards */}
            <KpiCards kpis={kpis} />

            {/* Tabs */}
            <Tabs defaultValue="overzicht" className="space-y-4">
              <TabsList>
                <TabsTrigger value="overzicht">Overzicht</TabsTrigger>
                <TabsTrigger value="omzet">Omzet</TabsTrigger>
                <TabsTrigger value="klanten">Klanten</TabsTrigger>
                <TabsTrigger value="marges">Marges</TabsTrigger>
              </TabsList>

              {/* Overzicht Tab */}
              <TabsContent value="overzicht" className="space-y-4">
                <OfferteTrendChart data={maandelijkseTrend} />
                <div className="grid gap-4 lg:grid-cols-2">
                  <RevenueChart
                    monthlyData={maandelijkseTrend}
                    quarterlyData={kwartaalOmzet}
                  />
                  <ScopeMarginChart data={scopeMarges} />
                </div>
              </TabsContent>

              {/* Omzet Tab */}
              <TabsContent value="omzet" className="space-y-4">
                <RevenueChart
                  monthlyData={maandelijkseTrend}
                  quarterlyData={kwartaalOmzet}
                />
                <OfferteTrendChart data={maandelijkseTrend} />
              </TabsContent>

              {/* Klanten Tab */}
              <TabsContent value="klanten" className="space-y-4">
                <TopKlantenTable klanten={topKlanten} />
              </TabsContent>

              {/* Marges Tab */}
              <TabsContent value="marges" className="space-y-4">
                <ScopeMarginChart data={scopeMarges} />
              </TabsContent>
            </Tabs>
          </>
        ) : (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <BarChart3 className="h-12 w-12 text-muted-foreground/50" />
            <h3 className="mt-4 text-lg font-semibold">Geen data beschikbaar</h3>
            <p className="mt-2 text-muted-foreground">
              Maak eerst enkele offertes aan om je rapportages te bekijken.
            </p>
          </div>
        )}
      </div>
    </>
  );
}
