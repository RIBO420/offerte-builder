# Rapportage-inventaris — feitenbasis voor het herontwerp

Stand: 15 aug 2026, branch `main`. Alle paden relatief aan de projectmap.

## 1. Padenkaart

Er zijn **geen subroutes**: de hele rapportage-sectie is één client-page met 8 tabs.

| Bestand | Rol |
|---|---|
| `src/app/(dashboard)/rapportages/page.tsx` (491 r.) | Enige route. `"use client"`, `RequireRole ["directie","projectleider"]` (r. 485), 8 tabs via shadcn `Tabs` (r. 238–421) |
| `src/app/(dashboard)/rapportages/loading.tsx` (55 r.) | Route-skeleton (header + `StatsGridSkeleton`) |

Tabs (r. 240–256): `overzicht` · `pipeline` · `omzet` · `klanten` · `marges` · `calculatie` · `medewerkers` · `projecten`. Tab-state staat in de URL (`?tab=…`) via `useTabState` (`src/hooks/use-tab-state.ts`), dus deep-linkbaar.

Verwijzingen naar `/rapportages`:
- `src/components/app-sidebar.tsx:92` — sidebar-item "Rapportages" (BarChart3-icoon)
- `src/components/command-palette.tsx:186–191` — command-palette navigatie
- `src/components/providers/shortcuts-provider.tsx:231` — sneltoets-navigatie
- `src/hooks/use-breadcrumb.ts:18` — breadcrumb-label
- `src/components/dashboard/financieel-grid.tsx:180` — alleen commentaar ("Uren leeft op /uren en /rapportages")

## 2. Per tab: componenten, data, berekening

Alle data komt uit **één Convex-query**: `api.analytics.getAnalyticsData` via `src/hooks/use-analytics.ts:63` (1 query voor de hele pagina). Uitzondering: het Calculatie-tab laadt er 2 bij. Componenten staan alle in `src/components/analytics/` en worden lazy geladen via `dynamic.tsx` (zie §6).

| Tab | Componenten (regel in page.tsx) | Data |
|---|---|---|
| (boven tabs) | `KpiCards` (r. 220), `SecondaryKpiCards` (r. 229) | echt (`kpis`) — maar sparklines zijn **verzonnen** (zie §3) |
| overzicht | `OfferteTrendChart`, `RevenueChart`, `ScopeMarginChart` (r. 268–275) | echt |
| pipeline | `PipelineFunnelChart`, `TopKlantenTable` (r. 289–294) | echt |
| omzet | `TrendForecastChart`, `RevenueChart` (r. 307–314) | echt |
| klanten | `TopKlantenTable` (r. 327) | echt (zelfde tabel als pipeline-tab) |
| marges | `ScopeProfitabilityChart`, `ScopeMarginChart` (r. 340–344) | echt (ScopeMarginChart ook op overzicht-tab) |
| calculatie | `CalculatieVergelijking` (r. 357), `NormuurSuggesties` (r. 365), `BeurtNacalculatie` (r. 366) | CalculatieVergelijking: **sample-data** (`sampleCalculatieData`, r. 53–60, incl. hardcoded `accuracyScore={78}`). De andere twee: echt (`api.beurtNacalculatie.getBeurtNacalculatie` / `getNormuurSuggesties`) |
| medewerkers | `MedewerkerProductiviteit` (r. 379) | **volledig sample** (`sampleMedewerkerData` r. 62–68, `totaalUren={760}`) |
| projecten | `ProjectPrestaties` (r. 396), `FinancieelOverzicht` (r. 405) | **volledig sample** (r. 70–93; alle props hardcoded, incl. `totaleOmzet={336000}`) |

Sample-data draagt zelfs een comment "in production, this would come from the API" (r. 52). Server-side bestaan de echte queries wél al (§5) maar **niemand roept ze aan**.

Verder client-side: Excel-export (`src/lib/excel-export.ts`, lazy import exceljs, r. 39–50), framer-motion-animaties per tab, en de "vergelijk met vorige periode"-toggle (`comparisonEnabled`, r. 98) die alleen **hardcoded 'previous'-waarden** in-/uitschakelt (r. 360, 382, 399–415).

### Periode-filter: half aangesloten
`EnhancedDateFilter` (`src/components/analytics/enhanced-date-filter.tsx`, 290 r.) toont 10 presets + custom range, maar `page.tsx:130–147` mapt ze **lossy** terug naar de 4 presets die `use-analytics.ts` kent (`deze-maand`/`dit-kwartaal`/`dit-jaar`/`alles`): "vorige-maand" → data van déze maand, "custom" → alles. `customDateRange` (r. 100) wordt in state gezet maar **nooit** aan de hook doorgegeven — `useAnalytics.setDateRange` bestaat maar wordt nergens gebruikt.

