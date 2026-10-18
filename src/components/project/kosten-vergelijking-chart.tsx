"use client";

import dynamic from "next/dynamic";
import { Skeleton } from "@/components/ui/skeleton";

/**
 * Placeholder in de maat van de echte grafiek: zelfde figure-opbouw (kop +
 * plot van `hoogte` px), zodat de pagina niet verspringt als hij laadt.
 */
function ChartSkeleton({ hoogte }: { hoogte: number }) {
  return (
    <div className="flex flex-col gap-2 px-3 py-3" aria-hidden="true">
      <Skeleton className="h-5 w-40" />
      <Skeleton className="w-full" style={{ height: hoogte }} />
    </div>
  );
}

export const KostenVergelijkingChart = dynamic(
  () =>
    import("./kosten-vergelijking-chart-content").then((mod) => ({
      default: mod.KostenVergelijkingChartContent,
    })),
  { ssr: false, loading: () => <ChartSkeleton hoogte={300} /> }
);

export const KostenAfwijkingChart = dynamic(
  () =>
    import("./kosten-vergelijking-chart-content").then((mod) => ({
      default: mod.KostenAfwijkingChartContent,
    })),
  { ssr: false, loading: () => <ChartSkeleton hoogte={220} /> }
);

export default KostenVergelijkingChart;
