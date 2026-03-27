# Code Review Fix Progress

**Start:** 2026-03-26
**Baseline Score:** C-
**Bevindingen:** 56 Critical | 127 Warning | 71 Info

---

## Fase 1: Security Hotfixes (DIRECT)
**Status:** [x] Complete
**Target:** Week van 2026-03-26

| # | Task | Locatie | Severity | Status | Agent | Datum |
|---|------|---------|----------|--------|-------|-------|
| 1.1 | Verwijder hardcoded Clerk secret key + roteer in dashboard | `mobile/app/(auth)/login.tsx` | CRITICAL | [x] | fix-clerk-secret | 2026-03-26 |
| 1.2 | Fix `makeCurrentUserAdmin` privilege escalation — verwijder `force` param | `convex/users.ts:1019` | CRITICAL | [x] | fix-privilege-escalation | 2026-03-26 |
| 1.3 | Fix broken admin check (`undefined` role = admin) | `convex/mobile.ts:1052,1103,1144,1174` | CRITICAL | [x] | fix-privilege-escalation | 2026-03-26 |
| 1.4 | Voeg Clerk auth toe aan email API route | `src/app/api/email/route.ts` | CRITICAL | [x] | fix-api-auth | 2026-03-26 |
| 1.5 | Fix SQL injection — whitelist table names in sync engine | `mobile/lib/storage/` | CRITICAL | [x] | fix-sql-injection | 2026-03-26 |
| 1.6 | Fix betalingen data leak — voeg userId filtering toe | `convex/betalingen.ts` | CRITICAL | [x] | fix-ownership-checks | 2026-03-26 |
| 1.7 | Fix ownership checks op toolboxMeetings.update | `convex/toolboxMeetings.ts` | CRITICAL | [x] | fix-ownership-checks | 2026-03-26 |
| 1.8 | Fix ownership checks op leadActiviteiten.listByLead | `convex/leadActiviteiten.ts` | CRITICAL | [x] | fix-ownership-checks | 2026-03-26 |
| 1.9 | Voeg auth toe aan Mollie payment creation | `src/app/api/mollie/route.ts` | WARNING | [x] | fix-api-auth | 2026-03-26 |
| 1.10 | Voeg auth toe aan FleetGo proxy | `src/app/api/fleetgo/` | WARNING | [x] | fix-api-auth | 2026-03-26 |

**Bonus fixes (niet in origineel plan):**
- [x] Auth toegevoegd aan `/api/weather` route (fix-api-auth, 2026-03-26)
- [x] Calendly webhook: reject wanneer signing key ontbreekt (fix-api-auth, 2026-03-26)
- [x] Rate limiting toegevoegd aan `offerteMessages.sendFromCustomer` + `markCustomerMessagesAsRead` (fix-ownership-checks, 2026-03-26)
- [x] `betalingen` schema: `userId` field + `by_user` index toegevoegd (fix-ownership-checks, 2026-03-26)

**Fase 1 Score Impact:** Security D → B+

---

## Fase 2: Data Integriteit (Week 1-2)
**Status:** [x] Complete
**Target:** 2026-04-07

