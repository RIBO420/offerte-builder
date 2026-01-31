"use client";

import dynamic from "next/dynamic";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader } from "@/components/ui/card";

// Loading skeleton for chart components
function ChartSkeleton() {
  return (
    <Card>
      <CardHeader>
        <Skeleton className="h-5 w-32" />
        <Skeleton className="h-4 w-48 mt-1" />
      </CardHeader>
      <CardContent>
        <Skeleton className="h-[300px] w-full" />
      </CardContent>
    </Card>
  );
}

// Loading skeleton for KPI cards
function KpiSkeleton() {
  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      {Array.from({ length: 4 }).map((_, i) => (
        <Card key={i}>
          <CardHeader className="pb-2">
            <Skeleton className="h-4 w-24" />
          </CardHeader>
          <CardContent>
            <Skeleton className="h-8 w-16 mb-2" />
            <Skeleton className="h-3 w-32" />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

// Loading skeleton for table
function TableSkeleton() {
  return (
    <Card>
      <CardHeader>
        <Skeleton className="h-5 w-32" />
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

// Dynamically import chart components with loading states
// These use recharts which is a large dependency (~200KB)
export const DynamicOfferteTrendChart = dynamic(
  () => import("./offerte-trend-chart").then((mod) => mod.OfferteTrendChart),
  {
    loading: () => <ChartSkeleton />,
    ssr: false,
  }
);

export const DynamicRevenueChart = dynamic(
  () => import("./revenue-chart").then((mod) => mod.RevenueChart),
  {
    loading: () => <ChartSkeleton />,
    ssr: false,
  }
);

export const DynamicScopeMarginChart = dynamic(
  () => import("./scope-margin-chart").then((mod) => mod.ScopeMarginChart),
  {
    loading: () => <ChartSkeleton />,
    ssr: false,
  }
);

export const DynamicScopeProfitabilityChart = dynamic(
  () => import("./scope-profitability-chart").then((mod) => mod.ScopeProfitabilityChart),
  {
    loading: () => <ChartSkeleton />,
    ssr: false,
  }
);

export const DynamicPipelineFunnelChart = dynamic(
  () => import("./pipeline-funnel-chart").then((mod) => mod.PipelineFunnelChart),
  {
    loading: () => <ChartSkeleton />,
    ssr: false,
  }
);

export const DynamicTrendForecastChart = dynamic(
  () => import("./trend-forecast-chart").then((mod) => mod.TrendForecastChart),
  {
    loading: () => <ChartSkeleton />,
    ssr: false,
  }
);

// KPI cards also use framer-motion animations
export const DynamicKpiCards = dynamic(
  () => import("./kpi-cards").then((mod) => mod.KpiCards),
  {
    loading: () => <KpiSkeleton />,
    ssr: false,
  }
);

export const DynamicSecondaryKpiCards = dynamic(
  () => import("./secondary-kpi-cards").then((mod) => mod.SecondaryKpiCards),
  {
    loading: () => <KpiSkeleton />,
    ssr: false,
  }
);

// Table component
export const DynamicTopKlantenTable = dynamic(
  () => import("./top-klanten-table").then((mod) => mod.TopKlantenTable),
  {
    loading: () => <TableSkeleton />,
    ssr: false,
  }
);
