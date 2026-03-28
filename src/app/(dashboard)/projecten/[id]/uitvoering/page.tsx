"use client";

import { useState, useCallback, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../../../../convex/_generated/api";
import { m } from "framer-motion";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  Wrench,
  Plus,
  TrendingUp,
} from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { useCurrentUser } from "@/hooks/use-current-user";
import {
  useUrenRegistratie,
  useMachineGebruik,
} from "@/hooks/use-uren-registratie";
import { useMachines } from "@/hooks/use-machines";
import { UrenImport } from "@/components/project/uren-import";
import { UrenEntryForm, UrenEntryData, DatabaseMedewerker } from "@/components/project/uren-entry-form";
import { ProjectProgressStepper } from "@/components/project/project-progress-stepper";
import { Id } from "../../../../../../convex/_generated/dataModel";
import { format } from "date-fns";

import { ProgressIndicator } from "./components/progress-indicator";
import { StatsCards } from "./components/stats-cards";
import { FinishProjectSection } from "./components/finish-project-section";
import { UrenTab } from "./components/uren-tab";
import { MachinesTab } from "./components/machines-tab";
import { OverzichtTab } from "./components/overzicht-tab";
import { MachineFormDialog } from "./components/machine-form-dialog";
import { DeleteConfirmationDialog } from "./components/delete-confirmation-dialog";

