"use client";

import { cn } from "@/lib/utils";
import {
  BLIJFT_LIGGEN_LABELS,
  INDELING_LABELS,
  PERSPECTIEF_LABELS,
  STATUS_CHIP_LABELS,
  type BlijftLiggenModus,
  type Indeling,
  type Perspectief,
  type StatusChip,
} from "@/components/mijn-dag/verdeel-op";

/**
 * De twee stuurregels boven het bord (inventaris §B1/§B2).
 *
 * Eerst *wiens* werk je ziet, dan *hoe* het gestapeld ligt, en pas daarna hoe
 * de signalering wordt getoond. Alles staat als segmentknoppen in beeld en
 * niet in een dropdown: dit zijn geen instellingen die je één keer kiest, maar
 * standen waar je tien keer per dag tussen wisselt.
 *
 * Elke keuze landt in de URL (zie `werkbord.tsx`), dus een bord dat je zo hebt
 * staan kun je delen en herladen.
 */
function Segment<T extends string>({
  label,
  waardes,
  labels,
  waarde,
  onKies,
}: {
  label: string;
  waardes: T[];
  labels: Record<T, string>;
  waarde: T;
  onKies: (waarde: T) => void;
}) {
  return (
    <div className="flex min-w-0 items-center gap-2">
      <span className="shrink-0 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </span>
      <div
        role="group"
        aria-label={label}
        className="flex flex-wrap items-center gap-0.5 rounded-lg border bg-muted/40 p-0.5"
      >
        {waardes.map((optie) => (
          <button
            key={optie}
            type="button"
            aria-pressed={optie === waarde}
            onClick={() => onKies(optie)}
            className={cn(
              "rounded-md px-2.5 py-1 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              optie === waarde
                ? "bg-card text-foreground shadow-xs"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            {labels[optie]}
          </button>
        ))}
      </div>
    </div>
  );
}

export function PerspectiefBalk({
  perspectief,
  indeling,
  statusChip,
  blijftLiggenModus,
  aantalLiggen,
  onWijzig,
}: {
  perspectief: Perspectief;
  indeling: Indeling;
  statusChip: StatusChip;
  blijftLiggenModus: BlijftLiggenModus;
  aantalLiggen: number;
  onWijzig: (patch: {
    perspectief?: Perspectief;
    indeling?: Indeling;
    statusChip?: StatusChip;
    blijftLiggenModus?: BlijftLiggenModus;
  }) => void;
}) {
  return (
    <div className="grid gap-2">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <Segment
          label="Perspectief"
          waardes={["mij", "uitgezet", "alles"]}
          labels={PERSPECTIEF_LABELS}
          waarde={perspectief}
          onKies={(waarde) => onWijzig({ perspectief: waarde })}
        />
        <Segment
          label="Status"
          waardes={["alles", "todo", "bezig", "check"]}
          labels={STATUS_CHIP_LABELS}
          waarde={statusChip}
          onKies={(waarde) => onWijzig({ statusChip: waarde })}
        />
      </div>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <Segment
          label="Verdeel op"
          waardes={["wanneer", "wie", "status", "klant"]}
          labels={INDELING_LABELS}
          waarde={indeling}
          onKies={(waarde) => onWijzig({ indeling: waarde })}
        />
        <Segment
          label="Blijft liggen"
          waardes={["kolom", "balk", "uit"]}
          labels={BLIJFT_LIGGEN_LABELS}
          waarde={blijftLiggenModus}
          onKies={(waarde) => onWijzig({ blijftLiggenModus: waarde })}
        />
        {blijftLiggenModus !== "uit" && aantalLiggen > 0 && (
          <span className="rounded-full border border-status-vervallen-border bg-status-vervallen px-2 py-0.5 text-[11px] font-medium leading-4 text-status-vervallen-text">
            {aantalLiggen} {aantalLiggen === 1 ? "taak" : "taken"} vastgelopen
          </span>
        )}
      </div>
    </div>
  );
}
