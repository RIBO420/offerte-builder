"use client";

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
import { Download, BarChart3, Trees } from "lucide-react";
import { useAnalytics } from "@/hooks/use-analytics";
import {
  KpiCards,
  SecondaryKpiCards,
  OfferteTrendChart,
  RevenueChart,
  ScopeMarginChart,
  ScopeProfitabilityChart,
  TopKlantenTable,
  AnalyticsDateFilter,
  PipelineFunnelChart,
  TrendForecastChart,
} from "@/components/analytics";
import { AnalyticsSkeleton } from "@/components/skeletons";
import { exportAnalyticsReport } from "@/lib/excel-export";

export default function RapportagesPage() {
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

        <AnimatePresence mode="wait">
          {isLoading ? (
            <motion.div
              key="loader"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3 }}
            >
              <AnalyticsSkeleton />
            </motion.div>
          ) : kpis ? (
            <motion.div
              key="content"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
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
                <Tabs defaultValue="overzicht" className="space-y-4">
                  <TabsList className="flex-wrap h-auto gap-1">
                    <TabsTrigger value="overzicht">Overzicht</TabsTrigger>
                    <TabsTrigger value="pipeline">Pipeline</TabsTrigger>
                    <TabsTrigger value="omzet">Omzet & Forecast</TabsTrigger>
                    <TabsTrigger value="klanten">Klanten</TabsTrigger>
                    <TabsTrigger value="marges">Winstgevendheid</TabsTrigger>
                  </TabsList>

                  {/* Overzicht Tab */}
                  <TabsContent value="overzicht" className="space-y-4">
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.3 }}
                    >
                      <OfferteTrendChart data={maandelijkseTrend} />
                    </motion.div>
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.3, delay: 0.1 }}
                      className="grid gap-4 lg:grid-cols-2"
                    >
                      <RevenueChart
                        monthlyData={maandelijkseTrend}
                        quarterlyData={kwartaalOmzet}
                      />
                      <ScopeMarginChart data={scopeMarges} />
                    </motion.div>
                  </TabsContent>

                  {/* Pipeline Tab - NEW */}
                  <TabsContent value="pipeline" className="space-y-4">
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.3 }}
                      className="grid gap-4 lg:grid-cols-2"
                    >
                      <PipelineFunnelChart
                        data={pipelineFunnel}
                        conversionRates={conversionRates}
                      />
                      <TopKlantenTable klanten={topKlanten} />
                    </motion.div>
                  </TabsContent>

                  {/* Omzet & Forecast Tab - ENHANCED */}
                  <TabsContent value="omzet" className="space-y-4">
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.3 }}
                    >
                      <TrendForecastChart
                        data={maandelijkseTrend}
                        forecast={forecast}
                      />
                    </motion.div>
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.3, delay: 0.1 }}
                    >
                      <RevenueChart
                        monthlyData={maandelijkseTrend}
                        quarterlyData={kwartaalOmzet}
                      />
                    </motion.div>
                  </TabsContent>

                  {/* Klanten Tab */}
                  <TabsContent value="klanten" className="space-y-4">
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.3 }}
                    >
                      <TopKlantenTable klanten={topKlanten} />
                    </motion.div>
                  </TabsContent>

                  {/* Winstgevendheid Tab - ENHANCED */}
                  <TabsContent value="marges" className="space-y-4">
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.3 }}
                    >
                      <ScopeProfitabilityChart
                        data={scopeMarges}
                        totalRevenue={totalScopeRevenue}
                      />
                    </motion.div>
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.3, delay: 0.1 }}
                    >
                      <ScopeMarginChart data={scopeMarges} />
                    </motion.div>
                  </TabsContent>
                </Tabs>
              </motion.div>
            </motion.div>
          ) : (
            <motion.div
              key="empty"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.4 }}
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
