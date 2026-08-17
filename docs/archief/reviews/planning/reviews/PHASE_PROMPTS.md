# Phase Prompts — Copy-Paste per Fase

Kopieer de prompt voor de gewenste fase naar een nieuw Claude Code gesprek.
Elke prompt lanceert een parallel agent team dat de fixes uitvoert.

---

## Fase 1: Security Hotfixes

```
Je bent de security lead voor het Top Tuinen project in /Users/ricardobos/Projects/Client Work/Top-Tuinen/TOP Offerte Calculator/offerte-builder.

Lees eerst:
- CLAUDE.md
- .planning/reviews/security-audit.md
- .planning/reviews/mobile-review.md
- .planning/reviews/convex-functions.md
- .planning/reviews/PROGRESS.md

Maak een team van 5 agents die PARALLEL de volgende security fixes uitvoeren. Elke agent commit zijn eigen wijzigingen met een duidelijke commit message.

## Agent 1: "fix-clerk-secret"
- Locatie: `mobile/app/(auth)/login.tsx`
- Verwijder de hardcoded `sk_test_...` Clerk secret key
- Vervang door een environment variable reference (CLERK_SECRET_KEY)
- Controleer of er nog meer hardcoded secrets in de hele mobile/ directory staan (grep -r "sk_test\|sk_live\|pk_test\|pk_live\|secret" mobile/)
- Na de fix: herinner de gebruiker om de key te rotaren in het Clerk dashboard

## Agent 2: "fix-privilege-escalation"
- Locatie: `convex/users.ts` (rond regel 1019)
- Vind de `makeCurrentUserAdmin` functie
- Verwijder de `force: true` parameter/optie die auth bypass toestaat
- Maak de functie alleen beschikbaar als internalMutation OF voeg een check toe dat alleen bestaande admins dit kunnen aanroepen
- Controleer of er andere admin-bypass routes zijn in convex/users.ts
- Locatie: `convex/mobile.ts:1052,1103,1144,1174`
- Fix het patroon `user.role && user.role !== "admin"` — dit geeft admin access bij `undefined` role
- Correcte check: `if (!user.role || user.role !== "admin") throw new Error("Geen admin rechten")`
- Fix ALLE 4 locaties

## Agent 3: "fix-api-auth"
- Locatie: `src/app/api/email/route.ts`
- Voeg Clerk auth check toe aan het begin van de POST handler
- Pattern: import `auth` from `@clerk/nextjs/server`, check `const { userId } = await auth(); if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });`
- Doe hetzelfde voor `src/app/api/fleetgo/` als die route ook geen auth heeft
- Controleer ALLE routes in `src/app/api/` — welke missen auth? Fix ze allemaal.

## Agent 4: "fix-sql-injection"
- Locatie: `mobile/lib/storage/` — de sync engine
- Vind waar table names via string interpolatie in SQLite queries terechtkomen
- Maak een WHITELIST van toegestane table names
- Valideer table name input tegen deze whitelist VOOR het uitvoeren van queries
- Gebruik parameterized queries waar mogelijk

## Agent 5: "fix-ownership-checks"
- Locatie: `convex/betalingen.ts`
- `betalingen.list` retourneert alle betalingen — voeg userId filter toe
- `betalingen.create` slaat geen userId op — voeg userId toe aan het record
- Locatie: `convex/toolboxMeetings.ts`
- `update` mutation mist ownership check — voeg check toe dat alleen de creator of een admin kan updaten
- Locatie: `convex/leadActiviteiten.ts`
- `listByLead` mist ownership check — beperk tot users die toegang hebben tot de lead
- Voeg ook rate limiting toe aan publieke offerte message endpoints als die bestaan

Na afloop: update .planning/reviews/PROGRESS.md — zet alle Fase 1 taken op [x] met datum.
Draai `npm run typecheck` en `npm run lint` om te verifiëren dat alles compileert.
```

---

## Fase 2: Data Integriteit

