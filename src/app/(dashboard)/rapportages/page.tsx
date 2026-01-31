"use client";

import { useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
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
import { Download, BarChart3, Loader2 } from "lucide-react";
import { useReducedMotion } from "@/hooks/use-accessibility";
import { useAnalytics } from "@/hooks/use-analytics";
import {
  AnalyticsDateFilter,
  // Use dynamic imports for heavy chart components (recharts ~200KB)
  DynamicKpiCards as KpiCards,
  DynamicSecondaryKpiCards as SecondaryKpiCards,
  DynamicOfferteTrendChart as OfferteTrendChart,
  DynamicRevenueChart as RevenueChart,
  DynamicScopeMarginChart as ScopeMarginChart,
  DynamicScopeProfitabilityChart as ScopeProfitabilityChart,
  DynamicTopKlantenTable as TopKlantenTable,
  DynamicPipelineFunnelChart as PipelineFunnelChart,
  DynamicTrendForecastChart as TrendForecastChart,
} from "@/components/analytics";

// Dynamic import for excel export (xlsx ~400KB)
const exportAnalyticsReport = async (
  kpis: Parameters<typeof import("@/lib/excel-export").exportAnalyticsReport>[0],
  topKlanten: Parameters<typeof import("@/lib/excel-export").exportAnalyticsReport>[1],
  scopeMarges: Parameters<typeof import("@/lib/excel-export").exportAnalyticsReport>[2],
  exportData: Parameters<typeof import("@/lib/excel-export").exportAnalyticsReport>[3],
  filename: string
) => {
  const { exportAnalyticsReport: doExport } = await import("@/lib/excel-export");
  return doExport(kpis, topKlanten, scopeMarges, exportData, filename);
};

export default function RapportagesPage() {
  const reducedMotion = useReducedMotion();
  const [activeTab, setActiveTab] = useState("overzicht");
  const {
    kpis,
    maandelijkseTrend,
    kwartaalOmzet,
    scopeMarges,
    totalScopeRevenue,
    topKlanten,
    exportData,
    isLoading,
    datePreset,
    setPreset,
    pipelineFunnel,
    conversionRates,
    forecast,
  } = useAnalytics();

  const handleExport = useCallback(() => {
    if (!kpis) return;
    exportAnalyticsReport(
      kpis,
      topKlanten,
      scopeMarges,
      exportData,
      "top-tuinen-rapportage"
    );
  }, [kpis, topKlanten, scopeMarges, exportData]);

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

        <AnimatePresence mode="popLayout">
          {isLoading ? (
            <motion.div
              key="loader"
              initial={reducedMotion ? false : { opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={reducedMotion ? undefined : { opacity: 0 }}
              transition={{ duration: reducedMotion ? 0 : 0.15 }}
              className="flex items-center justify-center py-20"
            >
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </motion.div>
          ) : kpis ? (
            <motion.div
              key="content"
              initial={reducedMotion ? false : { opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: reducedMotion ? 0 : 0.3 }}
              className="space-y-4"
            >
              {/* Primary KPI Cards */}
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: 0.1 }}
              >
                <KpiCards kpis={kpis} />
              </motion.div>

              {/* Secondary KPI Cards - New Insights */}
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: 0.15 }}
              >
                <SecondaryKpiCards kpis={kpis} />
              </motion.div>

              {/* Tabs */}
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: 0.2 }}
              >
                <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
                  <TabsList className="flex-wrap h-auto gap-1">
                    <TabsTrigger value="overzicht">Overzicht</TabsTrigger>
                    <TabsTrigger value="pipeline">Pipeline</TabsTrigger>
                    <TabsTrigger value="omzet">Omzet & Forecast</TabsTrigger>
                    <TabsTrigger value="klanten">Klanten</TabsTrigger>
                    <TabsTrigger value="marges">Winstgevendheid</TabsTrigger>
                  </TabsList>

                  <AnimatePresence mode="wait">
                    {/* Overzicht Tab */}
                    {activeTab === "overzicht" && (
                      <motion.div
                        key="overzicht"
                        initial={reducedMotion ? false : { opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={reducedMotion ? undefined : { opacity: 0, y: -8 }}
                        transition={{ duration: reducedMotion ? 0 : 0.2 }}
                      >
                        <TabsContent value="overzicht" className="space-y-4" forceMount>
                          <OfferteTrendChart data={maandelijkseTrend} />
                          <div className="grid gap-4 lg:grid-cols-2">
                            <RevenueChart
                              monthlyData={maandelijkseTrend}
                              quarterlyData={kwartaalOmzet}
                            />
                            <ScopeMarginChart data={scopeMarges} />
                          </div>
                        </TabsContent>
                      </motion.div>
                    )}

                    {/* Pipeline Tab */}
                    {activeTab === "pipeline" && (
                      <motion.div
                        key="pipeline"
                        initial={reducedMotion ? false : { opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={reducedMotion ? undefined : { opacity: 0, y: -8 }}
                        transition={{ duration: reducedMotion ? 0 : 0.2 }}
                      >
                        <TabsContent value="pipeline" className="space-y-4" forceMount>
                          <div className="grid gap-4 lg:grid-cols-2">
                            <PipelineFunnelChart
                              data={pipelineFunnel}
                              conversionRates={conversionRates}
                            />
                            <TopKlantenTable klanten={topKlanten} />
                          </div>
                        </TabsContent>
                      </motion.div>
                    )}

                    {/* Omzet & Forecast Tab */}
                    {activeTab === "omzet" && (
                      <motion.div
                        key="omzet"
                        initial={reducedMotion ? false : { opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={reducedMotion ? undefined : { opacity: 0, y: -8 }}
                        transition={{ duration: reducedMotion ? 0 : 0.2 }}
                      >
                        <TabsContent value="omzet" className="space-y-4" forceMount>
                          <TrendForecastChart
                            data={maandelijkseTrend}
                            forecast={forecast}
                          />
                          <RevenueChart
                            monthlyData={maandelijkseTrend}
                            quarterlyData={kwartaalOmzet}
                          />
                        </TabsContent>
                      </motion.div>
                    )}

                    {/* Klanten Tab */}
                    {activeTab === "klanten" && (
                      <motion.div
                        key="klanten"
                        initial={reducedMotion ? false : { opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={reducedMotion ? undefined : { opacity: 0, y: -8 }}
                        transition={{ duration: reducedMotion ? 0 : 0.2 }}
                      >
                        <TabsContent value="klanten" className="space-y-4" forceMount>
                          <TopKlantenTable klanten={topKlanten} />
                        </TabsContent>
                      </motion.div>
                    )}

                    {/* Winstgevendheid Tab */}
                    {activeTab === "marges" && (
                      <motion.div
                        key="marges"
                        initial={reducedMotion ? false : { opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={reducedMotion ? undefined : { opacity: 0, y: -8 }}
                        transition={{ duration: reducedMotion ? 0 : 0.2 }}
                      >
                        <TabsContent value="marges" className="space-y-4" forceMount>
                          <ScopeProfitabilityChart
                            data={scopeMarges}
                            totalRevenue={totalScopeRevenue}
                          />
                          <ScopeMarginChart data={scopeMarges} />
                        </TabsContent>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </Tabs>
              </motion.div>
            </motion.div>
          ) : (
            <motion.div
              key="empty"
              initial={reducedMotion ? false : { opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={reducedMotion ? undefined : { opacity: 0 }}
              transition={{ duration: reducedMotion ? 0 : 0.3 }}
              className="flex flex-col items-center justify-center py-12 text-center"
            >
              <motion.div
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{
                  duration: 0.5,
                  ease: [0.16, 1, 0.3, 1],
                }}
                className="relative"
              >
                {/* Subtle glow effect */}
                <motion.div
                  className="absolute inset-0 rounded-2xl bg-gradient-to-br from-emerald-500/20 to-green-600/20 blur-xl"
                  animate={{
                    opacity: [0.3, 0.5, 0.3],
                    scale: [1, 1.1, 1],
                  }}
                  transition={{
                    duration: 3,
                    repeat: Infinity,
                    ease: "easeInOut",
                  }}
                />
                <div className="relative flex h-16 w-16 items-center justify-center rounded-2xl bg-muted">
                  <BarChart3 className="h-8 w-8 text-muted-foreground" />
                </div>
              </motion.div>
              <h3 className="mt-4 text-lg font-semibold">Geen data beschikbaar</h3>
              <p className="mt-2 text-muted-foreground">
                Maak eerst enkele offertes aan om je rapportages te bekijken.
              </p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </>
  );
}
