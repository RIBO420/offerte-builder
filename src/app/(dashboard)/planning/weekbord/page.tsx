"use client";

/**
 * Weekbord-pagina (module Planning, PRD §2.2 — fase 1 stap 5a).
 * Kantoor plant; voorman en overige stafrollen lezen mee.
 * De route-dagkaart (weergave 2) volgt in stap 5b.
 */

import { PageHeader } from "@/components/page-header";
import { Weekbord } from "@/components/planbord/weekbord";

export default function WeekbordPagina() {
  return (
    <>
      <PageHeader />
      <div className="flex flex-1 flex-col gap-4 p-4 md:p-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight md:text-3xl">
            Weekbord
          </h1>
          <p className="text-muted-foreground">
            Rijen zijn teams, kolommen zijn dagen. Sleep opdrachten uit de bak
            om te plannen; sleep blokken om te verplaatsen of de duur aan te
            passen.
          </p>
        </div>
        <Weekbord />
      </div>
    </>
  );
}
