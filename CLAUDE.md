# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Top Tuinen OS — a monorepo for a Dutch landscaping company (Top Tuinen) containing a web app for the whole back office (leads, klanten, offertes, projecten, planning, uren, facturen, klantportaal) and a mobile app for field workers. All UI text is in Dutch. Naming rule: internal product chrome says **Top Tuinen OS**, anything the customer sees (klantportaal, PDF's, e-mail, publieke configurator) says plain **Top Tuinen**.

## Architecture

```
/src/          → Next.js 16 web app (App Router, React 19, Tailwind CSS 4, shadcn/ui)
/mobile/       → React Native Expo 54 app (NativeWind, Expo Router)
/convex/       → Shared serverless backend (65+ function files, schema, auth)
/public/       → Static assets for web
```

- **Convex** is the single backend for both web and mobile — all data, mutations, queries, and business logic live here
- **Clerk** handles auth for both platforms (same project, different SDKs: `@clerk/nextjs` for web, `@clerk/clerk-expo` for mobile)
- Web and mobile do NOT share UI components (different frameworks), but share the Convex backend

## Authentication & Routing (web)

- **Single login terminal:** the app root `/` (`src/app/page.tsx`) IS the login form (custom Clerk `useSignIn`). There are NO `/sign-in` or `/sign-up` routes. Self-service sign-up is disabled in Clerk — staff accounts are created internally; klanten via invitation only.
- **Middleware:** `src/proxy.ts` (Next.js 16 renamed `middleware` → `proxy`). Unauthenticated requests on protected routes go to `/`; authenticated **klanten** are routed to `/portaal/overzicht`, staff to `/dashboard`.
- **Role-based home:** routing uses the **Convex** user role (set immediately by `users.linkKlantAccount`), not the Clerk session claim (which can lag right after sign-up). The login page (`src/app/page.tsx`) and `src/app/(dashboard)/layout.tsx` both redirect klanten to the portal; the dashboard layout also blocks klanten from staff pages.
- **Klant onboarding (invitation flow):**
  1. Admin clicks "Verstuur uitnodiging" on the klanten page → `klanten.sendPortalInvitation` → schedules `portaalEmail.sendClerkInvitation` (Clerk REST `POST /v1/invitations`, `notify:true`). Clerk emails a "set password" link (NOT Resend).
  2. Link → `/portaal/registreren` (Clerk `<SignUp>` via invitation ticket — works even with sign-up restricted) → set password → `/portaal/koppelen` links the Clerk user to the klant record (`users.linkKlantAccount` sets `role:"klant"` and syncs it to Clerk publicMetadata via `users.setClerkMetadata`).
  3. Klant then logs in on `/` like everyone and lands on the portal.
- `/portaal/registreren` is the only public `/portaal` route (invitation accept); all other `/portaal/*` requires auth.
- **Clerk/Convex prerequisites:** Clerk sign-up mode = "Restricted" + Email enabled as identifier; `CLERK_SECRET_KEY` set in the **Convex** env (used by `sendClerkInvitation` + `setClerkMetadata`). Invite redirect base = `NEXT_PUBLIC_APP_URL` / `SITE_URL` (Convex env; prod = `https://toptuinen.app`).

## Commands

### Web App
```bash
npm run dev          # Next.js dev server
npm run build        # Production build
npm run lint         # ESLint
npm run typecheck    # TypeScript check (tsc --noEmit)
npm run test         # Vitest (watch mode)
npm run test:run     # Vitest (single run)
npm run test:coverage
```

### Mobile App
```bash
cd mobile
npx expo start --ios          # Start Expo dev server + iOS simulator
npx expo start --ios --clear  # Start with Metro cache cleared
npm install                   # Flags niet nodig: mobile/.npmrc zet legacy-peer-deps=true
```

### E2E Tests (Playwright)
```bash
npx playwright test                    # Run all E2E tests
npx playwright test configurator      # Run only configurator tests (no auth needed)
npx playwright test --headed           # Run with visible browser
npx playwright install chromium        # Install browser (first time)
```
- Requires `npm run dev` + `npx convex dev` running
- Auth tests need `E2E_CLERK_USER_EMAIL` + `E2E_CLERK_USER_PASSWORD` in `.env.local`
- Uses `@clerk/testing` with `setupClerkTestingToken` to bypass bot detection
- Test user needs `bypass_client_trust: true` in Clerk + `e2e-test@toptuinen.nl` in `ADMIN_EMAILS`