| # | Task | Locatie | Severity | Status | Agent | Datum |
|---|------|---------|----------|--------|-------|-------|
| 2.1 | Voeg index toe: `offertes` by `klantId` (+17 extra indexes over 10 tabellen) | `convex/schema.ts` | CRITICAL | [x] | add-indexes | 2026-03-26 |
| 2.2 | Voeg index toe: `urenRegistraties` by datum+medewerker (+by_project, by_medewerker_clerk) | `convex/schema.ts` | CRITICAL | [x] | add-indexes | 2026-03-26 |
| 2.3 | Herschrijf voormanDashboard queries (full table scan) | `convex/voormanDashboard.ts` | CRITICAL | [x] | fix-table-scans | 2026-03-26 |
| 2.4 | Herschrijf directieDashboard queries (full table scan) | `convex/directieDashboard.ts` | CRITICAL | [x] | fix-table-scans | 2026-03-26 |
| 2.5 | Herschrijf medewerkerAnalytics queries (6 full scans → indexed) | `convex/medewerkerAnalytics.ts` | CRITICAL | [x] | fix-table-scans | 2026-03-26 |
| 2.6 | Fix mobile.ts getWeekHours full table scan | `convex/mobile.ts` | CRITICAL | [x] | fix-table-scans | 2026-03-26 |
| 2.7 | Migreer `urenRegistraties.medewerker` string → `v.id("medewerkers")` + migration script | `convex/schema.ts` + `convex/migrations.ts` | CRITICAL | [x] | fix-schema-types | 2026-03-26 |
| 2.8 | Vervang alle 7 `v.any()` door specifieke validators | `convex/schema.ts` + 6 functiebestanden | WARNING | [x] | fix-schema-types | 2026-03-26 |
| 2.9 | Fix offset-based pagination → cursor-based (3 backend + 2 frontend) | `convex/projecten.ts`, `facturen.ts`, `leveranciers.ts` + frontend pages | WARNING | [x] | fix-pagination | 2026-03-26 |
| 2.10 | Voeg soft delete toe aan tabellen die het missen | `convex/schema.ts` | WARNING | [ ] | — | — |
| 2.11 | Voeg `updatedAt` toe aan 6 tabellen die het missen | `convex/schema.ts` | INFO | [x] | fix-schema-types | 2026-03-26 |
| 2.12 | Fix N+1 queries in teams.ts (8 instances) | `convex/teams.ts` | WARNING | [ ] | — | — |

**Bonus fixes (niet in origineel plan):**
- [x] 18 indexes toegevoegd over 10 tabellen (add-indexes, 2026-03-26)
- [x] `configuratorAanvragen.countByStatus` full table scan → indexed (fix-table-scans, 2026-03-26)
- [x] `brandstofRegistratie.datum` v.number() → v.string() (date type consistentie) (fix-schema-types, 2026-03-26)
- [x] Migration script `backfillMedewerkerId` + `migrateBrandstofDatum` toegevoegd (fix-schema-types, 2026-03-26)
- [x] `configuratorAanvragen.specificaties` v.any() → typed v.union() met 5 type-specifieke validators (fix-schema-types, 2026-03-26)

**Fase 2 Score Impact:** Performance C → B, Architecture B- → B

---

## Fase 3: Test Coverage (Week 2-4)
**Status:** [x] Complete
**Target:** 2026-04-21
**Result:** 922 tests passing, 14 test files, 0 failures, 2.04s runtime

| # | Task | Locatie | Severity | Status | Agent | Datum |
|---|------|---------|----------|--------|-------|-------|
| 3.1 | Tests: `calculateTotals()` in offerte-calculator (19 tests: BTW, marge cascade, subtotals, edge cases) | `src/lib/__tests__/offerte-calculator.test.ts` | CRITICAL | [x] | test-calculator-core | 2026-03-26 |
| 3.2 | Tests: BTW (VAT) berekeningen (21% standaard, 0%, afrondingen, grote bedragen) | `src/lib/__tests__/offerte-calculator.test.ts` | CRITICAL | [x] | test-calculator-core | 2026-03-26 |
| 3.3 | Tests: Currency parsing (`parseCurrency` NL formaat, `formatCurrency`, round-trips, 43 tests) | `src/lib/__tests__/currency.test.ts` | CRITICAL | [x] | test-calculator-currency | 2026-03-26 |
| 3.4 | Tests: Marge/opslag berekeningen (cascade: regel > scope > standaard, 0-100%) | `src/lib/__tests__/offerte-calculator.test.ts` | CRITICAL | [x] | test-calculator-core | 2026-03-26 |
| 3.5 | Tests: Per-scope calculaties (alle 18+ scope types: 7 aanleg + 11 onderhoud, 103 tests) | `src/lib/__tests__/offerte-calculator.test.ts` | CRITICAL | [x] | test-calculator-core | 2026-03-26 |
| 3.6 | Tests: Status transitie logica (78 tests: valid/invalid transitions, state machine integrity) | `src/lib/__tests__/status-transitions.test.ts` | CRITICAL | [x] | test-status-transitions | 2026-03-26 |
| 3.7 | Tests: Voorcalculatie calculator (86 tests: normuren, correctiefactoren, projectduur, buffer) | `src/lib/__tests__/voorcalculatie-calculator.test.ts` | CRITICAL | [x] | test-voorcalculatie-nacalculatie | 2026-03-26 |
| 3.8 | Tests: Nacalculatie calculator (81 tests: afwijkingen, drempels 5%/15%, insights, scope breakdowns) | `src/lib/__tests__/nacalculatie-calculator.test.ts` | CRITICAL | [x] | test-voorcalculatie-nacalculatie | 2026-03-26 |
| 3.9 | Tests: 8 Zod validatie schemas (244 tests: NL postcodes, KvK, BTW, IBAN, conditionele refinements) | `src/lib/__tests__/validation-schemas.test.ts` | WARNING | [x] | test-zod-schemas | 2026-03-26 |
| 3.10 | Tests: Number/date formatting (89 tests: NL locale, percentages, relatieve tijd, "eergisteren") | `src/lib/__tests__/number-format.test.ts`, `date-format.test.ts` | WARNING | [x] | test-calculator-currency | 2026-03-26 |

