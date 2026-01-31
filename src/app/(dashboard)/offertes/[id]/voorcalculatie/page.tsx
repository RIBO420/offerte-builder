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
} from "lucide-react";
import { useOfferteVoorcalculatie } from "@/hooks/use-voorcalculatie";
import { TeamSelector } from "@/components/project/team-selector";
import { UrenOverzicht } from "@/components/project/uren-overzicht";
import { OfferteWorkflowStepper } from "@/components/offerte/offerte-workflow-stepper";
import { Id } from "../../../../../../convex/_generated/dataModel";
import { toast } from "sonner";

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
    }
    setShowCompleteDialog(false);
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
            <Button variant="ghost" size="icon" asChild>
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
              >
                <Send className="mr-2 h-4 w-4" />
                Afronden
                <ChevronRight className="ml-1 h-4 w-4" />
              </Button>
            </div>
          </div>
        </motion.div>

        {/* Workflow Stepper */}
        <Card className="p-4 md:p-6">
          <OfferteWorkflowStepper
            currentStatus={offerte.status as "concept" | "voorcalculatie" | "verzonden" | "geaccepteerd" | "afgewezen"}
            hasVoorcalculatie={hasVoorcalculatie}
          />
        </Card>

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
      </motion.div>

      {/* Complete Voorcalculatie Dialog */}
      <AlertDialog open={showCompleteDialog} onOpenChange={setShowCompleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Voorcalculatie afronden?</AlertDialogTitle>
            <AlertDialogDescription>
              De voorcalculatie wordt opgeslagen en de offerte wordt gemarkeerd als
              klaar om te verzenden. Je kunt de voorcalculatie later nog aanpassen.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuleren</AlertDialogCancel>
            <AlertDialogAction onClick={handleComplete}>
              <Send className="mr-2 h-4 w-4" />
              Afronden
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