### CI/CD (GitHub Actions)
- `.github/workflows/ci.yml` — runs on push/PR to main: lint, typecheck, unit tests, E2E
- `.github/workflows/playwright.yml` — on-demand E2E with browser selector

### Convex Backend
```bash
npx convex dev       # Start Convex dev server (syncs schema + functions)
npx convex deploy --yes  # Deploy to production
```

## Key Domain Concepts

- **Offerte** = Quote/proposal with status workflow: concept → voorcalculatie → verzonden → geaccepteerd → geweigerd
- **Klant** = Customer
- **Medewerker** = Employee/staff member
- **Aanleg** = New garden installation (scopes: grondwerk, bestrating, **parkeerplaats**, **beregening**, borders, gras, houtwerk, water_elektra, specials)
- **Onderhoud** = Maintenance contracts (scopes incl. reiniging, bemesting, gazonanalyse, mollenbestrijding)
- **Offertetypes (TT-004):** `offertes.type` kent bewust maar twee waarden — `aanleg` en `onderhoud`. De 8 werkzaamheden die kantoor hanteert (Tuinaanleg, Tuinrenovatie, Onderhoud, Beregening, Bestrating, Parkeerplaats, Reiniging, Overige diensten) zijn **startpunten in `NewOfferteDialog`**, niet aparte types: elke tegel opent de juiste wizard met `?scope=…` (meerdere toegestaan). Voeg dus géén literals toe aan `offertes.type` — dat raakt 40+ switch-punten, filters, statistieken en PDF.
- **Regels** = Line items (type: materiaal/arbeid/machine) with hoeveelheid × prijsPerEenheid
- **Nacalculatie** = Post-calculation (comparing estimated vs actual costs)
- **Uren** = Hours/time tracking by field workers

## Web App Structure

- Forms: React Hook Form + Zod validation
- Wizards: Custom hooks (e.g., `useAanlegWizard`) in `src/components/offerte/`
- Scope forms: `src/components/offerte/scope-forms/` — one form per scope type
- Calculator: `src/lib/offerte-calculator.ts` — pricing logic
- PDF generation: React PDF (`@react-pdf/renderer`)
- UI components: shadcn/ui (Radix primitives + Tailwind)

### Een nieuwe aanleg-scope toevoegen

Een scope leeft op ~15 plekken. Volg `parkeerplaats` of `beregening` als blauwdruk
(beide zijn in één keer compleet doorgevoerd) en loop deze lijst af:

1. `convex/validators.ts` — eigen validator + opnemen in `aanlegScopeDataValidator`
2. `src/types/offerte.ts` — `AanlegScope` union + `…Data` interface
3. `src/lib/validations/aanleg-scopes.ts` — zod-schema
4. `useAanlegWizard.ts` — `ScopeData`, `DEFAULT_…`, `INITIAL_WIZARD_DATA`, `SCOPES`,
   `isScopeDataValid`, `scopeValidationErrors`, `scopeValidationHandlers`
5. `scope-forms/<scope>-form.tsx` + export in `scope-forms/index.ts`
6. `AanlegScopeDetailsStep` (case + `SCOPE_ICONS`), `AanlegKlantScopesStep`,
   `scope-change-modal` (beide ook `SCOPE_ICONS`), `AanlegReviewSection` (samenvatting)
7. `src/lib/offerte-calculator.ts` — constanten + `calculate<Scope>` + `switch`-case
8. `src/lib/voorcalculatie-calculator.ts` — uren-case (spiegelt de calculator)
9. Labelmaps (~14 bestanden): zoek op een bestaande scope-naam met
   `grep -rl "parkeerplaats" src convex` en loop die lijst af
10. `convex/normuren.ts` seed, `convex/kwaliteitsControles.ts` checklist,
    `planning-templates.ts` taken/kleur, `scopeMarges` in schema + instellingen + tarieven-tab
11. Tests in `src/lib/__tests__/offerte-calculator.test.ts`

