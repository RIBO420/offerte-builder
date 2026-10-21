"use client";

/**
 * Tijdbord-pagina (HERO-nabouw fase 4): het planbord op een tijdas met
 * kwartierstappen. Draait naast het weekbord tot het tijdbord is goedgekeurd.
 * Zonder SSR: het bord onthoudt zoom en weergave in de browser.
 */

import dynamic from "next/dynamic";
import { PageHeader } from "@/components/page-header";
import { PlanningTabs } from "@/components/planbord/planning-tabs";
import { REVEAL_KLASSE } from "@/components/pagina-reveal";

const Tijdbord = dynamic(
  () => import("@/components/planbord/tijdbord").then((m) => m.Tijdbord),
  {
    ssr: false,
    loading: () => <p className="p-4 text-sm text-muted-foreground">Bord laden…</p>,
  }
);

export default function TijdbordPagina() {
  return (
    <>
      <PageHeader />
      <div className={`${REVEAL_KLASSE} flex flex-1 flex-col gap-4 p-4 md:p-6`}>
        <div className="flex flex-wrap items-end justify-between gap-3">
          <h1 className="font-display text-2xl font-semibold tracking-tight md:text-[28px]">
            Tijdbord
          </h1>
          <PlanningTabs actief="/planning/tijdbord" />
        </div>
        <Tijdbord />
      </div>
    </>
  );
}
