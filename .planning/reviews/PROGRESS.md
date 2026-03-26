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
**Status:** [ ] Not Started / [ ] In Progress / [ ] Complete
**Target:** 2026-04-07

| # | Task | Locatie | Severity | Status | Agent | Datum |
|---|------|---------|----------|--------|-------|-------|
| 2.1 | Voeg index toe: `offertes` by `klantId` | `convex/schema.ts` | CRITICAL | [ ] | — | — |
| 2.2 | Voeg index toe: `urenRegistraties` by datum+medewerker | `convex/schema.ts` | CRITICAL | [ ] | — | — |
| 2.3 | Herschrijf voormanDashboard queries (full table scan) | `convex/voormanDashboard.ts` | CRITICAL | [ ] | — | — |
| 2.4 | Herschrijf directieDashboard queries (full table scan) | `convex/directieDashboard.ts` | CRITICAL | [ ] | — | — |
| 2.5 | Herschrijf medewerkerAnalytics queries (5 full scans) | `convex/medewerkerAnalytics.ts` | CRITICAL | [ ] | — | — |
| 2.6 | Fix mobile.ts getWeekHours full table scan | `convex/mobile.ts` | CRITICAL | [ ] | — | — |
| 2.7 | Migreer `urenRegistraties.medewerker` string → `v.id("medewerkers")` | `convex/schema.ts` + migrations | CRITICAL | [ ] | — | — |
| 2.8 | Vervang `v.any()` door specifieke validators (7 locaties) | `convex/schema.ts` | WARNING | [ ] | — | — |
| 2.9 | Fix offset-based pagination → cursor-based | `convex/projecten.ts`, `facturen.ts`, `leveranciers.ts` | WARNING | [ ] | — | — |
| 2.10 | Voeg soft delete toe aan tabellen die het missen | `convex/schema.ts` | WARNING | [ ] | — | — |
| 2.11 | Voeg `updatedAt` toe aan ~16 tabellen die het missen | `convex/schema.ts` | INFO | [ ] | — | — |
| 2.12 | Fix N+1 queries in teams.ts (8 instances) | `convex/teams.ts` | WARNING | [ ] | — | — |

**Fase 2 Score Impact:** Performance C → B, Architecture B- → B

---

## Fase 3: Test Coverage (Week 2-4)
**Status:** [ ] Not Started / [ ] In Progress / [ ] Complete
**Target:** 2026-04-21

| # | Task | Locatie | Severity | Status | Agent | Datum |
|---|------|---------|----------|--------|-------|-------|
| 3.1 | Tests: `calculateTotals()` in offerte-calculator | `src/lib/offerte-calculator.ts` | CRITICAL | [ ] | — | — |
| 3.2 | Tests: BTW (VAT) berekeningen | `src/lib/offerte-calculator.ts` | CRITICAL | [ ] | — | — |
| 3.3 | Tests: Currency parsing (`parseCurrency` NL formaat) | `src/lib/` | CRITICAL | [ ] | — | — |
| 3.4 | Tests: Marge/opslag berekeningen | `src/lib/offerte-calculator.ts` | CRITICAL | [ ] | — | — |
| 3.5 | Tests: Per-scope calculaties (alle 18+ scope types) | `src/lib/offerte-calculator.ts` | CRITICAL | [ ] | — | — |
| 3.6 | Tests: Status transitie logica (`validTransitions`) | `convex/offertes.ts` | CRITICAL | [ ] | — | — |
| 3.7 | Tests: Voorcalculatie calculator (435 regels) | `src/lib/voorcalculatie-calculator.ts` | CRITICAL | [ ] | — | — |
| 3.8 | Tests: Nacalculatie calculator (423 regels) | `src/lib/nacalculatie-calculator.ts` | CRITICAL | [ ] | — | — |
| 3.9 | Tests: 9 Zod validatie schemas (NL formaten) | `src/lib/validations/` | WARNING | [ ] | — | — |
| 3.10 | Integration tests: kritieke Convex mutations | `convex/offertes.ts`, `convex/facturen.ts` | WARNING | [ ] | — | — |

**Fase 3 Score Impact:** Test Coverage F → C+

---

## Fase 4: Code Cleanup (Week 3-4)
**Status:** [ ] Not Started / [ ] In Progress / [ ] Complete
**Target:** 2026-04-21

