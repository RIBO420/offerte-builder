"use client";

/**
 * Weekbord-pagina (module Planning, PRD §2.2 — fase 1 stap 5a).
 * Kantoor plant; voorman en overige stafrollen lezen mee.
 * De route-dagkaart (weergave 2, stap 5b) is dezelfde data, chronologisch
 * per team-dag — bereikbaar via de knop hieronder of per cel op het bord.
 */

import Link from "next/link";
import { CalendarClock } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Weekbord } from "@/components/planbord/weekbord";

export default function WeekbordPagina() {
  return (
    <>
      <PageHeader />
      <div className="flex flex-1 flex-col gap-4 p-4 md:p-6">
        <div className="flex flex-wrap items-start justify-between gap-2">
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
          <Button variant="outline" asChild>
            <Link href="/planning/dagkaart">
              <CalendarClock className="mr-2 h-4 w-4" />
              Dagkaart
            </Link>
          </Button>
        </div>
        <Weekbord />
      </div>
    </>
  );
}
