"use client";

import { useMemo } from "react";
import { SectieLegeStaat } from "@/components/ui/sectie-paneel";
import { formatUrenKort } from "@/lib/format/uren-kort";
import type { UrenRegistratie } from "./uren-tab";

/**
 * Uren per medewerker: totaal, aantal dagen en het aandeel in de gelogde
 * uren. Vervangt de oude "Overzicht"-tab.
 */
export function PerMedewerkerTab({ registraties }: { registraties: UrenRegistratie[] }) {
  const rijen = useMemo(() => {
    const perMedewerker = new Map<string, { uren: number; dagen: Set<string> }>();
    for (const r of registraties) {
      const rij = perMedewerker.get(r.medewerker) ?? { uren: 0, dagen: new Set<string>() };
      rij.uren += r.uren;
      rij.dagen.add(r.datum);
      perMedewerker.set(r.medewerker, rij);
    }
    return [...perMedewerker.entries()]
      .map(([naam, { uren, dagen }]) => ({ naam, uren, dagen: dagen.size }))
      .sort((a, b) => b.uren - a.uren);
  }, [registraties]);

  if (rijen.length === 0) {
    return <SectieLegeStaat tekst="Nog geen uren geregistreerd." />;
  }

  const totaal = rijen.reduce((som, r) => som + r.uren, 0);

  return (
    <ul className="flex flex-col py-1.5">
      {rijen.map((rij) => {
        const aandeel = totaal > 0 ? (rij.uren / totaal) * 100 : 0;
        return (
          <li
            key={rij.naam}
            className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1 px-3 py-2 @xl/sectie:grid-cols-[minmax(0,12rem)_minmax(0,1fr)_7rem_5rem]"
          >
            <span className="truncate font-medium">{rij.naam}</span>
            <span
              aria-hidden="true"
              className="order-last col-span-full h-1.5 overflow-hidden rounded-full bg-muted @xl/sectie:order-none @xl/sectie:col-span-1"
            >
              <span
                className="block h-full rounded-full bg-accent-warm"
                style={{ width: `${aandeel}%` }}
              />
            </span>
            <span className="hidden text-xs text-muted-foreground tabular-nums @xl/sectie:inline">
              {rij.dagen} {rij.dagen === 1 ? "dag" : "dagen"} · {Math.round(aandeel)}%
            </span>
            <span className="text-right font-semibold tabular-nums">
              {formatUrenKort(rij.uren)} uur
            </span>
          </li>
        );
      })}
    </ul>
  );
}
