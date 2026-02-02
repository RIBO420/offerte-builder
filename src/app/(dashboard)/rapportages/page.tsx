"use client";

import { useState, useCallback, Suspense } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { RequireAdmin } from "@/components/require-admin";
import { useTabState } from "@/hooks/use-tab-state";
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
import { Download, BarChart3, Loader2, Calculator, Users, FolderKanban } from "lucide-react";
import { useReducedMotion } from "@/hooks/use-accessibility";
import { useAnalytics } from "@/hooks/use-analytics";
import {
  EnhancedDateFilter,
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
  // New analytics components
  DynamicCalculatieVergelijking as CalculatieVergelijking,
  DynamicMedewerkerProductiviteit as MedewerkerProductiviteit,
  DynamicProjectPrestaties as ProjectPrestaties,
  DynamicFinancieelOverzicht as FinancieelOverzicht,
} from "@/components/analytics";
import type { DateRangePreset } from "@/components/analytics";

// Dynamic import for excel export (xlsx ~400KB)
const exportAnalyticsReport = async (
  kpis: Parameters<typeof import("@/lib/excel-export").exportAnalyticsReport>[0],
  topKlanten: Parameters<typeof import("@/lib/excel-export").exportAnalyticsReport>[1],
  scopeMarges: Parameters<typeof import("@/lib/excel-export").exportAnalyticsReport>[2],
  exportData: Parameters<typeof import("@/lib/excel-export").exportAnalyticsReport>[3],
  filename: string,
  maandelijkseTrend?: Parameters<typeof import("@/lib/excel-export").exportAnalyticsReport>[5]
) => {
  const { exportAnalyticsReport: doExport } = await import("@/lib/excel-export");
  return doExport(kpis, topKlanten, scopeMarges, exportData, filename, maandelijkseTrend);
};

// Sample data for new tabs (in production, this would come from the API)
const sampleCalculatieData = [
  { scope: "grondwerk", voorcalculatie: 15000, nacalculatie: 14200, variance: -800, variancePercentage: -5.3, projectCount: 8 },
  { scope: "bestrating", voorcalculatie: 28000, nacalculatie: 31500, variance: 3500, variancePercentage: 12.5, projectCount: 12 },
  { scope: "beplanting", voorcalculatie: 12000, nacalculatie: 11800, variance: -200, variancePercentage: -1.7, projectCount: 15 },
  { scope: "schutting", voorcalculatie: 8500, nacalculatie: 9200, variance: 700, variancePercentage: 8.2, projectCount: 6 },
  { scope: "verlichting", voorcalculatie: 4500, nacalculatie: 4300, variance: -200, variancePercentage: -4.4, projectCount: 4 },
  { scope: "arbeid", voorcalculatie: 35000, nacalculatie: 38500, variance: 3500, variancePercentage: 10.0, projectCount: 20 },
];

const sampleMedewerkerData = [
  { id: "1", naam: "Jan de Vries", uren: 168, declarabeleUren: 152, projecten: 8, efficiëntieRatio: 90, gemiddeldeUrenPerProject: 19, previousEfficiëntie: 87 },
  { id: "2", naam: "Pieter Jansen", uren: 160, declarabeleUren: 136, projecten: 6, efficiëntieRatio: 85, gemiddeldeUrenPerProject: 22.7, previousEfficiëntie: 82 },
  { id: "3", naam: "Klaas Bakker", uren: 152, declarabeleUren: 121.6, projecten: 7, efficiëntieRatio: 80, gemiddeldeUrenPerProject: 17.4, previousEfficiëntie: 83 },
  { id: "4", naam: "Willem Smit", uren: 144, declarabeleUren: 108, projecten: 5, efficiëntieRatio: 75, gemiddeldeUrenPerProject: 21.6, previousEfficiëntie: 72 },
  { id: "5", naam: "Henk Visser", uren: 136, declarabeleUren: 95.2, projecten: 4, efficiëntieRatio: 70, gemiddeldeUrenPerProject: 23.8, previousEfficiëntie: 74 },
];

