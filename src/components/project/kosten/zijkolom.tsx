"use client";

/**
 * Zijkolom van het kostendashboard: kosten per scope en de kengetallen.
 */

import { SectiePaneel } from "@/components/ui/sectie-paneel";
import { scopeStip } from "@/components/project/project-cijfers";
import { formatCurrency } from "@/lib/format/currency";
import { formatUrenKort } from "@/lib/format/uren-kort";
import { cn } from "@/lib/utils";
import { scopeNaam } from "./helpers";

export interface ScopeRegel {
  scope: string;
  uren: number;
  totaal: number;
  /** Er staat minstens één boeking op deze scope. */
  geboekt: boolean;
}

export function PerScope({ regels }: { regels: ScopeRegel[] }) {
  return (
    <SectiePaneel
      titel="Per scope"
      kopbalk
      legeRegel={regels.length === 0 ? { tekst: "Nog niets geboekt." } : undefined}
    >
      {regels.length > 0 && (
        <ul className="grid grid-cols-[0.75rem_minmax(0,1fr)_auto_auto] items-center gap-x-3 gap-y-2.5 px-3 py-3 text-[13px]">
          {regels.map((r) => (
            <li key={r.scope} className="col-span-4 grid grid-cols-subgrid items-center">
              <span aria-hidden="true" className={cn("size-2.5 rounded-full", scopeStip(r.scope))} />
              <span className="truncate font-medium">{scopeNaam(r.scope)}</span>
              <span className="text-end text-muted-foreground tabular-nums">
                {r.uren > 0 ? (
                  `${formatUrenKort(r.uren)} u`
                ) : (
                  <>
                    <span aria-hidden="true">—</span>
                    <span className="sr-only">geen uren</span>
                  </>
                )}
              </span>
              {r.geboekt ? (
                <span className="text-end font-semibold tabular-nums">{formatCurrency(r.totaal)}</span>
              ) : (
                <span className="text-end text-xs text-muted-foreground">nog niets</span>
              )}
            </li>
          ))}
        </ul>
      )}
    </SectiePaneel>
  );
}

export function Kengetallen({
  werkdagen,
  medewerkers,
  uren,
  gemiddeldPerWerkdag,
}: {
  werkdagen: number;
  medewerkers: number;
  uren: number;
  gemiddeldPerWerkdag: number;
}) {
  const rijen: Array<[string, string]> = [
    ["Werkdagen geboekt", String(werkdagen)],
    ["Medewerkers", String(medewerkers)],
    ["Uren", formatUrenKort(uren)],
    ["Gemiddeld per werkdag", werkdagen > 0 ? formatCurrency(gemiddeldPerWerkdag) : "—"],
  ];
  return (
    <SectiePaneel titel="Kengetallen" kopbalk>
      <dl className="grid grid-cols-[minmax(0,1fr)_auto] gap-x-3 gap-y-2 px-4 py-3.5 text-[13px]">
        {rijen.map(([label, waarde]) => (
          <div key={label} className="col-span-2 grid grid-cols-subgrid">
            <dt className="text-muted-foreground">{label}</dt>
            <dd className="text-end font-semibold tabular-nums">{waarde}</dd>
          </div>
        ))}
      </dl>
    </SectiePaneel>
  );
}
