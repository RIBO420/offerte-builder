// Static exports (lightweight components)
export { AnalyticsDateFilter } from "./analytics-date-filter";

// Regular exports for direct imports when needed
export { KpiCards } from "./kpi-cards";
export { SecondaryKpiCards } from "./secondary-kpi-cards";
export { OfferteTrendChart } from "./offerte-trend-chart";
export { RevenueChart } from "./revenue-chart";
export { ScopeMarginChart } from "./scope-margin-chart";
export { ScopeProfitabilityChart } from "./scope-profitability-chart";
export { TopKlantenTable } from "./top-klanten-table";
export { PipelineFunnelChart } from "./pipeline-funnel-chart";
export { TrendForecastChart } from "./trend-forecast-chart";

// Dynamic exports for code-splitting (use these for better bundle size)
export {
  DynamicKpiCards,
  DynamicSecondaryKpiCards,
  DynamicOfferteTrendChart,
  DynamicRevenueChart,
  DynamicScopeMarginChart,
  DynamicScopeProfitabilityChart,
  DynamicTopKlantenTable,
  DynamicPipelineFunnelChart,
  DynamicTrendForecastChart,
} from "./dynamic";
