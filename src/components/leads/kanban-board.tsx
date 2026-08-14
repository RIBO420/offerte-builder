"use client";

import { useState, useCallback } from "react";
import {
  DndContext,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  closestCorners,
  type DragStartEvent,
  type DragEndEvent,
} from "@dnd-kit/core";
import { useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { showSuccessToast, showErrorToast } from "@/lib/toast-utils";
import { KanbanColumn } from "./kanban-column";
import { VerliesRedenDialog } from "./verlies-reden-dialog";
import type { Lead } from "./lead-card";
import { LEAD_STATUS_CONFIG } from "@/lib/constants/statuses";
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

// ============================================
// Column definitions
// ============================================

type PipelineStatus =
  | "nieuw"
  | "contact_gehad"
  | "offerte_verstuurd"
  | "gewonnen"
  | "verloren";

interface ColumnDef {
  id: PipelineStatus;
  label: string;
  colorClass: string;
  isLost?: boolean;
}

// Kolomstippen uit het statussysteem (WS4): `--lead-*`-tokens, geen ad-hoc
// vijfkleurenmapping meer.
const columns: ColumnDef[] = [
  {
    id: "nieuw",
    label: LEAD_STATUS_CONFIG.nieuw.label,
    colorClass: LEAD_STATUS_CONFIG.nieuw.color.dot,
  },
  {
    id: "contact_gehad",
    label: LEAD_STATUS_CONFIG.contact_gehad.label,
    colorClass: LEAD_STATUS_CONFIG.contact_gehad.color.dot,
  },
  {
    id: "offerte_verstuurd",
    label: LEAD_STATUS_CONFIG.offerte_verstuurd.label,
    colorClass: LEAD_STATUS_CONFIG.offerte_verstuurd.color.dot,
  },
  {
    id: "gewonnen",
    label: LEAD_STATUS_CONFIG.gewonnen.label,
    colorClass: LEAD_STATUS_CONFIG.gewonnen.color.dot,
  },
  {
    id: "verloren",
    label: LEAD_STATUS_CONFIG.verloren.label,
    colorClass: LEAD_STATUS_CONFIG.verloren.color.dot,
    isLost: true,
  },
];

// ============================================
// KanbanBoard component
// ============================================

interface KanbanBoardProps {
  leads: Record<string, Lead[]>;
  onLeadClick?: (lead: Lead) => void;
}

export function KanbanBoard({ leads, onLeadClick }: KanbanBoardProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [verliesDialogOpen, setVerliesDialogOpen] = useState(false);
  const [pendingVerliesLeadId, setPendingVerliesLeadId] =
    useState<Id<"configuratorAanvragen"> | null>(null);

  const updatePipelineStatus = useMutation(
    api.configuratorAanvragen.updatePipelineStatus
  );
  const markGewonnen = useMutation(api.configuratorAanvragen.markGewonnen);
  // §5.2: archiveren i.p.v. hard delete; hard delete alleen via de GDPR-flow
  const archiveerLead = useMutation(api.configuratorAanvragen.archiveer);

  const [pendingDeleteLead, setPendingDeleteLead] = useState<Lead | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Sensors
  const pointerSensor = useSensor(PointerSensor, {
    activationConstraint: { distance: 8 },
  });
  const keyboardSensor = useSensor(KeyboardSensor);
  const sensors = useSensors(pointerSensor, keyboardSensor);

  // Find which column a lead currently belongs to
  const findLeadColumn = useCallback(
    (leadId: string): PipelineStatus | null => {
      for (const [status, statusLeads] of Object.entries(leads)) {
        if (statusLeads.some((l) => l._id === leadId)) {
          return status as PipelineStatus;
        }
      }
      return null;
    },
    [leads]
  );

  // Drag handlers
  function handleDragStart(_event: DragStartEvent) {
    setIsDragging(true);
  }

  async function handleDragEnd(event: DragEndEvent) {
    setIsDragging(false);

    const { active, over } = event;
    if (!over) return;

    const leadId = String(active.id) as Id<"configuratorAanvragen">;
    const sourceColumn = findLeadColumn(leadId);
    const targetColumn = String(over.id) as PipelineStatus;

    // No change needed
    if (!sourceColumn || sourceColumn === targetColumn) return;

    // Block dragging FROM gewonnen
    if (sourceColumn === "gewonnen") {
      showErrorToast("Een gewonnen lead kan niet terug naar een eerdere status");
      return;
    }

    // Validate target is a known column
    if (!columns.some((c) => c.id === targetColumn)) return;

    try {
      if (targetColumn === "gewonnen") {
        await markGewonnen({ id: leadId });
        showSuccessToast("Lead gemarkeerd als gewonnen");
      } else if (targetColumn === "verloren") {
        // Open dialog instead of calling mutation directly
        setPendingVerliesLeadId(leadId);
        setVerliesDialogOpen(true);
      } else {
        await updatePipelineStatus({
          id: leadId,
          pipelineStatus: targetColumn,
        });
      }
    } catch (error) {
      showErrorToast(
        error instanceof Error
          ? error.message
          : "Er ging iets mis bij het verplaatsen"
      );
    }
  }

  // VerliesRedenDialog handlers
  async function handleVerliesBevestig(reden: string) {
    if (!pendingVerliesLeadId) return;

    try {
      await updatePipelineStatus({
        id: pendingVerliesLeadId,
        pipelineStatus: "verloren",
        verliesReden: reden,
      });
      showSuccessToast("Lead gemarkeerd als verloren");
    } catch (error) {
      showErrorToast(
        error instanceof Error
          ? error.message
          : "Er ging iets mis bij het markeren als verloren"
      );
    } finally {
      setVerliesDialogOpen(false);
      setPendingVerliesLeadId(null);
    }
  }

  function handleVerliesClose() {
    setVerliesDialogOpen(false);
    setPendingVerliesLeadId(null);
  }

  // Quick-archive a lead (e.g. test leads or mistakes) straight from its card (§5.2).
  const handleDeleteRequest = useCallback((lead: Lead) => {
    setPendingDeleteLead(lead);
  }, []);

  const handleDeleteConfirm = useCallback(async () => {
    if (!pendingDeleteLead) return;
    setIsDeleting(true);
    try {
      await archiveerLead({ id: pendingDeleteLead._id });
      showSuccessToast("Lead gearchiveerd");
      setPendingDeleteLead(null);
    } catch (error) {
      showErrorToast(
        error instanceof Error
          ? error.message
          : "Er ging iets mis bij het archiveren"
      );
    } finally {
      setIsDeleting(false);
    }
  }, [pendingDeleteLead, archiveerLead]);

  return (
    <>
      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        {/* WS1 B7: het bord mag nooit breder zijn dan zijn container (geen
            h-scroll). Kolommen delen de breedte via een grid met minmax(0,1fr);
            onder `lg` stapelen ze. Geen overflow-container meer nodig — de
            geliftte kaart van dnd-kit wordt zo ook nergens afgekapt. */}
        <div className="grid grid-cols-1 gap-4 pb-4 lg:grid-cols-[repeat(5,minmax(0,1fr))]">
          {columns.map((col) => (
            <KanbanColumn
              key={col.id}
              id={col.id}
              label={col.label}
              colorClass={col.colorClass}
              leads={leads[col.id] ?? []}
              onLeadClick={onLeadClick}
              onLeadDelete={handleDeleteRequest}
              isLost={col.isLost}
              isDragging={isDragging}
            />
          ))}
        </div>

      </DndContext>

      <VerliesRedenDialog
        open={verliesDialogOpen}
        onClose={handleVerliesClose}
        onBevestig={handleVerliesBevestig}
      />

      <AlertDialog
        open={pendingDeleteLead !== null}
        onOpenChange={(open) => {
          if (!open) setPendingDeleteLead(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Lead archiveren?</AlertDialogTitle>
            <AlertDialogDescription>
              Weet je zeker dat je de lead van{" "}
              <span className="font-medium">{pendingDeleteLead?.klantNaam}</span>{" "}
              wilt archiveren? De lead verdwijnt van het bord; activiteiten en
              foto&apos;s blijven bewaard en de lead kan worden hersteld.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Annuleren</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                handleDeleteConfirm();
              }}
              disabled={isDeleting}
            >
              {isDeleting ? "Archiveren..." : "Archiveren"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
