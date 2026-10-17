"use client";

/**
 * Weekbord-pagina (module Planning, PRD §2.2 — fase 1 stap 5a).
 * Kantoor plant; voorman en overige stafrollen lezen mee.
 * De route-dagkaart (weergave 2, stap 5b) is dezelfde data, chronologisch
 * per team-dag — bereikbaar via de knop hieronder of per cel op het bord.
 */

import { PageHeader } from "@/components/page-header";
import { PlanningTabs } from "@/components/planbord/planning-tabs";
import { Weekbord } from "@/components/planbord/weekbord";

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
          <PlanningTabs actief="/planning/weekbord" />
        </div>
        <Weekbord />
      </div>
    </>
  );
}
