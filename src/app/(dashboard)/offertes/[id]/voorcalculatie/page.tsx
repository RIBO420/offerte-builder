"use client";

import { use, useState, useCallback, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { useReducedMotion } from "@/hooks/use-accessibility";
import { useAutoSave } from "@/hooks/use-auto-save";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { SaveIndicator } from "@/components/ui/save-indicator";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  ArrowLeft,
  Loader2,
  Calculator,
  Save,
  ChevronRight,
  FileText,
  Send,
  CheckCircle2,
  HelpCircle,
  ArrowRight,
  Edit,
  Eye,
} from "lucide-react";
import { useOfferteVoorcalculatie } from "@/hooks/use-voorcalculatie";
import { TeamSelector } from "@/components/project/team-selector";
import { UrenOverzicht } from "@/components/project/uren-overzicht";
import { OfferteWorkflowStepper } from "@/components/offerte/offerte-workflow-stepper";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Id } from "../../../../../../convex/_generated/dataModel";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export default function OfferteVoorcalculatiePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const reducedMotion = useReducedMotion();

  const {
    offerte,
    voorcalculatie,
    calculation,
    isLoading,
    hasVoorcalculatie,
    saveVoorcalculatie,
    moveToVoorcalculatie,
    calculateDays,
  } = useOfferteVoorcalculatie(id as Id<"offertes">);

  // Form state
  const [teamGrootte, setTeamGrootte] = useState<2 | 3 | 4>(
    voorcalculatie?.teamGrootte ?? 2
  );
  const [teamleden, setTeamleden] = useState<string[]>(
    voorcalculatie?.teamleden ?? []
  );
  const [effectieveUrenPerDag, setEffectieveUrenPerDag] = useState(
    voorcalculatie?.effectieveUrenPerDag ?? 7
  );
  const [showCompleteDialog, setShowCompleteDialog] = useState(false);
  const [isCompleting, setIsCompleting] = useState(false);

  // Determine if we're in view-only mode (offerte already past voorcalculatie stage)
  const isViewOnly = offerte?.status && !["concept", "voorcalculatie"].includes(offerte.status);

  // Update state when voorcalculatie loads
  useMemo(() => {
    if (voorcalculatie) {
      setTeamGrootte(voorcalculatie.teamGrootte);
      setTeamleden(voorcalculatie.teamleden ?? []);
      setEffectieveUrenPerDag(voorcalculatie.effectieveUrenPerDag);
    }
  }, [voorcalculatie]);

  // Calculate estimated days
  const geschatteDagen = useMemo(() => {
    if (!calculation) return 0;
    return calculateDays(
      calculation.normUrenTotaal,
      teamGrootte,
      effectieveUrenPerDag
    );
  }, [calculation, teamGrootte, effectieveUrenPerDag, calculateDays]);

  // Auto-save data structure
  const autoSaveData = useMemo(
    () => ({
      teamGrootte,
      teamleden: teamleden.length > 0 ? teamleden : undefined,
      effectieveUrenPerDag,
    }),
    [teamGrootte, teamleden, effectieveUrenPerDag]
  );

  // Auto-save handler
  const handleAutoSave = useCallback(
    async (data: typeof autoSaveData) => {
      await saveVoorcalculatie(data);
    },
    [saveVoorcalculatie]
  );

  // Auto-save hook
  const {
    isSaving,
    isDirty,
    lastSaved,
    saveNow,
    error: saveError,
  } = useAutoSave({
    data: autoSaveData,
    onSave: handleAutoSave,
    debounceMs: 2000,
    enabled: !!calculation, // Only enable when calculation is available
  });

  // Show error toast when save fails
  useMemo(() => {
    if (saveError) {
      toast.error("Fout bij auto-opslaan voorcalculatie");
    }
  }, [saveError]);

  // Calculate completion progress
  const completionProgress = useMemo(() => {
    let progress = 0;
    if (calculation) progress += 40; // Calculation ready
    if (teamGrootte) progress += 20; // Team size selected
    if (effectieveUrenPerDag) progress += 20; // Hours per day set
    if (hasVoorcalculatie || lastSaved) progress += 20; // Data saved
    return progress;
  }, [calculation, teamGrootte, effectieveUrenPerDag, hasVoorcalculatie, lastSaved]);

  // Manual save handler
  const handleSave = useCallback(async () => {
    try {
      await saveNow();
      toast.success("Voorcalculatie opgeslagen");
    } catch (error) {
      toast.error("Fout bij opslaan voorcalculatie");
      console.error(error);
    }
  }, [saveNow]);

  // Complete voorcalculatie and move to next status
  const handleComplete = useCallback(async () => {
    setIsCompleting(true);
    try {
      // Wait for any pending save to complete
      if (isDirty || isSaving) {
        await saveNow();
      }
      // First save if not already saved
      if (!hasVoorcalculatie) {
        await saveNow();
      }
      await moveToVoorcalculatie();
      toast.success("Voorcalculatie afgerond - offerte klaar om te verzenden");
      router.push(`/offertes/${id}`);
    } catch (error) {
      toast.error("Fout bij afronden voorcalculatie");
      console.error(error);
    } finally {
      setIsCompleting(false);
      setShowCompleteDialog(false);
    }
  }, [hasVoorcalculatie, isDirty, isSaving, saveNow, moveToVoorcalculatie, router, id]);

  if (isLoading) {
    return (
      <>
        <header className="flex h-16 shrink-0 items-center gap-2 border-b px-4">
          <SidebarTrigger className="-ml-1" />
          <Separator orientation="vertical" className="mr-2 h-4" />
          <Breadcrumb>
            <BreadcrumbList>
              <BreadcrumbItem>
                <BreadcrumbLink href="/dashboard">Dashboard</BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                <BreadcrumbLink href="/offertes">Offertes</BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                <BreadcrumbPage>Laden...</BreadcrumbPage>
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

  if (!offerte) {
    return (
      <>
        <header className="flex h-16 shrink-0 items-center gap-2 border-b px-4">
          <SidebarTrigger className="-ml-1" />
          <Separator orientation="vertical" className="mr-2 h-4" />
          <Breadcrumb>
            <BreadcrumbList>
              <BreadcrumbItem>
                <BreadcrumbLink href="/dashboard">Dashboard</BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                <BreadcrumbLink href="/offertes">Offertes</BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                <BreadcrumbPage>Niet gevonden</BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
        </header>

        <div className="flex flex-1 flex-col gap-6 p-4 md:gap-8 md:p-8">
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <FileText className="h-12 w-12 text-muted-foreground/50" />
              <h3 className="mt-4 text-lg font-semibold">
                Offerte niet gevonden
              </h3>
              <p className="mt-2 text-sm text-muted-foreground">
                De offerte bestaat niet of je hebt geen toegang.
              </p>
              <Button asChild className="mt-4">
                <Link href="/offertes">Terug naar Offertes</Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      </>
    );
  }

  return (
    <>
      <header className="flex h-16 shrink-0 items-center gap-2 border-b px-4">
        <SidebarTrigger className="-ml-1" />
        <Separator orientation="vertical" className="mr-2 h-4" />
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink href="/dashboard">Dashboard</BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbLink href="/offertes">Offertes</BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbLink href={`/offertes/${id}`}>
                {offerte.offerteNummer}
              </BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbPage>Voorcalculatie</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>
      </header>

      <motion.div
        initial={reducedMotion ? false : { opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: reducedMotion ? 0 : 0.5, ease: "easeOut" }}
        className="flex flex-1 flex-col gap-6 p-4 md:gap-8 md:p-8"
      >
        {/* Header */}
        <motion.div
          initial={reducedMotion ? false : { opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{
            duration: reducedMotion ? 0 : 0.4,
            delay: reducedMotion ? 0 : 0.1,
          }}
          className="flex items-center justify-between"
        >
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" className="h-9 w-9 sm:h-8 sm:w-8" asChild aria-label="Terug naar offerte">
              <Link href={`/offertes/${id}`}>
                <ArrowLeft className="h-4 w-4" />
              </Link>
            </Button>
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-blue-100 dark:bg-blue-950 flex items-center justify-center">
                <Calculator className="h-5 w-5 text-blue-700 dark:text-blue-400" />
              </div>
              <div>
                <h1 className="text-2xl font-bold tracking-tight">
                  Voorcalculatie
                </h1>
                <p className="text-muted-foreground">
                  {offerte.offerteNummer} - {offerte.klant.naam}
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <SaveIndicator
              isSaving={isSaving}
              isDirty={isDirty}
              lastSaved={lastSaved}
            />
            {!isViewOnly && (
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={handleSave}
                  disabled={isSaving || !calculation || !isDirty}
                  title="Auto-save is actief (2 sec na wijziging)"
                >
                  {isSaving ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Save className="mr-2 h-4 w-4" />
                  )}
                  Opslaan
                </Button>
                <Button
                  onClick={() => setShowCompleteDialog(true)}
                  disabled={!calculation || isSaving}
                  className="bg-green-600 hover:bg-green-700 text-white"
                >
                  <Send className="mr-2 h-4 w-4" />
                  Afronden
                  <ChevronRight className="ml-1 h-4 w-4" />
                </Button>
              </div>
            )}
          </div>
        </motion.div>

        {/* View-only banner for accepted/rejected offertes */}
        {isViewOnly && (
          <motion.div
            initial={reducedMotion ? false : { opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{
              duration: reducedMotion ? 0 : 0.4,
              delay: reducedMotion ? 0 : 0.12,
            }}
          >
            <div className="rounded-lg bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 p-4">
              <div className="flex items-center gap-2">
                <Eye className="h-4 w-4 text-blue-600" />
                <span className="text-sm font-medium text-blue-800 dark:text-blue-200">
                  Alleen-lezen weergave
                </span>
              </div>
              <p className="text-sm text-blue-700 dark:text-blue-300 mt-1">
                Deze offerte is al {offerte?.status === "geaccepteerd" ? "geaccepteerd" : offerte?.status === "afgewezen" ? "afgewezen" : "verzonden"}.
                Je bekijkt de voorcalculatie ter referentie.
              </p>
            </div>
          </motion.div>
        )}

        {/* Progress and Guidance Section */}
        <motion.div
          initial={reducedMotion ? false : { opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{
            duration: reducedMotion ? 0 : 0.4,
            delay: reducedMotion ? 0 : 0.15,
          }}
        >
          <Card className="overflow-hidden">
            <div className="p-4 md:p-6 space-y-4">
              {/* Workflow Stepper - show voorcalculatie as current since we're on this page */}
              <OfferteWorkflowStepper
                currentStatus={offerte.status === "concept" ? "voorcalculatie" : offerte.status as "concept" | "voorcalculatie" | "verzonden" | "geaccepteerd" | "afgewezen"}
                hasVoorcalculatie={hasVoorcalculatie}
              />

              {/* Progress indicator */}
              <div className="pt-4 border-t">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">Voortgang voorcalculatie</span>
                    {completionProgress === 100 && (
                      <Badge variant="default" className="bg-green-600 text-xs">
                        <CheckCircle2 className="h-3 w-3 mr-1" />
                        Gereed
                      </Badge>
                    )}
                  </div>
                  <span className="text-sm text-muted-foreground">{completionProgress}%</span>
                </div>
                <Progress value={completionProgress} className="h-2" />
              </div>

              {/* What is voorcalculatie - collapsible help */}
              <details className="group pt-2">
                <summary className="flex items-center gap-2 cursor-pointer text-sm text-muted-foreground hover:text-foreground transition-colors">
                  <HelpCircle className="h-4 w-4" />
                  <span>Wat is een voorcalculatie?</span>
                </summary>
                <div className="mt-3 pl-6 text-sm text-muted-foreground space-y-2">
                  <p>
                    De voorcalculatie helpt je om de werkelijke projectduur te bepalen op basis van:
                  </p>
                  <ul className="list-disc pl-4 space-y-1">
                    <li><strong>Teamgrootte:</strong> Hoeveel medewerkers werken aan dit project?</li>
                    <li><strong>Effectieve uren:</strong> Hoeveel productieve uren per dag (exclusief pauzes, reistijd)?</li>
                    <li><strong>Normuren:</strong> De berekende uren op basis van de offerte werkzaamheden</li>
                  </ul>
                  <p className="pt-2">
                    Na het afronden van de voorcalculatie kun je de offerte verzenden naar de klant.
                  </p>
                </div>
              </details>
            </div>
          </Card>
        </motion.div>

        {/* Main Content */}
        <div className="grid gap-6 lg:grid-cols-3">
          {/* Left Column - Team Config */}
          <motion.div
            initial={reducedMotion ? false : { opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{
              duration: reducedMotion ? 0 : 0.4,
              delay: reducedMotion ? 0 : 0.2,
            }}
          >
            <TeamSelector
              teamGrootte={teamGrootte}
              teamleden={teamleden}
              effectieveUrenPerDag={effectieveUrenPerDag}
              onTeamGrootteChange={setTeamGrootte}
              onTeamledenChange={setTeamleden}
              onEffectieveUrenChange={setEffectieveUrenPerDag}
            />
          </motion.div>

          {/* Right Column - Uren Overzicht */}
          <motion.div
            initial={reducedMotion ? false : { opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{
              duration: reducedMotion ? 0 : 0.4,
              delay: reducedMotion ? 0 : 0.3,
            }}
            className="lg:col-span-2"
          >
            {calculation ? (
              <UrenOverzicht
                normUrenPerScope={calculation.normUrenPerScope}
                normUrenTotaal={calculation.normUrenTotaal}
                geschatteDagen={geschatteDagen}
                bereikbaarheidFactor={calculation.bereikbaarheidFactor}
                achterstallijkheidFactor={calculation.achterstallijkheidFactor}
              />
            ) : (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-16">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                  <p className="mt-4 text-muted-foreground">
                    Uren worden berekend...
                  </p>
                </CardContent>
              </Card>
            )}
          </motion.div>
        </div>

        {/* Summary Card */}
        {calculation && (
          <motion.div
            initial={reducedMotion ? false : { opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{
              duration: reducedMotion ? 0 : 0.4,
              delay: reducedMotion ? 0 : 0.4,
            }}
          >
            <Card className="border-primary/50 bg-primary/5">
              <CardHeader>
                <CardTitle>Samenvatting</CardTitle>
                <CardDescription>
                  Geschatte projectduur op basis van team configuratie
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid gap-6 sm:grid-cols-4">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">
                      Totaal Normuren
                    </p>
                    <p className="text-3xl font-bold">
                      {calculation.normUrenTotaal}
                    </p>
                    <p className="text-xs text-muted-foreground">uur</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">
                      Team Capaciteit
                    </p>
                    <p className="text-3xl font-bold">
                      {teamGrootte * effectieveUrenPerDag}
                    </p>
                    <p className="text-xs text-muted-foreground">uur/dag</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">
                      Geschatte Duur
                    </p>
                    <p className="text-3xl font-bold text-primary">
                      {geschatteDagen}
                    </p>
                    <p className="text-xs text-muted-foreground">werkdagen</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">
                      Met Buffer (+10%)
                    </p>
                    <p className="text-3xl font-bold">
                      {Math.ceil(geschatteDagen * 1.1)}
                    </p>
                    <p className="text-xs text-muted-foreground">werkdagen</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}

        {/* Next Steps Card - only show when not in view-only mode */}
        {calculation && !isViewOnly && (
          <motion.div
            initial={reducedMotion ? false : { opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{
              duration: reducedMotion ? 0 : 0.4,
              delay: reducedMotion ? 0 : 0.5,
            }}
          >
            <Card
              className={cn(
                "border-2 transition-all",
                completionProgress === 100
                  ? "border-green-300 dark:border-green-700 bg-green-50/50 dark:bg-green-950/20"
                  : "border-blue-200 dark:border-blue-800 bg-blue-50/30 dark:bg-blue-950/10"
              )}
            >
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2">
                  {completionProgress === 100 ? (
                    <>
                      <CheckCircle2 className="h-5 w-5 text-green-600" />
                      <span className="text-green-700 dark:text-green-300">Voorcalculatie gereed</span>
                    </>
                  ) : (
                    <>
                      <ArrowRight className="h-5 w-5 text-blue-600" />
                      <span>Volgende stap</span>
                    </>
                  )}
                </CardTitle>
                <CardDescription>
                  {completionProgress === 100
                    ? "De voorcalculatie is ingevuld. Rond af om naar de volgende stap te gaan."
                    : "Vul de team configuratie in om de voorcalculatie af te ronden."}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* What happens next */}
                <div className="rounded-lg bg-white/50 dark:bg-black/10 p-4 space-y-3">
                  <p className="text-sm font-medium">Na het afronden:</p>
                  <div className="grid gap-2 sm:grid-cols-3">
                    <div className="flex items-start gap-2 text-sm">
                      <div className="h-6 w-6 rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center shrink-0">
                        <span className="text-xs font-bold text-blue-700 dark:text-blue-300">1</span>
                      </div>
                      <div>
                        <p className="font-medium">Status wijzigt</p>
                        <p className="text-xs text-muted-foreground">Offerte wordt klaar om te verzenden</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-2 text-sm">
                      <div className="h-6 w-6 rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center shrink-0">
                        <span className="text-xs font-bold text-blue-700 dark:text-blue-300">2</span>
                      </div>
                      <div>
                        <p className="font-medium">Verzenden</p>
                        <p className="text-xs text-muted-foreground">Verstuur per email of deel een link</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-2 text-sm">
                      <div className="h-6 w-6 rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center shrink-0">
                        <span className="text-xs font-bold text-blue-700 dark:text-blue-300">3</span>
                      </div>
                      <div>
                        <p className="font-medium">Klant reageert</p>
                        <p className="text-xs text-muted-foreground">Accepteren of afwijzen</p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Action buttons */}
                <div className="flex flex-col sm:flex-row gap-3 pt-2">
                  <Button
                    variant="outline"
                    asChild
                    className="flex-1"
                  >
                    <Link href={`/offertes/${id}/bewerken`}>
                      <Edit className="mr-2 h-4 w-4" />
                      Offerte bewerken
                    </Link>
                  </Button>
                  <Button
                    onClick={() => setShowCompleteDialog(true)}
                    disabled={!calculation || isSaving || isCompleting}
                    className={cn(
                      "flex-1",
                      completionProgress === 100 && "bg-green-600 hover:bg-green-700"
                    )}
                  >
                    {isCompleting ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Send className="mr-2 h-4 w-4" />
                    )}
                    Voorcalculatie afronden
                    <ChevronRight className="ml-1 h-4 w-4" />
                  </Button>
                </div>

                {/* Note about editing */}
                <p className="text-xs text-muted-foreground text-center pt-1">
                  Je kunt de voorcalculatie later altijd nog aanpassen.
                </p>
              </CardContent>
            </Card>
          </motion.div>
        )}
      </motion.div>

      {/* Complete Voorcalculatie Dialog */}
      <AlertDialog open={showCompleteDialog} onOpenChange={setShowCompleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-green-600" />
              Voorcalculatie afronden?
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3">
                <p>
                  De voorcalculatie wordt opgeslagen en de offerte wordt gemarkeerd als
                  klaar om te verzenden.
                </p>
                <div className="rounded-lg bg-muted p-3 space-y-2">
                  <p className="text-sm font-medium text-foreground">Samenvatting:</p>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div>
                      <span className="text-muted-foreground">Team:</span>{" "}
                      <span className="font-medium text-foreground">{teamGrootte} personen</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Uren/dag:</span>{" "}
                      <span className="font-medium text-foreground">{effectieveUrenPerDag} uur</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Normuren:</span>{" "}
                      <span className="font-medium text-foreground">{calculation?.normUrenTotaal ?? 0} uur</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Geschatte duur:</span>{" "}
                      <span className="font-medium text-foreground">{geschatteDagen} dagen</span>
                    </div>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">
                  Je kunt de voorcalculatie later nog aanpassen indien nodig.
                </p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isCompleting}>Annuleren</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleComplete}
              disabled={isCompleting}
              className="bg-green-600 hover:bg-green-700"
            >
              {isCompleting ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Send className="mr-2 h-4 w-4" />
              )}
              {isCompleting ? "Bezig met afronden..." : "Afronden en doorgaan"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