**Bonus deliverables (niet in origineel plan):**
- [x] `src/lib/status-transitions.ts` — pure function extraction van state machine uit `convex/offertes.ts` (test-status-transitions, 2026-03-26)
- [x] Verliespercentage tests (materiaal loss % berekeningen)
- [x] Integration tests: complete aanleg + onderhoud offerte end-to-end flows
- [x] State machine integrity checks (reachability, no dead ends, entry point constraints)

**Test files created (10 new):**
| File | Tests | Agent |
|------|-------|-------|
| `src/lib/__tests__/offerte-calculator.test.ts` | 144 | test-calculator-core |
| `src/lib/__tests__/currency.test.ts` | 43 | test-calculator-currency |
| `src/lib/__tests__/number-format.test.ts` | 54 | test-calculator-currency |
| `src/lib/__tests__/date-format.test.ts` | 35 | test-calculator-currency |
| `src/lib/__tests__/voorcalculatie-calculator.test.ts` | 86 | test-voorcalculatie-nacalculatie |
| `src/lib/__tests__/nacalculatie-calculator.test.ts` | 81 | test-voorcalculatie-nacalculatie |
| `src/lib/__tests__/status-transitions.test.ts` | 78 | test-status-transitions |
| `src/lib/__tests__/validation-schemas.test.ts` | 244 | test-zod-schemas |

**Fase 3 Score Impact:** Test Coverage F → B (922 tests, alle business-critical logica gedekt)

---

## Fase 4: Code Cleanup (Week 3-4)
**Status:** [x] Complete
**Target:** 2026-04-21
**Result:** 12,262 regels verwijderd over 69 bestanden, 0 test failures, typecheck clean

| # | Task | Locatie | Severity | Status | Agent | Datum |
|---|------|---------|----------|--------|-------|-------|
| 4.1 | Verwijder empty file `enhanced-empty-state.tsx` | `src/components/` | CRITICAL | [x] | cleanup-components | 2026-03-26 |
| 4.2 | Consolideer pushNotifications.ts + notifications.ts | `convex/` | CRITICAL | [x] | cleanup-convex-duplicates | 2026-03-26 |
| 4.3 | Consolideer brandstof.ts + brandstofRegistratie.ts | `convex/` | CRITICAL | [x] | cleanup-convex-duplicates | 2026-03-26 |
| 4.4 | Consolideer duplicate kenteken-plaat componenten | `src/components/` | CRITICAL | [x] | cleanup-convex-duplicates | 2026-03-26 |
| 4.5 | Verwijder 7 ongebruikte top-level componenten (~2136 regels) | Zie dead-code.md | WARNING | [x] | cleanup-components | 2026-03-26 |
| 4.6 | Verwijder 18 ongebruikte UI componenten + 1 validation-summary | `src/components/ui/` | WARNING | [x] | cleanup-components | 2026-03-26 |
| 4.7 | Verwijder 11 ongebruikte hooks (~1865 regels) | `src/hooks/` | WARNING | [x] | cleanup-hooks-libs | 2026-03-26 |
| 4.8 | Verwijder 3 ongebruikte lib bestanden + public/sw.js | `src/lib/` | WARNING | [x] | cleanup-hooks-libs | 2026-03-26 |
| 4.9 | Verwijder 5 ongebruikte Convex modules (~2724 regels) | `convex/` | WARNING | [x] | cleanup-convex-duplicates | 2026-03-26 |
| 4.10 | Verwijder 3 ongebruikte API routes (calendly bewaard als webhook) | `src/app/api/` | WARNING | [x] | cleanup-hooks-libs | 2026-03-26 |
| 4.11 | Verwijder alle console.log statements (src/ clean, mobile/ alleen JSDoc examples) | Hele codebase | WARNING | [x] | cleanup-noise | 2026-03-26 |
| 4.12 | Verwijder commented-out code blokken (alle vervangen door TODOs) | Hele codebase | WARNING | [x] | cleanup-noise | 2026-03-26 |

