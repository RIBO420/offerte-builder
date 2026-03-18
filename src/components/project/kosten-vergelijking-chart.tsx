"use client";

import dynamic from "next/dynamic";
import { Skeleton } from "@/components/ui/skeleton";

function ChartSkeleton() {
  return (
    <div className="w-full h-[300px] flex items-center justify-center">
      <Skeleton className="w-full h-full" />
    </div>
  );
}

export const KostenVergelijkingChart = dynamic(
  () =>
    import("./kosten-vergelijking-chart-content").then((mod) => ({
      default: mod.KostenVergelijkingChartContent,
    })),
  { ssr: false, loading: () => <ChartSkeleton /> }
);

export const KostenAfwijkingChart = dynamic(
  () =>
    import("./kosten-vergelijking-chart-content").then((mod) => ({
      default: mod.KostenAfwijkingChartContent,
    })),
  { ssr: false, loading: () => <ChartSkeleton /> }
);

export default KostenVergelijkingChart;