**Val nooit terug op `if (normuur) …`.** `normuren.createDefaults` is idempotent op
"heeft deze user al normuren", dus bestaande bedrijven krijgen nieuwe seed-regels
nóóit. Gebruik `findNormuur(...)?.normuurPerEenheid ?? CONSTANTE`, anders levert de
scope stilzwijgend €0 arbeid op. De fallback-constanten in `offerte-calculator.ts`
zijn realistische schattingen, geen vastgestelde Top Tuinen-tarieven.

### Tabellen: nooit zijwaarts scrollen

De app scrollt bewust nergens horizontaal — liever inkorten. `ResponsiveTable`
(`src/components/ui/responsive-table.tsx`) heeft daarvoor twee kolom-opties:

- `width?: string` — Tailwind-class (`w-[30%]`, `w-[88px]`). Zodra één kolom een
  width heeft, schakelt de tabel naar `table-fixed` en korten lange waarden in.
- `allowOverflow?: boolean` — zet `overflow-hidden` uit; nodig voor knoppenkolommen.

**Val hier niet in:** in `table-fixed` is een px-breedte **geen ondergrens**. Passen
de kolommen samen niet, dan schaalt de browser ze allemaal proportioneel mee — ook
je "vaste" 196px. Een rij met 5 icoonknoppen (≈184px nodig) verliest dan de eerste
knop buiten de cel. Oplossing bij >3 acties: potlood-knop + `DropdownMenu` met
`MoreHorizontal`, kolom `w-[88px]` + `allowOverflow`. Zie `klanten/page.tsx`.

`EmptyState` heeft een `compact`-variant (één regel i.p.v. ~180px). Gebruik die op
overzichtspagina's met meerdere secties, anders is een lege sectie de grootste.

### Werkschermsecties: `SectiePaneel`, niet `<Card>`

`src/components/ui/sectie-paneel.tsx` is het frame voor secties in een dossier of
werkscherm: één rand met een klein uppercase kopje, optioneel een teller en acties
rechts. Bewust géén `<Card>` — die brengt een eigen kop-, padding- en schaduwlaag
mee, en meerdere Cards onder elkaar lezen als losse eilanden. `SectieLegeStaat`
hoort erbij: een lege sectie legt uit waar hij voor is en blijft de kléínste sectie.
In gebruik door Tijdlijn (`components/tijdlijn/klant-tijdlijn.tsx`) en Taken
(`components/klanten/klant-taken-card.tsx`).

Twee patronen die daar zijn vastgelegd:

- **Composer = één regel die openklapt bij focus.** De controlestrip hangt aan
  `group-data-[open=false]/composer:hidden`. Let op: de selects erin renderen in een
  portal, dus focus verlaat de composer — een naïeve `onBlur` klapt hem dicht terwijl
  je een medewerker kiest. `src/__tests__/components/composer-openklappen.test.tsx`
  bewaakt dat.
- **Container-queries, geen viewport-breakpoints.** `SectiePaneel` zet
  `@container/sectie`; smalle varianten schrijf je als `@max-[34rem]/sectie:…`.
  Nodig omdat dezelfde tijdlijn zowel in de brede klantpagina als in de smallere
  Chat-module staat — die moet niet meeliften op de schermbreedte.

- **Het klikvlak is de hele regel, niet het invoerveld.** Het veld is ~19px hoog in
  een regel van ~41px en het icoon links is geen invoerveld; klikken op de regel deed
  daardoor niets. Omdat de knoppen pas ná het openklappen bestaan, leest dat als "de
  knoppen werken niet". Een `onMouseDown` op de regel die `preventDefault()` doet en
  het veld focust lost dat op — met een uitzondering voor echte controls
  (`button, input, textarea, select, a, [role=combobox]`).

**Val hier niet in:** ziet een `grid-cols-[…]` er in de DOM goed uit maar is de
computed `grid-template-columns` één kolom, dan ontbreekt de regel in de stylesheet
en is de dev-server stale. Herstart hem vóór je de code verdenkt — dit heeft al twee
keer een half uur gekost.

**En hier ook niet:** draai nooit `npm run build` terwijl `next dev` loopt. Ze delen
`.next/`, de dev-server blijft daarna oude modules serveren en je meet een versie van
je code die niet meer bestaat. Stop de dev-server, bouw, start hem opnieuw.

## Mobile App Structure

