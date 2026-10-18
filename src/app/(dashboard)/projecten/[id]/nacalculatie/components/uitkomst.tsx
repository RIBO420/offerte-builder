"use client";

import { SectiePaneel } from "@/components/ui/sectie-paneel";
import {
  BudgetStatusPil,
  nacalculatieBudgetStatus,
  type BudgetStatus,
} from "@/components/project/budget-status-pil";
import type { NacalculatieResult } from "@/lib/nacalculatie-calculator";
import { formatAfwijkingProcent, formatUrenKort } from "@/lib/format/uren-kort";
import { formatCurrency } from "@/lib/format/currency";
import { cn } from "@/lib/utils";

const BALK_WERKELIJK: Record<BudgetStatus, string> = {
  onder_budget: "bg-status-gepland-dot",
  binnen_budget: "bg-status-geaccepteerd-dot",
  over_budget: "bg-status-afgewezen-dot",
  op_schema: "bg-status-geaccepteerd-dot",
  over_begroting: "bg-status-afgewezen-dot",
  geen_begroting: "bg-muted-foreground",
};

function euro(bedrag: number): string {
  return formatCurrency(bedrag, "nl-NL", bedrag % 1 !== 0);
}

/**
 * "Uitkomst": het antwoord eerst. Pil, groot afwijkingspercentage, de zin
 * gewerkt-tegen-gepland, twee vergelijkingsbalken en de kerncijfers.
 */
export function Uitkomst({
  data,
  teamGrootte,
}: {
  data: NacalculatieResult;
  teamGrootte?: number;
}) {
  const status = nacalculatieBudgetStatus(data.afwijkingPercentage);
  const verschil = data.werkelijkeUren - data.geplandeUren;
  const schaal = Math.max(data.geplandeUren, data.werkelijkeUren, 1);

  return (
    <SectiePaneel titel="Uitkomst" acties={<BudgetStatusPil status={status} />}>
      <div className="flex flex-col gap-4 px-5 pb-5 pt-4">
        <p className="flex flex-wrap items-baseline gap-x-3.5 gap-y-1.5">
          <span className="font-display text-[44px] font-semibold leading-none tracking-tight tabular-nums">
            {formatAfwijkingProcent(data.afwijkingPercentage)}
          </span>
          <span className="text-base text-muted-foreground tabular-nums">
            {formatUrenKort(data.werkelijkeUren)} uur gewerkt tegen{" "}
            {formatUrenKort(data.geplandeUren)} gepland
            {Math.abs(verschil) >= 0.05 && (
              <>
                {" "}
                · {formatUrenKort(Math.abs(verschil))} uur {verschil < 0 ? "minder" : "meer"}
              </>
            )}
          </span>
        </p>

        <div className="flex flex-col gap-2">
          <VergelijkBalk
            label="Gepland"
            uren={data.geplandeUren}
            breedte={(data.geplandeUren / schaal) * 100}
            kleur="bg-muted-foreground/60"
          />
          <VergelijkBalk
            label="Werkelijk"
            uren={data.werkelijkeUren}
            breedte={(data.werkelijkeUren / schaal) * 100}
            kleur={BALK_WERKELIJK[status]}
          />
        </div>

        <dl className="grid grid-cols-[repeat(auto-fit,minmax(9.5rem,1fr))] gap-3 border-t pt-3.5">
          <Kerncijfer
            label="Werkdagen"
            waarde={String(data.werkelijkeDagen)}
            context={`van ${formatUrenKort(data.geplandeDagen)} gepland`}
          />
          <Kerncijfer
            label="Machinekosten"
            waarde={euro(data.werkelijkeMachineKosten)}
            context={`van ${euro(data.geplandeMachineKosten)}`}
          />
          <Kerncijfer
            label="Team"
            waarde={String(data.aantalMedewerkers)}
            context={[
              teamGrootte ? `van ${teamGrootte} gelogd` : "gelogd",
              `${data.aantalRegistraties} ${data.aantalRegistraties === 1 ? "registratie" : "registraties"}`,
            ].join(" · ")}
          />
        </dl>
      </div>
    </SectiePaneel>
  );
}

function VergelijkBalk({
  label,
  uren,
  breedte,
  kleur,
}: {
  label: string;
  uren: number;
  breedte: number;
  kleur: string;
}) {
  return (
    <div className="grid grid-cols-[5rem_minmax(0,1fr)_4rem] items-center gap-3 text-[13px]">
      <span className="text-muted-foreground">{label}</span>
      <span aria-hidden="true" className="h-2.5 overflow-hidden rounded-full bg-muted">
        <span
          className={cn("block h-full rounded-full transition-[width] duration-500 ease-standaard motion-reduce:transition-none", kleur)}
          style={{ width: `${breedte}%` }}
        />
      </span>
      <span className="text-right font-semibold tabular-nums">{formatUrenKort(uren)} u</span>
    </div>
  );
}

function Kerncijfer({
  label,
  waarde,
  context,
}: {
  label: string;
  waarde: string;
  context: string;
}) {
  return (
    <div className="flex min-w-0 flex-col gap-0.5">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="text-lg font-semibold tabular-nums">
        {waarde}{" "}
        <span className="text-[13px] font-normal text-muted-foreground">{context}</span>
      </dd>
    </div>
  );
}