| # | Task | Locatie | Severity | Status | Agent | Datum |
|---|------|---------|----------|--------|-------|-------|
| 4.1 | Verwijder empty file `enhanced-empty-state.tsx` | `src/components/` | CRITICAL | [ ] | — | — |
| 4.2 | Consolideer pushNotifications.ts + notifications.ts | `convex/` | CRITICAL | [ ] | — | — |
| 4.3 | Consolideer brandstof.ts + brandstofRegistratie.ts | `convex/` | CRITICAL | [ ] | — | — |
| 4.4 | Consolideer duplicate kenteken-plaat componenten | `src/components/` | CRITICAL | [ ] | — | — |
| 4.5 | Verwijder 6 ongebruikte top-level componenten (~1965 regels) | Zie dead-code.md | WARNING | [ ] | — | — |
| 4.6 | Verwijder 20 ongebruikte UI componenten | `src/components/ui/` | WARNING | [ ] | — | — |
| 4.7 | Verwijder 11 ongebruikte hooks (~1865 regels) | `src/hooks/` | WARNING | [ ] | — | — |
| 4.8 | Verwijder 3 ongebruikte lib bestanden | `src/lib/` | WARNING | [ ] | — | — |
| 4.9 | Verwijder 5 ongebruikte Convex modules | `convex/` | WARNING | [ ] | — | — |
| 4.10 | Verwijder 4 ongebruikte API routes | `src/app/api/` | WARNING | [ ] | — | — |
| 4.11 | Verwijder alle console.log statements | Hele codebase | WARNING | [ ] | — | — |
| 4.12 | Verwijder commented-out code blokken | Hele codebase | WARNING | [ ] | — | — |

**Fase 4 Score Impact:** Dead Code D+ → A, ~9.700 regels minder

---

## Fase 5: Architecture & UX (Week 4-6)
**Status:** [ ] Not Started / [ ] In Progress / [ ] Complete
**Target:** 2026-05-05

| # | Task | Locatie | Severity | Status | Agent | Datum |
|---|------|---------|----------|--------|-------|-------|
| 5.1 | Uitbreiden rollenmodel 3→7 rollen (schema + users) | `convex/schema.ts`, `convex/users.ts` | CRITICAL | [ ] | — | — |
| 5.2 | Implementeer granulaire permissies per rol | `convex/` alle functies | CRITICAL | [ ] | — | — |
| 5.3 | Migreer Convex errors: `Error` → `ConvexError` (459 locaties) | `convex/*.ts` | CRITICAL | [ ] | — | — |
| 5.4 | Voeg root `not-found.tsx` toe | `src/app/not-found.tsx` | CRITICAL | [ ] | — | — |
| 5.5 | Voeg `(auth)/not-found.tsx` toe | `src/app/(auth)/not-found.tsx` | CRITICAL | [ ] | — | — |
| 5.6 | Voeg `loading.tsx` toe aan 17 dashboard routes | `src/app/(dashboard)/` | WARNING | [ ] | — | — |
| 5.7 | Fix unmemoized CommandProvider context | `src/components/` of `src/providers/` | CRITICAL | [ ] | — | — |
| 5.8 | Standaardiseer toast patronen (1 patroon) | `src/` breed | WARNING | [ ] | — | — |
| 5.9 | Fix 6 formulieren: raw useState → React Hook Form + Zod | Zie ui-ux-consistency.md | WARNING | [ ] | — | — |
| 5.10 | Fix biometric login flow op mobile | `mobile/app/(auth)/login.tsx` | CRITICAL | [ ] | — | — |
| 5.11 | Fix 14 eslint-disable exhaustive-deps → shared hook | `src/components/offerte/scope-forms/` | WARNING | [ ] | — | — |
| 5.12 | Fix useEffect + setTimeout missing cleanup (3 locaties) | Zie react-patterns.md | WARNING | [ ] | — | — |
| 5.13 | Voeg `DialogDescription` toe aan 4 dialogs (a11y) | Zie ui-ux-consistency.md | WARNING | [ ] | — | — |

**Fase 5 Score Impact:** Architecture B- → A-, Error Handling B- → A, Mobile D → C+

---

