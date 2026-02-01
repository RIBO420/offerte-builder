"use client";

import { use, useState, useCallback, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { useMutation } from "convex/react";
import { api } from "../../../../../../convex/_generated/api";
import { Id } from "../../../../../../convex/_generated/dataModel";
import { useNacalculatie } from "@/hooks/use-nacalculatie";
import { useLeerfeedback } from "@/hooks/use-leerfeedback";
import { NacalculatieSummary } from "@/components/project/nacalculatie-summary";
import { AfwijkingenTabel } from "@/components/project/afwijkingen-tabel";
import { VergelijkingChart, AfwijkingChart } from "@/components/project/vergelijking-chart";
import { NormuurSuggestieCard } from "@/components/project/normuur-suggestie-card";
import { LeerfeedbackHistorie, LeerfeedbackHistorieTable } from "@/components/project/leerfeedback-historie";
import { ProjectProgressStepper } from "@/components/project/project-progress-stepper";
import { NacalculatieSuccessDialog } from "@/components/project/nacalculatie-success-dialog";
import { Progress } from "@/components/ui/progress";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { toast } from "sonner";
import {
  ArrowLeft,
  Loader2,
  ClipboardCheck,
  Save,
  Download,
  FileSpreadsheet,
  AlertTriangle,
  Info,
  TrendingUp,
  TrendingDown,
  History,
  Lightbulb,
  CheckCircle,
  Calculator,
  Clock,
  ArrowRight,
  Receipt,
  Target,
  BarChart3,
  HelpCircle,
} from "lucide-react";
import { exportNacalculatieToExcel } from "./export";
import { getDeviationColor, formatDeviation } from "@/lib/nacalculatie-calculator";

export default function NacalculatiePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const projectId = id as Id<"projecten">;

  // Get nacalculatie data
  const {
    nacalculatie,
    clientCalculation,
    details,
    isLoading,
    isLoadingDetails,
    save,
    addConclusion,
    hasVoorcalculatie,
    hasUrenRegistraties,
  } = useNacalculatie(projectId);

  // Get leerfeedback data
  const {
    suggesties,
    historie,
    totaalAnalyseerdeProjecten,
    minimumVoorSuggestie,
    isLoading: isLoadingLeerfeedback,
    applyAanpassing,
    revertAanpassing,
  } = useLeerfeedback();

  // Local state
  const [conclusies, setConclusies] = useState(nacalculatie?.conclusies || "");
  const [isSaving, setIsSaving] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [activeTab, setActiveTab] = useState("overzicht");
  const [showSuccessDialog, setShowSuccessDialog] = useState(false);

  // Update conclusies when nacalculatie loads
  useMemo(() => {
    if (nacalculatie?.conclusies) {
      setConclusies(nacalculatie.conclusies);
    }
  }, [nacalculatie?.conclusies]);

  // Save nacalculatie
  const handleSave = useCallback(async () => {
    if (!clientCalculation) return;

    setIsSaving(true);
    try {
      // Check if we should update project status
      const shouldUpdateStatus = details?.project?.status === "afgerond";

      await save({
        werkelijkeUren: clientCalculation.werkelijkeUren,
        werkelijkeDagen: clientCalculation.werkelijkeDagen,
        werkelijkeMachineKosten: clientCalculation.werkelijkeMachineKosten,
        afwijkingUren: clientCalculation.afwijkingUren,
        afwijkingPercentage: clientCalculation.afwijkingPercentage,
        afwijkingenPerScope: clientCalculation.afwijkingenPerScopeMap,
        conclusies,
        updateProjectStatus: shouldUpdateStatus,
      });

      // Show success dialog instead of just a toast
      setShowSuccessDialog(true);
    } catch (error) {
      toast.error("Fout bij opslaan nacalculatie");
      console.error(error);
    } finally {
      setIsSaving(false);
    }
  }, [clientCalculation, conclusies, save, details?.project?.status]);

  // Save only conclusions
  const handleSaveConclusions = useCallback(async () => {
    if (!conclusies) return;

    setIsSaving(true);
    try {
      await addConclusion(conclusies);
      toast.success("Conclusies opgeslagen");
    } catch (error) {
      toast.error("Fout bij opslaan conclusies");
      console.error(error);
    } finally {
      setIsSaving(false);
    }
  }, [conclusies, addConclusion]);

  // Export to Excel
  const handleExport = useCallback(async () => {
    if (!clientCalculation || !details) return;

    setIsExporting(true);
    try {
      await exportNacalculatieToExcel({
        projectNaam: details.project?.naam || "Project",
        berekening: clientCalculation,
        voorcalculatie: details.voorcalculatie,
        conclusies,
      });
      toast.success("Excel export gedownload");
    } catch (error) {
      toast.error("Fout bij exporteren");
      console.error(error);
    } finally {
      setIsExporting(false);
    }
  }, [clientCalculation, details, conclusies]);

  // Apply leerfeedback suggestion
  const handleApplySuggestie = useCallback(
    async (
      normuurId: string,
      nieuweWaarde: number,
      reden: string,
      bronProjecten: string[]
    ) => {
      try {
        await applyAanpassing({
          normuurId: normuurId as Id<"normuren">,
          nieuweWaarde,
          reden,
          bronProjecten: bronProjecten as Id<"projecten">[],
        });
        toast.success("Normuur aangepast");
      } catch (error) {
        toast.error("Fout bij aanpassen normuur");
        console.error(error);
      }
    },
    [applyAanpassing]
  );

  // Revert leerfeedback adjustment
  const handleRevert = useCallback(
    async (historieId: Id<"leerfeedback_historie">) => {
      try {
        await revertAanpassing(historieId);
        toast.success("Aanpassing teruggedraaid");
      } catch (error) {
        toast.error("Fout bij terugdraaien");
        console.error(error);
      }
    },
    [revertAanpassing]
  );

  // Loading state
  if (isLoading || isLoadingDetails) {
    return (
      <>
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
                <BreadcrumbLink href="/projecten">Projecten</BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                <BreadcrumbPage>Nacalculatie</BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
        </header>
        <div className="flex flex-1 items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </>
    );
  }

  // Check if we have the necessary data
  const canCalculate = hasVoorcalculatie && hasUrenRegistraties;

  // Calculate budget status for visual indicators
  const budgetStatus = useMemo(() => {
    if (!clientCalculation) return null;
    const percentage = clientCalculation.afwijkingPercentage;
    const isOverBudget = percentage > 0;
    const isUnderBudget = percentage < 0;
    const absPercentage = Math.abs(percentage);

    // Calculate progress bar value (100% = exact on budget)
    const progressValue = Math.min(Math.max(100 + percentage, 0), 200);

    return {
      isOverBudget,
      isUnderBudget,
      absPercentage,
      progressValue,
      status: clientCalculation.status,
    };
  }, [clientCalculation]);

  return (
    <>
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
              <BreadcrumbLink href="/projecten">Projecten</BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem className="hidden sm:inline-flex">
              <BreadcrumbLink href={`/projecten/${id}`}>
                {details?.project?.naam || "Project"}
              </BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator className="hidden sm:inline-flex" />
            <BreadcrumbItem>
              <BreadcrumbPage>Nacalculatie</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>
      </header>

      <div className="flex flex-1 flex-col gap-4 p-4 md:gap-6 md:p-6 pb-28 md:pb-6">
        {/* Page Header */}
        <div className="flex flex-col gap-4">
          <div className="flex items-start gap-3">
            <Button variant="ghost" size="icon" asChild className="shrink-0 mt-1">
              <Link href={`/projecten/${id}`}>
                <ArrowLeft className="h-4 w-4" />
              </Link>
            </Button>
            <div className="flex-1 min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <ClipboardCheck className="h-5 w-5 md:h-6 md:w-6 text-primary shrink-0" />
                <h1 className="text-xl md:text-2xl font-bold tracking-tight">
                  Nacalculatie
                </h1>
              </div>
              <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                {details?.project?.naam}
              </p>
            </div>
            {/* Desktop action buttons */}
            <div className="hidden md:flex gap-2 shrink-0">
              <Button
                variant="outline"
                size="sm"
                onClick={handleExport}
                disabled={!clientCalculation || isExporting}
              >
                {isExporting ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <FileSpreadsheet className="h-4 w-4 mr-2" />
                )}
                Exporteren
              </Button>
            </div>
          </div>

          {/* What is nacalculatie - explanation card */}
          <Card className="bg-muted/30 border-dashed">
            <CardContent className="py-3 px-4">
              <div className="flex items-start gap-3">
                <HelpCircle className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
                <div className="text-sm text-muted-foreground">
                  <p className="font-medium text-foreground">Wat is een nacalculatie?</p>
                  <p className="mt-1">
                    Vergelijk de geplande uren uit je offerte met de werkelijk geregistreerde uren.
                    Zo zie je direct of het project binnen budget is gebleven en welke werkzaamheden
                    meer of minder tijd kostten dan verwacht.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Quick Status Summary - Visual budget indicator */}
        {clientCalculation && budgetStatus && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
          >
            <Card className={`border-2 ${
              budgetStatus.status === "good"
                ? "border-green-200 dark:border-green-800 bg-green-50/50 dark:bg-green-950/20"
                : budgetStatus.status === "warning"
                ? "border-yellow-200 dark:border-yellow-800 bg-yellow-50/50 dark:bg-yellow-950/20"
                : "border-red-200 dark:border-red-800 bg-red-50/50 dark:bg-red-950/20"
            }`}>
              <CardContent className="py-4 px-4 md:px-6">
                <div className="flex flex-col md:flex-row md:items-center gap-4">
                  {/* Status Icon & Text */}
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <div className={`h-12 w-12 md:h-14 md:w-14 rounded-full flex items-center justify-center shrink-0 ${
                      budgetStatus.status === "good"
                        ? "bg-green-100 dark:bg-green-900/50"
                        : budgetStatus.status === "warning"
                        ? "bg-yellow-100 dark:bg-yellow-900/50"
                        : "bg-red-100 dark:bg-red-900/50"
                    }`}>
                      {budgetStatus.isOverBudget ? (
                        <TrendingUp className={`h-6 w-6 md:h-7 md:w-7 ${
                          budgetStatus.status === "good"
                            ? "text-green-600 dark:text-green-400"
                            : budgetStatus.status === "warning"
                            ? "text-yellow-600 dark:text-yellow-400"
                            : "text-red-600 dark:text-red-400"
                        }`} />
                      ) : budgetStatus.isUnderBudget ? (
                        <TrendingDown className={`h-6 w-6 md:h-7 md:w-7 ${
                          budgetStatus.status === "good"
                            ? "text-green-600 dark:text-green-400"
                            : "text-blue-600 dark:text-blue-400"
                        }`} />
                      ) : (
                        <Target className="h-6 w-6 md:h-7 md:w-7 text-green-600 dark:text-green-400" />
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm text-muted-foreground">Totale afwijking</p>
                      <p className={`text-2xl md:text-3xl font-bold ${
                        getDeviationColor(budgetStatus.status).text
                      }`}>
                        {formatDeviation(clientCalculation.afwijkingPercentage)}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {budgetStatus.isOverBudget
                          ? `${Math.abs(clientCalculation.afwijkingUren)} uur meer dan gepland`
                          : budgetStatus.isUnderBudget
                          ? `${Math.abs(clientCalculation.afwijkingUren)} uur minder dan gepland`
                          : "Precies op planning"}
                      </p>
                    </div>
                  </div>

                  {/* Quick Stats */}
                  <div className="grid grid-cols-2 gap-3 md:gap-4 md:w-auto">
                    <div className="bg-background/60 rounded-lg p-3 text-center">
                      <p className="text-xs text-muted-foreground">Gepland</p>
                      <p className="text-lg md:text-xl font-semibold">{clientCalculation.geplandeUren}u</p>
                    </div>
                    <div className="bg-background/60 rounded-lg p-3 text-center">
                      <p className="text-xs text-muted-foreground">Werkelijk</p>
                      <p className={`text-lg md:text-xl font-semibold ${getDeviationColor(budgetStatus.status).text}`}>
                        {clientCalculation.werkelijkeUren}u
                      </p>
                    </div>
                  </div>
                </div>

                {/* Visual Progress Bar */}
                <div className="mt-4">
                  <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
                    <span>0%</span>
                    <span className="font-medium">Budget (100%)</span>
                    <span>200%</span>
                  </div>
                  <div className="relative h-3 bg-muted rounded-full overflow-hidden">
                    {/* Budget marker at 50% */}
                    <div className="absolute left-1/2 top-0 bottom-0 w-0.5 bg-foreground/30 z-10" />
                    {/* Progress fill */}
                    <motion.div
                      className={`h-full rounded-full ${
                        budgetStatus.status === "good"
                          ? "bg-green-500"
                          : budgetStatus.status === "warning"
                          ? "bg-yellow-500"
                          : "bg-red-500"
                      }`}
                      initial={{ width: 0 }}
                      animate={{ width: `${Math.min(budgetStatus.progressValue / 2, 100)}%` }}
                      transition={{ duration: 0.5, ease: "easeOut" }}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}

        {/* Progress Stepper - Collapsed on mobile */}
        <Card className="p-3 md:p-6">
          <div className="hidden md:block">
            <ProjectProgressStepper
              projectId={id}
              projectStatus={(details?.project?.status || "afgerond") as "gepland" | "in_uitvoering" | "afgerond" | "nacalculatie_compleet" | "gefactureerd"}
              hasPlanning={true}
              hasUrenRegistraties={hasUrenRegistraties}
              hasNacalculatie={!!nacalculatie}
            />
          </div>
          <div className="md:hidden">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="h-8 w-8 rounded-full bg-primary flex items-center justify-center">
                  <ClipboardCheck className="h-4 w-4 text-primary-foreground" />
                </div>
                <div>
                  <p className="text-sm font-medium">Stap 4 van 5</p>
                  <p className="text-xs text-muted-foreground">Nacalculatie</p>
                </div>
              </div>
              <Badge variant="secondary">
                {nacalculatie ? "Opgeslagen" : "In bewerking"}
              </Badge>
            </div>
          </div>
        </Card>

        {/* Missing data - Empty States */}
        {!canCalculate && (
          <div className="grid gap-4 md:grid-cols-2">
            {/* No Voorcalculatie */}
            {!hasVoorcalculatie && (
              <Card className="border-orange-200 dark:border-orange-800 bg-orange-50/50 dark:bg-orange-950/20">
                <CardContent className="flex flex-col items-center justify-center py-8">
                  <div className="h-12 w-12 rounded-full bg-orange-100 dark:bg-orange-900/50 flex items-center justify-center mb-4">
                    <Calculator className="h-6 w-6 text-orange-600 dark:text-orange-400" />
                  </div>
                  <h3 className="text-lg font-semibold text-center">
                    Geen voorcalculatie
                  </h3>
                  <p className="text-sm text-muted-foreground text-center mt-2 max-w-xs">
                    Om een nacalculatie te maken heb je eerst een voorcalculatie nodig met de geplande uren.
                  </p>
                  <Button asChild className="mt-4">
                    <Link href={`/projecten/${id}/voorcalculatie`}>
                      <Calculator className="mr-2 h-4 w-4" />
                      Maak voorcalculatie
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </Link>
                  </Button>
                </CardContent>
              </Card>
            )}

            {/* No Uren Registraties */}
            {!hasUrenRegistraties && (
              <Card className="border-blue-200 dark:border-blue-800 bg-blue-50/50 dark:bg-blue-950/20">
                <CardContent className="flex flex-col items-center justify-center py-8">
                  <div className="h-12 w-12 rounded-full bg-blue-100 dark:bg-blue-900/50 flex items-center justify-center mb-4">
                    <Clock className="h-6 w-6 text-blue-600 dark:text-blue-400" />
                  </div>
                  <h3 className="text-lg font-semibold text-center">
                    Geen urenregistraties
                  </h3>
                  <p className="text-sm text-muted-foreground text-center mt-2 max-w-xs">
                    Om werkelijke uren te vergelijken met de planning moeten er eerst uren geregistreerd zijn.
                  </p>
                  <Button asChild className="mt-4">
                    <Link href={`/projecten/${id}/uitvoering`}>
                      <Clock className="mr-2 h-4 w-4" />
                      Ga naar uitvoering
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </Link>
                  </Button>
                </CardContent>
              </Card>
            )}
          </div>
        )}

        {/* Main Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4 md:space-y-6">
          <TabsList className="w-full md:w-auto grid grid-cols-3 md:flex">
            <TabsTrigger value="overzicht" className="gap-1 md:gap-2 text-xs md:text-sm">
              <ClipboardCheck className="h-3.5 w-3.5 md:h-4 md:w-4" />
              <span className="hidden xs:inline">Overzicht</span>
              <span className="xs:hidden">Over.</span>
            </TabsTrigger>
            <TabsTrigger value="details" className="gap-1 md:gap-2 text-xs md:text-sm">
              <BarChart3 className="h-3.5 w-3.5 md:h-4 md:w-4" />
              Details
            </TabsTrigger>
            <TabsTrigger value="leerfeedback" className="gap-1 md:gap-2 text-xs md:text-sm">
              <Lightbulb className="h-3.5 w-3.5 md:h-4 md:w-4" />
              <span className="hidden xs:inline">Feedback</span>
              <span className="xs:hidden">Leer</span>
              {suggesties.length > 0 && (
                <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-xs">
                  {suggesties.length}
                </Badge>
              )}
            </TabsTrigger>
          </TabsList>

          {/* Overview Tab */}
          <TabsContent value="overzicht" className="space-y-4 md:space-y-6">
            {clientCalculation && (
              <>
                {/* Simplified Insights - Only show top 3 most important */}
                {clientCalculation.insights.length > 0 && (
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="flex items-center gap-2 text-base md:text-lg">
                        <Lightbulb className="h-4 w-4 md:h-5 md:w-5 text-amber-500" />
                        Belangrijkste Inzichten
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="grid gap-2 md:gap-3">
                        {clientCalculation.insights.slice(0, 3).map((insight, index) => {
                          const iconMap = {
                            success: <CheckCircle className="h-4 w-4 text-green-500 shrink-0" />,
                            warning: <AlertTriangle className="h-4 w-4 text-yellow-500 shrink-0" />,
                            critical: <AlertTriangle className="h-4 w-4 text-red-500 shrink-0" />,
                            info: <Info className="h-4 w-4 text-blue-500 shrink-0" />,
                          };
                          return (
                            <motion.div
                              key={index}
                              initial={{ opacity: 0, y: 5 }}
                              animate={{ opacity: 1, y: 0 }}
                              transition={{ delay: index * 0.05 }}
                              className={`flex items-start gap-3 p-3 rounded-lg ${
                                insight.type === "success"
                                  ? "bg-green-50 dark:bg-green-950/30"
                                  : insight.type === "warning"
                                  ? "bg-yellow-50 dark:bg-yellow-950/30"
                                  : insight.type === "critical"
                                  ? "bg-red-50 dark:bg-red-950/30"
                                  : "bg-blue-50 dark:bg-blue-950/30"
                              }`}
                            >
                              {iconMap[insight.type]}
                              <div className="min-w-0 flex-1">
                                <p className="font-medium text-sm">{insight.title}</p>
                                <p className="text-xs md:text-sm text-muted-foreground mt-0.5 line-clamp-2">
                                  {insight.description}
                                </p>
                              </div>
                            </motion.div>
                          );
                        })}
                      </div>
                      {clientCalculation.insights.length > 3 && (
                        <p className="text-xs text-muted-foreground mt-3 text-center">
                          + {clientCalculation.insights.length - 3} meer inzichten in Details tab
                        </p>
                      )}
                    </CardContent>
                  </Card>
                )}

                {/* Simplified Summary */}
                <NacalculatieSummary
                  data={clientCalculation}
                  teamGrootte={details?.voorcalculatie?.teamGrootte}
                  effectieveUrenPerDag={details?.voorcalculatie?.effectieveUrenPerDag}
                />

                {/* Conclusions */}
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base md:text-lg">Conclusies & Leerpunten</CardTitle>
                    <CardDescription className="text-xs md:text-sm">
                      Noteer je bevindingen voor toekomstige projecten (optioneel)
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <Textarea
                      placeholder="Bijv. grondwerk duurde langer door onverwachte stenen..."
                      value={conclusies}
                      onChange={(e) => setConclusies(e.target.value)}
                      rows={3}
                      className="resize-none text-sm"
                    />
                  </CardContent>
                </Card>

                {/* Desktop: Save and Continue CTA */}
                <Card className="hidden md:block border-primary/20 bg-primary/5">
                  <CardContent className="flex items-center justify-between gap-4 py-4">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                        <Receipt className="h-5 w-5 text-primary" />
                      </div>
                      <div>
                        <p className="font-medium">Klaar met de nacalculatie?</p>
                        <p className="text-sm text-muted-foreground">
                          Sla op en ga door naar de factuur
                        </p>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        onClick={handleSave}
                        disabled={!clientCalculation || isSaving}
                      >
                        {isSaving ? (
                          <Loader2 className="h-4 w-4 animate-spin mr-2" />
                        ) : (
                          <Save className="h-4 w-4 mr-2" />
                        )}
                        Alleen Opslaan
                      </Button>
                      <Button
                        onClick={handleSave}
                        disabled={!clientCalculation || isSaving}
                        className="bg-primary"
                      >
                        {isSaving ? (
                          <Loader2 className="h-4 w-4 animate-spin mr-2" />
                        ) : (
                          <Receipt className="h-4 w-4 mr-2" />
                        )}
                        Opslaan & Naar Factuur
                        <ArrowRight className="h-4 w-4 ml-2" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>

                {/* Factuur CTA Card - Only show if already saved */}
                {details?.project?.status === "nacalculatie_compleet" && (
                  <Card className="border-green-200 dark:border-green-800 bg-green-50/50 dark:bg-green-950/20">
                    <CardContent className="flex flex-col sm:flex-row items-center justify-between gap-4 py-4 md:py-6">
                      <div className="flex items-center gap-3 md:gap-4">
                        <div className="h-10 w-10 md:h-12 md:w-12 rounded-full bg-green-100 dark:bg-green-900/50 flex items-center justify-center">
                          <CheckCircle className="h-5 w-5 md:h-6 md:w-6 text-green-600 dark:text-green-400" />
                        </div>
                        <div>
                          <h3 className="text-base md:text-lg font-semibold">
                            Nacalculatie Voltooid
                          </h3>
                          <p className="text-xs md:text-sm text-muted-foreground">
                            Je kunt nu de factuur genereren
                          </p>
                        </div>
                      </div>
                      <Button asChild className="bg-green-600 hover:bg-green-700 w-full sm:w-auto">
                        <Link href={`/projecten/${id}/factuur`}>
                          <Receipt className="mr-2 h-4 w-4" />
                          Ga naar Factuur
                          <ArrowRight className="ml-2 h-4 w-4" />
                        </Link>
                      </Button>
                    </CardContent>
                  </Card>
                )}
              </>
            )}
          </TabsContent>

          {/* Details Tab */}
          <TabsContent value="details" className="space-y-6">
            {clientCalculation && (
              <>
                <div className="grid gap-6 lg:grid-cols-2">
                  <VergelijkingChart
                    afwijkingen={clientCalculation.afwijkingenPerScope}
                    height={400}
                  />
                  <AfwijkingChart
                    afwijkingen={clientCalculation.afwijkingenPerScope}
                    height={400}
                  />
                </div>

                <AfwijkingenTabel
                  afwijkingen={clientCalculation.afwijkingenPerScope}
                />
              </>
            )}
          </TabsContent>

          {/* Leerfeedback Tab */}
          <TabsContent value="leerfeedback" className="space-y-6">
            {/* Warning banner */}
            <Alert className="border-amber-500 bg-amber-50 dark:bg-amber-950/30">
              <AlertTriangle className="h-4 w-4 text-amber-600" />
              <AlertTitle className="text-amber-800 dark:text-amber-200">
                Handmatige aanpassingen
              </AlertTitle>
              <AlertDescription className="text-amber-700 dark:text-amber-300">
                Normuur aanpassingen gebeuren alleen op basis van jouw
                expliciete goedkeuring. Er worden geen automatische wijzigingen
                doorgevoerd. Elke aanpassing wordt gelogd en kan worden
                teruggedraaid.
              </AlertDescription>
            </Alert>

            {/* Suggestions */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-semibold">Suggesties voor Normuren</h3>
                  <p className="text-sm text-muted-foreground">
                    Gebaseerd op {totaalAnalyseerdeProjecten} projecten (minimum{" "}
                    {minimumVoorSuggestie} voor suggestie)
                  </p>
                </div>
              </div>

              {isLoadingLeerfeedback ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              ) : suggesties.length > 0 ? (
                <div className="grid gap-4 lg:grid-cols-2">
                  {suggesties.map((suggestie) => (
                    <NormuurSuggestieCard
                      key={suggestie.id}
                      suggestie={suggestie}
                      onApply={handleApplySuggestie}
                    />
                  ))}
                </div>
              ) : (
                <Card>
                  <CardContent className="py-8 text-center text-muted-foreground">
                    <CheckCircle className="h-8 w-8 mx-auto mb-2 text-green-500" />
                    <p className="font-medium">Geen suggesties beschikbaar</p>
                    <p className="text-sm mt-1">
                      {totaalAnalyseerdeProjecten < minimumVoorSuggestie
                        ? `Je hebt ${minimumVoorSuggestie - totaalAnalyseerdeProjecten} meer projecten nodig met nacalculatie data.`
                        : "De huidige normuren lijken accuraat op basis van de projectdata."}
                    </p>
                  </CardContent>
                </Card>
              )}
            </div>

            {/* History */}
            <LeerfeedbackHistorie
              historie={historie}
              onRevert={handleRevert}
              isLoading={isLoadingLeerfeedback ?? false}
            />
          </TabsContent>
        </Tabs>
      </div>

      {/* Mobile Sticky Bottom Action Bar */}
      {clientCalculation && (
        <motion.div
          initial={{ y: 100 }}
          animate={{ y: 0 }}
          className="fixed bottom-0 left-0 right-0 md:hidden bg-background border-t shadow-lg z-50 safe-area-bottom"
        >
          <div className="p-4 flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleExport}
              disabled={isExporting}
              className="shrink-0"
            >
              {isExporting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <FileSpreadsheet className="h-4 w-4" />
              )}
            </Button>
            {details?.project?.status === "nacalculatie_compleet" ? (
              <Button asChild className="flex-1 bg-green-600 hover:bg-green-700">
                <Link href={`/projecten/${id}/factuur`}>
                  <Receipt className="mr-2 h-4 w-4" />
                  Ga naar Factuur
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
            ) : (
              <Button
                onClick={handleSave}
                disabled={isSaving}
                className="flex-1"
              >
                {isSaving ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <Save className="h-4 w-4 mr-2" />
                )}
                Opslaan & Doorgaan
                <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            )}
          </div>
        </motion.div>
      )}

      {/* Success Dialog */}
      <NacalculatieSuccessDialog
        open={showSuccessDialog}
        onOpenChange={setShowSuccessDialog}
        projectId={id}
      />
    </>
  );
}
