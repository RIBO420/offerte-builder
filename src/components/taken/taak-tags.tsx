"use client";

import { AlertTriangle, MessageSquare } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  STATUS_LABELS,
  STATUS_TOON,
  deadlineWeergave,
  formatDeadlineVolledig,
  vandaagISO,
  type TaakStatus,
  type VerrijkteTaak,
} from "./types";

/**
 * De metaregel van een taakkaart, ingeklapt én open (inventaris §A6).
 *
 * Volgorde is de leesvolgorde van de vraag "moet ik hier iets mee?":
 * status → prioriteit → deadline → subtaken → herkomst → overleg. Alleen wat
 * iets zegt krijgt inkt: `normaal` en `laag` staan er niet als pil, want een
 * regel waarin alles kleur heeft wijst nergens meer naar.
 *
 * Deadline is amber zolang de taak open staat en rood zodra hij voorbij is —
 * dezelfde betekenis als elders in de app (§C).
 */
const PIL =
  "inline-flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-[10px] font-medium leading-none";

export function TaakTags({
  taak,
  toonStatus = true,
  className,
}: {
  taak: VerrijkteTaak;
  /** Op een statusbord is de kolom al de status — dan is de pil ruis. */
  toonStatus?: boolean;
  className?: string;
}) {
  const status = taak.status as TaakStatus;
  const isKlaar = status === "klaar";
  const deadline =
    taak.deadline && !isKlaar
      ? deadlineWeergave(taak.deadline, vandaagISO())
      : null;

  return (
    <span
      className={cn("inline-flex flex-wrap items-center gap-1", className)}
    >
      {toonStatus && (
        <span className={cn(PIL, STATUS_TOON[status])}>
          {STATUS_LABELS[status]}
        </span>
      )}

      {taak.prioriteit === "hoog" && !isKlaar && (
        <span
          className={cn(
            PIL,
            "border-status-vervallen-border bg-status-vervallen text-status-vervallen-text"
          )}
        >
          Hoog
        </span>
      )}

      {deadline && taak.deadline && (
        <time
          dateTime={taak.deadline}
          title={formatDeadlineVolledig(taak.deadline)}
          className={cn(
            PIL,
            deadline.teLaat
              ? "border-status-vervallen-border bg-status-vervallen text-status-vervallen-text"
              : "border-status-verzonden-border bg-status-verzonden text-status-verzonden-text"
          )}
        >
          {deadline.teLaat && <AlertTriangle className="size-3" aria-hidden />}
          {deadline.tekst}
        </time>
      )}

      {taak.subtakenTotaal > 0 && (
        <span
          className={cn(PIL, "border-border bg-muted text-muted-foreground")}
          title={`${taak.subtakenKlaar} van ${taak.subtakenTotaal} subtaken klaar`}
        >
          <span className="tabular-nums">
            {taak.subtakenKlaar}/{taak.subtakenTotaal}
          </span>
        </span>
      )}

      {taak.ai && !isKlaar && (
        <span
          className={cn(PIL, "border-primary/30 bg-primary/10 uppercase tracking-wide text-primary")}
        >
          Uit gesprek
        </span>
      )}

      {taak.reactieCount > 0 && (
        <span
          className={cn(PIL, "border-border bg-muted text-muted-foreground")}
          title={`${taak.reactieCount} ${taak.reactieCount === 1 ? "reactie" : "reacties"}`}
        >
          <MessageSquare className="size-3" aria-hidden />
          <span className="tabular-nums">{taak.reactieCount}</span>
        </span>
      )}
    </span>
  );
}
