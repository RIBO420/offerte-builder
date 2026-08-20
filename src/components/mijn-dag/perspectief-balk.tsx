"use client";

import { AlertTriangle, ChevronDown, LayoutGrid, ListFilter } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
 * De werkbalk boven het bord (inventaris §B1/§B2) — één rij.
 *
 * Zelfde patroon als Linear/Asana: alleen de hóófdvraag ("wiens werk zie ik?")
 * staat als zichtbare segmentknop; de overige standen zijn compacte
 * dropdown-knoppen die hun huidige waarde tonen. Zo kost de bediening één
 * regel in plaats van twee balken vol knoppen, en blijft elke stand toch in
 * één klik bereikbaar én afleesbaar.
 *
 * Elke keuze landt in de URL (zie `werkbord.tsx`), dus een bord dat je zo
 * hebt staan kun je delen en herladen.
 */

const KNOP =
  "inline-flex h-8 items-center gap-1.5 rounded-full border bg-card px-3 text-xs font-medium transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

function StandKnop<T extends string>({
  label,
  icoon,
  waardes,
  labels,
  waarde,
  standaard,
  onKies,
}: {
  label: string;
  icoon: React.ReactNode;
  waardes: T[];
  labels: Record<T, string>;
  waarde: T;
  /** Bij de standaardstand blijft de knop stil; elke andere stand kleurt mee. */
  standaard: T;
  onKies: (waarde: T) => void;
}) {
  const afwijkend = waarde !== standaard;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className={cn(KNOP, afwijkend && "border-primary/40 text-foreground")}
        aria-label={`${label}: ${labels[waarde]}`}
      >
        {icoon}
        <span className="text-muted-foreground">{label}:</span>
        <span className={cn(afwijkend && "font-semibold")}>
          {labels[waarde]}
        </span>
        <ChevronDown className="size-3.5 text-muted-foreground" aria-hidden />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start">
        <DropdownMenuLabel>{label}</DropdownMenuLabel>
        <DropdownMenuRadioGroup
          value={waarde}
          onValueChange={(nieuw) => onKies(nieuw as T)}
        >
          {waardes.map((optie) => (
            <DropdownMenuRadioItem key={optie} value={optie}>
              {labels[optie]}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
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
    <div className="flex flex-wrap items-center gap-2">
      {/* De hoofdvraag: wiens werk kijk je naar. */}
      <div
        role="group"
        aria-label="Perspectief"
        className="flex items-center gap-1 rounded-full border bg-card p-1"
      >
        {(["mij", "uitgezet", "alles"] as const).map((optie) => (
          <button
            key={optie}
            type="button"
            aria-pressed={optie === perspectief}
            onClick={() => onWijzig({ perspectief: optie })}
            className={cn(
              "rounded-full px-3 py-1 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              optie === perspectief
                ? "bg-primary text-primary-foreground shadow-xs"
                : "text-muted-foreground hover:bg-muted hover:text-foreground"
            )}
          >
            {PERSPECTIEF_LABELS[optie]}
          </button>
        ))}
      </div>

      <StandKnop
        label="Verdeel op"
        icoon={
          <LayoutGrid className="size-3.5 text-muted-foreground" aria-hidden />
        }
        waardes={["wanneer", "wie", "status", "klant"]}
        labels={INDELING_LABELS}
        waarde={indeling}
        standaard="wanneer"
        onKies={(waarde) => onWijzig({ indeling: waarde })}
      />

      <StandKnop
        label="Status"
        icoon={
          <ListFilter className="size-3.5 text-muted-foreground" aria-hidden />
        }
        waardes={["alles", "todo", "bezig", "check"]}
        labels={STATUS_CHIP_LABELS}
        waarde={statusChip}
        standaard="alles"
        onKies={(waarde) => onWijzig({ statusChip: waarde })}
      />

      {/* Blijft-liggen: weergavekeuze én signaal in één knop — het rode
          badge-getal maakt een losse "vastgelopen"-pil overbodig. */}
      <DropdownMenu>
        <DropdownMenuTrigger
          className={cn(
            KNOP,
            aantalLiggen > 0 &&
              blijftLiggenModus !== "uit" &&
              "border-status-vervallen-border"
          )}
          aria-label={`Blijft liggen: ${BLIJFT_LIGGEN_LABELS[blijftLiggenModus]}${
            aantalLiggen > 0 ? `, ${aantalLiggen} vastgelopen` : ""
          }`}
        >
          <AlertTriangle
            className={cn(
              "size-3.5",
              aantalLiggen > 0
                ? "text-status-vervallen-text"
                : "text-muted-foreground"
            )}
            aria-hidden
          />
          <span className="text-muted-foreground">Blijft liggen</span>
          {aantalLiggen > 0 && (
            <span className="inline-flex size-4.5 items-center justify-center rounded-full bg-destructive text-[10px] font-semibold tabular-nums text-white">
              {aantalLiggen}
            </span>
          )}
          <ChevronDown className="size-3.5 text-muted-foreground" aria-hidden />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start">
          <DropdownMenuLabel>Weergave</DropdownMenuLabel>
          <DropdownMenuRadioGroup
            value={blijftLiggenModus}
            onValueChange={(nieuw) =>
              onWijzig({ blijftLiggenModus: nieuw as BlijftLiggenModus })
            }
          >
            {(["kolom", "balk", "uit"] as const).map((optie) => (
              <DropdownMenuRadioItem key={optie} value={optie}>
                {BLIJFT_LIGGEN_LABELS[optie]}
              </DropdownMenuRadioItem>
            ))}
          </DropdownMenuRadioGroup>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
