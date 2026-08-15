# Masterplan: rapportages als antwoordverhaal

Consolidatie van `rapportage-inventaris.md`, `rapportage-schouw.md` en
`rapportage-patronen.md` (15 aug 2026). Uitvoering na goedkeuring, bouwagents
op Opus 5.

## Diagnose in één alinea

/rapportages is één pagina met 8 tabs en ±15 grafieken, geordend op datasoort
in plaats van op vragen. Drie tabs draaien (deels) op hardcoded sample-data
(nep-"winstmarge 25,9%", €336.000 naast echte €50.531), de KPI-sparklines zijn
verzonnen (`generateTrendData`, wijzen altijd omhoog), de token-grafieken
renderen zwart (`hsl(var(--chart-N))` om OKLCH-tokens = ongeldige CSS), het
periodefilter mapt 11 opties lossy op 4 en "Vorig jaar" toont dezelfde cijfers
als "Dit jaar", en drie componenten staan exact dubbel. De échte queries
(`getVoorcalculatieNacalculatieVergelijking`, `getFinancieelOverzicht`) bestaan
en worden nergens gebruikt.

## Het ontwerp: één scrollverhaal, vier vragen

De 8 tabs verdwijnen. Eén pagina met sticky ankernavigatie en vier
vraagsecties, elk een **antwoordblok**: een geschreven antwoordzin, één groot
Fraunces-heldcijfer, hooguit één grafiek als bewijs, en een doorklik naar de
voorgefilterde bestaande lijstpagina (cijfers verifieerbaar = vertrouwen).

1. **Hoe loopt deze maand/dit seizoen?** — omzet & gefactureerd, t.o.v. vorige
   periode én vorig seizoen (hoveniers denken in seizoenen: voorjaar vs.
   voorjaar in de periodekiezer).
2. **Wat zit er in de pipeline?** — offertes per status, conversie, wat blijft
   liggen (doorklik: /offertes gefilterd).
3. **Waar blijft geld liggen?** — openstaande facturen, voor- vs. nacalculatie
   (progressive disclosure: normuur-suggesties als uitklap, gevoed door de
   bestaande ongebruikte queries).
4. **Wat is mijn beste werk?** — marge per scope, topklanten (doorklik naar
   klantdossiers).

## Regels

- **R1. Geen enkele verzonnen waarde.** Sloop de ±1950 regels sample-tabs,
  `generateTrendData` en alle nep-sparklines (ook de dashboard-omzetsparkline).
  Sectie zonder echte data → eerlijke lege staat met uitleg wanneer er wél data
  is.
- **R2. Eén cijferdefinitie.** De dubbele query-implementatie
  (convex/dashboard.ts naast analytics.ts) wordt samengevoegd; dashboard en
  rapportage tonen nooit meer verschillende omzetten.
- **R3. Grafiekdieet.** Drie vormen: horizontale staaf (ranglijsten), verticale
  staaf (maanden), lijn (lange trends). Geen pie/funnel/gauge/sparkline-
  decoratie. Van ±15 naar ±6 chartcomponenten. Labels in mensentaal (geen
  "water_elektra").
- **R4. Kleuren gefixt en op dieet.** `hsl(var())` → `var()` (de
  zwarte-grafieken-bug, 9 bestanden); Loof-groen als hoofdreeks, terracotta
  uitsluitend voor aandacht/verlies, verder getinte neutralen via shadcn
  `ChartContainer`.
- **R5. Eerlijke periodekiezer.** Alleen presets die echt werken + de
  seizoensvergelijking; de vergelijk-toggle vergelijkt echt of verdwijnt.
- **R6. Choreografie.** Skeletons met exacte eindafmetingen (nul CLS bij
  recharts-hydratie), gestaggerde sectie-fade (~80 ms, ease-out-quint),
  cross-fade bij periodewissel. WS8 blijft staan: charts uitsluitend via
  `dynamic.tsx` (ssr:false), geen statische chart-exports in
  `analytics/index.ts`.
- **R7. Maandrapport-knop.** "Download maandrapport": dezelfde vier secties als
  opgemaakte print/PDF-verhaalversie (Fraunces, groot cijferwerk) — geen aparte
  view, klaar om naar de boekhouder te sturen.

## Hergebruik / sloop

Herbruikbaar: hele Convex-laag, dynamic/skeleton-patroon, EnhancedDateFilter-UI
(uitgekleed), tokens. Sloop: KpiCards-glassmorphism, sample-tab-componenten,
tab-animatie-boilerplate, duplicaat-renders (RevenueChart/ScopeMarginChart/
TopKlantenTable 2×).

## Gates

Typecheck, lint, alle tests; ingelogde schouw: geen zwarte grafieken, geen
tegenstrijdige cijfers tussen dashboard en rapportage, geen verzonnen waarde
meer vindbaar; CLS visueel nul bij laden; bundlecheck dat recharts niet in de
eerste chunk terugkeert.