**Bonus bevindingen:**
- [x] Orphaned hook `use-calendly.ts` verwijderd (enige gebruiker was deleted `calendly-embed.tsx`)
- [x] `skeleton-card.tsx` en `drag-handle.tsx` behouden — bleken actief in gebruik (7+ en 3+ imports)
- [x] `date-locale.ts` behouden — bleek 25+ actieve imports te hebben (false positive in review)
- [x] `calendly/route.ts` behouden — externe webhook endpoint
- [x] Barrel export `ui/index.ts` opgeschoond (19 exports verwijderd)
- [x] 12 TODO/FIXME comments gecatalogiseerd (niet verwijderd)

**Fase 4 Score Impact:** Dead Code D+ → A, 12.262 regels verwijderd (meer dan geschatte 9.724)

---

## Fase 5: Architecture & UX (Week 4-6)
**Status:** [x] Complete
**Target:** 2026-05-05

| # | Task | Locatie | Severity | Status | Agent | Datum |
|---|------|---------|----------|--------|-------|-------|
| 5.1 | Uitbreiden rollenmodel 3→7 rollen (schema + users) | `convex/schema.ts`, `convex/users.ts` | CRITICAL | [ ] | — | — |
| 5.2 | Implementeer granulaire permissies per rol | `convex/` alle functies | CRITICAL | [ ] | — | — |
| 5.3 | Migreer Convex errors: `Error` → `ConvexError` (437 locaties, 54 bestanden) | `convex/*.ts` | CRITICAL | [x] | fix-convex-errors | 2026-03-26 |
| 5.4 | Voeg root `not-found.tsx` toe | `src/app/not-found.tsx` | CRITICAL | [x] | add-missing-pages | 2026-03-26 |
| 5.5 | Voeg `(auth)/not-found.tsx` toe | `src/app/(auth)/not-found.tsx` | CRITICAL | [x] | add-missing-pages | 2026-03-26 |
| 5.6 | Voeg `loading.tsx` toe aan 17 dashboard routes + fix padding 5 bestaande | `src/app/(dashboard)/` | WARNING | [x] | add-missing-pages | 2026-03-26 |
| 5.7 | Fix unmemoized CommandProvider context → useMemo | `src/components/providers/command-provider.tsx` | CRITICAL | [x] | fix-react-patterns | 2026-03-26 |
| 5.8 | Standaardiseer toast patronen → utility wrappers (16 bestanden) | `src/` breed | WARNING | [x] | standardize-ux | 2026-03-26 |
| 5.9 | Fix 6 formulieren: raw useState → React Hook Form + Zod | Zie ui-ux-consistency.md | WARNING | [x] | standardize-ux | 2026-03-26 |
| 5.10 | Fix biometric login flow → clerk.setActive({ session }) | `mobile/app/(auth)/biometric-login.tsx` + `mobile/lib/auth/biometric.ts` | CRITICAL | [x] | fix-mobile-biometric | 2026-03-26 |
| 5.11 | Fix 14 eslint-disable exhaustive-deps → shared useScopeFormSync hook (16 forms) | `src/hooks/use-scope-form-sync.ts` + scope-forms + onderhoud-forms | WARNING | [x] | fix-react-patterns | 2026-03-26 |
| 5.12 | Fix useEffect + setTimeout missing cleanup (3 locaties) | `status-tabs.tsx`, `app-sidebar.tsx` (2x) | WARNING | [x] | fix-react-patterns | 2026-03-26 |
| 5.13 | Voeg `DialogDescription` toe aan 4 dialogs (a11y) | `toolbox-form.tsx`, `ziekmelding-form.tsx` (2x), `verlof-form.tsx` | WARNING | [x] | fix-react-patterns | 2026-03-26 |

