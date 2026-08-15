"use client";

/**
 * WS8 — recharts komt uitsluitend hierlangs binnen.
 *
 * Recharts is ~200 KB. Elke chart-component die je ergens statisch importeert
 * trekt dat de eerste chunk van die pagina in. Daarom: geen enkele statische
 * chart-export in `index.ts`, en consumenten importeren de `Dynamic*`-variant
 * uit dít bestand.
 *
 * Na het herontwerp zijn er nog twéé recharts-componenten over (van de vijftien
 * die er stonden): staven per maand en één lijn voor lange reeksen. De derde
 * vorm van het grafiekdieet — de horizontale ranglijst — staat in
 * `staafwerk.tsx` en heeft geen recharts nodig; die mag dus gewoon statisch.
 *
 * De `loading`-skeletons hebben exact `BEWIJS_HOOGTE`, zodat er bij hydratie
 * niets verschuift (R6).
 */

import dynamic from "next/dynamic";
import { Skeleton } from "@/components/ui/skeleton";
import { BEWIJS_HOOGTE } from "./maten";

function GrafiekSkelet() {
  return (
    <Skeleton
      className="w-full"
      style={{ height: BEWIJS_HOOGTE }}
      aria-label="Grafiek laden"
    />
  );
}

export const DynamicMaandStavenChart = dynamic(
  () => import("./maand-staven-chart").then((mod) => mod.MaandStavenChart),
  { loading: () => <GrafiekSkelet />, ssr: false }
);

export const DynamicLangeTrendChart = dynamic(
  () => import("./lange-trend-chart").then((mod) => mod.LangeTrendChart),
  { loading: () => <GrafiekSkelet />, ssr: false }
);
