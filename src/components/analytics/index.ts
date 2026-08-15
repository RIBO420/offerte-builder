/**
 * Analytics-barrel — BEWUST zonder statische chart-exports (WS8/optimize O4).
 *
 * De recharts-componenten (`maand-staven-chart`, `lange-trend-chart`)
 * importeren recharts statisch. Zodra deze barrel ze re-exporteert, kan
 * recharts (~200 KB) alsnog in de eerste chunk van elke consument belanden.
 * Wie ze nodig heeft neemt de `Dynamic*`-variant uit `./dynamic`.
 *
 * Wat hier wél staat is licht: de horizontale-staaf-primitieven (pure CSS) en
 * de nacalculatie-sectie van de onderhoudsbeurten.
 */

export { RangStaven, StapelBalk } from "./staafwerk";
export type { StaafRegel, StapelDeel } from "./staafwerk";
export { BEWIJS_HOOGTE } from "./maten";
export { BeurtNacalculatie } from "./beurt-nacalculatie";

// Code-splitting: alleen deze twee bevatten recharts.
export { DynamicMaandStavenChart, DynamicLangeTrendChart } from "./dynamic";
