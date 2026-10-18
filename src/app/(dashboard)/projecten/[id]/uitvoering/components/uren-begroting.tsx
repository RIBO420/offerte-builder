"use client";

import { SectiePaneel } from "@/components/ui/sectie-paneel";
import { Skeleton } from "@/components/ui/skeleton";
import {
  BudgetStatusPil,
  uitvoeringBudgetStatus,
} from "@/components/project/budget-status-pil";
import { formatUrenKort } from "@/lib/format/uren-kort";
import { formatCurrency } from "@/lib/format/currency";
import { cn } from "@/lib/utils";

/**
 * "Uren tegen begroting": het heldcijfer van de uitvoering. Eén groot getal
 * (gelogde uren), de begroting ernaast in een zin, één brede balk en een rij
 * kerncijfers. Vervangt de oude ProgressIndicator + vier StatsCards.
 *
 * Over de begroting: de balk loopt dan vol en het deel bóven de begroting is
 * gearceerd, en de zin zegt hoeveel uur erover — kleur is nooit het enige
 * signaal.
 */
export function UrenBegroting({
  isLoading,
  gelogd,
  begroot,
  heeftVoorcalculatie,
  aantalMedewerkers,
  aantalWerkdagen,
  machineKosten,
}: {
  isLoading: boolean;
  gelogd: number;
  begroot: number;
  heeftVoorcalculatie: boolean;
  aantalMedewerkers: number;
  aantalWerkdagen: number;
  machineKosten: number;
}) {
  const status = uitvoeringBudgetStatus(gelogd, heeftVoorcalculatie ? begroot : 0);
  const heeftBegroting = status !== "geen_begroting";
  const over = status === "over_begroting";
  const voortgang = heeftBegroting ? (gelogd / begroot) * 100 : 0;

  // Over de begroting schaalt de balk naar de gelogde uren: het begrote deel
  // is effen, het deel erboven gearceerd.
  const begrootDeel = over ? (begroot / gelogd) * 100 : Math.min(voortgang, 100);

  return (
    <SectiePaneel
      titel="Uren tegen begroting"
      acties={!isLoading && <BudgetStatusPil status={status} />}
    >
      <div className="flex flex-col gap-3.5 px-5 pb-5 pt-4">
        {isLoading ? (
          <>
            <Skeleton className="h-11 w-48" />
            <Skeleton className="h-2.5 w-full rounded-full" />
          </>
        ) : (
          <>
            <p className="flex flex-wrap items-baseline gap-x-3.5 gap-y-1.5">
              <span className="font-display text-[44px] font-semibold leading-none tracking-tight tabular-nums">
                {formatUrenKort(gelogd)}
              </span>
              <span className="text-base text-muted-foreground tabular-nums">
                {heeftBegroting ? (
                  <>
                    van {formatUrenKort(begroot)} uur gelogd ·{" "}
                    {over ? (
                      <span className="font-medium text-destructive">
                        {formatUrenKort(gelogd - begroot)} uur over de begroting
                      </span>
                    ) : (
                      <>nog {formatUrenKort(begroot - gelogd)} uur binnen begroting</>
                    )}
                  </>
                ) : (
                  <>uur gelogd · nog geen voorcalculatie om tegen af te zetten</>
                )}
              </span>
            </p>

            {heeftBegroting && (
              <div
                role="img"
                aria-label={`${Math.round(voortgang)}% van de begrote uren gelogd`}
                className="relative flex h-2.5 overflow-hidden rounded-full bg-accent-warm/15"
              >
                <span
                  className={cn(
                    "h-full bg-accent-warm transition-[width] duration-500 ease-out motion-reduce:transition-none",
                    !over && "rounded-full"
                  )}
                  style={{ width: `${begrootDeel}%` }}
                />
                {over && (
                  <span
                    className="h-full flex-1 bg-accent-warm"
                    style={{
                      backgroundImage:
                        "repeating-linear-gradient(135deg, transparent 0 4px, color-mix(in oklch, var(--background) 45%, transparent) 4px 8px)",
                    }}
                  />
                )}
              </div>
            )}
          </>
        )}

        <dl className="grid grid-cols-[repeat(auto-fit,minmax(8.75rem,1fr))] gap-3 border-t pt-3.5">
          {heeftBegroting && (
            <Kerncijfer label="Voortgang" waarde={isLoading ? null : `${Math.round(voortgang)}%`} />
          )}
          <Kerncijfer
            label="Medewerkers gelogd"
            waarde={isLoading ? null : String(aantalMedewerkers)}
          />
          <Kerncijfer label="Werkdagen" waarde={isLoading ? null : String(aantalWerkdagen)} />
          <Kerncijfer
            label="Machinekosten"
            waarde={isLoading ? null : formatCurrency(machineKosten, "nl-NL", machineKosten % 1 !== 0)}
          />
        </dl>
      </div>
    </SectiePaneel>
  );
}

function Kerncijfer({ label, waarde }: { label: string; waarde: string | null }) {
  return (
    <div className="flex min-w-0 flex-col gap-0.5">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="text-lg font-semibold tabular-nums">
        {waarde ?? <Skeleton className="mt-1 h-5 w-12" />}
      </dd>
    </div>
  );
}