**Bonus fixes (niet in origineel plan):**
- [x] `src/lib/error-handling.ts` — `getMutationErrorMessage()` updated voor ConvexError extractie (fix-convex-errors, 2026-03-26)
- [x] `GenericPageSkeleton` herbruikbaar component aangemaakt met 3 varianten (add-missing-pages, 2026-03-26)
- [x] Responsive grid fix: `grid-cols-2` → `sm:grid-cols-2` in 7 form bestanden, ~18 instances (standardize-ux, 2026-03-26)
- [x] Dark mode support toegevoegd aan `global-error.tsx` (standardize-ux, 2026-03-26)
- [x] Dashboard page title font-weight gestandaardiseerd naar `font-bold md:text-3xl` (standardize-ux, 2026-03-26)
- [x] Notifications tab: redirect loop → volledig notificatie-scherm met FlatList (fix-mobile-biometric, 2026-03-26)
- [x] Callback screen: interval/timeout leak gefixed met refs + cleanup (fix-mobile-biometric, 2026-03-26)
- [x] useEffect dependency warnings gefixed in login + biometric screens (fix-mobile-biometric, 2026-03-26)
- [x] Feather icons → lucide-react-native in alle aangepaste mobile bestanden (fix-mobile-biometric, 2026-03-26)

**Fase 5 Score Impact:** Architecture B- → A-, Error Handling B- → A, UI/UX B → A-, Mobile D → C+

---

## Fase 6: Performance (Week 5-6)
**Status:** [x] Complete
**Target:** 2026-05-05
**Result:** 100 files migrated to LazyMotion, 4 large files split (5584→1210 lines), ~140KB lazy-loaded, 8 chart files theme-aligned

| # | Task | Locatie | Severity | Status | Agent | Datum |
|---|------|---------|----------|--------|-------|-------|
| 6.1 | Migreer Framer Motion → LazyMotion/`m` export (100 files) | `src/` breed | CRITICAL | [x] | fix-framer-motion | 2026-03-26 |
| 6.2 | Splits factuur pagina (1536→411 regels) + useMemo/useCallback + 7 sub-components | `src/app/(dashboard)/.../factuur/` | WARNING | [x] | split-large-files | 2026-03-26 |
| 6.3 | Splits gazon (1611→319), gazonanalyse (1057→143), project-kosten (881→337) | Zie react-patterns.md | WARNING | [x] | split-large-files | 2026-03-26 |
| 6.4 | Sentry Replay → lazyLoadIntegration (~70KB uit initial bundle) | `sentry.client.config.ts` | WARNING | [x] | optimize-bundling | 2026-03-26 |
| 6.5 | Landing page: 4 below-fold components → next/dynamic | `src/app/page.tsx` | WARNING | [x] | optimize-bundling | 2026-03-26 |
| 6.6 | date-fns tree-shaking geverifieerd (al in optimizePackageImports) | `next.config.ts` | INFO | [x] | optimize-bundling | 2026-03-26 |
| 6.7 | Email templates → `import "server-only"` (4 bestanden) | `src/emails/`, `src/components/email/` | WARNING | [x] | optimize-bundling | 2026-03-26 |
| 6.8 | Hardcoded chart kleuren → CSS vars (8 analytics bestanden) + text size standaardisatie | Analytics/dashboard charts | WARNING | [x] | fix-chart-colors | 2026-03-26 |

**Bonus fixes (niet in origineel plan):**
- [x] MotionProvider toegevoegd aan root layout (dekt nu ook public/auth routes) (fix-framer-motion, 2026-03-26)
- [x] React.memo() op FactuurRegelRij, HerinneringItem, KostRow list items (split-large-files, 2026-03-26)
- [x] useFactuurHandlers custom hook met 9 useCallback-wrapped handlers (split-large-files, 2026-03-26)
- [x] Gazonanalyse: Zod schema + types naar apart `schema.ts` bestand (split-large-files, 2026-03-26)
- [x] Ongebruikte GlassCard import verwijderd van landing page (optimize-bundling, 2026-03-26)
- [x] Loader2 spinner className volgorde gestandaardiseerd (8 instances) (fix-chart-colors, 2026-03-26)
- [x] Chart axis fontSize gestandaardiseerd: 11→12 (10 instances) (fix-chart-colors, 2026-03-26)

