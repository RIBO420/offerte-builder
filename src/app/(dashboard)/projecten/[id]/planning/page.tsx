"use client";

import { use, useState, useCallback, useMemo } from "react";
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
  CardFooter,
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
import { Progress } from "@/components/ui/progress";
import {
  ArrowLeft,
  Loader2,
  RefreshCw,
  Plus,
  ListTodo,
  Play,
  CheckCircle2,
  Circle,
  ArrowRight,
  ClipboardCheck,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";
import { usePlanning, type TaakStatus } from "@/hooks/use-planning";
import { TakenLijst } from "@/components/project/taken-lijst";
import { PlanningOverzicht } from "@/components/project/planning-overzicht";
import { ProjectDuurCard } from "@/components/project/project-duur-card";
import { ProjectProgressStepper } from "@/components/project/project-progress-stepper";
import { VoertuigSelector } from "@/components/project/voertuig-selector";
import {
  getScopeDisplayName,
  takenTemplates,
} from "@/lib/planning-templates";
import { cn } from "@/lib/utils";

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
    updateVolgorde,
    removeTask,
    addTask,
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

  // Handle status update
  const handleUpdateStatus = async (taskId: Id<"planningTaken">, status: TaakStatus) => {
    try {
      await updateStatus(taskId, status);
    } catch {
      toast.error("Fout bij bijwerken status");
    }
  };

  // Handle delete
  const handleDelete = async (taskId: Id<"planningTaken">) => {
    try {
      await removeTask(taskId);
      toast.success("Taak verwijderd");
    } catch {
      toast.error("Fout bij verwijderen taak");
    }
  };

  // Handle reorder (drag and drop)
  const handleReorder = async (
    taskOrders: Array<{ taskId: Id<"planningTaken">; volgorde: number }>
  ) => {
    try {
      await updateVolgorde(taskOrders);
    } catch {
      toast.error("Fout bij herschikken taken");
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
    } catch {
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

  // Planning checklist items
  const checklistItems = useMemo(() => {
    const hasVoertuigen = (project?.toegewezenVoertuigen as Id<"voertuigen">[])?.length > 0;

    return [
      {
        id: "taken",
        label: "Taken zijn gegenereerd",
        description: "Genereer taken vanuit de voorcalculatie of voeg handmatig taken toe",
        completed: taken.length > 0,
        action: !voorcalculatie ? null : {
          label: "Genereer Taken",
          onClick: handleGenerate,
          loading: isGenerating,
        },
      },
      {
        id: "voertuigen",
        label: "Voertuigen zijn toegewezen",
        description: "Selecteer welke voertuigen worden ingezet voor dit project",
        completed: hasVoertuigen,
        action: null, // User can use the selector in the sidebar
      },
      {
        id: "startdatum",
        label: "Startdatum is ingesteld",
        description: "Kies wanneer het project begint voor een realistische planning",
        completed: startDatum !== null,
        action: null, // User can use the date picker
      },
    ];
  }, [taken.length, project?.toegewezenVoertuigen, startDatum, voorcalculatie, isGenerating, handleGenerate]);

  const completedChecklistItems = checklistItems.filter(item => item.completed).length;
  const checklistProgress = Math.round((completedChecklistItems / checklistItems.length) * 100);
  const isReadyForExecution = taken.length > 0; // Minimum requirement: have tasks

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
            <Button variant="ghost" size="icon" className="h-9 w-9 sm:h-8 sm:w-8" asChild aria-label="Terug naar project">
              <Link href={`/projecten/${id}`}>
                <ArrowLeft className="h-4 w-4" />
              </Link>
            </Button>
            <div>
              <h1 className="text-2xl font-bold tracking-tight md:text-3xl">
                Planning
              </h1>
              <p className="text-muted-foreground">
                Bereid het project voor op uitvoering
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            {/* Show regenerate button only when tasks exist */}
            {taken.length > 0 && voorcalculatie && (
              <Button
                variant="outline"
                onClick={handleGenerate}
                disabled={isGenerating}
              >
                {isGenerating ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <RefreshCw className="mr-2 h-4 w-4" />
                )}
                Opnieuw Genereren
              </Button>
            )}
            <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
              <DialogTrigger asChild>
                <Button variant={taken.length > 0 ? "default" : "outline"}>
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

        {/* Progress Stepper - Shows actual project status from database */}
        <Card className="p-4 md:p-6">
          <ProjectProgressStepper
            projectId={id}
            projectStatus={(project?.status || "gepland") as "gepland" | "in_uitvoering" | "afgerond" | "nacalculatie_compleet" | "gefactureerd"}
            hasPlanning={taken.length > 0}
            hasUrenRegistraties={false}
            hasNacalculatie={false}
          />
        </Card>

        {/* Planning Guidance Card - Shows what needs to be done before starting execution */}
        {canStartExecution && (
          <Card className={cn(
            "border-2 transition-colors",
            isReadyForExecution
              ? "border-green-500/50 bg-green-50/50 dark:bg-green-950/20"
              : "border-amber-500/50 bg-amber-50/50 dark:bg-amber-950/20"
          )}>
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className={cn(
                    "p-2 rounded-lg shrink-0",
                    isReadyForExecution
                      ? "bg-green-100 dark:bg-green-900/50"
                      : "bg-amber-100 dark:bg-amber-900/50"
                  )}>
                    {isReadyForExecution ? (
                      <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400" />
                    ) : (
                      <ClipboardCheck className="h-5 w-5 text-amber-600 dark:text-amber-400" />
                    )}
                  </div>
                  <div>
                    <CardTitle className="text-lg">
                      {isReadyForExecution
                        ? "Klaar om te starten!"
                        : "Bereid de uitvoering voor"}
                    </CardTitle>
                    <CardDescription>
                      {isReadyForExecution
                        ? "De planning is compleet. Je kunt nu de uitvoering starten."
                        : "Doorloop onderstaande stappen voordat je de uitvoering start."}
                    </CardDescription>
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <span className={cn(
                    "text-2xl font-bold tabular-nums",
                    isReadyForExecution ? "text-green-600" : "text-amber-600"
                  )}>
                    {completedChecklistItems}/{checklistItems.length}
                  </span>
                  <p className="text-xs text-muted-foreground">voltooid</p>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Progress bar */}
              <Progress
                value={checklistProgress}
                className={cn(
                  "h-2",
                  isReadyForExecution && "[&>div]:bg-green-500"
                )}
              />

              {/* Checklist items */}
              <div className="space-y-3">
                {checklistItems.map((item) => (
                  <div
                    key={item.id}
                    className={cn(
                      "flex items-start gap-3 p-3 rounded-lg transition-colors",
                      item.completed
                        ? "bg-background/80"
                        : "bg-background"
                    )}
                  >
                    <div className="mt-0.5 shrink-0">
                      {item.completed ? (
                        <CheckCircle2 className="h-5 w-5 text-green-500" />
                      ) : (
                        <Circle className="h-5 w-5 text-muted-foreground/50" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={cn(
                        "font-medium",
                        item.completed && "text-muted-foreground line-through"
                      )}>
                        {item.label}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {item.description}
                      </p>
                    </div>
                    {!item.completed && item.action && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={item.action.onClick}
                        disabled={item.action.loading}
                        className="shrink-0"
                      >
                        {item.action.loading ? (
                          <Loader2 className="mr-2 h-3 w-3 animate-spin" />
                        ) : (
                          <Sparkles className="mr-2 h-3 w-3" />
                        )}
                        {item.action.label}
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
            <CardFooter className="border-t pt-4">
              <AlertDialog open={showStartExecutionDialog} onOpenChange={setShowStartExecutionDialog}>
                <AlertDialogTrigger asChild>
                  <Button
                    className={cn(
                      "w-full",
                      isReadyForExecution
                        ? "bg-green-600 hover:bg-green-700"
                        : ""
                    )}
                    disabled={!isReadyForExecution}
                  >
                    <Play className="mr-2 h-4 w-4" />
                    Start Uitvoering
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Project uitvoering starten?</AlertDialogTitle>
                    <AlertDialogDescription className="space-y-3">
                      <p>
                        Je staat op het punt om de uitvoering van dit project te starten.
                        De status wordt gewijzigd naar &quot;In Uitvoering&quot;.
                      </p>
                      <div className="bg-muted p-3 rounded-lg space-y-2">
                        <p className="font-medium text-foreground">Wat gebeurt er?</p>
                        <ul className="text-sm space-y-1">
                          <li className="flex items-center gap-2">
                            <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0" />
                            Je kunt uren gaan registreren op taken
                          </li>
                          <li className="flex items-center gap-2">
                            <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0" />
                            De voortgang wordt bijgehouden
                          </li>
                          <li className="flex items-center gap-2">
                            <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0" />
                            Na afronding kun je een nacalculatie maken
                          </li>
                        </ul>
                      </div>
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
            </CardFooter>
          </Card>
        )}

        {/* Main Content */}
        <div className="grid gap-6 lg:grid-cols-3">
          {/* Left Column - Tasks List */}
          <div className="lg:col-span-2 space-y-6">
            {taken.length === 0 ? (
              <Card>
                <CardContent className="py-12">
                  <div className="flex flex-col items-center justify-center text-center">
                    <div className="p-4 rounded-full bg-muted mb-4">
                      <ListTodo className="h-8 w-8 text-muted-foreground" />
                    </div>
                    <h3 className="text-lg font-semibold">
                      Nog geen taken gepland
                    </h3>
                    {!voorcalculatie ? (
                      <>
                        <p className="text-sm text-muted-foreground mt-2 max-w-md">
                          Er is geen voorcalculatie gevonden voor dit project.
                          Maak eerst een voorcalculatie aan bij de offerte om taken te kunnen genereren.
                        </p>
                        {project?.offerteId && (
                          <div className="flex gap-2 mt-6">
                            <Button asChild>
                              <Link href={`/offertes/${project.offerteId}/voorcalculatie`}>
                                <ArrowRight className="mr-2 h-4 w-4" />
                                Naar Offerte Voorcalculatie
                              </Link>
                            </Button>
                          </div>
                        )}
                      </>
                    ) : (
                      <>
                        <p className="text-sm text-muted-foreground mt-2 max-w-md">
                          Start met het plannen van je project door taken te genereren
                          vanuit de voorcalculatie, of voeg handmatig taken toe.
                        </p>
                        <div className="flex flex-col sm:flex-row gap-3 mt-6">
                          <Button onClick={handleGenerate} disabled={isGenerating}>
                            {isGenerating ? (
                              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            ) : (
                              <Sparkles className="mr-2 h-4 w-4" />
                            )}
                            Genereer Taken Automatisch
                          </Button>
                          <Button variant="outline" onClick={() => setIsAddDialogOpen(true)}>
                            <Plus className="mr-2 h-4 w-4" />
                            Handmatig Toevoegen
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
                onReorder={handleReorder}
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
