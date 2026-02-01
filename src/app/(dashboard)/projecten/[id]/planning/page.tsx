"use client";

import { use, useState, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../../../../convex/_generated/api";
import { Id } from "../../../../../../convex/_generated/dataModel";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
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
import {
  ArrowLeft,
  Loader2,
  RefreshCw,
  Plus,
  Calendar,
  ListTodo,
  Clock,
  Play,
} from "lucide-react";
import { toast } from "sonner";
import { usePlanning, type PlanningTaak, type TaakStatus } from "@/hooks/use-planning";
import { TakenLijst } from "@/components/project/taken-lijst";
import { PlanningOverzicht } from "@/components/project/planning-overzicht";
import { ProjectDuurCard } from "@/components/project/project-duur-card";
import { ProjectProgressStepper } from "@/components/project/project-progress-stepper";
import { VoertuigSelector } from "@/components/project/voertuig-selector";
import {
  getScopeDisplayName,
  takenTemplates,
} from "@/lib/planning-templates";

export default function PlanningPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const projectId = id as Id<"projecten">;

  // Get project data
  const project = useQuery(
    api.projecten.get,
    projectId ? { id: projectId } : "skip"
  );

  // Get voorcalculatie for team settings
  // With the new workflow, voorcalculatie is linked to the offerte, not the project
  // First try to get by offerte, then fallback to by project for legacy data
  const voorcalculatieByOfferte = useQuery(
    api.voorcalculaties.getByOfferte,
    project?.offerteId ? { offerteId: project.offerteId } : "skip"
  );
  const voorcalculatieByProject = useQuery(
    api.voorcalculaties.getByProject,
    projectId && !voorcalculatieByOfferte ? { projectId } : "skip"
  );
  const voorcalculatie = voorcalculatieByOfferte || voorcalculatieByProject;

  // Planning hook
  const {
    taken,
    takenPerScope,
    summary,
    isLoading,
    generateFromVoorcalculatie,
    updateStatus,
    removeTask,
    addTask,
    moveUp,
    moveDown,
  } = usePlanning(projectId);

  // Mutation for updating project status
  const updateProjectStatus = useMutation(api.projecten.updateStatus);

  // Local state
  const [isGenerating, setIsGenerating] = useState(false);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isStartingExecution, setIsStartingExecution] = useState(false);
  const [showStartExecutionDialog, setShowStartExecutionDialog] = useState(false);
  const [startDatum, setStartDatum] = useState<Date | null>(null);
  const [newTask, setNewTask] = useState({
    scope: "",
    taakNaam: "",
    normUren: 0,
  });

  // Team settings from voorcalculatie
  const teamGrootte = (voorcalculatie as any)?.teamGrootte || 2;
  const effectieveUrenPerDag = (voorcalculatie as any)?.effectieveUrenPerDag || 6;

  // Calculate days from hours
  const calculateDays = useCallback(
    (hours: number): number => {
      const effectiveTeamHours = teamGrootte * effectieveUrenPerDag;
      if (effectiveTeamHours <= 0) return 0;
      return Math.round((hours / effectiveTeamHours) * 100) / 100;
    },
    [teamGrootte, effectieveUrenPerDag]
  );

  // Handle generate tasks
  const handleGenerate = async () => {
    setIsGenerating(true);
    try {
      const result = await generateFromVoorcalculatie();
      toast.success(`${result.count} taken gegenereerd`);
    } catch (error) {
      toast.error("Fout bij genereren taken", {
        description: error instanceof Error ? error.message : "Onbekende fout",
      });
    } finally {
      setIsGenerating(false);
    }
  };

  // Handle status update
  const handleUpdateStatus = async (taskId: Id<"planningTaken">, status: TaakStatus) => {
    try {
      await updateStatus(taskId, status);
    } catch (error) {
      toast.error("Fout bij bijwerken status");
    }
  };

  // Handle delete
  const handleDelete = async (taskId: Id<"planningTaken">) => {
    try {
      await removeTask(taskId);
      toast.success("Taak verwijderd");
    } catch (error) {
      toast.error("Fout bij verwijderen taak");
    }
  };

  // Handle move up/down
  const handleMoveUp = async (taskId: Id<"planningTaken">) => {
    try {
      await moveUp(taskId);
    } catch (error) {
      toast.error("Fout bij verplaatsen taak");
    }
  };

  const handleMoveDown = async (taskId: Id<"planningTaken">) => {
    try {
      await moveDown(taskId);
    } catch (error) {
      toast.error("Fout bij verplaatsen taak");
    }
  };

  // Handle add custom task
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
      setNewTask({ scope: "", taakNaam: "", normUren: 0 });
    } catch (error) {
      toast.error("Fout bij toevoegen taak");
    }
  };

  // Get available scopes for new task
  const availableScopes = Object.keys(takenTemplates);

  // Handle start execution (transition to in_uitvoering)
  const handleStartExecution = async () => {
    setIsStartingExecution(true);
    try {
      await updateProjectStatus({ id: projectId, status: "in_uitvoering" });
      toast.success("Project gestart! Je wordt doorgestuurd naar de uitvoering.");
      router.push(`/projecten/${id}/uitvoering`);
    } catch (error) {
      toast.error("Fout bij starten uitvoering", {
        description: error instanceof Error ? error.message : "Onbekende fout",
      });
      setIsStartingExecution(false);
      setShowStartExecutionDialog(false);
    }
  };

  // Check if project can transition to execution
  const canStartExecution = project?.status === "gepland";

  // Loading state
  if (isLoading) {
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
              <BreadcrumbPage>Planning</BreadcrumbPage>
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
              <h1 className="text-2xl font-bold tracking-tight md:text-3xl">
                Planning
              </h1>
              <p className="text-muted-foreground">
                Beheer taken en bekijk projectplanning
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={handleGenerate}
              disabled={isGenerating || !voorcalculatie}
              title={!voorcalculatie ? "Geen voorcalculatie gevonden - maak deze aan bij de offerte" : undefined}
            >
              {isGenerating ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="mr-2 h-4 w-4" />
              )}
              {taken.length > 0 ? "Opnieuw Genereren" : "Genereer Taken"}
            </Button>
            {canStartExecution && (
              <AlertDialog open={showStartExecutionDialog} onOpenChange={setShowStartExecutionDialog}>
                <AlertDialogTrigger asChild>
                  <Button variant="default" className="bg-green-600 hover:bg-green-700">
                    <Play className="mr-2 h-4 w-4" />
                    Start Uitvoering
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Project uitvoering starten?</AlertDialogTitle>
                    <AlertDialogDescription>
                      Je staat op het punt om de uitvoering van dit project te starten.
                      De status wordt gewijzigd naar &quot;In Uitvoering&quot; en je kunt
                      beginnen met het registreren van gewerkte uren.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel disabled={isStartingExecution}>Annuleren</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={handleStartExecution}
                      disabled={isStartingExecution}
                      className="bg-green-600 hover:bg-green-700"
                    >
                      {isStartingExecution ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Starten...
                        </>
                      ) : (
                        <>
                          <Play className="mr-2 h-4 w-4" />
                          Start Uitvoering
                        </>
                      )}
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
            <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="mr-2 h-4 w-4" />
                  Taak Toevoegen
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Nieuwe Taak Toevoegen</DialogTitle>
                  <DialogDescription>
                    Voeg een aangepaste taak toe aan de planning.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label htmlFor="scope">Scope</Label>
                    <Select
                      value={newTask.scope}
                      onValueChange={(value) =>
                        setNewTask({ ...newTask, scope: value })
                      }
                    >
                      <SelectTrigger id="scope">
                        <SelectValue placeholder="Selecteer scope" />
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
                      onChange={(e) =>
                        setNewTask({ ...newTask, taakNaam: e.target.value })
                      }
                      placeholder="Bijv. Extra afwerking"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="normUren">Geschatte uren</Label>
                    <Input
                      id="normUren"
                      type="number"
                      min="0"
                      step="0.5"
                      value={newTask.normUren || ""}
                      onChange={(e) =>
                        setNewTask({
                          ...newTask,
                          normUren: parseFloat(e.target.value) || 0,
                        })
                      }
                      placeholder="0"
                    />
                    {newTask.normUren > 0 && (
                      <p className="text-sm text-muted-foreground">
                        = {calculateDays(newTask.normUren).toFixed(2)} dagen
                      </p>
                    )}
                  </div>
                </div>
                <DialogFooter>
                  <Button
                    variant="outline"
                    onClick={() => setIsAddDialogOpen(false)}
                  >
                    Annuleren
                  </Button>
                  <Button onClick={handleAddTask}>Toevoegen</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {/* Progress Stepper */}
        <Card className="p-4 md:p-6">
          <ProjectProgressStepper
            projectId={id}
            currentStatus="gepland"
            hasPlanning={taken.length > 0}
            hasUrenRegistraties={false}
            hasNacalculatie={false}
          />
        </Card>

        {/* Main Content */}
        <div className="grid gap-6 lg:grid-cols-3">
          {/* Left Column - Tasks List */}
          <div className="lg:col-span-2 space-y-6">
            {taken.length === 0 ? (
              <Card>
                <CardContent className="py-12">
                  <div className="flex flex-col items-center justify-center text-center">
                    <ListTodo className="h-12 w-12 text-muted-foreground/50 mb-4" />
                    <h3 className="text-lg font-medium">
                      Nog geen taken gepland
                    </h3>
                    {!voorcalculatie ? (
                      <>
                        <p className="text-sm text-muted-foreground mt-1 max-w-md">
                          Er is geen voorcalculatie gevonden voor dit project.
                          Maak een voorcalculatie aan bij de offerte.
                        </p>
                        {project?.offerteId && (
                          <div className="flex gap-2 mt-4">
                            <Button asChild>
                              <Link href={`/offertes/${project.offerteId}/voorcalculatie`}>
                                Naar Offerte Voorcalculatie
                              </Link>
                            </Button>
                          </div>
                        )}
                      </>
                    ) : (
                      <>
                        <p className="text-sm text-muted-foreground mt-1 max-w-md">
                          Genereer automatisch taken op basis van de voorcalculatie,
                          of voeg handmatig taken toe.
                        </p>
                        <div className="flex gap-2 mt-4">
                          <Button onClick={handleGenerate} disabled={isGenerating}>
                            {isGenerating ? (
                              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            ) : (
                              <RefreshCw className="mr-2 h-4 w-4" />
                            )}
                            Genereer Taken
                          </Button>
                        </div>
                      </>
                    )}
                  </div>
                </CardContent>
              </Card>
            ) : (
              <TakenLijst
                taken={taken}
                takenPerScope={takenPerScope}
                onUpdateStatus={handleUpdateStatus}
                onMoveUp={handleMoveUp}
                onMoveDown={handleMoveDown}
                onDelete={handleDelete}
                isLoading={isLoading}
              />
            )}
          </div>

          {/* Right Column - Overview & Duration */}
          <div className="space-y-6">
            <ProjectDuurCard
              totaalDagen={summary?.totaalDagen || 0}
              totaalUren={summary?.totaalUren || 0}
              teamGrootte={teamGrootte}
              effectieveUrenPerDag={effectieveUrenPerDag}
              startDatum={startDatum}
              onStartDatumChange={setStartDatum}
            />

            {/* Voertuigen Selector */}
            <VoertuigSelector
              projectId={projectId}
              selectedVoertuigen={(project?.toegewezenVoertuigen as Id<"voertuigen">[]) || []}
              autoSave={true}
            />

            {summary && taken.length > 0 && (
              <PlanningOverzicht summary={summary} isLoading={isLoading} />
            )}
          </div>
        </div>
      </div>
    </>
  );
}