- **Design system:** Premium Organic theme — dark mode with nature-green accents (#4ADE80 primary)
- **Theme tokens:** `mobile/theme/` — colors, typography, spacing, shadows, animations, haptics (single source of truth; tailwind.config.js imports from here)
- **UI components:** `mobile/components/ui/` — 25+ components with CVA variants, Reanimated animations, haptic feedback
- **Navigation:** Expo Router with custom FloatingTabBar (blur, spring animations, Lucide icons — NO emojis as icons)
- **Tabs:** Home (hero project + notifications), Foto's, Uren, Chat, Profiel
- **Hooks:** `mobile/hooks/` — auth, offline sync, photo capture, audio recording, push notifications, Reanimated animation hooks
- **Offline-first:** SQLite local DB + Convex sync engine (`mobile/lib/storage/`)
- **Auth:** Clerk Expo + biometric login (Face ID/Touch ID)

## Convex Patterns

- Schema defined in `convex/schema.ts` with Zod-like validators
- Functions organized by domain: `convex/offertes.ts`, `convex/klanten.ts`, `convex/projecten.ts`, etc.
- Auth via `convex/auth.config.ts` using Clerk provider; helpers in `convex/auth.ts` (`requireAuth`, `requireAuthUserId`, `requireKlant`, etc.)
- **Role-based access (7-role model, see `convex/roles.ts` / `convex/validators.ts`):** `directie` (= admin), `projectleider`, `voorman`, `medewerker`, `klant`, `onderaannemer_zzp`, `materiaalman`. Legacy mapping: `admin`→`directie`, `viewer`→`klant`. `klant` users live in `/portaal`; staff in `/dashboard`.
- **`klantTaken`** (`convex/klantTaken.ts`) — losse to-do's per klant, toewijsbaar aan een
  medewerker. Eigen tabel naast `klantTijdlijn` (wat er gebeurd ís, append-only) en
  `planningTaken` (hangt aan een werkitem). Intern dossier: klantaccounts krijgen op elke
  functie een `AuthError`. UI: `klant-taken-card` op `/klanten/[id]`, teller in de
  klantenlijst, `mijn-taken` op het dashboard.
- **`places` / `placesLogica`** (TT-006) — bedrijfszoeken via Google Places. De sleutel
  (`GOOGLE_MAPS_API_KEY`, dezelfde als voor Distance Matrix) blijft server-side in een
  action. Places wordt per aanroep afgerekend op de sleutel van de app-eigenaar, dus:
  debounce 350 ms + minimaal 3 tekens, sessie-token, krappe `X-Goog-FieldMask`, en een
  rate limit per gebruiker (`checkPlacesRateLimit`). `placesLogica.ts` is puur en wordt
  getest met een gemockte fetch — er gaan nooit echte calls uit in de testsuite.
- **Klant-import** — `src/lib/klant-import-parser.ts` is bewust tolerant: een rij wordt
  alleen geweigerd als er geen náám uit te halen is. Ontbrekende/buitenlandse postcodes en
  onleesbare e-mailadressen leveren een aandachtspunt op, geen fout. Het adresveld van de
  relatie-export ("Dijk 24A, 6127 AG Grevenbicht") wordt gesplitst door van achteren naar
  voren het laatste komma-segment met een postcode te zoeken. `importKlanten` en
  `importLeveranciers` accepteren daarom lege adresvelden en gebruiken
  `normaliseerImportPostcode` (normaliseert, weigert nooit) i.p.v. de strenge varianten.
  Eén gedeelde dialog: `src/components/import/relatie-import-dialog.tsx`.

### Optionele velden in een index: `q.eq(veld, undefined)` is géén lege zoekopdracht

`withIndex("by_offerte", (q) => q.eq("offerteId", project.offerteId))` matcht bij een
ontbrekende `offerteId` **alle** documenten die zelf geen `offerteId` hebben — niet nul.
Met `.unique()` erachter klapt de query zodra er twee van zijn. Zo sloopte één werkitem
zonder offerte de projectdetailpagina, planning, nacalculatie, projectkosten, archief,
dashboard, analytics en rapportages tegelijk (`unique() query returned more than one
result from table voorcalculaties`). Het was een queryfout, geen dubbele data.

Regel: **guard elk optioneel veld voordat je het in een index stopt**, en gebruik
`.unique()` alleen waar het schema uniciteit echt afdwingt — een leesquery mag nooit een
scherm slopen om een dubbele rij. Voor voorcalculaties doet
`convex/lib/voorcalculatieLookup.ts` dit: `voorcalculatieVanProject`,
`voorcalculatieVanOfferte` (undefined → `null`) en `voorcalculatieVoorProject(ctx,
project, voorkeur)`. De `voorkeur` is een parameter omdat bij `createFromOfferte` met
`copyVoorcalculatie` een projectkopie náást het origineel op de offerte bestaat en die
twee uiteen kunnen lopen; elke aanroeper houdt de volgorde die hij had.

## Testing

- **Unit tests:** Vitest + @testing-library/react (1986 tests, 86% coverage)
- **Test files:** `src/__tests__/` — hooks, components, convex logic, lib utilities
- **Test helpers:** `src/__tests__/helpers/convex-mock.ts` — shared Convex mock utilities and factories
- **E2E tests:** Playwright in `e2e/` — configurator, offerte wizards, klant CRUD, projecten, portaal
- **E2E auth:** `e2e/helpers/auth.ts` — Clerk login, navigation helpers, wizard interaction helpers
- **E2E setup:** `e2e/global-setup.ts` + `playwright.config.ts` loads `.env.local` via dotenv
- **A11y tests:** `src/__tests__/a11y/` — axe-core checks on core UI components

## Openstaande acties (stand: 14 aug 2026)

- **Places API (New) staat nog UIT** in Google Cloud voor `GOOGLE_MAPS_API_KEY`. Tot dat
  moment verbergt `BedrijfZoeken` zichzelf (`places.beschikbaar` → false) en werkt
  handmatig invoeren gewoon. Aanzetten = TT-006 live.
- **Fallback-prijzen nalopen.** De constanten voor parkeerplaats en beregening in
  `offerte-calculator.ts` (bv. betonklinker €28/m², kolk €185, pop-up sproeier €45,
  regelkast €285) zijn realistische schattingen, géén vastgestelde Top Tuinen-tarieven.
  Zodra kantoor eigen normuren/producten invoert, winnen die vanzelf.
- **Vier tabellen alleen nagerekend, niet visueel gecontroleerd:** leveranciers,
  medewerkers, wagenpark, machines. De klantentabel is wél gemeten (820–1920px).
- **E2E-auth is stuk (pre-existing):** `e2e/helpers/auth.ts` zoekt een veld `E-mailadres`
  dat niet meer op de loginpagina staat, dus `login()` loopt vast op een timeout. Alle
  geauthenticeerde Playwright-tests falen daardoor. Losstaand van de wijzigingen hierboven.

## Important Notes

- **Dev-server draait niet standaard.** Er staat géén `npm run dev` voor dit project op een
  vaste poort; poort 3000 is bij deze gebruiker Timeline-ERP en 3002 Vitamientje-agent.
  Start hem expliciet en controleer wélke app antwoordt (`/` moet "Top Tuinen" bevatten)
  voordat je een poortnummer doorgeeft.
- **Zie je een layoutwijziging niet terug, herstart de dev-server voordat je de code
  verdenkt.** Tailwind v4 + Turbopack serveert soms een verouderde stylesheet: de classes
  staan dan wel in de DOM maar de bijbehorende CSS-regel ontbreekt. Kost anders een half
  uur debuggen aan correcte code.
- `mobile/.npmrc` zet `legacy-peer-deps=true` — nodig omdat `@clerk/clerk-expo` een `react-dom` peer dependency declareert die botst met de react-versie van Expo SDK 54. Niet verwijderen: zonder dit faalt `npm ci`, o.a. in de EAS Build "Install dependencies" fase waar de vlag niet handmatig meegegeven kan worden. Losse `--legacy-peer-deps` flags zijn hierdoor niet meer nodig.
- Mobile uses `react-native-reanimated` v4.1.1 (not legacy Animated API)
- The web app uses Tailwind CSS v4 (not v3) — different config format than mobile
- Mobile uses NativeWind (Tailwind for RN) with `tailwind.config.js` v3 syntax
- NumberInput/AreaInput components render `<input type="text" inputmode="decimal">`, not `type="number"`
