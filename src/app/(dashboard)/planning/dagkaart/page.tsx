"use client";

/**
 * Route-dagkaart-pagina (module Planning, PRD §2.2 weergave 2 — fase 1 stap
 * 5b). Eén team, één dag, chronologisch — met tijdcascade en handmatig
 * ordenen. Kantoor stuurt bij; voorman en overige stafrollen lezen mee.
 * Modus Vandaag = live regie (Convex realtime); Planvenster = datumkeuze.
 */

import { Suspense } from "react";
import { PageHeader } from "@/components/page-header";
import { Dagkaart } from "@/components/planbord/dagkaart";

export default function DagkaartPagina() {
  return (
    <>
      <PageHeader />
      <div className="flex flex-1 flex-col gap-4 p-4 md:p-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight md:text-3xl">
            Dagkaart
          </h1>
          <p className="text-muted-foreground">
            De dag van één team, van vertrek bij de loods tot de
            einde-dag-check. Sleep klantblokken om te herordenen; pas je een
            tijd of duur aan, dan schuift alles erna automatisch door.
          </p>
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
