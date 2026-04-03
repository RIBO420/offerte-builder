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

const columns: ColumnDef[] = [
  { id: "nieuw", label: "Nieuw", colorClass: "bg-blue-500" },
  { id: "contact_gehad", label: "Contact gehad", colorClass: "bg-amber-500" },
  { id: "offerte_verstuurd", label: "Offerte verstuurd", colorClass: "bg-violet-500" },
  { id: "gewonnen", label: "Gewonnen", colorClass: "bg-emerald-500" },
  { id: "verloren", label: "Verloren", colorClass: "bg-red-500", isLost: true },
];

// ============================================
// KanbanBoard component
// ============================================

interface KanbanBoardProps {
  leads: Record<string, Lead[]>;
  onLeadClick?: (lead: Lead) => void;
}

export function KanbanBoard({ leads, onLeadClick }: KanbanBoardProps) {
  const [verliesDialogOpen, setVerliesDialogOpen] = useState(false);
  const [pendingVerliesLeadId, setPendingVerliesLeadId] =
    useState<Id<"configuratorAanvragen"> | null>(null);

  const updatePipelineStatus = useMutation(
    api.configuratorAanvragen.updatePipelineStatus
  );
  const markGewonnen = useMutation(api.configuratorAanvragen.markGewonnen);

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
    // No-op: we don't use DragOverlay, the card moves itself via useDraggable transform
  }

  async function handleDragEnd(event: DragEndEvent) {

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

  return (
    <>
      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <div className="flex gap-4 overflow-x-auto pb-4">
          {columns.map((col) => (
            <KanbanColumn
              key={col.id}
              id={col.id}
              label={col.label}
              colorClass={col.colorClass}
              leads={leads[col.id] ?? []}
              onLeadClick={onLeadClick}
              isLost={col.isLost}
            />
          ))}
        </div>

      </DndContext>

      <VerliesRedenDialog
        open={verliesDialogOpen}
        onClose={handleVerliesClose}
        onBevestig={handleVerliesBevestig}
      />
    </>
  );
}
