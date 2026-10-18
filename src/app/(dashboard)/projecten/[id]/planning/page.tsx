"use client";

/**
 * Projectplanning (redesign okt 2026): per scope een sectie met de taken,
 * rechts de doorlooptijd, een waarschuwing als taken en voorcalculatie
 * uiteenlopen, en de voertuigen. De kop (naam, status, fasen) is de gedeelde
 * `ProjectKop`; de oude stepper-kaart en de blokken "Planning overzicht" en
 * "Details per scope" zijn vervallen — hun cijfers staan in de scope-koppen.
 */

import { use, useState, useCallback, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../../../../convex/_generated/api";
import { Id } from "../../../../../../convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NumberInput } from "@/components/ui/number-input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PageHeader } from "@/components/page-header";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { AlertTriangle, ArrowRight, Loader2, Play, Plus, RefreshCw, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { usePlanning, type TaakStatus } from "@/hooks/use-planning";
import { TakenLijst } from "@/components/project/taken-lijst";
import { ProjectDuurCard } from "@/components/project/project-duur-card";
import { ProjectKop } from "@/components/project/project-kop";
import { VoertuigSelector } from "@/components/project/voertuig-selector";
import { getal } from "@/components/project/project-cijfers";
import { SectiePaneel } from "@/components/ui/sectie-paneel";
import { getScopeDisplayName, takenTemplates } from "@/lib/planning-templates";
import { ProjectNietGevonden } from "@/components/project/project-niet-gevonden";
import ProjectPlanningLoading from "./loading";
import { REVEAL_KLASSE } from "@/components/pagina-reveal";

const LEGE_TAAK = { scope: "", taakNaam: "", normUren: 0 };

export default function PlanningPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const projectId = id as Id<"projecten">;

  // Zelfde query als ProjectKop: Convex dedupliceert op query + args.
  const details = useQuery(api.projecten.getWithDetails, { id: projectId });
  const project = details?.project;
  const offerte = details?.offerte;

  // Voorcalculatie uit `getWithDetails`: dezelfde zoekvolgorde als de rest
  // van het project (convex/lib/voorcalculatieLookup.ts).
  const voorcalculatie = details?.voorcalculatie;

  const team = useQuery(api.teams.get, project?.teamId ? { id: project.teamId } : "skip");

  const {
    taken,
    summary,
    isLoading,
    generateFromVoorcalculatie,
    updateStatus,
    updateVolgorde,
    removeTask,
    addTask,
  } = usePlanning(projectId);

  const updateProjectStatus = useMutation(api.projecten.updateStatus);

  // KLIC-melding: wettelijk verplicht bij aanleg met graafwerk. De server
  // weigert starten zonder; die eis hoort daarom vóóraf zichtbaar in het
  // startdialoog te staan, niet achteraf in een wegflitsende fout-toast.
  const klicVereist =
    offerte?.type === "aanleg" &&
    (offerte?.scopes ?? []).includes("grondwerk") &&
    !project?.klicMeldingGedaan;

  const [isGenerating, setIsGenerating] = useState(false);
  const [bevestigOpnieuw, setBevestigOpnieuw] = useState(false);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isStartingExecution, setIsStartingExecution] = useState(false);
  const [showStartExecutionDialog, setShowStartExecutionDialog] = useState(false);
  const [klicBevestigd, setKlicBevestigd] = useState(false);
  const [startDatum, setStartDatum] = useState<Date | null>(null);
  const [newTask, setNewTask] = useState(LEGE_TAAK);

  // Optimistische updates voor status en verwijderen
  const [optimisticStatusUpdates, setOptimisticStatusUpdates] = useState<Map<string, TaakStatus>>(new Map());
  const [optimisticDeletedIds, setOptimisticDeletedIds] = useState<Set<string>>(new Set());

  const teamGrootte = voorcalculatie?.teamGrootte ?? 2;
  const effectieveUrenPerDag = voorcalculatie?.effectieveUrenPerDag ?? 6;

  const calculateDays = useCallback(
    (hours: number): number => {
      const effectiveTeamHours = teamGrootte * effectieveUrenPerDag;
      if (effectiveTeamHours <= 0) return 0;
      return Math.round((hours / effectiveTeamHours) * 100) / 100;
    },
    [teamGrootte, effectieveUrenPerDag]
  );

  const handleGenerate = useCallback(async () => {
    setIsGenerating(true);
    try {
      const result = await generateFromVoorcalculatie();
      toast.success(`${result.count} taken gegenereerd`);
    } catch (err) {
      toast.error("Fout bij genereren taken", {
        description: err instanceof Error ? err.message : "Onbekende fout",
      });
    } finally {
      setIsGenerating(false);
    }
  }, [generateFromVoorcalculatie]);

  const handleUpdateStatus = async (taskId: Id<"planningTaken">, status: TaakStatus) => {
    setOptimisticStatusUpdates((prev) => new Map(prev).set(taskId, status));
    const wisOptimistisch = () =>
      setOptimisticStatusUpdates((prev) => {
        const next = new Map(prev);
        next.delete(taskId);
        return next;
      });
    try {
      await updateStatus(taskId, status);
      wisOptimistisch();
    } catch {
      wisOptimistisch();
      toast.error("Fout bij bijwerken status");
    }
  };

  const handleDelete = async (taskId: Id<"planningTaken">) => {
    setOptimisticDeletedIds((prev) => new Set(prev).add(taskId));
    toast.success("Taak verwijderd");
    const wisOptimistisch = () =>
      setOptimisticDeletedIds((prev) => {
        const next = new Set(prev);
        next.delete(taskId);
        return next;
      });
    try {
      await removeTask(taskId);
      wisOptimistisch();
    } catch {
      wisOptimistisch();
      toast.error("Fout bij verwijderen taak");
    }
  };

  const handleReorder = async (
    taskOrders: Array<{ taskId: Id<"planningTaken">; volgorde: number }>
  ) => {
    try {
      await updateVolgorde(taskOrders);
    } catch {
      toast.error("Fout bij herschikken taken");
    }
  };

  const openToevoegen = (scope = "") => {
    setNewTask({ ...LEGE_TAAK, scope });
    setIsAddDialogOpen(true);
  };

  const handleAddTask = async () => {
    if (!newTask.scope || !newTask.taakNaam || newTask.normUren <= 0) {
      toast.error("Vul alle velden in");
      return;
    }
    try {
      await addTask({
        scope: newTask.scope,
        taakNaam: newTask.taakNaam,
        normUren: newTask.normUren,
        geschatteDagen: calculateDays(newTask.normUren),
      });
      toast.success("Taak toegevoegd");
      setIsAddDialogOpen(false);
      setNewTask(LEGE_TAAK);
    } catch {
      toast.error("Fout bij toevoegen taak");
    }
  };

  const handleStartExecution = async (skipKlicCheck = false) => {
    setIsStartingExecution(true);
    try {
      await updateProjectStatus({ id: projectId, status: "in_uitvoering", skipKlicCheck });
      toast.success("Project gestart! Je wordt doorgestuurd naar de uitvoering.");
      router.push(`/projecten/${id}/uitvoering`);
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : "Onbekende fout";
      if (errorMsg.includes("KLIC-melding")) {
        toast.error("KLIC-melding niet bevestigd", {
          description: "Wil je de KLIC-melding overslaan en toch starten?",
          action: {
            label: "Toch starten",
            onClick: () => handleStartExecution(true),
          },
        });
      } else {
        toast.error("Fout bij starten uitvoering", { description: errorMsg });
      }
      setIsStartingExecution(false);
      setShowStartExecutionDialog(false);
    }
  };

  const canStartExecution = project?.status === "gepland";

  const takenMetOptimistisch = useMemo(
    () =>
      taken
        .filter((taak) => !optimisticDeletedIds.has(taak._id))
        .map((taak) => {
          const status = optimisticStatusUpdates.get(taak._id);
          return status ? { ...taak, status } : taak;
        }),
    [taken, optimisticStatusUpdates, optimisticDeletedIds]
  );

  const takenPerScope = useMemo(() => {
    const perScope: Record<string, typeof takenMetOptimistisch> = {};
    for (const taak of takenMetOptimistisch) {
      (perScope[taak.scope] ??= []).push(taak);
    }
    return perScope;
  }, [takenMetOptimistisch]);

  // Scopes in het toevoegdialoog: de sjablonen plus wat er al in de planning staat.
  const availableScopes = useMemo(
    () => Array.from(new Set([...Object.keys(takenTemplates), ...Object.keys(takenPerScope)])),
    [takenPerScope]
  );

  const breadcrumb = (
    <PageHeader
      customLabels={{ [`/projecten/${id}`]: project?.naam ?? "Project" }}
    />
  );

  // Zelfde skeleton als loading.tsx, zodat er na de routewissel geen tweede
  // (andere) laadstaat verschijnt.
  if (isLoading || details === undefined) {
    return <ProjectPlanningLoading />;
  }

  if (details === null || !project) {
    return <ProjectNietGevonden projectId={id} pad="planning" />;
  }

  const taakUren = summary?.totaalUren ?? 0;
  const begroteUren = voorcalculatie?.normUrenTotaal ?? 0;
  // Alleen waarschuwen als beide er zijn en ze op één decimaal verschillen.
  const urenWijkenAf = taakUren > 0 && begroteUren > 0 && getal(taakUren) !== getal(begroteUren);

  return (
    <>
      {breadcrumb}

      <div className={`${REVEAL_KLASSE} flex flex-1 flex-col gap-5 p-4 md:p-8`}>
        <ProjectKop
          projectId={id}
          actief="planning"
          acties={
            <>
              {/* Automatisch taken invullen uit de voorcalculatie: altijd in de
                  kop zodra er een voorcalculatie is. Zonder taken is dit dé
                  hoofdactie; met taken een omlijnde "opnieuw". */}
              {voorcalculatie && (
                <Button
                  variant={taken.length > 0 ? "outline" : "default"}
                  onClick={() => (taken.length > 0 ? setBevestigOpnieuw(true) : handleGenerate())}
                  disabled={isGenerating}
                >
                  {isGenerating ? (
                    <Loader2 className="mr-2 size-4 animate-spin" aria-hidden="true" />
                  ) : taken.length > 0 ? (
                    <RefreshCw className="mr-2 size-4" aria-hidden="true" />
                  ) : (
                    <Sparkles className="mr-2 size-4" aria-hidden="true" />
                  )}
                  {taken.length > 0 ? "Taken opnieuw genereren" : "Taken automatisch genereren"}
                </Button>
              )}
              <Button
                variant={taken.length > 0 || !voorcalculatie ? "default" : "outline"}
                onClick={() => openToevoegen()}
              >
                <Plus className="mr-2 size-4" aria-hidden="true" />
                Taak toevoegen
              </Button>
              <AlertDialog open={bevestigOpnieuw} onOpenChange={setBevestigOpnieuw}>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Taken opnieuw genereren?</AlertDialogTitle>
                    <AlertDialogDescription>
                      {taken.length === 1
                        ? "De huidige taak verdwijnt, met zijn status."
                        : `Alle ${taken.length} huidige taken verdwijnen, met hun status.`}{" "}
                      Daarna komen de taken opnieuw uit de voorcalculatie; zelf toegevoegde
                      taken komen niet terug.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Annuleren</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={() => {
                        setBevestigOpnieuw(false);
                        void handleGenerate();
                      }}
                    >
                      Opnieuw genereren
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </>
          }
        />

        <div className="@container/planning">
          <div className="grid items-start gap-5 @4xl/planning:grid-cols-[minmax(0,1fr)_minmax(18rem,24rem)]">
            {/* Taken per scope */}
            <div className="flex min-w-0 flex-col gap-4">
              {taken.length === 0 ? (
                <SectiePaneel titel="Taken" kopbalk>
                  <div className="flex flex-col items-start gap-3 p-4">
                    <div className="flex flex-col gap-1">
                      <p className="text-sm font-medium">Nog geen taken gepland</p>
                      <p className="max-w-prose text-[13px] text-muted-foreground">
                        {voorcalculatie
                          ? "Genereer de taken uit de voorcalculatie, of voeg ze zelf toe."
                          : "Er is nog geen voorcalculatie. Maak die eerst bij de offerte, dan kun je de taken genereren."}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {voorcalculatie ? (
                        <Button variant="outline" onClick={handleGenerate} disabled={isGenerating}>
                          {isGenerating ? (
                            <Loader2 className="mr-2 size-4 animate-spin" aria-hidden="true" />
                          ) : (
                            <Sparkles className="mr-2 size-4" aria-hidden="true" />
                          )}
                          Taken automatisch genereren
                        </Button>
                      ) : (
                        project?.offerteId && (
                          <Button asChild>
                            <Link href={`/offertes/${project.offerteId}/voorcalculatie`}>
                              Naar de voorcalculatie
                              <ArrowRight className="ml-2 size-4" aria-hidden="true" />
                            </Link>
                          </Button>
                        )
                      )}
                    </div>
                  </div>
                </SectiePaneel>
              ) : (
                <TakenLijst
                  takenPerScope={takenPerScope}
                  onUpdateStatus={handleUpdateStatus}
                  onReorder={handleReorder}
                  onDelete={handleDelete}
                  onTaakToevoegen={openToevoegen}
                  isLoading={isLoading}
                />
              )}
            </div>

            {/* Zijkolom: wanneer, met wie, waarmee */}
            <aside aria-label="Doorlooptijd en middelen" className="flex min-w-0 flex-col gap-4">
              {canStartExecution && (
                <SectiePaneel titel="Uitvoering starten" kopbalk>
                  <div className="flex flex-col gap-3 p-4">
                    <p className="text-[13px] text-muted-foreground">
                      {taken.length > 0
                        ? "Na de start registreer je uren op dit project en loopt de voortgang mee."
                        : "Voeg eerst taken toe; daarna kun je de uitvoering starten."}
                    </p>
                    <AlertDialog
                      open={showStartExecutionDialog}
                      onOpenChange={(open) => {
                        setShowStartExecutionDialog(open);
                        if (!open) setKlicBevestigd(false);
                      }}
                    >
                      <AlertDialogTrigger asChild>
                        <Button variant="outline" disabled={taken.length === 0} className="self-start">
                          <Play className="mr-2 size-4" aria-hidden="true" />
                          Uitvoering starten
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Uitvoering starten?</AlertDialogTitle>
                          <AlertDialogDescription asChild>
                            <div className="space-y-2">
                              <p>
                                De status van het project wordt &quot;In uitvoering&quot;. Daarna
                                kun je uren registreren op de taken, loopt de voortgang mee, en
                                maak je na afronding de nacalculatie.
                              </p>
                            </div>
                          </AlertDialogDescription>
                          {klicVereist && (
                            <div className="space-y-2 rounded-lg border border-status-vervallen-border bg-status-vervallen/20 p-3">
                              <p className="text-sm font-medium text-foreground">
                                KLIC-melding verplicht
                              </p>
                              <p className="text-sm text-muted-foreground">
                                Dit is een aanlegproject met graafwerk; een KLIC-melding bij het
                                Kadaster is wettelijk verplicht vóór er gegraven wordt.
                              </p>
                              <label className="flex cursor-pointer items-start gap-2 text-sm text-foreground">
                                <Checkbox
                                  checked={klicBevestigd}
                                  onCheckedChange={(v) => setKlicBevestigd(v === true)}
                                  className="mt-0.5"
                                />
                                <span>
                                  Ik bevestig dat de KLIC-melding voor dit project is gedaan
                                </span>
                              </label>
                            </div>
                          )}
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel disabled={isStartingExecution}>Annuleren</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => handleStartExecution(klicVereist && klicBevestigd)}
                            disabled={isStartingExecution || (klicVereist && !klicBevestigd)}
                          >
                            {isStartingExecution ? (
                              <>
                                <Loader2 className="mr-2 size-4 animate-spin" aria-hidden="true" />
                                Starten…
                              </>
                            ) : (
                              <>
                                <Play className="mr-2 size-4" aria-hidden="true" />
                                Uitvoering starten
                              </>
                            )}
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </SectiePaneel>
              )}

              <ProjectDuurCard
                totaalDagen={summary?.totaalDagen ?? 0}
                totaalUren={taakUren}
                teamGrootte={teamGrootte}
                effectieveUrenPerDag={effectieveUrenPerDag}
                startDatum={startDatum}
                onStartDatumChange={setStartDatum}
                geplandeStart={project?.geplandeStart}
                geplandeEind={project?.geplandeEind}
                teamNaam={team?.naam ?? null}
              />

              {urenWijkenAf && (
                <section
                  aria-label="Begroting wijkt af"
                  className="flex gap-2.5 rounded-lg border border-[color-mix(in_oklch,var(--accent-warm)_35%,var(--border))] bg-surface-aandacht px-4 py-3.5"
                >
                  <AlertTriangle className="mt-0.5 size-4 shrink-0 text-accent-warm" aria-hidden="true" />
                  <p className="text-[13px] tabular-nums">
                    <span className="font-semibold">
                      Taken tellen {getal(taakUren)} uur, de voorcalculatie {getal(begroteUren)} uur.
                    </span>{" "}
                    <span className="text-muted-foreground">
                      Uitvoering en nacalculatie rekenen met {getal(begroteUren)}. Pas taken of
                      voorcalculatie aan.
                    </span>
                  </p>
                </section>
              )}

              <VoertuigSelector
                projectId={projectId}
                selectedVoertuigen={(project?.toegewezenVoertuigen as Id<"voertuigen">[]) || []}
                autoSave={true}
              />
            </aside>
          </div>
        </div>
      </div>

      <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Taak toevoegen</DialogTitle>
            <DialogDescription>Voeg een eigen taak toe aan de planning.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="scope">Scope</Label>
              <Select
                value={newTask.scope}
                onValueChange={(value) => setNewTask({ ...newTask, scope: value })}
              >
                <SelectTrigger id="scope">
                  <SelectValue placeholder="Kies een scope" />
                </SelectTrigger>
                <SelectContent>
                  {availableScopes.map((scope) => (
                    <SelectItem key={scope} value={scope}>
                      {getScopeDisplayName(scope)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="taakNaam">Taaknaam</Label>
              <Input
                id="taakNaam"
                value={newTask.taakNaam}
                onChange={(e) => setNewTask({ ...newTask, taakNaam: e.target.value })}
                placeholder="Bijv. extra afwerking"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="normUren">Geschatte uren</Label>
              <NumberInput
                id="normUren"
                value={newTask.normUren}
                onChange={(normUren) => setNewTask((prev) => ({ ...prev, normUren }))}
                min={0}
                step={0.5}
                decimals={2}
                showStepper={false}
                suffix="uur"
              />
              {newTask.normUren > 0 && (
                <p className="text-sm tabular-nums text-muted-foreground">
                  = {getal(calculateDays(newTask.normUren))} dagen
                </p>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>
              Annuleren
            </Button>
            <Button onClick={handleAddTask}>Toevoegen</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
