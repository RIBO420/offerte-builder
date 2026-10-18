"use client";

/**
 * Route-dagkaart-pagina (module Planning, PRD §2.2 weergave 2 — fase 1 stap
 * 5b). Eén ploeg, één dag, chronologisch — met tijdcascade en handmatig
 * ordenen. Kantoor stuurt bij; voorman en overige stafrollen lezen mee.
 * De datumnavigatie in de kaart is het planvenster; "Vandaag" is live regie.
 */

import { Suspense } from "react";
import { PageHeader } from "@/components/page-header";
import { Dagkaart } from "@/components/planbord/dagkaart";
import { PlanningTabs } from "@/components/planbord/planning-tabs";
import { REVEAL_KLASSE } from "@/components/pagina-reveal";

export default function DagkaartPagina() {
  return (
    <>
      <PageHeader />
      <div className={`${REVEAL_KLASSE} flex flex-1 flex-col gap-4 p-4 md:p-6`}>
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div className="min-w-0 space-y-1.5">
            <h1 className="font-display text-2xl font-semibold tracking-tight md:text-[28px]">
              Dagkaart
            </h1>
            <p className="text-[15px] text-muted-foreground">
              De dag van één ploeg, van vertrek bij de loods tot de
              einde-dag-check.
            </p>
          </div>
          <PlanningTabs actief="/planning/dagkaart" />
        </div>
        <Suspense
          fallback={
            <p className="text-sm text-muted-foreground">Dagkaart laden…</p>
          }
        >
          <Dagkaart />
        </Suspense>
      </div>
    </>
  );
}
