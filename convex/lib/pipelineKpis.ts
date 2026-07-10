/**
 * §5.3b (PRD §2.5e): Pipeline-KPI helpers.
 *
 * Concept-offertes ontstaan continu door de wizard-auto-save en vertekenen
 * daardoor de pipeline-cijfers. Deze pure helpers filteren concepten uit
 * pipeline-KPI's (dashboard.ts en analytics.ts) en berekenen de funnel en
 * conversieratio's vanaf voorcalculatie.
 *
 * Bewust géén Convex-imports: dit bestand is puur en unit-testbaar.
 */

export interface PipelineStatusCounts {
  voorcalculatie: number;
  verzonden: number;
  geaccepteerd: number;
  afgewezen: number;
}

export interface PipelineFunnel {
  voorcalculatie: number;
  verzonden: number;
  afgehandeld: number;
  geaccepteerd: number;
}

export interface PipelineConversionRates {
  voorcalculatieToVerzonden: number;
  verzondenToAfgehandeld: number;
  afgehandeldToWon: number;
  overallConversion: number;
}

/**
 * Filter concept-offertes uit een lijst — concepten (auto-save) tellen
 * niet mee in pipeline-KPI's.
 */
export function filterConceptenUit<T extends { status: string }>(
  offertes: T[]
): T[] {
  return offertes.filter((o) => o.status !== "concept");
}

/**
 * Cumulatieve sales-funnel vanaf voorcalculatie (concepten uitgesloten).
 * Elke stage telt alles wat die stage bereikt heeft of verder is.
 */
export function berekenPipelineFunnel(
  counts: PipelineStatusCounts
): PipelineFunnel {
  const afgehandeld = counts.geaccepteerd + counts.afgewezen;
  const verzonden = counts.verzonden + afgehandeld;
  const voorcalculatie = counts.voorcalculatie + verzonden;

  return {
    voorcalculatie,
    verzonden,
    afgehandeld,
    geaccepteerd: counts.geaccepteerd,
  };
}

function pct(teller: number, noemer: number): number {
  return noemer > 0 ? Math.round((teller / noemer) * 100) : 0;
}

/**
 * Conversieratio's tussen de funnel-stages (concepten uitgesloten).
 */
export function berekenConversionRates(
  funnel: PipelineFunnel
): PipelineConversionRates {
  return {
    voorcalculatieToVerzonden: pct(funnel.verzonden, funnel.voorcalculatie),
    verzondenToAfgehandeld: pct(funnel.afgehandeld, funnel.verzonden),
    afgehandeldToWon: pct(funnel.geaccepteerd, funnel.afgehandeld),
    overallConversion: pct(funnel.geaccepteerd, funnel.voorcalculatie),
  };
}
