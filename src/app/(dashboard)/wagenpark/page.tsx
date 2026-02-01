"use client";

import { useState, useCallback } from "react";
import Link from "next/link";
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
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Plus,
  MoreHorizontal,
  Edit,
  Trash2,
  Loader2,
  Wrench,
  Truck,
  Home,
  Sparkles,
  Clock,
  Euro,
  FolderKanban,
  ExternalLink,
} from "lucide-react";
import { toast } from "sonner";
import { useMachines, useMachinesWithUsage } from "@/hooks/use-machines";
import { useCurrentUser } from "@/hooks/use-current-user";
import { MachineForm, MachineFormData } from "@/components/machines/machine-form";

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

interface Machine {
  _id: string;
  naam: string;
  type: "intern" | "extern";
  tarief: number;
  tariefType: "uur" | "dag";
  gekoppeldeScopes: string[];
  isActief: boolean;
}

interface MachineWithUsage extends Machine {
  usage: {
    totaalUren: number;
    totaalKosten: number;
    aantalDagen: number;
    aantalProjecten: number;
    projecten: Array<{
      _id: string;
      naam: string;
      status: string;
      klantNaam: string;
    } | null>;
  };
}

export default function WagenparkPage() {
  const { isLoading: isUserLoading } = useCurrentUser();
  const {
    create,
    update,
    delete: deleteMachine,
    initializeDefaults,
  } = useMachines();
  const { machines: machinesWithUsage, isLoading: isMachinesLoading } = useMachinesWithUsage();

  const [showForm, setShowForm] = useState(false);
  const [selectedMachine, setSelectedMachine] = useState<Machine | null>(null);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [machineToDelete, setMachineToDelete] = useState<Machine | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isInitializing, setIsInitializing] = useState(false);
  const [showProjectsDialog, setShowProjectsDialog] = useState(false);
  const [selectedMachineProjects, setSelectedMachineProjects] = useState<MachineWithUsage | null>(null);

  const isLoading = isUserLoading || isMachinesLoading;

  const handleOpenForm = useCallback((machine?: Machine) => {
    if (machine) {
      setSelectedMachine(machine);
    } else {
      setSelectedMachine(null);
    }
    setShowForm(true);
  }, []);

  const handleCloseForm = useCallback(() => {
    setShowForm(false);
    setSelectedMachine(null);
  }, []);

  const handleSubmit = useCallback(
    async (data: MachineFormData) => {
      setIsSaving(true);
      try {
        if (selectedMachine) {
          await update({
            id: selectedMachine._id as any,
            ...data,
          });
          toast.success("Machine bijgewerkt");
        } else {
          await create(data);
          toast.success("Machine toegevoegd");
        }
        handleCloseForm();
      } catch (error) {
        toast.error("Fout bij opslaan machine");
        console.error(error);
      } finally {
        setIsSaving(false);
      }
    },
    [selectedMachine, create, update, handleCloseForm]
  );

  const handleDelete = useCallback(async () => {
    if (!machineToDelete) return;

    try {
      await deleteMachine({ id: machineToDelete._id as any });
      toast.success("Machine verwijderd");
      setShowDeleteDialog(false);
      setMachineToDelete(null);
    } catch (error) {
      toast.error("Fout bij verwijderen machine");
      console.error(error);
    }
  }, [machineToDelete, deleteMachine]);

  const handleInitializeDefaults = useCallback(async () => {
    setIsInitializing(true);
    try {
      const result = await initializeDefaults();
      if (result.count > 0) {
        toast.success(`${result.count} standaard machines toegevoegd`);
      } else {
        toast.info("Je hebt al machines in je wagenpark");
      }
    } catch (error) {
      toast.error("Fout bij toevoegen standaard machines");
      console.error(error);
    } finally {
      setIsInitializing(false);
    }
  }, [initializeDefaults]);

  const handleShowProjects = useCallback((machine: MachineWithUsage) => {
    setSelectedMachineProjects(machine);
    setShowProjectsDialog(true);
  }, []);

  // Stats
  const machines = machinesWithUsage as MachineWithUsage[];
  const interneMachines = machines.filter((m) => m.type === "intern");
  const externeMachines = machines.filter((m) => m.type === "extern");
  const totaalUren = machines.reduce((sum, m) => sum + m.usage.totaalUren, 0);
  const totaalKosten = machines.reduce((sum, m) => sum + m.usage.totaalKosten, 0);

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
              <BreadcrumbPage>Wagenpark</BreadcrumbPage>
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
              Wagenpark
            </h1>
            <p className="text-muted-foreground">
              Beheer je machines en bekijk hun inzet bij projecten
            </p>
          </div>
          <div className="flex gap-2">
            {machines.length === 0 && (
              <Button
                variant="outline"
                onClick={handleInitializeDefaults}
                disabled={isInitializing}
              >
                {isInitializing ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Sparkles className="mr-2 h-4 w-4" />
                )}
                Standaard machines
              </Button>
            )}
            <Button onClick={() => handleOpenForm()}>
              <Plus className="mr-2 h-4 w-4" />
              Machine toevoegen
            </Button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Totaal machines
              </CardTitle>
              <Wrench className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <>
                  <div className="text-2xl font-bold">{machines.length}</div>
                  <p className="text-xs text-muted-foreground">
                    in je wagenpark
                  </p>
                </>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Intern / Extern
              </CardTitle>
              <div className="flex gap-1">
                <Home className="h-4 w-4 text-muted-foreground" />
                <Truck className="h-4 w-4 text-muted-foreground" />
              </div>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <>
                  <div className="text-2xl font-bold">
                    {interneMachines.length} / {externeMachines.length}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    eigen / huur machines
                  </p>
                </>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Totaal ingezet
              </CardTitle>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <>
                  <div className="text-2xl font-bold">{totaalUren.toFixed(1)} uur</div>
                  <p className="text-xs text-muted-foreground">
                    over alle projecten
                  </p>
                </>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Totaal kosten
              </CardTitle>
              <Euro className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <>
                  <div className="text-2xl font-bold">{formatCurrency(totaalKosten)}</div>
                  <p className="text-xs text-muted-foreground">
                    machine kosten
                  </p>
                </>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Machines Table */}
        {isLoading ? (
          <Card>
            <CardContent className="flex items-center justify-center py-12">
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className="flex flex-col items-center gap-4"
              >
                <div className="relative">
                  <div className="absolute inset-0 bg-emerald-500/20 blur-xl rounded-full" />
                  <div className="relative flex h-16 w-16 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500 to-green-600">
                    <Loader2 className="h-8 w-8 animate-spin text-white" />
                  </div>
                </div>
                <p className="text-muted-foreground animate-pulse">Laden...</p>
              </motion.div>
            </CardContent>
          </Card>
        ) : machines.length > 0 ? (
          <Card>
            <CardHeader>
              <CardTitle>Je machines</CardTitle>
              <CardDescription>
                Overzicht van alle machines en hun inzet bij projecten
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Machine</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead className="text-right">Tarief</TableHead>
                    <TableHead className="text-right">Ingezet</TableHead>
                    <TableHead className="text-right">Kosten</TableHead>
                    <TableHead className="text-center">Projecten</TableHead>
                    <TableHead className="w-[50px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {machines.map((machine, index) => (
                    <motion.tr
                      key={machine._id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.05 }}
                      className="border-b transition-colors hover:bg-muted/50 data-[state=selected]:bg-muted"
                    >
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Wrench className="h-4 w-4 text-muted-foreground" />
                          <div>
                            <span className="font-medium">{machine.naam}</span>
                            {machine.gekoppeldeScopes.length > 0 && (
                              <div className="flex flex-wrap gap-1 mt-1">
                                {machine.gekoppeldeScopes.slice(0, 2).map((scope) => (
                                  <Badge
                                    key={scope}
                                    variant="outline"
                                    className="text-xs"
                                  >
                                    {scopeLabels[scope] || scope}
                                  </Badge>
                                ))}
                                {machine.gekoppeldeScopes.length > 2 && (
                                  <Badge variant="outline" className="text-xs">
                                    +{machine.gekoppeldeScopes.length - 2}
                                  </Badge>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            machine.type === "intern" ? "secondary" : "outline"
                          }
                        >
                          {machine.type === "intern" ? "Intern" : "Extern"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div>
                          <span className="font-medium">
                            {formatCurrency(machine.tarief)}
                          </span>
                          <span className="text-muted-foreground ml-1 text-sm">
                            /{machine.tariefType}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        {machine.usage.totaalUren > 0 ? (
                          <span className="font-medium">
                            {machine.usage.totaalUren.toFixed(1)} uur
                          </span>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        {machine.usage.totaalKosten > 0 ? (
                          <span className="font-medium">
                            {formatCurrency(machine.usage.totaalKosten)}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell className="text-center">
                        {machine.usage.aantalProjecten > 0 ? (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="gap-1"
                            onClick={() => handleShowProjects(machine)}
                          >
                            <FolderKanban className="h-3 w-3" />
                            {machine.usage.aantalProjecten}
                          </Button>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
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
                              onClick={() => handleOpenForm(machine)}
                            >
                              <Edit className="mr-2 h-4 w-4" />
                              Bewerken
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              onClick={() => {
                                setMachineToDelete(machine);
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
                    </motion.tr>
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
                Geen machines
              </h3>
              <p className="mt-2 text-sm text-muted-foreground text-center max-w-md">
                Voeg machines toe aan je wagenpark om ze in projecten te
                kunnen gebruiken voor kostenbepaling.
              </p>
              <div className="mt-6 flex gap-2">
                <Button
                  variant="outline"
                  onClick={handleInitializeDefaults}
                  disabled={isInitializing}
                >
                  {isInitializing ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Sparkles className="mr-2 h-4 w-4" />
                  )}
                  Standaard machines
                </Button>
                <Button onClick={() => handleOpenForm()}>
                  <Plus className="mr-2 h-4 w-4" />
                  Machine toevoegen
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </motion.div>

      {/* Machine Form Dialog */}
      <MachineForm
        open={showForm}
        onOpenChange={handleCloseForm}
        machine={selectedMachine}
        onSubmit={handleSubmit}
        isLoading={isSaving}
      />

      {/* Projects Dialog */}
      <Dialog open={showProjectsDialog} onOpenChange={setShowProjectsDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Wrench className="h-5 w-5" />
              {selectedMachineProjects?.naam}
            </DialogTitle>
            <DialogDescription>
              Projecten waarbij deze machine is ingezet
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {selectedMachineProjects?.usage.projecten
              .filter(Boolean)
              .map((project) => (
                <div
                  key={project!._id}
                  className="flex items-center justify-between rounded-lg border p-3"
                >
                  <div>
                    <p className="font-medium">{project!.naam}</p>
                    <p className="text-sm text-muted-foreground">
                      {project!.klantNaam}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge
                      variant={
                        project!.status === "afgerond"
                          ? "default"
                          : project!.status === "in_uitvoering"
                          ? "secondary"
                          : "outline"
                      }
                    >
                      {project!.status.replace("_", " ")}
                    </Badge>
                    <Button variant="ghost" size="icon" asChild>
                      <Link href={`/projecten/${project!._id}`}>
                        <ExternalLink className="h-4 w-4" />
                      </Link>
                    </Button>
                  </div>
                </div>
              ))}
            {(!selectedMachineProjects?.usage.projecten ||
              selectedMachineProjects.usage.projecten.filter(Boolean).length === 0) && (
              <p className="text-center text-muted-foreground py-4">
                Geen projecten gevonden
              </p>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Machine verwijderen?</AlertDialogTitle>
            <AlertDialogDescription>
              Weet je zeker dat je &quot;{machineToDelete?.naam}&quot; wilt
              verwijderen? Dit kan niet ongedaan worden gemaakt.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setMachineToDelete(null)}>
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
