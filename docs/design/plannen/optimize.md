# Optimize-plan — Top Tuinen OS (fase 1: alleen lezen)

Datum: 14 aug 2026 · Schouw: dev-server http://localhost:3000 (Turbopack, dus ruwe laadtijden genegeerd; alleen structurele zaken). Bekeken: /dashboard, /klanten, /offertes, /projecten, projectdetail (Beregening Salden), /configurator/gazon.

---

## 1. Bevindingen met bewijs

### B1 — Auth-waterval blokkeert élke eerste render (hoog)
`src/app/(dashboard)/layout.tsx` rendert **niets behalve een spinner** zolang
`useConvexAuth()` laadt, `isAuthenticated` false is óf `users.current` nog niet binnen is:

```ts
if (isLoading || !isAuthenticated || currentUser === undefined || isKlant) {
  return (<div …><Loader2 …/></div>);
}
```

Dat is een seriële keten: Clerk JS laden → token → Convex WebSocket-auth → `users.current`-query → dán pas sidebar + pagina. In de browser zag ik daardoor bij elke harde load/naviagtie eerst een volledig zwart/leeg contentvlak (screenshots /dashboard, /projecten: 3–7 s leeg in dev; in prod korter maar de keten blijft serieel). De sidebar en paginaskeletten hangen onnodig achter deze gate — middleware garandeert al dat de gebruiker ingelogd is (staat er als comment zelf bij).

### B2 — Drie permanente zware subscriptions op élke stafpagina (hoog)
`usePrefetchAllCommonData()` in `DashboardShell` (`src/hooks/use-prefetch.ts` r74–94) draait op elke stafpagina, permanent:
- `api.offertes.getFullDashboardData`
- `api.berekeningen.getCalculationData` (normuren + correctiefactoren + producten + instellingen)
- `api.klanten.listWithRecent` (volledige klantenlijst, prod ±300 records)

Convex `useQuery` is een **live subscription**, geen eenmalige prefetch: elke mutatie op klanten/offertes/producten pusht een verse payload naar élk open scherm, ook op pagina's die er niets mee doen (bv. /uren, /chat). Dit is structureel WebSocket- en re-renderverkeer.

### B3 — PDF-barrel lekt @react-pdf/renderer (~500 KB) naar offertedetail (hoog)
`src/app/(dashboard)/offertes/[id]/components/offerte-header.tsx:45`:

```ts
import { DynamicPDFDownloadButton as PDFDownloadButton } from "@/components/pdf";
```

De barrel `src/components/pdf/index.ts` re-exporteert náást de dynamic-variant ook statisch `OffertePDF`, `ContractPDF`, `FactuurPDF` én `PDFDownloadButton` — en die laatste importeert `pdf` uit `@react-pdf/renderer` statisch (r4) plus `PdfPreviewModal` (die óók statisch `pdf` importeert). `package.json` heeft **geen `"sideEffects": false`**, dus de bundler mag deze re-exports niet wegsnijden: de hele react-pdf-keten komt mee in de offertedetail-bundle, ondanks de naam "Dynamic". In dev laadt Turbopack ze hoe dan ook allemaal.

### B4 — Analytics-barrel: zelfde lek richting recharts (middel)
`src/app/(dashboard)/rapportages/page.tsx` importeert netjes de `Dynamic*`-varianten, maar **via de barrel** `src/components/analytics/index.ts`, die daarnaast alle statische recharts-componenten re-exporteert (`OfferteTrendChart`, `RevenueChart`, …, `FinancieelOverzicht`). Zonder `sideEffects: false` kan recharts (~200 KB min) zo alsnog in de eerste rapportages-chunk belanden en is de code-splitting deels theater. (Positief: dashboard zelf laadt géén recharts — genetwerkcheck bevestigde dat.)

### B5 — Animaties op layout-properties i.p.v. transform/opacity (middel)
Gemeten vindplaatsen (elke frame een reflow van onderliggende content):
- `src/app/(dashboard)/offertes/page.tsx:371` — selectiebalk `animate={{ height: "auto" }}` / `exit height: 0` (duwt de hele offertetabel elke frame omlaag/omhoog)
- `src/app/(dashboard)/archief/page.tsx:206` — idem `height: "auto"`
- `src/components/wagenpark/brandstof-form.tsx:298` en `kilometer-log.tsx:253` — idem
- `src/app/(dashboard)/projecten/[id]/factuur/components/workflow-step-indicator.tsx:74` — voortgang via `animate={{ width: "0→100%" }}`
- `src/app/(dashboard)/projecten/[id]/nacalculatie/page.tsx:387` — budgetbalk via `width`

