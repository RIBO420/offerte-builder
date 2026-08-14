"use client";

/**
 * Kaart op het meldingen/cases-bord (PRD §2.4).
 * Toont type, klant, eigenaar, deadline en de escalatie-markering voor
 * plantaken (§2.1: zonder actie na X dagen kleurt de taak op — geen mail).
 */

import { useDraggable } from "@dnd-kit/core";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { MELDING_TYPE_CONFIG, statusClasses } from "@/lib/constants/statuses";
import type { Id } from "../../../convex/_generated/dataModel";
import { AlertTriangle, CalendarClock, User } from "lucide-react";

export interface MeldingKaart {
  _id: Id<"servicemeldingen">;
  beschrijving: string;
  status: string;
  type?: "serviceverzoek" | "klacht" | "schade";
  kanaal?: string;
  taaksoort?: "melding" | "plantaak" | "debiteurentaak";
  deadline?: string;
  prioriteit: string;
  klantNaam: string;
  eigenaarNaam: string | null;
  geescaleerd: boolean;
  verzekeringsvlag?: boolean;
  beoordelenVoorPlanning?: boolean;
  werkitemId?: Id<"projecten">;
  updatedAt: number;
}

// Typekleuren uit de centrale bron (WS4): `--melding-*`-tokens. Klacht en
// schade dragen hun urgentie óók op de kaart zelf (gekleurde linkerrand),
// zodat dit bord op afstand niet verwisselbaar is met het leadsbord.
const TYPE_LABELS: Record<string, string> = Object.fromEntries(
  Object.entries(MELDING_TYPE_CONFIG).map(([key, config]) => [key, config.label])
);

const TYPE_KLEUREN: Record<string, string> = Object.fromEntries(
  Object.entries(MELDING_TYPE_CONFIG).map(([key, config]) => [
    key,
    statusClasses(config),
  ])
);

const TYPE_KAART_RAND: Record<string, string> = {
  klacht: "border-l-4 border-l-melding-klacht-dot",
  schade: "border-l-4 border-l-melding-schade-dot",
};

interface MeldingCardProps {
  melding: MeldingKaart;
  onClick: (melding: MeldingKaart) => void;
}

export function MeldingCard({ melding, onClick }: MeldingCardProps) {
  const { attributes, listeners, setNodeRef, transform, isDragging } =
    useDraggable({ id: melding._id });

  const isPlantaak = melding.taaksoort === "plantaak";
  const isDebiteurentaak = melding.taaksoort === "debiteurentaak";

  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      data-testid="melding-card"
      style={
        transform
          ? { transform: `translate(${transform.x}px, ${transform.y}px)` }
          : undefined
      }
      onClick={() => onClick(melding)}
      className={cn(
        "rounded-lg border bg-card p-3 shadow-sm cursor-pointer space-y-2 text-left",
        // WS4: klacht/schade visueel onderscheiden van serviceverzoek
        !isPlantaak &&
          !isDebiteurentaak &&
          melding.type &&
          TYPE_KAART_RAND[melding.type],
        isDragging && "opacity-60 z-50 relative",
        // Escalatie-markering (§2.1/§8.12): visueel, geen mail
        melding.geescaleerd &&
          "border-destructive ring-1 ring-destructive/60 bg-destructive/5"
      )}
    >
      <div className="flex items-center gap-1.5 flex-wrap">
        {isDebiteurentaak ? (
          <Badge className="bg-status-herinnering text-status-herinnering-text border-status-herinnering-border text-[10px]">
            Debiteurentaak
          </Badge>
        ) : isPlantaak ? (
          <Badge className="bg-status-afgerond text-status-afgerond-text border-status-afgerond-border text-[10px]">
            Plantaak
          </Badge>
        ) : (
          melding.type && (
            <Badge className={cn("text-[10px]", TYPE_KLEUREN[melding.type])}>
              {TYPE_LABELS[melding.type]}
            </Badge>
          )
        )}
        {melding.verzekeringsvlag && (
          <Badge variant="outline" className="text-[10px]">
            Verzekering
          </Badge>
        )}
        {melding.beoordelenVoorPlanning && (
          <Badge variant="outline" className="text-[10px]">
            Beoordelen voor planning
          </Badge>
        )}
        {melding.geescaleerd && (
          <AlertTriangle
            className="size-3.5 text-destructive ml-auto shrink-0"
            aria-label="Geëscaleerd"
          />
        )}
      </div>
      <p className="text-sm line-clamp-2">{melding.beschrijving}</p>
      <div className="text-xs text-muted-foreground space-y-0.5">
        <div className="truncate font-medium text-foreground/80">
          {melding.klantNaam}
        </div>
        {melding.eigenaarNaam && (
          <div className="flex items-center gap-1">
            <User className="size-3 shrink-0" />
            <span className="truncate">{melding.eigenaarNaam}</span>
          </div>
        )}
        {melding.deadline && (
          <div className="flex items-center gap-1">
            <CalendarClock className="size-3 shrink-0" />
            <span>{melding.deadline}</span>
          </div>
        )}
      </div>
    </div>
  );
}