const sampleProjectData = [
  { id: "1", naam: "Tuin Familie de Jong", klantNaam: "Familie de Jong", status: "afgerond" as const, startDatum: Date.now() - 30 * 24 * 60 * 60 * 1000, eindDatum: Date.now() - 5 * 24 * 60 * 60 * 1000, geplandEindDatum: Date.now() - 3 * 24 * 60 * 60 * 1000, budget: 15000, werkelijkeKosten: 13500, winstmarge: 28, isOpTijd: false, dagenOverschrijding: 2 },
  { id: "2", naam: "Bedrijfstuin Acme BV", klantNaam: "Acme BV", status: "gefactureerd" as const, startDatum: Date.now() - 45 * 24 * 60 * 60 * 1000, eindDatum: Date.now() - 15 * 24 * 60 * 60 * 1000, geplandEindDatum: Date.now() - 14 * 24 * 60 * 60 * 1000, budget: 35000, werkelijkeKosten: 28000, winstmarge: 32, isOpTijd: true },
  { id: "3", naam: "Terras Familie Bakker", klantNaam: "Familie Bakker", status: "in_uitvoering" as const, startDatum: Date.now() - 10 * 24 * 60 * 60 * 1000, geplandEindDatum: Date.now() + 5 * 24 * 60 * 60 * 1000, budget: 8500, werkelijkeKosten: 4200, winstmarge: 25, isOpTijd: true },
  { id: "4", naam: "Complete Tuin Villa", klantNaam: "Dhr. van Dijk", status: "gepland" as const, startDatum: Date.now() + 7 * 24 * 60 * 60 * 1000, geplandEindDatum: Date.now() + 28 * 24 * 60 * 60 * 1000, budget: 45000, werkelijkeKosten: 0, winstmarge: 30, isOpTijd: true },
  { id: "5", naam: "Onderhoud Kantoorpand", klantNaam: "Office Park", status: "afgerond" as const, startDatum: Date.now() - 20 * 24 * 60 * 60 * 1000, eindDatum: Date.now() - 12 * 24 * 60 * 60 * 1000, geplandEindDatum: Date.now() - 10 * 24 * 60 * 60 * 1000, budget: 5500, werkelijkeKosten: 5800, winstmarge: 18, isOpTijd: false, dagenOverschrijding: 2 },
];

const sampleKostenBreakdown = [
  { naam: "Arbeid", bedrag: 45000, percentage: 45, color: "#10b981" },
  { naam: "Materiaal", bedrag: 28000, percentage: 28, color: "#3b82f6" },
  { naam: "Transport", bedrag: 8000, percentage: 8, color: "#f59e0b" },
  { naam: "Machines", bedrag: 12000, percentage: 12, color: "#8b5cf6" },
  { naam: "Overig", bedrag: 7000, percentage: 7, color: "#ec4899" },
];

const sampleMaandelijksOverzicht = [
  { maand: "Jan", omzet: 42000, kosten: 31500, winst: 10500, marge: 25 },
  { maand: "Feb", omzet: 38000, kosten: 29260, winst: 8740, marge: 23 },
  { maand: "Mar", omzet: 55000, kosten: 40700, winst: 14300, marge: 26 },
  { maand: "Apr", omzet: 61000, kosten: 43920, winst: 17080, marge: 28 },
  { maand: "Mei", omzet: 72000, kosten: 51840, winst: 20160, marge: 28 },
  { maand: "Jun", omzet: 68000, kosten: 51680, winst: 16320, marge: 24 },
];

