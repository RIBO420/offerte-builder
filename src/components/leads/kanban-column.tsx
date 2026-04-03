"use client";

import { useDroppable } from "@dnd-kit/core";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { LeadCard } from "./lead-card";
import type { Lead } from "./lead-card";

// ============================================
// KanbanColumn component
// ============================================

interface KanbanColumnProps {
  id: string;
  label: string;
  colorClass: string;
  leads: Lead[];
  onLeadClick?: (lead: Lead) => void;
  isLost?: boolean;
  isDragging?: boolean;
}

export function KanbanColumn({
  id,
  label,
  colorClass,
  leads,
  onLeadClick,
  isLost = false,
  isDragging = false,
}: KanbanColumnProps) {
  const { isOver, setNodeRef } = useDroppable({ id });

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "flex flex-col rounded-xl border bg-muted/30 p-3 min-w-[280px] w-[280px] transition-colors",
        isOver && "bg-accent/50 border-primary",
        isLost && "opacity-60"
      )}
    >
      {/* Column header */}
      <div className="flex items-center gap-2 mb-3 px-1">
        <span
          className={cn("size-2.5 rounded-full shrink-0", colorClass)}
        />
        <span className="text-sm font-medium truncate">{label}</span>
        <Badge variant="secondary" className="ml-auto text-[10px] tabular-nums">
          {leads.length}
        </Badge>
      </div>

      {/* Lead cards */}
      <div className={cn("flex flex-col gap-2 flex-1 min-h-[120px]", isDragging ? "overflow-visible" : "overflow-y-auto")}>
        {leads.map((lead) => (
          <LeadCard key={lead._id} lead={lead} onClick={onLeadClick} />
        ))}
        {leads.length === 0 && (
          <div className="flex items-center justify-center h-24 text-xs text-muted-foreground rounded-lg border border-dashed">
            Geen leads
          </div>
        )}
      </div>
    </div>
  );
}
