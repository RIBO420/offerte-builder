/**
 * Analytics-barrel — bevat BEWUST alleen de lichte componenten en de
 * dynamic-varianten (optimize O4).
 *
 * De statische chart-componenten (OfferteTrendChart, RevenueChart, …)
 * importeren recharts (~200 KB) statisch. Toen de barrel die náást de
 * Dynamic*-varianten re-exporteerde, kon recharts alsnog in de eerste
 * chunk van elke consument belanden. Statische chart-exports hier dus niet
 * terugzetten; wie een statische variant echt nodig heeft importeert hem
 * rechtstreeks uit het bronbestand.
 */

// Static exports (lightweight components)
export { EnhancedDateFilter } from "./enhanced-date-filter";
export type { DateRangePreset } from "./enhanced-date-filter";
export { ComparisonIndicator, ComparisonArrow, ComparisonDisplay } from "./comparison-indicator";

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
  // New dynamic components
  DynamicCalculatieVergelijking,
  DynamicMedewerkerProductiviteit,
  DynamicProjectPrestaties,
  DynamicFinancieelOverzicht,
} from "./dynamic";