```
Je bent de database architect voor het Top Tuinen project in /Users/ricardobos/Projects/Client Work/Top-Tuinen/TOP Offerte Calculator/offerte-builder.

Lees eerst:
- CLAUDE.md
- .planning/reviews/schema-review.md
- .planning/reviews/convex-functions.md
- .planning/reviews/PROGRESS.md

Maak een team van 4 agents die PARALLEL de volgende data integriteit fixes uitvoeren.

## Agent 1: "add-indexes"
Lees `convex/schema.ts` en voeg ontbrekende indexes toe:
- `offertes` tabel: index op `klantId` (8+ queries scannen hier op)
- `urenRegistraties` tabel: index op `medewerker` + `datum` combinatie
- `urenRegistraties` tabel: index op `projectId`
- Check alle queries in `convex/*.ts` — zoek naar `.filter()` calls op velden zonder index
- Voeg indexes toe voor elk veld dat frequent gefilterd wordt
- Documenteer welke indexes je toevoegt en waarom

## Agent 2: "fix-table-scans"
Herschrijf alle full table scan queries:
- `convex/voormanDashboard.ts` — gebruikt `.collect()` op hele tabellen, filter daarna in JS
- `convex/directieDashboard.ts` — zelfde probleem
- `convex/medewerkerAnalytics.ts` — 5 full table scans (urenRegistraties 3x, voorcalculaties 3x)
- `convex/mobile.ts` getWeekHours — scant alle urenRegistraties
- Herschrijf naar indexed queries: gebruik `.withIndex("by_field", q => q.eq("field", value))` pattern
- BELANGRIJK: coördineer met Agent 1 — de indexes moeten matchen met de queries

## Agent 3: "fix-pagination"
Fix de offset-based pagination naar cursor-based:
- `convex/projecten.ts` — handmatige offset/slice paginering
- `convex/facturen.ts` — zelfde probleem
- `convex/leveranciers.ts` — zelfde probleem
- Gebruik Convex's ingebouwde `.paginate(paginationOpts)` pattern
- Pas ook de frontend componenten aan die deze queries gebruiken (search voor `usePaginatedQuery`)

## Agent 4: "fix-schema-types"
Fix type safety in het schema:
- Vervang alle 7 `v.any()` gebruiken door specifieke validators (check schema-review.md voor locaties)
- Migreer `urenRegistraties.medewerker` van `v.string()` naar `v.id("medewerkers")`
  - Dit vereist een data migratie — schrijf een Convex migration script
- Voeg `updatedAt: v.optional(v.number())` toe aan de ~16 tabellen die het missen
- Fix inconsistente datum types (sommige gebruiken number/timestamp, andere string)

Na afloop: update .planning/reviews/PROGRESS.md — zet alle Fase 2 taken op [x] met datum.
Draai `npx convex dev` om schema changes te valideren (of dry-run).
Draai `npm run typecheck` om type errors te checken.
```

---

## Fase 3: Test Coverage

```
Je bent de test lead voor het Top Tuinen project in /Users/ricardobos/Projects/Client Work/Top-Tuinen/TOP Offerte Calculator/offerte-builder.

Lees eerst:
- CLAUDE.md
- .planning/reviews/test-coverage.md
- src/lib/offerte-calculator.ts (de kern-calculator, 2027 regels)
- vitest.config.ts (test configuratie)

Het project heeft <2% test coverage. Alle financiële berekeningen zijn ongetest. Maak een team van 5 agents die PARALLEL tests schrijven.

## Agent 1: "test-calculator-core"
Schrijf uitgebreide tests voor `src/lib/offerte-calculator.ts`:
- Test `calculateTotals()` met diverse inputs
- Test elke scope type calculatie (grondwerk, bestrating, borders, gras, houtwerk, water_elektra, specials)
- Test marge/opslag berekeningen
- Test BTW (21%) berekeningen
- Test afrondingsgedrag
- Edge cases: lege input, negatieve waarden, nul hoeveelheden, extreme waarden
- Schrijf tests in `src/lib/__tests__/offerte-calculator.test.ts`
- Gebruik vitest + describe/it pattern

## Agent 2: "test-calculator-currency"
Schrijf tests voor currency en formatting:
- Test `parseCurrency()` — Nederlands formaat "1.234,56" → 1234.56
- Test `formatCurrency()` — 1234.56 → "€ 1.234,56"
- Edge cases: "0", negatief, heel grote bedragen, ongeldige input, lege string
- Test eventuele andere format/parse utilities
- Schrijf tests in `src/lib/__tests__/currency.test.ts`

## Agent 3: "test-voorcalculatie-nacalculatie"
Schrijf tests voor de voor- en nacalculatie:
- Lees `src/lib/voorcalculatie-calculator.ts` (435 regels) — test alle publieke functies
- Lees `src/lib/nacalculatie-calculator.ts` (423 regels) — test planned vs actual berekeningen
- Test afwijkingspercentages, urentotalen, kostenvergelijkingen
- Schrijf tests in `src/lib/__tests__/voorcalculatie-calculator.test.ts` en `nacalculatie-calculator.test.ts`

## Agent 4: "test-status-transitions"
Schrijf tests voor status/workflow logica:
- Lees `convex/offertes.ts` — vind de `validTransitions` state machine
- Test elke geldige transitie: concept → voorcalculatie → verzonden → geaccepteerd/geweigerd
- Test dat ongeldige transities geweigerd worden
- Test edge cases: dubbele transitie, transitie van eindstatus
- Schrijf tests in `src/lib/__tests__/status-transitions.test.ts`
- Note: je moet de transitie logica mogelijk extracten naar een pure function om het testbaar te maken

## Agent 5: "test-zod-schemas"
Schrijf tests voor alle Zod validatie schemas:
- Vind alle Zod schemas in `src/lib/` en `src/components/` (zoek naar `z.object`)
- Test Nederlandse formaten: postcodes (1234 AB), telefoonnummers, KvK nummers
- Test dat valide input passt en invalide input faalt met juiste error messages
- Test currency input validatie
- Schrijf tests in `src/lib/__tests__/validation-schemas.test.ts`

Na afloop: draai `npm run test:run` om alle tests te runnen. Fix eventuele failures.
Update .planning/reviews/PROGRESS.md — zet alle Fase 3 taken op [x] met datum.
Rapporteer het totale test resultaat (passed/failed/coverage%).
```

---

## Fase 4: Code Cleanup

```
Je bent de code cleanup lead voor het Top Tuinen project in /Users/ricardobos/Projects/Client Work/Top-Tuinen/TOP Offerte Calculator/offerte-builder.

Lees eerst:
- CLAUDE.md
- .planning/reviews/dead-code.md (bevat exacte locaties van alle dead code)
- .planning/reviews/PROGRESS.md

Er zijn ~9.724 regels dead code over 47 bestanden. Maak een team van 4 agents die PARALLEL opruimen. BELANGRIJK: verifieer altijd dat code ECHT ongebruikt is voor je het verwijdert (grep naar imports/usage).

## Agent 1: "cleanup-convex-duplicates"
Consolideer duplicate Convex modules:
- `convex/pushNotifications.ts` vs `convex/notifications.ts` — ~985 regels overlap
  - Bepaal welke het meest compleet is, migreer unieke functies, verwijder het duplicaat
  - Update alle frontend imports
- `convex/brandstof.ts` vs `convex/brandstofRegistratie.ts` — duplicate functionaliteit
  - Zelfde aanpak: consolideer naar 1 bestand
- Verwijder 5 ongebruikte Convex modules (medewerkerAnalytics, medewerkerRapportages, pushNotifications, brandstof, meerwerk)
  - MAAR verifieer eerst dat ze echt niet geimporteerd worden (grep in src/ en mobile/)

## Agent 2: "cleanup-components"
Verwijder ongebruikte componenten:
- Verwijder empty file `enhanced-empty-state.tsx` (0 bytes)
- Consolideer duplicate `kenteken-plaat` componenten (2 directories)
- Verwijder 6 ongebruikte top-level componenten (~1965 regels) — zie dead-code.md voor lijst
- Verwijder 20 ongebruikte UI componenten — zie dead-code.md voor lijst
- VERIFIEER elke component: grep -r "ComponentName" src/ mobile/ — moet 0 results geven
- Update eventuele barrel exports (index.ts bestanden)

## Agent 3: "cleanup-hooks-libs"
Verwijder ongebruikte hooks en lib bestanden:
- Verwijder 11 ongebruikte hooks (~1865 regels) — zie dead-code.md voor lijst
- Verwijder 3 ongebruikte lib bestanden — zie dead-code.md voor lijst
- Verwijder 4 ongebruikte API routes (calendly, summarize, transcribe, weather)
- VERIFIEER elk: grep dat ze nergens geimporteerd worden

## Agent 4: "cleanup-noise"
Verwijder code noise:
- Verwijder alle `console.log` statements uit productie code
  - grep -rn "console\.log" src/ convex/ --include="*.ts" --include="*.tsx"
  - BEWAAR console.error en console.warn (die zijn nuttig)
  - BEWAAR console.log in test bestanden
- Verwijder commented-out code blokken (meer dan 3 regels aaneengesloten uitgecommentarieerd)
- Catalogiseer alle TODO/FIXME/HACK comments (niet verwijderen, wel rapporteren)

Na afloop: draai `npm run typecheck && npm run lint && npm run build` om te verifiëren.
Update .planning/reviews/PROGRESS.md — zet alle Fase 4 taken op [x] met datum.
Rapporteer hoeveel regels code verwijderd zijn.
```

---

## Fase 5: Architecture & UX

```
Je bent de architect voor het Top Tuinen project in /Users/ricardobos/Projects/Client Work/Top-Tuinen/TOP Offerte Calculator/offerte-builder.

Lees eerst:
- CLAUDE.md
- .planning/reviews/react-patterns.md
- .planning/reviews/error-handling.md
- .planning/reviews/ui-ux-consistency.md
- .planning/reviews/scope-compliance.md
- .planning/reviews/mobile-review.md
- .planning/reviews/PROGRESS.md

Maak een team van 5 agents die PARALLEL architectuur en UX verbeteringen doorvoeren.

## Agent 1: "fix-convex-errors"
Migreer alle Convex error handling van `throw new Error()` naar `ConvexError`:
- Er zijn 459 locaties in convex/*.ts
- Import `ConvexError` from "convex/values"
- Vervang `throw new Error("message")` door `throw new ConvexError("message")`
- Voor user-facing errors: gebruik Nederlandse messages
- Groepeer errors in categorieën: auth, validation, not-found, business-logic
- Dit is een systematische find-and-replace maar controleer elke case

## Agent 2: "add-missing-pages"
Voeg ontbrekende Next.js pagina's toe:
- Maak `src/app/not-found.tsx` — nette 404 pagina in Nederlands, shadcn/ui styled
- Maak `src/app/(auth)/not-found.tsx` — 404 voor auth routes
- Maak `loading.tsx` voor de 17 dashboard routes die het missen:
  - Gebruik consistent skeleton pattern (shadcn/ui Skeleton component)
  - Match de padding van de parent layout (`md:p-8`)
  - Maak een herbruikbaar `DashboardSkeleton` component
- Fix de padding mismatch tussen bestaande loading.tsx (`md:p-6`) en pages (`md:p-8`)

## Agent 3: "fix-react-patterns"
Fix React pattern issues:
- Fix unmemoized CommandProvider context value → wrap in useMemo
- Fix 14 eslint-disable exhaustive-deps → extraheer een shared `useScopeFormSync` hook
- Fix useEffect + setTimeout missing cleanup (3 locaties) → voeg clearTimeout toe in return
- Voeg `DialogDescription` toe aan 4 dialogs die het missen (accessibility)
- Fix `"use client"` op dashboard layout als het niet nodig is

## Agent 4: "standardize-ux"
Standaardiseer UX patronen:
- Toast: kies 1 patroon — migreer alles naar de utility wrappers (`showSuccessToast`/`showErrorToast`) OF naar raw `toast()`, niet beide
- Fix 6 formulieren die nog raw useState gebruiken → migreer naar React Hook Form + Zod (dit is de project standaard)
- Fix responsive issues: voeg breakpoints toe aan `grid-cols-2` forms (~15 locaties)
- Fix dark mode support in `global-error.tsx`
- Standaardiseer font-weight in dashboard titles (kies `font-bold` of `font-semibold`)

## Agent 5: "fix-mobile-biometric"
Fix de biometric login flow:
- Locatie: `mobile/app/(auth)/login.tsx`
- Het probleem: tokens worden opgeslagen na biometric setup maar NOOIT gebruikt om Clerk sessies te herstellen
- Fix: na Face ID/Touch ID verificatie, gebruik het opgeslagen token om `signIn.create()` aan te roepen met de juiste Clerk strategy
- Test de flow: opslaan → app sluiten → openen → biometric → sessie hersteld
- Fix ook: notifications tab redirect loop
- Fix ook: interval leak in callback screen (clearInterval in useEffect cleanup)

Na afloop: draai `npm run typecheck && npm run lint && npm run build`.
Update .planning/reviews/PROGRESS.md — zet alle Fase 5 taken op [x] met datum.
```

---

## Fase 6: Performance

```
Je bent de performance engineer voor het Top Tuinen project in /Users/ricardobos/Projects/Client Work/Top-Tuinen/TOP Offerte Calculator/offerte-builder.

Lees eerst:
- CLAUDE.md
- .planning/reviews/performance.md
- .planning/reviews/react-patterns.md
- .planning/reviews/PROGRESS.md

Maak een team van 4 agents die PARALLEL performance verbeteringen doorvoeren.

## Agent 1: "fix-framer-motion"
Migreer Framer Motion van direct `motion` import naar lazy loaded variant:
- Er zijn 107+ bestanden die `import { motion } from "framer-motion"` gebruiken
- Strategie A (voorkeur): Maak een `LazyMotion` provider in de root layout met `domAnimation` feature bundle. Vervang `motion.div` door `m.div` (van `framer-motion`). Dit bespaart ~50-80KB per route.
- Strategie B (alternatief): Verwijder Framer Motion animaties die puur decoratief zijn en vervang door CSS transitions/animations (Tailwind `animate-*` of `transition-*` classes)
- Begin met de meest geladen routes (dashboard, offerte pagina's)
- Test dat animaties nog werken na de migratie

## Agent 2: "split-large-files"
Splits te grote pagina-bestanden op:
- Vind alle bestanden >1000 regels in src/app/ en src/components/
- De factuur pagina (1536 regels) — splits in sub-componenten + voeg useMemo/useCallback toe
- Andere 1500+ regel bestanden — splits op logische grenzen
- Elk sub-component in eigen bestand
- Voeg React.memo() toe aan list item components die in .map() gebruikt worden

## Agent 3: "optimize-bundling"
Optimaliseer bundel grootte:
- Sentry Replay (~70KB) — laad conditionally, alleen in productie of voor een percentage users
- Landing page — lazy load heavy componenten met next/dynamic
- Controleer of @react-email/components niet in de client bundle lekt (moet server-only zijn)
- Verifieer date-fns tree-shaking: import { format } from "date-fns" ipv import * as dateFns
- Check package.json voor andere grote dependencies die geoptimaliseerd kunnen worden

## Agent 4: "fix-chart-colors"
Fix hardcoded kleuren en visuele consistentie:
- Analytics charts gebruiken hardcoded `rgb()`/`hsl()` kleuren
- Dashboard DonutChart gebruikt hardcoded kleuren
- Migreer naar CSS custom properties (--chart-1, --chart-2 etc. uit het shadcn theme)
- Fix `text-[10px]`/`text-[11px]` arbitrary sizes → maak een consistent pattern
- Fix Loader2 spinner sizing inconsistentie

Na afloop: draai `npm run build` en vergelijk bundle sizes (als mogelijk).
Update .planning/reviews/PROGRESS.md — zet alle Fase 6 taken op [x] met datum.
```

---

## Fase 7: Scope Compliance

```
Je bent de product lead voor het Top Tuinen project in /Users/ricardobos/Projects/Client Work/Top-Tuinen/TOP Offerte Calculator/offerte-builder.

Lees eerst:
- CLAUDE.md
- .planning/reviews/scope-compliance.md
- ../TOP_TUINEN_SCOPE_DOCUMENT.md (één directory omhoog)
- .planning/feature_list.json
- .planning/reviews/PROGRESS.md

NOTE: Dit is de grootste fase — het implementeert ontbrekende modules. Dit kan niet in 1 sessie. Begin met de quick wins en plan de grote modules als aparte sprints.

Maak een team van 4 agents die PARALLEL werken.

## Agent 1: "fix-feature-list"
Fix de administratie eerst:
- Open `.planning/feature_list.json`
- EML-001 (email template library) is gemarkeerd als `passes: true` maar er is geen `emailTemplates` tabel of admin UI → fix naar `passes: false`
- EML-005 (Resend webhook voor open/click tracking) is gemarkeerd als `passes: true` maar het endpoint bestaat niet → fix naar `passes: false`
- Herbereken de totalen (was 66/75, moet lager zijn)
- Voeg notes toe bij elke false positive die je vindt

## Agent 2: "implement-roles"
Breid het rollenmodel uit van 3 naar 7 rollen:
- Huidige rollen: admin, medewerker, viewer
- Vereiste rollen: directie, projectleider, voorman, medewerker, klant, onderaannemer_zzp, materiaalman
- Update `convex/schema.ts` — voeg de nieuwe rollen toe aan de user role validator
- Update `convex/users.ts` — pas role checks aan
- Maak een permissions matrix: welke rol mag wat (CRUD per module)
- Implementeer een `hasPermission(user, action, resource)` helper
- Update alle Convex functies die role checks doen
- NOTE: dit is een grote change — maak eerst een plan, dan implementeer stap voor stap

## Agent 3: "implement-quick-wins"
Implementeer de kleinere ontbrekende features:
- 2FA voor admin users — configureer in Clerk dashboard, voeg UI hint toe
- Session timeout — configureer in Clerk
- Klant CSV import — maak een Convex action + upload UI component
- Fix web chat UI als die incompleet is

## Agent 4: "plan-large-modules"
Plan (NIET implementeren) de grote ontbrekende modules:
- Onderhoudscontracten & SLA-beheer (P1) — schrijf een technisch ontwerp
- Boekhoudkoppeling (P1) — schrijf een technisch ontwerp
- Garantiebeheer & Servicemeldingen (P2) — schrijf een technisch ontwerp
- Per module: schema design, API design, UI wireframe beschrijving, geschatte complexiteit
- Schrijf plannen naar `.planning/modules/onderhoud-plan.md`, `boekhouding-plan.md`, `garantie-plan.md`

Na afloop: update .planning/reviews/PROGRESS.md — zet voltooide taken op [x] met datum.
```

---

## Na Elke Fase: Verificatie Prompt

```
Je bent de QA lead voor het Top Tuinen project in /Users/ricardobos/Projects/Client Work/Top-Tuinen/TOP Offerte Calculator/offerte-builder.

Fase [X] is zojuist afgerond. Verifieer het werk:

1. Draai `npm run typecheck` — geen TypeScript errors
2. Draai `npm run lint` — geen lint errors
3. Draai `npm run build` — build succesvol
4. Draai `npm run test:run` — alle tests passing
5. Check `git diff --stat` — welke bestanden zijn gewijzigd?
6. Lees .planning/reviews/PROGRESS.md — zijn alle taken voor Fase [X] op [x] gezet?
7. Re-run de relevante review agents uit de originele review om te verifiëren dat de issues gefixt zijn

Als er problemen zijn: fix ze. Als alles groen is: commit met message "fix(review): complete fase [X] — [korte beschrijving]".

Update de Score Tracking tabel in PROGRESS.md met de nieuwe scores na deze fase.
```