### B6 — Klantenlijst: filter op elke toetsaanslag + ongememoizeerde rijen (middel)
`src/app/(dashboard)/klanten/page.tsx`: er ís een `debouncedSearchTerm` (r196), maar die wordt alleen voor de URL gebruikt — `filteredKlanten` (r414) hangt aan de **rauwe** `searchTerm`, dus elke toetsaanslag filtert en her-rendert de volledige lijst. `ResponsiveTable` (`src/components/ui/responsive-table.tsx` r169–199) rendert rijen met een kale `data.map(...)` zonder gememoizeerd rijcomponent — bij ±300 klanten met badges/dropdowns per cel is dat per toetsaanslag veel React-werk. (De zoekindex zelf is wél netjes gememoizeerd.)

### B7 — Sidebar doet 4 losse count-subscriptions op elke pagina (laag/middel)
`src/components/app-sidebar.tsx` r211–229: `countActieveLeads`, `countKlanten`, `telOpenMeldingen`, `countWachtrij` als aparte `useQuery`'s (5 totaal in het bestand). Eén gebundelde `sidebarTellingen`-query = minder subscriptions en minder losse invalidaties.

### B8 — Twee fontbestanden gepreload maar ongebruikt (laag)
Console op élke pagina (dashboard, klanten, configurator):
`The resource …/797e433ab948586e-s.p.….woff2 was preloaded … but not used` + zelfde voor `caa3a2e1cccd8315-s.p.3b6cae6d.woff2`. Root layout laadt `Geist` én `Geist_Mono` (`src/app/layout.tsx` r15–23) altijd; minimaal één (Mono + een extra Geist-variant) wordt boven de vouw niet gebruikt. Onnodige preload-bytes op het kritieke pad.

### B9 — Publieke configurator betaalt de volledige staf-stack (middel)
Op `/configurator/gazon` (publiek, klantgericht, waarschijnlijk vaak mobiel) verschijnt de Clerk-dev-warning in de console: de root layout wikkelt álles in `ClerkProvider` + `ConvexClientProvider` + Sentry + MotionProvider. De configurator laadt dus Clerk JS en meer terwijl er niets in te loggen valt.

### B10 — Dode webpack-config in next.config.ts (laag)
Next 16 bouwt standaard met Turbopack; het `webpack: (config) => …`-blok (`next.config.ts` r22–34, `resolve.fallback`) draait dan nooit. Verwarrend en dood gewicht; `optimizePackageImports` staat wél goed (lucide, framer-motion, date-fns, recharts).

### Wat al goed staat (niet aanraken)
- exceljs overal via `await import(...)` (excel-export.ts, export-utils.ts, prijsboek, rapportages)
- react-pdf in handlers via `await import("@react-pdf/renderer")` (contracten, factuur, huisstijl, portaal)
- framer-motion via `LazyMotion strict` + uitsluitend `m.` (0× `<motion.`)
- `next/font` (geen externe font-CDN), `next/image` voor logo/avatars, immutable cache-headers
- Sentry replay lazy-loaded (scheelt ~70 KB), klanten-zoekindex gememoizeerd

---

## 2. Concrete optimalisaties per bestand

