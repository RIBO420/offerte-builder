"use client";

import { useState, useCallback, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../../../../convex/_generated/api";
import { motion } from "framer-motion";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Clock,
  Users,
  Wrench,
  MoreHorizontal,
  Edit,
  Trash2,
  Loader2,
  Plus,
  Calendar,
  TrendingUp,
  CheckCircle,
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
import { format, parseISO } from "date-fns";
import { nl } from "date-fns/locale";

// Scope labels
const scopeLabels: Record<string, string> = {
  grondwerk: "Grondwerk",
  bestrating: "Bestrating",
  borders: "Borders",
  gras: "Gazon",
  houtwerk: "Houtwerk",
  water_elektra: "Water/Elektra",
  specials: "Specials",
  gras_onderhoud: "Gras Onderhoud",
  borders_onderhoud: "Borders Onderhoud",
  heggen: "Heggen",
  bomen: "Bomen",
  overig: "Overig",
};

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("nl-NL", {
    style: "currency",
    currency: "EUR",
  }).format(amount);
}

function formatDate(dateString: string): string {
  try {
    return format(parseISO(dateString), "EEEE d MMMM", { locale: nl });
  } catch {
    return dateString;
  }
}

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
            <Button onClick={() => setShowUrenForm(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Uren registreren
            </Button>
            {project?.status === "in_uitvoering" && (
              <AlertDialog open={showFinishDialog} onOpenChange={setShowFinishDialog}>
                <AlertDialogTrigger asChild>
                  <Button
                    variant="default"
                    className="bg-blue-600 hover:bg-blue-700"
                    disabled={!canFinishProject || !hasVoorcalculatie}
                    title={
                      !hasVoorcalculatie
                        ? "Geen voorcalculatie beschikbaar"
                        : urenTotals.totaalUren <= 0
                        ? "Registreer eerst gewerkte uren"
                        : undefined
                    }
                  >
                    <CheckCircle className="mr-2 h-4 w-4" />
                    Project Afronden
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Project afronden en naar nacalculatie?</AlertDialogTitle>
                    <AlertDialogDescription asChild>
                      <div className="space-y-4">
                        <p>
                          Je staat op het punt om dit project af te ronden. Hierna kun je
                          de nacalculatie bekijken en vergelijken met de voorcalculatie.
                        </p>
                        <div className="rounded-lg border p-4 space-y-2 bg-muted/50">
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Totaal geregistreerde uren:</span>
                            <span className="font-medium">{urenTotals.totaalUren.toFixed(1)} uur</span>
                          </div>
                          {hasVoorcalculatie && (
                            <>
                              <div className="flex justify-between">
                                <span className="text-muted-foreground">Begroot (voorcalculatie):</span>
                                <span className="font-medium">{begroteUren.toFixed(1)} uur</span>
                              </div>
                              <div className="flex justify-between border-t pt-2 mt-2">
                                <span className="text-muted-foreground">Verschil:</span>
                                <span className={`font-medium ${verschilUren > 0 ? "text-red-600" : verschilUren < 0 ? "text-green-600" : ""}`}>
                                  {verschilUren > 0 ? "+" : ""}{verschilUren.toFixed(1)} uur ({verschilPercentage}%)
                                </span>
                              </div>
                            </>
                          )}
                        </div>
                      </div>
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel disabled={isFinishing}>Annuleren</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={handleFinishProject}
                      disabled={isFinishing}
                      className="bg-blue-600 hover:bg-blue-700"
                    >
                      {isFinishing ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Afronden...
                        </>
                      ) : (
                        <>
                          <CheckCircle className="mr-2 h-4 w-4" />
                          Afronden & Naar Nacalculatie
                        </>
                      )}
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
          </div>
        </div>

        {/* Progress Stepper */}
        <Card className="p-4 md:p-6">
          <ProjectProgressStepper
            projectId={params.id as string}
            currentStatus="in_uitvoering"
            hasPlanning={true}
            hasUrenRegistraties={urenTotals.totaalUren > 0}
            hasNacalculatie={false}
          />
        </Card>

        {/* Stats Cards */}
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Totaal uren</CardTitle>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <>
                  <div className="text-2xl font-bold">
                    {urenTotals.totaalUren.toFixed(1)}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    geregistreerde uren
                  </p>
                </>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Medewerkers</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <>
                  <div className="text-2xl font-bold">
                    {Object.keys(urenTotals.perMedewerker).length}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    hebben gewerkt
                  </p>
                </>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Werkdagen</CardTitle>
              <Calendar className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <>
                  <div className="text-2xl font-bold">
                    {Object.keys(urenTotals.perDatum).length}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    geregistreerd
                  </p>
                </>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Machine kosten
              </CardTitle>
              <Wrench className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <>
                  <div className="text-2xl font-bold">
                    {formatCurrency(machineTotals.totaalKosten)}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    totaal
                  </p>
                </>
              )}
            </CardContent>
          </Card>
        </div>

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
            {isLoading ? (
              <Card>
                <CardContent className="flex items-center justify-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </CardContent>
              </Card>
            ) : groupedByDate.length > 0 ? (
              <div className="space-y-4">
                {groupedByDate.map(([date, items]) => (
                  <Card key={date}>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-medium">
                        {formatDate(date)}
                      </CardTitle>
                      <CardDescription>
                        {items.reduce((sum, i) => sum + i.uren, 0).toFixed(1)}{" "}
                        uur door {[...new Set(items.map((i) => i.medewerker))].length}{" "}
                        medewerker(s)
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Medewerker</TableHead>
                            <TableHead className="text-right">Uren</TableHead>
                            <TableHead>Scope</TableHead>
                            <TableHead>Notities</TableHead>
                            <TableHead>Bron</TableHead>
                            <TableHead className="w-[50px]"></TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {items.map((item) => (
                            <TableRow key={item._id}>
                              <TableCell className="font-medium">
                                {item.medewerker}
                              </TableCell>
                              <TableCell className="text-right">
                                {item.uren.toFixed(1)}
                              </TableCell>
                              <TableCell>
                                {item.scope ? (
                                  <Badge variant="outline">
                                    {scopeLabels[item.scope] || item.scope}
                                  </Badge>
                                ) : (
                                  <span className="text-muted-foreground">-</span>
                                )}
                              </TableCell>
                              <TableCell className="max-w-[200px] truncate">
                                {item.notities || (
                                  <span className="text-muted-foreground">-</span>
                                )}
                              </TableCell>
                              <TableCell>
                                <Badge
                                  variant={
                                    item.bron === "import"
                                      ? "secondary"
                                      : "outline"
                                  }
                                >
                                  {item.bron === "import"
                                    ? "Import"
                                    : "Handmatig"}
                                </Badge>
                              </TableCell>
                              <TableCell>
                                <DropdownMenu>
                                  <DropdownMenuTrigger asChild>
                                    <Button variant="ghost" size="icon">
                                      <MoreHorizontal className="h-4 w-4" />
                                    </Button>
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent align="end">
                                    <DropdownMenuItem
                                      onClick={() => {
                                        setItemToDelete({
                                          type: "uren",
                                          id: item._id,
                                        });
                                        setShowDeleteDialog(true);
                                      }}
                                      className="text-destructive"
                                    >
                                      <Trash2 className="mr-2 h-4 w-4" />
                                      Verwijderen
                                    </DropdownMenuItem>
                                  </DropdownMenuContent>
                                </DropdownMenu>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-12">
                  <Clock className="h-12 w-12 text-muted-foreground/50" />
                  <h3 className="mt-4 text-lg font-semibold">
                    Geen uren geregistreerd
                  </h3>
                  <p className="mt-2 text-sm text-muted-foreground text-center max-w-md">
                    Importeer een urenregistratie of voeg handmatig uren toe.
                  </p>
                  <div className="mt-6 flex gap-2">
                    <UrenImport onImport={handleImport} isImporting={isImporting} />
                    <Button onClick={() => setShowUrenForm(true)}>
                      <Plus className="mr-2 h-4 w-4" />
                      Uren registreren
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* Machines Tab */}
          <TabsContent value="machines" className="space-y-4">
            <div className="flex justify-end">
              <Button onClick={() => setShowMachineForm(true)}>
                <Plus className="mr-2 h-4 w-4" />
                Machine gebruik toevoegen
              </Button>
            </div>

            {isLoading ? (
              <Card>
                <CardContent className="flex items-center justify-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </CardContent>
              </Card>
            ) : machineUsage.length > 0 ? (
              <Card>
                <CardHeader>
                  <CardTitle>Machine gebruik</CardTitle>
                  <CardDescription>
                    Overzicht van ingezette machines
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Machine</TableHead>
                        <TableHead>Datum</TableHead>
                        <TableHead className="text-right">Uren</TableHead>
                        <TableHead className="text-right">Kosten</TableHead>
                        <TableHead className="w-[50px]"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {machineUsage.map((item) => (
                        <TableRow key={item._id}>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <Wrench className="h-4 w-4 text-muted-foreground" />
                              <span className="font-medium">
                                {item.machine?.naam || "Onbekende machine"}
                              </span>
                              {item.machine?.type && (
                                <Badge variant="outline" className="text-xs">
                                  {item.machine.type}
                                </Badge>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>{formatDate(item.datum)}</TableCell>
                          <TableCell className="text-right">
                            {item.uren.toFixed(1)}
                          </TableCell>
                          <TableCell className="text-right font-medium">
                            {formatCurrency(item.kosten)}
                          </TableCell>
                          <TableCell>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon">
                                  <MoreHorizontal className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem
                                  onClick={() => {
                                    setItemToDelete({
                                      type: "machine",
                                      id: item._id,
                                    });
                                    setShowDeleteDialog(true);
                                  }}
                                  className="text-destructive"
                                >
                                  <Trash2 className="mr-2 h-4 w-4" />
                                  Verwijderen
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            ) : (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-12">
                  <Wrench className="h-12 w-12 text-muted-foreground/50" />
                  <h3 className="mt-4 text-lg font-semibold">
                    Geen machine gebruik
                  </h3>
                  <p className="mt-2 text-sm text-muted-foreground text-center max-w-md">
                    Registreer het gebruik van machines voor dit project.
                  </p>
                  <Button
                    className="mt-6"
                    onClick={() => setShowMachineForm(true)}
                  >
                    <Plus className="mr-2 h-4 w-4" />
                    Machine gebruik toevoegen
                  </Button>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* Overzicht Tab */}
          <TabsContent value="overzicht" className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              {/* Uren per medewerker */}
              <Card>
                <CardHeader>
                  <CardTitle>Uren per medewerker</CardTitle>
                </CardHeader>
                <CardContent>
                  {Object.entries(urenTotals.perMedewerker).length > 0 ? (
                    <div className="space-y-3">
                      {Object.entries(urenTotals.perMedewerker)
                        .sort(([, a], [, b]) => b - a)
                        .map(([medewerker, uren]) => (
                          <div
                            key={medewerker}
                            className="flex items-center justify-between"
                          >
                            <div className="flex items-center gap-2">
                              <Users className="h-4 w-4 text-muted-foreground" />
                              <span>{medewerker}</span>
                            </div>
                            <span className="font-medium">
                              {uren.toFixed(1)} uur
                            </span>
                          </div>
                        ))}
                    </div>
                  ) : (
                    <p className="text-muted-foreground text-sm">
                      Nog geen registraties
                    </p>
                  )}
                </CardContent>
              </Card>

              {/* Uren per scope */}
              <Card>
                <CardHeader>
                  <CardTitle>Uren per scope</CardTitle>
                </CardHeader>
                <CardContent>
                  {Object.entries(urenTotals.perScope).length > 0 ? (
                    <div className="space-y-3">
                      {Object.entries(urenTotals.perScope)
                        .sort(([, a], [, b]) => b - a)
                        .map(([scope, uren]) => (
                          <div
                            key={scope}
                            className="flex items-center justify-between"
                          >
                            <Badge variant="outline">
                              {scopeLabels[scope] || scope}
                            </Badge>
                            <span className="font-medium">
                              {uren.toFixed(1)} uur
                            </span>
                          </div>
                        ))}
                    </div>
                  ) : (
                    <p className="text-muted-foreground text-sm">
                      Geen scopes geregistreerd
                    </p>
                  )}
                </CardContent>
              </Card>

              {/* Machine kosten overzicht */}
              <Card className="md:col-span-2">
                <CardHeader>
                  <CardTitle>Machine kosten overzicht</CardTitle>
                </CardHeader>
                <CardContent>
                  {Object.entries(machineTotals.perMachine).length > 0 ? (
                    <div className="space-y-3">
                      {Object.entries(machineTotals.perMachine)
                        .sort(([, a], [, b]) => b.kosten - a.kosten)
                        .map(([id, data]) => (
                          <div
                            key={id}
                            className="flex items-center justify-between"
                          >
                            <div className="flex items-center gap-2">
                              <Wrench className="h-4 w-4 text-muted-foreground" />
                              <span>{data.naam}</span>
                              <span className="text-muted-foreground text-sm">
                                ({data.uren.toFixed(1)} uur)
                              </span>
                            </div>
                            <span className="font-medium">
                              {formatCurrency(data.kosten)}
                            </span>
                          </div>
                        ))}
                      <Separator />
                      <div className="flex items-center justify-between font-medium">
                        <span>Totaal machine kosten</span>
                        <span>{formatCurrency(machineTotals.totaalKosten)}</span>
                      </div>
                    </div>
                  ) : (
                    <p className="text-muted-foreground text-sm">
                      Nog geen machine gebruik
                    </p>
                  )}
                </CardContent>
              </Card>
            </div>
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
        <AlertDialog open={showMachineForm} onOpenChange={setShowMachineForm}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Machine gebruik registreren</AlertDialogTitle>
              <AlertDialogDescription>
                Registreer het gebruik van een machine voor dit project
              </AlertDialogDescription>
            </AlertDialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <label className="text-sm font-medium">Machine</label>
                <Select value={selectedMachine} onValueChange={setSelectedMachine}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecteer machine" />
                  </SelectTrigger>
                  <SelectContent>
                    {machines.map((machine) => (
                      <SelectItem key={machine._id} value={machine._id}>
                        {machine.naam} ({formatCurrency(machine.tarief)}/
                        {machine.tariefType})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <label className="text-sm font-medium">Datum</label>
                <input
                  type="date"
                  value={machineDate}
                  onChange={(e) => setMachineDate(e.target.value)}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                />
              </div>
              <div className="grid gap-2">
                <label className="text-sm font-medium">Uren gebruikt</label>
                <input
                  type="number"
                  min="0"
                  step="0.5"
                  value={machineUren}
                  onChange={(e) => setMachineUren(e.target.value)}
                  placeholder="8"
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                />
              </div>
            </div>
            <AlertDialogFooter>
              <AlertDialogCancel>Annuleren</AlertDialogCancel>
              <AlertDialogAction onClick={handleAddMachineUsage} disabled={isSaving}>
                {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Toevoegen
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}

      {/* Delete confirmation */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {itemToDelete?.type === "uren"
                ? "Urenregistratie verwijderen?"
                : "Machine gebruik verwijderen?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              Weet je zeker dat je deze registratie wilt verwijderen? Dit kan
              niet ongedaan worden gemaakt.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setItemToDelete(null)}>
              Annuleren
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Verwijderen
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