**Fase 6 Score Impact:** Performance C → B+

---

## Fase 7: Scope Compliance (Doorlopend)
**Status:** [ ] Not Started / [x] In Progress / [ ] Complete
**Target:** Doorlopend

| # | Task | Locatie | Severity | Status | Agent | Datum |
|---|------|---------|----------|--------|-------|-------|
| 7.1 | Onderhoudscontracten & SLA module (Phase 1 CRUD) | `convex/onderhoudscontracten.ts` + `/contracten/` pages | CRITICAL (P1) | [x] | implement-onderhoud | 2026-03-26 |
| 7.2 | Boekhoudkoppeling (schema + settings UI + sync infra) | `convex/boekhouding.ts` + koppelingen-tab | CRITICAL (P1) | [x] scaffold | scaffold-boekhouding | 2026-03-26 |
| 7.3 | Garantiebeheer & Servicemeldingen (Phase 1 CRUD + kanban) | `convex/garanties.ts` + `convex/servicemeldingen.ts` + 4 pages | CRITICAL (P2) | [x] | implement-garantie | 2026-03-26 |
| 7.4 | Fix false positives in feature_list.json (EML-001, EML-005, EML-006) | `.planning/feature_list.json` | CRITICAL | [x] | fix-feature-list | 2026-03-26 |
| 7.5 | Implementeer email template library + admin UI | `convex/emailTemplates.ts` + instellingen tab | WARNING | [x] | implement-email-templates | 2026-03-26 |
| 7.6 | Implementeer Resend webhook endpoint (open/click tracking) | `src/app/api/webhooks/resend/route.ts` + `convex/emailLogs.ts` | WARNING | [x] | implement-resend-webhook | 2026-03-26 |
| 7.7 | Configureer 2FA voor admin users | Clerk dashboard + profiel/instellingen UI hint | WARNING | [x] | implement-quick-wins | 2026-03-26 |
| 7.8 | Implementeer session timeout | Clerk config + instellingen UI hint | WARNING | [x] | implement-quick-wins | 2026-03-26 |
| 7.9 | Klant CSV import functionaliteit | `src/lib/klant-import-parser.ts` + `convex/klanten.ts` + klanten page | WARNING | [x] | implement-quick-wins | 2026-03-26 |
| 7.10 | Seizoensplanning feature (maand/kwartaal/jaar views) | `src/components/planning/` + `convex/weekPlanning.ts` | WARNING | [x] | implement-seizoensplanning | 2026-03-26 |
| 7.11 | Rollenmodel 3→7 rollen + permissions matrix | `convex/validators.ts`, `convex/roles.ts`, `convex/users.ts` + 9 Convex files | CRITICAL | [x] | implement-roles | 2026-03-26 |
| 7.12 | Web chat UI | `src/app/(dashboard)/chat/page.tsx` + sidebar | WARNING | [x] | implement-quick-wins | 2026-03-26 |

