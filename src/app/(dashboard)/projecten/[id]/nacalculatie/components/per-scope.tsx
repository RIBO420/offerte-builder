"use client";

import { useMemo } from "react";
import { SectiePaneel } from "@/components/ui/sectie-paneel";
import type { ScopeAfwijking } from "@/lib/nacalculatie-calculator";
import { scopeLabel } from "@/lib/rapportage-labels";
import { formatAfwijkingProcent, formatUrenKort } from "@/lib/format/uren-kort";
import { cn } from "@/lib/utils";

/**
 * Breed (container ≥ 36rem): scope · dubbel balkje · gepland · werkelijk ·
 * afwijking. Smal: scope + afwijking, het balkje eronder, de uren in een
 * regel daaronder.
 */
const RIJ_BREED =
  "@xl/sectie:grid-cols-[7rem_minmax(0,1fr)_5.25rem_5.25rem_6rem] @xl/sectie:gap-x-3.5";

function afwijkingWeergave(s: ScopeAfwijking): { tekst: string; klasse: string } {
  if (s.geplandeUren > 0 && s.werkelijkeUren === 0) {
    return { tekst: "niets geboekt", klasse: "font-normal text-muted-foreground" };
  }
  if (s.geplandeUren === 0) {
    return { tekst: "niet gepland", klasse: "font-normal text-muted-foreground" };
  }
  const p = s.afwijkingPercentage;
  return {
    tekst: formatAfwijkingProcent(p),
    klasse: cn(
      "font-semibold",
      p > 5 && "text-status-afgewezen-text",
      p < -5 && "text-status-gepland-text"
    ),
  };
}

export function PerScope({ afwijkingen }: { afwijkingen: ScopeAfwijking[] }) {
  // Geboekte scopes eerst (grootste afwijking bovenaan), dan wat niets kreeg.
  const rijen = useMemo(
    () =>
      [...afwijkingen].sort((a, b) => {
        const aLeeg = a.werkelijkeUren === 0 ? 1 : 0;
        const bLeeg = b.werkelijkeUren === 0 ? 1 : 0;
        if (aLeeg !== bLeeg) return aLeeg - bLeeg;
        return Math.abs(b.afwijkingPercentage) - Math.abs(a.afwijkingPercentage);
      }),
    [afwijkingen]
  );
  const schaal = Math.max(1, ...afwijkingen.flatMap((s) => [s.geplandeUren, s.werkelijkeUren]));

  return (
    <SectiePaneel
      titel="Per scope"
      kopbalk
      legeRegel={rijen.length === 0 ? { tekst: "Geen scopes in de voorcalculatie." } : undefined}
      acties={
        rijen.length > 0 && (
          <span className="flex items-center gap-3 text-xs text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <span aria-hidden="true" className="h-1.5 w-3 rounded-full bg-muted-foreground/60" />
              gepland
            </span>
            <span className="flex items-center gap-1.5">
              <span aria-hidden="true" className="h-1.5 w-3 rounded-full bg-accent-warm" />
              werkelijk
            </span>
          </span>
        )
      }
    >
      {rijen.length > 0 && (
        <div className="py-1.5">
          <div
            aria-hidden="true"
            className={`hidden items-center px-3.5 py-1.5 text-xs text-muted-foreground @xl/sectie:grid ${RIJ_BREED}`}
          >
            <span>Scope</span>
            <span />
            <span className="text-right">Gepland</span>
            <span className="text-right">Werkelijk</span>
            <span className="text-right">Afwijking</span>
          </div>
          <ul>
            {rijen.map((s) => {
              const afwijking = afwijkingWeergave(s);
              return (
                <li
                  key={s.scope}
                  className={`grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1 rounded-md px-3.5 py-2.5 transition-colors hover:bg-muted/50 ${RIJ_BREED}`}
                >
                  <span className="truncate font-medium">{scopeLabel(s.scope)}</span>
                  <span
                    aria-hidden="true"
                    className="order-2 col-span-full flex flex-col gap-[3px] @xl/sectie:order-none @xl/sectie:col-span-1"
                  >
                    <span
                      className="block h-1.5 rounded-full bg-muted-foreground/60"
                      style={{ width: `${(s.geplandeUren / schaal) * 100}%` }}
                    />
                    <span
                      className="block h-1.5 rounded-full bg-accent-warm"
                      style={{ width: `${(s.werkelijkeUren / schaal) * 100}%` }}
                    />
                  </span>
                  <span className="order-3 col-span-full text-xs text-muted-foreground tabular-nums @xl/sectie:order-none @xl/sectie:col-span-1 @xl/sectie:text-right @xl/sectie:text-sm @xl/sectie:text-foreground">
                    {formatUrenKort(s.geplandeUren)} u
                    <span className="@xl/sectie:hidden">
                      {" "}gepland · {formatUrenKort(s.werkelijkeUren)} u werkelijk
                    </span>
                  </span>
                  <span className="hidden text-right font-semibold tabular-nums @xl/sectie:inline">
                    {formatUrenKort(s.werkelijkeUren)} u
                  </span>
                  <span className={cn("order-1 text-right tabular-nums @xl/sectie:order-none", afwijking.klasse)}>
                    {afwijking.tekst}
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </SectiePaneel>
  );
}
