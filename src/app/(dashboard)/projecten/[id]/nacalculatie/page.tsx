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
  History,
  Lightbulb,
  CheckCircle,
  Calculator,
  Clock,
  ArrowRight,
} from "lucide-react";
import { exportNacalculatieToExcel } from "./export";

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
      await save({
        werkelijkeUren: clientCalculation.werkelijkeUren,
        werkelijkeDagen: clientCalculation.werkelijkeDagen,
        werkelijkeMachineKosten: clientCalculation.werkelijkeMachineKosten,
        afwijkingUren: clientCalculation.afwijkingUren,
        afwijkingPercentage: clientCalculation.afwijkingPercentage,
        afwijkingenPerScope: clientCalculation.afwijkingenPerScopeMap,
        conclusies,
      });
      toast.success("Nacalculatie opgeslagen");
    } catch (error) {
      toast.error("Fout bij opslaan nacalculatie");
      console.error(error);
    } finally {
      setIsSaving(false);
    }
  }, [clientCalculation, conclusies, save]);

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
              <BreadcrumbLink href={`/projecten/${id}`}>
                {details?.project?.naam || "Project"}
              </BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbPage>Nacalculatie</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>
      </header>

      <div className="flex flex-1 flex-col gap-6 p-4 md:gap-8 md:p-8">
        {/* Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" asChild>
              <Link href={`/projecten/${id}`}>
                <ArrowLeft className="h-4 w-4" />
              </Link>
            </Button>
            <div>
              <div className="flex items-center gap-3">
                <ClipboardCheck className="h-6 w-6 text-primary" />
                <h1 className="text-2xl font-bold tracking-tight md:text-3xl">
                  Nacalculatie
                </h1>
              </div>
              <p className="text-muted-foreground">
                {details?.project?.naam} - Vergelijk werkelijk vs gepland
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
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
            <Button onClick={handleSave} disabled={!clientCalculation || isSaving}>
              {isSaving ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <Save className="h-4 w-4 mr-2" />
              )}
              Opslaan
            </Button>
          </div>
        </div>

        {/* Progress Stepper */}
        <Card className="p-4 md:p-6">
          <ProjectProgressStepper
            projectId={id}
            currentStatus="nacalculatie_compleet"
            hasPlanning={true}
            hasUrenRegistraties={hasUrenRegistraties}
            hasNacalculatie={!!nacalculatie}
          />
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
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList>
            <TabsTrigger value="overzicht" className="gap-2">
              <ClipboardCheck className="h-4 w-4" />
              Overzicht
            </TabsTrigger>
            <TabsTrigger value="details" className="gap-2">
              <TrendingUp className="h-4 w-4" />
              Details
            </TabsTrigger>
            <TabsTrigger value="leerfeedback" className="gap-2">
              <Lightbulb className="h-4 w-4" />
              Leerfeedback
              {suggesties.length > 0 && (
                <Badge variant="secondary" className="ml-1">
                  {suggesties.length}
                </Badge>
              )}
            </TabsTrigger>
          </TabsList>

          {/* Overview Tab */}
          <TabsContent value="overzicht" className="space-y-6">
            {clientCalculation && (
              <>
                <NacalculatieSummary
                  data={clientCalculation}
                  teamGrootte={details?.voorcalculatie?.teamGrootte}
                  effectieveUrenPerDag={details?.voorcalculatie?.effectieveUrenPerDag}
                />

                {/* Insights */}
                {clientCalculation.insights.length > 0 && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Info className="h-5 w-5" />
                        Inzichten
                      </CardTitle>
                      <CardDescription>
                        Automatisch gegenereerde observaties
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-3">
                        {clientCalculation.insights.map((insight, index) => (
                          <motion.div
                            key={index}
                            initial={{ opacity: 0, x: -10 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: index * 0.1 }}
                            className={`p-3 rounded-lg border-l-4 ${
                              insight.type === "success"
                                ? "bg-green-50 dark:bg-green-950/30 border-green-500"
                                : insight.type === "warning"
                                  ? "bg-yellow-50 dark:bg-yellow-950/30 border-yellow-500"
                                  : insight.type === "critical"
                                    ? "bg-red-50 dark:bg-red-950/30 border-red-500"
                                    : "bg-blue-50 dark:bg-blue-950/30 border-blue-500"
                            }`}
                          >
                            <p className="font-medium text-sm">{insight.title}</p>
                            <p className="text-sm text-muted-foreground mt-1">
                              {insight.description}
                            </p>
                          </motion.div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Conclusions */}
                <Card>
                  <CardHeader>
                    <CardTitle>Conclusies & Leerpunten</CardTitle>
                    <CardDescription>
                      Noteer je bevindingen en leerpunten voor toekomstige projecten
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <Textarea
                      placeholder="Beschrijf je conclusies, observaties en leerpunten..."
                      value={conclusies}
                      onChange={(e) => setConclusies(e.target.value)}
                      rows={5}
                    />
                    <Button
                      variant="outline"
                      onClick={handleSaveConclusions}
                      disabled={isSaving || !conclusies}
                    >
                      {isSaving ? (
                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      ) : (
                        <Save className="h-4 w-4 mr-2" />
                      )}
                      Conclusies Opslaan
                    </Button>
                  </CardContent>
                </Card>
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
    </>
  );
}