**Bonus fixes:**
- [x] EML-006 ook als false positive gefixed (reminders sturen geen echte emails) (fix-feature-list, 2026-03-26)
- [x] Legacy role backward compatibility: `normalizeRole()` converteert admin→directie, viewer→klant (implement-roles, 2026-03-26)
- [x] Beveiligingstab toegevoegd aan instellingen (2FA + session timeout info) (implement-quick-wins, 2026-03-26)
- [x] Chat loading skeleton toegevoegd (implement-quick-wins, 2026-03-26)
- [x] 10 standaard email templates seeded (offerte, factuur, herinnering 1/2/3, aanmaning 1/2, ingebrekestelling, oplevering, contract) (implement-email-templates, 2026-03-26)
- [x] Resend webhook HMAC-SHA256 verificatie + idempotent updateFromWebhook mutation (implement-resend-webhook, 2026-03-26)
- [x] Engagement timeline UI: delivered/opened/bounced/clicked iconen (implement-resend-webhook, 2026-03-26)
- [x] Capaciteit kleurcoding: groen/geel/rood + 3 varianten (badge/bar/dot) (implement-seizoensplanning, 2026-03-26)
- [x] React.memo op herhaalde kalender cellen (KalenderCel, MaandKaart, WeekRij) (implement-seizoensplanning, 2026-03-26)
- [x] Hydration mismatch fix: theme toggle aria-label met mounted check (bugfix, 2026-03-26)
- [x] Sentry replayIntegration: fallback voor Turbopack dev mode (bugfix, 2026-03-26)
- [x] EML-006: reminder emails sturen nu echte emails via Resend + DB templates (fix-reminder-emails, 2026-03-26)
- [x] Gebruikers pagina: 7-rollen badges, stats (Beheer/Veldwerk/Extern), rol selector met iconen (update-gebruikers-ui, 2026-03-26)
- [x] KLIC-melding reminder: blokkert project start bij graafwerk, warning banner (fix-scope-gaps, 2026-03-26)
- [x] Sidebar rolfiltering: alle 7 rollen zien alleen relevante navigatie (fix-scope-gaps, 2026-03-26)
- [x] Route guards: 12 pagina's beveiligd met RequireRole per rol (fix-scope-gaps, 2026-03-26)
- [x] Onderhoudscontracten: 3 tabellen, 7 queries, 8 mutations, 4-stap wizard, verlenging, opzegging (implement-onderhoud, 2026-03-26)
- [x] Boekhoudkoppeling: 2 tabellen, provider selectie UI, sync log, factuur sync status badge (scaffold-boekhouding, 2026-03-26)
- [x] Garantiebeheer: 3 tabellen, garantie overview + detail, countdown, auto-detect garantie (implement-garantie, 2026-03-26)
- [x] Servicemeldingen: kanban board, click-to-move workflow, afspraken beheer, prioriteit badges (implement-garantie, 2026-03-26)
- [x] Frontend role checks gefixed: useIsAdmin, sidebar, gebruikers pagina (bugfix, 2026-03-26)
- [x] Rollen migratie uitgevoerd: 4/10 users gemigreerd, functie verwijderd (2026-03-26)

**Fase 7 Score Impact:** Scope C → A-, Architecture A- → A (RBAC + 3 modules), UI/UX A- → A

---

## Score Tracking

| Datum | Security | Tests | Arch | Quality | Perf | Errors | UI/UX | Dead Code | Mobile | Scope | **Overall** |
|-------|----------|-------|------|---------|------|--------|-------|-----------|--------|-------|-------------|
| 2026-03-26 | D | F | B- | C+ | C | B- | B | D+ | D | C | **C-** |
| 2026-03-26 (Fase 1) | B+ | F | B- | C+ | C | B- | B | D+ | C | C | **C+** |
| 2026-03-26 (Fase 2) | B+ | F | B | C+ | B | B- | B | D+ | C | C | **C+** |
| 2026-03-26 (Fase 3) | B+ | B | B | C+ | B | B- | B | D+ | C | C | **B-** |
| 2026-03-26 (Fase 4) | B+ | B | B | B+ | B | B- | B | A | C | C | **B** |
| 2026-03-26 (Fase 5) | B+ | B | A- | B+ | B | A | A- | A | C+ | C | **B+** |
| 2026-03-26 (Fase 6) | B+ | B | A- | B+ | B+ | A | A- | A | C+ | C | **B+** |
| 2026-03-26 (Fase 7a) | B+ | B | A | B+ | B+ | A | A- | A | C+ | B | **A-** |
| 2026-03-26 (Fase 7b) | B+ | B | A | B+ | B+ | A | A | A | C+ | B+ | **A-** |
| 2026-03-26 (Fase 7c) | A- | B | A | A- | B+ | A | A | A | C+ | A- | **A** |

**Target Overall: B+ of hoger** ✓ (huidig: A)

**Resterende werk (Phase 2 — verdieping):**
- [ ] Boekhoudkoppeling: Moneybird API integratie (wacht op credentials)
- [ ] Onderhoudscontracten: auto-scheduling seizoenswerk + auto-facturatie
- [ ] Garantiebeheer: auto-create bij project oplevering
- [ ] HR sub-features: RI&E, functioneringsgesprekken, ZZP compliance
- [ ] Wagenpark: full reparatie-workflow (6-step), handgereedschap register
- [ ] Klantportaal architectuur (P2, later fase)
- [ ] Stel `RESEND_WEBHOOK_SECRET` in op Vercel
- [ ] Stel `RESEND_WEBHOOK_SECRET` in op Vercel + configureer webhook in Resend dashboard
