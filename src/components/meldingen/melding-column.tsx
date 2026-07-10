"use client";

/**
 * Statuskolom van het meldingen/cases-bord (PRD §2.4) — kanban-patroon
 * hergebruikt van het leads-bord (kanban-column.tsx).
 */

import { useDroppable } from "@dnd-kit/core";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { MeldingCard, type MeldingKaart } from "./melding-card";

interface MeldingColumnProps {
  id: string;
  label: string;
  colorClass: string;
  meldingen: MeldingKaart[];
  onMeldingClick: (melding: MeldingKaart) => void;
}

export function MeldingColumn({
  id,
  label,
  colorClass,
  meldingen,
  onMeldingClick,
}: MeldingColumnProps) {
  const { isOver, setNodeRef } = useDroppable({ id });

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "flex flex-col rounded-xl border bg-muted/30 p-3 min-w-[280px] w-[280px] transition-colors",
        isOver && "bg-accent/50 border-primary"
      )}
    >
      <div className="flex items-center gap-2 mb-3 px-1">
        <span className={cn("size-2.5 rounded-full shrink-0", colorClass)} />
        <span className="text-sm font-medium truncate">{label}</span>
        <Badge variant="secondary" className="ml-auto text-[10px] tabular-nums">
          {meldingen.length}
        </Badge>
      </div>
      <div className="flex flex-col gap-2 flex-1 min-h-[120px] overflow-y-auto">
        {meldingen.map((melding) => (
          <MeldingCard
            key={melding._id}
            melding={melding}
            onClick={onMeldingClick}
          />
        ))}
        {meldingen.length === 0 && (
          <div className="flex items-center justify-center h-24 text-xs text-muted-foreground rounded-lg border border-dashed">
            Geen meldingen
          </div>
        )}
      </div>
    </div>
  );
}
