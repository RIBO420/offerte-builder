/**
 * Statuspil voor uren tegen begroting (uitvoering) en de uitkomst van de
 * nacalculatie.
 *
 * Deze statussen hebben (nog) geen domein in `src/lib/constants/statuses.ts`.
 * De kleuren volgen wel de statusreceptuur: dezelfde tokens als de bestaande
 * statussen met dezelfde betekenis (succes 152, informatie 245, negatief 30,
 * neutraal 150). Hoort op termijn als domein "budget" in statuses.ts, zodat
 * `StatusBadge` hem kan tonen.
 */

import { cn } from "@/lib/utils";

export type BudgetStatus =
  | "op_schema"
  | "over_begroting"
  | "onder_budget"
  | "binnen_budget"
  | "over_budget"
  | "geen_begroting";

const KLEUR = {
  succes: {
    bg: "bg-status-geaccepteerd",
    text: "text-status-geaccepteerd-text",
    border: "border-status-geaccepteerd-border",
    dot: "bg-status-geaccepteerd-dot",
  },
  informatie: {
    bg: "bg-status-gepland",
    text: "text-status-gepland-text",
    border: "border-status-gepland-border",
    dot: "bg-status-gepland-dot",
  },
  negatief: {
    bg: "bg-status-afgewezen",
    text: "text-status-afgewezen-text",
    border: "border-status-afgewezen-border",
    dot: "bg-status-afgewezen-dot",
  },
  neutraal: {
    bg: "bg-status-concept",
    text: "text-status-concept-text",
    border: "border-status-concept-border",
    dot: "bg-status-concept-dot",
  },
} as const;

export const BUDGET_STATUS: Record<
  BudgetStatus,
  { label: string; kleur: (typeof KLEUR)[keyof typeof KLEUR] }
> = {
  op_schema: { label: "Op schema", kleur: KLEUR.succes },
  over_begroting: { label: "Over begroting", kleur: KLEUR.negatief },
  onder_budget: { label: "Onder budget", kleur: KLEUR.informatie },
  binnen_budget: { label: "Binnen budget", kleur: KLEUR.succes },
  over_budget: { label: "Over budget", kleur: KLEUR.negatief },
  geen_begroting: { label: "Geen begroting", kleur: KLEUR.neutraal },
};

/** Uitvoering: gelogde uren tegen de begrote uren uit de voorcalculatie. */
export function uitvoeringBudgetStatus(gelogd: number, begroot: number): BudgetStatus {
  if (!(begroot > 0)) return "geen_begroting";
  return gelogd > begroot ? "over_begroting" : "op_schema";
}

/**
 * Nacalculatie: afwijking in procenten. Binnen ±5% (de "goed"-drempel van de
 * nacalculatie-calculator) telt als binnen budget.
 */
export function nacalculatieBudgetStatus(afwijkingProcent: number): BudgetStatus {
  if (afwijkingProcent > 5) return "over_budget";
  if (afwijkingProcent < -5) return "onder_budget";
  return "binnen_budget";
}

export function BudgetStatusPil({
  status,
  className,
}: {
  status: BudgetStatus;
  className?: string;
}) {
  const { label, kleur } = BUDGET_STATUS[status];
  return (
    <span
      className={cn(
        "inline-flex h-[22px] shrink-0 items-center gap-1.5 rounded-full border px-2 text-xs font-medium",
        kleur.bg,
        kleur.text,
        kleur.border,
        className
      )}
    >
      <span aria-hidden="true" className={cn("size-1.5 rounded-full", kleur.dot)} />
      {label}
    </span>
  );
}
