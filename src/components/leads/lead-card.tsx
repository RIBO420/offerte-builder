"use client";

import { useDraggable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { cn } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";
import { nl } from "@/lib/date-locale";
import { MapPin, Archive } from "lucide-react";
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
// Bron/type-label
// ============================================

// WS4 (critique): de bron van een lead is bijzaak — een klein grijs
// tekstlabel, geen gekleurde badge of gekleurde rand. Waarde en ouderdom
// zijn waar een verkoper op stuurt.
const typeLabels: Record<LeadType | "handmatig" | "website", string> = {
  gazon: "Gazon",
  boomschors: "Boomschors",
  verticuteren: "Verticuteren",
  contact: "Website",
  handmatig: "Handmatig",
  website: "Website",
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
  onDelete?: (lead: Lead) => void;
}

export function LeadCard({ lead, onClick, onDelete }: LeadCardProps) {
  const { attributes, listeners, setNodeRef, transform, isDragging } =
    useDraggable({
      id: lead._id,
      data: { lead },
    });

  const style = transform
    ? {
        transform: CSS.Translate.toString(transform),
        zIndex: 50,
      }
    : undefined;

  const isWebsite = lead.bron === "website_contact";
  const isHandmatig =
    !isWebsite && lead.bron != null && handmatigeBronnen.includes(lead.bron);

  const badgeKey: LeadType | "handmatig" | "website" = isWebsite
    ? "website"
    : isHandmatig
      ? "handmatig"
      : lead.type;
  const bronLabel = typeLabels[badgeKey];

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
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      onClick={() => onClick?.(lead)}
      className={cn(
        "group relative rounded-lg border bg-card p-3 cursor-grab active:cursor-grabbing transition-shadow",
        isDragging && "shadow-xl",
        !isDragging && "hover:shadow-md"
      )}
    >
      {onDelete && (
        <button
          type="button"
          aria-label={`Lead ${lead.klantNaam} archiveren`}
          title="Lead archiveren"
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.stopPropagation();
            onDelete(lead);
          }}
          className="absolute -right-2 -top-2 z-10 hidden size-6 items-center justify-center rounded-full border bg-background text-muted-foreground shadow-sm transition-colors hover:border-destructive/50 hover:text-destructive group-hover:flex focus-visible:flex"
        >
          <Archive className="size-3.5" />
        </button>
      )}
      <div className="flex items-start justify-between gap-2 mb-1.5">
        <p className="font-medium text-sm leading-tight truncate">
          {lead.klantNaam}
        </p>
        <span className="shrink-0 text-[10px] uppercase tracking-wide text-muted-foreground">
          {bronLabel}
        </span>
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

      {/* WS4 (critique): bedrag prominent — hier stuurt een verkoper op. */}
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-base font-semibold tabular-nums tracking-tight text-foreground">
          {priceFormatter.format(waarde)}
        </span>
        <span className="text-xs text-muted-foreground">{relativeDate}</span>
      </div>
    </div>
  );
}
