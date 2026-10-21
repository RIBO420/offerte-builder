"use client";

import Link from "next/link";

/**
 * Eén tabrij voor alle planningsschermen. Het overzicht had eigen tabs
 * (Week/Maand/Kwartaal/Jaar) naast knoppen naar het weekbord, en het weekbord
 * weer andere knoppen; nu zie je op elk planningsscherm dezelfde vier ingangen
 * op dezelfde plek.
 */
const WEERGAVEN = [
  { href: "/planning", label: "Overzicht" },
  { href: "/planning/weekbord", label: "Weekbord" },
  { href: "/planning/tijdbord", label: "Tijdbord" },
  { href: "/planning/lijst", label: "Lijst" },
  { href: "/planning/dagkaart", label: "Dagkaart" },
] as const;

export type PlanningWeergave = (typeof WEERGAVEN)[number]["href"];

export function PlanningTabs({ actief }: { actief: PlanningWeergave }) {
  return (
    <nav aria-label="Planningweergave" className="flex flex-wrap gap-0.5 rounded-lg bg-muted p-[3px]">
      {WEERGAVEN.map((weergave) => {
        const isActief = weergave.href === actief;
        return (
          <Link
            key={weergave.href}
            href={weergave.href}
            aria-current={isActief ? "page" : undefined}
            className={`flex h-[34px] items-center whitespace-nowrap rounded-md px-3.5 text-sm transition-colors ${
              isActief
                ? "bg-card font-semibold text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {weergave.label}
          </Link>
        );
      })}
    </nav>
  );
}