function RapportagesPageContent() {
  const reducedMotion = useReducedMotion();
  const [activeTab, setActiveTab] = useTabState("overzicht");
  const [comparisonEnabled, setComparisonEnabled] = useState(false);
  const [enhancedPreset, setEnhancedPreset] = useState<DateRangePreset>("dit-jaar");
  const [customDateRange, setCustomDateRange] = useState<{ from: Date; to: Date } | undefined>();

  const {
    kpis,
    maandelijkseTrend,
    kwartaalOmzet,
    scopeMarges,
    totalScopeRevenue,
    topKlanten,
    exportData,
    isLoading,
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
      "top-tuinen-rapportage",
      maandelijkseTrend
    );
  }, [kpis, topKlanten, scopeMarges, exportData, maandelijkseTrend]);

  // Map enhanced preset to analytics preset
  const handleEnhancedPresetChange = useCallback((preset: DateRangePreset) => {
    setEnhancedPreset(preset);
    // Map to existing analytics presets
    const mappedPreset = {
      "deze-week": "deze-maand",
      "deze-maand": "deze-maand",
      "vorige-maand": "deze-maand",
      "dit-kwartaal": "dit-kwartaal",
      "vorig-kwartaal": "dit-kwartaal",
      "dit-jaar": "dit-jaar",
      "vorig-jaar": "dit-jaar",
      "laatste-30-dagen": "deze-maand",
      "laatste-90-dagen": "dit-kwartaal",
      "alles": "alles",
      "custom": "alles",
    }[preset] as "deze-maand" | "dit-kwartaal" | "dit-jaar" | "alles";
    setPreset(mappedPreset);
  }, [setPreset]);

  // Tab content animation config
  const getAnimationProps = () => reducedMotion
    ? { initial: { opacity: 1 }, animate: { opacity: 1 }, exit: { opacity: 1 } }
    : { initial: { opacity: 0, y: 8 }, animate: { opacity: 1, y: 0 }, exit: { opacity: 0, y: -8 } };

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
          <div className="flex flex-wrap items-center gap-2">
            <EnhancedDateFilter
              currentPreset={enhancedPreset}
              onPresetChange={handleEnhancedPresetChange}
              customRange={customDateRange}
              onCustomRangeChange={setCustomDateRange}
              showComparison={true}
              comparisonEnabled={comparisonEnabled}
              onComparisonChange={setComparisonEnabled}
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
                    <TabsTrigger value="calculatie" className="gap-1.5">
                      <Calculator className="h-3.5 w-3.5" />
                      Calculatie Analyse
                    </TabsTrigger>
                    <TabsTrigger value="medewerkers" className="gap-1.5">
                      <Users className="h-3.5 w-3.5" />
                      Medewerkers
                    </TabsTrigger>
                    <TabsTrigger value="projecten" className="gap-1.5">
                      <FolderKanban className="h-3.5 w-3.5" />
                      Projecten
                    </TabsTrigger>
                  </TabsList>

                  <AnimatePresence mode="wait">
                    {/* Overzicht Tab */}
                    {activeTab === "overzicht" && (
                      <motion.div
                        key="overzicht"
                        {...getAnimationProps()}
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
                        {...getAnimationProps()}
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
                        {...getAnimationProps()}
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
                        {...getAnimationProps()}
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
                        {...getAnimationProps()}
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

                    {/* Calculatie Analyse Tab - NEW */}
                    {activeTab === "calculatie" && (
                      <motion.div
                        key="calculatie"
                        {...getAnimationProps()}
                        transition={{ duration: reducedMotion ? 0 : 0.2 }}
                      >
                        <TabsContent value="calculatie" className="space-y-4" forceMount>
                          <CalculatieVergelijking
                            data={sampleCalculatieData}
                            accuracyScore={78}
                            previousAccuracyScore={comparisonEnabled ? 72 : undefined}
                          />
                        </TabsContent>
                      </motion.div>
                    )}

                    {/* Medewerkers Tab - NEW */}
                    {activeTab === "medewerkers" && (
                      <motion.div
                        key="medewerkers"
                        {...getAnimationProps()}
                        transition={{ duration: reducedMotion ? 0 : 0.2 }}
                      >
                        <TabsContent value="medewerkers" className="space-y-4" forceMount>
                          <MedewerkerProductiviteit
                            data={sampleMedewerkerData}
                            totaalUren={760}
                            previousPeriodTotaalUren={comparisonEnabled ? 720 : undefined}
                          />
                        </TabsContent>
                      </motion.div>
                    )}

                    {/* Projecten Tab - NEW */}
                    {activeTab === "projecten" && (
                      <motion.div
                        key="projecten"
                        {...getAnimationProps()}
                        transition={{ duration: reducedMotion ? 0 : 0.2 }}
                      >
                        <TabsContent value="projecten" className="space-y-4" forceMount>
                          <ProjectPrestaties
                            data={sampleProjectData}
                            onTimePercentage={85}
                            previousOnTimePercentage={comparisonEnabled ? 78 : undefined}
                            budgetAccuracy={92}
                            previousBudgetAccuracy={comparisonEnabled ? 88 : undefined}
                            averageDuration={14}
                            previousAverageDuration={comparisonEnabled ? 16 : undefined}
                          />
                          <FinancieelOverzicht
                            kostenBreakdown={sampleKostenBreakdown}
                            maandelijksOverzicht={sampleMaandelijksOverzicht}
                            totaleOmzet={336000}
                            previousTotaleOmzet={comparisonEnabled ? 298000 : undefined}
                            totaleKosten={248900}
                            previousTotaleKosten={comparisonEnabled ? 231000 : undefined}
                            winstmarge={25.9}
                            previousWinstmarge={comparisonEnabled ? 22.5 : undefined}
                            nettoWinst={87100}
                            previousNettoWinst={comparisonEnabled ? 67000 : undefined}
                          />
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
                  className="absolute inset-0 rounded-2xl bg-gradient-to-br from-primary/20 to-primary/10 blur-xl"
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
              <p className="mt-2 text-sm text-muted-foreground max-w-sm">
                Maak eerst enkele offertes aan om je rapportages te bekijken. Start met een nieuwe offerte om te beginnen.
              </p>
              <div className="flex gap-3 mt-4">
                <Button asChild>
                  <Link href="/offertes/nieuw/aanleg">
                    Nieuwe Aanleg Offerte
                  </Link>
                </Button>
                <Button asChild variant="outline">
                  <Link href="/offertes/nieuw/onderhoud">
                    Nieuw Onderhoud
                  </Link>
                </Button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </>
  );
}

export default function RapportagesPage() {
  return (
    <RequireAdmin>
      <Suspense fallback={null}>
        <RapportagesPageContent />
      </Suspense>
    </RequireAdmin>
  );
}
