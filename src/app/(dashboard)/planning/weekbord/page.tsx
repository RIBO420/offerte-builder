"use client";

/**
 * Weekbord-pagina (module Planning, PRD §2.2 — fase 1 stap 5a).
 * Kantoor plant; voorman en overige stafrollen lezen mee.
 * De route-dagkaart (weergave 2, stap 5b) is dezelfde data, chronologisch
 * per team-dag — bereikbaar via de knop hieronder of per cel op het bord.
 */

import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { Weekbord } from "@/components/planbord/weekbord";

/** Drie weergaven van dezelfde planning; de tab is de navigatie. */
const WEERGAVEN = [
  { href: "/planning/weekbord", label: "Weekbord" },
  { href: "/planning/lijst", label: "Lijst" },
  { href: "/planning/dagkaart", label: "Dagkaart" },
] as const;

export default function WeekbordPagina() {
  return (
    <>
      <PageHeader />
      <div className="flex flex-1 flex-col gap-4 p-4 md:p-6">
        <div className="flex flex-wrap items-end justify-between gap-3">
          {/* De uitleg ("rijen zijn teams…") staat niet meer als alinea boven
              het bord: het bord legt zichzelf uit, en de sleephint staat in de
              opdrachtenbak, waar je hem nodig hebt. */}
          <h1 className="font-display text-2xl font-semibold tracking-tight md:text-[28px]">
            Weekbord
          </h1>
          <nav aria-label="Weergave" className="flex gap-0.5 rounded-lg bg-muted p-[3px]">
            {WEERGAVEN.map((weergave) => {
              const actief = weergave.href === "/planning/weekbord";
              return (
                <Link
                  key={weergave.href}
                  href={weergave.href}
                  aria-current={actief ? "page" : undefined}
                  className={`flex h-[34px] items-center rounded-md px-3.5 text-sm transition-colors ${
                    actief
                      ? "bg-card font-semibold text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {weergave.label}
                </Link>
              );
            })}
          </nav>
        </div>
        <Weekbord />
      </div>
    </>
  );
}
