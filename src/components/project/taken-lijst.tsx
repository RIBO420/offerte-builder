"use client";

/**
 * Takenlijst van de projectplanning (redesign okt 2026): per scope één
 * sectie met een kop die de stand al vertelt ("2 van 4 taken · 35 uur ·
 * 4 dagen" + balkje), een takentabel en onderaan een knop om een taak aan
 * die scope toe te voegen. De vroegere blokken "Planning overzicht" en
 * "Details per scope" vervallen: hun cijfers staan hier in de koppen.
 *
 * Geen <table>: de rijen zijn een grid dat op containerbreedte kolommen
 * laat vallen (# en dagen eerst), zodat er nooit zijwaarts gescrold wordt.
 */

import { useState, useCallback } from "react";
import { MoreHorizontal, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
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
import { SectiePaneel } from "@/components/ui/sectie-paneel";
import { StatusBadge } from "@/components/ui/status-badge";
import { SortableList, type SortableItemProps } from "@/components/ui/sortable-list";
import { DragHandle } from "@/components/ui/drag-handle";
import { getScopeDisplayName } from "@/lib/planning-templates";
import { TAAK_STATUS_CONFIG } from "@/lib/constants/statuses";
import type { PlanningTaak, TaakStatus } from "@/hooks/use-planning";
import type { Id } from "../../../convex/_generated/dataModel";
import { cn } from "@/lib/utils";
import { getal, procent, scopeStip, VoortgangsBalk } from "./project-cijfers";

interface TakenLijstProps {
  takenPerScope: Record<string, PlanningTaak[]>;
  onUpdateStatus: (taskId: Id<"planningTaken">, status: TaakStatus) => Promise<void>;
  onReorder: (
    taskOrders: Array<{ taskId: Id<"planningTaken">; volgorde: number }>
  ) => Promise<void>;
  onDelete: (taskId: Id<"planningTaken">) => Promise<void>;
  /** Opent het toevoegdialoog met deze scope al gekozen. */
  onTaakToevoegen: (scope: string) => void;
  isLoading?: boolean;
}

const VOLGENDE_STATUS: Record<TaakStatus, TaakStatus> = {
  gepland: "gestart",
  gestart: "afgerond",
  afgerond: "gepland",
};

const STATUSSEN: TaakStatus[] = ["gepland", "gestart", "afgerond"];

/**
 * Kolommen: greep · # · taak · uren · dagen · status · acties. In een smalle
 * sectie vallen # en dagen weg; de taaknaam krimpt (truncate), nooit de pagina.
 */
const RIJ_GRID =
  "grid items-center gap-x-3 grid-cols-[2.25rem_minmax(0,1fr)_3.5rem_6.75rem_2.25rem] @lg/sectie:grid-cols-[2.25rem_1.5rem_minmax(0,1fr)_4rem_3.5rem_6.75rem_2.25rem]";

function TaakRij({
  taak,
  index,
  sortableProps,
  onUpdateStatus,
  onVerwijder,
  isLoading,
}: {
  taak: PlanningTaak;
  index: number;
  sortableProps: SortableItemProps;
  onUpdateStatus: TakenLijstProps["onUpdateStatus"];
  onVerwijder: (taskId: Id<"planningTaken">) => void;
  isLoading?: boolean;
}) {
  const klaar = taak.status === "afgerond";
  const volgende = VOLGENDE_STATUS[taak.status];

  return (
    <div
      ref={sortableProps.setNodeRef}
      style={sortableProps.style}
      className={cn(
        RIJ_GRID,
        "rounded-md px-2 py-1 transition-colors hover:bg-muted/50",
        sortableProps.isDragging && "bg-accent/60",
        sortableProps.isOver && "bg-accent/30"
      )}
    >
      <DragHandle
        listeners={sortableProps.listeners}
        attributes={sortableProps.attributes}
        isDragging={sortableProps.isDragging}
        aria-label={`Versleep ${taak.taakNaam} om te herschikken`}
      />
      <span className="hidden text-[13px] tabular-nums text-muted-foreground @lg/sectie:block">
        {index + 1}
      </span>
      <span
        title={taak.taakNaam}
        className={cn(
          "min-w-0 truncate text-sm",
          klaar && "text-muted-foreground line-through decoration-muted-foreground/50"
        )}
      >
        {taak.taakNaam}
        {klaar && <span className="sr-only"> (afgerond)</span>}
      </span>
      <span
        className={cn(
          "text-right text-sm tabular-nums",
          klaar && "text-muted-foreground"
        )}
      >
        {getal(taak.normUren)} u
      </span>
      <span
        className={cn(
          "hidden text-right text-sm tabular-nums @lg/sectie:block",
          klaar ? "text-muted-foreground" : "text-foreground"
        )}
      >
        {getal(taak.geschatteDagen)}
      </span>
      <button
        type="button"
        onClick={() => onUpdateStatus(taak._id, volgende)}
        disabled={isLoading}
        aria-label={`Status van ${taak.taakNaam}: ${TAAK_STATUS_CONFIG[taak.status].label}. Wijzig naar ${TAAK_STATUS_CONFIG[volgende].label.toLowerCase()}`}
        className="justify-self-start rounded-full transition-opacity hover:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
      >
        <StatusBadge status={taak.status} domain="taak" size="sm" showTooltip={false} />
      </button>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="size-9 text-muted-foreground sm:size-8"
            disabled={isLoading}
            aria-label={`Acties voor ${taak.taakNaam}`}
          >
            <MoreHorizontal className="size-4" aria-hidden="true" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {STATUSSEN.filter((s) => s !== taak.status).map((s) => (
            <DropdownMenuItem key={s} onClick={() => onUpdateStatus(taak._id, s)}>
              Markeer als {TAAK_STATUS_CONFIG[s].label.toLowerCase()}
            </DropdownMenuItem>
          ))}
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onClick={() => onVerwijder(taak._id)}
            className="text-destructive focus:text-destructive"
          >
            <Trash2 className="mr-2 size-4" aria-hidden="true" />
            Verwijderen
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

export function TakenLijst({
  takenPerScope,
  onUpdateStatus,
  onReorder,
  onDelete,
  onTaakToevoegen,
  isLoading,
}: TakenLijstProps) {
  const [verwijderId, setVerwijderId] = useState<Id<"planningTaken"> | null>(null);
  const [isVerwijderen, setIsVerwijderen] = useState(false);

  const handleVerwijder = async () => {
    if (!verwijderId) return;
    setIsVerwijderen(true);
    try {
      await onDelete(verwijderId);
    } finally {
      setIsVerwijderen(false);
      setVerwijderId(null);
    }
  };

  const handleReorder = useCallback(
    async (nieuweVolgorde: Array<{ id: string | number }>) => {
      await onReorder(
        nieuweVolgorde.map((item, index) => ({
          taskId: item.id as Id<"planningTaken">,
          volgorde: index,
        }))
      );
    },
    [onReorder]
  );

  return (
    <div className="flex flex-col gap-4">
      {Object.entries(takenPerScope).map(([scope, scopeTaken]) => {
        const naam = getScopeDisplayName(scope);
        const uren = scopeTaken.reduce((som, t) => som + t.normUren, 0);
        const dagen = scopeTaken.reduce((som, t) => som + t.geschatteDagen, 0);
        const afgerond = scopeTaken.filter((t) => t.status === "afgerond").length;
        const pct = procent(afgerond, scopeTaken.length);
        const meta = `${afgerond} van ${scopeTaken.length} taken · ${getal(uren)} uur · ${getal(dagen)} ${dagen === 1 ? "dag" : "dagen"}`;

        return (
          <SectiePaneel
            key={scope}
            titel={naam}
            kopbalk
            icoon={
              <span
                aria-hidden="true"
                className={cn("block size-2 rounded-full", scopeStip(scope))}
              />
            }
            acties={
              <div className="flex min-w-0 items-center gap-3">
                <span
                  title={meta}
                  className="min-w-0 truncate text-[13px] tabular-nums text-muted-foreground"
                >
                  {meta}
                </span>
                <VoortgangsBalk
                  waarde={pct}
                  className="hidden w-24 shrink-0 @md/sectie:block"
                />
                <span className="shrink-0 text-[13px] font-semibold tabular-nums">
                  {pct}%
                </span>
              </div>
            }
          >
            <div className="flex flex-col p-1">
              <div
                aria-hidden="true"
                className={cn(RIJ_GRID, "px-2 pt-1.5 pb-1 text-xs text-muted-foreground")}
              >
                <span />
                <span className="hidden @lg/sectie:block">#</span>
                <span>Taak</span>
                <span className="text-right">Uren</span>
                <span className="hidden text-right @lg/sectie:block">Dagen</span>
                <span>Status</span>
                <span />
              </div>
              <SortableList
                items={scopeTaken.map((taak) => ({ ...taak, id: taak._id }))}
                onReorder={handleReorder}
                disabled={isLoading}
                aria-label={`Taken voor ${naam}`}
                itemIdPrefix={`taak-${scope}`}
                renderItem={(item, sortableProps, index) => (
                  <TaakRij
                    taak={item as unknown as PlanningTaak}
                    index={index}
                    sortableProps={sortableProps}
                    onUpdateStatus={onUpdateStatus}
                    onVerwijder={setVerwijderId}
                    isLoading={isLoading}
                  />
                )}
              />
              <button
                type="button"
                onClick={() => onTaakToevoegen(scope)}
                className="mx-1 mt-1 mb-1 flex h-10 items-center justify-center gap-2 rounded-md border border-dashed text-sm text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <Plus className="size-4" aria-hidden="true" />
                <span className="truncate">Taak toevoegen aan {naam}</span>
              </button>
            </div>
          </SectiePaneel>
        );
      })}

      <AlertDialog open={!!verwijderId} onOpenChange={() => setVerwijderId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Taak verwijderen</AlertDialogTitle>
            <AlertDialogDescription>
              Weet je zeker dat je deze taak wilt verwijderen? Dit kan niet ongedaan
              worden gemaakt.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isVerwijderen}>Annuleren</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleVerwijder}
              disabled={isVerwijderen}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isVerwijderen ? "Verwijderen…" : "Verwijderen"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
