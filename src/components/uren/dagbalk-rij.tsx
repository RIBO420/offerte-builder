"use client";

/**
 * Eén rij "iemand-op-een-dag": naam of daglabel, de mini-dagbalk op een
 * gedeelde tijd-as, en het uurtotaal met de status als tékst (kleur is nooit
 * de enige drager). De rij is de gedeelde vorm van de drie rolgezichten:
 *
 * - Ploegenfilm: alle leden van een ploeg onder elkaar, klik → daginspector;
 * - voorman-gezicht: de ploegdag, met per lid de open voorstellen;
 * - medewerker-gezicht: de eigen week, met kantoorcorrecties gemarkeerd.
 *
 * Boven `@[30rem]/sectie` staan label, balk en totaal in één regel (grid);
 * daaronder stapelt de rij — geen zijwaartse scroll, de balk schaalt mee.
 */

import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { formatHours } from "@/lib/format";
import { tijdVanMinuten, type DagSegment } from "./controle-types";
import { Dagbalk } from "./dagbalk";

export function DagbalkRij({
  label,
  balkLabel,
  segmenten,
  asVanMinuten,
  asTotMinuten,
  uren,
  status,
  meta,
  metAs = false,
  onClick,
}: {
  /** Wat er links staat: de naam (film/ploegdag) of de dag (eigen week). */
  label: string;
  /** Toegankelijke naam van de balk ("Lars Hendriks, dinsdag 11 augustus"). */
  balkLabel: string;
  segmenten: DagSegment[];
  asVanMinuten: number;
  asTotMinuten: number;
  uren: number;
  status: "open" | "ingediend";
  /** Extra regel onder de rij: open voorstellen, kantoorcorrecties, resultaat. */
  meta?: ReactNode;
  /** Tijd-as-labels onder de balk — één keer per hoofdstuk, op de onderste rij. */
  metAs?: boolean;
  /** Maakt de rij een knop (film: open de daginspector). */
  onClick?: () => void;
}) {
  const inhoud = (
    <>
      <span className="flex min-w-0 items-baseline gap-2 @[30rem]/sectie:w-[10.5rem] @[30rem]/sectie:shrink-0 @[30rem]/sectie:flex-col @[30rem]/sectie:gap-0.5">
        <span className="min-w-0 truncate text-[13px] font-medium">
          {label}
        </span>
        <span
          className={cn(
            "text-[11px] leading-4",
            status === "ingediend"
              ? "text-muted-foreground"
              : "font-medium text-status-verzonden-text"
          )}
        >
          {status === "ingediend" ? "ingediend" : "nog open"}
        </span>
      </span>

      <span className="min-w-0 flex-1">
        <Dagbalk
          segmenten={segmenten}
          formaat="mini"
          label={balkLabel}
          asVanMinuten={asVanMinuten}
          asTotMinuten={asTotMinuten}
        />
        {metAs && (
          <span
            aria-hidden="true"
            className="mt-1 flex justify-between text-[10px] leading-3 tabular-nums text-muted-foreground/80"
          >
            <span>{tijdVanMinuten(asVanMinuten)}</span>
            <span>
              {tijdVanMinuten(
                Math.round((asVanMinuten + asTotMinuten) / 2 / 30) * 30
              )}
            </span>
            <span>{tijdVanMinuten(asTotMinuten)}</span>
          </span>
        )}
      </span>

      <span className="shrink-0 text-right text-[13px] tabular-nums @[30rem]/sectie:w-[4.5rem]">
        {formatHours(uren)} uur
      </span>
    </>
  );

  const rijKlasse =
    "flex w-full flex-col gap-1.5 px-3 py-2 text-left @[30rem]/sectie:flex-row @[30rem]/sectie:items-center @[30rem]/sectie:gap-3";

  return (
    <div className="flex flex-col">
      {onClick ? (
        <button
          type="button"
          onClick={onClick}
          className={cn(
            rijKlasse,
            "cursor-pointer transition-colors hover:bg-muted/40 focus-visible:bg-muted/40 focus-visible:outline-none"
          )}
          aria-label={`${balkLabel} — details bekijken`}
        >
          {inhoud}
        </button>
      ) : (
        <div className={rijKlasse}>{inhoud}</div>
      )}
      {meta && (
        <div className="px-3 pb-2 text-[12px] leading-4 text-muted-foreground @[30rem]/sectie:pl-[calc(10.5rem+1.5rem)]">
          {meta}
        </div>
      )}
    </div>
  );
}