| # | Bestand | Wijziging | Verwachte winst |
|---|---------|-----------|-----------------|
| O1 | `src/app/(dashboard)/offertes/[id]/components/offerte-header.tsx` | Import uit `@/components/pdf/dynamic` i.p.v. de barrel | ~500 KB uit de offertedetail-bundle |
| O2 | `package.json` | `"sideEffects": false` toevoegen (na check op CSS-imports: `globals.css` wordt in layout geïmporteerd → `"sideEffects": ["*.css"]`) | Tree-shaking van álle lokale barrels wordt betrouwbaar |
| O3 | `src/components/pdf/index.ts` | Barrel splitsen: statische PDF-exports naar `@/components/pdf/static` of consumenten direct laten importeren | Voorkomt herhaling van B3 |
| O4 | `src/app/(dashboard)/rapportages/page.tsx` + `src/components/analytics/index.ts` | `Dynamic*` direct uit `@/components/analytics/dynamic` importeren; barrel ontdoen van statische chart-re-exports (of O2 volstaat) | recharts (~200 KB) gegarandeerd uit de eerste rapportages-chunk |
| O5 | `src/app/(dashboard)/klanten/page.tsx` | `filteredKlanten` op `debouncedSearchTerm` laten hangen | Vloeiend typen in zoekveld bij 300 klanten |
| O6 | `src/components/ui/responsive-table.tsx` | Rijcomponent extraheren + `React.memo` (props: item, columns) | Alleen gewijzigde rijen her-renderen; merkbaar op alle grote tabellen (klanten, offertes, leveranciers, …) |
| O7 | `src/app/(dashboard)/projecten/[id]/factuur/components/workflow-step-indicator.tsx`, `…/nacalculatie/page.tsx` | Voortgangsbalken: `transform: scaleX()` met `transform-origin: left` i.p.v. `width` | GPU-composited i.p.v. reflow per frame |
| O8 | `src/app/(dashboard)/offertes/page.tsx:367-374`, `archief/page.tsx:204-208`, `src/components/wagenpark/brandstof-form.tsx`, `kilometer-log.tsx` | In/uitklap: `opacity` + `clip-path`/`scaleY`, of hoogte-animatie beperken tot de balk zelf met vaste hoogte (`h-8` is bekend) | Geen reflow van de tabel eronder tijdens animatie |
| O9 | `src/components/app-sidebar.tsx` + nieuwe `convex/sidebarTellingen.ts` | Eén query die alle badges teruggeeft | 4→1 subscriptions per pagina |
| O10 | `src/app/(dashboard)/layout.tsx` + `src/hooks/use-prefetch.ts` | Prefetch versoberen: `getCalculationData` en `klanten.listWithRecent` uit de layout; alleen prefetchen waar het aantoonbaar helpt (bv. `usePrefetchCalculationData` in de wizard-entry, klanten via hover-prefetch `usePrefetchOnInteraction` die al bestaat) | Fors minder live WebSocket-verkeer + re-renders op elke pagina |
| O11 | `src/app/(dashboard)/layout.tsx` | Shell (sidebar + skeleton) direct renderen; de auth/rol-gate alleen om de content of als redirect-effect, niet om de hele boom | Waargenomen "zwart scherm" bij elke harde load verdwijnt; snellere perceived load |
| O12 | `src/app/layout.tsx` | `Geist_Mono` controleren op werkelijk gebruik; zo niet: verwijderen, anders `preload: false` | 1–2 fontbestanden van het kritieke pad, console-warnings weg |
| O13 | `next.config.ts` | Dood `webpack`-blok verwijderen (of commentaar dat het alleen voor een webpack-fallback-build bestaat) | Hygiëne, geen schijnzekerheid |
| O14 | `src/app/(public)/configurator/layout.tsx` + `src/app/layout.tsx` | Onderzoeken: providers (Clerk) naar route-groep-layouts zodat de publieke configurator geen Clerk JS laadt. Let op: `ConvexProviderWithClerk` zit er mogelijk aan vast — dan minimaal documenteren waarom | Kleinere bundle op de enige echt publieke, klantgerichte pagina |

## 3. Prioritering

**Quick wins (klein risico, direct meetbaar):**
1. O1 + O2 + O3 — PDF-barrel-lek dichten (grootste bundelwinst, 3 kleine edits)
2. O4 — analytics-barrel (zelfde patroon)
3. O5 — debounce in klantenfilter (één dependency wijzigen)
4. O12 — fonts (config-regel)
5. O13 — dode config weg

**Middelgroot:**
6. O6 — rij-memoization ResponsiveTable (raakt alle tabellen; met tests)
7. O7 + O8 — animaties naar transform/opacity
8. O9 — sidebar-tellers bundelen (nieuwe Convex-query + test)

**Architectuur (apart oppakken, met Ricardo afstemmen):**
9. O10 — prefetch-strategie
10. O11 — auth-gate/shell-rendering
11. O14 — providers per route-groep

**Meetplan bij fase 2:** vóór/na `next build` (production) draaien met dev-server gestopt (zie CLAUDE.md-waarschuwing over gedeelde `.next/`), bundle-groottes per route uit de build-output vergelijken; voor O5/O6 React Profiler op de klantenpagina.

## 4. Geraakte bestanden

- package.json
- next.config.ts
- src/app/layout.tsx
- src/app/(dashboard)/layout.tsx
- src/app/(dashboard)/klanten/page.tsx
- src/app/(dashboard)/offertes/page.tsx
- src/app/(dashboard)/offertes/[id]/components/offerte-header.tsx
- src/app/(dashboard)/rapportages/page.tsx
- src/app/(dashboard)/archief/page.tsx
- src/app/(dashboard)/projecten/[id]/factuur/components/workflow-step-indicator.tsx
- src/app/(dashboard)/projecten/[id]/nacalculatie/page.tsx
- src/app/(public)/configurator/layout.tsx
- src/components/pdf/index.ts
- src/components/analytics/index.ts
- src/components/app-sidebar.tsx
- src/components/ui/responsive-table.tsx
- src/components/wagenpark/brandstof-form.tsx
- src/components/wagenpark/kilometer-log.tsx
- src/hooks/use-prefetch.ts
- convex/sidebarTellingen.ts (nieuw)