## 3. Grafiek-inventaris

Library: **recharts** overal (9 bestanden); sparklines zijn eigen SVG (`src/components/ui/sparkline.tsx`). Kleuren: sinds WS10 (commit `abe6159`) overal tokens `hsl(var(--chart-1..5))` uit `globals.css:300–304` (light) / 512–516 (dark); **geen ad-hoc hex meer in de componenten**. Wél ad-hoc hex in `page.tsx:79–83` (`sampleKostenBreakdown`: #10b981, #3b82f6, …) die als props de FinancieelOverzicht-donut in gaan.

| Component | Type | Data |
|---|---|---|
| `offerte-trend-chart.tsx:175` | AreaChart (aanleg/onderhoud gestapeld, chart-1/2) | maandelijkseTrend |
| `revenue-chart.tsx:165` | BarChart (chart-4), toggle maand/kwartaal | maandelijkseTrend + kwartaalOmzet |
| `scope-margin-chart.tsx:189` | BarChart per scope, kleur naar margeklasse (chart-1/2/4/5) | scopeMarges |
| `scope-profitability-chart.tsx:184,262` | ComposedChart horizontaal + tweede BarChart | scopeMarges |
| `pipeline-funnel-chart.tsx` | **geen recharts** — CSS-balken funnel | pipelineFunnel + conversionRates |
| `trend-forecast-chart.tsx:162` | ComposedChart: lijnen + moving average + 3-maands forecast (chart-1..5) | maandelijkseTrend + forecast |
| `calculatie-vergelijking.tsx:281` | BarChart voor/nacalculatie (chart-1/2) + tabellen | sample |
| `medewerker-productiviteit.tsx:317` | BarChart uren per medewerker + ranglijst | sample |
| `financieel-overzicht.tsx:403,~480` | PieChart (donut, props-kleuren = hex) + BarChart + samenvattingstabel | sample |
| `kpi-cards.tsx:145–279` | 4× Sparkline | **`generateTrendData()` (r. 24–46): seeded-random nepdata** — de trendlijntjes onder de KPI's tonen geen echte historie |
| `top-klanten-table.tsx` | tabel (geen grafiek) | topKlanten |

Dubbelingen: `RevenueChart` op 2 tabs; `ScopeMarginChart` op 2 tabs; `TopKlantenTable` op 2 tabs; omzet-per-maand zit in OfferteTrendChart, RevenueChart, TrendForecastChart én (sample) FinancieelOverzicht.

## 4. Metrics-inventaris

Uit `getAnalyticsData` (return `convex/analytics.ts:408–440`): `winRate`, `gemiddeldeWaarde`, `totaleOmzet` (geaccepteerd, incl. btw), `totaalOffertes`, `geaccepteerd/afgewezenCount`, `avgCycleTime` (created→updated, r. 126–132), `avgResponseTime` (verzonden→updated), `repeatCustomerPercentage/-Count`, `totalCustomers`, `overallConversion`. KpiCards toont de eerste 4; SecondaryKpiCards de cycle/response/repeat/customers-set.

**Overlap met /dashboard**: `convex/dashboard.ts:getAdminDashboardData` berekent apart óók omzet, pipeline-stats (excl. concepten, net als analytics r. 113–121) en kwartaaltrends; `FinancieelGrid` (dashboard) toont Totale Omzet als heldcijfer + openstaand/gefactureerd — Totale Omzet en pipeline-tellingen staan dus op beide plekken, uit **twee losse queryimplementaties**. De dashboard-sparkline onder de omzetkaart is eveneens hardcoded (`financieel-grid.tsx:165`: `data={[10,15,12,…]}`). WS3a schrapte al KPI's op het dashboard juist wegens dubbeling met /rapportages (comment `financieel-grid.tsx:177–180`).

Let op: nepgetallen in de UI die echt lijken: accuracyScore 78, onTime 85%, budgetAccuracy 92%, winstmarge 25,9% — allemaal literals in `page.tsx`.

## 5. Datamodel & server-side aggregatie (`convex/analytics.ts`, 1050 r.)

- `getAnalyticsData` (r. 68): leest **alleen `offertes`** (`by_user`, volledige `.collect()`, datumfilter daarna in JS, r. 77–90). Alle aggregatie server-side: maand/kwartaal-buckets, scope-marges (naïef: omzet/marge gedeeld door aantal scopes, r. 231–236), topklanten, funnel (`convex/lib/pipelineKpis.ts`, concepten uitgesloten), lineaire-regressie-forecast (r. 39–55). Periode = `startDate/endDate` timestamps vanuit de client (4 presets, §2).
- `getVoorcalculatieNacalculatieVergelijking` (r. 451): leest `projecten`, `nacalculaties`, voorcalculaties via `convex/lib/voorcalculatieLookup.ts`, `offertes`; berekent variantie per project/scope + accuracy + `comparePreviousPeriod`. **Ongebruikt** — dit is precies wat het Calculatie-tab met sample-data nabootst.
- `getFinancieelOverzicht` (r. 771): leest `offertes`, `projecten`, `instellingen`. **Ongebruikt** — dit is wat het Projecten-tab nabootst.
- `convex/beurtNacalculatie.ts` (wél gebruikt, Calculatie-tab): leest `instellingen`, `projecten`, `urenSegmenten` — de enige plek waar echte úrendata in rapportages komt.

Tabellen die rapportages nu echt voeden: `offertes`, `projecten`, `urenSegmenten`, `instellingen` (+ `nacalculaties`/voorcalculaties zodra de ongebruikte queries worden aangesloten). Facturen voeden alléén het dashboard, niet /rapportages.

## 6. Eerdere optimalisatie (WS8 — niet terugdraaien)

Commit `844eebc` ("WS8: barrel-lekken … O1-O5, O13", 14 aug):
- `src/components/analytics/index.ts` exporteert **bewust géén** statische chart-componenten meer — alleen `EnhancedDateFilter`, `ComparisonIndicator` en de `Dynamic*`-varianten. Waarschuwingscomment staat er bovenaan.
- `page.tsx:14–16` importeert daarom rechtstreeks uit `./dynamic` en `./enhanced-date-filter`, niet uit de barrel (recharts ~200 KB anders alsnog in de eerste chunk).
- `package.json` kreeg `"sideEffects": ["*.css"]` zodat tree-shaking van barrels betrouwbaar is.
- `src/components/analytics/dynamic.tsx`: alle 13 componenten via `next/dynamic` met `ssr:false` + 4 skeleton-varianten. Exceljs wordt pas bij export-klik geladen (`page.tsx:39–50`).

Regels voor het herontwerp: nieuwe chartcomponenten altijd via `dynamic.tsx` toevoegen; nooit statische recharts-exports terugzetten in `index.ts`; recharts niet in de eerste chunk importeren. (De −828 KB was WS8-breed: ~500 KB react-pdf op offertedetail + ~200 KB recharts hier + rest.)

## 7. Herbruikbaar vs. sloopbaar

**Herbruikbaar (generiek, props-gedreven, op tokens):**
- Hele Convex-laag: `getAnalyticsData` + de twee ongebruikte queries — aansluiten i.p.v. herbouwen.
- `dynamic.tsx`-patroon + skeletons; `use-tab-state`; `use-analytics` (mits presets uitgebreid).
- `Sparkline` (`src/components/ui/sparkline.tsx`) — mits met echte data gevoed.
- `ComparisonIndicator` (204 r., ongebruikt potentieel); `TopKlantenTable`; `EnhancedDateFilter`-UI (backend-mapping moet af); excel-export; `PipelineFunnelChart` (licht, geen recharts).
- Chartkleuren-tokens `--chart-1..5` (WS10).

**Verweven met het oude ontwerp / sloopkandidaat:**
- `KpiCards` (292 r.): glow/glassmorphism/gradient-styling (r. 76–90) botst met Loof & Leem; nep-sparklinegenerator moet sowieso weg.
- De drie sample-tabs (`CalculatieVergelijking`, `MedewerkerProductiviteit`, `ProjectPrestaties`, `FinancieelOverzicht`, samen ~1950 r.): UI is bruikbaar als referentie maar toont fictie; óf aansluiten op de bestaande queries, óf schrappen.
- 170 regels sample-data + hex-kleuren in `page.tsx` (r. 52–93).
- Dubbel gerenderde charts over tabs heen (RevenueChart/ScopeMarginChart/TopKlantenTable ×2) — herontwerpkans.
- Tab-animatie-boilerplate (framer-motion per tab, ~15 r. per tab) en de empty-state met pulserende glow (r. 424–476).
