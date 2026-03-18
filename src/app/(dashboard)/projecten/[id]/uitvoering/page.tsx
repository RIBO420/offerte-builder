"use client";

import { useState, useCallback, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../../../../convex/_generated/api";
import { motion } from "framer-motion";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Separator } from "@/components/ui/separator";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Clock,
  Wrench,
  Plus,
  TrendingUp,
} from "lucide-react";
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

  // Fetch active medewerkers from database for the form dropdown
  const medewerkers = useQuery(api.medewerkers.getActive);

  // Mutation for updating project status
  const updateProjectStatus = useMutation(api.projecten.updateStatus);

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

  const isLoading = isUserLoading || isUrenLoading || isMachineLoading;

  // Group registrations by date
  const groupedByDate = useMemo(() => {
    const groups: Record<string, typeof registraties> = {};
    registraties.forEach((reg) => {
      if (!groups[reg.datum]) {
        groups[reg.datum] = [];
      }
      groups[reg.datum].push(reg);
    });
    // Sort dates descending
    return Object.entries(groups).sort(([a], [b]) => b.localeCompare(a));
  }, [registraties]);

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

    try {
      if (itemToDelete.type === "uren") {
        await deleteUren({ id: itemToDelete.id as Id<"urenRegistraties"> });
        toast.success("Registratie verwijderd");
      } else {
        await deleteMachineUsage({ id: itemToDelete.id as Id<"machineGebruik"> });
        toast.success("Machine gebruik verwijderd");
      }
      setShowDeleteDialog(false);
      setItemToDelete(null);
    } catch (error) {
      toast.error("Fout bij verwijderen");
      console.error(error);
    }
  }, [itemToDelete, deleteUren, deleteMachineUsage]);

  // Handle finish project (transition to afgerond)
  const handleFinishProject = useCallback(async () => {
    setIsFinishing(true);
    try {
      await updateProjectStatus({ id: projectId, status: "afgerond" });
      toast.success("Project afgerond! Je wordt doorgestuurd naar de nacalculatie.");
      router.push(`/projecten/${projectId}/nacalculatie`);
    } catch (error) {
      toast.error("Fout bij afronden project", {
        description: error instanceof Error ? error.message : "Onbekende fout",
      });
      setIsFinishing(false);
      setShowFinishDialog(false);
    }
  }, [projectId, updateProjectStatus, router]);

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
              <BreadcrumbPage>Uitvoering</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>
      </header>

      <motion.div
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
              machineUsage={machineUsage}
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
      </motion.div>

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
