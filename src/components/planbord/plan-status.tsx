import { cn } from "@/lib/utils";
import { getStatusConfig, type StatusConfig } from "@/lib/constants/statuses";

/**
 * Status van een gepland werkitem (lijst en dagkaart) als pil met stip.
 *
 * Kleuren komen uit `statuses.ts` (domein "project"). Onderhoudsbeurten kennen
 * drie statussen die daar (nog) niet in staan; die krijgen hier alleen een
 * Nederlands label en lenen de receptuur van de status met dezelfde betekenis
 * (uitgevoerd = succes, deels = actief, vervallen = negatief) — geen nieuwe
 * kleuren.
 */
const BEURT_STATUSSEN: Record<string, { label: string; leen: string }> = {
  uitgevoerd: { label: "Uitgevoerd", leen: "afgerond" },
  deels_uitgevoerd: { label: "Deels uitgevoerd", leen: "in_uitvoering" },
  vervallen: { label: "Vervallen", leen: "vervallen" },
};

export const PLAN_STATUS_LABELS: Record<string, string> = {
  gepland: "Gepland",
  in_uitvoering: "In uitvoering",
  afgerond: "Afgerond",
  uitgevoerd: "Uitgevoerd",
  deels_uitgevoerd: "Deels uitgevoerd",
  nacalculatie_compleet: "Nacalculatie",
  gefactureerd: "Gefactureerd",
  vervallen: "Vervallen",
  voorcalculatie: "Voorcalculatie",
};

export function planStatusConfig(status: string): StatusConfig {
  const beurt = BEURT_STATUSSEN[status];
  if (beurt) {
    const geleend =
      beurt.leen === "vervallen"
        ? getStatusConfig("vervallen", "factuur")
        : getStatusConfig(beurt.leen, "project");
    return { ...geleend, label: beurt.label };
  }
  return getStatusConfig(status, "project");
}

export function PlanStatusPil({
  status,
  className,
}: {
  status: string;
  className?: string;
}) {
  const config = planStatusConfig(status);
  return (
    <span
      className={cn(
        "inline-flex h-[22px] shrink-0 items-center gap-1.5 rounded-full border px-2 text-xs font-medium whitespace-nowrap",
        config.color.bg,
        config.color.text,
        config.color.border,
        className
      )}
    >
      <span
        aria-hidden="true"
        className={cn("size-1.5 rounded-full", config.color.dot)}
      />
      {config.label}
    </span>
  );
}