## Fase 6: Performance (Week 5-6)
**Status:** [ ] Not Started / [ ] In Progress / [ ] Complete
**Target:** 2026-05-05

| # | Task | Locatie | Severity | Status | Agent | Datum |
|---|------|---------|----------|--------|-------|-------|
| 6.1 | Migreer Framer Motion → LazyMotion/`m` export (107+ files) | `src/` breed | CRITICAL | [ ] | — | — |
| 6.2 | Splits factuur pagina (1536 regels) + voeg useMemo/useCallback | `src/app/(dashboard)/.../factuur/` | WARNING | [ ] | — | — |
| 6.3 | Splits andere 1500+ regel pagina-bestanden | Zie react-patterns.md | WARNING | [ ] | — | — |
| 6.4 | Optimaliseer Sentry Replay: conditional loading | `src/` Sentry config | WARNING | [ ] | — | — |
| 6.5 | Lazy load landing page heavy componenten | `src/app/(public)/` | WARNING | [ ] | — | — |
| 6.6 | Verifieer date-fns tree-shaking | `package.json` / bundel | INFO | [ ] | — | — |
| 6.7 | Verplaats PDF generation naar server-side/worker | `src/` PDF componenten | WARNING | [ ] | — | — |
| 6.8 | Fix hardcoded kleuren in charts → CSS vars | Analytics/dashboard charts | WARNING | [ ] | — | — |

**Fase 6 Score Impact:** Performance C → B+

---

## Fase 7: Scope Compliance (Doorlopend)
**Status:** [ ] Not Started / [ ] In Progress / [ ] Complete
**Target:** Doorlopend

| # | Task | Locatie | Severity | Status | Agent | Datum |
|---|------|---------|----------|--------|-------|-------|
| 7.1 | Implementeer Onderhoudscontracten & SLA module | Nieuw: `convex/onderhoud.ts` + UI | CRITICAL (P1) | [ ] | — | — |
| 7.2 | Implementeer Boekhoudkoppeling | Nieuw: `convex/boekhouding.ts` + UI | CRITICAL (P1) | [ ] | — | — |
| 7.3 | Implementeer Garantiebeheer & Servicemeldingen | Nieuw: `convex/garantie.ts` + UI | CRITICAL (P2) | [ ] | — | — |
| 7.4 | Fix false positives in feature_list.json (EML-001, EML-005) | `.planning/feature_list.json` | CRITICAL | [ ] | — | — |
| 7.5 | Implementeer email template library + admin UI | `convex/emailTemplates.ts` + UI | WARNING | [ ] | — | — |
| 7.6 | Implementeer Resend webhook endpoint (open/click tracking) | `src/app/api/webhooks/resend/` | WARNING | [ ] | — | — |
| 7.7 | Configureer 2FA voor admin users | Clerk dashboard + UI | WARNING | [ ] | — | — |
| 7.8 | Implementeer session timeout | Auth config | WARNING | [ ] | — | — |
| 7.9 | Klant CSV import functionaliteit | UI + Convex action | WARNING | [ ] | — | — |
| 7.10 | Seizoensplanning feature | Planning module | WARNING | [ ] | — | — |

**Fase 7 Score Impact:** Scope C → B+

---

## Score Tracking

| Datum | Security | Tests | Arch | Quality | Perf | Errors | UI/UX | Dead Code | Mobile | Scope | **Overall** |
|-------|----------|-------|------|---------|------|--------|-------|-----------|--------|-------|-------------|
| 2026-03-26 | D | F | B- | C+ | C | B- | B | D+ | D | C | **C-** |
| 2026-03-26 (Fase 1) | B+ | F | B- | C+ | C | B- | B | D+ | C | C | **C+** |
| Fase 2 klaar | — | — | — | — | — | — | — | — | — | — | **—** |
| Fase 3 klaar | — | — | — | — | — | — | — | — | — | — | **—** |
| Fase 4 klaar | — | — | — | — | — | — | — | — | — | — | **—** |
| Fase 5 klaar | — | — | — | — | — | — | — | — | — | — | **—** |
| Fase 6 klaar | — | — | — | — | — | — | — | — | — | — | **—** |
| Fase 7 klaar | — | — | — | — | — | — | — | — | — | — | **—** |

**Target Overall: B+ of hoger**
