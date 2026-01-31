"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
  ChevronUp,
  ChevronDown,
  MoreHorizontal,
  Trash2,
  Edit,
  CheckCircle2,
  PlayCircle,
  Circle,
  Clock,
  Calendar,
} from "lucide-react";
import {
  getScopeDisplayName,
  getScopeColor,
  statusConfig,
  type TaakStatus,
} from "@/lib/planning-templates";
import type { PlanningTaak } from "@/hooks/use-planning";
import { Id } from "../../../convex/_generated/dataModel";
import { cn } from "@/lib/utils";

interface TakenLijstProps {
  taken: PlanningTaak[];
  takenPerScope: Record<string, PlanningTaak[]>;
  onUpdateStatus: (taskId: Id<"planningTaken">, status: TaakStatus) => Promise<void>;
  onMoveUp: (taskId: Id<"planningTaken">) => Promise<void>;
  onMoveDown: (taskId: Id<"planningTaken">) => Promise<void>;
  onDelete: (taskId: Id<"planningTaken">) => Promise<void>;
  onEdit?: (task: PlanningTaak) => void;
  isLoading?: boolean;
}

function StatusIcon({ status }: { status: TaakStatus }) {
  switch (status) {
    case "afgerond":
      return <CheckCircle2 className="h-4 w-4 text-green-500" />;
    case "gestart":
      return <PlayCircle className="h-4 w-4 text-blue-500" />;
    default:
      return <Circle className="h-4 w-4 text-gray-400" />;
  }
}

function formatHours(hours: number): string {
  if (hours < 1) {
    return `${Math.round(hours * 60)} min`;
  }
  return `${hours.toFixed(1)} uur`;
}

function formatDays(days: number): string {
  if (days < 0.5) {
    return `${Math.round(days * 8)} uur`;
  }
  if (days === 1) {
    return "1 dag";
  }
  return `${days.toFixed(1)} dagen`;
}

export function TakenLijst({
  taken,
  takenPerScope,
  onUpdateStatus,
  onMoveUp,
  onMoveDown,
  onDelete,
  onEdit,
  isLoading,
}: TakenLijstProps) {
  const [deleteTaskId, setDeleteTaskId] = useState<Id<"planningTaken"> | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleDelete = async () => {
    if (!deleteTaskId) return;
    setIsDeleting(true);
    try {
      await onDelete(deleteTaskId);
    } finally {
      setIsDeleting(false);
      setDeleteTaskId(null);
    }
  };

  const handleStatusCycle = async (task: PlanningTaak) => {
    const nextStatus: Record<TaakStatus, TaakStatus> = {
      gepland: "gestart",
      gestart: "afgerond",
      afgerond: "gepland",
    };
    await onUpdateStatus(task._id, nextStatus[task.status]);
  };

  if (taken.length === 0) {
    return (
      <Card>
        <CardContent className="py-12">
          <div className="flex flex-col items-center justify-center text-center">
            <Calendar className="h-12 w-12 text-muted-foreground/50 mb-4" />
            <h3 className="text-lg font-medium">Geen taken gevonden</h3>
            <p className="text-sm text-muted-foreground mt-1">
              Genereer taken vanuit de voorcalculatie om te beginnen.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const scopes = Object.keys(takenPerScope);

  return (
    <div className="space-y-6">
      {scopes.map((scope) => {
        const scopeTaken = takenPerScope[scope];
        const totaalUren = scopeTaken.reduce((sum, t) => sum + t.normUren, 0);
        const totaalDagen = scopeTaken.reduce((sum, t) => sum + t.geschatteDagen, 0);
        const afgerond = scopeTaken.filter((t) => t.status === "afgerond").length;

        return (
          <Card key={scope}>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div
                    className={cn(
                      "w-3 h-3 rounded-full",
                      getScopeColor(scope)
                    )}
                  />
                  <CardTitle className="text-lg">
                    {getScopeDisplayName(scope)}
                  </CardTitle>
                  <Badge variant="outline" className="font-normal">
                    {afgerond}/{scopeTaken.length} taken
                  </Badge>
                </div>
                <div className="flex items-center gap-4 text-sm text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <Clock className="h-4 w-4" />
                    {formatHours(totaalUren)}
                  </span>
                  <span className="flex items-center gap-1">
                    <Calendar className="h-4 w-4" />
                    {formatDays(totaalDagen)}
                  </span>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10"></TableHead>
                    <TableHead>Taak</TableHead>
                    <TableHead className="w-24 text-right">Uren</TableHead>
                    <TableHead className="w-24 text-right">Dagen</TableHead>
                    <TableHead className="w-28">Status</TableHead>
                    <TableHead className="w-24 text-right">Acties</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {scopeTaken.map((taak, index) => (
                    <TableRow key={taak._id}>
                      <TableCell className="text-muted-foreground font-mono text-xs">
                        {index + 1}
                      </TableCell>
                      <TableCell className="font-medium">
                        {taak.taakNaam}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatHours(taak.normUren)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatDays(taak.geschatteDagen)}
                      </TableCell>
                      <TableCell>
                        <button
                          onClick={() => handleStatusCycle(taak)}
                          className="focus:outline-none"
                        >
                          <Badge
                            className={cn(
                              statusConfig[taak.status].bgColor,
                              statusConfig[taak.status].color,
                              "cursor-pointer transition-colors hover:opacity-80"
                            )}
                          >
                            <StatusIcon status={taak.status} />
                            <span className="ml-1">
                              {statusConfig[taak.status].label}
                            </span>
                          </Badge>
                        </button>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon-xs"
                            onClick={() => onMoveUp(taak._id)}
                            disabled={index === 0 || isLoading}
                            title="Omhoog"
                          >
                            <ChevronUp className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon-xs"
                            onClick={() => onMoveDown(taak._id)}
                            disabled={
                              index === scopeTaken.length - 1 || isLoading
                            }
                            title="Omlaag"
                          >
                            <ChevronDown className="h-4 w-4" />
                          </Button>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon-xs"
                                disabled={isLoading}
                              >
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              {onEdit && (
                                <DropdownMenuItem onClick={() => onEdit(taak)}>
                                  <Edit className="mr-2 h-4 w-4" />
                                  Bewerken
                                </DropdownMenuItem>
                              )}
                              <DropdownMenuItem
                                onClick={() => setDeleteTaskId(taak._id)}
                                className="text-destructive"
                              >
                                <Trash2 className="mr-2 h-4 w-4" />
                                Verwijderen
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        );
      })}

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deleteTaskId} onOpenChange={() => setDeleteTaskId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Taak verwijderen</AlertDialogTitle>
            <AlertDialogDescription>
              Weet je zeker dat je deze taak wilt verwijderen? Dit kan niet
              ongedaan worden gemaakt.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Annuleren</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting ? "Verwijderen..." : "Verwijderen"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