export default function UitvoeringPage() {
  const params = useParams();
  const router = useRouter();
  const projectId = params.id as Id<"projecten">;

  // Get project data
  const project = useQuery(api.projecten.get, { id: projectId });

  // Get voorcalculatie - first try by offerte (new workflow), then by project (legacy)
  const voorcalculatieByOfferte = useQuery(
    api.voorcalculaties.getByOfferte,
    project?.offerteId ? { offerteId: project.offerteId } : "skip"
  );
  const voorcalculatieByProject = useQuery(
    api.voorcalculaties.getByProject,
    projectId && !voorcalculatieByOfferte ? { projectId } : "skip"
  );
  const voorcalculatie = voorcalculatieByOfferte || voorcalculatieByProject;

  // Get linked offerte to check type/scopes for KLIC-melding (PRJ-W01)
  const offerte = useQuery(
    api.offertes.get,
    project?.offerteId ? { id: project.offerteId } : "skip"
  );

  // Fetch active medewerkers from database for the form dropdown
  const medewerkers = useQuery(api.medewerkers.getActive);

  // Mutation for updating project status
  const updateProjectStatus = useMutation(api.projecten.updateStatus);
  const setKlicMelding = useMutation(api.projecten.setKlicMelding);

  const { isLoading: isUserLoading } = useCurrentUser();
  const {
    registraties,
    totals: urenTotals,
    isLoading: isUrenLoading,
    add: addUren,
    importEntries,
    delete: deleteUren,
  } = useUrenRegistratie(projectId);
  const {
    usage: machineUsage,
    totals: machineTotals,
    isLoading: isMachineLoading,
    add: addMachineUsage,
    delete: deleteMachineUsage,
  } = useMachineGebruik(projectId);
  const { machines } = useMachines();

  const [activeTab, setActiveTab] = useState("uren");
  const [showUrenForm, setShowUrenForm] = useState(false);
  const [showMachineForm, setShowMachineForm] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<{ type: "uren" | "machine"; id: string } | null>(null);
  const [showFinishDialog, setShowFinishDialog] = useState(false);
  const [isFinishing, setIsFinishing] = useState(false);

  // Machine form state
  const [selectedMachine, setSelectedMachine] = useState<string>("");
  const [machineDate, setMachineDate] = useState<string>(
    format(new Date(), "yyyy-MM-dd")
  );
  const [machineUren, setMachineUren] = useState<string>("");

  // Optimistic update states
  const [optimisticDeletedItemIds, setOptimisticDeletedItemIds] = useState<Set<string>>(new Set());
  const [optimisticKlicMelding, setOptimisticKlicMelding] = useState<boolean | null>(null);

  const isLoading = isUserLoading || isUrenLoading || isMachineLoading;

  // Group registrations by date, excluding optimistically deleted items
  const groupedByDate = useMemo(() => {
    const filtered = registraties.filter((reg) => !optimisticDeletedItemIds.has(reg._id));
    const groups: Record<string, typeof registraties> = {};
    filtered.forEach((reg) => {
      if (!groups[reg.datum]) {
        groups[reg.datum] = [];
      }
      groups[reg.datum].push(reg);
    });
    // Sort dates descending
    return Object.entries(groups).sort(([a], [b]) => b.localeCompare(a));
  }, [registraties, optimisticDeletedItemIds]);

  // Filter machine usage by optimistically deleted items
  const filteredMachineUsage = useMemo(
    () => machineUsage.filter((item) => !optimisticDeletedItemIds.has(item._id)),
    [machineUsage, optimisticDeletedItemIds]
  );

  // Get unique medewerkers for the form
  const existingMedewerkers = useMemo(
    () => [...new Set(registraties.map((r) => r.medewerker))],
    [registraties]
  );

  const handleImport = useCallback(
    async (entries: UrenEntryData[]) => {
      setIsImporting(true);
      try {
        const result = await importEntries(entries);
        toast.success(`${result.count} registraties geimporteerd`);
      } catch (error) {
        toast.error("Fout bij importeren");
        console.error(error);
      } finally {
        setIsImporting(false);
      }
    },
    [importEntries]
  );

  const handleAddUren = useCallback(
    async (data: UrenEntryData) => {
      setIsSaving(true);
      try {
        await addUren(data);
        toast.success("Uren geregistreerd");
        setShowUrenForm(false);
      } catch (error) {
        toast.error("Fout bij registreren uren");
        console.error(error);
      } finally {
        setIsSaving(false);
      }
    },
    [addUren]
  );

  const handleAddMachineUsage = useCallback(async () => {
    if (!selectedMachine || !machineDate || !machineUren) {
      toast.error("Vul alle velden in");
      return;
    }

    setIsSaving(true);
    try {
      await addMachineUsage({
        machineId: selectedMachine as Id<"machines">,
        datum: machineDate,
        uren: parseFloat(machineUren) || 0,
      });
      toast.success("Machine gebruik geregistreerd");
      setShowMachineForm(false);
      setSelectedMachine("");
      setMachineUren("");
    } catch (error) {
      toast.error("Fout bij registreren machine gebruik");
      console.error(error);
    } finally {
      setIsSaving(false);
    }
  }, [selectedMachine, machineDate, machineUren, addMachineUsage]);

  const handleDelete = useCallback(async () => {
    if (!itemToDelete) return;

    const deletedId = itemToDelete.id;
    const deletedType = itemToDelete.type;

    // Optimistic: hide the item immediately and close dialog
    setOptimisticDeletedItemIds((prev) => new Set(prev).add(deletedId));
    setShowDeleteDialog(false);
    setItemToDelete(null);
    toast.success(deletedType === "uren" ? "Registratie verwijderd" : "Machine gebruik verwijderd");

    try {
      if (deletedType === "uren") {
        await deleteUren({ id: deletedId as Id<"urenRegistraties"> });
      } else {
        await deleteMachineUsage({ id: deletedId as Id<"machineGebruik"> });
      }
      // Server confirmed — clear optimistic state (real data takes over)
      setOptimisticDeletedItemIds((prev) => {
        const newSet = new Set(prev);
        newSet.delete(deletedId);
        return newSet;
      });
    } catch (error) {
      // Rollback on error — item reappears
      setOptimisticDeletedItemIds((prev) => {
        const newSet = new Set(prev);
        newSet.delete(deletedId);
        return newSet;
      });
      toast.error("Fout bij verwijderen");
      console.error(error);
    }
  }, [itemToDelete, deleteUren, deleteMachineUsage]);

  // Handle finish project (transition to afgerond)
  const handleFinishProject = useCallback(async () => {
    setIsFinishing(true);

    // Optimistic: show success and navigate immediately
    toast.success("Project afgerond! Je wordt doorgestuurd naar de nacalculatie.");
    router.push(`/projecten/${projectId}/nacalculatie`);

    try {
      await updateProjectStatus({ id: projectId, status: "afgerond" });
    } catch (error) {
      // Server rejected — notify user (they're already on nacalculatie page)
      toast.error("Fout bij afronden project", {
        description: error instanceof Error ? error.message : "Onbekende fout",
        action: {
          label: "Terug naar uitvoering",
          onClick: () => router.push(`/projecten/${projectId}/uitvoering`),
        },
      });
    } finally {
      setIsFinishing(false);
      setShowFinishDialog(false);
    }
  }, [projectId, updateProjectStatus, router]);

  // PRJ-W01: KLIC-melding check — required for aanleg projects with grondwerk
  const requiresKlicMelding =
    offerte?.type === "aanleg" && offerte?.scopes?.includes("grondwerk");
  const klicMeldingGedaan = optimisticKlicMelding ?? project?.klicMeldingGedaan === true;

  const handleKlicMeldingToggle = useCallback(
    async (checked: boolean) => {
      // Optimistic: update checkbox immediately
      setOptimisticKlicMelding(checked);
      toast.success(
        checked
          ? "KLIC-melding als gedaan gemarkeerd"
          : "KLIC-melding markering verwijderd"
      );

      try {
        await setKlicMelding({ id: projectId, klicMeldingGedaan: checked });
        // Server confirmed — clear optimistic state (real data takes over)
        setOptimisticKlicMelding(null);
      } catch (error) {
        // Rollback on error
        setOptimisticKlicMelding(null);
        toast.error("Fout bij opslaan KLIC-melding status");
        console.error(error);
      }
    },
    [projectId, setKlicMelding]
  );

  // Check if project can be finished
  const canFinishProject = project?.status === "in_uitvoering" && urenTotals.totaalUren > 0;
  const hasVoorcalculatie = !!voorcalculatie;

  // Calculate comparison with voorcalculatie
  const begroteUren = voorcalculatie?.normUrenTotaal || 0;
  const verschilUren = urenTotals.totaalUren - begroteUren;
  const verschilPercentage = begroteUren > 0 ? ((verschilUren / begroteUren) * 100).toFixed(1) : 0;

  // Progress calculation - cap at 100% for display, but show actual if over
  const progressPercentage = begroteUren > 0
    ? Math.min((urenTotals.totaalUren / begroteUren) * 100, 100)
    : 0;
  const actualProgressPercentage = begroteUren > 0
    ? (urenTotals.totaalUren / begroteUren) * 100
    : 0;
  const isOverBudget = actualProgressPercentage > 100;
  const isNearBudget = actualProgressPercentage >= 80 && actualProgressPercentage <= 100;

  const handleDeleteItem = useCallback((item: { type: "uren" | "machine"; id: string }) => {
    setItemToDelete(item);
    setShowDeleteDialog(true);
  }, []);

  return (
    <>
      <PageHeader />

      <m.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="flex flex-1 flex-col gap-6 p-4 md:gap-8 md:p-8"
      >
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight md:text-3xl">
              Uitvoering & Urenregistratie
            </h1>
            <p className="text-muted-foreground">
              Registreer gewerkte uren en machine gebruik
            </p>
          </div>
          <div className="flex gap-2">
            <UrenImport onImport={handleImport} isImporting={isImporting} />
            <Button onClick={() => setShowUrenForm(true)} size="lg">
              <Plus className="mr-2 h-4 w-4" />
              Uren registreren
            </Button>
          </div>
        </div>

        {/* Progress Stepper - Shows actual project status from database */}
        <Card className="p-4 md:p-6">
          <ProjectProgressStepper
            projectId={params.id as string}
            projectStatus={(project?.status || "in_uitvoering") as "gepland" | "in_uitvoering" | "afgerond" | "nacalculatie_compleet" | "gefactureerd"}
            hasPlanning={true}
            hasUrenRegistraties={urenTotals.totaalUren > 0}
            hasNacalculatie={false}
          />
        </Card>

        {/* PRJ-W01: KLIC-melding warning banner for aanleg projects with grondwerk */}
        {requiresKlicMelding && (
          <Card className={`p-4 border-l-4 ${klicMeldingGedaan ? "border-l-green-500 bg-green-50 dark:bg-green-950/20" : "border-l-amber-500 bg-amber-50 dark:bg-amber-950/20"}`}>
            <div className="flex items-start gap-4">
              {klicMeldingGedaan ? (
                <CheckCircle2 className="h-5 w-5 text-green-600 mt-0.5 shrink-0" />
              ) : (
                <AlertTriangle className="h-5 w-5 text-amber-600 mt-0.5 shrink-0" />
              )}
              <div className="flex-1">
                <h3 className={`font-semibold ${klicMeldingGedaan ? "text-green-800 dark:text-green-300" : "text-amber-800 dark:text-amber-300"}`}>
                  {klicMeldingGedaan ? "KLIC-melding gedaan" : "KLIC-melding vereist"}
                </h3>
                <p className={`text-sm mt-1 ${klicMeldingGedaan ? "text-green-700 dark:text-green-400" : "text-amber-700 dark:text-amber-400"}`}>
                  {klicMeldingGedaan
                    ? "De KLIC-melding is bevestigd. Het project kan worden gestart."
                    : "Dit aanlegproject bevat graafwerk. Een KLIC-melding is wettelijk verplicht voordat je begint met graven. Het project kan niet worden gestart zonder deze bevestiging."}
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <Checkbox
                  id="klic-melding"
                  checked={klicMeldingGedaan}
                  onCheckedChange={(checked) => handleKlicMeldingToggle(checked === true)}
                />
                <label
                  htmlFor="klic-melding"
                  className={`text-sm font-medium cursor-pointer ${klicMeldingGedaan ? "text-green-700 dark:text-green-300" : "text-amber-700 dark:text-amber-300"}`}
                >
                  KLIC-melding gedaan
                </label>
              </div>
            </div>
          </Card>
        )}

        {/* Progress Indicator - Prominent visual feedback */}
        {hasVoorcalculatie && (
          <ProgressIndicator
            urenTotaal={urenTotals.totaalUren}
            begroteUren={begroteUren}
            verschilUren={verschilUren}
            progressPercentage={progressPercentage}
            actualProgressPercentage={actualProgressPercentage}
            isOverBudget={isOverBudget}
            isNearBudget={isNearBudget}
          />
        )}

        {/* Stats Cards */}
        <StatsCards
          isLoading={isLoading}
          urenTotals={urenTotals}
          machineTotals={machineTotals}
        />

        {/* Project Afronden Section - Clear visibility */}
        {project?.status === "in_uitvoering" && (
          <FinishProjectSection
            showFinishDialog={showFinishDialog}
            setShowFinishDialog={setShowFinishDialog}
            handleFinishProject={handleFinishProject}
            isFinishing={isFinishing}
            canFinishProject={canFinishProject}
            hasVoorcalculatie={hasVoorcalculatie}
            urenTotaal={urenTotals.totaalUren}
            begroteUren={begroteUren}
            verschilUren={verschilUren}
            verschilPercentage={verschilPercentage}
          />
        )}

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
          <TabsList>
            <TabsTrigger value="uren" className="flex items-center gap-2">
              <Clock className="h-4 w-4" />
              Urenregistratie
              {urenTotals.aantalRegistraties > 0 && (
                <Badge variant="secondary" className="ml-1">
                  {urenTotals.aantalRegistraties}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="machines" className="flex items-center gap-2">
              <Wrench className="h-4 w-4" />
              Machine gebruik
              {machineTotals.aantalRegistraties > 0 && (
                <Badge variant="secondary" className="ml-1">
                  {machineTotals.aantalRegistraties}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="overzicht" className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4" />
              Overzicht
            </TabsTrigger>
          </TabsList>

          {/* Uren Tab */}
          <TabsContent value="uren" className="space-y-4">
            <UrenTab
              isLoading={isLoading}
              groupedByDate={groupedByDate}
              onShowUrenForm={() => setShowUrenForm(true)}
              onDeleteItem={handleDeleteItem}
              onImport={handleImport}
              isImporting={isImporting}
            />
          </TabsContent>

          {/* Machines Tab */}
          <TabsContent value="machines" className="space-y-4">
            <MachinesTab
              isLoading={isLoading}
              machineUsage={filteredMachineUsage}
              onShowMachineForm={() => setShowMachineForm(true)}
              onDeleteItem={handleDeleteItem}
            />
          </TabsContent>

          {/* Overzicht Tab */}
          <TabsContent value="overzicht" className="space-y-4">
            <OverzichtTab
              urenTotals={urenTotals}
              machineTotals={machineTotals}
            />
          </TabsContent>
        </Tabs>
      </m.div>

      {/* Uren Entry Form */}
      <UrenEntryForm
        open={showUrenForm}
        onOpenChange={setShowUrenForm}
        onSubmit={handleAddUren}
        isLoading={isSaving}
        existingMedewerkers={existingMedewerkers}
        databaseMedewerkers={medewerkers as DatabaseMedewerker[] | undefined}
      />

      {/* Machine Usage Form */}
      {showMachineForm && (
        <MachineFormDialog
          open={showMachineForm}
          onOpenChange={setShowMachineForm}
          selectedMachine={selectedMachine}
          onSelectedMachineChange={setSelectedMachine}
          machineDate={machineDate}
          onMachineDateChange={setMachineDate}
          machineUren={machineUren}
          onMachineUrenChange={setMachineUren}
          onSubmit={handleAddMachineUsage}
          isSaving={isSaving}
          machines={machines}
        />
      )}

      {/* Delete confirmation */}
      <DeleteConfirmationDialog
        open={showDeleteDialog}
        onOpenChange={setShowDeleteDialog}
        itemType={itemToDelete?.type ?? null}
        onConfirm={handleDelete}
        onCancel={() => setItemToDelete(null)}
      />
    </>
  );
}
