import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

/** De vier stappen van de factuurflow, met wat je in elke stap doet. */
export const FACTUUR_STAPPEN = [
  { label: "Genereren", wat: "factuur aanmaken uit de offerte" },
  { label: "Controleren", wat: "regels en bedragen nalopen" },
  { label: "Versturen", wat: "per e-mail naar de klant" },
  { label: "Betaald", wat: "markeren zodra het geld binnen is" },
] as const;

/**
 * Index van de stap die nu aan de beurt is (0 = Genereren). Een betaalde
 * factuur geeft 4: alle stappen klaar.
 *
 * Anders dan `getWorkflowStep` (die de statusvolgorde telt) is dit "wat moet
 * je nu doen": een conceptfactuur moet je controleren, een definitieve
 * versturen, een verzonden of vervallen factuur wacht op betaling.
 */
export function huidigeFactuurStap(status: string | null | undefined): number {
  switch (status) {
    case "concept":
      return 1;
    case "definitief":
      return 2;
    case "verzonden":
    case "vervallen":
      return 3;
    case "betaald":
      return 4;
    default:
      return 0;
  }
}

export function FactuurStappen({ huidige }: { huidige: number }) {
  return (
    <ol
      aria-label="Factuurstappen"
      className="@container/stappen flex flex-wrap items-center gap-x-3 gap-y-2 rounded-lg border bg-card px-4 py-3.5"
    >
      {FACTUUR_STAPPEN.map((stap, index) => {
        const klaar = index < huidige;
        const nu = index === huidige;
        const laatste = index === FACTUUR_STAPPEN.length - 1;
        return (
          <li
            key={stap.label}
            aria-current={nu ? "step" : undefined}
            className={cn(
              "flex min-w-0 items-center gap-2.5",
              laatste ? "flex-none" : "flex-1 basis-[8.5rem]",
              !klaar && !nu && "text-muted-foreground"
            )}
          >
            <span
              aria-hidden="true"
              className={cn(
                "grid size-6 shrink-0 place-items-center rounded-full border text-xs font-semibold tabular-nums",
                klaar &&
                  "border-status-geaccepteerd-border bg-status-geaccepteerd text-status-geaccepteerd-text",
                nu && "border-status-gefactureerd-border bg-status-gefactureerd text-status-gefactureerd-text"
              )}
            >
              {klaar ? <Check className="size-3.5" strokeWidth={3} /> : index + 1}
            </span>
            <span className="whitespace-nowrap text-[13px] font-medium">
              {stap.label}
              {klaar && <span className="sr-only"> (klaar)</span>}
              {nu && <span className="sr-only"> (nu)</span>}
            </span>
            {!laatste && (
              <span aria-hidden="true" className="hidden h-px flex-1 bg-border @2xl/stappen:block" />
            )}
          </li>
        );
      })}
    </ol>
  );
}
