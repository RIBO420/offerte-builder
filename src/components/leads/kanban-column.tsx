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
  onLeadDelete?: (lead: Lead) => void;
  isLost?: boolean;
  isDragging?: boolean;
}

export function KanbanColumn({
  id,
  label,
  colorClass,
  leads,
  onLeadClick,
  onLeadDelete,
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

      {/*
        Lead cards. De `overflow-y-auto` stond hier al, maar zonder plafond
        scrolt er niets: de kolom groeit gewoon mee en dan groeit de pagina
        mee. Met 87 leads in "Nieuw" werd dat een pagina van meters lang.

        Vandaar de max-hoogte in viewport-eenheden: de kolom houdt op bij wat
        er op het scherm past en scrolt binnenin. Bewust vh en geen vaste px —
        op een laptop hoort de kolom korter te zijn dan op een groot scherm.

        Tijdens slepen gaat het plafond eraf: dnd-kit tilt de kaart uit de
        stapel, en binnen een scrollende container zou die worden afgekapt.
      */}
      <div
        className={cn(
          "flex min-h-[120px] flex-1 flex-col gap-2",
          isDragging
            ? "overflow-visible"
            : "max-h-[calc(100vh-26rem)] overflow-y-auto"
        )}
      >
        {leads.map((lead) => (
          <LeadCard
            key={lead._id}
            lead={lead}
            onClick={onLeadClick}
            onDelete={onLeadDelete}
          />
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
