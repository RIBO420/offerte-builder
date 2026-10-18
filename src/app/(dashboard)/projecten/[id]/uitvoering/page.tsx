"use client";

import { useState, useCallback, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import { useQuery, useMutation } from "convex/react";
import { format } from "date-fns";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { api } from "../../../../../../convex/_generated/api";
import { Id } from "../../../../../../convex/_generated/dataModel";
import { PaginaReveal } from "@/components/pagina-reveal";
import { PageHeader } from "@/components/page-header";
import { ProjectKop } from "@/components/project/project-kop";
import { ProjectNietGevonden } from "@/components/project/project-niet-gevonden";
import { Button } from "@/components/ui/button";
import { SectiePaneel } from "@/components/ui/sectie-paneel";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { logger } from "@/lib/logger";
import { useCurrentUser } from "@/hooks/use-current-user";
import { useUrenRegistratie, useMachineGebruik } from "@/hooks/use-uren-registratie";
import { useMachines } from "@/hooks/use-machines";
import { UrenImport } from "@/components/project/uren-import";
import {
  UrenEntryForm,
  UrenEntryData,
  type UrenFormulierData,
  DatabaseMedewerker,
} from "@/components/project/uren-entry-form";

import {
  UrenBegroting,
  FinishProjectSection,
  UitvoeringKlaarSection,
  UrenTab,
  MachinesTab,
  PerMedewerkerTab,
  MachineFormDialog,
  DeleteConfirmationDialog,
  KlicMeldingBanner,
  type UrenRegistratie,
} from "./components";

const TAB_TRIGGER = "flex-none px-3 text-[13px] data-[state=active]:font-semibold";

export default function UitvoeringPage() {
  const params = useParams();
  const router = useRouter();
  const projectId = params.id as Id<"projecten">;

  // Project, offerte en planningstaken; dezelfde query als de ProjectKop
  // (Convex dedupliceert op query + args).
  const details = useQuery(api.projecten.getWithDetails, { id: projectId });
  const project = details?.project;
  const offerte = details?.offerte;

  // Voorcalculatie uit `getWithDetails`: dezelfde zoekvolgorde als de rest
  // van het project (convex/lib/voorcalculatieLookup.ts).
  const voorcalculatie = details?.voorcalculatie;

  // Actieve medewerkers voor de keuzelijst in het formulier
  const medewerkers = useQuery(api.medewerkers.getActive);

  const updateProjectStatus = useMutation(api.projecten.updateStatus);
  const setKlicMelding = useMutation(api.projecten.setKlicMelding);

  const { isLoading: isUserLoading } = useCurrentUser();
  const {
    registraties,
    totals: urenTotals,
    isLoading: isUrenLoading,
    add: addUren,
    importEntries,
    update: updateUren,
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
  const [bewerkItem, setBewerkItem] = useState<UrenRegistratie | null>(null);
  const [showMachineForm, setShowMachineForm] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<{ type: "uren" | "machine"; id: string } | null>(null);
  const [showFinishDialog, setShowFinishDialog] = useState(false);
  const [isFinishing, setIsFinishing] = useState(false);

  // Machineformulier
  const [selectedMachine, setSelectedMachine] = useState<string>("");
  const [machineDate, setMachineDate] = useState<string>(format(new Date(), "yyyy-MM-dd"));
  const [machineUren, setMachineUren] = useState<string>("");

  // Optimistische updates
  const [optimisticDeletedItemIds, setOptimisticDeletedItemIds] = useState<Set<string>>(new Set());
  const [optimisticKlicMelding, setOptimisticKlicMelding] = useState<boolean | null>(null);

  const isLoading = Boolean(
    isUserLoading || isUrenLoading || isMachineLoading || details === undefined
  );

  const zichtbareRegistraties = useMemo(
    () => registraties.filter((reg) => !optimisticDeletedItemIds.has(reg._id)),
    [registraties, optimisticDeletedItemIds]
  );

  // Registraties per dag, nieuwste dag eerst
  const groupedByDate = useMemo(() => {
    const groups: Record<string, typeof zichtbareRegistraties> = {};
    zichtbareRegistraties.forEach((reg) => {
      (groups[reg.datum] ??= []).push(reg);
    });
    return Object.entries(groups).sort(([a], [b]) => b.localeCompare(a));
  }, [zichtbareRegistraties]);

  const filteredMachineUsage = useMemo(
    () => machineUsage.filter((item) => !optimisticDeletedItemIds.has(item._id)),
    [machineUsage, optimisticDeletedItemIds]
  );

  const existingMedewerkers = useMemo(
    () => [...new Set(registraties.map((r) => r.medewerker))],
    [registraties]
  );

  const handleImport = useCallback(
    async (entries: UrenEntryData[]) => {
      setIsImporting(true);
      try {
        const result = await importEntries(entries);
        toast.success(`${result.count} registraties geïmporteerd`);
      } catch (error) {
        toast.error("Fout bij importeren");
        logger.error("Importeren urenregistraties mislukt", error, {
          module: "projecten/uitvoering",
          aantalRegels: entries.length,
        });
      } finally {
        setIsImporting(false);
      }
    },
    [importEntries]
  );

  const handleAddUren = useCallback(
    async (data: UrenFormulierData) => {
      setIsSaving(true);
      try {
        await addUren({
          ...data,
          scope: data.scope ?? undefined,
          notities: data.notities ?? undefined,
        });
        toast.success("Uren geregistreerd");
        setShowUrenForm(false);
      } catch (error) {
        toast.error("Fout bij registreren uren");
        logger.error("Registreren uren mislukt", error, {
          module: "projecten/uitvoering",
        });
      } finally {
        setIsSaving(false);
      }
    },
    [addUren]
  );

  const handleEditUren = useCallback(
    async (data: UrenFormulierData) => {
      if (!bewerkItem) return;
      setIsSaving(true);
      try {
        await updateUren({ id: bewerkItem._id as Id<"urenRegistraties">, ...data });
        toast.success("Registratie bijgewerkt");
        setBewerkItem(null);
      } catch (error) {
        toast.error("Fout bij bijwerken registratie");
        logger.error("Bijwerken urenregistratie mislukt", error, {
          module: "projecten/uitvoering",
        });
      } finally {
        setIsSaving(false);
      }
    },
    [bewerkItem, updateUren]
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
      toast.success("Machinegebruik geregistreerd");
      setShowMachineForm(false);
      setSelectedMachine("");
      setMachineUren("");
    } catch (error) {
      toast.error("Fout bij registreren machinegebruik");
      logger.error("Registreren machinegebruik mislukt", error, {
        module: "projecten/uitvoering",
      });
    } finally {
      setIsSaving(false);
    }
  }, [selectedMachine, machineDate, machineUren, addMachineUsage]);

  const handleDelete = useCallback(async () => {
    if (!itemToDelete) return;

    const deletedId = itemToDelete.id;
    const deletedType = itemToDelete.type;

    // Optimistisch: direct verbergen en dialoog sluiten
    setOptimisticDeletedItemIds((prev) => new Set(prev).add(deletedId));
    setShowDeleteDialog(false);
    setItemToDelete(null);
    toast.success(deletedType === "uren" ? "Registratie verwijderd" : "Machinegebruik verwijderd");

    const herstel = () =>
      setOptimisticDeletedItemIds((prev) => {
        const newSet = new Set(prev);
        newSet.delete(deletedId);
        return newSet;
      });

    try {
      if (deletedType === "uren") {
        await deleteUren({ id: deletedId as Id<"urenRegistraties"> });
      } else {
        await deleteMachineUsage({ id: deletedId as Id<"machineGebruik"> });
      }
      // Server bevestigt — echte data neemt het over
      herstel();
    } catch (error) {
      // Terugdraaien: de regel verschijnt weer
      herstel();
      toast.error("Fout bij verwijderen");
      logger.error("Verwijderen registratie mislukt", error, {
        module: "projecten/uitvoering",
      });
    }
  }, [itemToDelete, deleteUren, deleteMachineUsage]);

  // Project afronden (→ afgerond)
  const handleFinishProject = useCallback(async () => {
    setIsFinishing(true);

    // Optimistisch: direct door naar de nacalculatie
    toast.success("Project afgerond. Je gaat naar de nacalculatie.");
    router.push(`/projecten/${projectId}/nacalculatie`);

    try {
      await updateProjectStatus({ id: projectId, status: "afgerond" });
    } catch (error) {
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

  // PRJ-W01: KLIC-melding verplicht bij aanleg met grondwerk
  const requiresKlicMelding =
    offerte?.type === "aanleg" && offerte?.scopes?.includes("grondwerk");
  const klicMeldingGedaan = optimisticKlicMelding ?? project?.klicMeldingGedaan === true;

  const handleKlicMeldingToggle = useCallback(
    async (checked: boolean) => {
      setOptimisticKlicMelding(checked);
      toast.success(
        checked ? "KLIC-melding als gedaan gemarkeerd" : "KLIC-melding markering verwijderd"
      );

      try {
        await setKlicMelding({ id: projectId, klicMeldingGedaan: checked });
        setOptimisticKlicMelding(null);
      } catch (error) {
        setOptimisticKlicMelding(null);
        toast.error("Fout bij opslaan KLIC-melding status");
        logger.error("Opslaan KLIC-meldingstatus mislukt", error, {
          module: "projecten/uitvoering",
          projectId,
        });
      }
    },
    [projectId, setKlicMelding]
  );

  const canFinishProject = project?.status === "in_uitvoering" && urenTotals.totaalUren > 0;
  const hasVoorcalculatie = !!voorcalculatie;
  const begroteUren = voorcalculatie?.normUrenTotaal || 0;

  const openTaken = useMemo(() => {
    const taken = details?.planningTaken ?? [];
    if (taken.length === 0) return null;
    return {
      open: taken.filter((t) => t.status !== "afgerond").length,
      totaal: taken.length,
    };
  }, [details?.planningTaken]);

  const handleDeleteItem = useCallback((item: { type: "uren" | "machine"; id: string }) => {
    setItemToDelete(item);
    setShowDeleteDialog(true);
  }, []);

  const isAfgerond =
    project?.status === "afgerond" ||
    project?.status === "nacalculatie_compleet" ||
    project?.status === "gefactureerd";

  if (details === null) {
    return <ProjectNietGevonden projectId={projectId} pad="uitvoering" />;
  }

  return (
    <>
      <PageHeader customLabels={{ [`/projecten/${projectId}`]: project?.naam ?? "Project" }} />

      {/* Eén reveal op de buitenkant; de blokken eronder zijn gewone divs en
          staan er dus ook als er nul animatieframes vallen.
          → src/components/pagina-reveal.tsx */}
      <PaginaReveal className="flex flex-1 flex-col gap-5 p-4 md:p-8">
        <ProjectKop
          projectId={projectId}
          actief="uitvoering"
          acties={
            // Na afronden staan de uren vast: geen registreren of importeren meer.
            isAfgerond ? undefined : (
              <>
                <UrenImport onImport={handleImport} isImporting={isImporting} />
                <Button onClick={() => setShowUrenForm(true)}>
                  <Plus className="mr-2 size-4" />
                  Uren registreren
                </Button>
              </>
            )
          }
        />

        <div className="@container/werk">
          <div className="grid items-start gap-5 @4xl/werk:grid-cols-[minmax(0,1fr)_minmax(18rem,22rem)]">
            <div className="flex min-w-0 flex-col gap-4">
              {requiresKlicMelding && (
                <KlicMeldingBanner gedaan={klicMeldingGedaan} onToggle={handleKlicMeldingToggle} />
              )}

              <UrenBegroting
                isLoading={isLoading}
                gelogd={urenTotals.totaalUren}
                begroot={begroteUren}
                heeftVoorcalculatie={hasVoorcalculatie}
                aantalMedewerkers={Object.keys(urenTotals.perMedewerker).length}
                aantalWerkdagen={Object.keys(urenTotals.perDatum).length}
                machineKosten={machineTotals.totaalKosten}
              />

              <SectiePaneel titel="Registraties">
                <Tabs value={activeTab} onValueChange={setActiveTab} className="gap-0">
                  <div className="px-3 pb-1.5 pt-3">
                    <TabsList aria-label="Registraties">
                      <TabsTrigger value="uren" className={TAB_TRIGGER}>
                        Uren · <span className="tabular-nums">{zichtbareRegistraties.length}</span>
                      </TabsTrigger>
                      <TabsTrigger value="machines" className={TAB_TRIGGER}>
                        Machines · <span className="tabular-nums">{filteredMachineUsage.length}</span>
                      </TabsTrigger>
                      <TabsTrigger value="medewerkers" className={TAB_TRIGGER}>
                        Per medewerker
                      </TabsTrigger>
                    </TabsList>
                  </div>

                  <TabsContent value="uren">
                    <UrenTab
                      isLoading={isLoading}
                      groupedByDate={groupedByDate}
                      onEditItem={setBewerkItem}
                      onDeleteItem={handleDeleteItem}
                      alleenLezen={isAfgerond}
                    />
                  </TabsContent>
                  <TabsContent value="machines">
                    <MachinesTab
                      isLoading={isLoading}
                      machineUsage={filteredMachineUsage}
                      totaalKosten={machineTotals.totaalKosten}
                      onShowMachineForm={() => setShowMachineForm(true)}
                      onDeleteItem={handleDeleteItem}
                      alleenLezen={isAfgerond}
                    />
                  </TabsContent>
                  <TabsContent value="medewerkers">
                    <PerMedewerkerTab registraties={zichtbareRegistraties} />
                  </TabsContent>
                </Tabs>
              </SectiePaneel>
            </div>

            <aside aria-label="Volgende stap" className="flex min-w-0 flex-col gap-4">
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
                  openTaken={openTaken}
                />
              )}
              {isAfgerond && <UitvoeringKlaarSection projectId={projectId} />}
            </aside>
          </div>
        </div>
      </PaginaReveal>

      {/* Nieuwe registratie */}
      <UrenEntryForm
        open={showUrenForm}
        onOpenChange={setShowUrenForm}
        onSubmit={handleAddUren}
        isLoading={isSaving}
        existingMedewerkers={existingMedewerkers}
        databaseMedewerkers={medewerkers as DatabaseMedewerker[] | undefined}
      />

      {/* Registratie bewerken; `key` laadt de waarden van de gekozen regel */}
      {bewerkItem && (
        <UrenEntryForm
          key={bewerkItem._id}
          modus="bewerken"
          open
          onOpenChange={(open) => !open && setBewerkItem(null)}
          onSubmit={handleEditUren}
          isLoading={isSaving}
          initialData={{
            datum: bewerkItem.datum,
            medewerker: bewerkItem.medewerker,
            uren: bewerkItem.uren,
            scope: bewerkItem.scope,
            notities: bewerkItem.notities,
          }}
          existingMedewerkers={existingMedewerkers}
          databaseMedewerkers={medewerkers as DatabaseMedewerker[] | undefined}
        />
      )}

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
