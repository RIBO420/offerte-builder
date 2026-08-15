# Masterplan: dashboard als dagstaat (bento-herontwerp)

Goedgekeurd 15 aug 2026: Ricardo wil "Aandacht nodig" en "Mijn taken" naast
elkaar op brede schermen, een bento-grid voor de hele pagina, volledig
responsive met zo min mogelijk scrollen — en gaf volledige ontwerpvrijheid
("je mag hem zelfs helemaal redesignen"). Uitvoering op Opus 5.

## Diagnose (gemeten op 1680×1000, 15 aug)

Alles staat in één kolom van volle breedte: "Aandacht nodig" en "Mijn taken"
zijn lijstjes van ~5 korte regels uitgesmeerd over ~1500px. De pagina is
2205px hoog bij een viewport van 1000px — ruim twee schermen scrollen. Alleen
de drie kleine KPI-kaarten en Pipeline+Conversie staan naast elkaar. De
omzet-sparkline is verzonnen trenddata (rapportage-inventaris) en moet weg.

## Concept: de dagstaat

Het dashboard is de ochtendbriefing van de hovenier: in één oogopslag "wat
vraagt vandaag mijn aandacht, hoe staat de zaak ervoor, wat loopt er". Drie
ideeën boven op de bento:

1. **De kop is de samenvatting, geen versiering.** "Goedemiddag, Ricardo"
   wordt één compacte regel waarin de begroeting en de staat van de zaak
   samenvallen, bv. "Goedemiddag, Ricardo — 3 dingen vragen je aandacht, 2
   projecten lopen op schema." (Fraunces, maar kleiner dan nu; de tellers
   "15 offertes · 7 projecten" gaan erin op). De vrijgekomen hoogte gaat naar
   de werkstrook.
2. **Werkstrook bovenaan, cijfers daarna.** Actie gaat vóór informatie: wat
   je moet dóén staat boven wat je moet wéten.
3. **Eén blok = één vraag** (zelfde principe als de nieuwe rapportages):
   elk bento-blok beantwoordt één vraag en klikt door naar de lijst die het
   cijfer bewijst.

## Bento-indeling (12 kolommen, ≥1440px)

| Strook | Indeling |
|---|---|
| Werkstrook | **Aandacht nodig** (7 kol, oranje anker, grootste vlak) naast **Mijn taken** (5 kol) |
| Cijferstrook | **Omzet** (5, enige grote Fraunces-cijfer) · Openstaand (3) · Gefactureerd dit Q (2) · Actieve projecten (2) |
| Pipeline | **Offerte Pipeline** (8) naast Conversie (4) |
| Werk | Lopend werk (6) naast Laatste offertes (6) |
| Voetstrook | Vloot & Materieel als één regel (12) — blijft zoals hij is |

Doel: werkstrook + cijferstrook + pipeline boven de vouw op 1680×1000;
paginahoogte ~halveren.

## Regels

- **Hiërarchie, geen egaal muurtje.** Niet alle cellen even zwaar (les van
  het klantdossier): Aandacht nodig houdt het oranje anker en het grootste
  vlak; Omzet is het enige heldcijfer; de rest bewust stiller. Gebruik de
  bestaande gewichtsklassen-denkwijze (`--surface-primair` voor de
  werkstrook, rustiger vlakken voor naslag).
- **Container queries, geen viewport-breakpoints** (bestaand patroon,
  `@container` zoals SectiePaneel): elk blok past zich aan zijn cél aan.
  Lijstblokken cappen op N regels met "alle →"-doorklik; een hoger blok mag
  meer regels tonen.
- **Responsive zonder amputatie**: mobiel één kolom in prioriteitsvolgorde
  (werkstrook eerst), tablet twee kolommen, desktop de bento. Alle data
  blijft overal bereikbaar — indikken, niet verstoppen. Nooit zijwaarts
  scrollen.
- **Echte cijfers.** De verzonnen omzet-sparkline verdwijnt (dit dashboard-
  deel hoort bij DEZE werkstroom, niet bij de rapportage-agent). Zodra de
  gedeelde cijferlaag van de rapportage-datastroom er is, consumeert het
  dashboard dezelfde queries — dashboard en rapportage mogen nooit
  verschillende omzetten tonen.
- **Choreografie**: shell-silhouet blijft (geen zwart laadgat), skeletons met
  exacte eindafmetingen, één gestaggerde reveal bij binnenkomst (~80 ms,
  ease-out-quint), verder rust.
- Loof & Leem-tokens, Fraunces alleen kop + heldcijfer, statuskleuren via de
  ene statusbron.

## Afbakening

Alleen het dashboard (`(dashboard)/dashboard/`-route + dashboardcomponenten).
NIET aan /rapportages of `src/components/analytics/` komen (daar werkt een
andere agent); wel dezelfde query-contracten consumeren. Sidebar en andere
modules onaangeroerd.

## Gates

Typecheck, lint, volledige testsuite; ingelogde schouw op 1680/1280/tablet/
mobiel met gemeten paginahoogte (doel ≤ ~1200px op 1680×1000) en nul
horizontale scroll; geen verzonnen data meer op de pagina.
