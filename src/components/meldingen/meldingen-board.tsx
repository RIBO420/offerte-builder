"use client";

/**
 * Meldingen/cases-bord (PRD §2.4): vier statuskolommen met drag & drop —
 * kanban-patroon hergebruikt van het leads-bord. Statuswissels zijn
 * kantoor-only (server afgedwongen); elke wissel logt automatisch op de
 * klanttijdlijn en in de interne case-thread.
 */

import { useState } from "react";
import {
  DndContext,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  closestCorners,
  type DragEndEvent,
} from "@dnd-kit/core";
import { useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { showErrorToast, showSuccessToast } from "@/lib/toast-utils";
import { MeldingColumn } from "./melding-column";
import type { MeldingKaart } from "./melding-card";

type BordKolom = "nieuw" | "in_behandeling" | "wacht_op_derden" | "opgelost";

const columns: { id: BordKolom; label: string; colorClass: string }[] = [
  { id: "nieuw", label: "Nieuw", colorClass: "bg-blue-500" },
  { id: "in_behandeling", label: "In behandeling", colorClass: "bg-amber-500" },
  { id: "wacht_op_derden", label: "Wacht op derden", colorClass: "bg-violet-500" },
  { id: "opgelost", label: "Opgelost", colorClass: "bg-green-500" },
];

interface MeldingenBoardProps {
  bord: Record<BordKolom, MeldingKaart[]>;
  onMeldingClick: (melding: MeldingKaart) => void;
  kanMuteren: boolean;
}

export function MeldingenBoard({
  bord,
  onMeldingClick,
  kanMuteren,
}: MeldingenBoardProps) {
  const updateStatus = useMutation(api.servicemeldingen.updateStatus);
  const [, setIsDragging] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor)
  );

  function findKolom(meldingId: string): BordKolom | null {
    for (const [kolom, lijst] of Object.entries(bord)) {
      if (lijst.some((m) => m._id === meldingId)) return kolom as BordKolom;
    }
    return null;
  }

  async function handleDragEnd(event: DragEndEvent) {
    setIsDragging(false);
    const { active, over } = event;
    if (!over) return;

    const meldingId = String(active.id) as Id<"servicemeldingen">;
    const doel = String(over.id) as BordKolom;
    const bron = findKolom(String(active.id));
    if (!bron || bron === doel) return;
    if (!columns.some((c) => c.id === doel)) return;

    if (!kanMuteren) {
      showErrorToast("Alleen kantoor kan de status van een melding wijzigen");
      return;
    }

    try {
      await updateStatus({ id: meldingId, status: doel });
      showSuccessToast("Status bijgewerkt");
    } catch (error) {
      showErrorToast(
        error instanceof Error
          ? error.message
          : "Er ging iets mis bij het verplaatsen"
      );
    }
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={() => setIsDragging(true)}
      onDragEnd={handleDragEnd}
    >
      <div className="flex gap-4 pb-4 overflow-x-auto">
        {columns.map((col) => (
          <MeldingColumn
            key={col.id}
            id={col.id}
            label={col.label}
            colorClass={col.colorClass}
            meldingen={bord[col.id] ?? []}
            onMeldingClick={onMeldingClick}
          />
        ))}
      </div>
    </DndContext>
  );
}
