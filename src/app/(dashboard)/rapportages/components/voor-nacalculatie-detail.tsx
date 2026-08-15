"use client";

/**
 * De uitklap onder "Waar blijft geld liggen?" — alle projecten met een
 * voor/nacalculatie-paar, zonder afkapping.
 *
 * Deze component roept `getVoorNacalculatieDetail` pas aan wanneer hij bestaat,
 * en hij bestaat pas als iemand de uitklap opent. Dat is de hele reden dat de
 * detailquery apart staat: de eerste render van /rapportages hoeft dan niet op
 * de N+1 voorcalculatie-lookups te wachten.
 */

import { useQuery } from "convex/react";
import Link from "next/link";
import { api } from "@convex/_generated/api";
import { formatCurrency } from "@/lib/format/currency";
import { formatPercentage, urenTekst } from "@/lib/rapportage-labels";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import type { PeriodePreset } from "@/lib/rapportage-labels";

export function VoorNacalculatieDetail({
  preset,
  startDate,
  endDate,
}: {
  preset: PeriodePreset;
  startDate?: number;
  endDate?: number;
}) {
  const detail = useQuery(api.rapportage.getVoorNacalculatieDetail, {
    preset,
    startDate,
    endDate,
  });

  if (detail === undefined) {
    return (
      <div className="space-y-2 pt-1" aria-busy="true">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-11 w-full" />
        ))}
      </div>
    );
  }

  if (detail.projecten.length === 0) {
    return (
      <p className="py-3 text-sm text-muted-foreground">
        Voor {detail.periode.label} is nog geen enkel project nagecalculeerd.
      </p>
    );
  }

  return (
    <ul className="divide-y divide-border/70">
      {detail.projecten.map((project) => {
        const over = project.afwijkingUren > 0;
        return (
          <li key={project.projectId}>
            <Link
              href={`/projecten/${project.projectId}`}
              className="-mx-2 flex items-baseline justify-between gap-4 rounded-md px-2 py-2.5 transition-colors hover:bg-muted/50 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
            >
              <span className="min-w-0">
                <span className="block truncate text-sm font-medium">
                  {project.projectNaam}
                </span>
                <span className="block truncate text-xs text-muted-foreground">
                  {project.klantNaam} · begroot{" "}
                  {urenTekst(project.geplandeUren)}, werkelijk{" "}
                  {urenTekst(project.werkelijkeUren)}
                </span>
              </span>
              <span className="shrink-0 text-right">
                <span
                  className={cn(
                    "block text-sm font-medium tabular-nums",
                    over ? "text-[var(--chart-2)]" : "text-foreground"
                  )}
                >
                  {over ? "+" : ""}
                  {formatCurrency(project.afwijkingEuro, "nl-NL", false)}
                </span>
                <span className="block text-xs tabular-nums text-muted-foreground">
                  {project.afwijkingPercentage > 0 ? "+" : ""}
                  {formatPercentage(project.afwijkingPercentage)}
                </span>
              </span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
