"use client";

import { useDraggable } from "@dnd-kit/core";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";
import { nl } from "@/lib/date-locale";
import { MapPin } from "lucide-react";
import type { Doc } from "../../../convex/_generated/dataModel";

// ============================================
// Types
// ============================================

export type Lead = Doc<"configuratorAanvragen">;

type LeadType = Lead["type"];
type LeadBron = NonNullable<Lead["bron"]>;

const handmatigeBronnen: LeadBron[] = [
  "handmatig",
  "telefoon",
  "email",
  "doorverwijzing",
  "website_contact",
];

// ============================================
// Type badge config
// ============================================

const typeBadgeConfig: Record<
  LeadType | "handmatig" | "website",
  { label: string; className: string }
> = {
  gazon: {
    label: "Gazon",
    className: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300",
  },
  boomschors: {
    label: "Boomschors",
    className: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300",
  },
  verticuteren: {
    label: "Verticuteren",
    className: "bg-lime-100 text-lime-800 dark:bg-lime-900/40 dark:text-lime-300",
  },
  contact: {
    label: "Website",
    className: "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300",
  },
  handmatig: {
    label: "Handmatig",
    className: "bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300",
  },
  website: {
    label: "Website",
    className: "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300",
  },
};

// ============================================
// Price formatter
// ============================================

const priceFormatter = new Intl.NumberFormat("nl-NL", {
  style: "currency",
  currency: "EUR",
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

// ============================================
// LeadCard component
// ============================================

interface LeadCardProps {
  lead: Lead;
  onClick?: (lead: Lead) => void;
  isDragOverlay?: boolean;
}

export function LeadCard({ lead, onClick, isDragOverlay = false }: LeadCardProps) {
  const { attributes, listeners, setNodeRef, isDragging } =
    useDraggable({
      id: lead._id,
      data: { lead },
    });

  const isWebsite = lead.bron === "website_contact";
  const isHandmatig =
    !isWebsite && lead.bron != null && handmatigeBronnen.includes(lead.bron);

  const badgeKey: LeadType | "handmatig" | "website" = isWebsite
    ? "website"
    : isHandmatig
      ? "handmatig"
      : lead.type;
  const badgeConfig = typeBadgeConfig[badgeKey];

  const waarde = lead.geschatteWaarde ?? lead.definitievePrijs ?? lead.indicatiePrijs ?? 0;

  const relativeDate = formatDistanceToNow(new Date(lead.createdAt), {
    addSuffix: true,
    locale: nl,
  });

  // Onderwerp label voor contact-leads
  const specs = lead.type === "contact"
    ? (lead.specificaties as { onderwerp?: string } | undefined)
    : undefined;
  const onderwerpLabels: Record<string, string> = {
    tuinonderhoud: "Onderhoud",
    tuinaanleg: "Aanleg",
    reiniging: "Reiniging",
  };
  const onderwerpLabel = specs?.onderwerp
    ? onderwerpLabels[specs.onderwerp] ?? specs.onderwerp
    : undefined;

  return (
    <div
      ref={isDragOverlay ? undefined : setNodeRef}
      {...(isDragOverlay ? {} : attributes)}
      {...(isDragOverlay ? {} : listeners)}
      onClick={() => onClick?.(lead)}
      className={cn(
        "rounded-lg border bg-card p-3 cursor-grab active:cursor-grabbing transition-shadow",
        isHandmatig && "border-l-4 border-l-purple-500",
        isDragging && "opacity-0",
        isDragOverlay && "shadow-xl",
        !isDragOverlay && "hover:shadow-md"
      )}
    >
      <div className="flex items-start justify-between gap-2 mb-1.5">
        <p className="font-medium text-sm leading-tight truncate">
          {lead.klantNaam}
        </p>
        <Badge
          variant="secondary"
          className={cn("text-[10px] shrink-0", badgeConfig.className)}
        >
          {badgeConfig.label}
        </Badge>
      </div>

      {(lead.klantPlaats || onderwerpLabel) && (
        <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1.5">
          {lead.klantPlaats && (
            <span className="flex items-center gap-0.5 truncate">
              <MapPin className="size-3 shrink-0" />
              {lead.klantPlaats}
            </span>
          )}
          {onderwerpLabel && (
            <span className="truncate">{onderwerpLabel}</span>
          )}
        </div>
      )}

      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span className="font-semibold text-foreground">
          {priceFormatter.format(waarde)}
        </span>
        <span>{relativeDate}</span>
      </div>
    </div>
  );
}
